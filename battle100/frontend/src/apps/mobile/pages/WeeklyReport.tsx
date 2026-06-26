/**
 * 个人周复盘填报页面 (移动端)
 * 提供本周目标计划、本周实际完成（可自动导入播报）、达成率、亮点、卡点及下周目标填报
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, TextArea, Input, Button, Toast, Card, NavBar, Modal, Popup, Checkbox, Space } from 'antd-mobile'
import { LeftOutline, RightOutline, StarOutline, CalendarOutline, FileOutline } from 'antd-mobile-icons'
import { getMyWeeklyReport, saveWeeklyReport, extractWeeklyBroadcasts, extractWeeklyCrmData } from '@shared/api/report'
import { post } from '@shared/api/client'
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

export default function WeeklyReport() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isMarketing = user?.position_type === 'marketing' || ['target_officer', 'marketing_staff', 'tech_marketing'].includes(user?.role || '');
  
  // 维护当前周一的日期实例，默认当前日期所在周一
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()))
  
  // 计算当周周日日期
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  
  const mondayStr = formatDate(monday)
  const sundayStr = formatDate(sunday)
  
  const originalReportRef = useRef<any>(null)

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
  const [extracting, setExtracting] = useState(false) // 兼容原有一键，但之后可弃用或保留
  const [weeklyExtractLoading, setWeeklyExtractLoading] = useState(false)
  const [weeklyCrmExtractLoading, setWeeklyCrmExtractLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // ⚡ 智能拉取 CRM 数据预览与选择勾选状态
  const [crmPreviewVisible, setCrmPreviewVisible] = useState(false)
  const [crmPreviewData, setCrmPreviewData] = useState<any>(null)
  const [crmSelectedKeys, setCrmSelectedKeys] = useState({
    actual: true,
    rate: true,
    highlights: true,
    blockers: true,
    crm_active_projects: true,
    crm_milestone_tasks: true,
    crm_suspended_projects: true,
    crm_no_contract_warning: true,
    crm_unbilled_warning: true,
    crm_unreceived_warning: true,
    crm_health_diagnosis: true
  })
  
  // 钉钉同步状态，所有注释必须使用中文
  const [syncDingtalkVisible, setSyncDingtalkVisible] = useState(false)
  const [syncDingtalkReportId, setSyncDingtalkReportId] = useState<number | null>(null)
  const [syncDingtalkTemplateId, setSyncDingtalkTemplateId] = useState('')
  const [syncDingtalkLoading, setSyncDingtalkLoading] = useState(false)

  // 切换星期时立即置空基准值，防止拉取异步空档期错位写入本地缓存
  useEffect(() => {
    originalReportRef.current = null
  }, [mondayStr])

  // 监听数据改变并实时同步本地缓存（只在与基准数据有差异时写入）
  useEffect(() => {
    if (!user?.id || !mondayStr) return
    if (!originalReportRef.current) return

    const fields = [
      'delivery_plan', 'sales_plan',
      'delivery_actual', 'sales_actual',
      'delivery_rate', 'sales_rate',
      'delivery_highlights', 'sales_highlights',
      'delivery_blockers', 'sales_blockers',
      'delivery_support', 'sales_support',
      'next_delivery_plan', 'next_sales_plan'
    ]

    let hasDiff = false
    for (const field of fields) {
      if (report[field as keyof WeeklyReportType] !== originalReportRef.current[field]) {
        hasDiff = true
        break
      }
    }

    if (hasDiff) {
      const cacheKey = `weekly_report_draft_${user.id}_${mondayStr}`
      localStorage.setItem(cacheKey, JSON.stringify(report))
    }
  }, [report, user?.id, mondayStr])

  // AI 智能整理与微调状态
  const [aiOptimizeModalVisible, setAiOptimizeModalVisible] = useState(false)
  const [weeklyAiOptimizing, setWeeklyAiOptimizing] = useState(false)
  const [aiOptimizeForm] = Form.useForm()

  const handleAiOptimizeWeekly = async () => {
    const target_plan = isMarketing ? report.sales_plan : report.delivery_plan
    const actual = isMarketing ? report.sales_actual : report.delivery_actual
    const highlights = isMarketing ? report.sales_highlights : report.delivery_highlights
    const blockers = isMarketing ? report.sales_blockers : report.delivery_blockers
    const support = isMarketing ? report.sales_support : report.delivery_support
    const next_plan = isMarketing ? report.next_sales_plan : report.next_delivery_plan

    const isActualEmpty = !actual || actual.trim() === '' || actual.includes('做了什么项目') || actual.includes('销售：（已签约')
    const isHighlightsEmpty = !highlights || highlights.trim() === '' || highlights.includes('【项目】') || highlights.includes('【销售】')
    const isBlockersEmpty = !blockers || blockers.trim() === '' || blockers.includes('项目难点') || blockers.includes('销售难点')
    const isSupportEmpty = !support || support.trim() === '' || support.includes('项目侧：') || support.includes('销售侧：')
    const isNextPlanEmpty = !next_plan || next_plan.trim() === '' || next_plan.includes('项目交付工作') || next_plan.includes('销售：（新签')

    if (isActualEmpty && isHighlightsEmpty && isBlockersEmpty && isSupportEmpty && isNextPlanEmpty) {
      Toast.show({
        icon: 'fail',
        content: '当前各模块内容均为空，请先填写或导入数据！'
      })
      return
    }

    setWeeklyAiOptimizing(true)
    try {
      const res = await post<any>('/llm/agents/extractor/chat', {
        variables: {
          target_plan: target_plan || '',
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
        Toast.show({
          icon: 'fail',
          content: 'AI 整理返回的数据格式不正确'
        })
      }
    } catch (err: any) {
      console.error(err)
      Toast.show({
        icon: 'fail',
        content: err?.response?.data?.detail || 'AI 智能整理失败，请重试'
      })
    } finally {
      setWeeklyAiOptimizing(false)
    }
  }

  const handleConfirmAiOptimize = () => {
    const values = aiOptimizeForm.getFieldsValue()
    
    // 增加回写逻辑：支持项不直接覆盖原内容，以追加拼接形式回写
    const oldSupport = (isMarketing ? report.sales_support : report.delivery_support) || ''
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

    setReport(prev => {
      const nextReport = { ...prev }
      if (isMarketing) {
        nextReport.sales_actual = values.actual
        nextReport.sales_highlights = values.highlights
        nextReport.sales_blockers = values.blockers
        nextReport.sales_support = finalSupport
        nextReport.next_sales_plan = values.next_plan
      } else {
        nextReport.delivery_actual = values.actual
        nextReport.delivery_highlights = values.highlights
        nextReport.delivery_blockers = values.blockers
        nextReport.delivery_support = finalSupport
        nextReport.next_delivery_plan = values.next_plan
      }
      return nextReport
    })

    setAiOptimizeModalVisible(false)
    Toast.show({
      icon: 'success',
      content: '内容已成功填回周报表单！'
    })
  }

  // 拉取当周周报数据
  const fetchWeeklyReport = async (monDate: Date) => {
    setLoading(true)
    const monStr = formatDate(monDate)
    const sunStr = formatDate(new Date(new Date(monDate).setDate(monDate.getDate() + 6)))
    
    let data: any = null
    try {
      const res = await getMyWeeklyReport(monStr)
      const responseData = res?.data ? res.data : res
      if (responseData) {
        data = responseData
      }
    } catch (err) {
      console.log('尚未填写周报，将预填模版说明')
    }
    
    const fields = [
      'delivery_plan', 'sales_plan',
      'delivery_actual', 'sales_actual',
      'delivery_rate', 'sales_rate',
      'delivery_highlights', 'sales_highlights',
      'delivery_blockers', 'sales_blockers',
      'delivery_support', 'sales_support',
      'next_delivery_plan', 'next_sales_plan'
    ]
    
    const newReport: any = {
      start_date: monStr,
      end_date: sunStr,
      status: data?.status || 'draft'
    }
    
    fields.forEach(field => {
      const val = data ? data[field] : null
      if (val !== null && val !== undefined && val !== '') {
        newReport[field] = val
      } else {
        const isSalesField = field.startsWith('sales_') || field.startsWith('next_sales_')
        const isDeliveryField = field.startsWith('delivery_') || field.startsWith('next_delivery_')
        if (isMarketing && isSalesField) {
          newReport[field] = DEFAULT_TEMPLATES[field] || ''
        } else if (!isMarketing && isDeliveryField) {
          newReport[field] = DEFAULT_TEMPLATES[field] || ''
        } else {
          newReport[field] = ''
        }
      }
    })
    // 检查本地未保存的临时草稿并恢复
    if (user?.id) {
      const cacheKey = `weekly_report_draft_${user.id}_${monStr}`
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try {
          const cachedReport = JSON.parse(cached)
          let hasDiff = false
          fields.forEach(field => {
            if (cachedReport[field] !== undefined && cachedReport[field] !== newReport[field]) {
              hasDiff = true
              newReport[field] = cachedReport[field]
            }
          })
          if (hasDiff) {
            Toast.show({
              icon: 'success',
              content: '已为您自动恢复上次未保存的本地草稿内容',
              duration: 2000
            })
          }
        } catch (e) {
          console.error('解析本地周报草稿失败:', e)
        }
      }
    }

    originalReportRef.current = { ...newReport }
    
    setReport(newReport)
    setLoading(false)
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

  // 1. 导入上周周报和本周播报数据（步骤一）
  const handleAutoExtractWeekly = async () => {
    setWeeklyExtractLoading(true)
    try {
      const res = await extractWeeklyBroadcasts(mondayStr)
      const data = res?.data ? res.data : res
      if (data) {
        setReport(prev => ({
          ...prev,
          delivery_actual: data.delivery_actual || '',
          sales_actual: data.sales_actual || ''
        }))
        Toast.show({
          icon: 'success',
          content: '已成功导入上周实际完成及本周播报数据！'
        })
      }
    } catch (err) {
      console.error(err)
      Toast.show({
        icon: 'fail',
        content: '导入上周周报与本周播报数据失败'
      })
    } finally {
      setWeeklyExtractLoading(false)
    }
  }

  // 2. ⚡ 智能拉取 CRM 业绩与进度数据并弹出预览（步骤二）
  const handleAutoExtractCrmWeekly = async () => {
    setWeeklyCrmExtractLoading(true)
    try {
      const res = await extractWeeklyCrmData(mondayStr)
      const data = res?.data ? res.data : res
      if (data) {
        setCrmPreviewData(data)
        // 从本地存储尝试加载上一次的勾选配置，对齐管理端行为
        const cacheKey = isMarketing ? 'crm_selected_keys_marketing' : 'crm_selected_keys_delivery'
        const savedKeysStr = localStorage.getItem(cacheKey)
        let loadedKeys: Record<string, boolean> | null = null
        if (savedKeysStr) {
          try {
            loadedKeys = JSON.parse(savedKeysStr)
          } catch (e) {
            console.error('解析本地保存的 CRM 勾选状态失败', e)
          }
        }

        const actualVal = isMarketing ? data.sales_actual : data.delivery_actual
        const rateVal = isMarketing ? data.sales_rate : data.delivery_rate
        const highlightsVal = isMarketing ? data.sales_highlights : data.delivery_highlights
        const blockersVal = isMarketing ? data.sales_blockers : data.delivery_blockers

        if (loadedKeys) {
          setCrmSelectedKeys({
            actual: loadedKeys.actual !== undefined ? loadedKeys.actual : true,
            rate: loadedKeys.rate !== undefined ? loadedKeys.rate : true,
            highlights: loadedKeys.highlights !== undefined ? loadedKeys.highlights : true,
            blockers: loadedKeys.blockers !== undefined ? loadedKeys.blockers : true,
            crm_active_projects: loadedKeys.crm_active_projects !== undefined ? loadedKeys.crm_active_projects : true,
            crm_milestone_tasks: loadedKeys.crm_milestone_tasks !== undefined ? loadedKeys.crm_milestone_tasks : true,
            crm_suspended_projects: loadedKeys.crm_suspended_projects !== undefined ? loadedKeys.crm_suspended_projects : true,
            crm_no_contract_warning: loadedKeys.crm_no_contract_warning !== undefined ? loadedKeys.crm_no_contract_warning : true,
            crm_unbilled_warning: loadedKeys.crm_unbilled_warning !== undefined ? loadedKeys.crm_unbilled_warning : true,
            crm_unreceived_warning: loadedKeys.crm_unreceived_warning !== undefined ? loadedKeys.crm_unreceived_warning : true,
            crm_health_diagnosis: loadedKeys.crm_health_diagnosis !== undefined ? loadedKeys.crm_health_diagnosis : true
          })
        } else {
          // 首次或无本地保存配置时，进行智能诊断推荐勾选
          if (isMarketing) {
            setCrmSelectedKeys({
              actual: !!actualVal && !isDummyCrmActual(actualVal, true),
              rate: !!rateVal && rateVal !== '月度新签与回款指标正在统计中' && rateVal.trim() !== '',
              highlights: !!highlightsVal && highlightsVal !== '1. 本周销售签约及商务拓展平稳推进。' && highlightsVal.trim() !== '',
              blockers: !!blockersVal && blockersVal !== '1. 目前名下意向商机及收款合同暂无重大异常阻碍。' && blockersVal.trim() !== '',
              crm_active_projects: true,
              crm_milestone_tasks: true,
              crm_suspended_projects: true,
              crm_no_contract_warning: true,
              crm_unbilled_warning: true,
              crm_unreceived_warning: true,
              crm_health_diagnosis: true
            })
          } else {
            setCrmSelectedKeys({
              actual: true,
              blockers: true,
              rate: !!rateVal && rateVal !== '月度指标正在统计中' && rateVal.trim() !== '',
              highlights: !!highlightsVal && highlightsVal !== '1. 交付工作处于正常开发推进中，开发交付无积压。' && highlightsVal.trim() !== '',
              crm_active_projects: !!data.crm_active_projects && data.crm_active_projects !== '—',
              crm_milestone_tasks: !!data.crm_milestone_tasks && data.crm_milestone_tasks !== '—',
              crm_suspended_projects: !!data.crm_suspended_projects && data.crm_suspended_projects !== '—',
              crm_no_contract_warning: !!data.crm_no_contract_warning && data.crm_no_contract_warning !== '—',
              crm_unbilled_warning: !!data.crm_unbilled_warning && data.crm_unbilled_warning !== '—',
              crm_unreceived_warning: !!data.crm_unreceived_warning && data.crm_unreceived_warning !== '—',
              crm_health_diagnosis: !!data.crm_health_diagnosis && data.crm_health_diagnosis !== '—' && !data.crm_health_diagnosis.includes('工作饱和度与项目实施状态正常')
            })
          }
        }
        setCrmPreviewVisible(true)
      } else {
        Toast.show({
          icon: 'fail',
          content: '未拉取到任何有效的 CRM 数据'
        })
      }
    } catch (err: any) {
      console.error(err)
      Toast.show({
        icon: 'fail',
        content: err?.response?.data?.detail || '智能拉取 CRM 数据失败'
      })
    } finally {
      setWeeklyCrmExtractLoading(false)
    }
  }

  // 确认从预览中导入选中的 CRM 数据至表单状态
  const handleConfirmImportCrm = () => {
    if (!crmPreviewData) return

    // 保存用户的勾选配置状态
    const cacheKey = isMarketing ? 'crm_selected_keys_marketing' : 'crm_selected_keys_delivery'
    localStorage.setItem(cacheKey, JSON.stringify(crmSelectedKeys))

    const updateValues: Record<string, any> = {}

    if (isMarketing) {
      // 1. 营销岗：保持原先 4 大项导入逻辑
      if (crmSelectedKeys.actual) {
        const currentActual = report.sales_actual || ''
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
      
      if (crmSelectedKeys.blockers) {
        const crmBlockers = crmPreviewData.sales_blockers || ''
        if (crmBlockers) {
          updateValues.sales_blockers = crmBlockers
        }
      }
    } else {
      // 2. 交付岗：按 7 项 CRM 细粒度指标导入拼装
      // A. 拼装实际完成 (正在实施项目进度与里程碑明细拼接)
      let prefix = ''
      const deliveryActual = crmPreviewData.delivery_actual || ''
      const match = deliveryActual.match(/^【📊 CRM 本周业绩快照】：.*?\n\n/)
      if (match) {
        prefix = match[0]
      }

      const actualParts: string[] = []
      if (crmSelectedKeys.crm_active_projects && crmPreviewData.crm_active_projects && crmPreviewData.crm_active_projects !== '—') {
        actualParts.push(`目前负责跟进的正在实施项目进度情况如下：\n${crmPreviewData.crm_active_projects}`)
      }
      if (crmSelectedKeys.crm_milestone_tasks && crmPreviewData.crm_milestone_tasks && crmPreviewData.crm_milestone_tasks !== '—') {
        actualParts.push(`本周项目子任务及里程碑节点交付动作明细：\n${crmPreviewData.crm_milestone_tasks}`)
      }

      let crmActual = ''
      if (actualParts.length > 0) {
        crmActual = prefix + actualParts.join('\n\n')
      }

      if (crmActual) {
        const currentActual = report.delivery_actual || ''
        const isCurrentDummy = isDummyBroadcast(currentActual) || currentActual === (DEFAULT_TEMPLATES.delivery_actual || '')
        updateValues.delivery_actual = isCurrentDummy ? crmActual : `${currentActual}\n\n${crmActual}`
      }

      // B. 拼装卡点难点 (将暂停项目、超期未签、有进度未开票、已开票未回款、健康度诊断进行拼接)
      const diagnosisText = (crmSelectedKeys.crm_health_diagnosis && crmPreviewData.crm_health_diagnosis && crmPreviewData.crm_health_diagnosis !== '—' && !crmPreviewData.crm_health_diagnosis.includes('工作饱和度与项目实施状态正常')) 
        ? `【🚨 个人工作饱和度与项目健康度诊断】：\n${crmPreviewData.crm_health_diagnosis}` 
        : ''

      const blockerParts: string[] = []
      if (crmSelectedKeys.crm_suspended_projects && crmPreviewData.crm_suspended_projects && crmPreviewData.crm_suspended_projects !== '—') {
        blockerParts.push(`交付难点：项目处于暂停或异常挂起状态：\n${crmPreviewData.crm_suspended_projects}`)
      }
      if (crmSelectedKeys.crm_no_contract_warning && crmPreviewData.crm_no_contract_warning && crmPreviewData.crm_no_contract_warning !== '—') {
        blockerParts.push(`预设立警（超期未签合同项目）：\n${crmPreviewData.crm_no_contract_warning}`)
      }
      if (crmSelectedKeys.crm_unbilled_warning && crmPreviewData.crm_unbilled_warning && crmPreviewData.crm_unbilled_warning !== '—') {
        blockerParts.push(`交付卡点（有进度未开票项目）：\n${crmPreviewData.crm_unbilled_warning}`)
      }
      if (crmSelectedKeys.crm_unreceived_warning && crmPreviewData.crm_unreceived_warning && crmPreviewData.crm_unreceived_warning !== '—') {
        blockerParts.push(`收欠款预警（已开票未回款项目）：\n${crmPreviewData.crm_unreceived_warning}`)
      }

      let crmBlockers = ''
      const combinedBlockers = blockerParts.join('\n\n')
      if (diagnosisText && combinedBlockers) {
        crmBlockers = `${diagnosisText}\n\n${combinedBlockers}`
      } else if (diagnosisText) {
        crmBlockers = diagnosisText
      } else if (combinedBlockers) {
        crmBlockers = combinedBlockers
      }

      if (crmBlockers) {
        const currentBlockers = report.delivery_blockers || ''
        const isCurrentDummy = currentBlockers.includes('暂无重大的技术难点') || currentBlockers === (DEFAULT_TEMPLATES.delivery_blockers || '')
        updateValues.delivery_blockers = isCurrentDummy ? crmBlockers : `${currentBlockers}\n\n${crmBlockers}`
      }
    }

    // 3. 共通指标：仅营销岗处理计划达成率说明 (rate) 与工作亮点 (highlights)
    if (isMarketing) {
      if (crmSelectedKeys.rate) {
        if (crmPreviewData.sales_rate !== undefined && crmPreviewData.sales_rate !== null && crmPreviewData.sales_rate !== '') {
          updateValues.sales_rate = crmPreviewData.sales_rate
        }
      }

      if (crmSelectedKeys.highlights) {
        if (crmPreviewData.sales_highlights !== undefined && crmPreviewData.sales_highlights !== null && crmPreviewData.sales_highlights !== '') {
          updateValues.sales_highlights = crmPreviewData.sales_highlights
        }
      }
    }

    setReport(prev => ({
      ...prev,
      ...updateValues
    }))
    Toast.show({
      icon: 'success',
      content: '已成功将选中的 CRM 业绩与进度数据填入您的周报！'
    })
    setCrmPreviewVisible(false)
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
      const payload: any = {
        ...report,
        start_date: mondayStr,
        end_date: sundayStr,
        status: submitStatus
      }
      
      // 过滤与当前用户岗位不符的另一侧模板数据，避免空模板脏数据提交落库
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
        const isSalesField = field.startsWith('sales_') || field.startsWith('next_sales_')
        if (isMarketing && !isSalesField) {
          payload[field] = ''
        } else if (!isMarketing && isSalesField) {
          payload[field] = ''
        }
      })
      
      const res = await saveWeeklyReport(payload)
      const responseData = res?.data ? res.data : res
      if (responseData) {
        originalReportRef.current = { ...responseData }
        setReport(responseData)
        
        // 保存/提交成功后清除当前周的本地临时草稿缓存
        if (user?.id) {
          const cacheKey = `weekly_report_draft_${user.id}_${mondayStr}`
          localStorage.removeItem(cacheKey)
        }
        
        Toast.show({
          icon: 'success',
          content: submitStatus === 'submitted' ? '周复盘提交成功！' : '草稿保存成功！'
        })
        if (submitStatus === 'submitted') {
          // 正式提交成功，弹出同步至钉钉的 Modal，所有注释必须使用中文
          if (responseData.id) {
            setSyncDingtalkReportId(responseData.id)
            setSyncDingtalkTemplateId('')
            setSyncDingtalkVisible(true)
          } else {
            setTimeout(() => navigate('/m/profile'), 1500)
          }
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

  // 异步调用后端接口一键同步个人周报至钉钉工作日志，所有注释必须使用中文
  const handleSyncWeeklyReportToDingtalk = async () => {
    if (!syncDingtalkReportId) return
    setSyncDingtalkLoading(true)
    Toast.show({
      icon: 'loading',
      content: '正在同步至钉钉工作日志...',
      duration: 0
    })
    try {
      const res = await post<any>(`/reports/weekly/${syncDingtalkReportId}/sync-to-dingtalk`, {
        template_id: syncDingtalkTemplateId || undefined
      })
      Toast.clear()
      Toast.show({
        icon: 'success',
        content: res?.message || '同步填报至钉钉工作日志成功！'
      })
      setSyncDingtalkVisible(false)
      // 成功后延迟跳转回个人中心
      setTimeout(() => navigate('/m/profile'), 1500)
    } catch (err: any) {
      console.error('同步钉钉日志失败:', err)
      Toast.clear()
      const errMsg = err?.response?.data?.detail || err?.message || '同步填报至钉钉日志失败，请稍后重试'
      Toast.show({
        icon: 'fail',
        content: errMsg
      })
    } finally {
      setSyncDingtalkLoading(false)
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
            第 {Math.floor(Math.round((new Date(mondayStr + 'T00:00:00').getTime() - new Date('2026-06-01T00:00:00').getTime()) / 86400000) / 7) + 1} 周
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
            {/* 三步填报智能整理 - 按钮组 */}
            <div style={{ margin: '8px 0 16px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Button
                block
                loading={weeklyExtractLoading}
                onClick={handleAutoExtractWeekly}
                style={{
                  background: 'linear-gradient(135deg, #1890ff, #096dd9)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  height: '42px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 10px rgba(24,144,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                1️⃣ 导入上周周报和本周播报
              </Button>

              <Button
                block
                loading={weeklyCrmExtractLoading}
                onClick={handleAutoExtractCrmWeekly}
                style={{
                  background: 'linear-gradient(135deg, #ff4d4f, #d9363e)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  height: '42px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 10px rgba(255,77,79,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                2️⃣ ⚡ 智能拉取 CRM 业绩与进度
              </Button>
              
              <Button
                block
                loading={weeklyAiOptimizing}
                onClick={handleAiOptimizeWeekly}
                style={{
                  background: 'linear-gradient(135deg, #722ed1, #531dab)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  height: '42px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 10px rgba(114,46,209,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                3️⃣ 🪄 AI 助手智能整理周报
              </Button>
            </div>

            {/* 模块一：本周目标计划 */}
            <Card title={<div style={{ display: 'flex', alignItems: 'center', color: '#1677ff', gap: 6 }}><CalendarOutline /> 1. 本周目标计划</div>} style={{ borderRadius: '12px', marginBottom: 12 }}>
              {!isMarketing && (
                <Form.Item label='项目交付工作：（计划需要做什么项目，什么内容，到什么节点）'>
                  <TextArea
                    placeholder='请输入项目交付计划...'
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    value={report.delivery_plan || ''}
                    onChange={val => setReport(prev => ({ ...prev, delivery_plan: val }))}
                    style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                  />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item label='销售：（计划完成新签、回款、营销动作目标）'>
                  <TextArea
                    placeholder='请输入销售目标计划...'
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    value={report.sales_plan || ''}
                    onChange={val => setReport(prev => ({ ...prev, sales_plan: val }))}
                    style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                  />
                </Form.Item>
              )}
            </Card>

            {/* 模块二：本周实际完成 */}
            <Card title={<div style={{ display: 'flex', alignItems: 'center', color: '#52c41a', gap: 6 }}><StarOutline /> 2. 本周实际完成</div>} style={{ borderRadius: '12px', marginBottom: 12 }}>
              {!isMarketing && (
                <Form.Item label='项目交付工作：（做了什么项目，什么内容，到什么节点，幸福动作等）'>
                  <TextArea
                    placeholder='请输入本周项目交付实际完成情况...'
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    value={report.delivery_actual || ''}
                    onChange={val => setReport(prev => ({ ...prev, delivery_actual: val }))}
                    style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                  />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item label='销售：（已签约、中标、铁三角现场联动、拜访等）'>
                  <TextArea
                    placeholder='请输入本周销售实际完成情况...'
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    value={report.sales_actual || ''}
                    onChange={val => setReport(prev => ({ ...prev, sales_actual: val }))}
                    style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                  />
                </Form.Item>
              )}
            </Card>

            {/* 模块三：达成情况 */}
            <Card title={<div style={{ display: 'flex', alignItems: 'center', color: '#13c2c2', gap: 6 }}><FileOutline /> 3. 指标达成率</div>} style={{ borderRadius: '12px', marginBottom: 12 }}>
              {!isMarketing && (
                <Form.Item label='项目达成率 (%)'>
                  <Input
                    placeholder='例如 100%'
                    value={report.delivery_rate || ''}
                    onChange={val => setReport(prev => ({ ...prev, delivery_rate: val }))}
                    style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                  />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item label='销售达成率 (%)'>
                  <Input
                    placeholder='例如 85%'
                    value={report.sales_rate || ''}
                    onChange={val => setReport(prev => ({ ...prev, sales_rate: val }))}
                    style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                  />
                </Form.Item>
              )}
            </Card>

            {/* 模块四：本周亮点 */}
            <Card title='🏆 4. 本周亮点' style={{ borderRadius: '12px', marginBottom: 12 }}>
              {!isMarketing && (
                <Form.Item label='【项目亮点】'>
                  <TextArea
                    placeholder='请输入项目交付方面突出的工作成果与正反馈...'
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    value={report.delivery_highlights || ''}
                    onChange={val => setReport(prev => ({ ...prev, delivery_highlights: val }))}
                    style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                  />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item label='【销售亮点】'>
                  <TextArea
                    placeholder='请输入新签、回款、客户突破方面的亮点...'
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    value={report.sales_highlights || ''}
                    onChange={val => setReport(prev => ({ ...prev, sales_highlights: val }))}
                    style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                  />
                </Form.Item>
              )}
            </Card>

            {/* 模块五：本周卡点 */}
            <Card title='⚠️ 5. 本周卡点' style={{ borderRadius: '12px', marginBottom: 12 }}>
              {!isMarketing && (
                <Form.Item label='【项目难点】'>
                  <TextArea
                    placeholder='请输入项目推进卡点或技术堵点...'
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    value={report.delivery_blockers || ''}
                    onChange={val => setReport(prev => ({ ...prev, delivery_blockers: val }))}
                    style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                  />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item label='【销售难点】'>
                  <TextArea
                    placeholder='请输入客情推进、合同流转或回款被拒等销售难点...'
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    value={report.sales_blockers || ''}
                    onChange={val => setReport(prev => ({ ...prev, sales_blockers: val }))}
                    style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                  />
                </Form.Item>
              )}
            </Card>

            {/* 模块六：是否需要支持协调 */}
            <Card title='🤝 6. 是否需要支持协调' style={{ borderRadius: '12px', marginBottom: 12 }}>
              {!isMarketing && (
                <Form.Item label='【项目侧支持协调需求】'>
                  <TextArea
                    placeholder='如需要协调其他人或团队支持交付，请填写...'
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    value={report.delivery_support || ''}
                    onChange={val => setReport(prev => ({ ...prev, delivery_support: val }))}
                    style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                  />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item label='【销售侧支持协调需求】'>
                  <TextArea
                    placeholder='如需要协调其他人或团队支持销售，请填写...'
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    value={report.sales_support || ''}
                    onChange={val => setReport(prev => ({ ...prev, sales_support: val }))}
                    style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                  />
                </Form.Item>
              )}
            </Card>

            {/* 模块七：下周目标 */}
            <Card title='🚀 7. 下周目标' style={{ borderRadius: '12px', marginBottom: 16 }}>
              {!isMarketing && (
                <Form.Item label='项目交付工作：（做了什么项目，什么内容，到什么节点）'>
                  <TextArea
                    placeholder='请输入下周项目交付计划...'
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    value={report.next_delivery_plan || ''}
                    onChange={val => setReport(prev => ({ ...prev, next_delivery_plan: val }))}
                    style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                  />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item label='销售：（新签、回款、营销动作等）'>
                  <TextArea
                    placeholder='请输入下周销售目标计划...'
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    value={report.next_sales_plan || ''}
                    onChange={val => setReport(prev => ({ ...prev, next_sales_plan: val }))}
                    style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}
                  />
                </Form.Item>
              )}
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
                ✓ 本周复盘已提交（您仍可进行编辑并重新保存/提交）
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                onClick={() => handleSave('draft')}
                loading={submitting}
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
                style={{
                  flex: 1.5,
                  borderRadius: '20px',
                  height: '40px',
                  fontSize: 14,
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #1890ff, #102a4c)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 8px rgba(24,144,255,0.2)'
                }}
              >
                {report.status === 'submitted' ? '重新提交周复盘' : '提交周复盘'}
              </Button>
            </div>
          </Form>
        )}
      </div>

      {/* 🪄 AI 助手周报整理微调确认 Modal */}
      <Modal
        visible={aiOptimizeModalVisible}
        title={<span style={{ color: '#722ed1', fontWeight: 'bold' }}>🪄 AI 助手周报整理与微调</span>}
        content={
          <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '4px 0' }}>
            <div style={{ marginBottom: 12, padding: 8, background: '#f9f0ff', border: '1px solid #d3adf7', borderRadius: '6px', fontSize: '11px', color: '#722ed1', lineHeight: '1.5' }}>
              💡 以下是 AI 周报助手为您润色整理后的内容，您可以在下方直接进行微调，点击“确认并填回周报”即可自动追加或回写。
            </div>
            <Form
              form={aiOptimizeForm}
              layout='vertical'
            >
              <Form.Item name='actual' label={<span style={{ fontWeight: 'bold' }}>🔥 本周实际完成 (优化后)</span>}>
                <TextArea rows={5} placeholder="润色后的本周实际完成情况..." style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }} />
              </Form.Item>
              <Form.Item name='highlights' label={<span style={{ fontWeight: 'bold' }}>🏆 本周工作亮点 (优化后)</span>}>
                <TextArea rows={2} placeholder="润色后的本周亮点..." style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }} />
              </Form.Item>
              <Form.Item name='blockers' label={<span style={{ fontWeight: 'bold' }}>🚧 本周工作卡点/难点 (优化后)</span>}>
                <TextArea rows={2} placeholder="润色后的本周卡点与难点..." style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }} />
              </Form.Item>
              <Form.Item name='support' label={<span style={{ fontWeight: 'bold' }}>🤝 需要支持协调 (优化后)</span>}>
                <TextArea rows={2} placeholder="AI 整理出的支持协调事项..." style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }} />
              </Form.Item>
              <Form.Item name='next_plan' label={<span style={{ fontWeight: 'bold' }}>🚀 下周工作目标 (优化后)</span>}>
                <TextArea rows={3} placeholder="润色后的下周工作目标..." style={{ backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }} />
              </Form.Item>
            </Form>
          </div>
        }
        closeOnAction={false}
        actions={[
          {
            key: 'cancel',
            text: '取消',
          },
          {
            key: 'confirm',
            text: '确认并填回周报',
            primary: true,
          },
        ]}
        onAction={(action) => {
          if (action.key === 'confirm') {
            handleConfirmAiOptimize()
          } else {
            setAiOptimizeModalVisible(false)
          }
        }}
      />

      {/* 📢 同步至钉钉工作日志 Modal，所有注释必须使用中文 */}
      <Modal
        visible={syncDingtalkVisible}
        title={<span style={{ fontWeight: 'bold' }}>📢 同步至钉钉工作日志</span>}
        content={
          <div style={{ padding: '8px 0' }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
              您的个人周报已提交成功！可选择填入钉钉日志模板 ID 进行一键同步填报：
            </div>
            <Input
              placeholder="留空则自动识别战队专属模板，或输入其他模板 ID"
              value={syncDingtalkTemplateId}
              onChange={val => setSyncDingtalkTemplateId(val)}
              style={{
                backgroundColor: '#fafafa',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '13px'
              }}
            />
            <div style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>
              默认大盘 ID：19eab0d8aa4e349cb1df85146edac9cf (留空将自动按所属战队匹配)
            </div>
          </div>
        }
        closeOnAction={false}
        actions={[
          {
            key: 'cancel',
            text: '暂不同步',
          },
          {
            key: 'confirm',
            text: '立即同步',
            primary: true,
          },
        ]}
        onAction={async (action) => {
          if (action.key === 'confirm') {
            await handleSyncWeeklyReportToDingtalk()
          } else {
            setSyncDingtalkVisible(false)
            // 暂不同步时直接返回个人中心
            setTimeout(() => navigate('/m/profile'), 500)
          }
        }}
      />

      {/* ⚡ 智能拉取 CRM 数据预览与选择导入 Popup */}
      <Popup
        visible={crmPreviewVisible}
        onMaskClick={() => setCrmPreviewVisible(false)}
        bodyStyle={{
          height: '80vh',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f4f6fa'
        }}
      >
        {/* Popup 头部栏 */}
        <div style={{
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e8e8e8',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <span 
            onClick={() => setCrmPreviewVisible(false)} 
            style={{ fontSize: '14px', color: '#8c8c8c', cursor: 'pointer' }}
          >
            取消
          </span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#102a4c', display: 'flex', alignItems: 'center', gap: 4 }}>
            ⚡ CRM 业绩与进度预览选择
          </span>
          <span 
            onClick={handleConfirmImportCrm} 
            style={{ fontSize: '14px', color: '#1677ff', fontWeight: 'bold', cursor: 'pointer' }}
          >
            确认填入
          </span>
        </div>

        {/* Popup 内容滚动区 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {/* 1. 诊断摘要卡片 */}
          <div style={{
            background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
            border: '1px solid #d0dbe9'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#102a4c', marginBottom: '8px' }}>
              🔍 CRM 关联分析诊断概要
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '11px', color: '#4a4a4a' }}>
              <div>分析对象: <strong style={{ color: '#111' }}>{user?.name}</strong></div>
              <div>分析岗位: <span style={{
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 'bold',
                color: isMarketing ? '#096dd9' : '#389e0d',
                backgroundColor: isMarketing ? '#e6f7ff' : '#f6ffed',
                border: `1px solid ${isMarketing ? '#91d5ff' : '#b7eb8f'}`
              }}>{isMarketing ? '营销与销售线' : '交付与技术线'}</span></div>
              <div style={{ gridColumn: 'span 2' }}>分析周期: <strong>{mondayStr} ~ {sundayStr}</strong></div>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '12px', lineHeight: '1.4' }}>
            说明：系统已智能分析只读 CRM 数据库中的关联信息。请勾选您需要填入周报的板块（带蓝色边框的条目为当前选中的推荐项）：
          </div>

          {/* 2. 板块卡片列表 */}
          <Space direction="vertical" block style={{ '--gap': '12px' }}>
            {isMarketing ? (
              <>
                {/* 实际完成卡片 */}
                <div style={{
                  border: crmSelectedKeys.actual ? '2px solid #1677ff' : '1px solid #e8e8e8',
                  borderRadius: '12px',
                  backgroundColor: crmSelectedKeys.actual ? '#f0f7ff' : '#ffffff',
                  padding: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Checkbox 
                      checked={crmSelectedKeys.actual} 
                      onChange={val => setCrmSelectedKeys(prev => ({ ...prev, actual: val }))}
                      style={{ '--font-size': '13px', '--icon-size': '16px' }}
                    >
                      <span style={{ fontWeight: 'bold', color: '#262626' }}>
                        📅 当周实际完成 (销售签约与拜访)
                      </span>
                    </Checkbox>
                  </div>
                  <div style={{ 
                    whiteSpace: 'pre-wrap', 
                    maxHeight: '120px', 
                    overflowY: 'auto', 
                    fontFamily: 'monospace', 
                    fontSize: '12px', 
                    padding: '8px', 
                    border: '1px dashed #d9d9d9', 
                    borderRadius: '6px', 
                    backgroundColor: '#ffffff',
                    color: '#555',
                    lineHeight: '1.4'
                  }}>
                    {crmPreviewData?.sales_actual}
                  </div>
                </div>

                {/* 达成率说明卡片 */}
                <div style={{
                  border: crmSelectedKeys.rate ? '2px solid #1677ff' : '1px solid #e8e8e8',
                  borderRadius: '12px',
                  backgroundColor: crmSelectedKeys.rate ? '#f0f7ff' : '#ffffff',
                  padding: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Checkbox 
                      checked={crmSelectedKeys.rate} 
                      onChange={val => setCrmSelectedKeys(prev => ({ ...prev, rate: val }))}
                      style={{ '--font-size': '13px', '--icon-size': '16px' }}
                    >
                      <span style={{ fontWeight: 'bold', color: '#262626' }}>
                        📈 本月计划达成率指标
                      </span>
                    </Checkbox>
                  </div>
                  <div style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace', 
                    fontSize: '12px', 
                    padding: '8px', 
                    border: '1px dashed #d9d9d9', 
                    borderRadius: '6px', 
                    backgroundColor: '#ffffff',
                    color: '#555',
                    lineHeight: '1.4'
                  }}>
                    {crmPreviewData?.sales_rate}
                  </div>
                </div>

                {/* 工作亮点卡片 */}
                <div style={{
                  border: crmSelectedKeys.highlights ? '2px solid #1677ff' : '1px solid #e8e8e8',
                  borderRadius: '12px',
                  backgroundColor: crmSelectedKeys.highlights ? '#f0f7ff' : '#ffffff',
                  padding: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Checkbox 
                      checked={crmSelectedKeys.highlights} 
                      onChange={val => setCrmSelectedKeys(prev => ({ ...prev, highlights: val }))}
                      style={{ '--font-size': '13px', '--icon-size': '16px' }}
                    >
                      <span style={{ fontWeight: 'bold', color: '#262626' }}>
                        ✨ 当周工作亮点 (自动诊断建议)
                      </span>
                    </Checkbox>
                  </div>
                  <div style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace', 
                    fontSize: '12px', 
                    padding: '8px', 
                    border: '1px dashed #d9d9d9', 
                    borderRadius: '6px', 
                    backgroundColor: '#ffffff',
                    color: '#555',
                    lineHeight: '1.4'
                  }}>
                    {crmPreviewData?.sales_highlights}
                  </div>
                </div>

                {/* 工作卡点卡片 */}
                <div style={{
                  border: crmSelectedKeys.blockers ? '2px solid #1677ff' : '1px solid #e8e8e8',
                  borderRadius: '12px',
                  backgroundColor: crmSelectedKeys.blockers ? '#f0f7ff' : '#ffffff',
                  padding: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Checkbox 
                      checked={crmSelectedKeys.blockers} 
                      onChange={val => setCrmSelectedKeys(prev => ({ ...prev, blockers: val }))}
                      style={{ '--font-size': '13px', '--icon-size': '16px' }}
                    >
                      <span style={{ fontWeight: 'bold', color: '#262626' }}>
                        ⚠️ 当周工作卡点与异常难点
                      </span>
                    </Checkbox>
                  </div>
                  <div style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace', 
                    fontSize: '12px', 
                    padding: '8px', 
                    border: '1px dashed #d9d9d9', 
                    borderRadius: '6px', 
                    backgroundColor: '#ffffff',
                    color: '#555',
                    lineHeight: '1.4'
                  }}>
                    {crmPreviewData?.sales_blockers}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* 1. 正在实施项目进度情况 */}
                <div style={{
                  border: crmSelectedKeys.crm_active_projects ? '2px solid #1677ff' : '1px solid #e8e8e8',
                  borderRadius: '12px',
                  backgroundColor: crmSelectedKeys.crm_active_projects ? '#f0f7ff' : '#ffffff',
                  padding: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Checkbox 
                      checked={crmSelectedKeys.crm_active_projects} 
                      onChange={val => setCrmSelectedKeys(prev => ({ ...prev, crm_active_projects: val }))}
                      style={{ '--font-size': '13px', '--icon-size': '16px' }}
                    >
                      <span style={{ fontWeight: 'bold', color: '#262626' }}>
                        📅 目前负责跟进的正在实施项目进度情况
                      </span>
                    </Checkbox>
                  </div>
                  <div style={{ 
                    whiteSpace: 'pre-wrap', 
                    maxHeight: '120px', 
                    overflowY: 'auto', 
                    fontFamily: 'monospace', 
                    fontSize: '12px', 
                    padding: '8px', 
                    border: '1px dashed #d9d9d9', 
                    borderRadius: '6px', 
                    backgroundColor: '#ffffff',
                    color: '#555',
                    lineHeight: '1.4'
                  }}>
                    {crmPreviewData?.crm_active_projects || '—'}
                  </div>
                </div>

                {/* 2. 本周项目子任务及里程碑节点交付动作明细 */}
                <div style={{
                  border: crmSelectedKeys.crm_milestone_tasks ? '2px solid #1677ff' : '1px solid #e8e8e8',
                  borderRadius: '12px',
                  backgroundColor: crmSelectedKeys.crm_milestone_tasks ? '#f0f7ff' : '#ffffff',
                  padding: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Checkbox 
                      checked={crmSelectedKeys.crm_milestone_tasks} 
                      onChange={val => setCrmSelectedKeys(prev => ({ ...prev, crm_milestone_tasks: val }))}
                      style={{ '--font-size': '13px', '--icon-size': '16px' }}
                    >
                      <span style={{ fontWeight: 'bold', color: '#262626' }}>
                        🗓 本周项目子任务及里程碑节点交付动作明细
                      </span>
                    </Checkbox>
                  </div>
                  <div style={{ 
                    whiteSpace: 'pre-wrap', 
                    maxHeight: '120px', 
                    overflowY: 'auto', 
                    fontFamily: 'monospace', 
                    fontSize: '12px', 
                    padding: '8px', 
                    border: '1px dashed #d9d9d9', 
                    borderRadius: '6px', 
                    backgroundColor: '#ffffff',
                    color: '#555',
                    lineHeight: '1.4'
                  }}>
                    {crmPreviewData?.crm_milestone_tasks || '—'}
                  </div>
                </div>

                {/* 3. 处于暂停或异常挂起状态的项目 */}
                <div style={{
                  border: crmSelectedKeys.crm_suspended_projects ? '2px solid #1677ff' : '1px solid #e8e8e8',
                  borderRadius: '12px',
                  backgroundColor: crmSelectedKeys.crm_suspended_projects ? '#f0f7ff' : '#ffffff',
                  padding: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Checkbox 
                      checked={crmSelectedKeys.crm_suspended_projects} 
                      onChange={val => setCrmSelectedKeys(prev => ({ ...prev, crm_suspended_projects: val }))}
                      style={{ '--font-size': '13px', '--icon-size': '16px' }}
                    >
                      <span style={{ fontWeight: 'bold', color: '#faad14' }}>
                        ⚠️ 处于暂停或异常挂起状态的项目
                      </span>
                    </Checkbox>
                  </div>
                  <div style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace', 
                    fontSize: '12px', 
                    padding: '8px', 
                    border: '1px dashed #d9d9d9', 
                    borderRadius: '6px', 
                    backgroundColor: '#ffffff',
                    color: '#555',
                    lineHeight: '1.4'
                  }}>
                    {crmPreviewData?.crm_suspended_projects || '—'}
                  </div>
                </div>

                {/* 4. 预设立立警 (超期未签合同) */}
                <div style={{
                  border: crmSelectedKeys.crm_no_contract_warning ? '2px solid #1677ff' : '1px solid #e8e8e8',
                  borderRadius: '12px',
                  backgroundColor: crmSelectedKeys.crm_no_contract_warning ? '#f0f7ff' : '#ffffff',
                  padding: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Checkbox 
                      checked={crmSelectedKeys.crm_no_contract_warning} 
                      onChange={val => setCrmSelectedKeys(prev => ({ ...prev, crm_no_contract_warning: val }))}
                      style={{ '--font-size': '13px', '--icon-size': '16px' }}
                    >
                      <span style={{ fontWeight: 'bold', color: '#ff4d4f' }}>
                        🚨 预设立立警 (超期未签合同)
                      </span>
                    </Checkbox>
                  </div>
                  <div style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace', 
                    fontSize: '12px', 
                    padding: '8px', 
                    border: '1px dashed #d9d9d9', 
                    borderRadius: '6px', 
                    backgroundColor: '#ffffff',
                    color: '#555',
                    lineHeight: '1.4'
                  }}>
                    {crmPreviewData?.crm_no_contract_warning || '—'}
                  </div>
                </div>

                {/* 5. 交付卡点 (有进度未开票) */}
                <div style={{
                  border: crmSelectedKeys.crm_unbilled_warning ? '2px solid #1677ff' : '1px solid #e8e8e8',
                  borderRadius: '12px',
                  backgroundColor: crmSelectedKeys.crm_unbilled_warning ? '#f0f7ff' : '#ffffff',
                  padding: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Checkbox 
                      checked={crmSelectedKeys.crm_unbilled_warning} 
                      onChange={val => setCrmSelectedKeys(prev => ({ ...prev, crm_unbilled_warning: val }))}
                      style={{ '--font-size': '13px', '--icon-size': '16px' }}
                    >
                      <span style={{ fontWeight: 'bold', color: '#faad14' }}>
                        ⚠️ 交付卡点 (有进度未开票)
                      </span>
                    </Checkbox>
                  </div>
                  <div style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace', 
                    fontSize: '12px', 
                    padding: '8px', 
                    border: '1px dashed #d9d9d9', 
                    borderRadius: '6px', 
                    backgroundColor: '#ffffff',
                    color: '#555',
                    lineHeight: '1.4'
                  }}>
                    {crmPreviewData?.crm_unbilled_warning || '—'}
                  </div>
                </div>

                {/* 6. 收欠款预警 (已开票未回款) */}
                <div style={{
                  border: crmSelectedKeys.crm_unreceived_warning ? '2px solid #1677ff' : '1px solid #e8e8e8',
                  borderRadius: '12px',
                  backgroundColor: crmSelectedKeys.crm_unreceived_warning ? '#f0f7ff' : '#ffffff',
                  padding: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Checkbox 
                      checked={crmSelectedKeys.crm_unreceived_warning} 
                      onChange={val => setCrmSelectedKeys(prev => ({ ...prev, crm_unreceived_warning: val }))}
                      style={{ '--font-size': '13px', '--icon-size': '16px' }}
                    >
                      <span style={{ fontWeight: 'bold', color: '#ff4d4f' }}>
                        🚨 收欠款预警 (已开票未回款)
                      </span>
                    </Checkbox>
                  </div>
                  <div style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace', 
                    fontSize: '12px', 
                    padding: '8px', 
                    border: '1px dashed #d9d9d9', 
                    borderRadius: '6px', 
                    backgroundColor: '#ffffff',
                    color: '#555',
                    lineHeight: '1.4'
                  }}>
                    {crmPreviewData?.crm_unreceived_warning || '—'}
                  </div>
                </div>

                {/* 7. 饱和度与健康度诊断 */}
                <div style={{
                  border: crmSelectedKeys.crm_health_diagnosis ? '2px solid #1677ff' : '1px solid #e8e8e8',
                  borderRadius: '12px',
                  backgroundColor: crmSelectedKeys.crm_health_diagnosis ? '#f0f7ff' : '#ffffff',
                  padding: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Checkbox 
                      checked={crmSelectedKeys.crm_health_diagnosis} 
                      onChange={val => setCrmSelectedKeys(prev => ({ ...prev, crm_health_diagnosis: val }))}
                      style={{ '--font-size': '13px', '--icon-size': '16px' }}
                    >
                      <span style={{ fontWeight: 'bold', color: '#ff4d4f' }}>
                        🩺 饱和度与健康度诊断
                      </span>
                    </Checkbox>
                  </div>
                  <div style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace', 
                    fontSize: '12px', 
                    padding: '8px', 
                    border: '1px dashed #d9d9d9', 
                    borderRadius: '6px', 
                    backgroundColor: '#ffffff',
                    color: '#555',
                    lineHeight: '1.4'
                  }}>
                    {crmPreviewData?.crm_health_diagnosis || '—'}
                  </div>
                </div>
              </>
            )}
          </Space>
        </div>
      </Popup>
    </div>
  )
}
