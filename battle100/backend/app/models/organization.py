"""
组织架构模型
定义战区和战队的表结构
"""

from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel


class Zone(BaseModel):
    """战区表"""
    __tablename__ = "zones"

    name: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True, comment="战区名称"
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, default=0, comment="排序序号"
    )

    # ===== 关联关系 =====
    teams = relationship("Team", back_populates="zone")

    def __repr__(self) -> str:
        return f"<Zone(id={self.id}, name={self.name})>"


class Team(BaseModel):
    """战队表"""
    __tablename__ = "teams"

    name: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="战队名称"
    )
    zone_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("zones.id"), nullable=False, comment="所属战区ID"
    )
    company: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="所属公司"
    )
    headcount: Mapped[int] = mapped_column(
        Integer, default=0, comment="团队人数"
    )
    target_officer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, comment="目标官用户ID"
    )
    digital_specialist_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, comment="数字专员用户ID"
    )
    crm_dept_code: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="CRM部门编码"
    )

    # ===== 关联关系 =====
    zone = relationship("Zone", back_populates="teams")
    members = relationship("User", back_populates="team", foreign_keys="[User.team_id]")
    target_officer = relationship("User", foreign_keys=[target_officer_id])
    digital_specialist = relationship("User", foreign_keys=[digital_specialist_id])
    team_goals = relationship("TeamGoal", back_populates="team")
    weekly_targets = relationship("WeeklyTarget", back_populates="team")

    def __repr__(self) -> str:
        return f"<Team(id={self.id}, name={self.name})>"
