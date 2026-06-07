
import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Progress, Table, Button, Tag, Space, Typography, message, Modal, Input, Form, Badge, Select, Alert, Collapse, Checkbox, Upload, Radio, Spin, Tabs, Tooltip, Drawer, Divider, DatePicker, Descriptions } from 'antd'
import dayjs from 'dayjs'
import {
  DollarOutlined,
  HeartOutlined,
  SmileOutlined,
  SendOutlined,
  NotificationOutlined,
  FireOutlined,
  RiseOutlined,
  FlagOutlined,
  UserOutlined,
  FileTextOutlined,
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  LockOutlined,
  TrophyOutlined,
  SearchOutlined,
  TeamOutlined,
  ExportOutlined,
  SyncOutlined
} from '@ant-design/icons'
import { HAPPINESS_STANDARDS } from '@shared/data/happinessStandards'
import { getDashboardData, getMyStats, getTeamDetailedMetrics, getCompanyKpiDetail } from '@shared/api/dashboard'
import { get, post } from '@shared/api/client'
import { useAuthStore } from '@shared/stores/authStore'
import type { DashboardData, MyStatsResponse, RankingItem } from '@shared/types'

const { Title, Text } = Typography

const MATRIX_KPI_CONFIG = [
  { key: 'marketing_signing', label: '营销新签实际/目标', unit: '万元', headerBg: '#e6f7ff', titleColor: '#096dd9', width: 130 },
  { key: 'delivery_signing', label: '交付新签实际/目标', unit: '万元', headerBg: '#e6fffb', titleColor: '#08979c', width: 130 },
  { key: 'happiness_action', label: '客户幸福动作完成数', unit: '次', headerBg: '#feffe6', titleColor: '#ad8b00', width: 100 },
  { key: 'triangle_count', label: '售前铁三角联动次数', unit: '次', headerBg: '#f6ffed', titleColor: '#389e0d', width: 100 },
  { key: 'leads_count', label: '有效线索数', unit: '条', headerBg: '#fff2e8', titleColor: '#d4380d', width: 85 },
  { key: 'leads_conversion_rate', label: '线索转化率', unit: '%', headerBg: '#f9f0ff', titleColor: '#531dab', width: 85 },
  { key: 'new_customer_count', label: '新客户数', unit: '个', headerBg: '#fcffe6', titleColor: '#5b8c00', width: 85 },
  { key: 'happiness_story_count', label: '幸福故事数', unit: '个', headerBg: '#fff0f6', titleColor: '#c41d7f', width: 85 },
  { key: 'contract_count', label: '新签合同单数', unit: '个', headerBg: '#e6fffb', titleColor: '#08979c', width: 85 }
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

const Dashboard: React.FC = () => {
  const { user } = useAuthStore()
  const isMarketing = user?.position_type === 'marketing' || ['target_officer', 'marketing_staff', 'tech_marketing'].includes(user?.role || '');

  // 周复盘个人填写相关状态和函数
  const [hasWeeklyReport, setHasWeeklyReport] = useState(false)
  const [weeklyDate, setWeeklyDate] = useState<dayjs.Dayjs>(() => dayjs())
  const [weeklyWriteVisible, setWeeklyWriteVisible] = useState(false)
  const [weeklyWriteLoading, setWeeklyWriteLoading] = useState(false)
  const [weeklyExtractLoading, setWeeklyExtractLoading] = useState(false)
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
  const [weeklyCrmExtractLoading, setWeeklyCrmExtractLoading] = useState(false)

  // AI 助手智能整理状态
  const [weeklyAiOptimizing, setWeeklyAiOptimizing] = useState(false)
  const [aiOptimizeModalVisible, setAiOptimizeModalVisible] = useState(false)
  const [aiOptimizeForm] = Form.useForm()

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

  const getMondayAndSunday = (dateVal: dayjs.Dayjs) => {
    const day = dateVal.day()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const mon = dateVal.add(diffToMonday, 'day')
    const sun = mon.add(6, 'day')
    return [mon, sun]
  }

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

  const loadWeeklyReportData = async (dateVal: dayjs.Dayjs) => {
    setWeeklyWriteLoading(true)
    try {
      const [mon] = getMondayAndSunday(dateVal)
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

  const checkMyWeeklyReportStatus = async () => {
    try {
      const [mon] = getMondayAndSunday(dayjs())
      const startDateStr = mon.format('YYYY-MM-DD')
      const res = await get<any>(`/reports/weekly/mine?start_date=${startDateStr}`)
      const data = res?.data ? res.data : res
      if (data && data.id) {
        setHasWeeklyReport(true)
      } else {
        setHasWeeklyReport(false)
      }
    } catch (err) {
      setHasWeeklyReport(false)
    }
  }

  const openWeeklyWriteModal = () => {
    setWeeklyWriteVisible(true)
    const today = dayjs()
    setWeeklyDate(today)
    loadWeeklyReportData(today)
  }

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
        setHasWeeklyReport(true)
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '保存周报失败')
    } finally {
      setWeeklySubmitLoading(false)
    }
  }

  // 个人奋斗目标矩阵大盘状态变量，所有注释均采用中文
  const [matrixData, setMatrixData] = useState<any[]>([])
  const [matrixLoading, setMatrixLoading] = useState(false)
  const [matrixKeyword, setMatrixKeyword] = useState('')
  const [matrixTeamId, setMatrixTeamId] = useState<number | undefined>(undefined)
  const [matrixThirdClassBar, setMatrixThirdClassBar] = useState<string | undefined>(undefined)

  const fetchMatrixData = React.useCallback(async () => {
    setMatrixLoading(true)
    try {
      const params = new URLSearchParams()
      if (matrixKeyword) params.append('keyword', matrixKeyword)
      if (matrixTeamId) params.append('team_id', String(matrixTeamId))
      if (matrixThirdClassBar) params.append('third_class_bar', matrixThirdClassBar)
      
      const res: any = await get(`/dashboard/personal-goals?${params.toString()}`)
      if (res && res.items) {
        setMatrixData(res.items)
      }
    } catch (err) {
      console.error(err)
      message.error('加载矩阵大盘数据失败')
    } finally {
      setMatrixLoading(false)
    }
  }, [matrixKeyword, matrixTeamId, matrixThirdClassBar])
  
  // 统一权限判定函数，超级管理员默认拥有所有权限，无 permissions 字段时兜底为 true
  const hasPerm = (p: string) => {
    if (user?.role === 'admin') return true
    return user?.permissions?.includes(p) ?? true
  }

  const [data, setData] = useState<DashboardData | null>(null)
  const [personalStats, setPersonalStats] = useState<MyStatsResponse['personal_stats'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false)
  const [broadcastForm] = Form.useForm()
  const watchHappinessScore = Form.useWatch('happinessScore', broadcastForm)
  const [currentActionType, setCurrentActionType] = useState<string>('')
  const [fileList, setFileList] = useState<any[]>([])
  const [usersList, setUsersList] = useState<{ id: number; name: string }[]>([])
  const [crmProjects, setCrmProjects] = useState<any[]>([])
  const [crmLoading, setCrmLoading] = useState(false)
  const [crmCustomers, setCrmCustomers] = useState<string[]>([])
  const [crmProjectsSearch, setCrmProjectsSearch] = useState<string[]>([])
  
  const [teamMetricsModalVisible, setTeamMetricsModalVisible] = useState(false)
  const [selectedTeamMetrics, setSelectedTeamMetrics] = useState<any>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  
  // 新增重复播报校验及明细弹窗所需的状态变量
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false)
  const [duplicateCheckData, setDuplicateCheckData] = useState<{
    customerName: string;
    count: number;
    list: string[];
  } | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [pendingPublishValues, setPendingPublishValues] = useState<any>(null)
  
  const handleYesDuplicate = () => {
    // 点击“是”：直接关闭整个填报弹窗和重复提示弹窗，并重置表单和附件
    setBroadcastModalVisible(false)
    setDuplicateModalVisible(false)
    setPendingPublishValues(null)
    setShowDetails(false)
    broadcastForm.resetFields()
    setFileList([])
  }

  const handleNoDuplicate = async () => {
    // 点击“否”：允许用户发布，跳过拦截直接提报
    setDuplicateModalVisible(false)
    setShowDetails(false)
    if (pendingPublishValues) {
      await executePublishBroadcast(pendingPublishValues)
    }
  }
  
  // 日报自动生成器状态
  const [dailyReportModalVisible, setDailyReportModalVisible] = useState(false)
  const [dailyReportText, setDailyReportText] = useState('')
  const [dailyReportLoading, setDailyReportLoading] = useState(false)
  // 日报生成统计范围选择（'company' 代表全公司大盘，其它为战队 ID）
  const [selectedReportScope, setSelectedReportScope] = useState<string | number>('company')
  // 日报生成角色视角选择（'admin' 代表系统管理员，'digital_specialist' 代表数字专员，'target_officer' 代表目标官）
  const [selectedReportRole, setSelectedReportRole] = useState<string>('admin')

  useEffect(() => {
    if (user) {
      if (user.role === 'target_officer') {
        setSelectedReportRole('target_officer')
      } else if (user.role === 'digital_specialist') {
        setSelectedReportRole('digital_specialist')
      } else {
        setSelectedReportRole('admin')
      }
    }
  }, [user])

  const customUpload = async (options: any) => {
    const { file, onSuccess, onError } = options
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res: any = await post('/reports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (res && res.url) {
        onSuccess(res)
      } else {
        onError(new Error('上传图片失败'))
      }
    } catch (err) {
      onError(err)
    }
  }

  const handleGenerateDailyReport = async (scope?: string | number, roleParam?: string) => {
    try {
      // 判定传入的 scope 是否是有效的 string 或 number，以防 React MouseEvent 被当作 scope 传参
      const isScopeValid = scope !== undefined && typeof scope !== 'object'
      let finalScope: string | number = isScopeValid ? scope : selectedReportScope
      
      // 针对目标官，如果未指定且没有被初始化过，默认展示其所在的战队
      if (!isScopeValid && selectedReportScope === 'company' && user?.role === 'target_officer' && user?.team_id) {
        finalScope = user.team_id
        setSelectedReportScope(user.team_id)
      }

      let finalRole = roleParam !== undefined ? roleParam : selectedReportRole
      // 如果范围是全公司大盘，强制锁定为系统管理员角色视角
      if (finalScope === 'company') {
        finalRole = 'admin'
      } else {
        // 如果当前视角为 admin（因为刚才看的是大盘），但当前范围为具体战队，自动切换为合适的战队视角
        if (finalRole === 'admin') {
          if (user?.role === 'target_officer') {
            finalRole = 'target_officer'
          } else {
            // 超管或数字专员，切换至战队时默认显示数字专员视角（战队昨日）
            finalRole = 'digital_specialist'
          }
        }
      }
      setSelectedReportRole(finalRole)

      let url = `/dashboard/daily-report?role=${finalRole}`
      if (finalScope !== 'company') {
        url += `&team_id=${finalScope}`
      }

      setDailyReportLoading(true)
      const res: any = await get(url)
      if (res && res.text) {
        setDailyReportText(res.text)
        setDailyReportModalVisible(true)
      } else {
        message.error('生成日报失败，返回数据为空')
      }
    } catch (err) {
      message.error('日报生成接口调用失败')
    } finally {
      setDailyReportLoading(false)
    }
  }

  // 新增分摊分摊逻辑所需的临时状态
  const [formVersion, setFormVersion] = useState(0)
  const [selectedProjectMarketingUsers, setSelectedProjectMarketingUsers] = useState<any[]>([])

  // 线索明细弹窗状态
  const [leadsModalVisible, setLeadsModalVisible] = useState(false)
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [leadsList, setLeadsList] = useState<any[]>([])
  const [currentLeadType, setCurrentLeadType] = useState<string>('')
  const [currentLeadTeamName, setCurrentLeadTeamName] = useState<string>('')

  // 获取战队线索明细数据
  const handleViewLeadsList = async (teamId: number, leadType: 'valid' | 'potential', teamName: string) => {
    if (leadType === 'valid') {
      // 来源于本系统的有效线索库，如附件2
      setCompanyKpiDetailType('leads')
      setCompanyFilterTeamId(teamId)
      setCompanyFilterWeek(undefined)
      setCompanyFilterReporter(undefined)
      setCompanyFilterKeyword('')
      setCompanyKpiDetailModalVisible(true)
    } else {
      setLeadsModalVisible(true)
      setLeadsLoading(true)
      setLeadsList([])
      setCurrentLeadType('潜力需求线索')
      setCurrentLeadTeamName(teamName)
      try {
        const res = await get(`/dashboard/team-leads?team_id=${teamId}&lead_type=${leadType}`)
        if (res && Array.isArray(res)) {
          setLeadsList(res)
        }
      } catch (err: any) {
        // 捕获异常，并使用 message.error 提示用户连接失败的真实报错原因
        const errMsg = err?.response?.data?.detail || err?.message || '获取线索明细列表失败'
        message.error(errMsg)
        setLeadsModalVisible(false) // 失败时关闭二级Modal，避免显示空白弹框
      } finally {
        setLeadsLoading(false)
      }
    }
  }

  // 铁三角与幸福度下钻状态
  const [trianglesModalVisible, setTrianglesModalVisible] = useState(false)
  const [trianglesLoading, setTrianglesLoading] = useState(false)
  const [trianglesList, setTrianglesList] = useState<any[]>([])
  const [currentTriangleTeamName, setCurrentTriangleTeamName] = useState<string>('')

  const [happinessModalVisible, setHappinessModalVisible] = useState(false)
  const [happinessLoading, setHappinessLoading] = useState(false)
  const [happinessList, setHappinessList] = useState<any[]>([])
  const [currentHappinessTeamName, setCurrentHappinessTeamName] = useState<string>('')

  // 获取战队售前铁三角联动明细
  const handleViewTrianglesList = async (teamId: number, teamName: string) => {
    setTrianglesModalVisible(true)
    setTrianglesLoading(true)
    setTrianglesList([])
    setCurrentTriangleTeamName(teamName)
    try {
      const res = await get<any[]>(`/dashboard/team-triangles?team_id=${teamId}`)
      if (res && Array.isArray(res)) {
        setTrianglesList(res)
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.message || '获取铁三角明细列表失败'
      message.error(errMsg)
      setTrianglesModalVisible(false)
    } finally {
      setTrianglesLoading(false)
    }
  }

  // 获取战队客户幸福动作明细
  const handleViewHappinessList = async (teamId: number, teamName: string) => {
    setHappinessModalVisible(true)
    setHappinessLoading(true)
    setHappinessList([])
    setCurrentHappinessTeamName(teamName)
    try {
      const res = await get<any[]>(`/dashboard/team-happiness?team_id=${teamId}`)
      if (res && Array.isArray(res)) {
        setHappinessList(res)
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.message || '获取客户幸福动作明细列表失败'
      message.error(errMsg)
      setHappinessModalVisible(false)
    } finally {
      setHappinessLoading(false)
    }
  }

  // 二级铁三角明细表格列定义
  const trianglesColumns = [
    {
      title: '填报日期',
      dataIndex: 'report_date',
      key: 'report_date',
      width: 110,
      align: 'center' as const
    },
    {
      title: '提报人',
      dataIndex: 'reporter_name',
      key: 'reporter_name',
      width: 100,
      align: 'center' as const
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 140
    },
    {
      title: '联动搭档',
      dataIndex: 'partner_name',
      key: 'partner_name',
      width: 110,
      align: 'center' as const
    },
    {
      title: '播报内容',
      dataIndex: 'description',
      key: 'description',
      render: (val: string) => <div style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{val}</div>
    }
  ]

  // 二级幸福动作明细表格列定义
  const happinessColumns = [
    {
      title: '填报日期',
      dataIndex: 'report_date',
      key: 'report_date',
      width: 110,
      align: 'center' as const
    },
    {
      title: '提报人',
      dataIndex: 'reporter_name',
      key: 'reporter_name',
      width: 100,
      align: 'center' as const
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 140
    },
    {
      title: '标准分值',
      dataIndex: 'level',
      key: 'level',
      width: 110,
      align: 'center' as const,
      render: (val: string) => <strong style={{ color: '#3f51b5' }}>{val}</strong>
    },
    {
      title: '播报内容',
      dataIndex: 'description',
      key: 'description',
      render: (val: string) => <div style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{val}</div>
    }
  ]

  // 全公司 KPI 详情弹窗状态
  const [companyKpiDetailModalVisible, setCompanyKpiDetailModalVisible] = useState(false)
  const [companyKpiDetailLoading, setCompanyKpiDetailLoading] = useState(false)
  const [companyKpiDetailType, setCompanyKpiDetailType] = useState<'contracts' | 'happiness' | 'triangle' | 'leads' | 'tenders'>('contracts')
  const [companyKpiDetailData, setCompanyKpiDetailData] = useState<any>(null)
  const [companyExportLoading, setCompanyExportLoading] = useState(false)

  // 个人周战将榜轮播与手动切换状态，所有注释必须使用中文
  const [activeRankTab, setActiveRankTab] = useState<'marketing_signing' | 'delivery_signing' | 'leads' | 'happiness' | 'triangle'>('marketing_signing')

  // 周英雄榜实绩个人明细抽屉状态，所有注释必须使用中文
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<any[]>([])
  const [detailCategory, setDetailCategory] = useState<string>('')
  const [detailUser, setDetailUser] = useState<string>('')
  const [isDetailAll, setIsDetailAll] = useState<boolean>(false)

  // 周战将排行榜的战队与三级巴筛选状态，所有注释必须使用中文
  const [rankFilterTeamId, setRankFilterTeamId] = useState<number | undefined>(undefined)
  const [rankFilterThirdClassBar, setRankFilterThirdClassBar] = useState<string | undefined>(undefined)
  const [rankFilterLyingFlat, setRankFilterLyingFlat] = useState<boolean>(false)

  // 定时轮播：每 8 秒自动轮播一次，所有注释必须使用中文
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveRankTab(prev => {
        if (prev === 'marketing_signing') return 'delivery_signing'
        if (prev === 'delivery_signing') return 'leads'
        if (prev === 'leads') return 'happiness'
        if (prev === 'happiness') return 'triangle'
        return 'marketing_signing'
      })
    }, 8000)
    return () => clearInterval(timer)
  }, [])

  // 全公司 KPI 筛选条件状态变量，所有注释必须使用中文
  const [companyFilterTeamId, setCompanyFilterTeamId] = useState<number | undefined>(undefined)
  const [companyFilterWeek, setCompanyFilterWeek] = useState<number | undefined>(undefined)
  const [companyFilterReporter, setCompanyFilterReporter] = useState<string | undefined>(undefined)
  const [companyFilterKeyword, setCompanyFilterKeyword] = useState<string>('')

  // 接口返回的可用战队和提报人下拉缓存
  const [availableTeams, setAvailableTeams] = useState<any[]>([])
  const [availableReporters, setAvailableReporters] = useState<string[]>([])

  // 核心数据拉取函数，注释全部使用中文
  const loadCompanyKpiData = async (
    type: 'contracts' | 'happiness' | 'triangle' | 'leads' | 'tenders',
    params: {
      team_id?: number
      week?: number
      reporter_name?: string
      keyword?: string
    }
  ) => {
    setCompanyKpiDetailLoading(true)
    try {
      const res = await getCompanyKpiDetail({
        kpi_type: type,
        ...params
      })
      if (res) {
        setCompanyKpiDetailData(res)
        if (res.teams) {
          setAvailableTeams(res.teams)
        }
        if (res.reporters) {
          setAvailableReporters(res.reporters)
        }
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.message || '加载明细数据失败'
      message.error(errMsg)
    } finally {
      setCompanyKpiDetailLoading(false)
    }
  }

  // 导出全公司 KPI 明细数据为 Excel，所有注释必须使用中文
  const handleExportCompanyKpi = async () => {
    setCompanyExportLoading(true)
    try {
      const typeMap: Record<string, string> = {
        contracts: '公司累计新签合同额明细',
        happiness: '公司客户幸福动作明细',
        triangle: '售前铁三角联动明细',
        leads: '新增有效商机线索明细',
        tenders: '公司累计中标项目明细'
      }
      const title = typeMap[companyKpiDetailType] || '大盘指标明细'

      let url = `/dashboard/company-kpi-detail/export?kpi_type=${companyKpiDetailType}`
      const params = []
      if (companyFilterTeamId) {
        params.push(`team_id=${companyFilterTeamId}`)
      }
      if (companyFilterWeek) {
        params.push(`week=${companyFilterWeek}`)
      }
      if (companyFilterReporter) {
        params.push(`reporter_name=${encodeURIComponent(companyFilterReporter)}`)
      }
      if (companyFilterKeyword) {
        params.push(`keyword=${encodeURIComponent(companyFilterKeyword)}`)
      }
      if (params.length > 0) {
        url += '&' + params.join('&')
      }

      // 请求后端导出接口，接收 blob
      const response = await get<any>(url, { responseType: 'blob' })
      
      const blob = new Blob([response as any], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${title}_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      message.success(`${title}导出成功`)
    } catch (err) {
      console.error('导出 KPI 明细失败', err)
      message.error('导出 KPI 明细失败')
    } finally {
      setCompanyExportLoading(false)
    }
  }

  // 首次点击指标卡片，打开明细弹窗重置筛选条件，所有注释必须使用中文
  const handleViewCompanyKpiDetail = (type: 'contracts' | 'happiness' | 'triangle' | 'leads' | 'tenders') => {
    setCompanyKpiDetailType(type)
    setCompanyFilterTeamId(undefined)
    setCompanyFilterWeek(undefined)
    setCompanyFilterReporter(undefined)
    setCompanyFilterKeyword('')
    setCompanyKpiDetailModalVisible(true)
  }

  // 点击排行榜中员工实绩查看明细触发方法，所有注释必须使用中文
  const handleViewPersonalDetail = (userName: string, category: string, isAll = false) => {
    setDetailUser(userName)
    setDetailCategory(category)
    setIsDetailAll(isAll)
    setDetailData([])
    setDetailDrawerVisible(true)
    fetchPersonalWeeklyDetail(userName, category, isAll)
  }

  // 异步获取员工对应的指标详细数据列表，所有注释必须使用中文
  const fetchPersonalWeeklyDetail = async (userName: string, category: string, isAll = false) => {
    setDetailLoading(true)
    try {
      const res = await get<any>(`/dashboard/personal-weekly-detail?user_name=${encodeURIComponent(userName)}&category=${category}&is_all=${isAll}`)
      const data = res?.data ? res.data : res
      if (data && Array.isArray(data)) {
        setDetailData(data)
      } else {
        setDetailData([])
      }
    } catch (err) {
      console.error('拉取员工实绩明细失败', err)
      message.error('获取个人实绩明细失败')
      setDetailData([])
    } finally {
      setDetailLoading(false)
    }
  }

  // 渲染不同类别的明细表格列，全部注释必须使用中文
  const getDetailColumns = (category: string) => {
    const baseColumns = [
      {
        title: '日期',
        dataIndex: 'date',
        key: 'date',
        width: 95,
        align: 'center' as const
      },
      {
        title: '客户名称',
        dataIndex: 'customer_name',
        key: 'customer_name',
        width: 130,
        render: (val: string) => <div style={{ wordBreak: 'break-all' }}>{val || '未关联客户'}</div>
      }
    ]

    switch (category) {
      case 'marketing_signing':
      case 'delivery_signing':
      case 'contract_count':
      case 'new_customer_count':
        return [
          ...baseColumns,
          {
            title: '分摊金额',
            dataIndex: 'amount',
            key: 'amount',
            width: 95,
            align: 'right' as const,
            render: (val: number) => <strong style={{ color: '#ff4d4f' }}>{val} 万</strong>
          },
          {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            render: (val: string) => <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{val}</div>
          }
        ]
      case 'leads':
      case 'leads_count':
      case 'leads_conversion_rate':
        return [
          ...baseColumns,
          {
            title: '项目名称',
            dataIndex: 'project_name',
            key: 'project_name',
            width: 120,
            render: (val: string) => <div style={{ wordBreak: 'break-all' }}>{val || '未定'}</div>
          },
          {
            title: '预计金额',
            dataIndex: 'amount',
            key: 'amount',
            width: 90,
            align: 'right' as const,
            render: (val: number) => <strong style={{ color: '#722ed1' }}>{val} 万</strong>
          },
          {
            title: '播报描述',
            dataIndex: 'description',
            key: 'description',
            render: (val: string) => <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{val}</div>
          }
        ]
      case 'happiness':
      case 'happiness_action':
      case 'happiness_story_count':
        return [
          ...baseColumns,
          {
            title: '项目名称',
            dataIndex: 'project_name',
            key: 'project_name',
            width: 120,
            render: (val: string) => <div style={{ wordBreak: 'break-all' }}>{val || '未定'}</div>
          },
          {
            title: '关怀分',
            dataIndex: 'happiness_score',
            key: 'happiness_score',
            width: 75,
            align: 'center' as const,
            render: (val: number) => <Tag color="green" style={{ marginRight: 0 }}>+{val}分</Tag>
          },
          {
            title: '关怀动作描述',
            dataIndex: 'description',
            key: 'description',
            render: (val: string) => <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{val}</div>
          }
        ]
      case 'triangle':
      case 'triangle_count':
        return [
          ...baseColumns,
          {
            title: '联动描述',
            dataIndex: 'description',
            key: 'description',
            render: (val: string) => <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{val}</div>
          }
        ]
      default:
        return baseColumns
    }
  }

  // 监听筛选条件变动，防抖重新加载数据，所有注释必须使用中文
  useEffect(() => {
    if (companyKpiDetailModalVisible) {
      const timer = setTimeout(() => {
        loadCompanyKpiData(companyKpiDetailType, {
          team_id: companyFilterTeamId,
          week: companyFilterWeek,
          reporter_name: companyFilterReporter,
          keyword: companyFilterKeyword
        })
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [
    companyFilterTeamId,
    companyFilterWeek,
    companyFilterReporter,
    companyFilterKeyword,
    companyKpiDetailModalVisible,
    companyKpiDetailType
  ])

  // 新签合同明细下钻状态
  const [contractsModalVisible, setContractsModalVisible] = useState(false)
  const [contractsLoading, setContractsLoading] = useState(false)
  const [contractsList, setContractsList] = useState<any[]>([])
  const [currentContractType, setCurrentContractType] = useState<string>('')
  const [currentContractTeamName, setCurrentContractTeamName] = useState<string>('')

  // 获取战队合同/新签项目明细数据
  const handleViewContractsList = async (teamId: number, contractType: 'marketing' | 'delivery', teamName: string) => {
    setContractsModalVisible(true)
    setContractsLoading(true)
    setContractsList([])
    setCurrentContractType(contractType === 'marketing' ? '营销新签项目' : '交付新签项目')
    setCurrentContractTeamName(teamName)
    try {
      const res = await get<any>(`/dashboard/team-contracts?team_id=${teamId}&contract_type=${contractType}`)
      if (res && Array.isArray(res)) {
        setContractsList(res)
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.message || '获取新签合同明细列表失败'
      message.error(errMsg)
      setContractsModalVisible(false)
    } finally {
      setContractsLoading(false)
    }
  }

  // 二级合同新签项目明细列表表格列定义
  const contractsColumns = [
    {
      title: '签单日期',
      dataIndex: 'report_date',
      key: 'report_date',
      width: 110,
      align: 'center' as const
    },
    {
      title: '提报人',
      dataIndex: 'reporter_name',
      key: 'reporter_name',
      width: 100,
      align: 'center' as const
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 140
    },
    {
      title: '新签金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right' as const,
      render: (val: number) => <strong style={{ color: '#cf1322' }}>{val !== undefined ? `${val} 万元` : '0.0 万元'}</strong>
    },
    {
      title: '协同搭档',
      dataIndex: 'partner_name',
      key: 'partner_name',
      width: 100,
      align: 'center' as const
    },
    {
      title: '播报内容',
      dataIndex: 'description',
      key: 'description',
      render: (val: string) => <div style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{val}</div>
    }
  ]

  // 二级线索列表表格列定义
  const leadsColumns = [
    {
      title: '业务信息',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (val: string) => <a style={{ color: '#1677ff', textDecoration: 'underline' }}>{val}</a>
    },
    {
      title: '拓展进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 90,
      align: 'center' as const
    },
    {
      title: '最新反馈内容',
      dataIndex: 'latest_feedback',
      key: 'latest_feedback',
      width: 300,
      render: (val: string) => <div style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{val}</div>
    },
    {
      title: '业务线索状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center' as const
    },
    {
      title: '项目预算(万)',
      dataIndex: 'budget',
      key: 'budget',
      width: 110,
      align: 'right' as const,
      render: (val: number) => val !== undefined ? val : 0
    },
    {
      title: '预计金额(万)',
      dataIndex: 'forecast_amount',
      key: 'forecast_amount',
      width: 110,
      align: 'right' as const,
      render: (val: number) => val !== undefined ? val : 0
    },
    {
      title: '所属区域',
      dataIndex: 'region',
      key: 'region',
      width: 140
    },
    {
      title: '业务分类',
      dataIndex: 'business_category',
      key: 'business_category',
      width: 130
    },
    {
      title: '项目来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      align: 'center' as const
    },
    {
      title: '业主单位',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 260
    }
  ]

  const roundPct = (num: number) => {
    return Math.round(num * 100) / 100
  }

  const handleViewTeamMetrics = async (teamId: number) => {
    if (!teamId) return
    setTeamMetricsModalVisible(true)
    setMetricsLoading(true)
    setSelectedTeamMetrics(null)
    try {
      const res = await getTeamDetailedMetrics(teamId)
      if (res) {
        setSelectedTeamMetrics(res)
      }
    } catch (err) {
      message.error('获取战队多维度精细化指标失败')
    } finally {
      setMetricsLoading(false)
    }
  }

  // 加载系统内所有真实用户
  const loadUsersList = async () => {
    try {
      const res = await get('/users?page_size=1000')
      if (res && (res as any).items) {
        setUsersList((res as any).items)
      }
    } catch (err) {
      console.error('加载系统用户列表失败', err)
    }
  }

  // 异步获取 CRM 中对应进展阶段的潜在项目列表
  const loadCrmProjects = async (actionType: string) => {
    let progress = 25
    if (actionType === 'lead_25') progress = 25
    else if (actionType === 'lead_75') progress = 75
    else if (actionType === 'contract') progress = 90
    else return

    setCrmLoading(true)
    try {
      const res = await get<any[]>(`/broadcast/crm-projects?progress=${progress}`)
      if (res && Array.isArray(res)) {
        setCrmProjects(res)
      } else {
        setCrmProjects([])
      }
    } catch (err) {
      message.error('获取 CRM 对应项目失败，可能连接超时')
      setCrmProjects([])
    } finally {
      setCrmLoading(false)
    }
  }

  const handleValuesChange = (changedValues: any, allValues: any) => {
    const isMarketing = user?.position_type === 'marketing'
    const defaultDelivery = isMarketing ? [] : [{ userId: user?.id, ratio: 100 }]

    // A. 当选择动作类型改变时，请求 CRM 对应阶段项目并重置字段
    if (changedValues.actionType !== undefined) {
      const type = changedValues.actionType
      setCurrentActionType(type)
      setCrmProjects([])
      setSelectedProjectMarketingUsers([])
      if (['lead_25', 'lead_75', 'contract'].includes(type)) {
        loadCrmProjects(type)
      }
      broadcastForm.setFieldsValue({
        crmProjectId: undefined,
        customerName: '',
        amount: '',
        projectName: type === 'happiness' ? '未定' : '',
        contractName: '',
        budgetMoney: '',
        expectMoney: '',
        deliveryAllocations: defaultDelivery,
        marketingAllocations: [],
        employeeName: allValues.employeeName || user?.name || '',
        happinessScore: 20,
        actionDescription: '',
        content: type ? '奋战一百天，亮剑破六千！今日' : ''
      })
      if (type === 'happiness') {
        loadCrmProjectsSearch()
      }
      setFormVersion(v => v + 1)
      return
    }

    // B. 当选择 CRM 具体项目时，联动自动回填项目名、业主单位、预算/预计金额，并带出营销人员
    if (changedValues.crmProjectId !== undefined) {
      const projId = changedValues.crmProjectId
      const proj = crmProjects.find(p => p.id === projId)
      if (proj) {
        broadcastForm.setFieldsValue({
          customerName: proj.customer_name,
          projectName: proj.name,
          contractName: proj.name,
          budgetMoney: proj.budget_money,
          expectMoney: proj.expect_money,
          amount: proj.expect_money || proj.budget_money || 0.0,
          deliveryAllocations: defaultDelivery
        })
        // 回填到计算变量中
        allValues.customerName = proj.customer_name
        allValues.projectName = proj.name
        allValues.contractName = proj.name
        allValues.budgetMoney = proj.budget_money
        allValues.expectMoney = proj.expect_money
        allValues.amount = proj.expect_money || proj.budget_money || 0.0

        if (proj.marketing_users) {
          setSelectedProjectMarketingUsers(proj.marketing_users)
          const validMarketingUsers = proj.marketing_users.filter((mu: any) => mu.local_user_id !== null)
          
          let defaultMarketingAllocations: any[] = []
          if (validMarketingUsers.length === 1) {
            defaultMarketingAllocations = [{
              userId: validMarketingUsers[0].local_user_id,
              ratio: 100
            }]
          } else {
            const count = validMarketingUsers.length
            if (count > 0) {
              const avgRatio = Math.floor(100 / count)
              defaultMarketingAllocations = validMarketingUsers.map((mu: any, idx: number) => ({
                userId: mu.local_user_id,
                ratio: idx === count - 1 ? (100 - avgRatio * (count - 1)) : avgRatio
              }))
            }
          }
          
          broadcastForm.setFieldsValue({
            marketingAllocations: defaultMarketingAllocations
          })
        } else {
          setSelectedProjectMarketingUsers([])
          broadcastForm.setFieldsValue({
            marketingAllocations: []
          })
        }
      } else {
        setSelectedProjectMarketingUsers([])
      }
    }

    // 处理客户幸福动作标准项联动
    if (changedValues.actionType === 'happiness' || currentActionType === 'happiness') {
      if (changedValues.happinessScore !== undefined) {
        // 分值改变，清空已选标准和描述
        broadcastForm.setFieldsValue({
          selectedStandards: [],
          actionDescription: ''
        })
        allValues.selectedStandards = []
        allValues.actionDescription = ''
      } else if (changedValues.selectedStandards !== undefined) {
        // 勾选标准改变，拼接动作描述
        const selectedList: string[] = changedValues.selectedStandards || []
        const cleanedList = selectedList.map(item => item.replace(/[;；]$/, ''))
        const joined = cleanedList.join('；')
        broadcastForm.setFieldsValue({
          actionDescription: joined
        })
        allValues.actionDescription = joined
      }
    }

    // C. 重新计算生成捷报文字
    const { actionType, customerName, projectName, contractName, employeeName, happinessScore, actionDescription, budgetMoney, expectMoney, copartners, marketingCopartners, triangleResult, customerFeedback, happinessResult, happinessFeedback, recommendAction } = allValues
    if (!actionType) return
    
    const prefix = '奋战一百天，亮剑破六千！今日'
    let generated = ''
    
    switch (actionType) {
      case 'lead_25':
        generated = `${prefix}确定有效线索：客户为${customerName || 'XX'}，项目金额${expectMoney || 0.0}万，赢战百日！`
        break
      case 'lead_75':
        generated = `${prefix}确定${projectName || 'XX'}项目中地承接，客户为${customerName || 'XX'}，项目金额${expectMoney || 0.0}万，赢战百日！`
        break
      case 'contract':
        generated = `${prefix}确定${contractName || 'XX'}项目走完合同流程，客户为${customerName || 'XX'}，项目金额${expectMoney || 0.0}万 nudge，赢战百日！`.replace(" nudge", "")
        break
      case 'triangle': {
        const copartnersStr = copartners && copartners.length > 0 ? copartners.join('、') : '';
        const marketingStr = marketingCopartners && marketingCopartners.length > 0 ? marketingCopartners.join('、') : '';
        let partnersInfo = '';
        if (copartnersStr && marketingStr) {
          partnersInfo = `联动人(${copartnersStr})、营销人员(${marketingStr})`;
        } else if (copartnersStr) {
          partnersInfo = `联动人(${copartnersStr})`;
        } else if (marketingStr) {
          partnersInfo = `营销人员(${marketingStr})`;
        }
        const partnerPart = partnersInfo ? `，与${partnersInfo}` : '';
        generated = `${prefix}我司【${employeeName || 'XX'}】${partnerPart}在【${customerName || 'XX'}】开展售前铁三角联动。\n联动动作：${actionDescription || 'XX'}。\n成果：${triangleResult || 'XX'}。\n客户反馈：${customerFeedback || 'XX'}。\n为客户幸福而奋斗，赢战百日！`;
        break;
      }
      case 'happiness': {
        const feedbackLine = happinessFeedback ? `\n客户反馈：${happinessFeedback}。` : '';
        const projectPart = projectName ? `，关联项目【${projectName}】` : '，关联项目【未定】';
        generated = `${prefix}我司【${employeeName || 'XX'}】做到客户幸福标准【${happinessScore ?? 0}分】动作，对象为【${customerName || 'XX'}】${projectPart}，动作描述：${actionDescription || 'XX'}。\n成果：${happinessResult || 'XX'}。${feedbackLine}\n内部可推广复制的做法：${recommendAction || 'XX'}。\n为客户幸福而奋斗，赢战百日！`;
        break;
      }
      default:
        break
    }
    
    broadcastForm.setFieldsValue({ content: generated })
    
    // 强制触发组件重绘以更新折算金额与统计
    setFormVersion(v => v + 1)
  }

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      // 1. 获取全盘大屏概览数据，带上周战将排行榜专有筛选条件
      const res = await getDashboardData({
        team_id: rankFilterTeamId,
        third_class_bar: rankFilterThirdClassBar,
        is_lying_flat: rankFilterLyingFlat
      })
      if (res) {
        setData(res as any)
      }

      // 2. 获取当前用户个人级联实绩与目标（用于个人双水位盘展示）
      const statsRes = await getMyStats()
      if (statsRes) {
        setPersonalStats((statsRes as any).personal_stats)
      }

      // 3. 检查当前用户本周是否已填写过周报
      await checkMyWeeklyReportStatus()
    } catch (err: any) {
      console.error(err)
      const detailError = err?.response?.data?.detail || err?.message || '加载系统作战看板数据失败'
      message.error(`诊断错误: ${detailError}`, 10)
    } finally {
      setLoading(false)
    }
  }

  const customerSearchTimerRef = React.useRef<any>(null)

  const handleCustomerSearch = (val: string) => {
    if (customerSearchTimerRef.current) {
      clearTimeout(customerSearchTimerRef.current)
    }
    customerSearchTimerRef.current = setTimeout(() => {
      loadCrmCustomers(val)
    }, 300)
  }

  // 异步获取 CRM 数据库中的客户名称列表
  const loadCrmCustomers = async (keyword?: string) => {
    try {
      let url = '/broadcast/crm-customers'
      if (keyword) {
        url += `?keyword=${encodeURIComponent(keyword)}`
      }
      const res = await get<any>(url)
      const data = res?.data ? res.data : res
      if (data && Array.isArray(data)) {
        setCrmCustomers(data)
      } else {
        setCrmCustomers([])
      }
    } catch (err) {
      console.error('加载 CRM 客户列表失败', err)
      setCrmCustomers([])
    }
  }

  const projectSearchTimerRef = React.useRef<any>(null)

  const handleProjectSearch = (val: string) => {
    if (projectSearchTimerRef.current) {
      clearTimeout(projectSearchTimerRef.current)
    }
    projectSearchTimerRef.current = setTimeout(() => {
      loadCrmProjectsSearch(val)
    }, 300)
  }

  // 异步获取 CRM 数据库中的项目名称列表，支持模糊搜索，限制返回条数，按创建时间倒序
  const loadCrmProjectsSearch = async (keyword?: string) => {
    try {
      let url = '/broadcast/crm-projects-search'
      if (keyword) {
        url += `?keyword=${encodeURIComponent(keyword)}`
      }
      const res = await get<any>(url)
      const data = res?.data ? res.data : res
      if (data && Array.isArray(data)) {
        setCrmProjectsSearch(data)
      } else {
        setCrmProjectsSearch([])
      }
    } catch (err) {
      console.error('加载 CRM 项目列表失败', err)
      setCrmProjectsSearch([])
    }
  }

  useEffect(() => {
    if (broadcastModalVisible) {
      loadCrmCustomers()
      loadCrmProjectsSearch()
    }
  }, [broadcastModalVisible])

  // 监听排行榜专属过滤状态变化，自动重载概览数据，所有注释必须使用中文
  useEffect(() => {
    loadData()
  }, [rankFilterTeamId, rankFilterThirdClassBar, rankFilterLyingFlat])

  // 监听矩阵大盘过滤状态变化，自动重载矩阵大盘数据，所有注释必须使用中文
  useEffect(() => {
    fetchMatrixData()
  }, [fetchMatrixData])

  useEffect(() => {
    loadUsersList()
  }, [])

  const handleFetchPassword = async (id: number) => {
    try {
      const res = await get<any>(`/broadcast/${id}/password`)
      const data = res?.data ? res.data : res
      if (data && data.password) {
        Modal.info({
          title: '🔑 附件解压密码',
          content: (
            <div>
              <p>解压密码为：<strong style={{ fontSize: 16, color: '#722ed1' }}>{data.password}</strong></p>
              <p style={{ color: '#8c8c8c', fontSize: 12 }}>请复制密码并妥善保管，勿随意转发。</p>
            </div>
          ),
          okText: '确定'
        })
      } else {
        message.error('获取密码失败')
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || '权限不足或网络异常'
      message.error(`获取密码失败: ${errMsg}`)
    }
  }

  // 真正执行发布广播的底层方法，所有注释采用中文
  const executePublishBroadcast = async (values: any) => {
    try {
      if (values.actionType === 'station_report') {
        const formData = new FormData()
        formData.append('station_category', values.stationCategory)
        formData.append('station_location', values.stationLocation)
        formData.append('title', values.title)
        formData.append('content', values.content)
        if (values.summary) {
          formData.append('summary', values.summary)
        }
        formData.append('is_urgent', String(!!values.isUrgent))
        formData.append('push_channel', 'all')
        
        if (fileList && fileList.length > 0) {
          fileList.forEach((file: any) => {
            if (file.originFileObj) {
              formData.append('files', file.originFileObj)
            } else if (file.raw) {
              formData.append('files', file.raw)
            }
          })
        }
        
        const res = await post<any>('/broadcast/station-report', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        
        if (res) {
          message.success('驻点快报发布成功，大屏端与钉钉已同步推送且附件已加密！')
          setBroadcastModalVisible(false)
          setCurrentActionType('')
          setFileList([])
          broadcastForm.resetFields()
          loadData()
        }
        return
      }

      let deliveryAllocations: any[] = []
      let marketingAllocations: any[] = []

      if (values.actionType === 'contract') {
        const contractAmt = parseFloat(values.expectMoney || 0)
        if (isNaN(contractAmt) || contractAmt <= 0) {
          message.error('请输入有效的合同价格！')
          return
        }

        // A. 校验交付业绩分配比例
        if (values.deliveryAllocations && values.deliveryAllocations.length > 0) {
          let deliveryRatioSum = 0
          const userSet = new Set()
          for (const item of values.deliveryAllocations) {
            if (!item.userId) {
              message.error('交付业绩分配中存在未选择员工的记录！')
              return
            }
            if (userSet.has(item.userId)) {
              message.error('交付业绩分配人员不能重复！')
              return
            }
            userSet.add(item.userId)
            
            const ratio = parseFloat(item.ratio || 0)
            if (isNaN(ratio) || ratio <= 0) {
              message.error('每个分摊人员的比例必须大于 0%！')
              return
            }
            deliveryRatioSum += ratio
            deliveryAllocations.push({
              user_id: item.userId,
              ratio: ratio,
              amount: (ratio * contractAmt) / 100
            })
          }

          if (Math.abs(deliveryRatioSum - 100) > 0.01) {
            message.error(`交付新签分配比例总和必须等于 100%！当前累计为: ${deliveryRatioSum.toFixed(2)}%`)
            return
          }
        } else {
          message.error('请添加交付新签业绩分配人员！')
          return
        }

        // B. 校验营销业绩分配比例
        if (values.marketingAllocations && values.marketingAllocations.length > 0) {
          let marketingRatioSum = 0
          const userSet = new Set()
          for (const item of values.marketingAllocations) {
            if (!item.userId) {
              message.error('营销业绩分配中存在未选择员工的记录！')
              return
            }
            if (userSet.has(item.userId)) {
              message.error('营销业绩分配人员不能重复！')
              return
            }
            userSet.add(item.userId)
            
            const ratio = parseFloat(item.ratio || 0)
            if (isNaN(ratio) || ratio <= 0) {
              message.error('每个营销分摊人员的比例必须大于 0%！')
              return
            }
            marketingRatioSum += ratio
            marketingAllocations.push({
              user_id: item.userId,
              ratio: ratio,
              amount: (ratio * contractAmt) / 100
            })
          }

          if (Math.abs(marketingRatioSum - 100) > 0.01) {
            message.error(`营销新签分配比例总和必须等于 100%！当前累计为: ${marketingRatioSum.toFixed(2)}%`)
            return
          }
        } else {
          message.error('请添加营销新签业绩分配人员！')
          return
        }
      }

      const attachment_urls = fileList
        .filter(file => file.status === 'done' || file.url)
        .map(file => file.url || file.response?.url)
        .filter(Boolean)

      const payload: any = {
        event_type: values.actionType === 'contract' ? 'contract_signed' : values.actionType,
        content: values.content,
        push_channel: 'all',
        action_type: values.actionType,
        customer_name: values.customerName || values.contractName || values.projectName || '',
        amount: values.amount ? parseFloat(values.amount) : undefined,
        employee_name: values.employeeName,
        happiness_score: values.happinessScore !== undefined ? parseInt(values.happinessScore) : undefined,
        action_description: values.actionDescription,
        // 新增 CRM 关联属性
        budget_money: values.budgetMoney ? parseFloat(values.budgetMoney) : undefined,
        expect_money: values.expectMoney ? parseFloat(values.expectMoney) : undefined,
        crm_opportunity_id: values.crmProjectId,
        project_name: values.projectName || '未定',
        // 铁三角联动新增多选人员
        copartners: values.copartners,
        marketing_copartners: values.marketingCopartners,
        attachment_urls: attachment_urls.length > 0 ? attachment_urls : undefined
      }

      if (values.actionType === 'contract') {
        payload.delivery_allocations = deliveryAllocations
        payload.marketing_allocations = marketingAllocations
        payload.amount = parseFloat(values.expectMoney)
        payload.expect_money = parseFloat(values.expectMoney)
      }

      const res = await post('/broadcast', payload)
      if (res) {
        message.success('广播发布成功，大屏端与钉钉已同步推送并记录各自分配实绩')
        setBroadcastModalVisible(false)
        setCurrentActionType('')
        setSelectedProjectMarketingUsers([])
        setFileList([])
        broadcastForm.resetFields()
        loadData()
      }
    } catch (err) {
      message.error('发布失败')
    }
  }

  // 提交战报广播的前置检测与拦截校验方法
  const handlePublishBroadcast = async (values: any) => {
    if (values.actionType === 'station_report') {
      await executePublishBroadcast(values)
      return
    }

    // 1. 进行业绩比例校验等前置校验，防止格式不正确时仍弹框
    if (values.actionType === 'contract') {
      const contractAmt = parseFloat(values.expectMoney || 0)
      if (isNaN(contractAmt) || contractAmt <= 0) {
        message.error('请输入有效的合同价格！')
        return
      }
      if (!values.deliveryAllocations || values.deliveryAllocations.length === 0) {
        message.error('请添加交付新签业绩分配人员！')
        return
      }
      if (!values.marketingAllocations || values.marketingAllocations.length === 0) {
        message.error('请添加营销新签业绩分配人员！')
        return
      }
    }

    try {
      const customerName = values.customerName || values.contractName || values.projectName || ''
      // 请求后端进行重复检测与明细条数拉取
      const checkRes = await post<any>('/broadcast/check-duplicate', {
        content: values.content,
        customer_name: customerName
      })
      const checkData = checkRes?.data ? checkRes.data : checkRes
      
      if (checkData && checkData.is_duplicate) {
        // 重复了，拦截并弹出提示 Modal，暂存 values
        setPendingPublishValues(values)
        setDuplicateCheckData({
          customerName: customerName || '当前客户',
          count: checkData.triangle_count || 0,
          list: checkData.triangle_list || []
        })
        setShowDetails(false)
        setDuplicateModalVisible(true)
        return
      }
    } catch (err: any) {
      console.error('播报重复性检测发生异常，跳过检测直接发布', err)
      const errorMsg = err?.response?.data?.detail || err?.message || '未知网络错误'
      message.warning(`播报重复性检测服务暂时离线或异常（错误：${errorMsg}），已直接发布。`)
    }

    // 若未发生重复或检查无拦截，正常执行发布
    await executePublishBroadcast(values)
  }

  const kpis = data?.kpiSummary

  // 构造战队赛马数据
  const teamRankingDataSource: any[] = []
  if (data?.zoneTeamsPK) {
    Object.entries(data.zoneTeamsPK).forEach(([zoneName, teams]) => {
      teams.forEach((t, idx) => {
        teamRankingDataSource.push({
          zoneName,
          rank: t.rank,
          name: t.name,
          score: t.score,
          trend: t.trend,
          weeklyMarketingActual: t.weeklyMarketingActual,
          weeklyMarketingTarget: t.weeklyMarketingTarget,
          weeklyDeliveryActual: t.weeklyDeliveryActual,
          weeklyDeliveryTarget: t.weeklyDeliveryTarget,
          key: `${zoneName}-${t.name}`,
          rowSpan: idx === 0 ? teams.length : 0
        })
      })
    })
  }

  const zoneColumns = [
    { 
      title: '战区名称', 
      dataIndex: 'zoneName', 
      key: 'zoneName',
      onCell: (record: any) => ({
        rowSpan: record.rowSpan
      }),
      render: (val: string) => <span style={{ fontWeight: 'bold' }}>{val}</span>
    },
    { 
      title: '区内排名', 
      dataIndex: 'rank', 
      key: 'rank', 
      width: 90, 
      render: (val: number) => <Tag color={val === 1 ? 'gold' : val === 2 ? 'blue' : 'default'}>Top {val}</Tag> 
    },
    { title: '战队名称', dataIndex: 'name', key: 'name', width: 140 },
    { 
      title: '营销 (万)', 
      key: 'marketing',
      width: 105,
      render: (record: any) => {
        const act = record.weeklyMarketingActual ?? 0
        const tgt = record.weeklyMarketingTarget ?? 0
        return <span>{act.toFixed(1).replace('.0', '')}/{tgt.toFixed(1).replace('.0', '')}</span>
      }
    },
    { 
      title: '交付 (万)', 
      key: 'delivery',
      width: 105,
      render: (record: any) => {
        const act = record.weeklyDeliveryActual ?? 0
        const tgt = record.weeklyDeliveryTarget ?? 0
        return <span>{act.toFixed(1).replace('.0', '')}/{tgt.toFixed(1).replace('.0', '')}</span>
      }
    },
    { title: '完成百分比 (%)', dataIndex: 'score', key: 'score', width: 115, render: (val: number) => <strong>{val}%</strong> },
    { title: '趋势', dataIndex: 'trend', key: 'trend', width: 90, render: (val: string) => val === 'up' ? <Tag color="success">↑ 上升</Tag> : val === 'down' ? <Tag color="error">↓ 下降</Tag> : <Tag color="warning">→ 持平</Tag> }
  ]

  const getRankListDetails = () => {
    switch (activeRankTab) {
      case 'delivery_signing':
        return {
          title: '🏆 交付签单先锋周战将榜 (TOP 15)',
          unit: '万元',
          color: '#08979c',
          list: data?.deliveryHeroBoard || []
        }
      case 'leads':
        return {
          title: '🔍 周线索先锋奖榜 (TOP 15)',
          unit: '条',
          color: '#1677ff',
          list: data?.leadsBoard || []
        }
      case 'happiness':
        return {
          title: '🌟 周客户幸福动作卷王榜 (TOP 15)',
          unit: '次',
          color: '#52c41a',
          list: data?.happinessBoard || []
        }
      case 'triangle':
        return {
          title: '🤝 周铁三角协作标杆榜 (TOP 15)',
          unit: '次',
          color: '#fa8c16',
          list: data?.triangleBoard || []
        }
      case 'marketing_signing':
      default:
        return {
          title: '🏆 营销签单先锋周战将榜 (TOP 15)',
          unit: '万元',
          color: '#ff4d4f',
          list: data?.marketingHeroBoard || []
        }
    }
  }

  // 状态灯辅助方法
  const getLightStatus = (light: 'red' | 'yellow' | 'green' | undefined) => {
    if (light === 'green') return 'success'
    if (light === 'yellow') return 'warning'
    return 'error'
  }

  const getLightText = (light: 'red' | 'yellow' | 'green' | undefined) => {
    if (light === 'green') return '势头强劲'
    if (light === 'yellow') return '稍有落后'
    return '预警红灯'
  }

  const zone1Teams = data?.dualTrackTeams?.slice(0, 3) || []
  const zone2Teams = data?.dualTrackTeams?.slice(3, 6) || []
  const zone3Teams = data?.dualTrackTeams?.slice(6, 9) || []

  const renderTeamCard = (t: any, idx: number) => {
    return (
      <Col xs={24} sm={12} md={8} key={t.teamName || idx}>
        <Card
          hoverable
          onClick={() => t.teamId && handleViewTeamMetrics(t.teamId)}
          size="small"
          title={<strong style={{ fontSize: 15, cursor: 'pointer' }}>{t.teamName}</strong>}
          extra={
            <Space>
              <Badge status={getLightStatus(t.statusLight)} text={getLightText(t.statusLight)} />
            </Space>
          }
          style={{
            background: '#fafafa',
            border: `1px solid ${t.statusLight === 'red' ? '#ffa39e' : t.statusLight === 'yellow' ? '#ffe58f' : '#d9d9d9'}`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <Text type="secondary">战队巴长：</Text><strong>{t.leader}</strong>
          </div>

          <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 6, border: '1px solid #f0f0f0', marginTop: 8 }}>
            {/* 营销新签进度 */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <Text type="secondary">营销新签实际/目标</Text>
                <strong>{t.marketingActual} / {t.marketingTarget} 万 ({t.marketingRate}%)</strong>
              </div>
              <Progress percent={t.marketingRate} size="small" strokeColor="#1677ff" showInfo={false} />
            </div>

            {/* 交付新签进度 */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <Text type="secondary">交付新签实际/目标</Text>
                <strong>{t.deliveryActual} / {t.deliveryTarget} 万 ({t.deliveryRate}%)</strong>
              </div>
              <Progress percent={t.deliveryRate} size="small" strokeColor="#52c41a" showInfo={false} />
            </div>

            {/* 有效线索进度 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <Text type="secondary">有效线索实际/目标</Text>
                <strong>{t.validLeadsActual ?? 0} / {t.validLeadsTarget ?? 0} 条 ({(t.validLeadsRate ?? 0)}%)</strong>
              </div>
              <Progress percent={t.validLeadsRate ?? 0} size="small" strokeColor="#faad14" showInfo={false} />
            </div>
          </div>
        </Card>
      </Col>
    )
  }

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>⚔️ 百日奋战经营作战大盘 (管理端)</Title>
          <Text type="secondary">
            口号：{data?.slogan || '奋战一百天，亮剑破六千！'} | 战役倒计时还剩 <strong>{data?.countdown || 71}</strong> 天 | 
            当前登录人：<strong>{user?.name || '管理员'}</strong> ({user?.position || '系统管理员'})
          </Text>
        </Col>
        <Col>
          <Space>
            {['admin', 'digital_specialist', 'target_officer'].includes(user?.role || '') && (
              <Button 
                type="primary" 
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }} 
                icon={<FileTextOutlined />} 
                loading={dailyReportLoading}
                onClick={() => handleGenerateDailyReport()}
              >
                生成今日日报
              </Button>
            )}
            <Button
              type="primary"
              ghost
              icon={<FileTextOutlined />}
              onClick={openWeeklyWriteModal}
            >
              {hasWeeklyReport ? '编辑我的周报' : '填写我的周报'}
            </Button>
            <Button icon={<FireOutlined />} onClick={loadData} loading={loading}>刷新看板</Button>
            <Button type="primary" icon={<NotificationOutlined />} onClick={() => {
              setCurrentActionType('')
              setBroadcastModalVisible(true)
              setFileList([])
              broadcastForm.setFieldsValue({
                actionType: undefined,
                employeeName: user?.name || ''
              })
            }}>
              发送实时战报
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 第一级：🏆 公司战役总盘五大指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap' }}>
        <Col xs={24} sm={12} style={{ flex: '1 1 20%', minWidth: '220px' }}>
          <Card 
            className="card-kpi" 
            variant="borderless"
            hoverable
            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
            onClick={() => handleViewCompanyKpiDetail('contracts')}
          >
            <Statistic
              title="💰 公司累计新签合同额"
              value={kpis?.newContracts.value}
              precision={2}
              styles={{ content: { color: '#1677ff', fontSize: 26, fontWeight: 700 } }}
              prefix={<DollarOutlined />}
              suffix="万元"
            />
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary">目标: {kpis?.newContracts.target}万</Text>
                <Text strong color="#1677ff">{kpis?.newContracts.percentage}%</Text>
              </div>
              <Progress percent={kpis?.newContracts.percentage} size="small" strokeColor="#1677ff" />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} style={{ flex: '1 1 20%', minWidth: '220px' }}>
          <Card 
            className="card-kpi" 
            variant="borderless"
            hoverable
            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
            onClick={() => handleViewCompanyKpiDetail('happiness')}
          >
            <Statistic
              title="😊 公司客户幸福动作"
              value={kpis?.happinessActions.value}
              styles={{ content: { color: '#52c41a', fontSize: 26, fontWeight: 700 } }}
              prefix={<HeartOutlined />}
              suffix="次"
            />
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary">目标: {kpis?.happinessActions.target}次</Text>
                <Text strong color="#52c41a">{kpis?.happinessActions.percentage}%</Text>
              </div>
              <Progress percent={kpis?.happinessActions.percentage} size="small" strokeColor="#52c41a" />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} style={{ flex: '1 1 20%', minWidth: '220px' }}>
          <Card 
            className="card-kpi" 
            variant="borderless"
            hoverable
            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
            onClick={() => handleViewCompanyKpiDetail('triangle')}
          >
            <Statistic
              title="🤝 售前铁三角联动次数"
              value={kpis?.ironTriangle.value}
              styles={{ content: { color: '#fa8c16', fontSize: 26, fontWeight: 700 } }}
              prefix={<SmileOutlined />}
              suffix="次"
            />
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary">目标: {kpis?.ironTriangle.target}次</Text>
                <Text strong color="#fa8c16">{kpis?.ironTriangle.percentage}%</Text>
              </div>
              <Progress percent={kpis?.ironTriangle.percentage} size="small" strokeColor="#fa8c16" />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} style={{ flex: '1 1 20%', minWidth: '220px' }}>
          <Card 
            className="card-kpi" 
            variant="borderless"
            hoverable
            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
            onClick={() => handleViewCompanyKpiDetail('tenders')}
          >
            <Statistic
              title="🏆 公司累计中标项目"
              value={kpis?.tenderProjects?.value}
              styles={{ content: { color: '#13c2c2', fontSize: 26, fontWeight: 700 } }}
              prefix={<TrophyOutlined />}
              suffix="个"
            />
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary">目标: {kpis?.tenderProjects?.target}个</Text>
                <Text strong style={{ color: '#13c2c2' }}>{kpis?.tenderProjects?.percentage}%</Text>
              </div>
              <Progress percent={kpis?.tenderProjects?.percentage} size="small" strokeColor="#13c2c2" />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} style={{ flex: '1 1 20%', minWidth: '220px' }}>
          <Card 
            className="card-kpi" 
            variant="borderless"
            hoverable
            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
            onClick={() => handleViewCompanyKpiDetail('leads')}
          >
            <Statistic
              title="🔍 新增有效商机线索"
              value={kpis?.validLeads.value}
              styles={{ content: { color: '#722ed1', fontSize: 26, fontWeight: 700 } }}
              prefix={<RiseOutlined />}
              suffix="条"
            />
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary">目标: {kpis?.validLeads.target}条</Text>
                <Text strong color="#722ed1">{kpis?.validLeads.percentage}%</Text>
              </div>
              <Progress percent={kpis?.validLeads.percentage} size="small" strokeColor="#722ed1" />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 第二级：⚔️ 战队双轨（营销/交付）新签九宫格对战PK版 */}
      <Card 
        title={<span><FlagOutlined style={{ marginRight: 8 }} />战队双轨动力大PK (3x3九宫格看板，点击卡片可查看战队多维度指标)</span>} 
        style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
          {/* 第一战区 */}
          {zone1Teams.length > 0 && (
            <div>
              <div style={{ 
                padding: '6px 16px', 
                background: '#e6f7ff', 
                borderLeft: '4px solid #1890ff', 
                fontWeight: 'bold', 
                fontSize: '14px',
                color: '#0050b3',
                marginBottom: 12, 
                borderRadius: '0 4px 4px 0', 
                display: 'inline-block',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}>
                🔵 第一战区（清远战队、广州一战队、广州二战队）
              </div>
              <Row gutter={[16, 16]}>
                {zone1Teams.map((t, idx) => renderTeamCard(t, idx))}
              </Row>
            </div>
          )}

          {/* 第二战区 */}
          {zone2Teams.length > 0 && (
            <div>
              <div style={{ 
                padding: '6px 16px', 
                background: '#f9f0ff', 
                borderLeft: '4px solid #722ed1', 
                fontWeight: 'bold', 
                fontSize: '14px',
                color: '#531dab',
                marginBottom: 12, 
                borderRadius: '0 4px 4px 0', 
                display: 'inline-block',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}>
                🟣 第二战区（广州三战队（大数据）、佛山战队、湛江战队）
              </div>
              <Row gutter={[16, 16]}>
                {zone2Teams.map((t, idx) => renderTeamCard(t, idx + 3))}
              </Row>
            </div>
          )}

          {/* 第三战区 */}
          {zone3Teams.length > 0 && (
            <div>
              <div style={{ 
                padding: '6px 16px', 
                background: '#fff0f6', 
                borderLeft: '4px solid #eb2f96', 
                fontWeight: 'bold', 
                fontSize: '14px',
                color: '#c41d7f',
                marginBottom: 12, 
                borderRadius: '0 4px 4px 0', 
                display: 'inline-block',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}>
                🔴 第三战区（云浮战队、东莞战队、茂名战队）
              </div>
              <Row gutter={[16, 16]}>
                {zone3Teams.map((t, idx) => renderTeamCard(t, idx + 6))}
              </Row>
            </div>
          )}
        </div>
      </Card>

      {/* 第三级：战区赛马 & 个人英雄榜 & 个人岗位考核水位 */}
      <Row gutter={[16, 16]}>
        {/* 各战区战队冲刺排名 */}
        <Col xs={24} lg={10}>
          <Card title="🏆 各战区战队冲刺排名" variant="borderless" style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <Table
              dataSource={teamRankingDataSource}
              columns={zoneColumns}
              rowKey="key"
              pagination={false}
              loading={loading}
              size="small"
              bordered
            />
          </Card>
        </Col>

        {/* 个人英雄榜 */}
        <Col xs={24} lg={7}>
          <Card 
            title={<span>{getRankListDetails().title}</span>}
            extra={<span style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 'normal', whiteSpace: 'nowrap' }}>⏳ 8s 轮播</span>}
            variant="borderless" 
            style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
          >
            {/* 5个 Tab 按钮选择器 */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
              {[
                { id: 'marketing_signing', label: '营销签单' },
                { id: 'delivery_signing', label: '交付签单' },
                { id: 'leads', label: '线索先锋' },
                { id: 'happiness', label: '幸福卷王' },
                { id: 'triangle', label: '铁三角协作' }
              ].map(t => {
                const isActive = activeRankTab === t.id
                const isDelivery = t.id === 'delivery_signing'
                return (
                  <Button
                    key={t.id}
                    size="small"
                    onClick={() => setActiveRankTab(t.id as any)}
                    style={{
                      fontSize: 11,
                      padding: '0 6px',
                      height: 22,
                      background: isActive 
                        ? isDelivery 
                          ? '#08979c' 
                          : '#ff4d4f'
                        : '#f5f5f5',
                      borderColor: isActive 
                        ? isDelivery 
                          ? '#08979c' 
                          : '#ff4d4f'
                        : '#d9d9d9',
                      color: isActive ? '#ffffff' : '#595959',
                      fontWeight: isActive ? 'bold' : 'normal',
                      borderRadius: 4
                    }}
                  >
                    {t.label}
                  </Button>
                )
              })}
            </div>

            {/* 排行榜过滤器操作栏（按战队、按三级巴筛选及躺平榜切换开关），所有注释必须使用中文 */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, paddingBottom: 8, borderBottom: '1px dashed #f0f0f0' }}>
              <Select
                placeholder="按战队"
                allowClear
                size="small"
                style={{ width: 100 }}
                value={rankFilterTeamId}
                onChange={(val) => setRankFilterTeamId(val)}
                popupMatchSelectWidth={false}
              >
                {(data as any)?.teams?.map((t: any) => (
                  <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
                ))}
              </Select>
              <Select
                placeholder="按三级巴"
                allowClear
                size="small"
                style={{ width: 110 }}
                value={rankFilterThirdClassBar}
                onChange={(val) => setRankFilterThirdClassBar(val)}
                popupMatchSelectWidth={false}
              >
                {(data as any)?.thirdClassBars?.map((b: string) => (
                  <Select.Option key={b} value={b}>{b}</Select.Option>
                ))}
              </Select>
            </div>

            {/* 英雄榜数据列表容器 */}
            <div style={{ paddingRight: 4 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}><Spin size="small" /></div>
              ) : getRankListDetails().list.slice(0, 15).length === 0 ? (
                <div style={{ textAlign: 'center', color: '#bfbfbf', fontSize: 12, padding: '20px 0' }}>暂无当周数据记录</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {getRankListDetails().list.slice(0, 15).map((item, index) => {
                    const details = getRankListDetails()
                    return (
                      <div key={index} style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              backgroundColor: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#f5f5f5',
                              color: index < 3 ? '#fff' : '#666',
                              textAlign: 'center',
                              lineHeight: '20px',
                              fontWeight: 'bold',
                              fontSize: 11
                            }}
                          >
                            {index + 1}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 'bold' }}>{item.name}</span>
                            <span style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 'normal' }}>{item.teamName}</span>
                          </div>
                        </div>
                        <div>
                          <Tooltip title="点击查看本周实绩详情 🔍">
                            <span 
                              onClick={() => handleViewPersonalDetail(item.name, activeRankTab)}
                              style={{ 
                                color: details.color, 
                                fontSize: 13, 
                                cursor: 'pointer', 
                                fontWeight: 'bold', 
                                textDecoration: 'underline',
                                transition: 'all 0.3s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = '0.7';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = '1';
                              }}
                            >
                              {details.unit === '万元' ? item.score.toFixed(1).replace('.0', '') : Math.round(item.score)} {details.unit}
                            </span>
                          </Tooltip>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* 个人双轨考核水位 */}
        <Col xs={24} lg={7}>
            <Card title={<span><UserOutlined style={{ marginRight: 8 }} />🎯 我的个人考核双水位</span>} variant="borderless" style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              {personalStats && personalStats.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {personalStats.map((item: any, idx: number) => {
                    const maxVal = Math.max(item.challenge_target, item.actual, 1)
                    const basePct = (item.base_target / maxVal) * 100
                    const challengePct = (item.challenge_target / maxVal) * 100
                    const actualPct = (item.actual / maxVal) * 100

                    return (
                      <div key={idx} style={{ marginBottom: 14, borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text strong>{item.goal_name}</Text>
                          <Text type="success" strong>实际：{item.actual} {item.unit}</Text>
                        </div>

                        {/* 自定义双轨水位进度条 */}
                        <div style={{ position: 'relative', height: 10, background: '#e8e8e8', borderRadius: 5, margin: '6px 0' }}>
                          {/* 实际值条 */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              height: '100%',
                              width: `${Math.min(actualPct, 100)}%`,
                              background: 'linear-gradient(90deg, #1677ff, #00d4ff)',
                              borderRadius: 5
                            }}
                          />
                          {/* 基础水位红色刻度 */}
                          <div
                            style={{
                              position: 'absolute',
                              left: `${basePct}%`,
                              top: -2,
                              bottom: -2,
                              width: 2.5,
                              backgroundColor: '#ff4d4f',
                              zIndex: 2
                            }}
                            title={`基础水位: ${item.base_target}`}
                          />
                          {/* 挑战水位金色刻度 */}
                          <div
                            style={{
                              position: 'absolute',
                              left: `${challengePct}%`,
                              top: -2,
                              bottom: -2,
                              width: 2.5,
                              backgroundColor: '#ffd700',
                              zIndex: 2
                            }}
                            title={`挑战水位: ${item.challenge_target}`}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c' }}>
                          <span>🔴 基础:{item.base_target} ({item.actual >= item.base_target ? '达成✅' : '未达'})</span>
                          <span>🟡 挑战:{item.challenge_target} ({item.actual >= item.challenge_target ? '破线🔥' : '未破'})</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                  系统管理员/中台无个人冲刺考核指标
                </div>
              )}
            </Card>
          </Col>
      </Row>

      {/* 📊 个人奋斗目标实际完成矩阵大盘，所有注释均采用中文 */}
      {(() => {
        // 个人奋斗目标矩阵大盘 Table 列定义
        const matrixColumns = [
          {
            title: '基本信息',
            fixed: 'left' as const,
            children: [
              { 
                title: '姓名', 
                dataIndex: 'user_name', 
                key: 'user_name', 
                width: 95, 
                fixed: 'left' as const, 
                render: (val: string) => <strong>{val}</strong> 
              },
              { 
                title: '归属战队', 
                dataIndex: 'team_name', 
                key: 'team_name', 
                width: 125, 
                fixed: 'left' as const 
              }
            ]
          },
          ...MATRIX_KPI_CONFIG.map(kpi => {
            return {
              title: (
                <div style={{ 
                  background: kpi.headerBg, 
                  color: kpi.titleColor,
                  padding: '12px 8px', 
                  margin: '-16px -8px', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  borderBottom: '1px solid #f0f0f0',
                  borderRadius: '4px 4px 0 0'
                }}>
                  {kpi.label} ({kpi.unit})
                </div>
              ),
              key: kpi.key,
              width: kpi.width,
              align: 'center' as const,
              render: (_: any, record: any) => {
                const goal = record.goals[kpi.key]
                if (!goal || !goal.is_configured) {
                  return <span style={{ color: '#ccc' }}>—</span>
                }
                
                const val = goal.actual !== null && goal.actual !== undefined ? goal.actual : 0.0
                const baseTarget = goal.base_target !== null && goal.base_target !== undefined ? goal.base_target : 0.0

                let formattedVal = typeof val === 'number' ? val.toFixed(2).replace('.00', '') : val
                let formattedTarget = typeof baseTarget === 'number' ? baseTarget.toFixed(2).replace('.00', '') : baseTarget

                if (kpi.key === 'marketing_signing' || kpi.key === 'delivery_signing') {
                  formattedVal = typeof val === 'number' ? val.toFixed(1).replace('.0', '') : val
                  formattedTarget = typeof baseTarget === 'number' ? baseTarget.toFixed(1).replace('.0', '') : baseTarget
                } else if (kpi.key === 'leads_conversion_rate') {
                  formattedVal = typeof val === 'number' ? val.toFixed(1).replace('.0', '') : val
                  formattedTarget = typeof baseTarget === 'number' ? baseTarget.toFixed(1).replace('.0', '') : baseTarget
                } else if (kpi.key === 'happiness_action' || kpi.key === 'triangle_count' || kpi.key === 'leads_count' || kpi.key === 'new_customer_count' || kpi.key === 'happiness_story_count' || kpi.key === 'contract_count') {
                  formattedVal = Math.round(val)
                  formattedTarget = Math.round(baseTarget)
                }

                const isAchieved = baseTarget > 0 && val >= baseTarget;
                const showColor = baseTarget > 0;

                const actualNode = val > 0 ? (
                  <Tooltip title="点击查看个人累计实绩明细 🔍">
                    <span 
                      onClick={() => handleViewPersonalDetail(record.user_name, kpi.key, true)}
                      style={{ 
                        fontWeight: 'bold', 
                        color: showColor ? (isAchieved ? '#52c41a' : '#ff4d4f') : '#1677ff', 
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {formattedVal}
                    </span>
                  </Tooltip>
                ) : (
                  <span style={{ fontWeight: 'bold', color: showColor ? (isAchieved ? '#52c41a' : '#ff4d4f') : 'inherit' }}>
                    {formattedVal}
                  </span>
                )
                
                return (
                  <div>
                    {actualNode}
                    <span style={{ color: '#8c8c8c', marginLeft: 4 }} title="奋斗目标">/ {formattedTarget}</span>
                  </div>
                )
              }
            }
          })
        ]

        // 个人奋斗目标矩阵大盘汇总行渲染，仅对实际值累加，目标值不加总
        const renderSummary = (pageData: any[]) => {
          let totalMarketingActual = 0
          let totalDeliveryActual = 0
          let totalHappinessActionActual = 0
          let totalTriangleActual = 0
          let totalLeadsActual = 0
          let totalNewCustomerActual = 0
          let totalStoryActual = 0
          let totalContractCountActual = 0

          pageData.forEach(row => {
            const goals = row.goals || {}
            totalMarketingActual += goals.marketing_signing?.actual || 0
            totalDeliveryActual += goals.delivery_signing?.actual || 0
            totalHappinessActionActual += goals.happiness_action?.actual || 0
            totalTriangleActual += goals.triangle_count?.actual || 0
            totalLeadsActual += goals.leads_count?.actual || 0
            totalNewCustomerActual += goals.new_customer_count?.actual || 0
            totalStoryActual += goals.happiness_story_count?.actual || 0
            totalContractCountActual += goals.contract_count?.actual || 0
          })

          const totalLeadsConversionActual = totalLeadsActual > 0 
            ? ((totalContractCountActual / totalLeadsActual) * 100).toFixed(1).replace('.0', '')
            : '0'

          return (
            <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
              <Table.Summary.Cell index={0} fixed="left">
                <strong>汇总</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} fixed="left">
                <span>—</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="center">
                <span style={{ color: '#096dd9' }}>{totalMarketingActual.toFixed(1).replace('.0', '')} 万元</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="center">
                <span style={{ color: '#08979c' }}>{totalDeliveryActual.toFixed(1).replace('.0', '')} 万元</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="center">
                <span style={{ color: '#ad8b00' }}>{Math.round(totalHappinessActionActual)} 次</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="center">
                <span style={{ color: '#389e0d' }}>{Math.round(totalTriangleActual)} 次</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="center">
                <span style={{ color: '#d4380d' }}>{Math.round(totalLeadsActual)} 条</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="center">
                <span style={{ color: '#531dab' }}>{totalLeadsConversionActual} %</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="center">
                <span style={{ color: '#5b8c00' }}>{Math.round(totalNewCustomerActual)} 个</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={9} align="center">
                <span style={{ color: '#c41d7f' }}>{Math.round(totalStoryActual)} 个</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={10} align="center">
                <span style={{ color: '#08979c' }}>{Math.round(totalContractCountActual)} 个</span>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )
        }

        return (
          <Card 
            title={<span><TeamOutlined style={{ marginRight: 8 }} />📊 个人奋斗目标实际完成矩阵大盘</span>} 
            variant="borderless" 
            style={{ marginTop: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
          >
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="middle">
              <Col xs={24} sm={8} md={6}>
                <Input.Search
                  placeholder="搜索姓名或手机号"
                  allowClear
                  value={matrixKeyword}
                  onChange={(e) => setMatrixKeyword(e.target.value)}
                  onSearch={fetchMatrixData}
                  enterButton={<SearchOutlined />}
                />
              </Col>
              <Col xs={12} sm={6} md={5}>
                <Select
                  style={{ width: '100%' }}
                  value={matrixTeamId}
                  placeholder="筛选战队"
                  allowClear
                  onChange={(val) => setMatrixTeamId(val)}
                  popupMatchSelectWidth={false}
                >
                  {(data as any)?.teams?.map((t: any) => (
                    <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
                  ))}
                </Select>
              </Col>
              <Col xs={12} sm={6} md={5}>
                <Select
                  style={{ width: '100%' }}
                  value={matrixThirdClassBar}
                  placeholder="筛选三级巴"
                  allowClear
                  onChange={(val) => setMatrixThirdClassBar(val)}
                  popupMatchSelectWidth={false}
                >
                  {(data as any)?.thirdClassBars?.map((b: string) => (
                    <Select.Option key={b} value={b}>{b}</Select.Option>
                  ))}
                </Select>
              </Col>
            </Row>

            <Table
              dataSource={matrixData}
              columns={matrixColumns}
              rowKey="user_id"
              loading={matrixLoading}
              pagination={{
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 人已配目标`,
                defaultPageSize: 10,
                pageSizeOptions: ['10', '20', '50', '100']
              }}
              scroll={{ x: 'max-content' }}
              bordered
              summary={renderSummary}
            />
          </Card>
        )
      })()}

      {/* 实时动态战报 */}
      <Card title="🔔 战役实时攻坚播报" variant="borderless" style={{ marginTop: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Spin spinning={loading}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(!data?.liveFeed || data.liveFeed.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#8c8c8c' }}>暂无战报播报</div>
            ) : (
              data.liveFeed.map((item: any, idx: number) => (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    justifyContent: 'space-between', 
                    padding: '12px 0',
                    borderBottom: idx === data.liveFeed.length - 1 ? 'none' : '1px solid #f0f0f0' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                    {/* 固定 75px 的标签容器，实现左侧标签垂直整齐对齐 */}
                    <div style={{ width: 75, flexShrink: 0, marginRight: 16, display: 'flex', justifyContent: 'center' }}>
                      <Tag 
                        color={
                          item.type === 'contract' ? 'error' : 
                          item.type === 'achievement' ? 'success' : 
                          item.type === 'milestone' ? 'warning' : 
                          item.type === 'station_report' ? 'magenta' : 'processing'
                        }
                        style={{ 
                          whiteSpace: 'normal', 
                          wordBreak: 'break-all', 
                          height: 'auto', 
                          lineHeight: '1.3', 
                          padding: '4px 6px',
                          textAlign: 'center',
                          marginRight: 0,
                          width: '100%',
                          fontSize: 12
                        }}
                      >
                        {
                          item.type === 'contract' ? '合同新签' : 
                          item.type === 'achievement' ? '有效线索' : 
                          item.type === 'milestone' ? (item.content.includes('幸福') ? '幸福动作' : '阶段中标') : 
                          item.type === 'station_report' ? '驻点快报' : '售前铁三角联动'
                        }
                      </Tag>
                    </div>
                    {/* 正文文本，支持长文字自动折行 */}
                    <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                      <Text style={{ fontSize: 13, wordBreak: 'break-all', lineHeight: '1.5' }}>{item.content}</Text>
                      {item.attachment_urls && item.attachment_urls.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                          <Button 
                            type="link" 
                            size="small" 
                            icon={<DownloadOutlined />}
                            href={item.attachment_urls[0].url} 
                            target="_blank"
                            style={{ padding: 0 }}
                          >
                            下载加密附件
                          </Button>
                          <Button 
                            type="link" 
                            size="small" 
                            icon={<LockOutlined />}
                            onClick={() => handleFetchPassword(item.id)}
                            style={{ padding: 0, color: '#722ed1' }}
                          >
                            获取解压密码
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* 右侧时间，确保绝对不折行 */}
                  <div style={{ flexShrink: 0, marginLeft: 16, whiteSpace: 'nowrap', color: '#8c8c8c', fontSize: 12, paddingTop: 4 }}>
                    {item.time}
                  </div>
                </div>
              ))
            )}
          </div>
        </Spin>
      </Card>

      {/* 手动发送播报Modal */}
      <Modal
        title="发布实时战报（广播至4K大屏与钉钉）"
        open={broadcastModalVisible}
        onCancel={() => {
          setBroadcastModalVisible(false)
          setCurrentActionType('')
        }}
        onOk={() => broadcastForm.submit()}
        destroyOnHidden
      >
        <Form 
          form={broadcastForm} 
          layout="vertical" 
          onFinish={handlePublishBroadcast}
          onValuesChange={handleValuesChange}
        >
          <Form.Item
            name="actionType"
            label="战报动作类型"
            rules={[{ required: true, message: '请选择战报动作类型' }]}
          >
            <Select placeholder="请选择要发布的战报动作">
              <Select.Option value="contract">已完成合同签订（双方盖章）</Select.Option>
              <Select.Option value="triangle">铁三角联动</Select.Option>
              <Select.Option value="happiness">客户幸福动作</Select.Option>
              <Select.Option value="station_report">驻点人员播报</Select.Option>
            </Select>
          </Form.Item>

          {currentActionType === 'station_report' && (
            <>
              <Form.Item
                name="stationLocation"
                label="驻点地点"
                rules={[{ required: true, message: '请输入驻点地点（如：广州、茂名）' }]}
              >
                <Input placeholder="请输入驻点地点，例如：茂名、湛江、广州" />
              </Form.Item>

              <Form.Item
                name="stationCategory"
                label="驻点播报分类"
                rules={[{ required: true, message: '请选择驻点播报分类' }]}
              >
                <Select placeholder="请选择分类">
                  <Select.Option value="policy">🏛️ 最新政策</Select.Option>
                  <Select.Option value="deployment">📋 重大会议部署</Select.Option>
                  <Select.Option value="lead">🎯 潜在项目线索</Select.Option>
                  <Select.Option value="intelligence">🔍 重大情报信息</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="title"
                label="播报标题"
                rules={[{ required: true, message: '请输入播报标题' }]}
              >
                <Input placeholder="请输入播报标题" />
              </Form.Item>

              <Form.Item
                name="content"
                label="正文内容"
                rules={[{ required: true, message: '请输入正文内容' }]}
              >
                <Input.TextArea rows={4} placeholder="请输入具体的播报正文内容..." />
              </Form.Item>

              <Form.Item
                name="summary"
                label="内容摘要（选填，不填则根据正文自动生成前150字）"
              >
                <Input.TextArea rows={2} placeholder="用于钉钉消息推送预览，限150字以内" maxLength={150} />
              </Form.Item>

              <Form.Item
                name="isUrgent"
                label="是否紧急快报"
                valuePropName="checked"
              >
                <Checkbox style={{ color: '#ff4d4f' }}>
                  🚨 紧急播报（勾选后将通过钉钉群发并强提醒 @所有人 ！）
                </Checkbox>
              </Form.Item>

              <Form.Item label="📎 上传附件文件（支持多文件，单次上传及打包后总大小限 50MB 以内）">
                <Upload
                  beforeUpload={() => false}
                  fileList={fileList}
                  onChange={({ fileList }) => {
                    const totalSize = fileList.reduce((acc, f) => acc + (f.size || 0), 0)
                    if (totalSize > 50 * 1024 * 1024) {
                      message.error('文件总大小不能超过 50MB！')
                      fileList.pop()
                    }
                    setFileList([...fileList])
                  }}
                  multiple
                >
                  <Button icon={<UploadOutlined />}>选择文件（Word/PDF/ZIP/图片等）</Button>
                </Upload>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                  注意：Supabase 免费版单文件限制 50MB，文件将通过 AES-256 安全加密打包
                </div>
              </Form.Item>
            </>
          )}

          {['lead_25', 'lead_75', 'contract'].includes(currentActionType) && (
            <Form.Item
              name="crmProjectId"
              label={
                currentActionType === 'contract'
                  ? '从项目管理系统的合同表获取'
                  : currentActionType === 'lead_75'
                  ? '从投标室确认标讯系统中标项目中获取'
                  : '选择对应 CRM 中进展阶段为 25% 的项目'
              }
              rules={[{ required: true, message: '请选择对应的 CRM 潜在项目' }]}
            >
              <Select
                showSearch
                loading={crmLoading}
                placeholder="键入检索 CRM 项目名称..."
                optionFilterProp="label"
                filterOption={(input, option) =>
                  ((option as any)?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={crmProjects.map(p => ({
                  value: p.id,
                  label: `${p.name} | 业主：${p.customer_name}`
                }))}
              />
            </Form.Item>
          )}

          {currentActionType === 'lead_25' && (
            <>
              <Form.Item name="customerName" label="客户名称" rules={[{ required: true, message: '选择项目后自动填入' }]}>
                <Input disabled placeholder="选择项目后自动回填业主单位" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="budgetMoney" label="项目预算金额 (万元)">
                    <Input disabled placeholder="自动回填" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="expectMoney" label="预计金额 (万元)">
                    <Input disabled placeholder="自动回填" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="amount" noStyle><Input type="hidden" /></Form.Item>
            </>
          )}

          {currentActionType === 'lead_75' && (
            <>
              <Form.Item name="projectName" label="项目名称" rules={[{ required: true, message: '选择项目后自动填入' }]}>
                <Input disabled placeholder="选择项目后自动回填" />
              </Form.Item>
              <Form.Item name="customerName" label="客户名称" rules={[{ required: true, message: '选择项目后自动填入' }]}>
                <Input disabled placeholder="选择项目后自动回填业主单位" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="budgetMoney" label="项目预算金额 (万元)">
                    <Input disabled placeholder="自动回填" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="expectMoney" label="预计金额 (万元)">
                    <Input disabled placeholder="自动回填" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="amount" noStyle><Input type="hidden" /></Form.Item>
            </>
          )}

          {currentActionType === 'contract' && (() => {
            const expectMoneyVal = parseFloat(broadcastForm.getFieldValue('expectMoney') || 0);
            const deliveryAllocationsVal = broadcastForm.getFieldValue('deliveryAllocations') || [];
            
            // 实时累计已分配的交付比例
            const deliveryRatioTotal = deliveryAllocationsVal.reduce((acc: number, curr: any) => acc + parseFloat(curr?.ratio || 0), 0);
            
            // 实时累计已分配的营销比例
            const marketingAllocationsVal = broadcastForm.getFieldValue('marketingAllocations') || [];
            const marketingRatioTotal = marketingAllocationsVal.reduce((acc: number, curr: any) => acc + parseFloat(curr?.ratio || 0), 0);
              
            return (
              <>
                <Form.Item name="contractName" label="合同/项目名称" rules={[{ required: true, message: '选择项目后自动填入' }]}>
                  <Input disabled placeholder="选择项目后自动回填" />
                </Form.Item>
                <Form.Item name="customerName" label="客户名称" rules={[{ required: true, message: '选择项目后自动填入' }]}>
                  <Input disabled placeholder="选择项目后自动回填业主单位" />
                </Form.Item>
                
                <Form.Item name="expectMoney" label="合同价格 (万元)" rules={[{ required: true, message: '请填写合同价格' }]}>
                  <Input type="number" step="0.0001" placeholder="自动回填且可手动修改" />
                </Form.Item>
                
                {/* 交付新签业绩分配 */}
                <div style={{ marginTop: 16, marginBottom: 16, padding: 12, border: '1px solid #f0f0f0', borderRadius: 8, backgroundColor: '#fafafa' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#333' }}>
                    <span style={{ color: '#ff4d4f', marginRight: 4, fontFamily: 'SimSun, sans-serif' }}>*</span>
                    交付新签业绩分配（合同总额：{expectMoneyVal.toFixed(2)} 万元）
                    <span style={{ fontSize: 12, fontWeight: 'normal', color: '#666', marginLeft: 8 }}>
                      (除了营销岗以外的人员，如技术、交付人员)
                    </span>
                  </div>
                  <Form.List name="deliveryAllocations">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }) => {
                          const ratio = parseFloat(broadcastForm.getFieldValue(['deliveryAllocations', name, 'ratio']) || 0);
                          const allocatedAmount = ((ratio * expectMoneyVal) / 100).toFixed(2);
                          return (
                            <div key={key} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8, width: '100%' }}>
                              <div style={{ flex: 10, minWidth: 0 }}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'userId']}
                                  rules={[{ required: true, message: '请选择分摊员工' }]}
                                  noStyle
                                >
                                  <Select
                                    showSearch
                                    placeholder="选择分摊员工"
                                    optionFilterProp="label"
                                    options={usersList
                                      .filter(u => u.position_type !== 'marketing')
                                      .map(u => ({
                                        value: u.id,
                                        label: `${u.name} | ${u.position || '交付/技术'}`
                                      }))}
                                  />
                                </Form.Item>
                              </div>
                              <div style={{ flex: 8, minWidth: 0 }}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'ratio']}
                                  rules={[{ required: true, message: '比例' }]}
                                  noStyle
                                >
                                  <Input
                                    type="number"
                                    placeholder="比例 (%)"
                                    suffix="%"
                                    style={{ width: '100%' }}
                                  />
                                </Form.Item>
                              </div>
                              <div style={{ flex: 4, minWidth: 0, textAlign: 'right', paddingRight: 4, whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 12, color: '#888' }}>
                                  {allocatedAmount} 万元
                                </span>
                              </div>
                              <div style={{ flex: 2, minWidth: 0, textAlign: 'right' }}>
                                <Button type="link" danger onClick={() => remove(name)} style={{ padding: 0 }}>
                                  删除
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        <Form.Item noStyle>
                          <Button type="dashed" onClick={() => add()} block style={{ marginTop: 8 }}>
                            + 添加交付分摊员工
                          </Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                  
                  {/* 交付比率统计 */}
                  <div style={{ marginTop: 8, fontSize: 12, textAlign: 'right', color: '#666' }}>
                    已分配累计比例：
                    <span style={{ fontWeight: 'bold', color: Math.abs(deliveryRatioTotal - 100) < 0.01 ? 'green' : 'red' }}>
                      {deliveryRatioTotal.toFixed(2)} %
                    </span>
                    （必须等于 100%）
                  </div>
                </div>

                {/* 营销新签业绩分配 */}
                <div style={{ marginTop: 16, marginBottom: 16, padding: 12, border: '1px solid #f0f0f0', borderRadius: 8, backgroundColor: '#fafafa' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#333' }}>
                    <span style={{ color: '#ff4d4f', marginRight: 4, fontFamily: 'SimSun, sans-serif' }}>*</span>
                    营销新签业绩分配（合同总额：{expectMoneyVal.toFixed(2)} 万元）
                    <span style={{ fontSize: 12, fontWeight: 'normal', color: '#666', marginLeft: 8 }}>
                      (当前 CRM 项目对应的营销人员分摊，支持手动增删与微调)
                    </span>
                  </div>

                  {/* 未绑定提示 */}
                  {selectedProjectMarketingUsers.some(mu => mu.local_user_id === null) && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', border: '1px dashed #ffa39e', backgroundColor: '#fff1f0', borderRadius: 6 }}>
                      <div style={{ color: '#cf1322', fontSize: 12, fontWeight: 'bold' }}>
                        ⚠️ 提示：当前 CRM 项目的以下营销人员未绑定本系统账号，无法自动分摊：
                      </div>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 12, color: '#cf1322' }}>
                        {selectedProjectMarketingUsers.filter(mu => mu.local_user_id === null).map(mu => (
                          <li key={mu.crm_user_id}>{mu.name} (CRM账户ID: {mu.crm_user_id})</li>
                        ))}
                      </ul>
                      <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                        请在下方点击“+ 添加营销分摊员工”手动指定参与分配的营销人员。
                      </div>
                    </div>
                  )}

                  <Form.List name="marketingAllocations">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }) => {
                          const ratio = parseFloat(broadcastForm.getFieldValue(['marketingAllocations', name, 'ratio']) || 0);
                          const allocatedAmount = ((ratio * expectMoneyVal) / 100).toFixed(2);
                          return (
                            <div key={key} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8, width: '100%' }}>
                              <div style={{ flex: 10, minWidth: 0 }}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'userId']}
                                  rules={[{ required: true, message: '请选择营销员工' }]}
                                  noStyle
                                >
                                  <Select
                                    showSearch
                                    placeholder="选择营销分摊员工"
                                    optionFilterProp="label"
                                    options={usersList
                                      .filter(u => u.position_type === 'marketing' || u.role === 'marketing_staff' || u.role === 'admin')
                                      .map(u => ({
                                        value: u.id,
                                        label: `${u.name} | ${u.position || '营销/销售'}`
                                      }))}
                                  />
                                </Form.Item>
                              </div>
                              <div style={{ flex: 8, minWidth: 0 }}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'ratio']}
                                  rules={[{ required: true, message: '比例' }]}
                                  noStyle
                                >
                                  <Input
                                    type="number"
                                    placeholder="比例 (%)"
                                    suffix="%"
                                    style={{ width: '100%' }}
                                  />
                                </Form.Item>
                              </div>
                              <div style={{ flex: 4, minWidth: 0, textAlign: 'right', paddingRight: 4, whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 12, color: '#888' }}>
                                  {allocatedAmount} 万元
                                </span>
                              </div>
                              <div style={{ flex: 2, minWidth: 0, textAlign: 'right' }}>
                                <Button type="link" danger onClick={() => remove(name)} style={{ padding: 0 }}>
                                  删除
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        <Form.Item noStyle>
                          <Button type="dashed" onClick={() => add()} block style={{ marginTop: 8 }}>
                            + 添加营销分摊员工
                          </Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                  
                  {/* 营销比率统计 */}
                  <div style={{ marginTop: 8, fontSize: 12, textAlign: 'right', color: '#666' }}>
                    已分配累计比例：
                    <span style={{ fontWeight: 'bold', color: Math.abs(marketingRatioTotal - 100) < 0.01 ? 'green' : 'red' }}>
                      {marketingRatioTotal.toFixed(2)} %
                    </span>
                    （必须等于 100%）
                  </div>
                </div>
                
                {/* 隐藏字段用来兼容之前逻辑 */}
                <Form.Item name="amount" noStyle><Input type="hidden" /></Form.Item>
                <Form.Item name="budgetMoney" noStyle><Input type="hidden" /></Form.Item>
              </>
            );
          })()}

          {currentActionType === 'triangle' && (
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="employeeName" label="用户自己的姓名" rules={[{ required: true, message: '请选择您的姓名' }]}>
                    <Select
                      showSearch
                      placeholder="搜索选择员工姓名"
                      optionFilterProp="label"
                      filterOption={(input, option) =>
                        ((option as any)?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={usersList.map(u => ({ value: u.name, label: u.name }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="customerName" label="客户 / 业主名称" rules={[{ required: true, message: '请选择或搜索 CRM 客户名称' }]}>
                    <Select
                      showSearch
                      placeholder="输入关键字检索并选择 CRM 客户"
                      filterOption={false}
                      onSearch={handleCustomerSearch}
                      options={crmCustomers.map(c => ({ value: c, label: c }))}
                      defaultActiveFirstOption={false}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="copartners" label="联动人 (除营销岗，可多选)">
                    <Select
                      mode="multiple"
                      placeholder="请选择联动人（非营销岗）"
                      optionFilterProp="label"
                      filterOption={(input, option) =>
                        ((option as any)?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={usersList.filter(u => u.position_type !== 'marketing').map(u => ({ value: u.name, label: u.name }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="marketingCopartners" label="营销联动人 (营销岗，可多选)">
                    <Select
                      mode="multiple"
                      placeholder="请选择营销联动人（营销岗）"
                      optionFilterProp="label"
                      filterOption={(input, option) =>
                        ((option as any)?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={usersList.filter(u => u.position_type === 'marketing').map(u => ({ value: u.name, label: u.name }))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="actionDescription" label="联动的动作" rules={[{ required: true, message: '请输入具体的联动动作说明' }]}>
                <Input.TextArea placeholder="请输入具体的铁三角联动动作描述..." rows={3} />
              </Form.Item>
              <Form.Item name="triangleResult" label="成果" rules={[{ required: true, message: '请输入联动取得的成果' }]}>
                <Input.TextArea placeholder="（推进到什么阶段/达成什么结果）" rows={3} />
              </Form.Item>
              <Form.Item name="customerFeedback" label="客户反馈" rules={[{ required: true, message: '请输入客户反馈' }]}>
                <Input.TextArea placeholder="“（客户原话或总结）”" rows={3} />
              </Form.Item>
            </>
          )}

          {currentActionType === 'happiness' && (
            <>
              <Form.Item name="employeeName" label="员工姓名" rules={[{ required: true, message: '请选择做到幸福动作的员工姓名' }]}>
                <Select
                  showSearch
                  placeholder="搜索选择员工姓名，默认为当前登录人"
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    ((option as any)?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={usersList.map(u => ({ value: u.name, label: u.name }))}
                />
              </Form.Item>
              <Form.Item name="projectName" label="项目名称">
                <Select
                  showSearch
                  placeholder="输入关键字检索并选择 CRM 项目（选填，默认为未定）"
                  filterOption={false}
                  onSearch={handleProjectSearch}
                  options={crmProjectsSearch.map(p => ({ value: p, label: p }))}
                  defaultActiveFirstOption={false}
                  allowClear
                />
              </Form.Item>
              <Form.Item name="customerName" label="客户名称" rules={[{ required: true, message: '请选择或搜索 CRM 客户名称' }]}>
                <Select
                  showSearch
                  placeholder="输入关键字检索并选择 CRM 客户"
                  filterOption={false}
                  onSearch={handleCustomerSearch}
                  options={crmCustomers.map(c => ({ value: c, label: c }))}
                  defaultActiveFirstOption={false}
                />
              </Form.Item>
              <Form.Item name="happinessScore" label="客户幸福标准分值" rules={[{ required: true, message: '请选择幸福分值' }]}>
                <Select placeholder="选择客户幸福标准分值">
                  <Select.Option value={0}>0分</Select.Option>
                  <Select.Option value={20}>20分</Select.Option>
                  <Select.Option value={50}>50分</Select.Option>
                  <Select.Option value={100}>100分</Select.Option>
                </Select>
              </Form.Item>

              {watchHappinessScore !== undefined && HAPPINESS_STANDARDS[String(watchHappinessScore)] && (
                <Form.Item name="selectedStandards" label="客户幸福标准选项勾选">
                  <Checkbox.Group style={{ width: '100%' }}>
                    <Collapse 
                      size="small" 
                      defaultActiveKey={HAPPINESS_STANDARDS[String(watchHappinessScore)].sections.map((s: any) => s.section_id)}
                      style={{ marginBottom: 16, maxHeight: '300px', overflowY: 'auto' }}
                    >
                      {HAPPINESS_STANDARDS[String(watchHappinessScore)].sections.map((sec: any) => (
                        <Collapse.Panel 
                          header={<span style={{ fontWeight: 'bold', color: '#1677ff' }}>{sec.section_title}</span>} 
                          key={sec.section_id}
                        >
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {sec.items.map((item: any) => (
                              <div key={item.item_id} style={{ padding: '4px 0' }}>
                                <Checkbox value={item.content}>
                                  <span style={{ fontSize: 13, lineHeight: '1.5', display: 'inline-block', verticalAlign: 'top', whiteSpace: 'normal' }}>
                                    {item.content}
                                  </span>
                                </Checkbox>
                              </div>
                            ))}
                          </Space>
                        </Collapse.Panel>
                      ))}
                    </Collapse>
                  </Checkbox.Group>
                </Form.Item>
              )}

              <Form.Item name="actionDescription" label="动作描述" rules={[{ required: true, message: '请输入具体关怀与拜访动作' }]}>
                <Input.TextArea 
                  rows={3} 
                  autoSize={{ minRows: 2, maxRows: 6 }} 
                  placeholder="例如：关怀与拜访 / 递交了第三期方案成效汇报" 
                />
              </Form.Item>
              <Form.Item name="happinessResult" label="成果" rules={[{ required: true, message: '请输入取得的成果' }]}>
                <Input.TextArea placeholder="（推进到什么阶段/达成什么结果）" rows={3} />
              </Form.Item>
              <Form.Item name="happinessFeedback" label="客户反馈（可选）">
                <Input.TextArea placeholder="“（客户原话或总结）”" rows={3} />
              </Form.Item>
              <Form.Item name="recommendAction" label="内部可推广复制的做法" rules={[{ required: true, message: '请输入内部可推广复制的做法说明' }]}>
                <Input.TextArea placeholder="具体做法说明" rows={3} />
              </Form.Item>
            </>
          )}

          {['contract', 'happiness', 'triangle'].includes(currentActionType) && (
            <Form.Item label="📎 上传证明照片（可选，最多3张）">
              <Upload
                customRequest={customUpload}
                listType="picture-card"
                fileList={fileList}
                onChange={({ fileList }) => setFileList(fileList)}
                maxCount={3}
                accept="image/*"
              >
                {fileList.length < 3 && (
                  <div>
                    <PlusOutlined />
                    <div style={{ marginTop: 8 }}>上传照片</div>
                  </div>
                )}
              </Upload>
            </Form.Item>
          )}

          {currentActionType !== 'station_report' && (
            <Form.Item
              name="content"
              label="最终生成战报文本"
              rules={[{ required: true, message: '战报内容不能为空' }, { max: 1000, message: '战报文本不能多于1000字' }]}
            >
              <Input.TextArea rows={4} placeholder="选择动作填入要素后自动生成，也可在此手动微调" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 重复战报检测提示 Modal，所有文字采用纯中文 */}
      <Modal
        title="⚠️ 发现重复播报内容"
        open={duplicateModalVisible}
        closable={false}
        mask={{ closable: false }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ color: '#fa8c16', fontSize: 12, textAlign: 'left' }}>
              提示：按是，确定为重复记录，将不再播报，按否，不是重复记录，将直接播报出去
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button key="yes" type="primary" onClick={handleYesDuplicate}>是</Button>
              <Button key="no" onClick={handleNoDuplicate}>否</Button>
            </div>
          </div>
        }
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ fontSize: 14 }}>
            昨日上午9点至今本【{duplicateCheckData?.customerName}】已经播放{' '}
            <strong style={{ color: '#ff4d4f', fontSize: 16 }}>{duplicateCheckData?.count}</strong>{' '}
            条。
          </p>
          
          <Button 
            type="link" 
            size="small" 
            style={{ padding: 0, marginBottom: 8 }}
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '收起明细' : '打开明细'}
          </Button>

          {showDetails && duplicateCheckData?.list && (
            <Card size="small" style={{ maxHeight: 180, overflowY: 'auto', backgroundColor: '#fafafa', marginTop: 8 }}>
              {duplicateCheckData.list.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '12px 0', color: '#bfbfbf', fontSize: 11 }}>
                  本日暂无该客户的铁三角联动记录
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {duplicateCheckData.list.map((item: any, index: number) => (
                    <div 
                      key={index} 
                      style={{ 
                        padding: '4px 0', 
                        fontSize: 12, 
                        borderBottom: index === duplicateCheckData.list.length - 1 ? 'none' : '1px solid #f0f0f0' 
                      }}
                    >
                      {index + 1}. {item}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </Modal>

      {/* 战队多维度精细指标Modal */}
      <Modal
        title={selectedTeamMetrics ? `⚔️ 【${selectedTeamMetrics.team_name}】多维度精细化指标明细` : "加载中..."}
        open={teamMetricsModalVisible}
        onCancel={() => {
          setTeamMetricsModalVisible(false)
          setSelectedTeamMetrics(null)
        }}
        footer={null}
        width={960}
        destroyOnHidden
      >
        {metricsLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Progress type="circle" percent={60} status="active" strokeColor="#1677ff" />
            <div style={{ marginTop: 16 }}>正在从 CRM 客户管理系统及本地同步加载最新数据...</div>
          </div>
        ) : selectedTeamMetrics ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, background: '#f5f5f5', padding: '10px 16px', borderRadius: 6 }}>
              <div>
                CRM系统对接状态：
                {selectedTeamMetrics.crm_connected ? (
                  <Tag color="success">🟢 已直连CRM（实时提取有效与潜力线索）</Tag>
                ) : (
                  <Tag color="error">❌ 连接离线（CRM系统暂不可用，无法显示线索指标）</Tag>
                )}
              </div>
              <div>
                数据统计口径：<strong style={{ color: '#1677ff' }}>按本战队全员累加</strong>
              </div>
            </div>
            
            <Table
              dataSource={[
                {
                  key: 'm_contract',
                  name: '💰 营销新签合同额',
                  definition: '合同已加盖双方公章，营销人员所属战队新签总额',
                  target: `${selectedTeamMetrics.marketing_target} 万元`,
                  actual: `${selectedTeamMetrics.marketing_actual} 万元`,
                  rate: selectedTeamMetrics.marketing_target > 0 ? roundPct(selectedTeamMetrics.marketing_actual / selectedTeamMetrics.marketing_target * 100) : 0.0
                },
                {
                  key: 'd_contract',
                  name: '🛠️ 交付新签合同额',
                  definition: '合同已加盖双方公章，技术/交付人员所属战队新签总额',
                  target: `${selectedTeamMetrics.delivery_target} 万元`,
                  actual: `${selectedTeamMetrics.delivery_actual} 万元`,
                  rate: selectedTeamMetrics.delivery_target > 0 ? roundPct(selectedTeamMetrics.delivery_actual / selectedTeamMetrics.delivery_target * 100) : 0.0
                },
                {
                  key: 'valid_leads',
                  name: '🔍 有效需求线索量',
                  definition: '本系统有效线索库中进度为25%的线索总数量',
                  target: `${selectedTeamMetrics.valid_leads_target} 条`,
                  actual: selectedTeamMetrics.valid_leads_actual !== null ? `${selectedTeamMetrics.valid_leads_actual} 条` : '—',
                  rate: (selectedTeamMetrics.valid_leads_actual !== null && selectedTeamMetrics.valid_leads_target > 0) ? roundPct(selectedTeamMetrics.valid_leads_actual / selectedTeamMetrics.valid_leads_target * 100) : '—'
                },
                {
                  key: 'potential_leads',
                  name: '📈 潜力需求线索量',
                  definition: 'CRM线索库中进度在 5%~10% 的线索数（CRM专属指标）',
                  target: '—',
                  actual: selectedTeamMetrics.potential_leads_actual !== null ? `${selectedTeamMetrics.potential_leads_actual} 条` : '—',
                  rate: '—'
                },
                {
                  key: 'conversion',
                  name: '📊 线索转化率',
                  definition: '新签线索个数 / 上月有效线索池总个数 * 100%（CRM线索转化指标）',
                  target: '—',
                  actual: selectedTeamMetrics.leads_conversion_rate !== null ? `${selectedTeamMetrics.leads_conversion_rate} %` : '—',
                  rate: '—'
                },
                {
                  key: 'new_customer',
                  name: '🆕 战役新客户数',
                  definition: '本战队已审核日报中，新签合同明细里去重客户总数',
                  target: '—',
                  actual: `${selectedTeamMetrics.new_customers_actual} 个`,
                  rate: '—'
                },
                {
                  key: 'renew',
                  name: '🔄 续签合同额',
                  definition: '同一科室两年内再次签订的合同额总数（基于合同描述智能检索）',
                  target: '—',
                  actual: `${selectedTeamMetrics.renew_amount_actual} 万元`,
                  rate: '—'
                },
                {
                  key: 'triangle',
                  name: '🤝 售前铁三角联动',
                  definition: '本战队全体员工共同客户接触、联动拜访累计次数',
                  target: '—',
                  actual: `${selectedTeamMetrics.triangle_actual} 次`,
                  rate: '—'
                },
                {
                  key: 'happiness',
                  name: '😊 客户幸福标准动作',
                  definition: '本战队全员做到幸福关怀动作并收到客户正反馈的次数',
                  target: '—',
                  actual: `${selectedTeamMetrics.happiness_actual} 次`,
                  rate: '—'
                }
              ]}
              columns={[
                { title: '作战多维指标', dataIndex: 'name', key: 'name', width: 200, render: (val: string) => <strong>{val}</strong> },
                { title: '口径/定义解析', dataIndex: 'definition', key: 'definition', width: 320 },
                { title: '保底奋斗目标', dataIndex: 'target', key: 'target', width: 130 },
                { 
                  title: '真实实际完成', 
                  dataIndex: 'actual', 
                  key: 'actual', 
                  width: 130, 
                  render: (val: string, record: any) => {
                    const isLeads = record.key === 'valid_leads' || record.key === 'potential_leads';
                    const isContracts = record.key === 'm_contract' || record.key === 'd_contract';
                    const isTriangle = record.key === 'triangle';
                    const isHappiness = record.key === 'happiness';
                    const hasValue = val && val !== '—' && !val.startsWith('0 条') && !val.startsWith('0.0 条');
                    
                    if (isLeads && hasValue) {
                      if (!hasPerm('drilldown_leads')) {
                        return <span style={{ color: '#8c8c8c', fontWeight: 'bold' }}>{val}</span>;
                      }
                      return (
                        <a 
                          style={{ 
                            color: '#1677ff', 
                            fontWeight: 'bold', 
                            textDecoration: 'underline', 
                            cursor: 'pointer' 
                          }}
                          onClick={() => {
                            const leadType = record.key === 'valid_leads' ? 'valid' : 'potential';
                            handleViewLeadsList(selectedTeamMetrics.team_id, leadType, selectedTeamMetrics.team_name);
                          }}
                        >
                          {val}
                        </a>
                      );
                    }
                    
                    // 新签合同额下钻：仅当有实际金额且金额不为0时，才允许下钻
                    const hasContractValue = val && val !== '—' && !val.startsWith('0 万元') && !val.startsWith('0.0 万元');
                    if (isContracts && hasContractValue) {
                      return (
                        <a 
                          style={{ 
                            color: '#1677ff', 
                            fontWeight: 'bold', 
                            textDecoration: 'underline', 
                            cursor: 'pointer' 
                          }}
                          onClick={() => {
                            const contractType = record.key === 'm_contract' ? 'marketing' : 'delivery';
                            handleViewContractsList(selectedTeamMetrics.team_id, contractType, selectedTeamMetrics.team_name);
                          }}
                        >
                          {val}
                        </a>
                      );
                    }

                    // 售前铁三角联动下钻：仅当有实际次数且次数不为0时，才允许下钻
                    const hasTriangleValue = val && val !== '—' && !val.startsWith('0 次') && !val.startsWith('0.0 次');
                    if (isTriangle && hasTriangleValue) {
                      return (
                        <a 
                          style={{ 
                            color: '#1677ff', 
                            fontWeight: 'bold', 
                            textDecoration: 'underline', 
                            cursor: 'pointer' 
                          }}
                          onClick={() => {
                            handleViewTrianglesList(selectedTeamMetrics.team_id, selectedTeamMetrics.team_name);
                          }}
                        >
                          {val}
                        </a>
                      );
                    }

                    // 客户幸福标准动作下钻：仅当有实际次数且次数不为0时，才允许下钻
                    const hasHappinessValue = val && val !== '—' && !val.startsWith('0 次') && !val.startsWith('0.0 次');
                    if (isHappiness && hasHappinessValue) {
                      return (
                        <a 
                          style={{ 
                            color: '#1677ff', 
                            fontWeight: 'bold', 
                            textDecoration: 'underline', 
                            cursor: 'pointer' 
                          }}
                          onClick={() => {
                            handleViewHappinessList(selectedTeamMetrics.team_id, selectedTeamMetrics.team_name);
                          }}
                        >
                          {val}
                        </a>
                      );
                    }
                    
                    // 不支持下钻（或者值为0、未考核的项目），渲染为常规无下划线的加粗状态，不再误导用户点击
                    return <span style={{ color: '#262626', fontWeight: 'bold' }}>{val}</span>;
                  }
                },
                { 
                  title: '达成进度', 
                  dataIndex: 'rate', 
                  key: 'rate', 
                  render: (val: any) => typeof val === 'number' ? (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Progress percent={val} size="small" style={{ width: 110, marginRight: 8 }} />
                      <span>{val}%</span>
                    </div>
                  ) : val 
                }
              ]}
              pagination={false}
              size="small"
              bordered
            />
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>暂无数据</div>
        )}
      </Modal>

      {/* 战队线索明细下钻 Modal */}
      <Modal
        title={selectedTeamMetrics ? `🔍 【${currentLeadTeamName}】${currentLeadType}明细列表` : "线索明细列表"}
        open={leadsModalVisible}
        onCancel={() => {
          setLeadsModalVisible(false)
          setLeadsList([])
        }}
        footer={[
          <Button key="close" type="primary" onClick={() => setLeadsModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={1200}
        destroyOnHidden
      >
        <Table
          dataSource={leadsList}
          columns={leadsColumns}
          loading={leadsLoading}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条数据` }}
          scroll={{ x: 1800, y: 500 }}
          bordered
          size="small"
        />
      </Modal>

      {/* 战队合同明细下钻 Modal */}
      <Modal
        title={selectedTeamMetrics ? `🔍 【${currentContractTeamName}】${currentContractType}明细列表` : "新签合同明细列表"}
        open={contractsModalVisible}
        onCancel={() => {
          setContractsModalVisible(false)
          setContractsList([])
        }}
        footer={[
          <Button key="close" type="primary" onClick={() => setContractsModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={1100}
        destroyOnHidden
      >
        <Table
          dataSource={contractsList}
          columns={contractsColumns}
          loading={contractsLoading}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条数据` }}
          scroll={{ y: 500 }}
          bordered
          size="small"
        />
      </Modal>

      {/* 战队售前铁三角明细下钻 Modal */}
      <Modal
        title={selectedTeamMetrics ? `🔍 【${currentTriangleTeamName}】售前铁三角明细列表` : "售前铁三角明细列表"}
        open={trianglesModalVisible}
        onCancel={() => {
          setTrianglesModalVisible(false)
          setTrianglesList([])
        }}
        footer={[
          <Button key="close" type="primary" onClick={() => setTrianglesModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={1100}
        destroyOnHidden
      >
        <Table
          dataSource={trianglesList}
          columns={trianglesColumns}
          loading={trianglesLoading}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条数据` }}
          scroll={{ y: 500 }}
          bordered
          size="small"
        />
      </Modal>

      {/* 战队客户幸福动作明细下钻 Modal */}
      <Modal
        title={selectedTeamMetrics ? `🔍 【${currentHappinessTeamName}】客户幸福动作明细列表` : "客户幸福动作明细列表"}
        open={happinessModalVisible}
        onCancel={() => {
          setHappinessModalVisible(false)
          setHappinessList([])
        }}
        footer={[
          <Button key="close" type="primary" onClick={() => setHappinessModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={1100}
        destroyOnHidden
      >
        <Table
          dataSource={happinessList}
          columns={happinessColumns}
          loading={happinessLoading}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条数据` }}
          scroll={{ y: 500 }}
          bordered
          size="small"
        />
      </Modal>

      {/* 📅 今日日报自动生成器 Modal */}
      <Modal
        title="📅 今日日报自动生成器"
        open={dailyReportModalVisible}
        onCancel={() => setDailyReportModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDailyReportModalVisible(false)}>
            关闭
          </Button>,
          <Button 
            key="copy" 
            type="primary" 
            onClick={() => {
              navigator.clipboard.writeText(dailyReportText)
              message.success('日报内容已成功复制到剪贴板！可以直接粘贴发送！')
            }}
          >
            一键复制日报
          </Button>
        ]}
        width={600}
        destroyOnHidden
      >
        <div style={{ padding: '8px 0' }}>
          {/* 日报范围选择下拉框，只在超级管理员和数字专员时提供灵活切换，目标官则显示为只读战队名称 */}
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 500, color: '#555' }}>日报范围：</span>
            {['admin', 'digital_specialist'].includes(user?.role || '') ? (
              <Select
                value={selectedReportScope}
                style={{ width: 220 }}
                onChange={(val) => {
                  setSelectedReportScope(val)
                  handleGenerateDailyReport(val)
                }}
              >
                <Select.Option value="company">全公司大盘</Select.Option>
                {data?.dualTrackTeams?.map((t: any) => (
                  <Select.Option key={t.teamId} value={t.teamId || 0}>
                    {t.teamName}
                  </Select.Option>
                ))}
              </Select>
            ) : (
              <Tag color="blue" style={{ fontSize: '14px', padding: '4px 10px' }}>
                {data?.dualTrackTeams?.find((t: any) => t.teamId === selectedReportScope)?.teamName || '本战队'}
              </Tag>
            )}
          </div>

          {/* 日报角色视角选择单选组 */}
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 500, color: '#555' }}>角色视角：</span>
            <Radio.Group
              value={selectedReportRole}
              onChange={(e) => {
                const val = e.target.value
                setSelectedReportRole(val)
                handleGenerateDailyReport(undefined, val)
              }}
            >
              <Radio.Button 
                value="target_officer" 
                disabled={selectedReportScope === 'company'}
              >
                目标官 (当天晚上)
              </Radio.Button>
              <Radio.Button 
                value="digital_specialist" 
                disabled={selectedReportScope === 'company'}
              >
                数字专员 (次日早晨)
              </Radio.Button>
              <Radio.Button 
                value="admin" 
                disabled={selectedReportScope !== 'company'}
              >
                系统管理员 (次日大盘)
              </Radio.Button>
            </Radio.Group>
          </div>

          <Alert 
            message="点击下方按钮即可一键复制格式化文案，直接发送至微信/钉钉群！" 
            type="info" 
            showIcon 
            style={{ marginBottom: 16 }} 
          />
          <Input.TextArea
            value={dailyReportText}
            autoSize={{ minRows: 10, maxRows: 20 }}
            readOnly
            style={{ 
              fontFamily: 'monospace', 
              backgroundColor: '#f5f5f5', 
              padding: '12px', 
              borderRadius: '6px',
              color: '#333'
            }}
          />
        </div>
      </Modal>

      {/* 全公司 KPI 详情下钻 Modal，所有注释必须使用中文 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 40 }}>
            <div style={{ fontWeight: 'bold', fontSize: 16 }}>
              {companyKpiDetailType === 'contracts' && <span>💰 公司累计新签合同额明细</span>}
              {companyKpiDetailType === 'happiness' && <span>😊 公司客户幸福动作明细</span>}
              {companyKpiDetailType === 'triangle' && <span>🤝 售前铁三角联动明细</span>}
              {companyKpiDetailType === 'leads' && <span>🔍 新增有效商机线索明细</span>}
              {companyKpiDetailType === 'tenders' && <span>🏆 公司累计中标项目明细</span>}
            </div>
            
            {/* 标题栏右侧的筛选组合栏，所有注释必须使用中文 */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
              {/* 导出按钮 */}
              <Button
                icon={<ExportOutlined />}
                loading={companyExportLoading}
                onClick={handleExportCompanyKpi}
                size="small"
                style={{ borderRadius: 4 }}
              >
                导出
              </Button>

              {/* 战队筛选 */}
              <Select
                placeholder="选择战队"
                value={companyFilterTeamId}
                onChange={(val) => setCompanyFilterTeamId(val)}
                allowClear
                style={{ width: 125 }}
                size="small"
              >
                {availableTeams.map(t => (
                  <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
                ))}
              </Select>
              
              {/* 周筛选 */}
              <Select
                placeholder="选择周"
                value={companyFilterWeek}
                onChange={(val) => setCompanyFilterWeek(val)}
                allowClear
                style={{ width: 105 }}
                size="small"
              >
                {Array.from({ length: 15 }, (_, i) => i + 1).map(w => (
                  <Select.Option key={w} value={w}>第 {w} 周</Select.Option>
                ))}
              </Select>
              
              {/* 提报人筛选 */}
              <Select
                placeholder="选择提报人"
                value={companyFilterReporter}
                onChange={(val) => setCompanyFilterReporter(val)}
                allowClear
                showSearch
                style={{ width: 115 }}
                size="small"
              >
                {availableReporters.map(r => (
                  <Select.Option key={r} value={r}>{r}</Select.Option>
                ))}
              </Select>
              
              {/* 模糊搜索 */}
              <Input
                placeholder="搜索客户/描述..."
                value={companyFilterKeyword}
                onChange={(e) => setCompanyFilterKeyword(e.target.value)}
                allowClear
                style={{ width: 145 }}
                size="small"
              />
            </div>
          </div>
        }
        open={companyKpiDetailModalVisible}
        onCancel={() => setCompanyKpiDetailModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setCompanyKpiDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={950}
        destroyOnHidden
      >
        <Spin spinning={companyKpiDetailLoading}>
          {companyKpiDetailData && (
            <div>
              {/* 顶部指标卡汇总看板 */}
              <div style={{ marginBottom: 20 }}>
                {companyKpiDetailType === 'contracts' ? (
                  <Row gutter={16}>
                    <Col span={8}>
                      <div style={{
                        background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                        padding: '16px',
                        borderRadius: '8px',
                        color: '#fff',
                        boxShadow: '0 4px 12px rgba(24,144,255,0.2)'
                      }}>
                        <div style={{ fontSize: 13, opacity: 0.85 }}>交付新签总额 (大盘去重)</div>
                        <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>
                          {companyKpiDetailData.delivery_total} <span style={{ fontSize: 14 }}>万元</span>
                        </div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{
                        background: 'linear-gradient(135deg, #ff7a45 0%, #ff4d4f 100%)',
                        padding: '16px',
                        borderRadius: '8px',
                        color: '#fff',
                        boxShadow: '0 4px 12px rgba(255,77,79,0.2)'
                      }}>
                        <div style={{ fontSize: 13, opacity: 0.85 }}>营销新签总额</div>
                        <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>
                          {companyKpiDetailData.marketing_total} <span style={{ fontSize: 14 }}>万元</span>
                        </div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{
                        background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                        padding: '16px',
                        borderRadius: '8px',
                        color: '#fff',
                        boxShadow: '0 4px 12px rgba(82,196,26,0.2)'
                      }}>
                        <div style={{ fontSize: 13, opacity: 0.85 }}>公司累计总签合同额</div>
                        <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>
                          {companyKpiDetailData.delivery_total} <span style={{ fontSize: 14 }}>万元</span>
                        </div>
                      </div>
                    </Col>
                  </Row>
                ) : (
                  <div style={{
                    background: companyKpiDetailType === 'tenders' ? '#e6fffb' : '#f6ffed',
                    border: companyKpiDetailType === 'tenders' ? '1px solid #87e8de' : '1px solid #b7eb8f',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <Space size="middle">
                      <span style={{ fontSize: 15, fontWeight: 500, color: companyKpiDetailType === 'tenders' ? '#08979c' : '#389e0d' }}>
                        {companyKpiDetailType === 'happiness' && '😊 公司客户幸福动作累计已执行'}
                        {companyKpiDetailType === 'triangle' && '🤝 售前铁三角现场联动累计'}
                        {companyKpiDetailType === 'leads' && '🔍 新增有效商机线索累计'}
                        {companyKpiDetailType === 'tenders' && '🏆 公司累计中标项目累计'}
                      </span>
                    </Space>
                    <span style={{ fontSize: 22, fontWeight: 'bold', color: companyKpiDetailType === 'tenders' ? '#08979c' : '#389e0d' }}>
                      {companyKpiDetailData.total}{' '}
                      <span style={{ fontSize: 14, fontWeight: 'normal' }}>
                        {companyKpiDetailType === 'leads' ? '条' : companyKpiDetailType === 'tenders' ? '个' : '次'}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              {/* 明细展示表格 */}
              {companyKpiDetailType === 'contracts' ? (
                <Tabs defaultActiveKey="delivery" type="card">
                  <Tabs.TabPane tab="交付新签明细" key="delivery">
                    <Table
                      dataSource={companyKpiDetailData.delivery_list}
                      rowKey="id"
                      size="small"
                      pagination={{ pageSize: 10 }}
                      columns={[
                        { title: '签单日期', dataIndex: 'report_date', key: 'report_date', width: 110, align: 'center' },
                        { title: '提报人', dataIndex: 'reporter_name', key: 'reporter_name', width: 90, align: 'center' },
                        { title: '所属战队', dataIndex: 'team_name', key: 'team_name', width: 130 },
                        { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 130 },
                        {
                          title: '签约金额',
                          dataIndex: 'amount',
                          key: 'amount',
                          width: 110,
                          align: 'right',
                          render: (val: number) => <strong style={{ color: '#1677ff' }}>{val} 万</strong>
                        },
                        { title: '协同搭档', dataIndex: 'partner_name', key: 'partner_name', width: 90, align: 'center' },
                        {
                          title: '播报内容',
                          dataIndex: 'description',
                          key: 'description',
                          render: (val: string) => <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{val}</div>
                        }
                      ]}
                    />
                  </Tabs.TabPane>
                  <Tabs.TabPane tab="营销新签明细" key="marketing">
                    <Table
                      dataSource={companyKpiDetailData.marketing_list}
                      rowKey="id"
                      size="small"
                      pagination={{ pageSize: 10 }}
                      columns={[
                        { title: '签单日期', dataIndex: 'report_date', key: 'report_date', width: 110, align: 'center' },
                        { title: '提报人', dataIndex: 'reporter_name', key: 'reporter_name', width: 90, align: 'center' },
                        { title: '所属战队', dataIndex: 'team_name', key: 'team_name', width: 130 },
                        { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 130 },
                        {
                          title: '签约金额',
                          dataIndex: 'amount',
                          key: 'amount',
                          width: 110,
                          align: 'right',
                          render: (val: number) => <strong style={{ color: '#ff4d4f' }}>{val} 万</strong>
                        },
                        { title: '协同搭档', dataIndex: 'partner_name', key: 'partner_name', width: 90, align: 'center' },
                        {
                          title: '播报内容',
                          dataIndex: 'description',
                          key: 'description',
                          render: (val: string) => <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{val}</div>
                        }
                      ]}
                    />
                  </Tabs.TabPane>
                </Tabs>
              ) : (
                <Table
                  dataSource={companyKpiDetailData.list}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 10 }}
                  columns={
                    companyKpiDetailType === 'happiness'
                      ? [
                          { title: '填报日期', dataIndex: 'report_date', key: 'report_date', width: 110, align: 'center' },
                          { title: '执行人', dataIndex: 'reporter_name', key: 'reporter_name', width: 90, align: 'center' },
                          { title: '所属战队', dataIndex: 'team_name', key: 'team_name', width: 130 },
                          { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 130 },
                          {
                            title: '标准分值',
                            dataIndex: 'level',
                            key: 'level',
                            width: 100,
                            align: 'center',
                            render: (val: string) => <Tag color="green">{val}</Tag>
                          },
                          {
                            title: '播报内容',
                            dataIndex: 'description',
                            key: 'description',
                            render: (val: string) => <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{val}</div>
                          }
                        ]
                      : companyKpiDetailType === 'triangle'
                      ? [
                          { title: '联动日期', dataIndex: 'report_date', key: 'report_date', width: 110, align: 'center' },
                          { title: '提报人', dataIndex: 'reporter_name', key: 'reporter_name', width: 90, align: 'center' },
                          { title: '所属战队', dataIndex: 'team_name', key: 'team_name', width: 130 },
                          { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 130 },
                          { title: '联动搭档', dataIndex: 'partner_name', key: 'partner_name', width: 110, align: 'center' },
                          {
                            title: '播报内容',
                            dataIndex: 'description',
                            key: 'description',
                            render: (val: string) => <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{val}</div>
                          }
                        ]
                      : companyKpiDetailType === 'tenders'
                      ? [
                          { title: '中标日期', dataIndex: 'report_date', key: 'report_date', width: 110, align: 'center' },
                          { title: '提报人', dataIndex: 'reporter_name', key: 'reporter_name', width: 90, align: 'center' },
                          { title: '所属战队', dataIndex: 'team_name', key: 'team_name', width: 130 },
                          { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 130 },
                          {
                            title: '预计金额',
                            dataIndex: 'amount',
                            key: 'amount',
                            width: 110,
                            align: 'right',
                            render: (val: number) => <strong style={{ color: '#13c2c2' }}>{val} 万</strong>
                          },
                          {
                            title: '当前进度',
                            dataIndex: 'progress',
                            key: 'progress',
                            width: 100,
                            align: 'center',
                            render: (val: string) => <Tag color="cyan">{val}</Tag>
                          },
                          {
                            title: '播报内容',
                            dataIndex: 'description',
                            key: 'description',
                            render: (val: string) => <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{val}</div>
                          }
                        ]
                      : [
                          { title: '发现日期', dataIndex: 'report_date', key: 'report_date', width: 110, align: 'center' },
                          { title: '提报人', dataIndex: 'reporter_name', key: 'reporter_name', width: 90, align: 'center' },
                          { title: '所属战队', dataIndex: 'team_name', key: 'team_name', width: 130 },
                          { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 130 },
                          {
                            title: '预计金额',
                            dataIndex: 'amount',
                            key: 'amount',
                            width: 110,
                            align: 'right',
                            render: (val: number) => <strong style={{ color: '#722ed1' }}>{val} 万</strong>
                          },
                          {
                            title: '当前进度',
                            dataIndex: 'progress',
                            key: 'progress',
                            width: 100,
                            align: 'center',
                            render: (val: string) => <Tag color="purple">{val}</Tag>
                          },
                          {
                            title: '播报内容',
                            dataIndex: 'description',
                            key: 'description',
                            render: (val: string) => <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{val}</div>
                          }
                        ]
                  }
                />
              )}
            </div>
          )}
        </Spin>
      </Modal>

      {/* 周英雄榜实绩个人明细抽屉，所有注释必须使用中文 */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>⚡ 【{detailUser}】{isDetailAll ? '累计' : '本周'}【{
              detailCategory === 'marketing_signing' ? '营销新签' :
              detailCategory === 'delivery_signing' ? '交付新签' :
              ['leads', 'leads_count', 'leads_conversion_rate'].includes(detailCategory) ? '有效线索' :
              ['happiness', 'happiness_action', 'happiness_story_count'].includes(detailCategory) ? '客户幸福' :
              ['triangle', 'triangle_count'].includes(detailCategory) ? '铁三角联动' : 
              ['contract_count', 'new_customer_count'].includes(detailCategory) ? '新签合同' : ''
            }】实绩明细</span>
          </div>
        }
        placement="right"
        styles={{ wrapper: { width: 750 } }}
        onClose={() => setDetailDrawerVisible(false)}
        open={detailDrawerVisible}
        destroyOnHidden
      >
        <Table
          dataSource={detailData}
          columns={getDetailColumns(detailCategory)}
          rowKey="id"
          loading={detailLoading}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          size="middle"
          bordered
          locale={{ emptyText: <span style={{ color: '#bfbfbf' }}>{isDetailAll ? '暂无该项累计实绩明细记录' : '本周暂无该项实绩明细记录'}</span> }}
        />
      </Drawer>

      {/* 周报填写Modal弹窗 */}
      <Modal
        title={<strong>📅 填写我的个人周复盘周报</strong>}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, borderBottom: '1px dashed #f0f0f0', paddingBottom: 12 }}>
            <Space style={{ flexWrap: 'wrap' }}>
              <span style={{ whiteSpace: 'nowrap' }}><strong>选择填报周：</strong></span>
              <DatePicker
                picker="week"
                placeholder="选择填报周"
                style={{ width: '130px' }}
                value={weeklyDate}
                onChange={(val) => {
                  if (val) {
                    setWeeklyDate(val)
                    loadWeeklyReportData(val)
                  }
                }}
                allowClear={false}
              />
              <span style={{ fontSize: 13, color: '#8c8c8c', marginLeft: 4 }}>
                （当前周范围：<strong>{getMondayAndSunday(weeklyDate)[0].format('YYYY-MM-DD')} ~ {getMondayAndSunday(weeklyDate)[1].format('YYYY-MM-DD')}</strong>）
              </span>
            </Space>
            <Space style={{ flexWrap: 'wrap' }}>
              <Button
                type="primary"
                ghost
                icon={<RiseOutlined />}
                loading={weeklyExtractLoading}
                onClick={handleAutoExtractWeekly}
                style={{ whiteSpace: 'nowrap' }}
              >
                一键导入当周播报数据
              </Button>
              <Button
                type="primary"
                danger
                icon={<SyncOutlined />}
                loading={weeklyCrmExtractLoading}
                onClick={handleAutoExtractCrmWeekly}
                style={{ whiteSpace: 'nowrap' }}
              >
                ⚡ 智能拉取 CRM 业绩与进度
              </Button>
              <Button
                type="primary"
                style={{ backgroundColor: '#722ed1', borderColor: '#722ed1', whiteSpace: 'nowrap' }}
                icon={<SyncOutlined spin={weeklyAiOptimizing} />}
                loading={weeklyAiOptimizing}
                onClick={handleAiOptimizeWeekly}
              >
                🪄 AI 助手智能整理
              </Button>
            </Space>
          </div>
          
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
              <Text strong>
                {getMondayAndSunday(weeklyDate)[0].format('YYYY-MM-DD')} ~ {getMondayAndSunday(weeklyDate)[1].format('YYYY-MM-DD')}
              </Text>
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
    </div>
  )
}

export default Dashboard
