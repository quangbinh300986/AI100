import React from 'react'

interface KpiItem {
  value: number
  target: number
  percentage: number
}

interface KpiCardsProps {
  theme?: string
  kpiSummary?: {
    newContracts: KpiItem
    happinessActions: KpiItem
    ironTriangle: KpiItem
    validLeads: KpiItem
  }
}

const KpiCards: React.FC<KpiCardsProps> = ({ theme = 'theme-light-red', kpiSummary }) => {
  // 当后端接口不可用时，默认全部归零显示，杜绝假数据兜底
  const defaultSummary = {
    newContracts: { value: 0, target: 0, percentage: 0 },
    happinessActions: { value: 0, target: 0, percentage: 0 },
    ironTriangle: { value: 0, target: 0, percentage: 0 },
    validLeads: { value: 0, target: 0, percentage: 0 }
  }

  const summary = kpiSummary || defaultSummary

  const items = [
    {
      title: '新签合同额',
      value: summary.newContracts.value,
      target: summary.newContracts.target,
      percent: summary.newContracts.percentage,
      color: 'linear-gradient(90deg, #b71c1c 0%, #ff4d4f 100%)',
      unit: '万元',
      icon: '💰'
    },
    {
      title: '客户幸福动作',
      value: summary.happinessActions.value,
      target: summary.happinessActions.target,
      percent: summary.happinessActions.percentage,
      color: 'linear-gradient(90deg, #fa8c16 0%, #ffc069 100%)',
      unit: '次',
      icon: '😊'
    },
    {
      title: '铁三角利他协作',
      value: summary.ironTriangle.value,
      target: summary.ironTriangle.target,
      percent: summary.ironTriangle.percentage,
      color: 'linear-gradient(90deg, #e53935 0%, #ff7875 100%)',
      unit: '次',
      icon: '🤝'
    },
    {
      title: '有效新增线索',
      value: summary.validLeads.value,
      target: summary.validLeads.target,
      percent: summary.validLeads.percentage,
      color: 'linear-gradient(90deg, #d4af37 0%, #ffe58f 100%)',
      unit: '条',
      icon: '🔍'
    }
  ]

  const isScrollTheme = theme === 'theme-light-red' || theme === 'theme-gold'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', width: '100%', flexShrink: 0 }}>
      {items.map((item, idx) => (
        <div
          key={idx}
          className={`screen-card ${isScrollTheme ? 'scroll-paper' : ''}`}
          style={{
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 四角金色包角，强化责任状奢华工艺感 */}
          {isScrollTheme && <div className="scroll-corner-decor-top-right" />}
          {isScrollTheme && <div className="scroll-corner-decor-bottom-left" />}

          {/* KPI 头部标题栏 (责任状白底红头) */}
          <div
            className="card-header-red"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.65rem 1.25rem',
            }}
          >
            <span style={{ fontSize: '0.95rem', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>{item.icon}</span>
              <span style={{ fontWeight: 'bold' }}>{item.title}</span>
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>
              {item.percent.toFixed(1)}%
            </span>
          </div>

          {/* KPI 数据与进度区 */}
          <div style={{ padding: '1.2rem 1.25rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
            <div style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'baseline' }}>
              <span className="glow-number" style={{ fontSize: '2.5rem', lineHeight: 1 }}>
                {item.value.toLocaleString()}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '0.4rem', fontWeight: 'bold' }}>
                {item.unit}
              </span>
            </div>

            {/* 进度条与目标 */}
            <div>
              <div className="progress-track" style={{ height: '10px', borderRadius: '5px' }}>
                <div
                  className="progress-bar-glow"
                  style={{
                    width: `${Math.min(item.percent, 100)}%`,
                    background: item.color,
                    height: '100%',
                    borderRadius: '5px',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '0.4rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 'bold',
                }}
              >
                <span>已达成比率</span>
                <span>目标: {item.target.toLocaleString()} {item.unit}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default KpiCards
