"""
播报接口
提供播报事件的查询和手动创建API，并支持快捷将填报数据入库日报与大屏，及直连 CRM 获取项目列表
"""

from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional

from app.database import get_db
from app.models.user import User, UserRole
from app.models.broadcast import BroadcastEvent, EventType, PushStatus
from app.models.report import DailyReport, ReportDetail, ReportStatus, DetailType
from app.api.deps import get_current_user

logger = logging.getLogger("battle100")


async def trigger_broadcast_push(broadcast_id: int):
    """
    后台异步推送战报到钉钉
    """
    from app.database import AsyncSessionLocal
    from app.models.broadcast import BroadcastEvent, PushStatus
    from app.models.user import User as DbUser
    from app.models.organization import Team as DbTeam
    from app.integrations.dingtalk import dingtalk_client
    from sqlalchemy import select
    from datetime import datetime, timezone
    import logging
    
    logger = logging.getLogger("battle100")
    
    async with AsyncSessionLocal() as db:
        try:
            # 1. 查询播报事件及关联的用户、战队
            stmt = select(
                BroadcastEvent, 
                DbUser.name.label("user_name"), 
                DbUser.dingtalk_id.label("user_dingtalk_id"),
                DbTeam.name.label("team_name")
            ).outerjoin(DbUser, BroadcastEvent.user_id == DbUser.id)\
             .outerjoin(DbTeam, BroadcastEvent.team_id == DbTeam.id)\
             .where(BroadcastEvent.id == broadcast_id)
             
            res = await db.execute(stmt)
            row = res.first()
            if not row:
                logger.error(f"推送战报失败：战报ID {broadcast_id} 不存在")
                return
                
            event, user_name, user_dingtalk_id, team_name = row
            
            # 只有 pending 且包含 dingtalk 渠道的才进行发送
            if event.push_status != PushStatus.PENDING:
                logger.info(f"战报ID {broadcast_id} 状态非 PENDING，取消推送")
                return
                
            if "dingtalk" not in event.push_channel and event.push_channel != "all":
                # 非钉钉渠道，直接标记为已发送
                event.push_status = PushStatus.SENT
                event.push_time = datetime.now(timezone.utc)
                db.add(event)
                await db.commit()
                return
                
            # 2. 收集接收工作通知的用户（作为个人兜底）
            dingtalk_users = [user_dingtalk_id] if user_dingtalk_id else []
            
            # 3. 调用推送
            msg_id = await dingtalk_client.push_broadcast_message(
                event_type=event.event_type,
                content=event.content,
                user_name=user_name,
                team_name=team_name,
                dingtalk_users=dingtalk_users
            )
            
            # 4. 根据发送结果更新状态
            if msg_id:
                event.push_status = PushStatus.SENT
                event.dingtalk_msg_id = msg_id
                event.push_time = datetime.now(timezone.utc)
                logger.info(f"战报ID {broadcast_id} 推送钉钉成功，MsgID: {msg_id}")
            else:
                event.push_status = PushStatus.FAILED
                logger.error(f"战报ID {broadcast_id} 推送钉钉失败")
                
            db.add(event)
            await db.commit()
        except Exception as e:
            logger.error(f"推送战报ID {broadcast_id} 发生异常: {e}")
            try:
                stmt = select(BroadcastEvent).where(BroadcastEvent.id == broadcast_id)
                res = await db.execute(stmt)
                event = res.scalar_one_or_none()
                if event:
                    event.push_status = PushStatus.FAILED
                    db.add(event)
                    await db.commit()
            except Exception as inner_err:
                logger.error(f"推送战报异常处理回滚失败: {inner_err}")


router = APIRouter(prefix="/broadcast", tags=["播报"])


class AllocationItem(BaseModel):
    """业绩分摊子项"""
    user_id: int = Field(..., description="系统内部用户ID")
    ratio: float = Field(..., description="分摊比例 (百分比，如 30.0)")
    amount: float = Field(..., description="分摊具体金额 (万元)")


class BroadcastCreate(BaseModel):
    """创建播报请求"""
    event_type: str = Field(..., description="事件类型")
    team_id: Optional[int] = Field(None, description="关联战队ID")
    content: str = Field(..., description="播报内容")
    push_channel: str = Field(default="dingtalk", description="推送渠道")
    
    # 手动快捷填报关联字段
    action_type: Optional[str] = None
    customer_name: Optional[str] = None
    amount: Optional[float] = None
    employee_name: Optional[str] = None
    happiness_score: Optional[int] = None
    action_description: Optional[str] = None
    
    # 新增直连 CRM 录入的增强关联字段
    budget_money: Optional[float] = None
    expect_money: Optional[float] = None
    crm_opportunity_id: Optional[str] = None
    
    # 新增分摊数据字段
    delivery_allocations: Optional[list[AllocationItem]] = None
    marketing_allocations: Optional[list[AllocationItem]] = None
    attachment_urls: Optional[list[str]] = None


class BroadcastResponse(BaseModel):
    """播报响应"""
    id: int
    event_type: str
    user_id: Optional[int] = None
    team_id: Optional[int] = None
    content: Optional[str] = None
    push_status: str
    push_channel: str
    event_time: Optional[datetime] = None
    created_at: datetime
    crm_opportunity_id: Optional[str] = None
    user_name: Optional[str] = None
    team_name: Optional[str] = None
    delivery_allocations: Optional[list[AllocationItem]] = None
    marketing_allocations: Optional[list[AllocationItem]] = None

    model_config = {"from_attributes": True}


@router.get("/crm-projects", summary="直连 CRM 获取特定拓展进度的项目列表")
async def get_crm_projects(
    progress: int = Query(..., description="拓展进度（25、75、90）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    直连 CRM 数据库获取对应进展阶段的项目：
    - 25：拓展进度 25% 的有效线索项目
    - 75：拓展进度 75% 的已中标项目
    - 90：拓展进度 90% 的已签订合同项目
    """
    import pymysql
    from app.config import settings

    try:
        conn = pymysql.connect(
            host=settings.CRM_DB_HOST,
            port=settings.CRM_DB_PORT,
            user=settings.CRM_DB_USER,
            password=settings.CRM_DB_PASSWORD,
            database=settings.CRM_DB_NAME,
            charset='utf8mb4',
            connect_timeout=3
        )
        cur = conn.cursor(pymysql.cursors.DictCursor)
        
        # 只查询未删除、非暂停状态的项目，同时拉取营销人员列 market_user_id
        query = """
            SELECT id, name, customer_name, budget_money, expect_money, progress, market_user_id
            FROM zdcrm_business_opportunity
            WHERE progress = %s
              AND is_del = '0'
              AND (is_suspension = '0' OR is_suspension IS NULL)
            ORDER BY create_time DESC
            LIMIT 500
        """
        cur.execute(query, (progress,))
        projects = cur.fetchall()
        
        # 0. 查询本地系统所有已经关联并使用的 CRM 潜在项目 ID
        used_opp_stmt = select(ReportDetail.crm_opportunity_id).where(
            ReportDetail.crm_opportunity_id.isnot(None),
            ReportDetail.crm_opportunity_id != ""
        )
        used_opp_res = await db.execute(used_opp_stmt)
        used_opp_ids = set(used_opp_res.scalars().all())

        # 批量获取关联人员的中文姓名与本地系统 ID 以免陷入 O(N) 循环查询
        all_user_codes = set()
        for p in projects:
            if p["id"] in used_opp_ids:
                continue
            m_user_str = p.get("market_user_id")
            if m_user_str:
                codes = [c.strip() for c in m_user_str.split(",") if c.strip()]
                all_user_codes.update(codes)

        user_code_to_name = {}
        if all_user_codes:
            placeholders = ",".join(["%s"] * len(all_user_codes))
            sys_user_query = f"SELECT user_code, user_name FROM js_sys_user WHERE user_code IN ({placeholders})"
            cur.execute(sys_user_query, tuple(all_user_codes))
            for row in cur.fetchall():
                user_code_to_name[row["user_code"]] = row["user_name"]

        # 从本地系统批量根据【中文人名】查询映射
        local_user_map = {}
        if user_code_to_name:
            all_names = list(user_code_to_name.values())
            stmt = select(User.id, User.name).where(
                User.name.in_(all_names),
                User.is_active == True
            )
            local_users_res = await db.execute(stmt)
            for uid, uname in local_users_res.all():
                local_user_map[uname] = uid

        results = []
        for p in projects:
            if p["id"] in used_opp_ids:
                continue
            m_users = []
            m_user_str = p.get("market_user_id")
            if m_user_str:
                codes = [c.strip() for c in m_user_str.split(",") if c.strip()]
                for code in codes:
                    uname = user_code_to_name.get(code, code)
                    # 通过真实姓名（人名）匹配本地系统 ID
                    uid = local_user_map.get(uname)
                    m_users.append({
                        "crm_user_id": code,
                        "name": uname,
                        "local_user_id": uid
                    })

            results.append({
                "id": p["id"],
                "name": p["name"] or "未命名项目",
                "customer_name": p["customer_name"] or "未知业主单位",
                "budget_money": float(p["budget_money"] or 0.0),
                "expect_money": float(p["expect_money"] or 0.0),
                "progress": float(p["progress"] or 0.0),
                "marketing_users": m_users
            })
            
        conn.close()
        return results
    except Exception as e:
        logger.error(f"直连 CRM 获取进度为 {progress}% 的项目列表发生异常: {e}")
        return []


class BroadcastListResponse(BaseModel):
    """播报列表响应"""
    total: int = Field(..., description="总数")
    items: list[BroadcastResponse] = Field(..., description="播报列表")


class BroadcastUpdate(BaseModel):
    """修改播报请求"""
    content: Optional[str] = None
    push_status: Optional[str] = None
    push_channel: Optional[str] = None
    crm_opportunity_id: Optional[str] = None
    
    # 支持编辑时联动更新业绩及分摊
    customer_name: Optional[str] = None
    amount: Optional[float] = None
    delivery_allocations: Optional[list[AllocationItem]] = None
    marketing_allocations: Optional[list[AllocationItem]] = None
    happiness_score: Optional[int] = None
    action_description: Optional[str] = None


class BatchDeleteBroadcastRequest(BaseModel):
    """批量删除播报请求"""
    ids: list[int] = Field(..., description="要删除的播报ID列表")


@router.get("/crm-customers", summary="直连 CRM 获取客户名称列表")
async def get_crm_customers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    直连 CRM 数据库获取所有活跃商机的客户名称列表（用于前端下拉选择）
    """
    import pymysql
    from app.config import settings

    try:
        conn = pymysql.connect(
            host=settings.CRM_DB_HOST,
            port=settings.CRM_DB_PORT,
            user=settings.CRM_DB_USER,
            password=settings.CRM_DB_PASSWORD,
            database=settings.CRM_DB_NAME,
            charset='utf8mb4',
            connect_timeout=3
        )
        cur = conn.cursor()
        
        # 优先从商机表中提取所有去重后的唯一客户名称，这对于战报关联最实用且准确
        query = """
            SELECT DISTINCT customer_name 
            FROM zdcrm_business_opportunity 
            WHERE customer_name IS NOT NULL 
              AND customer_name != ''
              AND is_del = '0'
            ORDER BY customer_name ASC
            LIMIT 1000
        """
        cur.execute(query)
        rows = cur.fetchall()
        
        customers = [r[0] for r in rows if r[0]]
        
        # 如果从商机表拿出的偏少，我们也尝试从 crm_customer 表读取作为补充
        if len(customers) < 20:
            try:
                cur.execute("SELECT DISTINCT name FROM crm_customer WHERE is_del = '0' AND name IS NOT NULL AND name != '' ORDER BY name ASC LIMIT 1000")
                cust_rows = cur.fetchall()
                for cr in cust_rows:
                    if cr[0] not in customers:
                        customers.append(cr[0])
            except Exception:
                pass
                
        conn.close()
        return customers
    except Exception as e:
        logger.error(f"直连 CRM 获取客户列表发生异常: {e}")
        return []


@router.get("", response_model=BroadcastListResponse, summary="获取播报列表")
async def list_broadcasts(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    team_id: int | None = Query(None, description="按战队筛选"),
    event_type: str | None = Query(None, description="按事件类型筛选"),
    keyword: str | None = Query(None, description="关键字检索播报内容"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取播报列表（支持分页、关联战队、用户查询及模糊搜索）"""
    from sqlalchemy import func
    from app.models.user import User as DbUser
    from app.models.organization import Team as DbTeam

    # 主查询语句
    query = select(
        BroadcastEvent.id,
        BroadcastEvent.event_type,
        BroadcastEvent.user_id,
        BroadcastEvent.team_id,
        BroadcastEvent.content,
        BroadcastEvent.push_status,
        BroadcastEvent.push_channel,
        BroadcastEvent.event_time,
        BroadcastEvent.created_at,
        BroadcastEvent.crm_opportunity_id,
        DbUser.name.label("user_name"),
        DbTeam.name.label("team_name")
    ).outerjoin(DbUser, BroadcastEvent.user_id == DbUser.id)\
     .outerjoin(DbTeam, BroadcastEvent.team_id == DbTeam.id)\
     .order_by(BroadcastEvent.created_at.desc())

    # 过滤条件
    if team_id:
        query = query.where(BroadcastEvent.team_id == team_id)
    if event_type:
        query = query.where(BroadcastEvent.event_type == event_type)
    if keyword:
        query = query.where(BroadcastEvent.content.contains(keyword))

    # 计算总数
    count_stmt = select(func.count(BroadcastEvent.id))
    if team_id:
        count_stmt = count_stmt.where(BroadcastEvent.team_id == team_id)
    if event_type:
        count_stmt = count_stmt.where(BroadcastEvent.event_type == event_type)
    if keyword:
        count_stmt = count_stmt.where(BroadcastEvent.content.contains(keyword))
    
    total = await db.scalar(count_stmt) or 0

    # 分页
    query = query.offset((page - 1) * page_size).limit(page_size)
    res = await db.execute(query)
    rows = res.all()
    
    # 批量抓取这些 rows 中 crm_opportunity_id 相关的业绩分摊明细，避免 N+1
    opp_ids = [r.crm_opportunity_id for r in rows if r.crm_opportunity_id]
    opp_allocs = {}
    if opp_ids:
        from app.models.report import ReportDetail, DailyReport
        import re
        
        detail_stmt = select(
            ReportDetail.crm_opportunity_id,
            ReportDetail.amount,
            ReportDetail.description,
            DailyReport.user_id
        ).join(DailyReport, ReportDetail.report_id == DailyReport.id)\
         .where(ReportDetail.crm_opportunity_id.in_(opp_ids))
         
        det_res = await db.execute(detail_stmt)
        for det_row in det_res.all():
            opp_id = det_row.crm_opportunity_id
            if opp_id not in opp_allocs:
                opp_allocs[opp_id] = {"delivery": [], "marketing": []}
                
            desc = det_row.description or ""
            ratio = 100.0
            match = re.search(r"分摊\s*\(\s*([0-9.]+)\s*%\s*\)", desc)
            if match:
                ratio = float(match.group(1))
                
            alloc_item = AllocationItem(
                user_id=det_row.user_id,
                ratio=ratio,
                amount=det_row.amount or 0.0
            )
            if "营销" in desc:
                opp_allocs[opp_id]["marketing"].append(alloc_item)
            else:
                opp_allocs[opp_id]["delivery"].append(alloc_item)
    
    items = []
    for row in rows:
        crm_opp = row.crm_opportunity_id
        allocs = opp_allocs.get(crm_opp) if crm_opp else None
        
        items.append(BroadcastResponse(
            id=row.id,
            event_type=row.event_type,
            user_id=row.user_id,
            team_id=row.team_id,
            content=row.content,
            push_status=row.push_status,
            push_channel=row.push_channel,
            event_time=row.event_time,
            created_at=row.created_at,
            crm_opportunity_id=row.crm_opportunity_id,
            user_name=row.user_name,
            team_name=row.team_name,
            delivery_allocations=allocs["delivery"] if allocs else None,
            marketing_allocations=allocs["marketing"] if allocs else None
        ))
        
    return BroadcastListResponse(total=total, items=items)


@router.put("/{id}", response_model=BroadcastResponse, summary="修改播报内容")
async def update_broadcast(
    id: int,
    broadcast_in: BroadcastUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """修改战报播报内容（根据事件类型级联清退旧业绩并重算分摊）"""
    stmt = select(BroadcastEvent).where(BroadcastEvent.id == id)
    res = await db.execute(stmt)
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="战报不存在")
        
    old_opp_id = event.crm_opportunity_id
    new_opp_id = broadcast_in.crm_opportunity_id
    
    # ===== A. 联动清退扣回该战报原先关联的所有日报指标金额与计数 =====
    if old_opp_id:
        from app.models.report import ReportDetail
        detail_stmt = select(ReportDetail).where(ReportDetail.crm_opportunity_id == old_opp_id)
        detail_res = await db.execute(detail_stmt)
        details = detail_res.scalars().all()
        
        for detail in details:
            report_stmt = select(DailyReport).where(DailyReport.id == detail.report_id)
            report_res = await db.execute(report_stmt)
            report = report_res.scalar_one_or_none()
            
            if report:
                if detail.detail_type == DetailType.CONTRACT:
                    report.contract_amount = max(0.0, report.contract_amount - (detail.amount or 0.0))
                    report.contract_count = max(0, report.contract_count - 1)
                elif detail.detail_type == DetailType.LEAD and detail.lead_progress == "25%":
                    report.leads_count = max(0, report.leads_count - 1)
            
            await db.delete(detail)
        await db.flush()

    # ===== B. 更新战报基本文字、推送渠道、以及最新的 CRM 商机关联 =====
    if broadcast_in.content is not None:
        event.content = broadcast_in.content
    if broadcast_in.push_status is not None:
        event.push_status = broadcast_in.push_status
    if broadcast_in.push_channel is not None:
        event.push_channel = broadcast_in.push_channel
    
    # 前三种和 CRM 关联，后两种及自定义不关联
    if event.event_type in ["contract_signed", "lead_75", "lead_25"]:
        event.crm_opportunity_id = new_opp_id if (new_opp_id and new_opp_id != "") else None
    else:
        event.crm_opportunity_id = None
        
    await db.flush()

    # ===== C. 重新计算并录入新业绩明细 =====
    final_opp_id = event.crm_opportunity_id
    
    # 只有当前三种关联 CRM 时，且类型是合同新签或线索，才重新计入系统数据 (中标确定不更新系统实绩)
    if final_opp_id and event.event_type in ["contract_signed", "lead_25"]:
        report_date = event.created_at.date() if event.created_at else datetime.now(timezone.utc).date()
        
        async def get_or_create_report(uid: int) -> DailyReport:
            r_stmt = select(DailyReport).where(
                DailyReport.user_id == uid,
                DailyReport.report_date == report_date
            )
            r_res = await db.execute(r_stmt)
            rep = r_res.scalar_one_or_none()
            if not rep:
                rep = DailyReport(
                    user_id=uid,
                    report_date=report_date,
                    contract_amount=0.0,
                    contract_count=0,
                    happiness_actions=0,
                    triangle_count=0,
                    leads_count=0,
                    status=ReportStatus.REVIEWED,
                    reviewer_id=current_user.id,
                    submitted_at=datetime.now(timezone.utc),
                    reviewed_at=datetime.now(timezone.utc)
                )
                db.add(rep)
                await db.flush()
            else:
                if rep.status in [ReportStatus.DRAFT, ReportStatus.REJECTED, ReportStatus.SUBMITTED]:
                    rep.status = ReportStatus.REVIEWED
                    rep.reviewer_id = current_user.id
                    rep.submitted_at = rep.submitted_at or datetime.now(timezone.utc)
                    rep.reviewed_at = datetime.now(timezone.utc)
            return rep

        c_name = broadcast_in.customer_name or "关联客户单位"

        if event.event_type == "contract_signed":
            # 合同新签分摊录入
            has_allocations = (
                (broadcast_in.delivery_allocations and len(broadcast_in.delivery_allocations) > 0) or
                (broadcast_in.marketing_allocations and len(broadcast_in.marketing_allocations) > 0)
            )
            
            if has_allocations:
                if broadcast_in.delivery_allocations:
                    for alloc in broadcast_in.delivery_allocations:
                        rep = await get_or_create_report(alloc.user_id)
                        rep.contract_amount += alloc.amount
                        rep.contract_count += 1
                        det = ReportDetail(
                            report_id=rep.id,
                            detail_type=DetailType.CONTRACT,
                            customer_name=c_name,
                            amount=alloc.amount,
                            crm_opportunity_id=final_opp_id,
                            description=f"【交付新签分摊 ({alloc.ratio}%)】{event.content}"
                        )
                        db.add(det)
                
                if broadcast_in.marketing_allocations:
                    for alloc in broadcast_in.marketing_allocations:
                        rep = await get_or_create_report(alloc.user_id)
                        rep.contract_amount += alloc.amount
                        rep.contract_count += 1
                        det = ReportDetail(
                            report_id=rep.id,
                            detail_type=DetailType.CONTRACT,
                            customer_name=c_name,
                            amount=alloc.amount,
                            crm_opportunity_id=final_opp_id,
                            description=f"【营销新签分摊 ({alloc.ratio}%)】{event.content}"
                        )
                        db.add(det)
            else:
                # 兜底：单人 100%
                rep = await get_or_create_report(event.user_id or current_user.id)
                val_amount = broadcast_in.amount or 0.0
                rep.contract_amount += val_amount
                rep.contract_count += 1
                det = ReportDetail(
                    report_id=rep.id,
                    detail_type=DetailType.CONTRACT,
                    customer_name=c_name,
                    amount=val_amount,
                    crm_opportunity_id=final_opp_id,
                    description=event.content
                )
                db.add(det)
                
        elif event.event_type == "lead_25":
            # 有效线索录入 (数量)
            rep = await get_or_create_report(event.user_id or current_user.id)
            rep.leads_count += 1
            det = ReportDetail(
                report_id=rep.id,
                detail_type=DetailType.LEAD,
                customer_name=c_name,
                amount=broadcast_in.amount or 0.0,
                lead_progress="25%",
                crm_opportunity_id=final_opp_id,
                description=event.content
            )
            db.add(det)

    await db.commit()
    await db.refresh(event)

    # 异步触发钉钉播报推送
    if event.push_status == PushStatus.PENDING and (event.push_channel == "dingtalk" or event.push_channel == "all"):
        background_tasks.add_task(trigger_broadcast_push, event.id)

    # 触发大屏 WebSocket 刷新
    try:
        from app.services.websocket import ws_manager
        await ws_manager.broadcast({"type": "update", "event_type": "report_submitted"})
    except Exception:
        pass

    return event


@router.delete("/{id}", summary="删除播报")
async def delete_broadcast(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """物理删除战报，并级联扣减对应用户的日报完成金额和明细记录"""
    stmt = select(BroadcastEvent).where(BroadcastEvent.id == id)
    res = await db.execute(stmt)
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="战报不存在")
        
    # 如果有关联的 CRM 项目 ID，级联删除 ReportDetail 并重新扣减 DailyReport
    opp_id = event.crm_opportunity_id
    if opp_id:
        # 查出所有关联的 ReportDetail 记录
        detail_stmt = select(ReportDetail).where(ReportDetail.crm_opportunity_id == opp_id)
        detail_res = await db.execute(detail_stmt)
        details = detail_res.scalars().all()
        
        for detail in details:
            # 找到对应的日报
            report_stmt = select(DailyReport).where(DailyReport.id == detail.report_id)
            report_res = await db.execute(report_stmt)
            report = report_res.scalar_one_or_none()
            
            if report:
                # 根据明细类型进行扣减
                if detail.detail_type == DetailType.CONTRACT:
                    report.contract_amount = max(0.0, report.contract_amount - (detail.amount or 0.0))
                    report.contract_count = max(0, report.contract_count - 1)
                elif detail.detail_type == DetailType.LEAD and detail.lead_progress == "25%":
                    report.leads_count = max(0, report.leads_count - 1)
                elif detail.detail_type == DetailType.TRIANGLE:
                    report.triangle_count = max(0, report.triangle_count - 1)
                elif detail.detail_type == DetailType.HAPPINESS:
                    report.happiness_actions = max(0, report.happiness_actions - 1)
            
            # 删除明细
            await db.delete(detail)
            
    # 删除战报事件本身
    await db.delete(event)
    await db.commit()
    
    # 触发大屏 WebSocket 更新
    try:
        from app.services.websocket import ws_manager
        await ws_manager.broadcast({"type": "update", "event_type": "report_submitted"})
    except Exception:
        pass
        
    return {"message": "删除成功"}


@router.post("/batch-delete", summary="批量删除播报")
async def batch_delete_broadcasts(
    req: BatchDeleteBroadcastRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """批量删除战报，并自动级联扣减金额"""
    for id_val in req.ids:
        # 复用单条删除逻辑以确保数据一致性
        stmt = select(BroadcastEvent).where(BroadcastEvent.id == id_val)
        res = await db.execute(stmt)
        event = res.scalar_one_or_none()
        if not event:
            continue
            
        opp_id = event.crm_opportunity_id
        if opp_id:
            detail_stmt = select(ReportDetail).where(ReportDetail.crm_opportunity_id == opp_id)
            detail_res = await db.execute(detail_stmt)
            details = detail_res.scalars().all()
            
            for detail in details:
                report_stmt = select(DailyReport).where(DailyReport.id == detail.report_id)
                report_res = await db.execute(report_stmt)
                report = report_res.scalar_one_or_none()
                
                if report:
                    if detail.detail_type == DetailType.CONTRACT:
                        report.contract_amount = max(0.0, report.contract_amount - (detail.amount or 0.0))
                        report.contract_count = max(0, report.contract_count - 1)
                    elif detail.detail_type == DetailType.LEAD and detail.lead_progress == "25%":
                        report.leads_count = max(0, report.leads_count - 1)
                    elif detail.detail_type == DetailType.TRIANGLE:
                        report.triangle_count = max(0, report.triangle_count - 1)
                    elif detail.detail_type == DetailType.HAPPINESS:
                        report.happiness_actions = max(0, report.happiness_actions - 1)
                
                await db.delete(detail)
                
        await db.delete(event)
        
    await db.commit()
    
    # 触发大屏 WebSocket 更新
    try:
        from app.services.websocket import ws_manager
        await ws_manager.broadcast({"type": "update", "event_type": "report_submitted"})
    except Exception:
        pass
        
    return {"message": "批量删除成功"}


@router.post("", response_model=BroadcastResponse, status_code=201, summary="创建播报")
async def create_broadcast(
    broadcast_in: BroadcastCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    手动创建播报事件，并在入参包含明细填报要素时自动为员工落库已审核通过的日报及明细。
    """
    # 兼容处理：若前端由于浏览器缓存仍发送 'manual'，自动转换为合法的 'custom'
    event_type = broadcast_in.event_type
    if event_type == "manual":
        event_type = "custom"

    # 1. 优先创建并写入广播事件
    event = BroadcastEvent(
        event_type=event_type,
        user_id=current_user.id,
        team_id=broadcast_in.team_id,
        content=broadcast_in.content,
        push_status=PushStatus.PENDING,
        push_channel=broadcast_in.push_channel,
        event_time=datetime.now(timezone.utc),
        crm_opportunity_id=broadcast_in.crm_opportunity_id,
    )
    db.add(event)
    await db.flush()

    # 2. 如果包含填报的 action_type，则说明是伴随大屏快捷录入，自动生成对应的日报与明细数据
    if broadcast_in.action_type:
        async def get_or_create_report(uid: int) -> DailyReport:
            today = date.today()
            report_stmt = select(DailyReport).where(
                DailyReport.user_id == uid,
                DailyReport.report_date == today
            )
            report_res = await db.execute(report_stmt)
            rep = report_res.scalar_one_or_none()

            if not rep:
                rep = DailyReport(
                    user_id=uid,
                    report_date=today,
                    contract_amount=0.0,
                    contract_count=0,
                    happiness_actions=0,
                    triangle_count=0,
                    leads_count=0,
                    status=ReportStatus.REVIEWED,  # 默认自动审核通过
                    reviewer_id=current_user.id,
                    submitted_at=datetime.now(timezone.utc),
                    reviewed_at=datetime.now(timezone.utc)
                )
                db.add(rep)
                await db.flush()  # 获得 rep.id
            else:
                # 如果已有日报是草稿或驳回，强行将其状态更新为已审核
                if rep.status in [ReportStatus.DRAFT, ReportStatus.REJECTED, ReportStatus.SUBMITTED]:
                    rep.status = ReportStatus.REVIEWED
                    rep.reviewer_id = current_user.id
                    rep.submitted_at = rep.submitted_at or datetime.now(timezone.utc)
                    rep.reviewed_at = datetime.now(timezone.utc)
            return rep

        # A. 确定目标员工 ID
        target_user_id = current_user.id
        if broadcast_in.employee_name:
            user_stmt = select(User).where(User.name == broadcast_in.employee_name)
            user_res = await db.execute(user_stmt)
            target_user = user_res.scalar_one_or_none()
            if target_user:
                target_user_id = target_user.id

        action = broadcast_in.action_type
        
        # 快捷处理写入的金额数：如果传入了预计金额或金额，作为 amount 记录
        amount_to_save = broadcast_in.expect_money
        if amount_to_save is None or amount_to_save <= 0:
            amount_to_save = broadcast_in.budget_money
        if amount_to_save is None or amount_to_save <= 0:
            amount_to_save = broadcast_in.amount or 0.0

        # 判断是否提供并需要进行交付/营销比例分摊
        has_allocations = (action == "contract" and (
            (broadcast_in.delivery_allocations and len(broadcast_in.delivery_allocations) > 0) or
            (broadcast_in.marketing_allocations and len(broadcast_in.marketing_allocations) > 0)
        ))

        if has_allocations:
            # 1. 交付业绩分摊落库
            if broadcast_in.delivery_allocations:
                for alloc in broadcast_in.delivery_allocations:
                    rep = await get_or_create_report(alloc.user_id)
                    rep.contract_amount += alloc.amount
                    rep.contract_count += 1
                    detail = ReportDetail(
                        report_id=rep.id,
                        detail_type=DetailType.CONTRACT,
                        customer_name=broadcast_in.customer_name,
                        amount=alloc.amount,
                        crm_opportunity_id=broadcast_in.crm_opportunity_id,
                        description=f"【交付新签分摊 ({alloc.ratio}%)】{broadcast_in.content}",
                        attachment_urls=broadcast_in.attachment_urls
                    )
                    db.add(detail)
            
            # 2. 营销业绩分摊落库
            if broadcast_in.marketing_allocations:
                for alloc in broadcast_in.marketing_allocations:
                    rep = await get_or_create_report(alloc.user_id)
                    rep.contract_amount += alloc.amount
                    rep.contract_count += 1
                    detail = ReportDetail(
                        report_id=rep.id,
                        detail_type=DetailType.CONTRACT,
                        customer_name=broadcast_in.customer_name,
                        amount=alloc.amount,
                        crm_opportunity_id=broadcast_in.crm_opportunity_id,
                        description=f"【营销新签分摊 ({alloc.ratio}%)】{broadcast_in.content}",
                        attachment_urls=broadcast_in.attachment_urls
                    )
                    db.add(detail)
            
            await db.flush()
        else:
            # 走原本没有分摊的单人兜底逻辑
            report = await get_or_create_report(target_user_id)
            detail = None

            if action == "contract":
                report.contract_amount += amount_to_save
                report.contract_count += 1
                detail = ReportDetail(
                    report_id=report.id,
                    detail_type=DetailType.CONTRACT,
                    customer_name=broadcast_in.customer_name,
                    amount=amount_to_save,
                    crm_opportunity_id=broadcast_in.crm_opportunity_id,
                    description=broadcast_in.content,
                    attachment_urls=broadcast_in.attachment_urls
                )
            elif action == "lead_25":
                report.leads_count += 1
                detail = ReportDetail(
                    report_id=report.id,
                    detail_type=DetailType.LEAD,
                    customer_name=broadcast_in.customer_name,
                    amount=amount_to_save,
                    lead_progress="25%",
                    crm_opportunity_id=broadcast_in.crm_opportunity_id,
                    description=broadcast_in.content,
                    attachment_urls=broadcast_in.attachment_urls
                )
            elif action == "lead_75":
                # 中标确定不作为新增线索计数
                detail = ReportDetail(
                    report_id=report.id,
                    detail_type=DetailType.LEAD,
                    customer_name=broadcast_in.customer_name,
                    amount=amount_to_save,
                    lead_progress="75%",
                    crm_opportunity_id=broadcast_in.crm_opportunity_id,
                    description=broadcast_in.content,
                    attachment_urls=broadcast_in.attachment_urls
                )
            elif action == "triangle":
                report.triangle_count += 1
                detail = ReportDetail(
                    report_id=report.id,
                    detail_type=DetailType.TRIANGLE,
                    customer_name=broadcast_in.customer_name,
                    description=broadcast_in.content,
                    attachment_urls=broadcast_in.attachment_urls
                )
            elif action == "happiness":
                report.happiness_actions += 1
                score_val = broadcast_in.happiness_score or 20
                detail = ReportDetail(
                    report_id=report.id,
                    detail_type=DetailType.HAPPINESS,
                    customer_name=broadcast_in.customer_name or "客户幸福关怀单位",
                    happiness_level=score_val,
                    description=broadcast_in.action_description or broadcast_in.content,
                    attachment_urls=broadcast_in.attachment_urls
                )

            if detail:
                db.add(detail)
                await db.flush()

        # D. 触发大屏 WebSocket 实时更新推送
        try:
            from app.services.websocket import ws_manager
            await ws_manager.broadcast({"type": "update", "event_type": "report_submitted"})
        except Exception as ws_err:
            logger.error(f"快捷填报大屏 WebSocket 广播失败: {ws_err}")

    await db.commit()
    await db.refresh(event)

    # 异步触发钉钉播报推送
    if event.push_status == PushStatus.PENDING and (event.push_channel == "dingtalk" or event.push_channel == "all"):
        background_tasks.add_task(trigger_broadcast_push, event.id)

    return event
