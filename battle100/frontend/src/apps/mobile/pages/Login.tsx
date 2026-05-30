/**
 * 移动端登录页
 * 暗蓝渐变背景 + 公司Logo + 百日奋战口号
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Toast, Space } from 'antd-mobile'
import { EyeInvisibleOutline, EyeOutline } from 'antd-mobile-icons'

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  /** 处理登录提交 */
  const handleLogin = async (values: { phone: string; password: string }) => {
    setLoading(true)
    try {
      // 模拟登录请求（后续接入真实API）
      console.log('登录信息：', values)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      Toast.show({ icon: 'success', content: '登录成功' })
      navigate('/m/home', { replace: true })
    } catch {
      Toast.show({ icon: 'fail', content: '登录失败，请重试' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a1929 0%, #0d2137 40%, #1677ff 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 32px',
      }}
    >
      {/* Logo区域 */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1677ff, #00d4ff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(22, 119, 255, 0.4)',
          }}
        >
          <span style={{ fontSize: 36, color: '#fff', fontWeight: 800 }}>百</span>
        </div>
        <h1
          style={{
            color: '#fff',
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 8,
            letterSpacing: 2,
          }}
        >
          百日奋战
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 14,
            letterSpacing: 4,
          }}
        >
          拼搏百日 决胜未来
        </p>
      </div>

      {/* 登录表单 */}
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)',
          borderRadius: 16,
          padding: '32px 24px',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        <Form
          onFinish={handleLogin}
          footer={
            <Button
              block
              type="submit"
              color="primary"
              size="large"
              loading={loading}
              style={{
                borderRadius: 8,
                height: 48,
                fontSize: 16,
                fontWeight: 600,
                background: 'linear-gradient(90deg, #1677ff, #00d4ff)',
                border: 'none',
              }}
            >
              登 录
            </Button>
          }
        >
          <Form.Item
            name="phone"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
            ]}
          >
            <Input
              placeholder="请输入手机号"
              clearable
              type="tel"
              maxLength={11}
              style={{
                '--font-size': '16px',
                '--color': '#fff',
                '--placeholder-color': 'rgba(255,255,255,0.4)',
              } as React.CSSProperties}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Input
                placeholder="请输入密码"
                clearable
                type={showPassword ? 'text' : 'password'}
                style={{
                  flex: 1,
                  '--font-size': '16px',
                  '--color': '#fff',
                  '--placeholder-color': 'rgba(255,255,255,0.4)',
                } as React.CSSProperties}
              />
              <Space style={{ cursor: 'pointer', paddingLeft: 8 }}>
                {showPassword ? (
                  <EyeOutline
                    onClick={() => setShowPassword(false)}
                    style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }}
                  />
                ) : (
                  <EyeInvisibleOutline
                    onClick={() => setShowPassword(true)}
                    style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }}
                  />
                )}
              </Space>
            </div>
          </Form.Item>
        </Form>

        {/* 忘记密码 */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            忘记密码？请联系管理员
          </span>
        </div>
      </div>

      {/* 底部信息 */}
      <div
        style={{
          position: 'fixed',
          bottom: 32,
          textAlign: 'center',
          color: 'rgba(255,255,255,0.3)',
          fontSize: 12,
        }}
      >
        © 2026 百日奋战管理系统
      </div>
    </div>
  )
}
