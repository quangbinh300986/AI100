"""
每日填报接口
提供每日填报的CRUD和审核操作API
"""

from datetime import date, datetime, timezone
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db, get_crm_db
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
    WeeklyReportListResponse,
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
    background_tasks: BackgroundTasks,
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
    
    if status_val == "submitted":
        from app.services.dingtalk import send_weekly_report_to_dingtalk
        background_tasks.add_task(send_weekly_report_to_dingtalk, report, current_user)
        
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
    
    # 5. 统一合并排版为单个完成文本列表
    content_list = []
    for idx, ev in enumerate(all_events, 1):
        content_clean = ev.content or ""
        # 清除类似 [broadcast_id:123] 标记
        content_clean = re.sub(r"\s*\[broadcast_id:\d+\]", "", content_clean).strip()
        # 清除特定的口号文字（包含可能的前后换行、空格和常用标点逗号，以防排版零碎）
        content_clean = re.sub(r"奋战一百天[，,，]?\s*亮剑破六千[！!！]?\s*", "", content_clean)
        content_clean = re.sub(r"[，,，\s\n]*为客户幸福而奋斗[，,，]?\s*赢战百日[！!！]?", "", content_clean)
        content_clean = re.sub(r"[，,，\s\n]*赢战百日[！!！]?", "", content_clean)
        content_clean = content_clean.strip()
        
        prefix = ""
        if ev.event_type == "lead_75":
            prefix = "【中标】"
        elif ev.event_type == "lead_25":
            prefix = "【有效线索】"
        elif ev.event_type == "contract_signed":
            prefix = "【合同签订】"
        elif ev.event_type == "triangle":
            prefix = "【铁三角联动】"
        elif ev.event_type == "happiness":
            prefix = "【幸福动作】"
            
        content_list.append(f"{idx}. {prefix}{content_clean}")
        
    formatted_text = "\n".join(content_list) if content_list else "1. 无相关播报数据"
    
    # 导入所需的用户岗位和角色枚举
    from app.models.user import PositionType, UserRole
    
    # 判断当前用户是否为营销岗或目标官
    is_marketing = (
        current_user.position_type == PositionType.MARKETING 
        or current_user.role in [UserRole.TARGET_OFFICER, UserRole.MARKETING_STAFF, UserRole.TECH_MARKETING]
    )
    
    # 根据身份分岗归入对应的字段，不需填写的字段置空
    if is_marketing:
        return {
            "delivery_actual": "",
            "sales_actual": formatted_text
        }
    else:
        return {
            "delivery_actual": formatted_text,
            "sales_actual": ""
        }


def sync_extract_crm_data(real_name: str, start_date_val: date, is_marketing: bool) -> dict:
    from datetime import timedelta
    from sqlalchemy import text
    
    monday = start_date_val
    sunday = start_date_val + timedelta(days=6)
    
    # 格式化日期参数
    start_date_str = monday.strftime('%Y-%m-%d')
    end_date_str = sunday.strftime('%Y-%m-%d 23:59:59')
    
    result = {
        "delivery_actual": "",
        "sales_actual": "",
        "delivery_rate": "",
        "sales_rate": "",
        "delivery_highlights": "",
        "sales_highlights": "",
        "delivery_blockers": "",
        "sales_blockers": "",
        "delivery_support": "",
        "sales_support": "",
        "next_delivery_plan": "",
        "next_sales_plan": ""
    }
    
    try:
        from app.database import get_crm_db
        with get_crm_db() as conn:
            # 1. 提取计划达成率说明 (根据 responsible_person_alias 匹配当前人在当月的目标)
            target_sql = text("""
                SELECT 
                    SUM(new_sign_target_amount) as target_sign, 
                    SUM(new_sign_actual_amount) as actual_sign,
                    SUM(receive_target_amount) as target_receive, 
                    SUM(receive_actual_amount) as actual_receive
                FROM zdcrm_target_plan_management
                WHERE (responsible_person_alias = :real_name OR create_by = :real_name)
                  AND year = :year AND month = :month
                  AND is_del = '0'
            """)
            target_rows = conn.execute(target_sql, {
                "real_name": real_name,
                "year": monday.year,
                "month": monday.month
            }).mappings().all()
            
            rate_desc = ""
            if target_rows and target_rows[0]["target_sign"] is not None:
                row = target_rows[0]
                t_sign = float(row["target_sign"])
                a_sign = float(row["actual_sign"]) if row["actual_sign"] else 0.0
                t_recv = float(row["target_receive"])
                a_recv = float(row["actual_receive"]) if row["actual_receive"] else 0.0
                
                sign_rate = f"{(a_sign / t_sign * 100):.1f}%" if t_sign > 0 else "—"
                recv_rate = f"{(a_recv / t_recv * 100):.1f}%" if t_recv > 0 else "—"
                
                if is_marketing:
                    rate_desc = f"月度销售新签达成率：{sign_rate} (实际 {a_sign:.1f}万 / 目标 {t_sign:.1f}万)；月度回款达成率：{recv_rate} (实际 {a_recv:.1f}万 / 目标 {t_recv:.1f}万)"
                else:
                    rate_desc = f"本月累计新签达成：{sign_rate}，回款达成：{recv_rate}"
            
            if is_marketing:
                result["sales_rate"] = rate_desc or "月度新签与回款指标正在统计中"
                result["delivery_rate"] = ""
            else:
                result["delivery_rate"] = rate_desc or "月度指标正在统计中"
                result["sales_rate"] = ""
                
            if is_marketing:
                # 2. 营销岗：新签合同 actual
                contract_sql = text("""
                    SELECT contract_name, contract_money_wy 
                    FROM contract 
                    WHERE signer = :real_name 
                      AND signing_date BETWEEN :start_date AND :end_date 
                      AND (is_suspension IS NULL OR is_suspension != '1')
                """)
                contracts = conn.execute(contract_sql, {
                    "real_name": real_name,
                    "start_date": start_date_str,
                    "end_date": end_date_str
                }).mappings().all()
                
                sales_list = []
                c_idx = 1
                if contracts:
                    sales_list.append("本周正式签约合同项目如下：")
                    for c in contracts:
                        sales_list.append(f"  {c_idx}) 【{c['contract_name']}】签署成功，金额：{float(c['contract_money_wy']):.2f} 万元")
                        c_idx += 1
                
                # 3. 营销岗：实际回款 actual
                receive_sql = text("""
                    SELECT r.contract_name, r.receive_money, r.receive_date 
                    FROM zdcrm_contract_receive_money_view r
                    INNER JOIN contract c ON r.contract_id = c.id
                    WHERE c.signer = :real_name 
                      AND r.receive_date BETWEEN :start_date AND :end_date
                """)
                receives = conn.execute(receive_sql, {
                    "real_name": real_name,
                    "start_date": start_date_str,
                    "end_date": end_date_str
                }).mappings().all()
                
                if receives:
                    if not sales_list:
                        sales_list.append("本周到账回款明细：")
                    else:
                        sales_list.append("\n本周到账回款明细：")
                    for r in receives:
                        sales_list.append(f"  {c_idx}) 【{r['contract_name']}】收到回款金额：{float(r['receive_money'] or 0):.2f} 元，到账日期：{r['receive_date'].strftime('%m-%d') if r['receive_date'] else '—'}")
                        c_idx += 1
                
                # 4. 营销岗：客户跟进拜访 actual
                visit_sql = text("""
                    SELECT customer_name, remark, create_time 
                    FROM zdcrm_visit_customer_record 
                    WHERE (create_by = :real_name OR update_by = :real_name)
                      AND create_time BETWEEN :start_date AND :end_date
                      AND is_del = '0'
                    ORDER BY create_time ASC
                """)
                visits = conn.execute(visit_sql, {
                    "real_name": real_name,
                    "start_date": start_date_str,
                    "end_date": end_date_str
                }).mappings().all()
                
                if visits:
                    if not sales_list:
                        sales_list.append("本周拜访/跟进客户动作明细：")
                    else:
                        sales_list.append("\n本周拜访/跟进客户动作明细：")
                    for v in visits:
                        t_str = v['create_time'].strftime('%m-%d') if v['create_time'] else '—'
                        sales_list.append(f"  {c_idx}) 【{t_str}】对接拜访【{v['customer_name']}】(工作记录：{v['remark'] or '未填'})")
                        c_idx += 1
                
                formatted_sales = "\n".join(sales_list) if sales_list else "1. 本周暂无相关的合同新签、到账回款与客户拜访登记。"
                result["sales_actual"] = formatted_sales
                result["delivery_actual"] = ""
                
                # 5. 亮点与卡点智能提取
                highlight_list = []
                blocker_list = []
                
                # 如果有大额签约
                h_idx = 1
                for c in contracts:
                    if float(c['contract_money_wy']) >= 50.0:
                        highlight_list.append(f"  {h_idx}) 成功签订大额合同：【{c['contract_name']}】（金额：{float(c['contract_money_wy']):.2f}万元）")
                        h_idx += 1
                
                if len(visits) >= 3:
                    highlight_list.append(f"  {h_idx}) 本周客户对接频次较高，累计完成 {len(visits)} 次客户拜访与商务洽谈")
                    h_idx += 1
                
                # 卡点检查
                terminated_sql = text("""
                    SELECT remark, action_strategy 
                    FROM zdcrm_target_plan_management
                    WHERE (responsible_person_alias = :real_name OR create_by = :real_name)
                      AND is_terminated = '1' AND is_del = '0'
                      AND year = :year AND month = :month
                """)
                term_projects = conn.execute(terminated_sql, {
                    "real_name": real_name,
                    "year": monday.year,
                    "month": monday.month
                }).mappings().all()
                
                b_idx = 1
                if term_projects:
                    for tp in term_projects:
                        blocker_list.append(f"  {b_idx}) CRM 中标注的中止/预警项目跟进阻碍（备注：{tp['remark'] or '无'}，应对策略：{tp['action_strategy'] or '暂无'}）")
                        b_idx += 1
                
                result["sales_highlights"] = "\n".join(highlight_list) if highlight_list else "1. 本周销售签约及商务拓展平稳推进。"
                result["sales_blockers"] = "\n".join(blocker_list) if blocker_list else "1. 目前名下意向商机及收款合同暂无重大异常阻碍。"
                result["delivery_highlights"] = ""
                result["delivery_blockers"] = ""
                
            else:
                # 6. 交付及其他岗：负责的项目与进度 update（筛选最近一个月内更新过进展且不是100%进展的项目）
                one_month_ago_dt = (monday - timedelta(days=30)).strftime('%Y-%m-%d 23:59:59')
                project_sql = text("""
                    SELECT project_name, project_progress, project_status 
                    FROM project 
                    WHERE project_manager = :real_name
                      AND (project_status IS NULL OR (project_status != '已归档' AND project_status != '已结项'))
                      AND project_progress < 100.0
                      AND update_date >= :one_month_ago
                """)
                projects = conn.execute(project_sql, {
                    "real_name": real_name,
                    "one_month_ago": one_month_ago_dt
                }).mappings().all()
                
                delivery_list = []
                d_idx = 1
                if projects:
                    delivery_list.append("目前负责跟进的在研项目进度情况如下：")
                    for p in projects:
                        delivery_list.append(f"  {d_idx}) 项目【{p['project_name']}】当前总体进度：{float(p['project_progress'] or 0):.1f}%")
                        d_idx += 1
                
                # 7. 里程碑任务实际完成情况
                task_sql = text("""
                    SELECT t.name as task_name, p.project_name, t.milestone 
                    FROM task t
                    INNER JOIN project p ON t.project_id = p.id
                    WHERE p.project_manager = :real_name
                      AND t.finish_date BETWEEN :start_date AND :end_date
                      AND t.status = '0'
                    ORDER BY t.finish_date ASC
                """)
                tasks = conn.execute(task_sql, {
                    "real_name": real_name,
                    "start_date": start_date_str,
                    "end_date": end_date_str
                }).mappings().all()
                
                if tasks:
                    if not delivery_list:
                        delivery_list.append("本周项目子任务及里程碑节点交付动作明细：")
                    else:
                        delivery_list.append("\n本周项目子任务及里程碑节点交付动作明细：")
                    for t in tasks:
                        m_tag = "【里程碑】" if t['milestone'] == '1' else ""
                        delivery_list.append(f"  {d_idx}) {m_tag}完成项目【{t['project_name']}】下的任务节点：【{t['task_name']}】")
                        d_idx += 1
                
                formatted_delivery = "\n".join(delivery_list) if delivery_list else "1. 本周名下负责的在研项目推进平稳，无重大子任务或里程碑完成提交。"
                result["delivery_actual"] = formatted_delivery
                result["sales_actual"] = ""
                
                # 8. 亮点与卡点智能提取
                highlight_list = []
                blocker_list = []
                
                h_idx = 1
                m_tasks = [t for t in tasks if t['milestone'] == '1']
                if m_tasks:
                    highlight_list.append(f"  {h_idx}) 本周成功突破并攻克了 {len(m_tasks)} 个核心项目交付里程碑节点！")
                    h_idx += 1
                
                if len(tasks) >= 3:
                    highlight_list.append(f"  {h_idx}) 本周高效推进并完成了 {len(tasks)} 个项目子项任务交付，项目稳步实施中")
                    h_idx += 1
                
                # 卡点检查
                project_block_sql = text("""
                    SELECT project_name, remarks 
                    FROM project 
                    WHERE project_manager = :real_name
                      AND stop_status = '1'
                """)
                block_projects = conn.execute(project_block_sql, {"real_name": real_name}).mappings().all()
                b_idx = 1
                if block_projects:
                    for bp in block_projects:
                        blocker_list.append(f"  {b_idx}) 交付难点：项目【{bp['project_name']}】处于暂停或异常挂起状态（备注：{bp['remarks'] or '无'}）")
                        b_idx += 1
                
                # 预设立（超过一个月未签合同）项目检查
                presetup_block_sql = text("""
                    SELECT project_name, create_date 
                    FROM project 
                    WHERE project_manager = :real_name
                      AND (project_status IS NULL OR (project_status != '已归档' AND project_status != '已结项'))
                      AND (contract_status = '0' OR contract_status IS NULL)
                      AND create_date < :one_month_ago
                """)
                from datetime import timedelta
                one_month_ago_dt = (monday - timedelta(days=30)).strftime('%Y-%m-%d 23:59:59')
                presetup_projects = conn.execute(presetup_block_sql, {
                    "real_name": real_name,
                    "one_month_ago": one_month_ago_dt
                }).mappings().all()
                if presetup_projects:
                    for pp in presetup_projects:
                        c_date_str = pp['create_date'].strftime('%Y-%m-%d') if pp['create_date'] else '—'
                        blocker_list.append(f"  {b_idx}) 预设立预警：项目【{pp['project_name']}】已立项执行超过一个月，但目前仍未签订正式合同（立项时间：{c_date_str}）")
                        b_idx += 1
                
                # 8.2 已到交付节点还未开发票的项目
                unbilled_node_sql = text("""
                    SELECT DISTINCT p.project_name, p.project_progress, np.project_progress_trigger, cm.installment_money
                    FROM project p
                    INNER JOIN contract_money_urge_notify_project np ON p.id = np.project_id
                    INNER JOIN contract_money cm ON np.contract_money_id = cm.id
                    WHERE p.project_manager = :real_name
                      AND p.project_progress >= np.project_progress_trigger
                      AND (cm.invoic_status IS NULL OR cm.invoic_status = '' OR cm.invoic_status = '0')
                      AND (p.project_status IS NULL OR (p.project_status != '已归档' AND p.project_status != '已结项'))
                """)
                unbilled_projects = conn.execute(unbilled_node_sql, {"real_name": real_name}).mappings().all()
                if unbilled_projects:
                    for up in unbilled_projects:
                        money_str = f"{float(up['installment_money']):,.2f}" if up['installment_money'] is not None else "—"
                        blocker_list.append(
                            f"  {b_idx}) 交付卡点：项目【{up['project_name']}】进度已达 {float(up['project_progress'] or 0):.1f}%"
                            f"（已达收付款触发节点 {float(up['project_progress_trigger'] or 0):.1f}%），"
                            f"但尚未开发票（本阶段合同款项：{money_str}元）"
                        )
                        b_idx += 1

                # 8.3 已开发票还未到账的项目
                unreceived_bill_sql = text("""
                    SELECT DISTINCT p.project_name, br.bill_money, br.un_account_money, br.bill_create_date
                    FROM contract_un_receive_bill_not_receive br
                    INNER JOIN contract_project cp ON br.contract_id = cp.contract_id
                    INNER JOIN project p ON cp.project_id = p.id
                    WHERE p.project_manager = :real_name
                      AND br.un_account_money > 0
                      AND (p.project_status IS NULL OR (p.project_status != '已归档' AND p.project_status != '已结项'))
                """)
                unreceived_projects = conn.execute(unreceived_bill_sql, {"real_name": real_name}).mappings().all()
                if unreceived_projects:
                    for urp in unreceived_projects:
                        bill_money_str = f"{float(urp['bill_money']):,.2f}" if urp['bill_money'] is not None else "—"
                        un_money_str = f"{float(urp['un_account_money']):,.2f}" if urp['un_account_money'] is not None else "—"
                        b_date_str = urp['bill_create_date'].strftime('%Y-%m-%d') if urp['bill_create_date'] else '—'
                        blocker_list.append(
                            f"  {b_idx}) 收欠款预警：项目【{urp['project_name']}】已开发票但尚未回款到账"
                            f"（开票日期：{b_date_str}，开票金额：{bill_money_str}元，未到账金额：{un_money_str}元）"
                        )
                        b_idx += 1
                
                result["delivery_highlights"] = "\n".join(highlight_list) if highlight_list else "1. 交付工作处于正常开发推进中，开发交付无积压。"
                result["delivery_blockers"] = "\n".join(blocker_list) if blocker_list else "1. 本周项目整体推进良好，暂无重大的技术难点与交付卡点。"
                result["sales_highlights"] = ""
                result["sales_blockers"] = ""
                
    except Exception as e:
        import logging
        logging.getLogger("battle100").error(f"从 CRM 库提取数据出错: {e}")
        
    return result


@router.get("/weekly/auto-extract-crm", summary="自动从CRM系统提取周报实际完成和达成情况")
async def extract_weekly_crm_data(
    start_date: date = Query(..., description="周开始日期(周一)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    联动 CRM 数据库，基于当前登录用户的真实姓名（real_name）自动抽取其本周的：
    1. 新签合同与回款明细（营销岗）
    2. 客户拜访跟进频次（营销岗）
    3. 月度新签与回款目标的最新达成率说明（自动计算）
    4. 正在进行的在研项目进度及本周攻克的里程碑子任务（交付岗）
    并自动拼装排版为序号（1. 2. 3.）明细文本，提供一键拉取静默覆盖。
    """
    from fastapi.concurrency import run_in_threadpool
    from app.models.user import PositionType, UserRole
    
    # 岗位判定
    is_marketing = (
        current_user.position_type == PositionType.MARKETING 
        or current_user.role in [UserRole.TARGET_OFFICER, UserRole.MARKETING_STAFF, UserRole.TECH_MARKETING]
    )
    
    # 异步在线程池中调用同步数据库查询
    result = await run_in_threadpool(
        sync_extract_crm_data, 
        current_user.name, # 绑定真实姓名进行跨库匹配
        start_date, 
        is_marketing
    )
    
    return result


@router.get("/weekly/summary", response_model=WeeklyReportListResponse, summary="获取小组成员周复盘汇总表")
async def get_weekly_reports_summary(
    start_date: date = Query(..., description="周开始日期(周一)"),
    team_id: int | None = Query(None, description="按战队/小组筛选"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("view_weekly_reports")),
):
    """获取选定周时间段内，小组成员提交的周复盘数据大表（PC端汇总使用）"""
    # 数据范围权限校验：非管理员和目标官，且有归属战队时，强制绑定为其所属战队
    from app.models.user import UserRole
    if current_user.role not in [UserRole.ADMIN.value, UserRole.TARGET_OFFICER.value] and current_user.team_id is not None:
        team_id = current_user.team_id

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
        DbUser.name.label("user_name"),
        DbUser.position_type.label("user_position_type"),
        DbUser.role.label("user_role")
    ).join(DbUser, WeeklyReport.user_id == DbUser.id)
    
    if team_id:
        query = query.where(DbUser.team_id == team_id)
        
    query = query.where(WeeklyReport.start_date == start_date)
    query = query.order_by(DbUser.name.asc())
    
    # 统计总数
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    # 分页
    query = query.offset((page - 1) * page_size).limit(page_size)
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
            user_name=row.user_name,
            user_position_type=row.user_position_type,
            user_role=row.user_role
        ))
        
    return WeeklyReportListResponse(total=total, items=items)


@router.delete("/weekly/{report_id}", summary="删除指定周报")
async def delete_weekly_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """物理删除某条周报数据，需权限校验"""
    stmt = select(WeeklyReport).where(WeeklyReport.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="未找到该周报记录")
        
    # 权限校验：仅管理员、拥有 delete_weekly_report 权限的角色，或周报所有者本人允许删除
    from app.models.user import UserRole, RolePermission
    has_perm = current_user.role == UserRole.ADMIN.value
    if not has_perm:
        perm_res = await db.execute(
            select(RolePermission).where(
                RolePermission.role == current_user.role,
                RolePermission.menu_key == "delete_weekly_report"
            )
        )
        if perm_res.scalar_one_or_none():
            has_perm = True

    if not has_perm and report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除他人的周报记录")
        
    await db.delete(report)
    await db.commit()
    return {"message": "周报已成功删除"}


from pydantic import BaseModel

class WeeklyBatchDeleteRequest(BaseModel):
    """批量删除请求Schema"""
    ids: list[int]


@router.post("/weekly/batch-delete", summary="批量删除周报记录")
async def batch_delete_weekly_reports(
    req: WeeklyBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """批量物理删除多条周报数据，仅管理员与拥有 delete_weekly_report 权限的角色允许操作"""
    from app.models.user import UserRole, RolePermission
    has_perm = current_user.role == UserRole.ADMIN.value
    if not has_perm:
        perm_res = await db.execute(
            select(RolePermission).where(
                RolePermission.role == current_user.role,
                RolePermission.menu_key == "delete_weekly_report"
            )
        )
        if perm_res.scalar_one_or_none():
            has_perm = True

    if not has_perm:
        raise HTTPException(status_code=403, detail="仅管理员或拥有删除周报权限的角色可以批量删除周报")
        
    from sqlalchemy import delete
    stmt = delete(WeeklyReport).where(WeeklyReport.id.in_(req.ids))
    await db.execute(stmt)
    await db.commit()
    return {"message": f"成功删除 {len(req.ids)} 条周报记录"}


@router.put("/weekly/{report_id}", response_model=WeeklyReportResponse, summary="修改/更新指定周报")
async def update_weekly_report(
    report_id: int,
    report_in: WeeklyReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """修改/更新已有周报内容（支持管理员/拥有 edit_weekly_report 权限者修改他人，或所有人修改自己）"""
    stmt = select(WeeklyReport).where(WeeklyReport.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="未找到该周报记录")
        
    # 权限校验：仅管理员、拥有 edit_weekly_report 权限的角色，或周报所有者本人允许修改
    from app.models.user import UserRole, RolePermission
    has_perm = current_user.role == UserRole.ADMIN.value
    if not has_perm:
        perm_res = await db.execute(
            select(RolePermission).where(
                RolePermission.role == current_user.role,
                RolePermission.menu_key == "edit_weekly_report"
            )
        )
        if perm_res.scalar_one_or_none():
            has_perm = True

    if not has_perm and report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权修改他人的周报记录")
        
    update_data = report_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(report, field, value)
        
    db.add(report)
    await db.commit()
    await db.refresh(report)
    
    # 关联补全被编辑者的用户信息
    from app.models.user import User as DbUser
    user_stmt = select(DbUser).where(DbUser.id == report.user_id)
    user_res = await db.execute(user_stmt)
    db_user = user_res.scalar_one()
    
    report.user_name = db_user.name
    report.user_position_type = db_user.position_type
    report.user_role = db_user.role
    
    return report
