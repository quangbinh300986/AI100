"""
幸福委模型
定义幸福委和幸福委成员的表结构
"""

from sqlalchemy import String, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel


class Committee(BaseModel):
    """幸福委表"""
    __tablename__ = "committees"

    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, comment="幸福委编码"
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="幸福委名称"
    )
    category: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="分类"
    )
    chairman: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="主任姓名"
    )
    responsibility: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="职责描述"
    )

    # ===== 关联关系 =====
    members = relationship("CommitteeMember", back_populates="committee", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Committee(id={self.id}, code={self.code}, name={self.name})>"


class CommitteeMember(BaseModel):
    """幸福委成员表"""
    __tablename__ = "committee_members"

    committee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("committees.id"), nullable=False, comment="所属幸福委ID"
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, comment="成员用户ID"
    )
    member_role: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="成员角色"
    )
    branch: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="所属分支"
    )

    # ===== 关联关系 =====
    committee = relationship("Committee", back_populates="members")
    user = relationship("User")

    def __repr__(self) -> str:
        return f"<CommitteeMember(id={self.id}, committee_id={self.committee_id}, user_id={self.user_id})>"
