import React, { useEffect, useState, useRef } from 'react'
import HeaderBanner from './components/HeaderBanner'
import TrendChart from './components/TrendChart'
import LiveFeed from './components/LiveFeed'
import ZoneLeaderboard from './components/ZoneLeaderboard'
import DualTrackGrid from './components/DualTrackGrid'
import LeadFunnel from './components/LeadFunnel'
import HeroBoard from './components/HeroBoard'
import { getDashboardData } from '@shared/api/dashboard'
import type { DashboardData } from '@shared/types'

const BigScreen: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const pollTimerRef = useRef<any>(null)



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
          pollTimerRef.current = setInterval(loadScreenData, 60000)
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
        paddingBottom: '3.5rem', // 开启底部滚动播报并留出足够高度
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

      {/* 2. 总进度大卡片 */}
      <div style={{ padding: '0 1.5rem', marginTop: '0.5rem', flexShrink: 0 }}>
        <div
          className="screen-card scroll-paper"
          style={{
            padding: '0.6rem 1.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            border: '3px solid var(--border-color)',
            position: 'relative'
          }}
        >
          <div className="scroll-corner-decor-top-right" />
          <div className="scroll-corner-decor-bottom-left" />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>⚔️</span>
              <span>百日新签合同额累计总进度 (实时达成率)</span>
            </span>
            <span className="glow-number" style={{ fontSize: '1.3rem' }}>
              {newContractsValue.toFixed(1)}万 / {newContractsTarget.toFixed(0)}万
              <span style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', marginLeft: '0.5rem', fontWeight: 'bold' }}>
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
      </div>

      {/* 3. 大屏核心合并视图 */}
      <div
        className="cabin-container"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '0.6rem 1.5rem 0 1.5rem',
          gap: '0.7rem',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {/* 第一层：左侧双轨九宫格（65% 宽），右侧各战区战队周冲刺排行榜表格（35% 宽） */}
        <div style={{ flex: 1, display: 'flex', gap: '1.5rem', overflow: 'hidden', maxHeight: '31rem' }}>
          {/* 左侧：双轨动力 3x3 九宫格 */}
          <div style={{ flex: 6.5, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <DualTrackGrid theme={theme} teams={data?.dualTrackTeams} />
          </div>
          {/* 右侧：各战区战队周冲刺表格 */}
          <div style={{ flex: 3.5, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ZoneLeaderboard
              theme={theme}
              zoneTeamsPK={data?.zoneTeamsPK}
              dualTrackTeams={data?.dualTrackTeams}
            />
          </div>
        </div>

        {/* 第二层（底栏）：周趋势对比图（40%）、商机漏斗/特大攻坚墙（30%）、个人排行榜（30%）三栏并排 */}
        <div style={{ flex: 1, display: 'flex', gap: '1.5rem', overflow: 'hidden', maxHeight: '31rem', paddingBottom: '0.5rem' }}>
          {/* 左侧：趋势对比图 */}
          <div style={{ flex: 4, height: '100%' }}>
            <TrendChart theme={theme} weeklyTrend={data?.weeklyTrend} />
          </div>
          {/* 中间：铁三角线索漏斗与重特大项目攻坚墙 */}
          <div style={{ flex: 3, height: '100%' }}>
            <LeadFunnel theme={theme} leadsFunnel={data?.leadsFunnel} importantProjects={data?.importantProjects} />
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
      
      {/* 底部实时战报走马灯滚动播报 */}
      <LiveFeed theme={theme} liveFeed={data?.liveFeed} />
    </div>
  )
}

export default BigScreen
