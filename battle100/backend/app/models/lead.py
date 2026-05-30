"""
线索转化率模型
定义线索转化率追踪的表结构
"""

from sqlalchemy import String, Integer, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel


class LeadConversion(BaseModel):
    """线索转化率表"""
    __tablename__ = "lead_conversions"
    __table_args__ = (
        UniqueConstraint("team_id", "month", name="uq_lead_conversion_team_month"),
    )

    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id"), nullable=False, comment="战队ID"
    )
    month: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="月份（如：2024-01）"
    )
    conversion_rate_25_75: Mapped[float] = mapped_column(
        Float, default=0, comment="25%-75%阶段转化率"
    )
    conversion_rate_75: Mapped[float] = mapped_column(
        Float, default=0, comment="75%以上阶段转化率"
    )
    target_rate: Mapped[float] = mapped_column(
        Float, default=0, comment="目标转化率"
    )

    # ===== 关联关系 =====
    team = relationship("Team")

    def __repr__(self) -> str:
        return f"<LeadConversion(id={self.id}, team_id={self.team_id}, month={self.month})>"
