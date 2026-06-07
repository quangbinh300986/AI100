import React, { useEffect, useState } from 'react'
import {
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Input,
  Form,
  Card,
  Typography,
  message,
  Select,
  Row,
  Col,
  Popconfirm,
  DatePicker,
  Descriptions,
  Checkbox,
  Tabs,
  Alert,
  Radio
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  SyncOutlined,
  FilterOutlined,
  EyeOutlined,
  FileTextOutlined,
  DownloadOutlined,
  CopyOutlined
} from '@ant-design/icons'
import { get, post, put, del } from '@shared/api/client'
import { useAuthStore } from '@shared/stores/authStore'
import dayjs from 'dayjs'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const { Text } = Typography

// 战队选项定义 (与本地数据库同步)
const TEAM_OPTIONS = [
  { label: '全部战队', value: 'all' },
  { label: '清远战队', value: '1' },
  { label: '广州一战队', value: '2' },
  { label: '广州二战队', value: '3' },
  { label: '广州三战队（大数据）', value: '4' },
  { label: '佛山战队', value: '5' },
  { label: '湛江战队', value: '6' },
  { label: '云浮战队', value: '7' },
  { label: '东莞战队', value: '8' },
  { label: '茂名战队', value: '9' },
]

const DEFAULT_TEMPLATES: Record<string, string> = {
  delivery_plan: "项目交付工作：（需要做什么项目、什么内容，到什么节点）\n1. \n2. \n3. ",
  sales_plan: "销售：（新签、回款、营销动作，新签动作包括：新签合同跟进、报价、合同入系统、营销线索等；回款动作包括：对接业主请款、申请开票、定期问询请款情况等；营销动作：获取营销线索、潜在项目分析、拜访客户等）\n1. \n2. \n3. ",
  delivery_actual: "项目交付工作：（做了什么项目，什么内容，到什么节点，幸福动作等）\n1. \n2. \n3. ",
  sales_actual: "销售：（已签约、中标、铁三角现场联动、拜访等）\n1. \n2. \n3. ",
  delivery_highlights: "【项目】\n1. \n2. ",
  sales_highlights: "【销售】\n1. \n2. ",
  delivery_blockers: "【项目难点】\n1. \n2. ",
  sales_blockers: "【销售难点】\n1. \n2. ",
  delivery_support: "项目侧：",
  sales_support: "销售侧：",
  next_delivery_plan: "项目交付工作：（做了什么项目，什么内容，到什么节点）\n1. \n2. \n3. ",
  next_sales_plan: "销售：（新签、回款、营销动作等）\n1. \n2. \n3. "
}

// 判定是否为播报无数据的兜底文本
const isDummyBroadcast = (text: string) => {
  if (!text) return true
  const clean = text.trim()
  return clean === '1. 无相关播报数据' || clean === ''
}

// 判定是否为 CRM 无数据的兜底文本
const isDummyCrmActual = (text: string, isMarketing: boolean) => {
  if (!text) return true
  const clean = text.trim()
  if (isMarketing) {
    return clean === '1. 本周暂无相关的合同新签、到账回款与客户拜访登记。' || clean === ''
  } else {
    return clean === '1. 本周名下负责的正在实施项目推进平稳，无重大子任务或里程碑完成提交。' || clean === ''
  }
}

const WeeklyReports: React.FC = () => {
  const { user } = useAuthStore()
  // 是否属于营销岗/目标官等
  const isMarketing = user?.position_type === 'marketing' || ['target_officer', 'marketing_staff', 'tech_marketing'].includes(user?.role || '');
  // 是否为全局管理权限角色
  const isGlobalUser = user?.role === 'admin' || user?.role === 'target_officer';

  // 当前活动 Tab：'report' 为员工填报周报汇总，'crm' 为 CRM 业务数据汇总
  const [activeTab, setActiveTab] = useState<'report' | 'crm'>('report')

  // CRM 业务汇总相关状态
  const [crmReports, setCrmReports] = useState<any[]>([])
  const [crmLoading, setCrmLoading] = useState(false)
  const [crmPage, setCrmPage] = useState(1)
  const [crmPageSize, setCrmPageSize] = useState(10)
  const [crmTotal, setCrmTotal] = useState(0)

  // 个人 CRM 业务详情弹窗状态
  const [crmViewVisible, setCrmViewVisible] = useState(false)
  const [viewingCrmReport, setViewingCrmReport] = useState<any>(null)

  // 三级巴筛选状态
  const [weeklyThirdBar, setWeeklyThirdBar] = useState<string>('all')
  const [thirdClassBarOptions, setThirdClassBarOptions] = useState<{ label: string; value: string }[]>([])

  // 周复盘汇总相关状态，默认当前周
  const [weeklyDate, setWeeklyDate] = useState<dayjs.Dayjs>(() => dayjs())
  // 战队筛选：非全局角色默认限制为本战队
  const [weeklyTeamId, setWeeklyTeamId] = useState<string>(
    !isGlobalUser && user?.teamId ? String(user.teamId) : 'all'
  )
  const [weeklyReports, setWeeklyReports] = useState<any[]>([])
  const [weeklyLoading, setWeeklyLoading] = useState(false)

  // 周复盘汇总表分页状态
  const [weeklyPage, setWeeklyPage] = useState(1)
  const [weeklyPageSize, setWeeklyPageSize] = useState(10)
  const [weeklyTotal, setWeeklyTotal] = useState(0)

  // 周报汇总表多选状态
  const [weeklySelectedRowKeys, setWeeklySelectedRowKeys] = useState<React.Key[]>([])

  // 是否已经填写过本周的周报状态
  const [hasMineReport, setHasMineReport] = useState(false)

  // 周报查看弹窗状态
  const [weeklyViewVisible, setWeeklyViewVisible] = useState(false)
  const [viewingWeeklyReport, setViewingWeeklyReport] = useState<any>(null)
  const isViewingMarketing = viewingWeeklyReport?.user_position_type === 'marketing' ||
    ['target_officer', 'marketing_staff', 'tech_marketing'].includes(viewingWeeklyReport?.user_role || '');

  // 周报编辑相关状态
  const [weeklyEditVisible, setWeeklyEditVisible] = useState(false)
  const [editingWeeklyReport, setEditingWeeklyReport] = useState<any>(null)
  const [weeklyEditLoading, setWeeklyEditLoading] = useState(false)
  const [weeklyEditForm] = Form.useForm()

  // 计算给定日期所在周的周一和周日 (自适应 locale)
  const getMondayAndSunday = (dateVal: dayjs.Dayjs) => {
    const day = dateVal.day()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const mon = dateVal.add(diffToMonday, 'day')
    const sun = mon.add(6, 'day')
    return [mon, sun]
  }

  // PC端个人周复盘填写相关状态
  const [weeklyWriteVisible, setWeeklyWriteVisible] = useState(false)
  const [weeklyWriteLoading, setWeeklyWriteLoading] = useState(false)
  const [weeklyExtractLoading, setWeeklyExtractLoading] = useState(false)
  const [weeklyCrmExtractLoading, setWeeklyCrmExtractLoading] = useState(false)
  const [weeklySubmitLoading, setWeeklySubmitLoading] = useState(false)
  const [weeklyStatusToSubmit, setWeeklyStatusToSubmit] = useState<'draft' | 'submitted'>('draft')
  const [weeklyForm] = Form.useForm()

  // ⚡ 智能拉取 CRM 业绩与进度预览弹窗状态
  const [crmPreviewVisible, setCrmPreviewVisible] = useState(false)
  const [crmPreviewData, setCrmPreviewData] = useState<any>(null)
  const [crmSelectedKeys, setCrmSelectedKeys] = useState<Record<string, boolean>>({
    actual: true,
    rate: true,
    highlights: true,
    blockers: true
  })

  // AI 助手智能整理状态
  const [weeklyAiOptimizing, setWeeklyAiOptimizing] = useState(false)
  const [aiOptimizeModalVisible, setAiOptimizeModalVisible] = useState(false)
  const [aiOptimizeForm] = Form.useForm()

  // ⚡ 团队（战队与三级巴）整体周报相关状态
  const [groupReportVisible, setGroupReportVisible] = useState(false)
  const [groupReportLoading, setGroupReportLoading] = useState(false)
  const [groupReportContent, setGroupReportContent] = useState('')
  const [hasSavedReport, setHasSavedReport] = useState(false)
  const [savedReportTime, setSavedReportTime] = useState('')
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit')
  const [dingSending, setDingSending] = useState(false)
  const [groupMetrics, setGroupMetrics] = useState<any>({
    marketing_signed: 0,
    delivery_signed: 0,
    win_bids: 0,
    happiness_count: 0,
    triangle_count: 0,
    valid_leads: 0,
    potential_leads: 0,
    production_value: 0,
    receive_value: 0
  })

  const [groupPdfExporting, setGroupPdfExporting] = useState(false)
  const [groupDocxExporting, setGroupDocxExporting] = useState(false)
  const [userPdfExporting, setUserPdfExporting] = useState(false)
  const [userDocxExporting, setUserDocxExporting] = useState(false)

  const handleAiOptimizeWeekly = async () => {
    const values = weeklyForm.getFieldsValue()
    const actual = isMarketing ? values.sales_actual : values.delivery_actual
    const highlights = isMarketing ? values.sales_highlights : values.delivery_highlights
    const blockers = isMarketing ? values.sales_blockers : values.delivery_blockers
    const support = isMarketing ? values.sales_support : values.delivery_support
    const next_plan = isMarketing ? values.next_sales_plan : values.next_delivery_plan

    const isActualEmpty = !actual || actual.trim() === '' || actual.includes('做了什么项目') || actual.includes('销售：（已签约')
    const isHighlightsEmpty = !highlights || highlights.trim() === '' || highlights.includes('【项目】') || highlights.includes('【销售】')
    const isBlockersEmpty = !blockers || blockers.trim() === '' || blockers.includes('项目难点') || blockers.includes('销售难点')
    const isSupportEmpty = !support || support.trim() === '' || support.includes('项目侧：') || support.includes('销售侧：')
    const isNextPlanEmpty = !next_plan || next_plan.trim() === '' || next_plan.includes('项目交付工作') || next_plan.includes('销售：（新签')

    if (isActualEmpty && isHighlightsEmpty && isBlockersEmpty && isSupportEmpty && isNextPlanEmpty) {
      message.warning('当前“本周实际完成”、“本周工作亮点”、“本周工作卡点/难点”、“需要支持”及“下周工作目标”均为空，请先填写或导入数据！')
      return
    }

    setWeeklyAiOptimizing(true)
    try {
      const res = await post<any>('/llm/agents/extractor/chat', {
        variables: {
          actual: actual || '',
          highlights: highlights || '',
          blockers: blockers || '',
          support: support || '',
          next_plan: next_plan || ''
        },
        response_format_json: true
      })
      
      const content = res?.data?.content || res?.content
      if (content) {
        aiOptimizeForm.setFieldsValue({
          actual: content.actual || '',
          highlights: content.highlights || '',
          blockers: content.blockers || '',
          support: content.support || '',
          next_plan: content.next_plan || ''
        })
        setAiOptimizeModalVisible(true)
      } else {
        message.error('AI 整理返回的数据格式不正确')
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || 'AI 智能整理失败，请重试')
    } finally {
      setWeeklyAiOptimizing(false)
    }
  }

  const handleConfirmAiOptimize = () => {
    const values = aiOptimizeForm.getFieldsValue()
    
    // 增加回写逻辑：支持项不直接覆盖原内容，若AI整理出新内容，则追加拼接在原内容后
    const oldSupport = weeklyForm.getFieldValue(isMarketing ? 'sales_support' : 'delivery_support') || ''
    const aiSupport = values.support || ''
    let finalSupport = oldSupport
    if (aiSupport.trim() && aiSupport !== '无' && aiSupport !== '暂无') {
      const cleanOld = oldSupport.trim()
      const cleanAi = aiSupport.trim()
      if (cleanOld === '项目侧：' || cleanOld === '销售侧：') {
        finalSupport = cleanAi
      } else if (cleanOld) {
        if (!cleanOld.includes(cleanAi)) {
          finalSupport = `${cleanOld}\n${cleanAi}`
        }
      } else {
        finalSupport = cleanAi
      }
    }

    if (isMarketing) {
      weeklyForm.setFieldsValue({
        sales_actual: values.actual,
        sales_highlights: values.highlights,
        sales_blockers: values.blockers,
        sales_support: finalSupport,
        next_sales_plan: values.next_plan
      })
    } else {
      weeklyForm.setFieldsValue({
        delivery_actual: values.actual,
        delivery_highlights: values.highlights,
        delivery_blockers: values.blockers,
        delivery_support: finalSupport,
        next_delivery_plan: values.next_plan
      })
    }
    setAiOptimizeModalVisible(false)
    message.success('已成功将 AI 整理优化后的内容填回周报表单！')
  }

  // 判定是否有生成团队整体周报的权限
  const allowedGroupReport = ['admin', 'target_officer', 'team_leader', 'digital_specialist'].includes(user?.role || '')

  // 获取当前所选团队名称
  const getGroupNameText = () => {
    if (weeklyThirdBar && weeklyThirdBar !== 'all') {
      return weeklyThirdBar
    }
    if (weeklyTeamId && weeklyTeamId !== 'all') {
      const opt = TEAM_OPTIONS.find(o => o.value === weeklyTeamId)
      return opt ? opt.label : ''
    }
    return ''
  }

  // 触发生成或获取团队已存整体周报
  const handleGenerateGroupReport = async () => {
    setGroupReportLoading(true)
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      let url = `/reports/weekly/group-report?start_date=${startDateStr}`
      if (weeklyTeamId && weeklyTeamId !== 'all') {
        url += `&team_id=${weeklyTeamId}`
      }
      if (weeklyThirdBar && weeklyThirdBar !== 'all') {
        url += `&third_class_bar=${encodeURIComponent(weeklyThirdBar)}`
      }
      
      try {
        const res = await get<any>(url)
        const data = res?.data ? res.data : res
        if (data && data.id) {
          setGroupReportContent(data.content)
          setGroupMetrics({
            marketing_signed: data.marketing_signed,
            delivery_signed: data.delivery_signed,
            win_bids: data.win_bids,
            happiness_count: data.happiness_count,
            triangle_count: data.triangle_count,
            valid_leads: data.valid_leads,
            potential_leads: data.potential_leads,
            production_value: data.production_value,
            receive_value: data.receive_value
          })
          setHasSavedReport(true)
          setSavedReportTime(dayjs(data.updated_at || data.created_at).format('YYYY-MM-DD HH:mm:ss'))
          setGroupReportVisible(true)
          setGroupReportLoading(false)
          return
        }
      } catch (err: any) {
        console.error("获取团队存盘周报异常:", err)
        const status = err?.response?.status || err?.status
        const detail = err?.response?.data?.detail || ''
        if (status === 404 || detail.includes('未找到该周') || detail.includes('不存在') || detail.includes('Not Found')) {
          // 若无存盘周报，直接自动调用 AI 智能生成
          await triggerAiGenerateGroupReport()
          return
        }
        throw err
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '获取团队整体周报快照失败')
    } finally {
      setGroupReportLoading(false)
    }
  }

  // 强制/重新由 AI 智能生成整体周报
  const triggerAiGenerateGroupReport = async () => {
    setGroupReportLoading(true)
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      let url = `/reports/weekly/generate-group-report?start_date=${startDateStr}`
      if (weeklyTeamId && weeklyTeamId !== 'all') {
        url += `&team_id=${weeklyTeamId}`
      }
      if (weeklyThirdBar && weeklyThirdBar !== 'all') {
        url += `&third_class_bar=${encodeURIComponent(weeklyThirdBar)}`
      }
      
      const res = await post<any>(url, {})
      const data = res?.data ? res.data : res
      if (data) {
        setGroupReportContent(data.content || '')
        setGroupMetrics(data.metrics || {
          marketing_signed: 0,
          delivery_signed: 0,
          win_bids: 0,
          happiness_count: 0,
          triangle_count: 0,
          valid_leads: 0,
          potential_leads: 0,
          production_value: 0,
          receive_value: 0
        })
        setHasSavedReport(false)
        setSavedReportTime('')
        setGroupReportVisible(true)
        message.success('AI 团队整体周报智能整理生成完毕！')
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || 'AI 生成团队周报失败，请确认该团队是否有已激活成员及相关数据')
    } finally {
      setGroupReportLoading(false)
    }
  }

  // 保存整体周报至系统数据库
  const handleSaveGroupReport = async () => {
    setGroupReportLoading(true)
    try {
      const [mon, sun] = getMondayAndSunday(weeklyDate)
      const payload = {
        team_id: weeklyTeamId !== 'all' ? parseInt(weeklyTeamId) : null,
        third_class_bar: weeklyThirdBar !== 'all' ? weeklyThirdBar : null,
        start_date: mon.format('YYYY-MM-DD'),
        end_date: sun.format('YYYY-MM-DD'),
        content: groupReportContent,
        marketing_signed: groupMetrics.marketing_signed,
        delivery_signed: groupMetrics.delivery_signed,
        win_bids: groupMetrics.win_bids,
        happiness_count: groupMetrics.happiness_count,
        triangle_count: groupMetrics.triangle_count,
        valid_leads: groupMetrics.valid_leads,
        potential_leads: groupMetrics.potential_leads,
        production_value: groupMetrics.production_value,
        receive_value: groupMetrics.receive_value
      }
      
      const res = await post<any>('/reports/weekly/save-group-report', payload)
      const data = res?.data ? res.data : res
      if (data) {
        setHasSavedReport(true)
        setSavedReportTime(dayjs(data.updated_at || data.created_at).format('YYYY-MM-DD HH:mm:ss'))
        message.success('团队整体周报及数据指标快照已成功存盘！')
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '保存团队整体周报失败')
    } finally {
      setGroupReportLoading(false)
    }
  }

  // 一键导出为 Markdown 文件
  const handleExportGroupReportFile = () => {
    try {
      const groupName = getGroupNameText()
      const [mon] = getMondayAndSunday(weeklyDate)
      const dateStr = mon.format('YYYY-MM-DD')
      const filename = `${groupName || '团队'}_${dateStr}_整体复盘周报.md`
      
      const blob = new Blob([groupReportContent], { type: 'text/markdown;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      message.success('整体周报已导出为 Markdown 文件')
    } catch (err) {
      console.error(err)
      message.error('导出文件失败')
    }
  }

  // 统一的 PDF 导出逻辑 (使用 html2canvas + jsPDF 纯前端高保真图片 PDF 分页)
  const handleExportPDF = async (elementId: string, filename: string, setLoader: (loading: boolean) => void) => {
    const element = document.getElementById(elementId)
    if (!element) {
      message.error('未找到可导出的页面节点')
      return
    }
    
    setLoader(true)
    try {
      const canvas = await html2canvas(element, {
        scale: 2, // 双倍清晰度
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0)
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0
      
      // 写入第一页
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      // 循环分页处理
      while (heightLeft > 0) {
        position -= pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      pdf.save(filename)
      message.success('PDF 战报下载成功！')
    } catch (err: any) {
      console.error('导出 PDF 异常:', err)
      message.error('导出 PDF 战报失败')
    } finally {
      setLoader(false)
    }
  }

  // 团队整体周报的 Word 导出 (调用后端 docx_exporter)
  const handleExportGroupDocx = async () => {
    const groupName = getGroupNameText()
    const [mon] = getMondayAndSunday(weeklyDate)
    const dateStr = mon.format('YYYY-MM-DD')
    const title = `${groupName || '团队'}_${dateStr}_整体复盘周报`
    
    setGroupDocxExporting(true)
    try {
      const res = await post<any>('/reports/weekly/export-docx', {
        title: title,
        metrics: groupMetrics,
        content: groupReportContent
      }, {
        responseType: 'blob'
      })
      
      const blob = res as unknown as Blob
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${title}.docx`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      message.success('Word 文档导出成功！')
    } catch (err: any) {
      console.error('导出 Word 异常:', err)
      message.error(err?.response?.data?.detail || '导出 Word 文档失败')
    } finally {
      setGroupDocxExporting(false)
    }
  }

  // 个人周报的 Word 导出 (拼接 Markdown 内容后调用后端接口)
  const handleExportUserDocx = async () => {
    if (!viewingWeeklyReport) return
    
    const isMarketingUser = viewingWeeklyReport.user_position_type === 'marketing' ||
      ['target_officer', 'marketing_staff', 'tech_marketing'].includes(viewingWeeklyReport.user_role || '')
      
    const userName = viewingWeeklyReport.user_name
    const title = `${userName}_${selectedMonday}_个人周复盘`
    
    let mdContent = ''
    mdContent += `# 🎯 本周目标计划\n${isMarketingUser ? (viewingWeeklyReport.sales_plan || '—') : (viewingWeeklyReport.delivery_plan || '—')}\n\n`
    mdContent += `# 🔥 本周实际完成\n${isMarketingUser ? (viewingWeeklyReport.sales_actual || '—') : (viewingWeeklyReport.delivery_actual || '—')}\n\n`
    mdContent += `# 📊 计划达成率说明\n${isMarketingUser ? (viewingWeeklyReport.sales_rate || '—') : (viewingWeeklyReport.delivery_rate || '—')}\n\n`
    mdContent += `# 🏆 本周工作亮点\n${isMarketingUser ? (viewingWeeklyReport.sales_highlights || '—') : (viewingWeeklyReport.delivery_highlights || '—')}\n\n`
    mdContent += `# 🚧 本周工作卡点/难点\n${isMarketingUser ? (viewingWeeklyReport.sales_blockers || '—') : (viewingWeeklyReport.delivery_blockers || '—')}\n\n`
    mdContent += `# 🤝 需要支持协调\n${isMarketingUser ? (viewingWeeklyReport.sales_support || '—') : (viewingWeeklyReport.delivery_support || '—')}\n\n`
    mdContent += `# 🚀 下周工作目标\n${isMarketingUser ? (viewingWeeklyReport.next_sales_plan || '—') : (viewingWeeklyReport.next_delivery_plan || '—')}\n`

    setUserDocxExporting(true)
    try {
      const res = await post<any>('/reports/weekly/export-docx', {
        title: title,
        metrics: null, // 个人周报不单独拼装 metrics 表
        content: mdContent
      }, {
        responseType: 'blob'
      })
      
      const blob = res as unknown as Blob
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${title}.docx`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      message.success('Word 文档导出成功！')
    } catch (err: any) {
      console.error('导出 Word 异常:', err)
      message.error(err?.response?.data?.detail || '导出 Word 文档失败')
    } finally {
      setUserDocxExporting(false)
    }
  }

  // 一键复制 Markdown 文本
  const handleCopyGroupReportText = async () => {
    try {
      await navigator.clipboard.writeText(groupReportContent)
      message.success('整体周报 Markdown 文本已复制到剪贴板')
    } catch (err) {
      console.error(err)
      message.error('浏览器拒绝了复制操作，请手动选择复制')
    }
  }

  // 一键复制并同步发送至钉钉机器人，且自动完成系统数据库存盘
  const handleCopyAndSendToDingtalk = async () => {
    let copySuccess = false
    try {
      await navigator.clipboard.writeText(groupReportContent)
      copySuccess = true
    } catch (err) {
      console.error(err)
    }

    setDingSending(true)
    const [mon, sun] = getMondayAndSunday(weeklyDate)
    const startDateStr = mon.format('YYYY-MM-DD')

    // 1. 自动存盘到系统数据库
    try {
      const savePayload = {
        team_id: weeklyTeamId !== 'all' ? parseInt(weeklyTeamId) : null,
        third_class_bar: weeklyThirdBar !== 'all' ? weeklyThirdBar : null,
        start_date: startDateStr,
        end_date: sun.format('YYYY-MM-DD'),
        content: groupReportContent,
        marketing_signed: groupMetrics.marketing_signed,
        delivery_signed: groupMetrics.delivery_signed,
        win_bids: groupMetrics.win_bids,
        happiness_count: groupMetrics.happiness_count,
        triangle_count: groupMetrics.triangle_count,
        valid_leads: groupMetrics.valid_leads,
        potential_leads: groupMetrics.potential_leads,
        production_value: groupMetrics.production_value,
        receive_value: groupMetrics.receive_value
      }
      
      const saveRes = await post<any>('/reports/weekly/save-group-report', savePayload)
      const saveData = saveRes?.data ? saveRes.data : saveRes
      if (saveData) {
        setHasSavedReport(true)
        setSavedReportTime(dayjs(saveData.updated_at || saveData.created_at).format('YYYY-MM-DD HH:mm:ss'))
      }
    } catch (err: any) {
      console.error(err)
      const errMsg = err.response?.data?.detail || '保存失败，请重试'
      if (copySuccess) {
        message.warn(`周报已复制到剪贴板，但同步存盘至系统数据库失败：${errMsg}`)
      } else {
        message.error(`同步存盘至系统数据库失败：${errMsg}`)
      }
      setDingSending(false)
      return // 若存盘失败则直接中断，不再尝试向钉钉推送
    }

    // 2. 发送到钉钉机器人
    try {
      await post('/reports/weekly/send-group-report-to-dingtalk', {
        group_name: getGroupNameText(),
        start_date: startDateStr,
        metrics: groupMetrics,
        content: groupReportContent,
        redirect_url: window.location.origin + '/admin/weekly-reports'
      })

      if (copySuccess) {
        message.success('整体周报已复制、成功存盘数据库，并已同步推送至钉钉！')
      } else {
        message.success('整体周报已成功存盘数据库并推送至钉钉！(剪贴板复制失败，请手动复制)')
      }
    } catch (err: any) {
      console.error(err)
      const errMsg = err.response?.data?.detail || '推送失败，请重试'
      if (copySuccess) {
        message.warn(`周报已复制并成功存盘至系统数据库，但同步推送至钉钉机器人失败：${errMsg}`)
      } else {
        message.warn(`周报已成功存盘至系统数据库，但同步推送至钉钉机器人失败：${errMsg}`)
      }
    } finally {
      setDingSending(false)
    }
  }

  // 动态权限校验函数 (支持系统管理员 admin 与默认配置兜底)
  const hasPermission = (perm: string) => {
    if (user?.role === 'admin') return true
    const userPerms = (user as any)?.permissions
    if (!userPerms || userPerms.length === 0) {
      if (perm === 'view_weekly_reports') {
        return true
      }
      if (perm === 'edit_weekly_report' || perm === 'delete_weekly_report') {
        return user?.role === 'admin' || user?.role === 'target_officer'
      }
      return true
    }
    return userPerms.includes(perm)
  }

  // 检查当周自己是否有填写周报记录
  const checkMyReport = async () => {
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      const res = await get<any>(`/reports/weekly/mine?start_date=${startDateStr}`)
      const data = res?.data ? res.data : res
      if (data && data.id) {
        setHasMineReport(true)
      } else {
        setHasMineReport(false)
      }
    } catch (err) {
      setHasMineReport(false)
    }
  }

  // 自动提取当周实际完成
  const handleAutoExtractWeekly = async () => {
    setWeeklyExtractLoading(true)
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      const res = await get<any>(`/reports/weekly/auto-extract?start_date=${startDateStr}`)
      const data = res?.data ? res.data : res
      if (data) {
        weeklyForm.setFieldsValue({
          delivery_actual: data.delivery_actual,
          sales_actual: data.sales_actual
        })
        message.success('已自动提取本周您的交付及销售实际数据！')
      }
    } catch (err) {
      console.error(err)
      message.error('自动提取当周播报数据失败')
    } finally {
      setWeeklyExtractLoading(false)
    }
  }

  // ⚡ 智能拉取 CRM 业绩与进度数据
  const handleAutoExtractCrmWeekly = async () => {
    setWeeklyCrmExtractLoading(true)
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      const res = await get<any>(`/reports/weekly/auto-extract-crm?start_date=${startDateStr}`)
      const data = res?.data ? res.data : res
      if (data) {
        setCrmPreviewData(data)
        // 根据获取到的数据是否为空，智能初始化勾选状态
        const actualVal = isMarketing ? data.sales_actual : data.delivery_actual
        const rateVal = isMarketing ? data.sales_rate : data.delivery_rate
        const highlightsVal = isMarketing ? data.sales_highlights : data.delivery_highlights
        const blockersVal = isMarketing ? data.sales_blockers : data.delivery_blockers

        setCrmSelectedKeys({
          actual: !!actualVal && !isDummyCrmActual(actualVal, isMarketing),
          rate: !!rateVal && rateVal !== '月度新签与回款指标正在统计中' && rateVal !== '月度指标正在统计中' && rateVal.trim() !== '',
          highlights: !!highlightsVal && highlightsVal !== '1. 本周销售签约及商务拓展平稳推进。' && highlightsVal !== '1. 交付工作处于正常开发推进中，开发交付无积压。' && highlightsVal.trim() !== '',
          blockers: !!blockersVal && blockersVal !== '1. 目前名下意向商机及收款合同暂无重大异常阻碍。' && blockersVal !== '1. 本周项目整体推进良好，暂无重大的技术难点与交付卡点。' && blockersVal.trim() !== ''
        })
        setCrmPreviewVisible(true)
      } else {
        message.warning('未拉取到任何有效的 CRM 数据')
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '智能拉取 CRM 数据失败')
    } finally {
      setWeeklyCrmExtractLoading(false)
    }
  }

  // 确认从预览中导入选中的 CRM 数据
  const handleConfirmImportCrm = () => {
    if (!crmPreviewData) return

    const currentValues = weeklyForm.getFieldsValue()
    const updateValues: Record<string, any> = {}

    // 1. 处理实际完成 (actual)
    if (crmSelectedKeys.actual) {
      if (!isMarketing) {
        const currentActual = currentValues.delivery_actual || ''
        const crmActual = crmPreviewData.delivery_actual || ''
        
        const isCurrentDummy = isDummyBroadcast(currentActual) || currentActual === (DEFAULT_TEMPLATES.delivery_actual || '')
        const isCrmDummy = isDummyCrmActual(crmActual, false)

        let combinedActual = ''
        if (!isCurrentDummy && !isCrmDummy) {
          combinedActual = `${currentActual}\n\n${crmActual}`
        } else if (!isCurrentDummy) {
          combinedActual = currentActual
        } else if (!isCrmDummy) {
          combinedActual = crmActual
        } else {
          combinedActual = crmActual || currentActual
        }
        if (combinedActual) {
          updateValues.delivery_actual = combinedActual
        }
      } else {
        const currentActual = currentValues.sales_actual || ''
        const crmActual = crmPreviewData.sales_actual || ''
        
        const isCurrentDummy = isDummyBroadcast(currentActual) || currentActual === (DEFAULT_TEMPLATES.sales_actual || '')
        const isCrmDummy = isDummyCrmActual(crmActual, true)

        let combinedActual = ''
        if (!isCurrentDummy && !isCrmDummy) {
          combinedActual = `${currentActual}\n\n${crmActual}`
        } else if (!isCurrentDummy) {
          combinedActual = currentActual
        } else if (!isCrmDummy) {
          combinedActual = crmActual
        } else {
          combinedActual = crmActual || currentActual
        }
        if (combinedActual) {
          updateValues.sales_actual = combinedActual
        }
      }
    }

    // 2. 处理计划达成率说明 (rate)
    if (crmSelectedKeys.rate) {
      const key = isMarketing ? 'sales_rate' : 'delivery_rate'
      if (crmPreviewData[key] !== undefined && crmPreviewData[key] !== null && crmPreviewData[key] !== '') {
        updateValues[key] = crmPreviewData[key]
      }
    }

    // 3. 处理工作亮点 (highlights)
    if (crmSelectedKeys.highlights) {
      const key = isMarketing ? 'sales_highlights' : 'delivery_highlights'
      if (crmPreviewData[key] !== undefined && crmPreviewData[key] !== null && crmPreviewData[key] !== '') {
        updateValues[key] = crmPreviewData[key]
      }
    }

    // 4. 处理工作卡点/难点 (blockers)
    if (crmSelectedKeys.blockers) {
      const key = isMarketing ? 'sales_blockers' : 'delivery_blockers'
      if (crmPreviewData[key] !== undefined && crmPreviewData[key] !== null && crmPreviewData[key] !== '') {
        updateValues[key] = crmPreviewData[key]
      }
    }

    weeklyForm.setFieldsValue(updateValues)
    message.success('已成功将选中的 CRM 业绩与进度数据填入您的周报！')
    setCrmPreviewVisible(false)
  }

  // 打开填写 Modal 并加载已有周报
  const openWeeklyWriteModal = async () => {
    setWeeklyWriteVisible(true)
    setWeeklyWriteLoading(true)
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      weeklyForm.resetFields()
      
      let data: any = null
      try {
        const res = await get<any>(`/reports/weekly/mine?start_date=${startDateStr}`)
        data = res?.data ? res.data : res
      } catch (err: any) {
        if (err?.response?.status === 404) {
          console.log('该周尚未填写周报')
        } else {
          message.error('拉取历史周报失败')
        }
      }
      
      const formValues: Record<string, any> = {}
      const fields = [
        'delivery_plan', 'sales_plan',
        'delivery_actual', 'sales_actual',
        'delivery_rate', 'sales_rate',
        'delivery_highlights', 'sales_highlights',
        'delivery_blockers', 'sales_blockers',
        'delivery_support', 'sales_support',
        'next_delivery_plan', 'next_sales_plan'
      ]
      
      fields.forEach(field => {
        const val = data ? data[field] : null
        if (val !== null && val !== undefined && val !== '') {
          formValues[field] = val
        } else {
          formValues[field] = DEFAULT_TEMPLATES[field] || ''
        }
      })
      weeklyForm.setFieldsValue(formValues)
    } finally {
      setWeeklyWriteLoading(false)
    }
  }

  // 提交/暂存周报
  const handleWeeklySubmit = async (values: any) => {
    setWeeklySubmitLoading(true)
    try {
      const [mon, sun] = getMondayAndSunday(weeklyDate)
      const payload = {
        ...values,
        start_date: mon.format('YYYY-MM-DD'),
        end_date: sun.format('YYYY-MM-DD'),
        status: weeklyStatusToSubmit
      }
      const res = await post<any>('/reports/weekly', payload)
      if (res) {
        message.success(weeklyStatusToSubmit === 'draft' ? '周复盘草稿已暂存' : '周复盘已正式提交')
        setWeeklyWriteVisible(false)
        loadWeeklyReports() // 刷新汇总大表
        checkMyReport() // 刷新自己周报填报的状态
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '保存周报失败')
    } finally {
      setWeeklySubmitLoading(false)
    }
  }

  // 加载选定战队与选定周一的周复盘汇总
  const loadWeeklyReports = async () => {
    setWeeklyLoading(true)
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      
      let url = `/reports/weekly/summary?start_date=${startDateStr}&page=${weeklyPage}&page_size=${weeklyPageSize}`
      // 如果是非全局角色，强制传递自身的 teamId 进行校验
      const targetTeamId = !isGlobalUser && user?.teamId ? String(user.teamId) : weeklyTeamId;
      if (targetTeamId && targetTeamId !== 'all') {
        url += `&team_id=${targetTeamId}`
      }
      if (weeklyThirdBar && weeklyThirdBar !== 'all') {
        url += `&third_class_bar=${encodeURIComponent(weeklyThirdBar)}`
      }
      
      const res = await get<any>(url)
      const data = res?.data ? res.data : res
      if (data && data.items) {
        setWeeklyReports(data.items)
        setWeeklyTotal(data.total || 0)
      } else {
        setWeeklyReports([])
        setWeeklyTotal(0)
      }
    } catch (err) {
      console.error(err)
      message.error('加载周复盘汇总表失败')
      setWeeklyReports([])
      setWeeklyTotal(0)
    } finally {
      setWeeklyLoading(false)
    }
  }

  // 删除单条周报
  const handleWeeklyDelete = async (id: number) => {
    try {
      const res = await del<any>(`/reports/weekly/${id}`)
      if (res) {
        message.success('周报删除成功')
        loadWeeklyReports()
        checkMyReport()
        setWeeklySelectedRowKeys(prev => prev.filter(k => k !== id))
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '删除周报失败')
    }
  }

  // 批量删除周报
  const handleWeeklyBatchDelete = async () => {
    if (weeklySelectedRowKeys.length === 0) return
    try {
      const res = await post<any>('/reports/weekly/batch-delete', {
        ids: weeklySelectedRowKeys
      })
      if (res) {
        message.success(`成功批量删除 ${weeklySelectedRowKeys.length} 条周报`)
        setWeeklySelectedRowKeys([])
        loadWeeklyReports()
        checkMyReport()
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '批量删除周报失败')
    }
  }

  // 打开编辑周报弹窗
  const openWeeklyEditModal = (record: any) => {
    setEditingWeeklyReport(record)
    setWeeklyEditVisible(true)
    weeklyEditForm.resetFields()
    weeklyEditForm.setFieldsValue({
      delivery_plan: record.delivery_plan || '',
      sales_plan: record.sales_plan || '',
      delivery_actual: record.delivery_actual || '',
      sales_actual: record.sales_actual || '',
      delivery_rate: record.delivery_rate || '',
      sales_rate: record.sales_rate || '',
      delivery_highlights: record.delivery_highlights || '',
      sales_highlights: record.sales_highlights || '',
      delivery_blockers: record.delivery_blockers || '',
      sales_blockers: record.sales_blockers || '',
      delivery_support: record.delivery_support || '',
      sales_support: record.sales_support || '',
      next_delivery_plan: record.next_delivery_plan || '',
      next_sales_plan: record.next_sales_plan || ''
    })
  }

  // 打开查看详情弹窗
  const openWeeklyViewModal = (record: any) => {
    setViewingWeeklyReport(record)
    setWeeklyViewVisible(true)
  }

  // 提交修改他人的周报
  const handleWeeklyEditSubmit = async (values: any) => {
    if (!editingWeeklyReport) return
    setWeeklyEditLoading(true)
    try {
      const res = await put<any>(`/reports/weekly/${editingWeeklyReport.id}`, {
        ...values,
        status: editingWeeklyReport.status // 保持周报原有状态(draft/submitted)
      })
      if (res) {
        message.success('已成功保存修改后的周报')
        setWeeklyEditVisible(false)
        loadWeeklyReports()
        checkMyReport()
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '修改周报失败')
    } finally {
      setWeeklyEditLoading(false)
    }
  }

  // 加载选定战队与选定周一的 CRM 业务数据汇总
  const loadCrmReports = async () => {
    setCrmLoading(true)
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      
      let url = `/reports/weekly/crm-summary?start_date=${startDateStr}&page=${crmPage}&page_size=${crmPageSize}`
      // 如果是非全局角色，强制传递自身的 teamId 进行校验
      const targetTeamId = !isGlobalUser && user?.teamId ? String(user.teamId) : weeklyTeamId;
      if (targetTeamId && targetTeamId !== 'all') {
        url += `&team_id=${targetTeamId}`
      }
      if (weeklyThirdBar && weeklyThirdBar !== 'all') {
        url += `&third_class_bar=${encodeURIComponent(weeklyThirdBar)}`
      }
      
      const res = await get<any>(url)
      const data = res?.data ? res.data : res
      if (data && data.items) {
        setCrmReports(data.items)
        setCrmTotal(data.total || 0)
      } else {
        setCrmReports([])
        setCrmTotal(0)
      }
    } catch (err) {
      console.error(err)
      message.error('加载 CRM 业务数据汇总失败')
      setCrmReports([])
      setCrmTotal(0)
    } finally {
      setCrmLoading(false)
    }
  }

  // 加载系统所有的三级巴选项
  const loadThirdClassBars = async () => {
    try {
      const res = await get<string[]>('/users/third-class-bars')
      if (res) {
        const opts = [
          { label: '全部三级巴', value: 'all' },
          ...res.map((bar: string) => ({ label: bar, value: bar }))
        ]
        setThirdClassBarOptions(opts)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // 打开 CRM 查看详情 Modal
  const openCrmViewModal = (record: any) => {
    setViewingCrmReport(record)
    setCrmViewVisible(true)
  }

  useEffect(() => {
    loadThirdClassBars()
  }, [])

  useEffect(() => {
    if (activeTab === 'report') {
      loadWeeklyReports()
    } else {
      loadCrmReports()
    }
  }, [activeTab, weeklyDate, weeklyTeamId, weeklyThirdBar, weeklyPage, weeklyPageSize, crmPage, crmPageSize])

  useEffect(() => {
    checkMyReport()
  }, [weeklyDate])

  const [mon, sun] = getMondayAndSunday(weeklyDate)
  const selectedMonday = mon.format('YYYY-MM-DD')
  const selectedSunday = sun.format('YYYY-MM-DD')

  const weeklyColumns = [
    {
      title: '成员姓名',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 100,
      fixed: 'left' as const,
      align: 'center' as const,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '本周目标计划',
      children: [
        {
          title: '项目交付计划',
          dataIndex: 'delivery_plan',
          key: 'delivery_plan',
          width: 220,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
        {
          title: '销售计划',
          dataIndex: 'sales_plan',
          key: 'sales_plan',
          width: 220,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
      ],
    },
    {
      title: '本周实际完成',
      children: [
        {
          title: '项目交付实际',
          dataIndex: 'delivery_actual',
          key: 'delivery_actual',
          width: 250,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
        {
          title: '销售实际完成',
          dataIndex: 'sales_actual',
          key: 'sales_actual',
          width: 250,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
      ],
    },
    {
      title: '达成情况',
      children: [
        {
          title: '项目达成率',
          dataIndex: 'delivery_rate',
          key: 'delivery_rate',
          width: 110,
          align: 'center' as const,
          render: (text: string) => text ? (
            <Tag color="blue" style={{ maxWidth: '100%', display: 'inline-flex', alignItems: 'center' }}>
              <Text ellipsis={{ tooltip: text }} style={{ color: 'inherit', fontSize: 'inherit' }}>
                {text}
              </Text>
            </Tag>
          ) : '—',
        },
        {
          title: '销售达成率',
          dataIndex: 'sales_rate',
          key: 'sales_rate',
          width: 110,
          align: 'center' as const,
          render: (text: string) => text ? (
            <Tag color="geekblue" style={{ maxWidth: '100%', display: 'inline-flex', alignItems: 'center' }}>
              <Text ellipsis={{ tooltip: text }} style={{ color: 'inherit', fontSize: 'inherit' }}>
                {text}
              </Text>
            </Tag>
          ) : '—',
        },
      ],
    },
    {
      title: '本周亮点',
      children: [
        {
          title: '项目亮点',
          dataIndex: 'delivery_highlights',
          key: 'delivery_highlights',
          width: 200,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
        {
          title: '销售亮点',
          dataIndex: 'sales_highlights',
          key: 'sales_highlights',
          width: 200,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
      ],
    },
    {
      title: '本周卡点',
      children: [
        {
          title: '项目难点',
          dataIndex: 'delivery_blockers',
          key: 'delivery_blockers',
          width: 200,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
        {
          title: '销售难点',
          dataIndex: 'sales_blockers',
          key: 'sales_blockers',
          width: 200,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
      ],
    },
    {
      title: '支持协调需求',
      children: [
        {
          title: '项目侧',
          dataIndex: 'delivery_support',
          key: 'delivery_support',
          width: 180,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
        {
          title: '销售侧',
          dataIndex: 'sales_support',
          key: 'sales_support',
          width: 180,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
      ],
    },
    {
      title: '下周计划目标',
      children: [
        {
          title: '项目交付计划',
          dataIndex: 'next_delivery_plan',
          key: 'next_delivery_plan',
          width: 200,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
        {
          title: '销售计划',
          dataIndex: 'next_sales_plan',
          key: 'next_sales_plan',
          width: 200,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
      ],
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (status: string) => {
        return status === 'submitted' ? (
          <Tag color="success">已提交</Tag>
        ) : (
          <Tag color="default">草稿</Tag>
        )
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 170, // 增加宽度容纳查看按钮
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, record: any) => {
        const isOwn = record.user_id === user?.id
        // 拥有编辑权限或本人
        const canEdit = isOwn || hasPermission('edit_weekly_report')
        // 拥有删除权限或本人
        const canDelete = isOwn || hasPermission('delete_weekly_report')
        
        return (
          <Space size="small">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openWeeklyViewModal(record)} style={{ padding: 0 }}>
              查看
            </Button>
            {canEdit && (
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openWeeklyEditModal(record)} style={{ padding: 0 }}>
                编辑
              </Button>
            )}
            {canDelete && (
              <Popconfirm
                title="确定要删除该条周报吗？"
                onConfirm={() => handleWeeklyDelete(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" danger size="small" icon={<DeleteOutlined />} style={{ padding: 0 }}>
                  删除
                </Button>
              </Popconfirm>
            )}
            {!canEdit && !canDelete && '—'}
          </Space>
        )
      }
    }
  ]

  const crmColumns = [
    {
      title: '成员姓名',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 100,
      fixed: 'left' as const,
      align: 'center' as const,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '三级巴',
      dataIndex: 'third_class_bar',
      key: 'third_class_bar',
      width: 150,
      render: (text: string) => text || '—',
    },
    {
      title: '归属战队',
      dataIndex: 'team_name',
      key: 'team_name',
      width: 130,
      render: (text: string) => text || '—',
    },
    {
      title: 'CRM 业务完成情况',
      children: [
        {
          title: '项目交付实际 (负责在研/里程碑)',
          dataIndex: 'delivery_actual',
          key: 'delivery_actual',
          width: 300,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
        {
          title: '销售实际完成 (合同/回款/客户拜访)',
          dataIndex: 'sales_actual',
          key: 'sales_actual',
          width: 300,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
      ],
    },
    {
      title: '达成情况',
      children: [
        {
          title: '项目达成率说明',
          dataIndex: 'delivery_rate',
          key: 'delivery_rate',
          width: 130,
          render: (text: string) => text ? (
            <Tag color="cyan" style={{ maxWidth: '100%', display: 'inline-flex', alignItems: 'center' }}>
              <Text ellipsis={{ tooltip: text }} style={{ color: 'inherit', fontSize: 'inherit' }}>
                {text}
              </Text>
            </Tag>
          ) : '—',
        },
        {
          title: '销售达成率说明',
          dataIndex: 'sales_rate',
          key: 'sales_rate',
          width: 130,
          render: (text: string) => text ? (
            <Tag color="purple" style={{ maxWidth: '100%', display: 'inline-flex', alignItems: 'center' }}>
              <Text ellipsis={{ tooltip: text }} style={{ color: 'inherit', fontSize: 'inherit' }}>
                {text}
              </Text>
            </Tag>
          ) : '—',
        },
      ],
    },
    {
      title: '工作亮点',
      children: [
        {
          title: '项目亮点 (自动诊断)',
          dataIndex: 'delivery_highlights',
          key: 'delivery_highlights',
          width: 250,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
        {
          title: '销售亮点 (自动诊断)',
          dataIndex: 'sales_highlights',
          key: 'sales_highlights',
          width: 250,
          render: (text: string) => (
            <Text ellipsis={{ tooltip: text }}>{text || '—'}</Text>
          ),
        },
      ],
    },
    {
      title: '异常与卡点预警',
      children: [
        {
          title: '项目难点 (预设立/超期/未开票/未到账)',
          dataIndex: 'delivery_blockers',
          key: 'delivery_blockers',
          width: 400,
          render: (text: string) => {
            if (!text) return '—';
            // 判断是否具有严重问题的警示关键字，如预设立未签、开票未到账、到期未开票
            const isWarning = text.includes('预设立预警') || text.includes('未开发票') || text.includes('未回款') || text.includes('交付卡点') || text.includes('收付款触发节点') || text.includes('未回款到账');
            return (
              <div style={{ color: isWarning ? '#ff4d4f' : 'inherit', fontWeight: isWarning ? '500' : 'normal' }}>
                <Text ellipsis={{ tooltip: text }} style={{ color: isWarning ? '#ff4d4f' : 'inherit' }}>
                  {text}
                </Text>
              </div>
            );
          },
        },
        {
          title: '销售难点 (项目终止/商务阻碍)',
          dataIndex: 'sales_blockers',
          key: 'sales_blockers',
          width: 250,
          render: (text: string) => {
            if (!text) return '—';
            const isWarning = text.includes('中止') || text.includes('预警') || text.includes('阻碍');
            return (
              <div style={{ color: isWarning ? '#faad14' : 'inherit', fontWeight: isWarning ? '500' : 'normal' }}>
                <Text ellipsis={{ tooltip: text }} style={{ color: isWarning ? '#faad14' : 'inherit' }}>
                  {text}
                </Text>
              </div>
            );
          },
        },
      ],
    },
    {
      title: '操作',
      key: 'action',
      width: 110,
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openCrmViewModal(record)}>
          查看 CRM
        </Button>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', minHeight: '70vh' }}>
        {/* 筛选项 */}
        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <Space>
              <FilterOutlined style={{ color: '#1890ff' }} />
              <strong>汇总过滤：</strong>
            </Space>
          </Col>
          <Col xs={24} sm={8} md={6}>
            <DatePicker
              picker="week"
              placeholder="选择填报周"
              style={{ width: '100%' }}
              value={weeklyDate}
              onChange={(val) => {
                if (val) {
                  setWeeklyDate(val)
                }
              }}
              allowClear={false}
            />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Select
              style={{ width: '100%' }}
              placeholder="按战队/小组筛选"
              value={weeklyTeamId}
              onChange={(val) => {
                setWeeklyTeamId(val)
              }}
              disabled={!isGlobalUser} // 只有管理员/目标官允许切换战队，非全局角色被锁定
              options={TEAM_OPTIONS}
            />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Select
              style={{ width: '100%' }}
              placeholder="按三级巴筛选"
              value={weeklyThirdBar}
              onChange={(val) => {
                setWeeklyThirdBar(val)
              }}
              options={thirdClassBarOptions}
            />
          </Col>
          <Col>
            <Space>
              {activeTab === 'report' && weeklySelectedRowKeys.length > 0 && hasPermission('delete_weekly_report') && (
                <Popconfirm
                  title={`确定要删除选中的 ${weeklySelectedRowKeys.length} 条周报吗？`}
                  onConfirm={handleWeeklyBatchDelete}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button type="primary" danger icon={<DeleteOutlined />}>
                    批量删除 ({weeklySelectedRowKeys.length})
                  </Button>
                </Popconfirm>
              )}
              <Button
                type="primary"
                onClick={activeTab === 'report' ? loadWeeklyReports : loadCrmReports}
                icon={<SyncOutlined />}
              >
                刷新周汇总
              </Button>
              {activeTab === 'report' && (
                <Button
                  type="primary"
                  ghost
                  icon={<EditOutlined />}
                  onClick={openWeeklyWriteModal}
                >
                  {hasMineReport ? '修改我的周报' : '填写我的周报'}
                </Button>
              )}
              {allowedGroupReport && (
                <Button
                  type="primary"
                  style={{
                    backgroundColor: weeklyTeamId === 'all' && weeklyThirdBar === 'all' ? undefined : '#13c2c2',
                    borderColor: weeklyTeamId === 'all' && weeklyThirdBar === 'all' ? undefined : '#13c2c2',
                    color: weeklyTeamId === 'all' && weeklyThirdBar === 'all' ? undefined : '#fff'
                  }}
                  disabled={weeklyTeamId === 'all' && weeklyThirdBar === 'all'}
                  icon={<FileTextOutlined />}
                  loading={groupReportLoading}
                  onClick={handleGenerateGroupReport}
                >
                  生成【{getGroupNameText() || '未选'}】整体周报
                </Button>
              )}
            </Space>
          </Col>
          <Col style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 13, color: '#8c8c8c' }}>
              当前检索周范围：<strong>{selectedMonday} ~ {selectedSunday}</strong>
            </span>
          </Col>
        </Row>

        {/* 双维度汇总 Tabs */}
        <Tabs
          type="card"
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'report' | 'crm')}
          style={{ marginBottom: 16 }}
          items={[
            {
              key: 'report',
              label: <span style={{ fontSize: '14px', fontWeight: 'bold' }}>📝 个人周复盘填报汇总</span>,
              children: (
                <Table
                  dataSource={weeklyReports}
                  columns={weeklyColumns}
                  loading={weeklyLoading}
                  rowKey="id"
                  bordered
                  rowSelection={{
                    selectedRowKeys: weeklySelectedRowKeys,
                    onChange: (keys: React.Key[]) => setWeeklySelectedRowKeys(keys)
                  }}
                  pagination={{
                    current: weeklyPage,
                    pageSize: weeklyPageSize,
                    total: weeklyTotal,
                    onChange: (p, ps) => {
                      setWeeklyPage(p)
                      setWeeklyPageSize(ps)
                    },
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条数据`
                  }}
                  scroll={{ x: 3100 }}
                  locale={{ emptyText: '该周内此小组/战队暂无提交的周复盘数据' }}
                />
              )
            },
            {
              key: 'crm',
              label: <span style={{ fontSize: '14px', fontWeight: 'bold' }}>⚡ CRM 业务数据智能汇总</span>,
              children: (
                <Table
                  dataSource={crmReports}
                  columns={crmColumns}
                  loading={crmLoading}
                  rowKey="user_id"
                  bordered
                  pagination={{
                    current: crmPage,
                    pageSize: crmPageSize,
                    total: crmTotal,
                    onChange: (p, ps) => {
                      setCrmPage(p)
                      setCrmPageSize(ps)
                    },
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条数据`
                  }}
                  scroll={{ x: 2500 }}
                  locale={{ emptyText: '该周内此小组/战队暂无匹配的 CRM 业务数据' }}
                />
              )
            }
          ]}
        />

        {/* 周报只读查看Modal弹窗 */}
        <Modal
          title={<strong>🔍 查看员工周复盘详情（周范围：{selectedMonday} ~ {selectedSunday} - 成员：{viewingWeeklyReport?.user_name}）</strong>}
          open={weeklyViewVisible}
          onCancel={() => setWeeklyViewVisible(false)}
          footer={[
            <Button
              key="export-pdf"
              icon={<DownloadOutlined />}
              loading={userPdfExporting}
              onClick={() => handleExportPDF('user-report-pdf-export-temp', `${viewingWeeklyReport?.user_name}_${selectedMonday}_个人周复盘.pdf`, setUserPdfExporting)}
            >
              导出PDF
            </Button>,
            <Button
              key="export-docx"
              icon={<DownloadOutlined />}
              loading={userDocxExporting}
              onClick={handleExportUserDocx}
            >
              导出Word
            </Button>,
            <Button key="close" type="primary" onClick={() => setWeeklyViewVisible(false)}>
              关闭
            </Button>
          ]}
          width={800}
          centered
          destroyOnHidden
        >
          {viewingWeeklyReport && (
            <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '8px' }}>
              <div id="user-report-modal-content" style={{ padding: '16px', backgroundColor: '#ffffff' }}>
                <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="成员姓名"><strong>{viewingWeeklyReport.user_name}</strong></Descriptions.Item>
                <Descriptions.Item label="岗位类别">
                  <Tag color="cyan">
                    {viewingWeeklyReport.user_position_type === 'marketing' ? '营销岗' : '交付及其他'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="填报状态">
                  {viewingWeeklyReport.status === 'submitted' ? (
                    <Tag color="success">已提交</Tag>
                  ) : (
                    <Tag color="default">草稿</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="提交时间">
                  {viewingWeeklyReport.submitted_at 
                    ? dayjs(viewingWeeklyReport.submitted_at).format('YYYY-MM-DD HH:mm:ss')
                    : '—'}
                </Descriptions.Item>
              </Descriptions>

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>🎯 本周目标计划</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                {!isViewingMarketing && (
                  <Col span={24}>
                    <Card title="项目交付计划" size="small" headStyle={{ background: '#f5f5f5' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 60 }}>{viewingWeeklyReport.delivery_plan || '—'}</div>
                    </Card>
                  </Col>
                )}
                {isViewingMarketing && (
                  <Col span={24}>
                    <Card title="销售计划" size="small" headStyle={{ background: '#f5f5f5' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 60 }}>{viewingWeeklyReport.sales_plan || '—'}</div>
                    </Card>
                  </Col>
                )}
              </Row>

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>🔥 本周实际完成</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                {!isViewingMarketing && (
                  <Col span={24}>
                    <Card title="项目交付实际" size="small" headStyle={{ background: '#f6ffed' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 80 }}>{viewingWeeklyReport.delivery_actual || '—'}</div>
                    </Card>
                  </Col>
                )}
                {isViewingMarketing && (
                  <Col span={24}>
                    <Card title="销售实际完成" size="small" headStyle={{ background: '#f6ffed' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 80 }}>{viewingWeeklyReport.sales_actual || '—'}</div>
                    </Card>
                  </Col>
                )}
              </Row>

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>📊 计划达成率说明</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                {!isViewingMarketing && (
                  <Col span={24}>
                    <Card title="项目达成率" size="small" headStyle={{ background: '#e6f7ff' }}>
                      <div><strong>{viewingWeeklyReport.delivery_rate || '—'}</strong></div>
                    </Card>
                  </Col>
                )}
                {isViewingMarketing && (
                  <Col span={24}>
                    <Card title="销售达成率" size="small" headStyle={{ background: '#e6f7ff' }}>
                      <div><strong>{viewingWeeklyReport.sales_rate || '—'}</strong></div>
                    </Card>
                  </Col>
                )}
              </Row>

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>🏆 本周工作亮点</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                {!isViewingMarketing && (
                  <Col span={24}>
                    <Card title="项目亮点" size="small" headStyle={{ background: '#fffb8f' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingWeeklyReport.delivery_highlights || '—'}</div>
                    </Card>
                  </Col>
                )}
                {isViewingMarketing && (
                  <Col span={24}>
                    <Card title="销售亮点" size="small" headStyle={{ background: '#fffb8f' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingWeeklyReport.sales_highlights || '—'}</div>
                    </Card>
                  </Col>
                )}
              </Row>

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>🚧 本周工作卡点/难点</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                {!isViewingMarketing && (
                  <Col span={24}>
                    <Card title="项目难点" size="small" headStyle={{ background: '#fff2e8' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingWeeklyReport.delivery_blockers || '—'}</div>
                    </Card>
                  </Col>
                )}
                {isViewingMarketing && (
                  <Col span={24}>
                    <Card title="销售难点" size="small" headStyle={{ background: '#fff2e8' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingWeeklyReport.sales_blockers || '—'}</div>
                    </Card>
                  </Col>
                )}
              </Row>

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>🤝 需要支持协调</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                {!isViewingMarketing && (
                  <Col span={24}>
                    <Card title="项目侧" size="small" headStyle={{ background: '#feffe6' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingWeeklyReport.delivery_support || '—'}</div>
                    </Card>
                  </Col>
                )}
                {isViewingMarketing && (
                  <Col span={24}>
                    <Card title="销售侧" size="small" headStyle={{ background: '#feffe6' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingWeeklyReport.sales_support || '—'}</div>
                    </Card>
                  </Col>
                )}
              </Row>

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>🚀 下周工作目标</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                {!isViewingMarketing && (
                  <Col span={24}>
                    <Card title="项目交付计划" size="small" headStyle={{ background: '#f5f5f5' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 60 }}>{viewingWeeklyReport.next_delivery_plan || '—'}</div>
                    </Card>
                  </Col>
                )}
                {isViewingMarketing && (
                  <Col span={24}>
                    <Card title="销售计划" size="small" headStyle={{ background: '#f5f5f5' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 60 }}>{viewingWeeklyReport.next_sales_plan || '—'}</div>
                    </Card>
                  </Col>
                )}
              </Row>
              </div>
            </div>
          )}
        </Modal>

        {/* 成员 CRM 业务详情 Modal */}
        <Modal
          title={<strong>🔍 查看成员 CRM 业务实时汇总（成员：{viewingCrmReport?.user_name} - 周范围：{selectedMonday} ~ {selectedSunday}）</strong>}
          open={crmViewVisible}
          onCancel={() => setCrmViewVisible(false)}
          footer={[
            <Button key="close" type="primary" onClick={() => setCrmViewVisible(false)}>
              关闭
            </Button>
          ]}
          width={800}
          centered
          destroyOnHidden
        >
          {viewingCrmReport && (
            <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '8px' }}>
              <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="成员姓名"><strong>{viewingCrmReport.user_name}</strong></Descriptions.Item>
                <Descriptions.Item label="岗位类别">
                  <Tag color={viewingCrmReport.position_type === 'marketing' ? 'blue' : 'green'}>
                    {viewingCrmReport.position_type === 'marketing' ? '营销岗' : '交付及其他'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="三级巴">
                  {viewingCrmReport.third_class_bar || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="归属战队">
                  {viewingCrmReport.team_name || '—'}
                </Descriptions.Item>
              </Descriptions>

              {/* 区分营销岗位与交付岗位 */}
              {viewingCrmReport.position_type === 'marketing' ? (
                <>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#722ed1' }}>🔥 当周销售实际完成 (CRM)</div>
                  <Card size="small" style={{ marginBottom: 16 }} headStyle={{ background: '#f6ffed' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 80, fontFamily: 'monospace' }}>{viewingCrmReport.sales_actual || '暂无数据'}</div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#722ed1' }}>📈 月度指标达成率 (CRM)</div>
                  <Card size="small" style={{ marginBottom: 16 }} headStyle={{ background: '#e6f7ff' }}>
                    <div><strong>{viewingCrmReport.sales_rate || '暂无统计指标'}</strong></div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#722ed1' }}>✨ 当周工作亮点 (CRM 诊断)</div>
                  <Card size="small" style={{ marginBottom: 16 }} headStyle={{ background: '#fffb8f' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingCrmReport.sales_highlights || '正常无大额签约/高频客户动作'}</div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#722ed1' }}>⚠️ 销售卡点与异常预警 (CRM 异常)</div>
                  <Card size="small" style={{ marginBottom: 16, border: '1px solid #ffe58f' }} headStyle={{ background: '#fffbe6' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 50, color: viewingCrmReport.sales_blockers?.includes('1. 目前') ? 'inherit' : '#d46b08' }}>{viewingCrmReport.sales_blockers || '无异常'}</div>
                  </Card>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>🔥 当周项目交付实际 (CRM)</div>
                  <Card size="small" style={{ marginBottom: 16 }} headStyle={{ background: '#f6ffed' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 80, fontFamily: 'monospace' }}>{viewingCrmReport.delivery_actual || '暂无数据'}</div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>📈 月度指标达成率 (CRM)</div>
                  <Card size="small" style={{ marginBottom: 16 }} headStyle={{ background: '#e6f7ff' }}>
                    <div><strong>{viewingCrmReport.delivery_rate || '暂无统计指标'}</strong></div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>✨ 当周工作亮点 (CRM 诊断)</div>
                  <Card size="small" style={{ marginBottom: 16 }} headStyle={{ background: '#fffb8f' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingCrmReport.delivery_highlights || '开发交付无积压'}</div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>⚠️ 项目卡点与异常预警 (包含预设立、已到节点未开票、已开票未回款等)</div>
                  <Card size="small" style={{ marginBottom: 16, border: '1px solid #ffa39e' }} headStyle={{ background: '#fff1f0' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 50, color: viewingCrmReport.delivery_blockers?.includes('1. 本周项目') ? 'inherit' : '#cf1322', fontWeight: viewingCrmReport.delivery_blockers?.includes('1. 本周项目') ? 'normal' : '500' }}>{viewingCrmReport.delivery_blockers || '无异常'}</div>
                  </Card>
                </>
              )}
            </div>
          )}
        </Modal>

        {/* 周报填写Modal弹窗 */}
        <Modal
          title={<strong>📅 填写我的个人周复盘周报（当前选定周：{selectedMonday} ~ {selectedSunday}）</strong>}
          open={weeklyWriteVisible}
          onCancel={() => setWeeklyWriteVisible(false)}
          footer={[
            <Button key="cancel" onClick={() => setWeeklyWriteVisible(false)}>
              取消
            </Button>,
            <Button
              key="draft"
              onClick={() => {
                setWeeklyStatusToSubmit('draft')
                weeklyForm.submit()
              }}
              loading={weeklySubmitLoading}
            >
              暂存草稿
            </Button>,
            <Button
              key="submit"
              type="primary"
              onClick={() => {
                setWeeklyStatusToSubmit('submitted')
                weeklyForm.submit()
              }}
              loading={weeklySubmitLoading}
            >
              正式提交
            </Button>
          ]}
          width={800}
          destroyOnHidden
        >
          <div style={{ margin: '12px 0' }}>
            <Space style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                ghost
                icon={<SyncOutlined />}
                loading={weeklyExtractLoading}
                onClick={handleAutoExtractWeekly}
              >
                一键导入当周播报数据
              </Button>
              <Button
                type="primary"
                danger
                icon={<SyncOutlined />}
                loading={weeklyCrmExtractLoading}
                onClick={handleAutoExtractCrmWeekly}
              >
                ⚡ 智能拉取 CRM 业绩与进度
              </Button>
              <Button
                type="primary"
                style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                icon={<SyncOutlined spin={weeklyAiOptimizing} />}
                loading={weeklyAiOptimizing}
                onClick={handleAiOptimizeWeekly}
              >
                🪄 AI 助手智能整理
              </Button>
            </Space>
            
            <Form
              form={weeklyForm}
              layout="vertical"
              onFinish={handleWeeklySubmit}
              loading={weeklyWriteLoading}
            >
              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🎯 本周目标计划</div>
              {!isMarketing && (
                <Form.Item name="delivery_plan" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={3} placeholder="请输入本周的项目交付工作计划..." />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item name="sales_plan" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={3} placeholder="请输入本周的销售工作计划..." />
                </Form.Item>
              )}

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🔥 本周实际完成 (支持一键导入推荐内容)</div>
              {!isMarketing && (
                <Form.Item name="delivery_actual" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={4} placeholder="请输入本周项目交付的实际完成情况..." />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item name="sales_actual" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={4} placeholder="请输入本周销售的实际完成情况..." />
                </Form.Item>
              )}

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>📊 计划达成率说明</div>
              {!isMarketing && (
                <Form.Item name="delivery_rate" style={{ marginBottom: 0 }}>
                  <Input placeholder="例如：90% 或 基本达成" />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item name="sales_rate" style={{ marginBottom: 0 }}>
                  <Input placeholder="例如：80% 或 新签达成100%" />
                </Form.Item>
              )}

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🏆 本周工作亮点</div>
              {!isMarketing && (
                <Form.Item name="delivery_highlights" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={2} placeholder="请输入项目交付侧的亮点..." />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item name="sales_highlights" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={2} placeholder="请输入销售侧的工作亮点..." />
                </Form.Item>
              )}

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🚧 本周工作卡点/难点</div>
              {!isMarketing && (
                <Form.Item name="delivery_blockers" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={2} placeholder="请输入项目交付侧遇到的困难阻碍..." />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item name="sales_blockers" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={2} placeholder="请输入销售侧遇到的困难阻碍..." />
                </Form.Item>
              )}

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🤝 需要支持协调</div>
              {!isMarketing && (
                <Form.Item name="delivery_support" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={2} placeholder="如需要协调其他人或团队支持交付，请填写..." />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item name="sales_support" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={2} placeholder="如需要协调其他人或团队支持销售，请填写..." />
                </Form.Item>
              )}

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🚀 下周工作目标</div>
              {!isMarketing && (
                <Form.Item name="next_delivery_plan" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={3} placeholder="请输入下周的项目交付目标计划..." />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item name="next_sales_plan" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={3} placeholder="请输入下周的销售目标计划..." />
                </Form.Item>
              )}
            </Form>
          </div>
        </Modal>

        {/* ⚡ 智能拉取 CRM 业绩与进度预览 Modal */}
        <Modal
          title={
            <Space>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1677ff' }}>⚡ 智能拉取 CRM 数据预览与选择导入</span>
            </Space>
          }
          open={crmPreviewVisible}
          onOk={handleConfirmImportCrm}
          onCancel={() => setCrmPreviewVisible(false)}
          okText="确认填入选中的数据"
          cancelText="取消"
          width={800}
          styles={{ body: { maxHeight: '600px', overflowY: 'auto', padding: '16px' } }}
        >
          {/* 1. 分析环境描述卡片 */}
          <Card 
            size="small" 
            style={{ 
              marginBottom: '16px', 
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', 
              border: '1px solid #d9d9d9',
              borderRadius: '8px' 
            }}
          >
            <Descriptions title="🔍 CRM 关联分析诊断概要" size="small" column={2}>
              <Descriptions.Item label="当前分析对象">
                <Text strong style={{ color: '#102a4c' }}>{user?.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="分析周期">
                <Text strong>{selectedMonday} ~ {selectedSunday}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="匹配分析岗位">
                <Tag color={isMarketing ? 'blue' : 'green'}>
                  {isMarketing ? '营销与销售线 (分析商机/合同/回款/拜访)' : '交付与技术线 (分析正在实施项目/子任务/里程碑)'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="数据库来源">
                <Text type="secondary">gzzdpm 只读实例</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <div style={{ marginBottom: '12px' }}>
            <Text type="secondary">
              说明：系统已智能分析只读 CRM 数据库中的关联信息。请勾选您需要填入周报的板块（带蓝色边框的条目为当前选中的推荐项）：
            </Text>
          </div>

          {/* 2. 各维度展示卡片 */}
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            
            {/* 实际完成 */}
            <Card
              size="small"
              title={
                <Checkbox 
                  checked={crmSelectedKeys.actual} 
                  onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, actual: e.target.checked })}
                >
                  <span style={{ fontWeight: 'bold' }}>📅 当周实际完成 ({isMarketing ? '销售签约与拜访' : '项目推进与交付'})</span>
                </Checkbox>
              }
              style={{ border: crmSelectedKeys.actual ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
              styles={{ body: { backgroundColor: crmSelectedKeys.actual ? '#f0f7ff' : '#fafafa' } }}
            >
              <div style={{ whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                {isMarketing ? crmPreviewData?.sales_actual : crmPreviewData?.delivery_actual}
              </div>
            </Card>

            {/* 指标达成率 */}
            <Card
              size="small"
              title={
                <Checkbox 
                  checked={crmSelectedKeys.rate} 
                  onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, rate: e.target.checked })}
                >
                  <span style={{ fontWeight: 'bold' }}>📈 本月计划达成率指标</span>
                </Checkbox>
              }
              style={{ border: crmSelectedKeys.rate ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
              styles={{ body: { backgroundColor: crmSelectedKeys.rate ? '#f0f7ff' : '#fafafa' } }}
            >
              <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                {isMarketing ? crmPreviewData?.sales_rate : crmPreviewData?.delivery_rate}
              </div>
            </Card>

            {/* 工作亮点 */}
            <Card
              size="small"
              title={
                <Checkbox 
                  checked={crmSelectedKeys.highlights} 
                  onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, highlights: e.target.checked })}
                >
                  <span style={{ fontWeight: 'bold' }}>✨ 当周工作亮点 (自动诊断建议)</span>
                </Checkbox>
              }
              style={{ border: crmSelectedKeys.highlights ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
              styles={{ body: { backgroundColor: crmSelectedKeys.highlights ? '#f0f7ff' : '#fafafa' } }}
            >
              <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                {isMarketing ? crmPreviewData?.sales_highlights : crmPreviewData?.delivery_highlights}
              </div>
            </Card>

            {/* 工作卡点 */}
            <Card
              size="small"
              title={
                <Checkbox 
                  checked={crmSelectedKeys.blockers} 
                  onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, blockers: e.target.checked })}
                >
                  <span style={{ fontWeight: 'bold' }}>⚠️ 当周工作卡点与异常难点 (包括预设立超期警示)</span>
                </Checkbox>
              }
              style={{ border: crmSelectedKeys.blockers ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
              styles={{ body: { backgroundColor: crmSelectedKeys.blockers ? '#f0f7ff' : '#fafafa' } }}
            >
              <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                {isMarketing ? crmPreviewData?.sales_blockers : crmPreviewData?.delivery_blockers}
              </div>
            </Card>

          </Space>
        </Modal>

        {/* 🪄 AI 助手智能整理微调确认 Modal */}
        <Modal
          title={
            <Space>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#722ed1' }}>🪄 AI 助手周报整理与优化微调</span>
            </Space>
          }
          open={aiOptimizeModalVisible}
          onCancel={() => setAiOptimizeModalVisible(false)}
          onOk={handleConfirmAiOptimize}
          okText="确认并填回周报"
          cancelText="取消"
          width={750}
          destroyOnHidden
        >
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f9f0ff', border: '1px solid #d3adf7', borderRadius: '4px', fontSize: '13px', color: '#722ed1' }}>
              💡 以下是 AI 周报助手为您润色整理后的内容，您可以在下方文本框中直接进行微调，确认无误后点击“确认并填回周报”即可自动覆盖并回填主表单。
            </div>
            <Form
              form={aiOptimizeForm}
              layout="vertical"
            >
              <Form.Item
                name="actual"
                label={<span style={{ fontWeight: 'bold' }}>🔥 本周实际完成 (优化后)</span>}
              >
                <Input.TextArea rows={6} placeholder="润色后的本周实际完成情况..." />
              </Form.Item>

              <Form.Item
                name="highlights"
                label={<span style={{ fontWeight: 'bold' }}>🏆 本周工作亮点 (优化后)</span>}
              >
                <Input.TextArea rows={3} placeholder="润色后的本周亮点..." />
              </Form.Item>

              <Form.Item
                name="blockers"
                label={<span style={{ fontWeight: 'bold' }}>🚧 本周工作卡点/难点 (优化后)</span>}
              >
                <Input.TextArea rows={3} placeholder="润色后的本周卡点与难点..." />
              </Form.Item>

              <Form.Item
                name="support"
                label={<span style={{ fontWeight: 'bold' }}>🤝 需要支持协调 (优化后)</span>}
              >
                <Input.TextArea rows={2} placeholder="AI 分析或润色出的需要支持与协调事项（若无，可留空，系统不会覆盖原内容）..." />
              </Form.Item>

              <Form.Item
                name="next_plan"
                label={<span style={{ fontWeight: 'bold' }}>🚀 下周工作目标 (优化后)</span>}
              >
                <Input.TextArea rows={4} placeholder="润色后的下周工作目标..." />
              </Form.Item>
            </Form>
          </div>
        </Modal>

        {/* 周报编辑Modal弹窗 */}
        <Modal
          title={<strong>📅 编辑员工周复盘周报（当前选定周：{selectedMonday} ~ {selectedSunday} - 用户：{editingWeeklyReport?.user_name}）</strong>}
          open={weeklyEditVisible}
          onCancel={() => setWeeklyEditVisible(false)}
          footer={[
            <Button key="cancel" onClick={() => setWeeklyEditVisible(false)}>
              取消
            </Button>,
            <Button
              key="submit"
              type="primary"
              onClick={() => {
                weeklyEditForm.submit()
              }}
              loading={weeklyEditLoading}
            >
              保存修改
            </Button>
          ]}
          width={800}
          destroyOnHidden
        >
          <div style={{ margin: '12px 0' }}>
            <Form
              form={weeklyEditForm}
              layout="vertical"
              onFinish={handleWeeklyEditSubmit}
              loading={weeklyEditLoading}
            >
              {(() => {
                const isEditingMarketing = editingWeeklyReport?.user_position_type === 'marketing' ||
                  ['target_officer', 'marketing_staff', 'tech_marketing'].includes(editingWeeklyReport?.user_role || '');
                
                return (
                  <>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🎯 本周目标计划</div>
                    {!isEditingMarketing && (
                      <Form.Item name="delivery_plan" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={3} placeholder="请输入本周的项目交付工作计划..." />
                      </Form.Item>
                    )}
                    {isEditingMarketing && (
                      <Form.Item name="sales_plan" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={3} placeholder="请输入本周的销售工作计划..." />
                      </Form.Item>
                    )}

                    <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🔥 本周实际完成</div>
                    {!isEditingMarketing && (
                      <Form.Item name="delivery_actual" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={4} placeholder="请输入本周项目交付的实际完成情况..." />
                      </Form.Item>
                    )}
                    {isEditingMarketing && (
                      <Form.Item name="sales_actual" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={4} placeholder="请输入本周销售的实际完成情况..." />
                      </Form.Item>
                    )}

                    <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>📊 计划达成率说明</div>
                    {!isEditingMarketing && (
                      <Form.Item name="delivery_rate" style={{ marginBottom: 0 }}>
                        <Input placeholder="例如：90% 或 基本达成" />
                      </Form.Item>
                    )}
                    {isEditingMarketing && (
                      <Form.Item name="sales_rate" style={{ marginBottom: 0 }}>
                        <Input placeholder="例如：80% 或 新签达成100%" />
                      </Form.Item>
                    )}

                    <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🏆 本周工作亮点</div>
                    {!isEditingMarketing && (
                      <Form.Item name="delivery_highlights" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="请输入项目交付侧的亮点..." />
                      </Form.Item>
                    )}
                    {isEditingMarketing && (
                      <Form.Item name="sales_highlights" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="请输入销售侧的工作亮点..." />
                      </Form.Item>
                    )}

                    <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🚧 本周工作卡点/难点</div>
                    {!isEditingMarketing && (
                      <Form.Item name="delivery_blockers" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="请输入项目交付侧遇到的困难阻碍..." />
                      </Form.Item>
                    )}
                    {isEditingMarketing && (
                      <Form.Item name="sales_blockers" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="请输入销售侧遇到的困难阻碍..." />
                      </Form.Item>
                    )}

                    <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🤝 需要支持协调</div>
                    {!isEditingMarketing && (
                      <Form.Item name="delivery_support" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="如需要协调其他人或团队支持交付，请填写..." />
                      </Form.Item>
                    )}
                    {isEditingMarketing && (
                      <Form.Item name="sales_support" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="如需要协调其他人或团队支持销售，请填写..." />
                      </Form.Item>
                    )}

                    <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🚀 下周工作目标</div>
                    {!isEditingMarketing && (
                      <Form.Item name="next_delivery_plan" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={3} placeholder="请输入下周的项目交付目标计划..." />
                      </Form.Item>
                    )}
                    {isEditingMarketing && (
                      <Form.Item name="next_sales_plan" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={3} placeholder="请输入下周的销售目标计划..." />
                      </Form.Item>
                    )}
                  </>
                )
              })()}
            </Form>
          </div>
        </Modal>

        {/* ⚡ 团队（战队与三级巴）整体周报预览及指标看板 Modal */}
        <Modal
          title={
            <Space>
              <FileTextOutlined style={{ color: '#13c2c2' }} />
              <strong>⚡ 团队整体复盘周报（当前所选：{getGroupNameText()}）</strong>
            </Space>
          }
          open={groupReportVisible}
          onCancel={() => setGroupReportVisible(false)}
          width={1000}
          centered
          destroyOnClose
          footer={[
            <Button 
              key="regenerate" 
              danger 
              ghost
              icon={<SyncOutlined />} 
              loading={groupReportLoading}
              onClick={triggerAiGenerateGroupReport}
            >
              重新由 AI 智能生成
            </Button>,
            <Button 
              key="copy" 
              icon={<CopyOutlined />} 
              loading={dingSending}
              onClick={handleCopyAndSendToDingtalk}
            >
              一键复制并发送到钉钉
            </Button>,
            <Button 
              key="export" 
              icon={<DownloadOutlined />} 
              onClick={handleExportGroupReportFile}
            >
              导出为 .md 文件
            </Button>,
            <Button 
              key="export-pdf" 
              icon={<DownloadOutlined />} 
              loading={groupPdfExporting}
              onClick={() => handleExportPDF('group-report-pdf-export-temp', `${getGroupNameText()}_${mon.format('YYYY-MM-DD')}_整体复盘周报.pdf`, setGroupPdfExporting)}
            >
              导出PDF
            </Button>,
            <Button 
              key="export-docx" 
              icon={<DownloadOutlined />} 
              loading={groupDocxExporting}
              onClick={handleExportGroupDocx}
            >
              导出Word
            </Button>,
            <Button 
              key="save" 
              type="primary" 
              loading={groupReportLoading}
              onClick={handleSaveGroupReport}
            >
              保存至系统数据库
            </Button>,
            <Button 
              key="close" 
              onClick={() => setGroupReportVisible(false)}
            >
              关闭
            </Button>
          ]}
        >
          <div style={{ maxHeight: '75vh', overflowY: 'auto', padding: '4px' }}>
            <div id="group-report-modal-content" style={{ padding: '16px', backgroundColor: '#ffffff' }}>
            {/* 1. 存盘状态 Alert (小巧单行) */}
            <Alert
              message={
                <span style={{ fontSize: '12px' }}>
                  <strong>{hasSavedReport ? "已加载系统数据库存档快照" : "当前内容由 AI 智能生成（预览）"}</strong>。
                  {hasSavedReport 
                    ? `（存档时间：${savedReportTime}）。您可以随时在下方直接微调，或点击“重新由 AI 智能生成”刷新内容并覆盖保存。`
                    : "您可以在下方直接进行润色调整，确认后点击下方“保存至系统数据库”进行存盘。"
                  }
                </span>
              }
              type={hasSavedReport ? "success" : "info"}
              showIcon
              style={{ marginBottom: 12, padding: '6px 12px' }}
            />

            {/* 2. 九个核心财务与播报指标看板卡片 (扁平 Grid 排列，极度压缩纵向空间) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginBottom: '12px' }}>
              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '6px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959' }}>营销新签合同额</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#389e0d' }}>
                  {groupMetrics.marketing_signed?.toFixed(2)} 万元
                </span>
              </div>
              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '6px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959' }}>交付新签合同额</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#389e0d' }}>
                  {groupMetrics.delivery_signed?.toFixed(2)} 万元
                </span>
              </div>
              <div style={{ background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '6px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959' }}>中标项目个数</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#096dd9' }}>
                  {groupMetrics.win_bids} 个
                </span>
              </div>
              <div style={{ background: '#fffbe6', border: '1px solid #ffd591', borderRadius: '6px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959' }}>幸福动作个数</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#d46b08' }}>
                  {groupMetrics.happiness_count} 次
                </span>
              </div>
              <div style={{ background: '#fffbe6', border: '1px solid #ffd591', borderRadius: '6px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959' }}>铁三角联动次数</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#d46b08' }}>
                  {groupMetrics.triangle_count} 次
                </span>
              </div>
              <div style={{ background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: '6px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959' }}>有效商机线索量</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1d39c4' }}>
                  {groupMetrics.valid_leads} 个
                </span>
              </div>
              <div style={{ background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: '6px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959' }}>潜力商机线索量</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1d39c4' }}>
                  {groupMetrics.potential_leads} 个
                </span>
              </div>
              <div style={{ background: '#fff0f6', border: '1px solid #ffadd2', borderRadius: '6px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959' }}>CRM 累计产值</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#c41d7f' }}>
                  {groupMetrics.production_value?.toFixed(2)} 万元
                </span>
              </div>
              <div style={{ background: '#fff0f6', border: '1px solid #ffadd2', borderRadius: '6px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959' }}>CRM 到账回款额</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#c41d7f' }}>
                  {groupMetrics.receive_value?.toFixed(2)} 万元
                </span>
              </div>
            </div>

            {/* 3. 周报文本编辑器 (带实时 Markdown 预览切换) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#262626' }}>📝 团队整体周报正文 (Markdown 文本)</div>
              <Radio.Group 
                value={previewMode} 
                onChange={(e) => setPreviewMode(e.target.value)} 
                size="small"
                style={{ zIndex: 10 }}
              >
                <Radio.Button value="edit">
                  <EditOutlined /> 编辑源码
                </Radio.Button>
                <Radio.Button value="preview">
                  <EyeOutlined /> 实时预览
                </Radio.Button>
              </Radio.Group>
            </div>

            {previewMode === 'edit' ? (
              <Input.TextArea
                rows={18}
                value={groupReportContent}
                onChange={(e) => setGroupReportContent(e.target.value)}
                placeholder="大模型正在分析和生成中，这可能需要一点时间..."
                style={{ fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.6', backgroundColor: '#fafafa' }}
                disabled={groupReportLoading}
              />
            ) : (
              <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <MarkdownPreview text={groupReportContent} />
              </div>
            )}
            </div>
          </div>
        </Modal>

        {/* 隐藏的用于 PDF 导出的整体周报渲染模板，去除了maxHeight/滚动条限制且不带Alert与Radio切换杂质 */}
        <div style={{ position: 'absolute', top: -9999, left: -9999, width: '794px', zIndex: -100 }}>
          <div id="group-report-pdf-export-temp" style={{ padding: '32px', backgroundColor: '#ffffff', minHeight: '297mm' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#102a4c', margin: '0 0 8px 0' }}>
                📅 团队整体复盘周报（{getGroupNameText()}）
              </h1>
              <div style={{ fontSize: '13px', color: '#595959' }}>
                时间跨度：{selectedMonday} ~ {selectedSunday}
              </div>
            </div>

            {/* 九宫格数据看板 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '6px', padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959', marginBottom: '4px' }}>营销新签合同额</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#389e0d' }}>{groupMetrics.marketing_signed?.toFixed(2)} 万元</span>
              </div>
              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '6px', padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959', marginBottom: '4px' }}>交付新签合同额</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#389e0d' }}>{groupMetrics.delivery_signed?.toFixed(2)} 万元</span>
              </div>
              <div style={{ background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '6px', padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959', marginBottom: '4px' }}>中标项目个数</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#096dd9' }}>{groupMetrics.win_bids} 个</span>
              </div>
              <div style={{ background: '#fffbe6', border: '1px solid #ffd591', borderRadius: '6px', padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959', marginBottom: '4px' }}>幸福动作个数</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#d46b08' }}>{groupMetrics.happiness_count} 次</span>
              </div>
              <div style={{ background: '#fffbe6', border: '1px solid #ffd591', borderRadius: '6px', padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959', marginBottom: '4px' }}>铁三角联动次数</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#d46b08' }}>{groupMetrics.triangle_count} 次</span>
              </div>
              <div style={{ background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: '6px', padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959', marginBottom: '4px' }}>有效商机线索量</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1d39c4' }}>{groupMetrics.valid_leads} 个</span>
              </div>
              <div style={{ background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: '6px', padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959', marginBottom: '4px' }}>潜力商机线索量</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1d39c4' }}>{groupMetrics.potential_leads} 个</span>
              </div>
              <div style={{ background: '#fff0f6', border: '1px solid #ffadd2', borderRadius: '6px', padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959', marginBottom: '4px' }}>CRM 累计产值</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#c41d7f' }}>{groupMetrics.production_value?.toFixed(2)} 万元</span>
              </div>
              <div style={{ background: '#fff0f6', border: '1px solid #ffadd2', borderRadius: '6px', padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', color: '#595959', marginBottom: '4px' }}>CRM 到账回款额</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#c41d7f' }}>{groupMetrics.receive_value?.toFixed(2)} 万元</span>
              </div>
            </div>

            {/* 周报 Markdown 正文，使用无高度限制且完全垂直展开的预览组件 */}
            <div style={{ borderTop: '2px solid #f0f0f0', paddingTop: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#262626', marginBottom: '12px' }}>📝 团队整体周报正文</div>
              <MarkdownPreview text={groupReportContent} />
            </div>
          </div>
        </div>

        {/* 隐藏的用于 PDF 导出的个人周复盘渲染模板 */}
        <div style={{ position: 'absolute', top: -9999, left: -9999, width: '794px', zIndex: -100 }}>
          {viewingWeeklyReport && (
            <div id="user-report-pdf-export-temp" style={{ padding: '32px', backgroundColor: '#ffffff', minHeight: '297mm' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1677ff', margin: '0 0 8px 0' }}>
                  🔍 员工周复盘详情
                </h1>
                <div style={{ fontSize: '13px', color: '#595959' }}>
                  周范围：{selectedMonday} ~ {selectedSunday} - 成员：{viewingWeeklyReport.user_name}
                </div>
              </div>

              <Descriptions bordered column={2} size="small" style={{ marginBottom: 20 }}>
                <Descriptions.Item label="成员姓名"><strong>{viewingWeeklyReport.user_name}</strong></Descriptions.Item>
                <Descriptions.Item label="岗位类别">
                  <Tag color="cyan">
                    {viewingWeeklyReport.user_position_type === 'marketing' ? '营销岗' : '交付及其他'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="填报状态">
                  {viewingWeeklyReport.status === 'submitted' ? (
                    <Tag color="success">已提交</Tag>
                  ) : (
                    <Tag color="default">草稿</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="提交时间">
                  {viewingWeeklyReport.submitted_at 
                    ? dayjs(viewingWeeklyReport.submitted_at).format('YYYY-MM-DD HH:mm:ss')
                    : '—'}
                </Descriptions.Item>
              </Descriptions>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff', marginBottom: '6px' }}>🎯 本周目标计划</div>
                  <Card size="small" headStyle={{ background: '#f5f5f5' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#434343' }}>
                      {(isViewingMarketing ? viewingWeeklyReport.sales_plan : viewingWeeklyReport.delivery_plan) || '—'}
                    </div>
                  </Card>
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff', marginBottom: '6px' }}>🔥 本周实际完成</div>
                  <Card size="small" headStyle={{ background: '#f6ffed' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#434343' }}>
                      {(isViewingMarketing ? viewingWeeklyReport.sales_actual : viewingWeeklyReport.delivery_actual) || '—'}
                    </div>
                  </Card>
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff', marginBottom: '6px' }}>📊 计划达成率说明</div>
                  <Card size="small" headStyle={{ background: '#e6f7ff' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#434343' }}>
                      {(isViewingMarketing ? viewingWeeklyReport.sales_rate : viewingWeeklyReport.delivery_rate) || '—'}
                    </div>
                  </Card>
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff', marginBottom: '6px' }}>🏆 本周工作亮点</div>
                  <Card size="small" headStyle={{ background: '#fffb8f' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#434343' }}>
                      {(isViewingMarketing ? viewingWeeklyReport.sales_highlights : viewingWeeklyReport.delivery_highlights) || '—'}
                    </div>
                  </Card>
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff', marginBottom: '6px' }}>🚧 本周工作卡点/难点</div>
                  <Card size="small" headStyle={{ background: '#fff2e8' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#434343' }}>
                      {(isViewingMarketing ? viewingWeeklyReport.sales_blockers : viewingWeeklyReport.delivery_blockers) || '—'}
                    </div>
                  </Card>
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff', marginBottom: '6px' }}>🤝 需要支持协调</div>
                  <Card size="small" headStyle={{ background: '#feffe6' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#434343' }}>
                      {(isViewingMarketing ? viewingWeeklyReport.sales_support : viewingWeeklyReport.delivery_support) || '—'}
                    </div>
                  </Card>
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff', marginBottom: '6px' }}>🚀 下周工作目标</div>
                  <Card size="small" headStyle={{ background: '#f5f5f5' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#434343' }}>
                      {(isViewingMarketing ? viewingWeeklyReport.next_sales_plan : viewingWeeklyReport.next_delivery_plan) || '—'}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 外部自定义 Markdown 渲染预览组件，支持表格、粗体、多级标题和引用块
interface MarkdownPreviewProps {
  text: string;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ text }) => {
  if (!text) return <div style={{ color: '#bfbfbf', fontStyle: 'italic', padding: '20px' }}>暂无内容</div>;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let tableAligns: ('left' | 'center' | 'right')[] = [];
  
  let inList = false;
  let listItems: string[] = [];

  const parseInlineMarkdown = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*)/g;
    const splitParts = str.split(regex);
    
    splitParts.forEach((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        parts.push(<strong key={index}>{part.slice(2, -2)}</strong>);
      } else {
        parts.push(part);
      }
    });
    return parts;
  };

  const renderTable = (headers: string[], rows: string[][], aligns: ('left' | 'center' | 'right')[], key: number) => {
    return (
      <div key={key} style={{ overflowX: 'auto', marginBottom: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #f0f0f0' }}>
          <thead>
            <tr style={{ backgroundColor: '#fafafa' }}>
              {headers.map((h, i) => (
                <th 
                  key={i} 
                  style={{ 
                    border: '1px solid #f0f0f0', 
                    padding: '6px 10px', 
                    fontWeight: '600', 
                    textAlign: aligns[i] || 'left',
                    color: '#262626'
                  }}
                >
                  {parseInlineMarkdown(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} style={{ backgroundColor: rIdx % 2 === 1 ? '#fafafa' : '#fff' }}>
                {row.map((cell, cIdx) => (
                  <td 
                    key={cIdx} 
                    style={{ 
                      border: '1px solid #f0f0f0', 
                      padding: '6px 10px', 
                      textAlign: aligns[cIdx] || 'left',
                      color: '#595959'
                    }}
                  >
                    {parseInlineMarkdown(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderList = (items: string[], key: number) => {
    return (
      <ul key={key} style={{ paddingLeft: '18px', marginBottom: '12px', listStyleType: 'disc' }}>
        {items.map((item, i) => (
          <li key={i} style={{ marginBottom: '4px', fontSize: '12.5px', lineHeight: '1.5', color: '#434343' }}>
            {parseInlineMarkdown(item)}
          </li>
        ))}
      </ul>
    );
  };

  let elementKey = 0;

  const flushTable = () => {
    if (inTable) {
      elements.push(renderTable(tableHeaders, tableRows, tableAligns, elementKey++));
      inTable = false;
      tableHeaders = [];
      tableRows = [];
      tableAligns = [];
    }
  };

  const flushList = () => {
    if (inList) {
      elements.push(renderList(listItems, elementKey++));
      inList = false;
      listItems = [];
    }
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();

    // 1. 表格
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
      const cells = line.split('|').map(c => c.trim()).slice(1, -1);
      
      if (!inTable) {
        tableHeaders = cells;
        inTable = true;
        if (idx + 1 < lines.length) {
          const nextLine = lines[idx + 1].trim();
          if (nextLine.startsWith('|') && nextLine.includes('---')) {
            const alignCells = nextLine.split('|').map(c => c.trim()).slice(1, -1);
            tableAligns = alignCells.map(c => {
              if (c.startsWith(':') && c.endsWith(':')) return 'center';
              if (c.endsWith(':')) return 'right';
              return 'left';
            });
            idx++;
          }
        }
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    // 2. 列表
    if (line.startsWith('- ') || line.startsWith('* ')) {
      inList = true;
      listItems.push(line.slice(2));
      continue;
    } else {
      flushList();
    }

    // 3. 标题
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={elementKey++} style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '2px solid #f0f0f0', paddingBottom: '6px', marginTop: '12px', marginBottom: '10px', color: '#141414' }}>
          {parseInlineMarkdown(line.slice(2))}
        </h1>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={elementKey++} style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '10px', marginBottom: '6px', color: '#1f1f1f', borderLeft: '3px solid #13c2c2', paddingLeft: '8px' }}>
          {parseInlineMarkdown(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={elementKey++} style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '8px', marginBottom: '4px', color: '#434343' }}>
          {parseInlineMarkdown(line.slice(4))}
        </h3>
      );
      continue;
    }

    // 4. 引用
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={elementKey++} style={{ borderLeft: '3px solid #13c2c2', padding: '4px 10px', background: '#e6fffb', margin: '0 0 10px 0', borderRadius: '0 4px 4px 0', fontSize: '12px', color: '#595959' }}>
          {parseInlineMarkdown(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // 5. 空行
    if (line === '') {
      if (elements.length > 0 && elements[elements.length - 1] !== 'br') {
        elements.push(<div key={elementKey++} style={{ height: '6px' }} />);
      }
      continue;
    }

    // 6. 普通行
    elements.push(
      <p key={elementKey++} style={{ fontSize: '12.5px', lineHeight: '1.5', marginBottom: '6px', color: '#262626' }}>
        {parseInlineMarkdown(line)}
      </p>
    );
  }

  flushTable();
  flushList();

  return (
    <div 
      className="markdown-body" 
      style={{ 
        padding: '16px', 
        background: '#fff', 
        border: '1px solid #d9d9d9', 
        borderRadius: '6px', 
        minHeight: '380px',
        color: '#262626',
        textAlign: 'left'
      }}
    >
      {elements}
    </div>
  );
};

export default WeeklyReports
