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
  Switch,
  InputNumber,
  Divider,
  Popconfirm,
  Statistic,
  Tooltip,
  Collapse,
  Checkbox,
  Upload,
  Tabs,
  DatePicker
} from 'antd'
import { HAPPINESS_STANDARDS } from '@shared/data/happinessStandards'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SyncOutlined,
  FilterOutlined,
  CopyOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  DingtalkOutlined,
  GlobalOutlined,
  DesktopOutlined,
  ExportOutlined,
  DownloadOutlined
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

// 播报与动作类型定义 (严格限制为这 5 种核心动作 + 自定义文本播报)
const EVENT_TYPE_OPTIONS = [
  { label: '有效线索确定 (25%)', value: 'lead_25' },
  { label: '中标确定 (75%)', value: 'lead_75' },
  { label: '已完成合同签订 (90%)', value: 'contract_signed' },
  { label: '铁三角联动', value: 'triangle' },
  { label: '客户幸福动作', value: 'happiness' },
  { label: '驻点快报', value: 'station_report' },
  { label: '自定义播报', value: 'custom' },
]

// 推送状态定义
const PUSH_STATUS_OPTIONS = [
  { label: '待推送', value: 'pending' },
  { label: '已发送', value: 'sent' },
  { label: '发送失败', value: 'failed' },
]

// 推送渠道定义
const PUSH_CHANNEL_OPTIONS = [
  { label: '钉钉群推送', value: 'dingtalk' },
  { label: '系统通知', value: 'system' },
  { label: '全渠道推送', value: 'all' },
]

// 播报数据结构
interface BroadcastItem {
  id: number
  event_type: string
  user_id?: number
  team_id?: number
  content: string
  push_status: string
  push_channel: string
  event_time?: string
  created_at: string
  crm_opportunity_id?: string
  crm_opportunity_name?: string
  user_name?: string
  team_name?: string
  delivery_allocations?: any[]
  marketing_allocations?: any[]
  attachment_urls?: string[]
  project_name?: string
}


// 本地系统用户结构
interface UserItem {
  id: number
  name: string
  role: string
  teamId?: number
  position_type?: string
}

// CRM 商机项目结构
interface CRMProject {
  id: string
  name: string
  customer_name: string
  budget_money: number
  expect_money: number
  progress: number
  marketing_users: {
    crm_user_id: string
    name: string
    local_user_id?: number
  }[]
}



const Reports: React.FC = () => {
  const { user } = useAuthStore()
  const isMarketing = user?.position_type === 'marketing' || ['target_officer', 'marketing_staff', 'tech_marketing'].includes(user?.role || '');
  const isTeamLeader = user?.role === 'team_leader'




  // 动态权限校验函数 (支持系统管理员 admin 与默认配置兜底)
  const hasPermission = (perm: string) => {
    if (user?.role === 'admin') return true
    const userPerms = (user as any)?.permissions
    if (!userPerms || userPerms.length === 0) {
      if (perm === 'approve_report') {
        return user?.role === 'admin' || user?.role === 'team_leader'
      }
      if (perm === 'reject_report') {
        return user?.role === 'admin'
      }
      return true
    }
    return userPerms.includes(perm)
  }

  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [exportLoading, setExportLoading] = useState(false)

  // 筛选项状态
  const [filterTeamId, setFilterTeamId] = useState<string | undefined>(
    isTeamLeader && user?.teamId ? String(user.teamId) : undefined
  )
  const [filterEventType, setFilterEventType] = useState<string | undefined>(undefined)
  const [filterKeyword, setFilterKeyword] = useState<string>('')

  // 选中的行键值 (用于批量删除)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  // 表单与模态框状态
  const [createVisible, setCreateVisible] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [selectedBroadcast, setSelectedBroadcast] = useState<BroadcastItem | null>(null)
  const [editEventType, setEditEventType] = useState<string>('custom')
  
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const createActionType = Form.useWatch('action_type', createForm)
  const createHappinessScore = Form.useWatch('happiness_score', createForm)
  const editHappinessScore = Form.useWatch('happiness_score', editForm)

  const [createFileList, setCreateFileList] = useState<any[]>([])
  const [editFileList, setEditFileList] = useState<any[]>([])
  const [editPassword, setEditPassword] = useState<string>('')

  const [crmProjectsSearch, setCrmProjectsSearch] = useState<string[]>([])
  const projectSearchTimerRef = React.useRef<any>(null)

  const handleProjectSearch = (val: string) => {
    if (projectSearchTimerRef.current) {
      clearTimeout(projectSearchTimerRef.current)
    }
    projectSearchTimerRef.current = setTimeout(() => {
      loadCrmProjectsSearch(val)
    }, 300)
  }

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
    if (createVisible || editVisible) {
      loadCrmProjectsSearch()
    }
  }, [createVisible, editVisible])

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

  // 伴随指标与 CRM 数据状态
  const [withIndicator, setWithIndicator] = useState(false)
  const [actionType, setActionType] = useState<string>('contract')
  const [crmLoading, setCrmLoading] = useState(false)
  const [crmProjects, setCrmProjects] = useState<CRMProject[]>([])
  const [crmCustomers, setCrmCustomers] = useState<string[]>([])
  const [users, setUsers] = useState<UserItem[]>([])

  // 看板汇总数据
  const [summaryData, setSummaryData] = useState({
    todayCount: 0,
    pendingCount: 0,
    sentCount: 0,
    totalCount: 0,
  })

  // 新建战报表单联动处理器
  const handleCreateValuesChange = (changedValues: any, allValues: any) => {
    // 监听伴随指标 action_type 的改变
    if (changedValues.action_type !== undefined) {
      handleActionTypeChange(changedValues.action_type)
      return
    }

    if (withIndicator && actionType === 'happiness') {
      if (changedValues.happiness_score !== undefined) {
        // 分值改变，清空已选标准和描述
        createForm.setFieldsValue({
          selected_standards: [],
          action_description: ''
        })
        allValues.selected_standards = []
        allValues.action_description = ''
      } else if (changedValues.selected_standards !== undefined) {
        // 勾选标准改变，拼接动作描述
        const selectedList: string[] = changedValues.selected_standards || []
        const cleanedList = selectedList.map(item => item.replace(/[;；]$/, ''))
        const joined = cleanedList.join('；')
        createForm.setFieldsValue({
          action_description: joined
        })
        allValues.action_description = joined
      }

      // 重新生成 content
      const prefix = '奋战一百天，亮剑破六千！今日'
      const employeeName = user?.name || '团队成员'
      const score = allValues.happiness_score ?? 20
      const desc = allValues.action_description || ''
      const customer = allValues.customer_name || '客户'
      const result = allValues.happiness_result || ''
      const feedback = allValues.happiness_feedback || ''
      const recommend = allValues.recommend_action || ''
      const projectName = allValues.project_name || '未定'
      const projectPart = `，关联项目【${projectName}】`

      const feedbackLine = feedback ? `\n客户反馈：${feedback}。` : '';
      const generated = `${prefix}我司【${employeeName}】做到客户幸福标准【${score}分】动作，对象为【${customer}】${projectPart}，动作描述：${desc}。\n成果：${result}。${feedbackLine}\n内部可推广复制的做法：${recommend}。\n为客户幸福而奋斗，赢战百日！`
      createForm.setFieldsValue({ content: generated })
    } else if (withIndicator && actionType === 'triangle') {
      const prefix = '奋战一百天，亮剑破六千！今日'
      const employeeName = allValues.employee_name || user?.name || '我司团队成员'
      const copartners = allValues.copartners || []
      const marketingCopartners = allValues.marketing_copartners || []
      const copartnersStr = copartners.length > 0 ? copartners.join('、') : '';
      const marketingStr = marketingCopartners.length > 0 ? marketingCopartners.join('、') : '';
      let partnersInfo = '';
      if (copartnersStr && marketingStr) {
        partnersInfo = `联动人(${copartnersStr})、营销人员(${marketingStr})`;
      } else if (copartnersStr) {
        partnersInfo = `联动人(${copartnersStr})`;
      } else if (marketingStr) {
        partnersInfo = `营销人员(${marketingStr})`;
      }
      const partnerPart = partnersInfo ? `，与${partnersInfo}` : '';
      const customer = allValues.customer_name || '客户'
      const desc = allValues.action_description || ''
      const result = allValues.triangle_result || ''
      const feedback = allValues.customer_feedback || ''
      const generated = `${prefix}我司【${employeeName}】${partnerPart}在【${customer}】开展售前铁三角联动。\n联动动作：${desc}。\n成果：${result}。\n客户反馈：${feedback}。\n为客户幸福而奋斗，赢战百日！`
      createForm.setFieldsValue({ content: generated })
    }
  }

  // 编辑战报表单联动处理器
  const handleEditValuesChange = (changedValues: any, allValues: any) => {
    if (editEventType === 'happiness') {
      if (changedValues.happiness_score !== undefined) {
        // 分值改变，清空已选标准和描述
        editForm.setFieldsValue({
          selected_standards: [],
          action_description: ''
        })
        allValues.selected_standards = []
        allValues.action_description = ''
      } else if (changedValues.selected_standards !== undefined) {
        // 勾选标准改变，拼接动作描述
        const selectedList: string[] = changedValues.selected_standards || []
        const cleanedList = selectedList.map(item => item.replace(/[;；]$/, ''))
        const joined = cleanedList.join('；')
        editForm.setFieldsValue({
          action_description: joined
        })
        allValues.action_description = joined
      }

      // 重新生成 content
      const prefix = '奋战一百天，亮剑破六千！今日'
      const employeeName = selectedBroadcast?.user_name || user?.name || '团队成员'
      const score = allValues.happiness_score ?? 20
      const desc = allValues.action_description || ''
      const customer = allValues.customer_name || '客户'
      const result = allValues.happiness_result || ''
      const feedback = allValues.happiness_feedback || ''
      const recommend = allValues.recommend_action || ''
      const projectName = allValues.project_name || '未定'
      const projectPart = `，关联项目【${projectName}】`

      const feedbackLine = feedback ? `\n客户反馈：${feedback}。` : '';
      const generated = `${prefix}我司【${employeeName}】做到客户幸福标准【${score}分】动作，对象为【${customer}】${projectPart}，动作描述：${desc}。\n成果：${result}。${feedbackLine}\n内部可推广复制的做法：${recommend}。\n为客户幸福而奋斗，赢战百日！`
      editForm.setFieldsValue({ content: generated })
    } else if (editEventType === 'triangle') {
      const prefix = '奋战一百天，亮剑破六千！今日'
      const employeeName = allValues.employee_name || selectedBroadcast?.user_name || user?.name || '我司团队成员'
      const copartners = allValues.copartners || []
      const marketingCopartners = allValues.marketing_copartners || []
      const copartnersStr = copartners.length > 0 ? copartners.join('、') : '';
      const marketingStr = marketingCopartners.length > 0 ? marketingCopartners.join('、') : '';
      let partnersInfo = '';
      if (copartnersStr && marketingStr) {
        partnersInfo = `联动人(${copartnersStr})、营销人员(${marketingStr})`;
      } else if (copartnersStr) {
        partnersInfo = `联动人(${copartnersStr})`;
      } else if (marketingStr) {
        partnersInfo = `营销人员(${marketingStr})`;
      }
      const partnerPart = partnersInfo ? `，与${partnersInfo}` : '';
      const customer = allValues.customer_name || '客户'
      const desc = allValues.action_description || ''
      const result = allValues.triangle_result || ''
      const feedback = allValues.customer_feedback || ''
      const generated = `${prefix}我司【${employeeName}】${partnerPart}在【${customer}】开展售前铁三角联动。\n联动动作：${desc}。\n成果：${result}。\n客户反馈：${feedback}。\n为客户幸福而奋斗，赢战百日！`
      editForm.setFieldsValue({ content: generated })
    }
  }

  // 确保战队长只查看本战队

  useEffect(() => {
    if (isTeamLeader && user?.teamId) {
      setFilterTeamId(String(user.teamId))
    }
  }, [user, isTeamLeader])

  // 加载系统用户列表 (分摊选择使用)
  const loadUsers = async () => {
    try {
      const res = await get<any>('/users?page_size=1000')
      const data = res?.data ? res.data : res
      if (data && data.items) {
        setUsers(data.items || [])
      }
    } catch (err) {
      console.error('加载系统员工列表失败', err)
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

  // 加载 CRM 客户名称列表
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
      }
    } catch (err) {
      console.error('加载 CRM 客户列表失败', err)
    }
  }

  // 加载战报数据
  const loadBroadcasts = async () => {
    setLoading(true)
    try {
      let url = `/broadcast?page=${page}&page_size=${pageSize}`
      
      const targetTeam = isTeamLeader && user?.teamId ? String(user.teamId) : filterTeamId
      if (targetTeam && targetTeam !== 'all') {
        url += `&team_id=${targetTeam}`
      }
      if (filterEventType && filterEventType !== 'all') {
        url += `&event_type=${filterEventType}`
      }
      if (filterKeyword) {
        url += `&keyword=${encodeURIComponent(filterKeyword)}`
      }

      const res = await get<any>(url)
      const data = res?.data ? res.data : res
      if (data && (data.items || data.total !== undefined)) {
        setBroadcasts(data.items || [])
        setTotal(data.total || 0)
      } else {
        setBroadcasts([])
        setTotal(0)
      }
    } catch (err) {
      console.error(err)
      message.error('加载战报列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 计算看板指标统计
  const loadSummaryStats = async () => {
    try {
      const res = await get<any>('/broadcast/summary-stats')
      const data = res?.data ? res.data : res
      if (data) {
        setSummaryData({
          todayCount: data.today_count || 0,
          pendingCount: data.pending_count || 0,
          sentCount: data.sent_count || 0,
          totalCount: data.total_count || 0,
        })
      }
    } catch (err) {
      console.error('获取统计看板失败', err)
    }
  }

  // 导出战报数据为 Excel
  const handleExportBroadcasts = async () => {
    setExportLoading(true)
    try {
      let url = `/broadcast/export?`
      const targetTeam = isTeamLeader && user?.teamId ? String(user.teamId) : filterTeamId
      const params = []
      if (targetTeam && targetTeam !== 'all') {
        params.push(`team_id=${targetTeam}`)
      }
      if (filterEventType && filterEventType !== 'all') {
        params.push(`event_type=${filterEventType}`)
      }
      if (filterKeyword) {
        params.push(`keyword=${encodeURIComponent(filterKeyword)}`)
      }
      url += params.join('&')

      const response = await get<any>(url, { responseType: 'blob' })
      
      const blob = new Blob([response as any], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `战报导出_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      message.success('战报导出成功')
    } catch (err) {
      console.error('导出战报数据失败', err)
      message.error('导出战报数据失败')
    } finally {
      setExportLoading(false)
    }
  }

  useEffect(() => {
    loadBroadcasts()
    loadSummaryStats()
  }, [page, pageSize, filterTeamId, filterEventType, user])

  useEffect(() => {
    loadUsers()
    loadCrmCustomers()
  }, [])



  // 复制 CRM 商机 ID 提示
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    message.success('商机ID已成功复制到剪贴板')
  }

  // 执行单条删除 (含级联扣减)
  const handleDelete = async (id: number) => {
    try {
      const res = await del<any>(`/broadcast/${id}`)
      if (res) {
        message.success('战报已成功删除，关联业绩明细与日报完成额已级联回滚')
        loadBroadcasts()
        loadSummaryStats()
        setSelectedRowKeys(prev => prev.filter(k => k !== id))
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '删除失败')
    }
  }

  // 执行批量删除 (含级联扣减)
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return
    try {
      const res = await post<any>('/broadcast/batch-delete', {
        ids: selectedRowKeys
      })
      if (res) {
        message.success(`已成功批量删除 ${selectedRowKeys.length} 条战报，对应业绩已被级联清退`)
        setSelectedRowKeys([])
        loadBroadcasts()
        loadSummaryStats()
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '批量删除失败')
    }
  }

  // 触发获取特定拓展进度的 CRM 项目
  const fetchCRMProjects = async (progress: number, initialProject?: any, includeOppId?: string) => {
    setCrmLoading(true)
    try {
      let url = `/broadcast/crm-projects?progress=${progress}`
      if (includeOppId) {
        url += `&include_opp_id=${includeOppId}`
      }
      const res = await get<any>(url)
      const data = res?.data ? res.data : res
      let list = (data && Array.isArray(data)) ? data : []
      if (initialProject) {
        // 检查后端是否返回了该商机的真实数据
        const existRealProj = list.find((p: any) => p.id === initialProject.id)
        if (existRealProj) {
          // 若有真实数据，则保留并优先放到最前面显示
          list = list.filter((p: any) => p.id !== initialProject.id)
          list = [existRealProj, ...list]
        } else {
          // 否则使用临时拼凑的 initialProject 兜底
          list = list.filter((p: any) => p.id !== initialProject.id)
          list = [initialProject, ...list]
        }
      }
      setCrmProjects(list)
    } catch (err) {
      message.error('无法直连获取 CRM 对应进度的项目数据')
      setCrmProjects(initialProject ? [initialProject] : [])
    } finally {
      setCrmLoading(false)
    }
  }

  // 监听创建弹窗里的动作类型变化
  const handleActionTypeChange = (type: string) => {
    setActionType(type)
    createForm.setFieldsValue({
      crm_opportunity_id: undefined,
      customer_name: '',
      amount: 0,
      expect_money: 0,
      budget_money: 0,
      delivery_allocations: [],
      marketing_allocations: [],
      project_name: type === 'happiness' ? '未定' : undefined
    })

    if (type === 'contract') {
      fetchCRMProjects(90) // 合同阶段为 90%
    } else if (type === 'lead_75') {
      fetchCRMProjects(75) // 已中标阶段为 75%
    } else if (type === 'lead_25') {
      fetchCRMProjects(25) // 有效线索阶段为 25%
    }
  }

  // 选中某条 CRM 商机后的数据带入逻辑
  const handleCRMProjectSelect = (oppId: string) => {
    const proj = crmProjects.find(p => p.id === oppId)
    if (!proj) return

    const defaultAmount = proj.expect_money > 0 ? proj.expect_money : proj.budget_money

    createForm.setFieldsValue({
      customer_name: proj.customer_name,
      amount: defaultAmount,
      expect_money: proj.expect_money,
      budget_money: proj.budget_money
    })

    const currentDelivery = [{
      user_id: user?.id || 0,
      ratio: 100,
      amount: defaultAmount
    }]
    createForm.setFieldsValue({ delivery_allocations: currentDelivery })

    if (proj.marketing_users && proj.marketing_users.length > 0) {
      const marketingUsersCount = proj.marketing_users.length
      const avgRatio = Math.round((100 / marketingUsersCount) * 100) / 100
      
      const initMarketingAlloc = proj.marketing_users.map((mu, index) => {
        const matchedLocalId = mu.local_user_id || 0
        const allocRatio = index === marketingUsersCount - 1 
          ? Math.round((100 - avgRatio * (marketingUsersCount - 1)) * 100) / 100 
          : avgRatio

        return {
          user_id: matchedLocalId,
          ratio: allocRatio,
          amount: Math.round((defaultAmount * (allocRatio / 100)) * 100) / 100
        }
      })
      createForm.setFieldsValue({ marketing_allocations: initMarketingAlloc })
    } else {
      createForm.setFieldsValue({ marketing_allocations: [] })
    }

    let progressText = '90%'
    if (actionType === 'lead_75') progressText = '75%'
    if (actionType === 'lead_25') progressText = '25%'

    const generatedContent = `【战报播报】恭喜【${user?.name || '团队成员'}】成功推进项目《${proj.name}》至进度 ${progressText}！业主单位：${proj.customer_name}，合同估算价金额：${defaultAmount} 万元！`
    createForm.setFieldsValue({ content: generatedContent })
  }

  // 选中某条编辑 CRM 商机后的数据带入逻辑
  const handleEditCRMProjectSelect = (oppId: string) => {
    const proj = crmProjects.find(p => p.id === oppId)
    if (!proj) return

    const defaultAmount = proj.expect_money > 0 ? proj.expect_money : proj.budget_money

    editForm.setFieldsValue({
      customer_name: proj.customer_name,
      amount: defaultAmount,
      expect_money: proj.expect_money,
      budget_money: proj.budget_money
    })

    const currentDelivery = [{
      user_id: selectedBroadcast?.user_id || user?.id || 0,
      ratio: 100,
      amount: defaultAmount
    }]
    editForm.setFieldsValue({ delivery_allocations: currentDelivery })

    if (proj.marketing_users && proj.marketing_users.length > 0) {
      const marketingUsersCount = proj.marketing_users.length
      const avgRatio = Math.round((100 / marketingUsersCount) * 100) / 100
      
      const initMarketingAlloc = proj.marketing_users.map((mu, index) => {
        const matchedLocalId = mu.local_user_id || 0
        const allocRatio = index === marketingUsersCount - 1 
          ? Math.round((100 - avgRatio * (marketingUsersCount - 1)) * 100) / 100 
          : avgRatio

        return {
          user_id: matchedLocalId,
          ratio: allocRatio,
          amount: Math.round((defaultAmount * (allocRatio / 100)) * 100) / 100
        }
      })
      editForm.setFieldsValue({ marketing_allocations: initMarketingAlloc })
    } else {
      editForm.setFieldsValue({ marketing_allocations: [] })
    }

    let progressText = '90%'
    if (editEventType === 'lead_75') progressText = '75%'
    if (editEventType === 'lead_25') progressText = '25%'

    const generatedContent = `【战报播报】恭喜【${selectedBroadcast?.user_name || user?.name || '团队成员'}】成功推进项目《${proj.name}》至进度 ${progressText}！业主单位：${proj.customer_name}，合同估算价金额：${defaultAmount} 万元！`
    editForm.setFieldsValue({ content: generatedContent })
  }

  // 重新根据输入框的总金额与分摊比例计算每个员工的分摊具体金额 (新建表单)
  const recalculateAllocations = () => {
    const formVals = createForm.getFieldsValue()
    const totalAmt = formVals.amount || 0

    if (formVals.delivery_allocations) {
      const updated = formVals.delivery_allocations.map((item: any) => ({
        ...item,
        amount: Math.round((totalAmt * ((item.ratio || 0) / 100)) * 100) / 100
      }))
      createForm.setFieldsValue({ delivery_allocations: updated })
    }

    if (formVals.marketing_allocations) {
      const updated = formVals.marketing_allocations.map((item: any) => ({
        ...item,
        amount: Math.round((totalAmt * ((item.ratio || 0) / 100)) * 100) / 100
      }))
      createForm.setFieldsValue({ marketing_allocations: updated })
    }
  }

  // 重新根据编辑表单中的总金额和比例计算分摊具体金额 (编辑表单)
  const recalculateEditAllocations = () => {
    const formVals = editForm.getFieldsValue()
    const totalAmt = formVals.amount || 0

    if (formVals.delivery_allocations) {
      const updated = formVals.delivery_allocations.map((item: any) => ({
        ...item,
        amount: Math.round((totalAmt * ((item.ratio || 0) / 100)) * 100) / 100
      }))
      editForm.setFieldsValue({ delivery_allocations: updated })
    }

    if (formVals.marketing_allocations) {
      const updated = formVals.marketing_allocations.map((item: any) => ({
        ...item,
        amount: Math.round((totalAmt * ((item.ratio || 0) / 100)) * 100) / 100
      }))
      editForm.setFieldsValue({ marketing_allocations: updated })
    }
  }

  // 提交创建新战报
  const handleCreateSubmit = async (values: any) => {
    // 校验比例和
    if (withIndicator && (actionType === 'contract' || actionType === 'lead_75' || actionType === 'lead_25')) {
      const dAllocs = values.delivery_allocations || []
      if (dAllocs.length > 0) {
        const dSum = dAllocs.reduce((sum: number, item: any) => sum + (Number(item.ratio) || 0), 0)
        if (Math.abs(dSum - 100) > 0.1) {
          message.error(`提交失败：交付分摊比例之和必须为 100% (当前为 ${dSum}%)`)
          return
        }
        if (dAllocs.some((item: any) => !item.user_id)) {
          message.error('提交失败：交付分摊存在未选择员工的记录')
          return
        }
      }

      const mAllocs = values.marketing_allocations || []
      if (mAllocs.length > 0) {
        const mSum = mAllocs.reduce((sum: number, item: any) => sum + (Number(item.ratio) || 0), 0)
        if (Math.abs(mSum - 100) > 0.1) {
          message.error(`提交失败：营销分摊比例之和必须为 100% (当前为 ${mSum}%)`)
          return
        }
        if (mAllocs.some((item: any) => !item.user_id)) {
          message.error('提交失败：营销分摊存在未选择员工的记录')
          return
        }
      }
    }

    try {
      const attachment_urls = createFileList
        .filter(file => file.status === 'done' || file.url)
        .map(file => file.url || file.response?.url)
        .filter(Boolean)

      const payload: any = {
        event_type: values.event_type,
        team_id: values.team_id === 'all' || !values.team_id ? null : Number(values.team_id),
        content: values.content,
        push_channel: values.push_channel,
        // 伴随录入日报指标
        action_type: withIndicator ? values.action_type : null,
        customer_name: withIndicator ? values.customer_name : null,
        amount: withIndicator ? Number(values.amount) : null,
        crm_opportunity_id: withIndicator ? values.crm_opportunity_id : null,
        // 分摊
        delivery_allocations: withIndicator ? values.delivery_allocations : null,
        marketing_allocations: withIndicator ? values.marketing_allocations : null,
        happiness_score: withIndicator && values.action_type === 'happiness' ? values.happiness_score : null,
        project_name: withIndicator && values.action_type === 'happiness' ? (values.project_name || '未定') : null,
        action_description: withIndicator ? values.action_description : null,
        // 铁三角联动新增字段
        employee_name: withIndicator ? values.employee_name : null,
        copartners: withIndicator ? values.copartners : null,
        marketing_copartners: withIndicator ? values.marketing_copartners : null,
        attachment_urls: withIndicator && ['contract', 'happiness', 'triangle'].includes(values.action_type) && attachment_urls.length > 0 ? attachment_urls : undefined
      }

      const res = await post<any>('/broadcast', payload)
      if (res) {
        message.success('战报创建成功！已自动广播推送并重算大屏数据')
        setCreateVisible(false)
        createForm.resetFields()
        setCreateFileList([])
        setWithIndicator(false)
        loadBroadcasts()
        loadSummaryStats()
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '手动录入战报失败')
    }
  }

  // 提交修改战报
  const handleEditSubmit = async (values: any) => {
    if (!selectedBroadcast) return

    // 针对合同新签类型的分摊和进行校验
    if (editEventType === 'contract_signed') {
      const dAllocs = values.delivery_allocations || []
      if (dAllocs.length > 0) {
        const dSum = dAllocs.reduce((sum: number, item: any) => sum + (Number(item.ratio) || 0), 0)
        if (Math.abs(dSum - 100) > 0.1) {
          message.error(`保存失败：交付分摊比例之和必须为 100% (当前为 ${dSum}%)`)
          return
        }
      }

      const mAllocs = values.marketing_allocations || []
      if (mAllocs.length > 0) {
        const mSum = mAllocs.reduce((sum: number, item: any) => sum + (Number(item.ratio) || 0), 0)
        if (Math.abs(mSum - 100) > 0.1) {
          message.error(`保存失败：营销分摊比例之和必须为 100% (当前为 ${mSum}%)`)
          return
        }
      }
    }

    try {
      const attachment_urls = editFileList
        .filter(file => file.status === 'done' || file.url)
        .map(file => file.url || file.response?.url)
        .filter(Boolean)

      const payload: any = {
        content: values.content,
        push_status: values.push_status,
        push_channel: values.push_channel,
        crm_opportunity_id: values.crm_opportunity_id || ''
      }

      // 如果是前三种(关联 CRM) 或 铁三角/幸福动作，将对应的客户名称、金额及分摊发送回写
      if (editEventType === 'contract_signed' || editEventType === 'lead_75' || editEventType === 'lead_25') {
        payload.customer_name = values.customer_name
        payload.amount = Number(values.amount || 0)
      }
      if (editEventType === 'contract_signed') {
        payload.delivery_allocations = values.delivery_allocations
        payload.marketing_allocations = values.marketing_allocations
      }
      if (editEventType === 'triangle' || editEventType === 'happiness') {
        payload.customer_name = values.customer_name
        payload.action_description = values.action_description
      }
      if (editEventType === 'triangle') {
        payload.employee_name = values.employee_name
        payload.copartners = values.copartners
        payload.marketing_copartners = values.marketing_copartners
      }
      if (editEventType === 'happiness') {
        payload.happiness_score = values.happiness_score
        payload.project_name = values.project_name || '未定'
      }
      if (editEventType === 'station_report') {
        payload.project_name = values.project_name
        payload.station_location = values.station_location
        payload.station_category = values.station_category
        payload.summary = values.summary
        payload.is_urgent = !!values.is_urgent
      }

      if (['contract_signed', 'happiness', 'triangle'].includes(editEventType)) {
        payload.attachment_urls = attachment_urls.length > 0 ? attachment_urls : null
      }

      const res = await put<any>(`/broadcast/${selectedBroadcast.id}`, payload)
      if (res) {
        message.success('战报修改成功，已联动级联同步重算业绩数据')
        setEditVisible(false)
        setEditFileList([])
        setEditPassword('')
        loadBroadcasts()
        loadSummaryStats()
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '编辑保存失败')
    }
  }


  // 表格列定义
  const columns = [
    {
      title: '事件类型',
      dataIndex: 'event_type',
      key: 'event_type',
      width: 145,
      render: (val: string) => {
        let label = '自定义播报'
        let color = 'default'
        if (val === 'contract_signed') {
          label = '已完成合同签订'
          color = 'volcano'
        } else if (val === 'lead_75') {
          label = '中标确定'
          color = 'gold'
        } else if (val === 'lead_25') {
          label = '有效线索确定'
          color = 'green'
        } else if (val === 'triangle') {
          label = '铁三角联动'
          color = 'blue'
        } else if (val === 'happiness') {
          label = '客户幸福动作'
          color = 'purple'
        } else if (val === 'station_report') {
          label = '驻点快报'
          color = 'cyan'
        }
        return <Tag color={color} style={{ fontWeight: 'bold', padding: '3px 8px', borderRadius: 4 }}>{label}</Tag>
      }
    },
    {
      title: '播报内容',
      dataIndex: 'content',
      key: 'content',
      render: (val: string) => (
        <Tooltip title={val} placement="topLeft" overlayStyle={{ maxWidth: 400 }}>
          <div style={{
            maxHeight: 50,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            color: '#333',
            fontSize: '13.5px',
            lineHeight: '1.5'
          }}>
            {val}
          </div>
        </Tooltip>
      )
    },
    {
      title: '发布人',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 90,
      render: (val: string) => <span style={{ fontWeight: 500 }}>{val || '系统'}</span>
    },
    {
      title: '所属战队',
      dataIndex: 'team_name',
      key: 'team_name',
      width: 110,
      render: (val: string) => val ? <Tag color="cyan">{val}</Tag> : <span style={{ color: '#aaa' }}>-</span>
    },
    {
      title: '推送状态',
      dataIndex: 'push_status',
      key: 'push_status',
      width: 95,
      render: (val: string) => {
        if (val === 'sent') return <Tag color="success">已发送</Tag>
        if (val === 'pending') return <Tag color="warning">待推送</Tag>
        return <Tag color="error">发送失败</Tag>
      }
    },
    {
      title: '推送渠道',
      dataIndex: 'push_channel',
      key: 'push_channel',
      width: 105,
      render: (val: string) => {
        if (val === 'dingtalk') return <Space><DingtalkOutlined style={{ color: '#1890ff' }} />钉钉</Space>
        if (val === 'system') return <Space><DesktopOutlined style={{ color: '#52c41a' }} />系统</Space>
        return <Space><GlobalOutlined style={{ color: '#722ed1' }} />全渠道</Space>
      }
    },
    {
      title: 'CRM商机关联',
      dataIndex: 'crm_opportunity_id',
      key: 'crm_opportunity_id',
      width: 180,
      render: (val: string, record: BroadcastItem) => {
        if (!val) return <span style={{ color: '#ccc' }}>未关联</span>
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            {record.crm_opportunity_name ? (
              <div 
                style={{ 
                  fontWeight: 'bold', 
                  color: '#262626', 
                  whiteSpace: 'normal', 
                  wordBreak: 'break-all',
                  fontSize: 13 
                }}
              >
                {record.crm_opportunity_name}
              </div>
            ) : (
              <span style={{ color: '#8c8c8c', fontSize: 12 }}>（暂无项目名称）</span>
            )}
            <Space size={4}>
              <Tooltip title={val} placement="topLeft">
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#8c8c8c' }}>
                  {val.length > 8 ? `${val.substring(0, 8)}...` : val}
                </span>
              </Tooltip>
              <Button 
                type="text" 
                size="small" 
                style={{ height: 20, width: 20, padding: 0 }}
                icon={<CopyOutlined style={{ fontSize: 10, color: '#1890ff' }} />} 
                onClick={() => copyToClipboard(val)} 
              />
            </Space>
          </Space>
        )
      }
    },
    {
      title: '播报时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: BroadcastItem) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined style={{ color: '#1890ff' }} />}
            disabled={!hasPermission('approve_report')}
            onClick={() => {
              setSelectedBroadcast(record)
              setEditEventType(record.event_type)

              // 自动通过正则或分摊和提炼已有的合同总金额与客户名称回填
              const totalAllocAmount = record.delivery_allocations 
                ? record.delivery_allocations.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)
                : 0;

              // 从 content 中提取客户单位名称以兜底
              const matchCustomer = record.customer_name ||
                                    record.content.match(/业主单位：\s*([^，!。；]+)/)?.[1] || 
                                    record.content.match(/客户为\s*([^，!。；]+)/)?.[1] || 
                                    record.content.match(/客户分别为\s*([^，!。；]+)/)?.[1] || 
                                    record.content.match(/对象为【([^】]+)】/)?.[1] || 
                                    record.content.match(/在【([^】]+)】/)?.[1] ||
                                    '';
              const matchProjectName = record.content.match(/《([^》]+)》/)?.[1] || '已关联项目';

              const matchEmployeeName = record.content.match(/我司【([^】]+)】/)?.[1] || record.user_name || '';
              const copartnersMatch = record.content.match(/联动人\(([^)]+)\)/)?.[1];
              const matchCopartners = copartnersMatch ? copartnersMatch.split('、') : [];
              const marketingMatch = record.content.match(/营销人员\(([^)]+)\)/)?.[1];
              const matchMarketingCopartners = marketingMatch ? marketingMatch.split('、') : [];
              const matchActionDesc = (record as any).action_description ||
                                      record.content.match(/联动动作：\s*([^。]+)/)?.[1] ||
                                      record.content.match(/客户幸福标准\d+分\s*(.*?)\s*动作/)?.[1] || '';

              const initialProj = record.crm_opportunity_id ? {
                id: record.crm_opportunity_id,
                name: matchProjectName,
                customer_name: matchCustomer,
                expect_money: record.amount || totalAllocAmount || 0,
                budget_money: record.amount || totalAllocAmount || 0,
                marketing_users: []
              } : undefined;

              let progress = 90
              if (record.event_type === 'lead_75') progress = 75
              if (record.event_type === 'lead_25') progress = 25

              if (['contract_signed', 'lead_75', 'lead_25'].includes(record.event_type)) {
                fetchCRMProjects(progress, initialProj, record.crm_opportunity_id)
              }

              const matchHappinessScore = (record as any).happiness_score !== undefined
                ? (record as any).happiness_score
                : (parseInt(record.content.match(/客户幸福标准(\d+)分/)?.[1] || '20'));

              const initialSelectedStandards = matchActionDesc ? matchActionDesc.split(/[；;]/).filter(Boolean) : [];
              const matchTriangleResult = (record as any).triangle_result || record.content.match(/成果：\s*([^。\n]+)/)?.[1] || '';
              const matchCustomerFeedback = (record as any).customer_feedback || record.content.match(/客户反馈：\s*([^。\n]+)/)?.[1] || '';
              const matchRecommendAction = (record as any).recommend_action || record.content.match(/内部可推广复制的做法：\s*([^。\n]+)/)?.[1] || '';

              const initialFileList = (record.attachment_urls || []).map((item: any, index: number) => {
                const urlStr = typeof item === 'string' ? item : (item?.url || '');
                const nameStr = typeof item === 'string' ? `image-${index}.png` : (item?.name || `file-${index}`);
                return {
                  uid: `-${index}`,
                  name: nameStr,
                  status: 'done',
                  url: urlStr
                };
              })
              setEditFileList(initialFileList)

              // 异步获取最新政策解压密码
              if (record.event_type === 'station_report' && record.station_category === 'policy') {
                get<any>(`/broadcast/${record.id}/password`).then(res => {
                  const pwd = res?.password || res?.data?.password || '';
                  setEditPassword(pwd);
                }).catch(() => {
                  setEditPassword('');
                });
              } else {
                setEditPassword('');
              }

              editForm.setFieldsValue({
                content: record.content,
                push_status: record.push_status,
                push_channel: record.push_channel,
                crm_opportunity_id: record.crm_opportunity_id,
                customer_name: matchCustomer,
                amount: record.amount || totalAllocAmount || 0,
                expect_money: record.amount || totalAllocAmount || 0,
                budget_money: record.amount || totalAllocAmount || 0,
                delivery_allocations: record.delivery_allocations || [],
                marketing_allocations: record.marketing_allocations || [],
                // 铁三角回填
                employee_name: matchEmployeeName,
                copartners: matchCopartners,
                marketing_copartners: matchMarketingCopartners,
                action_description: matchActionDesc,
                triangle_result: matchTriangleResult,
                customer_feedback: matchCustomerFeedback,
                // 幸福动作回填
                project_name: record.event_type === 'happiness' ? (record.project_name || '未定') : (record.project_name || ''),
                happiness_score: matchHappinessScore,
                selected_standards: initialSelectedStandards,
                happiness_result: matchTriangleResult,
                happiness_feedback: matchCustomerFeedback,
                recommend_action: matchRecommendAction,
                // 驻点播报回填
                station_location: (record as any).station_location || '',
                station_category: (record as any).station_category || '',
                summary: (record as any).summary || '',
                is_urgent: (record as any).is_urgent || false
              })
              setEditVisible(true)
            }}

          >
            编辑
          </Button>
          <Popconfirm
            title={
              <div style={{ maxWidth: 260 }}>
                <span style={{ color: '#f5222d', fontWeight: 'bold' }}>⚠️ 级联扣减警告</span>
                <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>该操作将清除战报！若有关联的 CRM 项目，对应用户的日报新签金额及明细业绩将被自动回滚清退。确定删除吗？</p>
              </div>
            }
            onConfirm={() => handleDelete(record.id)}
            okText="狠心删除"
            cancelText="保留"
            okButtonProps={{ danger: true }}
            disabled={!hasPermission('reject_report')}
          >
            <Button type="text" danger icon={<DeleteOutlined />} disabled={!hasPermission('reject_report')}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  // 表格多选配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  }



  return (
    <div style={{ padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      {/* 头部微型渐变统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: 'linear-gradient(135deg, #e0f7fa 0%, #80deea 100%)', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <Statistic title={<span style={{ color: '#006064', fontWeight: 500 }}>今日播报数</span>} value={summaryData.todayCount} valueStyle={{ color: '#006064', fontWeight: 'bold' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: 'linear-gradient(135deg, #fff3e0 0%, #ffcc80 100%)', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <Statistic title={<span style={{ color: '#e65100', fontWeight: 500 }}>待推送消息</span>} value={summaryData.pendingCount} valueStyle={{ color: '#e65100', fontWeight: 'bold' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #a5d6a7 100%)', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <Statistic title={<span style={{ color: '#1b5e20', fontWeight: 500 }}>成功已发送</span>} value={summaryData.sentCount} valueStyle={{ color: '#1b5e20', fontWeight: 'bold' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: 'linear-gradient(135deg, #f3e5f5 0%, #ce93d8 100%)', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <Statistic title={<span style={{ color: '#4a148c', fontWeight: 500 }}>历史累计战报</span>} value={summaryData.totalCount} valueStyle={{ color: '#4a148c', fontWeight: 'bold' }} />
          </Card>
        </Col>
      </Row>

      {/* 头部标题与控制按钮 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <h3 style={{ fontSize: 20, margin: 0, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            📢 实时战报与广播管理控制台
          </h3>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ExportOutlined />}
              loading={exportLoading}
              onClick={handleExportBroadcasts}
              style={{ borderRadius: 4 }}
            >
              导出
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!hasPermission('approve_report')}
              onClick={() => {
                createForm.resetFields()
                setWithIndicator(false)
                setCreateVisible(true)
              }}
              style={{ borderRadius: 4 }}
            >
              手动新建战报
            </Button>
            <Button
              icon={<SyncOutlined />}
              onClick={() => {
                loadBroadcasts()
                loadSummaryStats()
                message.success('战报数据已刷新')
              }}
            >
              刷新
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 筛选面板 */}
      <Card bordered={false} style={{ marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }} styles={{ body: { padding: '16px' } }}>
        <Row gutter={[16, 16]} align="middle">
          <Col>
            <Space>
              <FilterOutlined style={{ color: '#1890ff' }} />
              <strong>类型过滤：</strong>
            </Space>
          </Col>
          <Col xs={24} sm={6} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="按战队筛选"
              value={filterTeamId || (isTeamLeader ? String(user?.teamId) : 'all')}
              onChange={(val) => {
                setFilterTeamId(val)
                setPage(1)
              }}
              disabled={isTeamLeader}
              options={TEAM_OPTIONS}
            />
          </Col>
          <Col xs={24} sm={6} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="按类型筛选"
              value={filterEventType || 'all'}
              onChange={(val) => {
                setFilterEventType(val)
                setPage(1)
              }}
              options={[{ label: '全部战报动作类型', value: 'all' }, ...EVENT_TYPE_OPTIONS]}
            />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Input
              placeholder="关键字检索播报文本..."
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              onPressEnter={() => setPage(1)}
              allowClear
            />
          </Col>
          <Col>
            <Space>
              <Button type="primary" onClick={() => setPage(1)}>搜索</Button>
              <Button
                onClick={() => {
                  if (!isTeamLeader) {
                    setFilterTeamId(undefined)
                  }
                  setFilterEventType(undefined)
                  setFilterKeyword('')
                  setPage(1)
                }}
              >
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 批量操作提示栏 */}
      {selectedRowKeys.length > 0 && (
        <Card size="small" style={{ marginBottom: 12, background: '#fff2e8', border: '1px solid #ffbb96', borderRadius: 4 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <WarningOutlined style={{ color: '#fa541c' }} />
                <span>已选中 <strong style={{ color: '#fa541c' }}>{selectedRowKeys.length}</strong> 项战报广播事件。</span>
                <span style={{ fontSize: 12, color: '#8c8c8c' }}>（执行批量删除将级联清除已关联的 CRM 业绩日报数据并重新扣减，请务必核实！）</span>
              </Space>
            </Col>
            <Col>
              <Space>
                <Popconfirm
                  title={
                    <div style={{ maxWidth: 280 }}>
                      <span style={{ color: '#f5222d', fontWeight: 'bold' }}>⚠️ 确认批量清退吗？</span>
                      <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>该操作将彻底物理删除选中的 {selectedRowKeys.length} 条战报，扣回所有关联业绩和日报明细，此过程无法恢复！</p>
                    </div>
                  }
                  onConfirm={handleBatchDelete}
                  okText="确定批量删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  disabled={!hasPermission('reject_report')}
                >
                  <Button type="primary" danger size="small" icon={<DeleteOutlined />} disabled={!hasPermission('reject_report')}>
                    批量删除所选
                  </Button>
                </Popconfirm>
                <Button size="small" onClick={() => setSelectedRowKeys([])}>取消选择</Button>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* 数据表格主体 */}
      <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)', borderRadius: 8 }}>
        <Table
          rowSelection={rowSelection}
          dataSource={broadcasts}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条战报记录`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            }
          }}
        />
      </Card>

      {/* 手动新建战报Modal */}
      <Modal
        title={<strong>📢 新建实时战报与广播事件</strong>}
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        width={720}
        onOk={() => createForm.submit()}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            event_type: 'custom',
            push_channel: 'all',
            team_id: isTeamLeader ? String(user?.teamId) : undefined
          }}
          onFinish={handleCreateSubmit}
          onValuesChange={handleCreateValuesChange}
          style={{ marginTop: 12 }}
        >

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="event_type"
                label="事件类型"
                rules={[{ required: true, message: '请选择事件类型' }]}
              >
                <Select options={EVENT_TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="team_id"
                label="关联战队 (可选)"
              >
                <Select disabled={isTeamLeader} options={[{ label: '不关联特定战队', value: 'all' }, ...TEAM_OPTIONS.filter(o => o.value !== 'all')]} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="push_channel"
                label="推送渠道"
                rules={[{ required: true, message: '请选择推送渠道' }]}
              >
                <Select options={PUSH_CHANNEL_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12} style={{ display: 'flex', alignItems: 'center', paddingTop: 24 }}>
              <Space>
                <Switch 
                  checked={withIndicator} 
                  onChange={(val) => {
                    setWithIndicator(val)
                    if (val) {
                      handleActionTypeChange('contract')
                    }
                  }} 
                />
                <strong>伴随录入日报指标</strong>
                <Tooltip title="开启后，允许同时为录入员工落库已通过审核的日报业绩，并支持业绩分摊。">
                  <InfoCircleOutlined style={{ color: '#1890ff' }} />
                </Tooltip>
              </Space>
            </Col>
          </Row>

          {/* 伴随录入板块 */}
          {withIndicator && (
            <div style={{ background: '#f9f9f9', padding: '16px', borderRadius: 8, marginBottom: 16, borderLeft: '4px solid #1890ff' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#1890ff', fontWeight: 'bold' }}>💡 日报业绩指标伴随录入</h4>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="action_type"
                    label="指标动作类型"
                    initialValue="contract"
                  >
                    <Select 
                      onChange={handleActionTypeChange}
                      options={[
                        { label: '已完成合同签订 (90%)', value: 'contract' },
                        { label: '铁三角联动', value: 'triangle' },
                        { label: '客户幸福动作', value: 'happiness' },
                      ]} 
                    />
                  </Form.Item>
                </Col>
                
                {/* 25%/75%/90% 提供直连 CRM */}
                {(actionType === 'contract' || actionType === 'lead_75' || actionType === 'lead_25') && (
                  <Col span={12}>
                    <Form.Item
                      name="crm_opportunity_id"
                      label="直连 CRM 匹配商机"
                      rules={[{ required: true, message: '请选择关联的 CRM 商机' }]}
                    >
                      <Select
                        showSearch
                        placeholder="选择或搜索未绑定的 CRM 商机"
                        loading={crmLoading}
                        onSelect={handleCRMProjectSelect}
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={crmProjects.map(p => ({
                          label: `[CRM] ${p.name} (${p.customer_name})`,
                          value: p.id
                        }))}
                      />
                    </Form.Item>
                  </Col>
                )}
              </Row>

              {/* 业主单位与合同价格 */}
              <Row gutter={16}>
                {actionType === 'happiness' && (
                  <Col span={12}>
                    <Form.Item
                      name="project_name"
                      label="项目名称"
                    >
                      <Select
                        showSearch
                        placeholder="输入关键字检索并选择 CRM 项目（选填，默认为未定）"
                        filterOption={false}
                        onSearch={handleProjectSearch}
                        options={crmProjectsSearch.map(p => ({ label: p, value: p }))}
                        defaultActiveFirstOption={false}
                        allowClear
                      />
                    </Form.Item>
                  </Col>
                )}

                <Col span={12}>
                  <Form.Item
                    name="customer_name"
                    label="业主/客户名称"
                    rules={[{ required: true, message: '请选择业主/客户名称' }]}
                  >
                    <Select
                      showSearch
                      placeholder="输入关键字检索并选择 CRM 客户"
                      filterOption={false}
                      onSearch={handleCustomerSearch}
                      options={crmCustomers.map(c => ({ label: c, value: c }))}
                      defaultActiveFirstOption={false}
                    />
                  </Form.Item>
                </Col>
                
                {(actionType === 'contract' || actionType === 'lead_75' || actionType === 'lead_25') && (
                  <Col span={12}>
                    <Form.Item
                      name="amount"
                      label="合同价格 / 预计金额 (万元)"
                      rules={[{ required: true, message: '请输入金额' }]}
                    >
                      <InputNumber 
                        style={{ width: '100%' }} 
                        min={0} 
                        onChange={() => setTimeout(recalculateAllocations, 100)} 
                      />
                    </Form.Item>
                  </Col>
                )}

                {actionType === 'happiness' && (
                  <Col span={12}>
                    <Form.Item
                      name="happiness_score"
                      label="幸福得分 (分值)"
                      initialValue={20}
                      rules={[{ required: true, message: '请选择幸福分值' }]}
                    >
                      <Select placeholder="选择客户幸福标准分值">
                        <Select.Option value={0}>0分</Select.Option>
                        <Select.Option value={20}>20分</Select.Option>
                        <Select.Option value={50}>50分</Select.Option>
                        <Select.Option value={100}>100分</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                )}
              </Row>

              {actionType === 'happiness' && createHappinessScore !== undefined && HAPPINESS_STANDARDS[String(createHappinessScore)] && (
                <Form.Item name="selected_standards" label="客户幸福标准选项勾选">
                  <Checkbox.Group style={{ width: '100%' }}>
                    <Collapse 
                      size="small" 
                      defaultActiveKey={HAPPINESS_STANDARDS[String(createHappinessScore)].sections.map((s: any) => s.section_id)}
                      style={{ marginBottom: 16, maxHeight: '300px', overflowY: 'auto' }}
                    >
                      {HAPPINESS_STANDARDS[String(createHappinessScore)].sections.map((sec: any) => (
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

              {actionType === 'happiness' && (
                <>
                  <Form.Item
                    name="action_description"
                    label="具体幸福关怀动作说明"
                    rules={[{ required: true, message: '请输入具体关怀与拜访动作' }]}
                  >
                    <Input.TextArea 
                      placeholder="请输入具体执行的关怀动作说明..." 
                      rows={3} 
                      autoSize={{ minRows: 2, maxRows: 6 }} 
                    />
                  </Form.Item>
                  <Form.Item name="happiness_result" label="成果" rules={[{ required: true, message: '请输入取得的成果' }]}>
                    <Input.TextArea placeholder="（推进到什么阶段/达成什么结果）" rows={3} />
                  </Form.Item>
                  <Form.Item name="happiness_feedback" label="客户反馈（可选）">
                    <Input.TextArea placeholder="“（客户原话或总结）”" rows={3} />
                  </Form.Item>
                  <Form.Item name="recommend_action" label="内部可推广复制的做法" rules={[{ required: true, message: '请输入内部可推广复制的做法说明' }]}>
                    <Input.TextArea placeholder="具体做法说明" rows={3} />
                  </Form.Item>
                </>
              )}


              {actionType === 'triangle' && (
                <>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="employee_name" label="用户自己的姓名" rules={[{ required: true, message: '请选择录入员工姓名' }]} initialValue={user?.name}>
                        <Select
                          showSearch
                          placeholder="选择录入员工姓名"
                          optionFilterProp="label"
                          filterOption={(input, option) =>
                            ((option as any)?.label ?? '').toLowerCase().includes(input.toLowerCase())
                          }
                          options={users.map(u => ({ value: u.name, label: u.name }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="copartners" label="联动人 (除营销岗，多选)">
                        <Select
                          mode="multiple"
                          placeholder="请选择联动人"
                          optionFilterProp="label"
                          filterOption={(input, option) =>
                            ((option as any)?.label ?? '').toLowerCase().includes(input.toLowerCase())
                          }
                          options={users.filter(u => u.position_type !== 'marketing').map(u => ({ value: u.name, label: u.name }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="marketing_copartners" label="营销联动人 (营销岗，多选)">
                        <Select
                          mode="multiple"
                          placeholder="请选择营销人员"
                          optionFilterProp="label"
                          filterOption={(input, option) =>
                            ((option as any)?.label ?? '').toLowerCase().includes(input.toLowerCase())
                          }
                          options={users.filter(u => u.position_type === 'marketing').map(u => ({ value: u.name, label: u.name }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  
                  <Form.Item name="action_description" label="联动的动作" rules={[{ required: true, message: '请输入联动动作说明' }]}>
                    <Input.TextArea placeholder="请输入具体的铁三角联动动作描述..." rows={3} />
                  </Form.Item>
                  <Form.Item name="triangle_result" label="成果" rules={[{ required: true, message: '请输入联动取得的成果' }]}>
                    <Input.TextArea placeholder="（推进到什么阶段/达成什么结果）" rows={3} />
                  </Form.Item>
                  <Form.Item name="customer_feedback" label="客户反馈" rules={[{ required: true, message: '请输入客户反馈' }]}>
                    <Input.TextArea placeholder="“（客户原话或总结）”" rows={3} />
                  </Form.Item>
                </>
              )}

              {/* 业绩比例分摊部分 */}
              {(actionType === 'contract') && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  
                  {/* 交付分摊 */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <strong style={{ fontSize: 13 }}>🛠️ 交付业绩分配分摊 (比例之和必须为 100%)</strong>
                      <Button 
                        size="small" 
                        type="dashed" 
                        onClick={() => {
                          const currentVals = createForm.getFieldValue('delivery_allocations') || []
                          createForm.setFieldsValue({
                            delivery_allocations: [...currentVals, { user_id: undefined, ratio: 0, amount: 0 }]
                          })
                        }}
                      >
                        + 添加交付成员
                      </Button>
                    </div>
                    
                    <Form.List name="delivery_allocations">
                      {(fields, { remove }) => (
                        <>
                          {fields.map(({ key, name, ...restField }) => (
                            <Row gutter={8} key={key} align="middle" style={{ marginBottom: 8 }}>
                              <Col span={10}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'user_id']}
                                  rules={[{ required: true, message: '必填' }]}
                                  style={{ margin: 0 }}
                                >
                                  <Select
                                    showSearch
                                    placeholder="选择交付人员"
                                    options={users.map(u => ({ label: `${u.name}`, value: u.id }))}
                                    filterOption={(input, option) =>
                                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                  />
                                </Form.Item>
                              </Col>
                              <Col span={6}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'ratio']}
                                  rules={[{ required: true, message: '必填' }]}
                                  style={{ margin: 0 }}
                                >
                                  <InputNumber
                                    placeholder="比例 (%)"
                                    min={0}
                                    max={100}
                                    style={{ width: '100%' }}
                                    formatter={value => `${value}%`}
                                    parser={value => value!.replace('%', '')}
                                    onChange={() => setTimeout(recalculateAllocations, 100)}
                                  />
                                </Form.Item>
                              </Col>
                              <Col span={6}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'amount']}
                                  style={{ margin: 0 }}
                                >
                                  <InputNumber placeholder="分摊金额(万)" disabled style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={2}>
                                <Button type="link" danger onClick={() => { remove(name); setTimeout(recalculateAllocations, 100); }}>删除</Button>
                              </Col>
                            </Row>
                          ))}
                        </>
                      )}
                    </Form.List>
                  </div>

                  {/* 营销分摊 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <strong style={{ fontSize: 13 }}>💰 营销业绩分配分摊 (比例之和必须为 100%)</strong>
                      <Button 
                        size="small" 
                        type="dashed" 
                        onClick={() => {
                          const currentVals = createForm.getFieldValue('marketing_allocations') || []
                          createForm.setFieldsValue({
                            marketing_allocations: [...currentVals, { user_id: undefined, ratio: 0, amount: 0 }]
                          })
                        }}
                      >
                        + 添加营销成员
                      </Button>
                    </div>

                    <Form.List name="marketing_allocations">
                      {(fields, { remove }) => (
                        <>
                          {fields.map(({ key, name, ...restField }) => (
                            <Row gutter={8} key={key} align="middle" style={{ marginBottom: 8 }}>
                              <Col span={10}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'user_id']}
                                  rules={[{ required: true, message: '必填' }]}
                                  style={{ margin: 0 }}
                                >
                                  <Select
                                    showSearch
                                    placeholder="选择营销人员"
                                    options={users.map(u => ({ label: `${u.name}`, value: u.id }))}
                                    filterOption={(input, option) =>
                                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                  />
                                </Form.Item>
                              </Col>
                              <Col span={6}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'ratio']}
                                  rules={[{ required: true, message: '必填' }]}
                                  style={{ margin: 0 }}
                                >
                                  <InputNumber
                                    placeholder="比例 (%)"
                                    min={0}
                                    max={100}
                                    style={{ width: '100%' }}
                                    formatter={value => `${value}%`}
                                    parser={value => value!.replace('%', '')}
                                    onChange={() => setTimeout(recalculateAllocations, 100)}
                                  />
                                </Form.Item>
                              </Col>
                              <Col span={6}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'amount']}
                                  style={{ margin: 0 }}
                                >
                                  <InputNumber placeholder="分摊金额(万)" disabled style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={2}>
                                <Button type="link" danger onClick={() => { remove(name); setTimeout(recalculateAllocations, 100); }}>删除</Button>
                              </Col>
                            </Row>
                          ))}
                        </>
                      )}
                    </Form.List>
                  </div>
                </>
              )}
              {['contract', 'happiness', 'triangle'].includes(actionType) && (

                <Form.Item label="📎 上传证明照片（可选，最多3张）">
                  <Upload
                    customRequest={customUpload}
                    listType="picture-card"
                    fileList={createFileList}
                    onChange={({ fileList }) => setCreateFileList(fileList)}
                    maxCount={3}
                    accept="image/*"
                  >
                    {createFileList.length < 3 && (
                      <div>
                        <PlusOutlined />
                        <div style={{ marginTop: 8 }}>上传</div>
                      </div>
                    )}
                  </Upload>
                </Form.Item>
              )}
            </div>
          )}


          <Form.Item
            name="content"
            label="战报广播文本内容"
            rules={[{ required: true, message: '请输入战报播报内容' }]}
          >
            <Input.TextArea placeholder="写入推送到大屏及钉钉群的战报词..." rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑战报Modal (根据选择的播报类型差异化展示字段) */}
      <Modal
        title={<strong>✏️ 编辑战报播报内容与实绩关联</strong>}
        open={editVisible}
        onCancel={() => { setEditVisible(false); setEditFileList([]); setEditPassword(''); }}
        onOk={() => editForm.submit()}
        destroyOnClose
        width={editEventType === 'contract_signed' ? 720 : 520}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditSubmit}
          onValuesChange={handleEditValuesChange}
          style={{ marginTop: 12 }}
        >

          {/* 基本文本和通道 */}
          <Form.Item
            name="content"
            label="播报文本内容"
            rules={[{ required: true, message: '请输入播报内容' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>

          {/* 驻点人员播报的专属字段 */}
          {editEventType === 'station_report' && (
            <>
              <Form.Item
                name="project_name"
                label="播报标题"
                rules={[{ required: true, message: '请输入播报标题' }]}
              >
                <Input placeholder="请输入播报标题" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="station_location"
                    label="驻点地点"
                    rules={[{ required: true, message: '请输入驻点地点' }]}
                  >
                    <Input placeholder="如: 广州/深圳/茂名" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="station_category"
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
                </Col>
              </Row>

              <Form.Item
                name="summary"
                label="内容摘要（选填，不填则根据正文自动生成前150字）"
              >
                <Input.TextArea rows={2} placeholder="用于钉钉消息推送预览，限150字以内" maxLength={150} />
              </Form.Item>

              <Form.Item
                name="is_urgent"
                label="是否紧急快报"
                valuePropName="checked"
              >
                <Checkbox style={{ color: '#ff4d4f' }}>
                  🚨 紧急播报（勾选后将通过钉钉群发并强提醒 @所有人 ！）
                </Checkbox>
              </Form.Item>
            </>
          )}

          {/* 前三种 (lead_25, lead_75, contract_signed) 显示和 CRM 潜力库选择下拉框 */}
          {['lead_25', 'lead_75', 'contract_signed'].includes(editEventType) && (
            <Form.Item
              name="crm_opportunity_id"
              label={
                editEventType === 'contract_signed'
                  ? '从项目管理系统的合同表获取'
                  : editEventType === 'lead_75'
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
                onSelect={handleEditCRMProjectSelect}
              />
            </Form.Item>
          )}

          {/* 有效线索确定 (25%) / 中标确定 (75%) 的回填只读界面 */}
          {(editEventType === 'lead_25' || editEventType === 'lead_75') && (
            <>
              <Form.Item name="customer_name" label="客户名称" rules={[{ required: true, message: '选择项目后自动填入' }]}>
                <Input disabled placeholder="选择项目后自动回填业主单位" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="budget_money" label="项目预算金额 (万元)">
                    <Input disabled placeholder="自动回填" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="expect_money" label="预计金额 (万元)">
                    <Input disabled placeholder="自动回填" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* 合同签订 (90%) 类型的客户名称回填 */}
          {editEventType === 'contract_signed' && (
            <Form.Item name="customer_name" label="客户名称" rules={[{ required: true, message: '选择项目后自动填入' }]}>
              <Input disabled placeholder="选择项目后自动回填业主单位" />
            </Form.Item>
          )}

          {editEventType === 'happiness' && (
            <Form.Item
              name="project_name"
              label="项目名称"
            >
              <Select
                showSearch
                placeholder="输入关键字检索并选择 CRM 项目（选填，默认为未定）"
                filterOption={false}
                onSearch={handleProjectSearch}
                options={crmProjectsSearch.map(p => ({ label: p, value: p }))}
                defaultActiveFirstOption={false}
                allowClear
              />
            </Form.Item>
          )}

          {/* 后两种 (triangle, happiness) 显示和客户相关属性 */}
          {(editEventType === 'triangle' || editEventType === 'happiness') && (
            <Form.Item
              name="customer_name"
              label="客户 / 业主名称"
              rules={[{ required: true, message: '请选择客户/业主名称' }]}
            >
              <Select
                showSearch
                placeholder="输入关键字检索并选择 CRM 客户"
                filterOption={false}
                onSearch={handleCustomerSearch}
                options={crmCustomers.map(c => ({ label: c, value: c }))}
                defaultActiveFirstOption={false}
              />
            </Form.Item>
          )}

          {editEventType === 'triangle' && (
            <>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="employee_name" label="用户自己的姓名" rules={[{ required: true, message: '请选择录入员工姓名' }]}>
                    <Select
                      showSearch
                      placeholder="选择录入员工姓名"
                      optionFilterProp="label"
                      filterOption={(input, option) =>
                        ((option as any)?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={users.map(u => ({ value: u.name, label: u.name }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="copartners" label="联动人 (除营销岗，多选)">
                    <Select
                      mode="multiple"
                      placeholder="请选择联动人"
                      optionFilterProp="label"
                      filterOption={(input, option) =>
                        ((option as any)?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={users.filter(u => u.position_type !== 'marketing').map(u => ({ value: u.name, label: u.name }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="marketing_copartners" label="营销联动人 (营销岗，多选)">
                    <Select
                      mode="multiple"
                      placeholder="请选择营销人员"
                      optionFilterProp="label"
                      filterOption={(input, option) =>
                        ((option as any)?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={users.filter(u => u.position_type === 'marketing').map(u => ({ value: u.name, label: u.name }))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="action_description" label="联动的动作" rules={[{ required: true, message: '请输入联动动作说明' }]}>
                <Input.TextArea placeholder="请输入具体的铁三角联动动作描述..." rows={3} />
              </Form.Item>
              <Form.Item name="triangle_result" label="成果" rules={[{ required: true, message: '请输入联动取得的成果' }]}>
                <Input.TextArea placeholder="（推进到什么阶段/达成什么结果）" rows={3} />
              </Form.Item>
              <Form.Item name="customer_feedback" label="客户反馈" rules={[{ required: true, message: '请输入客户反馈' }]}>
                <Input.TextArea placeholder="“（客户原话或总结）”" rows={3} />
              </Form.Item>
            </>
          )}

          {/* 第五种幸福动作显示数量/得分 */}
          {editEventType === 'happiness' && (
            <>
              <Form.Item
                name="happiness_score"
                label="客户幸福得分分值"
                initialValue={20}
                rules={[{ required: true, message: '请选择幸福分值' }]}
              >
                <Select placeholder="选择客户幸福标准分值">
                  <Select.Option value={0}>0分</Select.Option>
                  <Select.Option value={20}>20分</Select.Option>
                  <Select.Option value={50}>50分</Select.Option>
                  <Select.Option value={100}>100分</Select.Option>
                </Select>
              </Form.Item>

              {editHappinessScore !== undefined && HAPPINESS_STANDARDS[String(editHappinessScore)] && (
                <Form.Item name="selected_standards" label="客户幸福标准选项勾选">
                  <Checkbox.Group style={{ width: '100%' }}>
                    <Collapse 
                      size="small" 
                      defaultActiveKey={HAPPINESS_STANDARDS[String(editHappinessScore)].sections.map((s: any) => s.section_id)}
                      style={{ marginBottom: 16, maxHeight: '300px', overflowY: 'auto' }}
                    >
                      {HAPPINESS_STANDARDS[String(editHappinessScore)].sections.map((sec: any) => (
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

              <Form.Item
                name="action_description"
                label="具体幸福关怀动作说明"
                rules={[{ required: true, message: '请输入具体关怀与拜访动作' }]}
              >
                <Input.TextArea 
                  placeholder="请输入具体执行的关怀动作说明..." 
                  rows={3} 
                  autoSize={{ minRows: 2, maxRows: 6 }} 
                />
              </Form.Item>
              <Form.Item name="happiness_result" label="成果" rules={[{ required: true, message: '请输入取得的成果' }]}>
                <Input.TextArea placeholder="（推进到什么阶段/达成什么结果）" rows={3} />
              </Form.Item>
              <Form.Item name="happiness_feedback" label="客户反馈（可选）">
                <Input.TextArea placeholder="“（客户原话或总结）”" rows={3} />
              </Form.Item>
              <Form.Item name="recommend_action" label="内部可推广复制的做法" rules={[{ required: true, message: '请输入内部可推广复制的做法说明' }]}>
                <Input.TextArea placeholder="具体做法说明" rows={3} />
              </Form.Item>
            </>
          )}


          {/* 第三种已完成合同签订显示金额和分摊列表 */}
          {editEventType === 'contract_signed' && (
            <>
              <Form.Item
                name="amount"
                label="合同价格 (万元)"
                rules={[{ required: true, message: '请输入合同价格' }]}
              >
                <InputNumber 
                  style={{ width: '100%' }} 
                  min={0} 
                  onChange={() => setTimeout(recalculateEditAllocations, 100)} 
                />
              </Form.Item>

              <Divider style={{ margin: '16px 0 8px 0' }} />
              
              {/* 交付业绩比例分摊编辑 */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justify_content: 'space-between', marginBottom: 8 }}>
                  <strong style={{ fontSize: 13 }}>🛠️ 交付业绩比例分配 (和为100%)</strong>
                  <Button 
                    size="small" 
                    type="dashed" 
                    onClick={() => {
                      const cur = editForm.getFieldValue('delivery_allocations') || []
                      editForm.setFieldsValue({
                        delivery_allocations: [...cur, { user_id: undefined, ratio: 0, amount: 0 }]
                      })
                    }}
                  >
                    + 增加交付成员
                  </Button>
                </div>

                <Form.List name="delivery_allocations">
                  {(fields, { remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }) => (
                        <Row gutter={8} key={key} align="middle" style={{ marginBottom: 8 }}>
                          <Col span={10}>
                            <Form.Item
                              {...restField}
                              name={[name, 'user_id']}
                              rules={[{ required: true, message: '必填' }]}
                              style={{ margin: 0 }}
                            >
                              <Select
                                showSearch
                                placeholder="交付人员"
                                options={users.map(u => ({ label: `${u.name}`, value: u.id }))}
                                filterOption={(input, option) =>
                                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                              />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'ratio']}
                              rules={[{ required: true, message: '必填' }]}
                              style={{ margin: 0 }}
                            >
                              <InputNumber
                                placeholder="比例 (%)"
                                min={0}
                                max={100}
                                style={{ width: '100%' }}
                                formatter={value => `${value}%`}
                                parser={value => value!.replace('%', '')}
                                onChange={() => setTimeout(recalculateEditAllocations, 100)}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'amount']}
                              style={{ margin: 0 }}
                            >
                              <InputNumber placeholder="分摊金额(万)" disabled style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={2}>
                            <Button type="link" danger onClick={() => { remove(name); setTimeout(recalculateEditAllocations, 100); }}>删除</Button>
                          </Col>
                        </Row>
                      ))}
                    </>
                  )}
                </Form.List>
              </div>

              {/* 营销业绩比例分摊编辑 */}
              <div>
                <div style={{ display: 'flex', justify_content: 'space-between', marginBottom: 8 }}>
                  <strong style={{ fontSize: 13 }}>💰 营销业绩比例分配 (和为100%)</strong>
                  <Button 
                    size="small" 
                    type="dashed" 
                    onClick={() => {
                      const cur = editForm.getFieldValue('marketing_allocations') || []
                      editForm.setFieldsValue({
                        marketing_allocations: [...cur, { user_id: undefined, ratio: 0, amount: 0 }]
                      })
                    }}
                  >
                    + 增加营销成员
                  </Button>
                </div>

                <Form.List name="marketing_allocations">
                  {(fields, { remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }) => (
                        <Row gutter={8} key={key} align="middle" style={{ marginBottom: 8 }}>
                          <Col span={10}>
                            <Form.Item
                              {...restField}
                              name={[name, 'user_id']}
                              rules={[{ required: true, message: '必填' }]}
                              style={{ margin: 0 }}
                            >
                              <Select
                                showSearch
                                placeholder="营销人员"
                                options={users.map(u => ({ label: `${u.name}`, value: u.id }))}
                                filterOption={(input, option) =>
                                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                              />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'ratio']}
                              rules={[{ required: true, message: '必填' }]}
                              style={{ margin: 0 }}
                            >
                              <InputNumber
                                placeholder="比例 (%)"
                                min={0}
                                max={100}
                                style={{ width: '100%' }}
                                formatter={value => `${value}%`}
                                parser={value => value!.replace('%', '')}
                                onChange={() => setTimeout(recalculateEditAllocations, 100)}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'amount']}
                              style={{ margin: 0 }}
                            >
                              <InputNumber placeholder="分摊金额(万)" disabled style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={2}>
                            <Button type="link" danger onClick={() => { remove(name); setTimeout(recalculateEditAllocations, 100); }}>删除</Button>
                          </Col>
                        </Row>
                      ))}
                    </>
                  )}
                </Form.List>
              </div>
            </>
          )}

          {editEventType === 'station_report' && editFileList.length > 0 && (
            <>
              <Form.Item label="📎 已上传的附件压缩包">
                <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#555' }}>
                    📦 {editFileList[0]?.name || 'encrypted_attachments.zip'}
                  </span>
                  <Button 
                    type="link" 
                    size="small" 
                    icon={<DownloadOutlined />}
                    href={`${editFileList[0]?.url}?download=${editFileList[0]?.name || 'encrypted_attachments.zip'}`}
                    target="_blank"
                  >
                    下载附件
                  </Button>
                </div>
              </Form.Item>

              {editForm.getFieldValue('station_category') === 'policy' && (
                <Form.Item label="🔑 压缩包解压密码">
                  <Input 
                    value={editPassword || '加载中...'} 
                    disabled 
                    addonAfter={
                      <Button 
                        type="text" 
                        size="small" 
                        style={{ height: '22px', padding: '0 4px', color: '#1890ff' }}
                        disabled={!editPassword}
                        onClick={() => {
                          if (editPassword) {
                            navigator.clipboard.writeText(editPassword);
                            message.success('解压密码已成功复制到剪贴板！');
                          }
                        }}
                      >
                        复制密码
                      </Button>
                    }
                  />
                </Form.Item>
              )}
            </>
          )}

          {['contract_signed', 'happiness', 'triangle'].includes(editEventType) && (
            <Form.Item label="📎 证明照片（可选，最多3张）">
              <Upload
                customRequest={customUpload}
                listType="picture-card"
                fileList={editFileList}
                onChange={({ fileList }) => setEditFileList(fileList)}
                maxCount={3}
                accept="image/*"
              >
                {editFileList.length < 3 && (
                  <div>
                    <PlusOutlined />
                    <div style={{ marginTop: 8 }}>上传</div>
                  </div>
                )}
              </Upload>
            </Form.Item>
          )}

          <Divider style={{ margin: '12px 0' }} />


          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="push_status"
                label="推送状态"
                rules={[{ required: true, message: '请选择推送状态' }]}
              >
                <Select options={PUSH_STATUS_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="push_channel"
                label="推送渠道"
                rules={[{ required: true, message: '请选择推送渠道' }]}
              >
                <Select options={PUSH_CHANNEL_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      </div>
    </div>
  )
}

export default Reports
