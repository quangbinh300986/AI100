import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Row,
  Col,
  Input,
  Button,
  Tag,
  Switch,
  List,
  Modal,
  Form,
  Select,
  Collapse,
  Space,
  Empty,
  Tooltip,
  Divider,
  Checkbox,
  message,
  theme
} from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  SyncOutlined,
  LinkOutlined,
  CheckOutlined,
  CloseOutlined,
  SettingOutlined,
  CopyOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CompassOutlined,
  SmileOutlined,
  ToolOutlined,
  SafetyOutlined,
  ExclamationCircleOutlined,
  GlobalOutlined
} from '@ant-design/icons'
import { get, post, put, del } from '@shared/api/client'

// 提供商厂商结构体
interface LlmProvider {
  id: string
  name: string
  type: string
  base_url: string
  api_key: string
  enabled: boolean
  is_custom: boolean
  sort_order: number
  website_official: string
  website_api_key: string
  website_docs: string
  website_models: string
}

// 大模型结构体
interface LlmModel {
  id: string
  provider_id: string
  model_id: string
  name: string
  group_name: string | null
  enabled: boolean
  capabilities: string[]
}

const LlmSettings: React.FC = () => {
  const { token } = theme.useToken()

  // ==================== 状态定义 ====================
  const [providers, setProviders] = useState<LlmProvider[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string>('deepseek')
  const [models, setModels] = useState<LlmModel[]>([])
  
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [checking, setChecking] = useState(false)
  
  // 搜索关键字
  const [searchText, setSearchText] = useState('')
  const [modelSearchText, setModelSearchText] = useState('')

  // 输入框的本地状态缓冲，防止每次输入都触发 blur 保存
  const [localApiKey, setLocalApiKey] = useState('')
  const [localBaseUrl, setLocalBaseUrl] = useState('')

  // 弹窗状态
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [showAddModel, setShowAddModel] = useState(false)
  const [showEditModel, setShowEditModel] = useState(false)
  const [showManageModels, setShowManageModels] = useState(false)
  const [showKeyManager, setShowKeyManager] = useState(false)
  const [showTestModelDialog, setShowTestModelDialog] = useState(false)

  // 表单状态
  const [addProviderForm] = Form.useForm()
  const [addModelForm] = Form.useForm()
  const [editModelForm] = Form.useForm()
  const [editingModel, setEditingModel] = useState<LlmModel | null>(null)
  
  // 测试与密钥结果
  const [testTargetModel, setTestTargetModel] = useState('')
  const [keyTestResults, setKeyTestResults] = useState<Record<string, { success: boolean; msg: string }>>({})
  const [checkStatus, setCheckStatus] = useState<string>('')

  // 远程模型拉取状态
  const [fetchingRemote, setFetchingRemote] = useState(false)
  const [remoteModels, setRemoteModels] = useState<{ id: string; caps: string[] }[]>([])
  const [remoteSearchText, setRemoteSearchText] = useState('')
  const [remoteTab, setRemoteTab] = useState<string>('all')

  // 折叠面板展开的分组列表
  const [activeGroups, setActiveGroups] = useState<string[]>([])

  // ==================== 初始化加载数据 ====================
  const fetchProviders = async (selectId?: string) => {
    setLoadingProviders(true)
    try {
      const res = await get<LlmProvider[]>('/llm/providers')
      if (res && Array.isArray(res)) {
        setProviders(res)
        if (res.length > 0) {
          // 如果传入了 selectId 且在列表中，则选中它，否则选中当前的，或者默认第一个
          const targetId = selectId || selectedProviderId
          const hasTarget = res.some(p => p.id === targetId)
          const finalId = hasTarget ? targetId : res[0].id
          setSelectedProviderId(finalId)
        }
      }
    } catch (err) {
      message.error('加载大模型厂商列表失败')
    } finally {
      setLoadingProviders(false)
    }
  }

  const fetchModels = async (providerId: string) => {
    setLoadingModels(true)
    try {
      const res = await get<LlmModel[]>(`/llm/models/${providerId}`)
      if (res && Array.isArray(res)) {
        setModels(res)
        // 自动展开所有分组
        const groups = Array.from(new Set(res.map(m => m.group_name || '默认分组')))
        setActiveGroups(groups)
      }
    } catch (err) {
      message.error('加载模型列表失败')
    } finally {
      setLoadingModels(false)
    }
  }

  useEffect(() => {
    fetchProviders()
  }, [])

  useEffect(() => {
    if (selectedProviderId) {
      fetchModels(selectedProviderId)
      const current = providers.find(p => p.id === selectedProviderId)
      if (current) {
        setLocalApiKey(current.api_key || '')
        setLocalBaseUrl(current.base_url || '')
        setCheckStatus('')
      }
    }
  }, [selectedProviderId, providers])

  // ==================== 计算属性 ====================
  const currentProvider = useMemo(() => {
    return providers.find(p => p.id === selectedProviderId)
  }, [providers, selectedProviderId])

  const filteredProviders = useMemo(() => {
    if (!searchText) return providers
    const kw = searchText.toLowerCase()
    return providers.filter(p => 
      p.name.toLowerCase().includes(kw) || p.id.toLowerCase().includes(kw)
    )
  }, [providers, searchText])

  // 按分组整理的模型数据
  const modelsByGroup = useMemo(() => {
    const groups: Record<string, LlmModel[]> = {}
    const kw = modelSearchText.toLowerCase()
    
    const filtered = models.filter(m => 
      m.name.toLowerCase().includes(kw) || m.model_id.toLowerCase().includes(kw)
    )

    filtered.forEach(m => {
      const groupName = m.group_name || '默认分组'
      if (!groups[groupName]) {
        groups[groupName] = []
      }
      groups[groupName].push(m)
    })
    return groups
  }, [models, modelSearchText])

  const enabledModelCount = useMemo(() => {
    return models.filter(m => m.enabled).length
  }, [models])

  // 获取多密钥列表
  const keyList = useMemo(() => {
    if (!localApiKey) return []
    return localApiKey.split(',').map(k => k.trim()).filter(Boolean)
  }, [localApiKey])

  // 接口预览地址
  const apiPreviewUrl = useMemo(() => {
    if (!localBaseUrl) return '-'
    const base = localBaseUrl.replace(/\/+$/, '')
    const ptype = currentProvider?.type || 'openai'
    if (ptype === 'gemini') return base + '/v1beta/models'
    if (ptype === 'ollama') return base + '/api/tags'
    if (base.endsWith('/v1') || base.includes('/v1/')) return base.replace(/\/$/, '') + '/chat/completions'
    return base + '/v1/chat/completions'
  }, [localBaseUrl, currentProvider])

  // ==================== 厂商操作 ====================
  const handleToggleProvider = async (checked: boolean) => {
    if (!currentProvider) return
    try {
      await put(`/llm/providers/${currentProvider.id}`, { enabled: checked })
      setProviders(prev => prev.map(p => p.id === currentProvider.id ? { ...p, enabled: checked } : p))
      message.success(`${checked ? '已开启' : '已禁用'} 厂商配置`)
    } catch {
      message.error('切换厂商状态失败')
    }
  }

  const handleSaveApiKey = async () => {
    if (!currentProvider || localApiKey === currentProvider.api_key) return
    try {
      await put(`/llm/providers/${currentProvider.id}`, { api_key: localApiKey })
      setProviders(prev => prev.map(p => p.id === currentProvider.id ? { ...p, api_key: localApiKey } : p))
      message.success('API Key 保存成功')
    } catch {
      message.error('API Key 保存失败')
    }
  }

  const handleSaveBaseUrl = async () => {
    if (!currentProvider || localBaseUrl === currentProvider.base_url) return
    try {
      await put(`/llm/providers/${currentProvider.id}`, { base_url: localBaseUrl })
      setProviders(prev => prev.map(p => p.id === currentProvider.id ? { ...p, base_url: localBaseUrl } : p))
      message.success('API 地址保存成功')
    } catch {
      message.error('API 地址保存失败')
    }
  }

  // 同步 Cherry Studio 大模型配置
  const handleSyncCherry = async () => {
    setSyncing(true)
    try {
      const res = await post<any>('/llm/sync-from-cherry')
      if (res && res.status === 'success') {
        message.success(`同步完成！新增 ${res.inserted || 0} 个，更新 ${res.updated || 0} 个提供商配置`)
        await fetchProviders()
      } else {
        message.error(res?.detail || '从 Cherry 同步大模型失败')
      }
    } catch {
      message.error('网络请求失败，请稍后再试')
    } finally {
      setSyncing(false)
    }
  }

  // 创建自定义提供商厂商
  const handleAddProviderSubmit = async () => {
    try {
      const values = await addProviderForm.validateFields()
      const res = await post<any>('/llm/providers', values)
      if (res && res.id) {
        message.success('新增自定义厂商成功')
        setShowAddProvider(false)
        addProviderForm.resetFields()
        await fetchProviders(res.id)
      }
    } catch (err: any) {
      message.error(err.response?.data?.detail || '创建厂商失败')
    }
  }

  // ==================== 密钥健康性批量测试 ====================
  const handleOpenTestModelDialog = async () => {
    if (!currentProvider) return
    await handleSaveApiKey()
    await handleSaveBaseUrl()

    if (models.length === 0) {
      message.warning('请先添加该厂商的模型，以便执行接口联通性校验')
      return
    }
    // 默认选取第一个模型
    setTestTargetModel(models[0].model_id)
    setShowTestModelDialog(true)
  }

  const executeModelTest = async () => {
    if (!testTargetModel || !currentProvider) return
    setChecking(true)
    setKeyTestResults({})
    try {
      const keysToTest = keyList.length > 0 ? keyList : ['']
      const res = await post<any>('/llm/check-model-keys', {
        provider_id: currentProvider.id,
        model_id: testTargetModel,
        api_keys: keysToTest
      })
      
      let successCount = 0
      let failedCount = 0
      if (res) {
        const results: Record<string, { success: boolean; msg: string }> = {}
        Object.entries(res).forEach(([k, val]: [string, any]) => {
          results[k] = { success: val.success, msg: val.message }
          if (val.success) successCount++
          else failedCount++
        })
        setKeyTestResults(results)
        
        if (failedCount === 0 && successCount > 0) {
          setCheckStatus('success')
          message.success(`联通性测试完美通过！${successCount} 个 Key 均可用`)
        } else if (successCount > 0) {
          setCheckStatus('partial')
          message.warning(`健康检测完成: ${successCount} 个正常，${failedCount} 个异常`)
        } else {
          setCheckStatus('failed')
          message.error(`连通失败：全数密钥均返回连接异常！`)
        }
      }
      setShowTestModelDialog(false)
    } catch (err: any) {
      setCheckStatus('failed')
      message.error(err.response?.data?.detail || '接口检测发生网络异常')
    } finally {
      setChecking(false)
    }
  }

  // 多密钥管理辅助方法
  const maskKey = (key: string) => {
    if (key.length <= 8) return '****'
    return key.slice(0, 6) + '****' + key.slice(-4)
  }

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key)
    message.success('已复制密钥到剪切板')
  }

  const handleEditKey = (idx: number, key: string) => {
    Modal.confirm({
      title: '修改密钥 Key',
      content: (
        <Input
          defaultValue={key}
          id="edit-key-input"
          placeholder="请输入新的 API Key"
          style={{ marginTop: 10 }}
        />
      ),
      onOk: async () => {
        const el = document.getElementById('edit-key-input') as HTMLInputElement
        if (el && el.value.trim()) {
          const keys = [...keyList]
          keys[idx] = el.value.trim()
          const newApiKeys = keys.join(',')
          setLocalApiKey(newApiKeys)
          await put(`/llm/providers/${currentProvider?.id}`, { api_key: newApiKeys })
          setProviders(prev => prev.map(p => p.id === currentProvider?.id ? { ...p, api_key: newApiKeys } : p))
          message.success('API Key 已更新')
        }
      }
    })
  }

  const handleRemoveKey = async (idx: number) => {
    const keys = [...keyList]
    keys.splice(idx, 1)
    const newApiKeys = keys.join(',')
    setLocalApiKey(newApiKeys)
    await put(`/llm/providers/${currentProvider?.id}`, { api_key: newApiKeys })
    setProviders(prev => prev.map(p => p.id === currentProvider?.id ? { ...p, api_key: newApiKeys } : p))
    message.success('API Key 已移除')
  }

  const handleAddNewKey = () => {
    Modal.confirm({
      title: '添加新 API 密钥',
      content: (
        <Input
          id="add-key-input"
          placeholder="请输入 API Key"
          style={{ marginTop: 10 }}
        />
      ),
      onOk: async () => {
        const el = document.getElementById('add-key-input') as HTMLInputElement
        if (el && el.value.trim()) {
          const val = el.value.trim()
          const newApiKeys = localApiKey ? localApiKey + ',' + val : val
          setLocalApiKey(newApiKeys)
          await put(`/llm/providers/${currentProvider?.id}`, { api_key: newApiKeys })
          setProviders(prev => prev.map(p => p.id === currentProvider?.id ? { ...p, api_key: newApiKeys } : p))
          message.success('API Key 已添加')
        }
      }
    })
  }

  const handleClearAllKeys = () => {
    Modal.confirm({
      title: '危险操作确认',
      icon: <ExclamationCircleOutlined style={{ color: 'red' }} />,
      content: '确定要清空该厂商下的所有 API 密钥吗？这将导致相关 Agent 路由失效。',
      okText: '确认回收',
      okType: 'danger',
      onOk: async () => {
        setLocalApiKey('')
        await put(`/llm/providers/${currentProvider?.id}`, { api_key: '' })
        setProviders(prev => prev.map(p => p.id === currentProvider?.id ? { ...p, api_key: '' } : p))
        message.success('API Key 已清空')
      }
    })
  }

  // ==================== 模型添加、修改与删除 ====================
  const handleToggleModel = async (modelId: string, checked: boolean) => {
    try {
      await put(`/llm/models/${modelId}`, { enabled: checked })
      setModels(prev => prev.map(m => m.id === modelId ? { ...m, enabled: checked } : m))
      message.success(`${checked ? '已启用' : '已禁用'} 大模型`)
    } catch {
      message.error('切换模型状态失败')
    }
  }

  const handleAddModelSubmit = async () => {
    if (!currentProvider) return
    try {
      const values = await addModelForm.validateFields()
      const res = await post<any>('/llm/models', {
        provider_id: currentProvider.id,
        model_id: values.model_id.trim(),
        name: values.name?.trim() || values.model_id.trim(),
        group_name: values.group_name?.trim() || undefined,
        enabled: true
      })
      if (res) {
        message.success('模型添加成功')
        setShowAddModel(false)
        addModelForm.resetFields()
        await fetchModels(currentProvider.id)
      }
    } catch (err: any) {
      message.error(err.response?.data?.detail || '添加模型失败')
    }
  }

  const handleOpenEditModel = (model: LlmModel) => {
    setEditingModel(model)
    editModelForm.setFieldsValue({
      name: model.name,
      group_name: model.group_name || '',
      capabilities: model.capabilities || []
    })
    setShowEditModel(true)
  }

  const handleSaveEditModel = async () => {
    if (!editingModel || !currentProvider) return
    try {
      const values = await editModelForm.validateFields()
      await put(`/llm/models/${editingModel.id}`, {
        name: values.name,
        group_name: values.group_name || null,
        capabilities: values.capabilities
      })
      message.success('模型配置已保存')
      setShowEditModel(false)
      await fetchModels(currentProvider.id)
    } catch {
      message.error('模型配置保存失败')
    }
  }

  const handleDeleteModel = (model: LlmModel) => {
    Modal.confirm({
      title: '删除模型确认',
      content: `确定要从系统配置中移除大模型 "${model.name}" (${model.model_id}) 吗？`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await del(`/llm/models/${model.id}`)
          message.success('大模型配置已彻底删除')
          if (currentProvider) {
            await fetchModels(currentProvider.id)
          }
        } catch {
          message.error('删除模型失败')
        }
      }
    })
  }

  // ==================== 远程模型拉取与自动注册 ====================
  const handleFetchRemoteModels = async () => {
    if (!currentProvider) return
    setFetchingRemote(true)
    setRemoteModels([])
    try {
      const res = await post<any>(`/llm/providers/${currentProvider.id}/check`, {})
      if (res && res.status === 'success' && Array.isArray(res.models)) {
        // 利用推断得出特征能力
        const items = res.models.map((m_id: string) => {
          // 在前端推断能力
          const caps: string[] = []
          const idLower = m_id.toLowerCase()
          // 仿照后端
          if (/vision|vl|img|image|omni/i.test(idLower)) caps.push('vision')
          if (/deepseek-chat|gpt-|o1|o3|claude|gemini|glm-4|qwen-max|qwen-plus/i.test(idLower)) caps.push('tool')
          if (/think|reasoner|r1|qwq|o1|o3/i.test(idLower)) caps.push('reasoning')
          if (/search|online|web/i.test(idLower)) caps.push('web')
          if (/embed/i.test(idLower)) caps.push('embedding')
          if (/rerank/i.test(idLower)) caps.push('rerank')
          return { id: m_id, caps }
        })
        setRemoteModels(items)
        message.success(`联通成功，共发现 ${res.models.length} 个可用模型`)
      } else {
        message.error(res?.message || '无法获取远程模型列表')
      }
    } catch {
      message.error('拉取模型配置网络请求超时')
    } finally {
      setFetchingRemote(false)
    }
  }

  // 快捷添加或移除远程模型到本地启用表
  const handleAddRemoteModel = async (remoteId: string, caps: string[]) => {
    if (!currentProvider) return
    try {
      // 简单推断分组规则
      const parts = remoteId.split('/')
      let groupName = ''
      if (parts.length >= 2) {
        groupName = parts[0]
      } else {
        const dash = remoteId.split('-')
        if (dash.length >= 2) groupName = dash.slice(0, 2).join('-')
      }

      await post('/llm/models', {
        provider_id: currentProvider.id,
        model_id: remoteId,
        name: remoteId,
        group_name: groupName || undefined,
        enabled: true,
        capabilities: caps
      })
      message.success(`已成功录入并启用模型 ${remoteId}`)
      await fetchModels(currentProvider.id)
    } catch {
      message.error('快捷添加模型失败')
    }
  }

  const handleRemoveRemoteModel = async (remoteId: string) => {
    if (!currentProvider) return
    const fullId = `${currentProvider.id}:${remoteId}`
    try {
      await del(`/llm/models/${fullId}`)
      message.success('已移除该模型')
      await fetchModels(currentProvider.id)
    } catch {
      message.error('移除模型失败')
    }
  }

  // 打开远程管理大模型弹窗
  const handleOpenManageModels = () => {
    setShowManageModels(true)
    handleFetchRemoteModels()
  }

  const filteredRemoteModels = useMemo(() => {
    return remoteModels.filter(m => {
      // 标签过滤
      if (remoteTab !== 'all' && !m.caps.includes(remoteTab)) return false
      // 搜索过滤
      if (remoteSearchText && !m.id.toLowerCase().includes(remoteSearchText.toLowerCase())) return false
      return true
    })
  }, [remoteModels, remoteTab, remoteSearchText])

  const existingModelIds = useMemo(() => {
    return new Set(models.map(m => m.model_id))
  }, [models])

  // ==================== 厂商图标辅助 ====================
  const getProviderIcon = (p: LlmProvider | undefined) => {
    if (!p) return '🤖'
    const id = p.id.toLowerCase()
    if (id.includes('deepseek')) return '🐳'
    if (id.includes('zhipu')) return '⚛️'
    if (id.includes('dashscope') || id.includes('qwen') || id.includes('alibaba')) return '☁️'
    if (id.includes('doubao') || id.includes('bytedance') || id.includes('volc')) return '🌋'
    if (id.includes('silicon')) return '💾'
    if (id.includes('moonshot') || id.includes('kimi')) return '🌙'
    if (id.includes('minimax')) return '🐴'
    if (id.includes('openai')) return '⚙️'
    if (id.includes('gemini') || id.includes('google')) return '♊'
    if (id.includes('anthropic') || id.includes('claude')) return '🍁'
    if (id.includes('ollama')) return '🦙'
    if (id.includes('groq')) return '⚡'
    if (id.includes('openrouter')) return '🔌'
    return '🤖'
  }

  // ==================== UI 渲染 ====================
  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 280px)', overflow: 'hidden' }}>
      
      {/* ====== 左侧：提供商列表 ====== */}
      <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '12px', borderRight: '1px solid #f0f0f0', paddingRight: '20px', height: '100%' }}>
        <Input
          placeholder="搜索模型平台..."
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          allowClear
        />

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {loadingProviders ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <SyncOutlined spin style={{ fontSize: 20, color: token.colorPrimary }} />
            </div>
          ) : filteredProviders.length === 0 ? (
            <Empty description="暂无匹配平台" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            filteredProviders.map(p => {
              const active = p.id === selectedProviderId
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProviderId(p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: active ? '#f0f5ff' : 'transparent',
                    borderLeft: active ? `4px solid ${token.colorPrimary}` : '4px solid transparent',
                    transition: 'all 0.2s',
                  }}
                  className="provider-list-item"
                >
                  <Space size="middle">
                    <span style={{ fontSize: '18px' }}>{getProviderIcon(p)}</span>
                    <span style={{ fontSize: '14px', fontWeight: active ? 'bold' : 'normal', color: active ? token.colorPrimary : '#262626' }}>
                      {p.name}
                    </span>
                  </Space>
                  {p.enabled && <Tag color="success" style={{ margin: 0, borderRadius: '10px' }}>ON</Tag>}
                </div>
              )
            })
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
          <Button icon={<SyncOutlined spin={syncing} />} loading={syncing} onClick={handleSyncCherry} block>
            同步内置提供商
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAddProvider(true)} block>
            新增自定义厂商
          </Button>
        </div>
      </div>

      {/* ====== 右侧：平台详情 ====== */}
      <div style={{ flex: 1, overflowY: 'auto', height: '100%', paddingRight: '4px' }}>
        {currentProvider ? (
          <div>
            {/* 顶栏信息与开关 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>{getProviderIcon(currentProvider)}</span>
                <Title level={3} style={{ margin: 0 }}>{currentProvider.name}</Title>
                {currentProvider.website_official && (
                  <a href={currentProvider.website_official} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center' }}>
                    <Button type="link" icon={<LinkOutlined />} size="small" />
                  </a>
                )}
              </div>
              <Switch
                checked={currentProvider.enabled}
                onChange={handleToggleProvider}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
            </div>

            <Divider style={{ margin: '12px 0 20px 0' }} />

            {/* API Key 设置 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>API 密钥</span>
                <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => setShowKeyManager(true)}>
                  密钥管理
                </Button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input.Password
                  placeholder="请输入 API Key，如有多密钥使用英文逗号分隔"
                  value={localApiKey}
                  onChange={e => setLocalApiKey(e.target.value)}
                  onBlur={handleSaveApiKey}
                  style={{ flex: 1 }}
                />
                <Button 
                  type={checkStatus === 'success' ? 'primary' : 'default'}
                  icon={checkStatus === 'success' ? <CheckOutlined /> : undefined}
                  onClick={handleOpenTestModelDialog}
                  loading={checking}
                >
                  {checkStatus === 'success' ? '通过' : '检 测'}
                </Button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px' }}>
                {currentProvider.website_api_key ? (
                  <a href={currentProvider.website_api_key} target="_blank" rel="noreferrer" style={{ color: token.colorPrimary }}>
                    点击这里获取密钥
                  </a>
                ) : <span />}
                <span style={{ color: '#8c8c8c' }}>多密钥以逗号隔开，负载均衡随机调度</span>
              </div>
            </div>

            {/* API 地址 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>API 地址</div>
              <Input
                placeholder="接口端点端 URL，如 https://api.openai.com/v1"
                value={localBaseUrl}
                onChange={e => setLocalBaseUrl(e.target.value)}
                onBlur={handleSaveBaseUrl}
              />
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#8c8c8c' }}>
                预览: <span style={{ fontFamily: 'monospace' }}>{apiPreviewUrl}</span>
              </div>
            </div>

            {/* 模型列表管理 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    在用模型 <Tag color="blue" style={{ marginLeft: 6, borderRadius: 10 }}>{enabledModelCount}</Tag>
                  </span>
                  <Input
                    placeholder="过滤本地模型..."
                    prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                    value={modelSearchText}
                    onChange={e => setModelSearchText(e.target.value)}
                    size="small"
                    style={{ width: '180px' }}
                    allowClear
                  />
                </div>
                <Space>
                  <Button size="small" icon={<SettingOutlined />} onClick={handleOpenManageModels}>管理</Button>
                  <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setShowAddModel(true)}>添加</Button>
                </Space>
              </div>

              <div style={{ background: '#fafafa', borderRadius: '8px', padding: '12px', border: '1px solid #f0f0f0' }}>
                {loadingModels ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <SyncOutlined spin style={{ fontSize: 24, color: token.colorPrimary }} />
                  </div>
                ) : Object.keys(modelsByGroup).length === 0 ? (
                  <Empty description="平台下暂无已添加的大模型，请点击右上方进行添加或管理获取" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <Collapse
                    activeKey={activeGroups}
                    onChange={keys => setActiveGroups(keys as string[])}
                    ghost
                    style={{ background: 'transparent' }}
                  >
                    {Object.entries(modelsByGroup).map(([group, list]) => (
                      <Collapse.Panel 
                        key={group} 
                        header={
                          <Space>
                            <span style={{ fontWeight: 'bold' }}>{group}</span>
                            <Tag style={{ borderRadius: 10 }}>{list.length}</Tag>
                          </Space>
                        }
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {list.map(model => (
                            <div
                              key={model.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 16px',
                                background: '#fff',
                                border: '1px solid #f0f0f0',
                                borderRadius: '6px',
                                transition: 'all 0.2s'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{model.name}</span>
                                  {/* 能力徽章 */}
                                  <Space size={2}>
                                    {model.capabilities?.includes('vision') && (
                                      <Tooltip title="支持视觉/多模态"><Tag color="green" style={{ padding: '0 4px', fontSize: 10 }}><EyeOutlined /></Tag></Tooltip>
                                    )}
                                    {model.capabilities?.includes('web') && (
                                      <Tooltip title="支持内置联网搜索"><Tag color="blue" style={{ padding: '0 4px', fontSize: 10 }}><CompassOutlined /></Tag></Tooltip>
                                    )}
                                    {model.capabilities?.includes('reasoning') && (
                                      <Tooltip title="支持深度推理/思考"><Tag color="orange" style={{ padding: '0 4px', fontSize: 10 }}><SmileOutlined /></Tag></Tooltip>
                                    )}
                                    {model.capabilities?.includes('tool') && (
                                      <Tooltip title="支持函数/工具调用"><Tag color="purple" style={{ padding: '0 4px', fontSize: 10 }}><ToolOutlined /></Tag></Tooltip>
                                    )}
                                  </Space>
                                </div>
                                <span style={{ color: '#8c8c8c', fontSize: '12px', marginTop: '2px', fontFamily: 'monospace' }}>
                                  {model.model_id}
                                </span>
                              </div>
                              <Space size="middle">
                                <Switch
                                  size="small"
                                  checked={model.enabled}
                                  onChange={checked => handleToggleModel(model.id, checked)}
                                />
                                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenEditModel(model)} />
                                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteModel(model)} />
                              </Space>
                            </div>
                          ))}
                        </div>
                      </Collapse.Panel>
                    ))}
                  </Collapse>
                )}
              </div>
            </div>

            {/* 官网和定价参考 */}
            {(currentProvider.website_docs || currentProvider.website_models) && (
              <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#8c8c8c', background: '#f5f5f5', padding: '10px', borderRadius: '6px' }}>
                查看 {currentProvider.name}{' '}
                {currentProvider.website_docs && (
                  <a href={currentProvider.website_docs} target="_blank" rel="noreferrer" style={{ color: token.colorPrimary }}>
                    官方文档
                  </a>
                )}
                {currentProvider.website_docs && currentProvider.website_models && ' 和 '}
                {currentProvider.website_models && (
                  <a href={currentProvider.website_models} target="_blank" rel="noreferrer" style={{ color: token.colorPrimary }}>
                    大模型定价参考
                  </a>
                )}
                获取更多对接配置说明
              </div>
            )}
          </div>
        ) : (
          <Empty description="请在左侧选择需要编辑配置的大模型厂商" style={{ marginTop: '100px' }} />
        )}
      </div>

      {/* ====== 弹框1：新增自定义厂商 ====== */}
      <Modal
        title="新增自定义平台厂商"
        open={showAddProvider}
        onCancel={() => setShowAddProvider(false)}
        onOk={handleAddProviderSubmit}
        destroyOnHidden
      >
        <Form form={addProviderForm} layout="vertical" initialValues={{ type: 'openai', enabled: true }} style={{ marginTop: '16px' }}>
          <Form.Item label="厂商显示名称" name="name" rules={[{ required: true, message: '请输入厂商名称' }]}>
            <Input placeholder="如: 自建千问转发" />
          </Form.Item>
          <Form.Item label="API 接口协议" name="type" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="openai">OpenAI 兼容协议 (Default)</Select.Option>
              <Select.Option value="gemini">Google Gemini 官方协议</Select.Option>
              <Select.Option value="ollama">Ollama 局域网协议</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="接口 API 地址" name="base_url" rules={[{ required: true, message: '请输入 API 端点基地址' }]}>
            <Input placeholder="https://api.yourproxy.com/v1" />
          </Form.Item>
          <Form.Item label="API 授权密钥 (Key)" name="api_key">
            <Input.Password placeholder="可选。若使用公用中转或 Ollama 则留空" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ====== 弹框2：添加模型 ====== */}
      <Modal
        title="手动添加可用大模型"
        open={showAddModel}
        onCancel={() => setShowAddModel(false)}
        onOk={handleAddModelSubmit}
        destroyOnHidden
      >
        <Form form={addModelForm} layout="vertical" style={{ marginTop: '16px' }}>
          <Form.Item label="原始大模型 ID" name="model_id" rules={[{ required: true, message: '请输入大模型原始 ID' }]}>
            <Input placeholder="如: gpt-4o, deepseek-chat" />
          </Form.Item>
          <Form.Item label="模型显示名称" name="name">
            <Input placeholder="如果不输入，默认同大模型原始 ID" />
          </Form.Item>
          <Form.Item label="模型分组" name="group_name">
            <Input placeholder="可选，如: GPT-4, DeepSeek 等" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ====== 弹框3：编辑模型 (包括特征勾选) ====== */}
      <Modal
        title={`编辑大模型: ${editingModel?.model_id}`}
        open={showEditModel}
        onCancel={() => setShowEditModel(false)}
        onOk={handleSaveEditModel}
        destroyOnHidden
      >
        <Form form={editModelForm} layout="vertical" style={{ marginTop: '16px' }}>
          <Form.Item label="显示名称" name="name" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="所属分组" name="group_name">
            <Input placeholder="如: GPT-4, Llama" />
          </Form.Item>
          <Form.Item label="特征能力标记" name="capabilities">
            <Checkbox.Group style={{ width: '100%' }}>
              <Row>
                <Col span={12} style={{ marginBottom: 8 }}><Checkbox value="vision"><EyeOutlined style={{ marginRight: 6 }} />支持视觉多模态 (Vision)</Checkbox></Col>
                <Col span={12} style={{ marginBottom: 8 }}><Checkbox value="tool"><ToolOutlined style={{ marginRight: 6 }} />支持函数调用 (Tool Use)</Checkbox></Col>
                <Col span={12} style={{ marginBottom: 8 }}><Checkbox value="reasoning"><SmileOutlined style={{ marginRight: 6 }} />支持深度推理思维 (Reasoning)</Checkbox></Col>
                <Col span={12} style={{ marginBottom: 8 }}><Checkbox value="web"><CompassOutlined style={{ marginRight: 6 }} />支持联网搜索 (Web Search)</Checkbox></Col>
                <Col span={12} style={{ marginBottom: 8 }}><Checkbox value="embedding"><SafetyOutlined style={{ marginRight: 6 }} />支持文本向量化 (Embedding)</Checkbox></Col>
                <Col span={12} style={{ marginBottom: 8 }}><Checkbox value="rerank"><GlobalOutlined style={{ marginRight: 6 }} />支持重排排序 (Rerank)</Checkbox></Col>
              </Row>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      {/* ====== 弹框4：管理模型 (拉取远程列表) ====== */}
      <Modal
        title={
          <Space>
            <span>远程模型同步面板</span>
            <Tag color="blue">{currentProvider?.name}</Tag>
          </Space>
        }
        open={showManageModels}
        onCancel={() => setShowManageModels(false)}
        footer={null}
        width={720}
        destroyOnHidden
      >
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input
              placeholder="搜索模型 ID 或显示名"
              value={remoteSearchText}
              onChange={e => setRemoteSearchText(e.target.value)}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              style={{ flex: 1 }}
              allowClear
            />
            <Button
              icon={<SyncOutlined spin={fetchingRemote} />}
              loading={fetchingRemote}
              onClick={handleFetchRemoteModels}
            >
              重新拉取
            </Button>
          </div>

          {/* 选项过滤 */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #f0f0f0', paddingBottom: '8px' }}>
            {[
              { key: 'all', label: '全部' },
              { key: 'reasoning', label: '推理思维' },
              { key: 'vision', label: '视觉多模态' },
              { key: 'web', label: '网页联网' },
              { key: 'tool', label: '工具调用' },
              { key: 'embedding', label: '向量嵌入' },
            ].map(tab => (
              <span
                key={tab.key}
                onClick={() => setRemoteTab(tab.key)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  background: remoteTab === tab.key ? '#f0f5ff' : 'transparent',
                  color: remoteTab === tab.key ? token.colorPrimary : '#595959',
                  fontWeight: remoteTab === tab.key ? 'bold' : 'normal',
                }}
              >
                {tab.label}
              </span>
            ))}
          </div>

          <div style={{ height: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px' }}>
            {fetchingRemote ? (
              <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <SyncOutlined spin style={{ fontSize: 24, color: token.colorPrimary }} />
                <div style={{ marginTop: 10, color: '#8c8c8c' }}>正在握手连通 API 拉取模型列表...</div>
              </div>
            ) : filteredRemoteModels.length === 0 ? (
              <Empty description="未发现符合筛选条件的模型" style={{ marginTop: 60 }} />
            ) : (
              filteredRemoteModels.map(m => {
                const added = existingModelIds.has(m.id)
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: '#fafafa',
                      border: '1px solid #f0f0f0',
                      borderRadius: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>{getProviderIcon(currentProvider)}</span>
                      <span style={{ fontWeight: '500', fontFamily: 'monospace' }}>{m.id}</span>
                      <Space size={2}>
                        {m.caps.includes('vision') && <Tag color="green" style={{ fontSize: 10, padding: '0 4px' }}>视觉</Tag>}
                        {m.caps.includes('tool') && <Tag color="purple" style={{ fontSize: 10, padding: '0 4px' }}>工具</Tag>}
                        {m.caps.includes('reasoning') && <Tag color="orange" style={{ fontSize: 10, padding: '0 4px' }}>推理</Tag>}
                        {m.caps.includes('web') && <Tag color="blue" style={{ fontSize: 10, padding: '0 4px' }}>联网</Tag>}
                        {m.caps.includes('embedding') && <Tag color="cyan" style={{ fontSize: 10, padding: '0 4px' }}>向量</Tag>}
                      </Space>
                    </div>
                    <div>
                      {added ? (
                        <Button
                          size="small"
                          danger
                          icon={<CloseOutlined />}
                          onClick={() => handleRemoveRemoteModel(m.id)}
                        >
                          移除
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => handleAddRemoteModel(m.id, m.caps)}
                        >
                          添加启用
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </Modal>

      {/* ====== 弹框5：多密钥管理 ====== */}
      <Modal
        title={
          <Space>
            <span>API 密钥管理中心</span>
            <Tag color="cyan">{currentProvider?.name}</Tag>
          </Space>
        }
        open={showKeyManager}
        onCancel={() => setShowKeyManager(false)}
        width={580}
        destroyOnHidden
        footer={[
          <Button key="close" type="primary" onClick={() => setShowKeyManager(false)}>关闭</Button>
        ]}
      >
        <div style={{ marginTop: '16px' }}>
          <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', padding: '4px' }}>
            {keyList.length === 0 ? (
              <Empty description="暂无密钥，请点击右下方进行添加" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              keyList.map((key, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    background: '#fafafa',
                    border: '1px solid #f0f0f0',
                    borderRadius: '6px'
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{maskKey(key)}</span>
                  
                  {/* 检测健康结果 */}
                  {keyTestResults[key] && (
                    <div style={{ marginLeft: '12px' }}>
                      {keyTestResults[key].success ? (
                        <Tag color="success"><CheckOutlined /> 正常</Tag>
                      ) : (
                        <Tooltip title={keyTestResults[key].msg}>
                          <Tag color="error" style={{ cursor: 'pointer' }}><CloseOutlined /> 异常</Tag>
                        </Tooltip>
                      )}
                    </div>
                  )}

                  <Space size="middle" style={{ marginLeft: 'auto' }}>
                    <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleCopyKey(key)} />
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditKey(idx, key)} />
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemoveKey(idx)} />
                  </Space>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
            <span style={{ color: '#8c8c8c', fontSize: '12px' }}>多密钥以逗号隔开，轮询调度以分担并发</span>
            <Space>
              <Button danger icon={<DeleteOutlined />} onClick={handleClearAllKeys}>回收全部</Button>
              <Button type="primary" ghost icon={<SyncOutlined spin={checking} />} loading={checking} onClick={handleOpenTestModelDialog}>
                密钥测试
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNewKey}>新增密钥</Button>
            </Space>
          </div>
        </div>
      </Modal>

      {/* ====== 弹框6：选择测试模型 ====== */}
      <Modal
        title="选择检测用的模型"
        open={showTestModelDialog}
        onCancel={() => setShowTestModelDialog(false)}
        onOk={executeModelTest}
        confirmLoading={checking}
        width={380}
        destroyOnHidden
      >
        <div style={{ marginTop: '12px', marginBottom: '24px' }}>
          <div style={{ marginBottom: '8px', color: '#595959' }}>请在当前已启用的模型中，选择一个作为握手对话测试模型：</div>
          <Select
            value={testTargetModel}
            onChange={setTestTargetModel}
            style={{ width: '100%' }}
            placeholder="请选择大模型"
          >
            {models.map(m => (
              <Select.Option key={m.model_id} value={m.model_id}>
                {m.name} ({m.model_id})
              </Select.Option>
            ))}
          </Select>
        </div>
      </Modal>

    </div>
  )
}

// 辅助样式组件
const Title: React.FC<any> = ({ children, level, style }) => {
  const TagName = `h${level}` as any
  return <TagName style={{ margin: 0, fontWeight: 600, ...style }}>{children}</TagName>
}

export default LlmSettings

