/**
 * 每日冲刺数据填报页面 (移动端升级版)
 * 适配 5 种核心动作填报与实时战报发布 (CRM 提取、分摊业绩、照片上传)
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Button, Toast, Selector, Stepper, TextArea, Input, Card, Modal, List } from 'antd-mobile'
import { CheckCircleFill, CloseCircleFill, AddOutline, DeleteOutline, SearchOutline } from 'antd-mobile-icons'
import { get, post } from '@shared/api/client'
import { useAuthStore } from '@shared/stores/authStore'

// 战报动作类型选项 (与大屏完全对齐)
const ACTION_TYPE_OPTIONS = [
  { label: '有效线索确定 (25%)', value: 'lead_25' },
  { label: '中标确定 (75%)', value: 'lead_75' },
  { label: '已完成合同签订 (90%)', value: 'contract' },
  { label: '铁三角联动', value: 'triangle' },
  { label: '客户幸福动作', value: 'happiness' },
]

export default function DailyReport() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // 动作类型状态
  const [actionType, setActionType] = useState<string>('lead_25')
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

  // 选中的 CRM 实体
  const [selectedProject, setSelectedProject] = useState<any | null>(null)

  // 分摊业绩列表
  const [deliveryAllocations, setDeliveryAllocations] = useState<any[]>([])
  const [marketingAllocations, setMarketingAllocations] = useState<any[]>([])

  // 分摊选择成员弹窗状态
  const [allocUserModalVisible, setAllocUserModalVisible] = useState(false)
  const [allocTargetType, setAllocTargetType] = useState<'delivery' | 'marketing'>('delivery')

  // 表单数据
  const [formData, setFormData] = useState({
    crmOpportunityId: '',
    customerName: '',
    amount: 0.0,
    budgetMoney: 0.0,
    expectMoney: 0.0,
    happinessScore: 20,
    actionDescription: '',
    content: ''
  })

  // 合同/幸福动作照片附件
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([])

  // 挂载加载
  useEffect(() => {
    const initData = async () => {
      try {
        const uRes = await get<any>('/users?page_size=1000')
        const uData = uRes?.data ? uRes.data : uRes
        if (uData?.items) {
          setUsers(uData.items)
        }

        const cRes = await get<any>('/broadcast/crm-customers')
        const cData = cRes?.data ? cRes.data : cRes
        if (Array.isArray(cData)) {
          setCrmCustomers(cData)
        }
      } catch (err) {
        console.error('初始化移动端基础数据失败', err)
      }
    }
    initData()
  }, [])

  // 监听动作类型改变加载 CRM 潜力库项目
  const handleActionTypeChange = async (val: string) => {
    setActionType(val)
    setSelectedProject(null)
    setProjectSearch('')
    setCustomerSearch('')
    setDeliveryAllocations([])
    setMarketingAllocations([])
    setAttachmentUrls([])

    setFormData({
      crmOpportunityId: '',
      customerName: '',
      amount: 0.0,
      budgetMoney: 0.0,
      expectMoney: 0.0,
      happinessScore: 20,
      actionDescription: '',
      content: ''
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

    const prefix = '攻坚一百天，亮剑破六千！今日确定'
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
  const updateHappinessContent = (score: number, desc: string, customer: string) => {
    const prefix = '攻坚一百天，亮剑破六千！今日'
    const generated = `${prefix}${user?.name || 'XX'}做到客户幸福标准${score}分${desc || 'XX'}动作，收到客户${customer || 'XXX'}正反馈，为客户幸福而奋斗，赢战百日！`
    setFormData(prev => ({ ...prev, content: generated }))
  }

  // 铁三角联动文本生成
  const updateTriangleContent = (customer: string) => {
    const prefix = '攻坚一百天，亮剑破六千！今日'
    const generated = `${prefix}售前铁三角现场联动，客户分别为${customer || 'XX'}，为客户幸福而奋斗，赢战百日！`
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

    // 校验分摊和
    if (actionType === 'contract') {
      if (deliveryAllocations.length > 0) {
        const dSum = deliveryAllocations.reduce((s, i) => s + (Number(i.ratio) || 0), 0)
        if (Math.abs(dSum - 100) > 0.1) {
          Toast.show({ icon: 'fail', content: `交付分摊比例之和必须为 100% (当前为 ${dSum}%)` })
          return
        }
        if (deliveryAllocations.some(i => !i.user_id)) {
          Toast.show({ icon: 'fail', content: '交付分摊存在未选择员工的记录' })
          return
        }
      }
      if (marketingAllocations.length > 0) {
        const mSum = marketingAllocations.reduce((s, i) => s + (Number(i.ratio) || 0), 0)
        if (Math.abs(mSum - 100) > 0.1) {
          Toast.show({ icon: 'fail', content: `营销分摊比例之和必须为 100% (当前为 ${mSum}%)` })
          return
        }
        if (marketingAllocations.some(i => !i.user_id)) {
          Toast.show({ icon: 'fail', content: '营销分摊存在未选择员工的记录' })
          return
        }
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
        action_description: actionType === 'happiness' ? formData.actionDescription : null,
        delivery_allocations: actionType === 'contract' ? deliveryAllocations : null,
        marketing_allocations: actionType === 'contract' ? marketingAllocations : null,
        attachment_urls: attachmentUrls.length > 0 ? attachmentUrls : null
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

  // 客户名称过滤
  const filteredCustomers = crmCustomers.filter(c =>
    c.toLowerCase().includes(customerSearch.toLowerCase())
  )

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
              <span style={{ fontSize: 14, fontWeight: 'bold', color: '#1677ff' }}>
                🔗 关联 CRM 潜力库项目 (当前进度: {actionType === 'lead_25' ? '25%' : actionType === 'lead_75' ? '75%' : '90%'})
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
              <Form.Item label="业主单位/客户名称" required>
                <Input value={formData.customerName} readOnly placeholder="选择项目后自动回填" style={{ fontSize: 13 }} />
              </Form.Item>

              {/* 金额输入 (线索和中标允许改金额，合同也允许改) */}
              <Form.Item label="预计合同价格 / 预计金额 (万元)" required>
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
                    <label style={{ width: 80, height: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#fafafa', border: '1px dashed #ccc', borderRadius: 6, cursor: 'pointer' }}>
                      <AddOutline style={{ fontSize: 24, color: '#999' }} />
                      <span style={{ fontSize: 10, color: '#999', marginTop: 4 }}>上传照片</span>
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                    </label>
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

            <div style={{ fontSize: 13, color: '#999', marginBottom: 12 }}>
              请搜索并选择本次铁三角现场共同拜访的客户单位名称：
            </div>

            {/* 客户搜索 */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#f0f0f0', borderRadius: 8, padding: '6px 12px', marginBottom: 12 }}>
              <SearchOutline style={{ color: '#999', marginRight: 6 }} />
              <Input
                placeholder="搜索选择 CRM 客户名称..."
                value={customerSearch}
                onChange={(val) => {
                  setCustomerSearch(val)
                  setFormData(prev => ({ ...prev, customerName: val }))
                  updateTriangleContent(val)
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
                      updateTriangleContent(cust)
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
              <Form.Item label="选定的客户名称" required>
                <Input value={formData.customerName} readOnly placeholder="请输入或在上方搜索选中" style={{ fontSize: 13 }} />
              </Form.Item>
            </Form>
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
                  updateHappinessContent(prev => prev.happinessScore, prev => prev.actionDescription, val)
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
              <Form.Item label="选定的客户名称" required>
                <Input value={formData.customerName} readOnly placeholder="在上方搜索或键入选择" style={{ fontSize: 13 }} />
              </Form.Item>

              <Form.Item label="客户幸福动作标准分值" required>
                <Stepper
                  min={0}
                  max={100}
                  value={formData.happinessScore}
                  onChange={(val) => {
                    setFormData(prev => ({ ...prev, happinessScore: val ?? 20 }))
                    updateHappinessContent(val ?? 20, formData.actionDescription, formData.customerName)
                  }}
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item label="具体动作描述" required>
                <TextArea
                  placeholder="请输入关怀客户幸福动作的具体叙述（必填，如给客户修投影仪等）..."
                  rows={2}
                  value={formData.actionDescription}
                  onChange={(val) => {
                    setFormData(prev => ({ ...prev, actionDescription: val }))
                    updateHappinessContent(formData.happinessScore, val, formData.customerName)
                  }}
                  style={{ fontSize: 13 }}
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
                  <label style={{ width: 80, height: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#fafafa', border: '1px dashed #ccc', borderRadius: 6, cursor: 'pointer' }}>
                    <AddOutline style={{ fontSize: 24, color: '#999' }} />
                    <span style={{ fontSize: 10, color: '#999', marginTop: 4 }}>上传证明</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  </label>
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
            <List>
              {users.map(u => (
                <List.Item
                  key={u.id}
                  clickable
                  onClick={() => handleAddAllocMember(u.id)}
                >
                  <span style={{ fontSize: 13 }}>{u.name} ({u.role === 'admin' ? '管理员' : u.role === 'team_leader' ? '战队长' : '开发员工'})</span>
                </List.Item>
              ))}
            </List>
          </div>
        }
        onClose={() => setAllocUserModalVisible(false)}
        closeOnMaskClick
        actions={[{ key: 'close', text: '取消' }]}
      />
    </div>
  )
}
