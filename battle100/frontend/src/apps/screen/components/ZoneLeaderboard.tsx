import React from 'react'
import type { RankingItem } from '@shared/types'

interface ZoneLeaderboardProps {
  theme?: string
  zoneRanking?: RankingItem[]
}

const ZoneLeaderboard: React.FC<ZoneLeaderboardProps> = ({ theme = 'theme-light-red', zoneRanking = [] }) => {
  // 确保有三大战区数据，如果没有则兜底
  const displayZones = zoneRanking.length >= 3 ? zoneRanking.slice(0, 3) : [
    { rank: 1, name: '第一战区', score: 150.0, trend: 'up' },
    { rank: 2, name: '第三战区', score: 110.0, trend: 'up' },
    { rank: 3, name: '第二战区', score: 0.0, trend: 'same' }
  ]

  // 计算最大分数以确定进度条最大宽度，至少为200万
  const maxScore = Math.max(...displayZones.map(z => z.score), 200)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: '1rem',
        borderLeft: '4px solid var(--accent-color)',
        paddingLeft: '0.8rem'
      }}>
        <div style={{
          fontSize: '1.25rem',
          fontWeight: 'bold',
          color: 'var(--accent-color)',
          fontFamily: 'STKaiti, KaiTi, sans-serif',
        }}>
          战区龙虎榜与奖励结算
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          7日复盘画布 <span>📊</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', paddingLeft: '1.2rem' }}>
        {displayZones.map((zone, idx) => {
          // 根据名次赋予不同颜色的奖牌图标
          let medal = '🥉'
          let barGradient = 'linear-gradient(90deg, #b71c1c 0%, #f5222d 100%)'
          
          if (idx === 0) {
            medal = '🥇'
            barGradient = 'linear-gradient(90deg, #d4af37 0%, #fadb14 100%)'
          } else if (idx === 1) {
            medal = '🥈'
            barGradient = 'linear-gradient(90deg, #e53935 0%, #ff7875 100%)'
          }

          const pct = Math.max((zone.score / maxScore) * 100, 2) // 最低留出2%以防空条不好看（如果是0，就强制2%作为底线，或者干脆给0）

          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '80px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{medal}</span>
                {zone.name}
              </div>
              
              <div style={{ flex: 1, position: 'relative', height: '16px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${zone.score === 0 ? 0 : pct}%`,
                  background: barGradient,
                  borderRadius: '8px',
                  transition: 'width 1s ease-out'
                }} />
              </div>
              
              <div style={{ width: '70px', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                {zone.score.toFixed(1)}万
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ZoneLeaderboard
