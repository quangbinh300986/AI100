import React, { useState, useEffect } from 'react'
import { Layout, Menu, Button, Avatar, Dropdown, Space, theme, message } from 'antd'
import {
  DashboardOutlined,
  CheckSquareOutlined,
  FileExcelOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  LogoutOutlined,
  UserOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@shared/stores/authStore'
import { get } from '@shared/api/client'

const { Header, Sider, Content } = Layout

const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clearAuth, updateUser } = useAuthStore()
  const [initializing, setInitializing] = useState(true)
  
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  // 初始化拉取用户信息，解决刷新丢失状态导致白屏的 Bug
  useEffect(() => {
    const initUser = async () => {
      if (user) {
        setInitializing(false)
        return
      }

      const token = localStorage.getItem('battle100_token')
      if (token) {
        try {
          // 由于后端直接返回了用户对象本身，我们自适应读取
          const res = await get<any>('/auth/me')
          if (res) {
            // 如果后端封装了 code, data，则读取 data，否则直接以返回的对象为用户数据
            const userData = res.code === 0 && res.data ? res.data : res
            if (userData && userData.role) {
              updateUser(userData)
            } else {
              clearAuth()
              navigate('/admin/login')
            }
          } else {
            clearAuth()
            navigate('/admin/login')
          }
        } catch (err) {
          clearAuth()
          navigate('/admin/login')
        }
      } else {
        clearAuth()
        navigate('/admin/login')
      }
      setInitializing(false)
    }

    initUser()
  }, [user, clearAuth, updateUser, navigate])

  // 任何成功登录的用户都允许留在 PC 端，其可访问的页面由动态分配的权限标识控制
  const hasAccess = !!user

  // 路由守护与越权拦截
  useEffect(() => {
    if (initializing) return

    // 路由鉴权：如果用户强行输入 URL 访问了无权查看的子页面，强制重定向到仪表盘
    const path = location.pathname
    const userPerms = (user as any)?.permissions
    
    const menuDefaultRoles: Record<string, string[]> = {
      '2': ['admin', 'team_leader'],
      '3': ['admin', 'target_officer', 'digital_specialist'],
      '4': ['admin']
    }
    
    const checkPermission = (menuKey: string, permName: string) => {
      // 1. 系统管理员(admin)默认拥有所有页面的强行访问权，防止管理员误操作将自己锁死在后台之外
      if (user?.role === 'admin') {
        return true
      }
      // 2. 如果后端没有下发 permissions 字段，或者下发的数据为空（数据库为空未初始化），使用默认角色判定
      if (!userPerms || userPerms.length === 0) {
        const allowedRoles = menuDefaultRoles[menuKey] || []
        return allowedRoles.includes(user?.role || '')
      }
      // 3. 否则按照动态配置的权限判定
      return userPerms.includes(permName)
    }
    
    if (path.includes('/admin/reports') && !checkPermission('2', 'view_reports')) {
      message.warning('无权访问填报审核页面')
      navigate('/admin/dashboard')
    } else if (path.includes('/admin/goals') && !checkPermission('3', 'view_goals')) {
      message.warning('无权访问目标管理页面')
      navigate('/admin/dashboard')
    } else if (path.includes('/admin/settings') && !checkPermission('4', 'view_settings')) {
      message.warning('无权访问系统设置页面')
      navigate('/admin/dashboard')
    }
  }, [user, location.pathname, navigate, initializing])

  if (initializing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#001529', color: '#fff' }}>
        <h2>正在初始化用户信息...</h2>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!hasAccess) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#001529', color: '#fff' }}>
        <h2>正在跳转至移动端...</h2>
      </div>
    )
  }

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
    if (path.includes('/admin/settings')) return '4'
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
      case '4':
        navigate('/admin/settings')
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

  // 映射菜单 key 到默认兜底角色
  const menuDefaultRoles: Record<string, string[]> = {
    '1': ['admin', 'target_officer', 'digital_specialist', 'team_leader'],
    '2': ['admin', 'team_leader'],
    '3': ['admin', 'target_officer', 'digital_specialist'],
    '4': ['admin']
  }

  // 映射菜单 key 到动态权限标识
  const menuPermissionMap: Record<string, string> = {
    '1': 'view_dashboard',
    '2': 'view_reports',
    '3': 'view_goals',
    '4': 'view_settings'
  }

  // 基于动态权限与默认角色双轨兜底渲染菜单项
  const sidebarItems = [
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
    {
      key: '4',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
  ].filter(item => {
    // 1. 系统管理员(admin)默认拥有全部侧边菜单的查看和使用权，防止误勾选导致管理员账号锁死
    if (user?.role === 'admin') {
      return true
    }

    const userPerms = (user as any)?.permissions
    
    // 2. 如果后端未下发，或下发的权限列表为空 (比如数据库刚建表尚未插入数据，或配置记录被清空)，均走老系统的默认角色权限兜底，确保菜单展示正常
    if (!userPerms || userPerms.length === 0) {
      const allowedRoles = menuDefaultRoles[item.key] || []
      return allowedRoles.includes(user?.role || '')
    }

    // 3. 否则严格以数据库中读取的动态权限控制为准
    const perm = menuPermissionMap[item.key]
    return userPerms.includes(perm)
  })

  return (
    <Layout className="admin-layout" style={{ minHeight: '100vh' }}>
      {/* 侧边菜单 */}
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        <div className="logo-area" style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {collapsed ? '⚔️' : '⚔️ 百日奋战后台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          onClick={handleMenuClick}
          items={sidebarItems}
        />
      </Sider>

      {/* 右侧框架 */}
      <Layout>
        {/* 顶部状态栏 */}
        <Header className="admin-header" style={{ padding: 0, background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', zIndex: 1 }}>
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
                <span>{user?.realName || user?.name || user?.username || '管理员'}</span>
                <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
                  ({user?.role === 'admin' ? '系统管理员' : user?.role === 'target_officer' ? '目标官' : user?.role === 'digital_specialist' ? '数字专员' : '战队长'})
                </span>
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
