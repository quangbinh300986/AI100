/**
 * 大屏看板数据API
 */
import { get } from './client'
import type { DashboardData, RankingItem, MyStatsResponse } from '@shared/types'

/** 获取大屏全部数据 */
export function getDashboardData() {
  return get<DashboardData>('/dashboard/overview')
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
