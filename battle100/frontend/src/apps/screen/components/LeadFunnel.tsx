import React from 'react'

interface LeadFunnelProps {
  theme?: string
}

interface FunnelItem {
  stage: string
  percent: number
  projectName: string
  amount: number
  teamName: string
  owner: string
  expert: string
  collabCount: number
  tag: string
  tagColor: string
}

const LeadFunnel: React.FC<LeadFunnelProps> = ({ theme = 'theme-light-red' }) => {
  // 默认商机漏斗列表置空，只使用真实数据
  const funnelData: FunnelItem[] = []

  const isScrollTheme = theme === 'theme-light-red' || theme === 'theme-gold'

  return (
    <div
      className={`screen-card ${isScrollTheme ? 'scroll-paper' : ''}`}
      style={{
        padding: '1.5rem',
        height: 'calc(100% - 3rem)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 宣纸四角包边 */}
      {isScrollTheme && <div className="scroll-corner-decor-top-right" />}
      {isScrollTheme && <div className="scroll-corner-decor-bottom-left" />}

      <h3
        style={{
          margin: '0 0 1rem 0',
          fontSize: '1.2rem',
          color: 'var(--accent-color)',
          borderBottom: '2px solid var(--border-color)',
          paddingBottom: '0.8rem',
          fontWeight: 'bold',
          fontFamily: 'STKaiti, KaiTi, sans-serif'
        }}
      >
        ⏳ 铁三角线索漏斗与重特大项目攻坚墙
      </h3>

      {/* 漏斗主体：采用网格化排开4个推进阶段 */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateRows: 'repeat(4, 1fr)',
          gap: '0.8rem',
          overflowY: 'auto',
          paddingRight: '2px'
        }}
      >
        {funnelData.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              background: 'rgba(0,0,0,0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              overflow: 'hidden',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            }}
          >
            {/* 左侧阶段进度章 */}
            <div
              style={{
                width: '7.5rem',
                background: theme === 'theme-gold'
                  ? 'linear-gradient(135deg, #d4af37 0%, #aa7c11 100%)'
                  : 'linear-gradient(135deg, #b71c1c 0%, #7f0000 100%)',
                color: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.5rem',
                flexShrink: 0
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'center' }}>
                {item.stage}
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, marginTop: '0.2rem' }}>
                {item.percent}%
              </span>
            </div>

            {/* 右侧项目卡片详情 */}
            <div
              style={{
                flex: 1,
                padding: '0.6rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minWidth: 0
              }}
            >
              {/* 第一行：项目名与金额 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <span
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {item.projectName}
                </span>
                <span className="glow-number" style={{ fontSize: '1.1rem', flexShrink: 0 }}>
                  {item.amount}万
                </span>
              </div>

              {/* 第二行：战队、责任人、方案协助者、协同次数、幸福动作标签 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>
                    {item.teamName} · {item.owner}
                  </span>
                  <span>|</span>
                  <span>{item.expert}</span>
                  <span>|</span>
                  <span style={{ fontWeight: 'bold' }}>
                    协同: {item.collabCount}次
                  </span>
                </div>

                {/* 前线动作/卡点高光标签 */}
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    backgroundColor: item.tagColor + '15',
                    color: item.tagColor,
                    border: `1px solid ${item.tagColor}40`,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                  }}
                >
                  {item.tag}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default LeadFunnel
