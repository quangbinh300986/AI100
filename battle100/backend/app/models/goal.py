"""
目标模型
定义个人目标、战队目标和周度目标分解的表结构
"""

import enum
from sqlalchemy import String, Integer, Float, Date, ForeignKey, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date
from app.models.base import BaseModel


class GoalType(str, enum.Enum):
    """个人目标类型枚举"""
    CONTRACT_AMOUNT = "contract_amount"      # 签约金额
    CONTRACT_COUNT = "contract_count"        # 签约单数
    HAPPINESS_ACTION = "happiness_action"    # 幸福行动
    TRIANGLE_COUNT = "triangle_count"        # 铁三角拜访
    LEADS_COUNT = "leads_count"              # 线索数量
    LEADS_CONVERSION_RATE = "leads_conversion_rate"  # 线索转化率
    NEW_CUSTOMER_COUNT = "new_customer_count"        # 新客户数
    HAPPINESS_STORY_COUNT = "happiness_story_count"  # 客户幸福故事数


class TeamGoalCategory(str, enum.Enum):
    """战队目标类别枚举"""
    MARKETING = "marketing"    # 营销目标
    DELIVERY = "delivery"      # 交付目标


class PersonalGoal(BaseModel):
    """个人目标表"""
    __tablename__ = "personal_goals"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, comment="用户ID"
    )
    goal_type: Mapped[str] = mapped_column(
        Enum(GoalType), nullable=False, comment="目标类型"
    )
    base_target: Mapped[float] = mapped_column(
        Float, default=0, comment="保底目标值"
    )
    challenge_target: Mapped[float] = mapped_column(
        Float, default=0, comment="挑战目标值"
    )
    unit: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="单位（万元/个/次）"
    )
    period: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="目标周期（如：2024Q1）"
    )
    actual_value: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="实际完成值（为Null表示由系统自动计算）"
    )

    # ===== 关联关系 =====
    user = relationship("User", back_populates="personal_goals")

    def __repr__(self) -> str:
        return f"<PersonalGoal(id={self.id}, user_id={self.user_id}, type={self.goal_type})>"


class TeamGoal(BaseModel):
    """战队目标表"""
    __tablename__ = "team_goals"

    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id"), nullable=False, comment="战队ID"
    )
    category: Mapped[str] = mapped_column(
        Enum(TeamGoalCategory), nullable=False, comment="目标类别（营销/交付）"
    )
    base_target: Mapped[float] = mapped_column(
        Float, default=0, comment="保底目标值"
    )
    red_line_target: Mapped[float] = mapped_column(
        Float, default=0, comment="红线目标值"
    )
    gap: Mapped[float] = mapped_column(
        Float, default=0, comment="目标缺口"
    )
    original_plan: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="原始计划描述"
    )

    # ===== 关联关系 =====
    team = relationship("Team", back_populates="team_goals")

    def __repr__(self) -> str:
        return f"<TeamGoal(id={self.id}, team_id={self.team_id}, category={self.category})>"


class WeeklyTarget(BaseModel):
    """周度目标分解表"""
    __tablename__ = "weekly_targets"

    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id"), nullable=False, comment="战队ID"
    )
    week_number: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="周次编号"
    )
    week_start: Mapped[date] = mapped_column(
        Date, nullable=False, comment="周开始日期"
    )
    week_end: Mapped[date] = mapped_column(
        Date, nullable=False, comment="周结束日期"
    )
    marketing_target: Mapped[float] = mapped_column(
        Float, default=0, comment="原营销目标值"
    )
    delivery_target: Mapped[float] = mapped_column(
        Float, default=0, comment="原交付目标值"
    )
    marketing_base_target: Mapped[float] = mapped_column(
        Float, default=0, comment="营销保底目标值"
    )
    marketing_challenge_target: Mapped[float] = mapped_column(
        Float, default=0, comment="营销挑战高目标值"
    )
    delivery_base_target: Mapped[float] = mapped_column(
        Float, default=0, comment="交付保底目标值"
    )
    delivery_challenge_target: Mapped[float] = mapped_column(
        Float, default=0, comment="交付挑战高目标值"
    )
    marketing_actual: Mapped[float] = mapped_column(
        Float, default=0, comment="营销实际值"
    )
    delivery_actual: Mapped[float] = mapped_column(
        Float, default=0, comment="交付实际值"
    )

    # ===== 关联关系 =====
    team = relationship("Team", back_populates="weekly_targets")

    def __repr__(self) -> str:
        return f"<WeeklyTarget(id={self.id}, team_id={self.team_id}, week={self.week_number})>"
