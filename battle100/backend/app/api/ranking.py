"""
排名接口
提供个人排名和战队排名API
"""

from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.report import DailyReport
from app.models.organization import Team
from app.api.deps import get_current_user

router = APIRouter(prefix="/ranking", tags=["排名"])


@router.get("/personal", summary="个人排名")
async def get_personal_ranking(
    start_date: date | None = Query(None, description="开始日期"),
    end_date: date | None = Query(None, description="结束日期"),
    rank_by: str = Query("contract_amount", description="排名维度"),
    limit: int = Query(20, ge=1, le=100, description="返回数量"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取个人排名
    支持按签约金额、签约单数、幸福行动次数等维度排名
    """
    # 构建排名字段映射
    rank_field_map = {
        "contract_amount": func.coalesce(func.sum(DailyReport.contract_amount), 0),
        "contract_count": func.coalesce(func.sum(DailyReport.contract_count), 0),
        "happiness_actions": func.coalesce(func.sum(DailyReport.happiness_actions), 0),
        "triangle_count": func.coalesce(func.sum(DailyReport.triangle_count), 0),
        "leads_count": func.coalesce(func.sum(DailyReport.leads_count), 0),
    }

    rank_field = rank_field_map.get(rank_by)
    if rank_field is None:
        rank_field = rank_field_map["contract_amount"]

    query = (
        select(
            User.id,
            User.name,
            User.team_id,
            rank_field.label("total_value"),
        )
        .join(DailyReport, DailyReport.user_id == User.id)
    )

    # 日期筛选
    if start_date:
        query = query.where(DailyReport.report_date >= start_date)
    if end_date:
        query = query.where(DailyReport.report_date <= end_date)

    query = (
        query
        .group_by(User.id, User.name, User.team_id)
        .order_by(rank_field.desc())
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    ranking = []
    for idx, row in enumerate(rows, 1):
        ranking.append({
            "rank": idx,
            "user_id": row.id,
            "user_name": row.name,
            "team_id": row.team_id,
            "total_value": float(row.total_value),
        })

    return {"rank_by": rank_by, "items": ranking}


@router.get("/team", summary="战队排名")
async def get_team_ranking(
    start_date: date | None = Query(None, description="开始日期"),
    end_date: date | None = Query(None, description="结束日期"),
    rank_by: str = Query("contract_amount", description="排名维度"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取战队排名
    按战队汇总填报数据进行排名
    """
    rank_field_map = {
        "contract_amount": func.coalesce(func.sum(DailyReport.contract_amount), 0),
        "contract_count": func.coalesce(func.sum(DailyReport.contract_count), 0),
        "happiness_actions": func.coalesce(func.sum(DailyReport.happiness_actions), 0),
    }

    rank_field = rank_field_map.get(rank_by, rank_field_map["contract_amount"])

    query = (
        select(
            Team.id,
            Team.name,
            rank_field.label("total_value"),
        )
        .join(User, User.team_id == Team.id)
        .join(DailyReport, DailyReport.user_id == User.id)
    )

    if start_date:
        query = query.where(DailyReport.report_date >= start_date)
    if end_date:
        query = query.where(DailyReport.report_date <= end_date)

    query = (
        query
        .group_by(Team.id, Team.name)
        .order_by(rank_field.desc())
    )

    result = await db.execute(query)
    rows = result.all()

    ranking = []
    for idx, row in enumerate(rows, 1):
        ranking.append({
            "rank": idx,
            "team_id": row.id,
            "team_name": row.name,
            "total_value": float(row.total_value),
        })

    return {"rank_by": rank_by, "items": ranking}
