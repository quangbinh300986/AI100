import { useState, useEffect } from 'react'
import { Tabs, DotLoading, Popup } from 'antd-mobile'
import { useAuth } from '@shared/hooks/useAuth'
import { getPersonalRanking, getTeamRanking, getDashboardData } from '@shared/api/dashboard'
import { get } from '@shared/api/client'

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
  isPercent = false,
  onScoreClick
}: {
  data: Array<{ rank: number; name: string; team?: string; score: number; trend: 'up' | 'down' | 'same' }>
  showTeam?: boolean
  unit?: string
  isPercent?: boolean
  onScoreClick?: (userName: string) => void
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
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {onScoreClick && item.score > 0 ? (
                    <span 
                      onClick={() => onScoreClick(item.name)}
                      style={{ color: '#1677ff', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      {item.score.toFixed(1).replace('.0', '')}
                    </span>
                  ) : (
                    <span style={{ color: '#595959' }}>
                      {item.score.toFixed(1).replace('.0', '')}
                    </span>
                  )}
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

  // 筛选项及其数据源状态
  const [teams, setTeams] = useState<any[]>([])
  const [thirdClassBars, setThirdClassBars] = useState<string[]>([])
  const [filterTeamId, setFilterTeamId] = useState<number | undefined>(undefined)
  const [filterThirdClassBar, setFilterThirdClassBar] = useState<string | undefined>(undefined)

  // 个人大盘 6 大分类的英雄榜列表
  const [marketingList, setMarketingList] = useState<any[]>([])
  const [deliveryList, setDeliveryList] = useState<any[]>([])
  const [leadsList, setLeadsList] = useState<any[]>([])
  const [potentialLeadsList, setPotentialLeadsList] = useState<any[]>([])
  const [happinessList, setHappinessList] = useState<any[]>([])
  const [triangleList, setTriangleList] = useState<any[]>([])

  const [personalActiveTab, setPersonalActiveTab] = useState<'marketing_signing' | 'delivery_signing' | 'leads' | 'potential_leads' | 'happiness' | 'triangle'>('marketing_signing')

  // 明细弹窗 Popup 状态
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<any[]>([])
  const [detailUser, setDetailUser] = useState('')
  const [detailCategory, setDetailCategory] = useState('')

  // 我的个人排名卡片信息
  const [myRankInfo, setMyRankInfo] = useState<{ rank: string; score: number; team: string }>({
    rank: '-',
    score: 0,
    team: user?.team_name || '暂无战队'
  })

  // 弹出明细 Popup 加载方法
  const handleViewDetail = async (userName: string, category: string) => {
    setDetailUser(userName)
    setDetailCategory(category)
    setDetailVisible(true)
    setDetailLoading(true)
    setDetailData([])
    try {
      const res: any = await get(`/dashboard/personal-weekly-detail?user_name=${encodeURIComponent(userName)}&category=${category}&is_all=true`)
      const data = res?.data ? res.data : res
      if (data && Array.isArray(data)) {
        setDetailData(data)
      }
    } catch (err) {
      console.error('加载累计明细失败:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  // 重新加载数据函数，支持战队和三级巴联动筛选，所有注释均采用中文
  async function loadRankings(tId?: number, bar?: string) {
    setLoading(true)
    try {
      const [pRes, tRes, dRes] = await Promise.all([
        getPersonalRanking({ limit: 20 }),
        getTeamRanking({ rank_by: 'marketing' }),
        getDashboardData({ team_id: tId, third_class_bar: bar })
      ])

      // 1. 设置战队及三级巴选项
      if (dRes) {
        setTeams((dRes as any).teams || [])
        setThirdClassBars((dRes as any).thirdClassBars || [])

        // 2. 映射多维个人战将榜
        const mapHeroBoard = (items: any[]) => (items || []).map((x: any) => ({
          rank: x.rank,
          name: x.name,
          team: x.teamName,
          score: x.score,
          trend: x.trend || 'same'
        }))

        setMarketingList(mapHeroBoard((dRes as any).marketingHeroBoard))
        setDeliveryList(mapHeroBoard((dRes as any).deliveryHeroBoard))
        setLeadsList(mapHeroBoard((dRes as any).leadsBoard))
        setPotentialLeadsList(mapHeroBoard((dRes as any).potentialLeadsBoard))
        setHappinessList(mapHeroBoard((dRes as any).happinessBoard))
        setTriangleList(mapHeroBoard((dRes as any).triangleBoard))

        // 3. 战区排行
        const zList = ((dRes as any).zoneRanking || []).map((x: any) => ({
          rank: x.rank,
          name: x.name,
          score: x.score,
          trend: x.trend || 'same'
        }))
        setZoneRankings(zList)
      }

      // 4. 战队排行
      if (tRes && tRes.items) {
        const tList = (tRes.items || []).map((x: any) => ({
          rank: x.rank,
          name: x.team_name,
          score: x.total_value,
          trend: 'same'
        }))
        setTeamRankings(tList)
      }

      // 5. 定位登录用户排名 (以营销新签为标准)
      if (user?.id && pRes && pRes.items) {
        const pList = (pRes.items || []).map((x: any) => ({
          rank: x.rank,
          name: x.user_name,
          team: x.team_name,
          score: x.total_value,
          userId: x.user_id
        }))
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
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRankings(filterTeamId, filterThirdClassBar)
  }, [filterTeamId, filterThirdClassBar, user])

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
        <Tabs.Tab title="个人排名 (周英雄)" key="personal">
          {/* 胶囊 Tab 指标选择行，所有注释采用中文 */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 0', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            {[
              { id: 'marketing_signing', label: '营销签单' },
              { id: 'delivery_signing', label: '交付签单' },
              { id: 'leads', label: '线索先锋' },
              { id: 'potential_leads', label: '潜力先锋' },
              { id: 'happiness', label: '幸福卷王' },
              { id: 'triangle', label: '铁三角协作' }
            ].map(tab => {
              const isActive = personalActiveTab === tab.id
              return (
                <div
                  key={tab.id}
                  onClick={() => setPersonalActiveTab(tab.id as any)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 'bold',
                    background: isActive ? '#1677ff' : '#f5f5f5',
                    color: isActive ? '#ffffff' : '#595959',
                    transition: 'all 0.2s',
                    boxShadow: isActive ? '0 2px 6px rgba(22,119,255,0.3)' : 'none'
                  }}
                >
                  {tab.label}
                </div>
              )
            })}
          </div>

          {/* 战队与三级巴下拉筛选栏 */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4, marginBottom: 12 }}>
            <select
              value={filterTeamId || ''}
              onChange={(e) => setFilterTeamId(e.target.value ? Number(e.target.value) : undefined)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d9d9d9',
                background: '#ffffff',
                fontSize: 13,
                color: '#262626',
                outline: 'none',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23595959\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                backgroundSize: '16px'
              }}
            >
              <option value="">全部战队</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            
            <select
              value={filterThirdClassBar || ''}
              onChange={(e) => setFilterThirdClassBar(e.target.value || undefined)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d9d9d9',
                background: '#ffffff',
                fontSize: 13,
                color: '#262626',
                outline: 'none',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23595959\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                backgroundSize: '16px'
              }}
            >
              <option value="">全部三级巴</option>
              {thirdClassBars.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* 根据胶囊 Tab 动态渲染对应排行榜，并传点击明细回调 */}
          {personalActiveTab === 'marketing_signing' && (
            <RankList data={marketingList} showTeam unit="万" onScoreClick={(name) => handleViewDetail(name, 'marketing_signing')} />
          )}
          {personalActiveTab === 'delivery_signing' && (
            <RankList data={deliveryList} showTeam unit="万" onScoreClick={(name) => handleViewDetail(name, 'delivery_signing')} />
          )}
          {personalActiveTab === 'leads' && (
            <RankList data={leadsList} showTeam unit="条" onScoreClick={(name) => handleViewDetail(name, 'leads')} />
          )}
          {personalActiveTab === 'potential_leads' && (
            <RankList data={potentialLeadsList} showTeam unit="条" onScoreClick={(name) => handleViewDetail(name, 'potential_leads')} />
          )}
          {personalActiveTab === 'happiness' && (
            <RankList data={happinessList} showTeam unit="次" onScoreClick={(name) => handleViewDetail(name, 'happiness')} />
          )}
          {personalActiveTab === 'triangle' && (
            <RankList data={triangleList} showTeam unit="次" onScoreClick={(name) => handleViewDetail(name, 'triangle')} />
          )}
        </Tabs.Tab>

        <Tabs.Tab title="战队排名 (新签)" key="team">
          <RankList data={teamRankings} unit="万" />
        </Tabs.Tab>
        <Tabs.Tab title="战区排名 (达成率)" key="zone">
          <RankList data={zoneRankings} unit="%" isPercent />
        </Tabs.Tab>
      </Tabs>

      {/* 个人累计实绩明细 Popup，所有注释采用中文 */}
      <Popup
        visible={detailVisible}
        onMaskClick={() => setDetailVisible(false)}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '60vh', maxHeight: '80vh', padding: 20, overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ fontSize: 16, fontWeight: 'bold' }}>
            ⚡ 【{detailUser}】累计【{
              detailCategory === 'marketing_signing' ? '营销新签' :
              detailCategory === 'delivery_signing' ? '交付新签' :
              detailCategory === 'leads' ? '有效线索' :
              detailCategory === 'potential_leads' ? '潜力线索确定' :
              detailCategory === 'happiness' ? '客户幸福' :
              detailCategory === 'triangle' ? '铁三角联动' : ''
            }】明细
          </span>
          <span onClick={() => setDetailVisible(false)} style={{ color: '#1677ff', fontSize: 14, cursor: 'pointer', fontWeight: 'bold' }}>关闭</span>
        </div>
        
        {detailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><DotLoading color="primary" /></div>
        ) : detailData.length > 0 ? (
          detailData.map((item, idx) => (
            <div key={idx} style={{ background: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 10, border: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8c8c8c', marginBottom: 6 }}>
                <span>📅 {item.date}</span>
                {item.amount !== undefined && (
                  <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{item.amount} 万元</span>
                )}
                {item.happiness_score !== undefined && (
                  <span style={{ color: '#52c41a', fontWeight: 'bold' }}>+{item.happiness_score} 分</span>
                )}
              </div>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: '#262626', marginBottom: 4 }}>
                🏢 {item.customer_name || '未关联客户'}
              </div>
              {item.project_name && (
                <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>
                  📌 项目：{item.project_name}
                </div>
              )}
              {item.description && (
                <div style={{ fontSize: 12, color: '#8c8c8c', wordBreak: 'break-all' }}>
                  💬 {item.description}
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '40px 0' }}>暂无该项累计实绩明细记录</div>
        )}
      </Popup>
    </div>
  )
}
