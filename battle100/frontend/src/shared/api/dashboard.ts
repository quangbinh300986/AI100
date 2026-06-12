/**
 * 大屏看板数据API
 */
import { get, post } from './client'
import type { DashboardData, RankingItem, MyStatsResponse } from '@shared/types'

/** 获取大屏全部数据 */
export function getDashboardData(params?: { team_id?: number; third_class_bar?: string; is_lying_flat?: boolean }) {
  return get<DashboardData>('/dashboard/overview', { params })
}

/** 获取KPI汇总数据 */
export function getKpiSummary() {
  return get<DashboardData['kpiSummary']>('/dashboard/kpi')
}

/** 获取战区排名 */
export function getZoneRanking() {
  return get<RankingItem[]>('/dashboard/zone-ranking')
}

/** 获取周趋势数据 */
export function getWeeklyTrend() {
  return get<DashboardData['weeklyTrend']>('/dashboard/weekly-trend')
}

/** 获取实时播报 */
export function getLiveFeed() {
  return get<DashboardData['liveFeed']>('/dashboard/live-feed')
}

/** 获取英雄榜 */
export function getHeroBoard() {
  return get<RankingItem[]>('/dashboard/hero-board')
}

/** 获取当前登录用户的多级作战数据 */
export function getMyStats() {
  return get<MyStatsResponse>('/dashboard/my-stats')
}

/** 获取战队多维度精细化指标 */
export function getTeamDetailedMetrics(teamId: number) {
  return get<any>(`/dashboard/team/${teamId}/metrics`)
}

/** 获取个人排行榜（支持合同额、单数、幸福动作、线索等维度） */
export function getPersonalRanking(params?: { start_date?: string; end_date?: string; rank_by?: string; limit?: number }) {
  // 修正 Axios GET 请求的传参，使用 { params } 包裹以正确传递 Query 参数并保留请求头配置
  return get<{ rank_by: string; items: any[] }>('/ranking/personal', { params })
}

/** 获取战队排行榜 */
export function getTeamRanking(params?: { start_date?: string; end_date?: string; rank_by?: string }) {
  // 修正 Axios GET 请求的传参，使用 { params } 包裹以正确传递 Query 参数并保留请求头配置
  return get<{ rank_by: string; items: any[] }>('/ranking/team', { params })
}

/** 获取全公司 KPI 明细数据 */
export function getCompanyKpiDetail(params: {
  kpi_type: string
  team_id?: number
  week?: number
  reporter_name?: string
  keyword?: string
}) {
  return get<any>('/dashboard/company-kpi-detail', { params })
}

/** 点赞/取消点赞 KPI 明细记录 */
export function toggleKpiLike(data: { target_id: number; target_type: string }) {
  return post<any>('/broadcast/kpi/like', data)
}

/** 对 KPI 明细发表评论 */
export function addKpiComment(data: { target_id: number; target_type: string; content: string }) {
  return post<any>('/broadcast/kpi/comment', data)
}

/** 获取 KPI 明细的历史评论列表 */
export function getKpiComments(params: { target_id: number; target_type: string }) {
  return get<any[]>('/broadcast/kpi/comments', { params })
}

