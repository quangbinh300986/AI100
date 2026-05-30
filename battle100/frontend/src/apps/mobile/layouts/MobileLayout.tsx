/**
 * 移动端布局组件 - 底部TabBar导航
 */
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { TabBar } from 'antd-mobile'
import {
  AppOutline,
  UnorderedListOutline,
  AddCircleOutline,
  HistogramOutline,
  UserOutline,
} from 'antd-mobile-icons'

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
