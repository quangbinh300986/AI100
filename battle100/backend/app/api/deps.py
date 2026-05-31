"""
API依赖注入模块
提供获取当前用户、权限校验等公共依赖
"""

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User, UserRole
from app.services.auth_service import verify_access_token

# OAuth2密码模式的Token获取端点
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    获取当前登录用户
    从JWT令牌中解析用户ID，查询数据库返回完整用户对象
    支持从 Header 中提取 Bearer Token，以及从 URL Query 中获取 token 参数
    """
    # 认证失败异常
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        token = request.query_params.get("token")

    if not token:
        raise credentials_exception

    # 验证Token
    payload = verify_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    # 查询用户
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用",
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """获取当前活跃用户（确保未被禁用）"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用",
        )
    return current_user


def require_roles(*roles: UserRole):
    """
    角色权限校验依赖工厂
    使用方式：Depends(require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER))
    :param roles: 允许的角色列表
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in [r.value for r in roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"权限不足，需要以下角色之一: {[r.value for r in roles]}",
            )
        return current_user

    return role_checker


def require_permission(perm_name: str):
    """
    基于数据库 role_permissions 表的动态权限校验依赖工厂
    使用方式：Depends(require_permission("goals"))
    :param perm_name: 需要的权限 Key (dashboard, reports, goals, settings)
    """
    async def permission_checker(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        # 系统管理员默认拥有所有权限，规避因权限配置失误导致管理员账号被锁死
        if current_user.role == UserRole.ADMIN:
            return current_user

        from app.models.user import RolePermission
        result = await db.execute(
            select(RolePermission).where(
                RolePermission.role == current_user.role,
                RolePermission.menu_key == perm_name
            )
        )
        perm = result.scalar_one_or_none()
        if not perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"操作权限不足，当前角色无权限操作该模块：{perm_name}",
            )
        return current_user

    return permission_checker
