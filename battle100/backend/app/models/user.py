"""
用户模型
定义用户表结构，包含认证信息、角色、所属战队等字段
"""

import enum
from sqlalchemy import String, Integer, Boolean, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel


class UserRole(str, enum.Enum):
    """用户角色/系统权限"""
    ADMIN = "admin"                            # 超级管理员
    TARGET_OFFICER = "target_officer"          # 目标官
    DIGITAL_SPECIALIST = "digital_specialist"  # 数字专员
    TEAM_LEADER = "team_leader"                # 战队长
    STAFF = "staff"                            # 普通员工
    MARKETING_STAFF = "marketing_staff"        # 营销
    TECH_MARKETING = "tech_marketing"          # 技术营销


class PositionType(str, enum.Enum):
    """岗位类型"""
    BACK_OFFICE = "back_office"      # 后台
    MIDDLE_OFFICE = "middle_office"  # 中台
    MANAGEMENT = "management"        # 管理岗
    TECHNICAL = "technical"          # 技术岗
    DELIVERY = "delivery"            # 交付岗
    MARKETING = "marketing"          # 营销岗
    SUPPORT = "support"              # 历史保留：支撑岗


class User(BaseModel):
    """用户表"""
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="用户姓名"
    )
    phone: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, comment="手机号码"
    )
    password_hash: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="密码哈希值"
    )
    dingtalk_id: Mapped[str | None] = mapped_column(
        String(100), unique=True, nullable=True, comment="钉钉用户ID"
    )
    position: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="岗位名称"
    )
    position_type: Mapped[str | None] = mapped_column(
        Enum(PositionType), nullable=True, comment="岗位类型"
    )
    third_class_bar: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="三级巴/三级部门名称"
    )
    team_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("teams.id"), nullable=True, comment="所属战队ID"
    )
    role: Mapped[str] = mapped_column(
        Enum(UserRole), nullable=False, default=UserRole.STAFF, comment="用户角色"
    )
    crm_user_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="CRM系统用户ID"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否激活"
    )

    # ===== 关联关系 =====
    team = relationship("Team", back_populates="members", foreign_keys=[team_id])
    daily_reports = relationship("DailyReport", back_populates="user", foreign_keys="[DailyReport.user_id]")
    personal_goals = relationship("PersonalGoal", back_populates="user")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, name={self.name}, role={self.role})>"


class RolePermission(BaseModel):
    """角色权限配置表"""
    __tablename__ = "role_permissions"

    role: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True, comment="用户角色，如 admin, team_leader 等"
    )
    menu_key: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="菜单/权限 Key，如 dashboard, reports, goals, settings"
    )

    def __repr__(self) -> str:
        return f"<RolePermission(id={self.id}, role={self.role}, menu_key={self.menu_key})>"
