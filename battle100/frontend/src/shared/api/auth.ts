/**
 * 认证相关API
 */
import { post } from './client'
import type { LoginRequest, LoginResponse, User } from '@shared/types'

/** 用户登录 */
export function login(data: LoginRequest) {
  return post<LoginResponse>('/auth/login', data)
}

/** 获取当前用户信息 */
export function getCurrentUser() {
  return post<User>('/auth/me')
}

/** 退出登录 */
export function logout() {
  return post('/auth/logout')
}

/** 修改密码 */
export function changePassword(data: { oldPassword: string; newPassword: string }) {
  return post('/auth/change-password', data)
}
