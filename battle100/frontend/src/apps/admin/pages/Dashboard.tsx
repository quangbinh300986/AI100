
import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Progress, Table, List, Button, Tag, Space, Typography, message, Modal, Input, Form, Badge, Select, Alert, Collapse, Checkbox } from 'antd'
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
  FileTextOutlined
} from '@ant-design/icons'
import { HAPPINESS_STANDARDS } from '@shared/data/happinessStandards'
import { getDashboardData, getMyStats, getTeamDetailedMetrics } from '@shared/api/dashboard'
import { get, post } from '@shared/api/client'
import { useAuthStore } from '@shared/stores/authStore'
import type { DashboardData, MyStatsResponse, RankingItem } from '@shared/types'

const { Title, Text } = Typography

const Dashboard: React.FC = () => {
  const { user } = useAuthStore()
  
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
  const [usersList, setUsersList] = useState<{ id: number; name: string }[]>([])
  const [crmProjects, setCrmProjects] = useState<any[]>([])
  const [crmLoading, setCrmLoading] = useState(false)
  const [crmCustomers, setCrmCustomers] = useState<string[]>([])
  
  const [teamMetricsModalVisible, setTeamMetricsModalVisible] = useState(false)
  const [selectedTeamMetrics, setSelectedTeamMetrics] = useState<any>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  
  // 日报自动生成器状态
  const [dailyReportModalVisible, setDailyReportModalVisible] = useState(false)
  const [dailyReportText, setDailyReportText] = useState('')
  const [dailyReportLoading, setDailyReportLoading] = useState(false)

  const handleGenerateDailyReport = async () => {
    try {
      let url = '/dashboard/daily-report'
      if (user?.role === 'target_officer') {
        if (user?.team_id) {
          url += `?team_id=${user.team_id}`
        }
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
    setLeadsModalVisible(true)
    setLeadsLoading(true)
    setLeadsList([])
    setCurrentLeadType(leadType === 'valid' ? '有效需求线索' : '潜力需求线索')
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
      width: 240
    },
    {
      title: '联动搭档',
      dataIndex: 'partner_name',
      key: 'partner_name',
      width: 110,
      align: 'center' as const
    },
    {
      title: '联动描述说明',
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
      width: 240
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
      title: '客户关怀与拜访动作描述',
      dataIndex: 'description',
      key: 'description',
      render: (val: string) => <div style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{val}</div>
    }
  ]

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
      width: 240
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
      title: '项目描述与分摊说明',
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
        projectName: '',
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
    const { actionType, customerName, projectName, contractName, employeeName, happinessScore, actionDescription, budgetMoney, expectMoney, copartners, marketingCopartners } = allValues
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
        generated = `${prefix}我司【${employeeName || 'XX'}】${partnerPart}在【${customerName || 'XX'}】开展售前铁三角联动，联动动作：${actionDescription || 'XX'}。为客户幸福而奋斗，赢战百日！`;
        break;
      }
      case 'happiness':
        generated = `${prefix}${employeeName || 'XX'}做到客户幸福标准${happinessScore ?? 0}分${actionDescription || 'XX'}动作，收到客户${customerName || 'XXX'}正反馈，为客户幸福而奋斗，赢战百日！`
        break
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
      // 1. 获取全盘大屏概览数据
      const res = await getDashboardData()
      if (res) {
        setData(res as any)
      }

      // 2. 获取当前用户个人级联实绩与目标（用于个人双水位盘展示）
      const statsRes = await getMyStats()
      if (statsRes) {
        setPersonalStats((statsRes as any).personal_stats)
      }
    } catch (err: any) {
      console.error(err)
      const detailError = err?.response?.data?.detail || err?.message || '加载系统作战看板数据失败'
      message.error(`诊断错误: ${detailError}`, 10)
    } finally {
      setLoading(false)
    }
  }

  // 异步获取 CRM 数据库中的客户名称列表
  const loadCrmCustomers = async () => {
    try {
      const res = await get<any>('/broadcast/crm-customers')
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

  useEffect(() => {
    if (broadcastModalVisible) {
      loadCrmCustomers()
    }
  }, [broadcastModalVisible])

  useEffect(() => {
    loadData()
    loadUsersList()
  }, [])

  // 发布广播
  const handlePublishBroadcast = async (values: any) => {
    try {
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
        // 铁三角联动新增多选人员
        copartners: values.copartners,
        marketing_copartners: values.marketingCopartners
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
        broadcastForm.resetFields()
        loadData()
      }
    } catch (err) {
      message.error('发布失败')
    }
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
      width: 100, 
      render: (val: number) => <Tag color={val === 1 ? 'gold' : val === 2 ? 'blue' : 'default'}>Top {val}</Tag> 
    },
    { title: '战队名称', dataIndex: 'name', key: 'name' },
    { title: '完成百分比 (%)', dataIndex: 'score', key: 'score', render: (val: number) => <strong>{val}%</strong> },
    { title: '趋势', dataIndex: 'trend', key: 'trend', render: (val: string) => val === 'up' ? <Tag color="success">↑ 上升</Tag> : val === 'down' ? <Tag color="error">↓ 下降</Tag> : <Tag color="warning">→ 持平</Tag> }
  ]

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
                onClick={handleGenerateDailyReport}
              >
                生成今日日报
              </Button>
            )}
            <Button icon={<FireOutlined />} onClick={loadData} loading={loading}>刷新看板</Button>
            <Button type="primary" icon={<NotificationOutlined />} onClick={() => {
              setCurrentActionType('')
              setBroadcastModalVisible(true)
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

      {/* 第一级：🏆 公司战役总盘四大指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="card-kpi" bordered={false}>
            <Statistic
              title="💰 公司累计新签合同额"
              value={kpis?.newContracts.value}
              precision={2}
              valueStyle={{ color: '#1677ff', fontSize: 26, fontWeight: 700 }}
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

        <Col xs={24} sm={12} md={6}>
          <Card className="card-kpi" bordered={false}>
            <Statistic
              title="😊 公司客户幸福动作"
              value={kpis?.happinessActions.value}
              valueStyle={{ color: '#52c41a', fontSize: 26, fontWeight: 700 }}
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

        <Col xs={24} sm={12} md={6}>
          <Card className="card-kpi" bordered={false}>
            <Statistic
              title="🤝 售前铁三角联动次数"
              value={kpis?.ironTriangle.value}
              valueStyle={{ color: '#fa8c16', fontSize: 26, fontWeight: 700 }}
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

        <Col xs={24} sm={12} md={6}>
          <Card className="card-kpi" bordered={false}>
            <Statistic
              title="🔍 新增有效商机线索"
              value={kpis?.validLeads.value}
              valueStyle={{ color: '#722ed1', fontSize: 26, fontWeight: 700 }}
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
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
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
        </Space>
      </Card>

      {/* 第三级：战区赛马 & 个人英雄榜 & 个人岗位考核水位 */}
      <Row gutter={[16, 16]}>
        {/* 各战区战队冲刺排名 */}
        <Col xs={24} lg={9}>
          <Card title="🏆 各战区战队冲刺排名" bordered={false} style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
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
        <Col xs={24} lg={8}>
          <Card title="🥇 个人签约战将榜 TOP 5" bordered={false} style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <List
              loading={loading}
              itemLayout="horizontal"
              dataSource={data?.heroBoard?.slice(0, 5)}
              renderItem={(item, index) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#f5f5f5',
                          color: index < 3 ? '#fff' : '#666',
                          textAlign: 'center',
                          lineHeight: '24px',
                          fontWeight: 'bold'
                        }}
                      >
                        {index + 1}
                      </div>
                    }
                    title={<strong>{item.name}</strong>}
                    description={`战队：${item.teamName}`}
                  />
                  <div>
                    <Text strong style={{ color: '#f5222d', fontSize: 14 }}>{item.score} 万元</Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* 个人双轨考核水位 */}
        <Col xs={24} lg={7}>
          <Card title={<span><UserOutlined style={{ marginRight: 8 }} />🎯 我的个人考核双水位</span>} bordered={false} style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            {personalStats && personalStats.length > 0 ? (
              <List
                dataSource={personalStats}
                renderItem={(item) => {
                  const maxVal = Math.max(item.challenge_target, item.actual, 1)
                  const basePct = (item.base_target / maxVal) * 100
                  const challengePct = (item.challenge_target / maxVal) * 100
                  const actualPct = (item.actual / maxVal) * 100

                  return (
                    <div style={{ marginBottom: 14, borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
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
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                系统管理员/中台无个人冲刺考核指标
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 实时动态战报 */}
      <Card title="🔔 战役实时攻坚播报" bordered={false} style={{ marginTop: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <List
          loading={loading}
          dataSource={data?.liveFeed}
          renderItem={(item) => (
            <List.Item>
              <Space>
                <Tag color={
                  item.type === 'contract' ? 'error' : 
                  item.type === 'achievement' ? 'success' : 
                  item.type === 'milestone' ? 'warning' : 'processing'
                }>
                  {
                    item.type === 'contract' ? '合同新签' : 
                    item.type === 'achievement' ? '有效线索' : 
                    item.type === 'milestone' ? (item.content.includes('幸福') ? '幸福动作' : '阶段中标') : '工作动态'
                  }
                </Tag>
                <Text>{item.content}</Text>
              </Space>
              <Text type="secondary">{item.time}</Text>
            </List.Item>
          )}
        />
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
        destroyOnClose
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
              <Select.Option value="lead_25">有效线索确定</Select.Option>
              <Select.Option value="lead_75">中标确定</Select.Option>
              <Select.Option value="contract">已完成合同签订（双方盖章）</Select.Option>
              <Select.Option value="triangle">铁三角联动</Select.Option>
              <Select.Option value="happiness">客户幸福动作</Select.Option>
            </Select>
          </Form.Item>

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
                            <Row key={key} gutter={16} align="middle" style={{ marginBottom: 8 }}>
                              <Col span={10}>
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
                              </Col>
                              <Col span={8}>
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
                              </Col>
                              <Col span={4} style={{ paddingLeft: 8 }}>
                                <span style={{ fontSize: 12, color: '#888' }}>
                                  {allocatedAmount} 万元
                                </span>
                              </Col>
                              <Col span={2}>
                                <Button type="link" danger onClick={() => remove(name)}>
                                  删除
                                </Button>
                              </Col>
                            </Row>
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
                            <Row key={key} gutter={16} align="middle" style={{ marginBottom: 8 }}>
                              <Col span={10}>
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
                              </Col>
                              <Col span={8}>
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
                              </Col>
                              <Col span={4} style={{ paddingLeft: 8 }}>
                                <span style={{ fontSize: 12, color: '#888' }}>
                                  {allocatedAmount} 万元
                                </span>
                              </Col>
                              <Col span={2}>
                                <Button type="link" danger onClick={() => remove(name)}>
                                  删除
                                </Button>
                              </Col>
                            </Row>
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
                      placeholder="搜索选择 CRM 客户名称"
                      optionFilterProp="label"
                      filterOption={(input, option) =>
                        ((option as any)?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={crmCustomers.map(c => ({ value: c, label: c }))}
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
              <Form.Item name="customerName" label="客户名称" rules={[{ required: true, message: '请选择或搜索 CRM 客户名称' }]}>
                <Select
                  showSearch
                  placeholder="搜索选择 CRM 客户名称"
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    ((option as any)?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={crmCustomers.map(c => ({ value: c, label: c }))}
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
                <Input placeholder="例如：关怀与拜访 / 递交了第三期方案成效汇报" />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="content"
            label="最终生成战报文本"
            rules={[{ required: true, message: '战报内容不能为空' }, { max: 150, message: '战报文本不能多于150字' }]}
          >
            <Input.TextArea rows={4} placeholder="选择动作填入要素后自动生成，也可在此手动微调" />
          </Form.Item>
        </Form>
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
        destroyOnClose
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
                  definition: 'CRM线索库中进度在 25%~75% 的线索总数量',
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
        destroyOnClose
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
        destroyOnClose
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
        destroyOnClose
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
        destroyOnClose
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
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
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
    </div>
  )
}

export default Dashboard
