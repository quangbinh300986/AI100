/**
 * 个人中心页面
 */
import { useState, useEffect } from 'react'
import { List, Dialog, Toast, DotLoading } from 'antd-mobile'
import {
  UserOutline,
  SetOutline,
  ExclamationCircleOutline,
  RightOutline,
} from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import { getMyStats } from '@shared/api/dashboard'
import type { MyStatsResponse } from '@shared/types'

export default function Profile() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuth()
  const [stats, setStats] = useState<MyStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getMyStats()
      .then((res) => {
        if (active && res) {
          setStats(res)
        }
      })
      .catch((err) => {
        console.error('获取级联作战数据失败:', err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  /** 退出登录 */
  const handleLogout = () => {
    Dialog.confirm({
      content: '确定要退出登录吗？',
      confirmText: '确定',
      cancelText: '取消',
      onConfirm: () => {
        clearAuth()
        Toast.show({ icon: 'success', content: '已退出登录' })
        navigate('/m/login', { replace: true })
      },
    })
  }

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <DotLoading color="primary" />
        <span style={{ marginTop: 12, color: '#999', fontSize: 14 }}>加载个人信息中...</span>
      </div>
    )
  }

  const zoneName = stats?.team_stats?.zone_name || '未分配战区'
  const teamName = stats?.team_stats?.team_name || '未分配战队'
  const joinDays = stats?.user_meta?.join_days ?? 0
  const totalReports = stats?.user_meta?.total_reports ?? 0
  const reportRate = stats?.user_meta?.report_rate ?? '0.0%'

  return (
    <div className="page-content" style={{ paddingTop: 0 }}>
      {/* 用户信息头部 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1677ff, #4096ff)',
          padding: '40px 20px 30px',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderRadius: '0 0 20px 20px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 'bold',
          }}
        >
          {(user?.name || '冲')[0]}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{user?.name || '冲刺队员'}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
            {zoneName} · {teamName}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            {user?.position || '冲刺队员'} | {user?.phone || '暂无手机号'}
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          margin: '16px 0',
        }}
      >
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1677ff' }}>
            {joinDays}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>参战天数</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>
            {totalReports}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>填报次数</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#faad14' }}>
            {reportRate}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>填报率</div>
        </div>
      </div>

      {/* 功能列表 */}
      <div className="card" style={{ padding: 0 }}>
        <List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
          <List.Item
            prefix={<UserOutline style={{ fontSize: 20, color: '#1677ff' }} />}
            extra={<RightOutline />}
            onClick={() => {
              Toast.show({ content: '详细个人信息请在管理端查看和修改' })
            }}
          >
            个人信息
          </List.Item>
          <List.Item
            prefix={<ExclamationCircleOutline style={{ fontSize: 20, color: '#52c41a' }} />}
            extra={<RightOutline />}
            onClick={() => {
              Toast.show({ content: '历史填报明细可在每日填报页面查看或补报' })
            }}
          >
            我的填报记录
          </List.Item>
          <List.Item
            prefix={<SetOutline style={{ fontSize: 20, color: '#faad14' }} />}
            extra={<RightOutline />}
            onClick={() => {
              Toast.show({ content: '修改密码功能请在管理端设置页面进行' })
            }}
          >
            修改密码
          </List.Item>
        </List>
      </div>

      {/* 退出登录 */}
      <div className="card" style={{ padding: 0, marginTop: 16 }}>
        <List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
          <List.Item
            onClick={handleLogout}
            style={{ textAlign: 'center', color: '#ff4d4f' }}
          >
            退出登录
          </List.Item>
        </List>
      </div>

      {/* 版本信息 */}
      <div style={{ textAlign: 'center', color: '#ccc', fontSize: 12, marginTop: 24 }}>
        百日奋战管理系统 v1.0.0
      </div>
    </div>
  )
}
