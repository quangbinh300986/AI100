import { useState, useEffect } from 'react'
import { Tabs, DotLoading } from 'antd-mobile'
import { useAuth } from '@shared/hooks/useAuth'
import { getPersonalRanking, getTeamRanking, getDashboardData } from '@shared/api/dashboard'

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

/** 排名列表组件 */
function RankList({
  data,
  showTeam = false,
  unit = '万',
  isPercent = false
}: {
  data: Array<{ rank: number; name: string; team?: string; score: number; trend: 'up' | 'down' | 'same' }>
  showTeam?: boolean
  unit?: string
  isPercent?: boolean
}) {
  return (
    <div style={{ marginTop: 12 }}>
      {data.length > 0 ? (
        data.map((item) => {
          const rankStyle = getRankStyle(item.rank)
          const trendIcon = item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '-'
          const trendColor = item.trend === 'up' ? '#52c41a' : item.trend === 'down' ? '#ff4d4f' : '#999'
          
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
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}>
                  {item.score.toFixed(1).replace('.0', '')}
                  <span style={{ fontSize: 12, color: '#999', marginLeft: 2, fontWeight: 'normal' }}>{unit}</span>
                </div>
                <div style={{ fontSize: 12, color: trendColor, fontWeight: 'bold' }}>
                  {trendIcon}
                </div>
              </div>
            </div>
          )
        })
      ) : (
        <div style={{ textAlign: 'center', padding: '36px 0', color: '#999', fontSize: 13 }}>
          暂无相关排行数据
        </div>
      )}
    </div>
  )
}

export default function TeamRanking() {
  const { user } = useAuth()
  const [personalRankings, setPersonalRankings] = useState<any[]>([])
  const [teamRankings, setTeamRankings] = useState<any[]>([])
  const [zoneRankings, setZoneRankings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // 我的个人排名卡片信息
  const [myRankInfo, setMyRankInfo] = useState<{ rank: string; score: number; team: string }>({
    rank: '-',
    score: 0,
    team: user?.team_name || '暂无战队'
  })

  useEffect(() => {
    let active = true
    
    async function loadRankings() {
      try {
        const [pRes, tRes, dRes] = await Promise.all([
          getPersonalRanking({ limit: 20 }),
          getTeamRanking(),
          getDashboardData()
        ])
        
        if (!active) return
        
        // 1. 个人排行
        const pList = (pRes?.items || []).map((x: any) => ({
          rank: x.rank,
          name: x.user_name,
          team: x.team_name,
          score: x.total_value,
          trend: x.rank === 1 ? 'up' : 'same',
          userId: x.user_id
        }))
        setPersonalRankings(pList)
        
        // 2. 战队排行
        const tList = (tRes?.items || []).map((x: any) => ({
          rank: x.rank,
          name: x.team_name,
          score: x.total_value,
          trend: x.rank === 1 ? 'up' : 'same'
        }))
        setTeamRankings(tList)
        
        // 3. 战区排行
        const zList = (dRes?.zoneRanking || []).map((x: any) => ({
          rank: x.rank,
          name: x.name,
          score: x.score,
          trend: x.rank === 1 ? 'up' : 'same'
        }))
        setZoneRankings(zList)

        // 4. 定位当前登录用户的具体排行
        if (user?.id) {
          const myItem = pList.find((x: any) => x.userId === user.id)
          if (myItem) {
            setMyRankInfo({
              rank: `第 ${myItem.rank} 名`,
              score: myItem.score,
              team: myItem.team
            })
          } else {
            setMyRankInfo({
              rank: '未上榜',
              score: 0,
              team: user.team_name || '暂无战队'
            })
          }
        }
      } catch (err) {
        console.error('获取排行榜数据失败:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadRankings()
    
    return () => {
      active = false
    }
  }, [user])

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <DotLoading color="primary" />
        <span style={{ marginTop: 12, color: '#999', fontSize: 14 }}>加载排行榜数据中...</span>
      </div>
    )
  }

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
          <div style={{ fontSize: 13, opacity: 0.8 }}>我的当前排名 (营销新签额)</div>
          <div style={{ fontSize: 36, fontWeight: 800, marginTop: 4 }}>{myRankInfo.rank}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            {myRankInfo.team} · 新签实际 {myRankInfo.score.toFixed(1).replace('.0', '')} 万
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
        <Tabs.Tab title="个人排名 (新签)" key="personal">
          <RankList data={personalRankings} showTeam unit="万" />
        </Tabs.Tab>
        <Tabs.Tab title="战队排名 (新签)" key="team">
          <RankList data={teamRankings} unit="万" />
        </Tabs.Tab>
        <Tabs.Tab title="战区排名 (达成率)" key="zone">
          <RankList data={zoneRankings} unit="%" isPercent />
        </Tabs.Tab>
      </Tabs>
    </div>
  )
}
