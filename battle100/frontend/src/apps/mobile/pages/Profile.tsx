/**
 * 个人中心页面
 */
import { useState, useEffect } from 'react'
import { List, Dialog, Toast, DotLoading, Popup, Tag } from 'antd-mobile'
import {
  UserOutline,
  SetOutline,
  ExclamationCircleOutline,
  RightOutline,
  FileOutline,
  CalendarOutline,
} from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import { getMyStats } from '@shared/api/dashboard'
import { get } from '@shared/api/client'
import type { MyStatsResponse } from '@shared/types'

export default function Profile() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuth()
  const [stats, setStats] = useState<MyStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // 个人名片 Popup
  const [personalInfoVisible, setPersonalInfoVisible] = useState(false)

  // 历史填报列表（一级 Popup）
  const [reportsVisible, setReportsVisible] = useState(false)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsList, setReportsList] = useState<any[]>([])
  const [reportsTotal, setReportsTotal] = useState(0)

  // 日报主表总结及动作明细（二级 Popup）
  const [reportDetailVisible, setReportDetailVisible] = useState(false)
  const [selectedReport, setSelectedReport] = useState<any>(null)

  // 今日日报自动生成器相关状态
  const [dailyReportVisible, setDailyReportVisible] = useState(false)
  const [dailyReportLoading, setDailyReportLoading] = useState(false)
  const [dailyReportText, setDailyReportText] = useState('')
  const [reportScope, setReportScope] = useState<string | number>('company')
  const [reportRole, setReportRole] = useState('admin')

  // 提取去重后的所有战队列表 (用于下拉筛选)
  const allTeams = stats?.zone_teams_data?.reduce((acc: Array<{ teamId: number; teamName: string }>, zone) => {
    if (zone.teams) {
      zone.teams.forEach(t => {
        if (!acc.some(existing => existing.teamId === t.team_id)) {
          acc.push({ teamId: t.team_id, teamName: t.team_name })
        }
      })
    }
    return acc
  }, []) || []

  // 接口生成日报方法
  const handleGenerateDailyReport = async (scope?: string | number, roleParam?: string) => {
    try {
      const finalScope = scope !== undefined ? scope : reportScope
      let finalRole = roleParam !== undefined ? roleParam : reportRole
      
      // 如果范围是全公司大盘，强制锁定为系统管理员角色视角
      if (finalScope === 'company') {
        finalRole = 'admin'
      } else {
        // 如果当前视角为 admin，但范围换成了战队，切换为数字专员或者目标官视角
        if (finalRole === 'admin') {
          if (user?.role === 'target_officer') {
            finalRole = 'target_officer'
          } else {
            finalRole = 'digital_specialist'
          }
        }
      }
      
      setReportScope(finalScope)
      setReportRole(finalRole)
      setDailyReportLoading(true)

      let url = `/dashboard/daily-report?role=${finalRole}`
      if (finalScope !== 'company') {
        url += `&team_id=${finalScope}`
      }

      const res: any = await get(url)
      const data = res?.data ? res.data : res
      if (data && data.text) {
        setDailyReportText(data.text)
      } else {
        Toast.show({ icon: 'fail', content: '生成日报失败，返回内容为空' })
      }
    } catch (err) {
      console.error('日报生成失败:', err)
      Toast.show({ icon: 'fail', content: '获取日报失败' })
    } finally {
      setDailyReportLoading(false)
    }
  }

  // 打开弹窗并根据角色初始化范围和视角
  const handleOpenDailyReportModal = () => {
    let initialScope: string | number = 'company'
    let initialRole = 'admin'

    if (user?.role === 'target_officer' && user?.team_id) {
      initialScope = user.team_id
      initialRole = 'target_officer'
    } else if (user?.role === 'digital_specialist' && user?.team_id) {
      initialScope = 'company'
      initialRole = 'admin'
    }

    setReportScope(initialScope)
    setReportRole(initialRole)
    setDailyReportVisible(true)
    handleGenerateDailyReport(initialScope, initialRole)
  }

  // 高兼容性复制剪切板文本函数，支持 HTTP、WebView 及安全域回退
  const copyToClipboard = (text: string) => {
    if (!text) {
      window.alert('无可复制的日报文本，请稍后再试。')
      return
    }

    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.width = '2em'
    textArea.style.height = '2em'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    textArea.setAttribute('readonly', '')

    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    // 兼容 iOS 设备选区
    textArea.setSelectionRange(0, 99999)

    let success = false
    try {
      success = document.execCommand('copy')
    } catch (err) {
      console.error('复制命令执行异常:', err)
    }

    document.body.removeChild(textArea)

    if (success) {
      window.alert('日报已成功复制到剪贴板！可以直接粘贴发送！')
    } else {
      // 同步复制失败后使用 navigator.clipboard 兜底
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => {
            window.alert('日报已复制到剪贴板！可以直接粘贴发送！')
          })
          .catch(() => {
            window.alert('复制失败，请长按文本框手动选择复制。')
          })
      } else {
        window.alert('复制失败，请长按文本框手动选择复制。')
      }
    }
  }

  // 挂载数据获取逻辑，所有注释均为中文
  const loadReportsList = async () => {
    try {
      const res: any = await get('/reports?page=1&page_size=100')
      const data = res?.data ? res.data : res
      if (data) {
        setReportsTotal(data.total || 0)
        if (data.items && Array.isArray(data.items)) {
          setReportsList(data.items)
        }
      }
    } catch (err) {
      console.error('加载历史填报明细失败:', err)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([
      getMyStats(),
      loadReportsList()
    ])
      .then(([statsRes]) => {
        if (active && statsRes) {
          setStats(statsRes)
        }
      })
      .catch((err) => {
        console.error('获取个人中心数据失败:', err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  /** 退出登录 */
  const handleLogout = () => {
    Dialog.confirm({
      content: '确定要退出登录吗？',
      confirmText: '确定',
      cancelText: '取消',
      onConfirm: () => {
        clearAuth()
        Toast.show({ icon: 'success', content: '已退出登录' })
        navigate('/m/login', { replace: true })
      },
    })
  }

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <DotLoading color="primary" />
        <span style={{ marginTop: 12, color: '#999', fontSize: 14 }}>加载个人信息中...</span>
      </div>
    )
  }

  const zoneName = stats?.team_stats?.zone_name || '未分配战区'
  const teamName = stats?.team_stats?.team_name || '未分配战队'
  const joinDays = stats?.user_meta?.join_days ?? 0
  const totalReports = stats?.user_meta?.total_reports ?? 0
  const reportRate = stats?.user_meta?.report_rate ?? '0.0%'

  return (
    <div className="page-content" style={{ paddingTop: 0 }}>
      {/* 用户信息头部 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1677ff, #4096ff)',
          padding: '40px 20px 30px',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderRadius: '0 0 20px 20px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 'bold',
          }}
        >
          {(user?.name || '冲')[0]}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{user?.name || '冲刺队员'}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
            {zoneName} · {teamName}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            {user?.position || '冲刺队员'} | {user?.phone || '暂无手机号'}
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          margin: '16px 0',
        }}
      >
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1677ff' }}>
            {joinDays}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>参战天数</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>
            {totalReports}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>填报次数</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#faad14' }}>
            {reportRate}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>填报率</div>
        </div>
      </div>

      {/* 功能列表 */}
      <div className="card" style={{ padding: 0 }}>
        <List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
          <List.Item
            prefix={<UserOutline style={{ fontSize: 20, color: '#1677ff' }} />}
            arrow
            onClick={() => setPersonalInfoVisible(true)}
          >
            个人信息
          </List.Item>
          <List.Item
            prefix={<ExclamationCircleOutline style={{ fontSize: 20, color: '#52c41a' }} />}
            extra={<span style={{ color: '#8c8c8c', fontSize: 13 }}>{reportsTotal} 篇</span>}
            arrow
            onClick={() => setReportsVisible(true)}
          >
            填报记录
          </List.Item>
          <List.Item
            prefix={<CalendarOutline style={{ fontSize: 20, color: '#722ed1' }} />}
            arrow
            onClick={() => navigate('/m/weekly-report')}
          >
            个人周复盘填报
          </List.Item>
          {/* 只有管理员、数字专员、目标官和战队长有权生成团队今日日报与团队周报 */}
          {['admin', 'digital_specialist', 'target_officer', 'team_leader'].includes(user?.role || '') && (
            <List.Item
              prefix={<FileOutline style={{ fontSize: 20, color: '#9f22c6' }} />}
              arrow
              onClick={handleOpenDailyReportModal}
            >
              生成今日日报
            </List.Item>
          )}
          {['admin', 'digital_specialist', 'target_officer', 'team_leader'].includes(user?.role || '') && (
            <List.Item
              prefix={<FileOutline style={{ fontSize: 20, color: '#1677ff' }} />}
              arrow
              onClick={() => navigate('/m/group-weekly-report')}
            >
              团队周报 AI 生成
            </List.Item>
          )}
          <List.Item
            prefix={<SetOutline style={{ fontSize: 20, color: '#faad14' }} />}
            arrow
            onClick={() => {
              Toast.show({ content: '修改密码功能请在管理端设置页面进行' })
            }}
          >
            修改密码
          </List.Item>
        </List>
      </div>

      {/* 退出登录 */}
      <div className="card" style={{ padding: 0, marginTop: 16 }}>
        <List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
          <List.Item
            onClick={handleLogout}
            style={{ textAlign: 'center', color: '#ff4d4f' }}
          >
            退出登录
          </List.Item>
        </List>
      </div>

      {/* 版本信息 */}
      <div style={{ textAlign: 'center', color: '#ccc', fontSize: 12, marginTop: 24 }}>
        百日奋战管理系统 v1.0.0
      </div>

      {/* ================= 个人信息名片弹窗 ================= */}
      <Popup
        visible={personalInfoVisible}
        onMaskClick={() => setPersonalInfoVisible(false)}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '60vh', maxHeight: '80vh', padding: 20, overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ fontSize: 16, fontWeight: 'bold' }}>👤 个人信息名片</span>
          <span onClick={() => setPersonalInfoVisible(false)} style={{ color: '#1677ff', fontSize: 14, cursor: 'pointer', fontWeight: 'bold' }}>关闭</span>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #e6f7ff, #bae7ff)', padding: 16, borderRadius: 12, marginBottom: 16, boxShadow: '0 4px 10px rgba(22,119,255,0.08)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0050b3' }}>{user?.name || '冲刺队员'}</div>
          <div style={{ fontSize: 12, color: '#003a8c', marginTop: 4 }}>岗位：{user?.position || '冲刺队员'}</div>
          <div style={{ fontSize: 12, color: '#003a8c', marginTop: 2 }}>手机：{user?.phone || '暂无手机号'}</div>
        </div>

        <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          <div style={{ marginBottom: 6 }}>🌐 所属战区：<strong>{zoneName}</strong></div>
          <div style={{ marginBottom: 6 }}>⚔️ 所属战队：<strong>{teamName}</strong></div>
          <div>🏢 三级巴：<strong>{user?.third_class_bar || '未分配'}</strong></div>
        </div>

        {/* 个人指标奋斗目标列表 */}
        <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10, color: '#333' }}>🎯 个人冲刺奋斗目标：</div>
        {stats?.personal_stats && stats.personal_stats.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats.personal_stats.map((item) => {
              const maxVal = Math.max(item.challenge_target, item.actual, 1)
              const rate = item.base_target > 0 ? (item.actual / item.base_target * 100) : 0
              return (
                <div key={item.goal_type} style={{ border: '1px solid #f0f0f0', padding: 10, borderRadius: 8, background: '#fdfdfd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 'bold', color: '#111' }}>
                    <span>{item.goal_name}</span>
                    <span style={{ color: '#1677ff' }}>实际：{item.actual} {item.unit}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#f5f5f5', margin: '6px 0' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(rate, 100)}%`,
                        background: 'linear-gradient(90deg, #1677ff, #00d4ff)',
                        borderRadius: 2
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c' }}>
                    <span>保底目标：{item.base_target}{item.unit}</span>
                    <span>挑战目标：{item.challenge_target}{item.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#ccc', fontSize: 12, padding: '10px 0' }}>暂无奋斗目标考核指标</div>
        )}
      </Popup>

      {/* ================= 一级弹窗：填报记录列表 ================= */}
      <Popup
        visible={reportsVisible}
        onMaskClick={() => setReportsVisible(false)}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '70vh', maxHeight: '90vh', padding: 20, overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ fontSize: 16, fontWeight: 'bold' }}>📋 历史填报明细列表</span>
          <span onClick={() => setReportsVisible(false)} style={{ color: '#1677ff', fontSize: 14, cursor: 'pointer', fontWeight: 'bold' }}>关闭</span>
        </div>

        {reportsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><DotLoading color="primary" /></div>
        ) : reportsList.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reportsList.map((item) => {
              const statusColor = item.status === 'reviewed' ? 'success' : item.status === 'rejected' ? 'danger' : 'default'
              const statusText = item.status === 'reviewed' ? '已审核' : item.status === 'rejected' ? '被驳回' : '草稿'
              
              return (
                <div
                  key={item.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #f0f0f0',
                    borderRadius: 10,
                    padding: 12,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>📅 {item.report_date}</span>
                    <Tag color={statusColor}>{statusText}</Tag>
                  </div>

                  {user?.role !== 'employee' && item.user_name && (
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                      提报人：<strong>{item.user_name}</strong>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', background: '#fafafa', padding: 8, borderRadius: 6, fontSize: 11, color: '#595959', marginBottom: 8 }}>
                    <div>💰 合同额：<span style={{ fontWeight: 'bold', color: '#111' }}>{item.contract_amount}万</span></div>
                    <div>笔数/客户数：<span style={{ fontWeight: 'bold', color: '#111' }}>{item.contract_count}个</span></div>
                    <div>🔍 有效线索：<span style={{ fontWeight: 'bold', color: '#111' }}>{item.leads_count}条</span></div>
                    <div>🤝 铁三角：<span style={{ fontWeight: 'bold', color: '#111' }}>{item.triangle_count}次</span></div>
                    <div>😊 幸福动作：<span style={{ fontWeight: 'bold', color: '#111' }}>{item.happiness_actions}次</span></div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span
                      onClick={() => {
                        setSelectedReport(item)
                        setReportDetailVisible(true)
                      }}
                      style={{ color: '#1677ff', fontSize: 12, fontWeight: 'bold', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      查看总结及动作流水 🔍
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '40px 0' }}>暂无填报记录历史流水</div>
        )}
      </Popup>

      {/* ================= 二级弹窗：日报工作总结及动作明细 ================= */}
      <Popup
        visible={reportDetailVisible}
        onMaskClick={() => {
          setReportDetailVisible(false)
          setSelectedReport(null)
        }}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '80vh', maxHeight: '90vh', padding: 20, overflowY: 'auto', zIndex: 1050 }}
      >
        {selectedReport && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 15, fontWeight: 'bold' }}>
                ⚡ 日报详情 ({selectedReport.report_date})
              </span>
              <span onClick={() => {
                setReportDetailVisible(false)
                setSelectedReport(null)
              }} style={{ color: '#1677ff', fontSize: 14, cursor: 'pointer', fontWeight: 'bold' }}>返回</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', background: '#f5f5f5', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>
              <span>提报员工：{selectedReport.user_name || user?.name}</span>
              <span>日报状态：{selectedReport.status === 'reviewed' ? '🟢 已审核' : selectedReport.status === 'rejected' ? '🔴 已驳回' : '⚪ 草稿'}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, background: '#fdfdfd' }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#1677ff', marginBottom: 4 }}>📝 今日工作总结</div>
                <div style={{ fontSize: 12, color: '#333', whiteSpace: 'pre-wrap', lineHeight: '18px' }}>
                  {selectedReport.work_summary || '未填写'}
                </div>
              </div>
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, background: '#fdfdfd' }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#1677ff', marginBottom: 4 }}>🔍 今日工作反思</div>
                <div style={{ fontSize: 12, color: '#333', whiteSpace: 'pre-wrap', lineHeight: '18px' }}>
                  {selectedReport.work_reflection || '未填写'}
                </div>
              </div>
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, background: '#fdfdfd' }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#1677ff', marginBottom: 4 }}>📅 明日工作计划</div>
                <div style={{ fontSize: 12, color: '#333', whiteSpace: 'pre-wrap', lineHeight: '18px' }}>
                  {selectedReport.next_day_plan || '未填写'}
                </div>
              </div>
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, background: '#fdfdfd' }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#1677ff', marginBottom: 4 }}>🗣️ 晨会分享/备忘</div>
                <div style={{ fontSize: 12, color: '#333', whiteSpace: 'pre-wrap', lineHeight: '18px' }}>
                  {selectedReport.standup_notes || '未填写'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10, color: '#333' }}>📋 录入动作流水记录：</div>
            {selectedReport.details && selectedReport.details.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedReport.details.map((detail: any, dIdx: number) => {
                  let typeText = '其他'
                  let typeColor = '#595959'
                  if (detail.detail_type === 'contract') { typeText = '合同新签'; typeColor = '#ff4d4f' }
                  else if (detail.detail_type === 'lead') { typeText = '有效线索'; typeColor = '#1890ff' }
                  else if (detail.detail_type === 'triangle') { typeText = '铁三角联动'; typeColor = '#722ed1' }
                  else if (detail.detail_type === 'happiness') { typeText = '客户幸福'; typeColor = '#52c41a' }

                  return (
                    <div
                      key={dIdx}
                      style={{
                        border: '1px solid #f0f0f0',
                        borderRadius: 8,
                        padding: 10,
                        background: '#f9f9f9',
                        position: 'relative'
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          fontSize: 10,
                          color: typeColor,
                          border: `1px solid ${typeColor}`,
                          padding: '1px 4px',
                          borderRadius: 4,
                          fontWeight: 'bold'
                        }}
                      >
                        {typeText}
                      </span>

                      <div style={{ fontSize: 13, fontWeight: 'bold', color: '#262626', marginBottom: 6, paddingRight: 60 }}>
                        🏢 客户：{detail.customer_name || '—'}
                      </div>

                      {detail.detail_type === 'contract' && (
                        <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>
                          新签价格：<strong style={{ color: '#ff4d4f' }}>{detail.amount} 万元</strong>
                          {detail.partner_name && detail.partner_name !== '—' && ` | 协同搭档：${detail.partner_name}`}
                        </div>
                      )}

                      {detail.detail_type === 'lead' && (
                        <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>
                          线索进度：<strong>{detail.lead_progress}</strong>
                          {detail.amount > 0 && ` | 预计金额：${detail.amount}万`}
                        </div>
                      )}

                      {detail.detail_type === 'happiness' && (
                        <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>
                          动作标准级别：<strong>{detail.happiness_level} 分</strong>
                        </div>
                      )}

                      {detail.detail_type === 'triangle' && detail.partner_name && detail.partner_name !== '—' && (
                        <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>
                          联动人：<strong>{detail.partner_name}</strong>
                        </div>
                      )}

                      {detail.description && (
                        <div style={{ fontSize: 11, color: '#8c8c8c', borderTop: '1px dashed #e8e8e8', paddingTop: 4, marginTop: 4, wordBreak: 'break-all' }}>
                          💬 播报内容：{detail.description}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#ccc', fontSize: 12, padding: '10px 0' }}>该日报无录入动作数据</div>
            )}
          </div>
        )}
      </Popup>

      {/* ================= 今日日报自动生成器弹窗 ================= */}
      <Popup
        visible={dailyReportVisible}
        onMaskClick={() => setDailyReportVisible(false)}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '80vh', maxHeight: '95vh', padding: 20, overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ fontSize: 16, fontWeight: 'bold' }}>📅 今日日报自动生成器</span>
          <span onClick={() => setDailyReportVisible(false)} style={{ color: '#1677ff', fontSize: 14, cursor: 'pointer', fontWeight: 'bold' }}>关闭</span>
        </div>

        {/* 1. 日报范围 */}
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#555', minWidth: '70px' }}>日报范围：</span>
          {['admin', 'digital_specialist'].includes(user?.role || '') ? (
            <select
              value={reportScope}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: 8,
                fontSize: 13,
                background: '#fff',
                outline: 'none',
                color: '#333'
              }}
              onChange={(e) => {
                const val = e.target.value
                const finalScope = val === 'company' ? 'company' : Number(val)
                handleGenerateDailyReport(finalScope)
              }}
            >
              <option value="company">全公司大盘</option>
              {allTeams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.teamName}
                </option>
              ))}
            </select>
          ) : (
            <Tag color="blue" style={{ fontSize: '13px', padding: '4px 10px', borderRadius: 4 }}>
              {stats?.team_stats?.team_name || '本战队'}
            </Tag>
          )}
        </div>

        {/* 2. 角色视角 */}
        <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#555' }}>角色视角：</span>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {[
              { value: 'target_officer', label: '目标官 (当晚)', disabled: reportScope === 'company' },
              { value: 'digital_specialist', label: '数字专员 (次晨)', disabled: reportScope === 'company' },
              { value: 'admin', label: '系统管理员 (大盘)', disabled: reportScope !== 'company' }
            ].map((roleOption) => {
              const isSelected = reportRole === roleOption.value
              return (
                <button
                  key={roleOption.value}
                  disabled={roleOption.disabled}
                  onClick={() => handleGenerateDailyReport(undefined, roleOption.value)}
                  style={{
                    flex: '1 0 auto',
                    padding: '6px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    border: '1px solid',
                    borderColor: roleOption.disabled ? '#f0f0f0' : isSelected ? '#1677ff' : '#d9d9d9',
                    background: roleOption.disabled ? '#f5f5f5' : isSelected ? '#e6f7ff' : '#fff',
                    color: roleOption.disabled ? '#bfbfbf' : isSelected ? '#1677ff' : '#595959',
                    fontWeight: isSelected ? 'bold' : 'normal',
                    cursor: roleOption.disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                >
                  {roleOption.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 温馨提示 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#0050b3', marginBottom: 14 }}>
          <span>ℹ️ 点击下方按钮一键复制日报文案，直接发送至群！</span>
        </div>

        {/* 3. 文本域及 Loading */}
        <div style={{ position: 'relative', border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden', background: '#fafafa', marginBottom: 20 }}>
          {dailyReportLoading && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255, 255, 255, 0.7)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
              <DotLoading color="primary" />
              <span style={{ fontSize: 11, color: '#999', marginTop: 6 }}>生成最新日报中...</span>
            </div>
          )}
          <textarea
            readOnly
            value={dailyReportText}
            placeholder="暂无日报文案，请检查筛选或重试"
            style={{
              width: '100%',
              minHeight: '260px',
              border: 'none',
              background: 'transparent',
              padding: 12,
              fontSize: 12,
              fontFamily: 'monospace',
              lineHeight: '18px',
              color: '#333',
              outline: 'none',
              boxSizing: 'border-box',
              display: 'block'
            }}
          />
        </div>

        {/* 4. 底部复制及关闭 */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setDailyReportVisible(false)}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 8,
              border: '1px solid #d9d9d9',
              background: '#fff',
              fontSize: 14,
              color: '#595959',
              cursor: 'pointer',
              fontWeight: 500,
              outline: 'none'
            }}
          >
            关闭
          </button>
          <button
            onClick={() => copyToClipboard(dailyReportText)}
            style={{
              flex: 2,
              padding: '10px 0',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #1677ff, #4096ff)',
              fontSize: 14,
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 10px rgba(22,119,255,0.2)',
              outline: 'none'
            }}
          >
            一键复制日报
          </button>
        </div>
      </Popup>
    </div>
  )
}
