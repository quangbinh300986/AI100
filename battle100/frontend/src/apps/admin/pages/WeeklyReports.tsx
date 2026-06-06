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
  Checkbox
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  SyncOutlined,
  FilterOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { get, post, put, del } from '@shared/api/client'
import { useAuthStore } from '@shared/stores/authStore'
import dayjs from 'dayjs'

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
    return clean === '1. 本周名下负责的在研项目推进平稳，无重大子任务或里程碑完成提交。' || clean === ''
  }
}

const WeeklyReports: React.FC = () => {
  const { user } = useAuthStore()
  // 是否属于营销岗/目标官等
  const isMarketing = user?.position_type === 'marketing' || ['target_officer', 'marketing_staff', 'tech_marketing'].includes(user?.role || '');
  // 是否为全局管理权限角色
  const isGlobalUser = user?.role === 'admin' || user?.role === 'target_officer';

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

  useEffect(() => {
    loadWeeklyReports()
    checkMyReport()
  }, [weeklyDate, weeklyTeamId, weeklyPage, weeklyPageSize])

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
          <Col>
            <Space>
              {weeklySelectedRowKeys.length > 0 && hasPermission('delete_weekly_report') && (
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
                onClick={loadWeeklyReports}
                icon={<SyncOutlined />}
              >
                刷新周汇总
              </Button>
              <Button
                type="primary"
                ghost
                icon={<EditOutlined />}
                onClick={openWeeklyWriteModal}
              >
                {hasMineReport ? '修改我的周报' : '填写我的周报'}
              </Button>
            </Space>
          </Col>
          <Col style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 13, color: '#8c8c8c' }}>
              当前检索周范围：<strong>{selectedMonday} ~ {selectedSunday}</strong>
            </span>
          </Col>
        </Row>

        {/* 汇总大表 */}
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

        {/* 周报只读查看Modal弹窗 */}
        <Modal
          title={<strong>🔍 查看员工周复盘详情（周范围：{selectedMonday} ~ {selectedSunday} - 成员：{viewingWeeklyReport?.user_name}）</strong>}
          open={weeklyViewVisible}
          onCancel={() => setWeeklyViewVisible(false)}
          footer={[
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
                  {isMarketing ? '营销与销售线 (分析商机/合同/回款/拜访)' : '交付与技术线 (分析在研项目/子任务/里程碑)'}
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
      </div>
    </div>
  )
}

export default WeeklyReports
