import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import { getMyStats } from '@shared/api/dashboard'
import type { MyStatsResponse } from '@shared/types'
import { DotLoading } from 'antd-mobile'

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

  useEffect(() => {
    let active = true
    getMyStats()
      .then((res) => {
        if (active && res) {
          setStats(res as any)
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

      {/* 第三级：🎯 个人双轨水位绩效盘 */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🎯 个人核心目标双轨盘</span>
          <span style={{ fontSize: 11, color: '#999' }}>基础 / 挑战双水位</span>
        </div>

        {personalStats.length > 0 ? (
          personalStats.map((item) => {
            // 定位刻度，挑战目标为上限，如果实际值超出，则实际值为上限。
            const maxVal = Math.max(item.challenge_target, item.actual, 1)
            const basePos = (item.base_target / maxVal) * 100
            const challengePos = (item.challenge_target / maxVal) * 100
            const actualPos = (item.actual / maxVal) * 100

            return (
              <div key={item.goal_type} style={{ marginBottom: 20 }}>
                {/* 标题及数值展示 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{item.goal_name}</span>
                  <span style={{ fontSize: 13, color: '#1677ff', fontWeight: 700 }}>
                    实际：{item.actual} <span style={{ fontSize: 11, color: '#999', fontWeight: 'normal' }}>{item.unit}</span>
                  </span>
                </div>

                {/* 精美双水位进度条 */}
                <div style={{ position: 'relative', height: 12, background: '#e2e8f0', borderRadius: 6, margin: '8px 0' }}>
                  {/* 实际值条 */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${Math.min(actualPos, 100)}%`,
                      background: 'linear-gradient(90deg, #1677ff, #00d4ff)',
                      borderRadius: 6,
                      transition: 'width 0.6s ease'
                    }}
                  />
                  {/* 基础水位刻度线 */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${basePos}%`,
                      top: -3,
                      bottom: -3,
                      width: 3,
                      backgroundColor: '#ff4d4f',
                      borderRadius: 1.5,
                      zIndex: 2
                    }}
                  />
                  {/* 挑战水位刻度线 */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${challengePos}%`,
                      top: -3,
                      bottom: -3,
                      width: 3,
                      backgroundColor: '#ffd700',
                      borderRadius: 1.5,
                      zIndex: 2
                    }}
                  />
                </div>

                {/* 底部详细水位指标数值 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#718096' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ff4d4f' }} />
                    基础：{item.base_target}{item.unit} ({item.actual >= item.base_target ? '✅已达成' : '未达成'})
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ffd700' }} />
                    挑战：{item.challenge_target}{item.unit} ({item.actual >= item.challenge_target ? '🔥已破线' : '未破线'})
                  </span>
                </div>
              </div>
            )
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#999', fontSize: 13 }}>
            暂无关联岗位考核目标，加油填报！
          </div>
        )}
      </div>
    </div>
  )
}
