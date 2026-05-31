import React, { useState, useEffect } from 'react'
import { Form as AntForm, Input as AntInput, Button as AntButton, message as antMessage, Spin } from 'antd'
import { UserOutlined, LockOutlined, LoadingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin } from '@shared/api/auth'
import { get, post } from '@shared/api/client'
import { useAuthStore } from '@shared/stores/authStore'
import { setToken, removeToken } from '@shared/utils'
import dd from 'dingtalk-jsapi'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [ddLoading, setDdLoading] = useState(false)
  const setAuth = useAuthStore((state) => state.setAuth)
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn)

  /** 钉钉免密登录流程 */
  const handleDingTalkLogin = async () => {
    setDdLoading(true)
    try {
      const ddApi = dd as any
      ddApi.ready(async () => {
        try {
          const corpId = 'dingdaec913f1d2b741235c2f4657eb6378f'
          ddApi.runtime.permission.requestAuthCode({
            corpId: corpId,
            onSuccess: async (result: { code: string }) => {
              try {
                // 请求后端免登
                const res = await post<any>('/auth/dingtalk-login', { auth_code: result.code })
                const tokenData = res?.data ? res.data : res
                const accessToken = tokenData.access_token
                
                if (accessToken) {
                  setToken(accessToken)
                  localStorage.setItem('battle100_token', accessToken)
                  
                  // 获取用户信息
                  const userRes = await get<any>('/auth/me')
                  const userData = userRes.code === 0 && userRes.data ? userRes.data : userRes
                  
                  if (userData && userData.role) {
                    setAuth(userData, accessToken)
                    antMessage.success('免密登录成功')
                    navigate('/admin/dashboard')
                  } else {
                    removeToken()
                    localStorage.removeItem('battle100_token')
                    antMessage.error('获取用户信息失败')
                    setDdLoading(false)
                  }
                } else {
                  throw new Error('未返回有效的Token')
                }
              } catch (innerErr: any) {
                console.error('免登后处理失败', innerErr)
                removeToken()
                localStorage.removeItem('battle100_token')
                const errMsg = innerErr?.response?.data?.detail || innerErr?.message || '未知校验错误'
                antMessage.error(`免密登录绑定失败: ${errMsg}`)
                setDdLoading(false)
              }
            },
            onFail: (err: any) => {
              console.error('获取钉钉授权码失败', err)
              antMessage.error(`钉钉授权码获取失败: ${JSON.stringify(err) || '未知错误'}`)
              setDdLoading(false)
            }
          })
        } catch (readyErr: any) {
          console.error('钉钉 Ready 初始化错误', readyErr)
          antMessage.error(`Ready初始化异常: ${readyErr.message}`)
          setDdLoading(false)
        }
      })
    } catch (e: any) {
      console.error('钉钉免登引导异常', e)
      antMessage.error(`引导失败: ${e.message}`)
      setDdLoading(false)
    }
  }

  // 探测钉钉运行环境
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    const isDD = ua.includes('dingtalk')
    
    if (isDD && !isLoggedIn) {
      handleDingTalkLogin()
    }
  }, [isLoggedIn])

  // 处理登录
  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      // 请求接口
      const response = await apiLogin({
        phone: values.phone,
        password: values.password,
      })
      
      const data = response as any
      if (data && data.access_token) {
        setToken(data.access_token)
        localStorage.setItem('battle100_token', data.access_token)
        
        try {
          // 实时请求真正的用户信息并更新 Store 状态
          const userRes = await get<any>('/auth/me')
          const userData = userRes.code === 0 && userRes.data ? userRes.data : userRes
          
          if (userData && userData.role) {
            setAuth(userData, data.access_token)
            antMessage.success('登录成功')
            navigate('/admin/dashboard')
          } else {
            removeToken()
            localStorage.removeItem('battle100_token')
            antMessage.error('获取用户信息失败')
          }
        } catch (meErr) {
          removeToken()
          localStorage.removeItem('battle100_token')
          antMessage.error('初始化用户信息失败')
        }
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

  if (ddLoading) {
    const antIcon = <LoadingOutlined style={{ fontSize: 40, color: '#1890ff' }} spin />
    return (
      <div 
        className="login-container" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '100vh', 
          background: '#f0f2f5' 
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <Spin indicator={antIcon} style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, color: '#1a1a1a', fontWeight: 600 }}>正在通过钉钉免登安全登录后台...</h3>
          <p style={{ color: '#8c8c8c' }}>请稍候，系统正在校验您的管理员身份</p>
        </div>
      </div>
    )
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

          <AntForm.Item
            name="password"
            style={{ display: 'none' }}
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
