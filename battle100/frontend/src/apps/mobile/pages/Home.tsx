import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import { getMyStats, getTeamDetailedMetrics, getCompanyKpiDetail, toggleKpiLike, addKpiComment, getKpiComments } from '@shared/api/dashboard'
import { get } from '@shared/api/client'
import type { MyStatsResponse } from '@shared/types'
import { DotLoading, Tabs, Popup, Form, Button, Toast, Selector, TextArea, Input, InfiniteScroll } from 'antd-mobile'
import { post } from '@shared/api/client'

/** 快捷入口配置 */
const shortcuts = [
  { icon: '📝', label: '每日填报', path: '/m/report' },
  { icon: '🎯', label: '我的目标', path: '/m/goals' },
  { icon: '🏆', label: '排行榜', path: '/m/ranking' },
  { icon: '👤', label: '个人中心', path: '/m/profile' },
]

interface MobileKpiCardProps {
  item: any;
  kpiType: string;
}

const MobileKpiCard: React.FC<MobileKpiCardProps> = ({ item, kpiType }) => {
  // 社交互动点赞 target_type 逻辑
  let targetType = 'report_detail';
  if (kpiType === 'middle_office_report' || kpiType === 'happiness_committee' || kpiType === 'station_reports') {
    targetType = 'broadcast_event';
  }

  const targetId = item.id;

  const [liked, setLiked] = useState(item.is_liked || false);
  const [likeCount, setLikeCount] = useState(item.like_count || 0);
  const [commentCount, setCommentCount] = useState(item.comment_count || 0);
  
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    setLiked(item.is_liked || false);
    setLikeCount(item.like_count || 0);
    setCommentCount(item.comment_count || 0);
  }, [item]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const nextLiked = !liked;
      const res = await toggleKpiLike({
        target_id: targetId,
        target_type: targetType
      });
      if (res) {
        setLiked(nextLiked);
        setLikeCount(prev => nextLiked ? prev + 1 : Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('点赞操作失败:', err);
    }
  };

  const loadComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await getKpiComments({
        target_id: targetId,
        target_type: targetType
      });
      if (res) {
        setComments(res);
      }
    } catch (err) {
      console.error('获取讨论列表失败:', err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const toggleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextShow = !showComments;
    setShowComments(nextShow);
    if (nextShow) {
      loadComments();
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await addKpiComment({
        target_id: targetId,
        target_type: targetType,
        content: commentInput.trim()
      });
      if (res) {
        setCommentInput('');
        setCommentCount(prev => prev + 1);
        loadComments();
      }
    } catch (err) {
      console.error('发表讨论失败:', err);
      Toast.show({ icon: 'fail', content: '发表讨论失败' });
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div 
      style={{ 
        background: '#fff', 
        borderRadius: 8, 
        border: '1px solid #f0f0f0', 
        padding: 12, 
        marginBottom: 10,
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#bfbfbf', marginBottom: 6 }}>
        <span>📅 {item.report_date || item.created_at?.slice(0, 10) || '未知时间'}</span>
        <span>✍️ {item.reporter_name || item.user_name || '系统'} ({item.team_name || item.team_name_val || '总部'})</span>
      </div>

      {item.customer_name && (
        <div style={{ fontSize: 13, fontWeight: 'bold', color: '#262626', marginBottom: 4 }}>
          🏢 {item.customer_name}
        </div>
      )}

      {/* 铁三角联动人或搭档 */}
      {item.partner_name && item.partner_name !== '—' && (
        <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>
          🤝 联动人/协同搭档：{item.partner_name}
        </div>
      )}

      <div style={{ fontSize: 12, color: '#595959', lineHeight: '18px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {item.description || item.content}
      </div>

      {/* 合同金额 */}
      {item.amount !== undefined && (
        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#ff4d4f', marginTop: 4 }}>
          签约额: {item.amount} 万元
        </div>
      )}

      {/* 线索进度 */}
      {item.progress && (
        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#1677ff', marginTop: 4 }}>
          进度: {item.progress}
        </div>
      )}

      {/* 幸福动作得分或等级 */}
      {item.level && (
        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#52c41a', marginTop: 4 }}>
          动作评价/得分: {item.level}
        </div>
      )}

      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 16, 
          marginTop: 10, 
          paddingTop: 8, 
          borderTop: '1px dashed #f5f5f5' 
        }}
      >
        <div 
          onClick={handleLike}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 4, 
            fontSize: 12, 
            color: liked ? '#ff4d4f' : '#8c8c8c', 
            cursor: 'pointer' 
          }}
        >
          <span>👍</span>
          <span>{likeCount}</span>
        </div>

        <div 
          onClick={toggleComments}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 4, 
            fontSize: 12, 
            color: showComments ? '#1890ff' : '#8c8c8c', 
            cursor: 'pointer' 
          }}
        >
          <span>💬</span>
          <span>{commentCount} 讨论</span>
        </div>
      </div>

      {showComments && (
        <div 
          style={{ 
            marginTop: 10, 
            background: '#fafafa', 
            borderRadius: 6, 
            padding: 8, 
            borderTop: '1px solid #f0f0f0' 
          }}
        >
          {commentsLoading ? (
            <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 11, color: '#999' }}>加载讨论中...</div>
          ) : comments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8, maxHeight: 150, overflowY: 'auto' }}>
              {comments.map((c) => (
                <div key={c.id} style={{ fontSize: 11, lineHeight: '14px', color: '#595959' }}>
                  <span style={{ fontWeight: 'bold', color: '#262626' }}>{c.user_name} ({c.team_name || '总部'}):</span>{' '}
                  <span>{c.content}</span>
                  <span style={{ color: '#bfbfbf', marginLeft: 6 }}>{c.created_at?.slice(5, 16)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 11, color: '#bfbfbf' }}>暂无讨论</div>
          )}

          <form 
            onSubmit={handleSubmitComment} 
            style={{ 
              display: 'flex', 
              gap: 6, 
              borderTop: '1px solid #f0f0f0', 
              paddingTop: 8, 
              marginTop: 4 
            }}
          >
            <input 
              type="text" 
              placeholder="发表讨论..." 
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              style={{ 
                flex: 1, 
                border: '1px solid #d9d9d9', 
                borderRadius: 4, 
                padding: '4px 8px', 
                fontSize: 11, 
                background: '#fff' 
              }}
            />
            <button 
              type="submit" 
              disabled={!commentInput.trim() || submittingComment}
              style={{ 
                background: '#1890ff', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 4, 
                padding: '4px 10px', 
                fontSize: 11, 
                cursor: 'pointer' 
              }}
            >
              发送
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [stats, setStats] = useState<MyStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // 战区大PK Tab 状态，默认全部为中文
  const [activeZoneTab, setActiveZoneTab] = useState<string>('第一战区')

  // 全公司大盘 KPI 指标详情弹窗状态
  const [companyKpiVisible, setCompanyKpiVisible] = useState(false)
  const [companyKpiLoading, setCompanyKpiLoading] = useState(false)
  const [companyKpiData, setCompanyKpiData] = useState<any>(null)
  const [companyKpiTitle, setCompanyKpiTitle] = useState('')
  const [companyKpiType, setCompanyKpiType] = useState<string>('')

  // 移动端明细无限滚动懒加载状态，所有注释必须使用中文
  const [displayedCount, setDisplayedCount] = useState(10)
  const loadMoreKpiData = async () => {
    // 延迟 500ms，为移动端滚动加载提供丝滑体验
    await new Promise(resolve => setTimeout(resolve, 500))
    setDisplayedCount(prev => prev + 10)
  }

  const handleViewCompanyKpi = async (type: string, title: string) => {
    setCompanyKpiTitle(title)
    setCompanyKpiType(type)
    setCompanyKpiVisible(true)
    setCompanyKpiLoading(true)
    setCompanyKpiData(null)
    setDisplayedCount(10) // 每次打开弹窗重置展示行数为10条
    try {
      const res = await getCompanyKpiDetail({ kpi_type: type })
      if (res) {
        setCompanyKpiData(res)
      }
    } catch (err) {
      console.error('加载公司大盘KPI明细失败:', err)
      Toast.show({ icon: 'fail', content: '加载明细失败' })
    } finally {
      setCompanyKpiLoading(false)
    }
  }

  // 中台幸福委播报相关状态与方法，所有注释必须使用中文
  const isMiddleOfficeOrAdmin = user?.role === 'admin' || user?.position_type === 'middle_office'
  const [middleOfficeVisible, setMiddleOfficeVisible] = useState(false)
  const [middleOfficeSubmitLoading, setMiddleOfficeSubmitLoading] = useState(false)
  const [middleOfficeForm, setMiddleOfficeForm] = useState({
    firstType: '',
    secondType: '',
    content: ''
  })

  const handlePublishMiddleOfficeBroadcast = async () => {
    if (!middleOfficeForm.firstType) {
      Toast.show({ icon: 'fail', content: '请选择播报一级分类' })
      return
    }
    if (!middleOfficeForm.secondType) {
      Toast.show({ icon: 'fail', content: '请选择二级分类' })
      return
    }
    if (!middleOfficeForm.content.trim()) {
      Toast.show({ icon: 'fail', content: '请输入播报内容' })
      return
    }

    if (middleOfficeSubmitLoading) return
    setMiddleOfficeSubmitLoading(true)

    try {
      const payload: any = {
        event_type: middleOfficeForm.firstType === 'happiness' ? 'happiness_committee' : 'middle_office_report',
        content: `【${middleOfficeForm.secondType}】${middleOfficeForm.content}`,
        push_channel: 'all',
        team_id: user?.teamId || null
      }
      const res = await post('/broadcast', payload)
      if (res) {
        Toast.show({ icon: 'success', content: '中台幸福委播报发布成功，大屏端与钉钉已同步推送' })
        setMiddleOfficeVisible(false)
        setMiddleOfficeForm({
          firstType: '',
          secondType: '',
          content: ''
        })
        // 成功提报后，重新拉取统计数据刷新页面
        const statsRes = await getMyStats()
        if (statsRes) {
          setStats(statsRes as any)
        }
      }
    } catch (err: any) {
      console.error(err)
      const detail = err?.response?.data?.detail || '发布失败'
      Toast.show({ icon: 'fail', content: detail })
    } finally {
      setMiddleOfficeSubmitLoading(false)
    }
  }

  // 一级指标弹窗状态
  const [teamMetricsVisible, setTeamMetricsVisible] = useState(false)
  const [teamMetricsLoading, setTeamMetricsLoading] = useState(false)
  const [selectedTeamName, setSelectedTeamName] = useState('')
  const [teamMetricsData, setTeamMetricsData] = useState<any>(null)

  // 二级流水明细状态
  const [subDetailVisible, setSubDetailVisible] = useState(false)
  const [subDetailLoading, setSubDetailLoading] = useState(false)
  const [subDetailData, setSubDetailData] = useState<any[]>([])
  const [subDetailTitle, setSubDetailTitle] = useState('')
  const [subDetailType, setSubDetailType] = useState('')

  useEffect(() => {
    let active = true
    getMyStats()
      .then((res) => {
        if (active && res) {
          setStats(res as any)
          // 依据用户所属战区自动锚定初始 Tab
          if (res.team_stats && res.team_stats.zone_name) {
            setActiveZoneTab(res.team_stats.zone_name)
          }
        }
      })
      .catch((err) => {
        console.error('获取级联大屏数据失败:', err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  // 打开一级指标弹窗，加载并显示战队 9 项多维指标明细
  const handleViewTeamMetrics = async (teamId: number, teamName: string) => {
    setSelectedTeamName(teamName)
    setTeamMetricsVisible(true)
    setTeamMetricsLoading(true)
    setTeamMetricsData(null)
    try {
      const res = await getTeamDetailedMetrics(teamId)
      const data = (res as any)?.data ? (res as any).data : res
      if (data) {
        setTeamMetricsData(data)
      }
    } catch (err) {
      console.error('获取战队多维度指标失败:', err)
    } finally {
      setTeamMetricsLoading(false)
    }
  }

  // 加载并打开二级明细卡片弹窗
  const handleViewSubDetail = async (type: string, title: string, teamId: number, extraType?: string) => {
    setSubDetailTitle(title)
    setSubDetailType(type)
    setSubDetailVisible(true)
    setSubDetailLoading(true)
    setSubDetailData([])
    setDisplayedCount(10) // 每次打开弹窗重置展示行数为10条
    try {
      let res: any
      if (type === 'contracts') {
        res = await get(`/dashboard/team-contracts?team_id=${teamId}&contract_type=${extraType}`)
      } else if (type === 'potential_leads') {
        res = await get(`/dashboard/company-kpi-detail?kpi_type=potential_leads&team_id=${teamId}`)
      } else if (type === 'valid_leads') {
        res = await get(`/dashboard/company-kpi-detail?kpi_type=leads&team_id=${teamId}`)
      } else if (type === 'triangle') {
        res = await get(`/dashboard/team-triangles?team_id=${teamId}`)
      } else if (type === 'happiness') {
        res = await get(`/dashboard/team-happiness?team_id=${teamId}`)
      }
      
      let data = res?.data ? res.data : res
      // 有效线索与潜力线索接口返回的是 {"list": [...]} 结构，特殊提取
      if ((type === 'valid_leads' || type === 'potential_leads') && data && data.list) {
        data = data.list
      }
      if (data && Array.isArray(data)) {
        setSubDetailData(data)
      }
    } catch (err) {
      console.error('加载战队二级细项明细失败:', err)
    } finally {
      setSubDetailLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <DotLoading color="primary" />
        <span style={{ marginTop: 12, color: '#999', fontSize: 14 }}>加载多级作战数据中...</span>
      </div>
    )
  }

  // 1. 公司盘数据
  const rawCompanyStats = stats?.company_stats || {}
  const companyStats = {
    newContracts: rawCompanyStats.newContracts || { value: 0, target: 6200, percentage: 0 },
    happinessActions: rawCompanyStats.happinessActions || { value: 0, target: 3300, percentage: 0 },
    ironTriangle: rawCompanyStats.ironTriangle || { value: 0, target: 500, percentage: 0 },
    tenderProjects: rawCompanyStats.tenderProjects || { value: 0, target: 150, percentage: 0 },
    validLeads: rawCompanyStats.validLeads || { value: 0, target: 600, percentage: 0 },
    potentialLeads: rawCompanyStats.potentialLeads || { value: 0, target: 600, percentage: 0 },
    stationReports: rawCompanyStats.stationReports || { value: 0, target: 300, percentage: 0 },
    middleOfficeReports: rawCompanyStats.middleOfficeReports || { value: 0, target: 500, percentage: 0 },
    happinessCommitteeReports: rawCompanyStats.happinessCommitteeReports || { value: 0, target: 600, percentage: 0 }
  }

  // 9 大指标列表，全部注释采用中文
  const kpiItems = [
    {
      key: 'newContracts',
      type: 'contracts',
      title: '新签合同',
      value: `${companyStats.newContracts.value.toLocaleString()} 万元`,
      target: `${companyStats.newContracts.target}万`,
      percentage: companyStats.newContracts.percentage,
      color: '#00d4ff'
    },
    {
      key: 'happinessActions',
      type: 'happiness',
      title: '幸福动作',
      value: `${companyStats.happinessActions.value} 次`,
      target: `${companyStats.happinessActions.target}次`,
      percentage: companyStats.happinessActions.percentage,
      color: '#00d4ff'
    },
    {
      key: 'ironTriangle',
      type: 'triangle',
      title: '铁三角协作',
      value: `${companyStats.ironTriangle.value} 次`,
      target: `${companyStats.ironTriangle.target}次`,
      percentage: companyStats.ironTriangle.percentage,
      color: '#00d4ff'
    },
    {
      key: 'tenderProjects',
      type: 'tenders',
      title: '中标项目',
      value: `${companyStats.tenderProjects.value} 个`,
      target: `${companyStats.tenderProjects.target}个`,
      percentage: companyStats.tenderProjects.percentage,
      color: '#00d4ff'
    },
    {
      key: 'validLeads',
      type: 'leads',
      title: '有效线索',
      value: `${companyStats.validLeads.value} 条`,
      target: `${companyStats.validLeads.target}条`,
      percentage: companyStats.validLeads.percentage,
      color: '#00d4ff'
    },
    {
      key: 'potentialLeads',
      type: 'potential_leads',
      title: '潜在线索',
      value: `${companyStats.potentialLeads.value} 条`,
      target: `${companyStats.potentialLeads.target}条`,
      percentage: companyStats.potentialLeads.percentage,
      color: '#00d4ff'
    },
    {
      key: 'stationReports',
      type: 'station_reports',
      title: '市场信息前线播报',
      value: `${companyStats.stationReports.value} 次`,
      target: `${companyStats.stationReports.target}次`,
      percentage: companyStats.stationReports.percentage,
      color: '#00d4ff'
    },
    {
      key: 'middleOfficeReports',
      type: 'middle_office_report',
      title: '中台前线播报',
      value: `${companyStats.middleOfficeReports.value} 次`,
      target: `${companyStats.middleOfficeReports.target}次`,
      percentage: companyStats.middleOfficeReports.percentage,
      color: '#00d4ff'
    },
    {
      key: 'happinessCommitteeReports',
      type: 'happiness_committee',
      title: '幸福委播报',
      value: `${companyStats.happinessCommitteeReports.value} 次`,
      target: `${companyStats.happinessCommitteeReports.target}次`,
      percentage: companyStats.happinessCommitteeReports.percentage,
      color: '#00d4ff'
    }
  ]

  // 2. 战队盘数据
  const teamStats = stats?.team_stats

  // 3. 个人目标数据
  const personalStats = stats?.personal_stats || []

  // 状态灯颜色
  const getLightColor = (light: 'red' | 'yellow' | 'green' | undefined) => {
    if (light === 'green') return '#52c41a'
    if (light === 'yellow') return '#faad14'
    if (light === 'red') return '#ff4d4f'
    return '#bfbfbf'
  }

  return (
    <div className="page-content">
      {/* 顶部问候 */}
      <div style={{ padding: '16px 0 8px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1f1f1f' }}>
          下午好，{user?.name || '冲刺队员'} 👋
        </h2>
        <p style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
          {teamStats ? (
            <>
              所属战队：<span style={{ color: '#1677ff', fontWeight: 600 }}>{teamStats.team_name}</span>
            </>
          ) : (
            <span>中地百日冲刺大本营</span>
          )}
          <span style={{ margin: '0 8px', color: '#ccc' }}>|</span>
          <span>岗位：{user?.position || '冲刺队员'}</span>
        </p>
      </div>

      {/* 快捷入口 */}
      <div
        className="card"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 4 }}
      >
        {(
          [
            ...shortcuts,
            { icon: '📢', label: '中台幸福委播报', path: 'middle_office_popup' }
          ]
        ).map((item) => (
          <div
            key={item.path}
            onClick={() => {
              if (item.path === 'middle_office_popup') {
                setMiddleOfficeVisible(true)
              } else {
                navigate(item.path)
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '8px 0',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 24 }}>{item.icon}</span>
            <span style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* 第一级：🏆 公司战役总盘 */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #0a1929, #102a4c)',
          color: '#fff',
          padding: 20,
          marginTop: 12,
          boxShadow: '0 4px 16px rgba(10, 25, 41, 0.25)'
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🏆 战役累计公司总盘</span>
          <span style={{ fontSize: 11, color: '#00d4ff', border: '1px solid #00d4ff', padding: '2px 6px', borderRadius: 4 }}>全员共享</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 8px' }}>
          {kpiItems.map((item, idx) => {
            const isLastRow = idx >= 6
            const isRightCol = (idx + 1) % 3 === 0
            
            return (
              <div 
                key={item.key}
                onClick={() => handleViewCompanyKpi(item.type, item.title)}
                style={{
                  padding: '10px 4px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRight: isRightCol ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  borderBottom: isLastRow ? 'none' : '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: item.color }}>
                  {item.value.replace(' 万元', '万').replace(' 次', '次').replace(' 个', '个').replace(' 条', '条')}
                </div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2, whiteSpace: 'nowrap' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 9, opacity: 0.5, marginTop: 1, whiteSpace: 'nowrap' }}>
                  目标 {item.target}
                </div>
                <div style={{ fontSize: 11, color: '#52c41a', marginTop: 4, fontWeight: 600 }}>
                  达成 {item.percentage}%
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 战区战队大PK看板，所有注释采用中文 */}
      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚔️ 战区战队双轨达成大PK</span>
          <span style={{ fontSize: 11, color: '#1677ff', border: '1px solid #1677ff', padding: '2px 6px', borderRadius: 4 }}>累计实绩</span>
        </div>

        {stats?.zone_teams_data && stats.zone_teams_data.length > 0 ? (
          <Tabs activeKey={activeZoneTab} onChange={(key) => setActiveZoneTab(key)}>
            {stats.zone_teams_data.map((zone) => (
              <Tabs.Tab title={zone.zone_name} key={zone.zone_name}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  {zone.teams.map((t) => {
                    const lightColor = t.status_light === 'green' ? '#52c41a' : t.status_light === 'yellow' ? '#faad14' : '#ff4d4f';
                    const lightText = t.status_light === 'green' ? '强劲绿灯' : t.status_light === 'yellow' ? '预警黄灯' : '警告红灯';

                    return (
                      <div
                        key={t.team_id}
                        onClick={() => handleViewTeamMetrics(t.team_id, t.team_name)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #f0f0f0',
                          borderRadius: 10,
                          padding: 12,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                          position: 'relative'
                        }}
                      >
                        {/* 头部：战队名与状态灯 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{t.team_name}</span>
                          <span style={{ fontSize: 11, color: lightColor, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'bold' }}>
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: lightColor,
                                boxShadow: `0 0 6px ${lightColor}`,
                                display: 'inline-block'
                              }}
                            />
                            {lightText}
                          </span>
                        </div>

                        {/* 巴长 */}
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                          战队巴长：<span style={{ color: '#111', fontWeight: 600 }}>{t.leader}</span>
                        </div>

                        {/* 三项指标进度 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {/* 营销新签 */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>
                              <span>营销新签实际/目标</span>
                              <span style={{ color: '#111', fontWeight: 600 }}>
                                {t.marketing_actual.toFixed(1).replace('.0', '')} / {t.marketing_target.toFixed(1).replace('.0', '')} 万 ({t.marketing_rate.toFixed(1).replace('.0', '')}%)
                              </span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: '#f5f5f5', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(t.marketing_rate, 100)}%`,
                                  background: 'linear-gradient(90deg, #1890ff, #00d4ff)',
                                  borderRadius: 2
                                }}
                              />
                            </div>
                          </div>

                          {/* 交付新签 */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>
                              <span>交付新签实际/目标</span>
                              <span style={{ color: '#111', fontWeight: 600 }}>
                                {t.delivery_actual.toFixed(1).replace('.0', '')} / {t.delivery_target.toFixed(1).replace('.0', '')} 万 ({t.delivery_rate.toFixed(1).replace('.0', '')}%)
                              </span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: '#f5f5f5', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(t.delivery_rate, 100)}%`,
                                  background: 'linear-gradient(90deg, #52c41a, #95de64)',
                                  borderRadius: 2
                                }}
                              />
                            </div>
                          </div>

                          {/* 有效线索 */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>
                              <span>有效线索实际/目标</span>
                              <span style={{ color: '#111', fontWeight: 600 }}>
                                {t.valid_leads_actual} / {t.valid_leads_target.toFixed(1).replace('.0', '')} 条 ({t.valid_leads_rate.toFixed(1).replace('.0', '')}%)
                              </span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: '#f5f5f5', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(t.valid_leads_rate, 100)}%`,
                                  background: 'linear-gradient(90deg, #faad14, #ffe58f)',
                                  borderRadius: 2
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Tabs.Tab>
            ))}
          </Tabs>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#999', fontSize: 12 }}>
            暂无战区战队大PK数据
          </div>
        )}
      </div>

      {/* 第二级：⚔️ 战队双轨及过程盘 */}
      {teamStats ? (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>⚔️ 战队双轨战斗盘</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: getLightColor(teamStats.status_light),
                  boxShadow: `0 0 8px ${getLightColor(teamStats.status_light)}`,
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>
                {teamStats.status_light === 'green' ? '强劲绿灯' : teamStats.status_light === 'yellow' ? '预警黄灯' : '警告红灯'}
              </span>
            </div>
          </div>

          {/* 战队双轨新签指标 */}
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 6 }}>
              <span>📢 营销新签实际/目标</span>
              <span style={{ fontWeight: 600, color: '#111' }}>
                {teamStats.marketing_actual} / {teamStats.marketing_target} 万元
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden', marginBottom: 12 }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(teamStats.marketing_percentage, 100)}%`,
                  background: 'linear-gradient(90deg, #1677ff, #4096ff)',
                  borderRadius: 3,
                  transition: 'width 0.6s ease'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 6 }}>
              <span>🚀 交付新签实际/目标</span>
              <span style={{ fontWeight: 600, color: '#111' }}>
                {teamStats.delivery_actual} / {teamStats.delivery_target} 万元
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(teamStats.delivery_percentage, 100)}%`,
                  background: 'linear-gradient(90deg, #52c41a, #73d13d)',
                  borderRadius: 3,
                  transition: 'width 0.6s ease'
                }}
              />
            </div>
          </div>

          {/* 战队过程指标表现 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', paddingTop: 4 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>{teamStats.happiness_actions}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>客户幸福动作</div>
            </div>
            <div style={{ borderLeft: '1px solid #edf2f7', borderRight: '1px solid #edf2f7' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>{teamStats.iron_triangle}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>售前铁三角</div>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>{teamStats.valid_leads}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>有效商机线索</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 🎯 查看个人目标跳转入口 */}
      <div
        className="card"
        onClick={() => navigate('/m/goals')}
        style={{ padding: '14px 16px', textAlign: 'center', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 14, color: '#1677ff', fontWeight: 700 }}>
          🎯 查看我的个人目标 ›
        </span>
      </div>

      {/* ================= 一级弹窗：战队多维指标明细 ================= */}
      <Popup
        visible={teamMetricsVisible}
        onMaskClick={() => {
          setTeamMetricsVisible(false)
          setTeamMetricsData(null)
        }}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '70vh', maxHeight: '90vh', padding: 20, overflowY: 'auto' }}
      >
        {selectedTeamName && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontSize: 16, fontWeight: 'bold' }}>
              ⚔️ 【{selectedTeamName}】多维度指标明细
            </span>
            <span onClick={() => {
              setTeamMetricsVisible(false)
              setTeamMetricsData(null)
            }} style={{ color: '#1677ff', fontSize: 14, cursor: 'pointer', fontWeight: 'bold' }}>关闭</span>
          </div>
        )}

        {teamMetricsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><DotLoading color="primary" /></div>
        ) : teamMetricsData ? (
          <div>
            <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: 6, fontSize: 11, color: '#666', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span>CRM对接：{teamMetricsData.crm_connected ? '🟢 已直连CRM' : '❌ 连接离线'}</span>
              <span>口径：全员累计</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                {
                  key: 'm_contract',
                  name: '💰 营销新签合同额',
                  definition: '合同已加盖双方公章，营销人员所属战队新签总额',
                  target: `${teamMetricsData.marketing_target} 万`,
                  actualVal: teamMetricsData.marketing_actual,
                  actual: `${teamMetricsData.marketing_actual} 万`,
                  rate: teamMetricsData.marketing_target > 0 ? (teamMetricsData.marketing_actual / teamMetricsData.marketing_target * 100) : 0,
                  isLink: teamMetricsData.marketing_actual > 0,
                  onClick: () => handleViewSubDetail('contracts', '营销新签项目', teamMetricsData.team_id, 'marketing')
                },
                {
                  key: 'd_contract',
                  name: '🛠️ 交付新签合同额',
                  definition: '合同已加盖双方公章，技术/交付人员所属战队新签总额',
                  target: `${teamMetricsData.delivery_target} 万`,
                  actualVal: teamMetricsData.delivery_actual,
                  actual: `${teamMetricsData.delivery_actual} 万`,
                  rate: teamMetricsData.delivery_target > 0 ? (teamMetricsData.delivery_actual / teamMetricsData.delivery_target * 100) : 0,
                  isLink: teamMetricsData.delivery_actual > 0,
                  onClick: () => handleViewSubDetail('contracts', '交付新签项目', teamMetricsData.team_id, 'delivery')
                },
                {
                  key: 'valid_leads',
                  name: '🔍 有效需求线索量',
                  definition: '本系统有效线索库中进度为25%的线索总数量',
                  target: `${teamMetricsData.valid_leads_target} 条`,
                  actualVal: teamMetricsData.valid_leads_actual,
                  actual: `${teamMetricsData.valid_leads_actual ?? 0} 条`,
                  rate: teamMetricsData.valid_leads_target > 0 ? ((teamMetricsData.valid_leads_actual ?? 0) / teamMetricsData.valid_leads_target * 100) : 0,
                  isLink: (teamMetricsData.valid_leads_actual ?? 0) > 0,
                  onClick: () => handleViewSubDetail('valid_leads', '有效需求线索', teamMetricsData.team_id)
                },
                {
                  key: 'potential_leads',
                  name: '📈 潜力需求线索量',
                  definition: '本系统潜力线索库中进度为 5%-10% 的线索总数量',
                  target: '—',
                  actualVal: teamMetricsData.potential_leads_actual,
                  actual: teamMetricsData.potential_leads_actual !== null ? `${teamMetricsData.potential_leads_actual} 条` : '—',
                  rate: 0,
                  isLink: (teamMetricsData.potential_leads_actual ?? 0) > 0,
                  onClick: () => handleViewSubDetail('potential_leads', '潜力需求线索', teamMetricsData.team_id)
                },
                {
                  key: 'conversion',
                  name: '📊 线索转化率',
                  definition: '新签线索个数 / 上月有效线索池总个数 * 100%（CRM线索转化指标）',
                  target: '—',
                  actualVal: 0,
                  actual: teamMetricsData.leads_conversion_rate !== null ? `${teamMetricsData.leads_conversion_rate} %` : '—',
                  rate: 0,
                  isLink: false
                },
                {
                  key: 'new_customer',
                  name: '🆕 战役新客户数',
                  definition: '本战队已审核日报中，新签合同明细里去重客户总数',
                  target: '—',
                  actualVal: 0,
                  actual: `${teamMetricsData.new_customers_actual} 个`,
                  rate: 0,
                  isLink: false
                },
                {
                  key: 'renew',
                  name: '🔄 续签合同额',
                  definition: '同一科室两年内再次签订的合同额总数（基于合同描述智能检索）',
                  target: '—',
                  actualVal: 0,
                  actual: `${teamMetricsData.renew_amount_actual} 万`,
                  rate: 0,
                  isLink: false
                },
                {
                  key: 'triangle',
                  name: '🤝 售前铁三角联动',
                  definition: '本战队全体员工共同客户接触、联动拜访累计次数',
                  target: '—',
                  actualVal: teamMetricsData.triangle_actual,
                  actual: `${teamMetricsData.triangle_actual} 次`,
                  rate: 0,
                  isLink: teamMetricsData.triangle_actual > 0,
                  onClick: () => handleViewSubDetail('triangle', '售前铁三角联动', teamMetricsData.team_id)
                },
                {
                  key: 'happiness',
                  name: '😊 客户幸福标准动作',
                  definition: '本战队全员做到幸福关怀动作并收到客户正反馈的次数',
                  target: '—',
                  actualVal: teamMetricsData.happiness_actual,
                  actual: `${teamMetricsData.happiness_actual} 次`,
                  rate: 0,
                  isLink: teamMetricsData.happiness_actual > 0,
                  onClick: () => handleViewSubDetail('happiness', '客户幸福标准动作', teamMetricsData.team_id)
                }
              ].map(item => (
                <div key={item.key} style={{ border: '1px solid #f0f0f0', padding: 12, borderRadius: 8, background: '#fdfdfd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 'bold', color: '#111' }}>{item.name}</span>
                    {item.target !== '—' && item.rate > 0 ? (
                      <span style={{ fontSize: 11, color: '#1677ff', fontWeight: 'bold' }}>达成率：{item.rate.toFixed(1).replace('.0', '')}%</span>
                    ) : null}
                  </div>
                  
                  {item.target !== '—' && (
                    <div style={{ height: 4, borderRadius: 2, background: '#f5f5f5', overflow: 'hidden', margin: '6px 0 8px 0' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(item.rate, 100)}%`,
                          background: 'linear-gradient(90deg, #ff4d4f 0%, #faad14 60%, #ffd700 100%)',
                          borderRadius: 2
                        }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginTop: 4 }}>
                    <span>目标：{item.target}</span>
                    <span>
                      实际：{item.isLink ? (
                        <span
                          onClick={item.onClick}
                          style={{ color: '#1677ff', textDecoration: 'underline', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          {item.actual} 🔍
                        </span>
                      ) : (
                        <span style={{ fontWeight: 'bold', color: '#333' }}>{item.actual}</span>
                      )}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 6, borderTop: '1px dashed #f0f0f0', paddingTop: 6, lineHeight: '14px' }}>
                    📖 {item.definition}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '30px 0' }}>获取战队多维数据失败</div>
        )}
      </Popup>

      {/* ================= 二级弹窗：具体明细流水记录卡片流 ================= */}
      <Popup
        visible={subDetailVisible}
        onMaskClick={() => {
          setSubDetailVisible(false)
          setSubDetailData([])
        }}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '80vh', maxHeight: '90vh', padding: 20, overflowY: 'auto', zIndex: 1050 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ fontSize: 15, fontWeight: 'bold' }}>
            ⚡ 【{selectedTeamName}】累计【{subDetailTitle}】明细
          </span>
          <span onClick={() => {
            setSubDetailVisible(false)
            setSubDetailData([])
          }} style={{ color: '#1677ff', fontSize: 14, cursor: 'pointer', fontWeight: 'bold' }}>返回</span>
        </div>

        {subDetailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><DotLoading color="primary" /></div>
        ) : subDetailData.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {subDetailData.slice(0, displayedCount).map((item, idx) => (
              <MobileKpiCard key={idx} item={item} kpiType={subDetailType} />
            ))}
            <InfiniteScroll 
              loadMore={loadMoreKpiData} 
              hasMore={displayedCount < subDetailData.length} 
            />
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '40px 0' }}>暂无该项累计实绩明细记录</div>
        )}
      </Popup>

      {/* 中台幸福委播报 Popup 表单，所有注释必须使用中文 */}
      <Popup
        visible={middleOfficeVisible}
        onClose={() => {
          if (!middleOfficeSubmitLoading) setMiddleOfficeVisible(false)
        }}
        bodyStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          minHeight: '60vh',
          maxHeight: '90vh',
          padding: '20px 16px',
          overflowY: 'auto',
          zIndex: 1060
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ fontSize: 15, fontWeight: 'bold', color: '#722ed1' }}>
            📢 中台幸福委播报提报
          </span>
          <span
            onClick={() => {
              if (!middleOfficeSubmitLoading) setMiddleOfficeVisible(false)
            }}
            style={{ color: '#666', fontSize: 14, cursor: 'pointer' }}
          >
            关闭
          </span>
        </div>

        <Form layout="vertical">
          <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>播报动作类型 (一级)</span>}>
            <Selector
              options={[
                { label: '幸福委播报', value: 'happiness' },
                { label: '中台播报', value: 'middle' }
              ]}
              value={[middleOfficeForm.firstType]}
              onChange={(arr) => {
                const val = arr[0] || ''
                setMiddleOfficeForm(prev => ({ ...prev, firstType: val, secondType: '' }))
              }}
              style={{
                '--font-size': '13px',
                '--active-background-color': '#f9f0ff',
                '--active-border-color': '#722ed1'
              }}
            />
          </Form.Item>

          {middleOfficeForm.firstType === 'happiness' && (
            <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>幸福委专委分类 (二级)</span>}>
              <Selector
                columns={2}
                options={[
                  { label: 'B3-1 使命落地委', value: 'B3-1 使命落地委' },
                  { label: 'B3-2 铁三角落地委', value: 'B3-2 铁三角落地委' },
                  { label: 'B3-3 AI提效委', value: 'B3-3 AI提效委' },
                  { label: 'B3-4 数字经营委', value: 'B3-4 数字经营委' },
                  { label: 'B3-5 传灯推广委', value: 'B3-5 传灯推广委' },
                  { label: 'B3-6 产品研发委', value: 'B3-6 产品研发委' },
                  { label: 'B3-7 质量风控委', value: 'B3-7 质量风控委' },
                  { label: 'B3-8 伙伴打造委', value: 'B3-8 伙伴打造委' },
                  { label: 'B3-9 直连客户委', value: 'B3-9 直连客户委' },
                  { label: 'B3-10 组织幸福委', value: 'B3-10 组织幸福委' },
                  { label: 'B3-11 温暖快乐委', value: 'B3-11 温暖快乐委' },
                  { label: 'B3-12 成长学习委', value: 'B3-12 成长学习委' }
                ]}
                value={[middleOfficeForm.secondType]}
                onChange={(arr) => {
                  const val = arr[0] || ''
                  setMiddleOfficeForm(prev => ({ ...prev, secondType: val }))
                }}
                style={{
                  '--font-size': '12px',
                  '--active-background-color': '#f9f0ff',
                  '--active-border-color': '#722ed1'
                }}
              />
            </Form.Item>
          )}

          {middleOfficeForm.firstType === 'middle' && (
            <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>中台部门分类 (二级)</span>}>
              <Selector
                columns={3}
                options={[
                  { label: '市场部', value: '市场部' },
                  { label: '技术中心', value: '技术中心' },
                  { label: '行政部', value: '行政部' },
                  { label: '人力资源部', value: '人力资源部' },
                  { label: '投标部', value: '投标部' },
                  { label: '中地研究院', value: '中地研究院' }
                ]}
                value={[middleOfficeForm.secondType]}
                onChange={(arr) => {
                  const val = arr[0] || ''
                  setMiddleOfficeForm(prev => ({ ...prev, secondType: val }))
                }}
                style={{
                  '--font-size': '12px',
                  '--active-background-color': '#f9f0ff',
                  '--active-border-color': '#722ed1'
                }}
              />
            </Form.Item>
          )}

          {middleOfficeForm.secondType && (
            <>
              <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>播报内容</span>}>
                <TextArea
                  placeholder="请输入具体的播报内容..."
                  rows={4}
                  value={middleOfficeForm.content}
                  onChange={(val) => setMiddleOfficeForm(prev => ({ ...prev, content: val }))}
                  style={{
                    fontSize: 13,
                    border: '1px solid #e8e8e8',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    background: '#fff'
                  }}
                />
              </Form.Item>

              <div style={{ marginTop: 24, marginBottom: 12 }}>
                <Button
                  block
                  color="primary"
                  onClick={handlePublishMiddleOfficeBroadcast}
                  loading={middleOfficeSubmitLoading}
                  style={{
                    borderRadius: 8,
                    height: 44,
                    fontSize: 15,
                    fontWeight: 'bold',
                    backgroundColor: '#722ed1',
                    borderColor: '#722ed1'
                  }}
                >
                  确认发布
                </Button>
              </div>
            </>
          )}
        </Form>
      </Popup>

      {/* ================= 全公司大盘 KPI 指标详情弹窗 ================= */}
      <Popup
        visible={companyKpiVisible}
        onMaskClick={() => {
          setCompanyKpiVisible(false)
          setCompanyKpiData(null)
        }}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '80vh', maxHeight: '90vh', padding: 20, overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ fontSize: 15, fontWeight: 'bold' }}>
            🏆 全公司【{companyKpiTitle}】大盘明细
          </span>
          <span onClick={() => {
            setCompanyKpiVisible(false)
            setCompanyKpiData(null)
          }} style={{ color: '#1677ff', fontSize: 14, cursor: 'pointer', fontWeight: 'bold' }}>关闭</span>
        </div>

        {companyKpiLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><DotLoading color="primary" /></div>
        ) : companyKpiData ? (
          <div>
            {/* 顶部的汇总卡片 */}
            <div style={{ marginBottom: 14 }}>
              {companyKpiType === 'contracts' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'linear-gradient(135deg, #1890ff, #096dd9)', padding: 12, borderRadius: 8, color: '#fff' }}>
                    <span style={{ fontSize: 12 }}>交付新签总额 (大盘去重)</span>
                    <span style={{ fontSize: 14, fontWeight: 'bold' }}>{companyKpiData.delivery_total || 0} 万元</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'linear-gradient(135deg, #ff7a45, #ff4d4f)', padding: 12, borderRadius: 8, color: '#fff' }}>
                    <span style={{ fontSize: 12 }}>营销新签总额</span>
                    <span style={{ fontSize: 14, fontWeight: 'bold' }}>{companyKpiData.marketing_total || 0} 万元</span>
                  </div>
                </div>
              ) : (
                <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>累计统计项：{companyKpiTitle}</span>
                  <span style={{ fontWeight: 'bold', color: '#1677ff' }}>共 {companyKpiData.total ?? 0} 次/条/个</span>
                </div>
              )}
            </div>

            {/* 流水卡片列表 */}
            <div>
              {(() => {
                if (companyKpiType === 'contracts') {
                  const dList = companyKpiData.delivery_list || [];
                  const mList = companyKpiData.marketing_list || [];
                  if (dList.length === 0 && mList.length === 0) {
                    return <div style={{ textAlign: 'center', padding: 30, color: '#bfbfbf', fontSize: 12 }}>暂无新签合同明细</div>;
                  }

                  const dListToShow = dList.slice(0, displayedCount);
                  const mListToShow = displayedCount > dList.length
                    ? mList.slice(0, displayedCount - dList.length)
                    : [];
                  
                  const totalCount = dList.length + mList.length;
                  const hasMore = displayedCount < totalCount;

                  return (
                    <div>
                      {dListToShow.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#111', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 3, height: 12, background: '#1890ff' }} />
                            交付新签合同列表 ({dList.length})
                          </div>
                          {dListToShow.map((item: any, idx: number) => (
                            <MobileKpiCard key={`d-${idx}`} item={item} kpiType={companyKpiType} />
                          ))}
                        </div>
                      )}
                      {mListToShow.length > 0 && (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#111', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 3, height: 12, background: '#ff7a45' }} />
                            营销新签合同列表 ({mList.length})
                          </div>
                          {mListToShow.map((item: any, idx: number) => (
                            <MobileKpiCard key={`m-${idx}`} item={item} kpiType={companyKpiType} />
                          ))}
                        </div>
                      )}
                      <InfiniteScroll loadMore={loadMoreKpiData} hasMore={hasMore} />
                    </div>
                  );
                }

                const list = companyKpiData.list || [];
                if (list.length === 0) {
                  return <div style={{ textAlign: 'center', padding: 30, color: '#bfbfbf', fontSize: 12 }}>暂无相关明细数据</div>;
                }

                const listToShow = list.slice(0, displayedCount);
                const hasMore = displayedCount < list.length;

                return (
                  <div>
                    {listToShow.map((item: any, idx: number) => (
                      <MobileKpiCard key={idx} item={item} kpiType={companyKpiType} />
                    ))}
                    <InfiniteScroll loadMore={loadMoreKpiData} hasMore={hasMore} />
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '30px 0' }}>获取公司大盘数据失败</div>
        )}
      </Popup>
    </div>
  )
}
