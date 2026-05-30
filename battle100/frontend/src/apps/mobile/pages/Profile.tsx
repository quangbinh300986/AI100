/**
 * 个人中心页面
 */
import { List, Avatar, Dialog, Toast } from 'antd-mobile'
import {
  UserOutline,
  SetOutline,
  ExclamationCircleOutline,
  RightOutline,
} from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'

/** 模拟用户信息 */
const userInfo = {
  name: '张三',
  phone: '138****8888',
  team: '雄鹰战队',
  zone: '华东战区',
  role: '销售专员',
  joinDays: 42,
  totalReports: 40,
  reportRate: '95.2%',
}

export default function Profile() {
  const navigate = useNavigate()

  /** 退出登录 */
  const handleLogout = () => {
    Dialog.confirm({
      content: '确定要退出登录吗？',
      confirmText: '确定',
      cancelText: '取消',
      onConfirm: () => {
        Toast.show({ icon: 'success', content: '已退出登录' })
        navigate('/m/login', { replace: true })
      },
    })
  }

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
          {userInfo.name[0]}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{userInfo.name}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
            {userInfo.zone} · {userInfo.team}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            {userInfo.role} | {userInfo.phone}
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
            {userInfo.joinDays}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>参战天数</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>
            {userInfo.totalReports}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>填报次数</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#faad14' }}>
            {userInfo.reportRate}
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
            onClick={() => {}}
          >
            个人信息
          </List.Item>
          <List.Item
            prefix={<ExclamationCircleOutline style={{ fontSize: 20, color: '#52c41a' }} />}
            extra={<RightOutline />}
            onClick={() => {}}
          >
            我的填报记录
          </List.Item>
          <List.Item
            prefix={<SetOutline style={{ fontSize: 20, color: '#faad14' }} />}
            extra={<RightOutline />}
            onClick={() => {}}
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
