import React from 'react'
import type { DualTrackTeam } from '@shared/types'

interface HonorHallProps {
  theme?: string
  teams?: DualTrackTeam[]
}

const HonorHall: React.FC<HonorHallProps> = ({ theme = 'theme-light-red', teams = [] }) => {
  // 筛选出红灯或黄灯的队伍进行预警
  // 筛选出红灯或黄灯的队伍进行预警
  const warningTeams = teams.filter(t => t.statusLight === 'red' || t.statusLight === 'yellow')
  
  // 真实业务中，政委协调介入为针对极个别落后战队的精准帮扶。
  // 若大部分战队（如超过3个）均处于未达标状态，说明是战役起步初期的正常现象，不应点名报错，应自动转换为绿色的全盘冲刺状态条。
  const isNormalOrEarlyStage = warningTeams.length === 0 || warningTeams.length > 3
  
  const alertBg = isNormalOrEarlyStage ? 'rgba(82, 196, 26, 0.08)' : 'rgba(250, 173, 20, 0.1)'
  const alertBorder = isNormalOrEarlyStage ? '1px solid #52c41a' : '1px solid #faad14'
  const alertColor = isNormalOrEarlyStage ? '#52c41a' : '#faad14'
  const alertIcon = isNormalOrEarlyStage ? '✅' : '⚠️'
  const alertTitle = isNormalOrEarlyStage ? '全盘冲刺动态' : '政委协同介入中'
  const alertContent = isNormalOrEarlyStage
    ? '所有战队正火热攻坚中，整体进度受控。坚定必胜信念，继续全力冲刺百日奋战目标！'
    : `战队 [${warningTeams.map(t => `${t.teamName}(${t.leader})`).join(', ')}] 进度面临卡点。已指派技术专家、风控委介入方案诊断，开展陪访以破除僵局。`

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* 战区/政委协同状态通知条 */}
      <div style={{
        background: alertBg,
        border: alertBorder,
        borderRadius: '6px',
        padding: '0.35rem 1rem',
        color: alertColor,
        fontSize: '0.8rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.8rem',
        fontWeight: 'bold',
        boxShadow: isNormalOrEarlyStage ? '0 2px 8px rgba(82, 196, 26, 0.12)' : '0 2px 8px rgba(250, 173, 20, 0.15)'
      }}>
        <span style={{ fontSize: '1.2rem' }}>{alertIcon}</span>
        <span>{alertTitle}：{alertContent}</span>
      </div>

      <div style={{
        fontSize: '0.95rem',
        fontWeight: 'bold',
        color: 'var(--accent-color)',
      }}>
        自动结算奖励与荣誉大厅
      </div>

      <div style={{
        display: 'flex',
        gap: '1rem',
        flex: 1
      }}>
        {/* 流动红旗 */}
        <div className="screen-card scroll-paper" style={{
          flex: 1,
          padding: '0.6rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          border: '1px dashed var(--accent-color)',
          position: 'relative'
        }}>
          <div className="scroll-corner-decor-top-right" style={{ transform: 'scale(0.5)' }} />
          <div className="scroll-corner-decor-bottom-left" style={{ transform: 'scale(0.5)' }} />
          
          <div style={{ fontSize: '1.8rem' }}>🚩</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-primary)' }}>【超凡先锋】流动红旗 (实时)</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.15rem 0' }}>暂无战队达成挑战目标，大家继续冲刺！</div>
            <div style={{ color: '#d48806', fontWeight: 'bold', fontSize: '0.9rem' }}>授予流动红旗</div>
          </div>
        </div>

        {/* 猎头大奖 */}
        <div className="screen-card scroll-paper" style={{
          flex: 1,
          padding: '0.6rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          border: '1px dashed var(--accent-color)',
          position: 'relative'
        }}>
          <div className="scroll-corner-decor-top-right" style={{ transform: 'scale(0.5)' }} />
          <div className="scroll-corner-decor-bottom-left" style={{ transform: 'scale(0.5)' }} />
          
          <div style={{ fontSize: '1.8rem' }}>🎯</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-primary)' }}>百万订单“猎头”大奖 (累计)</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.15rem 0' }}>已斩获百万/五十万级攻坚项目 0 个，每个即时奖励 1888 元</div>
            <div style={{ color: '#f5222d', fontWeight: 'bold', fontSize: '0.95rem' }}>+ ¥0</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HonorHall
