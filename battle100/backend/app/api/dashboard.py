from datetime import date, datetime, timezone, timedelta
import random
import logging
import pymysql
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload, aliased

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole, PositionType
from app.models.report import DailyReport, ReportStatus, ReportDetail, DetailType
from app.models.organization import Team, Zone
from app.models.goal import TeamGoal, TeamGoalCategory, WeeklyTarget
from app.schemas.dashboard import (
    DashboardResponse,
    KpiSummary,
    KpiItem,
    RankingItem,
    LiveFeedItem,
    WeeklyTrendData,
    WeeklyTrend,
)

logger = logging.getLogger("battle100")

PartnerUser = aliased(User)

async def get_team_marketing_actual(db: AsyncSession, team_id: int) -> float:
    """计算战队的真实营销新签合同额（填报人是该战队营销岗，或者搭档是该战队营销岗）"""
    query = (
        select(func.coalesce(func.sum(ReportDetail.amount), 0))
        .select_from(ReportDetail)
        .join(DailyReport, ReportDetail.report_id == DailyReport.id)
        .join(User, DailyReport.user_id == User.id)
        .outerjoin(PartnerUser, ReportDetail.partner_user_id == PartnerUser.id)
        .where(
            DailyReport.status == ReportStatus.REVIEWED,
            ReportDetail.detail_type == DetailType.CONTRACT,
            (
                ((User.team_id == team_id) & (User.position_type == PositionType.MARKETING)) |
                ((PartnerUser.team_id == team_id) & (PartnerUser.position_type == PositionType.MARKETING))
            )
        )
    )
    return float(await db.scalar(query) or 0.0)

async def get_team_delivery_actual(db: AsyncSession, team_id: int) -> float:
    """计算战队的真实交付新签合同额（填报人是该战队交付岗，或者搭档是该战队交付岗）"""
    query = (
        select(func.coalesce(func.sum(ReportDetail.amount), 0))
        .select_from(ReportDetail)
        .join(DailyReport, ReportDetail.report_id == DailyReport.id)
        .join(User, DailyReport.user_id == User.id)
        .outerjoin(PartnerUser, ReportDetail.partner_user_id == PartnerUser.id)
        .where(
            DailyReport.status == ReportStatus.REVIEWED,
            ReportDetail.detail_type == DetailType.CONTRACT,
            (
                ((User.team_id == team_id) & (User.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY]))) |
                ((PartnerUser.team_id == team_id) & (PartnerUser.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY])))
            )
        )
    )
    return float(await db.scalar(query) or 0.0)

async def get_team_weekly_marketing_actual(db: AsyncSession, start_date: date, end_date: date, team_id: int | None = None) -> float:
    query = (
        select(func.coalesce(func.sum(ReportDetail.amount), 0))
        .select_from(ReportDetail)
        .join(DailyReport, ReportDetail.report_id == DailyReport.id)
        .join(User, DailyReport.user_id == User.id)
        .outerjoin(PartnerUser, ReportDetail.partner_user_id == PartnerUser.id)
        .where(
            DailyReport.report_date >= start_date,
            DailyReport.report_date <= end_date,
            DailyReport.status == ReportStatus.REVIEWED,
            ReportDetail.detail_type == DetailType.CONTRACT,
        )
    )
    if team_id:
        query = query.where(
            (
                ((User.team_id == team_id) & (User.position_type == PositionType.MARKETING)) |
                ((PartnerUser.team_id == team_id) & (PartnerUser.position_type == PositionType.MARKETING))
            )
        )
    else:
        query = query.where(
            (User.position_type == PositionType.MARKETING) | (PartnerUser.position_type == PositionType.MARKETING)
        )
    return float(await db.scalar(query) or 0.0)

async def get_team_weekly_delivery_actual(db: AsyncSession, start_date: date, end_date: date, team_id: int | None = None) -> float:
    query = (
        select(func.coalesce(func.sum(ReportDetail.amount), 0))
        .select_from(ReportDetail)
        .join(DailyReport, ReportDetail.report_id == DailyReport.id)
        .join(User, DailyReport.user_id == User.id)
        .outerjoin(PartnerUser, ReportDetail.partner_user_id == PartnerUser.id)
        .where(
            DailyReport.report_date >= start_date,
            DailyReport.report_date <= end_date,
            DailyReport.status == ReportStatus.REVIEWED,
            ReportDetail.detail_type == DetailType.CONTRACT,
        )
    )
    if team_id:
        query = query.where(
            (
                ((User.team_id == team_id) & (User.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY]))) |
                ((PartnerUser.team_id == team_id) & (PartnerUser.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY])))
            )
        )
    else:
        query = query.where(
            (User.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY])) | 
            (PartnerUser.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY]))
        )
    return float(await db.scalar(query) or 0.0)


router = APIRouter(prefix="/dashboard", tags=["作战大屏"])

async def seed_mock_reports_if_needed(db: AsyncSession):
    """
    已禁用自动假数据生成，只展示由用户导入和填报的真实数据。
    """
    return
    # 检查已审核的日报数量
    count_res = await db.execute(
        select(func.count(DailyReport.id)).where(DailyReport.status == ReportStatus.REVIEWED)
    )
    total_reviewed = count_res.scalar() or 0
    if total_reviewed >= 10:
        return

    logger.info("检测到系统已审核填报数据不足，自动生成高保真历史已审核数据以丰富大屏展现...")
    
    # 确保战队目标有默认记录，作为完成率计算基准
    team_res = await db.execute(select(Team))
    teams = team_res.scalars().all()
    if not teams:
        return

    # 给战队插入新签合同目标
    for t in teams:
        goal_res = await db.execute(select(TeamGoal).where(TeamGoal.team_id == t.id))
        existing_goals = goal_res.scalars().all()
        if not existing_goals:
            # 营销目标 (400-1500万)
            g_m = TeamGoal(
                team_id=t.id,
                category=TeamGoalCategory.MARKETING,
                base_target=random.randint(600, 1400),
                red_line_target=random.randint(400, 1100),
                gap=random.randint(100, 300)
            )
            # 交付目标 (300-1000万)
            g_d = TeamGoal(
                team_id=t.id,
                category=TeamGoalCategory.DELIVERY,
                base_target=random.randint(400, 1000),
                red_line_target=random.randint(300, 800),
                gap=random.randint(50, 200)
            )
            db.add(g_m)
            db.add(g_d)

    # 随机给 60 个员工在过去 5 天中生成已审核通过的日报
    user_res = await db.execute(select(User).where(User.role != UserRole.ADMIN))
    users = user_res.scalars().all()
    if not users:
        await db.flush()
        return

    # 动态获取一个存在的超级管理员作为审核人，没有则用第一个普通用户兜底
    admin_id_res = await db.execute(select(User.id).where(User.role == UserRole.ADMIN).limit(1))
    admin_id = admin_id_res.scalar()
    if not admin_id and users:
        admin_id = users[0].id

    today = date.today()
    random_users = random.sample(users, min(len(users), 80))
    for u in random_users:
        num_days = random.randint(2, 4)
        for offset in range(1, num_days + 1):
            report_date = today - timedelta(days=offset)
            
            # 随机概率生成新签合同额，不管岗位类型以确保 KPI 卡片能展示非零实绩
            contract_amount = 0.0
            contract_count = 0
            if random.random() > 0.75:
                contract_amount = round(random.uniform(15.0, 160.0), 2)
                contract_count = random.choice([1, 2])

            happiness = random.randint(1, 5)
            triangle = random.randint(0, 3)
            leads = random.randint(0, 3)

            report = DailyReport(
                user_id=u.id,
                report_date=report_date,
                contract_amount=contract_amount,
                contract_count=contract_count,
                happiness_actions=happiness,
                triangle_count=triangle,
                leads_count=leads,
                work_summary="深化客户合作关系，推进商务及技术条款落实。",
                work_reflection="通过铁三角紧密联动，缩短项目商务周期。",
                next_day_plan="开展方案交付与宣讲，协助客户完成招投标工作。",
                standup_notes="完成昨日新签与线索拜访计划。",
                status=ReportStatus.REVIEWED,
                reviewer_id=admin_id,
                submitted_at=datetime.now() - timedelta(days=offset),
                reviewed_at=datetime.now() - timedelta(days=offset)
            )
            db.add(report)

    # 检查并生成周目标 WeeklyTarget 假数据以配合趋势折线
    w_res = await db.execute(select(WeeklyTarget))
    if not w_res.scalars().all():
        for t in teams:
            for w in range(1, 8):
                w_start = today - timedelta(weeks=(8-w))
                w_end = w_start + timedelta(days=6)
                
                m_target = round(random.uniform(40.0, 150.0), 2)
                d_target = round(random.uniform(30.0, 100.0), 2)
                m_actual = round(m_target * random.uniform(0.75, 1.25), 2) if w < 6 else 0.0
                d_actual = round(d_target * random.uniform(0.8, 1.2), 2) if w < 6 else 0.0
                
                wt = WeeklyTarget(
                    team_id=t.id,
                    week_number=w,
                    week_start=w_start,
                    week_end=w_end,
                    marketing_target=m_target,
                    delivery_target=d_target,
                    marketing_actual=m_actual,
                    delivery_actual=d_actual
                )
                db.add(wt)

    await db.flush()


@router.get("/overview", response_model=DashboardResponse, summary="获取大屏总览数据")
async def get_dashboard_overview(
    target_date: date | None = Query(None, description="数据日期，默认今天"),
    db: AsyncSession = Depends(get_db),
):
    """
    获取作战大屏总览数据，包括 KPI 汇总、战区赛马竞速、周趋势、滚动播报和个人英雄榜。
    """
    if target_date is None:
        target_date = date.today()

    # 1. 战役累计数据统计
    summary_result = await db.execute(
        select(
            func.coalesce(func.sum(DailyReport.contract_amount), 0).label("total_amount"),
            func.coalesce(func.sum(DailyReport.contract_count), 0).label("total_count"),
            func.coalesce(func.sum(DailyReport.happiness_actions), 0).label("total_happiness"),
            func.coalesce(func.sum(DailyReport.triangle_count), 0).label("total_triangle"),
            func.coalesce(func.sum(DailyReport.leads_count), 0).label("total_leads"),
        ).where(DailyReport.status == ReportStatus.REVIEWED)
    )
    row = summary_result.one()

    # 查询战区与战队总目标以计算总签约目标额（仅包含营销新签目标以修正分轨，并保留两位小数）
    total_base_target_res = await db.execute(
        select(func.coalesce(func.sum(TeamGoal.base_target), 0))
        .where(TeamGoal.category == TeamGoalCategory.MARKETING)
    )
    total_contract_target = round(float(total_base_target_res.scalar() or 6200.0), 2)

    # 构造 KPI Summary 属性
    # 新签合同
    val_contracts = float(row.total_amount)
    pct_contracts = round((val_contracts / total_contract_target) * 100, 2) if total_contract_target > 0 else 0.0
    kpi_contracts = KpiItem(value=round(val_contracts, 2), target=total_contract_target, percentage=pct_contracts)

    # 客户幸福：目标 3300 次
    val_happiness = int(row.total_happiness)
    pct_happiness = round((val_happiness / 3300) * 100, 2)
    kpi_happiness = KpiItem(value=val_happiness, target=3300, percentage=pct_happiness)

    # 铁三角：目标 500 次
    val_triangle = int(row.total_triangle)
    pct_triangle = round((val_triangle / 500) * 100, 2)
    kpi_triangle = KpiItem(value=val_triangle, target=500, percentage=pct_triangle)

    # 有效线索：目标 600 条
    val_leads = int(row.total_leads)
    pct_leads = round((val_leads / 600) * 100, 2)
    kpi_leads = KpiItem(value=val_leads, target=600, percentage=pct_leads)

    kpi_summary = KpiSummary(
        newContracts=kpi_contracts,
        happinessActions=kpi_happiness,
        ironTriangle=kpi_triangle,
        validLeads=kpi_leads
    )

    # 2. 战区赛马竞速榜 (实时百分比)
    zones_res = await db.execute(select(Zone).order_by(Zone.sort_order))
    zones = zones_res.scalars().all()

    zone_ranking_list = []
    zone_teams_pk = {}
    for idx, z in enumerate(zones):
        # 聚合该战区内部的所有战队自相PK数据
        t_res = await db.execute(select(Team).where(Team.zone_id == z.id))
        zone_teams = t_res.scalars().all()
        
        # 统计该战区下所有战队的已审核营销新签实际值之和作为战区实际
        z_actual = 0.0
        for t in zone_teams:
            z_actual += await get_team_marketing_actual(db, t.id)

        # 查询该战区下所有战队的目标新签保底额之和（仅包含营销新签目标，并保留两位小数）
        z_target_res = await db.execute(
            select(func.coalesce(func.sum(TeamGoal.base_target), 0))
            .select_from(Team)
            .join(TeamGoal, Team.id == TeamGoal.team_id)
            .where(Team.zone_id == z.id, TeamGoal.category == TeamGoalCategory.MARKETING)
        )
        z_target = round(float(z_target_res.scalar() or 2000.0), 2)

        z_pct = round((z_actual / z_target) * 100, 2) if z_target > 0 else 0.0
        zone_ranking_list.append({
            "name": z.name,
            "score": z_pct
        })
        
        team_pk_items = []
        for t in zone_teams:
            # 统计该战队已审核真实营销签约额
            t_actual = await get_team_marketing_actual(db, t.id)

            # 获取该战队新签基准目标
            t_target_res = await db.execute(
                select(TeamGoal.base_target)
                .where(TeamGoal.team_id == t.id, TeamGoal.category == TeamGoalCategory.MARKETING)
            )
            t_target = float(t_target_res.scalar() or 600.0)

            t_pct = round((t_actual / t_target) * 100, 2) if t_target > 0 else 0.0
            team_pk_items.append({
                "name": t.name,
                "score": t_pct
            })
            
        # 在战区组内，按完成百分比降序排列
        team_pk_items.sort(key=lambda x: x["score"], reverse=True)
        ranking_items = []
        for t_idx, item in enumerate(team_pk_items):
            ranking_items.append(
                RankingItem(
                    rank=t_idx + 1,
                    name=item["name"],
                    score=item["score"],
                    teamName=z.name,
                    trend="up" if t_idx == 0 else "same"
                )
            )
        zone_teams_pk[z.name] = ranking_items
    
    # 按照完成百分比从高到低排序，生成带 Rank 的列表
    zone_ranking_list.sort(key=lambda x: x["score"], reverse=True)
    zone_ranking = []
    for idx, item in enumerate(zone_ranking_list):
        zone_ranking.append(
            RankingItem(
                rank=idx + 1,
                name=item["name"],
                score=item["score"],
                trend="up" if idx == 0 else "same"
            )
        )

    # 3. 构造周度趋势 WeeklyTrendData
    weekly_dates_res = await db.execute(
        select(
            WeeklyTarget.week_number,
            func.min(WeeklyTarget.week_start).label("start_date"),
            func.max(WeeklyTarget.week_end).label("end_date")
        ).group_by(WeeklyTarget.week_number)
        .order_by(WeeklyTarget.week_number)
    )
    weekly_periods = weekly_dates_res.all()

    trend_dates = []
    trend_contracts = []
    trend_happiness = []
    trend_triangle = []
    trend_leads = []

    for w in weekly_periods:
        week_num = w.week_number
        s_date = w.start_date
        e_date = w.end_date
        
        # 查询该周范围内已审核的真实合同额、幸福、铁三角和线索
        w_actual_res = await db.execute(
            select(
                func.coalesce(func.sum(DailyReport.contract_amount), 0).label("amount"),
                func.coalesce(func.sum(DailyReport.happiness_actions), 0).label("happiness"),
                func.coalesce(func.sum(DailyReport.triangle_count), 0).label("triangle"),
                func.coalesce(func.sum(DailyReport.leads_count), 0).label("leads"),
            ).where(
                DailyReport.report_date >= s_date,
                DailyReport.report_date <= e_date,
                DailyReport.status == ReportStatus.REVIEWED
            )
        )
        w_row = w_actual_res.one()
        
        trend_dates.append(f"第{week_num}周")
        trend_contracts.append(round(float(w_row.amount), 2))
        trend_happiness.append(int(w_row.happiness))
        trend_triangle.append(int(w_row.triangle))
        trend_leads.append(int(w_row.leads))

    weekly_trend = WeeklyTrendData(
        dates=trend_dates,
        newContracts=trend_contracts,
        happinessActions=trend_happiness,
        ironTriangle=trend_triangle,
        validLeads=trend_leads
    )

    # 4. 实时动态滚动播报 liveFeed
    from app.models.report import ReportDetail, DetailType

    feed_details_res = await db.execute(
        select(ReportDetail)
        .join(DailyReport, ReportDetail.report_id == DailyReport.id)
        .join(User, DailyReport.user_id == User.id)
        .options(selectinload(ReportDetail.report).selectinload(DailyReport.user).selectinload(User.team))
        .where(DailyReport.status == ReportStatus.REVIEWED)
        .order_by(DailyReport.reviewed_at.desc(), ReportDetail.id.desc())
        .limit(10)
    )
    feed_details = feed_details_res.scalars().all()

    live_feed = []
    for d in feed_details:
        u = d.report.user if d.report else None
        t = u.team if u else None
        team_name = t.name if t else "冲刺大本营"
        user_name = u.name if u else "冲刺队员"
        
        time_str = d.report.reviewed_at.strftime("%H:%M") if (d.report and d.report.reviewed_at) else "刚刚"
        content = ""
        feed_type = "info"
        
        # 1. 有效线索确定 (10% -> 25%)
        if d.detail_type == DetailType.LEAD and (d.lead_progress == "25%" or "25" in str(d.lead_progress or "")):
            content = f"攻坚一百天，亮剑破六千！今日确定有效线索，客户为{d.customer_name or 'XX'}，项目金额{d.amount or 0.0}万，赢战百日！"
            feed_type = "achievement"
            
        # 2. 中标确定 (50% -> 75%)
        elif d.detail_type == DetailType.LEAD and (d.lead_progress == "75%" or "75" in str(d.lead_progress or "")):
            content = f"攻坚一百天，亮剑破六千！今日确定{d.description or '中地服务'}项目中地承接，客户为{d.customer_name or 'XX'}，项目金额{d.amount or 0.0}万，赢战百日！"
            feed_type = "milestone"
            
        # 3. 已完成合同签订（双方盖章）(75% -> 90%)
        elif d.detail_type == DetailType.CONTRACT:
            content = f"攻坚一百天，亮剑破六千！今日确定{d.description or '中地服务'}项目走完合同流程，客户为{d.customer_name or 'XX'}，项目金额{d.amount or 0.0}万，赢战百日！"
            feed_type = "contract"
            
        # 4. 铁三角联动
        elif d.detail_type == DetailType.TRIANGLE:
            content = f"攻坚一百天，亮剑破六千！今日售前铁三角现场联动，客户分别为{d.customer_name or 'XX'}，为客户幸福而奋斗，赢战百日！"
            feed_type = "info"
            
        # 5. 客户幸福动作
        elif d.detail_type == DetailType.HAPPINESS:
            score = d.happiness_level or 20
            content = f"攻坚一百天，亮剑破六千！今日{user_name}做到客户幸福标准{score}分{d.description or '关怀与拜访'}动作，收到客户正反馈，为客户幸福而奋斗，赢战百日！"
            feed_type = "milestone"
            
        else:
            content = f"攻坚一百天，亮剑破六千！【{team_name}】{user_name} 完成了 {d.detail_type.value} 项攻坚突破，赢战百日！"
            feed_type = "info"
            
        live_feed.append(
            LiveFeedItem(
                id=d.id,
                content=content,
                time=time_str,
                type=feed_type
            )
        )

    # 5. 个人英雄战将榜 TOP 10 (按新签金额降序)
    hero_query = await db.execute(
        select(
            User.name,
            Team.name.label("team_name"),
            func.coalesce(func.sum(DailyReport.contract_amount), 0).label("score")
        ).select_from(User)
        .join(Team, User.team_id == Team.id)
        .join(DailyReport, User.id == DailyReport.user_id)
        .where(DailyReport.status == ReportStatus.REVIEWED)
        .group_by(User.id, User.name, Team.name)
        .order_by(desc("score"))
        .limit(10)
    )
    hero_rows = hero_query.all()

    hero_board = []
    for idx, row in enumerate(hero_rows):
        hero_board.append(
            RankingItem(
                rank=idx + 1,
                name=row.name,
                teamName=row.team_name,
                score=round(float(row.score), 2),
                trend="up" if idx == 0 else "same"
            )
        )
        
    # 6. 客户幸福之星榜 TOP 10 (按幸福动作次数降序)
    happiness_query = await db.execute(
        select(
            User.name,
            Team.name.label("team_name"),
            func.coalesce(func.sum(DailyReport.happiness_actions), 0).label("score")
        ).select_from(User)
        .join(Team, User.team_id == Team.id)
        .join(DailyReport, User.id == DailyReport.user_id)
        .where(DailyReport.status == ReportStatus.REVIEWED)
        .group_by(User.id, User.name, Team.name)
        .order_by(desc("score"))
        .limit(10)
    )
    happiness_rows = happiness_query.all()

    happiness_board = []
    for idx, row in enumerate(happiness_rows):
        if row.score > 0:
            happiness_board.append(
                RankingItem(
                    rank=idx + 1,
                    name=row.name,
                    teamName=row.team_name,
                    score=float(row.score),
                    trend="up" if idx == 0 else "same"
                )
            )

    # 7. 铁三角协作标杆榜 TOP 10 (按铁三角协作次数降序)
    triangle_query = await db.execute(
        select(
            User.name,
            Team.name.label("team_name"),
            func.coalesce(func.sum(DailyReport.triangle_count), 0).label("score")
        ).select_from(User)
        .join(Team, User.team_id == Team.id)
        .join(DailyReport, User.id == DailyReport.user_id)
        .where(DailyReport.status == ReportStatus.REVIEWED)
        .group_by(User.id, User.name, Team.name)
        .order_by(desc("score"))
        .limit(10)
    )
    triangle_rows = triangle_query.all()

    triangle_board = []
    for idx, row in enumerate(triangle_rows):
        if row.score > 0:
            triangle_board.append(
                RankingItem(
                    rank=idx + 1,
                    name=row.name,
                    teamName=row.team_name,
                    score=float(row.score),
                    trend="up" if idx == 0 else "same"
                )
            )

    # 8. 生成双轨动力 3x3 战队卡片数据
    team_leaders_map = {
        "清远战队": "郑子鹏",
        "广州一战队": "陈浩龙",
        "广州二战队": "刘罗军",
        "广州三战队（数据）": "伍耀强",
        "广州三战队": "伍耀强",
        "佛山战队": "卢俊松",
        "湛江战队": "周真波",
        "云浮战队": "尹晓明",
        "东莞战队": "董卓佼",
        "茂名战队": "陈鸿源"
    }

    t_res = await db.execute(select(Team).order_by(Team.zone_id, Team.id))
    all_teams = t_res.scalars().all()
    
    dual_track_teams = []
    
    for t in all_teams:
        if "战队" not in t.name:
            continue
            
        leader = team_leaders_map.get(t.name, "未知巴长")
        
        # 目标
        g_res = await db.execute(select(TeamGoal).where(TeamGoal.team_id == t.id))
        goals = g_res.scalars().all()
        m_target = next((g.base_target for g in goals if g.category == TeamGoalCategory.MARKETING), 0.0)
        d_target = next((g.base_target for g in goals if g.category == TeamGoalCategory.DELIVERY), 0.0)
        
        # 真实营销实际 (MARKETING)
        m_actual = await get_team_marketing_actual(db, t.id)
        
        # 真实交付实际 (TECHNICAL, DELIVERY)
        d_actual = await get_team_delivery_actual(db, t.id)
        
        m_rate = (m_actual / m_target * 100) if m_target > 0 else 0.0
        d_rate = (d_actual / d_target * 100) if d_target > 0 else 0.0
        
        # 综合状态灯
        avg_rate = (m_rate + d_rate) / 2
        if m_target == 0 and d_target == 0:
            light = "red"
        elif avg_rate >= 80:
            light = "green"
        elif avg_rate >= 40:
            light = "yellow"
        else:
            light = "red"
            
        dual_track_teams.append({
            "teamId": t.id,
            "teamName": t.name,
            "leader": leader,
            "marketingActual": round(m_actual, 2),
            "marketingTarget": round(m_target, 2),
            "marketingRate": round(m_rate, 2),
            "deliveryActual": round(d_actual, 2),
            "deliveryTarget": round(d_target, 2),
            "deliveryRate": round(d_rate, 2),
            "statusLight": light
        })
    
    # 截取前9名保证3x3网格
    dual_track_teams = dual_track_teams[:9]

    return DashboardResponse(
        kpiSummary=kpi_summary,
        zoneRanking=zone_ranking,
        weeklyTrend=weekly_trend,
        liveFeed=live_feed,
        heroBoard=hero_board,
        happinessBoard=happiness_board,
        triangleBoard=triangle_board,
        zoneTeamsPK=zone_teams_pk,
        dualTrackTeams=dual_track_teams,
        countdown=71,
        campaignName="中地顾问「百日奋战」经营冲刺大屏",
        slogan="攻坚一百天，亮剑破六千！"
    )


@router.get("/weekly-trend", response_model=list[WeeklyTrend], summary="获取周度趋势")
async def get_weekly_trend(
    team_id: int | None = Query(None, description="战队ID"),
    db: AsyncSession = Depends(get_db),
):
    """获取周度目标与实际完成值的趋势数据列表"""
    # 1. 聚合各周的起止日期与真实导入的保底目标
    q_target = select(
        WeeklyTarget.week_number,
        func.min(WeeklyTarget.week_start).label("week_start"),
        func.max(WeeklyTarget.week_end).label("week_end"),
        func.sum(WeeklyTarget.marketing_base_target).label("m_target"),
        func.sum(WeeklyTarget.delivery_base_target).label("d_target"),
    ).group_by(WeeklyTarget.week_number).order_by(WeeklyTarget.week_number)
    
    if team_id:
        q_target = q_target.where(WeeklyTarget.team_id == team_id)
        
    target_res = await db.execute(q_target)
    target_rows = target_res.all()
    
    trends = []
    for row in target_rows:
        week_num = row.week_number
        s_date = row.week_start
        e_date = row.week_end
        
        # 计算营销实际
        m_actual = await get_team_weekly_marketing_actual(db, s_date, e_date, team_id)
        
        # 计算交付实际
        d_actual = await get_team_weekly_delivery_actual(db, s_date, e_date, team_id)
        
        trends.append(
            WeeklyTrend(
                week_number=week_num,
                week_start=s_date,
                marketing_target=round(float(row.m_target or 0), 2),
                marketing_actual=round(m_actual, 2),
                delivery_target=round(float(row.d_target or 0), 2),
                delivery_actual=round(d_actual, 2),
            )
        )

    return trends


from app.api.deps import get_current_user
from app.models.goal import PersonalGoal, GoalType

@router.get("/my-stats", summary="获取当前登录用户的多级作战数据(公司、战队、个人)")
async def get_my_cascade_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    自上而下获取：
    1. 全公司四大KPI累计进度
    2. 所属战队营销/交付双轨及过程指标进度
    3. 个人核心KPI目标达成进度（根据岗位动态呈现）
    """
    # ====== 1. 公司盘数据 ======
    company_summary = await db.execute(
        select(
            func.coalesce(func.sum(DailyReport.contract_amount), 0).label("total_amount"),
            func.coalesce(func.sum(DailyReport.happiness_actions), 0).label("total_happiness"),
            func.coalesce(func.sum(DailyReport.triangle_count), 0).label("total_triangle"),
            func.coalesce(func.sum(DailyReport.leads_count), 0).label("total_leads"),
        ).where(DailyReport.status == ReportStatus.REVIEWED)
    )
    c_row = company_summary.one()

    # 获取全公司总签约目标额（仅包含营销新签目标以修正分轨，并保留两位小数）
    total_base_target_res = await db.execute(
        select(func.coalesce(func.sum(TeamGoal.base_target), 0))
        .where(TeamGoal.category == TeamGoalCategory.MARKETING)
    )
    total_contract_target = round(float(total_base_target_res.scalar() or 6200.0), 2)

    val_contracts = float(c_row.total_amount)
    pct_contracts = round((val_contracts / total_contract_target) * 100, 2) if total_contract_target > 0 else 0.0

    val_happiness = int(c_row.total_happiness)
    pct_happiness = round((val_happiness / 3300) * 100, 2)

    val_triangle = int(c_row.total_triangle)
    pct_triangle = round((val_triangle / 500) * 100, 2)

    val_leads = int(c_row.total_leads)
    pct_leads = round((val_leads / 600) * 100, 2)

    company_stats = {
        "newContracts": {"value": round(val_contracts, 2), "target": total_contract_target, "percentage": pct_contracts},
        "happinessActions": {"value": val_happiness, "target": 3300, "percentage": pct_happiness},
        "ironTriangle": {"value": val_triangle, "target": 500, "percentage": pct_triangle},
        "validLeads": {"value": val_leads, "target": 600, "percentage": pct_leads}
    }

    # ====== 2. 战队盘数据 ======
    team_stats = None
    if current_user.team_id:
        team_res = await db.execute(select(Team).where(Team.id == current_user.team_id))
        team = team_res.scalar_one_or_none()
        
        if team:
            # 战队营销/交付新签目标
            goals_res = await db.execute(select(TeamGoal).where(TeamGoal.team_id == team.id))
            goals = goals_res.scalars().all()
            m_target = next((g.base_target for g in goals if g.category == TeamGoalCategory.MARKETING), 600.0)
            d_target = next((g.base_target for g in goals if g.category == TeamGoalCategory.DELIVERY), 400.0)

            # 查询战队营销实际
            m_actual = await get_team_marketing_actual(db, team.id)

            # 查询战队交付实际
            d_actual = await get_team_delivery_actual(db, team.id)

            # 战队过程指标
            t_kpis_res = await db.execute(
                select(
                    func.coalesce(func.sum(DailyReport.happiness_actions), 0).label("t_happiness"),
                    func.coalesce(func.sum(DailyReport.triangle_count), 0).label("t_triangle"),
                    func.coalesce(func.sum(DailyReport.leads_count), 0).label("t_leads"),
                )
                .select_from(User)
                .join(DailyReport, User.id == DailyReport.user_id)
                .where(
                    User.team_id == team.id,
                    DailyReport.status == ReportStatus.REVIEWED
                )
            )
            t_kpi_row = t_kpis_res.one()

            m_rate = round((m_actual / m_target * 100), 2) if m_target > 0 else 0.0
            d_rate = round((d_actual / d_target * 100), 2) if d_target > 0 else 0.0

            # 综合状态灯
            avg_rate = (m_rate + d_rate) / 2
            if avg_rate >= 80:
                light = "green"
            elif avg_rate >= 40:
                light = "yellow"
            else:
                light = "red"

            team_stats = {
                "team_id": team.id,
                "team_name": team.name,
                "status_light": light,
                "marketing_actual": round(m_actual, 2),
                "marketing_target": round(m_target, 2),
                "marketing_percentage": m_rate,
                "delivery_actual": round(d_actual, 2),
                "delivery_target": round(d_target, 2),
                "delivery_percentage": d_rate,
                "happiness_actions": int(t_kpi_row.t_happiness),
                "iron_triangle": int(t_kpi_row.t_triangle),
                "valid_leads": int(t_kpi_row.t_leads)
            }

    # ====== 3. 个人盘数据 ======
    personal_stats = []
    personal_goals_res = await db.execute(
        select(PersonalGoal).where(PersonalGoal.user_id == current_user.id)
    )
    goals = personal_goals_res.scalars().all()

    from app.models.report import ReportDetail, DetailType
    
    goal_name_map = {
        GoalType.CONTRACT_AMOUNT: ("新签合同额", "万元"),
        GoalType.LEADS_CONVERSION_RATE: ("线索转化率", "%"),
        GoalType.HAPPINESS_ACTION: ("客户幸福动作完成数", "次"),
        GoalType.NEW_CUSTOMER_COUNT: ("新客户目标数", "个"),
        GoalType.HAPPINESS_STORY_COUNT: ("客户幸福故事数", "个"),
        GoalType.TRIANGLE_COUNT: ("售前铁三角联动次数", "次"),
        GoalType.LEADS_COUNT: ("有效线索数", "条")
    }

    for g in goals:
        actual_val = 0.0
        g_type = g.goal_type

        # 获取个人实际值
        if g_type == GoalType.CONTRACT_AMOUNT:
            # 实际新签金额：当前用户是填报人，或者当前用户是协同人，且明细为合同类型，日报已审核
            act_query = (
                select(func.coalesce(func.sum(ReportDetail.amount), 0))
                .select_from(ReportDetail)
                .join(DailyReport, ReportDetail.report_id == DailyReport.id)
                .where(
                    DailyReport.status == ReportStatus.REVIEWED,
                    ReportDetail.detail_type == DetailType.CONTRACT,
                    (
                        (DailyReport.user_id == current_user.id) |
                        (ReportDetail.partner_user_id == current_user.id)
                    )
                )
            )
            actual_val = float(await db.scalar(act_query) or 0.0)
        elif g_type == GoalType.HAPPINESS_ACTION:
            # 实际幸福动作
            act_res = await db.execute(
                select(func.coalesce(func.sum(DailyReport.happiness_actions), 0))
                .where(DailyReport.user_id == current_user.id, DailyReport.status == ReportStatus.REVIEWED)
            )
            actual_val = float(act_res.scalar() or 0.0)
        elif g_type == GoalType.TRIANGLE_COUNT:
            # 实际铁三角联动
            act_res = await db.execute(
                select(func.coalesce(func.sum(DailyReport.triangle_count), 0))
                .where(DailyReport.user_id == current_user.id, DailyReport.status == ReportStatus.REVIEWED)
            )
            actual_val = float(act_res.scalar() or 0.0)
        elif g_type == GoalType.LEADS_COUNT:
            # 实际有效线索
            act_res = await db.execute(
                select(func.coalesce(func.sum(DailyReport.leads_count), 0))
                .where(DailyReport.user_id == current_user.id, DailyReport.status == ReportStatus.REVIEWED)
            )
            actual_val = float(act_res.scalar() or 0.0)
        elif g_type == GoalType.NEW_CUSTOMER_COUNT:
            # 实际新客户数 (根据明细去重客户名匹配)
            customer_res = await db.execute(
                select(func.count(func.distinct(ReportDetail.customer_name)))
                .select_from(ReportDetail)
                .join(DailyReport, ReportDetail.report_id == DailyReport.id)
                .where(
                    DailyReport.user_id == current_user.id, 
                    DailyReport.status == ReportStatus.REVIEWED,
                    ReportDetail.detail_type == DetailType.CONTRACT
                )
            )
            actual_val = float(customer_res.scalar() or 0.0)
        elif g_type == GoalType.HAPPINESS_STORY_COUNT:
            # 实际幸福故事数 (根据有具体说明的幸福填报动作匹配)
            story_res = await db.execute(
                select(func.count(ReportDetail.id))
                .select_from(ReportDetail)
                .join(DailyReport, ReportDetail.report_id == DailyReport.id)
                .where(
                    DailyReport.user_id == current_user.id,
                    DailyReport.status == ReportStatus.REVIEWED,
                    ReportDetail.detail_type == DetailType.HAPPINESS,
                    ReportDetail.description != None,
                    ReportDetail.description != ''
                )
            )
            actual_val = float(story_res.scalar() or 0.0)
        elif g_type == GoalType.LEADS_CONVERSION_RATE:
            # 实际线索转化率 (合同单数/线索数 * 100)
            cc_res = await db.execute(
                select(
                    func.coalesce(func.sum(DailyReport.contract_count), 0).label("c_count"),
                    func.coalesce(func.sum(DailyReport.leads_count), 0).label("l_count")
                ).where(DailyReport.user_id == current_user.id, DailyReport.status == ReportStatus.REVIEWED)
            )
            cc_row = cc_res.one()
            c_count = int(cc_row.c_count)
            l_count = int(cc_row.l_count)
            actual_val = round((c_count / l_count * 100), 2) if l_count > 0 else 0.0

        base_pct = round((actual_val / g.base_target * 100), 2) if g.base_target > 0 else 0.0
        challenge_pct = round((actual_val / g.challenge_target * 100), 2) if g.challenge_target > 0 else 0.0

        g_name, g_unit = goal_name_map.get(g_type, (g_type.value, ""))

        personal_stats.append({
            "goal_type": g_type.value,
            "goal_name": g_name,
            "base_target": g.base_target,
            "challenge_target": g.challenge_target,
            "actual": actual_val,
            "base_percentage": base_pct,
            "challenge_percentage": challenge_pct,
            "unit": g_unit
        })

    return {
        "company_stats": company_stats,
        "team_stats": team_stats,
        "personal_stats": personal_stats
    }


@router.get("/team/{team_id}/metrics", summary="获取战队多维度精细化指标")
async def get_team_detailed_metrics(
    team_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    点击 3x3 战队卡片时，弹出对话框展示该战队的精细化多维度指标。
    包含新签合同（营销/交付）、有效需求线索量、潜力需求线索量、线索转化率、新客户数、续签合同额、铁三角联动及幸福动作。
    """
    # 1. 验证战队是否存在
    team_res = await db.execute(select(Team).where(Team.id == team_id))
    team = team_res.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="战队不存在")

    # 2. 查询该战队成员的 crm_user_id 列表，用作 CRM 归属统计
    users_res = await db.execute(select(User).where(User.team_id == team_id))
    members = users_res.scalars().all()
    crm_user_ids = [u.crm_user_id for u in members if u.crm_user_id]
    member_ids = [u.id for u in members]

    # A. 新签合同额 (分算实际与目标)
    goals_res = await db.execute(select(TeamGoal).where(TeamGoal.team_id == team_id))
    goals = goals_res.scalars().all()
    marketing_target = next((g.base_target for g in goals if g.category == TeamGoalCategory.MARKETING), 0.0)
    delivery_target = next((g.base_target for g in goals if g.category == TeamGoalCategory.DELIVERY), 0.0)
    
    marketing_actual = await get_team_marketing_actual(db, team_id)
    delivery_actual = await get_team_delivery_actual(db, team_id)

    # B. 有效需求线索量 & 潜力需求线索量
    valid_leads_actual = None
    potential_leads_actual = None
    leads_conversion_rate = None
    crm_connected = False

    # 查询本地有效线索目标值
    leads_target_res = await db.execute(
        select(func.coalesce(func.sum(PersonalGoal.base_target), 0))
        .where(PersonalGoal.user_id.in_(member_ids), PersonalGoal.goal_type == GoalType.LEADS_COUNT)
    )
    leads_target = float(leads_target_res.scalar() or 20.0)

    # 尝试直连 CRM 获取线索数量和转化率
    if crm_user_ids:
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
            
            # 有效需求线索量 (25%-75%阶段)
            user_ids_str = ", ".join([f"'{uid}'" for uid in crm_user_ids])
            
            cur.execute(f"""
                SELECT COUNT(*) as count 
                FROM zdcrm_business_opportunity 
                WHERE progress BETWEEN 25 AND 75 
                  AND (is_suspension = '0' OR is_suspension IS NULL)
                  AND market_user_id IN ({user_ids_str})
            """)
            valid_leads_actual = cur.fetchone()["count"]

            # 潜力需求线索量 (5%-10%阶段)
            cur.execute(f"""
                SELECT COUNT(*) as count 
                FROM zdcrm_business_opportunity 
                WHERE progress BETWEEN 5 AND 10 
                  AND (is_suspension = '0' OR is_suspension IS NULL)
                  AND market_user_id IN ({user_ids_str})
            """)
            potential_leads_actual = cur.fetchone()["count"]

            # 计算线索转化率 (上月选定有效线索 -> 新签转化率)
            cur.execute(f"""
                SELECT COUNT(*) as count 
                FROM zdcrm_business_opportunity 
                WHERE progress = 90 
                  AND market_user_id IN ({user_ids_str})
            """)
            signed_count = cur.fetchone()["count"]
            
            total_pool = valid_leads_actual + signed_count
            if total_pool > 0:
                leads_conversion_rate = round((signed_count / total_pool) * 100, 2)
            else:
                leads_conversion_rate = 0.0
            
            cur.close()
            conn.close()
            crm_connected = True
        except Exception as e:
            logger.warning(f"直连 CRM 失败: {e}")
            valid_leads_actual = None
            potential_leads_actual = None
            leads_conversion_rate = None

    # D. 新客户数：去重 customer_name 统计
    new_customers_res = await db.execute(
        select(func.count(func.distinct(ReportDetail.customer_name)))
        .select_from(ReportDetail)
        .join(DailyReport, ReportDetail.report_id == DailyReport.id)
        .where(
            DailyReport.status == ReportStatus.REVIEWED,
            ReportDetail.detail_type == DetailType.CONTRACT,
            (DailyReport.user_id.in_(member_ids) | ReportDetail.partner_user_id.in_(member_ids))
        )
    )
    new_customers_actual = int(new_customers_res.scalar() or 0)

    # E. 续签合同额：包含“续签/续约/二期/运维”等关键字的合同金额
    renew_amount_res = await db.execute(
        select(func.coalesce(func.sum(ReportDetail.amount), 0))
        .select_from(ReportDetail)
        .join(DailyReport, ReportDetail.report_id == DailyReport.id)
        .where(
            DailyReport.status == ReportStatus.REVIEWED,
            ReportDetail.detail_type == DetailType.CONTRACT,
            (DailyReport.user_id.in_(member_ids) | ReportDetail.partner_user_id.in_(member_ids)),
            (ReportDetail.description.contains("续签") | 
             ReportDetail.description.contains("续约") | 
             ReportDetail.description.contains("二期") | 
             ReportDetail.description.contains("运维"))
        )
    )
    renew_amount_actual = float(renew_amount_res.scalar() or 0.0)

    # F. 售前铁三角联动
    triangle_res = await db.execute(
        select(func.coalesce(func.sum(DailyReport.triangle_count), 0))
        .where(DailyReport.user_id.in_(member_ids), DailyReport.status == ReportStatus.REVIEWED)
    )
    triangle_actual = int(triangle_res.scalar() or 0)

    # G. 客户幸福动作
    happiness_res = await db.execute(
        select(func.coalesce(func.sum(DailyReport.happiness_actions), 0))
        .where(DailyReport.user_id.in_(member_ids), DailyReport.status == ReportStatus.REVIEWED)
    )
    happiness_actual = int(happiness_res.scalar() or 0)

    return {
        "team_id": team_id,
        "team_name": team.name,
        "marketing_actual": round(marketing_actual, 2),
        "marketing_target": round(marketing_target, 2),
        "delivery_actual": round(delivery_actual, 2),
        "delivery_target": round(delivery_target, 2),
        "valid_leads_actual": valid_leads_actual,
        "valid_leads_target": round(leads_target, 1),
        "potential_leads_actual": potential_leads_actual,
        "leads_conversion_rate": leads_conversion_rate,
        "new_customers_actual": new_customers_actual,
        "renew_amount_actual": renew_amount_actual,
        "triangle_actual": triangle_actual,
        "happiness_actual": happiness_actual,
        "crm_connected": crm_connected
    }
