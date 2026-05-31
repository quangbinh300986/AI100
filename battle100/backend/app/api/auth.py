"""
认证接口
提供登录、刷新Token等认证相关API
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    Token,
    TokenRefreshRequest,
    PasswordChangeRequest,
    DingTalkLoginRequest,
)
from app.services.auth_service import (
    verify_password,
    hash_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
)
from app.api.deps import get_current_user
from app.integrations.dingtalk import dingtalk_client

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login", response_model=Token, summary="用户登录")
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    用户手机号+密码登录
    返回访问令牌和刷新令牌
    """
    # 查询用户
    result = await db.execute(
        select(User).where(User.phone == request.phone)
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="手机号或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用",
        )

    # 生成令牌
    access_token = create_access_token(user_id=user.id, role=user.role)
    refresh_token = create_refresh_token(user_id=user.id)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/dingtalk-login", response_model=Token, summary="钉钉免登登录")
async def dingtalk_login(
    request: DingTalkLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    钉钉免密登录（免登）
    通过 auth_code 获取钉钉用户信息，在本地匹配用户并生成 token
    """
    # 1. 获取钉钉用户信息
    dd_user = await dingtalk_client.get_user_info_by_code(request.auth_code)
    if not dd_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="钉钉免登失败，无法获取用户信息",
        )
        
    userid = dd_user.get("userid")
    name = dd_user.get("name")
    mobile = dd_user.get("mobile")
    
    user = None
    
    # 2. 优先使用 dingtalk_id 进行匹配
    if userid:
        result = await db.execute(
            select(User).where(User.dingtalk_id == userid)
        )
        user = result.scalar_one_or_none()
        
    # 3. 如果没匹配到，根据手机号进行匹配
    if user is None and mobile:
        result = await db.execute(
            select(User).where(User.phone == mobile)
        )
        user = result.scalar_one_or_none()
        
        # 如果手机号匹配成功，自动回写用户的 dingtalk_id，方便下次直接匹配
        if user:
            user.dingtalk_id = userid
            db.add(user)
            await db.commit()
            
    # 4. 如果仍未找到，提示未绑定
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"您的钉钉账号未与系统账号绑定，请联系管理员。钉钉姓名: {name or '未知'}",
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="该系统账号已被禁用",
        )
        
    # 生成令牌
    access_token = create_access_token(user_id=user.id, role=user.role)
    refresh_token = create_refresh_token(user_id=user.id)
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=Token, summary="刷新令牌")
async def refresh_token(
    request: TokenRefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    使用刷新令牌获取新的访问令牌
    """
    payload = verify_refresh_token(request.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="刷新令牌无效或已过期",
        )

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在或已被禁用",
        )

    # 生成新的令牌对
    access_token = create_access_token(user_id=user.id, role=user.role)
    new_refresh_token = create_refresh_token(user_id=user.id)

    return Token(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )


@router.post("/change-password", summary="修改密码")
async def change_password(
    request: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    修改当前用户密码
    需要验证原密码
    """
    if not verify_password(request.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="原密码错误",
        )

    current_user.password_hash = hash_password(request.new_password)
    db.add(current_user)
    await db.flush()

    return {"message": "密码修改成功"}


@router.get("/me", summary="获取当前用户信息")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取当前登录用户的基本信息，包含动态配置的权限列表"""
    from sqlalchemy import select
    from app.models.user import RolePermission

    # 动态查询该角色被配置的权限模块 key 列表
    permissions = []
    try:
        perm_query = await db.execute(
            select(RolePermission.menu_key).where(RolePermission.role == current_user.role)
        )
        permissions = [row for row in perm_query.scalars().all()]
    except Exception as ex:
        # 如果新表刚创建尚未插入，或者出现任何异常，返回空列表兜底
        pass

    return {
        "id": current_user.id,
        "name": current_user.name,
        "phone": current_user.phone,
        "role": current_user.role,
        "position": current_user.position,
        "position_type": current_user.position_type,
        "team_id": current_user.team_id,
        "is_active": current_user.is_active,
        "permissions": permissions,
    }
