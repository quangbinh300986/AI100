import React from 'react'
import type { DualTrackTeam } from '@shared/types'

interface DualTrackGridProps {
  theme?: string
  teams?: DualTrackTeam[]
}

const DualTrackGrid: React.FC<DualTrackGridProps> = ({ theme = 'theme-light-red', teams = [] }) => {
  const isScrollTheme = true // 锁定白天激昂主题

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        fontSize: '1.2rem',
        fontWeight: 'bold',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: 'var(--accent-color)',
        fontFamily: 'STKaiti, KaiTi, sans-serif',
      }}>
        双轨动力 · 红黄绿灯状态
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        gap: '1rem',
        flex: 1
      }}>
        {teams.map((team, idx) => {
          let lightColor = '#52c41a' // green
          let lightShadow = '0 0 10px #52c41a'
          if (team.statusLight === 'red') {
            lightColor = '#f5222d'
            lightShadow = '0 0 10px #f5222d'
          } else if (team.statusLight === 'yellow') {
            lightColor = '#faad14'
            lightShadow = '0 0 10px #faad14'
          }

          return (
            <div
              key={idx}
              className="screen-card scroll-paper"
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '1rem',
                border: '1px solid rgba(183, 28, 28, 0.2)',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.8)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              }}
            >
              {/* 四角装饰 */}
              <div className="scroll-corner-decor-top-right" style={{ transform: 'scale(0.7)' }} />
              <div className="scroll-corner-decor-bottom-left" style={{ transform: 'scale(0.7)' }} />

              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                {team.teamName}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>
                巴长: {team.leader}
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-primary)' }}>营销新签: {team.marketingActual}万 / 目标: {team.marketingTarget}万</span>
                  <span style={{ color: team.marketingRate >= 100 ? '#52c41a' : '#f5222d', fontWeight: 'bold' }}>
                    达成率: {team.marketingRate}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-primary)' }}>交付新签: {team.deliveryActual}万 / 目标: {team.deliveryTarget}万</span>
                  <span style={{ color: team.deliveryRate >= 100 ? '#52c41a' : '#f5222d', fontWeight: 'bold' }}>
                    达成率: {team.deliveryRate}%
                  </span>
                </div>
              </div>

              <div style={{
                marginTop: '1rem',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: lightColor,
                boxShadow: lightShadow,
                border: '2px solid rgba(255,255,255,0.8)'
              }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DualTrackGrid
