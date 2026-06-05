"""
每日填报接口
提供每日填报的CRUD和审核操作API
"""

from datetime import date, datetime, timezone
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole
from app.models.report import DailyReport, ReportDetail, ReportStatus, WeeklyReport
from app.schemas.report import (
    DailyReportCreate,
    DailyReportUpdate,
    DailyReportResponse,
    ReportReviewRequest,
    ReportListResponse,
    WeeklyReportCreate,
    WeeklyReportUpdate,
    WeeklyReportResponse,
)
from fastapi import Request
from app.api.deps import get_current_user, require_permission
from app.services.audit_service import log_action, to_dict

# 将本文件内所有的 require_roles 拦截器重映射到 reports 动态权限校验上，实现精细化数据库动态控制
def dynamic_require_roles(*roles):
    async def reports_permission_dependency(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        if current_user.role == UserRole.ADMIN:
            return current_user
            
        path = request.url.path
        
        # 统一映射到 approve_report，只要勾选了填报审核大类，均允许审核操作
        perm = "approve_report"
        
        checker = require_permission(perm)
        return await checker(current_user, db)
        
    return reports_permission_dependency

require_roles = dynamic_require_roles

router = APIRouter(prefix="/reports", tags=["每日填报"])


@router.post("/upload", summary="上传填报图片附件")
async def upload_photo(
    file: UploadFile = File(..., description="填报照片图片"),
    current_user: User = Depends(get_current_user),
):
    """
    上传照片至 Supabase 的 photos 存储桶中，返回公开访问 URL
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只能上传图片文件")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片大小不能超过 10MB")

    # 生成唯一文件名
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"

    # 构造 Supabase Storage 对象的上传 URL
    upload_url = f"{settings.SUPABASE_URL}/storage/v1/object/photos/{filename}"

    headers = {
        "Authorization": f"Bearer {settings.SERVICE_ROLE_KEY}",
        "Content-Type": file.content_type
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(upload_url, content=content, headers=headers, timeout=10.0)
            if resp.status_code not in [200, 201]:
                raise HTTPException(status_code=500, detail=f"上传至 Supabase Storage 失败: {resp.text}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")

    # 获取公开 URL
    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/photos/{filename}"

    return {"url": public_url, "filename": filename}



@router.post("", response_model=DailyReportResponse, status_code=201, summary="创建每日填报")
async def create_report(
    report_in: DailyReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    创建当日填报记录
    每人每天只能有一条填报记录（由数据库唯一约束保证）
    """
    # 检查是否已有当日填报
    existing = await db.execute(
        select(DailyReport).where(
            DailyReport.user_id == current_user.id,
            DailyReport.report_date == report_in.report_date,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"已存在{report_in.report_date}的填报记录",
        )

    # 统计明细，自动计算主表指标数值，不再使用前端输入的原字段手填值
    c_amount = 0.0
    c_count = 0
    h_actions = 0
    t_count = 0
    l_count = 0

    from app.models.report import DetailType

    for detail_in in report_in.details:
        if detail_in.detail_type == DetailType.CONTRACT:
            c_amount += detail_in.amount or 0.0
            c_count += 1
        elif detail_in.detail_type == DetailType.HAPPINESS:
            h_actions += 1
        elif detail_in.detail_type == DetailType.TRIANGLE:
            t_count += 1
        elif detail_in.detail_type == DetailType.LEAD:
            if detail_in.lead_progress == "25%":
                l_count += 1

    # 创建填报主记录
    report = DailyReport(
        user_id=current_user.id,
        report_date=report_in.report_date,
        contract_amount=c_amount,
        contract_count=c_count,
        happiness_actions=h_actions,
        triangle_count=t_count,
        leads_count=l_count,
        work_summary=report_in.work_summary,
        work_reflection=report_in.work_reflection,
        next_day_plan=report_in.next_day_plan,
        standup_notes=report_in.standup_notes,
        status=ReportStatus.DRAFT,
    )
    db.add(report)
    await db.flush()

    # 创建明细记录
    for detail_in in report_in.details:
        detail = ReportDetail(
            report_id=report.id,
            detail_type=detail_in.detail_type,
            customer_name=detail_in.customer_name,
            amount=detail_in.amount,
            lead_progress=detail_in.lead_progress,
            crm_opportunity_id=detail_in.crm_opportunity_id,
            happiness_level=detail_in.happiness_level,
            happiness_standard_id=detail_in.happiness_standard_id,
            description=detail_in.description,
            attachment_urls=detail_in.attachment_urls,
            partner_user_id=detail_in.partner_user_id,
        )
        db.add(detail)

    await db.flush()
    await db.refresh(report)

    # 加载明细及搭档姓名
    result = await db.execute(
        select(DailyReport)
        .options(selectinload(DailyReport.details).selectinload(ReportDetail.partner_user))
        .where(DailyReport.id == report.id)
    )
    loaded_report = result.scalar_one()
    for d in loaded_report.details:
        d.partner_name = d.partner_user.name if d.partner_user else None
    return loaded_report


@router.get("", response_model=ReportListResponse, summary="获取填报列表")
async def list_reports(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    report_date: date | None = Query(None, description="按日期筛选"),
    user_id: int | None = Query(None, description="按用户筛选"),
    team_id: int | None = Query(None, description="按战队筛选"),
    status_filter: str | None = Query(None, alias="status", description="按状态筛选"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取填报列表，支持分页和筛选
    普通员工只能看自己的，战队长只能看本战队成员的，超级管理员/目标官/数字专员可看所有
    """
    query = select(DailyReport).options(selectinload(DailyReport.details))

    # 1. 角色权限过滤
    if current_user.role in [UserRole.STAFF.value, UserRole.MARKETING_STAFF.value, UserRole.TECH_MARKETING.value]:
        # 普通员工（普通、营销、技术营销）强制只看自己的日报
        query = query.where(DailyReport.user_id == current_user.id)
    elif current_user.role == UserRole.TEAM_LEADER.value:
        # 战队长强制只看自己战队成员的日报
        if current_user.team_id is None:
            # 若战队长未分配战队，则无法看到任何数据
            query = query.where(DailyReport.id == -1)
        else:
            # JOIN User 表，强制限定 team_id
            query = query.join(User, DailyReport.user_id == User.id).where(User.team_id == current_user.team_id)
            # 如果战队长传入了特定 user_id 筛选，确保该用户在同一战队内
            if user_id is not None:
                query = query.where(DailyReport.user_id == user_id)
    else:
        # 超级管理员、目标官、数字专员：支持灵活按战队或个人过滤
        if team_id is not None:
            query = query.join(User, DailyReport.user_id == User.id).where(User.team_id == team_id)
        if user_id is not None:
            query = query.where(DailyReport.user_id == user_id)

    # 2. 日期筛选
    if report_date is not None:
        query = query.where(DailyReport.report_date == report_date)

    # 3. 状态筛选
    if status_filter is not None:
        query = query.where(DailyReport.status == status_filter)

    # 4. 排序：按日期降序
    query = query.order_by(DailyReport.report_date.desc())

    # 5. 正确计算过滤后的总条数
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # 6. 分页
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    reports = result.scalars().all()

    return ReportListResponse(total=total, items=reports)


@router.get("/{report_id}", response_model=DailyReportResponse, summary="获取填报详情")
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取指定填报的详细信息"""
    result = await db.execute(
        select(DailyReport)
        .options(selectinload(DailyReport.details))
        .where(DailyReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="填报记录不存在")

    # 权限检查
    if current_user.role == UserRole.STAFF.value and report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权查看他人的填报记录")

    return report


@router.put("/{report_id}", response_model=DailyReportResponse, summary="更新填报")
async def update_report(
    report_id: int,
    report_in: DailyReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    更新填报记录
    只有草稿和被驳回状态的记录可以编辑
    """
    result = await db.execute(
        select(DailyReport)
        .options(selectinload(DailyReport.details))
        .where(DailyReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="填报记录不存在")

    # 权限检查
    if report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能编辑自己的填报记录")

    # 状态检查
    if report.status not in [ReportStatus.DRAFT.value, ReportStatus.REJECTED.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="当前状态不允许编辑",
        )

    # 更新非空字段
    update_data = report_in.model_dump(exclude_unset=True, exclude={"details"})
    for field, value in update_data.items():
        setattr(report, field, value)

    # 更新明细（如果提供了）
    if report_in.details is not None:
        # 删除旧明细
        for detail in report.details:
            await db.delete(detail)
            
        c_amount = 0.0
        c_count = 0
        h_actions = 0
        t_count = 0
        l_count = 0
        
        # 创建新明细并重新计算数值
        for detail_in in report_in.details:
            detail = ReportDetail(
                report_id=report.id,
                detail_type=detail_in.detail_type,
                customer_name=detail_in.customer_name,
                amount=detail_in.amount,
                lead_progress=detail_in.lead_progress,
                crm_opportunity_id=detail_in.crm_opportunity_id,
                happiness_level=detail_in.happiness_level,
                happiness_standard_id=detail_in.happiness_standard_id,
                description=detail_in.description,
                attachment_urls=detail_in.attachment_urls,
                partner_user_id=detail_in.partner_user_id,
            )
            db.add(detail)
            
            if detail_in.detail_type == DetailType.CONTRACT:
                c_amount += detail_in.amount or 0.0
                c_count += 1
            elif detail_in.detail_type == DetailType.HAPPINESS:
                h_actions += 1
            elif detail_in.detail_type == DetailType.TRIANGLE:
                t_count += 1
            elif detail_in.detail_type == DetailType.LEAD:
                if detail_in.lead_progress == "25%":
                    l_count += 1
                
        report.contract_amount = c_amount
        report.contract_count = c_count
        report.happiness_actions = h_actions
        report.triangle_count = t_count
        report.leads_count = l_count

    db.add(report)
    await db.flush()
    await db.refresh(report)

    # 重新加载明细及搭档姓名
    result = await db.execute(
        select(DailyReport)
        .options(selectinload(DailyReport.details).selectinload(ReportDetail.partner_user))
        .where(DailyReport.id == report.id)
    )
    loaded_report = result.scalar_one()
    for d in loaded_report.details:
        d.partner_name = d.partner_user.name if d.partner_user else None
    return loaded_report


@router.post("/{report_id}/submit", summary="提交填报")
async def submit_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """将草稿状态的填报提交并默认自动审核通过"""
    result = await db.execute(
        select(DailyReport).where(DailyReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="填报记录不存在")

    if report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能提交自己的填报记录")

    if report.status not in [ReportStatus.DRAFT.value, ReportStatus.REJECTED.value]:
        raise HTTPException(status_code=400, detail="当前状态不允许提交")

    # 现阶段默认提交直接审核通过
    report.status = ReportStatus.REVIEWED
    report.submitted_at = datetime.now(timezone.utc)
    report.reviewed_at = datetime.now(timezone.utc)
    report.reviewer_id = None
    db.add(report)
    await db.flush()

    # 记录审计日志
    await log_action(
        db=db,
        user=current_user,
        action_type="UPDATE",
        target_module="report",
        target_id=report.id,
        description=f"提交日报并自动审核通过：日期 {report.report_date}",
        before_state=None,
        after_state=to_dict(report)
    )

    # 自动通过后广播通知大屏刷新
    try:
        from app.services.websocket import ws_manager
        await ws_manager.broadcast({"type": "update", "event": "report_approved"})
    except Exception as e:
        # 记录日志，但不影响主逻辑返回
        import logging
        logging.getLogger("battle100").error(f"默认通过大屏 WebSocket 广播失败: {e}")

    return {"message": "填报已提交并默认通过"}


@router.post("/{report_id}/review", summary="审核填报")
async def review_report(
    report_id: int,
    review: ReportReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER, UserRole.TEAM_LEADER)
    ),
):
    """
    审核填报记录
    仅管理员、目标官、战队长可操作。其中战队长只能审核本战队成员。
    """
    result = await db.execute(
        select(DailyReport).where(DailyReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="填报记录不存在")

    # 战队长防越权审查校验
    if current_user.role == UserRole.TEAM_LEADER.value:
        report_user_res = await db.execute(
            select(User.team_id).where(User.id == report.user_id)
        )
        report_user_team_id = report_user_res.scalar()
        if current_user.team_id is None or report_user_team_id != current_user.team_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="权限不足，您无权审核其他战队成员的日报"
            )

    if report.status != ReportStatus.SUBMITTED.value:
        raise HTTPException(status_code=400, detail="只能审核已提交的填报")

    # 状态修改前备份
    before_state = to_dict(report)

    if review.action == "approved":
        report.status = ReportStatus.REVIEWED
    elif review.action == "rejected":
        report.status = ReportStatus.REJECTED
    else:
        raise HTTPException(status_code=400, detail="无效的审核动作")

    report.reviewer_id = current_user.id
    report.reviewed_at = datetime.now(timezone.utc)
    db.add(report)
    await db.flush()

    # 记录审计日志
    action_cn = "审核通过" if review.action == "approved" else "审核驳回"
    await log_action(
        db=db,
        user=current_user,
        action_type="UPDATE",
        target_module="report",
        target_id=report.id,
        description=f"审核日报：日期 {report.report_date}，结果：{action_cn}。备注：{review.comment or '无'}",
        before_state=before_state,
        after_state=to_dict(report),
    )

    # 审核通过后广播通知大屏刷新
    if review.action == "approved":
        try:
            from app.services.websocket import ws_manager
            await ws_manager.broadcast({"type": "update", "event": "report_approved"})
        except Exception as e:
            # 记录日志，但不影响主逻辑返回
            import logging
            logging.getLogger("battle100").error(f"大屏 WebSocket 广播失败: {e}")

    return {"message": f"填报已{review.action}"}


# ==========================================
#              周复盘填报相关 API
# ==========================================

@router.get("/weekly/mine", response_model=WeeklyReportResponse, summary="获取我的周复盘填报")
async def get_my_weekly_report(
    start_date: date = Query(..., description="周开始日期(周一)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """根据开始日期查询当前登录用户的周复盘数据"""
    stmt = select(WeeklyReport).where(
        WeeklyReport.user_id == current_user.id,
        WeeklyReport.start_date == start_date
    )
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="未找到该周的周报")
        
    # 补全用户名
    report.user_name = current_user.name
    return report


@router.post("/weekly", response_model=WeeklyReportResponse, summary="保存或提交周复盘填报")
async def save_weekly_report(
    report_in: WeeklyReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建或更新周复盘填报（支持保存草稿或直接提交）"""
    # 检查是否已存在记录
    stmt = select(WeeklyReport).where(
        WeeklyReport.user_id == current_user.id,
        WeeklyReport.start_date == report_in.start_date
    )
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    
    status_val = report_in.status if report_in.status else "draft"
    submitted_at_val = datetime.now(timezone.utc) if status_val == "submitted" else None
    
    if report:
        # 更新现有记录
        report.delivery_plan = report_in.delivery_plan
        report.sales_plan = report_in.sales_plan
        report.delivery_actual = report_in.delivery_actual
        report.sales_actual = report_in.sales_actual
        report.delivery_rate = report_in.delivery_rate
        report.sales_rate = report_in.sales_rate
        report.delivery_highlights = report_in.delivery_highlights
        report.sales_highlights = report_in.sales_highlights
        report.delivery_blockers = report_in.delivery_blockers
        report.sales_blockers = report_in.sales_blockers
        report.delivery_support = report_in.delivery_support
        report.sales_support = report_in.sales_support
        report.next_delivery_plan = report_in.next_delivery_plan
        report.next_sales_plan = report_in.next_sales_plan
        report.status = status_val
        if submitted_at_val:
            report.submitted_at = submitted_at_val
    else:
        # 创建新记录
        report = WeeklyReport(
            user_id=current_user.id,
            start_date=report_in.start_date,
            end_date=report_in.end_date,
            delivery_plan=report_in.delivery_plan,
            sales_plan=report_in.sales_plan,
            delivery_actual=report_in.delivery_actual,
            sales_actual=report_in.sales_actual,
            delivery_rate=report_in.delivery_rate,
            sales_rate=report_in.sales_rate,
            delivery_highlights=report_in.delivery_highlights,
            sales_highlights=report_in.sales_highlights,
            delivery_blockers=report_in.delivery_blockers,
            sales_blockers=report_in.sales_blockers,
            delivery_support=report_in.delivery_support,
            sales_support=report_in.sales_support,
            next_delivery_plan=report_in.next_delivery_plan,
            next_sales_plan=report_in.next_sales_plan,
            status=status_val,
            submitted_at=submitted_at_val
        )
        db.add(report)
        
    await db.flush()
    await db.commit()
    await db.refresh(report)
    
    # 补充用户名并记录日志
    report.user_name = current_user.name
    
    action_type_str = "SUBMIT" if status_val == "submitted" else "SAVE_DRAFT"
    await log_action(
        db=db,
        user=current_user,
        action_type=action_type_str,
        target_module="weekly_report",
        target_id=report.id,
        description=f"{'提交' if status_val == 'submitted' else '暂存'}周复盘，范围：{report.start_date} ~ {report.end_date}",
        before_state=None,
        after_state=to_dict(report)
    )
    
    return report


@router.get("/weekly/auto-extract", summary="自动从播报系统提取周报实际完成内容")
async def extract_weekly_broadcasts(
    start_date: date = Query(..., description="周开始日期(周一)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    根据 Excel 附件 2 的要求，自动检索并提取该用户在对应周内自己填报的，
    以及该用户是联动人（提报明细或文字正则匹配）的五种核心动作播报信息。
    最后整理成排版优美的实际完成文本，直接提供给前端快速回填。
    """
    from datetime import timedelta, time
    import re
    from app.models.broadcast import BroadcastEvent
    from app.models.report import ReportDetail, DailyReport
    
    end_date = start_date + timedelta(days=6)
    
    # 转换为当周 UTC 时间边界
    start_dt = datetime.combine(start_date, time.min).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(end_date, time.max).replace(tzinfo=timezone.utc)
    
    # 1. 检索当前用户自己直接创建的播报
    stmt_self = select(BroadcastEvent).where(
        BroadcastEvent.user_id == current_user.id,
        BroadcastEvent.event_time >= start_dt,
        BroadcastEvent.event_time <= end_dt,
        BroadcastEvent.event_type.in_(["lead_25", "lead_75", "contract_signed", "triangle", "happiness"])
    )
    res_self = await db.execute(stmt_self)
    broadcasts_self = res_self.scalars().all()
    
    # 2. 检索该用户在日报明细中作为联动搭档关联的播报事件
    stmt_linked = select(BroadcastEvent).join(
        ReportDetail,
        ReportDetail.description.like(func.concat('%[broadcast_id:', BroadcastEvent.id, ']%'))
    ).join(
        DailyReport,
        DailyReport.id == ReportDetail.report_id
    ).where(
        DailyReport.user_id == current_user.id,
        BroadcastEvent.event_time >= start_dt,
        BroadcastEvent.event_time <= end_dt,
        BroadcastEvent.event_type.in_(["lead_25", "lead_75", "contract_signed", "triangle", "happiness"])
    )
    res_linked = await db.execute(stmt_linked)
    broadcasts_linked = res_linked.scalars().all()
    
    # 3. 正则兜底：查找包含“与联动人(姓名)”或“营销人员(姓名)”并包含当前用户的当周所有播报
    stmt_all = select(BroadcastEvent).where(
        BroadcastEvent.event_time >= start_dt,
        BroadcastEvent.event_time <= end_dt,
        BroadcastEvent.event_type.in_(["lead_25", "lead_75", "contract_signed", "triangle", "happiness"])
    )
    res_all = await db.execute(stmt_all)
    broadcasts_all = res_all.scalars().all()
    
    broadcasts_regex = []
    user_name = current_user.name
    for ev in broadcasts_all:
        content = ev.content or ""
        m1 = re.search(r"与联动人\((.*?)\)", content)
        m2 = re.search(r"营销人员\((.*?)\)", content)
        
        is_partner = False
        if m1:
            partners = [n.strip() for n in re.split(r'[，,、\s]', m1.group(1)) if n.strip()]
            if user_name in partners:
                is_partner = True
        if m2:
            partners = [n.strip() for n in re.split(r'[，,、\s]', m2.group(1)) if n.strip()]
            if user_name in partners:
                is_partner = True
                
        if is_partner:
            broadcasts_regex.append(ev)
            
    # 4. 合并去重并按发生时间升序排序
    event_dict = {}
    for ev in broadcasts_self + broadcasts_linked + broadcasts_regex:
        event_dict[ev.id] = ev
        
    all_events = list(event_dict.values())
    all_events.sort(key=lambda x: x.event_time if x.event_time else x.created_at)
    
    # 5. 分门别类排版为交付与销售文本
    delivery_list = []
    sales_list = []
    
    delivery_count = 0
    sales_count = 0
    
    for ev in all_events:
        content_clean = ev.content or ""
        # 清除类似 [broadcast_id:123] 标记
        content_clean = re.sub(r"\s*\[broadcast_id:\d+\]", "", content_clean).strip()
        
        if ev.event_type == "happiness":
            delivery_count += 1
            delivery_list.append(f"{delivery_count}. {content_clean}")
        else:
            sales_count += 1
            prefix = ""
            if ev.event_type == "lead_75":
                prefix = "【中标】"
            elif ev.event_type == "lead_25":
                prefix = "【有效线索】"
            elif ev.event_type == "contract_signed":
                prefix = "【合同签订】"
            elif ev.event_type == "triangle":
                prefix = "【铁三角联动】"
            sales_list.append(f"{sales_count}. {prefix}{content_clean}")
            
    return {
        "delivery_actual": "\n".join(delivery_list) if delivery_list else "1. 无相关客户幸福动作播报",
        "sales_actual": "\n".join(sales_list) if sales_list else "1. 无相关销售播报（新签/中标/合同/铁三角联动）"
    }


@router.get("/weekly/summary", response_model=list[WeeklyReportResponse], summary="获取小组成员周复盘汇总表")
async def get_weekly_reports_summary(
    start_date: date = Query(..., description="周开始日期(周一)"),
    team_id: int | None = Query(None, description="按战队/小组筛选"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取选定周时间段内，小组成员提交的周复盘数据大表（PC端汇总使用）"""
    from app.models.user import User as DbUser
    
    query = select(
        WeeklyReport.id,
        WeeklyReport.user_id,
        WeeklyReport.start_date,
        WeeklyReport.end_date,
        WeeklyReport.delivery_plan,
        WeeklyReport.sales_plan,
        WeeklyReport.delivery_actual,
        WeeklyReport.sales_actual,
        WeeklyReport.delivery_rate,
        WeeklyReport.sales_rate,
        WeeklyReport.delivery_highlights,
        WeeklyReport.sales_highlights,
        WeeklyReport.delivery_blockers,
        WeeklyReport.sales_blockers,
        WeeklyReport.delivery_support,
        WeeklyReport.sales_support,
        WeeklyReport.next_delivery_plan,
        WeeklyReport.next_sales_plan,
        WeeklyReport.status,
        WeeklyReport.submitted_at,
        WeeklyReport.created_at,
        WeeklyReport.updated_at,
        DbUser.name.label("user_name")
    ).join(DbUser, WeeklyReport.user_id == DbUser.id)
    
    if team_id:
        query = query.where(DbUser.team_id == team_id)
        
    query = query.where(WeeklyReport.start_date == start_date)
    query = query.order_by(DbUser.name.asc())
    
    res = await db.execute(query)
    rows = res.all()
    
    items = []
    for row in rows:
        items.append(WeeklyReportResponse(
            id=row.id,
            user_id=row.user_id,
            start_date=row.start_date,
            end_date=row.end_date,
            delivery_plan=row.delivery_plan,
            sales_plan=row.sales_plan,
            delivery_actual=row.delivery_actual,
            sales_actual=row.sales_actual,
            delivery_rate=row.delivery_rate,
            sales_rate=row.sales_rate,
            delivery_highlights=row.delivery_highlights,
            sales_highlights=row.sales_highlights,
            delivery_blockers=row.delivery_blockers,
            sales_blockers=row.sales_blockers,
            delivery_support=row.delivery_support,
            sales_support=row.sales_support,
            next_delivery_plan=row.next_delivery_plan,
            next_sales_plan=row.next_sales_plan,
            status=row.status,
            submitted_at=row.submitted_at,
            created_at=row.created_at,
            updated_at=row.updated_at,
            user_name=row.user_name
        ))
        
    return items
