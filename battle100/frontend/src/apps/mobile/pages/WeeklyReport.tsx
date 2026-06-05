/**
 * 个人周复盘填报页面 (移动端)
 * 提供本周目标计划、本周实际完成（可自动导入播报）、达成率、亮点、卡点及下周目标填报
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, TextArea, Input, Button, Toast, Card, NavBar } from 'antd-mobile'
import { LeftOutline, RightOutline, StarOutline, CalendarOutline, FileOutline } from 'antd-mobile-icons'
import { getMyWeeklyReport, saveWeeklyReport, extractWeeklyBroadcasts } from '@shared/api/report'
import { useAuthStore } from '@shared/stores/authStore'
import type { WeeklyReport as WeeklyReportType } from '@shared/types'

// 日期格式化辅助函数 YYYY-MM-DD
function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取某一日期所在周的周一
function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // 周日特殊处理
  return new Date(date.setDate(diff))
}

export default function WeeklyReport() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  
  // 维护当前周一的日期实例，默认当前日期所在周一
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()))
  
  // 计算当周周日日期
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  
  const mondayStr = formatDate(monday)
  const sundayStr = formatDate(sunday)
  
  // 周报数据状态
  const [report, setReport] = useState<Partial<WeeklyReportType>>({
    start_date: mondayStr,
    end_date: sundayStr,
    delivery_plan: '',
    sales_plan: '',
    delivery_actual: '',
    sales_actual: '',
    delivery_rate: '',
    sales_rate: '',
    delivery_highlights: '',
    sales_highlights: '',
    delivery_blockers: '',
    sales_blockers: '',
    delivery_support: '',
    sales_support: '',
    next_delivery_plan: '',
    next_sales_plan: '',
    status: 'draft'
  })
  
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 拉取当周周报数据
  const fetchWeeklyReport = async (monDate: Date) => {
    setLoading(true)
    const monStr = formatDate(monDate)
    const sunStr = formatDate(new Date(new Date(monDate).setDate(monDate.getDate() + 6)))
    
    try {
      const res = await getMyWeeklyReport(monStr)
      if (res && res.data) {
        setReport(res.data)
      } else {
        // 重置为空白模板
        setReport({
          start_date: monStr,
          end_date: sunStr,
          delivery_plan: '',
          sales_plan: '',
          delivery_actual: '',
          sales_actual: '',
          delivery_rate: '',
          sales_rate: '',
          delivery_highlights: '',
          sales_highlights: '',
          delivery_blockers: '',
          sales_blockers: '',
          delivery_support: '',
          sales_support: '',
          next_delivery_plan: '',
          next_sales_plan: '',
          status: 'draft'
        })
      }
    } catch (err) {
      // 404 表明无记录，重置为空白周报
      setReport({
        start_date: monStr,
        end_date: sunStr,
        delivery_plan: '',
        sales_plan: '',
        delivery_actual: '',
        sales_actual: '',
        delivery_rate: '',
        sales_rate: '',
        delivery_highlights: '',
        sales_highlights: '',
        delivery_blockers: '',
        sales_blockers: '',
        delivery_support: '',
        sales_support: '',
        next_delivery_plan: '',
        next_sales_plan: '',
        status: 'draft'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeeklyReport(monday)
  }, [mondayStr])

  // 切换前一周
  const handlePrevWeek = () => {
    const prev = new Date(monday)
    prev.setDate(monday.getDate() - 7)
    setMonday(prev)
  }

  // 切换后一周
  const handleNextWeek = () => {
    const next = new Date(monday)
    next.setDate(monday.getDate() + 7)
    setMonday(next)
  }

  // 一键自动从播报系统提取数据
  const handleAutoExtract = async () => {
    setExtracting(true)
    try {
      const res = await extractWeeklyBroadcasts(mondayStr)
      if (res && res.data) {
        setReport(prev => ({
          ...prev,
          delivery_actual: res.data.delivery_actual,
          sales_actual: res.data.sales_actual
        }))
        Toast.show({
          icon: 'success',
          content: '已成功提取并回填当周播报数据！'
        })
      }
    } catch (err) {
      Toast.show({
        icon: 'fail',
        content: '数据提取失败，请重试'
      })
    } finally {
      setExtracting(false)
    }
  }

  // 保存周报 (保存为草稿或提交)
  const handleSave = async (submitStatus: 'draft' | 'submitted') => {
    setSubmitting(true)
    
    // 基础校验 (若是提交，要求填报本周实际完成)
    if (submitStatus === 'submitted') {
      if (!report.delivery_actual?.trim() && !report.sales_actual?.trim()) {
        Toast.show({
          icon: 'fail',
          content: '提交时请至少填写一项实际完成工作'
        })
        setSubmitting(false)
        return
      }
    }

    try {
      const payload = {
        ...report,
        start_date: mondayStr,
        end_date: sundayStr,
        status: submitStatus
      }
      const res = await saveWeeklyReport(payload)
      if (res && res.data) {
        setReport(res.data)
        Toast.show({
          icon: 'success',
          content: submitStatus === 'submitted' ? '周复盘提交成功！' : '草稿保存成功！'
        })
        if (submitStatus === 'submitted') {
          // 提交成功后返回个人中心
          setTimeout(() => navigate('/m/profile'), 1500)
        }
      }
    } catch (err) {
      Toast.show({
        icon: 'fail',
        content: '保存失败，请检查网络后再试'
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6fa', paddingBottom: 50 }}>
      {/* 头部导航栏 */}
      <NavBar onBack={() => navigate('/m/profile')} style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #eee' }}>
        百日奋战周复盘
      </NavBar>

      {/* 周时间切换器 */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(135deg, #1890ff, #102a4c)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 12px rgba(24,144,255,0.15)'
      }}>
        <Button size='mini' fill='none' onClick={handlePrevWeek} style={{ color: '#fff', fontSize: 14 }}>
          <LeftOutline /> 上周
        </Button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>
            📅 {mondayStr.slice(5)} ~ {sundayStr.slice(5)}
          </div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
            第 {Math.ceil((monday.getTime() - new Date('2026-06-01').getTime()) / (86400000 * 7)) + 1} 周
          </div>
        </div>
        <Button size='mini' fill='none' onClick={handleNextWeek} style={{ color: '#fff', fontSize: 14 }}>
          下周 <RightOutline />
        </Button>
      </div>

      <div style={{ padding: '12px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>正在拉取周报数据...</div>
        ) : (
          <Form layout='vertical' style={{ '--background-color': 'transparent' }}>
            {/* 一键提取战报 - 炫酷横幅按钮 */}
            <div style={{ margin: '8px 0 16px 0' }}>
              <Button
                block
                loading={extracting}
                onClick={handleAutoExtract}
                style={{
                  background: 'linear-gradient(135deg, #722ed1, #3f1a68)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  height: '46px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 10px rgba(114,46,209,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✨ 依据附件2 自动拉取当周播报完成
              </Button>
            </div>

            {/* 模块一：本周目标计划 */}
            <Card title={<div style={{ display: 'flex', alignItems: 'center', color: '#1677ff', gap: 6 }}><CalendarOutline /> 1. 本周目标计划</div>} style={{ borderRadius: '12px', marginBottom: 12 }}>
              <Form.Item label='项目交付工作：（计划需要做什么项目，什么内容，到什么节点）'>
                <TextArea
                  placeholder='请输入项目交付计划...'
                  autoSize={{ minRows: 2, maxRows: 6 }}
                  value={report.delivery_plan || ''}
                  onChange={val => setReport(prev => ({ ...prev, delivery_plan: val }))}
                  style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                />
              </Form.Item>
              <Form.Item label='销售：（计划完成新签、回款、营销动作目标）'>
                <TextArea
                  placeholder='请输入销售目标计划...'
                  autoSize={{ minRows: 2, maxRows: 6 }}
                  value={report.sales_plan || ''}
                  onChange={val => setReport(prev => ({ ...prev, sales_plan: val }))}
                  style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                />
              </Form.Item>
            </Card>

            {/* 模块二：本周实际完成 */}
            <Card title={<div style={{ display: 'flex', alignItems: 'center', color: '#52c41a', gap: 6 }}><StarOutline /> 2. 本周实际完成</div>} style={{ borderRadius: '12px', marginBottom: 12 }}>
              <Form.Item label='项目交付工作：（做了什么项目，什么内容，到什么节点，幸福动作等）'>
                <TextArea
                  placeholder='请输入本周项目交付实际完成情况...'
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  value={report.delivery_actual || ''}
                  onChange={val => setReport(prev => ({ ...prev, delivery_actual: val }))}
                  style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                />
              </Form.Item>
              <Form.Item label='销售：（已签约、中标、铁三角现场联动、拜访等）'>
                <TextArea
                  placeholder='请输入本周销售实际完成情况...'
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  value={report.sales_actual || ''}
                  onChange={val => setReport(prev => ({ ...prev, sales_actual: val }))}
                  style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                />
              </Form.Item>
            </Card>

            {/* 模块三：达成情况 */}
            <Card title={<div style={{ display: 'flex', alignItems: 'center', color: '#13c2c2', gap: 6 }}><FileOutline /> 3. 指标达成率</div>} style={{ borderRadius: '12px', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Form.Item label='项目达成率 (%)'>
                    <Input
                      placeholder='例如 100%'
                      value={report.delivery_rate || ''}
                      onChange={val => setReport(prev => ({ ...prev, delivery_rate: val }))}
                      style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                    />
                  </Form.Item>
                </div>
                <div style={{ flex: 1 }}>
                  <Form.Item label='销售达成率 (%)'>
                    <Input
                      placeholder='例如 85%'
                      value={report.sales_rate || ''}
                      onChange={val => setReport(prev => ({ ...prev, sales_rate: val }))}
                      style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                    />
                  </Form.Item>
                </div>
              </div>
            </Card>

            {/* 模块四：本周亮点 */}
            <Card title='🏆 4. 本周亮点' style={{ borderRadius: '12px', marginBottom: 12 }}>
              <Form.Item label='【项目亮点】'>
                <TextArea
                  placeholder='请输入项目交付方面突出的工作成果与正反馈...'
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  value={report.delivery_highlights || ''}
                  onChange={val => setReport(prev => ({ ...prev, delivery_highlights: val }))}
                  style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                />
              </Form.Item>
              <Form.Item label='【销售亮点】'>
                <TextArea
                  placeholder='请输入新签、回款、客户突破方面的亮点...'
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  value={report.sales_highlights || ''}
                  onChange={val => setReport(prev => ({ ...prev, sales_highlights: val }))}
                  style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                />
              </Form.Item>
            </Card>

            {/* 模块五：本周卡点 */}
            <Card title='⚠️ 5. 本周卡点' style={{ borderRadius: '12px', marginBottom: 12 }}>
              <Form.Item label='【项目难点】'>
                <TextArea
                  placeholder='请输入项目推进卡点或技术堵点...'
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  value={report.delivery_blockers || ''}
                  onChange={val => setReport(prev => ({ ...prev, delivery_blockers: val }))}
                  style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                />
              </Form.Item>
              <Form.Item label='【销售难点】'>
                <TextArea
                  placeholder='请输入客情推进、合同流转或回款被拒等销售难点...'
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  value={report.sales_blockers || ''}
                  onChange={val => setReport(prev => ({ ...prev, sales_blockers: val }))}
                  style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                />
              </Form.Item>
            </Card>

            {/* 模块六：是否需要上级支持 */}
            <Card title='🤝 6. 是否需要上级支持' style={{ borderRadius: '12px', marginBottom: 12 }}>
              <Form.Item label='【项目侧支持需求】'>
                <TextArea
                  placeholder='请输入您需要的专家资源、技术援助等项目支持...'
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  value={report.delivery_support || ''}
                  onChange={val => setReport(prev => ({ ...prev, delivery_support: val }))}
                  style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                />
              </Form.Item>
              <Form.Item label='【销售侧支持需求】'>
                <TextArea
                  placeholder='请输入您需要的公司高管公关、商务条件放宽等销售支持...'
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  value={report.sales_support || ''}
                  onChange={val => setReport(prev => ({ ...prev, sales_support: val }))}
                  style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                />
              </Form.Item>
            </Card>

            {/* 模块七：下周目标 */}
            <Card title='🚀 7. 下周目标' style={{ borderRadius: '12px', marginBottom: 16 }}>
              <Form.Item label='项目交付工作：（做了什么项目，什么内容，到什么节点）'>
                <TextArea
                  placeholder='请输入下周项目交付计划...'
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  value={report.next_delivery_plan || ''}
                  onChange={val => setReport(prev => ({ ...prev, next_delivery_plan: val }))}
                  style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                />
              </Form.Item>
              <Form.Item label='销售：（新签、回款、营销动作等）'>
                <TextArea
                  placeholder='请输入下周销售目标计划...'
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  value={report.next_sales_plan || ''}
                  onChange={val => setReport(prev => ({ ...prev, next_sales_plan: val }))}
                  style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                />
              </Form.Item>
            </Card>

            {/* 状态标识和操作按钮 */}
            {report.status === 'submitted' && (
              <div style={{
                textAlign: 'center',
                padding: 12,
                color: '#52c41a',
                fontWeight: 'bold',
                backgroundColor: '#f6ffed',
                borderRadius: '8px',
                border: '1px solid #b7eb8f',
                marginBottom: 16
              }}>
                ✓ 本周复盘已提交 (锁定修改)
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                onClick={() => handleSave('draft')}
                loading={submitting}
                disabled={report.status === 'submitted'}
                style={{
                  flex: 1,
                  borderRadius: '20px',
                  height: '40px',
                  fontSize: 14,
                  backgroundColor: '#fff',
                  border: '1px solid #d9d9d9',
                  color: '#595959'
                }}
              >
                暂存为草稿
              </Button>
              <Button
                onClick={() => handleSave('submitted')}
                loading={submitting}
                disabled={report.status === 'submitted'}
                style={{
                  flex: 1.5,
                  borderRadius: '20px',
                  height: '40px',
                  fontSize: 14,
                  fontWeight: 'bold',
                  background: report.status === 'submitted' ? '#ccc' : 'linear-gradient(135deg, #1890ff, #102a4c)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 8px rgba(24,144,255,0.2)'
                }}
              >
                提交周复盘
              </Button>
            </div>
          </Form>
        )}
      </div>
    </div>
  )
}
