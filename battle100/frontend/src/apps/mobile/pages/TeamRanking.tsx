/**
 * 排名页面 - 个人/战队/战区排名
 */
import { Tabs } from 'antd-mobile'

/** 模拟个人排名数据 */
const personalRanking = [
  { rank: 1, name: '王强', team: '雄鹰战队', score: 956, trend: 'up' as const },
  { rank: 2, name: '李娜', team: '猛虎战队', score: 920, trend: 'same' as const },
  { rank: 3, name: '张伟', team: '雄鹰战队', score: 895, trend: 'up' as const },
  { rank: 4, name: '刘洋', team: '飞龙战队', score: 870, trend: 'down' as const },
  { rank: 5, name: '陈明', team: '猛虎战队', score: 845, trend: 'up' as const },
  { rank: 6, name: '赵丽', team: '雄鹰战队', score: 820, trend: 'down' as const },
  { rank: 7, name: '周杰', team: '飞龙战队', score: 790, trend: 'same' as const },
  { rank: 8, name: '吴芳', team: '猛虎战队', score: 760, trend: 'up' as const },
  { rank: 9, name: '孙磊', team: '飞龙战队', score: 735, trend: 'down' as const },
  { rank: 10, name: '朱颖', team: '雄鹰战队', score: 710, trend: 'same' as const },
]

/** 模拟战队排名 */
const teamRanking = [
  { rank: 1, name: '雄鹰战队', score: 4850, trend: 'up' as const },
  { rank: 2, name: '猛虎战队', score: 4620, trend: 'same' as const },
  { rank: 3, name: '飞龙战队', score: 4380, trend: 'down' as const },
  { rank: 4, name: '烈火战队', score: 4100, trend: 'up' as const },
  { rank: 5, name: '闪电战队', score: 3890, trend: 'down' as const },
]

/** 模拟战区排名 */
const zoneRanking = [
  { rank: 1, name: '华东战区', score: 15600, trend: 'up' as const },
  { rank: 2, name: '华南战区', score: 14800, trend: 'same' as const },
  { rank: 3, name: '华北战区', score: 13500, trend: 'up' as const },
  { rank: 4, name: '华中战区', score: 12800, trend: 'down' as const },
  { rank: 5, name: '西南战区', score: 11200, trend: 'down' as const },
]

/** 获取排名样式 */
function getRankStyle(rank: number) {
  if (rank === 1)
    return { bg: 'linear-gradient(135deg, #ffd700, #ffaa00)', color: '#fff' }
  if (rank === 2)
    return { bg: 'linear-gradient(135deg, #c0c0c0, #a0a0a0)', color: '#fff' }
  if (rank === 3)
    return { bg: 'linear-gradient(135deg, #cd7f32, #b5651d)', color: '#fff' }
  return { bg: '#f0f0f0', color: '#666' }
}

/** 获取趋势显示 */
function getTrendDisplay(trend: 'up' | 'down' | 'same') {
  if (trend === 'up') return { icon: '↑', color: '#52c41a' }
  if (trend === 'down') return { icon: '↓', color: '#ff4d4f' }
  return { icon: '-', color: '#999' }
}

/** 排名列表组件 */
function RankList({
  data,
  showTeam = false,
}: {
  data: Array<{ rank: number; name: string; team?: string; score: number; trend: 'up' | 'down' | 'same' }>
  showTeam?: boolean
}) {
  return (
    <div style={{ marginTop: 12 }}>
      {data.map((item) => {
        const rankStyle = getRankStyle(item.rank)
        const trend = getTrendDisplay(item.trend)
        return (
          <div
            key={item.rank}
            className="list-item"
            style={{
              marginBottom: 8,
              borderRadius: 12,
              border: item.rank <= 3 ? '1px solid rgba(22,119,255,0.1)' : '1px solid #f0f0f0',
              borderBottom: item.rank <= 3 ? '1px solid rgba(22,119,255,0.1)' : '1px solid #f0f0f0',
            }}
          >
            {/* 排名 */}
            <div
              className="rank-badge"
              style={{
                background: rankStyle.bg,
                color: rankStyle.color,
              }}
            >
              {item.rank}
            </div>

            {/* 信息 */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{item.name}</div>
              {showTeam && item.team && (
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{item.team}</div>
              )}
            </div>

            {/* 分数 */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}>{item.score}</div>
              <div style={{ fontSize: 12, color: trend.color }}>
                {trend.icon}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function TeamRanking() {
  return (
    <div className="page-content">
      {/* 页面标题 */}
      <div style={{ padding: '16px 0 8px' }}>
        <h2 className="page-title">🏆 排行榜</h2>
      </div>

      {/* 我的排名卡片 */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #1677ff, #00d4ff)',
          color: '#fff',
          padding: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>我的当前排名</div>
          <div style={{ fontSize: 36, fontWeight: 800, marginTop: 4 }}>第 5 名</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            雄鹰战队 · 总分 845
          </div>
        </div>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
          }}
        >
          🏅
        </div>
      </div>

      {/* 排名Tab */}
      <Tabs
        defaultActiveKey="personal"
        style={{
          '--title-font-size': '14px',
          '--active-title-color': '#1677ff',
          '--active-line-color': '#1677ff',
          marginTop: 16,
        } as React.CSSProperties}
      >
        <Tabs.Tab title="个人排名" key="personal">
          <RankList data={personalRanking} showTeam />
        </Tabs.Tab>
        <Tabs.Tab title="战队排名" key="team">
          <RankList data={teamRanking} />
        </Tabs.Tab>
        <Tabs.Tab title="战区排名" key="zone">
          <RankList data={zoneRanking} />
        </Tabs.Tab>
      </Tabs>
    </div>
  )
}
