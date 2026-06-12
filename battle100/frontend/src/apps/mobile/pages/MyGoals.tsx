import { useState, useEffect } from 'react'
import { DotLoading } from 'antd-mobile'
import { getMyStats, getDashboardData } from '@shared/api/dashboard'
import type { MyStatsResponse, DashboardData } from '@shared/types'

/**
 * 8种指标的元数据映射：emoji图标 + 主题色
 */
const GOAL_META: Record<string, { icon: string; color: string }> = {
  contract_amount:        { icon: '💰', color: '#1677ff' },
  happiness_action:       { icon: '😊', color: '#52c41a' },
  triangle_count:         { icon: '🤝', color: '#faad14' },
  leads_count:            { icon: '🔍', color: '#ff4d4f' },
  leads_conversion_rate:  { icon: '📊', color: '#ff4d4f' },
  new_customer_count:     { icon: '🆕', color: '#722ed1' },
  happiness_story_count:  { icon: '📖', color: '#52c41a' },
  contract_count:         { icon: '📝', color: '#1677ff' },
}

/** 根据 goal_type 获取图标，无匹配时返回默认 */
const getIcon = (type: string) => GOAL_META[type]?.icon ?? '🎯'
/** 根据 goal_type 获取主题色 */
const getColor = (type: string) => GOAL_META[type]?.color ?? '#1677ff'

export default function MyGoals() {
  const [stats, setStats] = useState<MyStatsResponse | null>(null)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  /** 个人目标胶囊Tab：'base' 保底 / 'challenge' 挑战 */
  const [activeGoalTab, setActiveGoalTab] = useState<'base' | 'challenge'>('base')

  useEffect(() => {
    let active = true
    
    // 加载个人与战队目标基本数据
    getMyStats()
      .then((res) => {
        if (active && res) setStats(res)
      })
      .catch((err) => {
        console.error('获取个人目标作战数据失败:', err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    // 同时加载大盘数据以渲染各战区冲刺排名
    getDashboardData()
      .then((res) => {
        if (active && res) setDashboardData(res)
      })
      .catch((err) => {
        console.error('获取大盘战区赛马PK数据失败:', err)
      })

    return () => { active = false }
  }, [])

  /* ────────── 加载状态 ────────── */
  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <DotLoading color="primary" />
        <span style={{ marginTop: 12, color: '#999', fontSize: 14 }}>加载目标作战数据中...</span>
      </div>
    )
  }

  /* ────────── 数据准备 ────────── */
  const personalStats = stats?.personal_stats || []
  const teamStats = stats?.team_stats ?? null

  // 百日奋战时间计算：2026-06-01 → 2026-09-08，共100天
  const startDate = new Date('2026-06-01')
  const endDate = new Date('2026-09-08')
  const now = new Date()
  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)

  const totalDays = 100
  const remainingDays = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  const passedDays = Math.max(0, Math.min(totalDays, totalDays - remainingDays))

  /* ────────── 渲染 ────────── */
  return (
    <div className="page-content">

      {/* ═══════════ 模块一：百日奋战时间线 ═══════════ */}
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          color: '#fff',
          padding: 20,
          borderRadius: 12,
        }}
      >
        {/* 标题行：左侧标题 + 右侧天数 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>✈️ 百日奋战进度</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>
            第 <span style={{ fontSize: 22, fontWeight: 700 }}>{passedDays}</span> 天 / 共100天
          </div>
        </div>

        {/* 进度条 */}
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.2)',
            marginTop: 14,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min((passedDays / totalDays) * 100, 100)}%`,
              borderRadius: 3,
              background: 'rgba(255,255,255,0.8)',
              transition: 'width 0.8s ease',
            }}
          />
        </div>

        {/* 剩余天数 */}
        <div style={{ textAlign: 'right', marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          剩余 {remainingDays} 天
        </div>
      </div>

      {/* ═══════════ 模块二：我的个人目标 ═══════════ */}
      <div style={{ marginTop: 16 }}>
        {/* 模块标题 */}
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>💪 我的个人目标</div>

        {/* 胶囊Tab */}
        <div
          style={{
            display: 'flex',
            background: '#f5f5f5',
            borderRadius: 20,
            padding: 3,
            marginBottom: 14,
          }}
        >
          {(['base', 'challenge'] as const).map((tab) => {
            const isActive = activeGoalTab === tab
            const label = tab === 'base' ? '保底奋斗目标' : '挑战破线目标'
            return (
              <div
                key={tab}
                onClick={() => setActiveGoalTab(tab)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '7px 0',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  ...(isActive
                    ? { background: '#1677ff', color: '#fff', boxShadow: '0 2px 8px rgba(22,119,255,0.3)' }
                    : { background: 'transparent', color: '#595959' }),
                }}
              >
                {label}
              </div>
            )
          })}
        </div>

        {/* 指标卡片列表 */}
        {personalStats.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {personalStats.map((item) => {
              const color = getColor(item.goal_type)
              const icon = getIcon(item.goal_type)
              const target = activeGoalTab === 'base' ? item.base_target : item.challenge_target
              const percentage = activeGoalTab === 'base' ? item.base_percentage : item.challenge_percentage
              const isCompleted = percentage >= 100

              // 达成状态标签
              let statusLabel: string
              let statusBg: string
              let statusColor: string
              if (isCompleted && activeGoalTab === 'challenge') {
                statusLabel = '🔥已破线'
                statusBg = 'rgba(255,77,79,0.1)'
                statusColor = '#ff4d4f'
              } else if (isCompleted) {
                statusLabel = '✅已达成'
                statusBg = 'rgba(82,196,26,0.1)'
                statusColor = '#52c41a'
              } else {
                statusLabel = '进行中'
                statusBg = 'rgba(250,173,20,0.1)'
                statusColor = '#faad14'
              }

              return (
                <div
                  key={item.goal_type}
                  style={{
                    background: '#fafafa',
                    border: '1px solid #f0f0f0',
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  {/* 头部：emoji + 名称（左）+ 状态标签（右） */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
                      {icon} {item.goal_name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: statusBg,
                        color: statusColor,
                      }}
                    >
                      {statusLabel}
                    </div>
                  </div>

                  {/* 数值行 */}
                  <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 10 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color }}>
                      {item.actual % 1 === 0 ? item.actual : item.actual.toFixed(1)}
                    </span>
                    <span style={{ fontSize: 12, color: '#999', marginLeft: 6 }}>
                      / {target % 1 === 0 ? target : target.toFixed(1)} {item.unit}
                    </span>
                  </div>

                  {/* 渐变进度条 + 百分比 */}
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 3,
                        background: '#f0f0f0',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(percentage, 100)}%`,
                          borderRadius: 3,
                          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, color: '#999', marginTop: 4 }}>
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '36px 0', color: '#999', fontSize: 13 }}>
            暂无关联岗位的个人目标数据
          </div>
        )}
      </div>

      {/* ═══════════ 模块三：我的战队目标盘 ═══════════ */}
      {teamStats && (
        <div
          style={{
            marginTop: 16,
            background: 'linear-gradient(135deg, #0a1929, #102a4c)',
            color: '#fff',
            padding: 20,
            borderRadius: 12,
          }}
        >
          {/* 标题行：战队名 + 战区Tag + 状态灯 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>⚔️ {teamStats.team_name}</span>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                border: '1px solid #00d4ff',
                color: '#00d4ff',
              }}
            >
              {teamStats.zone_name}
            </span>
            {/* 状态灯 */}
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                display: 'inline-block',
                marginLeft: 'auto',
                background:
                  teamStats.status_light === 'green'
                    ? '#52c41a'
                    : teamStats.status_light === 'yellow'
                      ? '#faad14'
                      : '#ff4d4f',
                boxShadow: `0 0 6px ${
                  teamStats.status_light === 'green'
                    ? '#52c41a'
                    : teamStats.status_light === 'yellow'
                      ? '#faad14'
                      : '#ff4d4f'
                }`,
              }}
            />
          </div>

          {/* 营销新签进度 */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, opacity: 0.85 }}>📈 营销新签</span>
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                {teamStats.marketing_actual} / {teamStats.marketing_target} 万元 · {teamStats.marketing_percentage}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(teamStats.marketing_percentage, 100)}%`,
                  borderRadius: 3,
                  background: 'linear-gradient(90deg, #1677ff, #69b1ff)',
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>

          {/* 交付新签进度 */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, opacity: 0.85 }}>📦 交付新签</span>
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                {teamStats.delivery_actual} / {teamStats.delivery_target} 万元 · {teamStats.delivery_percentage}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(teamStats.delivery_percentage, 100)}%`,
                  borderRadius: 3,
                  background: 'linear-gradient(90deg, #52c41a, #95de64)',
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>

          {/* 过程指标：3列grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              textAlign: 'center',
            }}
          >
            {/* 幸福动作 */}
            <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 11, opacity: 0.6 }}>😊 幸福动作</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{teamStats.happiness_actions}</div>
            </div>
            {/* 铁三角 */}
            <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 11, opacity: 0.6 }}>🤝 铁三角</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{teamStats.iron_triangle}</div>
            </div>
            {/* 有效线索 */}
            <div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>🔍 有效线索</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{teamStats.valid_leads}</div>
            </div>
          </div>
        </div>
      )}

      {/* 整理大盘战区排名数据并渲染卡片 */}
      {(() => {
        if (!dashboardData?.zoneTeamsPK || Object.keys(dashboardData.zoneTeamsPK).length === 0) return null;

        return (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>🏆 各战区战队冲刺排名</div>
            
            {Object.entries(dashboardData.zoneTeamsPK).map(([zoneName, teams]) => {
              if (!teams || teams.length === 0) return null;
              
              return (
                <div 
                  key={zoneName}
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    marginBottom: 14,
                    overflow: 'hidden'
                  }}
                >
                  {/* 战区头部 */}
                  <div 
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: 'linear-gradient(90deg, #fafafa, #ffffff)',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 4, height: 14, borderRadius: 2, background: 'linear-gradient(180deg, #1890ff, #096dd9)' }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1f1f1f' }}>{zoneName}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#bfbfbf' }}>共 {teams.length} 支战队</span>
                  </div>

                  {/* 战队列表 */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {teams.map((t: any, index: number) => {
                      const mAct = t.weeklyMarketingActual ?? 0;
                      const mTgt = t.weeklyMarketingTarget ?? 0;
                      const dAct = t.weeklyDeliveryActual ?? 0;
                      const dTgt = t.weeklyDeliveryTarget ?? 0;
                      
                      // 排名徽章样式
                      let rankBg = '#f5f5f5';
                      let rankColor = '#595959';
                      let rankBorder = '1px solid #d9d9d9';
                      
                      if (t.rank === 1) {
                        rankBg = 'linear-gradient(135deg, #ffe259 0%, #ffa751 100%)';
                        rankColor = '#fff';
                        rankBorder = 'none';
                      } else if (t.rank === 2) {
                        rankBg = 'linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%)';
                        rankColor = '#fff';
                        rankBorder = 'none';
                      } else if (t.rank === 3) {
                        rankBg = 'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)';
                        rankColor = '#fff';
                        rankBorder = 'none';
                      }

                      // 趋势气泡样式
                      let trendBg = '#f5f5f5';
                      let trendColor = '#595959';
                      let trendText = '持平';
                      
                      if (t.trend === 'up') {
                        trendBg = '#f6ffed';
                        trendColor = '#389e0d';
                        trendText = '↑ 上升';
                      } else if (t.trend === 'down') {
                        trendBg = '#fff1f0';
                        trendColor = '#cf1322';
                        trendText = '↓ 下降';
                      } else {
                        trendText = '→ 持平';
                      }

                      return (
                        <div 
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '12px 16px',
                            borderBottom: index === teams.length - 1 ? 'none' : '1px solid #f5f5f5'
                          }}
                        >
                          {/* 排名徽章 */}
                          <div 
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              background: rankBg,
                              color: rankColor,
                              border: rankBorder,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 'bold',
                              flexShrink: 0
                            }}
                          >
                            {t.rank}
                          </div>

                          {/* 战队信息 */}
                          <div style={{ flex: 1, marginLeft: 12, overflow: 'hidden' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#262626', marginBottom: 3 }}>
                              {t.name}
                            </div>
                            <div style={{ fontSize: 11, color: '#8c8c8c', display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
                              <span>📊 营销: {mAct.toFixed(1).replace('.0', '')}/{mTgt.toFixed(1).replace('.0', '')}万</span>
                              <span style={{ color: '#d9d9d9' }}>|</span>
                              <span>📦 交付: {dAct.toFixed(1).replace('.0', '')}/{dTgt.toFixed(1).replace('.0', '')}万</span>
                            </div>
                          </div>

                          {/* 完成率与趋势 */}
                          <div style={{ textAlign: 'right', marginLeft: 8, flexShrink: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1890ff', marginBottom: 2 }}>
                              {t.score}%
                            </div>
                            <span 
                              style={{
                                display: 'inline-block',
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: trendBg,
                                color: trendColor,
                                fontSize: 9,
                                fontWeight: 'bold'
                              }}
                            >
                              {trendText}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}


      {/* ═══════════ 模块四：目标说明 ═══════════ */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📌 目标说明</div>
        <ul style={{ fontSize: 13, color: '#666', lineHeight: 2, paddingLeft: 16 }}>
          <li>新签合同额：统计百日内签署合同或分摊的实际新签金额</li>
          <li>客户幸福动作完成数：全员所执行的客户幸福服务关怀动作数</li>
          <li>售前铁三角联动次数：与协同巴长、专员的共同联动与协作次数</li>
          <li>有效线索数：自主挖掘并分配的有效商机需求数量</li>
          <li>线索转化率：新签合同单数 / 营销有效线索总数量</li>
          <li>新客户目标数：本周度及百日战役战队内新增的客户个数</li>
        </ul>
      </div>
    </div>
  )
}
