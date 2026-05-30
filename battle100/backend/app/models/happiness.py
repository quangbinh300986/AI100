"""
客户幸福标准模型
定义幸福等级标准的表结构
"""

from sqlalchemy import String, Integer, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import BaseModel


class HappinessStandard(BaseModel):
    """客户幸福标准表"""
    __tablename__ = "happiness_standards"

    level: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="幸福等级（1-5）"
    )
    level_name: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="等级名称"
    )
    scope: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="适用范围"
    )
    phase: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="适用阶段"
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, default=0, comment="排序序号"
    )
    content: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="标准内容描述"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, comment="是否启用"
    )

    def __repr__(self) -> str:
        return f"<HappinessStandard(id={self.id}, level={self.level}, name={self.level_name})>"
