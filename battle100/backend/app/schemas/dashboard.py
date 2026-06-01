"""
大屏数据Schema
定义作战大屏展示所需的汇总数据结构，与前端 DashboardData 严格对齐
"""

from pydantic import BaseModel, Field
from typing import Optional
import datetime


class KpiItem(BaseModel):
    """单项KPI进度"""
    value: float = Field(default=0.0, description="当前完成值")
    target: float = Field(default=0.0, description="目标值")
    percentage: float = Field(default=0.0, description="完成率（%）")


class KpiSummary(BaseModel):
    """四大指标汇总"""
    newContracts: KpiItem = Field(..., description="新签合同总额")
    happinessActions: KpiItem = Field(..., description="客户幸福动作次数")
    ironTriangle: KpiItem = Field(..., description="售前铁三角联动次数")
    validLeads: KpiItem = Field(..., description="新增有效线索数")


class RankingItem(BaseModel):
    """大屏排名条目"""
    rank: int = Field(..., description="排名")
    name: str = Field(..., description="展示名称")
    avatar: Optional[str] = Field(default=None, description="头像")
    teamName: Optional[str] = Field(default=None, description="所属战队")
    score: float = Field(..., description="完成值（百分比或绝对值）")
    trend: str = Field(default="same", description="变化趋势(up/down/same)")


class LiveFeedItem(BaseModel):
    """大屏滚动播报条目"""
    id: int = Field(..., description="播报ID")
    content: str = Field(..., description="播报内容")
    time: str = Field(..., description="播报时间（例如：10分钟前 / 09:30）")
    type: str = Field(default="info", description="播报类型(contract/achievement/milestone/info)")


class WeeklyTrendData(BaseModel):
    """双轴趋势图折线数据列表"""
    dates: list[str] = Field(default_factory=list, description="日期或周次列表")
    newContracts: list[float] = Field(default_factory=list, description="营销完成趋势")
    newContractsTarget: list[float] = Field(default_factory=list, description="营销保底目标累计趋势")
    newContractsChallengeTarget: list[float] = Field(default_factory=list, description="营销挑战目标累计趋势")
    happinessActions: list[int] = Field(default_factory=list, description="交付完成趋势")
    ironTriangle: list[int] = Field(default_factory=list, description="铁三角联动趋势")
    validLeads: list[int] = Field(default_factory=list, description="有效线索趋势")


class DualTrackTeam(BaseModel):
    """双轨动力战队状态卡片"""
    teamId: Optional[int] = Field(default=None, description="战队ID")
    teamName: str = Field(..., description="战队名称")
    leader: str = Field(..., description="巴长/队长姓名")
    marketingActual: float = Field(default=0.0, description="营销新签实际")
    marketingTarget: float = Field(default=0.0, description="营销新签目标")
    marketingRate: float = Field(default=0.0, description="营销达成率")
    deliveryActual: float = Field(default=0.0, description="交付新签实际")
    deliveryTarget: float = Field(default=0.0, description="交付新签目标")
    deliveryRate: float = Field(default=0.0, description="交付达成率")
    validLeadsActual: int = Field(default=0, description="有效需求线索实际")
    validLeadsTarget: float = Field(default=0.0, description="有效需求线索目标")
    validLeadsRate: float = Field(default=0.0, description="有效需求线索达成率")
    statusLight: str = Field(default="green", description="综合状态灯: red/yellow/green")


class FunnelItem(BaseModel):
    """商机漏斗阶段属性"""
    stage: str = Field(..., description="推进阶段，例如 5%、10%等")
    name: str = Field(..., description="阶段中文名称，例如 潜在需求信息")
    count: int = Field(default=0, description="商机总个数")
    rate: float = Field(default=0.0, description="转化率（%）")


class ImportantProjectItem(BaseModel):
    """50万以上重特大攻坚项目"""
    id: str = Field(..., description="商机/项目ID")
    name: str = Field(..., description="商机/项目名称")
    customerName: Optional[str] = Field(default=None, description="客户名称")
    amount: float = Field(default=0.0, description="预计金额（万元）")
    progress: int = Field(default=0, description="当前进度百分比")


class DashboardResponse(BaseModel):
    """大屏看板完整响应 (即对齐前端 DashboardData)"""
    kpiSummary: KpiSummary = Field(..., description="四大指标汇总")
    zoneRanking: list[RankingItem] = Field(default_factory=list, description="战区排名列表")
    weeklyTrend: WeeklyTrendData = Field(..., description="周趋势折线数据")
    liveFeed: list[LiveFeedItem] = Field(default_factory=list, description="实时动态播报")
    heroBoard: list[RankingItem] = Field(default_factory=list, description="签单先锋榜TOP10")
    happinessBoard: list[RankingItem] = Field(default_factory=list, description="客户幸福之星榜TOP10")
    triangleBoard: list[RankingItem] = Field(default_factory=list, description="铁三角协作标杆榜TOP10")
    leadsBoard: list[RankingItem] = Field(default_factory=list, description="线索先锋榜TOP10")
    zoneTeamsPK: dict[str, list[RankingItem]] = Field(default_factory=dict, description="战区内部战队相互PK榜单")
    dualTrackTeams: list[DualTrackTeam] = Field(default_factory=list, description="九宫格双轨战队数据")
    leadsFunnel: list[FunnelItem] = Field(default_factory=list, description="销售漏斗数据")
    importantProjects: list[ImportantProjectItem] = Field(default_factory=list, description="50万以上重特大攻坚项目")
    countdown: int = Field(default=71, description="百日倒计时天数")
    campaignName: str = Field(default="中地顾问「百日奋战」经营冲刺大屏", description="战役名称")
    slogan: str = Field(default="奋战一百天，亮剑破六千！", description="战役口号")


class WeeklyTrend(BaseModel):
    """周度趋势基础数据（单周指标，用于接口返回列表）"""
    week_number: int = Field(..., description="周次")
    week_start: datetime.date = Field(..., description="周开始日期")
    marketing_target: float = Field(default=0, description="营销目标")
    marketing_actual: float = Field(default=0, description="营销实际")
    delivery_target: float = Field(default=0, description="交付目标")
    delivery_actual: float = Field(default=0, description="交付实际")
