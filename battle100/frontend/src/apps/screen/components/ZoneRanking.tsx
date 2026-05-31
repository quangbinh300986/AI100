import React from 'react'
import type { RankingItem } from '@shared/types'

interface ZoneRankingProps {
  theme?: string
  zoneRanking?: RankingItem[]
  zoneTeamsPK?: Record<string, RankingItem[]>
}

const ZoneRanking: React.FC<ZoneRankingProps> = ({
  theme = 'theme-light-red',
  zoneTeamsPK
}) => {
  // 默认高保真的 3 战区各 3 战队内PK赛马 Mock 数据
  const defaultZoneTeamsPK: Record<string, RankingItem[]> = {
    '第一战区': [
      { rank: 1, name: '清远战队', score: 78.4, trend: 'up' },
      { rank: 2, name: '广州一战队', score: 72.1, trend: 'same' },
      { rank: 3, name: '广州二战队', score: 65.8, trend: 'down' }
    ],
    '第二战区': [
      { rank: 1, name: '广州三战队（大数据）', score: 55.2, trend: 'up' },
      { rank: 2, name: '佛山战队', score: 48.0, trend: 'same' },
      { rank: 3, name: '湛江战队', score: 32.5, trend: 'down' }
    ],
    '第三战区': [
      { rank: 1, name: '云浮战队', score: 82.5, trend: 'up' },
      { rank: 2, name: '东莞战队', score: 61.4, trend: 'same' },
      { rank: 3, name: '茂名战队', score: 44.0, trend: 'down' }
    ]
  }

  const pkData = zoneTeamsPK && Object.keys(zoneTeamsPK).length > 0 ? zoneTeamsPK : defaultZoneTeamsPK

  // 白天红金主题下的超燃渐变进度条颜色
  const getProgressBarBg = (idx: number) => {
    if (idx === 0) return 'linear-gradient(90deg, #ff4d4f 0%, #a8071a 100%)' // 燃情深红 (冠军)
    if (idx === 1) return 'linear-gradient(90deg, #ff9c6e 0%, #d4380d 100%)' // 暖火橙 (亚军)
    return 'linear-gradient(90deg, #ffd8bf 0%, #fa541c 100%)' // 晚霞红 (季军)
  }

  return (
    <div
      className="screen-card scroll-paper"
      style={{
        padding: '1.5rem',
        height: 'calc(100% - 3rem)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="scroll-corner-decor-top-right" />
      <div className="scroll-corner-decor-bottom-left" />

      <h3
        style={{
          margin: '0 0 1rem 0',
          fontSize: '1.6rem',
          color: 'var(--accent-color)',
          borderBottom: '3px solid var(--border-color)',
          paddingBottom: '0.8rem',
          fontWeight: '900'
        }}
      >
        🏇 各大战区指挥部：内部赛马竞速榜
      </h3>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        {Object.entries(pkData).slice(0, 3).map(([zoneName, teams], zIdx) => (
          <div
            key={zoneName}
            style={{
              flex: 1,
              background: 'rgba(211, 47, 47, 0.03)',
              border: '2px solid rgba(212, 175, 55, 0.4)',
              borderRadius: '8px',
              padding: '1rem 1.2rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            {/* 战区大标题 */}
            <div
              style={{
              fontSize: '1.4rem',
              fontWeight: '900',
              color: 'var(--text-primary)',
              borderBottom: '2px dashed rgba(212, 175, 55, 0.6)',
              paddingBottom: '0.5rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}
          >
            <span style={{ fontSize: '1.6rem' }}>🚩</span>
            <span style={{ letterSpacing: '2px' }}>{zoneName}</span>
              <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                (内战 PK)
              </span>
            </div>

            {/* 3支战队超大字号赛跑道 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {teams.map((t, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {/* 战队名 */}
                  <div
                    style={{
                      width: '8.5rem',
                      fontSize: '1.25rem',
                      fontWeight: '900',
                      color: idx === 0 ? '#d4380d' : 'var(--text-primary)',
                      textShadow: idx === 0 ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    {idx === 0 && <span>👑</span>}
                    {idx !== 0 && <span style={{ visibility: 'hidden' }}>👑</span>}
                    {t.name}
                  </div>

                  {/* 超粗赛道与巨型百分比 */}
                  <div
                    style={{
                      flex: 1,
                      height: '36px',
                      background: 'rgba(0, 0, 0, 0.05)',
                      borderRadius: '18px',
                      border: '1px solid rgba(0,0,0,0.1)',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div
                      className="progress-bar-glow"
                      style={{
                        width: `${Math.min(t.score, 100)}%`,
                        background: getProgressBarBg(idx),
                        height: '100%',
                        borderRadius: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: '12px',
                        position: 'relative',
                        transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      {/* 赛道马 */}
                      <span style={{ fontSize: '1.4rem', transform: 'scaleX(-1)', marginRight: '4px', textShadow: '2px 0 4px rgba(0,0,0,0.3)' }}>🏇</span>
                    </div>
                  </div>

                  {/* 巨型达成率数字 */}
                  <div
                    className="glow-number"
                    style={{ 
                      width: '6rem', 
                      fontSize: '1.6rem', 
                      textAlign: 'right',
                      color: idx === 0 ? '#b71c1c' : 'var(--accent-color)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    }}
                  >
                    {t.score.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ZoneRanking

