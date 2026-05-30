/**
 * 移动端应用 - 路由配置
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MobileLayout from './layouts/MobileLayout'
import Login from './pages/Login'
import Home from './pages/Home'
import DailyReport from './pages/DailyReport'
import MyGoals from './pages/MyGoals'
import TeamRanking from './pages/TeamRanking'
import Profile from './pages/Profile'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 登录页 - 无底部导航 */}
        <Route path="/m/login" element={<Login />} />
        
        {/* 主布局 - 带底部TabBar */}
        <Route path="/m" element={<MobileLayout />}>
          <Route index element={<Navigate to="/m/home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="report" element={<DailyReport />} />
          <Route path="goals" element={<MyGoals />} />
          <Route path="ranking" element={<TeamRanking />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* 默认重定向到移动端首页 */}
        <Route path="*" element={<Navigate to="/m/home" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
