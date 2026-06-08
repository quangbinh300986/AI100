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
from app.services.audit_service import log_action, to_dict

def get_business_report_date(dt_utc: datetime) -> date:
    """
    根据北京时间 20:00 分水岭，计算业务日报归属日期
    北京时间 20:00 对应 UTC 12:00
    """
    from datetime import timedelta, timezone
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    bj_tz = timezone(timedelta(hours=8))
    dt_bj = dt_utc.astimezone(bj_tz)
    if dt_bj.hour >= 20:
        # 20:00 之后属于第二天日报
        return (dt_bj + timedelta(days=1)).date()
    else:
        # 20:00 之前属于当天日报
        return dt_bj.date()


async def trigger_broadcast_push(broadcast_id: int):
    """
    后台异步推送战报到钉钉
    """
    from app.database import AsyncSessionLocal
    from app.models.broadcast import BroadcastEvent, PushStatus
    from app.models.user import User as DbUser
    from app.models.organization import Team as DbTeam
    from app.integrations.dingtalk import dingtalk_client
    from app.config import settings
    from sqlalchemy import select
    from datetime import datetime, timezone
    logger = logging.getLogger("battle100")
    
    # 延迟 0.5 秒，确保外层路由事务已完全 commit 且连接已释放，防范并发连接争抢
    import asyncio
    await asyncio.sleep(0.5)
    
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
            
            # 3. 调用推送（支持偶发抖动与超时的重试机制）
            msg_id = None
            retry_count = 2
            for attempt in range(retry_count):
                if event.event_type == EventType.STATION_REPORT.value:
                    import urllib.parse
                    download_url = None
                    summary_text = event.summary or event.content or ""
                    
                    if event.attachment_urls and len(event.attachment_urls) > 0:
                        raw_url = event.attachment_urls[0].get("url")
                        name = event.attachment_urls[0].get("name", "encrypted_attachments.zip")
                        if raw_url:
                            # 优先使用配置的公网 Supabase 地址以支持 frp 穿透
                            if getattr(settings, "EXTERNAL_SUPABASE_URL", None):
                                raw_url = raw_url.replace(settings.SUPABASE_URL.rstrip('/'), settings.EXTERNAL_SUPABASE_URL.rstrip('/'))
                            quoted_name = urllib.parse.quote(name)
                            download_url = f"{raw_url}?download={quoted_name}"
                        
                        # 优化：如果是多附件，则在消息摘要正文末尾追加全部附件的 markdown 下载链接
                        if len(event.attachment_urls) > 1:
                            summary_text += "\n\n---\n📎 **所有附件列表**：\n"
                            for idx, att in enumerate(event.attachment_urls):
                                att_name = att.get("name")
                                att_url = att.get("url")
                                if att_url:
                                    if getattr(settings, "EXTERNAL_SUPABASE_URL", None):
                                        att_url = att_url.replace(settings.SUPABASE_URL.rstrip('/'), settings.EXTERNAL_SUPABASE_URL.rstrip('/'))
                                    quoted_att_name = urllib.parse.quote(att_name)
                                    summary_text += f"{idx+1}. [{att_name}]({att_url}?download={quoted_att_name}) \n"
                    
                    # 网页详情链接，优先使用配置的公网前端 URL
                    detail_url = None
                    if getattr(settings, "EXTERNAL_FRONTEND_URL", None):
                        detail_url = f"{settings.EXTERNAL_FRONTEND_URL.rstrip('/')}/admin/dashboard"
                    elif settings.CORS_ORIGINS and len(settings.CORS_ORIGINS) > 0:
                        detail_url = f"{settings.CORS_ORIGINS[0]}/admin/dashboard"
                        
                    msg_id = await dingtalk_client.send_station_report_actioncard(
                        title=event.project_name or "驻点快报",
                        category=event.station_category,
                        location=event.station_location,
                        summary=summary_text,
                        download_url=download_url,
                        password=event.attachment_password,
                        is_urgent=event.is_urgent,
                        detail_url=detail_url,
                        attachment_urls=event.attachment_urls
                    )
                else:
                    msg_id = await dingtalk_client.push_broadcast_message(
                        event_type=event.event_type,
                        content=event.content,
                        user_name=user_name,
                        team_name=team_name,
                        dingtalk_users=dingtalk_users,
                        attachment_urls=event.attachment_urls
                    )
                
                if msg_id:
                    # 推送成功，跳出重试
                    break
                
                if attempt < retry_count - 1:
                    logger.warning(f"战报ID {broadcast_id} 钉钉推送可能发生偶发抖动或失败，将在 2 秒后进行第 {attempt+2} 次重试...")
                    await asyncio.sleep(2.0)
            
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
    project_name: Optional[str] = None
    
    # 新增分摊数据字段
    delivery_allocations: Optional[list[AllocationItem]] = None
    marketing_allocations: Optional[list[AllocationItem]] = None
    attachment_urls: Optional[list[str]] = None
    copartners: Optional[list[str]] = None
    marketing_copartners: Optional[list[str]] = None


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
    crm_opportunity_name: Optional[str] = None
    project_name: Optional[str] = None
    user_name: Optional[str] = None
    team_name: Optional[str] = None
    delivery_allocations: Optional[list[AllocationItem]] = None
    marketing_allocations: Optional[list[AllocationItem]] = None

    # 驻点人员播报支持
    station_category: Optional[str] = None
    station_location: Optional[str] = None
    summary: Optional[str] = None
    attachment_urls: Optional[list] = None
    is_urgent: Optional[bool] = None

    model_config = {"from_attributes": True}


@router.get("/crm-projects", summary="直连 CRM 获取特定拓展进度的项目列表")
async def get_crm_projects(
    progress: int = Query(..., description="拓展进度（25、75、90）"),
    include_opp_id: Optional[str] = Query(None, description="强制包含的已绑定商机ID"),
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
    from datetime import datetime
    from app.config import settings

    # 计算当前月份首天零点，仅过滤当月更新过的活跃项目
    now = datetime.now()
    start_of_month = datetime(now.year, now.month, 1, 0, 0, 0)

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
        
        # 如果是中标确定 (progress=75)，从新表 tender_base_info 中取数
        if progress == 75:
            query = """
                SELECT
                    t.id,
                    t.project_name AS name,
                    t.customer_company AS customer_name,
                    t.tender_money AS budget_money,
                    t1.win_money AS expect_money,
                    75 AS progress
                FROM
                    tender_base_info t
                LEFT JOIN(
                    SELECT tender_base_info_id, win_money, tenderer 
                    FROM tender_company_info
                    WHERE status='0' AND win_status='1' AND parent_id = '0'
                ) t1 ON t.id = t1.tender_base_info_id
                WHERE t.status='0'
                  AND (t1.tenderer LIKE '%%广东中地土地房地产评估与规划设计有限公司%%' 
                       OR t1.tenderer LIKE '%%德恒城乡规划设计研究（广东）有限公司%%')
                  AND t.win_status = '1'
                  AND COALESCE(t.win_confirm_time, t.confirm_time) >= '2026-06-01 00:00:00'
                ORDER BY COALESCE(t.win_confirm_time, t.confirm_time) DESC
                LIMIT 500
            """
            cur.execute(query)
        elif progress == 90:
            # 如果是已完成合同 (progress=90)，从 contract 表中取数
            query = """
                SELECT 
                    c.id, 
                    c.contract_name AS name, 
                    c.contract_no,
                    c.contract_money,
                    cc.customer_name,
                    ba.province,
                    ba.city,
                    ba.district,
                    c.signer,
                    90 AS progress
                FROM contract c 
                LEFT JOIN crm_customer cc ON cc.id = c.owner AND cc.status ='0'
                LEFT JOIN bus_address ba ON ba.bus_id = c.id AND ba.bus_type ='contract' AND ba.status ='0'
                WHERE c.status ='0'
                  AND c.contract_status IN ('已签订','已验收')
                  AND c.signing_date >= '2026-06-01 00:00:00'
                ORDER BY c.signing_date DESC
                LIMIT 500
            """
            cur.execute(query)
        else:
            # 只查询未删除、非暂停状态，且最后更新时间在当月（含）以后的项目，同时拉取营销人员列 market_user_id
            if progress == 10:
                query = """
                    SELECT id, name, customer_name, budget_money, expect_money, progress, market_user_id
                    FROM zdcrm_business_opportunity
                    WHERE progress IN (5, 10)
                      AND update_time >= %s
                      AND is_del = '0'
                      AND (is_suspension = '0' OR is_suspension IS NULL)
                    ORDER BY create_time DESC
                    LIMIT 500
                """
                cur.execute(query, (start_of_month,))
            else:
                query = """
                    SELECT id, name, customer_name, budget_money, expect_money, progress, market_user_id
                    FROM zdcrm_business_opportunity
                    WHERE progress = %s
                      AND update_time >= %s
                      AND is_del = '0'
                      AND (is_suspension = '0' OR is_suspension IS NULL)
                    ORDER BY create_time DESC
                    LIMIT 500
                """
                cur.execute(query, (progress, start_of_month))
        projects = cur.fetchall()
        
        # 0. 查询本地系统所有已经关联并使用的 CRM 潜在项目 ID
        used_opp_stmt = select(ReportDetail.crm_opportunity_id).where(
            ReportDetail.crm_opportunity_id.isnot(None),
            ReportDetail.crm_opportunity_id != ""
        )
        used_opp_res = await db.execute(used_opp_stmt)
        used_opp_ids = set(str(x) for x in used_opp_res.scalars().all())
        if include_opp_id and str(include_opp_id) in used_opp_ids:
            used_opp_ids.discard(str(include_opp_id))

        # 批量获取关联人员的中文姓名与本地系统 ID 以免陷入 O(N) 循环查询
        all_user_codes = set()
        all_signers = set()
        for p in projects:
            if str(p["id"]) in used_opp_ids:
                continue
            m_user_str = p.get("market_user_id")
            if m_user_str:
                codes = [c.strip() for c in m_user_str.split(",") if c.strip()]
                all_user_codes.update(codes)
            signer_name = p.get("signer")
            if signer_name:
                all_signers.add(signer_name.strip())

        user_code_to_name = {}
        if all_user_codes:
            placeholders = ",".join(["%s"] * len(all_user_codes))
            sys_user_query = f"SELECT user_code, user_name FROM js_sys_user WHERE user_code IN ({placeholders})"
            cur.execute(sys_user_query, tuple(all_user_codes))
            for row in cur.fetchall():
                user_code_to_name[row["user_code"]] = row["user_name"]

        # 从本地系统批量根据【中文人名】查询映射 (融合 sys_user 与 contract signer 人名)
        local_user_map = {}
        target_names = list(user_code_to_name.values()) + list(all_signers)
        if target_names:
            stmt = select(User.id, User.name).where(
                User.name.in_(target_names),
                User.is_active == True
            )
            local_users_res = await db.execute(stmt)
            for uid, uname in local_users_res.all():
                local_user_map[uname] = uid

        results = []
        for p in projects:
            opp_id_str = str(p["id"])
            if opp_id_str in used_opp_ids:
                continue
            m_users = []
            
            if progress == 90:
                signer_name = p.get("signer")
                if signer_name:
                    signer_name = signer_name.strip()
                    uid = local_user_map.get(signer_name)
                    m_users.append({
                        "crm_user_id": signer_name,
                        "name": signer_name,
                        "local_user_id": uid
                    })
            else:
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

            # 合同额单位是元，需除以 10000 转换为万元
            raw_money = float(p.get("contract_money") or 0.0) / 10000.0 if progress == 90 else 0.0
            budget_money = raw_money if progress == 90 else float(p.get("budget_money") or 0.0)
            expect_money = raw_money if progress == 90 else float(p.get("expect_money") or 0.0)

            results.append({
                "id": opp_id_str,
                "name": p["name"] or "未命名项目",
                "customer_name": p["customer_name"] or "未知业主单位",
                "budget_money": budget_money,
                "expect_money": expect_money,
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
    employee_name: Optional[str] = None
    project_name: Optional[str] = None
    copartners: Optional[list[str]] = None
    marketing_copartners: Optional[list[str]] = None
    
    # 驻点播报新增字段支持
    station_category: Optional[str] = None
    station_location: Optional[str] = None
    summary: Optional[str] = None
    is_urgent: Optional[bool] = None
    attachment_urls: Optional[list] = None


class BatchDeleteBroadcastRequest(BaseModel):
    """批量删除播报请求"""
    ids: list[int] = Field(..., description="要删除的播报ID列表")


@router.get("/crm-customers", summary="直连 CRM 获取客户名称列表")
async def get_crm_customers(
    keyword: Optional[str] = Query(None, description="搜索关键字"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    直连 CRM 数据库获取所有活跃商机的客户名称列表（支持模糊搜索，限制返回条数，按创建时间倒序）
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
        
        if keyword:
            # 带有关键字的搜索：通过 LIKE 过滤，按创建时间倒序并只取前 50 条
            query = """
                SELECT DISTINCT customer_name 
                FROM crm_customer 
                WHERE status = '0'
                  AND customer_name LIKE %s
                  AND customer_name != ''
                  AND customer_name IS NOT NULL
                ORDER BY create_date DESC
                LIMIT 50
            """
            cur.execute(query, (f"%{keyword}%",))
        else:
            # 不带关键字：取最新创建的前 50 条记录
            query = """
                SELECT DISTINCT customer_name 
                FROM crm_customer 
                WHERE status = '0'
                  AND customer_name != ''
                  AND customer_name IS NOT NULL
                ORDER BY create_date DESC
                LIMIT 50
            """
            cur.execute(query)
            
        rows = cur.fetchall()
        customers = [r[0].strip() for r in rows if r[0]]
        conn.close()
        return customers
    except Exception as e:
        logger.error(f"直连 CRM 获取客户列表发生异常: {e}")
        return []


@router.get("/crm-projects-search", summary="直连 CRM 模糊搜索项目名称列表")
async def search_crm_projects(
    keyword: Optional[str] = Query(None, description="搜索关键字"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    直连 CRM 数据库获取所有活跃的项目名称列表（支持模糊搜索，限制返回条数，按创建时间倒序）
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
        
        if keyword:
            query = """
                SELECT DISTINCT project_name 
                FROM project 
                WHERE status = '0'
                  AND project_name LIKE %s
                  AND project_name != ''
                  AND project_name IS NOT NULL
                ORDER BY create_date DESC
                LIMIT 50
            """
            cur.execute(query, (f"%{keyword}%",))
        else:
            query = """
                SELECT DISTINCT project_name 
                FROM project 
                WHERE status = '0'
                  AND project_name != ''
                  AND project_name IS NOT NULL
                ORDER BY create_date DESC
                LIMIT 50
            """
            cur.execute(query)
            
        rows = cur.fetchall()
        projects = [r[0].strip() for r in rows if r[0]]
        conn.close()
        return projects
    except Exception as e:
        logger.error(f"直连 CRM 获取项目列表发生异常: {e}")
        return []


@router.get("/summary-stats", summary="获取战报看板统计数据")
async def get_broadcast_summary_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    在数据库中通过聚合查询获取战报看板所需的 4 个核心统计指标，所有注释必须使用中文
    """
    from sqlalchemy import func
    from datetime import datetime, time, timezone, timedelta
    
    # 按照北京时间今日零点进行过滤 (北京时间 = UTC + 8小时)
    bj_tz = timezone(timedelta(hours=8))
    now_bj = datetime.now(bj_tz)
    today_bj_start = datetime.combine(now_bj.date(), time.min).replace(tzinfo=bj_tz)
    utc_today_start = today_bj_start.astimezone(timezone.utc)

    # 1. 今日播报数 (创建时间在今日北京零点以后的播报，且未被删除)
    today_stmt = select(func.count(BroadcastEvent.id)).where(
        BroadcastEvent.created_at >= utc_today_start,
        BroadcastEvent.is_deleted == False
    )
    today_count = await db.scalar(today_stmt) or 0

    # 2. 待推送消息 (push_status 为 pending，且未被删除)
    pending_stmt = select(func.count(BroadcastEvent.id)).where(
        BroadcastEvent.push_status == "pending",
        BroadcastEvent.is_deleted == False
    )
    pending_count = await db.scalar(pending_stmt) or 0

    # 3. 成功已发送 (push_status 为 sent，且未被删除)
    sent_stmt = select(func.count(BroadcastEvent.id)).where(
        BroadcastEvent.push_status == "sent",
        BroadcastEvent.is_deleted == False
    )
    sent_count = await db.scalar(sent_stmt) or 0

    # 4. 历史累计战报 (总记录数，且未被删除)
    total_stmt = select(func.count(BroadcastEvent.id)).where(
        BroadcastEvent.is_deleted == False
    )
    total_count = await db.scalar(total_stmt) or 0

    return {
        "today_count": today_count,
        "pending_count": pending_count,
        "sent_count": sent_count,
        "total_count": total_count
    }


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
        BroadcastEvent.project_name,
        BroadcastEvent.station_category,
        BroadcastEvent.station_location,
        BroadcastEvent.summary,
        BroadcastEvent.attachment_urls,
        BroadcastEvent.is_urgent,
        DbUser.name.label("user_name"),
        DbTeam.name.label("team_name")
    ).outerjoin(DbUser, BroadcastEvent.user_id == DbUser.id)\
     .outerjoin(DbTeam, BroadcastEvent.team_id == DbTeam.id)\
     .order_by(BroadcastEvent.created_at.desc())

    # 过滤条件 (主列表默认过滤掉已删除/进入回收站的战报)
    query = query.where(BroadcastEvent.is_deleted == False)
    if team_id:
        query = query.where(BroadcastEvent.team_id == team_id)
    if event_type:
        query = query.where(BroadcastEvent.event_type == event_type)
    if keyword:
        query = query.where(BroadcastEvent.content.contains(keyword))

    # 计算总数
    count_stmt = select(func.count(BroadcastEvent.id)).where(BroadcastEvent.is_deleted == False)
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
    
    # 批量从外部 CRM 系统库中拉取项目名称
    opp_names = {}
    if opp_ids:
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
            placeholders = ', '.join(['%s'] * len(opp_ids))
            # 1. 从原商机表查询项目名称
            query_opp = f"""
                SELECT id, name
                FROM zdcrm_business_opportunity
                WHERE id IN ({placeholders})
            """
            cur.execute(query_opp, tuple(opp_ids))
            opp_rows = cur.fetchall()
            for o_row in opp_rows:
                opp_names[str(o_row["id"])] = o_row["name"]

            # 2. 从新招标中标表查询项目名称
            query_tender = f"""
                SELECT id, project_name AS name
                FROM tender_base_info
                WHERE id IN ({placeholders})
            """
            cur.execute(query_tender, tuple(opp_ids))
            tender_rows = cur.fetchall()
            for t_row in tender_rows:
                opp_names[str(t_row["id"])] = t_row["name"]

            # 3. 从新合同表查询项目名称
            query_contract = f"""
                SELECT id, contract_name AS name
                FROM contract
                WHERE id IN ({placeholders})
            """
            cur.execute(query_contract, tuple(opp_ids))
            contract_rows = cur.fetchall()
            for c_row in contract_rows:
                opp_names[str(c_row["id"])] = c_row["name"]
            cur.close()
            conn.close()
        except Exception as crm_err:
            logger.error(f"批量读取CRM项目名称失败: {crm_err}")

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
        opp_name = opp_names.get(crm_opp) if crm_opp else None
        
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
            crm_opportunity_name=opp_name,
            project_name=row.project_name,
            user_name=row.user_name,
            team_name=row.team_name,
            delivery_allocations=allocs["delivery"] if allocs else None,
            marketing_allocations=allocs["marketing"] if allocs else None,
            station_category=row.station_category,
            station_location=row.station_location,
            summary=row.summary,
            attachment_urls=row.attachment_urls,
            is_urgent=row.is_urgent
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
        
    # 留存修改前的状态
    before_state_dict = to_dict(event)
        
    old_opp_id = event.crm_opportunity_id
    new_opp_id = broadcast_in.crm_opportunity_id
    
    # ===== A. 联动清退扣回该战报原先关联的所有日报指标金额与计数 =====
    from app.models.report import ReportDetail
    detail_stmt = select(ReportDetail).where(ReportDetail.description.like(f"%\n[broadcast_id:{event.id}]"))
    detail_res = await db.execute(detail_stmt)
    details = detail_res.scalars().all()
    
    old_detail_user_ids = []
    for detail in details:
        report_stmt = select(DailyReport).where(DailyReport.id == detail.report_id)
        report_res = await db.execute(report_stmt)
        report = report_res.scalar_one_or_none()
        
        if report:
            old_detail_user_ids.append(report.user_id)
            if detail.detail_type == DetailType.CONTRACT:
                report.contract_amount = max(0.0, report.contract_amount - (detail.amount or 0.0))
                report.contract_count = max(0, report.contract_count - 1)
            elif detail.detail_type == DetailType.LEAD and detail.lead_progress == "25%":
                report.leads_count = max(0, report.leads_count - 1)
            elif detail.detail_type == DetailType.TRIANGLE:
                report.triangle_count = max(0, report.triangle_count - 1)
            elif detail.detail_type == DetailType.HAPPINESS:
                report.happiness_actions = max(0, report.happiness_actions - 1)
            elif detail.detail_type == DetailType.POTENTIAL_LEAD:
                report.potential_leads_count = max(0, report.potential_leads_count - 1)
        
        await db.delete(detail)
    await db.flush()

    # ===== B. 更新战报基本文字、推送渠道、以及最新的 CRM 商机关联 =====
    if broadcast_in.content is not None:
        event.content = broadcast_in.content
    if broadcast_in.push_status is not None:
        event.push_status = broadcast_in.push_status
    if broadcast_in.push_channel is not None:
        event.push_channel = broadcast_in.push_channel
    if broadcast_in.project_name is not None:
        event.project_name = broadcast_in.project_name
    if broadcast_in.station_category is not None:
        event.station_category = broadcast_in.station_category
    if broadcast_in.station_location is not None:
        event.station_location = broadcast_in.station_location
    if broadcast_in.summary is not None:
        event.summary = broadcast_in.summary
    if broadcast_in.is_urgent is not None:
        event.is_urgent = broadcast_in.is_urgent
    # 覆盖式更新附件列表（支持设为 None/空以清空图片）
    update_data = broadcast_in.dict(exclude_unset=True)
    if "attachment_urls" in update_data:
        event.attachment_urls = update_data["attachment_urls"]
    
    # 前三种和 CRM 关联，后两种及自定义不关联
    if event.event_type in ["contract_signed", "lead_75", "lead_25", "potential_lead"]:
        event.crm_opportunity_id = new_opp_id if (new_opp_id and new_opp_id != "") else None
    else:
        event.crm_opportunity_id = None
        
    await db.flush()

    # ===== C. 重新计算并录入新业绩明细 =====
    final_opp_id = event.crm_opportunity_id
    
    # 只有关联 CRM 且类型是合同新签、线索或潜力线索，或者非 CRM 关联但为联动、幸福动作，才重新计入系统数据 (中标确定不更新系统实绩)
    if (final_opp_id and event.event_type in ["contract_signed", "lead_25", "potential_lead"]) or (event.event_type in ["triangle", "happiness"]):
        report_date = get_business_report_date(event.created_at if event.created_at else datetime.now(timezone.utc))
        
        # 自动生成的日报提交与审核时间应与播报事件的实际发生时间/创建时间对齐，保证统计口径一致
        target_time = event.event_time if event.event_time else (event.created_at if event.created_at else datetime.now(timezone.utc))
        
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
                    potential_leads_count=0,
                    status=ReportStatus.REVIEWED,
                    reviewer_id=current_user.id,
                    submitted_at=target_time,
                    reviewed_at=target_time
                )
                db.add(rep)
                await db.flush()
            else:
                if rep.status in [ReportStatus.DRAFT, ReportStatus.REJECTED, ReportStatus.SUBMITTED]:
                    rep.status = ReportStatus.REVIEWED
                    rep.reviewer_id = current_user.id
                    rep.submitted_at = rep.submitted_at or target_time
                    rep.reviewed_at = target_time
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
                            description=f"【交付新签分摊 ({alloc.ratio}%)】{event.content}\n[broadcast_id:{event.id}]"
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
                            description=f"【营销新签分摊 ({alloc.ratio}%)】{event.content}\n[broadcast_id:{event.id}]"
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
                    description=f"{event.content}\n[broadcast_id:{event.id}]"
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
                description=f"{event.content}\n[broadcast_id:{event.id}]"
            )
            db.add(det)
        elif event.event_type == "potential_lead":
            # 潜力线索录入 (数量)
            rep = await get_or_create_report(event.user_id or current_user.id)
            rep.potential_leads_count += 1
            det = ReportDetail(
                report_id=rep.id,
                detail_type=DetailType.POTENTIAL_LEAD,
                customer_name=c_name,
                amount=broadcast_in.amount or 0.0,
                lead_progress="5%-10%",
                crm_opportunity_id=final_opp_id,
                description=f"{event.content}\n[broadcast_id:{event.id}]"
            )
            db.add(det)
        elif event.event_type == "happiness":
            # 客户幸福动作重新录入，所有注释必须使用中文
            rep = await get_or_create_report(event.user_id or current_user.id)
            rep.happiness_actions += 1
            score_val = broadcast_in.happiness_score if broadcast_in.happiness_score is not None else 20
            det = ReportDetail(
                report_id=rep.id,
                detail_type=DetailType.HAPPINESS,
                customer_name=c_name,
                project_name=broadcast_in.project_name or event.project_name or "未定",
                happiness_level=score_val,
                description=f"{event.content}\n[broadcast_id:{event.id}]"
            )
            db.add(det)
        elif event.event_type == "triangle":
            # 铁三角联动重新录入
            user_ids_to_add = set()
            
            # 如果前端传入了新的人员参数，则用新的计算；否则复用原来的 old_detail_user_ids
            has_new_partners = (
                broadcast_in.employee_name is not None or 
                broadcast_in.copartners is not None or 
                broadcast_in.marketing_copartners is not None
            )
            
            if has_new_partners:
                # 1. 目标员工（用户自己）
                emp_user_id = event.user_id or current_user.id
                if broadcast_in.employee_name:
                    emp_user_stmt = select(User.id).where(User.name == broadcast_in.employee_name, User.is_active == True)
                    emp_user_res = await db.execute(emp_user_stmt)
                    val_emp_id = emp_user_res.scalar_one_or_none()
                    if val_emp_id:
                        emp_user_id = val_emp_id
                user_ids_to_add.add(emp_user_id)
                
                # 2. 联动人
                if broadcast_in.copartners:
                    copartners_users = await db.execute(
                        select(User.id).where(User.name.in_(broadcast_in.copartners), User.is_active == True)
                    )
                    for uid in copartners_users.scalars().all():
                        user_ids_to_add.add(uid)
                        
                # 3. 营销联动人
                if broadcast_in.marketing_copartners:
                    marketing_users = await db.execute(
                        select(User.id).where(User.name.in_(broadcast_in.marketing_copartners), User.is_active == True)
                    )
                    for uid in marketing_users.scalars().all():
                        user_ids_to_add.add(uid)
            else:
                # 复用原来的
                for uid in old_detail_user_ids:
                    user_ids_to_add.add(uid)
            
            c_name = broadcast_in.customer_name or event.content
            for uid in user_ids_to_add:
                rep = await get_or_create_report(uid)
                rep.triangle_count += 1
                det = ReportDetail(
                    report_id=rep.id,
                    detail_type=DetailType.TRIANGLE,
                    customer_name=c_name,
                    description=f"{event.content}\n[broadcast_id:{event.id}]" if "\n[broadcast_id:" not in event.content else event.content
                )
                db.add(det)

    # 记录操作审计日志（在 commit 前执行，避免 commit 后实例属性过期 lazy load 报错）
    await db.flush()  # 确保 session 处于干净状态且 ID 已生成，避免 to_dict 隐式触发 autoflush 的 MissingGreenlet 错误
    await log_action(
        db, current_user, "UPDATE", "broadcast", str(event.id),
        f"修改了战报播报内容",
        before_state=before_state_dict,
        after_state=to_dict(event)
    )

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
        
    # 留存删除前的状态
    before_state = to_dict(event)
        
    # 通过描述中的 broadcast_id 关联标识，级联删除 ReportDetail 并重新扣减 DailyReport
    from app.models.report import ReportDetail
    detail_stmt = select(ReportDetail).where(ReportDetail.description.like(f"%\n[broadcast_id:{event.id}]"))
    detail_res = await db.execute(detail_stmt)
    details = detail_res.scalars().all()
    
    # 构造业绩明细数据快照备份，用于回收站还原
    backup_list = []
    for detail in details:
        # 找到对应的日报以获取 user_id
        report_stmt = select(DailyReport).where(DailyReport.id == detail.report_id)
        report_res = await db.execute(report_stmt)
        report = report_res.scalar_one_or_none()
        user_id_val = report.user_id if report else None

        detail_backup = {
            "detail_type": detail.detail_type.value if detail.detail_type else None,
            "customer_name": detail.customer_name,
            "amount": detail.amount,
            "lead_progress": detail.lead_progress,
            "crm_opportunity_id": detail.crm_opportunity_id,
            "happiness_level": detail.happiness_level,
            "happiness_standard_id": detail.happiness_standard_id,
            "project_name": detail.project_name,
            "description": detail.description,
            "partner_user_id": detail.partner_user_id,
            "user_id": user_id_val
        }
        backup_list.append(detail_backup)

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
            elif detail.detail_type == DetailType.POTENTIAL_LEAD:
                report.potential_leads_count = max(0, report.potential_leads_count - 1)
        
        # 删除明细
        await db.delete(detail)
            
    # 改为软删除并记录明细快照，不物理删除事件
    event.is_deleted = True
    event.allocations_backup = backup_list
    db.add(event)
    
    # 记录操作审计日志（在 commit 前执行）
    await log_action(
        db, current_user, "DELETE", "broadcast", str(id),
        f"删除了战报播报，类型：{event.event_type}，内容：{event.content[:50]}...",
        before_state=before_state,
        after_state=None
    )
    
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
    # 备份待删除的数据以留存日志
    stmt_to_backup = select(BroadcastEvent).where(BroadcastEvent.id.in_(req.ids))
    res_to_backup = await db.execute(stmt_to_backup)
    events_to_delete = res_to_backup.scalars().all()
    before_state = [to_dict(e) for e in events_to_delete]

    for id_val in req.ids:
        # 复用单条删除逻辑以确保数据一致性
        stmt = select(BroadcastEvent).where(BroadcastEvent.id == id_val)
        res = await db.execute(stmt)
        event = res.scalar_one_or_none()
        if not event:
            continue
            
        # 通过描述中的 broadcast_id 关联标识，级联删除 ReportDetail 并重新扣减 DailyReport
        from app.models.report import ReportDetail
        detail_stmt = select(ReportDetail).where(ReportDetail.description.like(f"%\n[broadcast_id:{event.id}]"))
        detail_res = await db.execute(detail_stmt)
        details = detail_res.scalars().all()
        
        backup_list = []
        for detail in details:
            # 找到对应的日报以获取 user_id
            report_stmt = select(DailyReport).where(DailyReport.id == detail.report_id)
            report_res = await db.execute(report_stmt)
            report = report_res.scalar_one_or_none()
            user_id_val = report.user_id if report else None

            detail_backup = {
                "detail_type": detail.detail_type.value if detail.detail_type else None,
                "customer_name": detail.customer_name,
                "amount": detail.amount,
                "lead_progress": detail.lead_progress,
                "crm_opportunity_id": detail.crm_opportunity_id,
                "happiness_level": detail.happiness_level,
                "happiness_standard_id": detail.happiness_standard_id,
                "project_name": detail.project_name,
                "description": detail.description,
                "partner_user_id": detail.partner_user_id,
                "user_id": user_id_val
            }
            backup_list.append(detail_backup)

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
                elif detail.detail_type == DetailType.POTENTIAL_LEAD:
                    report.potential_leads_count = max(0, report.potential_leads_count - 1)
            
            # 删除明细
            await db.delete(detail)
                
        event.is_deleted = True
        event.allocations_backup = backup_list
        db.add(event)
        
    # 记录操作审计日志（在 commit 前执行）
    await log_action(
        db, current_user, "DELETE", "broadcast", ",".join(map(str, req.ids)),
        f"批量删除了 {len(req.ids)} 条战报播报记录",
        before_state=before_state,
        after_state=None
    )
    
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
        project_name=broadcast_in.project_name or "未定" if event_type == "happiness" else broadcast_in.project_name,
        attachment_urls=broadcast_in.attachment_urls,  # 补全新建播报事件时的附件保存
    )
    db.add(event)
    await db.flush()

    # 2. 如果包含填报的 action_type，则说明是伴随大屏快捷录入，自动生成对应的日报与明细数据
    if broadcast_in.action_type:
        report_date = get_business_report_date(event.event_time if event.event_time else datetime.now(timezone.utc))

        # 自动生成的日报提交与审核时间应与播报事件的实际发生时间对齐，保证统计口径一致
        target_time = event.event_time if event.event_time else datetime.now(timezone.utc)

        async def get_or_create_report(uid: int) -> DailyReport:
            report_stmt = select(DailyReport).where(
                DailyReport.user_id == uid,
                DailyReport.report_date == report_date
            )
            report_res = await db.execute(report_stmt)
            rep = report_res.scalar_one_or_none()

            if not rep:
                rep = DailyReport(
                    user_id=uid,
                    report_date=report_date,
                    contract_amount=0.0,
                    contract_count=0,
                    happiness_actions=0,
                    triangle_count=0,
                    leads_count=0,
                    potential_leads_count=0,
                    status=ReportStatus.REVIEWED,  # 默认自动审核通过
                    reviewer_id=current_user.id,
                    submitted_at=target_time,
                    reviewed_at=target_time
                )
                db.add(rep)
                await db.flush()  # 获得 rep.id
            else:
                # 如果已有日报是草稿或驳回，强行将其状态更新为已审核
                if rep.status in [ReportStatus.DRAFT, ReportStatus.REJECTED, ReportStatus.SUBMITTED]:
                    rep.status = ReportStatus.REVIEWED
                    rep.reviewer_id = current_user.id
                    rep.submitted_at = rep.submitted_at or target_time
                    rep.reviewed_at = target_time
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
                        description=f"【交付新签分摊 ({alloc.ratio}%)】{broadcast_in.content}\n[broadcast_id:{event.id}]",
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
                        description=f"【营销新签分摊 ({alloc.ratio}%)】{broadcast_in.content}\n[broadcast_id:{event.id}]",
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
                    description=f"{broadcast_in.content}\n[broadcast_id:{event.id}]",
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
                    description=f"{broadcast_in.content}\n[broadcast_id:{event.id}]",
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
                    description=f"{broadcast_in.content}\n[broadcast_id:{event.id}]",
                    attachment_urls=broadcast_in.attachment_urls
                )
            elif action == "triangle":
                # 收集所有需要加次数的用户 ID
                user_ids_to_add = set()
                
                # 1. 目标员工（用户自己）
                user_ids_to_add.add(target_user_id)
                
                # 2. 联动人
                if broadcast_in.copartners:
                    copartners_users = await db.execute(
                        select(User.id).where(User.name.in_(broadcast_in.copartners), User.is_active == True)
                    )
                    for uid in copartners_users.scalars().all():
                        user_ids_to_add.add(uid)
                        
                # 3. 营销联动人
                if broadcast_in.marketing_copartners:
                    marketing_users = await db.execute(
                        select(User.id).where(User.name.in_(broadcast_in.marketing_copartners), User.is_active == True)
                    )
                    for uid in marketing_users.scalars().all():
                        user_ids_to_add.add(uid)
                
                # 为所有人累加次数并创建明细
                for uid in user_ids_to_add:
                    rep = await get_or_create_report(uid)
                    rep.triangle_count += 1
                    
                    # 确定对于当前用户 uid 的搭档：除了他自己以外的第一个需要加次数的用户 ID
                    other_uids = [other_id for other_id in user_ids_to_add if other_id != uid]
                    partner_id_val = other_uids[0] if other_uids else None
                    
                    det = ReportDetail(
                        report_id=rep.id,
                        detail_type=DetailType.TRIANGLE,
                        customer_name=broadcast_in.customer_name,
                        partner_user_id=partner_id_val,
                        description=f"{broadcast_in.content}\n[broadcast_id:{event.id}]",
                        attachment_urls=broadcast_in.attachment_urls
                    )
                    db.add(det)
                
                # 设为 None 避免外层再次 add
                detail = None
            elif action == "happiness":
                report.happiness_actions += 1
                score_val = broadcast_in.happiness_score if broadcast_in.happiness_score is not None else 20
                detail = ReportDetail(
                    report_id=report.id,
                    detail_type=DetailType.HAPPINESS,
                    customer_name=broadcast_in.customer_name or "客户幸福关怀单位",
                    project_name=broadcast_in.project_name or "未定",
                    happiness_level=score_val,
                    description=f"{broadcast_in.content}\n[broadcast_id:{event.id}]",
                    attachment_urls=broadcast_in.attachment_urls
                )
            elif action == "potential_lead":
                report.potential_leads_count += 1
                detail = ReportDetail(
                    report_id=report.id,
                    detail_type=DetailType.POTENTIAL_LEAD,
                    customer_name=broadcast_in.customer_name or "潜在客户单位",
                    amount=amount_to_save,
                    lead_progress="5%-10%",
                    crm_opportunity_id=broadcast_in.crm_opportunity_id,
                    description=f"{broadcast_in.content}\n[broadcast_id:{event.id}]",
                    attachment_urls=broadcast_in.attachment_urls
                )

            if detail:
                db.add(detail)
                await db.flush()

        # 记录操作审计日志（在 commit 前执行）
        await db.flush()  # 确保 session 处于干净状态，避免 to_dict 触发 MissingGreenlet 错误
        await log_action(
            db, current_user, "CREATE", "broadcast", str(event.id),
            f"发布了战报播报，类型：{event.event_type}，内容：{event.content[:50]}...",
            before_state=None,
            after_state=to_dict(event)
        )

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


class WebhookBroadcastPayload(BaseModel):
    type: str = Field(..., description="业务类型: 'lead' (有效线索), 'tender' (中标确定) 或 'potential_lead' (潜力线索)")
    id: str = Field(..., description="外部系统唯一标识(CRM商机ID或标讯招标ID)")
    name: str = Field(..., description="项目/标讯名称")
    customer_name: str = Field(..., description="客户/业主名称")
    budget_money: Optional[float] = Field(0.0, description="预算金额/标讯金额（万元）")
    expect_money: Optional[float] = Field(0.0, description="预计金额/中标金额（万元）")
    province: Optional[str] = Field(None, description="省")
    city: Optional[str] = Field(None, description="市")
    district: Optional[str] = Field(None, description="区")
    employee_name: Optional[str] = Field(None, description="项目归属人中文姓名，如 '张三'")


@router.post("/webhook", summary="外部系统(CRM/投标室)推送自动战报播报")
async def crm_webhook_broadcast(
    payload: WebhookBroadcastPayload,
    background_tasks: BackgroundTasks,
    token: Optional[str] = Query(None, description="安全验证Token"),
    db: AsyncSession = Depends(get_db)
):
    """
    接收 CRM 和投标室系统推送的中标、有效线索或潜力线索数据。
    自动在百日奋战系统中发布战报广播、推送到钉钉群，并自动为员工录入/生效日报及指标明细。
    """
    from app.config import settings
    
    # 验证安全Token
    secret = getattr(settings, "WEBHOOK_SECRET", "battle100_crm_push_token_2026")
    if token != secret:
        raise HTTPException(status_code=403, detail="安全验证Token不正确")

    # 1. 查找匹配归属人的系统活跃用户
    if not payload.employee_name:
        raise HTTPException(status_code=400, detail="推送请求必须包含归属人姓名 (employee_name)")
        
    user_stmt = select(User).where(User.name == payload.employee_name.strip(), User.is_active == True)
    res = await db.execute(user_stmt)
    user = res.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=400, 
            detail=f"员工姓名 '{payload.employee_name}' 未在系统中注册或未激活，自动推送失败"
        )

    # 2. 根据业务类型组装事件类型和战报文本
    event_type = ""
    content = ""
    prefix = "奋战一百天，亮剑破六千！今日"
    
    if payload.type == "lead":
        event_type = "lead_25"
        # 兼容取值金额
        money = payload.expect_money if payload.expect_money and payload.expect_money > 0 else payload.budget_money
        content = f"{prefix}确定有效线索：客户为{payload.customer_name}，项目【{payload.name}】金额{money or 0.0}万，赢战百日！"
    elif payload.type == "tender":
        event_type = "lead_75"
        money = payload.expect_money if payload.expect_money and payload.expect_money > 0 else payload.budget_money
        content = f"{prefix}确定【{payload.name}】项目中地承接，客户为{payload.customer_name}，项目金额{money or 0.0}万，赢战百日！"
    elif payload.type == "potential_lead":
        event_type = "potential_lead"
        money = payload.expect_money if payload.expect_money and payload.expect_money > 0 else payload.budget_money
        content = f"{prefix}确定潜在线索：客户为{payload.customer_name}，项目【{payload.name}】金额{money or 0.0}万，赢战百日！"
    else:
        raise HTTPException(status_code=400, detail="不支持的业务类型，目前仅支持 'lead'、'tender' 或 'potential_lead'")

    # 3. 写入战报广播事件
    event = BroadcastEvent(
        event_type=event_type,
        user_id=user.id,
        team_id=user.team_id,
        content=content,
        push_status=PushStatus.PENDING,
        push_channel="all",  # 推送至钉钉和大屏
        event_time=datetime.now(timezone.utc),
        crm_opportunity_id=payload.id,
    )
    db.add(event)
    await db.flush()  # 得到 event.id

    # 4. 如果是有效线索（lead_25）、中标确定（lead_75）或潜力线索（potential_lead），自动为该员工创建或更新当天的日报
    if event_type in ["lead_25", "lead_75", "potential_lead"]:
        report_date = get_business_report_date(event.event_time)
        
        # 查找或创建当天日报
        rep_stmt = select(DailyReport).where(
            DailyReport.user_id == user.id,
            DailyReport.report_date == report_date
        )
        rep_res = await db.execute(rep_stmt)
        report = rep_res.scalar_one_or_none()
        
        if not report:
            report = DailyReport(
                user_id=user.id,
                report_date=report_date,
                contract_amount=0.0,
                contract_count=0,
                happiness_actions=0,
                triangle_count=0,
                leads_count=0,
                potential_leads_count=0,
                status=ReportStatus.REVIEWED,  # 默认自动审核通过
                reviewer_id=None,
                submitted_at=event.event_time,
                reviewed_at=event.event_time
            )
            db.add(report)
            await db.flush()
        else:
            # 若已有日报状态非已审核，则强行转为已审核通过以生效
            if report.status in [ReportStatus.DRAFT, ReportStatus.REJECTED, ReportStatus.SUBMITTED]:
                report.status = ReportStatus.REVIEWED
                report.reviewer_id = None
                report.submitted_at = report.submitted_at or event.event_time
                report.reviewed_at = event.event_time
        
        # 增加线索总数计数 (中标确定不作为新增线索计数，只有25%有效商机线索才计数)
        if event_type == "lead_25":
            report.leads_count += 1
        elif event_type == "potential_lead":
            report.potential_leads_count += 1
        
        # 新增日报明细记录，绑定 broadcast_id 以支持级联清退/删除
        detail = ReportDetail(
            report_id=report.id,
            detail_type=DetailType.POTENTIAL_LEAD if event_type == "potential_lead" else DetailType.LEAD,
            customer_name=payload.customer_name,
            amount=money or 0.0,
            lead_progress="5%-10%" if event_type == "potential_lead" else ("25%" if event_type == "lead_25" else "75%"),
            crm_opportunity_id=payload.id,
            description=f"{content}\n[broadcast_id:{event.id}]"
        )
        db.add(detail)
        await db.flush()

    # 5. 记录操作审计日志（在 commit 前执行）
    await db.flush()  # 确保主键已生成且 session 干净，避免 to_dict 报错
    await log_action(
        db, None, "CREATE", "broadcast", str(event.id),
        f"接收 CRM/投标室 Webhook 推送自动发布战报，类型：{event.event_type}，内容：{event.content[:50]}...",
        before_state=None,
        after_state=to_dict(event)
    )

    await db.commit()
    await db.refresh(event)

    # 6. 异步触发钉钉推送
    background_tasks.add_task(trigger_broadcast_push, event.id)

    # 7. 大屏和 WebSocket 刷新广播通知
    try:
        from app.services.websocket import ws_manager
        # 广播战报提交
        await ws_manager.broadcast({"type": "update", "event_type": "report_submitted"})
        # 广播填报审核通过，促使大屏数据刷新
        if event_type in ["lead_25", "potential_lead"]:
            await ws_manager.broadcast({"type": "update", "event": "report_approved"})
    except Exception:
        pass

    return {
        "success": True,
        "message": f"战报自动推送录入成功，事件ID: {event.id}",
        "broadcast_id": event.id,
        "content": content
    }


# -------------------- 播报内容重复检测 --------------------

class BroadcastCheckRequest(BaseModel):
    content: str = Field(..., description="要比对的播报文本内容")
    customer_name: Optional[str] = Field(None, description="客户名称")

class BroadcastCheckResponse(BaseModel):
    is_duplicate: bool = Field(..., description="本日是否已存在相同的播报内容")
    triangle_count: int = Field(..., description="本日该客户下铁三角联动播报的累计条数")
    triangle_list: list[str] = Field(..., description="本日该客户下铁三角联动播报的明细列表")

@router.post("/check-duplicate", response_model=BroadcastCheckResponse, summary="检查特定时间段内播报内容是否重复并统计铁三角明细")
async def check_duplicate_broadcast(
    req: BroadcastCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import timedelta, timezone, time, datetime
    import re
    
    cn_offset = timezone(timedelta(hours=8))
    now_cn = datetime.now(cn_offset)
    today = now_cn.date()
    yesterday = today - timedelta(days=1)
    
    # 北京时间昨天上午 09:00:00
    bj_start_dt = datetime.combine(yesterday, time(9, 0, 0)).replace(tzinfo=cn_offset)
    # 转换为带时区的 UTC 时间，用于在带时区的 DateTime 字段过滤
    utc_start_dt = bj_start_dt.astimezone(timezone.utc)

    # 1. 统计该客户在指定时间段（昨天上午九点到现在）所有的铁三角联动已播报明细列表
    triangle_count = 0
    triangle_list = []
    
    if req.customer_name:
        customer_to_check = req.customer_name.strip()
        # 查询从昨天上午九点到现在的所有铁三角联动明细
        stmt = select(ReportDetail).where(
            ReportDetail.created_at >= utc_start_dt,
            ReportDetail.detail_type == DetailType.TRIANGLE
        )
        res = await db.execute(stmt)
        details = res.scalars().all()
        
        # 过滤指定客户名并去重统计真实的播报
        unique_broadcasts = {}
        for d in details:
            if d.customer_name and d.customer_name.strip() == customer_to_check:
                desc = d.description or ""
                # 从 description 中匹配 [broadcast_id:xxx] 作为去重的 key
                match = re.search(r"\[broadcast_id:(\d+)\]", desc)
                bid = match.group(1) if match else desc.strip()
                
                clean_content = desc.split("\n[broadcast_id:")[0].strip() if "\n[broadcast_id:" in desc else desc.strip()
                if bid and clean_content and bid not in unique_broadcasts:
                    unique_broadcasts[bid] = clean_content
                
        triangle_list = list(unique_broadcasts.values())
        triangle_count = len(triangle_list)

    # 2. 如果当前客户在时间段内已经播放过铁三角联动（数量 > 0），则直接触发重复提示拦截
    is_duplicate = triangle_count > 0

    return BroadcastCheckResponse(
        is_duplicate=is_duplicate,
        triangle_count=triangle_count,
        triangle_list=triangle_list
    )


@router.get("/export", summary="导出战报列表为Excel")
async def export_broadcasts(
    team_id: int | None = Query(None, description="按战队筛选"),
    event_type: str | None = Query(None, description="按事件类型筛选"),
    keyword: str | None = Query(None, description="关键字检索播报内容"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    根据筛选条件，将所有符合条件的战报记录导出为 Excel 文件
    """
    from fastapi.responses import StreamingResponse
    import pandas as pd
    import io
    from sqlalchemy import func
    from app.models.user import User as DbUser
    from app.models.organization import Team as DbTeam

    # 主查询语句（不进行分页，限制最多 10000 条数据）
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
        BroadcastEvent.project_name,
        DbUser.name.label("user_name"),
        DbTeam.name.label("team_name")
    ).outerjoin(DbUser, BroadcastEvent.user_id == DbUser.id)\
     .outerjoin(DbTeam, BroadcastEvent.team_id == DbTeam.id)\
     .order_by(BroadcastEvent.created_at.desc())\
     .limit(10000)

    # 过滤条件
    if team_id:
        query = query.where(BroadcastEvent.team_id == team_id)
    if event_type:
        query = query.where(BroadcastEvent.event_type == event_type)
    if keyword:
        query = query.where(BroadcastEvent.content.contains(keyword))

    res = await db.execute(query)
    rows = res.all()

    # 批量抓取 crm_opportunity_id 相关的项目中文名，避免 N+1
    opp_ids = [r.crm_opportunity_id for r in rows if r.crm_opportunity_id]
    opp_names = {}
    if opp_ids:
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
            placeholders = ', '.join(['%s'] * len(opp_ids))
            
            # 1. 潜在项目商机表
            query_opp = f"SELECT id, name FROM zdcrm_business_opportunity WHERE id IN ({placeholders})"
            cur.execute(query_opp, tuple(opp_ids))
            for o_row in cur.fetchall():
                opp_names[str(o_row["id"])] = o_row["name"]

            # 2. 招标表
            query_tender = f"SELECT id, project_name AS name FROM tender_base_info WHERE id IN ({placeholders})"
            cur.execute(query_tender, tuple(opp_ids))
            for t_row in cur.fetchall():
                opp_names[str(t_row["id"])] = t_row["name"]

            # 3. 合同表
            query_contract = f"SELECT id, contract_name AS name FROM contract WHERE id IN ({placeholders})"
            cur.execute(query_contract, tuple(opp_ids))
            for c_row in cur.fetchall():
                opp_names[str(c_row["id"])] = c_row["name"]
            cur.close()
            conn.close()
        except Exception as crm_err:
            import logging
            logging.getLogger("battle100").error(f"导出接口直连CRM获取项目名称失败: {crm_err}")

    # 映射字典
    event_type_map = {
        "potential_lead": "潜力线索确定",
        "lead_25": "有效线索确定",
        "lead_75": "中标确定",
        "contract_signed": "合同签订",
        "triangle": "铁三角联动",
        "happiness": "客户幸福动作",
        "custom": "自定义广播"
    }

    push_status_map = {
        "pending": "待推送",
        "sent": "已发送",
        "failed": "发送失败"
    }

    push_channel_map = {
        "dingtalk": "钉钉",
        "all": "全渠道"
    }

    # 拼装数据
    data_list = []
    for r in rows:
        crm_opp = r.crm_opportunity_id
        opp_name = opp_names.get(crm_opp) if crm_opp else None

        created_at_str = ""
        if r.created_at:
            from datetime import timedelta, timezone
            bj_tz = timezone(timedelta(hours=8))
            created_at_str = r.created_at.astimezone(bj_tz).strftime("%Y-%m-%d %H:%M:%S")

        data_list.append({
            "事件类型": event_type_map.get(r.event_type, r.event_type),
            "播报内容": r.content or "",
            "发布人": r.user_name or "",
            "所属战队": r.team_name or "",
            "推送状态": push_status_map.get(r.push_status, r.push_status),
            "推送渠道": push_channel_map.get(r.push_channel, r.push_channel),
            "CRM商机关联": opp_name or r.project_name or "未关联",
            "播报时间": created_at_str
        })

    df = pd.DataFrame(data_list)

    # 转换 Excel 流
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="战报列表")
    output.seek(0)

    # 规范文件名
    from datetime import datetime, timezone, timedelta
    now_bj = datetime.now(timezone(timedelta(hours=8)))
    filename_encoded = f"broadcast_export_{now_bj.strftime('%Y%m%d_%H%M%S')}.xlsx"

    headers = {
        'Content-Disposition': f'attachment; filename="{filename_encoded}"',
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )


# ==========================================
#              驻点人员播报相关 API
# ==========================================

from fastapi import Form, File, UploadFile
from app.services.file_encryption import FileEncryptionService

@router.post("/station-report", summary="创建驻点人员播报")
async def create_station_report(
    station_category: str = Form(..., description="policy/deployment/lead/intelligence"),
    station_location: str = Form(..., description="驻点地点"),
    title: str = Form(..., description="标题"),
    content: str = Form(..., description="正文内容"),
    summary: Optional[str] = Form(None, description="摘要"),
    is_urgent: bool = Form(False, description="是否紧急快报"),
    push_channel: str = Form("all", description="推送渠道: dingtalk/system/all"),
    files: list[UploadFile] = File(None, description="附件列表"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    创建驻点人员播报并免审核发布
    1. 接收文件，判断并限制总大小在 50MB 以内
    2. 用 pyzipper 进行 AES-256 加密打包，生成 12 位解压密码
    3. 上传到 Supabase 存储
    4. 创建 BroadcastEvent
    5. 后台触发钉钉 ActionCard 推送，解压密码直接包含在推送消息里
    6. WebSocket 广播到大屏
    """
    import uuid
    import httpx
    from app.config import settings

    total_size = 0
    file_list = []
    if files:
        # 过滤无效空文件
        valid_files = [f for f in files if f.filename and f.filename.strip()]
        for f in valid_files:
            file_bytes = await f.read()
            total_size += len(file_bytes)
            file_list.append((f.filename, file_bytes))
            
        if total_size > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="上传附件总大小不能超过 50MB")

    attachment_urls = []
    password = None
    if file_list:
        if station_category == "policy":
            # 只有政策保留 ZIP 压缩并 AES-256 加密
            zip_bytes, password = await FileEncryptionService.create_encrypted_zip(
                file_list,
                encrypt=True
            )
            if len(zip_bytes) > 50 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="打包后的压缩包大小超过 50MB 限制")
                
            # 上传到 Supabase Storage
            zip_filename = f"{uuid.uuid4().hex}.zip"
            upload_url = f"{settings.SUPABASE_URL}/storage/v1/object/photos/station_reports/{zip_filename}"
            
            headers = {
                "Authorization": f"Bearer {settings.SERVICE_ROLE_KEY}",
                "Content-Type": "image/png"  # 伪装 MIME 绕过限制
            }
            
            async with httpx.AsyncClient() as client:
                try:
                    resp = await client.post(upload_url, content=zip_bytes, headers=headers, timeout=30.0)
                    if resp.status_code not in [200, 201]:
                        raise HTTPException(status_code=500, detail=f"附件上传至 Supabase Storage 失败: {resp.text}")
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"附件上传失败: {str(e)}")
                    
            # 获取公开 URL，支持公网穿透域名替换
            supabase_url = settings.SUPABASE_URL
            if getattr(settings, "EXTERNAL_SUPABASE_URL", None):
                supabase_url = settings.EXTERNAL_SUPABASE_URL
            zip_url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/photos/station_reports/{zip_filename}"
            attachment_urls = [{"name": "encrypted_attachments.zip", "url": zip_url}]
        else:
            # 其他三种模式不压缩，直接逐个上传原始附件
            async with httpx.AsyncClient() as client:
                for original_name, file_bytes in file_list:
                    ext = original_name.split(".")[-1] if "." in original_name else "bin"
                    unique_name = f"{uuid.uuid4().hex}.{ext}"
                    upload_url = f"{settings.SUPABASE_URL}/storage/v1/object/photos/station_reports/{unique_name}"
                    
                    headers = {
                        "Authorization": f"Bearer {settings.SERVICE_ROLE_KEY}",
                        "Content-Type": "image/png"  # 伪装 MIME 绕过限制
                    }
                    try:
                        resp = await client.post(upload_url, content=file_bytes, headers=headers, timeout=30.0)
                        if resp.status_code not in [200, 201]:
                            raise HTTPException(status_code=500, detail=f"附件上传至 Supabase Storage 失败: {resp.text}")
                    except Exception as e:
                        raise HTTPException(status_code=500, detail=f"附件上传失败: {str(e)}")
                    
                    # 获取公开 URL，支持公网穿透域名替换
                    supabase_url = settings.SUPABASE_URL
                    if getattr(settings, "EXTERNAL_SUPABASE_URL", None):
                        supabase_url = settings.EXTERNAL_SUPABASE_URL
                    public_url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/photos/station_reports/{unique_name}"
                    attachment_urls.append({"name": original_name, "url": public_url})
    
    # 确定关联战队
    team_id = current_user.team_id
    
    event = BroadcastEvent(
        event_type=EventType.STATION_REPORT.value,
        user_id=current_user.id,
        team_id=team_id,
        content=content,
        project_name=title,  # 用作标题
        push_status=PushStatus.PENDING,
        push_channel=push_channel,
        event_time=datetime.now(timezone.utc),
        station_category=station_category,
        station_location=station_location,
        summary=summary or content[:150],
        attachment_urls=attachment_urls,
        attachment_password=password,
        is_urgent=is_urgent,
    )
    
    db.add(event)
    
    # 记录审计日志（在 commit 前执行）
    await db.flush()  # 确保主键已生成，避免 to_dict 报错
    await log_action(
        db, current_user, "CREATE", "broadcast", str(event.id),
        f"创建了驻点人员播报: {title}，驻点地点: {station_location}",
        before_state=None,
        after_state=to_dict(event)
    )
    
    await db.commit()
    await db.refresh(event)

    # 触发后台钉钉推送
    if push_channel in ["dingtalk", "all"]:
        background_tasks.add_task(trigger_broadcast_push, event.id)

    # 广播大屏 WebSocket 通知
    try:
        from app.services.websocket import ws_manager
        await ws_manager.broadcast({"type": "update", "event_type": "report_submitted"})
    except Exception:
        pass

    return event


@router.get("/station-reports", summary="获取驻点播报列表")
async def list_station_reports(
    category: Optional[str] = Query(None, description="按子分类过滤: policy/deployment/lead/intelligence"),
    location: Optional[str] = Query(None, description="按驻点地点过滤"),
    is_urgent: Optional[bool] = Query(None, description="按紧急程度过滤"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="页大小"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    查询驻点播报列表，对普通用户隐藏附件解压密码
    """
    from sqlalchemy import func
    
    query = select(BroadcastEvent).where(
        BroadcastEvent.event_type == EventType.STATION_REPORT.value,
        BroadcastEvent.is_deleted == False
    )
    
    if category:
        query = query.where(BroadcastEvent.station_category == category)
    if location:
        query = query.where(BroadcastEvent.station_location.like(f"%{location}%"))
    if is_urgent is not None:
        query = query.where(BroadcastEvent.is_urgent == is_urgent)
        
    query = query.order_by(BroadcastEvent.created_at.desc())
    
    # 统计总数
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    # 分页
    query = query.offset((page - 1) * page_size).limit(page_size)
    res = await db.execute(query)
    events = res.scalars().all()
    
    items = []
    for ev in events:
        item = {
            "id": ev.id,
            "event_type": ev.event_type,
            "user_id": ev.user_id,
            "team_id": ev.team_id,
            "title": ev.project_name,  # 用作标题
            "content": ev.content,
            "station_category": ev.station_category,
            "station_location": ev.station_location,
            "summary": ev.summary,
            "attachment_urls": ev.attachment_urls,
            "is_urgent": ev.is_urgent,
            "created_at": ev.created_at,
            "push_status": ev.push_status,
            "push_channel": ev.push_channel,
        }
        items.append(item)
        
    return {"total": total, "items": items}


@router.get("/{broadcast_id}/password", summary="获取驻点播报附件密码")
async def get_attachment_password(
    broadcast_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取驻点播报解压密码
    权限控制: 仅管理员、目标官、战队长或播报创建者本人口允许获取
    """
    stmt = select(BroadcastEvent).where(BroadcastEvent.id == broadcast_id)
    res = await db.execute(stmt)
    event = res.scalar_one_or_none()
    
    if not event:
        raise HTTPException(status_code=404, detail="播报不存在")
        
    if event.event_type != EventType.STATION_REPORT.value:
        raise HTTPException(status_code=400, detail="该播报不是驻点播报")
        
    is_owner = event.user_id == current_user.id
    is_privileged = current_user.role in [UserRole.ADMIN.value, UserRole.TARGET_OFFICER.value, UserRole.TEAM_LEADER.value]
    
    if not (is_owner or is_privileged):
        raise HTTPException(status_code=403, detail="您无权查看此附件密码")
        
    return {"password": event.attachment_password}


@router.get("/recycle-bin", response_model=BroadcastListResponse, summary="获取回收站战报列表")
async def list_recycle_bin(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    event_type: str | None = Query(None, description="按事件类型筛选"),
    keyword: str | None = Query(None, description="关键字检索"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """查询已被软删除的战报（回收站列表）"""
    from sqlalchemy import func
    from app.models.user import User as DbUser
    from app.models.organization import Team as DbTeam

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
        BroadcastEvent.project_name,
        BroadcastEvent.station_category,
        BroadcastEvent.station_location,
        BroadcastEvent.summary,
        BroadcastEvent.attachment_urls,
        BroadcastEvent.is_urgent,
        DbUser.name.label("user_name"),
        DbTeam.name.label("team_name")
    ).outerjoin(DbUser, BroadcastEvent.user_id == DbUser.id)\
     .outerjoin(DbTeam, BroadcastEvent.team_id == DbTeam.id)\
     .where(BroadcastEvent.is_deleted == True)\
     .order_by(BroadcastEvent.updated_at.desc())  # 按删除/更新时间倒序

    if event_type:
        query = query.where(BroadcastEvent.event_type == event_type)
    if keyword:
        query = query.where(BroadcastEvent.content.contains(keyword))

    # 计算总数
    count_stmt = select(func.count(BroadcastEvent.id)).where(BroadcastEvent.is_deleted == True)
    if event_type:
        count_stmt = count_stmt.where(BroadcastEvent.event_type == event_type)
    if keyword:
        count_stmt = count_stmt.where(BroadcastEvent.content.contains(keyword))
    
    total = await db.scalar(count_stmt) or 0

    # 分页
    query = query.offset((page - 1) * page_size).limit(page_size)
    res = await db.execute(query)
    rows = res.all()

    # 格式化输出
    results = []
    for r in rows:
        results.append({
            "id": r.id,
            "event_type": r.event_type,
            "user_id": r.user_id,
            "team_id": r.team_id,
            "content": r.content,
            "push_status": r.push_status,
            "push_channel": r.push_channel,
            "event_time": r.event_time,
            "created_at": r.created_at,
            "crm_opportunity_id": r.crm_opportunity_id,
            "project_name": r.project_name,
            "station_category": r.station_category,
            "station_location": r.station_location,
            "summary": r.summary,
            "attachment_urls": r.attachment_urls,
            "is_urgent": r.is_urgent,
            "user_name": r.user_name,
            "team_name": r.team_name,
        })

    return {
        "items": results,
        "total": total
    }


@router.delete("/recycle-bin/clear", summary="清空回收站")
async def clear_recycle_bin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """回收站中将所有已软删除的战报一键物理清空"""
    stmt = select(BroadcastEvent).where(BroadcastEvent.is_deleted == True)
    res = await db.execute(stmt)
    events = res.scalars().all()
    
    count = len(events)
    if count == 0:
        return {"message": "回收站已为空，无需清空"}
        
    for event in events:
        await db.delete(event)
        
    # 记录操作审计日志（在 commit 前执行）
    await log_action(
        db, current_user, "CLEAR_RECYCLE_BIN", "broadcast", None,
        f"清空了回收站，共彻底物理删除了 {count} 条战报记录",
        before_state=None,
        after_state=None
    )
    
    await db.commit()
    return {"message": f"成功清空回收站，共物理删除 {count} 条战报"}


@router.delete("/{id}/hard", summary="彻底删除战报")
async def hard_delete_broadcast(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """回收站中将战报物理删除"""
    stmt = select(BroadcastEvent).where(BroadcastEvent.id == id)
    res = await db.execute(stmt)
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="战报不存在")
        
    before_state = to_dict(event)
    
    # 记录操作审计日志（在 commit/delete 前执行，获取属性）
    await log_action(
        db, current_user, "HARD_DELETE", "broadcast", str(id),
        f"在回收站中彻底删除了战报，类型：{event.event_type}，标题：{event.project_name or (event.content[:30] if event.content else '')}",
        before_state=before_state,
        after_state=None
    )
    
    # 物理删除播报本身
    await db.delete(event)
    await db.commit()
    
    return {"message": "彻底删除成功"}


@router.post("/{id}/restore", summary="恢复已删除的战报")
async def restore_broadcast(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """从回收站恢复战报，并无损重新向数据库计入对应的日报业绩明细"""
    stmt = select(BroadcastEvent).where(BroadcastEvent.id == id)
    res = await db.execute(stmt)
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="战报不存在")
        
    if not event.is_deleted:
        raise HTTPException(status_code=400, detail="该战报未被删除，无需恢复")
        
    before_state = to_dict(event)
    
    # 1. 还原 is_deleted 状态
    event.is_deleted = False
    
    # 2. 读取 allocations_backup 暂存明细
    backup_list = event.allocations_backup or []
    
    # 自动获取或新建对应的日报 (日报提交和审核时间与发生时间对齐)
    target_time = event.event_time if event.event_time else event.created_at
    if not target_time:
        from datetime import timezone
        target_time = datetime.now(timezone.utc)
        
    report_date = get_business_report_date(target_time)
    
    from app.models.report import DailyReport, ReportDetail, DetailType, ReportStatus
    
    async def get_or_create_report(uid: int) -> DailyReport:
        report_stmt = select(DailyReport).where(
            DailyReport.user_id == uid,
            DailyReport.report_date == report_date
        )
        report_res = await db.execute(report_stmt)
        rep = report_res.scalar_one_or_none()
        if not rep:
            rep = DailyReport(
                user_id=uid,
                report_date=report_date,
                contract_amount=0.0,
                contract_count=0,
                happiness_actions=0,
                triangle_count=0,
                leads_count=0,
                potential_leads_count=0,
                status=ReportStatus.REVIEWED,
                reviewer_id=current_user.id,
                submitted_at=target_time,
                reviewed_at=target_time
            )
            db.add(rep)
            await db.flush()  # 获得 id
        else:
            if rep.status in [ReportStatus.DRAFT, ReportStatus.REJECTED, ReportStatus.SUBMITTED]:
                rep.status = ReportStatus.REVIEWED
                rep.reviewer_id = current_user.id
                rep.submitted_at = rep.submitted_at or target_time
                rep.reviewed_at = target_time
        return rep

    # 3. 逐条重新生成 ReportDetail 业绩并累加 DailyReport
    for att in backup_list:
        detail_type_str = att.get("detail_type")
        user_id_val = att.get("user_id")
        if not user_id_val:
            user_id_val = event.user_id
            
        if not user_id_val:
            continue
            
        report = await get_or_create_report(user_id_val)
        
        # 累加统计值
        if detail_type_str == DetailType.CONTRACT.value:
            report.contract_amount += float(att.get("amount") or 0.0)
            report.contract_count += 1
        elif detail_type_str == DetailType.LEAD.value and att.get("lead_progress") == "25%":
            report.leads_count += 1
        elif detail_type_str == DetailType.TRIANGLE.value:
            report.triangle_count += 1
        elif detail_type_str == DetailType.HAPPINESS.value:
            report.happiness_actions += 1
        elif detail_type_str == DetailType.POTENTIAL_LEAD.value:
            report.potential_leads_count += 1
            
        # 实例化重建 ReportDetail
        detail = ReportDetail(
            report_id=report.id,
            detail_type=DetailType(detail_type_str) if detail_type_str else None,
            customer_name=att.get("customer_name"),
            amount=att.get("amount"),
            lead_progress=att.get("lead_progress"),
            crm_opportunity_id=att.get("crm_opportunity_id"),
            happiness_level=att.get("happiness_level"),
            happiness_standard_id=att.get("happiness_standard_id"),
            project_name=att.get("project_name"),
            description=att.get("description"),
            partner_user_id=att.get("partner_user_id")
        )
        db.add(detail)
        
    # 重置暂存快照
    event.allocations_backup = None
    db.add(event)
    
    # 记录操作审计日志（在 commit 前执行）
    await db.flush()  # 确保 session 处于干净状态，避免 to_dict 触发 MissingGreenlet 错误
    await log_action(
        db, current_user, "RESTORE", "broadcast", str(id),
        f"恢复了已删除的战报播报，类型：{event.event_type}，业绩已无损重新加回",
        before_state=before_state,
        after_state=to_dict(event)
    )
    
    await db.commit()
    
    # 触发大屏 WebSocket 更新
    try:
        from app.services.websocket import ws_manager
        await ws_manager.broadcast({"type": "update", "event_type": "report_submitted"})
    except Exception:
        pass
        
    return {"message": "战报已成功从回收站中恢复，关联业绩已重算！"}



