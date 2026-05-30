"""
SQLAlchemy 模型基类
提供统一的主键、时间戳字段，所有模型继承此基类
"""

from datetime import datetime
from sqlalchemy import Integer, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """声明式基类，所有ORM模型的父类"""
    pass


class TimestampMixin:
    """
    时间戳混入类
    为模型自动添加 created_at 和 updated_at 字段
    """
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="创建时间",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新时间",
    )


class BaseModel(Base, TimestampMixin):
    """
    通用基础模型
    包含自增主键ID + 时间戳字段，所有业务模型继承此类
    """
    __abstract__ = True

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="主键ID",
    )
