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
from app.models.report import DailyReport, ReportDetail, ReportStatus
from app.schemas.report import (
    DailyReportCreate,
    DailyReportUpdate,
    DailyReportResponse,
    ReportReviewRequest,
    ReportListResponse,
)
from app.api.deps import get_current_user, require_roles

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
    status_filter: str | None = Query(None, alias="status", description="按状态筛选"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取填报列表，支持分页和筛选
    普通员工只能看自己的，管理者可以看下属的
    """
    query = select(DailyReport).options(selectinload(DailyReport.details))

    # 权限过滤：普通员工只看自己的
    if current_user.role == UserRole.STAFF.value:
        query = query.where(DailyReport.user_id == current_user.id)
    elif user_id is not None:
        query = query.where(DailyReport.user_id == user_id)

    # 日期筛选
    if report_date is not None:
        query = query.where(DailyReport.report_date == report_date)

    # 状态筛选
    if status_filter is not None:
        query = query.where(DailyReport.status == status_filter)

    # 排序：按日期降序
    query = query.order_by(DailyReport.report_date.desc())

    # 计算总数
    count_query = select(func.count()).select_from(
        select(DailyReport.id).where(
            *[clause for clause in query.whereclause] if query.whereclause is not None else []
        ).subquery()
    )
    # 简化：使用原query做count
    count_result = await db.execute(
        select(func.count(DailyReport.id)).select_from(DailyReport)
    )
    total = count_result.scalar()

    # 分页
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
    """将草稿状态的填报提交审核"""
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

    report.status = ReportStatus.SUBMITTED
    report.submitted_at = datetime.now(timezone.utc)
    db.add(report)
    await db.flush()

    return {"message": "填报已提交"}


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
    仅管理员、目标官、战队长可操作
    """
    result = await db.execute(
        select(DailyReport).where(DailyReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="填报记录不存在")

    if report.status != ReportStatus.SUBMITTED.value:
        raise HTTPException(status_code=400, detail="只能审核已提交的填报")

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
