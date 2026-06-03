/**
 * 移动端登录页
 * 整合钉钉静默免密登录与手机号密码常规登录
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Toast, Space } from 'antd-mobile'
import { EyeInvisibleOutline, EyeOutline } from 'antd-mobile-icons'
import { get, post } from '@shared/api/client'
import { useAuthStore } from '@shared/stores/authStore'
import { setToken, removeToken } from '@shared/utils'

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  const [isDingTalk, setIsDingTalk] = useState(false)
  const [ddLoading, setDdLoading] = useState(false)
  const authStore = useAuthStore()

  /** 钉钉免密登录流程 */
  const handleDingTalkLogin = async () => {
    setDdLoading(true)
    // 增加 4 秒超时强制兜底，防止任何 ready 失败或未捕获的报错导致页面永久卡死在登录加载中
    const timeoutTimer = setTimeout(() => {
      setDdLoading(false)
      console.warn('移动端钉钉免登检测超时，已自动降级至密码登录。')
    }, 4000)

    try {
      // 动态导入钉钉JSAPI以防止在非钉钉环境下自运行初始化抛出未捕获异常
      const ddModule = await import('dingtalk-jsapi')
      const ddApi = (ddModule.default || ddModule) as any
      ddApi.ready(async () => {
        try {
          const corpId = 'dingdaec913f1d2b741235c2f4657eb6378f'
          ddApi.runtime.permission.requestAuthCode({
            corpId: corpId,
            onSuccess: async (result: { code: string }) => {
              clearTimeout(timeoutTimer) // 成功，清除定时器
              try {
                // 请求后端钉钉登录接口
                const res = await post<any>('/auth/dingtalk-login', { auth_code: result.code })
                const tokenData = res?.data ? res.data : res
                const token = tokenData.access_token
                
                if (token) {
                  setToken(token)
                  // 拉取当前登录用户角色权限明细
                  const meRes = await get<any>('/auth/me')
                  const meData = meRes?.data ? meRes.data : meRes
                  
                  authStore.setAuth(meData, token)
                  Toast.show({ icon: 'success', content: '免登成功' })
                  navigate('/m/home', { replace: true })
                } else {
                  throw new Error('后端未返回有效的访问令牌')
                }
              } catch (innerErr: any) {
                console.error('免登网络校验失败', innerErr)
                removeToken()
                const errMsg = innerErr?.response?.data?.detail || innerErr?.message || '未知校验错误'
                Toast.show({
                  icon: 'fail',
                  content: `免密登录绑定失败: ${errMsg}`
                })
                setDdLoading(false)
              }
            },
            onFail: (err: any) => {
              clearTimeout(timeoutTimer) // 失败，清除定时器
              console.error('获取钉钉免登授权码失败', err)
              Toast.show({
                icon: 'fail',
                content: `钉钉授权码获取失败: ${JSON.stringify(err) || '未知错误'}`
              })
              setDdLoading(false)
            }
          })
        } catch (readyErr: any) {
          clearTimeout(timeoutTimer) // 异常，清除定时器
          console.error('钉钉 Ready 事件内部错误', readyErr)
          Toast.show({ icon: 'fail', content: `Ready初始化异常: ${readyErr.message}` })
          setDdLoading(false)
        }
      })
    } catch (e: any) {
      clearTimeout(timeoutTimer) // 异常，清除定时器
      console.error('钉钉免登引导异常', e)
      Toast.show({ icon: 'fail', content: `引导失败: ${e.message}` })
      setDdLoading(false)
    }
  }

  // 页面加载时自动探测环境
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    const isDD = ua.includes('dingtalk')
    setIsDingTalk(isDD)
    console.log('[调试] 当前浏览器 UserAgent:', ua, '检测为钉钉环境:', isDD)

    // 只有在钉钉应用内环境，且前端当前无登录态时，触发免登
    if (isDD && !authStore.isLoggedIn) {
      handleDingTalkLogin()
    }
  }, [authStore.isLoggedIn])

  /** 处理常规手动登录提交 */
  const handleLogin = async (values: { phone: string; password: string }) => {
    setLoading(true)
    try {
      const res = await post<any>('/auth/login', values)
      const tokenData = res?.data ? res.data : res
      const token = tokenData.access_token
      
      if (token) {
        setToken(token)
        // 获取系统用户信息
        const meRes = await get<any>('/auth/me')
        const meData = meRes?.data ? meRes.data : meRes
        
        authStore.setAuth(meData, token)
        Toast.show({ icon: 'success', content: '登录成功' })
        navigate('/m/home', { replace: true })
      } else {
        throw new Error('后端返回令牌缺失')
      }
    } catch (err: any) {
      removeToken()
      Toast.show({ 
        icon: 'fail', 
        content: err?.response?.data?.detail || '手机号或密码错误，请重试' 
      })
    } finally {
      setLoading(false)
    }
  }

  // 钉钉静默免登加载界面
  if (ddLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0a1929 0%, #0d2137 40%, #1677ff 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1677ff, #00d4ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              animation: 'spin 1.5s linear infinite',
              boxShadow: '0 4px 16px rgba(22, 119, 255, 0.4)',
            }}
          >
            <span style={{ fontSize: 24, fontWeight: 800 }}>百</span>
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>正在通过钉钉免登安全登录...</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>请稍候，系统正在校验您的身份</div>
        </div>
      </div>
    )
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
