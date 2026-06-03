import React, { useEffect, useState } from 'react'
import logoShield from '../../../assets/logo_shield.png'

interface HeaderBannerProps {
  theme?: string
  countdown: number
  slogan: string
  campaignName: string
}

const HeaderBanner: React.FC<HeaderBannerProps> = ({
  theme = 'theme-light-red',
  countdown,
  slogan,
  campaignName
}) => {
  const [timeStr, setTimeStr] = useState('')

  // 实时更新时间
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const format = (n: number) => n.toString().padStart(2, '0')
      setTimeStr(
        `${now.getFullYear()}-${format(now.getMonth() + 1)}-${format(now.getDate())} ` +
        `${format(now.getHours())}:${format(now.getMinutes())}:${format(now.getSeconds())}`
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // 决定标语字色与时间字色
  let sloganColor = 'rgba(255,255,255,0.8)'
  let timeColor = 'var(--accent-color)'

  if (theme === 'theme-light-red') {
    sloganColor = '#ffd8d8'
    timeColor = '#fffb8f'
  } else if (theme === 'theme-gold') {
    sloganColor = '#7a673d'
    timeColor = '#8b6508'
  } else if (theme === 'theme-dark-red') {
    sloganColor = 'rgba(255,255,255,0.6)'
    timeColor = '#ff4d4f'
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '4.5rem',
        padding: '0 2.5rem',
        background: 'var(--header-bg)',
        borderBottom: `2px solid var(--header-border)`,
        boxShadow: theme === 'theme-dark-red' ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 15px rgba(0,0,0,0.15)',
        position: 'relative',
        transition: 'all 0.5s ease',
      }}
    >
      {/* 1. 左侧：中地顾问盾牌 Logo 与公司副标 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
        {/* 中地顾问盾牌 Logo - 已实现透明底色且与大屏背景完美相融 */}
        <img
          src={logoShield}
          alt="中地顾问 Logo"
          style={{
            height: '62px',
            width: 'auto',
            objectFit: 'contain',
            flexShrink: 0
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2
            style={{
              margin: 0,
              fontSize: '1.4rem',
              fontWeight: 900,
              color: theme === 'theme-gold' ? '#4a3c1c' : '#ffffff',
              letterSpacing: '1px',
              lineHeight: 1.2
            }}
          >
            中地顾问
          </h2>
          <span
            style={{
              fontSize: '0.7rem',
              color: theme === 'theme-gold' ? '#8c7d5c' : 'rgba(255,255,255,0.75)',
              letterSpacing: '0.5px',
              fontWeight: 'bold',
            }}
          >
            为客户幸福而奋斗
          </span>
        </div>
        
        {/* 垂直分割线 */}
        <div
          style={{
            width: '2px',
            height: '2.5rem',
            backgroundColor: theme === 'theme-gold' ? 'rgba(74, 60, 28, 0.25)' : 'rgba(255,255,255,0.25)',
            margin: '0 1rem'
          }}
        />

        {/* 战役名称与大口号 */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1
            className="screen-title-glow"
            style={{
              margin: 0,
              fontSize: '1.8rem',
              fontWeight: 900,
              letterSpacing: '2px',
              lineHeight: 1.2
            }}
          >
            {campaignName || '中地顾问「百日奋战」经营冲刺大屏'}
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.95rem', color: sloganColor, letterSpacing: '1px', fontWeight: 'bold' }}>
            {slogan || '奋战一百天，亮剑破六千！'}
          </p>
        </div>
      </div>

      {/* 2. 中间：大屏倒计时 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span
          style={{
            fontSize: '1.2rem',
            color: theme === 'theme-gold' ? '#4a3c1c' : '#ffffff',
            fontWeight: 'bold',
            letterSpacing: '1px',
          }}
        >
          攻坚倒计时
        </span>
        <span
          className="glow-number"
          style={{
            fontSize: '3.4rem',
            lineHeight: 1,
            color: theme === 'theme-gold' ? '#b8860b' : '#fffb8f',
            textShadow: theme === 'theme-dark-red' ? '0 0 15px rgba(255, 77, 79, 0.8)' : '0 2px 5px rgba(0,0,0,0.3)',
          }}
        >
          {countdown}
        </span>
        <span
          style={{
            fontSize: '1.2rem',
            color: theme === 'theme-gold' ? '#4a3c1c' : '#ffffff',
            fontWeight: 'bold',
          }}
        >
          天
        </span>
      </div>

      {/* 3. 右侧：系统时间展示 */}
      <div
        style={{
          textAlign: 'right',
          fontSize: '1.3rem',
          fontFamily: 'monospace',
          color: timeColor,
          fontWeight: 'bold',
          letterSpacing: '0.5px',
          textShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
      >
        {timeStr}
      </div>
    </div>
  )
}

export default HeaderBanner
