"""
填报相关Schema
定义每日填报、填报明细等数据结构
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


class ReportDetailCreate(BaseModel):
    """创建填报明细"""
    detail_type: str = Field(..., description="明细类型")
    customer_name: Optional[str] = Field(None, description="客户名称")
    amount: Optional[float] = Field(None, description="金额（万元）")
    lead_progress: Optional[str] = Field(None, description="线索进展阶段")
    crm_opportunity_id: Optional[str] = Field(None, description="CRM商机ID")
    happiness_level: Optional[int] = Field(None, description="幸福等级")
    happiness_standard_id: Optional[int] = Field(None, description="幸福标准ID")
    project_name: Optional[str] = Field(None, description="项目名称")
    description: Optional[str] = Field(None, description="描述说明")
    attachment_urls: Optional[list[str]] = Field(None, description="附件URL列表")
    partner_user_id: Optional[int] = Field(None, description="协同搭档用户ID")


class ReportDetailResponse(ReportDetailCreate):
    """填报明细响应"""
    id: int
    report_id: int
    partner_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DailyReportCreate(BaseModel):
    """创建每日填报"""
    report_date: date = Field(..., description="填报日期")
    contract_amount: float = Field(default=0, description="当日签约金额")
    contract_count: int = Field(default=0, description="当日签约单数")
    happiness_actions: int = Field(default=0, description="幸福行动次数")
    triangle_count: int = Field(default=0, description="铁三角拜访次数")
    leads_count: int = Field(default=0, description="线索数量")
    work_summary: Optional[str] = Field(None, description="工作总结")
    work_reflection: Optional[str] = Field(None, description="工作反思")
    next_day_plan: Optional[str] = Field(None, description="明日计划")
    standup_notes: Optional[str] = Field(None, description="站会记录")
    details: list[ReportDetailCreate] = Field(default_factory=list, description="填报明细列表")


class DailyReportUpdate(BaseModel):
    """更新每日填报"""
    contract_amount: Optional[float] = Field(None, description="当日签约金额")
    contract_count: Optional[int] = Field(None, description="当日签约单数")
    happiness_actions: Optional[int] = Field(None, description="幸福行动次数")
    triangle_count: Optional[int] = Field(None, description="铁三角拜访次数")
    leads_count: Optional[int] = Field(None, description="线索数量")
    work_summary: Optional[str] = Field(None, description="工作总结")
    work_reflection: Optional[str] = Field(None, description="工作反思")
    next_day_plan: Optional[str] = Field(None, description="明日计划")
    standup_notes: Optional[str] = Field(None, description="站会记录")
    details: Optional[list[ReportDetailCreate]] = Field(None, description="填报明细列表")


class DailyReportResponse(BaseModel):
    """每日填报响应"""
    id: int
    user_id: int
    report_date: date
    contract_amount: float
    contract_count: int
    happiness_actions: int
    triangle_count: int
    leads_count: int
    work_summary: Optional[str] = None
    work_reflection: Optional[str] = None
    next_day_plan: Optional[str] = None
    standup_notes: Optional[str] = None
    status: str
    reviewer_id: Optional[int] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    details: list[ReportDetailResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReportReviewRequest(BaseModel):
    """审核请求"""
    action: str = Field(..., description="审核动作：approved/rejected")
    comment: Optional[str] = Field(None, description="审核意见")


class ReportListResponse(BaseModel):
    """填报列表响应"""
    total: int = Field(..., description="总数")
    items: list[DailyReportResponse] = Field(..., description="填报列表")


class WeeklyReportCreate(BaseModel):
    """创建周报Schema"""
    start_date: date = Field(..., description="周开始日期")
    end_date: date = Field(..., description="周结束日期")
    delivery_plan: Optional[str] = Field(None, description="项目交付计划")
    sales_plan: Optional[str] = Field(None, description="销售计划")
    delivery_actual: Optional[str] = Field(None, description="项目交付实际")
    sales_actual: Optional[str] = Field(None, description="销售实际")
    delivery_rate: Optional[str] = Field(None, description="项目达成率")
    sales_rate: Optional[str] = Field(None, description="销售达成率")
    delivery_highlights: Optional[str] = Field(None, description="项目亮点")
    sales_highlights: Optional[str] = Field(None, description="销售亮点")
    delivery_blockers: Optional[str] = Field(None, description="项目难点")
    sales_blockers: Optional[str] = Field(None, description="销售难点")
    delivery_support: Optional[str] = Field(None, description="项目侧上级支持")
    sales_support: Optional[str] = Field(None, description="销售侧上级支持")
    next_delivery_plan: Optional[str] = Field(None, description="下周项目交付目标")
    next_sales_plan: Optional[str] = Field(None, description="下周销售目标")
    status: Optional[str] = Field("draft", description="状态 draft/submitted")


class WeeklyReportUpdate(BaseModel):
    """更新周报Schema"""
    delivery_plan: Optional[str] = None
    sales_plan: Optional[str] = None
    delivery_actual: Optional[str] = None
    sales_actual: Optional[str] = None
    delivery_rate: Optional[str] = None
    sales_rate: Optional[str] = None
    delivery_highlights: Optional[str] = None
    sales_highlights: Optional[str] = None
    delivery_blockers: Optional[str] = None
    sales_blockers: Optional[str] = None
    delivery_support: Optional[str] = None
    sales_support: Optional[str] = None
    next_delivery_plan: Optional[str] = None
    next_sales_plan: Optional[str] = None
    status: Optional[str] = None


class WeeklyReportResponse(BaseModel):
    """周报响应Schema"""
    id: int
    user_id: int
    start_date: date
    end_date: date
    delivery_plan: Optional[str] = None
    sales_plan: Optional[str] = None
    delivery_actual: Optional[str] = None
    sales_actual: Optional[str] = None
    delivery_rate: Optional[str] = None
    sales_rate: Optional[str] = None
    delivery_highlights: Optional[str] = None
    sales_highlights: Optional[str] = None
    delivery_blockers: Optional[str] = None
    sales_blockers: Optional[str] = None
    delivery_support: Optional[str] = None
    sales_support: Optional[str] = None
    next_delivery_plan: Optional[str] = None
    next_sales_plan: Optional[str] = None
    status: str
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    user_name: Optional[str] = None

    model_config = {"from_attributes": True}
