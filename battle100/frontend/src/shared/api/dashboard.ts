/**
 * 大屏看板数据API
 */
import { get } from './client'
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
  return get<{ rank_by: string; items: any[] }>('/ranking/personal', params)
}

/** 获取战队排行榜 */
export function getTeamRanking(params?: { start_date?: string; end_date?: string; rank_by?: string }) {
  return get<{ rank_by: string; items: any[] }>('/ranking/team', params)
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

