import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import WeeklyReports from './pages/WeeklyReports'
import Goals from './pages/Goals'
import Settings from './pages/Settings'
import AdminLayout from './layouts/AdminLayout'
import { useAuthStore } from '@shared/stores/authStore'

// 路由拦截器组件
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn)
  return isLoggedIn ? <>{children}</> : <Navigate to="/admin/login" replace />
}

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          {/* 登录页面 */}
          <Route path="/admin/login" element={<Login />} />

          {/* 布局页（受保护） */}
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <AdminLayout />
              </PrivateRoute>
            }
          >
            {/* 子页面路由 */}
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="reports" element={<Reports />} />
            <Route path="weekly-reports" element={<WeeklyReports />} />
            <Route path="goals" element={<Goals />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* 捕获未定义路径 */}
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
