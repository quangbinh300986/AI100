import React, { useState } from 'react'

import { Form as AntForm, Input as AntInput, Button as AntButton, message as antMessage } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin } from '@shared/api/auth'
import { useAuthStore } from '@shared/stores/authStore'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((state) => state.setAuth)

  // 处理登录
  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      // 请求接口
      const response = await apiLogin({
        phone: values.phone,
        password: values.password,
      })
      
      // FastAPI的接口可能返回 { access_token, refresh_token }
      // 后端 models.User 数据可以通过调用 /auth/me 获取
      // 这里如果后端login接口只返回了 token，我们可以在前端设置 token 并且造一个 mock 用户，或者直接配合 store
      // 让我们假设 apiLogin 返回的直接是后端数据
      const data = response as any
      if (data && data.access_token) {
        // 创建一个临时管理员用户，之后会自动拉取 /me
        const mockUser = {
          id: 1,
          username: 'admin',
          realName: '中地顾问管理员',
          phone: values.phone,
          role: 'admin' as const,
          isActive: true,
          createdAt: new Date().toISOString(),
        }
        setAuth(mockUser, data.access_token)
        antMessage.success('登录成功')
        navigate('/admin/dashboard')
      } else {
        antMessage.error('登录失败，未获取到有效凭证')
      }
    } catch (err: any) {
      console.error(err)
      antMessage.error(err?.response?.data?.detail || '登录失败，请检查账号密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1890ff, #00d4ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <span style={{ fontSize: 28, color: '#fff', fontWeight: 800 }}>战</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 24, color: '#1a1a1a' }}>百日奋战 · 管理后台</h2>
          <p style={{ color: '#8c8c8c', marginTop: 8 }}>攻坚一百天，亮剑破六千</p>
        </div>

        <AntForm
          name="login_form"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          size="large"
        >
          <AntForm.Item
            name="phone"
            rules={[
              { required: true, message: '请输入手机号!' },
              { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确!' }
            ]}
          >
            <AntInput
              prefix={<UserOutlined style={{ color: 'rgba(0,0,0,.25)' }} />}
              placeholder="管理员手机号"
            />
          </AntForm.Item>

          <AntForm.Item
            name="password"
            rules={[{ required: true, message: '请输入密码!' }]}
          >
            <AntInput.Password
              prefix={<LockOutlined style={{ color: 'rgba(0,0,0,.25)' }} />}
              placeholder="密码"
            />
          </AntForm.Item>

          <AntForm.Item>
            <AntButton
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{
                background: 'linear-gradient(135deg, #1890ff, #0050b3)',
                borderColor: '#1890ff',
                height: 48,
              }}
            >
              安全登录
            </AntButton>
          </AntForm.Item>
        </AntForm>
      </div>
    </div>
  )
}

export default Login
