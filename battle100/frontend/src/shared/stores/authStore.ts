/**
 * Zustand认证状态管理
 */
import { create } from 'zustand'
import type { User } from '@shared/types'
import { getToken, setToken, removeToken } from '@shared/utils'

/** 认证状态接口 */
interface AuthState {
  /** 当前用户 */
  user: User | null
  /** JWT Token */
  token: string | null
  /** 是否已登录 */
  isLoggedIn: boolean
  /** 加载中 */
  loading: boolean

  /** 设置登录信息 */
  setAuth: (user: User, token: string) => void
  /** 清除登录信息 */
  clearAuth: () => void
  /** 更新用户信息 */
  updateUser: (user: Partial<User>) => void
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void
}

/** 创建认证状态Store */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getToken(),
  isLoggedIn: !!getToken(),
  loading: false,

  setAuth: (user: User, token: string) => {
    setToken(token)
    set({ user, token, isLoggedIn: true })
  },

  clearAuth: () => {
    removeToken()
    set({ user: null, token: null, isLoggedIn: false })
  },

  updateUser: (userData: Partial<User>) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...userData } : (userData as User),
    }))
  },

  setLoading: (loading: boolean) => {
    set({ loading })
  },
}))
