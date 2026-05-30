"""
认证服务
提供密码哈希、JWT令牌生成与验证等核心认证功能
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
import bcrypt

from app.config import settings


def hash_password(password: str) -> str:
    """
    对明文密码进行哈希处理
    :param password: 明文密码
    :return: 哈希后的密码字符串
    """
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证明文密码与哈希密码是否匹配
    :param plain_password: 明文密码
    :param hashed_password: 哈希后的密码
    :return: 是否匹配
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False


def create_access_token(
    user_id: int,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    创建访问令牌（Access Token）
    :param user_id: 用户ID
    :param role: 用户角色
    :param expires_delta: 自定义过期时间
    :return: JWT字符串
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )

    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    user_id: int,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    创建刷新令牌（Refresh Token）
    :param user_id: 用户ID
    :param expires_delta: 自定义过期时间
    :return: JWT字符串
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
        )

    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """
    解码并验证JWT令牌
    :param token: JWT字符串
    :return: 解码后的payload字典，验证失败返回None
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError:
        return None


def verify_access_token(token: str) -> Optional[dict]:
    """
    验证访问令牌有效性
    :param token: JWT字符串
    :return: payload字典（含user_id和role），无效返回None
    """
    payload = decode_token(token)
    if payload is None:
        return None
    if payload.get("type") != "access":
        return None
    return payload


def verify_refresh_token(token: str) -> Optional[dict]:
    """
    验证刷新令牌有效性
    :param token: JWT字符串
    :return: payload字典（含user_id），无效返回None
    """
    payload = decode_token(token)
    if payload is None:
        return None
    if payload.get("type") != "refresh":
        return None
    return payload
