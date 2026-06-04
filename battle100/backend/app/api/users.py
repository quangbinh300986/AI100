"""
用户管理接口
提供用户的CRUD操作API
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from app.models.organization import Team

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
    BatchDeleteRequest,
    BatchAssignTeamRequest,
    BatchAssignRoleRequest,
    BatchAssignPositionTypeRequest,
)
from app.services.auth_service import hash_password
from fastapi import Request
from app.api.deps import get_current_user, require_permission
from app.services.audit_service import log_action, to_dict

# 将本文件内所有的 require_roles 拦截器重映射到 settings 相关的动态权限校验上，实现精细化数据库动态控制
def dynamic_require_roles(*roles):
    async def users_permission_dependency(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        if current_user.role == UserRole.ADMIN:
            return current_user
            
        path = request.url.path
        
        # 1. 角色权限映射自身的修改与保存，归属于 manage_role_permissions 权限
        if "role-permissions" in path:
            perm = "manage_role_permissions"
        # 2. 其它（如用户管理批量分配角色/战队/岗位，用户创建和删除）归属于 manage_user_roles 权限
        else:
            perm = "manage_user_roles"
            
        checker = require_permission(perm)
        return await checker(current_user, db)
        
    return users_permission_dependency

require_roles = dynamic_require_roles

router = APIRouter(prefix="/users", tags=["用户管理"])


@router.get("", response_model=UserListResponse, summary="获取用户列表")
async def list_users(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=2000, description="每页数量"),
    team_id: int | None = Query(None, description="按战队筛选"),
    role: str | None = Query(None, description="按角色筛选"),
    position_type: str | None = Query(None, description="按岗位类别筛选"),
    third_class_bar: str | None = Query(None, description="按三级巴筛选"),
    keyword: str | None = Query(None, description="搜索关键词（姓名/手机号）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取用户列表，支持分页和筛选
    """
    # 构建筛选条件列表（count 和主查询共用）
    conditions = [User.is_active == True]
    if team_id is not None:
        if team_id == 0:
            conditions.append(User.team_id.is_(None))
        else:
            conditions.append(User.team_id == team_id)
    if role is not None:
        conditions.append(User.role == role)
    if position_type is not None:
        conditions.append(User.position_type == position_type)
    if third_class_bar is not None:
        conditions.append(User.third_class_bar == third_class_bar)
    if keyword:
        conditions.append(
            (User.name.contains(keyword)) | (User.phone.contains(keyword))
        )

    # 计算总数（基于 User 表，不 JOIN Team）
    count_query = select(func.count()).select_from(User)
    for cond in conditions:
        count_query = count_query.where(cond)
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # 主查询：JOIN Team 获取战队名称
    query = select(User, Team.name.label("team_name")).outerjoin(
        Team, User.team_id == Team.id
    )
    for cond in conditions:
        query = query.where(cond)
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    rows = result.all()

    # 将 team_name 动态附加 to User 对象上
    users = []
    for row in rows:
        user = row[0]
        user.team_name = row[1]  # 动态添加 team_name
        users.append(user)

    return UserListResponse(total=total, items=users)


@router.get("/third-class-bars", response_model=list[str], summary="获取所有去重后的三级巴列表")
async def list_third_class_bars(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取所有去重后的三级巴列表（仅返回激活且不为空的值）
    """
    result = await db.execute(
        select(User.third_class_bar)
        .where(
            User.is_active == True,
            User.third_class_bar.is_not(None),
            User.third_class_bar != ""
        )
        .distinct()
    )
    bars = result.scalars().all()
    # 过滤掉 None 或空字符串的健壮性处理
    return [b for b in bars if b]


from app.models.user import RolePermission

from pydantic import BaseModel as PydanticBaseModel
from typing import Dict, List

class RolePermissionsUpdateRequest(PydanticBaseModel):
    permissions: Dict[str, List[str]]

@router.get("/role-permissions", summary="获取所有角色的权限配置")
async def get_role_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """获取所有角色的权限配置列表映射"""
    result = await db.execute(select(RolePermission))
    rows = result.scalars().all()
    
    perms_map = {
        "admin": [],
        "target_officer": [],
        "digital_specialist": [],
        "team_leader": [],
        "staff": [],
        "marketing_staff": [],
        "tech_marketing": []
    }
    
    for row in rows:
        if row.role in perms_map:
            perms_map[row.role].append(row.menu_key)
            
    return perms_map

@router.post("/role-permissions", summary="保存所有角色的权限配置")
async def update_role_permissions(
    payload: RolePermissionsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """批量保存并更新所有角色的权限配置列表。执行删除重置操作。"""
    # 0. 记录原配置状态
    old_perms_res = await db.execute(select(RolePermission))
    old_perms = old_perms_res.scalars().all()
    old_map = {}
    for p in old_perms:
        old_map.setdefault(p.role, []).append(p.menu_key)

    # 1. 物理清空已有配置
    await db.execute(delete(RolePermission))
    
    # 2. 写入新配置
    new_perms = []
    valid_roles = ["admin", "target_officer", "digital_specialist", "team_leader", "staff", "marketing_staff", "tech_marketing"]
    valid_keys = [
        "view_dashboard", "drilldown_leads",
        "view_reports", "approve_report", "reject_report",
        "view_goals", "manage_base_targets", "import_weekly_targets", "clear_targets",
        "view_settings", "manage_role_permissions", "manage_user_roles"
    ]
    
    for role, menu_keys in payload.permissions.items():
        if role in valid_roles:
            for key in menu_keys:
                if key in valid_keys:
                    new_perms.append(RolePermission(role=role, menu_key=key))
                    
    db.add_all(new_perms)
    await db.flush()

    # 3. 记录新配置状态
    new_map = {}
    for p in new_perms:
        new_map.setdefault(p.role, []).append(p.menu_key)

    await log_action(
        db, current_user, "UPDATE", "role_permission", "all",
        "更新了系统角色与细粒度菜单/操作权限的配置",
        before_state=old_map,
        after_state=new_map
    )

    return {"message": "权限配置更新成功"}


@router.get("/{user_id}", response_model=UserResponse, summary="获取用户详情")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取指定用户的详细信息"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.post("", response_model=UserResponse, status_code=201, summary="创建用户")
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """
    创建新用户（仅管理员可用）
    """
    # 检查手机号是否已存在
    existing = await db.execute(
        select(User).where(User.phone == user_in.phone)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号已被注册",
        )

    # 创建用户
    user = User(
        name=user_in.name,
        phone=user_in.phone,
        password_hash=hash_password(user_in.password),
        position=user_in.position,
        position_type=user_in.position_type,
        third_class_bar=user_in.third_class_bar,
        team_id=user_in.team_id,
        role=user_in.role,
        dingtalk_id=user_in.dingtalk_id,
        crm_user_id=user_in.crm_user_id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    await log_action(
        db, current_user, "CREATE", "user", str(user.id),
        f"创建了新员工: {user.name} ({user.phone})",
        before_state=None,
        after_state=to_dict(user)
    )

    return user


@router.put("/{user_id}", response_model=UserResponse, summary="更新用户")
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """
    更新用户信息（仅管理员可用）
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")

    before_state = to_dict(user)

    # 更新非空字段
    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.add(user)
    await db.flush()
    await db.refresh(user)

    await log_action(
        db, current_user, "UPDATE", "user", str(user.id),
        f"编辑了员工: {user.name}",
        before_state=before_state,
        after_state=to_dict(user)
    )

    return user


@router.delete("/{user_id}", summary="删除用户")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """
    删除用户（软删除，设置is_active=False）
    仅管理员可用
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")

    before_state = to_dict(user)

    user.is_active = False
    db.add(user)
    await db.flush()

    await log_action(
        db, current_user, "UPDATE", "user", str(user.id),
        f"禁用了员工: {user.name} ({user.phone})",
        before_state=before_state,
        after_state=to_dict(user)
    )

    return {"message": "用户已禁用"}


@router.delete("/batch/delete", summary="批量删除用户")
async def batch_delete_users(
    req: BatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """
    批量删除用户（物理强删并级联清除相关业务数据）
    """
    from sqlalchemy import delete, update
    from app.models.goal import PersonalGoal
    from app.models.report import DailyReport, ReportDetail
    from app.models.organization import Team
    
    if not req.user_ids:
        return {"message": "未选择任何用户"}
        
    user_ids = req.user_ids

    # 0. 备份待物理删除的用户数据以留存日志
    users_to_delete_res = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_to_delete = users_to_delete_res.scalars().all()
    before_state = [to_dict(u) for u in users_to_delete]
    
    # 1. 解除 Team 中的外键引用 (target_officer_id, digital_specialist_id)
    await db.execute(update(Team).where(Team.target_officer_id.in_(user_ids)).values(target_officer_id=None))
    await db.execute(update(Team).where(Team.digital_specialist_id.in_(user_ids)).values(digital_specialist_id=None))
    
    # 2. 解除 DailyReport 中的审核人引用 (reviewer_id)
    await db.execute(update(DailyReport).where(DailyReport.reviewer_id.in_(user_ids)).values(reviewer_id=None))
    
    # 3. 物理删除关联的 ReportDetail (由于 SQLAlchemy ORM 批量删除不触发 cascade，需手动处理)
    # 先查出这些用户相关的 report_ids
    reports_res = await db.execute(select(DailyReport.id).where(DailyReport.user_id.in_(user_ids)))
    report_ids = reports_res.scalars().all()
    if report_ids:
        await db.execute(delete(ReportDetail).where(ReportDetail.report_id.in_(report_ids)))
        
    # 4. 物理删除 DailyReport
    await db.execute(delete(DailyReport).where(DailyReport.user_id.in_(user_ids)))
    
    # 5. 物理删除 PersonalGoal
    await db.execute(delete(PersonalGoal).where(PersonalGoal.user_id.in_(user_ids)))
    
    # 6. 最后物理删除 User 本身
    await db.execute(delete(User).where(User.id.in_(user_ids)))
    
    await db.flush()

    await log_action(
        db, current_user, "DELETE", "user", ",".join(map(str, user_ids)),
        f"批量物理删除了 {len(user_ids)} 个用户及其全部连带业务数据",
        before_state=before_state,
        after_state=None
    )

    return {"message": f"成功彻底删除 {len(user_ids)} 个用户及相关连带数据"}


@router.put("/batch/team", summary="批量分配战队")
async def batch_assign_team(
    req: BatchAssignTeamRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """
    批量分配用户到指定战队
    """
    if not req.user_ids:
        return {"message": "未选择任何用户"}
        
    result = await db.execute(select(User).where(User.id.in_(req.user_ids)))
    users = result.scalars().all()

    before_state = {str(u.id): to_dict(u) for u in users}
    
    for u in users:
        u.team_id = req.team_id
        db.add(u)
        
    await db.flush()

    # 重新加载获取更新后状态
    after_state = {str(u.id): to_dict(u) for u in users}

    await log_action(
        db, current_user, "UPDATE", "user", ",".join(map(str, req.user_ids)),
        f"批量分配了 {len(users)} 个用户的归属战队",
        before_state=before_state,
        after_state=after_state
    )

    return {"message": f"成功分配 {len(users)} 个用户"}


@router.put("/batch/role", summary="批量分配角色")
async def batch_assign_role(
    req: BatchAssignRoleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """
    批量分配用户角色（仅管理员可用）
    """
    if not req.user_ids:
        return {"message": "未选择任何用户"}
        
    result = await db.execute(select(User).where(User.id.in_(req.user_ids)))
    users = result.scalars().all()

    before_state = {str(u.id): to_dict(u) for u in users}
    
    for u in users:
        u.role = req.role
        db.add(u)
        
    await db.flush()

    after_state = {str(u.id): to_dict(u) for u in users}

    await log_action(
        db, current_user, "UPDATE", "user", ",".join(map(str, req.user_ids)),
        f"批量修改了 {len(users)} 个用户的角色为 {req.role}",
        before_state=before_state,
        after_state=after_state
    )

    return {"message": f"成功批量修改 {len(users)} 个用户的角色"}


@router.put("/batch/position-type", summary="批量分配岗位类别")
async def batch_assign_position_type(
    req: BatchAssignPositionTypeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """
    批量分配用户岗位类别（仅管理员可用）
    """
    if not req.user_ids:
        return {"message": "未选择任何用户"}
        
    result = await db.execute(select(User).where(User.id.in_(req.user_ids)))
    users = result.scalars().all()

    before_state = {str(u.id): to_dict(u) for u in users}
    
    for u in users:
        u.position_type = req.position_type
        db.add(u)
        
    await db.flush()

    after_state = {str(u.id): to_dict(u) for u in users}

    await log_action(
        db, current_user, "UPDATE", "user", ",".join(map(str, req.user_ids)),
        f"批量修改了 {len(users)} 个用户的岗位类别为 {req.position_type}",
        before_state=before_state,
        after_state=after_state
    )

    return {"message": f"成功批量修改 {len(users)} 个用户的岗位类别"}
