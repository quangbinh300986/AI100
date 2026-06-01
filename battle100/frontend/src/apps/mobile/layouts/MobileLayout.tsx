/**
 * 移动端布局组件 - 底部TabBar导航
 */
import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { TabBar } from 'antd-mobile'
import {
  AppOutline,
  UnorderedListOutline,
  AddCircleOutline,
  HistogramOutline,
  UserOutline,
} from 'antd-mobile-icons'
import { useAuthStore } from '@shared/stores/authStore'
import { get } from '@shared/api/client'

/** TabBar配置项 */
const tabs = [
  { key: '/m/home', title: '首页', icon: <AppOutline /> },
  { key: '/m/goals', title: '目标', icon: <UnorderedListOutline /> },
  { key: '/m/report', title: '填报', icon: <AddCircleOutline /> },
  { key: '/m/ranking', title: '排名', icon: <HistogramOutline /> },
  { key: '/m/profile', title: '我的', icon: <UserOutline /> },
]

export default function MobileLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clearAuth, updateUser } = useAuthStore()
  const [initializing, setInitializing] = useState(true)

  // 移动端初始化获取登录用户信息，防止直接刷新页面或通过免登进入时 user 状态为 null 导致姓名等字段空白
  useEffect(() => {
    const initUser = async () => {
      if (user) {
        setInitializing(false)
        return
      }

      const token = localStorage.getItem('battle100_token')
      if (token) {
        try {
          const res = await get<any>('/auth/me')
          if (res) {
            const userData = res.code === 0 && res.data ? res.data : res
            if (userData) {
              updateUser(userData)
            } else {
              clearAuth()
              navigate('/m/login')
            }
          } else {
            clearAuth()
            navigate('/m/login')
          }
        } catch (err) {
          clearAuth()
          navigate('/m/login')
        }
      } else {
        clearAuth()
        navigate('/m/login')
      }
      setInitializing(false)
    }

    initUser()
  }, [user, clearAuth, updateUser, navigate])

  if (initializing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f5f5', color: '#666' }}>
        <span>正在载入用户信息...</span>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 页面内容区域 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </div>

      {/* 底部导航栏 */}
      <div
        style={{
          borderTop: '1px solid var(--border-color)',
          backgroundColor: '#fff',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <TabBar
          activeKey={location.pathname}
          onChange={(key) => navigate(key)}
          style={{ '--adm-color-primary': '#1677ff' } as React.CSSProperties}
        >
          {tabs.map((tab) => (
            <TabBar.Item key={tab.key} icon={tab.icon} title={tab.title} />
          ))}
        </TabBar>
      </div>
    </div>
  )
}
