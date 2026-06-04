import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import { getMyStats, getTeamDetailedMetrics } from '@shared/api/dashboard'
import { get } from '@shared/api/client'
import type { MyStatsResponse } from '@shared/types'
import { DotLoading, Tabs, Popup } from 'antd-mobile'

/** 快捷入口配置 */
const shortcuts = [
  { icon: '📝', label: '每日填报', path: '/m/report' },
  { icon: '🎯', label: '我的目标', path: '/m/goals' },
  { icon: '🏆', label: '排行榜', path: '/m/ranking' },
  { icon: '👤', label: '个人中心', path: '/m/profile' },
]

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [stats, setStats] = useState<MyStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // 战区大PK Tab 状态，默认全部为中文
  const [activeZoneTab, setActiveZoneTab] = useState<string>('第一战区')

  // 一级指标弹窗状态
  const [teamMetricsVisible, setTeamMetricsVisible] = useState(false)
  const [teamMetricsLoading, setTeamMetricsLoading] = useState(false)
  const [selectedTeamName, setSelectedTeamName] = useState('')
  const [teamMetricsData, setTeamMetricsData] = useState<any>(null)

  // 二级流水明细状态
  const [subDetailVisible, setSubDetailVisible] = useState(false)
  const [subDetailLoading, setSubDetailLoading] = useState(false)
  const [subDetailData, setSubDetailData] = useState<any[]>([])
  const [subDetailTitle, setSubDetailTitle] = useState('')
  const [subDetailType, setSubDetailType] = useState('')

  useEffect(() => {
    let active = true
    getMyStats()
      .then((res) => {
        if (active && res) {
          setStats(res as any)
          // 依据用户所属战区自动锚定初始 Tab
          if (res.team_stats && res.team_stats.zone_name) {
            setActiveZoneTab(res.team_stats.zone_name)
          }
        }
      })
      .catch((err) => {
        console.error('获取级联大屏数据失败:', err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  // 打开一级指标弹窗，加载并显示战队 9 项多维指标明细
  const handleViewTeamMetrics = async (teamId: number, teamName: string) => {
    setSelectedTeamName(teamName)
    setTeamMetricsVisible(true)
    setTeamMetricsLoading(true)
    setTeamMetricsData(null)
    try {
      const res = await getTeamDetailedMetrics(teamId)
      const data = (res as any)?.data ? (res as any).data : res
      if (data) {
        setTeamMetricsData(data)
      }
    } catch (err) {
      console.error('获取战队多维度指标失败:', err)
    } finally {
      setTeamMetricsLoading(false)
    }
  }

  // 加载并打开二级明细卡片弹窗
  const handleViewSubDetail = async (type: string, title: string, teamId: number, extraType?: string) => {
    setSubDetailTitle(title)
    setSubDetailType(type)
    setSubDetailVisible(true)
    setSubDetailLoading(true)
    setSubDetailData([])
    try {
      let res: any
      if (type === 'contracts') {
        res = await get(`/dashboard/team-contracts?team_id=${teamId}&contract_type=${extraType}`)
      } else if (type === 'potential_leads') {
        res = await get(`/dashboard/team-leads?team_id=${teamId}&lead_type=potential`)
      } else if (type === 'valid_leads') {
        res = await get(`/dashboard/company-kpi-detail?kpi_type=leads&team_id=${teamId}`)
      } else if (type === 'triangle') {
        res = await get(`/dashboard/team-triangles?team_id=${teamId}`)
      } else if (type === 'happiness') {
        res = await get(`/dashboard/team-happiness?team_id=${teamId}`)
      }
      
      let data = res?.data ? res.data : res
      // 有效线索接口返回的是 {"list": [...]} 结构，特殊提取
      if (type === 'valid_leads' && data && data.list) {
        data = data.list
      }
      if (data && Array.isArray(data)) {
        setSubDetailData(data)
      }
    } catch (err) {
      console.error('加载战队二级细项明细失败:', err)
    } finally {
      setSubDetailLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <DotLoading color="primary" />
        <span style={{ marginTop: 12, color: '#999', fontSize: 14 }}>加载多级作战数据中...</span>
      </div>
    )
  }

  // 1. 公司盘数据
  const companyStats = stats?.company_stats || {
    newContracts: { value: 0, target: 12400, percentage: 0 },
    happinessActions: { value: 0, target: 3300, percentage: 0 },
    ironTriangle: { value: 0, target: 500, percentage: 0 },
    validLeads: { value: 0, target: 600, percentage: 0 }
  }

  // 2. 战队盘数据
  const teamStats = stats?.team_stats

  // 3. 个人目标数据
  const personalStats = stats?.personal_stats || []

  // 状态灯颜色
  const getLightColor = (light: 'red' | 'yellow' | 'green' | undefined) => {
    if (light === 'green') return '#52c41a'
    if (light === 'yellow') return '#faad14'
    if (light === 'red') return '#ff4d4f'
    return '#bfbfbf'
  }

  return (
    <div className="page-content">
      {/* 顶部问候 */}
      <div style={{ padding: '16px 0 8px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1f1f1f' }}>
          下午好，{user?.name || '冲刺队员'} 👋
        </h2>
        <p style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
          {teamStats ? (
            <>
              所属战队：<span style={{ color: '#1677ff', fontWeight: 600 }}>{teamStats.team_name}</span>
            </>
          ) : (
            <span>中地百日冲刺大本营</span>
          )}
          <span style={{ margin: '0 8px', color: '#ccc' }}>|</span>
          <span>岗位：{user?.position || '冲刺队员'}</span>
        </p>
      </div>

      {/* 快捷入口 */}
      <div
        className="card"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 4 }}
      >
        {shortcuts.map((item) => (
          <div
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '8px 0',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 24 }}>{item.icon}</span>
            <span style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* 第一级：🏆 公司战役总盘 */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #0a1929, #102a4c)',
          color: '#fff',
          padding: 20,
          marginTop: 12,
          boxShadow: '0 4px 16px rgba(10, 25, 41, 0.25)'
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🏆 战役累计公司总盘</span>
          <span style={{ fontSize: 11, color: '#00d4ff', border: '1px solid #00d4ff', padding: '2px 6px', borderRadius: 4 }}>全员共享</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#00d4ff' }}>
              {companyStats.newContracts.value.toLocaleString()} 万元
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>新签合同（目标 {companyStats.newContracts.target}万）</div>
            <div style={{ fontSize: 12, color: '#52c41a', marginTop: 4, fontWeight: 600 }}>
              完成率 {companyStats.newContracts.percentage}%
            </div>
          </div>
          <div style={{ paddingLeft: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#00d4ff' }}>
              {companyStats.happinessActions.value} 次
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>幸福动作（目标 {companyStats.happinessActions.target}次）</div>
            <div style={{ fontSize: 12, color: '#52c41a', marginTop: 4, fontWeight: 600 }}>
              完成率 {companyStats.happinessActions.percentage}%
            </div>
          </div>
          <div style={{ borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: 8, paddingTop: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#00d4ff' }}>
              {companyStats.ironTriangle.value} 次
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>铁三角协作（目标 {companyStats.ironTriangle.target}次）</div>
            <div style={{ fontSize: 12, color: '#52c41a', marginTop: 4, fontWeight: 600 }}>
              完成率 {companyStats.ironTriangle.percentage}%
            </div>
          </div>
          <div style={{ paddingLeft: 8, paddingTop: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#00d4ff' }}>
              {companyStats.validLeads.value} 条
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>有效线索（目标 {companyStats.validLeads.target}条）</div>
            <div style={{ fontSize: 12, color: '#52c41a', marginTop: 4, fontWeight: 600 }}>
              完成率 {companyStats.validLeads.percentage}%
            </div>
          </div>
        </div>
      </div>

      {/* 战区战队大PK看板，所有注释采用中文 */}
      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚔️ 战区战队双轨达成大PK</span>
          <span style={{ fontSize: 11, color: '#1677ff', border: '1px solid #1677ff', padding: '2px 6px', borderRadius: 4 }}>累计实绩</span>
        </div>

        {stats?.zone_teams_data && stats.zone_teams_data.length > 0 ? (
          <Tabs activeKey={activeZoneTab} onChange={(key) => setActiveZoneTab(key)}>
            {stats.zone_teams_data.map((zone) => (
              <Tabs.Tab title={zone.zone_name} key={zone.zone_name}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  {zone.teams.map((t) => {
                    const lightColor = t.status_light === 'green' ? '#52c41a' : t.status_light === 'yellow' ? '#faad14' : '#ff4d4f';
                    const lightText = t.status_light === 'green' ? '正常绿灯' : t.status_light === 'yellow' ? '稍有落后' : '预警红灯';

                    return (
                      <div
                        key={t.team_id}
                        onClick={() => handleViewTeamMetrics(t.team_id, t.team_name)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #f0f0f0',
                          borderRadius: 10,
                          padding: 12,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                          position: 'relative'
                        }}
                      >
                        {/* 头部：战队名与状态灯 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{t.team_name}</span>
                          <span style={{ fontSize: 11, color: lightColor, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'bold' }}>
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: lightColor,
                                boxShadow: `0 0 6px ${lightColor}`,
                                display: 'inline-block'
                              }}
                            />
                            {lightText}
                          </span>
                        </div>

                        {/* 巴长 */}
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                          战队巴长：<span style={{ color: '#111', fontWeight: 600 }}>{t.leader}</span>
                        </div>

                        {/* 三项指标进度 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {/* 营销新签 */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>
                              <span>营销新签实际/目标</span>
                              <span style={{ color: '#111', fontWeight: 600 }}>
                                {t.marketing_actual.toFixed(1).replace('.0', '')} / {t.marketing_target.toFixed(1).replace('.0', '')} 万 ({t.marketing_rate.toFixed(1).replace('.0', '')}%)
                              </span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: '#f5f5f5', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(t.marketing_rate, 100)}%`,
                                  background: 'linear-gradient(90deg, #1890ff, #00d4ff)',
                                  borderRadius: 2
                                }}
                              />
                            </div>
                          </div>

                          {/* 交付新签 */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>
                              <span>交付新签实际/目标</span>
                              <span style={{ color: '#111', fontWeight: 600 }}>
                                {t.delivery_actual.toFixed(1).replace('.0', '')} / {t.delivery_target.toFixed(1).replace('.0', '')} 万 ({t.delivery_rate.toFixed(1).replace('.0', '')}%)
                              </span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: '#f5f5f5', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(t.delivery_rate, 100)}%`,
                                  background: 'linear-gradient(90deg, #52c41a, #95de64)',
                                  borderRadius: 2
                                }}
                              />
                            </div>
                          </div>

                          {/* 有效线索 */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>
                              <span>有效线索实际/目标</span>
                              <span style={{ color: '#111', fontWeight: 600 }}>
                                {t.valid_leads_actual} / {t.valid_leads_target.toFixed(1).replace('.0', '')} 条 ({t.valid_leads_rate.toFixed(1).replace('.0', '')}%)
                              </span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: '#f5f5f5', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(t.valid_leads_rate, 100)}%`,
                                  background: 'linear-gradient(90deg, #faad14, #ffe58f)',
                                  borderRadius: 2
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Tabs.Tab>
            ))}
          </Tabs>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#999', fontSize: 12 }}>
            暂无战区战队大PK数据
          </div>
        )}
      </div>

      {/* 第二级：⚔️ 战队双轨及过程盘 */}
      {teamStats ? (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>⚔️ 战队双轨战斗盘</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: getLightColor(teamStats.status_light),
                  boxShadow: `0 0 8px ${getLightColor(teamStats.status_light)}`,
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>
                {teamStats.status_light === 'green' ? '势头强劲' : teamStats.status_light === 'yellow' ? '稍有落后' : '预警红灯'}
              </span>
            </div>
          </div>

          {/* 战队双轨新签指标 */}
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 6 }}>
              <span>📢 营销新签实际/目标</span>
              <span style={{ fontWeight: 600, color: '#111' }}>
                {teamStats.marketing_actual} / {teamStats.marketing_target} 万元
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden', marginBottom: 12 }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(teamStats.marketing_percentage, 100)}%`,
                  background: 'linear-gradient(90deg, #1677ff, #4096ff)',
                  borderRadius: 3,
                  transition: 'width 0.6s ease'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 6 }}>
              <span>🚀 交付新签实际/目标</span>
              <span style={{ fontWeight: 600, color: '#111' }}>
                {teamStats.delivery_actual} / {teamStats.delivery_target} 万元
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(teamStats.delivery_percentage, 100)}%`,
                  background: 'linear-gradient(90deg, #52c41a, #73d13d)',
                  borderRadius: 3,
                  transition: 'width 0.6s ease'
                }}
              />
            </div>
          </div>

          {/* 战队过程指标表现 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', paddingTop: 4 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>{teamStats.happiness_actions}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>客户幸福动作</div>
            </div>
            <div style={{ borderLeft: '1px solid #edf2f7', borderRight: '1px solid #edf2f7' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>{teamStats.iron_triangle}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>售前铁三角</div>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>{teamStats.valid_leads}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>有效商机线索</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 🎯 查看个人目标跳转入口 */}
      <div
        className="card"
        onClick={() => navigate('/m/goals')}
        style={{ padding: '14px 16px', textAlign: 'center', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 14, color: '#1677ff', fontWeight: 700 }}>
          🎯 查看我的个人目标 ›
        </span>
      </div>

      {/* ================= 一级弹窗：战队多维指标明细 ================= */}
      <Popup
        visible={teamMetricsVisible}
        onMaskClick={() => {
          setTeamMetricsVisible(false)
          setTeamMetricsData(null)
        }}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '70vh', maxHeight: '90vh', padding: 20, overflowY: 'auto' }}
      >
        {selectedTeamName && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontSize: 16, fontWeight: 'bold' }}>
              ⚔️ 【{selectedTeamName}】多维度指标明细
            </span>
            <span onClick={() => {
              setTeamMetricsVisible(false)
              setTeamMetricsData(null)
            }} style={{ color: '#1677ff', fontSize: 14, cursor: 'pointer', fontWeight: 'bold' }}>关闭</span>
          </div>
        )}

        {teamMetricsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><DotLoading color="primary" /></div>
        ) : teamMetricsData ? (
          <div>
            <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: 6, fontSize: 11, color: '#666', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span>CRM对接：{teamMetricsData.crm_connected ? '🟢 已直连CRM' : '❌ 连接离线'}</span>
              <span>口径：全员累计</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                {
                  key: 'm_contract',
                  name: '💰 营销新签合同额',
                  definition: '合同已加盖双方公章，营销人员所属战队新签总额',
                  target: `${teamMetricsData.marketing_target} 万`,
                  actualVal: teamMetricsData.marketing_actual,
                  actual: `${teamMetricsData.marketing_actual} 万`,
                  rate: teamMetricsData.marketing_target > 0 ? (teamMetricsData.marketing_actual / teamMetricsData.marketing_target * 100) : 0,
                  isLink: teamMetricsData.marketing_actual > 0,
                  onClick: () => handleViewSubDetail('contracts', '营销新签项目', teamMetricsData.team_id, 'marketing')
                },
                {
                  key: 'd_contract',
                  name: '🛠️ 交付新签合同额',
                  definition: '合同已加盖双方公章，技术/交付人员所属战队新签总额',
                  target: `${teamMetricsData.delivery_target} 万`,
                  actualVal: teamMetricsData.delivery_actual,
                  actual: `${teamMetricsData.delivery_actual} 万`,
                  rate: teamMetricsData.delivery_target > 0 ? (teamMetricsData.delivery_actual / teamMetricsData.delivery_target * 100) : 0,
                  isLink: teamMetricsData.delivery_actual > 0,
                  onClick: () => handleViewSubDetail('contracts', '交付新签项目', teamMetricsData.team_id, 'delivery')
                },
                {
                  key: 'valid_leads',
                  name: '🔍 有效需求线索量',
                  definition: '本系统有效线索库中进度为25%的线索总数量',
                  target: `${teamMetricsData.valid_leads_target} 条`,
                  actualVal: teamMetricsData.valid_leads_actual,
                  actual: `${teamMetricsData.valid_leads_actual ?? 0} 条`,
                  rate: teamMetricsData.valid_leads_target > 0 ? ((teamMetricsData.valid_leads_actual ?? 0) / teamMetricsData.valid_leads_target * 100) : 0,
                  isLink: (teamMetricsData.valid_leads_actual ?? 0) > 0,
                  onClick: () => handleViewSubDetail('valid_leads', '有效需求线索', teamMetricsData.team_id)
                },
                {
                  key: 'potential_leads',
                  name: '📈 潜力需求线索量',
                  definition: 'CRM线索库中进度在 5%~10% 的线索数（CRM专属指标）',
                  target: '—',
                  actualVal: teamMetricsData.potential_leads_actual,
                  actual: teamMetricsData.potential_leads_actual !== null ? `${teamMetricsData.potential_leads_actual} 条` : '—',
                  rate: 0,
                  isLink: (teamMetricsData.potential_leads_actual ?? 0) > 0,
                  onClick: () => handleViewSubDetail('potential_leads', '潜力需求线索', teamMetricsData.team_id)
                },
                {
                  key: 'conversion',
                  name: '📊 线索转化率',
                  definition: '新签线索个数 / 上月有效线索池总个数 * 100%（CRM线索转化指标）',
                  target: '—',
                  actualVal: 0,
                  actual: teamMetricsData.leads_conversion_rate !== null ? `${teamMetricsData.leads_conversion_rate} %` : '—',
                  rate: 0,
                  isLink: false
                },
                {
                  key: 'new_customer',
                  name: '🆕 战役新客户数',
                  definition: '本战队已审核日报中，新签合同明细里去重客户总数',
                  target: '—',
                  actualVal: 0,
                  actual: `${teamMetricsData.new_customers_actual} 个`,
                  rate: 0,
                  isLink: false
                },
                {
                  key: 'renew',
                  name: '🔄 续签合同额',
                  definition: '同一科室两年内再次签订的合同额总数（基于合同描述智能检索）',
                  target: '—',
                  actualVal: 0,
                  actual: `${teamMetricsData.renew_amount_actual} 万`,
                  rate: 0,
                  isLink: false
                },
                {
                  key: 'triangle',
                  name: '🤝 售前铁三角联动',
                  definition: '本战队全体员工共同客户接触、联动拜访累计次数',
                  target: '—',
                  actualVal: teamMetricsData.triangle_actual,
                  actual: `${teamMetricsData.triangle_actual} 次`,
                  rate: 0,
                  isLink: teamMetricsData.triangle_actual > 0,
                  onClick: () => handleViewSubDetail('triangle', '售前铁三角联动', teamMetricsData.team_id)
                },
                {
                  key: 'happiness',
                  name: '😊 客户幸福标准动作',
                  definition: '本战队全员做到幸福关怀动作并收到客户正反馈的次数',
                  target: '—',
                  actualVal: teamMetricsData.happiness_actual,
                  actual: `${teamMetricsData.happiness_actual} 次`,
                  rate: 0,
                  isLink: teamMetricsData.happiness_actual > 0,
                  onClick: () => handleViewSubDetail('happiness', '客户幸福标准动作', teamMetricsData.team_id)
                }
              ].map(item => (
                <div key={item.key} style={{ border: '1px solid #f0f0f0', padding: 12, borderRadius: 8, background: '#fdfdfd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 'bold', color: '#111' }}>{item.name}</span>
                    {item.target !== '—' && item.rate > 0 ? (
                      <span style={{ fontSize: 11, color: '#1677ff', fontWeight: 'bold' }}>达成率：{item.rate.toFixed(1).replace('.0', '')}%</span>
                    ) : null}
                  </div>
                  
                  {item.target !== '—' && (
                    <div style={{ height: 4, borderRadius: 2, background: '#f5f5f5', overflow: 'hidden', margin: '6px 0 8px 0' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(item.rate, 100)}%`,
                          background: 'linear-gradient(90deg, #ff4d4f 0%, #faad14 60%, #ffd700 100%)',
                          borderRadius: 2
                        }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginTop: 4 }}>
                    <span>目标：{item.target}</span>
                    <span>
                      实际：{item.isLink ? (
                        <span
                          onClick={item.onClick}
                          style={{ color: '#1677ff', textDecoration: 'underline', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          {item.actual} 🔍
                        </span>
                      ) : (
                        <span style={{ fontWeight: 'bold', color: '#333' }}>{item.actual}</span>
                      )}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 6, borderTop: '1px dashed #f0f0f0', paddingTop: 6, lineHeight: '14px' }}>
                    📖 {item.definition}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '30px 0' }}>获取战队多维数据失败</div>
        )}
      </Popup>

      {/* ================= 二级弹窗：具体明细流水记录卡片流 ================= */}
      <Popup
        visible={subDetailVisible}
        onMaskClick={() => {
          setSubDetailVisible(false)
          setSubDetailData([])
        }}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '80vh', maxHeight: '90vh', padding: 20, overflowY: 'auto', zIndex: 1050 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ fontSize: 15, fontWeight: 'bold' }}>
            ⚡ 【{selectedTeamName}】累计【{subDetailTitle}】明细
          </span>
          <span onClick={() => {
            setSubDetailVisible(false)
            setSubDetailData([])
          }} style={{ color: '#1677ff', fontSize: 14, cursor: 'pointer', fontWeight: 'bold' }}>返回</span>
        </div>

        {subDetailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><DotLoading color="primary" /></div>
        ) : subDetailData.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {subDetailData.map((item, idx) => (
              <div key={idx} style={{ background: '#f9f9f9', padding: 12, borderRadius: 8, border: '1px solid #f0f0f0' }}>
                {/* 1. 合同类型卡片 */}
                {subDetailType === 'contracts' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>
                      <span>📅 {item.report_date}</span>
                      <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{item.amount} 万元</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: '#262626', marginBottom: 4 }}>
                      🏢 {item.customer_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>
                      👤 提报：{item.reporter_name} {item.partner_name && item.partner_name !== '—' && `· 协同：${item.partner_name}`}
                    </div>
                    {item.description && (
                      <div style={{ fontSize: 11, color: '#8c8c8c', borderTop: '1px dashed #e8e8e8', paddingTop: 4, marginTop: 4, wordBreak: 'break-all' }}>
                        💬 {item.description}
                      </div>
                    )}
                  </>
                )}

                {/* 2. 潜力线索卡片 (CRM 专有) */}
                {subDetailType === 'potential_leads' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>
                      <span>🏢 客户：{item.customer_name || '—'}</span>
                      {item.forecast_amount !== undefined && (
                        <span style={{ color: '#faad14', fontWeight: 'bold' }}>预算 {item.forecast_amount} 万</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: '#262626', marginBottom: 4 }}>
                      📌 项目：{item.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                      ⚡ 当前进度：<strong style={{ color: '#1677ff' }}>{item.progress ?? '—'}</strong>
                    </div>
                  </>
                )}

                {/* 3. 有效线索卡片 (本系统) */}
                {subDetailType === 'valid_leads' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>
                      <span>📅 {item.report_date}</span>
                      <span style={{ color: '#1677ff', fontWeight: 'bold' }}>进度 {item.progress}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: '#262626', marginBottom: 4 }}>
                      🏢 {item.customer_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>
                      👤 提报：{item.reporter_name}
                    </div>
                    {item.description && (
                      <div style={{ fontSize: 11, color: '#8c8c8c', borderTop: '1px dashed #e8e8e8', paddingTop: 4, marginTop: 4, wordBreak: 'break-all' }}>
                        💬 {item.description}
                      </div>
                    )}
                  </>
                )}

                {/* 4. 铁三角联动卡片 */}
                {subDetailType === 'triangle' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>
                      <span>📅 {item.report_date}</span>
                      <span>👤 提报：{item.reporter_name}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: '#262626', marginBottom: 4 }}>
                      🏢 客户：{item.customer_name}
                    </div>
                    {item.partner_name && item.partner_name !== '—' && (
                      <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>
                        🤝 联动人：{item.partner_name}
                      </div>
                    )}
                    {item.description && (
                      <div style={{ fontSize: 11, color: '#8c8c8c', borderTop: '1px dashed #e8e8e8', paddingTop: 4, marginTop: 4, wordBreak: 'break-all' }}>
                        💬 {item.description}
                      </div>
                    )}
                  </>
                )}

                {/* 5. 幸福动作卡片 */}
                {subDetailType === 'happiness' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>
                      <span>📅 {item.report_date}</span>
                      <span style={{ color: '#52c41a', fontWeight: 'bold' }}>得分 +{item.level} 分</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: '#262626', marginBottom: 4 }}>
                      🏢 客户：{item.customer_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>
                      👤 提报人：{item.reporter_name}
                    </div>
                    {item.description && (
                      <div style={{ fontSize: 11, color: '#8c8c8c', borderTop: '1px dashed #e8e8e8', paddingTop: 4, marginTop: 4, wordBreak: 'break-all' }}>
                        💬 {item.description}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '40px 0' }}>暂无该项累计实绩明细记录</div>
        )}
      </Popup>
    </div>
  )
}
