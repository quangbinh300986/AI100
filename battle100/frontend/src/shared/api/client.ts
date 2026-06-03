/**
 * Axios HTTP客户端封装
 * 包含请求/响应拦截器、Token管理、基础URL配置
 */
import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { getToken, removeToken } from '@shared/utils'
import type { ApiResponse } from '@shared/types'

/** 创建Axios实例 */
const client: AxiosInstance = axios.create({
  // 基础URL，开发环境会被Vite代理
  baseURL: '/api/v1',
  // 请求超时时间：300秒 (防止钉钉同步等长耗时请求超时)
  timeout: 300000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/** 请求拦截器 - 自动附加Token */
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/** 响应拦截器 - 统一处理错误 */
client.interceptors.response.use(
  (response) => {
    // 直接返回响应数据
    return response.data
  },
  (error) => {
    if (error.response) {
      const { status } = error.response
      switch (status) {
        case 401:
          // 如果是登录请求本身报401（账号密码错误），直接抛给页面处理以显示提示，不应执行Token清除与页面重载
          const requestUrl = error.config?.url || ''
          if (requestUrl.includes('/auth/login') || requestUrl.includes('/auth/dingtalk-login')) {
            break
          }
          // Token过期或无效，清除并跳转登录
          removeToken()
          // 根据当前路径判断跳转哪个登录页
          if (window.location.pathname.startsWith('/m/')) {
            window.location.href = '/m/login'
          } else if (window.location.pathname.startsWith('/admin/')) {
            window.location.href = '/admin/login'
          }
          break
        case 403:
          console.error('权限不足')
          break
        case 404:
          console.error('请求资源不存在')
          break
        case 500:
          console.error('服务器内部错误')
          break
        default:
          console.error(`请求错误：${status}`)
      }
    } else if (error.request) {
      console.error('网络异常，请检查网络连接')
    }
    return Promise.reject(error)
  }
)

/** 封装GET请求 */
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  return client.get(url, config)
}

/** 封装POST请求 */
export async function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  return client.post(url, data, config)
}

/** 封装PUT请求 */
export async function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  return client.put(url, data, config)
}

/** 封装DELETE请求 */
export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  return client.delete(url, config)
}

export default client
