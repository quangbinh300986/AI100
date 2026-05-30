/**
 * 认证相关Hook
 */
import { useAuthStore } from '@shared/stores/authStore'
import { login as loginApi, logout as logoutApi } from '@shared/api/auth'
import type { LoginRequest } from '@shared/types'

/**
 * 认证Hook - 提供登录、退出、用户信息等
 */
export function useAuth() {
  const { user, isLoggedIn, loading, setAuth, clearAuth, setLoading } = useAuthStore()

  /** 登录 */
  const login = async (data: LoginRequest) => {
    setLoading(true)
    try {
      const res = await loginApi(data)
      if (res.code === 0 && res.data) {
        setAuth(res.data.user, res.data.token)
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setLoading(false)
    }
  }

  /** 退出登录 */
  const logout = async () => {
    try {
      await logoutApi()
    } finally {
      clearAuth()
    }
  }

  return {
    user,
    isLoggedIn,
    loading,
    login,
    logout,
  }
}
