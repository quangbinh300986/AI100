import React from 'react'
import type { RankingItem } from '@shared/types'

interface ZoneLeaderboardProps {
  theme?: string
  zoneTeamsPK?: Record<string, RankingItem[]>
}

const ZoneLeaderboard: React.FC<ZoneLeaderboardProps> = ({ theme = 'theme-light-red', zoneTeamsPK }) => {
  // 默认周冲刺兜底，所有实际值置零，保证只跑真实数据
  const defaultZoneTeamsPK: Record<string, RankingItem[]> = {
    '第一战区': [
      { rank: 1, name: '清远战队', score: 0.0, trend: 'same' },
      { rank: 2, name: '广州一战队', score: 0.0, trend: 'same' },
      { rank: 3, name: '广州二战队', score: 0.0, trend: 'same' }
    ],
    '第二战区': [
      { rank: 1, name: '广州三战队（大数据）', score: 0.0, trend: 'same' },
      { rank: 2, name: '佛山战队', score: 0.0, trend: 'same' },
      { rank: 3, name: '湛江战队', score: 0.0, trend: 'same' }
    ],
    '第三战区': [
      { rank: 1, name: '东莞战队', score: 0.0, trend: 'same' },
      { rank: 2, name: '云浮战队', score: 0.0, trend: 'same' },
      { rank: 3, name: '茂名战队', score: 0.0, trend: 'same' }
    ]
  }

  const pkData = zoneTeamsPK && Object.keys(zoneTeamsPK).length > 0 ? zoneTeamsPK : defaultZoneTeamsPK

  // 将 zoneTeamsPK 平铺成表格行数组，方便在 React 中渲染并处理 RowSpan
  const tableRows: Array<{
    zoneName: string
    rank: number
    teamName: string
    score: number
    trend: string
    rowSpan: number // 第一行设为3，其余设为0
  }> = []

  // 按固定的第一、第二、第三战区顺序扁平化
  const sortedZones = ['第一战区', '第二战区', '第三战区']
  sortedZones.forEach(zoneName => {
    const teams = pkData[zoneName] || []
    teams.forEach((t, idx) => {
      tableRows.push({
        zoneName,
        rank: t.rank,
        teamName: t.name,
        score: t.score,
        trend: t.trend,
        rowSpan: idx === 0 ? teams.length : 0
      })
    })
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* 模块主标题 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: '1rem',
        borderLeft: '4px solid var(--accent-color, #b71c1c)',
        paddingLeft: '0.8rem',
        flexShrink: 0
      }}>
        <div style={{
          fontSize: '1.25rem',
          fontWeight: 'bold',
          color: 'var(--accent-color, #b71c1c)',
          fontFamily: 'STKaiti, KaiTi, sans-serif',
        }}>
          各战区战队周冲刺排名 (周一开始清零)
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #666666)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold' }}>
          周度奖励核算看板 <span>🏆</span>
        </div>
      </div>

      {/* 冲刺排名表格 */}
      <div
        className="screen-card scroll-paper"
        style={{
          padding: '0.8rem',
          border: '1px solid rgba(183, 28, 28, 0.15)',
          borderRadius: '8px',
          background: '#ffffff',
          overflow: 'hidden'
        }}
      >
        <div className="scroll-corner-decor-top-right" style={{ transform: 'scale(0.5)' }} />
        <div className="scroll-corner-decor-bottom-left" style={{ transform: 'scale(0.5)' }} />

        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'center',
          fontSize: '0.85rem'
        }}>
          <thead>
            <tr style={{
              background: 'rgba(183, 28, 28, 0.05)',
              borderBottom: '2px solid rgba(183, 28, 28, 0.25)',
            }}>
              <th style={{ padding: '0.65rem 1rem', color: 'var(--accent-color, #b71c1c)', fontWeight: 'bold' }}>战区名称</th>
              <th style={{ padding: '0.65rem 1rem', color: 'var(--accent-color, #b71c1c)', fontWeight: 'bold' }}>区内排名</th>
              <th style={{ padding: '0.65rem 1rem', color: 'var(--accent-color, #b71c1c)', fontWeight: 'bold' }}>战队名称</th>
              <th style={{ padding: '0.65rem 1rem', color: 'var(--accent-color, #b71c1c)', fontWeight: 'bold' }}>完成百分比 (%)</th>
              <th style={{ padding: '0.65rem 1rem', color: 'var(--accent-color, #b71c1c)', fontWeight: 'bold' }}>趋势</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, idx) => {
              // 计算区内排名的 Tag 样式
              let rankBg = '#f5f5f5'
              let rankColor = '#666666'
              let rankBorder = '1px solid #d9d9d9'
              
              if (row.rank === 1) {
                rankBg = '#fffbe6'
                rankColor = '#d46b08'
                rankBorder = '1px solid #ffe58f'
              } else if (row.rank === 2) {
                rankBg = '#e6f7ff'
                rankColor = '#096dd9'
                rankBorder = '1px solid #91d5ff'
              }

              // 计算趋势 Tag 样式
              let trendColor = '#8c8c8c'
              let trendText = '→ 持平'
              if (row.trend === 'up') {
                trendColor = '#389e0d'
                trendText = '↑ 上升'
              } else if (row.trend === 'down') {
                trendColor = '#cf1322'
                trendText = '↓ 下降'
              }

              return (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    background: idx % 2 === 0 ? 'rgba(0,0,0,0.01)' : 'transparent'
                  }}
                >
                  {/* 战区名称合并单元格 */}
                  {row.rowSpan > 0 && (
                    <td
                      rowSpan={row.rowSpan}
                      style={{
                        padding: '0.8rem 1rem',
                        fontWeight: '900',
                        color: '#111111',
                        borderRight: '1px solid rgba(0,0,0,0.06)',
                        verticalAlign: 'middle',
                        fontFamily: 'STKaiti, KaiTi, sans-serif',
                        fontSize: '0.95rem'
                      }}
                    >
                      {row.zoneName}
                    </td>
                  )}
                  
                  {/* 区内排名 */}
                  <td style={{ padding: '0.65rem 1rem', borderRight: '1px solid rgba(0,0,0,0.06)' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      background: rankBg,
                      color: rankColor,
                      border: rankBorder,
                      fontWeight: 'bold',
                      fontSize: '0.75rem'
                    }}>
                      Top {row.rank}
                    </span>
                  </td>

                  {/* 战队名称 */}
                  <td style={{ padding: '0.65rem 1rem', fontWeight: 'bold', color: '#333333', borderRight: '1px solid rgba(0,0,0,0.06)' }}>
                    {row.teamName}
                  </td>

                  {/* 完成百分比 */}
                  <td style={{ padding: '0.65rem 1rem', fontWeight: 'bold', color: row.score > 0 ? '#1890ff' : '#333333', borderRight: '1px solid rgba(0,0,0,0.06)' }}>
                    {row.score.toFixed(2).replace('.00', '')}%
                  </td>

                  {/* 趋势 */}
                  <td style={{ padding: '0.65rem 1rem', fontWeight: 'bold', color: trendColor }}>
                    {trendText}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ZoneLeaderboard
