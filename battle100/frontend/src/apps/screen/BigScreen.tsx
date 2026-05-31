import React, { useEffect, useState, useRef } from 'react'
import HeaderBanner from './components/HeaderBanner'
import KpiCards from './components/KpiCards'
import TrendChart from './components/TrendChart'
import LiveFeed from './components/LiveFeed'
import ZoneLeaderboard from './components/ZoneLeaderboard'
import DualTrackGrid from './components/DualTrackGrid'
import HonorHall from './components/HonorHall'
import LeadFunnel from './components/LeadFunnel'
import HeroBoard from './components/HeroBoard'
import { getDashboardData } from '@shared/api/dashboard'
import type { DashboardData } from '@shared/types'

const BigScreen: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const pollTimerRef = useRef<any>(null)

  // 1. 舱段控制状态
  // 0: 指挥舱 (战区表格排名、双轨九宫格、荣誉大厅)
  // 1: 分析舱 (四大KPI指标卡、周趋势对比图、商机漏斗、周个人排行榜三栏)
  const [viewMode, setViewMode] = useState<0 | 1>(0)
  const [autoRotate, setAutoRotate] = useState<boolean>(true)

  // 2. 锁定唯一大屏主题：烈阳红金（白天激昂）
  const theme = 'theme-light-red'

  // 3. 锁定全局 body 类
  useEffect(() => {
    const body = document.body
    body.className = theme
  }, [])

  // 4. 自动计算 4K 屏幕的 rem 基准
  useEffect(() => {
    const handleResize = () => {
      const designWidth = 3840
      const currentWidth = window.innerWidth
      const rem = (currentWidth / designWidth) * 28
      document.documentElement.style.fontSize = `${Math.max(rem, 8)}px`
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 5. 加载大屏核心数据
  const loadScreenData = async () => {
    try {
      const res = await getDashboardData()
      // 后端 overview 接口直接返回了 DashboardResponse 对象本身，顶层并没有 data 包装
      // 这里采用与后台 Dashboard 页面一致的解包策略，同时兼容可能存在的 data 属性
      const actualData = (res as any)?.data ? (res as any).data : res
      if (actualData) {
        setData(actualData)
      }
    } catch (err) {
      console.error('API 轮询数据加载失败:', err)
    }
  }

  // 6. 建立 WebSocket 连接与重连心跳逻辑
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

  // 7. 自动轮播逻辑 (20秒切换一次舱段)
  useEffect(() => {
    if (!autoRotate) return
    const timer = setInterval(() => {
      setViewMode((prev) => (prev === 0 ? 1 : 0))
    }, 20000)
    return () => clearInterval(timer)
  }, [autoRotate])

  // 计算总签约保底额完成率，若无接口数据则默认归零
  const newContractsValue = data?.kpiSummary?.newContracts?.value ?? 0
  const newContractsTarget = data?.kpiSummary?.newContracts?.target ?? 0
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
        paddingBottom: '0.5rem', // 暂停底部滚动播报后收回高度
      }}
    >
      {/* 渐入切换动画 */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInCabin {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cabin-container {
          animation: fadeInCabin 0.45s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
        }
      `}} />

      {/* 1. 顶部 HeaderBanner */}
      <HeaderBanner
        theme={theme}
        countdown={data?.countdown ?? 0}
        slogan={data?.slogan ?? '新签破六万战役 · 数字化指挥舱'}
        campaignName={data?.campaignName ?? '中地顾问百日奋战'}
      />

      {/* 2. 总进度大卡片与舱段控制面板 */}
      <div style={{ padding: '0 2rem', marginTop: '1rem', flexShrink: 0, display: 'flex', gap: '1.5rem' }}>
        {/* 左侧：累计总进度卡片 */}
        <div
          className="screen-card scroll-paper"
          style={{
            flex: 3,
            padding: '1.1rem 2.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.7rem',
            border: '3px solid var(--border-color)',
            position: 'relative'
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
          <div style={{ position: 'relative', marginTop: '0.1rem' }}>
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

            {/* 保底红线 (设定在 60% 目标) */}
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

        {/* 右侧：舱段控制台卡片 */}
        <div
          className="screen-card scroll-paper"
          style={{
            flex: 1,
            padding: '0.8rem 1.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.2rem',
            border: '3px solid var(--border-color)',
            position: 'relative'
          }}
        >
          <div className="scroll-corner-decor-top-right" />
          <div className="scroll-corner-decor-bottom-left" />

          {/* 切换按钮组 */}
          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
            <button
              onClick={() => {
                setViewMode(0)
                setAutoRotate(false) // 手动点击后暂停自动轮播
              }}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                borderRadius: '6px',
                border: viewMode === 0 ? '2px solid #b71c1c' : '1px solid var(--border-color)',
                backgroundColor: viewMode === 0 ? '#b71c1c' : 'rgba(0,0,0,0.03)',
                color: viewMode === 0 ? '#ffffff' : 'var(--text-primary)',
                boxShadow: viewMode === 0 ? '0 0 10px rgba(183, 28, 28, 0.35)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <span>⚔️</span>
              <span>指挥舱</span>
            </button>

            <button
              onClick={() => {
                setViewMode(1)
                setAutoRotate(false) // 手动点击后暂停自动轮播
              }}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                borderRadius: '6px',
                border: viewMode === 1 ? '2px solid #fa8c16' : '1px solid var(--border-color)',
                backgroundColor: viewMode === 1 ? '#fa8c16' : 'rgba(0,0,0,0.03)',
                color: viewMode === 1 ? '#ffffff' : 'var(--text-primary)',
                boxShadow: viewMode === 1 ? '0 0 10px rgba(250, 140, 22, 0.35)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <span>📊</span>
              <span>分析舱</span>
            </button>
          </div>

          {/* 自动轮播开关 (Switch) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary, #666666)' }}>
              自动轮播
            </span>
            <div
              onClick={() => setAutoRotate(!autoRotate)}
              style={{
                width: '3rem',
                height: '1.5rem',
                borderRadius: '0.75rem',
                backgroundColor: autoRotate ? '#b71c1c' : '#bfbfbf',
                padding: '0.1rem',
                cursor: 'pointer',
                transition: 'background-color 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: autoRotate ? 'flex-end' : 'flex-start'
              }}
            >
              <div
                style={{
                  width: '1.3rem',
                  height: '1.3rem',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  transition: 'all 0.3s ease'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. 主体舱段切换 */}
      {viewMode === 0 ? (
        <div
          key="cabin-command"
          className="cabin-container"
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
          {/* 第一层：各战区战队冲刺表格 */}
          <div style={{ flexShrink: 0 }}>
            <ZoneLeaderboard theme={theme} zoneTeamsPK={data?.zoneTeamsPK} />
          </div>

          {/* 第二层：双轨动力 · 红黄绿灯状态（按战区横向分组还原） */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <DualTrackGrid theme={theme} teams={data?.dualTrackTeams} />
          </div>

          {/* 第三层：预警与自动结算荣誉大厅 */}
          <div style={{ flexShrink: 0, paddingBottom: '0.5rem' }}>
            <HonorHall theme={theme} teams={data?.dualTrackTeams} />
          </div>
        </div>
      ) : (
        <div
          key="cabin-analysis"
          className="cabin-container"
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
          {/* 第一层：KpiCards指标卡片 */}
          <div style={{ flexShrink: 0 }}>
            <KpiCards theme={theme} kpiSummary={data?.kpiSummary} />
          </div>

          {/* 第二层：趋势图、线索漏斗、英雄榜周排行三栏并排 */}
          <div style={{ flex: 1, display: 'flex', gap: '1.5rem', overflow: 'hidden', paddingBottom: '0.5rem' }}>
            {/* 左侧：趋势对比图 */}
            <div style={{ flex: 4, height: '100%' }}>
              <TrendChart theme={theme} weeklyTrend={data?.weeklyTrend} />
            </div>
            {/* 中间：铁三角线索漏斗与重特大项目攻坚墙 */}
            <div style={{ flex: 3, height: '100%' }}>
              <LeadFunnel theme={theme} />
            </div>
            {/* 右侧：个人周排行榜榜单 */}
            <div style={{ flex: 3, height: '100%' }}>
              <HeroBoard
                theme={theme}
                heroBoard={data?.heroBoard}
                happinessBoard={data?.happinessBoard}
                triangleBoard={data?.triangleBoard}
                leadsBoard={data?.leadsBoard}
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. 最底端：横向走马灯无缝捷报滚动栏 (用户要求暂停滚动播报) */}
      {/* <LiveFeed theme={theme} liveFeed={data?.liveFeed} /> */}
    </div>
  )
}

export default BigScreen
