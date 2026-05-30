/**
 * 每日填报相关API
 */
import { get, post, put } from './client'
import type { DailyReport, PaginatedResponse, PaginationParams } from '@shared/types'

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
