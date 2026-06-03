import React, { useState } from 'react'
import type { DualTrackTeam } from '@shared/types'
import { getTeamDetailedMetrics } from '@shared/api/dashboard'

interface DualTrackGridProps {
  theme?: string
  teams?: DualTrackTeam[]
}

const DualTrackGrid: React.FC<DualTrackGridProps> = ({ theme = 'theme-light-red', teams = [] }) => {
  const [modalVisible, setModalVisible] = useState(false)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [selectedMetrics, setSelectedMetrics] = useState<any>(null)
  const [activeTeamName, setActiveTeamName] = useState('')

  const handleCardClick = async (teamId: number | undefined, teamName: string) => {
    if (!teamId) return
    setActiveTeamName(teamName)
    setModalVisible(true)
    setMetricsLoading(true)
    setSelectedMetrics(null)
    try {
      const res = await getTeamDetailedMetrics(teamId)
      const actualData = (res as any)?.data ? (res as any).data : res
      if (actualData) {
        setSelectedMetrics(actualData)
      } else {
        setSelectedMetrics(res)
      }
    } catch (err) {
      console.error('获取战队多维度指标失败:', err)
    } finally {
      setMetricsLoading(false)
    }
  }

  // 定义三大战区的匹配规则与样式
  const zoneDefs = [
    {
      id: 1,
      name: '第一战区',
      dotColor: '#1890ff',
      bgColor: 'rgba(24, 144, 255, 0.05)',
      borderColor: 'rgba(24, 144, 255, 0.12)',
      teamNames: ['清远战队', '广州一战队', '广州二战队']
    },
    {
      id: 2,
      name: '第二战区',
      dotColor: '#722ed1',
      bgColor: 'rgba(114, 46, 209, 0.05)',
      borderColor: 'rgba(114, 46, 209, 0.12)',
      teamNames: ['广州三战队（大数据）', '佛山战队', '湛江战队']
    },
    {
      id: 3,
      name: '第三战区',
      dotColor: '#eb2f96',
      bgColor: 'rgba(235, 47, 150, 0.05)',
      borderColor: 'rgba(235, 47, 150, 0.12)',
      teamNames: ['云浮战队', '东莞战队', '茂名战队']
    }
  ]

  // 将 teams 转化为以战队名称为 key 的 Map
  const teamMap = new Map<string, DualTrackTeam>()
  teams.forEach(t => {
    teamMap.set(t.teamName, t)
  })

  // 默认巴长姓名对照表
  const defaultLeaders: Record<string, string> = {
    '清远战队': '郑子鹏',
    '广州一战队': '陈浩龙',
    '广州二战队': '刘罗军',
    '广州三战队（大数据）': '伍耀强',
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
    '佛山战队': { m: 920, d: 1000 },
    '湛江战队': { m: 700, d: 550 },
    '云浮战队': { m: 550, d: 450 },
    '东莞战队': { m: 270, d: 200 },
    '茂名战队': { m: 570, d: 120 }
  }

  const roundPct = (num: number) => {
    return Math.round(num * 100) / 100
  }

  const getMetricsRows = (m: any) => {
    if (!m) return []
    return [
      {
        key: 'm_contract',
        name: '💰 营销新签合同额',
        definition: '合同已加盖双方公章，营销人员所属战队新签总额',
        target: `${m.marketing_target} 万元`,
        actual: `${m.marketing_actual} 万元`,
        rate: m.marketing_target > 0 ? roundPct(m.marketing_actual / m.marketing_target * 100) : 0.0,
        hasBar: true
      },
      {
        key: 'd_contract',
        name: '🛠️ 交付新签合同额',
        definition: '合同已加盖双方公章，技术/交付人员所属战队新签总额',
        target: `${m.delivery_target} 万元`,
        actual: `${m.delivery_actual} 万元`,
        rate: m.delivery_target > 0 ? roundPct(m.delivery_actual / m.delivery_target * 100) : 0.0,
        hasBar: true
      },
      {
        key: 'valid_leads',
        name: '🔍 有效需求线索量',
        definition: '本系统有效线索库中进度为25%的线索总数量',
        target: `${m.valid_leads_target} 条`,
        actual: m.valid_leads_actual !== null ? `${m.valid_leads_actual} 条` : '—',
        rate: (m.valid_leads_actual !== null && m.valid_leads_target > 0) ? roundPct(m.valid_leads_actual / m.valid_leads_target * 100) : 0.0,
        hasBar: m.valid_leads_actual !== null && m.valid_leads_target > 0
      },
      {
        key: 'potential_leads',
        name: '📈 潜力需求线索量',
        definition: 'CRM线索库中进度在 5%~10% 的线索数（CRM专属指标）',
        target: '—',
        actual: m.potential_leads_actual !== null ? `${m.potential_leads_actual} 条` : '—',
        rate: 0.0,
        hasBar: false
      },
      {
        key: 'conversion',
        name: '📊 线索转化率',
        definition: '新签线索个数 / 上月有效线索池总个数 * 100%（CRM线索转化指标）',
        target: '—',
        actual: m.leads_conversion_rate !== null ? `${m.leads_conversion_rate} %` : '—',
        rate: 0.0,
        hasBar: false
      },
      {
        key: 'new_customer',
        name: '🆕 战役新客户数',
        definition: '本战队已审核日报中，新签合同明细里去重客户总数',
        target: '—',
        actual: `${m.new_customers_actual} 个`,
        rate: 0.0,
        hasBar: false
      },
      {
        key: 'renew',
        name: '🔄 续签合同额',
        definition: '同一科室两年内再次签订的合同额总数（基于合同描述智能检索）',
        target: '—',
        actual: `${m.renew_amount_actual} 万元`,
        rate: 0.0,
        hasBar: false
      },
      {
        key: 'triangle',
        name: '🤝 售前铁三角联动',
        definition: '本战队全体员工共同客户接触、联动拜访累计次数',
        target: '—',
        actual: `${m.triangle_actual} 次`,
        rate: 0.0,
        hasBar: false
      },
      {
        key: 'happiness',
        name: '😊 客户幸福标准动作',
        definition: '本战队全员做到幸福关怀动作并收到客户正反馈的次数',
        target: '—',
        actual: `${m.happiness_actual} 次`,
        rate: 0.0,
        hasBar: false
      }
    ]
  }

  return (
    <>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem', overflow: 'hidden' }}>
      {/* 模块主标题 */}
      <div style={{
        fontSize: '1.1rem',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: '#ffd700',
        borderLeft: '4px solid #ffd700',
        paddingLeft: '0.6rem',
        flexShrink: 0
      }}>
        战队双轨动力大PK (3x3九宫格看板，点击卡片可查看战队多维度指标)
      </div>

      {/* 战区分组滚动区域 - 高度压缩，间距压缩 */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '4px' }}>
        {zoneDefs.map((zone) => {
          // 找出当前战区匹配的所有战队数据
          const matchedTeams: DualTrackTeam[] = []
          const defaultTeamIds: Record<string, number> = {
            '清远战队': 1,
            '广州一战队': 2,
            '广州二战队': 3,
            '广州三战队（大数据）': 4,
            '佛山战队': 5,
            '湛江战队': 6,
            '云浮战队': 7,
            '东莞战队': 8,
            '茂名战队': 9
          }
          zone.teamNames.forEach(name => {
            const teamData = teamMap.get(name)
            if (teamData) {
              matchedTeams.push(teamData)
            } else {
              // 兜底重归零，防止后端暂无该战队数据时界面崩塌，保证数据完全真实
              const targets = defaultTargets[name] || { m: 1000, d: 800 }
              const matchedTeamInOrig = teams.find(t => t.teamName === name)
              matchedTeams.push({
                teamId: matchedTeamInOrig?.teamId || defaultTeamIds[name] || 0,
                teamName: name,
                leader: defaultLeaders[name] || '巴长',
                marketingActual: 0,
                marketingTarget: targets.m,
                marketingRate: 0,
                deliveryActual: 0,
                deliveryTarget: targets.d,
                deliveryRate: 0,
                validLeadsActual: 0,
                validLeadsTarget: 0,
                validLeadsRate: 0,
                statusLight: 'red'
              })
            }
          })

          // 限制只保留前3个以对齐 3x3
          const displayTeams = matchedTeams.slice(0, 3)

          return (
            <div
              key={zone.id}
              className="screen-card scroll-paper"
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'row', // 左右两栏布局
                alignItems: 'stretch',
                border: `2px solid ${zone.dotColor}aa`, // 战区描边大框
                borderRadius: '8px',
                padding: '0.2rem 0.3rem', // 极度压缩内部 padding
                background: theme === 'theme-gold' ? 'rgba(212, 175, 55, 0.02)' : 'rgba(0, 0, 0, 0.015)',
                boxShadow: `0 2px 10px rgba(0,0,0,0.01), inset 0 0 10px ${zone.dotColor}05`,
                flex: 1,
                minHeight: 0
              }}
            >
              {/* 四角金色包边 */}
              <div className="scroll-corner-decor-top-right" style={{ transform: 'scale(0.5)' }} />
              <div className="scroll-corner-decor-bottom-left" style={{ transform: 'scale(0.5)' }} />

              {/* 左侧：战区竖排字签栏 */}
              <div style={{
                width: '2.1rem',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(180deg, ${zone.dotColor} 0%, #111111 100%)`,
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: '1.2rem',
                borderRadius: '6px',
                padding: '0.5rem 0',
                marginRight: '0.4rem',
                boxShadow: `0 2px 6px ${zone.dotColor}22`
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.15rem',
                  lineHeight: 1.15,
                  letterSpacing: '1px'
                }}>
                  {(zone.id === 1 ? '第一战区' : zone.id === 2 ? '第二战区' : '第三战区').split('').map((char, charIdx) => (
                    <span key={charIdx}>{char}</span>
                  ))}
                </div>
              </div>

              {/* 右侧：战队卡片三列排开 - 间距压缩 */}
              <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.4rem'
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
                      className="screen-card scroll-paper screen-team-card-clickable"
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        gap: '0.2rem', // 缩减间隙以适应小屏
                        padding: '0.35rem 0.6rem', // 缩减内边距，减少高度占用
                        border: '1px solid rgba(0,0,0,0.06)',
                        borderRadius: '6px',
                        background: '#ffffff',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleCardClick(team.teamId, team.teamName)}
                    >
                      <div className="scroll-corner-decor-top-right" style={{ transform: 'scale(0.4)' }} />
                      <div className="scroll-corner-decor-bottom-left" style={{ transform: 'scale(0.4)' }} />

                      {/* 卡片头部：战队名与状态灯 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#111111' }}>
                          {team.teamName}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: lightColor, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: lightColor }} />
                          <span>{lightText}</span>
                        </span>
                      </div>

                      {/* 队长/巴长名字 */}
                      <div style={{ fontSize: '0.85rem', color: '#666666', marginBottom: '0' }}>
                        战队巴长: <strong style={{ color: '#333333' }}>{team.leader}</strong>
                      </div>

                      {/* 双轨指标与进度条 - 紧凑间距 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem', width: '100%' }}>
                        {/* 营销指标 */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0' }}>
                            <span style={{ color: '#8c8c8c', fontWeight: 'bold' }}>营销实际/目标</span>
                            <span style={{ color: '#333333', fontWeight: 'bold' }}>
                              {team.marketingActual.toFixed(1).replace('.0', '')}/{team.marketingTarget.toFixed(1).replace('.0', '')}万
                              <span style={{ color: team.marketingRate > 0 ? '#1890ff' : '#8c8c8c', marginLeft: '0.15rem' }}>
                                ({team.marketingRate.toFixed(1).replace('.0', '')}%)
                              </span>
                            </span>
                          </div>
                          <div className="progress-track" style={{ height: '5px', borderRadius: '2.5px', backgroundColor: '#f5f5f5' }}>
                            <div
                              style={{
                                width: `${Math.min(team.marketingRate, 100)}%`,
                                background: 'linear-gradient(90deg, #1890ff 0%, #00d4ff 100%)',
                                height: '100%',
                                borderRadius: '2.5px'
                              }}
                            />
                          </div>
                        </div>

                        {/* 交付指标 */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0' }}>
                            <span style={{ color: '#8c8c8c', fontWeight: 'bold' }}>交付实际/目标</span>
                            <span style={{ color: '#333333', fontWeight: 'bold' }}>
                              {team.deliveryActual.toFixed(1).replace('.0', '')}/{team.deliveryTarget.toFixed(1).replace('.0', '')}万
                              <span style={{ color: team.deliveryRate > 0 ? '#52c41a' : '#8c8c8c', marginLeft: '0.15rem' }}>
                                ({team.deliveryRate.toFixed(1).replace('.0', '')}%)
                              </span>
                            </span>
                          </div>
                          <div className="progress-track" style={{ height: '5px', borderRadius: '2.5px', backgroundColor: '#f5f5f5' }}>
                            <div
                              style={{
                                width: `${Math.min(team.deliveryRate, 100)}%`,
                                background: 'linear-gradient(90deg, #52c41a 0%, #95de64 100%)',
                                height: '100%',
                                borderRadius: '2.5px'
                              }}
                            />
                          </div>
                        </div>

                        {/* 有效线索指标 */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0' }}>
                            <span style={{ color: '#8c8c8c', fontWeight: 'bold' }}>有效线索实际/目标</span>
                            <span style={{ color: '#333333', fontWeight: 'bold' }}>
                              {team.validLeadsActual ?? 0}/{team.validLeadsTarget ?? 0}条
                              <span style={{ color: (team.validLeadsRate ?? 0) > 0 ? '#faad14' : '#8c8c8c', marginLeft: '0.15rem' }}>
                                ({(team.validLeadsRate ?? 0).toFixed(1).replace('.0', '')}%)
                              </span>
                            </span>
                          </div>
                          <div className="progress-track" style={{ height: '5px', borderRadius: '2.5px', backgroundColor: '#f5f5f5' }}>
                            <div
                              style={{
                                width: `${Math.min(team.validLeadsRate ?? 0, 100)}%`,
                                background: 'linear-gradient(90deg, #faad14 0%, #ffe58f 100%)',
                                height: '100%',
                                borderRadius: '2.5px'
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

    {/* 注入红金弹窗定制样式 */}
    <style dangerouslySetInnerHTML={{__html: `
      .screen-team-card-clickable {
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease !important;
      }
      .screen-team-card-clickable:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3), inset 0 0 10px rgba(212, 175, 55, 0.15) !important;
        border-color: rgba(212, 175, 55, 0.6) !important;
      }
      .red-gold-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: fadeInOverlay 0.3s ease forwards;
      }
      .red-gold-modal-content {
        width: 42rem;
        background: linear-gradient(135deg, rgba(35, 2, 2, 0.98) 0%, rgba(15, 0, 0, 0.99) 100%);
        border: 2px solid rgba(212, 175, 55, 0.85);
        border-radius: 12px;
        box-shadow: 0 10px 35px rgba(0, 0, 0, 0.85), 0 0 20px rgba(212, 175, 55, 0.25);
        position: relative;
        padding: 1rem;
        color: #ffffff;
        animation: scaleInContent 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      @keyframes fadeInOverlay {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scaleInContent {
        from { transform: scale(0.9) translateY(10px); opacity: 0; }
        to { transform: scale(1) translateY(0); opacity: 1; }
      }
      .red-gold-close-btn {
        position: absolute;
        top: 0.8rem;
        right: 1rem;
        background: none;
        border: none;
        color: #ffd700;
        font-size: 1.6rem;
        cursor: pointer;
        transition: transform 0.2s ease, text-shadow 0.2s ease;
        line-height: 1;
        z-index: 10;
      }
      .red-gold-close-btn:hover {
        transform: scale(1.2) rotate(90deg);
        text-shadow: 0 0 10px #ffd700;
      }
      .red-gold-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 0.6rem;
      }
      .red-gold-table th {
        background: linear-gradient(90deg, #5c0606 0%, #1f0303 100%);
        color: #ffd700;
        font-weight: bold;
        text-align: left;
        padding: 0.45rem 0.6rem;
        font-size: 0.95rem;
        border-bottom: 2px solid rgba(212, 175, 55, 0.5);
      }
      .red-gold-table td {
        padding: 0.45rem 0.6rem;
        font-size: 0.9rem;
        border-bottom: 1px solid rgba(212, 175, 55, 0.15);
      }
      .red-gold-table tr:nth-child(even) {
        background: rgba(0, 0, 0, 0.25);
      }
      .red-gold-table tr:nth-child(odd) {
        background: rgba(212, 175, 55, 0.02);
      }
      .red-gold-tag {
        display: inline-block;
        padding: 0.2rem 0.5rem;
        font-size: 0.8rem;
        border-radius: 4px;
        font-weight: bold;
      }
      .red-gold-tag-success {
        background: rgba(82, 196, 26, 0.15);
        color: #52c41a;
        border: 1px solid rgba(82, 196, 26, 0.35);
      }
      .red-gold-tag-error {
        background: rgba(245, 34, 45, 0.15);
        color: #f5222d;
        border: 1px solid rgba(245, 34, 45, 0.35);
      }
    `}} />

    {/* 红金多维指标弹窗 */}
    {modalVisible && (
      <div className="red-gold-modal-overlay" onClick={() => setModalVisible(false)}>
        <div className="red-gold-modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="red-gold-close-btn" onClick={() => setModalVisible(false)}>×</button>
          
          {/* 四角金色包边饰条 */}
          <div className="scroll-corner-decor-top-right" style={{ transform: 'scale(0.7)', top: '4px', right: '4px' }} />
          <div className="scroll-corner-decor-bottom-left" style={{ transform: 'scale(0.7)', bottom: '4px', left: '4px' }} />
          
          {/* 标题 */}
          <div style={{
            background: 'linear-gradient(90deg, #5c0606 0%, #1c0000 100%)',
            padding: '0.6rem 1rem',
            borderRadius: '6px',
            borderBottom: '1px solid rgba(212, 175, 55, 0.5)',
            marginBottom: '0.6rem'
          }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ffd700', letterSpacing: '1px' }}>
              ⚔️ 【{activeTeamName}】多维度精细化指标明细
            </span>
          </div>

          {metricsLoading ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              {/* 豪华金色旋转 Loading */}
              <div style={{
                width: '3rem',
                height: '3rem',
                border: '4px solid rgba(255, 215, 0, 0.1)',
                borderTop: '4px solid #ffd700',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}} />
              <div style={{ fontSize: '0.95rem', color: '#b8a16c' }}>正在从 CRM 客户管理系统及本地同步加载最新数据...</div>
            </div>
          ) : selectedMetrics ? (
            <div>
              {/* 对接状态与口径 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.6rem',
                background: 'rgba(0, 0, 0, 0.35)',
                padding: '0.45rem 0.8rem',
                borderRadius: 6,
                border: '1px solid rgba(212, 175, 55, 0.2)'
              }}>
                <div style={{ fontSize: '0.85rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>CRM系统对接状态：</span>
                  {selectedMetrics.crm_connected ? (
                    <span className="red-gold-tag red-gold-tag-success">🟢 已直连CRM（实时提取有效与潜力线索）</span>
                  ) : (
                    <span className="red-gold-tag red-gold-tag-error">❌ 连接离线（无法显示最新线索）</span>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#ffffff' }}>
                  数据统计口径：<strong style={{ color: '#ffd700' }}>按本战队全员累加</strong>
                </div>
              </div>

              {/* 指标数据表 */}
              <table className="red-gold-table">
                <thead>
                  <tr>
                    <th style={{ width: '25%' }}>作战多维指标</th>
                    <th style={{ width: '38%' }}>口径/定义解析</th>
                    <th style={{ width: '12%' }}>保底奋斗目标</th>
                    <th style={{ width: '12%' }}>真实实际完成</th>
                    <th style={{ width: '13%' }}>达成进度</th>
                  </tr>
                </thead>
                <tbody>
                  {getMetricsRows(selectedMetrics).map((row) => (
                    <tr key={row.key}>
                      <td style={{ fontWeight: 'bold', color: '#ffffff' }}>{row.name}</td>
                      <td style={{ color: '#d0c0a0', fontSize: '0.8rem', lineHeight: 1.25 }}>{row.definition}</td>
                      <td style={{ color: '#b8a16c' }}>{row.target}</td>
                      <td style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '0.95rem' }}>{row.actual}</td>
                      <td>
                        {row.hasBar ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <div style={{ flex: 1, height: '6px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
                              <div style={{
                                width: `${Math.min(row.rate, 100)}%`,
                                background: 'linear-gradient(90deg, #ff4d4f 0%, #faad14 60%, #ffd700 100%)',
                                height: '100%',
                                borderRadius: '3px'
                              }} />
                            </div>
                            <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '0.8rem', minWidth: '2rem', textAlign: 'right' }}>
                              {row.rate}%
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#8c8c8c' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#b8a16c' }}>未获取到战队指标数据</div>
          )}
        </div>
      </div>
    )}
  </>
)
}

export default DualTrackGrid
