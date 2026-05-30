/**
 * 我的目标页面 - 四大指标进度环
 */
import { ProgressCircle, Tabs } from 'antd-mobile'

/** 模拟目标数据 */
const goals = {
  monthly: [
    {
      key: 'new_contracts',
      label: '新签合同',
      icon: '💰',
      current: 285.5,
      target: 500,
      unit: '万元',
      color: '#1677ff',
    },
    {
      key: 'happiness_actions',
      label: '幸福动作',
      icon: '😊',
      current: 156,
      target: 200,
      unit: '次',
      color: '#52c41a',
    },
    {
      key: 'iron_triangle',
      label: '铁三角协作',
      icon: '🔺',
      current: 48,
      target: 80,
      unit: '次',
      color: '#faad14',
    },
    {
      key: 'valid_leads',
      label: '有效线索',
      icon: '🔍',
      current: 320,
      target: 400,
      unit: '条',
      color: '#ff4d4f',
    },
  ],
  total: [
    { key: 'new_contracts', label: '新签合同', icon: '💰', current: 1250, target: 5000, unit: '万元', color: '#1677ff' },
    { key: 'happiness_actions', label: '幸福动作', icon: '😊', current: 680, target: 2000, unit: '次', color: '#52c41a' },
    { key: 'iron_triangle', label: '铁三角协作', icon: '🔺', current: 210, target: 800, unit: '次', color: '#faad14' },
    { key: 'valid_leads', label: '有效线索', icon: '🔍', current: 1560, target: 4000, unit: '条', color: '#ff4d4f' },
  ],
}

/** 渲染进度环卡片 */
function GoalCard({
  goal,
}: {
  goal: { label: string; icon: string; current: number; target: number; unit: string; color: string }
}) {
  const percent = Math.min((goal.current / goal.target) * 100, 100)

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 20,
      }}
    >
      <ProgressCircle
        percent={percent}
        style={{
          '--size': '100px',
          '--track-width': '6px',
          '--fill-color': goal.color,
          '--track-color': '#f0f0f0',
        } as React.CSSProperties}
      >
        <span style={{ fontSize: 20, fontWeight: 700, color: goal.color }}>
          {percent.toFixed(0)}%
        </span>
      </ProgressCircle>
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {goal.icon} {goal.label}
        </div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
          {goal.current} / {goal.target} {goal.unit}
        </div>
      </div>
    </div>
  )
}

export default function MyGoals() {
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
        <div style={{ fontSize: 14, opacity: 0.8 }}>百日奋战总体进度</div>
        <div style={{ fontSize: 36, fontWeight: 800, marginTop: 8 }}>68.5%</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          第42天 / 共100天 · 剩余58天
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
              width: '68.5%',
              borderRadius: 3,
              background: 'rgba(255,255,255,0.8)',
              transition: 'width 0.8s ease',
            }}
          />
        </div>
      </div>

      {/* 分Tab查看 */}
      <Tabs
        defaultActiveKey="monthly"
        style={{
          '--title-font-size': '14px',
          '--active-title-color': '#1677ff',
          '--active-line-color': '#1677ff',
          marginTop: 16,
        } as React.CSSProperties}
      >
        <Tabs.Tab title="本月目标" key="monthly">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginTop: 12,
            }}
          >
            {goals.monthly.map((goal) => (
              <GoalCard key={goal.key} goal={goal} />
            ))}
          </div>
        </Tabs.Tab>
        <Tabs.Tab title="百日总目标" key="total">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginTop: 12,
            }}
          >
            {goals.total.map((goal) => (
              <GoalCard key={goal.key} goal={goal} />
            ))}
          </div>
        </Tabs.Tab>
      </Tabs>

      {/* 目标说明 */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📌 目标说明</div>
        <ul style={{ fontSize: 13, color: '#666', lineHeight: 2, paddingLeft: 16 }}>
          <li>新签合同：统计当期新签署合同的总金额</li>
          <li>幸福动作：客户关怀、团建等增进幸福感的行为</li>
          <li>铁三角：与前端、中台、后台的协作配合次数</li>
          <li>有效线索：经确认有跟进价值的销售线索数量</li>
        </ul>
      </div>
    </div>
  )
}
