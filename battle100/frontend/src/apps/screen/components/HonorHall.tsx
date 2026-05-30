import React from 'react'
import type { DualTrackTeam } from '@shared/types'

interface HonorHallProps {
  theme?: string
  teams?: DualTrackTeam[]
}

const HonorHall: React.FC<HonorHallProps> = ({ theme = 'theme-light-red', teams = [] }) => {
  // 筛选出红灯或黄灯的队伍进行预警
  const warningTeams = teams.filter(t => t.statusLight === 'red' || t.statusLight === 'yellow')
  const warningText = warningTeams.length > 0 
    ? `战队 [${warningTeams.map(t => `${t.teamName}(${t.leader})`).join(', ')}] 进度面临卡点。已指派技术专家、风控委介入方案诊断，开展陪访以破除僵局。`
    : `所有战队进度良好，绿灯放行中。继续保持高昂斗志，冲刺百日奋战目标！`

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 政委协同介入预警条 */}
      <div style={{
        background: 'rgba(250, 173, 20, 0.1)',
        border: '1px solid #faad14',
        borderRadius: '6px',
        padding: '0.8rem 1.2rem',
        color: '#faad14',
        fontSize: '0.95rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.8rem',
        fontWeight: 'bold',
        boxShadow: '0 2px 8px rgba(250, 173, 20, 0.15)'
      }}>
        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
        <span>政委协同介入中：{warningText}</span>
      </div>

      <div style={{
        fontSize: '1.1rem',
        fontWeight: 'bold',
        color: 'var(--accent-color)',
        fontFamily: 'STKaiti, KaiTi, sans-serif',
      }}>
        自动结算奖励与荣誉大厅
      </div>

      <div style={{
        display: 'flex',
        gap: '1.5rem',
        flex: 1
      }}>
        {/* 流动红旗 */}
        <div className="screen-card scroll-paper" style={{
          flex: 1,
          padding: '1.2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          border: '1px dashed var(--accent-color)',
          position: 'relative'
        }}>
          <div className="scroll-corner-decor-top-right" style={{ transform: 'scale(0.5)' }} />
          <div className="scroll-corner-decor-bottom-left" style={{ transform: 'scale(0.5)' }} />
          
          <div style={{ fontSize: '2.5rem' }}>🚩</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-primary)' }}>【超凡先锋】流动红旗 (实时)</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.4rem 0' }}>暂无战队达成挑战目标，大家继续冲刺！</div>
            <div style={{ color: '#d48806', fontWeight: 'bold', fontSize: '0.95rem' }}>授予流动红旗</div>
          </div>
        </div>

        {/* 猎头大奖 */}
        <div className="screen-card scroll-paper" style={{
          flex: 1,
          padding: '1.2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          border: '1px dashed var(--accent-color)',
          position: 'relative'
        }}>
          <div className="scroll-corner-decor-top-right" style={{ transform: 'scale(0.5)' }} />
          <div className="scroll-corner-decor-bottom-left" style={{ transform: 'scale(0.5)' }} />
          
          <div style={{ fontSize: '2.5rem' }}>🎯</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-primary)' }}>百万订单“猎头”大奖 (累计)</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.4rem 0' }}>已斩获百万/五十万级攻坚项目 3 个，每个即时奖励 1888 元</div>
            <div style={{ color: '#f5222d', fontWeight: 'bold', fontSize: '1.2rem' }}>+ ¥5664</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HonorHall
