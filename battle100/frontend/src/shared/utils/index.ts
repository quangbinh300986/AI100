/**
 * 百日奋战管理系统 - 工具函数
 */
import dayjs from 'dayjs'

/**
 * 格式化金额显示（万元）
 * @param value 金额数值
 * @param unit 是否显示单位
 */
export function formatMoney(value: number, unit = true): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}${unit ? '亿' : ''}`
  }
  return `${value.toLocaleString()}${unit ? '万' : ''}`
}

/**
 * 格式化百分比
 * @param value 小数或整数百分比
 */
export function formatPercent(value: number): string {
  if (value > 1) {
    return `${value.toFixed(1)}%`
  }
  return `${(value * 100).toFixed(1)}%`
}

/**
 * 格式化日期
 * @param date 日期字符串
 * @param format 格式化模板
 */
export function formatDate(date: string, format = 'YYYY-MM-DD'): string {
  return dayjs(date).format(format)
}

/**
 * 格式化日期时间
 * @param date 日期字符串
 */
export function formatDateTime(date: string): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

/**
 * 计算百日倒计时
 * @param endDate 活动结束日期
 */
export function getCountdown(endDate: string): number {
  const end = dayjs(endDate)
  const now = dayjs()
  const diff = end.diff(now, 'day')
  return Math.max(0, diff)
}

/**
 * 获取趋势颜色
 * @param trend 趋势方向
 */
export function getTrendColor(trend: 'up' | 'down' | 'same'): string {
  switch (trend) {
    case 'up':
      return '#52c41a'
    case 'down':
      return '#ff4d4f'
    default:
      return '#d9d9d9'
  }
}

/**
 * 获取趋势箭头符号
 * @param trend 趋势方向
 */
export function getTrendArrow(trend: 'up' | 'down' | 'same'): string {
  switch (trend) {
    case 'up':
      return '↑'
    case 'down':
      return '↓'
    default:
      return '-'
  }
}

/**
 * 获取排名标记
 * @param rank 排名
 */
export function getRankBadge(rank: number): string {
  switch (rank) {
    case 1:
      return '🥇'
    case 2:
      return '🥈'
    case 3:
      return '🥉'
    default:
      return `${rank}`
  }
}

/**
 * 存储Token到localStorage
 */
export function setToken(token: string): void {
  localStorage.setItem('battle100_token', token)
}

/**
 * 获取Token
 */
export function getToken(): string | null {
  return localStorage.getItem('battle100_token')
}

/**
 * 清除Token
 */
export function removeToken(): void {
  localStorage.removeItem('battle100_token')
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastTime = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastTime >= delay) {
      lastTime = now
      fn(...args)
    }
  }
}
