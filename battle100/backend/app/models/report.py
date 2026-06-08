"""
填报模型
定义每日填报表和填报明细表结构
"""

import enum
from datetime import date, datetime
from sqlalchemy import (
    String, Integer, Float, Date, DateTime, ForeignKey,
    Enum, Text, UniqueConstraint, JSON, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel


class ReportStatus(str, enum.Enum):
    """填报状态枚举"""
    DRAFT = "draft"          # 草稿
    SUBMITTED = "submitted"  # 已提交
    REVIEWED = "reviewed"    # 已审核
    REJECTED = "rejected"    # 已驳回


class DetailType(str, enum.Enum):
    """明细类型枚举"""
    CONTRACT = "contract"          # 签约明细
    HAPPINESS = "happiness"        # 幸福行动明细
    TRIANGLE = "triangle"          # 铁三角拜访明细
    LEAD = "lead"                  # 线索明细
    POTENTIAL_LEAD = "potential_lead"  # 潜力线索明细


class DailyReport(BaseModel):
    """每日填报表"""
    __tablename__ = "daily_reports"
    __table_args__ = (
        UniqueConstraint("user_id", "report_date", name="uq_daily_report_user_date"),
    )

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, comment="用户ID"
    )
    report_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="填报日期"
    )
    contract_amount: Mapped[float] = mapped_column(
        Float, default=0, comment="当日签约金额（万元）"
    )
    contract_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="当日签约单数"
    )
    happiness_actions: Mapped[int] = mapped_column(
        Integer, default=0, comment="幸福行动次数"
    )
    triangle_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="铁三角拜访次数"
    )
    leads_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="线索数量"
    )
    potential_leads_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="潜力线索数量"
    )
    work_summary: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="工作总结"
    )
    work_reflection: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="工作反思"
    )
    next_day_plan: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="明日计划"
    )
    standup_notes: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="站会记录"
    )
    status: Mapped[str] = mapped_column(
        Enum(ReportStatus), default=ReportStatus.DRAFT, nullable=False, comment="填报状态"
    )
    reviewer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, comment="审核人ID"
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="提交时间"
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="审核时间"
    )

    # ===== 关联关系 =====
    user = relationship("User", back_populates="daily_reports", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    details = relationship("ReportDetail", back_populates="report", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<DailyReport(id={self.id}, user_id={self.user_id}, date={self.report_date})>"


class ReportDetail(BaseModel):
    """填报明细表"""
    __tablename__ = "report_details"

    report_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("daily_reports.id"), nullable=False, comment="所属填报ID"
    )
    detail_type: Mapped[str] = mapped_column(
        Enum(DetailType), nullable=False, comment="明细类型"
    )
    customer_name: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="客户名称"
    )
    amount: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="金额（万元）"
    )
    lead_progress: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="线索进展阶段"
    )
    crm_opportunity_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="CRM商机ID"
    )
    happiness_level: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="幸福等级"
    )
    happiness_standard_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("happiness_standards.id"), nullable=True, comment="幸福标准ID"
    )
    project_name: Mapped[str | None] = mapped_column(
        String(200), nullable=True, comment="项目名称"
    )
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="描述说明"
    )
    attachment_urls: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="附件URL列表"
    )
    partner_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, comment="协同搭档用户ID"
    )

    # ===== 关联关系 =====
    report = relationship("DailyReport", back_populates="details")
    happiness_standard = relationship("HappinessStandard")
    partner_user = relationship("User", foreign_keys=[partner_user_id])

    def __repr__(self) -> str:
        return f"<ReportDetail(id={self.id}, report_id={self.report_id}, type={self.detail_type})>"


class WeeklyReport(BaseModel):
    """周复盘填报表ORM模型"""
    __tablename__ = "weekly_reports"
    __table_args__ = (
        UniqueConstraint("user_id", "start_date", "end_date", name="uq_weekly_report_user_date_range"),
    )

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, comment="用户ID"
    )
    start_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="周开始日期"
    )
    end_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="周结束日期"
    )
    
    # 本周目标计划
    delivery_plan: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="本周项目交付计划"
    )
    sales_plan: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="本周销售计划"
    )
    
    # 本周实际完成
    delivery_actual: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="本周项目交付实际完成"
    )
    sales_actual: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="本周销售实际完成"
    )
    
    # 达成情况
    delivery_rate: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="项目达成率"
    )
    sales_rate: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="销售达成率"
    )
    
    # 本周亮点
    delivery_highlights: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="项目亮点"
    )
    sales_highlights: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="销售亮点"
    )
    
    # 本周卡点
    delivery_blockers: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="项目难点"
    )
    sales_blockers: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="销售难点"
    )
    
    # 是否需要上级支持
    delivery_support: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="项目侧需要支持"
    )
    sales_support: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="销售侧需要支持"
    )
    
    # 下周目标
    next_delivery_plan: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="下周项目交付计划"
    )
    next_sales_plan: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="下周销售计划"
    )
    
    status: Mapped[str] = mapped_column(
        Enum(ReportStatus), default=ReportStatus.DRAFT, nullable=False, comment="填报状态"
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="提交时间"
    )

    # ===== 关联关系 =====
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<WeeklyReport(id={self.id}, user_id={self.user_id}, range={self.start_date}~{self.end_date})>"


class GroupWeeklyReport(BaseModel):
    """团队周复盘整体周报表ORM模型"""
    __tablename__ = "group_weekly_reports"
    __table_args__ = (
        UniqueConstraint("team_id", "third_class_bar", "start_date", name="uq_group_weekly_report_team_bar_date"),
    )

    team_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("teams.id"), nullable=True, comment="战队ID"
    )
    third_class_bar: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="三级巴名称"
    )
    start_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="周开始日期"
    )
    end_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="周结束日期"
    )
    
    # 整体周报 Markdown 文本
    content: Mapped[str] = mapped_column(
        Text, nullable=False, comment="整体周报 Markdown 内容"
    )
    
    # 多维业务汇总指标快照 (万元/个/次)
    marketing_signed: Mapped[float] = mapped_column(
        Float, default=0.0, comment="营销新签合同额（万元）"
    )
    delivery_signed: Mapped[float] = mapped_column(
        Float, default=0.0, comment="交付新签合同额（万元）"
    )
    win_bids: Mapped[int] = mapped_column(
        Integer, default=0, comment="中标个数"
    )
    happiness_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="幸福动作个数"
    )
    triangle_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="铁三角联动次数"
    )
    valid_leads: Mapped[int] = mapped_column(
        Integer, default=0, comment="有效商机线索量"
    )
    potential_leads: Mapped[int] = mapped_column(
        Integer, default=0, comment="潜力商机线索量"
    )
    production_value: Mapped[float] = mapped_column(
        Float, default=0.0, comment="CRM 累计产值（万元）"
    )
    receive_value: Mapped[float] = mapped_column(
        Float, default=0.0, comment="CRM 到账回款额（万元）"
    )

    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, comment="创建者用户ID"
    )

    # ===== 关联关系 =====
    team = relationship("Team", foreign_keys=[team_id])
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<GroupWeeklyReport(id={self.id}, team_id={self.team_id}, bar={self.third_class_bar}, start={self.start_date})>"

