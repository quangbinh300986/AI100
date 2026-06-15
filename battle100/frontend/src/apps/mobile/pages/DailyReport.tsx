/**
 * 每日冲刺数据填报页面 (移动端升级版)
 * 适配 5 种核心动作填报与实时战报发布 (CRM 提取、分摊业绩、照片上传)
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Button, Toast, Selector, Stepper, TextArea, Input, Card, Modal, List, Checkbox, CascadePicker, Switch } from 'antd-mobile'
import { CheckCircleFill, CloseCircleFill, AddOutline, DeleteOutline, SearchOutline } from 'antd-mobile-icons'
import { get, post } from '@shared/api/client'
import { useAuthStore } from '@shared/stores/authStore'
import { HAPPINESS_STANDARDS } from '@shared/data/happinessStandards'

// 区域级联选择配置配置，包含广东省主要市区及各个区县，以及北京市和外省
const REGION_OPTIONS = [
  {
    value: '广东省',
    label: '广东省',
    children: [
      {
        value: '广州市',
        label: '广州市',
        children: [
          { value: '越秀区', label: '越秀区' },
          { value: '荔湾区', label: '荔湾区' },
          { value: '海珠区', label: '海珠区' },
          { value: '天河区', label: '天河区' },
          { value: '白云区', label: '白云区' },
          { value: '黄埔区', label: '黄埔区' },
          { value: '番禺区', label: '番禺区' },
          { value: '花都区', label: '花都区' },
          { value: '南沙区', label: '南沙区' },
          { value: '从化区', label: '从化区' },
          { value: '增城区', label: '增城区' },
        ],
      },
      {
        value: '佛山市',
        label: '佛山市',
        children: [
          { value: '禅城区', label: '禅城区' },
          { value: '南海区', label: '南海区' },
          { value: '顺德区', label: '顺德区' },
          { value: '三水区', label: '三水区' },
          { value: '高明区', label: '高明区' },
        ],
      },
      {
        value: '深圳市',
        label: '深圳市',
        children: [
          { value: '福田区', label: '福田区' },
          { value: '罗湖区', label: '罗湖区' },
          { value: '南山区', label: '南山区' },
          { value: '宝安区', label: '宝安区' },
          { value: '龙岗区', label: '龙岗区' },
          { value: '盐田区', label: '盐田区' },
          { value: '龙华区', label: '龙华区' },
          { value: '坪山区', label: '坪山区' },
          { value: '光明区', label: '光明区' },
          { value: '大鹏新区', label: '大鹏新区' },
        ]
      },
      {
        value: '清远市',
        label: '清远市',
        children: [
          { value: '清城区', label: '清城区' },
          { value: '清新区', label: '清新区' },
          { value: '佛冈县', label: '佛冈县' },
          { value: '阳山县', label: '阳山县' },
          { value: '连山壮族瑶族自治县', label: '连山壮族瑶族自治县' },
          { value: '连南瑶族自治县', label: '连南瑶族自治县' },
          { value: '英德市', label: '英德市' },
          { value: '连州市', label: '连州市' },
        ],
      },
      {
        value: '湛江市',
        label: '湛江市',
        children: [
          { value: '赤坎区', label: '赤坎区' },
          { value: '霞山区', label: '霞山区' },
          { value: '坡头区', label: '坡头区' },
          { value: '麻章区', label: '麻章区' },
          { value: '遂溪县', label: '遂溪县' },
          { value: '徐闻县', label: '徐闻县' },
          { value: '廉江市', label: '廉江市' },
          { value: '雷州市', label: '雷州市' },
          { value: '吴川市', label: '吴川市' },
        ],
      },
      {
        value: '茂名市',
        label: '茂名市',
        children: [
          { value: '茂南区', label: '茂南区' },
          { value: '电白区', label: '电白区' },
          { value: '高州市', label: '高州市' },
          { value: '化州市', label: '化州市' },
          { value: '信宜市', label: '信宜市' },
        ],
      },
      {
        value: '云浮市',
        label: '云浮市',
        children: [
          { value: '云城区', label: '云城区' },
          { value: '云安区', label: '云安区' },
          { value: '新兴县', label: '新兴县' },
          { value: '郁南县', label: '郁南县' },
          { value: '罗定市', label: '罗定市' },
        ],
      },
    ],
  },
  {
    value: '北京市',
    label: '北京市',
    children: [
      { value: '东城区', label: '东城区' },
      { value: '西城区', label: '西城区' },
      { value: '朝阳区', label: '朝阳区' },
      { value: '丰台区', label: '丰台区' },
      { value: '石景山区', label: '石景山区' },
      { value: '海淀区', label: '海淀区' },
      { value: '门头沟区', label: '门头沟区' },
      { value: '房山区', label: '房山区' },
      { value: '通州区', label: '通州区' },
      { value: '顺义区', label: '顺义区' },
      { value: '昌平区', label: '昌平区' },
      { value: '大兴区', label: '大兴区' },
      { value: '怀柔区', label: '怀柔区' },
      { value: '平谷区', label: '平谷区' },
      { value: '密云区', label: '密云区' },
      { value: '延庆区', label: '延庆区' },
    ]
  },
  {
    value: '外省',
    label: '外省'
  }
]

// 战报动作类型选项 (与大屏完全对齐)
const ACTION_TYPE_OPTIONS = [
  { label: '已完成合同签订 (90%)', value: 'contract' },
  { label: '铁三角联动', value: 'triangle' },
  { label: '客户幸福动作', value: 'happiness' },
  { label: '市场信息前线播报', value: 'station_report' },
]

export default function DailyReport() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // 动作类型状态
  const [actionType, setActionType] = useState<string>('contract')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 营销内部播报相关计算与受控处理，所有注释必须使用中文
  const showMarketingReport = user?.position_type === 'marketing' || user?.role === 'target_officer' || user?.role === 'admin'
  const actionOptions = [
    { label: '已完成合同签订 (90%)', value: 'contract' },
    { label: '铁三角联动', value: 'triangle' },
    { label: '客户幸福动作', value: 'happiness' },
    { label: '市场信息前线播报', value: 'station_report' },
    ...(showMarketingReport ? [{ label: '营销内部播报', value: 'marketing_report' }] : [])
  ]

  const handleMarketingFieldChange = (name: string, value: any) => {
    setFormData(prev => {
      const next = { ...prev, [name]: value }
      updateMarketingContent(next)
      return next
    })
  }

  // 接口数据池
  const [users, setUsers] = useState<any[]>([])
  const [crmCustomers, setCrmCustomers] = useState<string[]>([])
  const [crmProjectsSearch, setCrmProjectsSearch] = useState<string[]>([])
  const [projectSearchKeyword, setProjectSearchKeyword] = useState('')
  const [crmProjects, setCrmProjects] = useState<any[]>([])
  const [crmLoading, setCrmLoading] = useState(false)

  // 搜索关键字
  const [projectSearch, setProjectSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [copartnerSearch, setCopartnerSearch] = useState('')
  const [marketingCopartnerSearch, setMarketingCopartnerSearch] = useState('')
  const [allocUserSearch, setAllocUserSearch] = useState('')

  // 选中的 CRM 实体
  const [selectedProject, setSelectedProject] = useState<any | null>(null)

  // 分摊业绩列表
  const [deliveryAllocations, setDeliveryAllocations] = useState<any[]>([])
  const [marketingAllocations, setMarketingAllocations] = useState<any[]>([])

  // 分摊选择成员弹窗状态
  const [allocUserModalVisible, setAllocUserModalVisible] = useState(false)
  const [allocTargetType, setAllocTargetType] = useState<'delivery' | 'marketing'>('delivery')
  
  // 铁三角人员选择多选弹窗状态
  const [copartnersModalVisible, setCopartnersModalVisible] = useState(false)
  const [marketingCopartnersModalVisible, setMarketingCopartnersModalVisible] = useState(false)

  // 重复播报检测状态变量
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false)
  const [duplicateCheckData, setDuplicateCheckData] = useState<{
    customerName: string;
    count: number;
    list: string[];
  } | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<any>(null)

  // 区域级联控制状态，所有注释必须使用中文
  const [regionVisible, setRegionVisible] = useState(false)

  // 表单数据
  const [formData, setFormData] = useState({
    crmOpportunityId: '',
    customerName: '',
    projectName: '',
    amount: 0.0,
    budgetMoney: 0.0,
    expectMoney: 0.0,
    happinessScore: 20,
    selectedStandards: [] as string[],
    actionDescription: '',
    triangleResult: '',
    customerFeedback: '',
    happinessResult: '',
    happinessFeedback: '',
    recommendAction: '',
    content: '',
    employeeName: '',
    copartners: [] as string[],
    marketingCopartners: [] as string[],
    // 营销内部播报专属字段
    marketingCategory: '',
    marketingRegion: ['广东省', '广州市', '荔湾区'] as string[],
    marketingSection: '',
    marketingAssistors: [] as string[],
    marketingContracts: [] as string[],
    marketingProgress: '',
    marketingIsImportant: 'no',
    marketingHelpNeeded: ''
  })

  // 移动端客户幸福动作折叠面板的状态
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  // 合同/幸福动作照片附件
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([])

  // 驻点播报专用附件文件状态
  const [stationFiles, setStationFiles] = useState<File[]>([])

  // 驻点播报细化字段状态
  const [isStationed, setIsStationed] = useState(true)
  const [policyLevel, setPolicyLevel] = useState('省级')
  const [policyOpportunity, setPolicyOpportunity] = useState('')
  const [policyRisk, setPolicyRisk] = useState('')
  const [policyOther, setPolicyOther] = useState('')

  const [meetingSubject, setMeetingSubject] = useState('')
  const [meetingTimePlace, setMeetingTimePlace] = useState('')
  const [meetingHost, setMeetingHost] = useState('')
  const [meetingProject, setMeetingProject] = useState('')
  const [meetingFunds, setMeetingFunds] = useState('')
  const [meetingInstructions, setMeetingInstructions] = useState('')
  const [meetingDeadline, setMeetingDeadline] = useState('')

  const [intelligenceType, setIntelligenceType] = useState('peer') // peer, personnel, competitor
  const [intelligenceContent, setIntelligenceContent] = useState('')
  const [intelligenceSource, setIntelligenceSource] = useState('')
  const [intelligenceReliability, setIntelligenceReliability] = useState('中')

  const customerSearchTimerRef = useRef<any>(null)
  
  const handleCustomerSearch = (val: string) => {
    if (customerSearchTimerRef.current) {
      clearTimeout(customerSearchTimerRef.current)
    }
    customerSearchTimerRef.current = setTimeout(() => {
      loadCrmCustomers(val)
    }, 300)
  }

  const loadCrmCustomers = async (keyword?: string) => {
    try {
      let url = '/broadcast/crm-customers'
      if (keyword) {
        url += `?keyword=${encodeURIComponent(keyword)}`
      }
      const cRes = await get<any>(url)
      const cData = cRes?.data ? cRes.data : cRes
      if (Array.isArray(cData)) {
        setCrmCustomers(cData)
      }
    } catch (err) {
      console.error('加载 CRM 客户列表失败', err)
    }
  }

  const projectSearchTimerRef = useRef<any>(null)

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
      const pRes = await get<any>(url)
      const pData = pRes?.data ? pRes.data : pRes
      if (Array.isArray(pData)) {
        setCrmProjectsSearch(pData)
      }
    } catch (err) {
      console.error('加载 CRM 项目列表失败', err)
    }
  }

  // 挂载加载
  useEffect(() => {
    const initData = async () => {
      try {
        const uRes = await get<any>('/users?page_size=1000')
        const uData = uRes?.data ? uRes.data : uRes
        if (uData?.items) {
          setUsers(uData.items)
        }
        
        await loadCrmCustomers()
        await loadCrmProjectsSearch()
        // 页面默认选中为 contract (90%)，因此在初始化时主动拉取一次合同数据列表
        await loadCrmProjects(90)
      } catch (err) {
        console.error('初始化移动端基础数据失败', err)
      }
    }
    initData()
  }, [])

  useEffect(() => {
    const resolvedName = user?.realName || user?.name || user?.username || ''
    if (resolvedName && !formData.employeeName) {
      setFormData(prev => ({ ...prev, employeeName: resolvedName }))
    }
  }, [user])

  // 监听动作类型改变加载 CRM 潜力库项目
  const handleActionTypeChange = async (val: string) => {
    setActionType(val)
    setSelectedProject(null)
    setProjectSearch('')
    setCustomerSearch('')
    setDeliveryAllocations([])
    setMarketingAllocations([])
    setAttachmentUrls([])

    const resolvedName = user?.realName || user?.name || user?.username || ''

    setFormData({
      crmOpportunityId: '',
      customerName: '',
      projectName: val === 'happiness' ? '未定' : '',
      amount: 0.0,
      budgetMoney: 0.0,
      expectMoney: 0.0,
      happinessScore: 20,
      selectedStandards: [],
      actionDescription: '',
      triangleResult: '',
      customerFeedback: '',
      happinessResult: '',
      happinessFeedback: '',
      recommendAction: '',
      content: '',
      employeeName: resolvedName,
      copartners: [],
      marketingCopartners: [],
      // 营销内部播报专属字段
      marketingCategory: '',
      marketingRegion: ['广东省', '广州市', '荔湾区'],
      marketingSection: '',
      marketingAssistors: [],
      marketingContracts: [],
      marketingProgress: '',
      marketingIsImportant: 'no',
      marketingHelpNeeded: ''
    })

    if (val === 'contract') {
      loadCrmProjects(90)
    } else if (val === 'lead_75') {
      loadCrmProjects(75)
    } else if (val === 'lead_25') {
      loadCrmProjects(25)
    } else if (val === 'potential_lead') {
      loadCrmProjects(10)
    } else if (val === 'happiness') {
      loadCrmProjectsSearch()
    } else if (val === 'station_report') {
      setStationFiles([])
    } else if (val === 'marketing_report') {
      loadCrmCustomers()
      loadCrmProjects(90)
    }
  }

  // 加载商机
  const loadCrmProjects = async (progress: number) => {
    setCrmLoading(true)
    try {
      const res = await get<any>(`/broadcast/crm-projects?progress=${progress}`)
      const data = res?.data ? res.data : res
      if (Array.isArray(data)) {
        setCrmProjects(data)
      } else {
        setCrmProjects([])
      }
    } catch (err) {
      console.error('加载 CRM 商机失败', err)
      setCrmProjects([])
    } finally {
      setCrmLoading(false)
    }
  }

  // 选中某条 CRM 商机后的数据带入逻辑
  const handleCRMProjectSelect = (proj: any) => {
    const defaultAmount = proj.expect_money > 0 ? proj.expect_money : proj.budget_money
    setSelectedProject(proj)

    let progressText = '90%'
    if (actionType === 'lead_75') progressText = '75%'
    if (actionType === 'lead_25') progressText = '25%'
    if (actionType === 'potential_lead') progressText = '5%-10%'

    const prefix = '奋战一百天，亮剑破六千！今日确定'
    let generatedContent = ''
    if (actionType === 'contract') {
      generatedContent = `${prefix}${proj.name}项目走完合同流程，客户为${proj.customer_name}，项目金额${defaultAmount}万，赢战百日！`
    } else if (actionType === 'lead_75') {
      generatedContent = `${prefix}${proj.name}项目中地承接，客户为${proj.customer_name}，项目金额${defaultAmount}万，赢战百日！`
    } else {
      generatedContent = `${prefix}有效线索：客户为${proj.customer_name}，项目金额${defaultAmount}万，赢战百日！`
    }

    setFormData(prev => ({
      ...prev,
      crmOpportunityId: proj.id,
      customerName: proj.customer_name,
      amount: defaultAmount,
      budgetMoney: proj.budget_money,
      expectMoney: proj.expect_money,
      content: generatedContent
    }))

    // 默认分配交付 100%
    const currentDelivery = [{
      user_id: user?.id || 0,
      ratio: 100,
      amount: defaultAmount
    }]
    setDeliveryAllocations(currentDelivery)

    if (proj.marketing_users && proj.marketing_users.length > 0) {
      // 过滤出已绑定本地账号的营销人员，对齐电脑端
      const validMarketingUsers = proj.marketing_users.filter((mu: any) => mu.local_user_id !== null)
      const marketingUsersCount = validMarketingUsers.length

      if (marketingUsersCount > 0) {
        const avgRatio = Math.round((100 / marketingUsersCount) * 100) / 100
        
        const initMarketingAlloc = validMarketingUsers.map((mu: any, index: number) => {
          const matchedLocalId = mu.local_user_id
          const allocRatio = index === marketingUsersCount - 1 
            ? Math.round((100 - avgRatio * (marketingUsersCount - 1)) * 100) / 100 
            : avgRatio

          return {
            user_id: matchedLocalId,
            ratio: allocRatio,
            amount: Math.round((defaultAmount * (allocRatio / 100)) * 100) / 100
          }
        })
        setMarketingAllocations(initMarketingAlloc)
      } else {
        setMarketingAllocations([])
      }
    } else {
      setMarketingAllocations([])
    }
  }

  // 照片上传逻辑（支持并发多选上传，限最多3张）
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    
    // 如果已有附件加新上传的超过3个，提示并限制
    if (attachmentUrls.length + files.length > 3) {
      Toast.show({ icon: 'fail', content: '照片总数最多限制为3张' })
      return
    }

    Toast.show({ icon: 'loading', content: '照片上传中...', duration: 0 })
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const data = new FormData()
        data.append('file', file)
        const res = await post<any>('/reports/upload', data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        return res?.url || null
      })
      
      const urls = await Promise.all(uploadPromises)
      Toast.clear()
      
      const validUrls = urls.filter(Boolean) as string[]
      if (validUrls.length > 0) {
        setAttachmentUrls(prev => [...prev, ...validUrls])
        Toast.show({ icon: 'success', content: `成功上传 ${validUrls.length} 张照片` })
      }
    } catch (e) {
      Toast.clear()
      Toast.show({ icon: 'fail', content: '照片上传失败，请重试' })
    } finally {
      // 重置 input 的 value 以便用户可以重复上传同一个文件
      event.target.value = ''
    }
  }

  // 业绩重算
  const recalculateAllocations = (amount: number, delivery: any[], marketing: any[]) => {
    const updatedDelivery = delivery.map((item: any) => ({
      ...item,
      amount: Math.round((amount * ((item.ratio || 0) / 100)) * 100) / 100
    }))
    const updatedMarketing = marketing.map((item: any) => ({
      ...item,
      amount: Math.round((amount * ((item.ratio || 0) / 100)) * 100) / 100
    }))
    setDeliveryAllocations(updatedDelivery)
    setMarketingAllocations(updatedMarketing)
  }

  // 幸福动作文本生成
  const updateHappinessContent = (partial: Partial<typeof formData> = {}) => {
    const data = { ...formData, ...partial }
    const prefix = '奋战一百天，亮剑破六千！今日'
    const resolvedName = user?.realName || user?.name || user?.username || 'XX'
    
    const feedbackLine = data.happinessFeedback ? `\n客户反馈：${data.happinessFeedback}。` : '';
    const projectPart = data.projectName ? `，关联项目【${data.projectName}】` : '，关联项目【未定】';
    const generated = `${prefix}我司【${resolvedName}】做到客户幸福标准【${data.happinessScore}分】动作，对象为【${data.customerName || 'XX'}】${projectPart}，动作描述：${data.actionDescription || 'XX'}。\n成果：${data.happinessResult || 'XX'}。${feedbackLine}\n内部可推广复制的做法：${data.recommendAction || 'XX'}。\n为客户幸福而奋斗，赢战百日！`
    setFormData(prev => ({ ...prev, ...partial, content: generated }))
  }

  // 铁三角联动文本生成
  const updateTriangleContent = (
    employee: string,
    customer: string,
    coparts: string[],
    mCoparts: string[],
    desc: string,
    result?: string,
    feedback?: string
  ) => {
    const prefix = '奋战一百天，亮剑破六千！今日'
    const copartnersStr = coparts && coparts.length > 0 ? coparts.join('、') : '';
    const marketingStr = mCoparts && mCoparts.length > 0 ? mCoparts.join('、') : '';
    let partnersInfo = '';
    if (copartnersStr && marketingStr) {
      partnersInfo = `联动人(${copartnersStr})、营销人员(${marketingStr})`;
    } else if (copartnersStr) {
      partnersInfo = `联动人(${copartnersStr})`;
    } else if (marketingStr) {
      partnersInfo = `营销人员(${marketingStr})`;
    }
    const partnerPart = partnersInfo ? `，与${partnersInfo}` : '';
    
    // 如果未传入则回退至当前 formData 状态值
    const activeResult = result !== undefined ? result : formData.triangleResult;
    const activeFeedback = feedback !== undefined ? feedback : formData.customerFeedback;

    const generated = `${prefix}我司【${employee || 'XX'}】${partnerPart}在【${customer || 'XX'}】开展售前铁三角联动。\n联动动作：${desc || 'XX'}。\n成果：${activeResult || 'XX'}。\n客户反馈：${activeFeedback || 'XX'}。\n为客户幸福而奋斗，赢战百日！`;
    setFormData(prev => ({ ...prev, content: generated }))
  }

  // 营销内部播报文本生成，所有注释必须使用中文
  const updateMarketingContent = (currentForm: typeof formData) => {
    const isImportant = currentForm.marketingIsImportant === 'yes'
    let regionStr = '广东省'
    if (Array.isArray(currentForm.marketingRegion)) {
      regionStr = currentForm.marketingRegion.join('/')
    } else if (typeof currentForm.marketingRegion === 'string') {
      regionStr = currentForm.marketingRegion
    }

    let generated = ''
    if (currentForm.marketingCategory === 'daily_work') {
      generated = `【日常工作】\n` +
        `* **区域**：${regionStr}\n` +
        `* **业主单位**：${currentForm.customerName || '未指定'}\n` +
        `* **科/股室**：${currentForm.marketingSection || '无'}\n` +
        `* **是否重点**：${isImportant ? '是 🔴' : '否'}\n` +
        `* **协助人**：${(currentForm.marketingAssistors && currentForm.marketingAssistors.length > 0) ? currentForm.marketingAssistors.join(', ') : '无'}\n` +
        `* **当前进展**：\n${currentForm.marketingProgress || '无'}\n\n` +
        `* **需协助事项**：\n${currentForm.marketingHelpNeeded || '无'}`
    } else if (currentForm.marketingCategory === 'payment_followup') {
      generated = `【回款跟进】\n` +
        `* **区域**：${regionStr}\n` +
        `* **业主单位**：${currentForm.customerName || '未指定'}\n` +
        `* **科/股室**：${currentForm.marketingSection || '无'}\n` +
        `* **关联合同**：${(currentForm.marketingContracts && currentForm.marketingContracts.length > 0) ? currentForm.marketingContracts.join(', ') : '无'}\n` +
        `* **是否重点**：${isImportant ? '是 🔴' : '否'}\n` +
        `* **当前进展**：\n${currentForm.marketingProgress || '无'}\n\n` +
        `* **需协助事项**：\n${currentForm.marketingHelpNeeded || '无'}`
    }

    setFormData(prev => ({ ...prev, content: generated }))
  }

  // 真正执行提交的接口
  const executeSubmit = async (payload: any) => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await post<any>('/broadcast', payload)
      if (res) {
        setSubmitted(true)
        Toast.show({ icon: 'success', content: '战报填报提交成功！' })
      }
    } catch (err: any) {
      console.error(err)
      const detail = err?.response?.data?.detail
      Toast.show({
        icon: 'fail',
        content: typeof detail === 'string' ? detail : '提报失败，今天该商机可能已被他人绑定或已被使用',
        duration: 3000
      })
    } finally {
      setSubmitting(false)
    }
  }

  // 提交接口
  const handleSubmit = async () => {
    if (submitting) return
    if (actionType === 'station_report') {
      if (!formData.projectName?.trim()) {
        Toast.show({ icon: 'fail', content: '请输入标题' })
        return
      }
      if (isStationed && !formData.customerName?.trim()) {
        Toast.show({ icon: 'fail', content: '请输入地点' })
        return
      }
      if (!formData.actionDescription?.trim()) {
        Toast.show({ icon: 'fail', content: '请选择播报分类' })
        return
      }

      let finalContent = ''
      let finalTitle = formData.projectName || ''
      const isUrgent = formData.happinessScore === 100
      const urgentStr = isUrgent ? '【紧急】' : ''

      if (formData.actionDescription === 'policy') {
        if (!stationFiles || stationFiles.length === 0) {
          Toast.show({ icon: 'fail', content: '最新政策分类必须上传附件！' })
          return
        }
        if (!policyLevel) {
          Toast.show({ icon: 'fail', content: '请选择政策层级' })
          return
        }
        let points = []
        if (policyOpportunity?.trim()) {
          points.push(`1. 业务机会：\n${policyOpportunity.trim()}`)
        }
        if (policyRisk?.trim()) {
          points.push(`2. 风险点：\n${policyRisk.trim()}`)
        }
        if (policyOther?.trim()) {
          points.push(`3. 其他要点：\n${policyOther.trim()}`)
        }

        finalContent = `【政策层级】\n${policyLevel}`
        if (points.length > 0) {
          finalContent += `\n\n【核心要点】\n${points.join('\n\n')}`
        }

        const levelStr = `[${policyLevel}]`
        if (!finalTitle.startsWith('【政策】') && !finalTitle.startsWith('【最新政策】')) {
          finalTitle = `【政策】${urgentStr}${levelStr}${finalTitle}`
        }
      } else if (formData.actionDescription === 'deployment') {
        if (!meetingSubject?.trim()) {
          Toast.show({ icon: 'fail', content: '请输入会议主题' })
          return
        }
        if (!meetingTimePlace?.trim()) {
          Toast.show({ icon: 'fail', content: '请输入会议召开时间与地点' })
          return
        }
        if (!meetingHost?.trim()) {
          Toast.show({ icon: 'fail', content: '请输入主持人或出席领导' })
          return
        }
        let points = []
        if (meetingProject?.trim()) {
          points.push(`1. 项目方面：\n${meetingProject.trim()}`)
        }
        if (meetingFunds?.trim()) {
          points.push(`2. 资金方面：\n${meetingFunds.trim()}`)
        }
        if (meetingInstructions?.trim()) {
          points.push(`3. 领导批示或核心决议：\n${meetingInstructions.trim()}`)
        }
        if (meetingDeadline?.trim()) {
          points.push(`4. 时间要求：\n${meetingDeadline.trim()}`)
        }

        finalContent = `【会议主题】\n${meetingSubject}\n\n` +
          `【时间地点】\n${meetingTimePlace}\n\n` +
          `【主持/出席领导】\n${meetingHost}`

        if (points.length > 0) {
          finalContent += `\n\n【会议要点】\n${points.join('\n\n')}`
        }

        if (!finalTitle.startsWith('【会议】') && !finalTitle.startsWith('【重大会议部署】') && !finalTitle.startsWith('【会议部署】')) {
          finalTitle = `【会议】${urgentStr}${finalTitle}`
        }
      } else if (formData.actionDescription === 'intelligence') {
        if (!intelligenceType) {
          Toast.show({ icon: 'fail', content: '请选择情报类型' })
          return
        }
        if (!intelligenceContent?.trim()) {
          Toast.show({ icon: 'fail', content: '请输入具体情报内容' })
          return
        }
        if (!intelligenceSource?.trim()) {
          Toast.show({ icon: 'fail', content: '请输入情报来源' })
          return
        }

        const typeMap: Record<string, string> = {
          peer: '同行',
          personnel: '人事',
          competitor: '对手',
        }
        const typeLabel = typeMap[intelligenceType] || '通用'

        finalContent = `【情报类型】\n${typeLabel}\n\n` +
          `【情报来源与可靠性】\n${intelligenceSource} (可靠性评估：${intelligenceReliability})\n\n` +
          `【具体内容】\n${intelligenceContent}`

        if (!finalTitle.startsWith('【情报') && !finalTitle.startsWith('【重大情报')) {
          finalTitle = `【情报-${typeLabel}】${urgentStr}${finalTitle}`
        }
      } else {
        if (!formData.content?.trim()) {
          Toast.show({ icon: 'fail', content: '请输入正文内容' })
          return
        }
        finalContent = formData.content || ''
      }
      
      setSubmitting(true)
      try {
        const formDataPayload = new FormData()
        formDataPayload.append('station_category', formData.actionDescription)
        formDataPayload.append('station_location', formData.customerName || '')
        formDataPayload.append('is_stationed', String(isStationed !== false))
        formDataPayload.append('title', finalTitle)
        formDataPayload.append('content', finalContent)
        formDataPayload.append('is_urgent', String(isUrgent))
        formDataPayload.append('push_channel', 'all')
        
        if (stationFiles && stationFiles.length > 0) {
          stationFiles.forEach((file) => {
            formDataPayload.append('files', file)
          })
        }
        
        const res = await post<any>('/broadcast/station-report', formDataPayload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        if (res) {
          setSubmitted(true)
          Toast.show({ icon: 'success', content: '市场信息前线播报发布成功！' })
        }
      } catch (err: any) {
        console.error(err)
        const detail = err?.response?.data?.detail || '网络异常'
        Toast.show({ icon: 'fail', content: `发布失败: ${detail}` })
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (actionType === 'marketing_report') {
      if (!formData.customerName) {
        Toast.show({ icon: 'fail', content: '请选择业主单位' })
        return
      }
      if (!formData.marketingProgress?.trim()) {
        Toast.show({ icon: 'fail', content: '请输入事项当前进展' })
        return
      }
      if (!formData.content?.trim()) {
        Toast.show({ icon: 'fail', content: '最终生成战报文本不能为空' })
        return
      }

      const payload: any = {
        event_type: 'marketing_report',
        content: formData.content,
        push_channel: 'all',
        action_type: 'marketing_report',
        customer_name: formData.customerName,
        employee_name: user?.realName || user?.name || user?.username || '',
        team_id: user?.teamId || null
      }
      
      await executeSubmit(payload)
      return
    }

    if (!formData.content.trim()) {
      Toast.show({ icon: 'fail', content: '请填写战报播报内容' })
      return
    }

    if (['potential_lead', 'lead_25', 'lead_75', 'contract'].includes(actionType) && !formData.crmOpportunityId) {
      Toast.show({ icon: 'fail', content: '请选择关联的 CRM 商机项目' })
      return
    }

    if (['triangle', 'happiness'].includes(actionType) && !formData.customerName) {
      Toast.show({ icon: 'fail', content: '请选择客户单位' })
      return
    }

    if (actionType === 'triangle' && !formData.employeeName) {
      Toast.show({ icon: 'fail', content: '请选择录入人姓名' })
      return
    }

    if (['triangle', 'happiness'].includes(actionType) && !formData.actionDescription?.trim()) {
      Toast.show({
        icon: 'fail',
        content: actionType === 'triangle' ? '请输入具体的联动动作说明' : '请输入关怀客户幸福动作的具体叙述'
      })
      return
    }

    if (actionType === 'triangle') {
      if (!formData.triangleResult?.trim()) {
        Toast.show({ icon: 'fail', content: '请输入联动取得的成果' })
        return
      }
      if (!formData.customerFeedback?.trim()) {
        Toast.show({ icon: 'fail', content: '请输入客户反馈' })
        return
      }
    }

    if (actionType === 'happiness') {
      if (!formData.happinessResult?.trim()) {
        Toast.show({ icon: 'fail', content: '请输入取得的成果' })
        return
      }
      if (!formData.recommendAction?.trim()) {
        Toast.show({ icon: 'fail', content: '请输入内部可推广复制的做法' })
        return
      }
    }

    // 校验分摊和
    if (actionType === 'contract') {
      if (deliveryAllocations.length === 0) {
        Toast.show({ icon: 'fail', content: '请添加交付新签业绩分配人员' })
        return
      }
      const dSum = deliveryAllocations.reduce((s, i) => s + (Number(i.ratio) || 0), 0)
      if (Math.abs(dSum - 100) > 0.1) {
        Toast.show({ icon: 'fail', content: `交付分摊比例之和必须为 100% (当前为 ${dSum}%)` })
        return
      }
      if (deliveryAllocations.some(i => !i.user_id)) {
        Toast.show({ icon: 'fail', content: '交付分摊存在未选择员工的记录' })
        return
      }
      if (deliveryAllocations.some(i => Number(i.ratio) <= 0)) {
        Toast.show({ icon: 'fail', content: '每个交付分摊人员的比例必须大于 0%' })
        return
      }

      if (marketingAllocations.length === 0) {
        Toast.show({ icon: 'fail', content: '请添加营销新签业绩分配人员' })
        return
      }
      const mSum = marketingAllocations.reduce((s, i) => s + (Number(i.ratio) || 0), 0)
      if (Math.abs(mSum - 100) > 0.1) {
        Toast.show({ icon: 'fail', content: `营销分摊比例之和必须为 100% (当前为 ${mSum}%)` })
        return
      }
      if (marketingAllocations.some(i => !i.user_id)) {
        Toast.show({ icon: 'fail', content: '营销分摊存在未选择员工的记录' })
        return
      }
      if (marketingAllocations.some(i => Number(i.ratio) <= 0)) {
        Toast.show({ icon: 'fail', content: '每个营销分摊人员的比例必须大于 0%' })
        return
      }
    }

    const payload = {
      event_type: actionType === 'contract' ? 'contract_signed' : actionType,
      team_id: user?.teamId || null,
      content: formData.content,
      push_channel: 'all',
      action_type: actionType,
      customer_name: formData.customerName || formData.projectName || '',
      amount: formData.amount,
      crm_opportunity_id: formData.crmOpportunityId || null,
      project_name: actionType === 'happiness' ? (formData.projectName || '未定') : null,
      happiness_score: actionType === 'happiness' ? formData.happinessScore : null,
      action_description: (actionType === 'happiness' || actionType === 'triangle') ? formData.actionDescription : null,
      delivery_allocations: actionType === 'contract' ? deliveryAllocations : null,
      marketing_allocations: actionType === 'contract' ? marketingAllocations : null,
      attachment_urls: attachmentUrls.length > 0 ? attachmentUrls : null,
      employee_name: formData.employeeName || null,
      copartners: actionType === 'triangle' ? formData.copartners : null,
      marketing_copartners: actionType === 'triangle' ? formData.marketingCopartners : null
    }

    // 运行重复检测，对齐电脑端
    try {
      const customerName = formData.customerName || formData.projectName || ''
      const checkRes = await post<any>('/broadcast/check-duplicate', {
        content: formData.content,
        customer_name: customerName
      })
      const checkData = checkRes?.data ? checkRes.data : checkRes
      
      if (checkData && checkData.is_duplicate) {
        // 重复了，拦截并弹出提示 Modal，暂存 payload
        setPendingPayload(payload)
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
    }

    // 未重复则正常提交
    await executeSubmit(payload)
  }

  // 协同人员添加
  const handleAddAllocMember = (uid: number) => {
    const matched = users.find(u => u.id === uid)
    if (!matched) return
    
    if (allocTargetType === 'delivery') {
      const exists = deliveryAllocations.some(item => item.user_id === uid)
      if (exists) {
        Toast.show('该员工已在交付列表中')
        return
      }
      const updated = [...deliveryAllocations, { user_id: uid, ratio: 0, amount: 0 }]
      setDeliveryAllocations(updated)
    } else {
      const exists = marketingAllocations.some(item => item.user_id === uid)
      if (exists) {
        Toast.show('该员工已在营销列表中')
        return
      }
      const updated = [...marketingAllocations, { user_id: uid, ratio: 0, amount: 0 }]
      setMarketingAllocations(updated)
    }
    setAllocUserModalVisible(false)
  }

  // 商机检索展示过滤
  const filteredProjects = crmProjects.filter(p => 
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) || 
    p.customer_name.toLowerCase().includes(projectSearch.toLowerCase())
  )

  // 客户名称直接使用后端模糊查询返回的数据
  const filteredCustomers = crmCustomers

  if (submitted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '0 32px' }}>
        <CheckCircleFill style={{ fontSize: 64, color: '#52c41a' }} />
        <h2 style={{ marginTop: 16, fontSize: 20, fontWeight: 600 }}>战报提交成功</h2>
        <p style={{ color: '#999', marginTop: 8, textAlign: 'center', fontSize: 13 }}>
          您的冲刺战报已成功提交，大屏与钉钉播报已触发，对应日报已级联生成审核通过。
        </p>
        <Button color="primary" block style={{ marginTop: 32, borderRadius: 8, height: 44 }} onClick={() => navigate('/m/home')}>
          返回首页
        </Button>
      </div>
    )
  }

  return (
    <div className="page-content" style={{ padding: '12px', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* 标题 */}
      <div style={{ padding: '12px 4px 8px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>⚔️ 每日冲刺业绩填报</h2>
        <p style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
          动作填报会自动在日报中进行数据加算和战报大屏推送
        </p>
      </div>

      {/* 选择动作类型 */}
      <Card style={{ marginBottom: 12, borderRadius: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10, color: '#333' }}>
          * 选择填报动作类型
        </div>
        <Selector
          options={actionOptions}
          value={[actionType]}
          onChange={(arr) => arr[0] && handleActionTypeChange(arr[0])}
          style={{
            '--font-size': '13px',
            '--active-background-color': '#e6f7ff',
            '--active-border-color': '#1677ff'
          }}
        />
      </Card>

      {/* 动态表单区域 */}
      <Card style={{ marginBottom: 12, borderRadius: 12, padding: '4px' }}>
        {/* 驻点人员播报 */}
        {actionType === 'station_report' && (
          <div style={{ padding: '8px' }}>
            <div style={{ borderBottom: '1px solid #eee', paddingBottom: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 'bold', color: '#1677ff' }}>
                🏛️ 市场信息前线播报内容填报
              </span>
            </div>
            
            <Form layout="vertical">
              <Form.Item label="是否为驻点人员">
                <Switch
                  checked={isStationed}
                  onChange={(val) => setIsStationed(val)}
                  style={{ '--checked-color': '#1677ff' }}
                />
              </Form.Item>

              <Form.Item label={isStationed ? "地点 (必填)" : "地点 (选填)"}>
                <Input
                  value={formData.customerName}
                  onChange={(val) => setFormData(prev => ({ ...prev, customerName: val }))}
                  placeholder="请输入驻点区域+客户名称，例：廉江市自然资源局"
                  style={{
                    fontSize: 13,
                    border: '1px solid #e8e8e8',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    background: '#fff'
                  }}
                />
              </Form.Item>

              <Form.Item label="播报分类 (必填)">
                <Selector
                  options={[
                    { label: '🏛️ 最新政策', value: 'policy' },
                    { label: '📋 会议部署', value: 'deployment' },
                    { label: '🔍 情报信息', value: 'intelligence' }
                  ]}
                  value={[formData.actionDescription]}
                  onChange={(arr) => setFormData(prev => ({ ...prev, actionDescription: arr[0] || '' }))}
                  style={{
                    '--font-size': '12px',
                    '--active-background-color': '#e6f7ff',
                    '--active-border-color': '#1677ff'
                  }}
                />
              </Form.Item>

              <Form.Item label="播报标题 (必填)">
                <Input
                  value={formData.projectName}
                  onChange={(val) => setFormData(prev => ({ ...prev, projectName: val }))}
                  placeholder="请在此输入简要的标题"
                  style={{
                    fontSize: 13,
                    border: '1px solid #e8e8e8',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    background: '#fff'
                  }}
                />
              </Form.Item>

              {/* 最新政策精细录入卡片 */}
              {formData.actionDescription === 'policy' && (
                <div style={{ background: '#fafafa', border: '1px solid #1677ff', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#1677ff', marginBottom: 8 }}>🏛️ 最新政策要素</div>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>政策层级 (必选)</div>
                  <Selector
                    options={[
                      { label: '国家级', value: '国家级' },
                      { label: '省级', value: '省级' },
                      { label: '市级', value: '市级' },
                      { label: '县区级', value: '县区级' },
                      { label: '其它', value: '其它' }
                    ]}
                    value={[policyLevel]}
                    onChange={(arr) => setPolicyLevel(arr[0] || '省级')}
                    style={{
                      '--font-size': '11px',
                      '--active-background-color': '#e6f7ff',
                      '--active-border-color': '#1677ff',
                      marginBottom: 8
                    }}
                  />
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>业务机会 (选填)</div>
                  <TextArea
                    value={policyOpportunity}
                    onChange={(val) => setPolicyOpportunity(val)}
                    placeholder="例：1. XX项目可能在XX月启动招标"
                    rows={2}
                    style={{ fontSize: 12, border: '1px solid #e8e8e8', borderRadius: 4, padding: 4, background: '#fff', marginBottom: 8 }}
                  />
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>风险点 (选填)</div>
                  <TextArea
                    value={policyRisk}
                    onChange={(val) => setPolicyRisk(val)}
                    placeholder="例：2. 预算可能缩减，或者对原方案有调整风险"
                    rows={2}
                    style={{ fontSize: 12, border: '1px solid #e8e8e8', borderRadius: 4, padding: 4, background: '#fff', marginBottom: 8 }}
                  />
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>其他要点 (选填)</div>
                  <TextArea
                    value={policyOther}
                    onChange={(val) => setPolicyOther(val)}
                    placeholder="例：3. 其他需要注意的通知事项"
                    rows={2}
                    style={{ fontSize: 12, border: '1px solid #e8e8e8', borderRadius: 4, padding: 4, background: '#fff' }}
                  />
                </div>
              )}

              {/* 重大会议部署精细录入卡片 */}
              {formData.actionDescription === 'deployment' && (
                <div style={{ background: '#fafafa', border: '1px solid #722ed1', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#722ed1', marginBottom: 8 }}>📋 重大会议部署要素</div>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>会议主题 (必填)</div>
                  <Input
                    value={meetingSubject}
                    onChange={(val) => setMeetingSubject(val)}
                    placeholder="例：XXX工作部署会"
                    style={{ fontSize: 12, border: '1px solid #e8e8e8', borderRadius: 4, padding: 4, background: '#fff', marginBottom: 8 }}
                  />
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>时间/地点 (必填)</div>
                  <Input
                    value={meetingTimePlace}
                    onChange={(val) => setMeetingTimePlace(val)}
                    placeholder="例：6月8日，3楼第一会议室"
                    style={{ fontSize: 12, border: '1px solid #e8e8e8', borderRadius: 4, padding: 4, background: '#fff', marginBottom: 8 }}
                  />
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>主持/出席领导 (必填)</div>
                  <Input
                    value={meetingHost}
                    onChange={(val) => setMeetingHost(val)}
                    placeholder="例：分管副局长李某某"
                    style={{ fontSize: 12, border: '1px solid #e8e8e8', borderRadius: 4, padding: 4, background: '#fff', marginBottom: 8 }}
                  />
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>项目方面要点 (选填)</div>
                  <TextArea
                    value={meetingProject}
                    onChange={(val) => setMeetingProject(val)}
                    placeholder="1、项目方面：...（名称、规模、主体）"
                    rows={2}
                    style={{ fontSize: 12, border: '1px solid #e8e8e8', borderRadius: 4, padding: 4, background: '#fff', marginBottom: 8 }}
                  />
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>资金方面要点 (选填)</div>
                  <TextArea
                    value={meetingFunds}
                    onChange={(val) => setMeetingFunds(val)}
                    placeholder="2、资金方面：...（额度、投向）"
                    rows={2}
                    style={{ fontSize: 12, border: '1px solid #e8e8e8', borderRadius: 4, padding: 4, background: '#fff', marginBottom: 8 }}
                  />
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>领导批示或决议 (选填)</div>
                  <TextArea
                    value={meetingInstructions}
                    onChange={(val) => setMeetingInstructions(val)}
                    placeholder="3、领导批示或核心决议"
                    rows={2}
                    style={{ fontSize: 12, border: '1px solid #e8e8e8', borderRadius: 4, padding: 4, background: '#fff', marginBottom: 8 }}
                  />
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>时间要求 (选填)</div>
                  <TextArea
                    value={meetingDeadline}
                    onChange={(val) => setMeetingDeadline(val)}
                    placeholder="4、时间要求：..."
                    rows={2}
                    style={{ fontSize: 12, border: '1px solid #e8e8e8', borderRadius: 4, padding: 4, background: '#fff' }}
                  />
                </div>
              )}

              {/* 重大情报信息精细录入卡片 */}
              {formData.actionDescription === 'intelligence' && (
                <div style={{ background: '#fafafa', border: '1px solid #fa8c16', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fa8c16', marginBottom: 8 }}>🔍 重大情报信息要素</div>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>情报类型 (必选)</div>
                  <Selector
                    options={[
                      { label: '同行项目', value: 'peer' },
                      { label: '领导变动', value: 'personnel' },
                      { label: '竞争对手', value: 'competitor' }
                    ]}
                    value={[intelligenceType]}
                    onChange={(arr) => setIntelligenceType(arr[0] || 'peer')}
                    style={{
                      '--font-size': '11px',
                      '--active-background-color': '#fef7e9',
                      '--active-border-color': '#fa8c16',
                      marginBottom: 8
                    }}
                  />
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
                    {intelligenceType === 'personnel'
                      ? '人物与变动 (必填)'
                      : intelligenceType === 'competitor'
                      ? '对手与动向 (必填)'
                      : '项目概况 (必填)'}
                  </div>
                  <TextArea
                    value={intelligenceContent}
                    onChange={(val) => setIntelligenceContent(val)}
                    placeholder={
                      intelligenceType === 'personnel'
                        ? '输入领导变动的具体职位、姓名、分管方向等'
                        : intelligenceType === 'competitor'
                        ? '输入竞争对手的近期市场活动及主要走势等'
                        : '输入同行在某地开展新型项目的具体规模、主体、模式等'
                    }
                    rows={3}
                    style={{ fontSize: 12, border: '1px solid #e8e8e8', borderRadius: 4, padding: 4, background: '#fff', marginBottom: 8 }}
                  />
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>情报来源 (必填)</div>
                  <Input
                    value={intelligenceSource}
                    onChange={(val) => setIntelligenceSource(val)}
                    placeholder="例：XX单位XX人透露、现场实地观察"
                    style={{ fontSize: 12, border: '1px solid #e8e8e8', borderRadius: 4, padding: 4, background: '#fff', marginBottom: 8 }}
                  />
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>可靠性评估 (必选)</div>
                  <Selector
                    options={[
                      { label: '高', value: '高' },
                      { label: '中', value: '中' },
                      { label: '低', value: '低' }
                    ]}
                    value={[intelligenceReliability]}
                    onChange={(arr) => setIntelligenceReliability(arr[0] || '中')}
                    style={{
                      '--font-size': '11px',
                      '--active-background-color': '#fef7e9',
                      '--active-border-color': '#fa8c16'
                    }}
                  />
                </div>
              )}

              {/* 兜底正文 */}
              {!['policy', 'deployment', 'intelligence'].includes(formData.actionDescription) && (
                <Form.Item label="正文内容 (必填)">
                  <TextArea
                    value={formData.content}
                    onChange={(val) => setFormData(prev => ({ ...prev, content: val }))}
                    placeholder="请输入具体政策或线索等播报正文内容..."
                    rows={4}
                    style={{
                      fontSize: 13,
                      border: '1px solid #e8e8e8',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      background: '#fff'
                    }}
                  />
                </Form.Item>
              )}

              <Form.Item label="内容摘要 (选填，不填则自动生成)">
                <TextArea
                  value={formData.recommendAction}
                  onChange={(val) => setFormData(prev => ({ ...prev, recommendAction: val }))}
                  placeholder="用于钉钉推送预览摘要，限150字以内"
                  rows={2}
                  maxLength={150}
                  style={{
                    fontSize: 13,
                    border: '1px solid #e8e8e8',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    background: '#fff'
                  }}
                />
              </Form.Item>

              <Form.Item label="紧急程度">
                <Checkbox
                  checked={formData.happinessScore === 100}
                  onChange={(val) => setFormData(prev => ({ ...prev, happinessScore: val ? 100 : 20 }))}
                  style={{ fontSize: 13, color: '#ff4d4f' }}
                >
                  🚨 紧急播报（群内强提醒 @所有人 ！）
                </Checkbox>
              </Form.Item>

              <Form.Item label="📎 上传附件（可多选，单次及打包总大小不能超过 50MB）">
                <div style={{ padding: '12px 4px', border: '1px dashed #ccc', borderRadius: 6, textAlign: 'center', background: '#fff', cursor: 'pointer', position: 'relative' }}>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      const totalSize = files.reduce((acc, f) => acc + f.size, 0)
                      if (totalSize > 50 * 1024 * 1024) {
                        Toast.show({ icon: 'fail', content: '所选文件总大小不能超过 50MB！' })
                        e.target.value = ''
                        return
                      }
                      setStationFiles(files)
                    }}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: '#666' }}>
                    {stationFiles.length > 0 ? `已选中 ${stationFiles.length} 个文件` : '点击选择文件（支持Word、PDF、ZIP等）'}
                  </span>
                </div>
                {stationFiles.length > 0 && (
                  <div style={{ marginTop: 8, maxHeight: 100, overflowY: 'auto', background: '#fff', borderRadius: 6, padding: '4px 8px' }}>
                    {stationFiles.map((f, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#666', padding: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📄 {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                  {formData.actionDescription === 'policy'
                    ? '注意：附件包将使用 AES-256 强加密，密码直接发布在群里'
                    : '注意：文件将作为原始附件直接上传，不进行加密'}
                </div>
              </Form.Item>
            </Form>
          </div>
        )}

        {/* 营销内部播报 */}
        {actionType === 'marketing_report' && (
          <div style={{ padding: '8px' }}>
            <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 'bold', color: '#722ed1' }}>
                📢 营销内部播报内容提报
              </span>
            </div>

            <Form layout="vertical">
              <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>营销播报分类</span>}>
                <Selector
                  options={[
                    { label: '日常工作', value: 'daily_work' },
                    { label: '回款跟进', value: 'payment_followup' }
                  ]}
                  value={[formData.marketingCategory]}
                  onChange={(arr) => {
                    const val = arr[0] || ''
                    handleMarketingFieldChange('marketingCategory', val)
                  }}
                  style={{
                    '--font-size': '13px',
                    '--active-background-color': '#f9f0ff',
                    '--active-border-color': '#722ed1'
                  }}
                />
              </Form.Item>

              {formData.marketingCategory && (
                <>
                  <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>区域</span>}>
                    <Button
                      onClick={() => setRegionVisible(true)}
                      style={{ width: '100%', textAlign: 'left', fontSize: 13, height: 38, borderRadius: 6, borderColor: '#d9d9d9', color: '#595959' }}
                    >
                      {formData.marketingRegion && formData.marketingRegion.length > 0
                        ? formData.marketingRegion.join(' / ')
                        : '请选择省/市/区'}
                    </Button>
                    <CascadePicker
                      title='请选择省/市/区'
                      options={REGION_OPTIONS}
                      visible={regionVisible}
                      value={formData.marketingRegion}
                      onClose={() => setRegionVisible(false)}
                      onConfirm={(val) => {
                        handleMarketingFieldChange('marketingRegion', val as string[])
                      }}
                    />
                  </Form.Item>

                  <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>业主单位 (CRM 客户)</span>}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', borderRadius: 8, padding: '4px 10px', marginBottom: 8, border: '1px solid #e8e8e8' }}>
                      <SearchOutline style={{ color: '#999', marginRight: 6 }} />
                      <Input
                        placeholder="输入关键字检索并选择业主..."
                        value={customerSearch}
                        onChange={(val) => {
                          setCustomerSearch(val)
                          handleCustomerSearch(val)
                        }}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                    <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, background: '#fff', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' }}>
                      {crmCustomers.length === 0 ? (
                        <div style={{ padding: '8px 12px', fontSize: 12, color: '#bfbfbf', textAlign: 'center' }}>无匹配的客户，可直接输入搜索词自动检索</div>
                      ) : (
                        crmCustomers.map((cust) => {
                          const isSelected = formData.customerName === cust
                          return (
                            <div
                              key={cust}
                              onClick={() => {
                                handleMarketingFieldChange('customerName', cust)
                              }}
                              style={{
                                padding: '8px 12px',
                                borderBottom: '1px solid #f5f5f5',
                                background: isSelected ? '#f9f0ff' : '#fff',
                                fontSize: 13,
                                color: isSelected ? '#722ed1' : '#262626',
                                fontWeight: isSelected ? 'bold' : 'normal'
                              }}
                            >
                              {cust}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </Form.Item>

                  <Form.Item label="科/股室 (选填)">
                    <Input
                      placeholder="请输入科/股室，例：开发利用科"
                      value={formData.marketingSection}
                      onChange={(val) => handleMarketingFieldChange('marketingSection', val)}
                      style={{
                        fontSize: 13,
                        border: '1px solid #e8e8e8',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        background: '#fff'
                      }}
                    />
                  </Form.Item>

                  {formData.marketingCategory === 'daily_work' && (
                    <Form.Item label="协助人 (选填)">
                      <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', borderRadius: 8, padding: '4px 10px', marginBottom: 8, border: '1px solid #e8e8e8' }}>
                        <SearchOutline style={{ color: '#999', marginRight: 6 }} />
                        <Input
                          placeholder="搜索人员名字..."
                          value={copartnerSearch}
                          onChange={setCopartnerSearch}
                          style={{ fontSize: 13 }}
                        />
                      </div>
                      <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #e8e8e8', borderRadius: 8, padding: 8, background: '#fff', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' }}>
                        <Checkbox.Group
                          value={formData.marketingAssistors}
                          onChange={(val) => handleMarketingFieldChange('marketingAssistors', val as string[])}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {users
                              .filter(u => u.name.toLowerCase().includes(copartnerSearch.toLowerCase()))
                              .map(u => (
                                <Checkbox key={u.id} value={u.name} style={{ '--font-size': '13px' }}>
                                  {u.name}
                                </Checkbox>
                              ))}
                          </div>
                        </Checkbox.Group>
                      </div>
                    </Form.Item>
                  )}

                  {formData.marketingCategory === 'payment_followup' && (
                    <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>关联合同项目 (可多选)</span>}>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', borderRadius: 8, padding: '4px 10px', marginBottom: 8, border: '1px solid #e8e8e8' }}>
                        <SearchOutline style={{ color: '#999', marginRight: 6 }} />
                        <Input
                          placeholder="搜索合同名称..."
                          value={projectSearch}
                          onChange={setProjectSearch}
                          style={{ fontSize: 13 }}
                        />
                      </div>
                      <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #e8e8e8', borderRadius: 8, padding: 8, background: '#fff', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' }}>
                        <Checkbox.Group
                          value={formData.marketingContracts}
                          onChange={(val) => handleMarketingFieldChange('marketingContracts', val as string[])}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {crmProjects
                              .filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                              .map(p => (
                                <Checkbox key={p.id} value={p.name} style={{ '--font-size': '13px' }}>
                                  {p.name} (业主：{p.customer_name})
                                </Checkbox>
                              ))}
                          </div>
                        </Checkbox.Group>
                      </div>
                    </Form.Item>
                  )}

                  <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>事项当前进展</span>}>
                    <TextArea
                      placeholder="请输入当前事项进展情况..."
                      value={formData.marketingProgress}
                      onChange={(val) => handleMarketingFieldChange('marketingProgress', val)}
                      rows={4}
                      style={{
                        fontSize: 13,
                        border: '1px solid #e8e8e8',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        background: '#fff'
                      }}
                    />
                  </Form.Item>

                  <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>是否重点信息</span>}>
                    <Selector
                      options={[
                        { label: '是', value: 'yes' },
                        { label: '否', value: 'no' }
                      ]}
                      value={[formData.marketingIsImportant]}
                      onChange={(arr) => {
                        const val = arr[0] || 'no'
                        handleMarketingFieldChange('marketingIsImportant', val)
                      }}
                      style={{
                        '--font-size': '13px',
                        '--active-background-color': '#f9f0ff',
                        '--active-border-color': '#722ed1'
                      }}
                    />
                  </Form.Item>

                  <Form.Item label="需协助事项 (选填)">
                    <TextArea
                      placeholder="请输入需要协调解决或上级支持的事项..."
                      value={formData.marketingHelpNeeded}
                      onChange={(val) => handleMarketingFieldChange('marketingHelpNeeded', val)}
                      rows={3}
                      style={{
                        fontSize: 13,
                        border: '1px solid #e8e8e8',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        background: '#fff'
                      }}
                    />
                  </Form.Item>
                </>
              )}
            </Form>
          </div>
        )}

        {/* 前三种动作 (商机联动) */}
        {['potential_lead', 'lead_25', 'lead_75', 'contract'].includes(actionType) && (
          <div>
            <div style={{ borderBottom: '1px solid #eee', paddingBottom: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 'bold', color: '#1677ff' }}>
                🔗 {actionType === 'contract' 
                  ? '从项目管理系统的合同表获取' 
                  : actionType === 'lead_75' 
                  ? '从投标室确认标讯系统中标项目中获取' 
                  : actionType === 'potential_lead'
                  ? '选择对应 CRM 中进展阶段为 5%-10% 的项目'
                  : '选择对应 CRM 中进展阶段为 25% 的项目'}
              </span>
            </div>

            {/* 项目列表搜索 */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#f0f0f0', borderRadius: 8, padding: '6px 12px', marginBottom: 12 }}>
              <SearchOutline style={{ color: '#999', marginRight: 6 }} />
              <Input
                placeholder="搜索未绑定的 CRM 项目或业主名称..."
                value={projectSearch}
                onChange={setProjectSearch}
                style={{ fontSize: 13 }}
              />
            </div>

            {crmLoading ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#999', fontSize: 13 }}>正在检索 CRM 未绑定项目...</div>
            ) : filteredProjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#999', fontSize: 13 }}>暂无满足阶段要求的未绑定商机项目</div>
            ) : (
              <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16, border: '1px solid #f0f0f0', borderRadius: 8 }}>
                {filteredProjects.map((p) => {
                  const isSelected = selectedProject?.id === p.id
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleCRMProjectSelect(p)}
                      style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid #f5f5f5',
                        background: isSelected ? '#e6f7ff' : '#fff',
                        fontSize: 13,
                        color: isSelected ? '#1677ff' : '#333'
                      }}
                    >
                      <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                        业主：{p.customer_name} | 预算：{p.budget_money}万 | 预计：{p.expect_money}万
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 业主名称 (只读回填) */}
            <Form layout="vertical">
              <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>业主单位/客户名称</span>}>
                <Input
                  value={formData.customerName}
                  readOnly
                  placeholder="选择项目后自动回填"
                  style={{
                    fontSize: 13,
                    border: '1px solid #e8e8e8',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    background: '#f5f5f5',
                    color: '#999'
                  }}
                />
              </Form.Item>

              {/* 金额输入 (线索和中标允许改金额，合同也允许改) */}
              <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>预计合同价格 / 预计金额 (万元)</span>}>
                <Stepper
                  min={0}
                  max={99999}
                  step={0.1}
                  value={formData.amount}
                  onChange={(val) => {
                    setFormData(prev => ({ ...prev, amount: val ?? 0.0 }))
                    // 同步重算分摊金额
                    if (actionType === 'contract') {
                      recalculateAllocations(val ?? 0.0, deliveryAllocations, marketingAllocations)
                    }
                  }}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Form>

            {/* 业绩分配分摊 (仅新签合同 90% 允许) */}
            {actionType === 'contract' && (
              <div style={{ marginTop: 16 }}>
                {/* 交付分摊 */}
                <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 'bold' }}><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>🛠️ 交付分配分摊 (总和需为100%)</span>
                    <Button
                      size="mini"
                      fill="outline"
                      color="primary"
                      onClick={() => {
                        setAllocTargetType('delivery')
                        setAllocUserModalVisible(true)
                        setAllocUserSearch('')
                      }}
                    >
                      <AddOutline /> 协同人
                    </Button>
                  </div>
                  {deliveryAllocations.map((alloc, idx) => {
                    const matchedUser = users.find(u => u.id === alloc.user_id)
                    return (
                      <div key={alloc.user_id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {matchedUser ? matchedUser.name : '未知人员'}
                        </span>
                        <div style={{ flex: 3, display: 'flex', alignItems: 'center' }}>
                          <Stepper
                            min={0}
                            max={100}
                            value={alloc.ratio}
                            onChange={(val) => {
                              const copy = [...deliveryAllocations]
                              copy[idx].ratio = val ?? 0
                              setDeliveryAllocations(copy)
                              recalculateAllocations(formData.amount, copy, marketingAllocations)
                            }}
                            style={{ '--button-font-size': '14px', '--input-font-size': '12px' }}
                          />
                          <span style={{ fontSize: 11, marginLeft: 2 }}>%</span>
                        </div>
                        <span style={{ fontSize: 12, flex: 2, textAlign: 'right', fontWeight: 'bold' }}>
                          {alloc.amount}万
                        </span>
                        <Button
                          size="mini"
                          fill="none"
                          color="danger"
                          onClick={() => {
                            const copy = deliveryAllocations.filter((_, i) => i !== idx)
                            setDeliveryAllocations(copy)
                            recalculateAllocations(formData.amount, copy, marketingAllocations)
                          }}
                        >
                          <DeleteOutline />
                        </Button>
                      </div>
                    )
                  })}
                </div>

                {/* 营销分摊 */}
                <div style={{ background: '#fafafa', borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 'bold' }}><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>💰 营销分配分摊 (总和需为100%)</span>
                    <Button
                      size="mini"
                      fill="outline"
                      color="primary"
                      onClick={() => {
                        setAllocTargetType('marketing')
                        setAllocUserModalVisible(true)
                        setAllocUserSearch('')
                      }}
                    >
                      <AddOutline /> 协同人
                    </Button>
                  </div>
                  {marketingAllocations.map((alloc, idx) => {
                    const matchedUser = users.find(u => u.id === alloc.user_id)
                    return (
                      <div key={alloc.user_id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {matchedUser ? matchedUser.name : '未知人员'}
                        </span>
                        <div style={{ flex: 3, display: 'flex', alignItems: 'center' }}>
                          <Stepper
                            min={0}
                            max={100}
                            value={alloc.ratio}
                            onChange={(val) => {
                              const copy = [...marketingAllocations]
                              copy[idx].ratio = val ?? 0
                              setMarketingAllocations(copy)
                              recalculateAllocations(formData.amount, deliveryAllocations, copy)
                            }}
                            style={{ '--button-font-size': '14px', '--input-font-size': '12px' }}
                          />
                          <span style={{ fontSize: 11, marginLeft: 2 }}>%</span>
                        </div>
                        <span style={{ fontSize: 12, flex: 2, textAlign: 'right', fontWeight: 'bold' }}>
                          {alloc.amount}万
                        </span>
                        <Button
                          size="mini"
                          fill="none"
                          color="danger"
                          onClick={() => {
                            const copy = marketingAllocations.filter((_, i) => i !== idx)
                            setMarketingAllocations(copy)
                            recalculateAllocations(formData.amount, deliveryAllocations, copy)
                          }}
                        >
                          <DeleteOutline />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 新签合同照片证明上传 */}
            {actionType === 'contract' && (
              <div style={{ marginTop: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
                  📎 上传盖章合同照片附件（证明材料）
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {attachmentUrls.map((url, i) => (
                    <div key={i} style={{ width: 80, height: 80, position: 'relative', border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden' }}>
                      <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div
                        onClick={() => setAttachmentUrls(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: 2, display: 'flex' }}
                      >
                        <CloseCircleFill style={{ fontSize: 14, color: '#fff' }} />
                      </div>
                    </div>
                  ))}
                  {attachmentUrls.length < 3 && (
                    <div 
                      onClick={() => document.getElementById('contract-file-input')?.click()}
                      style={{ width: 80, height: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#fafafa', border: '1px dashed #ccc', borderRadius: 6, cursor: 'pointer' }}
                    >
                      <AddOutline style={{ fontSize: 24, color: '#999' }} />
                      <span style={{ fontSize: 10, color: '#999', marginTop: 4 }}>上传照片</span>
                      <input id="contract-file-input" type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} multiple />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 铁三角联动 */}
        {actionType === 'triangle' && (
          <div>
            <div style={{ borderBottom: '1px solid #eee', paddingBottom: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 'bold', color: '#faad14' }}>
                🔺 售前铁三角现场联动填报
              </span>
            </div>

            <Form layout="vertical">
              {/* 1. 用户自己的姓名 */}
              <Form.Item label="用户自己的姓名">
                <Input 
                  value={formData.employeeName} 
                  readOnly 
                  style={{ 
                    fontSize: 13, 
                    background: '#f5f5f5', 
                    border: '1px solid #e8e8e8', 
                    padding: '6px 10px', 
                    borderRadius: 6,
                    color: '#999'
                  }} 
                />
              </Form.Item>

              {/* 2. 客户选择与选定 */}
              <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>客户/业主名称 (搜索选择)</span>}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#f0f0f0', borderRadius: 8, padding: '6px 12px', marginBottom: 8 }}>
                  <SearchOutline style={{ color: '#999', marginRight: 6 }} />
                  <Input
                    placeholder="输入搜索 CRM 客户名称..."
                    value={customerSearch}
                    onChange={(val) => {
                      setCustomerSearch(val)
                      setFormData(prev => ({ ...prev, customerName: val }))
                      updateTriangleContent(formData.employeeName, val, formData.copartners, formData.marketingCopartners, formData.actionDescription)
                      handleCustomerSearch(val)
                    }}
                    style={{ fontSize: 13 }}
                  />
                </div>

                {filteredCustomers.length > 0 && customerSearch && (
                  <div style={{ maxHeight: 150, overflowY: 'auto', marginBottom: 8, border: '1px solid #f0f0f0', borderRadius: 8, background: '#fff' }}>
                    {filteredCustomers.slice(0, 10).map((cust) => (
                      <div
                        key={cust}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, customerName: cust }))
                          updateTriangleContent(formData.employeeName, cust, formData.copartners, formData.marketingCopartners, formData.actionDescription)
                          setCustomerSearch('')
                        }}
                        style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid #f5f5f5',
                          background: '#fff',
                          fontSize: 13,
                          color: '#333'
                        }}
                      >
                        {cust}
                      </div>
                    ))}
                  </div>
                )}
                <Input
                  value={formData.customerName}
                  readOnly
                  placeholder="在上方搜索或键入确认客户名称"
                  style={{
                    fontSize: 13,
                    background: '#f5f5f5',
                    border: '1px solid #e8e8e8',
                    padding: '6px 10px',
                    borderRadius: 6,
                    color: '#999'
                  }}
                />
              </Form.Item>

              {/* 3. 联动人 (非营销岗) */}
              <Form.Item label="联动人 (除营销岗，多选)">
                <div 
                  onClick={() => {
                    setCopartnersModalVisible(true)
                    setCopartnerSearch('')
                  }}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid #dddddd',
                    borderRadius: 6,
                    background: '#ffffff',
                    fontSize: 13,
                    color: formData.copartners.length > 0 ? '#333' : '#999',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>
                    {formData.copartners.length > 0 
                      ? formData.copartners.join('、') 
                      : '点击选择联动人（非营销人员）'}
                  </span>
                  <span style={{ fontSize: 12, color: '#1677ff' }}>选择 ({formData.copartners.length}人)</span>
                </div>
              </Form.Item>

              {/* 4. 营销联动人 (营销岗) */}
              <Form.Item label="营销联动人 (营销岗，多选)">
                <div 
                  onClick={() => {
                    setMarketingCopartnersModalVisible(true)
                    setMarketingCopartnerSearch('')
                  }}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid #dddddd',
                    borderRadius: 6,
                    background: '#ffffff',
                    fontSize: 13,
                    color: formData.marketingCopartners.length > 0 ? '#333' : '#999',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>
                    {formData.marketingCopartners.length > 0 
                      ? formData.marketingCopartners.join('、') 
                      : '点击选择营销联动人'}
                  </span>
                  <span style={{ fontSize: 12, color: '#1677ff' }}>选择 ({formData.marketingCopartners.length}人)</span>
                </div>
              </Form.Item>

              {/* 5. 具体的联动动作 */}
              <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>联动的动作</span>}>
                <TextArea
                  placeholder="请输入具体的铁三角联动动作描述..."
                  rows={3}
                  value={formData.actionDescription}
                  onChange={(val) => {
                    setFormData(prev => ({ ...prev, actionDescription: val }))
                    updateTriangleContent(formData.employeeName, formData.customerName, formData.copartners, formData.marketingCopartners, val)
                  }}
                  style={{
                    fontSize: 13,
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    background: '#ffffff'
                  }}
                />
              </Form.Item>

              {/* 成果 */}
              <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>成果</span>}>
                <TextArea
                  placeholder="（推进到什么阶段/达成什么结果）"
                  rows={3}
                  value={formData.triangleResult}
                  onChange={(val) => {
                    setFormData(prev => ({ ...prev, triangleResult: val }))
                    updateTriangleContent(formData.employeeName, formData.customerName, formData.copartners, formData.marketingCopartners, formData.actionDescription, val, formData.customerFeedback)
                  }}
                  style={{
                    fontSize: 13,
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    background: '#ffffff'
                  }}
                />
              </Form.Item>

              {/* 客户反馈 */}
              <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>客户反馈</span>}>
                <TextArea
                  placeholder="“（客户原话或总结）”"
                  rows={3}
                  value={formData.customerFeedback}
                  onChange={(val) => {
                    setFormData(prev => ({ ...prev, customerFeedback: val }))
                    updateTriangleContent(formData.employeeName, formData.customerName, formData.copartners, formData.marketingCopartners, formData.actionDescription, formData.triangleResult, val)
                  }}
                  style={{
                    fontSize: 13,
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    background: '#ffffff'
                  }}
                />
              </Form.Item>
            </Form>

            {/* 铁三角联动照片证明上传 */}
            <div style={{ marginTop: 16, padding: '0 4px' }}>
              <span style={{ fontSize: 13, fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
                📎 上传联动现场合影照片（可选，最多3张）
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {attachmentUrls.map((url, i) => (
                  <div key={i} style={{ width: 80, height: 80, position: 'relative', border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden' }}>
                    <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div
                      onClick={() => setAttachmentUrls(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: 2, display: 'flex' }}
                    >
                      <CloseCircleFill style={{ fontSize: 14, color: '#fff' }} />
                    </div>
                  </div>
                ))}
                {attachmentUrls.length < 3 && (
                  <div 
                    onClick={() => document.getElementById('triangle-file-input')?.click()}
                    style={{ width: 80, height: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#fafafa', border: '1px dashed #ccc', borderRadius: 6, cursor: 'pointer' }}
                  >
                    <AddOutline style={{ fontSize: 24, color: '#999' }} />
                    <span style={{ fontSize: 10, color: '#999', marginTop: 4 }}>上传照片</span>
                    <input id="triangle-file-input" type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} multiple />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 客户幸福动作 */}
        {actionType === 'happiness' && (
          <div>
            <div style={{ borderBottom: '1px solid #eee', paddingBottom: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 'bold', color: '#52c41a' }}>
                😊 客户幸福动作填报
              </span>
            </div>

            {/* 项目选择部分 */}
            <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>
              项目名称（选填，默认为未定）：
            </div>

            <div style={{ display: 'flex', alignItems: 'center', background: '#f0f0f0', borderRadius: 8, padding: '6px 12px', marginBottom: 12 }}>
              <SearchOutline style={{ color: '#999', marginRight: 6 }} />
              <Input
                placeholder="搜索选择 CRM 项目名称..."
                value={projectSearchKeyword}
                onChange={(val) => {
                  setProjectSearchKeyword(val)
                  updateHappinessContent({ projectName: val || '未定' })
                  handleProjectSearch(val)
                }}
                style={{ fontSize: 13 }}
              />
            </div>

            {crmProjectsSearch.length > 0 && projectSearchKeyword && (
              <div style={{ maxHeight: 150, overflowY: 'auto', marginBottom: 16, border: '1px solid #f0f0f0', borderRadius: 8 }}>
                {crmProjectsSearch.slice(0, 15).map((proj) => (
                  <div
                    key={proj}
                    onClick={() => {
                      updateHappinessContent({ projectName: proj })
                      setProjectSearchKeyword('')
                    }}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid #f5f5f5',
                      background: '#fff',
                      fontSize: 13,
                      color: '#333'
                    }}
                  >
                    {proj}
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 13, color: '#999', marginBottom: 12 }}>
              请搜索并选择实施了幸福关怀动作的客户单位：
            </div>

            {/* 客户选择 */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#f0f0f0', borderRadius: 8, padding: '6px 12px', marginBottom: 12 }}>
              <SearchOutline style={{ color: '#999', marginRight: 6 }} />
              <Input
                placeholder="搜索选择 CRM 客户名称..."
                value={customerSearch}
                onChange={(val) => {
                  setCustomerSearch(val)
                  updateHappinessContent({ customerName: val })
                  handleCustomerSearch(val)
                }}
                style={{ fontSize: 13 }}
              />
            </div>

            {filteredCustomers.length > 0 && customerSearch && (
              <div style={{ maxHeight: 150, overflowY: 'auto', marginBottom: 16, border: '1px solid #f0f0f0', borderRadius: 8 }}>
                {filteredCustomers.slice(0, 15).map((cust) => (
                  <div
                    key={cust}
                    onClick={() => {
                      updateHappinessContent({ customerName: cust })
                      setCustomerSearch('')
                    }}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid #f5f5f5',
                      background: '#fff',
                      fontSize: 13,
                      color: '#333'
                    }}
                  >
                    {cust}
                  </div>
                ))}
              </div>
            )}

            <Form layout="vertical">
              <Form.Item label="选定的项目名称">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input
                    value={formData.projectName}
                    readOnly
                    placeholder="默认为未定"
                    style={{
                      fontSize: 13,
                      border: '1px solid #e8e8e8',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      background: '#f5f5f5',
                      color: '#999',
                      flex: 1
                    }}
                  />
                  {formData.projectName && formData.projectName !== '未定' && (
                    <Button
                      size="mini"
                      onClick={() => {
                        updateHappinessContent({ projectName: '未定' })
                      }}
                    >
                      清除
                    </Button>
                  )}
                </div>
              </Form.Item>

              <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>选定的客户名称</span>}>
                <Input
                  value={formData.customerName}
                  readOnly
                  placeholder="在上方搜索或键入选择"
                  style={{
                    fontSize: 13,
                    border: '1px solid #e8e8e8',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    background: '#f5f5f5',
                    color: '#999'
                  }}
                />
              </Form.Item>

              <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>客户幸福动作标准分值</span>}>
                <Selector
                  options={[
                    { label: '0分', value: 0 },
                    { label: '20分', value: 20 },
                    { label: '50分', value: 50 },
                    { label: '100分', value: 100 }
                  ]}
                  value={[formData.happinessScore]}
                  onChange={(arr) => {
                    const val = arr[0] ?? 20
                    updateHappinessContent({
                      happinessScore: val,
                      selectedStandards: [],
                      actionDescription: ''
                    })
                  }}
                />
              </Form.Item>

              {formData.happinessScore !== undefined && HAPPINESS_STANDARDS[String(formData.happinessScore)] && (
                <Form.Item label="客户幸福标准选项勾选">
                  <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 8, background: '#fcfcfc' }}>
                    {HAPPINESS_STANDARDS[String(formData.happinessScore)].sections.map((sec: any) => {
                      const expanded = expandedSections[sec.section_id] !== false
                      return (
                        <div key={sec.section_id} style={{ marginBottom: 12 }}>
                          <div 
                            onClick={() => setExpandedSections(prev => ({ ...prev, [sec.section_id]: !expanded }))}
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              background: '#f5f5f5', 
                              padding: '8px 10px', 
                              borderRadius: 4,
                              marginBottom: expanded ? 8 : 0
                            }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 'bold', color: '#1677ff' }}>
                              {sec.section_title}
                            </span>
                            <span style={{ fontSize: 12, color: '#999' }}>
                              {expanded ? '▲' : '▼'}
                            </span>
                          </div>

                          {expanded && (
                            <div style={{ paddingLeft: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {sec.items.map((item: any) => {
                                const isChecked = formData.selectedStandards.includes(item.content)
                                return (
                                  <Checkbox 
                                    key={item.item_id} 
                                    checked={isChecked}
                                    onChange={(checked) => {
                                      let nextSelected = [...formData.selectedStandards]
                                      if (checked) {
                                        if (!nextSelected.includes(item.content)) {
                                          nextSelected.push(item.content)
                                        }
                                      } else {
                                        nextSelected = nextSelected.filter(x => x !== item.content)
                                      }
                                      const cleanedList = nextSelected.map(t => t.replace(/[;；]$/, ''))
                                      const joined = cleanedList.join('；')
                                      updateHappinessContent({
                                        selectedStandards: nextSelected,
                                        actionDescription: joined
                                      })
                                    }}
                                  >
                                    <span style={{ fontSize: 12, color: '#333', lineHeight: '1.4' }}>
                                      {item.content}
                                    </span>
                                  </Checkbox>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Form.Item>
              )}

              <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>具体动作描述</span>}>
                <TextArea
                  placeholder="请输入或由上方勾选生成客户幸福动作的具体叙述（必填）..."
                  rows={3}
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  value={formData.actionDescription}
                  onChange={(val) => {
                    updateHappinessContent({ actionDescription: val })
                  }}
                  style={{
                    fontSize: 13,
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    background: '#ffffff'
                  }}
                />
              </Form.Item>

              {/* 成果 */}
              <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>成果</span>}>
                <TextArea
                  placeholder="（推进到什么阶段/达成什么结果）"
                  rows={3}
                  value={formData.happinessResult}
                  onChange={(val) => {
                    updateHappinessContent({ happinessResult: val })
                  }}
                  style={{
                    fontSize: 13,
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    background: '#ffffff'
                  }}
                />
              </Form.Item>

              {/* 客户反馈（可选） */}
              <Form.Item label="客户反馈（可选）">
                <TextArea
                  placeholder="“（客户原话或总结）”"
                  rows={3}
                  value={formData.happinessFeedback}
                  onChange={(val) => {
                    updateHappinessContent({ happinessFeedback: val })
                  }}
                  style={{
                    fontSize: 13,
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    background: '#ffffff'
                  }}
                />
              </Form.Item>

              {/* 内部可推广复制的做法 */}
              <Form.Item label={<span><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>内部可推广复制的做法</span>}>
                <TextArea
                  placeholder="具体做法说明"
                  rows={3}
                  value={formData.recommendAction}
                  onChange={(val) => {
                    updateHappinessContent({ recommendAction: val })
                  }}
                  style={{
                    fontSize: 13,
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    background: '#ffffff'
                  }}
                />
              </Form.Item>
            </Form>

            {/* 幸福动作照片证明上传 */}
            <div style={{ marginTop: 16, padding: '0 4px' }}>
              <span style={{ fontSize: 13, fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
                📎 上传客户正反馈截图或现场合影证明
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {attachmentUrls.map((url, i) => (
                  <div key={i} style={{ width: 80, height: 80, position: 'relative', border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden' }}>
                    <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div
                      onClick={() => setAttachmentUrls(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: 2, display: 'flex' }}
                    >
                      <CloseCircleFill style={{ fontSize: 14, color: '#fff' }} />
                    </div>
                  </div>
                ))}
                {attachmentUrls.length < 3 && (
                  <div 
                    onClick={() => document.getElementById('happiness-file-input')?.click()}
                    style={{ width: 80, height: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#fafafa', border: '1px dashed #ccc', borderRadius: 6, cursor: 'pointer' }}
                  >
                    <AddOutline style={{ fontSize: 24, color: '#999' }} />
                    <span style={{ fontSize: 10, color: '#999', marginTop: 4 }}>上传证明</span>
                    <input id="happiness-file-input" type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} multiple />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 战报内容审核修改 */}
      {actionType !== 'station_report' && (
        <Card style={{ marginBottom: 16, borderRadius: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#333' }}>
            📣 实时战报广播文本（可做微调）
          </div>
          <TextArea
            placeholder="关联选择相应商机或客户后将自动生成广播战报词..."
            rows={3}
            value={formData.content}
            onChange={(val) => setFormData(prev => ({ ...prev, content: val }))}
            style={{
              fontSize: 13,
              background: '#fafafa',
              borderRadius: 8,
              padding: 8,
              border: '1px solid #f0f0f0'
            }}
          />
        </Card>
      )}

      {/* 提交按钮 */}
      <Button
        block
        color="primary"
        onClick={handleSubmit}
        loading={submitting}
        style={{ borderRadius: 12, height: 46, fontSize: 16, fontWeight: 'bold' }}
      >
        提交发布冲刺战报
      </Button>

      {/* 分摊人员选择弹窗 */}
      <Modal
        visible={allocUserModalVisible}
        content={
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <h3 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>
              添加 {allocTargetType === 'delivery' ? '交付' : '营销'} 分摊人员
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f0f0f0', borderRadius: 8, padding: '6px 12px', marginBottom: 12 }}>
              <SearchOutline style={{ color: '#999', marginRight: 6 }} />
              <Input
                placeholder="搜索姓名..."
                value={allocUserSearch}
                onChange={setAllocUserSearch}
                style={{ fontSize: 13 }}
              />
            </div>
            {(() => {
              const filtered = users.filter(u => {
                // 根据分配类型进行岗位角色过滤，对齐电脑端
                if (allocTargetType === 'marketing') {
                  // 营销业绩分摊人员必须为营销岗、营销人员角色或管理员
                  if (!(u.position_type === 'marketing' || u.role === 'marketing_staff' || u.role === 'admin')) {
                    return false;
                  }
                } else if (allocTargetType === 'delivery') {
                  // 交付业绩分摊人员必须为非营销岗
                  if (u.position_type === 'marketing') {
                    return false;
                  }
                }

                const nameMatch = u.name.toLowerCase().includes(allocUserSearch.toLowerCase());
                const roleMap: Record<string, string> = {
                  admin: '管理员',
                  team_leader: '战队长',
                  employee: '开发员工'
                };
                const roleCn = roleMap[u.role] || '';
                const roleMatch = roleCn.toLowerCase().includes(allocUserSearch.toLowerCase());
                return nameMatch || roleMatch;
              });
              if (filtered.length === 0) {
                return <div style={{ textAlign: 'center', padding: '20px 0', color: '#999', fontSize: 13 }}>未找到匹配人员</div>;
              }
              return (
                <List>
                  {filtered.map(u => (
                    <List.Item
                      key={u.id}
                      clickable
                      onClick={() => handleAddAllocMember(u.id)}
                    >
                      <span style={{ fontSize: 13 }}>{u.name}{u.role === 'admin' ? ' (管理员)' : u.role === 'team_leader' ? ' (战队长)' : ''}</span>
                    </List.Item>
                  ))}
                </List>
              );
            })()}
          </div>
        }
        onClose={() => setAllocUserModalVisible(false)}
        onAction={() => setAllocUserModalVisible(false)}
        closeOnMaskClick
        actions={[{ key: 'close', text: '取消' }]}
      />

      {/* 联动人选择多选弹窗 */}
      <Modal
        visible={copartnersModalVisible}
        content={
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <h3 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>
              请选择联动人（非营销岗，多选）
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f0f0f0', borderRadius: 8, padding: '6px 12px', marginBottom: 12 }}>
              <SearchOutline style={{ color: '#999', marginRight: 6 }} />
              <Input
                placeholder="搜索姓名..."
                value={copartnerSearch}
                onChange={setCopartnerSearch}
                style={{ fontSize: 13 }}
              />
            </div>
            {(() => {
              const filtered = users.filter(u => {
                if (u.position_type === 'marketing') return false;
                const nameMatch = u.name.toLowerCase().includes(copartnerSearch.toLowerCase());
                const positionMatch = (u.position || '').toLowerCase().includes(copartnerSearch.toLowerCase());
                return nameMatch || positionMatch;
              });
              if (filtered.length === 0) {
                return <div style={{ textAlign: 'center', padding: '20px 0', color: '#999', fontSize: 13 }}>未找到匹配人员</div>;
              }
              return (
                <List>
                  {filtered.map(u => {
                    const isSelected = formData.copartners.includes(u.name)
                    return (
                      <List.Item
                        key={u.id}
                        clickable
                        onClick={() => {
                          let nextSelected = []
                          if (isSelected) {
                            nextSelected = formData.copartners.filter(name => name !== u.name)
                          } else {
                            nextSelected = [...formData.copartners, u.name]
                          }
                          setFormData(prev => ({ ...prev, copartners: nextSelected }))
                          // 联动自动更新文案
                          updateTriangleContent(formData.employeeName, formData.customerName, nextSelected, formData.marketingCopartners, formData.actionDescription)
                        }}
                        extra={isSelected ? <CheckCircleFill style={{ color: '#1677ff' }} /> : null}
                      >
                        <span style={{ fontSize: 13, color: isSelected ? '#1677ff' : '#333' }}>{u.name} ({u.position || '其它'})</span>
                      </List.Item>
                    )
                  })}
                </List>
              );
            })()}
          </div>
        }
        onClose={() => setCopartnersModalVisible(false)}
        onAction={() => setCopartnersModalVisible(false)}
        closeOnMaskClick
        actions={[{ key: 'close', text: '确定' }]}
      />

      {/* 营销人员选择多选弹窗 */}
      <Modal
        visible={marketingCopartnersModalVisible}
        content={
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <h3 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>
              请选择营销人员（营销岗，多选）
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f0f0f0', borderRadius: 8, padding: '6px 12px', marginBottom: 12 }}>
              <SearchOutline style={{ color: '#999', marginRight: 6 }} />
              <Input
                placeholder="搜索姓名..."
                value={marketingCopartnerSearch}
                onChange={setMarketingCopartnerSearch}
                style={{ fontSize: 13 }}
              />
            </div>
            {(() => {
              const filtered = users.filter(u => {
                if (u.position_type !== 'marketing') return false;
                const nameMatch = u.name.toLowerCase().includes(marketingCopartnerSearch.toLowerCase());
                const positionMatch = (u.position || '').toLowerCase().includes(marketingCopartnerSearch.toLowerCase());
                return nameMatch || positionMatch;
              });
              if (filtered.length === 0) {
                return <div style={{ textAlign: 'center', padding: '20px 0', color: '#999', fontSize: 13 }}>未找到匹配人员</div>;
              }
              return (
                <List>
                  {filtered.map(u => {
                    const isSelected = formData.marketingCopartners.includes(u.name)
                    return (
                      <List.Item
                        key={u.id}
                        clickable
                        onClick={() => {
                          let nextSelected = []
                          if (isSelected) {
                            nextSelected = formData.marketingCopartners.filter(name => name !== u.name)
                          } else {
                            nextSelected = [...formData.marketingCopartners, u.name]
                          }
                          setFormData(prev => ({ ...prev, marketingCopartners: nextSelected }))
                          // 联动自动更新文案
                          updateTriangleContent(formData.employeeName, formData.customerName, formData.copartners, nextSelected, formData.actionDescription)
                        }}
                        extra={isSelected ? <CheckCircleFill style={{ color: '#1677ff' }} /> : null}
                      >
                        <span style={{ fontSize: 13, color: isSelected ? '#1677ff' : '#333' }}>{u.name} ({u.position || '营销岗'})</span>
                      </List.Item>
                    )
                  })}
                </List>
              );
            })()}
          </div>
        }
        onClose={() => setMarketingCopartnersModalVisible(false)}
        onAction={() => setMarketingCopartnersModalVisible(false)}
        closeOnMaskClick
        actions={[{ key: 'close', text: '确定' }]}
      />

      {/* 重复战报检测提示 Modal，所有文字采用纯中文，与电脑端对齐 */}
      <Modal
        visible={duplicateModalVisible}
        title="⚠️ 发现重复播报内容"
        content={
          <div style={{ padding: '8px 0' }}>
            <p style={{ fontSize: 14 }}>
              昨日上午9点至今本【{duplicateCheckData?.customerName}】已经播放{' '}
              <strong style={{ color: '#ff4d4f', fontSize: 16 }}>{duplicateCheckData?.count}</strong>{' '}
              条。
            </p>
            
            <Button 
              fill="none"
              size="mini"
              style={{ padding: 0, marginBottom: 8, color: '#1677ff' }}
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? '收起明细' : '打开明细'}
            </Button>

            {showDetails && duplicateCheckData?.list && (
              <div style={{ maxHeight: 150, overflowY: 'auto', backgroundColor: '#fafafa', marginTop: 8, padding: 8, border: '1px solid #eee', borderRadius: 6 }}>
                {duplicateCheckData.list.length === 0 ? (
                  <div style={{ color: '#bfbfbf', fontSize: 11 }}>本日暂无该客户的铁三角联动记录</div>
                ) : (
                  duplicateCheckData.list.map((item, index) => (
                    <div key={index} style={{ padding: '4px 0', fontSize: 12, borderBottom: index === duplicateCheckData.list.length - 1 ? 'none' : '1px solid #f5f5f5' }}>
                      {index + 1}. {item}
                    </div>
                  ))
                )}
              </div>
            )}
            <p style={{ color: '#fa8c16', fontSize: 11, marginTop: 12 }}>
              提示：按是，确定为重复记录，将不再播报，按否，不是重复记录，将直接播报出去
            </p>
          </div>
        }
        onClose={() => setDuplicateModalVisible(false)}
        actions={[
          {
            key: 'yes',
            text: '是',
            primary: true,
            onClick: () => {
              setDuplicateModalVisible(false)
              setPendingPayload(null)
              setShowDetails(false)
              // 放弃播报，重定向回移动端首页
              navigate('/m/home')
            }
          },
          {
            key: 'no',
            text: '否',
            onClick: async () => {
              setDuplicateModalVisible(false)
              setShowDetails(false)
              if (pendingPayload) {
                await executeSubmit(pendingPayload)
              }
            }
          }
        ]}
      />
    </div>
  )
}
