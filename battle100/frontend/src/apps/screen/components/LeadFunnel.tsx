import React from 'react'
import type { FunnelItem, ImportantProjectItem } from '@shared/types'

interface LeadFunnelProps {
  theme?: string
  leadsFunnel?: FunnelItem[]
  importantProjects?: ImportantProjectItem[]
}

const LeadFunnel: React.FC<LeadFunnelProps> = ({
  theme = 'theme-light-red',
  leadsFunnel = [],
  importantProjects = []
}) => {
  const isScrollTheme = theme === 'theme-light-red' || theme === 'theme-gold'

  // 六级漏斗的主题配色
  const colors = ['#722ed1', '#1890ff', '#13c2c2', '#52c41a', '#faad14', '#f5222d']

  // clip-path 梯形剪裁规则（对齐倒扣渐窄梯形结构）
  const clipPaths = [
    'polygon(0% 0%, 100% 0%, 92% 100%, 8% 100%)',
    'polygon(8% 0%, 92% 0%, 84% 100%, 16% 100%)',
    'polygon(16% 0%, 84% 0%, 76% 100%, 24% 100%)',
    'polygon(24% 0%, 76% 0%, 68% 100%, 32% 100%)',
    'polygon(32% 0%, 68% 0%, 60% 100%, 40% 100%)',
    'polygon(40% 0%, 60% 0%, 48% 100%, 52% 100%)'
  ]

  // 当无接口数据时，默认初始化归零
  const defaultFunnel: FunnelItem[] = [
    { stage: '5%', name: '潜在需求信息', count: 0, rate: 0.0 },
    { stage: '10%', name: '需求意向阶段', count: 0, rate: 0.0 },
    { stage: '25%', name: '已验证需求', count: 0, rate: 0.0 },
    { stage: '50%', name: '进入二选一', count: 0, rate: 0.0 },
    { stage: '75%', name: '订单基本确认', count: 0, rate: 0.0 },
    { stage: '90%', name: '正式签约', count: 0, rate: 0.0 }
  ]

  const displayFunnel = leadsFunnel.length > 0 ? leadsFunnel : defaultFunnel

  return (
    <div
      className={`screen-card ${isScrollTheme ? 'scroll-paper' : ''}`}
      style={{
        padding: '1.25rem 1.5rem',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}
    >
      {/* 宣纸四角包边 */}
      {isScrollTheme && <div className="scroll-corner-decor-top-right" style={{ transform: 'scale(0.6)' }} />}
      {isScrollTheme && <div className="scroll-corner-decor-bottom-left" style={{ transform: 'scale(0.6)' }} />}

      <h3
        style={{
          margin: '0 0 0.8rem 0',
          fontSize: '1.15rem',
          color: 'var(--accent-color, #b71c1c)',
          borderLeft: '4px solid var(--accent-color, #b71c1c)',
          paddingLeft: '0.6rem',
          fontWeight: 'bold',
          flexShrink: 0
        }}
      >
        ⏳ 铁三角线索漏斗与重特大项目攻坚墙
      </h3>

      {/* 上半部分：销售漏斗转化图（类似附件2） */}
      <div
        style={{
          flexShrink: 0,
          borderBottom: '1px dashed rgba(0,0,0,0.08)',
          paddingBottom: '1rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center'
        }}
      >
        {/* 左侧：多色半透明渐窄多边形漏斗柱 */}
        <div style={{ width: '45%', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {displayFunnel.map((item, idx) => (
            <div
              key={idx}
              style={{
                width: '100%',
                height: '1.5rem',
                backgroundColor: colors[idx],
                clipPath: clipPaths[idx],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: '900',
                textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                opacity: item.count > 0 ? 1 : 0.45,
                transition: 'all 0.3s ease'
              }}
            >
              {item.stage}
            </div>
          ))}
        </div>

        {/* 右侧：标签与转化率对齐详情 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
          {displayFunnel.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.8rem',
                lineHeight: 1.2
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#666666', fontWeight: 'bold' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: colors[idx] }} />
                <span>{item.name}</span>
              </span>
              <span style={{ fontWeight: 'bold', color: '#111111' }}>
                <span className="glow-number" style={{ fontSize: '0.9rem', color: colors[idx] }}>
                  {item.count}
                </span>个
                <span style={{ fontSize: '0.75rem', color: '#8c8c8c', marginLeft: '0.4rem' }}>
                  (↑ {item.rate.toFixed(1).replace('.0', '')}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 下半部分：重特大项目攻坚墙 (50万以上) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: '1rem', overflow: 'hidden' }}>
        <div
          style={{
            fontSize: '1rem',
            fontWeight: 'bold',
            color: '#111111',
            marginBottom: '0.6rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            flexShrink: 0
          }}
        >
          <span>🧱</span>
          <span>重特大项目攻坚墙 (50万以上)</span>
          {importantProjects.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 'bold', marginLeft: 'auto' }}>
              共 {importantProjects.length} 个
            </span>
          )}
        </div>

        {/* 攻坚项目列表纵向滚动区域 */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            paddingRight: '4px'
          }}
        >
          {importantProjects.length > 0 ? (
            importantProjects.map((project, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(0,0,0,0.02)',
                  border: '1px solid rgba(0,0,0,0.05)',
                  borderRadius: '6px',
                  padding: '0.5rem 0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                }}
              >
                {/* 项目名与预计金额 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem' }}>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      color: '#222222',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={project.name}
                  >
                    {project.name}
                  </span>
                  <span
                    className="glow-number"
                    style={{
                      fontSize: '0.95rem',
                      color: 'var(--accent-color, #b71c1c)',
                      flexShrink: 0
                    }}
                  >
                    {project.amount.toFixed(0)}万
                  </span>
                </div>

                {/* 业主与推进阶段 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#8c8c8c' }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    客户: {project.customerName || '未知业主单位'}
                  </span>
                  <span style={{
                    fontWeight: 'bold',
                    color: project.progress >= 75 ? '#52c41a' : project.progress >= 50 ? '#faad14' : '#1890ff'
                  }}>
                    推进阶段: {project.progress}%
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8c8c8c',
              fontSize: '0.85rem',
              border: '1px dashed rgba(0,0,0,0.06)',
              borderRadius: '6px'
            }}>
              暂无 50 万以上重特大项目数据
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LeadFunnel
