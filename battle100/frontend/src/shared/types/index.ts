/**
 * 百日奋战管理系统 - TypeScript类型定义
 */

/** 用户角色枚举 */
export type UserRole = 'employee' | 'team_leader' | 'zone_leader' | 'admin'

/** 用户信息 */
export interface User {
  id: number
  /** 用户姓名 */
  name: string
  /** 用户名 */
  username?: string
  /** 真实姓名 */
  realName?: string
  /** 手机号 */
  phone: string
  /** 岗位名称 */
  position?: string
  /** 岗位类型 */
  position_type?: 'back_office' | 'middle_office' | 'management' | 'technical' | 'delivery' | 'marketing' | 'support'
  /** 三级巴 */
  third_class_bar?: string
  /** 角色 */
  role: string
  /** 头像URL */
  avatar?: string
  /** 所属战队ID */
  teamId?: number
  /** 所属战队名称 */
  teamName?: string
  /** 所属战区ID */
  zoneId?: number
  /** 所属战区名称 */
  zoneName?: string
  /** 是否活跃 */
  isActive: boolean
  /** 创建时间 */
  createdAt?: string
}

/** 战队信息 */
export interface Team {
  id: number
  /** 战队名称 */
  name: string
  /** 所属战区ID */
  zoneId: number
  /** 所属战区名称 */
  zoneName?: string
  /** 队长信息 */
  leader?: User
  /** 成员数量 */
  memberCount: number
  /** 创建时间 */
  createdAt: string
}

/** 战区信息 */
export interface Zone {
  id: number
  /** 战区名称 */
  name: string
  /** 战区负责人 */
  leader?: User
  /** 包含战队列表 */
  teams?: Team[]
  /** 战队数量 */
  teamCount: number
  /** 总人数 */
  totalMembers: number
}

/** 每日填报记录 */
export interface DailyReport {
  id: number
  /** 填报用户ID */
  userId: number
  /** 填报用户姓名 */
  userName?: string
  /** 填报日期 */
  reportDate: string
  /** 新签合同额（万元） */
  newContracts: number
  /** 幸福动作次数 */
  happinessActions: number
  /** 铁三角协作次数 */
  ironTriangle: number
  /** 有效线索数 */
  validLeads: number
  /** 工作总结 */
  summary?: string
  /** 审核状态 */
  status: 'pending' | 'approved' | 'rejected'
  /** 审核人 */
  reviewedBy?: string
  /** 审核备注 */
  reviewNote?: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt?: string
}

/** 目标定义 */
export interface Goal {
  id: number
  /** 目标名称 */
  name: string
  /** 指标Key */
  metricKey: 'new_contracts' | 'happiness_actions' | 'iron_triangle' | 'valid_leads'
  /** 目标值 */
  targetValue: number
  /** 当前完成值 */
  currentValue: number
  /** 完成百分比 */
  percentage: number
  /** 目标周期 */
  period: 'daily' | 'weekly' | 'monthly' | 'total'
  /** 目标归属 - 个人/战队/战区 */
  scope: 'personal' | 'team' | 'zone'
  /** 归属ID */
  scopeId: number
}

/** 排名条目 */
export interface RankingItem {
  /** 排名 */
  rank: number
  /** 名称（人名/队名/战区名） */
  name: string
  /** 头像 */
  avatar?: string
  /** 所属战队 */
  teamName?: string
  /** 得分 */
  score: number
  /** 变化趋势：上升/下降/不变 */
  trend: 'up' | 'down' | 'same'
  weeklyMarketingActual?: number
  weeklyMarketingTarget?: number
  weeklyDeliveryActual?: number
  weeklyDeliveryTarget?: number
}

/** 双轨动力战队状态卡片 */
export interface DualTrackTeam {
  teamId?: number
  teamName: string
  leader: string
  marketingActual: number
  marketingTarget: number
  marketingRate: number
  deliveryActual: number
  deliveryTarget: number
  deliveryRate: number
  validLeadsActual?: number
  validLeadsTarget?: number
  validLeadsRate?: number
  statusLight: 'red' | 'yellow' | 'green'
}

/** 大屏看板数据 */
export interface DashboardData {
  /** 四大指标汇总 */
  kpiSummary: {
    /** 新签合同总额（万元） */
    newContracts: { value: number; target: number; percentage: number }
    /** 幸福动作总次数 */
    happinessActions: { value: number; target: number; percentage: number }
    /** 铁三角协作总次数 */
    ironTriangle: { value: number; target: number; percentage: number }
    /** 有效线索总数 */
    validLeads: { value: number; target: number; percentage: number }
  }
  /** 战区排名列表 */
  zoneRanking: RankingItem[]
  /** 周趋势数据 */
  weeklyTrend: {
    dates: string[]
    newContracts: number[]
    newContractsTarget?: number[]
    newContractsChallengeTarget?: number[]
    happinessActions: number[]
    ironTriangle: number[]
    validLeads: number[]
  }
  /** 实时播报 */
  liveFeed: LiveFeedItem[]
  /** 英雄榜TOP10 */
  heroBoard: RankingItem[]
  marketingHeroBoard?: RankingItem[]
  deliveryHeroBoard?: RankingItem[]
  /** 客户幸福之星榜TOP10 */
  happinessBoard?: RankingItem[]
  /** 铁三角协作标杆榜TOP10 */
  triangleBoard?: RankingItem[]
  /** 线索先锋榜TOP10 */
  leadsBoard?: RankingItem[]
  /** 战区内部战队相互PK数据 */
  zoneTeamsPK?: Record<string, RankingItem[]>
  /** 九宫格双轨战队数据 */
  dualTrackTeams?: DualTrackTeam[]
  /** 百日倒计时 */
  countdown: number
  /** 活动名称 */
  campaignName: string
  /** 活动口号 */
  slogan: string
  /** 销售漏斗数据 */
  leadsFunnel?: FunnelItem[]
  /** 50万以上重特大攻坚项目 */
  importantProjects?: ImportantProjectItem[]
}

/** 销售漏斗明细 */
export interface FunnelItem {
  /** 推进阶段：5%、10%等 */
  stage: string
  /** 阶段名称：潜在需求信息等 */
  name: string
  /** 商机总个数 */
  count: number
  /** 本阶段到下一阶段转化率 */
  rate: number
}

/** 50万以上重特大攻坚项目明细 */
export interface ImportantProjectItem {
  id: string
  /** 项目名称 */
  name: string
  /** 客户名称 */
  customerName?: string
  /** 金额（万元） */
  amount: number
  /** 当前阶段进度百分比 */
  progress: number
}

/** 实时播报条目 */
export interface LiveFeedItem {
  id: number
  /** 播报内容 */
  content: string
  /** 播报时间 */
  time: string
  /** 播报类型 */
  type: 'contract' | 'achievement' | 'milestone' | 'info'
}

/** 登录请求 */
export interface LoginRequest {
  /** 手机号 */
  phone: string
  /** 密码 */
  password: string
}

/** 登录响应 */
export interface LoginResponse {
  /** JWT Token */
  token: string
  /** 用户信息 */
  user: User
}

/** API响应通用结构 */
export interface ApiResponse<T = unknown> {
  /** 状态码 */
  code: number
  /** 提示消息 */
  message: string
  /** 响应数据 */
  data: T
}

/** 分页请求参数 */
export interface PaginationParams {
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  list: T[]
  /** 总数 */
  total: number
  /** 当前页 */
  page: number
  /** 每页条数 */
  pageSize: number
}

/** 级联作战数据（公司、战队、个人） */
export interface MyStatsResponse {
  company_stats: {
    newContracts: { value: number; target: number; percentage: number }
    happinessActions: { value: number; target: number; percentage: number }
    ironTriangle: { value: number; target: number; percentage: number }
    validLeads: { value: number; target: number; percentage: number }
  }
  team_stats: {
    team_id: number
    team_name: string
    zone_name: string
    status_light: 'red' | 'yellow' | 'green'
    marketing_actual: number
    marketing_target: number
    marketing_percentage: number
    delivery_actual: number
    delivery_target: number
    delivery_percentage: number
    happiness_actions: number
    iron_triangle: number
    valid_leads: number
  } | null
  personal_stats: Array<{
    goal_type: string
    goal_name: string
    base_target: number
    challenge_target: number
    actual: number
    base_percentage: number
    challenge_percentage: number
    unit: string
  }>
  zone_teams_data?: Array<{
    zone_id: number
    zone_name: string
    teams: Array<{
      team_id: number
      team_name: string
      leader: string
      marketing_actual: number
      marketing_target: number
      marketing_rate: number
      delivery_actual: number
      delivery_target: number
      delivery_rate: number
      valid_leads_actual: number
      valid_leads_target: number
      valid_leads_rate: number
      status_light: 'red' | 'yellow' | 'green'
    }>
  }>
  user_meta?: {
    join_days: number
    total_reports: number
    report_rate: string
  }
}
