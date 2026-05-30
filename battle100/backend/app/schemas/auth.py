"""
认证相关Schema
定义登录请求、Token响应等数据结构
"""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """登录请求"""
    phone: str = Field(..., description="手机号码")
    password: str = Field(..., description="密码")


class DingTalkLoginRequest(BaseModel):
    """钉钉登录请求"""
    auth_code: str = Field(..., description="钉钉授权码")


class Token(BaseModel):
    """Token响应"""
    access_token: str = Field(..., description="访问令牌")
    refresh_token: str = Field(..., description="刷新令牌")
    token_type: str = Field(default="bearer", description="令牌类型")


class TokenRefreshRequest(BaseModel):
    """刷新Token请求"""
    refresh_token: str = Field(..., description="刷新令牌")


class TokenData(BaseModel):
    """Token解析后的数据"""
    user_id: int | None = None
    role: str | None = None


class PasswordChangeRequest(BaseModel):
    """修改密码请求"""
    old_password: str = Field(..., description="原密码")
    new_password: str = Field(..., min_length=6, description="新密码")
