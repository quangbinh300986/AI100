"""
操作审计日志模型
定义系统内用户所有写操作（增删改导）的审计记录表
"""

from sqlalchemy import String, Integer, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import BaseModel


class AuditLog(BaseModel):
    """系统操作日志审计表"""
    __tablename__ = "audit_logs"

    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, comment="操作人ID"
    )
    user_name: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="操作人姓名"
    )
    action_type: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="操作类型（CREATE, UPDATE, DELETE, IMPORT）"
    )
    target_module: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="操作模块（user, goal, weekly_target, report, role_permission等）"
    )
    target_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="被操作对象ID（若批量则以逗号分隔）"
    )
    description: Mapped[str] = mapped_column(
        Text, nullable=False, comment="动作描述文字"
    )
    before_state: Mapped[dict | list | None] = mapped_column(
        JSON, nullable=True, comment="变更前的数据状态"
    )
    after_state: Mapped[dict | list | None] = mapped_column(
        JSON, nullable=True, comment="变更后的数据状态"
    )

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, user_name={self.user_name}, action={self.action_type}, module={self.target_module})>"
