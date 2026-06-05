/**
 * 每日填报相关API
 */
import { get, post, put } from './client'
import type { DailyReport, PaginatedResponse, PaginationParams, WeeklyReport } from '@shared/types'

/** 提交每日填报 */
export function submitReport(data: Omit<DailyReport, 'id' | 'userId' | 'status' | 'createdAt'>) {
  return post<DailyReport>('/reports/submit', data)
}

/** 获取我的填报列表 */
export function getMyReports(params: PaginationParams) {
  return get<PaginatedResponse<DailyReport>>('/reports/mine', { params })
}

/** 获取指定日期的填报 */
export function getReportByDate(date: string) {
  return get<DailyReport>(`/reports/date/${date}`)
}

/** 更新填报记录 */
export function updateReport(id: number, data: Partial<DailyReport>) {
  return put<DailyReport>(`/reports/${id}`, data)
}

/** 审核填报（管理端） */
export function reviewReport(id: number, data: { status: 'approved' | 'rejected'; reviewNote?: string }) {
  return post(`/reports/${id}/review`, data)
}

/** 获取待审核填报列表（管理端） */
export function getPendingReports(params: PaginationParams) {
  return get<PaginatedResponse<DailyReport>>('/reports/pending', { params })
}

/** 获取团队填报列表（管理端） */
export function getTeamReports(params: PaginationParams & { teamId?: number; date?: string }) {
  return get<PaginatedResponse<DailyReport>>('/reports/team', { params })
}

/** 获取我的周复盘填报 (根据 start_date) */
export function getMyWeeklyReport(startDate: string) {
  return get<WeeklyReport>(`/reports/weekly/mine`, { params: { start_date: startDate } })
}

/** 提交或保存周复盘填报 */
export function saveWeeklyReport(data: any) {
  return post<WeeklyReport>(`/reports/weekly`, data)
}

/** 自动从播报系统提取该周的播报数据推荐文本 */
export function extractWeeklyBroadcasts(startDate: string) {
  return get<{ delivery_actual: string; sales_actual: string }>(`/reports/weekly/auto-extract`, { params: { start_date: startDate } })
}

/** 自动从 CRM 系统提取该周的业绩、进度和达成情况推荐文本 */
export function extractWeeklyCrmData(startDate: string) {
  return get<{
    delivery_actual: string;
    sales_actual: string;
    delivery_rate: string;
    sales_rate: string;
    delivery_highlights: string;
    sales_highlights: string;
    delivery_blockers: string;
    sales_blockers: string;
    delivery_support: string;
    sales_support: string;
    next_delivery_plan: string;
    next_sales_plan: string;
  }>(`/reports/weekly/auto-extract-crm`, { params: { start_date: startDate } })
}

/** 获取所有人的周复盘汇总列表 (管理端) */
export function getWeeklyReportsSummary(startDate: string, teamId?: number) {
  return get<WeeklyReport[]>(`/reports/weekly/summary`, { params: { start_date: startDate, team_id: teamId } })
}

