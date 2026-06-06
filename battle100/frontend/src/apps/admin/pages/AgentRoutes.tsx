import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Button,
  Select,
  Empty,
  Spin,
  Alert,
  Space,
  message,
  Modal,
  Form,
  Input
} from 'antd'
import {
  ReloadOutlined,
  SaveOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { get, put } from '@shared/api/client'

// 本地 Agent 路由结构体
interface AgentRoute {
  role: string
  name: string
  description: string
  icon: string
  provider_id: string | null
  model_id: string | null
  agent_name: string | null
  agent_description: string | null
  system_prompt: string | null
  user_prompt: string | null
  default_system_prompt: string | null
  default_user_prompt: string | null
}

// 可选模型扁平结构
interface AvailableModel {
  id: string
  provider_id: string
  model_id: string
  name: string
  group_name: string | null
  capabilities: string[]
  provider_name: string
}

// 分组模型列表类型
interface ModelGroup {
  providerName: string
  providerId: string
  models: {
    value: string // 格式: "provider_id:model_id"
    label: string
  }[]
}

const AgentRoutes: React.FC = () => {
  // ==================== 状态定义 ====================
  const [agents, setAgents] = useState<AgentRoute[]>([])
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([])
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 当前正在配置 Prompt 的 Agent 对象
  const [editingAgent, setEditingAgent] = useState<AgentRoute | null>(null)
  const [form] = Form.useForm()

  // ==================== 数据获取 ====================
  const fetchData = async () => {
    setLoading(true)
    try {
      const [agentsRes, modelsRes] = await Promise.all([
        get<AgentRoute[]>('/llm/agents'),
        get<AvailableModel[]>('/llm/available-models')
      ])

      if (agentsRes && Array.isArray(agentsRes)) {
        // 规格化返回的数据，确保所有属性均有默认值
        setAgents(agentsRes.map(a => ({
          ...a,
          agent_name: a.agent_name || null,
          agent_description: a.agent_description || null,
          system_prompt: a.system_prompt || null,
          user_prompt: a.user_prompt || null,
          default_system_prompt: a.default_system_prompt || null,
          default_user_prompt: a.default_user_prompt || null
        })))
      }

      if (modelsRes && Array.isArray(modelsRes)) {
        setAvailableModels(modelsRes)
      }
    } catch {
      message.error('加载 Agent 路由配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // ==================== 模型下拉按厂商分组 ====================
  const modelOptions = useMemo<ModelGroup[]>(() => {
    const groupsMap: Record<string, ModelGroup> = {}
    
    availableModels.forEach(m => {
      const pId = m.provider_id
      const pName = m.provider_name || pId
      
      if (!groupsMap[pId]) {
        groupsMap[pId] = {
          providerId: pId,
          providerName: pName,
          models: []
        }
      }
      
      groupsMap[pId].models.push({
        value: `${pId}:${m.model_id}`,
        label: `${m.name} (${m.model_id})`
      })
    })

    return Object.values(groupsMap)
  }, [availableModels])

  // ==================== 事件处理 ====================
  
  // 修改绑定的大模型路由
  const handleRouteChange = (role: string, val: string) => {
    setAgents(prev => prev.map(a => {
      if (a.role === role) {
        if (!val) {
          return { ...a, provider_id: null, model_id: null }
        }
        const parts = val.split(':')
        return {
          ...a,
          provider_id: parts[0],
          model_id: parts.slice(1).join(':')
        }
      }
      return a
    }))
  }

  // 打开编辑 Prompt 弹窗
  const openEditModal = (agent: AgentRoute) => {
    setEditingAgent(agent)
    form.setFieldsValue({
      agent_name: agent.agent_name || '',
      agent_description: agent.agent_description || '',
      system_prompt: agent.system_prompt || '',
      user_prompt: agent.user_prompt || ''
    })
  }

  // 暂存编辑的 Prompt
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      if (editingAgent) {
        setAgents(prev => prev.map(a => {
          if (a.role === editingAgent.role) {
            return {
              ...a,
              agent_name: values.agent_name ? values.agent_name.trim() : null,
              agent_description: values.agent_description ? values.agent_description.trim() : null,
              system_prompt: values.system_prompt ? values.system_prompt.trim() : null,
              user_prompt: values.user_prompt ? values.user_prompt.trim() : null
            }
          }
          return a
        }))
        message.success(`已暂存「${editingAgent.name}」的自定义配置，点击顶部“保存并生效”后写入数据库`)
        setEditingAgent(null)
      }
    } catch (errorInfo) {
      console.log('表单校验失败:', errorInfo)
    }
  }

  // 统一提交保存
  const handleSave = async () => {
    const routes = agents
      .filter(a => a.provider_id && a.model_id) // 过滤未分配模型的 Agent
      .map(a => ({
        agent_role: a.role,
        provider_id: a.provider_id,
        model_id: a.model_id,
        agent_name: a.agent_name || null,
        agent_description: a.agent_description || null,
        system_prompt: a.system_prompt || null,
        user_prompt: a.user_prompt || null
      }))

    if (routes.length === 0) {
      message.warning('请至少配置一个 Agent 智能体的模型路由关系')
      return
    }

    setSaving(true)
    try {
      const res = await put<any>('/llm/agents', { routes })
      if (res) {
        message.success(res.message || 'Agent 模型路由与自定义提示词配置保存生效！')
        await fetchData()
      }
    } catch (err: any) {
      message.error(err.response?.data?.detail || '路由配置保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 重置本地路由状态
  const handleReset = () => {
    setAgents(prev => prev.map(a => ({
      ...a,
      provider_id: null,
      model_id: null,
      agent_name: null,
      agent_description: null,
      system_prompt: null,
      user_prompt: null
    })))
    message.info('路由与提示词配置已在本地清空（点击保存并生效后写入数据库）')
  }

  // ==================== UI 渲染 ====================
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 0' }}>
        <Spin size="large" tip="正在从数据库载入最新 Agent 路由与提示词配置方案..." />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '10px 4px' }}>
      
      {/* 顶部警告提示 */}
      <Alert
        message={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThunderboltOutlined style={{ color: '#1677ff' }} />
            <span>为系统各业务 Agent 智能体分配不同的后端驱动模型。计算密集型（提取/清洗）推荐局域网 Ollama 模型，创意协作（撰写/分析）推荐云端大模型。可点击“配置 Prompt”自定义调优其运行提示词。</span>
          </div>
        }
        type="info"
        showIcon={false}
        style={{ marginBottom: '20px', borderRadius: '8px' }}
      />

      {/* 头部操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontWeight: 600, fontSize: '16px' }}>智能体（Agent）模型分配路由</h3>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>全部重置</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存并生效
          </Button>
        </Space>
      </div>

      {/* 智能体卡片列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {agents.length === 0 ? (
          <Empty description="暂无智能体角色" />
        ) : (
          agents.map(agent => {
            const hasCustomPrompt = !!(agent.system_prompt || agent.user_prompt || agent.agent_name || agent.agent_description)
            return (
              <Card
                key={agent.role}
                styles={{ body: { padding: '16px 24px' } }}
                style={{
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  border: '1px solid #f0f0f0',
                  transition: 'all 0.3s'
                }}
                className="agent-route-card"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  
                  {/* 智能体角色信息 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div
                      style={{
                        fontSize: '24px',
                        width: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#f5f5f5',
                        borderRadius: '10px',
                        flexShrink: 0
                      }}
                    >
                      {agent.icon || '🤖'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#262626' }}>
                        {agent.agent_name || agent.name}
                        {agent.agent_name && (
                          <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#8c8c8c', marginLeft: '8px' }}>
                            (原名: {agent.name})
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: '13px', color: '#8c8c8c', marginTop: '2px' }}>
                        {agent.agent_description || agent.description}
                      </span>
                    </div>
                  </div>

                  {/* 绑定模型选择 与 提示词配置 */}
                  <Space>
                    <Select
                      showSearch
                      placeholder="请分配可用的大模型..."
                      style={{ width: '260px' }}
                      value={agent.provider_id && agent.model_id ? `${agent.provider_id}:${agent.model_id}` : undefined}
                      onChange={val => handleRouteChange(agent.role, val)}
                      allowClear
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {modelOptions.map(group => (
                        <Select.OptGroup key={group.providerId} label={group.providerName}>
                          {group.models.map(model => (
                            <Select.Option key={model.value} value={model.value} label={model.label}>
                              {model.label}
                            </Select.Option>
                          ))}
                        </Select.OptGroup>
                      ))}
                    </Select>

                    <Button
                      icon={<SettingOutlined />}
                      onClick={() => openEditModal(agent)}
                      type={hasCustomPrompt ? 'primary' : 'default'}
                      ghost={hasCustomPrompt}
                    >
                      配置 Prompt
                    </Button>
                  </Space>

                </div>

                {/* 卡片底部展示已配置的 Prompt 提示 */}
                {hasCustomPrompt && (
                  <div 
                    style={{ 
                      marginTop: '12px', 
                      paddingTop: '12px', 
                      borderTop: '1px dashed #f0f0f0', 
                      display: 'flex', 
                      gap: '16px', 
                      flexWrap: 'wrap',
                      alignItems: 'center'
                    }}
                  >
                    {agent.agent_name && (
                      <span style={{ fontSize: '12px', color: '#722ed1', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircleOutlined /> 自定义显示名称
                      </span>
                    )}
                    {agent.agent_description && (
                      <span style={{ fontSize: '12px', color: '#fa8c16', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircleOutlined /> 自定义描述介绍
                      </span>
                    )}
                    {agent.system_prompt && (
                      <span style={{ fontSize: '12px', color: '#52c41a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircleOutlined /> 已配置系统提示词 ({agent.system_prompt.length} 字)
                      </span>
                    )}
                    {agent.user_prompt && (
                      <span style={{ fontSize: '12px', color: '#1890ff', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircleOutlined /> 已配置用户模板 ({agent.user_prompt.length} 字)
                      </span>
                    )}
                  </div>
                )}
              </Card>
            )
          })
        )}

        {modelOptions.length === 0 && !loading && (
          <div style={{ marginTop: '20px', textAlign: 'center', padding: '40px', background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: '8px' }}>
            <InfoCircleOutlined style={{ fontSize: '24px', color: '#bfbfbf', marginBottom: '10px' }} />
            <div>未发现可分配的 AI 模型。请先去 <strong style={{ color: '#1677ff' }}>"LLM 模型配置"</strong> 中启用厂商并拉取或添加大模型。</div>
          </div>
        )}
      </div>

      {/* 智能体 Prompt 自定义配置弹窗 */}
      <Modal
        title={`配置「${editingAgent?.name || ''}」自定义参数`}
        open={editingAgent !== null}
        onOk={handleModalOk}
        onCancel={() => setEditingAgent(null)}
        width={650}
        okText="暂存配置"
        cancelText="取消"
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: '16px' }}
        >
          <Form.Item
            name="agent_name"
            label="自定义智能体显示名称"
            extra="自定义在系统页面中展示的智能体名称，不填则默认使用内置名称"
          >
            <Input placeholder={`默认: ${editingAgent?.name || ''}`} maxLength={50} />
          </Form.Item>

          <Form.Item
            name="agent_description"
            label="自定义职责描述"
            extra="不填则显示系统默认的职责介绍说明"
          >
            <Input.TextArea placeholder={`默认: ${editingAgent?.description || ''}`} rows={2} maxLength={200} />
          </Form.Item>

          <Form.Item
            name="system_prompt"
            label="自定义系统提示词 (System Prompt)"
            extra="定义智能体的专业身份、背景逻辑和输出约束（不填则默认使用系统置入提示词模板）"
          >
            <Input.TextArea 
              placeholder={editingAgent?.default_system_prompt || "请输入大模型系统提示词..."} 
              rows={6} 
              showCount
            />
          </Form.Item>

          <Form.Item
            name="user_prompt"
            label="自定义用户提示词/模板 (User Prompt)"
            extra="定义大模型接收的用户内容结构，支持将具体战绩内容拼接入模板（不填则默认使用系统置入模板）"
          >
            <Input.TextArea 
              placeholder={editingAgent?.default_user_prompt || "请输入自定义用户提示词/模板..."} 
              rows={4} 
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  )
}

export default AgentRoutes
