import React, { useEffect, useState, useRef } from 'react'
import HeaderBanner from './components/HeaderBanner'
import KpiCards from './components/KpiCards'
import ZoneRanking from './components/ZoneRanking' // 虽然保留但不再在主视图使用，替换为全新的三层结构
import TrendChart from './components/TrendChart'
import LiveFeed from './components/LiveFeed'
import HeroBoard from './components/HeroBoard'
import ZoneLeaderboard from './components/ZoneLeaderboard'
import DualTrackGrid from './components/DualTrackGrid'
import HonorHall from './components/HonorHall'
import { getDashboardData } from '@shared/api/dashboard'
import type { DashboardData } from '@shared/types'

const BigScreen: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const pollTimerRef = useRef<any>(null)

  // 1. 锁定唯一大屏主题：烈阳红金（白天激昂）
  const theme = 'theme-light-red'

  // 2. 锁定全局 body 类
  useEffect(() => {
    const body = document.body
    body.className = theme
  }, [])

  // 3. 自动计算 4K 屏幕的 rem 基准
  useEffect(() => {
    const handleResize = () => {
      const designWidth = 3840
      const currentWidth = window.innerWidth
      // 核心调整：原系数为16，现改为28，让整个大屏字体和使用rem布局的卡片全量放大约1.75倍
      const rem = (currentWidth / designWidth) * 28
      document.documentElement.style.fontSize = `${Math.max(rem, 8)}px`
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 4. 加载大屏核心数据
  const loadScreenData = async () => {
    try {
      const res = await getDashboardData()
      if (res && res.data) {
        setData(res.data)
      }
    } catch (err) {
      console.error('API 轮询数据加载失败:', err)
    }
  }

  // 5. 建立 WebSocket 连接与重连心跳逻辑
  useEffect(() => {
    loadScreenData()

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const host = window.location.host || 'localhost:8100' // 后端主端口为8100
      const wsUrl = `${protocol}://${host}/ws/screen`

      console.log('正在连接大屏推送 WebSocket:', wsUrl)
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket 实时推送连接成功！')
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current)
          pollTimerRef.current = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log('收到实时数据更新推送:', message)
          if (message.type === 'update' || message.event_type) {
            loadScreenData()
          }
        } catch (e) {
          // 忽略心跳
        }
      }

      ws.onclose = () => {
        console.warn('WebSocket 连接断开，准备降级为 API 轮询...')
        if (!pollTimerRef.current) {
          pollTimerRef.current = setInterval(loadScreenData, 10000)
        }
        setTimeout(connectWs, 5000)
      }

      ws.onerror = (err) => {
        console.error('WebSocket 出错:', err)
        ws.close()
      }
    }

    connectWs()

    return () => {
      if (wsRef.current) wsRef.current.close()
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  // 计算总签约保底额完成率
  const newContractsValue = data?.kpiSummary?.newContracts?.value ?? 5578.0
  const newContractsTarget = data?.kpiSummary?.newContracts?.target ?? 12400.0
  const totalCompletionRate = newContractsTarget > 0 ? (newContractsValue / newContractsTarget) * 100 : 0.0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        boxSizing: 'border-box',
        paddingBottom: '2.5rem', // 底部留出实时横向捷报滚动条高度
      }}
    >
      {/* 移除悬浮的主题皮肤切换控制器，锁定激昂主题 */}

      {/* 1. 顶部 HeaderBanner */}
      <HeaderBanner
        theme={theme}
        countdown={data?.countdown ?? 71}
        slogan={data?.slogan ?? '新签破六万战役 · 数字化指挥舱'}
        campaignName={data?.campaignName ?? '中地顾问百日奋战'}
      />

      {/* 2. 百日新签合同额总进度大卡片 */}
      <div style={{ padding: '0 2rem', marginTop: '1rem', flexShrink: 0 }}>
        <div
          className="screen-card scroll-paper"
          style={{
            padding: '1.2rem 2.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
            border: '3px solid var(--border-color)'
          }}
        >
          <div className="scroll-corner-decor-top-right" />
          <div className="scroll-corner-decor-bottom-left" />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'STKaiti, KaiTi, sans-serif' }}>
              <span>⚔️</span>
              <span>百日新签合同额累计总进度 (实时达成率)</span>
            </span>
            <span className="glow-number" style={{ fontSize: '1.25rem' }}>
              {newContractsValue.toFixed(1)}万 / {newContractsTarget.toFixed(0)}万
              <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '0.5rem', fontWeight: 'bold' }}>
                (达成率: {totalCompletionRate.toFixed(1)}%)
              </span>
            </span>
          </div>

          {/* 进度条轨道与红线标记 */}
          <div style={{ position: 'relative', marginTop: '0.2rem' }}>
            <div className="progress-track" style={{ height: '24px', borderRadius: '12px' }}>
              <div
                className="progress-bar-glow"
                style={{
                  width: `${Math.min(totalCompletionRate, 100)}%`,
                  background: 'linear-gradient(90deg, #ff9800 0%, #e53935 50%, #b71c1c 100%)',
                  height: '100%',
                  borderRadius: '12px',
                  boxShadow: theme === 'theme-dark-red' ? '0 0 12px var(--glow-color)' : 'none'
                }}
              />
            </div>

            {/* 保底红线 (设定在 60% 目标，对应大约 7440 万) */}
            <div
              style={{
                position: 'absolute',
                top: '-4px',
                bottom: '-4px',
                left: '60%',
                width: '3px',
                backgroundColor: '#f5222d',
                boxShadow: '0 0 8px #ff4d4f',
                zIndex: 10
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  backgroundColor: '#f5222d',
                  whiteSpace: 'nowrap',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  fontFamily: 'sans-serif'
                }}
              >
                🚨 保底红线 (60%)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 主体指挥部大视窗：照抄最新红黄绿灯布局 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem 2.2rem 0 2.2rem',
          gap: '1.5rem',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {/* 第一层：战区龙虎榜与奖励结算 */}
        <div style={{ flexShrink: 0 }}>
          <ZoneLeaderboard theme={theme} zoneRanking={data?.zoneRanking} />
        </div>

        {/* 第二层：双轨动力 · 红黄绿灯状态（核心3x3九宫格） */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DualTrackGrid theme={theme} teams={data?.dualTrackTeams} />
        </div>

        {/* 第三层：预警与自动结算荣誉大厅 */}
        <div style={{ flexShrink: 0, paddingBottom: '0.5rem' }}>
          <HonorHall theme={theme} teams={data?.dualTrackTeams} />
        </div>
      </div>

      {/* 4. 最底端：横向走马灯无缝捷报滚动栏（按需求暂缓，待开发完毕开启） */}
      {/* <LiveFeed theme={theme} liveFeed={data?.liveFeed} /> */}
    </div>
  )
}

export default BigScreen
