"""
播报事件模型
定义播报事件的表结构，用于战报自动播报和钉钉推送
"""

import enum
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, Enum, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel


class EventType(str, enum.Enum):
    """事件类型枚举"""
    CONTRACT_SIGNED = "contract_signed"    # 签约播报
    GOAL_ACHIEVED = "goal_achieved"        # 目标达成
    DAILY_SUMMARY = "daily_summary"        # 每日汇总
    WEEKLY_SUMMARY = "weekly_summary"      # 周度汇总
    RANKING_UPDATE = "ranking_update"      # 排名变动
    CUSTOM = "custom"                      # 自定义播报


class PushStatus(str, enum.Enum):
    """推送状态枚举"""
    PENDING = "pending"      # 待推送
    SENT = "sent"            # 已发送
    FAILED = "failed"        # 发送失败


class PushChannel(str, enum.Enum):
    """推送渠道枚举"""
    DINGTALK = "dingtalk"    # 钉钉
    SYSTEM = "system"        # 系统内通知
    ALL = "all"              # 全渠道


class BroadcastEvent(BaseModel):
    """播报事件表"""
    __tablename__ = "broadcast_events"

    event_type: Mapped[str] = mapped_column(
        Enum(EventType), nullable=False, comment="事件类型"
    )
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, comment="关联用户ID"
    )
    team_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("teams.id"), nullable=True, comment="关联战队ID"
    )
    content: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="播报内容"
    )
    template_content: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="模板内容"
    )
    push_status: Mapped[str] = mapped_column(
        Enum(PushStatus), default=PushStatus.PENDING, comment="推送状态"
    )
    push_channel: Mapped[str] = mapped_column(
        Enum(PushChannel), default=PushChannel.DINGTALK, comment="推送渠道"
    )
    dingtalk_msg_id: Mapped[str | None] = mapped_column(
        String(200), nullable=True, comment="钉钉消息ID"
    )
    event_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="事件发生时间"
    )
    push_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="推送时间"
    )

    # ===== 关联关系 =====
    user = relationship("User")
    team = relationship("Team")

    def __repr__(self) -> str:
        return f"<BroadcastEvent(id={self.id}, type={self.event_type}, status={self.push_status})>"
