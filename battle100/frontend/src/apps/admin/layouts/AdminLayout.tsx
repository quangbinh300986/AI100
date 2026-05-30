import React, { useState } from 'react'
import { Layout, Menu, Button, Avatar, Dropdown, Space, theme } from 'antd'
import {
  DashboardOutlined,
  CheckSquareOutlined,
  FileExcelOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@shared/stores/authStore'

const { Header, Sider, Content } = Layout

const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clearAuth } = useAuthStore()
  
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  // 退出登录
  const handleLogout = () => {
    clearAuth()
    navigate('/admin/login')
  }

  // 映射当前路径至菜单激活项
  const getSelectedKey = () => {
    const path = location.pathname
    if (path.includes('/admin/dashboard')) return '1'
    if (path.includes('/admin/reports')) return '2'
    if (path.includes('/admin/goals')) return '3'
    return '1'
  }

  // 菜单点击
  const handleMenuClick = (info: { key: string }) => {
    switch (info.key) {
      case '1':
        navigate('/admin/dashboard')
        break
      case '2':
        navigate('/admin/reports')
        break
      case '3':
        navigate('/admin/goals')
        break
    }
  }

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  return (
    <Layout className="admin-layout">
      {/* 侧边菜单 */}
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        <div className="logo-area">
          {collapsed ? '⚔️' : '⚔️ 百日奋战后台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          onClick={handleMenuClick}
          items={[
            {
              key: '1',
              icon: <DashboardOutlined />,
              label: '作战仪表盘',
            },
            {
              key: '2',
              icon: <CheckSquareOutlined />,
              label: '填报审核',
            },
            {
              key: '3',
              icon: <FileExcelOutlined />,
              label: '目标官与目标导入',
            },
          ]}
        />
      </Sider>

      {/* 右侧框架 */}
      <Layout>
        {/* 顶部状态栏 */}
        <Header className="admin-header" style={{ padding: 0, background: colorBgContainer }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />
          <div style={{ marginRight: 24 }}>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.realName || user?.username || '管理员'}</span>
              </Space>
            </Dropdown>
          </div>
        </Header>

        {/* 内容主体 */}
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            overflowY: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AdminLayout
