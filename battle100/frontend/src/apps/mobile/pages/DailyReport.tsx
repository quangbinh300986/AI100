/**
 * 每日冲刺数据填报页面 (移动端升级版)
 * 适配 5 种核心动作填报与实时战报发布 (CRM 提取、分摊业绩、照片上传)
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Button, Toast, Selector, Stepper, TextArea, Input, Card, Modal, List, Checkbox } from 'antd-mobile'
import { CheckCircleFill, CloseCircleFill, AddOutline, DeleteOutline, SearchOutline } from 'antd-mobile-icons'
import { get, post } from '@shared/api/client'
import { useAuthStore } from '@shared/stores/authStore'
import { HAPPINESS_STANDARDS } from '@shared/data/happinessStandards'

// 战报动作类型选项 (与大屏完全对齐)
const ACTION_TYPE_OPTIONS = [
  { label: '已完成合同签订 (90%)', value: 'contract' },
  { label: '铁三角联动', value: 'triangle' },
  { label: '客户幸福动作', value: 'happiness' },
]

export default function DailyReport() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // 动作类型状态
  const [actionType, setActionType] = useState<string>('contract')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 接口数据池
  const [users, setUsers] = useState<any[]>([])
  const [crmCustomers, setCrmCustomers] = useState<string[]>([])
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

  // 表单数据
  const [formData, setFormData] = useState({
    crmOpportunityId: '',
    customerName: '',
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
    marketingCopartners: [] as string[]
  })

  // 移动端客户幸福动作折叠面板的状态
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  // 合同/幸福动作照片附件
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([])

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
      marketingCopartners: []
    })

    if (val === 'contract') {
      loadCrmProjects(90)
    } else if (val === 'lead_75') {
      loadCrmProjects(75)
    } else if (val === 'lead_25') {
      loadCrmProjects(25)
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
      const marketingUsersCount = proj.marketing_users.length
      const avgRatio = Math.round((100 / marketingUsersCount) * 100) / 100
      
      const initMarketingAlloc = proj.marketing_users.map((mu: any, index: number) => {
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
      setMarketingAllocations(initMarketingAlloc)
    } else {
      setMarketingAllocations([])
    }
  }

  // 照片上传逻辑
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const data = new FormData()
    data.append('file', file)
    try {
      Toast.show({ icon: 'loading', content: '照片上传中...', duration: 0 })
      const res = await post<any>('/reports/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      Toast.clear()
      if (res?.url) {
        setAttachmentUrls(prev => [...prev, res.url])
        Toast.show({ icon: 'success', content: '照片上传成功' })
      }
    } catch (e) {
      Toast.clear()
      Toast.show({ icon: 'fail', content: '照片上传失败，请重试' })
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
  const updateHappinessContent = (
    score: number,
    desc: string,
    customer: string,
    result?: string,
    feedback?: string,
    recommend?: string
  ) => {
    const prefix = '奋战一百天，亮剑破六千！今日'
    const resolvedName = user?.realName || user?.name || user?.username || 'XX'
    
    // 如果未传入则回退至当前 formData 状态值
    const activeResult = result !== undefined ? result : formData.happinessResult;
    const activeFeedback = feedback !== undefined ? feedback : formData.happinessFeedback;
    const activeRecommend = recommend !== undefined ? recommend : formData.recommendAction;

    const feedbackLine = activeFeedback ? `\n客户反馈：${activeFeedback}。` : '';
    const generated = `${prefix}我司【${resolvedName}】做到客户幸福标准【${score}分】动作，对象为【${customer || 'XX'}】，动作描述：${desc || 'XX'}。\n成果：${activeResult || 'XX'}。${feedbackLine}\n内部可推广复制的做法：${activeRecommend || 'XX'}。\n为客户幸福而奋斗，赢战百日！`
    setFormData(prev => ({ ...prev, content: generated }))
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

  // 提交接口
  const handleSubmit = async () => {
    if (!formData.content.trim()) {
      Toast.show({ icon: 'fail', content: '请填写战报播报内容' })
      return
    }

    if (['lead_25', 'lead_75', 'contract'].includes(actionType) && !formData.crmOpportunityId) {
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

    setSubmitting(true)
    try {
      const payload = {
        event_type: actionType === 'contract' ? 'contract_signed' : actionType,
        team_id: user?.teamId || null,
        content: formData.content,
        push_channel: 'all',
        action_type: actionType,
        customer_name: formData.customerName,
        amount: formData.amount,
        crm_opportunity_id: formData.crmOpportunityId || null,
        happiness_score: actionType === 'happiness' ? formData.happinessScore : null,
        action_description: (actionType === 'happiness' || actionType === 'triangle') ? formData.actionDescription : null,
        delivery_allocations: actionType === 'contract' ? deliveryAllocations : null,
        marketing_allocations: actionType === 'contract' ? marketingAllocations : null,
        attachment_urls: attachmentUrls.length > 0 ? attachmentUrls : null,
        employee_name: formData.employeeName || null,
        copartners: actionType === 'triangle' ? formData.copartners : null,
        marketing_copartners: actionType === 'triangle' ? formData.marketingCopartners : null
      }

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
          options={ACTION_TYPE_OPTIONS}
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
        {/* 前三种动作 (商机联动) */}
        {['lead_25', 'lead_75', 'contract'].includes(actionType) && (
          <div>
            <div style={{ borderBottom: '1px solid #eee', paddingBottom: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 'bold', color: '#1677ff' }}>
                🔗 {actionType === 'contract' 
                  ? '从项目管理系统的合同表获取' 
                  : actionType === 'lead_75' 
                  ? '从投标室确认标讯系统中标项目中获取' 
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
                    <span style={{ fontSize: 13, fontWeight: 'bold' }}>🛠️ 交付分配分摊 (总和需为100%)</span>
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
                        {alloc.user_id !== user?.id && (
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
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* 营销分摊 */}
                <div style={{ background: '#fafafa', borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 'bold' }}>💰 营销分配分摊 (总和需为100%)</span>
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
                      <input id="contract-file-input" type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
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
                    <input id="triangle-file-input" type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
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
                  setFormData(prev => ({ ...prev, customerName: val }))
                  updateHappinessContent(formData.happinessScore, formData.actionDescription, val)
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
                      setFormData(prev => ({ ...prev, customerName: cust }))
                      updateHappinessContent(formData.happinessScore, formData.actionDescription, cust)
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
                    setFormData(prev => ({
                      ...prev,
                      happinessScore: val,
                      selectedStandards: [],
                      actionDescription: ''
                    }))
                    updateHappinessContent(val, '', formData.customerName)
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
                                      setFormData(prev => ({
                                        ...prev,
                                        selectedStandards: nextSelected,
                                        actionDescription: joined
                                      }))
                                      updateHappinessContent(formData.happinessScore, joined, formData.customerName)
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
                    setFormData(prev => ({ ...prev, actionDescription: val }))
                    updateHappinessContent(formData.happinessScore, val, formData.customerName)
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
                    setFormData(prev => ({ ...prev, happinessResult: val }))
                    updateHappinessContent(formData.happinessScore, formData.actionDescription, formData.customerName, val, formData.happinessFeedback, formData.recommendAction)
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
                    setFormData(prev => ({ ...prev, happinessFeedback: val }))
                    updateHappinessContent(formData.happinessScore, formData.actionDescription, formData.customerName, formData.happinessResult, val, formData.recommendAction)
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
                    setFormData(prev => ({ ...prev, recommendAction: val }))
                    updateHappinessContent(formData.happinessScore, formData.actionDescription, formData.customerName, formData.happinessResult, formData.happinessFeedback, val)
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
                    <input id="happiness-file-input" type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 战报内容审核修改 */}
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
    </div>
  )
}
