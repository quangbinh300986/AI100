import React, { useState, useEffect, useRef } from 'react'
import type { RankingItem } from '@shared/types'

interface HeroBoardProps {
  theme?: string
  heroBoard?: RankingItem[]
  happinessBoard?: RankingItem[]
  triangleBoard?: RankingItem[]
}

type TabType = 'marketing' | 'happiness' | 'triangle'

const HeroBoard: React.FC<HeroBoardProps> = ({
  theme = 'theme-light-red',
  heroBoard = [],
  happinessBoard = [],
  triangleBoard = []
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('marketing')
  const timerRef = useRef<any>(null)

  // 默认补齐数据，确保大屏看起来饱满
  const defaultHeroes: RankingItem[] = [
    { rank: 1, name: '苏志辉', teamName: '清远战队', score: 138.5, trend: 'up' },
    { rank: 2, name: '周展图', teamName: '广州二战队', score: 100.0, trend: 'up' },
    { rank: 3, name: '罗志成', teamName: '东莞战队', score: 100.0, trend: 'same' },
    { rank: 4, name: '唐焕仪', teamName: '广州一战队', score: 93.5, trend: 'down' },
    { rank: 5, name: '张桂春', teamName: '佛山战队', score: 93.5, trend: 'up' },
    { rank: 6, name: '何锦泉', teamName: '广州三战队（大数据）', score: 85.0, trend: 'up' },
    { rank: 7, name: '陈文杰', teamName: '云浮战队', score: 80.0, trend: 'same' },
    { rank: 8, name: '李晓华', teamName: '湛江战队', score: 75.0, trend: 'down' },
    { rank: 9, name: '曾志强', teamName: '茂名战队', score: 70.0, trend: 'up' },
    { rank: 10, name: '梁永昌', teamName: '茂名战队', score: 68.0, trend: 'same' }
  ]

  const defaultHappiness: RankingItem[] = [
    { rank: 1, name: '陈露', teamName: '佛山战队', score: 28.0, trend: 'up' },
    { rank: 2, name: '梁少芬', teamName: '清远战队', score: 24.0, trend: 'up' },
    { rank: 3, name: '温国荣', teamName: '东莞战队', score: 21.0, trend: 'same' },
    { rank: 4, name: '唐焕仪', teamName: '广州一战队', score: 18.0, trend: 'up' },
    { rank: 5, name: '何锦泉', teamName: '茂名战队', score: 15.0, trend: 'same' },
    { rank: 6, name: '罗志成', teamName: '东莞战队', score: 14.0, trend: 'up' },
    { rank: 7, name: '苏志辉', teamName: '清远战队', score: 12.0, trend: 'down' },
    { rank: 8, name: '曾志强', teamName: '湛江战队', score: 10.0, trend: 'up' },
    { rank: 9, name: '周展图', teamName: '广州二战队', score: 9.0, trend: 'same' },
    { rank: 10, name: '林金龙', teamName: '云浮战队', score: 8.0, trend: 'up' }
  ]

  const defaultTriangle: RankingItem[] = [
    { rank: 1, name: '项斌强', teamName: '广州一战队', score: 19.0, trend: 'up' },
    { rank: 2, name: '曾志强', teamName: '茂名战队', score: 16.0, trend: 'up' },
    { rank: 3, name: '黄伟明', teamName: '湛江战队', score: 14.0, trend: 'same' },
    { rank: 4, name: '罗志成', teamName: '东莞战队', score: 11.0, trend: 'down' },
    { rank: 5, name: '苏志辉', teamName: '清远战队', score: 9.0, trend: 'up' },
    { rank: 6, name: '梁永昌', teamName: '茂名战队', score: 8.0, trend: 'same' },
    { rank: 7, name: '陈露', teamName: '佛山战队', score: 7.0, trend: 'up' },
    { rank: 8, name: '林金龙', teamName: '云浮战队', score: 7.0, trend: 'up' },
    { rank: 9, name: '温国荣', teamName: '东莞战队', score: 6.0, trend: 'down' },
    { rank: 10, name: '周展图', teamName: '广州二战队', score: 5.0, trend: 'same' }
  ]

  // 定时轮播函数
  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    timerRef.current = setInterval(() => {
      setActiveTab((prev) => {
        if (prev === 'marketing') return 'happiness'
        if (prev === 'happiness') return 'triangle'
        return 'marketing'
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
      case 'happiness':
        return {
          title: '🌟 客户幸福之星榜 (交付/支撑动作累计)',
          unit: '次',
          isFloat: false,
          list: happinessBoard.length > 0 ? happinessBoard : defaultHappiness,
          color: '#fa8c16'
        }
      case 'triangle':
        return {
          title: '🤝 铁三角协作标杆榜 (跨部门协同联动)',
          unit: '次',
          isFloat: false,
          list: triangleBoard.length > 0 ? triangleBoard : defaultTriangle,
          color: '#fa541c'
        }
      case 'marketing':
      default:
        return {
          title: '🏆 签单先锋战将榜 (前线新签合同业绩)',
          unit: '万',
          isFloat: true,
          list: heroBoard.length > 0 ? heroBoard : defaultHeroes,
          color: 'var(--accent-color)'
        }
    }
  }

  const { title, unit, isFloat, list, color } = getTabDetails()

  return (
    <div
      className="screen-card scroll-paper"
      style={{
        padding: '1.5rem 1.8rem',
        height: 'calc(100% - 3rem)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 宣纸四角包边 */}
      <div className="scroll-corner-decor-top-right" />
      <div className="scroll-corner-decor-bottom-left" />

      {/* 顶部三合一 Tab 按钮切换区 */}
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
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {[
            { id: 'marketing', label: '签单战将' },
            { id: 'happiness', label: '客户幸福' },
            { id: 'triangle', label: '铁三角协作' },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id as TabType)}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: isActive
                    ? 'linear-gradient(90deg, #b71c1c 0%, #ff4d4f 100%)'
                    : 'rgba(0,0,0,0.04)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease',
                  boxShadow: isActive ? '0 2px 8px rgba(183,28,28,0.25)' : 'none',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 'bold' }}>
          <span>⏳</span>
          8s 轮播中
        </div>
      </div>

      {/* 榜单大标题 */}
      <h3
        style={{
          margin: '0 0 0.8rem 0',
          fontSize: '1.15rem',
          color: color,
          fontWeight: 'bold',
          flexShrink: 0,
          fontFamily: 'STKaiti, KaiTi, sans-serif'
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
          gap: '0.5rem',
          overflowY: 'auto',
          paddingRight: '2px',
        }}
      >
        {list.map((item, idx) => {
          // 金银铜牌与数字名次背景色
          let badgeBg = 'transparent'
          let badgeColor = 'var(--text-secondary)'
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
                padding: '0.5rem 0.9rem',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                {/* 排名圆形徽章 */}
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: badgeBg,
                    color: badgeColor,
                    border: badgeBorder,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    boxShadow: idx < 3 ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  {idx + 1}
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 'bold',
                      color: idx < 3 ? 'var(--accent-color)' : 'var(--text-primary)',
                    }}
                  >
                    {item.name}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.8rem' }}>
                    {item.teamName}
                  </span>
                </div>
              </div>

              {/* 业绩分数 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span className="glow-number" style={{ fontSize: '1.1rem', color: color }}>
                  {isFloat ? item.score.toFixed(1) : Math.round(item.score)}
                  <span style={{ fontSize: '0.8rem', marginLeft: '0.15rem', color: 'var(--text-secondary)', textShadow: 'none', fontWeight: 'bold' }}>
                    {unit}
                  </span>
                </span>
                <span style={{ fontSize: '0.85rem' }}>
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
