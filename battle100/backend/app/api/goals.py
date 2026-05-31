"""
目标管理接口
提供个人目标、战队目标、周度目标分解的CRUD操作及批量管理API
"""

from datetime import date, datetime
import enum
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, UserRole
from app.models.organization import Team
from app.models.goal import PersonalGoal, TeamGoal, WeeklyTarget, GoalType, TeamGoalCategory
from app.models.report import DailyReport, ReportDetail, DetailType, ReportStatus
from app.schemas.goal import (
    PersonalGoalCreate,
    PersonalGoalResponse,
    TeamGoalCreate,
    TeamGoalResponse,
    WeeklyTargetCreate,
    WeeklyTargetUpdate,
    WeeklyTargetResponse,
)
from fastapi import Request
from app.api.deps import get_current_user, require_permission
from app.services.audit_service import log_action, to_dict

# 动态权限代理拦截：依据 HTTP 请求路径与方法，智能分流到目标的细粒度权限上
def dynamic_require_roles(*roles):
    async def goals_permission_dependency(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        if current_user.role == UserRole.ADMIN:
            return current_user
            
        path = request.url.path
        method = request.method
        
        # 1. 一键清空/批量删除目标映射为 clear_targets
        if "batch-delete" in path or method == "DELETE":
            perm = "clear_targets"
        # 2. 修改保底或编辑目标映射为 manage_base_targets
        elif method in ["POST", "PUT"]:
            perm = "manage_base_targets"
        # 3. 其它读操作映射为 view_goals
        else:
            perm = "view_goals"
            
        checker = require_permission(perm)
        return await checker(current_user, db)
        
    return goals_permission_dependency

require_roles = dynamic_require_roles

router = APIRouter(prefix="/goals", tags=["目标管理"])


# ===== Pydantic 请求模型 =====

class BatchDeleteRequest(BaseModel):
    ids: List[int] = Field(..., description="要删除的ID列表")


class PersonalGoalUpdateIn(BaseModel):
    goal_type: str = Field(..., description="目标类型")
    base_target: float = Field(..., description="保底目标")
    challenge_target: float = Field(..., description="挑战目标")
    unit: Optional[str] = None
    period: Optional[str] = None
    actual_value: Optional[float] = None


class PersonalGoalCreateIn(BaseModel):
    user_id: int = Field(..., description="用户ID")
    goal_type: str = Field(..., description="目标类型")
    base_target: float = Field(..., description="保底目标")
    challenge_target: float = Field(..., description="挑战目标")
    unit: Optional[str] = None
    period: Optional[str] = None
    actual_value: Optional[float] = None


class TeamGoalUpdateIn(BaseModel):
    team_id: int = Field(..., description="战队ID")
    category: str = Field(..., description="目标类型（marketing/delivery）")
    base_target: float = Field(..., description="保底目标")
    red_line_target: float = Field(..., description="红线目标")
    gap: float = Field(..., description="目标缺口")
    original_plan: Optional[str] = None


class TeamGoalCreateIn(BaseModel):
    team_id: int = Field(..., description="战队ID")
    category: str = Field(..., description="目标类型（marketing/delivery）")
    base_target: float = Field(..., description="保底目标")
    red_line_target: float = Field(..., description="红线目标")
    gap: float = Field(..., description="目标缺口")
    original_plan: Optional[str] = None


class WeeklyTargetUpdateIn(BaseModel):
    team_id: int = Field(..., description="战队ID")
    week_number: int = Field(..., description="周次")
    week_start: date = Field(..., description="开始日期")
    week_end: date = Field(..., description="结束日期")
    marketing_base_target: float = Field(..., description="营销保底目标")
    marketing_challenge_target: float = Field(..., description="营销挑战目标")
    delivery_base_target: float = Field(..., description="交付保底目标")
    delivery_challenge_target: float = Field(..., description="交付挑战目标")
    marketing_actual: float = Field(0.0, description="营销实际完成值")
    delivery_actual: float = Field(0.0, description="交付实际完成值")


class WeeklyTargetCreateIn(BaseModel):
    team_id: int = Field(..., description="战队ID")
    week_number: int = Field(..., description="周次")
    week_start: date = Field(..., description="开始日期")
    week_end: date = Field(..., description="结束日期")
    marketing_base_target: float = Field(..., description="营销保底目标")
    marketing_challenge_target: float = Field(..., description="营销挑战目标")
    delivery_base_target: float = Field(..., description="交付保底目标")
    delivery_challenge_target: float = Field(..., description="交付挑战目标")
    marketing_actual: float = Field(0.0, description="营销实际完成值")
    delivery_actual: float = Field(0.0, description="交付实际完成值")


# ===== 内部辅助函数 =====

async def sync_team_goals_from_weekly(db: AsyncSession, team_id: int):
    """根据该战队的周度目标累加汇总，自动刷写 TeamGoal 表的营销/交付目标"""
    # 汇总营销保底和挑战
    marketing_base = await db.scalar(
        select(func.coalesce(func.sum(WeeklyTarget.marketing_base_target), 0))
        .where(WeeklyTarget.team_id == team_id)
    ) or 0.0
    marketing_challenge = await db.scalar(
        select(func.coalesce(func.sum(WeeklyTarget.marketing_challenge_target), 0))
        .where(WeeklyTarget.team_id == team_id)
    ) or 0.0
    
    # 汇总交付保底和挑战
    delivery_base = await db.scalar(
        select(func.coalesce(func.sum(WeeklyTarget.delivery_base_target), 0))
        .where(WeeklyTarget.team_id == team_id)
    ) or 0.0
    delivery_challenge = await db.scalar(
        select(func.coalesce(func.sum(WeeklyTarget.delivery_challenge_target), 0))
        .where(WeeklyTarget.team_id == team_id)
    ) or 0.0
    
    # 更新/创建 营销 TeamGoal
    g_m_res = await db.execute(
        select(TeamGoal).where(
            TeamGoal.team_id == team_id,
            TeamGoal.category == TeamGoalCategory.MARKETING
        )
    )
    g_m = g_m_res.scalar_one_or_none()
    if not g_m:
        g_m = TeamGoal(team_id=team_id, category=TeamGoalCategory.MARKETING)
    g_m.base_target = marketing_base
    g_m.red_line_target = marketing_challenge
    g_m.gap = max(0.0, marketing_challenge - marketing_base)
    db.add(g_m)
    
    # 更新/创建 交付 TeamGoal
    g_d_res = await db.execute(
        select(TeamGoal).where(
            TeamGoal.team_id == team_id,
            TeamGoal.category == TeamGoalCategory.DELIVERY
        )
    )
    g_d = g_d_res.scalar_one_or_none()
    if not g_d:
        g_d = TeamGoal(team_id=team_id, category=TeamGoalCategory.DELIVERY)
    g_d.base_target = delivery_base
    g_d.red_line_target = delivery_challenge
    g_d.gap = max(0.0, delivery_challenge - delivery_base)
    db.add(g_d)
    
    await db.flush()


async def fetch_users_system_actual_values(db: AsyncSession, user_ids: List[int]) -> dict:
    """
    批量计算一组用户的 8 个指标的系统实际完成值。
    返回格式：{user_id: {goal_type_str: actual_value}}
    """
    if not user_ids:
        return {}
    
    # 初始化结果字典，将 8 项指标值初始化为 0.0
    result = {uid: {gt.value: 0.0 for gt in GoalType} for uid in user_ids}
    
    # 1. 聚合幸福行动、铁三角拜访、线索数量、新签合同单数
    stmt_reports = select(
        DailyReport.user_id,
        func.sum(DailyReport.happiness_actions).label("happiness_actions"),
        func.sum(DailyReport.triangle_count).label("triangle_count"),
        func.sum(DailyReport.leads_count).label("leads_count"),
        func.sum(DailyReport.contract_count).label("contract_count")
    ).where(
        DailyReport.user_id.in_(user_ids),
        DailyReport.status == ReportStatus.REVIEWED
    ).group_by(DailyReport.user_id)
    
    res_reports = await db.execute(stmt_reports)
    for row in res_reports.all():
        uid = row.user_id
        result[uid][GoalType.HAPPINESS_ACTION.value] = float(row.happiness_actions or 0.0)
        result[uid][GoalType.TRIANGLE_COUNT.value] = float(row.triangle_count or 0.0)
        result[uid][GoalType.LEADS_COUNT.value] = float(row.leads_count or 0.0)
        result[uid][GoalType.CONTRACT_COUNT.value] = float(row.contract_count or 0.0)
        
    # 2. 聚合新签/续签合同额 (包含填报人和协同人)
    stmt_details = select(
        DailyReport.user_id.label("creator_id"),
        ReportDetail.partner_user_id,
        ReportDetail.amount
    ).join(DailyReport, ReportDetail.report_id == DailyReport.id).where(
        DailyReport.status == ReportStatus.REVIEWED,
        ReportDetail.detail_type == DetailType.CONTRACT,
        (DailyReport.user_id.in_(user_ids) | ReportDetail.partner_user_id.in_(user_ids))
    )
    
    res_details = await db.execute(stmt_details)
    for row in res_details.all():
        # 累加给填报人
        creator = row.creator_id
        if creator in result:
            result[creator][GoalType.CONTRACT_AMOUNT.value] += float(row.amount or 0.0)
        # 累加给协同人
        partner = row.partner_user_id
        if partner and partner in result:
            result[partner][GoalType.CONTRACT_AMOUNT.value] += float(row.amount or 0.0)
            
    # 3. 聚合新客户数 (去重客户名)
    stmt_customers = select(
        DailyReport.user_id,
        ReportDetail.customer_name
    ).join(DailyReport, ReportDetail.report_id == DailyReport.id).where(
        DailyReport.status == ReportStatus.REVIEWED,
        ReportDetail.detail_type == DetailType.CONTRACT,
        DailyReport.user_id.in_(user_ids)
    ).distinct()
    
    res_customers = await db.execute(stmt_customers)
    # 内存去重计数
    user_customers = {uid: set() for uid in user_ids}
    for row in res_customers.all():
        uid = row.user_id
        if uid in user_customers and row.customer_name:
            user_customers[uid].add(row.customer_name)
    for uid, cust_set in user_customers.items():
        result[uid][GoalType.NEW_CUSTOMER_COUNT.value] = float(len(cust_set))
        
    # 4. 聚合客户幸福故事数 (说明不为空的幸福填报明细数)
    stmt_stories = select(
        DailyReport.user_id,
        func.count(ReportDetail.id).label("story_count")
    ).join(DailyReport, ReportDetail.report_id == DailyReport.id).where(
        DailyReport.status == ReportStatus.REVIEWED,
        ReportDetail.detail_type == DetailType.HAPPINESS,
        ReportDetail.description != None,
        ReportDetail.description != '',
        DailyReport.user_id.in_(user_ids)
    ).group_by(DailyReport.user_id)
    
    res_stories = await db.execute(stmt_stories)
    for row in res_stories.all():
        uid = row.user_id
        result[uid][GoalType.HAPPINESS_STORY_COUNT.value] = float(row.story_count or 0.0)
        
    # 5. 计算线索转化率 (合同单数 / 线索数量 * 100)
    for uid in user_ids:
        l_count = result[uid][GoalType.LEADS_COUNT.value]
        c_count = result[uid][GoalType.CONTRACT_COUNT.value]
        result[uid][GoalType.LEADS_CONVERSION_RATE.value] = round((c_count / l_count * 100), 2) if l_count > 0 else 0.0
        
    return result


# ===== 1. 个人目标 (PersonalGoal) =====

@router.get("/personal", response_model=list[PersonalGoalResponse], summary="获取个人目标列表(老接口兼容)")
async def list_personal_goals(
    user_id: int | None = Query(None, description="用户ID，不传则获取当前用户"),
    period: str | None = Query(None, description="目标周期"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取个人目标列表（向后兼容）"""
    target_user_id = user_id or current_user.id
    query = select(PersonalGoal).where(PersonalGoal.user_id == target_user_id)

    if period:
        query = query.where(PersonalGoal.period == period)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/personal", response_model=PersonalGoalResponse, status_code=201, summary="创建个人目标(老接口兼容)")
async def create_personal_goal(
    goal_in: PersonalGoalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建个人目标（向后兼容）"""
    goal = PersonalGoal(
        user_id=current_user.id,
        goal_type=goal_in.goal_type,
        base_target=goal_in.base_target,
        challenge_target=goal_in.challenge_target,
        unit=goal_in.unit,
        period=goal_in.period,
    )
    db.add(goal)
    await db.flush()
    await db.refresh(goal)
    return goal


# ----- 以下为管理后台新添 CRUD 接口 -----

@router.get("/personal/list", summary="分页与搜索查询所有个人奋斗目标")
async def list_personal_goals_paginated(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1),
    keyword: str | None = Query(None, description="搜索用户名或手机号"),
    goal_type: str | None = Query(None, description="目标类型"),
    team_id: int | None = Query(None, description="归属战队ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)),
):
    # 构建基础查询，拼装 User 信息及战队信息
    stmt = select(PersonalGoal, User).join(User, PersonalGoal.user_id == User.id)
    
    # 统计总量的查询
    count_stmt = select(func.count(PersonalGoal.id)).join(User, PersonalGoal.user_id == User.id)
    
    if keyword:
        keyword_filter = or_(User.name.contains(keyword), User.phone.contains(keyword))
        stmt = stmt.where(keyword_filter)
        count_stmt = count_stmt.where(keyword_filter)
        
    if goal_type:
        stmt = stmt.where(PersonalGoal.goal_type == goal_type)
        count_stmt = count_stmt.where(PersonalGoal.goal_type == goal_type)
        
    if team_id:
        stmt = stmt.where(User.team_id == team_id)
        count_stmt = count_stmt.where(User.team_id == team_id)

    # 排序与分页
    stmt = stmt.order_by(PersonalGoal.id.desc()).offset((page - 1) * page_size).limit(page_size)
    
    # 执行查询
    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0
    
    results = await db.execute(stmt)
    rows = results.all()
    
    # 转换战队名称
    team_res = await db.execute(select(Team))
    team_map = {t.id: t.name for t in team_res.scalars().all()}
    
    user_ids = list(set(g.user_id for g, u in rows))
    system_actuals = await fetch_users_system_actual_values(db, user_ids)

    items = []
    for goal, user in rows:
        user_sys_vals = system_actuals.get(goal.user_id, {})
        sys_val = user_sys_vals.get(goal.goal_type.value if hasattr(goal.goal_type, 'value') else goal.goal_type, 0.0)
        final_actual = goal.actual_value if goal.actual_value is not None else sys_val

        items.append({
            "id": goal.id,
            "user_id": goal.user_id,
            "user_name": user.name,
            "user_phone": user.phone,
            "team_name": team_map.get(user.team_id, "未分配") if user.team_id else "未分配",
            "team_id": user.team_id,
            "position": user.position,
            "position_type": user.position_type,
            "goal_type": goal.goal_type.value if hasattr(goal.goal_type, 'value') else goal.goal_type,
            "base_target": goal.base_target,
            "challenge_target": goal.challenge_target,
            "unit": goal.unit,
            "period": goal.period,
            "actual_value": goal.actual_value,
            "system_value": sys_val,
            "actual": final_actual,
            "created_at": goal.created_at,
            "updated_at": goal.updated_at
        })
        
    return {"total": total, "items": items}


@router.post("/personal/create-direct", status_code=201, summary="直接为指定用户创建个人目标")
async def create_personal_goal_direct(
    goal_in: PersonalGoalCreateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)),
):
    # 确认用户是否存在
    user_res = await db.execute(select(User).where(User.id == goal_in.user_id))
    if not user_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="指定的用户不存在")
        
    goal = PersonalGoal(
        user_id=goal_in.user_id,
        goal_type=goal_in.goal_type,
        base_target=goal_in.base_target,
        challenge_target=goal_in.challenge_target,
        unit=goal_in.unit,
        period=goal_in.period,
    )
    db.add(goal)
    await db.flush()
    await db.refresh(goal)

    # 记录操作审计日志
    await log_action(
        db, current_user, "CREATE", "personal_goal", str(goal.id),
        f"创建了个人目标，用户ID: {goal.user_id}, 目标类型: {goal.goal_type}",
        before_state=None,
        after_state=to_dict(goal)
    )

    return {"code": 200, "message": "创建个人目标成功", "id": goal.id}


@router.put("/personal/{goal_id}", summary="修改指定个人目标")
async def update_personal_goal(
    goal_id: int,
    goal_in: PersonalGoalUpdateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER, UserRole.DIGITAL_SPECIALIST)),
):
    goal_res = await db.execute(select(PersonalGoal).where(PersonalGoal.id == goal_id))
    goal = goal_res.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="目标未找到")
        
    before_state = to_dict(goal)
        
    goal.goal_type = goal_in.goal_type
    goal.base_target = goal_in.base_target
    goal.challenge_target = goal_in.challenge_target
    goal.unit = goal_in.unit
    goal.period = goal_in.period
    goal.actual_value = goal_in.actual_value
    
    db.add(goal)
    await db.flush()
    await db.refresh(goal)

    # 记录操作审计日志
    await log_action(
        db, current_user, "UPDATE", "personal_goal", str(goal_id),
        f"修改了个人目标，用户ID: {goal.user_id}, 目标类型: {goal.goal_type}",
        before_state=before_state,
        after_state=to_dict(goal)
    )

    return {"code": 200, "message": "修改成功"}


@router.delete("/personal/{goal_id}", summary="删除指定个人目标")
async def delete_personal_goal(
    goal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)),
):
    goal_res = await db.execute(select(PersonalGoal).where(PersonalGoal.id == goal_id))
    goal = goal_res.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="目标未找到")
        
    before_state = to_dict(goal)

    await db.delete(goal)
    await db.flush()

    await log_action(
        db, current_user, "DELETE", "personal_goal", str(goal_id),
        f"删除了个人目标，用户ID: {goal.user_id}, 目标类型: {goal.goal_type}",
        before_state=before_state,
        after_state=None
    )

    return {"code": 200, "message": "删除成功"}


@router.post("/personal/batch-delete", summary="批量删除个人目标")
async def batch_delete_personal_goals(
    req: BatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)),
):
    if not req.ids:
        return {"code": 200, "message": "未选中任何记录"}
        
    # 0. 备份原数据状态
    goals_res = await db.execute(select(PersonalGoal).where(PersonalGoal.id.in_(req.ids)))
    goals = goals_res.scalars().all()
    before_state = [to_dict(g) for g in goals]

    for gid in req.ids:
        goal_res = await db.execute(select(PersonalGoal).where(PersonalGoal.id == gid))
        goal = goal_res.scalar_one_or_none()
        if goal:
            await db.delete(goal)
            
    await db.flush()

    await log_action(
        db, current_user, "DELETE", "personal_goal", ",".join(map(str, req.ids)),
        f"批量清空/删除了 {len(before_state)} 条个人目标记录",
        before_state=before_state,
        after_state=None
    )

    return {"code": 200, "message": f"成功批量删除 {len(req.ids)} 条个人目标记录"}


class PersonalRecordUpdate(BaseModel):
    user_id: int
    goal_type: str
    base_target: float
    challenge_target: float
    unit: Optional[str] = None
    period: Optional[str] = None
    actual_value: Optional[float] = None


@router.post("/personal/batch-update-user-goals", summary="批量创建或更新某个员工的多维度奋斗目标")
async def batch_update_user_goals(
    records: List[PersonalRecordUpdate],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER, UserRole.DIGITAL_SPECIALIST)),
):
    """批量修改或新建某个用户下的多个目标指标值"""
    if not records:
        return {"code": 200, "message": "没有需要修改的数据"}
        
    target_user_ids = list(set(r.user_id for r in records))
    
    # 0. 备份更新前的目标数据
    old_goals_res = await db.execute(select(PersonalGoal).where(PersonalGoal.user_id.in_(target_user_ids)))
    old_goals = old_goals_res.scalars().all()
    before_state = [to_dict(g) for g in old_goals]

    for r in records:
        pg_res = await db.execute(
            select(PersonalGoal).where(
                PersonalGoal.user_id == r.user_id,
                PersonalGoal.goal_type == r.goal_type
            )
        )
        pg = pg_res.scalar_one_or_none()
        if not pg:
            pg = PersonalGoal(
                user_id=r.user_id,
                goal_type=r.goal_type
            )
        pg.base_target = r.base_target
        pg.challenge_target = r.challenge_target
        if r.unit is not None:
            pg.unit = r.unit
        if r.period is not None:
            pg.period = r.period
        pg.actual_value = r.actual_value
        db.add(pg)
        
    await db.flush()

    # 1. 备份更新后的目标数据
    new_goals_res = await db.execute(select(PersonalGoal).where(PersonalGoal.user_id.in_(target_user_ids)))
    new_goals = new_goals_res.scalars().all()
    after_state = [to_dict(g) for g in new_goals]

    await log_action(
        db, current_user, "UPDATE", "personal_goal", ",".join(map(str, target_user_ids)),
        f"批量创建或更新了员工【IDs:{target_user_ids}】的个人多维目标",
        before_state=before_state,
        after_state=after_state
    )
    await db.commit()
    return {"code": 200, "message": "批量保存个人多维目标成功"}


# ===== 2. 战队目标 (TeamGoal) =====

@router.get("/team", response_model=list[TeamGoalResponse], summary="获取战队目标列表(老接口兼容)")
async def list_team_goals(
    team_id: int | None = Query(None, description="战队ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取战队目标列表（老接口兼容）"""
    query = select(TeamGoal)
    if team_id:
        query = query.where(TeamGoal.team_id == team_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/team", response_model=TeamGoalResponse, status_code=201, summary="创建战队目标(老接口兼容)")
async def create_team_goal(
    goal_in: TeamGoalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)
    ),
):
    """创建战队目标（老接口兼容）"""
    goal = TeamGoal(
        team_id=goal_in.team_id,
        category=goal_in.category,
        base_target=goal_in.base_target,
        red_line_target=goal_in.red_line_target,
        gap=goal_in.gap,
        original_plan=goal_in.original_plan,
    )
    db.add(goal)
    await db.flush()
    await db.refresh(goal)
    return goal


# ----- 以下为管理后台新添 CRUD 接口 -----

@router.get("/team/list", summary="分页查询所有战队奋斗目标")
async def list_team_goals_paginated(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1),
    team_id: int | None = Query(None, description="战队ID"),
    category: str | None = Query(None, description="类别"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)),
):
    stmt = select(TeamGoal, Team).join(Team, TeamGoal.team_id == Team.id)
    count_stmt = select(func.count(TeamGoal.id)).join(Team, TeamGoal.team_id == Team.id)
    
    if team_id:
        stmt = stmt.where(TeamGoal.team_id == team_id)
        count_stmt = count_stmt.where(TeamGoal.team_id == team_id)
        
    if category:
        stmt = stmt.where(TeamGoal.category == category)
        count_stmt = count_stmt.where(TeamGoal.category == category)

    stmt = stmt.order_by(TeamGoal.id.desc()).offset((page - 1) * page_size).limit(page_size)
    
    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0
    
    results = await db.execute(stmt)
    rows = results.all()
    
    items = []
    for goal, team in rows:
        items.append({
            "id": goal.id,
            "team_id": goal.team_id,
            "team_name": team.name,
            "category": goal.category,
            "base_target": goal.base_target,
            "red_line_target": goal.red_line_target,
            "gap": goal.gap,
            "original_plan": goal.original_plan,
            "created_at": goal.created_at,
            "updated_at": goal.updated_at
        })
        
    return {"total": total, "items": items}


@router.post("/team/create-direct", status_code=201, summary="创建战队总目标")
async def create_team_goal_direct(
    goal_in: TeamGoalCreateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)),
):
    goal = TeamGoal(
        team_id=goal_in.team_id,
        category=goal_in.category,
        base_target=goal_in.base_target,
        red_line_target=goal_in.red_line_target,
        gap=goal_in.gap,
        original_plan=goal_in.original_plan
    )
    db.add(goal)
    await db.flush()

    await log_action(
        db, current_user, "CREATE", "team_goal", str(goal.id),
        f"创建了战队【ID:{goal.team_id}】的{goal.category}总目标",
        before_state=None,
        after_state=to_dict(goal)
    )

    return {"code": 200, "message": "创建战队总目标成功", "id": goal.id}


@router.put("/team/{goal_id}", summary="修改指定战队目标")
async def update_team_goal_direct(
    goal_id: int,
    goal_in: TeamGoalUpdateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)),
):
    goal_res = await db.execute(select(TeamGoal).where(TeamGoal.id == goal_id))
    goal = goal_res.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="目标未找到")
        
    before_state = to_dict(goal)

    goal.team_id = goal_in.team_id
    goal.category = goal_in.category
    goal.base_target = goal_in.base_target
    goal.red_line_target = goal_in.red_line_target
    goal.gap = goal_in.gap
    goal.original_plan = goal_in.original_plan
    
    db.add(goal)
    await db.flush()

    await log_action(
        db, current_user, "UPDATE", "team_goal", str(goal_id),
        f"编辑了战队【ID:{goal.team_id}】的战队目标",
        before_state=before_state,
        after_state=to_dict(goal)
    )

    return {"code": 200, "message": "修改成功"}


@router.delete("/team/{goal_id}", summary="删除指定战队目标")
async def delete_team_goal(
    goal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)),
):
    goal_res = await db.execute(select(TeamGoal).where(TeamGoal.id == goal_id))
    goal = goal_res.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="目标未找到")
        
    before_state = to_dict(goal)

    await db.delete(goal)
    await db.flush()

    await log_action(
        db, current_user, "DELETE", "team_goal", str(goal_id),
        f"删除了战队【ID:{goal.team_id}】的战队目标",
        before_state=before_state,
        after_state=None
    )

    return {"code": 200, "message": "删除成功"}


@router.post("/team/batch-delete", summary="批量删除战队目标")
async def batch_delete_team_goals(
    req: BatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)),
):
    if not req.ids:
        return {"code": 200, "message": "未选中任何记录"}
        
    goals_res = await db.execute(select(TeamGoal).where(TeamGoal.id.in_(req.ids)))
    goals = goals_res.scalars().all()
    before_state = [to_dict(g) for g in goals]

    for gid in req.ids:
        goal_res = await db.execute(select(TeamGoal).where(TeamGoal.id == gid))
        goal = goal_res.scalar_one_or_none()
        if goal:
            await db.delete(goal)
            
    await db.flush()

    await log_action(
        db, current_user, "DELETE", "team_goal", ",".join(map(str, req.ids)),
        f"批量删除了 {len(before_state)} 条战队目标记录",
        before_state=before_state,
        after_state=None
    )

    return {"code": 200, "message": f"成功批量删除 {len(req.ids)} 条战队目标记录"}


# ===== 3. 周度目标 (WeeklyTarget) =====

@router.get("/weekly", response_model=list[WeeklyTargetResponse], summary="获取周度目标列表(老接口兼容)")
async def list_weekly_targets(
    team_id: int | None = Query(None, description="战队ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取周度目标分解列表（老接口兼容）"""
    query = select(WeeklyTarget).order_by(WeeklyTarget.week_number)
    if team_id:
        query = query.where(WeeklyTarget.team_id == team_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/weekly", response_model=WeeklyTargetResponse, status_code=201, summary="创建周度目标(老接口兼容)")
async def create_weekly_target(
    target_in: WeeklyTargetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)
    ),
):
    """创建周度目标分解（并同步计算 TeamGoal，老接口兼容）"""
    target = WeeklyTarget(
        team_id=target_in.team_id,
        week_number=target_in.week_number,
        week_start=target_in.week_start,
        week_end=target_in.week_end,
        marketing_target=target_in.marketing_target,
        delivery_target=target_in.delivery_target,
        marketing_base_target=target_in.marketing_target, # 兼容老接口
        marketing_challenge_target=target_in.marketing_target,
        delivery_base_target=target_in.delivery_target,
        delivery_challenge_target=target_in.delivery_target
    )
    db.add(target)
    await db.flush()
    
    # 重新聚合刷写 TeamGoal
    await sync_team_goals_from_weekly(db, target.team_id)
    await db.refresh(target)
    return target


@router.put("/weekly/{target_id}", response_model=WeeklyTargetResponse, summary="更新周度实际值(老接口兼容)")
async def update_weekly_target(
    target_id: int,
    target_in: WeeklyTargetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER, UserRole.DIGITAL_SPECIALIST)
    ),
):
    """更新周度目标的实际完成值（老接口兼容）"""
    result = await db.execute(
        select(WeeklyTarget).where(WeeklyTarget.id == target_id)
    )
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="周度目标不存在")

    update_data = target_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(target, field, value)

    db.add(target)
    await db.flush()
    await db.refresh(target)
    return target


# ----- 以下为管理后台新添 CRUD 接口 -----

@router.get("/weekly/list", summary="分页查询所有周度分解目标")
async def list_weekly_targets_paginated(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1),
    team_id: int | None = Query(None, description="战队ID"),
    week_number: int | None = Query(None, description="周次"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)),
):
    stmt = select(WeeklyTarget, Team).join(Team, WeeklyTarget.team_id == Team.id)
    count_stmt = select(func.count(WeeklyTarget.id)).join(Team, WeeklyTarget.team_id == Team.id)
    
    if team_id:
        stmt = stmt.where(WeeklyTarget.team_id == team_id)
        count_stmt = count_stmt.where(WeeklyTarget.team_id == team_id)
        
    if week_number:
        stmt = stmt.where(WeeklyTarget.week_number == week_number)
        count_stmt = count_stmt.where(WeeklyTarget.week_number == week_number)

    stmt = stmt.order_by(WeeklyTarget.week_number.asc(), WeeklyTarget.id.desc()).offset((page - 1) * page_size).limit(page_size)
    
    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0
    
    results = await db.execute(stmt)
    rows = results.all()
    
    items = []
    for wt, team in rows:
        items.append({
            "id": wt.id,
            "team_id": wt.team_id,
            "team_name": team.name,
            "week_number": wt.week_number,
            "week_start": wt.week_start,
            "week_end": wt.week_end,
            "marketing_base_target": wt.marketing_base_target,
            "marketing_challenge_target": wt.marketing_challenge_target,
            "delivery_base_target": wt.delivery_base_target,
            "delivery_challenge_target": wt.delivery_challenge_target,
            "marketing_actual": wt.marketing_actual,
            "delivery_actual": wt.delivery_actual,
            "created_at": wt.created_at,
            "updated_at": wt.updated_at
        })
        
    return {"total": total, "items": items}


@router.post("/weekly/create-direct", status_code=201, summary="新建周度目标")
async def create_weekly_target_direct(
    target_in: WeeklyTargetCreateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)),
):
    target = WeeklyTarget(
        team_id=target_in.team_id,
        week_number=target_in.week_number,
        week_start=target_in.week_start,
        week_end=target_in.week_end,
        marketing_base_target=target_in.marketing_base_target,
        marketing_challenge_target=target_in.marketing_challenge_target,
        delivery_base_target=target_in.delivery_base_target,
        delivery_challenge_target=target_in.delivery_challenge_target,
        marketing_actual=target_in.marketing_actual,
        delivery_actual=target_in.delivery_actual
    )
    db.add(target)
    await db.flush()
    await db.refresh(target)
    
    # 重新聚合更新该战队总目标
    await sync_team_goals_from_weekly(db, target.team_id)

    # 记录操作审计日志
    await log_action(
        db, current_user, "CREATE", "weekly_target", str(target.id),
        f"新建了战队【ID:{target.team_id}】第 {target.week_number} 周分解目标",
        before_state=None,
        after_state=to_dict(target)
    )

    return {"code": 200, "message": "新建周目标成功", "id": target.id}


@router.put("/weekly-detail/{target_id}", summary="修改指定周度分解目标")
async def update_weekly_target_detail(
    target_id: int,
    target_in: WeeklyTargetUpdateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER, UserRole.DIGITAL_SPECIALIST)),
):
    wt_res = await db.execute(select(WeeklyTarget).where(WeeklyTarget.id == target_id))
    wt = wt_res.scalar_one_or_none()
    if not wt:
        raise HTTPException(status_code=404, detail="未找到周分解记录")
        
    before_state = to_dict(wt)
    old_team_id = wt.team_id
    
    wt.team_id = target_in.team_id
    wt.week_number = target_in.week_number
    wt.week_start = target_in.week_start
    wt.week_end = target_in.week_end
    wt.marketing_base_target = target_in.marketing_base_target
    wt.marketing_challenge_target = target_in.marketing_challenge_target
    wt.delivery_base_target = target_in.delivery_base_target
    wt.delivery_challenge_target = target_in.delivery_challenge_target
    wt.marketing_actual = target_in.marketing_actual
    wt.delivery_actual = target_in.delivery_actual
    
    db.add(wt)
    await db.flush()
    await db.refresh(wt)
    
    # 重新更新老战队与新战队的 TeamGoal
    await sync_team_goals_from_weekly(db, old_team_id)
    if old_team_id != wt.team_id:
        await sync_team_goals_from_weekly(db, wt.team_id)
        
    # 记录操作审计日志
    await log_action(
        db, current_user, "UPDATE", "weekly_target", str(target_id),
        f"修改了战队【ID:{wt.team_id}】第 {wt.week_number} 周分解目标",
        before_state=before_state,
        after_state=to_dict(wt)
    )

    return {"code": 200, "message": "更新周目标成功"}


@router.delete("/weekly-detail/{target_id}", summary="删除指定周分解目标")
async def delete_weekly_target_detail(
    target_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)),
):
    wt_res = await db.execute(select(WeeklyTarget).where(WeeklyTarget.id == target_id))
    wt = wt_res.scalar_one_or_none()
    if not wt:
        raise HTTPException(status_code=404, detail="未找到周分解记录")
        
    before_state = to_dict(wt)
    team_id = wt.team_id
    await db.delete(wt)
    await db.flush()
    
    # 重新聚合 TeamGoal
    await sync_team_goals_from_weekly(db, team_id)

    # 记录操作审计日志
    await log_action(
        db, current_user, "DELETE", "weekly_target", str(target_id),
        f"删除了战队【ID:{wt.team_id}】第 {wt.week_number} 周分解目标",
        before_state=before_state,
        after_state=None
    )
    return {"code": 200, "message": "删除周目标成功"}


@router.post("/weekly/batch-delete", summary="批量删除周分解目标")
async def batch_delete_weekly_targets(
    req: BatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)),
):
    if not req.ids:
        return {"code": 200, "message": "未选中任何记录"}
        
    # 0. 备份原记录状态
    wts_res = await db.execute(select(WeeklyTarget).where(WeeklyTarget.id.in_(req.ids)))
    wts = wts_res.scalars().all()
    before_state = [to_dict(w) for w in wts]

    affected_teams = set()
    for gid in req.ids:
        wt_res = await db.execute(select(WeeklyTarget).where(WeeklyTarget.id == gid))
        wt = wt_res.scalar_one_or_none()
        if wt:
            affected_teams.add(wt.team_id)
            await db.delete(wt)
            
    await db.flush()
    
    # 对所有受影响的战队重新计算
    for tid in affected_teams:
        await sync_team_goals_from_weekly(db, tid)
        
    await log_action(
        db, current_user, "DELETE", "weekly_target", ",".join(map(str, req.ids)),
        f"批量清空/删除了 {len(before_state)} 条周度目标分解记录",
        before_state=before_state,
        after_state=None
    )

    return {"code": 200, "message": f"成功批量删除 {len(req.ids)} 条周分解记录，已重新聚合受影响战队的目标值"}


class WeeklyRecordUpdate(BaseModel):
    id: int
    marketing_base_target: float
    marketing_challenge_target: float
    delivery_base_target: float
    delivery_challenge_target: float


@router.post("/weekly/batch-update-records", summary="批量更新周分解目标的数值")
async def batch_update_weekly_records(
    records: List[WeeklyRecordUpdate],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER, UserRole.DIGITAL_SPECIALIST)),
):
    """批量修改多个周分解记录的值，并联动更新受影响战队的目标值"""
    if not records:
        return {"code": 200, "message": "没有需要修改的数据"}
        
    record_ids = [r.id for r in records]

    # 0. 备份修改前的周记录
    old_wts_res = await db.execute(select(WeeklyTarget).where(WeeklyTarget.id.in_(record_ids)))
    old_wts = old_wts_res.scalars().all()
    before_state = [to_dict(w) for w in old_wts]

    affected_teams = set()
    for r in records:
        wt_res = await db.execute(select(WeeklyTarget).where(WeeklyTarget.id == r.id))
        wt = wt_res.scalar_one_or_none()
        if wt:
            wt.marketing_base_target = r.marketing_base_target
            wt.marketing_challenge_target = r.marketing_challenge_target
            wt.delivery_base_target = r.delivery_base_target
            wt.delivery_challenge_target = r.delivery_challenge_target
            affected_teams.add(wt.team_id)
            db.add(wt)
            
    await db.flush()
    
    # 重新触发级联汇总
    for tid in affected_teams:
        await sync_team_goals_from_weekly(db, tid)
        
    # 1. 备份修改后的周记录
    new_wts_res = await db.execute(select(WeeklyTarget).where(WeeklyTarget.id.in_(record_ids)))
    new_wts = new_wts_res.scalars().all()
    after_state = [to_dict(w) for w in new_wts]

    await log_action(
        db, current_user, "UPDATE", "weekly_target", ",".join(map(str, record_ids)),
        f"批量更新了 {len(records)} 条周分解记录的目标值",
        before_state=before_state,
        after_state=after_state
    )

    await db.commit()
    return {"code": 200, "message": "批量修改成功，战队总目标额已自动重算并刷新！"}

