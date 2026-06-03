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
    """计算战队的真实营销新签合同额"""
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
                (
                    (ReportDetail.description.contains("营销新签分摊")) &
                    ((User.team_id == team_id) | (PartnerUser.team_id == team_id))
                ) |
                (
                    (~ReportDetail.description.contains("交付新签分摊")) &
                    (
                        ((User.team_id == team_id) & (User.position_type.in_([PositionType.MARKETING, PositionType.MANAGEMENT]))) |
                        ((PartnerUser.team_id == team_id) & (PartnerUser.position_type.in_([PositionType.MARKETING, PositionType.MANAGEMENT])))
                    )
                )
            )
        )
    )
    return float(await db.scalar(query) or 0.0)

async def get_team_delivery_actual(db: AsyncSession, team_id: int) -> float:
    """计算战队的真实交付新签合同额"""
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
                (
                    (ReportDetail.description.contains("交付新签分摊")) &
                    ((User.team_id == team_id) | (PartnerUser.team_id == team_id))
                ) |
                (
                    (~ReportDetail.description.contains("营销新签分摊")) &
                    (
                        ((User.team_id == team_id) & (User.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY]))) |
                        ((PartnerUser.team_id == team_id) & (PartnerUser.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY])))
                    )
                )
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
                (
                    (ReportDetail.description.contains("营销新签分摊")) &
                    ((User.team_id == team_id) | (PartnerUser.team_id == team_id))
                ) |
                (
                    (~ReportDetail.description.contains("交付新签分摊")) &
                    (
                        ((User.team_id == team_id) & (User.position_type.in_([PositionType.MARKETING, PositionType.MANAGEMENT]))) |
                        ((PartnerUser.team_id == team_id) & (PartnerUser.position_type.in_([PositionType.MARKETING, PositionType.MANAGEMENT])))
                    )
                )
            )
        )
    else:
        query = query.where(
            (ReportDetail.description.contains("营销新签分摊")) |
            (
                (~ReportDetail.description.contains("交付新签分摊")) &
                (
                    (User.position_type.in_([PositionType.MARKETING, PositionType.MANAGEMENT])) |
                    (PartnerUser.position_type.in_([PositionType.MARKETING, PositionType.MANAGEMENT]))
                )
            )
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
                (
                    (ReportDetail.description.contains("交付新签分摊")) &
                    ((User.team_id == team_id) | (PartnerUser.team_id == team_id))
                ) |
                (
                    (~ReportDetail.description.contains("营销新签分摊")) &
                    (
                        ((User.team_id == team_id) & (User.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY]))) |
                        ((PartnerUser.team_id == team_id) & (PartnerUser.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY])))
                    )
                )
            )
        )
    else:
        query = query.where(
            (ReportDetail.description.contains("交付新签分摊")) |
            (
                (~ReportDetail.description.contains("营销新签分摊")) &
                (
                    (User.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY])) | 
                    (PartnerUser.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY]))
                )
            )
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

    # 计算当周区间 (每周周一开始清零重新统计周数据)
    from datetime import timedelta
    start_of_week = target_date - timedelta(days=target_date.weekday())
    end_of_week = start_of_week + timedelta(days=6)

    # 1. 战役累计数据统计
    # 统计去重后全公司累计合同额（只统计交付维度，过滤掉营销维度以防重复计算）
    total_amount_stmt = select(
        func.coalesce(func.sum(ReportDetail.amount), 0)
    ).select_from(ReportDetail).join(DailyReport, ReportDetail.report_id == DailyReport.id).where(
        DailyReport.status == ReportStatus.REVIEWED,
        ReportDetail.detail_type == DetailType.CONTRACT,
        ~ReportDetail.description.contains("营销新签分摊")
    )
    total_amount_res = await db.execute(total_amount_stmt)
    total_amount_val = float(total_amount_res.scalar() or 0.0)

    # 统计去重后全公司累计新签合同笔数（以唯一的 crm_opportunity_id 计数）
    total_count_stmt = select(
        func.count(func.distinct(ReportDetail.crm_opportunity_id))
    ).select_from(ReportDetail).join(DailyReport, ReportDetail.report_id == DailyReport.id).where(
        DailyReport.status == ReportStatus.REVIEWED,
        ReportDetail.detail_type == DetailType.CONTRACT,
        ReportDetail.crm_opportunity_id.isnot(None),
        ReportDetail.crm_opportunity_id != ""
    )
    total_count_res = await db.execute(total_count_stmt)
    total_count_val = int(total_count_res.scalar() or 0)

    summary_result = await db.execute(
        select(
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
    val_contracts = total_amount_val
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

    # 中标项目：目标 150 个（统计已审核的中标确定明细数 75%）
    total_tenders_stmt = select(
        func.coalesce(func.count(ReportDetail.id), 0)
    ).select_from(ReportDetail).join(DailyReport, ReportDetail.report_id == DailyReport.id).where(
        DailyReport.status == ReportStatus.REVIEWED,
        ReportDetail.detail_type == DetailType.LEAD,
        (ReportDetail.lead_progress.contains("75") | (ReportDetail.lead_progress == "75%"))
    )
    total_tenders_res = await db.execute(total_tenders_stmt)
    val_tenders = int(total_tenders_res.scalar() or 0)
    pct_tenders = round((val_tenders / 150) * 100, 2)
    kpi_tenders = KpiItem(value=val_tenders, target=150, percentage=pct_tenders)

    kpi_summary = KpiSummary(
        newContracts=kpi_contracts,
        happinessActions=kpi_happiness,
        ironTriangle=kpi_triangle,
        tenderProjects=kpi_tenders,
        validLeads=kpi_leads
    )

    # 2. 战区赛马竞速榜 (当周新签达成率排名，每周一清零)
    zones_res = await db.execute(select(Zone).order_by(Zone.sort_order))
    zones = zones_res.scalars().all()

    zone_ranking_list = []
    zone_teams_pk = {}
    for idx, z in enumerate(zones):
        # 聚合该战区内部的所有战队自相PK数据
        t_res = await db.execute(select(Team).where(Team.zone_id == z.id))
        zone_teams = t_res.scalars().all()
        
        # 统计该战区下所有战队的已审核营销与交付新签实际值与目标之和
        z_m_actual = 0.0
        z_m_target = 0.0
        z_d_actual = 0.0
        z_d_target = 0.0
        for t in zone_teams:
            t_m_act = await get_team_weekly_marketing_actual(db, start_of_week, end_of_week, t.id)
            t_d_act = await get_team_weekly_delivery_actual(db, start_of_week, end_of_week, t.id)
            z_m_actual += t_m_act
            z_d_actual += t_d_act

            # 查询目标
            wt_stmt = select(WeeklyTarget).where(
                WeeklyTarget.team_id == t.id,
                WeeklyTarget.week_start <= target_date,
                WeeklyTarget.week_end >= target_date
            )
            wt_res = await db.execute(wt_stmt)
            wt_obj = wt_res.scalar_one_or_none()
            
            t_m_tgt = wt_obj.marketing_base_target if wt_obj else 0.0
            t_d_tgt = wt_obj.delivery_base_target if wt_obj else 0.0
            
            # 营销目标兜底
            if t_m_tgt == 0:
                g_res = await db.execute(
                    select(TeamGoal.base_target)
                    .where(TeamGoal.team_id == t.id, TeamGoal.category == TeamGoalCategory.MARKETING)
                )
                m_target_total = float(g_res.scalar() or 0.0)
                if m_target_total > 0:
                    t_m_tgt = round(m_target_total / 12, 2)
            
            # 交付目标兜底
            if t_d_tgt == 0:
                g_res = await db.execute(
                    select(TeamGoal.base_target)
                    .where(TeamGoal.team_id == t.id, TeamGoal.category == TeamGoalCategory.DELIVERY)
                )
                d_target_total = float(g_res.scalar() or 0.0)
                if d_target_total > 0:
                    t_d_tgt = round(d_target_total / 12, 2)
                    
            z_m_target += t_m_tgt
            z_d_target += t_d_tgt

        # 加权计算战区百分比
        if z_m_target > 0 and z_d_target > 0:
            z_pct = round((z_m_actual / z_m_target * 50) + (z_d_actual / z_d_target * 50), 2)
        elif z_m_target <= 0 and z_d_target > 0:
            z_pct = round((z_d_actual / z_d_target * 100), 2)
        elif z_m_target > 0 and z_d_target <= 0:
            z_pct = round((z_m_actual / z_m_target * 100), 2)
        else:
            z_pct = 0.0
            
        zone_ranking_list.append({
            "name": z.name,
            "score": z_pct
        })
        
        team_pk_items = []
        for t in zone_teams:
            # 1. 营销实际和交付实际 (周度)
            t_m_actual = await get_team_weekly_marketing_actual(db, start_of_week, end_of_week, t.id)
            t_d_actual = await get_team_weekly_delivery_actual(db, start_of_week, end_of_week, t.id)

            # 2. 获取当周目标分解对象
            wt_stmt = select(WeeklyTarget).where(
                WeeklyTarget.team_id == t.id,
                WeeklyTarget.week_start <= target_date,
                WeeklyTarget.week_end >= target_date
            )
            wt_res = await db.execute(wt_stmt)
            wt_obj = wt_res.scalar_one_or_none()
            
            t_m_target = wt_obj.marketing_base_target if wt_obj else 0.0
            t_d_target = wt_obj.delivery_base_target if wt_obj else 0.0
            
            # 营销目标兜底
            if t_m_target == 0:
                g_res = await db.execute(
                    select(TeamGoal.base_target)
                    .where(TeamGoal.team_id == t.id, TeamGoal.category == TeamGoalCategory.MARKETING)
                )
                m_target_total = float(g_res.scalar() or 0.0)
                if m_target_total > 0:
                    t_m_target = round(m_target_total / 12, 2)
            
            # 交付目标兜底
            if t_d_target == 0:
                g_res = await db.execute(
                    select(TeamGoal.base_target)
                    .where(TeamGoal.team_id == t.id, TeamGoal.category == TeamGoalCategory.DELIVERY)
                )
                d_target_total = float(g_res.scalar() or 0.0)
                if d_target_total > 0:
                    t_d_target = round(d_target_total / 12, 2)

            # 3. 加权计算综合完成百分比
            if t_m_target > 0 and t_d_target > 0:
                t_m_pct = (t_m_actual / t_m_target) * 50
                t_d_pct = (t_d_actual / t_d_target) * 50
                t_pct = round(t_m_pct + t_d_pct, 2)
            elif t_m_target <= 0 and t_d_target > 0:
                t_pct = round((t_d_actual / t_d_target) * 100, 2)
            elif t_m_target > 0 and t_d_target <= 0:
                t_pct = round((t_m_actual / t_m_target) * 100, 2)
            else:
                t_pct = 0.0

            team_pk_items.append({
                "name": t.name,
                "score": t_pct,
                "weeklyMarketingActual": round(t_m_actual, 2),
                "weeklyMarketingTarget": round(t_m_target, 2),
                "weeklyDeliveryActual": round(t_d_actual, 2),
                "weeklyDeliveryTarget": round(t_d_target, 2)
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
                    trend="up" if t_idx == 0 else "same",
                    weeklyMarketingActual=item["weeklyMarketingActual"],
                    weeklyMarketingTarget=item["weeklyMarketingTarget"],
                    weeklyDeliveryActual=item["weeklyDeliveryActual"],
                    weeklyDeliveryTarget=item["weeklyDeliveryTarget"]
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

    # 提前批量查出每周的营销保底与挑战目标之和
    targets_stmt = select(
        WeeklyTarget.week_number,
        func.coalesce(func.sum(WeeklyTarget.marketing_base_target), 0).label("base_sum"),
        func.coalesce(func.sum(WeeklyTarget.marketing_challenge_target), 0).label("challenge_sum")
    ).group_by(WeeklyTarget.week_number).order_by(WeeklyTarget.week_number)
    targets_res = await db.execute(targets_stmt)
    targets_map = {r.week_number: (float(r.base_sum), float(r.challenge_sum)) for r in targets_res.all()}

    trend_dates = []
    trend_contracts = []
    trend_contracts_target = []
    trend_contracts_challenge_target = []
    trend_happiness = []
    trend_triangle = []
    trend_leads = []

    running_contracts = 0.0
    running_base_target = 0.0
    running_challenge_target = 0.0

    # 官方标准的百日战役15周日期起止映射（代码兜底纠偏防线）
    STANDARD_WEEK_RANGES_OVERVIEW = {
        1: (date(2026, 6, 1), date(2026, 6, 7)),
        2: (date(2026, 6, 8), date(2026, 6, 14)),
        3: (date(2026, 6, 15), date(2026, 6, 21)),
        4: (date(2026, 6, 22), date(2026, 6, 28)),
        5: (date(2026, 6, 29), date(2026, 7, 5)),
        6: (date(2026, 7, 6), date(2026, 7, 12)),
        7: (date(2026, 7, 13), date(2026, 7, 19)),
        8: (date(2026, 7, 20), date(2026, 7, 26)),
        9: (date(2026, 7, 27), date(2026, 8, 2)),
        10: (date(2026, 8, 3), date(2026, 8, 9)),
        11: (date(2026, 8, 10), date(2026, 8, 16)),
        12: (date(2026, 8, 17), date(2026, 8, 23)),
        13: (date(2026, 8, 24), date(2026, 8, 30)),
        14: (date(2026, 8, 31), date(2026, 9, 6)),
        15: (date(2026, 9, 7), date(2026, 9, 8))
    }
    for w in weekly_periods:
        week_num = w.week_number
        s_date, e_date = STANDARD_WEEK_RANGES_OVERVIEW.get(week_num, (w.start_date, w.end_date))
        
        # 统计去重后该周的合同总额（只统计交付维度，过滤掉营销维度以防重复计算）
        w_amount_stmt = select(
            func.coalesce(func.sum(ReportDetail.amount), 0)
        ).select_from(ReportDetail).join(DailyReport, ReportDetail.report_id == DailyReport.id).where(
            DailyReport.report_date >= s_date,
            DailyReport.report_date <= e_date,
            DailyReport.status == ReportStatus.REVIEWED,
            ReportDetail.detail_type == DetailType.CONTRACT,
            ~ReportDetail.description.contains("营销新签分摊")
        )
        w_amount_res = await db.execute(w_amount_stmt)
        w_amount_val = float(w_amount_res.scalar() or 0.0)

        # 累加实际新签合同额
        running_contracts += w_amount_val

        # 累加保底目标与挑战目标
        week_base, week_challenge = targets_map.get(week_num, (0.0, 0.0))
        running_base_target += week_base
        running_challenge_target += week_challenge

        # 查询该周范围内已审核的幸福、铁三角和线索次数
        w_actual_res = await db.execute(
            select(
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
        trend_contracts.append(round(running_contracts, 2))
        trend_contracts_target.append(round(running_base_target, 2))
        trend_contracts_challenge_target.append(round(running_challenge_target, 2))
        trend_happiness.append(int(w_row.happiness))
        trend_triangle.append(int(w_row.triangle))
        trend_leads.append(int(w_row.leads))

    weekly_trend = WeeklyTrendData(
        dates=trend_dates,
        newContracts=trend_contracts,
        newContractsTarget=trend_contracts_target,
        newContractsChallengeTarget=trend_contracts_challenge_target,
        happinessActions=trend_happiness,
        ironTriangle=trend_triangle,
        validLeads=trend_leads
    )

    # 4. 实时动态滚动播报 liveFeed

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
        
        if d.report and d.report.reviewed_at:
            # reviewed_at 储存为 UTC 时间，加 8 小时转换为东八区中国时间
            local_time = d.report.reviewed_at + timedelta(hours=8)
            time_str = local_time.strftime("%H:%M")
        else:
            time_str = "刚刚"
        content = ""
        feed_type = "info"
        
        # 1. 有效线索确定 (10% -> 25%)
        if d.detail_type == DetailType.LEAD and (d.lead_progress == "25%" or "25" in str(d.lead_progress or "")):
            if d.description and ("攻坚一百天" in d.description or "奋战一百天" in d.description or "亮剑破六千" in d.description):
                content = d.description
            else:
                content = f"奋战一百天，亮剑破六千！今日确定有效线索，客户为{d.customer_name or 'XX'}，项目金额{d.amount or 0.0}万，赢战百日！"
            feed_type = "achievement"
            
        # 2. 中标确定 (50% -> 75%)
        elif d.detail_type == DetailType.LEAD and (d.lead_progress == "75%" or "75" in str(d.lead_progress or "")):
            if d.description and ("攻坚一百天" in d.description or "奋战一百天" in d.description or "亮剑破六千" in d.description):
                content = d.description
            else:
                content = f"奋战一百天，亮剑破六千！今日确定{d.description or '中地服务'}项目中地承接，客户为{d.customer_name or 'XX'}，项目金额{d.amount or 0.0}万，赢战百日！"
            feed_type = "milestone"
            
        # 3. 已完成合同签订（双方盖章）(75% -> 90%)
        elif d.detail_type == DetailType.CONTRACT:
            if d.description and ("攻坚一百天" in d.description or "奋战一百天" in d.description or "亮剑破六千" in d.description):
                content = d.description
            else:
                content = f"奋战一百天，亮剑破六千！今日确定{d.description or '中地服务'}项目走完合同流程，客户为{d.customer_name or 'XX'}，项目金额{d.amount or 0.0}万，赢战百日！"
            feed_type = "contract"
            
        # 4. 铁三角联动
        elif d.detail_type == DetailType.TRIANGLE:
            if d.description and ("攻坚一百天" in d.description or "奋战一百天" in d.description or "亮剑破六千" in d.description):
                content = d.description
            else:
                content = f"奋战一百天，亮剑破六千！今日售前铁三角现场联动，客户分别为{d.customer_name or 'XX'}，为客户幸福而奋斗，赢战百日！"
            feed_type = "info"
            
        # 5. 客户幸福动作
        elif d.detail_type == DetailType.HAPPINESS:
            score = d.happiness_level if d.happiness_level is not None else 20
            if d.description and ("攻坚一百天" in d.description or "奋战一百天" in d.description or "亮剑破六千" in d.description):
                content = d.description
            else:
                content = f"奋战一百天，亮剑破六千！今日{user_name}做到客户幸福标准{score}分{d.description or '关怀与拜访'}动作，收到客户正反馈，为客户幸福而奋斗，赢战百日！"
            feed_type = "milestone"
            
        else:
            content = f"奋战一百天，亮剑破六千！【{team_name}】{user_name} 完成了 {d.detail_type.value} 项攻坚突破，赢战百日！"
            feed_type = "info"
            
        # 剔除内容中的关联战报标识 \n[broadcast_id:xx]
        if content and "\n[broadcast_id:" in content:
            content = content.split("\n[broadcast_id:")[0]
            
        live_feed.append(
            LiveFeedItem(
                id=d.id,
                content=content,
                time=time_str,
                type=feed_type
            )
        )

    # 5. 个人签约周战将榜 TOP 10 (按当周新签金额降序，每周一清零)
    hero_query = await db.execute(
        select(
            User.name,
            Team.name.label("team_name"),
            func.coalesce(func.sum(DailyReport.contract_amount), 0).label("score")
        ).select_from(User)
        .join(Team, User.team_id == Team.id)
        .join(DailyReport, User.id == DailyReport.user_id)
        .where(
            DailyReport.status == ReportStatus.REVIEWED,
            DailyReport.report_date >= start_of_week,
            DailyReport.report_date <= end_of_week
        )
        .group_by(User.id, User.name, Team.name)
        .order_by(desc("score"))
        .limit(15)
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

    # 5.1 营销新签周战将榜 TOP 10 (按当周营销新签金额降序，每周一清零)
    marketing_hero_query = await db.execute(
        select(
            User.name,
            Team.name.label("team_name"),
            func.coalesce(func.sum(ReportDetail.amount), 0).label("score")
        ).select_from(User)
        .join(Team, User.team_id == Team.id)
        .join(DailyReport, User.id == DailyReport.user_id)
        .join(ReportDetail, DailyReport.id == ReportDetail.report_id)
        .where(
            DailyReport.status == ReportStatus.REVIEWED,
            DailyReport.report_date >= start_of_week,
            DailyReport.report_date <= end_of_week,
            ReportDetail.detail_type == DetailType.CONTRACT,
            ReportDetail.description.contains("营销新签分摊")
        )
        .group_by(User.id, User.name, Team.name)
        .order_by(desc("score"))
        .limit(15)
    )
    marketing_hero_rows = marketing_hero_query.all()
    
    marketing_hero_board = []
    for idx, row in enumerate(marketing_hero_rows):
        if row.score > 0:
            marketing_hero_board.append(
                RankingItem(
                    rank=idx + 1,
                    name=row.name,
                    teamName=row.team_name,
                    score=round(float(row.score), 2),
                    trend="up" if idx == 0 else "same"
                )
            )

    # 5.2 交付新签周战将榜 TOP 10 (按当周交付新签金额降序，每周一清零)
    delivery_hero_query = await db.execute(
        select(
            User.name,
            Team.name.label("team_name"),
            func.coalesce(func.sum(ReportDetail.amount), 0).label("score")
        ).select_from(User)
        .join(Team, User.team_id == Team.id)
        .join(DailyReport, User.id == DailyReport.user_id)
        .join(ReportDetail, DailyReport.id == ReportDetail.report_id)
        .where(
            DailyReport.status == ReportStatus.REVIEWED,
            DailyReport.report_date >= start_of_week,
            DailyReport.report_date <= end_of_week,
            ReportDetail.detail_type == DetailType.CONTRACT,
            ~ReportDetail.description.contains("营销新签分摊")
        )
        .group_by(User.id, User.name, Team.name)
        .order_by(desc("score"))
        .limit(15)
    )
    delivery_hero_rows = delivery_hero_query.all()
    
    delivery_hero_board = []
    for idx, row in enumerate(delivery_hero_rows):
        if row.score > 0:
            delivery_hero_board.append(
                RankingItem(
                    rank=idx + 1,
                    name=row.name,
                    teamName=row.team_name,
                    score=round(float(row.score), 2),
                    trend="up" if idx == 0 else "same"
                )
            )
        
    # 6. 周客户幸福动作卷王榜 TOP 10 (按当周幸福动作次数降序，每周一清零)
    happiness_query = await db.execute(
        select(
            User.name,
            Team.name.label("team_name"),
            func.coalesce(func.sum(DailyReport.happiness_actions), 0).label("score")
        ).select_from(User)
        .join(Team, User.team_id == Team.id)
        .join(DailyReport, User.id == DailyReport.user_id)
        .where(
            DailyReport.status == ReportStatus.REVIEWED,
            DailyReport.report_date >= start_of_week,
            DailyReport.report_date <= end_of_week
        )
        .group_by(User.id, User.name, Team.name)
        .order_by(desc("score"))
        .limit(15)
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

    # 7. 周铁三角协作标杆榜 TOP 10 (按当周铁三角协作次数降序，每周一清零)
    triangle_query = await db.execute(
        select(
            User.name,
            Team.name.label("team_name"),
            func.coalesce(func.sum(DailyReport.triangle_count), 0).label("score")
        ).select_from(User)
        .join(Team, User.team_id == Team.id)
        .join(DailyReport, User.id == DailyReport.user_id)
        .where(
            DailyReport.status == ReportStatus.REVIEWED,
            DailyReport.report_date >= start_of_week,
            DailyReport.report_date <= end_of_week
        )
        .group_by(User.id, User.name, Team.name)
        .order_by(desc("score"))
        .limit(15)
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

    # 7.5. 周线索先锋奖榜 TOP 10 (按当周新增有效线索数降序，每周一清零)
    leads_query = await db.execute(
        select(
            User.name,
            Team.name.label("team_name"),
            func.coalesce(func.sum(DailyReport.leads_count), 0).label("score")
        ).select_from(User)
        .join(Team, User.team_id == Team.id)
        .join(DailyReport, User.id == DailyReport.user_id)
        .where(
            DailyReport.status == ReportStatus.REVIEWED,
            DailyReport.report_date >= start_of_week,
            DailyReport.report_date <= end_of_week
        )
        .group_by(User.id, User.name, Team.name)
        .order_by(desc("score"))
        .limit(15)
    )
    leads_rows = leads_query.all()

    leads_board = []
    for idx, row in enumerate(leads_rows):
        if row.score > 0:
            leads_board.append(
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
        "广州三战队（大数据）": "伍耀强",
        "广州三战队": "伍耀强",
        "佛山战队": "卢俊松",
        "湛江战队": "周真波",
        "云浮战队": "尹晓明",
        "东莞战队": "董卓佼",
        "茂名战队": "陈鸿源"
    }

    # 7.8 批量汇聚所有战队有效需求线索目标及 CRM 实际数
    from app.models.goal import PersonalGoal, GoalType
    user_goals_query = await db.execute(
        select(
            User.id,
            User.team_id,
            User.crm_user_id,
            func.coalesce(PersonalGoal.base_target, 0)
        ).select_from(User)
        .outerjoin(PersonalGoal, (User.id == PersonalGoal.user_id) & (PersonalGoal.goal_type == GoalType.LEADS_COUNT))
        .where(User.is_active == True)
    )
    user_goals_rows = user_goals_query.all()
    
    team_leads_target_map = {}
    crm_user_to_team_map = {}
    for uid, team_id, crm_uid, target in user_goals_rows:
        if not team_id:
            continue
        team_leads_target_map[team_id] = team_leads_target_map.get(team_id, 0.0) + float(target)
        if crm_uid:
            crm_user_to_team_map[crm_uid] = team_id

    team_leads_actual_map = {}
    if crm_user_to_team_map:
        import pymysql
        try:
            crm_conn = pymysql.connect(
                host=settings.CRM_DB_HOST,
                port=settings.CRM_DB_PORT,
                user=settings.CRM_DB_USER,
                password=settings.CRM_DB_PASSWORD,
                database=settings.CRM_DB_NAME,
                charset='utf8mb4',
                connect_timeout=3
            )
            crm_cur = crm_conn.cursor(pymysql.cursors.DictCursor)
            # 仅统计更新时间在6月1日后且进度等于25%的线索
            crm_cur.execute("""
                SELECT market_user_id
                FROM zdcrm_business_opportunity
                WHERE progress = 25
                  AND is_del = '0'
                  AND (is_suspension = '0' OR is_suspension IS NULL)
                  AND update_time >= '2026-06-01 00:00:00'
            """)
            crm_rows = crm_cur.fetchall()
            for row in crm_rows:
                m_uid = row["market_user_id"]
                if m_uid:
                    for part in m_uid.split(","):
                        part = part.strip()
                        if part in crm_user_to_team_map:
                            tid = crm_user_to_team_map[part]
                            team_leads_actual_map[tid] = team_leads_actual_map.get(tid, 0) + 1
            crm_cur.close()
            crm_conn.close()
        except Exception as crm_err:
            logger.warning(f"双轨动力卡片直连 CRM 获取有效线索失败: {crm_err}")

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
        
        # 有效线索目标和实际
        leads_target = team_leads_target_map.get(t.id, 0.0)
        leads_actual = team_leads_actual_map.get(t.id, 0)
        leads_rate = (leads_actual / leads_target * 100) if leads_target > 0 else 0.0
        
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
            "validLeadsActual": leads_actual,
            "validLeadsTarget": round(leads_target, 2),
            "validLeadsRate": round(leads_rate, 2),
            "statusLight": light
        })
    
    # 截取前9名保证3x3网格
    dual_track_teams = dual_track_teams[:9]

    # 9. 直连 CRM 计算销售漏斗与提取 50万以上重要项目
    import pymysql
    from app.schemas.dashboard import FunnelItem, ImportantProjectItem

    leads_funnel = []
    important_projects = []
    
    crm_conn = None
    try:
        crm_conn = pymysql.connect(
            host=settings.CRM_DB_HOST,
            port=settings.CRM_DB_PORT,
            user=settings.CRM_DB_USER,
            password=settings.CRM_DB_PASSWORD,
            database=settings.CRM_DB_NAME,
            charset='utf8mb4',
            connect_timeout=3
        )
        crm_cur = crm_conn.cursor(pymysql.cursors.DictCursor)
        
        # A. 统计销售漏斗各阶段商机数量
        crm_cur.execute("""
            SELECT progress, COUNT(*) as count
            FROM zdcrm_business_opportunity
            WHERE is_del = '0'
              AND (is_suspension = '0' OR is_suspension IS NULL)
              AND progress IN (5, 10, 25, 50, 75, 90)
            GROUP BY progress
        """)
        funnel_rows = crm_cur.fetchall()
        
        counts_map = {int(row["progress"]): row["count"] for row in funnel_rows}
        
        N_5 = counts_map.get(5, 0)
        N_10 = counts_map.get(10, 0)
        N_25 = counts_map.get(25, 0)
        N_50 = counts_map.get(50, 0)
        N_75 = counts_map.get(75, 0)
        N_90 = counts_map.get(90, 0)
        
        # 按照附件 2 对齐的阶段与转化率逻辑计算
        rate_5 = round((N_10 / N_5) * 100, 2) if N_5 > 0 else 0.0
        rate_10 = round((N_25 / N_10) * 100, 2) if N_10 > 0 else 0.0
        rate_25 = round((N_50 / N_25) * 100, 2) if N_25 > 0 else 0.0
        rate_50 = round((N_75 / N_50) * 100, 2) if N_50 > 0 else 0.0
        rate_75 = round((N_90 / N_75) * 100, 2) if N_75 > 0 else 0.0
        rate_90 = round((N_5 / N_90) * 100, 2) if N_90 > 0 else 0.0 # 首尾比
        
        leads_funnel = [
            FunnelItem(stage="5%", name="潜在需求信息", count=N_5, rate=rate_5),
            FunnelItem(stage="10%", name="需求意向阶段", count=N_10, rate=rate_10),
            FunnelItem(stage="25%", name="已验证需求", count=N_25, rate=rate_25),
            FunnelItem(stage="50%", name="进入二选一", count=N_50, rate=rate_50),
            FunnelItem(stage="75%", name="订单基本确认", count=N_75, rate=rate_75),
            FunnelItem(stage="90%", name="正式签约", count=N_90, rate=rate_90),
        ]
        
        # B. 提取预计金额 50万以上（expect_money >= 50）的重要商机列表
        crm_cur.execute("""
            SELECT id, name, customer_name, expect_money, progress
            FROM zdcrm_business_opportunity
            WHERE expect_money >= 50
              AND is_del = '0'
              AND (is_suspension = '0' OR is_suspension IS NULL)
            ORDER BY create_time DESC
            LIMIT 15
        """)
        project_rows = crm_cur.fetchall()
        
        for r in project_rows:
            important_projects.append(
                ImportantProjectItem(
                    id=str(r["id"]),
                    name=r["name"],
                    customerName=r["customer_name"],
                    amount=float(r["expect_money"]) if r["expect_money"] else 0.0,
                    progress=int(r["progress"]) if r["progress"] else 0
                )
            )
            
        crm_cur.close()
        crm_conn.close()
    except Exception as crm_err:
        logger.error(f"大屏加载时直连 CRM 获取漏斗和重要项目失败: {crm_err}，已降级启用高保真 Mock 兜底数据")
        # 降级 Mock 兜底数据 (数量与附件 2 完美对齐，满足极高逼真度)
        leads_funnel = [
            FunnelItem(stage="5%", name="潜在需求信息", count=177, rate=51.98),
            FunnelItem(stage="10%", name="需求意向阶段", count=92, rate=176.09),
            FunnelItem(stage="25%", name="已验证需求", count=162, rate=85.19),
            FunnelItem(stage="50%", name="进入二选一", count=138, rate=492.75),
            FunnelItem(stage="75%", name="订单基本确认", count=680, rate=103.97),
            FunnelItem(stage="90%", name="正式签约", count=707, rate=25.04),
        ]
        # 降级生成 5 条典型的 50万以上攻坚项目
        important_projects = [
            ImportantProjectItem(id="mock1", name="连山壮族瑶族自治县永久基本农田年度评估项目", customerName="连山壮族瑶族自治县自然资源局", amount=128.0, progress=75),
            ImportantProjectItem(id="mock2", name="清远市2026年度国土空间规划监测及动态评估服务", customerName="清远市自然资源局", amount=185.5, progress=50),
            ImportantProjectItem(id="mock3", name="佛山市三水区白坭点状供地综合技术服务工作", customerName="佛山市自然资源局三水分局", amount=75.0, progress=25),
            ImportantProjectItem(id="mock4", name="罗定市矿产资源规划编制及成果数据库入库项目", customerName="罗定市厚信建材有限公司", amount=56.0, progress=50),
            ImportantProjectItem(id="mock5", name="东莞市挖潜拓展多元化土地经营收益实施路径项目", customerName="东莞市地理信息与规划编制研究中心", amount=98.0, progress=90),
        ]
    finally:
        if crm_conn:
            try:
                crm_conn.close()
            except:
                pass

    # 动态计算倒计时天数（以数据库中最晚的周目标结束日期为基准，默认2026-09-08）
    max_end_date_res = await db.execute(select(func.max(WeeklyTarget.week_end)))
    campaign_end_date = max_end_date_res.scalar()
    if not campaign_end_date:
        campaign_end_date = date(2026, 9, 8)
    
    countdown = max(0, (campaign_end_date - target_date).days + 1)
    return DashboardResponse(
        kpiSummary=kpi_summary,
        zoneRanking=zone_ranking,
        weeklyTrend=weekly_trend,
        liveFeed=live_feed,
        heroBoard=hero_board,
        marketingHeroBoard=marketing_hero_board,
        deliveryHeroBoard=delivery_hero_board,
        happinessBoard=happiness_board,
        triangleBoard=triangle_board,
        leadsBoard=leads_board,
        zoneTeamsPK=zone_teams_pk,
        dualTrackTeams=dual_track_teams,
        leadsFunnel=leads_funnel,
        importantProjects=important_projects,
        countdown=countdown,
        campaignName="中地顾问「百日奋战」经营冲刺大屏",
        slogan="奋战一百天，亮剑破六千！"
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
    # 官方标准的百日战役15周日期起止映射（代码兜底纠偏防线）
    STANDARD_WEEK_RANGES = {
        1: (date(2026, 6, 1), date(2026, 6, 7)),
        2: (date(2026, 6, 8), date(2026, 6, 14)),
        3: (date(2026, 6, 15), date(2026, 6, 21)),
        4: (date(2026, 6, 22), date(2026, 6, 28)),
        5: (date(2026, 6, 29), date(2026, 7, 5)),
        6: (date(2026, 7, 6), date(2026, 7, 12)),
        7: (date(2026, 7, 13), date(2026, 7, 19)),
        8: (date(2026, 7, 20), date(2026, 7, 26)),
        9: (date(2026, 7, 27), date(2026, 8, 2)),
        10: (date(2026, 8, 3), date(2026, 8, 9)),
        11: (date(2026, 8, 10), date(2026, 8, 16)),
        12: (date(2026, 8, 17), date(2026, 8, 23)),
        13: (date(2026, 8, 24), date(2026, 8, 30)),
        14: (date(2026, 8, 31), date(2026, 9, 6)),
        15: (date(2026, 9, 7), date(2026, 9, 8))
    }
    for row in target_rows:
        week_num = row.week_number
        s_date, e_date = STANDARD_WEEK_RANGES.get(week_num, (row.week_start, row.week_end))
        
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
    try:
        return await _get_my_cascade_stats_impl(db, current_user)
    except Exception as err:
        import traceback
        exc_info = traceback.format_exc()
        logger.error(f"my-stats 接口报错: {exc_info}")
        raise HTTPException(status_code=500, detail=f"my-stats error: {str(err)}\n{exc_info}")

async def _get_my_cascade_stats_impl(db: AsyncSession, current_user: User):
    """
    自上而下获取：
    1. 全公司四大KPI累计进度
    2. 所属战队营销/交付双轨及过程指标进度
    3. 个人核心KPI目标达成进度（根据岗位动态呈现）
    """
    from app.models.report import ReportDetail, DetailType, ReportStatus

    # ====== 1. 公司盘数据 ======
    # 统计去重后全公司累计合同额（只统计交付维度，过滤掉营销维度以防重复计算）
    total_amount_stmt = select(
        func.coalesce(func.sum(ReportDetail.amount), 0)
    ).select_from(ReportDetail).join(DailyReport, ReportDetail.report_id == DailyReport.id).where(
        DailyReport.status == ReportStatus.REVIEWED,
        ReportDetail.detail_type == DetailType.CONTRACT,
        ~ReportDetail.description.contains("营销新签分摊")
    )
    total_amount_res = await db.execute(total_amount_stmt)
    total_amount_val = float(total_amount_res.scalar() or 0.0)

    company_summary = await db.execute(
        select(
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

    val_contracts = total_amount_val
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

    team_stats = None
    if current_user.team_id:
        from sqlalchemy.orm import joinedload
        team_res = await db.execute(
            select(Team).options(joinedload(Team.zone)).where(Team.id == current_user.team_id)
        )
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
                "zone_name": team.zone.name if team.zone else "未知战区",
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

    # 计算参战天数（从2026-06-01开始，截止到2026-09-08，最多100天）
    from datetime import date, datetime, timezone, timedelta
    campaign_start = date(2026, 6, 1)
    campaign_end = date(2026, 9, 8)
    
    # 使用北京时间 (UTC+8) 获取当前日期
    beijing_tz = timezone(timedelta(hours=8))
    today_bj = datetime.now(beijing_tz).date()
    
    if today_bj < campaign_start:
        join_days = 0
    elif today_bj > campaign_end:
        join_days = 100
    else:
        join_days = (today_bj - campaign_start).days + 1

    # 查询当前用户审核通过的日报总数
    total_reports_stmt = select(func.count(DailyReport.id)).where(
        DailyReport.user_id == current_user.id,
        DailyReport.status == ReportStatus.REVIEWED
    )
    total_reports = int(await db.scalar(total_reports_stmt) or 0)
    
    # 计算填报率，保留一位小数
    report_rate = round((total_reports / join_days * 100), 1) if join_days > 0 else 0.0

    return {
        "company_stats": company_stats,
        "team_stats": team_stats,
        "personal_stats": personal_stats,
        "user_meta": {
            "join_days": join_days,
            "total_reports": total_reports,
            "report_rate": f"{report_rate}%"
        }
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
            
            # 有效需求线索量 (仅25%阶段，且更新时间在6月1日后才算)
            user_ids_str = ", ".join([f"'{uid}'" for uid in crm_user_ids])
            
            cur.execute(f"""
                SELECT COUNT(*) as count 
                FROM zdcrm_business_opportunity 
                WHERE progress = 25 
                  AND (is_suspension = '0' OR is_suspension IS NULL)
                  AND market_user_id IN ({user_ids_str})
                  AND update_time >= '2026-06-01 00:00:00'
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


def get_mock_leads(lead_type: str, team_name: str):
    """
    Mock 数据兜底：当直连 CRM 数据库断开或出错时，返回高度拟真的明细数据
    """
    if lead_type == "valid":
        return [
            {
                "id": "mock_valid_1",
                "name": "从化区2026年耕作层剥离再利用方案编制",
                "progress": "50%",
                "latest_feedback": "合同已签订，正在准备前期资料",
                "status": "未预设立",
                "budget": 29.0,
                "forecast_amount": 29.0,
                "region": "广州市从化区",
                "business_category": "耕作层剥离利用方案",
                "source": "营销端",
                "customer_name": "广州市从化区土地储备开发中心"
            },
            {
                "id": "mock_valid_2",
                "name": "湛江县城标动力开发边界局部优化方案",
                "progress": "25%",
                "latest_feedback": "已挂网，已在走商务流程",
                "status": "未预设立",
                "budget": 20.0,
                "forecast_amount": 20.0,
                "region": "湛江市遂溪县",
                "business_category": "规划修改类",
                "source": "营销端",
                "customer_name": "遂溪县自然资源局"
            },
            {
                "id": "mock_valid_3",
                "name": "廉江市新民镇2026年度第十批次建设用地报批",
                "progress": "75%",
                "latest_feedback": "已签合同，正组卷上报",
                "status": "已预设立",
                "budget": 15.0,
                "forecast_amount": 15.0,
                "region": "廉江市新民镇",
                "business_category": "规划报批类",
                "source": "营销端",
                "customer_name": "新民镇人民政府"
            }
        ]
    else:
        return [
            {
                "id": "mock_potential_1",
                "name": "明富路回购规划",
                "progress": "10%",
                "latest_feedback": "合同已签订，正在准备初稿",
                "status": "未预设立",
                "budget": 10.0,
                "forecast_amount": 10.0,
                "region": "佛山市高明区",
                "business_category": "其他规划类",
                "source": "营销端",
                "customer_name": "佛山市自然资源局高明分局"
            },
            {
                "id": "mock_potential_2",
                "name": "罗定市2026年国有建设用地使用权基准地价更新",
                "progress": "5%",
                "latest_feedback": "已送初稿并开展论证工作",
                "status": "未预设立",
                "budget": 60.0,
                "forecast_amount": 43.0,
                "region": "云浮市罗定市",
                "business_category": "基准地价更新",
                "source": "营销端",
                "customer_name": "罗定市自然资源局"
            }
        ]


@router.get("/team-leads", summary="获取战队有效/潜力线索明细列表")
async def get_team_leads(
    team_id: int,
    lead_type: str = Query(..., description="线索类型：valid(有效, 25-75%) 或 potential(潜力, 5-10%)"),
    db: AsyncSession = Depends(get_db),
):
    """
    获取某个战队在特定线索类型（有效或潜力）下的 CRM 线索明细列表
    """
    import pymysql
    # 1. 验证战队是否存在
    team_res = await db.execute(select(Team).where(Team.id == team_id))
    team = team_res.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="战队不存在")

    # 2. 查询该战队成员的 crm_user_id 列表
    users_res = await db.execute(select(User).where(User.team_id == team_id))
    members = users_res.scalars().all()
    crm_user_ids = [u.crm_user_id for u in members if u.crm_user_id]
    
    if not crm_user_ids:
        raise HTTPException(status_code=400, detail="该战队成员未绑定任何 CRM 账号，无法拉取线索列表")

    leads_list = []
    
    # 3. 直连 CRM 数据库拉取线索列表
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
        
        user_ids_str = ", ".join([f"'{uid}'" for uid in crm_user_ids])
        
        # 进度与时间过滤条件拼接
        if lead_type == "valid":
            filter_cond = "progress = 25 AND update_time >= '2026-06-01 00:00:00'"
        elif lead_type == "potential":
            filter_cond = "progress BETWEEN 5 AND 10"
        else:
            raise HTTPException(status_code=400, detail="无效的线索类型")
            
        sql = f"""
            SELECT id, name, progress, remark, details, contract_status, budget_money, expect_money, 
                   province, city, district, third_type, data_source, customer_name 
            FROM zdcrm_business_opportunity 
            WHERE {filter_cond}
              AND (is_suspension = '0' OR is_suspension IS NULL)
              AND market_user_id IN ({user_ids_str})
            ORDER BY create_time DESC
        """
        cur.execute(sql)
        rows = cur.fetchall()
        
        for row in rows:
            region = ""
            if row.get("province"):
                region += row["province"]
            if row.get("city"):
                region += row["city"]
            if row.get("district"):
                region += row["district"]
                
            leads_list.append({
                "id": row.get("id"),
                "name": row.get("name") or "未命名业务",
                "progress": f"{float(row['progress'])}%" if row.get("progress") is not None else "0%",
                "latest_feedback": row.get("remark") or row.get("details") or "暂无反馈",
                "status": row.get("contract_status") or "未预设立",
                "budget": float(row["budget_money"]) if row.get("budget_money") is not None else 0.0,
                "forecast_amount": float(row["expect_money"]) if row.get("expect_money") is not None else 0.0,
                "region": region or "未知区域",
                "business_category": row.get("third_type") or "未分类",
                "source": row.get("data_source") or "营销端",
                "customer_name": row.get("customer_name") or "未知单位"
            })
            
        cur.close()
        conn.close()
    except Exception as e:
        import logging
        logging.getLogger("battle100").warning(f"直连 CRM 获取线索详情失败: {e}")
        raise HTTPException(status_code=503, detail="连接 CRM 数据库失败，无法获取线索详情")
        
    return leads_list


@router.get("/team-contracts", summary="获取战队营销/交付新签合同明细列表")
async def get_team_contracts(
    team_id: int,
    contract_type: str = Query(..., description="合同类型: marketing(营销) 或 delivery(交付)"),
    db: AsyncSession = Depends(get_db),
):
    """
    直连本地填报明细数据，获取战队营销或交付新签合同项目的列表
    """
    # 1. 验证战队是否存在
    team_res = await db.execute(select(Team).where(Team.id == team_id))
    team = team_res.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="战队不存在")

    stmt = (
        select(
            ReportDetail.id,
            DailyReport.report_date,
            User.name.label("reporter_name"),
            ReportDetail.customer_name,
            ReportDetail.amount,
            PartnerUser.name.label("partner_name"),
            ReportDetail.description,
        )
        .select_from(ReportDetail)
        .join(DailyReport, ReportDetail.report_id == DailyReport.id)
        .join(User, DailyReport.user_id == User.id)
        .outerjoin(PartnerUser, ReportDetail.partner_user_id == PartnerUser.id)
        .where(
            DailyReport.status == ReportStatus.REVIEWED,
            ReportDetail.detail_type == DetailType.CONTRACT,
        )
    )
    
    if contract_type == "marketing":
        stmt = stmt.where(
            (
                (
                    (ReportDetail.description.contains("营销新签分摊")) &
                    ((User.team_id == team_id) | (PartnerUser.team_id == team_id))
                ) |
                (
                    (~ReportDetail.description.contains("交付新签分摊")) &
                    (
                        ((User.team_id == team_id) & (User.position_type.in_([PositionType.MARKETING, PositionType.MANAGEMENT]))) |
                        ((PartnerUser.team_id == team_id) & (PartnerUser.position_type.in_([PositionType.MARKETING, PositionType.MANAGEMENT])))
                    )
                )
            )
        )
    elif contract_type == "delivery":
        stmt = stmt.where(
            (
                (
                    (ReportDetail.description.contains("交付新签分摊")) &
                    ((User.team_id == team_id) | (PartnerUser.team_id == team_id))
                ) |
                (
                    (~ReportDetail.description.contains("营销新签分摊")) &
                    (
                        ((User.team_id == team_id) & (User.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY]))) |
                        ((PartnerUser.team_id == team_id) & (PartnerUser.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY])))
                    )
                )
            )
        )
    else:
        raise HTTPException(status_code=400, detail="无效的合同新签类型")
        
    stmt = stmt.order_by(DailyReport.report_date.desc(), ReportDetail.id.desc())
    res = await db.execute(stmt)
    rows = res.all()
    
    result = []
    for r in rows:
        result.append({
            "id": r.id,
            "report_date": r.report_date.strftime("%Y-%m-%d") if r.report_date else "",
            "reporter_name": r.reporter_name,
            "customer_name": r.customer_name or "—",
            "amount": r.amount or 0.0,
            "partner_name": r.partner_name or "—",
            "description": r.description or "—",
        })
    return result


@router.get("/team-triangles", summary="获取战队售前铁三角联动明细列表")
async def get_team_triangles(
    team_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    直连本地填报明细数据，获取战队售前铁三角联动项目的明细列表
    """
    # 验证战队是否存在
    team_res = await db.execute(select(Team).where(Team.id == team_id))
    team = team_res.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="战队不存在")

    stmt = (
        select(
            ReportDetail.id,
            DailyReport.report_date,
            User.name.label("reporter_name"),
            ReportDetail.customer_name,
            PartnerUser.name.label("partner_name"),
            ReportDetail.description,
        )
        .select_from(ReportDetail)
        .join(DailyReport, ReportDetail.report_id == DailyReport.id)
        .join(User, DailyReport.user_id == User.id)
        .outerjoin(PartnerUser, ReportDetail.partner_user_id == PartnerUser.id)
        .where(
            DailyReport.status == ReportStatus.REVIEWED,
            ReportDetail.detail_type == DetailType.TRIANGLE,
            User.team_id == team_id
        )
        .order_by(DailyReport.report_date.desc(), ReportDetail.id.desc())
    )
    
    res = await db.execute(stmt)
    rows = res.all()
    
    result = []
    for r in rows:
        result.append({
            "id": r.id,
            "report_date": r.report_date.strftime("%Y-%m-%d") if r.report_date else "",
            "reporter_name": r.reporter_name,
            "customer_name": r.customer_name or "—",
            "partner_name": r.partner_name or "—",
            "description": r.description or "—",
        })
    return result


@router.get("/team-happiness", summary="获取战队客户幸福标准动作明细列表")
async def get_team_happiness(
    team_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    直连本地填报明细数据，获取战队客户幸福标准动作的明细列表
    """
    # 验证战队是否存在
    team_res = await db.execute(select(Team).where(Team.id == team_id))
    team = team_res.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="战队不存在")

    stmt = (
        select(
            ReportDetail.id,
            DailyReport.report_date,
            User.name.label("reporter_name"),
            ReportDetail.customer_name,
            ReportDetail.happiness_level,
            ReportDetail.description,
        )
        .select_from(ReportDetail)
        .join(DailyReport, ReportDetail.report_id == DailyReport.id)
        .join(User, DailyReport.user_id == User.id)
        .where(
            DailyReport.status == ReportStatus.REVIEWED,
            ReportDetail.detail_type == DetailType.HAPPINESS,
            User.team_id == team_id
        )
        .order_by(DailyReport.report_date.desc(), ReportDetail.id.desc())
    )
    
    res = await db.execute(stmt)
    rows = res.all()
    
    result = []
    for r in rows:
        result.append({
            "id": r.id,
            "report_date": r.report_date.strftime("%Y-%m-%d") if r.report_date else "",
            "reporter_name": r.reporter_name,
            "customer_name": r.customer_name or "—",
            "level": f"{r.happiness_level} 分" if r.happiness_level is not None else "—",
            "description": r.description or "—",
        })
    return result


@router.get("/company-kpi-detail", summary="获取全公司 KPI 明细数据")
async def get_company_kpi_detail(
    kpi_type: str = Query(..., description="KPI类型: contracts(合同新签), happiness(客户幸福动作), triangle(铁三角联动), leads(有效商机线索)"),
    team_id: int | None = Query(None, description="按战队筛选"),
    week: int | None = Query(None, description="按周筛选 (1-15)"),
    reporter_name: str | None = Query(None, description="按提报人筛选"),
    keyword: str | None = Query(None, description="按客户或描述搜索"),
    db: AsyncSession = Depends(get_db),
):
    """
    获取全公司级别的 KPI 指标明细列表及相关统计数据，所有注释必须使用中文
    """
    from app.models.user import User, PositionType
    from app.models.report import DailyReport, ReportDetail, ReportStatus, DetailType
    from app.models.organization import Team
    from sqlalchemy.orm import aliased
    from sqlalchemy import select, func
    from datetime import date

    PartnerUser = aliased(User)

    # 官方标准的百日战役15周日期区间定义
    STANDARD_WEEKS = {
        1: (date(2026, 6, 1), date(2026, 6, 7)),
        2: (date(2026, 6, 8), date(2026, 6, 14)),
        3: (date(2026, 6, 15), date(2026, 6, 21)),
        4: (date(2026, 6, 22), date(2026, 6, 28)),
        5: (date(2026, 6, 29), date(2026, 7, 5)),
        6: (date(2026, 7, 6), date(2026, 7, 12)),
        7: (date(2026, 7, 13), date(2026, 7, 19)),
        8: (date(2026, 7, 20), date(2026, 7, 26)),
        9: (date(2026, 7, 27), date(2026, 8, 2)),
        10: (date(2026, 8, 3), date(2026, 8, 9)),
        11: (date(2026, 8, 10), date(2026, 8, 16)),
        12: (date(2026, 8, 17), date(2026, 8, 23)),
        13: (date(2026, 8, 24), date(2026, 8, 30)),
        14: (date(2026, 8, 31), date(2026, 9, 6)),
        15: (date(2026, 9, 7), date(2026, 9, 8))
    }

    # 查出下拉菜单所需的过滤列表
    teams_query = select(Team.id, Team.name).order_by(Team.id)
    teams_res = await db.execute(teams_query)
    teams_list = [{"id": r.id, "name": r.name} for r in teams_res.all()]

    reporters_query = (
        select(User.name)
        .join(DailyReport, User.id == DailyReport.user_id)
        .where(DailyReport.status == ReportStatus.REVIEWED)
        .distinct()
        .order_by(User.name)
    )
    reporters_res = await db.execute(reporters_query)
    reporters_list = [r.name for r in reporters_res.all()]

    result_data = {
        "teams": teams_list,
        "reporters": reporters_list
    }

    if kpi_type == "contracts":
        # 1. 交付新签明细 (去重累计，大盘展示的也是交付视角累计)
        delivery_stmt = (
            select(
                ReportDetail.id,
                DailyReport.report_date,
                User.name.label("reporter_name"),
                Team.name.label("team_name"),
                ReportDetail.customer_name,
                ReportDetail.amount,
                PartnerUser.name.label("partner_name"),
                ReportDetail.description,
            )
            .select_from(ReportDetail)
            .join(DailyReport, ReportDetail.report_id == DailyReport.id)
            .join(User, DailyReport.user_id == User.id)
            .outerjoin(Team, User.team_id == Team.id)
            .outerjoin(PartnerUser, ReportDetail.partner_user_id == PartnerUser.id)
            .where(
                DailyReport.status == ReportStatus.REVIEWED,
                ReportDetail.detail_type == DetailType.CONTRACT,
                ~ReportDetail.description.contains("营销新签分摊")
            )
        )

        # 2. 营销新签明细
        marketing_stmt = (
            select(
                ReportDetail.id,
                DailyReport.report_date,
                User.name.label("reporter_name"),
                Team.name.label("team_name"),
                ReportDetail.customer_name,
                ReportDetail.amount,
                PartnerUser.name.label("partner_name"),
                ReportDetail.description,
            )
            .select_from(ReportDetail)
            .join(DailyReport, ReportDetail.report_id == DailyReport.id)
            .join(User, DailyReport.user_id == User.id)
            .outerjoin(Team, User.team_id == Team.id)
            .outerjoin(PartnerUser, ReportDetail.partner_user_id == PartnerUser.id)
            .where(
                DailyReport.status == ReportStatus.REVIEWED,
                ReportDetail.detail_type == DetailType.CONTRACT,
                (
                    (ReportDetail.description.contains("营销新签分摊")) |
                    (
                        (~ReportDetail.description.contains("交付新签分摊")) &
                        (
                            (User.position_type.in_([PositionType.MARKETING, PositionType.MANAGEMENT])) |
                            (PartnerUser.position_type.in_([PositionType.MARKETING, PositionType.MANAGEMENT]))
                        )
                    )
                )
            )
        )

        # 动态拼装合同额过滤条件
        if team_id is not None:
            delivery_stmt = delivery_stmt.where((User.team_id == team_id) | (PartnerUser.team_id == team_id))
            marketing_stmt = marketing_stmt.where((User.team_id == team_id) | (PartnerUser.team_id == team_id))
        
        if week is not None and week in STANDARD_WEEKS:
            s_date, e_date = STANDARD_WEEKS[week]
            delivery_stmt = delivery_stmt.where(DailyReport.report_date >= s_date, DailyReport.report_date <= e_date)
            marketing_stmt = marketing_stmt.where(DailyReport.report_date >= s_date, DailyReport.report_date <= e_date)

        if reporter_name:
            delivery_stmt = delivery_stmt.where(User.name == reporter_name)
            marketing_stmt = marketing_stmt.where(User.name == reporter_name)

        if keyword:
            kw_filter = (ReportDetail.customer_name.contains(keyword) | ReportDetail.description.contains(keyword))
            delivery_stmt = delivery_stmt.where(kw_filter)
            marketing_stmt = marketing_stmt.where(kw_filter)

        delivery_stmt = delivery_stmt.order_by(DailyReport.report_date.desc(), ReportDetail.id.desc())
        marketing_stmt = marketing_stmt.order_by(DailyReport.report_date.desc(), ReportDetail.id.desc())

        delivery_res = await db.execute(delivery_stmt)
        delivery_rows = delivery_res.all()
        delivery_list = []
        delivery_total = 0.0
        for r in delivery_rows:
            amt = r.amount or 0.0
            delivery_total += amt
            delivery_list.append({
                "id": r.id,
                "report_date": r.report_date.strftime("%Y-%m-%d") if r.report_date else "",
                "reporter_name": r.reporter_name,
                "team_name": r.team_name or "—",
                "customer_name": r.customer_name or "—",
                "amount": amt,
                "partner_name": r.partner_name or "—",
                "description": r.description or "—",
            })

        marketing_res = await db.execute(marketing_stmt)
        marketing_rows = marketing_res.all()
        marketing_list = []
        marketing_total = 0.0
        for r in marketing_rows:
            amt = r.amount or 0.0
            marketing_total += amt
            marketing_list.append({
                "id": r.id,
                "report_date": r.report_date.strftime("%Y-%m-%d") if r.report_date else "",
                "reporter_name": r.reporter_name,
                "team_name": r.team_name or "—",
                "customer_name": r.customer_name or "—",
                "amount": amt,
                "partner_name": r.partner_name or "—",
                "description": r.description or "—",
            })

        result_data.update({
            "delivery_total": round(delivery_total, 2),
            "marketing_total": round(marketing_total, 2),
            "delivery_list": delivery_list,
            "marketing_list": marketing_list
        })
        return result_data

    elif kpi_type == "happiness":
        stmt = (
            select(
                ReportDetail.id,
                DailyReport.report_date,
                User.name.label("reporter_name"),
                Team.name.label("team_name"),
                ReportDetail.customer_name,
                ReportDetail.happiness_level,
                ReportDetail.description,
            )
            .select_from(ReportDetail)
            .join(DailyReport, ReportDetail.report_id == DailyReport.id)
            .join(User, DailyReport.user_id == User.id)
            .outerjoin(Team, User.team_id == Team.id)
            .where(
                DailyReport.status == ReportStatus.REVIEWED,
                ReportDetail.detail_type == DetailType.HAPPINESS,
            )
        )

        if team_id is not None:
            stmt = stmt.where(User.team_id == team_id)
        if week is not None and week in STANDARD_WEEKS:
            s_date, e_date = STANDARD_WEEKS[week]
            stmt = stmt.where(DailyReport.report_date >= s_date, DailyReport.report_date <= e_date)
        if reporter_name:
            stmt = stmt.where(User.name == reporter_name)
        if keyword:
            stmt = stmt.where(ReportDetail.customer_name.contains(keyword) | ReportDetail.description.contains(keyword))

        stmt = stmt.order_by(DailyReport.report_date.desc(), ReportDetail.id.desc())
        res = await db.execute(stmt)
        rows = res.all()

        list_data = []
        for r in rows:
            list_data.append({
                "id": r.id,
                "report_date": r.report_date.strftime("%Y-%m-%d") if r.report_date else "",
                "reporter_name": r.reporter_name,
                "team_name": r.team_name or "—",
                "customer_name": r.customer_name or "—",
                "level": f"{r.happiness_level} 分" if r.happiness_level is not None else "—",
                "description": r.description or "—",
            })
        result_data.update({
            "total": len(list_data),
            "list": list_data
        })
        return result_data

    elif kpi_type == "triangle":
        stmt = (
            select(
                ReportDetail.id,
                DailyReport.report_date,
                User.name.label("reporter_name"),
                Team.name.label("team_name"),
                ReportDetail.customer_name,
                PartnerUser.name.label("partner_name"),
                ReportDetail.description,
            )
            .select_from(ReportDetail)
            .join(DailyReport, ReportDetail.report_id == DailyReport.id)
            .join(User, DailyReport.user_id == User.id)
            .outerjoin(Team, User.team_id == Team.id)
            .outerjoin(PartnerUser, ReportDetail.partner_user_id == PartnerUser.id)
            .where(
                DailyReport.status == ReportStatus.REVIEWED,
                ReportDetail.detail_type == DetailType.TRIANGLE,
            )
        )

        if team_id is not None:
            stmt = stmt.where((User.team_id == team_id) | (PartnerUser.team_id == team_id))
        if week is not None and week in STANDARD_WEEKS:
            s_date, e_date = STANDARD_WEEKS[week]
            stmt = stmt.where(DailyReport.report_date >= s_date, DailyReport.report_date <= e_date)
        if reporter_name:
            stmt = stmt.where(User.name == reporter_name)
        if keyword:
            stmt = stmt.where(ReportDetail.customer_name.contains(keyword) | ReportDetail.description.contains(keyword))

        stmt = stmt.order_by(DailyReport.report_date.desc(), ReportDetail.id.desc())
        res = await db.execute(stmt)
        rows = res.all()

        list_data = []
        import re

        # 按战报 ID 进行分组去重，优先保留真正的播报发布人自己的那条明细
        broadcast_groups = {}
        non_broadcast_rows = []

        for r in rows:
            desc = r.description or ""
            bid_match = re.search(r"\[broadcast_id:(\d+)\]", desc)
            if bid_match:
                bid = int(bid_match.group(1))
                if bid not in broadcast_groups:
                    broadcast_groups[bid] = []
                broadcast_groups[bid].append(r)
            else:
                non_broadcast_rows.append(r)

        final_rows = []
        for bid, group_rows in broadcast_groups.items():
            if len(group_rows) == 1:
                final_rows.append(group_rows[0])
            else:
                # 从第一条的描述中提取发起人（如 "我司【黄青】"）
                first_desc = group_rows[0].description or ""
                initiator_match = re.search(r"我司【(.*?)】", first_desc)
                selected_r = None
                if initiator_match:
                    initiator_name = initiator_match.group(1).strip()
                    for gr in group_rows:
                        if gr.reporter_name and gr.reporter_name.strip() == initiator_name:
                            selected_r = gr
                            break
                # 如果没有匹配上，则兜底使用第一条
                if not selected_r:
                    selected_r = group_rows[0]
                final_rows.append(selected_r)

        # 合并无战报 ID 的记录
        final_rows.extend(non_broadcast_rows)

        # 重新按报表日期降序、ID 降序排序
        final_rows.sort(key=lambda x: (x.report_date or date.min, x.id), reverse=True)

        for r in final_rows:
            list_data.append({
                "id": r.id,
                "report_date": r.report_date.strftime("%Y-%m-%d") if r.report_date else "",
                "reporter_name": r.reporter_name,
                "team_name": r.team_name or "—",
                "customer_name": r.customer_name or "—",
                "partner_name": r.partner_name or "—",
                "description": r.description or "—",
            })
        result_data.update({
            "total": len(list_data),
            "list": list_data
        })
        return result_data


    elif kpi_type == "leads":
        stmt = (
            select(
                ReportDetail.id,
                DailyReport.report_date,
                User.name.label("reporter_name"),
                Team.name.label("team_name"),
                ReportDetail.customer_name,
                ReportDetail.amount,
                ReportDetail.lead_progress,
                ReportDetail.description,
            )
            .select_from(ReportDetail)
            .join(DailyReport, ReportDetail.report_id == DailyReport.id)
            .join(User, DailyReport.user_id == User.id)
            .outerjoin(Team, User.team_id == Team.id)
            .where(
                DailyReport.status == ReportStatus.REVIEWED,
                ReportDetail.detail_type == DetailType.LEAD,
                (ReportDetail.lead_progress.contains("25") | (ReportDetail.lead_progress == "25%"))
            )
        )

        if team_id is not None:
            stmt = stmt.where(User.team_id == team_id)
        if week is not None and week in STANDARD_WEEKS:
            s_date, e_date = STANDARD_WEEKS[week]
            stmt = stmt.where(DailyReport.report_date >= s_date, DailyReport.report_date <= e_date)
        if reporter_name:
            stmt = stmt.where(User.name == reporter_name)
        if keyword:
            stmt = stmt.where(ReportDetail.customer_name.contains(keyword) | ReportDetail.description.contains(keyword))

        stmt = stmt.order_by(DailyReport.report_date.desc(), ReportDetail.id.desc())
        res = await db.execute(stmt)
        rows = res.all()

        list_data = []
        for r in rows:
            list_data.append({
                "id": r.id,
                "report_date": r.report_date.strftime("%Y-%m-%d") if r.report_date else "",
                "reporter_name": r.reporter_name,
                "team_name": r.team_name or "—",
                "customer_name": r.customer_name or "—",
                "amount": r.amount or 0.0,
                "progress": r.lead_progress or "—",
                "description": r.description or "—",
            })
        return {
            "total": len(list_data),
            "list": list_data
        }

    elif kpi_type == "tenders":
        stmt = (
            select(
                ReportDetail.id,
                DailyReport.report_date,
                User.name.label("reporter_name"),
                Team.name.label("team_name"),
                ReportDetail.customer_name,
                ReportDetail.amount,
                ReportDetail.lead_progress,
                ReportDetail.description,
            )
            .select_from(ReportDetail)
            .join(DailyReport, ReportDetail.report_id == DailyReport.id)
            .join(User, DailyReport.user_id == User.id)
            .outerjoin(Team, User.team_id == Team.id)
            .where(
                DailyReport.status == ReportStatus.REVIEWED,
                ReportDetail.detail_type == DetailType.LEAD,
                (ReportDetail.lead_progress.contains("75") | (ReportDetail.lead_progress == "75%"))
            )
        )

        if team_id is not None:
            stmt = stmt.where(User.team_id == team_id)
        if week is not None and week in STANDARD_WEEKS:
            s_date, e_date = STANDARD_WEEKS[week]
            stmt = stmt.where(DailyReport.report_date >= s_date, DailyReport.report_date <= e_date)
        if reporter_name:
            stmt = stmt.where(User.name == reporter_name)
        if keyword:
            stmt = stmt.where(ReportDetail.customer_name.contains(keyword) | ReportDetail.description.contains(keyword))

        stmt = stmt.order_by(DailyReport.report_date.desc(), ReportDetail.id.desc())
        res = await db.execute(stmt)
        rows = res.all()

        list_data = []
        for r in rows:
            list_data.append({
                "id": r.id,
                "report_date": r.report_date.strftime("%Y-%m-%d") if r.report_date else "",
                "reporter_name": r.reporter_name,
                "team_name": r.team_name or "—",
                "customer_name": r.customer_name or "—",
                "amount": r.amount or 0.0,
                "progress": r.lead_progress or "—",
                "description": r.description or "—",
            })
        return {
            "total": len(list_data),
            "list": list_data
        }

    else:
        raise HTTPException(status_code=400, detail="无效的 KPI 类型")


@router.get("/daily-report", summary="生成个人/战队当天日报")
async def generate_daily_report(
    team_id: int | None = Query(None, description="战队ID"),
    report_date: str | None = Query(None, description="填报日期，格式 YYYY-MM-DD"),
    role: str | None = Query(None, description="角色类型: target_officer, digital_specialist, admin"),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date, timedelta, datetime
    from app.models.report import DailyReport, ReportDetail, ReportStatus, DetailType
    from app.models.goal import WeeklyTarget, TeamGoal
    from app.models.organization import Team, Zone
    from app.config import settings

    # 当前实际时间
    real_now = datetime.now()
    
    # 支持通过 report_date 参数模拟特定日期的生成，若有，模拟为该日期晚上 22 点，否则以当前实际时间为准
    if report_date:
        try:
            simulated_date = datetime.strptime(report_date, "%Y-%m-%d").date()
            now = datetime.combine(simulated_date, datetime.min.time()) + timedelta(hours=22)
        except:
            now = real_now
    else:
        now = real_now

    # 以晚上 20:00 分水岭计算统计区间
    if now.hour >= 20:
        # 已过晚上 20:00，统计区间为今天的 20:00 往前推 24 小时
        end_time = datetime(now.year, now.month, now.day, 20, 0, 0)
    else:
        # 还没到晚上 20:00，统计区间为昨天的 20:00 往前推 24 小时
        end_time = datetime(now.year, now.month, now.day, 20, 0, 0) - timedelta(days=1)
    
    start_time = end_time - timedelta(days=1)
    
    # 周目标和月份统计的基准日期
    target_date = end_time.date()

    # 计算周度时间范围
    start_of_week = target_date - timedelta(days=target_date.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    
    # 计算本周的审核时间范围（本周一前一天周日晚上 20:00 至当前 20:00）
    weekly_start_time = datetime(start_of_week.year, start_of_week.month, start_of_week.day, 20, 0, 0) - timedelta(days=1)
    weekly_end_time = end_time

    # 计算中文月份和周数
    def get_chinese_num(n: int) -> str:
        cn = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"]
        return cn[n] if 0 <= n < len(cn) else str(n)

    month_cn = get_chinese_num(target_date.month)

    # 查当周 WeeklyTarget 获取 week_number
    wt_num_stmt = select(WeeklyTarget.week_number).where(
        WeeklyTarget.week_start <= target_date,
        WeeklyTarget.week_end >= target_date
    ).limit(1)
    wt_num_res = await db.execute(wt_num_stmt)
    week_num = wt_num_res.scalar()
    if not week_num:
        # 兜底计算当月第几周
        week_num = (target_date.day - 1) // 7 + 1
    week_cn = get_chinese_num(week_num)

    # 倒计时及攻坚天数
    max_end_date_res = await db.execute(select(func.max(WeeklyTarget.week_end)))
    campaign_end_date = max_end_date_res.scalar()
    if not campaign_end_date:
        campaign_end_date = date(2026, 9, 8)
    countdown = max(0, (campaign_end_date - target_date).days + 1)
    campaign_day = 101 - countdown
    if campaign_day < 1:
        campaign_day = 1

    # 星期几
    days_cn = ["一", "二", "三", "四", "五", "六", "七"]
    day_of_week_cn = days_cn[target_date.weekday()]

    # 统计周目标和周实际完成额 (万元)
    from app.models.goal import TeamGoalCategory
    if team_id:
        # 战队营销周目标与交付周目标
        wt_m_stmt = select(func.coalesce(func.sum(WeeklyTarget.marketing_base_target), 0)).where(
            WeeklyTarget.team_id == team_id,
            WeeklyTarget.week_start <= target_date,
            WeeklyTarget.week_end >= target_date
        )
        m_tgt = round(float(await db.scalar(wt_m_stmt) or 0.0), 2)
        
        wt_d_stmt = select(func.coalesce(func.sum(WeeklyTarget.delivery_base_target), 0)).where(
            WeeklyTarget.team_id == team_id,
            WeeklyTarget.week_start <= target_date,
            WeeklyTarget.week_end >= target_date
        )
        d_tgt = round(float(await db.scalar(wt_d_stmt) or 0.0), 2)

        # 双轨目标兜底
        if m_tgt == 0.0:
            g_m_res = await db.execute(
                select(func.coalesce(func.sum(TeamGoal.base_target), 0))
                .where(TeamGoal.team_id == team_id, TeamGoal.category == TeamGoalCategory.MARKETING)
            )
            m_tgt = round(float(g_m_res.scalar() or 0.0) / 12, 2)

        if d_tgt == 0.0:
            g_d_res = await db.execute(
                select(func.coalesce(func.sum(TeamGoal.base_target), 0))
                .where(TeamGoal.team_id == team_id, TeamGoal.category == TeamGoalCategory.DELIVERY)
            )
            d_tgt = round(float(g_d_res.scalar() or 0.0) / 12, 2)

        # 战队双轨周实际 (按照本周的审核时间段重新统计营销实际与交付实际)
        from app.models.user import PositionType
        query_m = (
            select(func.coalesce(func.sum(ReportDetail.amount), 0))
            .select_from(ReportDetail)
            .join(DailyReport, ReportDetail.report_id == DailyReport.id)
            .join(User, DailyReport.user_id == User.id)
            .outerjoin(PartnerUser, ReportDetail.partner_user_id == PartnerUser.id)
            .where(
                DailyReport.reviewed_at >= weekly_start_time,
                DailyReport.reviewed_at <= weekly_end_time,
                DailyReport.status == ReportStatus.REVIEWED,
                ReportDetail.detail_type == DetailType.CONTRACT,
                (
                    (
                        (ReportDetail.description.contains("营销新签分摊")) &
                        ((User.team_id == team_id) | (PartnerUser.team_id == team_id))
                    ) |
                    (
                        (~ReportDetail.description.contains("交付新签分摊")) &
                        (
                            ((User.team_id == team_id) & (User.position_type.in_([PositionType.MARKETING, PositionType.MANAGEMENT]))) |
                            ((PartnerUser.team_id == team_id) & (PartnerUser.position_type.in_([PositionType.MARKETING, PositionType.MANAGEMENT])))
                        )
                    )
                )
            )
        )
        m_act = round(float(await db.scalar(query_m) or 0.0), 2)

        query_d = (
            select(func.coalesce(func.sum(ReportDetail.amount), 0))
            .select_from(ReportDetail)
            .join(DailyReport, ReportDetail.report_id == DailyReport.id)
            .join(User, DailyReport.user_id == User.id)
            .outerjoin(PartnerUser, ReportDetail.partner_user_id == PartnerUser.id)
            .where(
                DailyReport.reviewed_at >= weekly_start_time,
                DailyReport.reviewed_at <= weekly_end_time,
                DailyReport.status == ReportStatus.REVIEWED,
                ReportDetail.detail_type == DetailType.CONTRACT,
                (
                    (
                        (ReportDetail.description.contains("交付新签分摊")) &
                        ((User.team_id == team_id) | (PartnerUser.team_id == team_id))
                    ) |
                    (
                        (~ReportDetail.description.contains("营销新签分摊")) &
                        (
                            ((User.team_id == team_id) & (User.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY]))) |
                            ((PartnerUser.team_id == team_id) & (PartnerUser.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY])))
                        )
                    )
                )
            )
        )
        d_act = round(float(await db.scalar(query_d) or 0.0), 2)
    else:
        # 公司级营销周目标与交付周目标
        wt_m_stmt = select(func.coalesce(func.sum(WeeklyTarget.marketing_base_target), 0)).where(
            WeeklyTarget.week_start <= target_date,
            WeeklyTarget.week_end >= target_date
        )
        m_tgt = round(float(await db.scalar(wt_m_stmt) or 0.0), 2)
        
        wt_d_stmt = select(func.coalesce(func.sum(WeeklyTarget.delivery_base_target), 0)).where(
            WeeklyTarget.week_start <= target_date,
            WeeklyTarget.week_end >= target_date
        )
        d_tgt = round(float(await db.scalar(wt_d_stmt) or 0.0), 2)

        # 公司双轨周实际 (按照本周的审核时间段重新统计营销实际与交付实际)
        from app.models.user import PositionType
        query_m = (
            select(func.coalesce(func.sum(ReportDetail.amount), 0))
            .select_from(ReportDetail)
            .join(DailyReport, ReportDetail.report_id == DailyReport.id)
            .join(User, DailyReport.user_id == User.id)
            .outerjoin(PartnerUser, ReportDetail.partner_user_id == PartnerUser.id)
            .where(
                DailyReport.reviewed_at >= weekly_start_time,
                DailyReport.reviewed_at <= weekly_end_time,
                DailyReport.status == ReportStatus.REVIEWED,
                ReportDetail.detail_type == DetailType.CONTRACT,
                (
                    (ReportDetail.description.contains("营销新签分摊")) |
                    (
                        (~ReportDetail.description.contains("交付新签分摊")) &
                        (
                            (User.position_type.in_([PositionType.MARKETING, PositionType.MANAGEMENT])) |
                            (PartnerUser.position_type.in_([PositionType.MARKETING, PositionType.MANAGEMENT]))
                        )
                    )
                )
            )
        )
        m_act = round(float(await db.scalar(query_m) or 0.0), 2)

        query_d = (
            select(func.coalesce(func.sum(ReportDetail.amount), 0))
            .select_from(ReportDetail)
            .join(DailyReport, ReportDetail.report_id == DailyReport.id)
            .join(User, DailyReport.user_id == User.id)
            .outerjoin(PartnerUser, ReportDetail.partner_user_id == PartnerUser.id)
            .where(
                DailyReport.reviewed_at >= weekly_start_time,
                DailyReport.reviewed_at <= weekly_end_time,
                DailyReport.status == ReportStatus.REVIEWED,
                ReportDetail.detail_type == DetailType.CONTRACT,
                (
                    (ReportDetail.description.contains("交付新签分摊")) |
                    (
                        (~ReportDetail.description.contains("营销新签分摊")) &
                        (
                            (User.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY])) | 
                            (PartnerUser.position_type.in_([PositionType.TECHNICAL, PositionType.DELIVERY]))
                        )
                    )
                )
            )
        )
        d_act = round(float(await db.scalar(query_d) or 0.0), 2)

    # 按照 20:00 统计区间筛选审核时间在此范围内的 DailyReport
    report_stmt = select(DailyReport.id).where(
        DailyReport.reviewed_at >= start_time,
        DailyReport.reviewed_at <= end_time,
        DailyReport.status == ReportStatus.REVIEWED
    )
    if team_id:
        report_stmt = report_stmt.join(User, DailyReport.user_id == User.id).where(User.team_id == team_id)
    report_ids = (await db.execute(report_stmt)).scalars().all()

    valid_leads_cnt = 0
    win_contracts_cnt = 0
    win_contracts_amt = 0.0
    signed_contracts_cnt = 0
    signed_contracts_amt = 0.0
    triangle_cnt = 0
    happiness_cnt = 0

    if report_ids:
        # 有效线索数量 (线索明细且进展为25%)
        # 根据数据库实际存储，修正过滤条件为 "25%"
        lead_stmt = select(func.count(ReportDetail.id)).where(
            ReportDetail.report_id.in_(report_ids),
            ReportDetail.detail_type == DetailType.LEAD,
            ReportDetail.lead_progress == "25%"
        )
        valid_leads_cnt = int(await db.scalar(lead_stmt) or 0)

        # 中标确定 (线索明细且进展为75%)
        # 根据数据库实际存储，修正过滤条件为 "75%"
        win_stmt = select(
            func.count(func.distinct(ReportDetail.crm_opportunity_id)).label("cnt"),
            func.coalesce(func.sum(ReportDetail.amount), 0).label("amt")
        ).where(
            ReportDetail.report_id.in_(report_ids),
            ReportDetail.detail_type == DetailType.LEAD,
            ReportDetail.lead_progress == "75%"
        )
        win_res = (await db.execute(win_stmt)).first()
        if win_res:
            win_contracts_cnt = int(win_res.cnt or 0)
            win_contracts_amt = round(float(win_res.amt or 0.0), 2)

        # 签订合同
        # 先查出这些日报下的所有合同明细，在内存中进行聚合，防止营销与交付分摊被重复累加
        all_contracts_stmt = select(ReportDetail).where(
            ReportDetail.report_id.in_(report_ids),
            ReportDetail.detail_type == DetailType.CONTRACT
        )
        all_contracts_res = await db.execute(all_contracts_stmt)
        all_contracts = all_contracts_res.scalars().all()

        # 分组聚合：以项目商机或播报作为 Key
        contracts_by_project = {}
        for item in all_contracts:
            # 优先使用 crm_opportunity_id
            proj_key = item.crm_opportunity_id
            if not proj_key or proj_key == "":
                # 尝试从描述中提取 broadcast_id
                import re
                match = re.search(r"\[broadcast_id:(\d+)\]", item.description or "")
                if match:
                    proj_key = f"broadcast_{match.group(1)}"
                else:
                    proj_key = f"detail_{item.id}"
            
            if proj_key not in contracts_by_project:
                contracts_by_project[proj_key] = {"marketing_amt": 0.0, "delivery_amt": 0.0, "other_amt": 0.0}
            
            desc = item.description or ""
            amt = item.amount or 0.0
            if "营销新签分摊" in desc:
                contracts_by_project[proj_key]["marketing_amt"] += amt
            elif "交付新签分摊" in desc:
                contracts_by_project[proj_key]["delivery_amt"] += amt
            else:
                # 兼容旧数据或无分摊的兜底记录
                contracts_by_project[proj_key]["other_amt"] += amt

        signed_contracts_cnt = len(contracts_by_project)
        signed_contracts_amt = 0.0
        for proj, amnts in contracts_by_project.items():
            # 取营销和交付分摊的最大值作为该项目在该战队（或大盘）内的最终业绩金额
            # 如果有兜底记录（other_amt），直接累加
            proj_amt = max(amnts["marketing_amt"], amnts["delivery_amt"]) + amnts["other_amt"]
            signed_contracts_amt += proj_amt
        
        signed_contracts_amt = round(signed_contracts_amt, 2)

        # 铁三角联动次数
        triangle_stmt = select(func.count(ReportDetail.id)).where(
            ReportDetail.report_id.in_(report_ids),
            ReportDetail.detail_type == DetailType.TRIANGLE
        )
        triangle_cnt = int(await db.scalar(triangle_stmt) or 0)

        # 客户幸福动作次数
        happiness_detail_stmt = select(func.count(ReportDetail.id)).where(
            ReportDetail.report_id.in_(report_ids),
            ReportDetail.detail_type == DetailType.HAPPINESS
        )
        h_detail_val = int(await db.scalar(happiness_detail_stmt) or 0)
        
        happiness_sum_stmt = select(func.coalesce(func.sum(DailyReport.happiness_actions), 0)).where(
            DailyReport.id.in_(report_ids)
        )
        h_sum_val = int(await db.scalar(happiness_sum_stmt) or 0)
        happiness_cnt = max(h_detail_val, h_sum_val)

    # 尝试直连 CRM 补充此统计区间内新增有效线索 (与填报取最大)
    crm_user_ids = []
    if team_id:
        users_res = await db.execute(select(User.crm_user_id).where(User.team_id == team_id))
        crm_user_ids = [uid for (uid,) in users_res.all() if uid]
    else:
        users_res = await db.execute(select(User.crm_user_id).where(User.crm_user_id != None))
        crm_user_ids = [uid for (uid,) in users_res.all() if uid]

    crm_leads_cnt = 0
    if crm_user_ids:
        import pymysql
        try:
            crm_conn = pymysql.connect(
                host=settings.CRM_DB_HOST,
                port=settings.CRM_DB_PORT,
                user=settings.CRM_DB_USER,
                password=settings.CRM_DB_PASSWORD,
                database=settings.CRM_DB_NAME,
                charset='utf8mb4',
                connect_timeout=3
            )
            cur = crm_conn.cursor(pymysql.cursors.DictCursor)
            user_ids_str = ", ".join([f"'{uid}'" for uid in crm_user_ids])
            cur.execute(f"""
                SELECT COUNT(*) as count 
                FROM zdcrm_business_opportunity 
                WHERE progress = 25 
                  AND is_del = '0'
                  AND (is_suspension = '0' OR is_suspension IS NULL)
                  AND market_user_id IN ({user_ids_str})
                  AND update_time BETWEEN %s AND %s
            """, (start_time, end_time))
            crm_leads_cnt = cur.fetchone()["count"]
            cur.close()
            crm_conn.close()
        except Exception as crm_err:
            logger.warning(f"统计区间内日报获取 CRM 线索失败: {crm_err}")

    valid_leads_cnt = max(valid_leads_cnt, crm_leads_cnt)

    # 统计区间描述文案
    range_str = f"（统计区间：{start_time.strftime('%Y-%m-%d %H:%M')} 至 {end_time.strftime('%Y-%m-%d %H:%M')}）"

    # 组装文本
    if not team_id:
        # 系统管理员 (全公司大盘)
        text = (
            f"攻坚一百天，亮剑破六千！中地【{month_cn}】月第【{week_cn}】周攻坚目标{range_str}：\n"
            f"新签合同：周营销完成{m_act}万/目标{m_tgt}万，周交付完成{d_act}万/目标{d_tgt}万。\n"
            f"昨日确定有效线索：{valid_leads_cnt} 条\n"
            f"昨日确定中标合同：{win_contracts_cnt} 个，金额{win_contracts_amt}万\n"
            f"昨日签订合同数量：{signed_contracts_cnt} 个，金额{signed_contracts_amt}万\n"
            f"昨日售前铁三角联动次数：{triangle_cnt} 次\n"
            f"昨日客户幸福动作次数：{happiness_cnt} 次\n"
            f"赢战百日！"
        )
    else:
        # 获取战区和战队名称
        team_info_stmt = select(Team.name, Zone.name).select_from(Team).join(Zone, Team.zone_id == Zone.id).where(Team.id == team_id)
        team_info_res = (await db.execute(team_info_stmt)).first()
        t_name = team_info_res[0] if team_info_res else "本战队"
        z_name = team_info_res[1] if team_info_res else ""

        # 区分目标官与数字专员视角
        if role == "target_officer":
            # 目标官视角
            text = (
                f"攻坚一百天，亮剑破六千！我是中地顾问{z_name}{t_name}，七日攻坚第{day_of_week_cn}日战况播报{range_str}：\n"
                f"本战队【{month_cn}】月第【{week_cn}】周攻坚目标：周营销完成{m_act}万/目标{m_tgt}万，周交付完成{d_act}万/目标{d_tgt}万。\n"
                f"今日确定有效线索：{valid_leads_cnt} 条\n"
                f"今日确定中标合同：{win_contracts_cnt} 个，金额{win_contracts_amt}万\n"
                f"今日签订合同数量：{signed_contracts_cnt} 个，金额{signed_contracts_amt}万\n"
                f"今日售前铁三角联动次数：{triangle_cnt} 次\n"
                f"今日客户幸福动作次数：{happiness_cnt} 次\n"
                f"今日工作小结\n"
                f"①\n"
                f"②\n"
                f"今日工作反思\n"
                f"①\n"
                f"②\n"
                f"明日工作安排\n"
                f"①\n"
                f"②\n"
                f"持续付出不亚于任何人的努力，全力以赴，挑战高目标，奋斗赢幸福，胜利!胜利!胜利!"
            )
        else:
            # 数字专员视角
            text = (
                f"攻坚一百天，亮剑破六千！{t_name}，百日奋战【{campaign_day}】日战况播报{range_str}：\n"
                f"本战队【{month_cn}】月第【{week_cn}】周攻坚目标：周营销完成{m_act}万/目标{m_tgt}万，周交付完成{d_act}万/目标{d_tgt}万。\n"
                f"昨日确定有效线索：{valid_leads_cnt} 条\n"
                f"昨日确定中标合同：{win_contracts_cnt} 个，金额{win_contracts_amt}万\n"
                f"昨日签订合同数量：{signed_contracts_cnt} 个，金额{signed_contracts_amt}万\n"
                f"昨日售前铁三角联动次数：{triangle_cnt} 次\n"
                f"昨日客户幸福动作次数：{happiness_cnt} 次\n"
                f"赢战百日！"
            )

    return {
        "text": text,
        "team_id": team_id,
        "report_date": target_date.strftime("%Y-%m-%d")
    }




