import React, { useState, useEffect, useRef } from 'react'
import type { RankingItem } from '@shared/types'

interface HeroBoardProps {
  theme?: string
  heroBoard?: RankingItem[]
  marketingHeroBoard?: RankingItem[]
  deliveryHeroBoard?: RankingItem[]
  happinessBoard?: RankingItem[]
  triangleBoard?: RankingItem[]
  leadsBoard?: RankingItem[]
  potentialLeadsBoard?: RankingItem[]
  stationReportsBoard?: RankingItem[]
}

type TabType = 'marketing_signing' | 'delivery_signing' | 'leads' | 'potential_leads' | 'happiness' | 'triangle' | 'station_reports'

const HeroBoard: React.FC<HeroBoardProps> = ({
  theme = 'theme-light-red',
  heroBoard = [],
  marketingHeroBoard = [],
  deliveryHeroBoard = [],
  happinessBoard = [],
  triangleBoard = [],
  leadsBoard = [],
  potentialLeadsBoard = [],
  stationReportsBoard = []
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('marketing_signing')
  const timerRef = useRef<any>(null)

  // 默认周排行兜底设为空，保证全真数据展示
  const defaultHeroes: RankingItem[] = []
  const defaultLeads: RankingItem[] = []
  const defaultHappiness: RankingItem[] = []
  const defaultTriangle: RankingItem[] = []

  // 定时轮播函数
  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    timerRef.current = setInterval(() => {
      setActiveTab((prev) => {
        if (prev === 'marketing_signing') return 'delivery_signing'
        if (prev === 'delivery_signing') return 'leads'
        if (prev === 'leads') return 'potential_leads'
        if (prev === 'potential_leads') return 'happiness'
        if (prev === 'happiness') return 'triangle'
        if (prev === 'triangle') return 'station_reports'
        return 'marketing_signing'
      })
    }, 8000)
  }

  // 组件挂载与 activeTab 变化时重新计时
  useEffect(() => {
    startTimer()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [activeTab])

  // 手动点击 Tab 切换
  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab)
  }

  // 获得对应榜单的数据及标题、单位
  const getTabDetails = () => {
    switch (activeTab) {
      case 'leads':
        return {
          title: '🔍 周线索先锋奖榜 (当周新增有效线索)',
          unit: '条',
          isFloat: false,
          list: leadsBoard.length > 0 ? leadsBoard : defaultLeads,
          color: '#1890ff'
        }
      case 'potential_leads':
        return {
          title: '🎯 周潜力线索先锋榜 (当周新增潜力线索)',
          unit: '条',
          isFloat: false,
          list: potentialLeadsBoard.length > 0 ? potentialLeadsBoard : defaultLeads,
          color: '#eb2f96'
        }
      case 'happiness':
        return {
          title: '🌟 周客户幸福动作卷王榜 (当周幸福动作次数)',
          unit: '次',
          isFloat: false,
          list: happinessBoard.length > 0 ? happinessBoard : defaultHappiness,
          color: '#fa8c16'
        }
      case 'triangle':
        return {
          title: '🤝 周铁三角协作标杆榜 (当周跨部门协同联动)',
          unit: '次',
          isFloat: false,
          list: triangleBoard.length > 0 ? triangleBoard : defaultTriangle,
          color: '#fa8c16'
        }
      case 'station_reports':
        return {
          title: '📢 周市场信息前线播报榜 (当周前线快报次数)',
          unit: '次',
          isFloat: false,
          list: stationReportsBoard.length > 0 ? stationReportsBoard : defaultTriangle,
          color: '#fa541c'
        }
      case 'marketing_signing':
        return {
          title: '🏆 营销签单先锋周战将榜 (当周营销新签合同额)',
          unit: '万',
          isFloat: true,
          list: marketingHeroBoard.length > 0 ? marketingHeroBoard : defaultHeroes,
          color: 'var(--accent-color, #b71c1c)'
        }
      case 'delivery_signing':
        return {
          title: '🏆 交付签单先锋周战将榜 (当周交付新签合同额)',
          unit: '万',
          isFloat: true,
          list: deliveryHeroBoard.length > 0 ? deliveryHeroBoard : defaultHeroes,
          color: '#08979c'
        }
      default:
        return {
          title: '🏆 签单先锋周战将榜 (当周新签合同额)',
          unit: '万',
          isFloat: true,
          list: heroBoard.length > 0 ? heroBoard : defaultHeroes,
          color: 'var(--accent-color, #b71c1c)'
        }
    }
  }

  const { title, unit, isFloat, list, color } = getTabDetails()

  return (
    <div
      className="screen-card scroll-paper"
      style={{
        padding: '1.25rem 1.5rem', // 对齐中间栏内间距
        height: '100%', // 高度设为 100% 自适应
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box' // 强制使用 border-box 对齐底部
      }}
    >
      {/* 宣纸四角包边 */}
      <div className="scroll-corner-decor-top-right" style={{ transform: 'scale(0.6)' }} />
      <div className="scroll-corner-decor-bottom-left" style={{ transform: 'scale(0.6)' }} />

      {/* 顶部四合一 Tab 按钮切换区 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid var(--border-color)',
          paddingBottom: '0.6rem',
          marginBottom: '0.8rem',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'marketing_signing', label: '营销签单战将', gradient: 'linear-gradient(90deg, #b71c1c 0%, #ff4d4f 100%)', shadow: 'rgba(183,28,28,0.25)' },
            { id: 'delivery_signing', label: '交付签单战将', gradient: 'linear-gradient(90deg, #08979c 0%, #36cfc9 100%)', shadow: 'rgba(8,151,156,0.25)' },
            { id: 'leads', label: '线索先锋', gradient: 'linear-gradient(90deg, #1890ff 0%, #69c0ff 100%)', shadow: 'rgba(24,144,255,0.25)' },
            { id: 'potential_leads', label: '潜力线索战将', gradient: 'linear-gradient(90deg, #eb2f96 0%, #ff85c0 100%)', shadow: 'rgba(235,47,150,0.25)' },
            { id: 'happiness', label: '幸福动作卷王', gradient: 'linear-gradient(90deg, #52c41a 0%, #95de64 100%)', shadow: 'rgba(82,196,26,0.25)' },
            { id: 'triangle', label: '铁三角协作', gradient: 'linear-gradient(90deg, #fa8c16 0%, #ffd591 100%)', shadow: 'rgba(250,140,22,0.25)' },
            { id: 'station_reports', label: '市场信息播报', gradient: 'linear-gradient(90deg, #fa541c 0%, #ff9c6e 100%)', shadow: 'rgba(250,84,28,0.25)' },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id as TabType)}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: isActive ? tab.gradient : 'rgba(0,0,0,0.04)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary, #666666)',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  transition: 'all 0.3s ease',
                  boxShadow: isActive ? `0 2px 8px ${tab.shadow}` : 'none',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #666666)', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 'bold' }}>
          <span>⏳</span>
          8s 轮播
        </div>
      </div>

      {/* 榜单大标题 */}
      <h3
        style={{
          margin: '0 0 0.8rem 0',
          fontSize: '1.15rem',
          color: color,
          fontWeight: 'bold',
          flexShrink: 0
        }}
      >
        {title}
      </h3>

      {/* 滚动列表 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.3rem', // 压缩间隙，使 10 名展示得更紧凑
          overflowY: 'auto',
          paddingRight: '2px',
        }}
      >
        {list.slice(0, 10).map((item, idx) => {
          // 金银铜牌与数字名次背景色
          let badgeBg = 'transparent'
          let badgeColor = 'var(--text-secondary, #666666)'
          let badgeBorder = '1px solid var(--border-color)'

          if (idx === 0) {
            badgeBg = 'linear-gradient(135deg, #ffd700 0%, #ffa500 100%)'
            badgeColor = '#4a2300'
            badgeBorder = 'none'
          } else if (idx === 1) {
            badgeBg = 'linear-gradient(135deg, #e6e6e6 0%, #b0b0b0 100%)'
            badgeColor = '#222'
            badgeBorder = 'none'
          } else if (idx === 2) {
            badgeBg = 'linear-gradient(135deg, #e0a96d 0%, #cd7f32 100%)'
            badgeColor = '#fff'
            badgeBorder = 'none'
          }

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.32rem 0.6rem', // 缩减内边距，减少单项高度
                background: idx < 3 
                  ? 'rgba(183, 28, 28, 0.04)' 
                  : 'rgba(0, 0, 0, 0.01)',
                borderRadius: '6px',
                border: idx < 3 
                  ? '1px solid rgba(183, 28, 28, 0.15)' 
                  : '1px solid rgba(0,0,0,0.02)',
                transition: 'all 0.3s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {/* 排名圆形徽章 */}
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: badgeBg,
                    color: badgeColor,
                    border: badgeBorder,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    boxShadow: idx < 3 ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  {idx + 1}
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      color: idx < 3 ? 'var(--accent-color, #b71c1c)' : 'var(--text-primary)',
                    }}
                  >
                    {item.name}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #666666)', marginLeft: '0.6rem' }}>
                    {item.teamName}
                  </span>
                </div>
              </div>

              {/* 业绩分数 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="glow-number" style={{ fontSize: '1.0rem', color: color }}>
                  {isFloat ? item.score.toFixed(1).replace('.0', '') : Math.round(item.score)}
                  <span style={{ fontSize: '0.75rem', marginLeft: '0.15rem', color: 'var(--text-secondary, #666666)', textShadow: 'none', fontWeight: 'bold' }}>
                    {unit}
                  </span>
                </span>
                <span style={{ fontSize: '0.8rem' }}>
                  {item.trend === 'up' ? '🔺' : item.trend === 'down' ? '🔻' : '➖'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default HeroBoard
