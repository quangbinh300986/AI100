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
            extra={<RightOutline />}
            onClick={() => setPersonalInfoVisible(true)}
          >
            个人信息
          </List.Item>
          <List.Item
            prefix={<ExclamationCircleOutline style={{ fontSize: 20, color: '#52c41a' }} />}
            extra={<span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#8c8c8c', fontSize: 13 }}>{reportsTotal} 篇 <RightOutline /></span>}
            onClick={() => setReportsVisible(true)}
          >
            我的填报记录
          </List.Item>
          <List.Item
            prefix={<SetOutline style={{ fontSize: 20, color: '#faad14' }} />}
            extra={<RightOutline />}
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
    </div>
  )
}
