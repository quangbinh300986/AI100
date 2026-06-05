"""
模型包初始化
统一导入所有ORM模型，确保Alembic能正确检测到全部表
"""

from app.models.base import Base, BaseModel
from app.models.user import User, UserRole, PositionType, RolePermission
from app.models.organization import Zone, Team
from app.models.goal import PersonalGoal, TeamGoal, WeeklyTarget, GoalType, TeamGoalCategory
from app.models.report import DailyReport, ReportDetail, ReportStatus, DetailType, WeeklyReport
from app.models.happiness import HappinessStandard
from app.models.broadcast import BroadcastEvent, EventType, PushStatus, PushChannel
from app.models.committee import Committee, CommitteeMember
from app.models.lead import LeadConversion
from app.models.audit_log import AuditLog

# 导出所有模型，供外部统一引用
__all__ = [
    "Base",
    "BaseModel",
    "User",
    "UserRole",
    "PositionType",
    "RolePermission",
    "Zone",
    "Team",
    "PersonalGoal",
    "TeamGoal",
    "WeeklyTarget",
    "GoalType",
    "TeamGoalCategory",
    "DailyReport",
    "ReportDetail",
    "ReportStatus",
    "DetailType",
    "WeeklyReport",
    "HappinessStandard",
    "BroadcastEvent",
    "EventType",
    "PushStatus",
    "PushChannel",
    "Committee",
    "CommitteeMember",
    "LeadConversion",
    "AuditLog",
]
