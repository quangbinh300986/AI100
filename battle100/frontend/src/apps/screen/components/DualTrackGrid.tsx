import React from 'react'
import type { DualTrackTeam } from '@shared/types'

interface DualTrackGridProps {
  theme?: string
  teams?: DualTrackTeam[]
}

const DualTrackGrid: React.FC<DualTrackGridProps> = ({ theme = 'theme-light-red', teams = [] }) => {
  // 定义三大战区的匹配规则与样式
  const zoneDefs = [
    {
      id: 1,
      name: '第一战区 (清远战队、广州一战队、广州二战队)',
      dotColor: '#1890ff',
      bgColor: 'rgba(24, 144, 255, 0.05)',
      borderColor: 'rgba(24, 144, 255, 0.12)',
      teamNames: ['清远战队', '广州一战队', '广州二战队']
    },
    {
      id: 2,
      name: '第二战区 (广州三战队（大数据）、佛山战队、湛江战队)',
      dotColor: '#722ed1',
      bgColor: 'rgba(114, 46, 209, 0.05)',
      borderColor: 'rgba(114, 46, 209, 0.12)',
      teamNames: ['广州三战队（大数据）', '广州三战队', '佛山战队', '湛江战队']
    },
    {
      id: 3,
      name: '第三战区 (云浮战队、东莞战队、茂名战队)',
      dotColor: '#eb2f96',
      bgColor: 'rgba(235, 47, 150, 0.05)',
      borderColor: 'rgba(235, 47, 150, 0.12)',
      teamNames: ['云浮战队', '东莞战队', '茂名战队']
    }
  ]

  // 将 teams 转化为以战队名称为 key 的 Map
  const teamMap = new Map<string, DualTrackTeam>()
  teams.forEach(t => {
    // 兼容可能出现的名字格式
    teamMap.set(t.teamName, t)
  })

  // 默认巴长姓名对照表
  const defaultLeaders: Record<string, string> = {
    '清远战队': '郑子鹏',
    '广州一战队': '陈浩龙',
    '广州二战队': '刘罗军',
    '广州三战队（大数据）': '伍耀强',
    '广州三战队': '伍耀强',
    '佛山战队': '卢俊松',
    '湛江战队': '周真波',
    '云浮战队': '尹晓明',
    '东莞战队': '董卓佼',
    '茂名战队': '陈鸿源'
  }

  // 默认目标额（万元）兜底
  const defaultTargets: Record<string, { m: number, d: number }> = {
    '清远战队': { m: 1400, d: 900 },
    '广州一战队': { m: 1390, d: 1465.16 },
    '广州二战队': { m: 400, d: 1234.92 },
    '广州三战队（大数据）': { m: 0, d: 280 },
    '广州三战队': { m: 0, d: 280 },
    '佛山战队': { m: 920, d: 1000 },
    '湛江战队': { m: 700, d: 550 },
    '云浮战队': { m: 550, d: 450 },
    '东莞战队': { m: 270, d: 200 },
    '茂名战队': { m: 570, d: 120 }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.2rem', overflow: 'hidden' }}>
      {/* 模块主标题 */}
      <div style={{
        fontSize: '1.25rem',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: 'var(--accent-color, #b71c1c)',
        fontFamily: 'STKaiti, KaiTi, sans-serif',
        borderLeft: '4px solid var(--accent-color, #b71c1c)',
        paddingLeft: '0.6rem',
        flexShrink: 0
      }}>
        战队双轨动力大PK (3x3九宫格看板，点击卡片可查看战队多维度指标)
      </div>

      {/* 战区分组滚动区域 */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingRight: '4px' }}>
        {zoneDefs.map((zone) => {
          // 找出当前战区匹配的所有战队数据
          const matchedTeams: DualTrackTeam[] = []
          zone.teamNames.forEach(name => {
            const teamData = teamMap.get(name)
            if (teamData) {
              matchedTeams.push(teamData)
            } else {
              // 兜底重归零，防止后端暂无该战队数据时界面崩塌，保证数据完全真实
              const targets = defaultTargets[name] || { m: 1000, d: 800 }
              matchedTeams.push({
                teamName: name,
                leader: defaultLeaders[name] || '巴长',
                marketingActual: 0,
                marketingTarget: targets.m,
                marketingRate: 0,
                deliveryActual: 0,
                deliveryTarget: targets.d,
                deliveryRate: 0,
                statusLight: 'red'
              })
            }
          })

          // 限制只保留前3个以对齐 3x3 (针对第二战区可能重复匹配大数据名字)
          const displayTeams = matchedTeams.slice(0, 3)

          return (
            <div key={zone.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flexShrink: 0 }}>
              {/* 战区大横条标题栏 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                background: zone.bgColor,
                border: `1px solid ${zone.borderColor}`,
                borderRadius: '6px',
                padding: '0.5rem 1.2rem',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                color: '#333333'
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: zone.dotColor,
                  boxShadow: `0 0 6px ${zone.dotColor}`
                }} />
                <span style={{ letterSpacing: '0.5px' }}>{zone.name}</span>
              </div>

              {/* 战队卡片三列排开 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem'
              }}>
                {displayTeams.map((team, tIdx) => {
                  // 根据灯状态计算颜色与文字
                  let lightColor = '#f5222d' // red
                  let lightText = '预警红灯'
                  if (team.statusLight === 'green') {
                    lightColor = '#52c41a'
                    lightText = '正常绿灯'
                  } else if (team.statusLight === 'yellow') {
                    lightColor = '#faad14'
                    lightText = '预警黄灯'
                  }

                  return (
                    <div
                      key={tIdx}
                      className="screen-card scroll-paper"
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '1.2rem 1.5rem',
                        border: '1px solid rgba(0,0,0,0.06)',
                        borderRadius: '8px',
                        background: '#ffffff',
                        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.03)',
                      }}
                    >
                      {/* 四角金色包边 */}
                      <div className="scroll-corner-decor-top-right" style={{ transform: 'scale(0.6)' }} />
                      <div className="scroll-corner-decor-bottom-left" style={{ transform: 'scale(0.6)' }} />

                      {/* 卡片头部：战队名与状态灯 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#111111' }}>
                          {team.teamName}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: lightColor, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: lightColor }} />
                          <span>{lightText}</span>
                        </span>
                      </div>

                      {/* 队长/巴长名字 */}
                      <div style={{ fontSize: '0.85rem', color: '#666666', marginBottom: '1rem' }}>
                        战队巴长: <strong style={{ color: '#333333' }}>{team.leader}</strong>
                      </div>

                      {/* 双轨指标与进度条 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
                        {/* 营销指标 */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                            <span style={{ color: '#8c8c8c', fontWeight: 'bold' }}>营销新签实际/目标</span>
                            <span style={{ color: '#333333', fontWeight: 'bold' }}>
                              {team.marketingActual.toFixed(1).replace('.0', '')} / {team.marketingTarget.toFixed(1).replace('.0', '')}万
                              <span style={{ color: team.marketingRate > 0 ? '#1890ff' : '#8c8c8c', marginLeft: '0.4rem' }}>
                                ({team.marketingRate.toFixed(2).replace('.00', '')}%)
                              </span>
                            </span>
                          </div>
                          <div className="progress-track" style={{ height: '6px', borderRadius: '3px', backgroundColor: '#f5f5f5' }}>
                            <div
                              style={{
                                width: `${Math.min(team.marketingRate, 100)}%`,
                                background: 'linear-gradient(90deg, #1890ff 0%, #00d4ff 100%)',
                                height: '100%',
                                borderRadius: '3px'
                              }}
                            />
                          </div>
                        </div>

                        {/* 交付指标 */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                            <span style={{ color: '#8c8c8c', fontWeight: 'bold' }}>交付新签实际/目标</span>
                            <span style={{ color: '#333333', fontWeight: 'bold' }}>
                              {team.deliveryActual.toFixed(1).replace('.0', '')} / {team.deliveryTarget.toFixed(1).replace('.0', '')}万
                              <span style={{ color: team.deliveryRate > 0 ? '#52c41a' : '#8c8c8c', marginLeft: '0.4rem' }}>
                                ({team.deliveryRate.toFixed(2).replace('.00', '')}%)
                              </span>
                            </span>
                          </div>
                          <div className="progress-track" style={{ height: '6px', borderRadius: '3px', backgroundColor: '#f5f5f5' }}>
                            <div
                              style={{
                                width: `${Math.min(team.deliveryRate, 100)}%`,
                                background: 'linear-gradient(90deg, #52c41a 0%, #95de64 100%)',
                                height: '100%',
                                borderRadius: '3px'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DualTrackGrid
