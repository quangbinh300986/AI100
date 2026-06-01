import React from 'react'
import type { LiveFeedItem } from '@shared/types'

interface LiveFeedProps {
  theme?: string
  liveFeed?: LiveFeedItem[]
}

const LiveFeed: React.FC<LiveFeedProps> = ({ theme = 'theme-light-red', liveFeed }) => {
  // 默认高保真播报数据
  const defaultFeed: LiveFeedItem[] = [
    { id: 1, content: '🏆 盖章签约！【清远战队】郑子鹏 成功新签合同 121 万元！赢战百日！', time: '10:02', type: 'contract' },
    { id: 2, content: '🔍 线索突破！【广州一战队】项斌强 现场联动营销方案铁三角，拜访客户确立预算！', time: '09:45', type: 'achievement' },
    { id: 3, content: '😊 客户幸福！【佛山战队】陈露 做到客户幸福动作 2 次，为客户幸福而奋斗！', time: '09:12', type: 'milestone' },
    { id: 4, content: '🏆 捷报频传！【东莞战队】罗志成 顺利达成第三周新签冲刺目标，展现超强协同动力！', time: '08:50', type: 'contract' },
    { id: 5, content: '🤝 利他协同！【云浮战队】林金龙 与交付中心紧密联动，现场为客户破除系统卡点！', time: '08:30', type: 'info' }
  ]

  const items = liveFeed && liveFeed.length > 0 ? liveFeed : defaultFeed

  // 将所有播报拼接成一条连贯的长文本，在大屏最下方横向滚动
  const marqueeText = items.map(item => `[${item.time}] ${item.content}`).join(' 　★　 ')

  return (
    <div
      style={{
        width: '100vw',
        height: '2.5rem',
        background: theme === 'theme-gold'
          ? 'linear-gradient(90deg, #f5ecd5 0%, #caa460 100%)'
          : 'linear-gradient(90deg, #7f0000 0%, #b71c1c 50%, #7f0000 100%)',
        borderTop: `2px solid var(--border-color)`,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: '0 2rem',
        position: 'fixed',
        bottom: 0,
        left: 0,
        zIndex: 999,
        boxShadow: '0 -4px 15px rgba(0,0,0,0.2)'
      }}
    >
      {/* 滚动条左侧的固定徽章 */}
      <div
        style={{
          background: '#ffffff',
          color: '#b71c1c',
          fontWeight: 'bold',
          fontSize: '0.85rem',
          padding: '0.2rem 0.6rem',
          borderRadius: '4px',
          marginRight: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          flexShrink: 0,
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        }}
      >
        <span>🔥</span>
        <span>实时战报捷报</span>
      </div>

      {/* 无缝滚动走马灯文字容器 */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes screen-marquee {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-50%, 0, 0); }
          }
          .screen-marquee-content {
            display: inline-block;
            white-space: nowrap;
            padding-left: 100%;
            animation: screen-marquee 80s linear infinite;
            font-size: 0.95rem;
            font-weight: bold;
            color: #ffffff;
            letter-spacing: 1px;
          }
          .screen-marquee-content:hover {
            animation-play-state: paused;
          }
        `}} />
        <div className="screen-marquee-content">
          {marqueeText} 　★　 {marqueeText}
        </div>
      </div>
    </div>
  )
}

export default LiveFeed
