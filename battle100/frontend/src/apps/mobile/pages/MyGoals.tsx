import { useState, useEffect } from 'react'
import { ProgressCircle, Tabs, DotLoading } from 'antd-mobile'
import { getMyStats } from '@shared/api/dashboard'
import type { MyStatsResponse } from '@shared/types'

/** 渲染进度环卡片 */
function GoalCard({
  label,
  icon,
  current,
  target,
  unit,
  color,
}: {
  label: string
  icon: string
  current: number
  target: number
  unit: string
  color: string
}) {
  const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 10px',
        textAlign: 'center'
      }}
    >
      <ProgressCircle
        percent={percent}
        style={{
          '--size': '90px',
          '--track-width': '6px',
          '--fill-color': color,
          '--track-color': '#f0f0f0',
        } as React.CSSProperties}
      >
        <span style={{ fontSize: 18, fontWeight: 700, color: color }}>
          {percent.toFixed(0)}%
        </span>
      </ProgressCircle>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#333', minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon} {label}
        </div>
        <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
          {current.toFixed(1).replace('.0', '')} / {target.toFixed(1).replace('.0', '')} {unit}
        </div>
      </div>
    </div>
  )
}

export default function MyGoals() {
  const [stats, setStats] = useState<MyStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getMyStats()
      .then((res) => {
        if (active && res) {
          setStats(res)
        }
      })
      .catch((err) => {
        console.error('获取个人目标作战数据失败:', err)
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
        <span style={{ marginTop: 12, color: '#999', fontSize: 14 }}>加载目标作战数据中...</span>
      </div>
    )
  }

  // 1. 公司盘数据
  const companyStats = stats?.company_stats || {
    newContracts: { value: 0, target: 6200, percentage: 0 }
  }

  // 2. 个人目标列表
  const personalStats = stats?.personal_stats || []

  // 3. 计算已过天数与剩余天数（从 2026-06-01 到 2026-09-08 共 100 天）
  const endDate = new Date('2026-09-08')
  const startDate = new Date('2026-06-01')
  const now = new Date()
  
  endDate.setHours(0, 0, 0, 0)
  startDate.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)

  const totalDays = 100
  const remainingDays = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  const passedDays = Math.max(0, totalDays - remainingDays)

  // 指标图标映射
  const getGoalIcon = (type: string) => {
    if (type.includes('contract')) return '💰'
    if (type.includes('happiness_action')) return '😊'
    if (type.includes('triangle')) return '🤝'
    if (type.includes('leads')) return '🔍'
    if (type.includes('customer')) return '🆕'
    if (type.includes('story')) return '📖'
    return '🎯'
  }

  // 指标颜色映射
  const getGoalColor = (type: string) => {
    if (type.includes('contract')) return '#1677ff'
    if (type.includes('happiness_action')) return '#52c41a'
    if (type.includes('triangle')) return '#faad14'
    if (type.includes('leads')) return '#ff4d4f'
    return '#722ed1'
  }

  return (
    <div className="page-content">
      {/* 页面标题 */}
      <div style={{ padding: '16px 0 8px' }}>
        <h2 className="page-title">🎯 我的目标</h2>
      </div>

      {/* 总览卡片 */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          color: '#fff',
          padding: 20,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 14, opacity: 0.8 }}>百日奋战公司总体进度</div>
        <div style={{ fontSize: 36, fontWeight: 800, marginTop: 8 }}>
          {companyStats.newContracts.percentage}%
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          第 {passedDays} 天 / 共 100 天 · 剩余 {remainingDays} 天
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.2)',
            marginTop: 16,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(companyStats.newContracts.percentage, 100)}%`,
              borderRadius: 3,
              background: 'rgba(255,255,255,0.8)',
              transition: 'width 0.8s ease',
            }}
          />
        </div>
      </div>

      {/* 分Tab查看 */}
      <Tabs
        defaultActiveKey="base"
        style={{
          '--title-font-size': '14px',
          '--active-title-color': '#1677ff',
          '--active-line-color': '#1677ff',
          marginTop: 16,
        } as React.CSSProperties}
      >
        <Tabs.Tab title="保底奋斗目标" key="base">
          {personalStats.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginTop: 12,
              }}
            >
              {personalStats.map((item) => (
                <GoalCard
                  key={item.goal_type}
                  label={item.goal_name}
                  icon={getGoalIcon(item.goal_type)}
                  current={item.actual}
                  target={item.base_target}
                  unit={item.unit}
                  color={getGoalColor(item.goal_type)}
                />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#999', fontSize: 13 }}>
              暂无关联岗位的保底奋斗目标
            </div>
          )}
        </Tabs.Tab>
        <Tabs.Tab title="挑战破线目标" key="challenge">
          {personalStats.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginTop: 12,
              }}
            >
              {personalStats.map((item) => (
                <GoalCard
                  key={item.goal_type}
                  label={item.goal_name}
                  icon={getGoalIcon(item.goal_type)}
                  current={item.actual}
                  target={item.challenge_target}
                  unit={item.unit}
                  color={getGoalColor(item.goal_type)}
                />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#999', fontSize: 13 }}>
              暂无关联岗位的挑战破线目标
            </div>
          )}
        </Tabs.Tab>
      </Tabs>

      {/* 目标说明 */}
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
