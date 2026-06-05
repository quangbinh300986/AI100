import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Row, 
  Col, 
  Checkbox, 
  Button, 
  List, 
  Spin, 
  message, 
  Typography, 
  Divider, 
  Tabs, 
  Table, 
  Input, 
  Select, 
  Modal, 
  Space, 
  Tag, 
  Descriptions 
} from 'antd'
import { SettingOutlined, SafetyCertificateOutlined, SearchOutlined, SyncOutlined } from '@ant-design/icons'
import { get, post } from '@shared/api/client'
import { useAuthStore } from '@shared/stores/authStore'

const { Title, Paragraph, Text } = Typography

// 系统角色映射
const ROLES = [
  { key: 'admin', name: '系统管理员', desc: '超级管理员，拥有全局数据大屏查看、指标录入与后台全模块的管理和系统配置权限' },
  { key: 'target_officer', name: '目标官', desc: '负责录入并导入全战队的保底、奋斗以及每周签约新签目标数据' },
  { key: 'digital_specialist', name: '数字专员', desc: '协助战队和公司进行数字经营的监控、汇总和目标数据协助导入' },
  { key: 'team_leader', name: '战队长', desc: '各战队巴长，负责审核并审批战队成员每日日报，对完成数据负直接责任' },
  { key: 'staff', name: '普通员工', desc: '战队前线拼搏队员，主要使用移动端进行每日进展 and 拜访行动填报' },
  { key: 'marketing_staff', name: '营销人员', desc: '负责营销拓展和线索对接，可通过移动端进行签约数据提报' },
  { key: 'tech_marketing', name: '技术营销', desc: '负责技术方案及铁三角联动，在移动端提交对应的协作跟进数据' }
]

// 细粒度权限菜单与操作按钮控制项
const PERMISSIONS = [
  // 仪表盘
  { key: 'view_dashboard', group: '📊 作战仪表盘', label: '查看作战仪表盘', desc: '允许进入后台经营作战仪表盘页面，查看整体 PK 与实绩大盘' },
  { key: 'drilldown_leads', group: '📊 作战仪表盘', label: '下钻查看 CRM 线索明细', desc: '允许在指标详情弹窗中，点击有效/潜力线索数值以下钻查看具体的 CRM 线索明细列表' },
  
  // 播报管理
  { key: 'view_reports', group: '📢 播报管理', label: '访问实时战报管理页面', desc: '允许进入实时战报管理页面，查看全公司与各战队的战报广播记录' },
  { key: 'approve_report', group: '📢 播报管理', label: '手动创建与编辑战报', desc: '允许手动新建战报（并伴随录入业绩指标）或编辑修改已有战报项目关联' },
  { key: 'reject_report', group: '📢 播报管理', label: '删除与级联清退战报', desc: '允许删除或批量删除战报，此操作将级联清退回滚相关业绩与日报完成额' },

  // 周复盘汇总
  { key: 'view_weekly_reports', group: '📊 周复盘汇总', label: '访问个人周复盘汇总页面', desc: '允许进入小组个人周复盘汇总页面，查看各小组成员的周复盘填报数据（非管理员限本战队）' },
  { key: 'edit_weekly_report', group: '📊 周复盘汇总', label: '编辑他人周复盘数据', desc: '允许编辑或修改他人已提交的周复盘数据' },
  { key: 'delete_weekly_report', group: '📊 周复盘汇总', label: '删除与批量删除周复盘数据', desc: '允许删除或批量删除他人的周复盘汇总数据' },

  // 目标管理
  { key: 'view_goals', group: '🎯 目标导入与管理', label: '访问目标管理页面', desc: '允许进入目标管理模块，查看四大指标的设定 and 周目标分解列表' },
  { key: 'manage_base_targets', group: '🎯 目标导入与管理', label: '设定/修改保底与奋斗目标', desc: '允许直接在线修改和保存各个战队的营销新签与交付新签目标' },
  { key: 'import_weekly_targets', group: '🎯 目标导入与管理', label: '导入周目标 Excel', desc: '允许通过上传分解文件批量覆盖并灌入周度分解目标' },
  { key: 'clear_targets', group: '🎯 目标导入与管理', label: '一键清空目标数据', desc: '允许清空战队周分解目标以进行重新导入' },

  // 系统设置
  { key: 'view_settings', group: '⚙️ 系统设置', label: '访问系统设置页面', desc: '允许进入系统角色权限管理模块，查看本设置面板的勾选关系' },
  { key: 'manage_role_permissions', group: '⚙️ 系统设置', label: '修改并保存角色权限配置', desc: '允许编辑并保存角色的权限映射。警告：拥有该权限的角色可修改所有权限' },
  { key: 'manage_user_roles', group: '⚙️ 系统设置', label: '批量修改用户角色/战队/岗位', desc: '允许在用户管理界面对成员进行批量岗位类别调整、角色重置及一键清除等用户管理操作' }
]

// 系统操作审计日志中文化对照词典
const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  name: '姓名',
  phone: '手机号',
  position: '岗位',
  position_type: '岗位类型',
  role: '系统角色',
  third_class_bar: '三级巴',
  team_id: '战队ID',
  is_active: '是否激活',
  marketing_base_target: '营销保底目标(万)',
  marketing_challenge_target: '营销挑战目标(万)',
  delivery_base_target: '交付保底目标(万)',
  delivery_challenge_target: '交付挑战目标(万)',
  base_target: '保底目标(万/次/个)',
  challenge_target: '挑战目标(万/次/个)',
  goal_type: '指标类型',
  user_id: '员工ID',
  status: '填报状态',
  report_date: '填报日期',
  contract_amount: '合同额(万)',
  contract_count: '合同数(单)',
  leads_count: '线索数',
  happiness_actions: '幸福行动数',
  triangle_count: '铁三角数',
  work_summary: '今日工作总结',
  work_reflection: '今日反思',
  next_day_plan: '明日计划',
  standup_notes: '晨会分享',
  reviewer_id: '审核人ID',
  reviewed_at: '审核时间',
  submitted_at: '提交时间',
  permissions: '系统权限列表',
  password_hash: '密码哈希',
}

// 提取并对比状态差异的辅助函数
const getDiffData = (before: any, after: any, actionType: string) => {
  const diffs: Array<{ key: string; fieldName: string; beforeVal: string; afterVal: string }> = []
  
  const formatVal = (val: any): string => {
    if (val === null || val === undefined) return '-'
    if (typeof val === 'boolean') return val ? '是' : '否'
    if (typeof val === 'object') return JSON.stringify(val, null, 2)
    return String(val)
  }

  // 1. UPDATE 操作：对比所有属性并高亮差异
  if (actionType === 'UPDATE') {
    const b = before && typeof before === 'object' ? before : {}
    const a = after && typeof after === 'object' ? after : {}
    const allKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]))
    
    allKeys.forEach((k) => {
      if (k === 'updated_at' || k === 'created_at') return
      
      const bVal = b[k]
      const aVal = a[k]
      const isChanged = JSON.stringify(bVal) !== JSON.stringify(aVal)
      
      if (isChanged) {
        diffs.push({
          key: k,
          fieldName: FIELD_LABELS[k] || k,
          beforeVal: formatVal(bVal),
          afterVal: formatVal(aVal),
        })
      }
    })
  } 
  // 2. CREATE / IMPORT 操作：展示所有新增字段值
  else if (actionType === 'CREATE' || actionType === 'IMPORT') {
    const a = after && typeof after === 'object' ? after : {}
    Object.keys(a).forEach((k) => {
      if (k === 'updated_at' || k === 'created_at') return
      diffs.push({
        key: k,
        fieldName: FIELD_LABELS[k] || k,
        beforeVal: '-',
        afterVal: formatVal(a[k]),
      })
    })
  } 
  // 3. DELETE 操作：显示所有已删除字段值
  else if (actionType === 'DELETE') {
    const b = before && typeof before === 'object' ? before : {}
    Object.keys(b).forEach((k) => {
      if (k === 'updated_at' || k === 'created_at') return
      diffs.push({
        key: k,
        fieldName: FIELD_LABELS[k] || k,
        beforeVal: formatVal(b[k]),
        afterVal: '-',
      })
    })
  }

  return diffs
}

const Settings: React.FC = () => {
  const { user, updateUser } = useAuthStore()
  
  // Tab 标签切换状态
  const [activeTab, setActiveTab] = useState<string>('permissions')

  // 1. 权限配置状态
  const [selectedRole, setSelectedRole] = useState<string>('admin')
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [permissionsMap, setPermissionsMap] = useState<Record<string, string[]>>({})

  // 2. 操作审计日志状态
  const [logs, setLogs] = useState<any[]>([])
  const [logsTotal, setLogsTotal] = useState<number>(0)
  const [logsPage, setLogsPage] = useState<number>(1)
  const [logsPageSize] = useState<number>(15)
  const [logsLoading, setLogsLoading] = useState<boolean>(false)
  
  // 日志条件筛选
  const [actionFilter, setActionFilter] = useState<string>('')
  const [moduleFilter, setModuleFilter] = useState<string>('')
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  
  // 变更详情弹窗状态
  const [diffModalVisible, setDiffModalVisible] = useState<boolean>(false)
  const [selectedLog, setSelectedLog] = useState<any>(null)

  // 加载所有角色的权限映射配置
  const fetchPermissions = async () => {
    setLoading(true)
    try {
      const res = await get<any>('/users/role-permissions')
      if (res) {
        setPermissionsMap(res)
      }
    } catch (err) {
      message.error('加载系统角色权限配置失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载审计日志列表
  const fetchAuditLogs = async (page = 1, action = actionFilter, module = moduleFilter, keyword = searchKeyword) => {
    setLogsLoading(true)
    try {
      const query = new URLSearchParams()
      query.append('page', page.toString())
      query.append('page_size', logsPageSize.toString())
      if (action) query.append('action_type', action)
      if (module) query.append('target_module', module)
      if (keyword) query.append('keyword', keyword)
      
      const res = await get<any>(`/audit-logs?${query.toString()}`)
      if (res) {
        setLogs(res.items || [])
        setLogsTotal(res.total || 0)
        setLogsPage(page)
      }
    } catch (err) {
      message.error('获取系统操作审计日志失败')
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'permissions') {
      fetchPermissions()
    } else {
      fetchAuditLogs(1)
    }
  }, [activeTab])

  // 某角色下某权限勾选状态切换
  const handlePermissionChange = (permKey: string, checked: boolean) => {
    const currentPerms = permissionsMap[selectedRole] || []
    let newPerms: string[]
    if (checked) {
      newPerms = [...currentPerms, permKey]
    } else {
      newPerms = currentPerms.filter(k => k !== permKey)
    }

    setPermissionsMap({
      ...permissionsMap,
      [selectedRole]: newPerms
    })
  }

  // 保存权限配置
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await post<any>('/users/role-permissions', {
        permissions: permissionsMap
      })
      if (res) {
        message.success('角色权限配置已成功保存并写入数据库！')
        
        // 如果管理员修改了自己当前所属角色的权限，则立刻刷新当前用户的权限列表，以防菜单与路由守卫不同步
        if (user && user.role === selectedRole) {
          const updatedPerms = permissionsMap[selectedRole] || []
          updateUser({
            ...user,
            permissions: updatedPerms
          })
          message.info('当前登录角色的权限已实时重载')
        }
      }
    } catch (err) {
      message.error('保存角色权限配置失败')
    } finally {
      setSaving(false)
    }
  }

  // 审计日志表格列配置
  const logColumns = [
    {
      title: '发生时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: '180px',
      render: (text: string) => {
        if (!text) return '-'
        const d = new Date(text)
        return d.toLocaleString('zh-CN', { hour12: false })
      }
    },
    {
      title: '操作人',
      dataIndex: 'user_name',
      key: 'user_name',
      width: '120px',
      render: (text: string, record: any) => (
        <span>{text || '系统'}{record.user_id ? ` (ID:${record.user_id})` : ''}</span>
      )
    },
    {
      title: '模块',
      dataIndex: 'target_module',
      key: 'target_module',
      width: '110px',
      render: (text: string) => {
        const moduleMap: Record<string, string> = {
          user: '员工用户',
          goal: '指标目标',
          report: '播报管理',
          role_permission: '权限配置',
        }
        return <Tag color="geekblue">{moduleMap[text] || text}</Tag>
      }
    },
    {
      title: '操作类型',
      dataIndex: 'action_type',
      key: 'action_type',
      width: '100px',
      render: (text: string) => {
        const typeMap: Record<string, { label: string; color: string }> = {
          CREATE: { label: '新建', color: 'green' },
          UPDATE: { label: '修改', color: 'blue' },
          DELETE: { label: '删除', color: 'red' },
          IMPORT: { label: '导入', color: 'orange' },
        }
        const match = typeMap[text] || { label: text, color: 'default' }
        return <Tag color={match.color}>{match.label}</Tag>
      }
    },
    {
      title: '操作描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '对象ID',
      dataIndex: 'target_id',
      key: 'target_id',
      width: '100px',
      render: (text: string) => text ? <Tag style={{ fontFamily: 'monospace' }}>{text}</Tag> : '-'
    },
    {
      title: '操作',
      key: 'actions',
      width: '100px',
      render: (text: any, record: any) => (
        <Button 
          type="link" 
          size="small" 
          onClick={() => {
            setSelectedLog(record)
            setDiffModalVisible(true)
          }}
        >
          查看变更
        </Button>
      )
    }
  ]

  // 变更 Diff 对比表格列配置
  const diffColumns = [
    {
      title: '修改字段',
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: '25%',
    },
    {
      title: '修改前数据',
      dataIndex: 'beforeVal',
      key: 'beforeVal',
      width: '37.5%',
      render: (text: string) => {
        const isDelete = selectedLog?.action_type === 'DELETE'
        if (isDelete) {
          return <span style={{ color: '#ff4d4f', fontWeight: 'bold', whiteSpace: 'pre-wrap' }}>{text}</span>
        }
        return <span style={{ color: '#8c8c8c', whiteSpace: 'pre-wrap' }}>{text}</span>
      }
    },
    {
      title: '修改后数据',
      dataIndex: 'afterVal',
      key: 'afterVal',
      width: '37.5%',
      render: (text: string) => {
        const isCreateOrImport = selectedLog?.action_type === 'CREATE' || selectedLog?.action_type === 'IMPORT'
        const isDelete = selectedLog?.action_type === 'DELETE'
        if (isCreateOrImport) {
          return <span style={{ color: '#52c41a', fontWeight: 'bold', whiteSpace: 'pre-wrap' }}>{text}</span>
        }
        if (isDelete) {
          return <span style={{ color: '#bfbfbf', textDecoration: 'line-through', whiteSpace: 'pre-wrap' }}>{text}</span>
        }
        return <span style={{ color: '#1677ff', fontWeight: 'bold', whiteSpace: 'pre-wrap' }}>{text}</span>
      }
    }
  ]

  // 渲染角色权限配置 Tab 的 JSX 结构
  const renderPermissionsTab = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" tip="正在从数据库载入最新角色权限关系..." />
        </div>
      )
    }

    return (
      <Row gutter={24}>
        {/* 左侧角色列表 */}
        <Col xs={24} md={8}>
          <Card title="系统角色列表" bordered={false} bodyStyle={{ padding: 0 }}>
            <List
              dataSource={ROLES}
              renderItem={(item) => {
                const isActive = selectedRole === item.key
                return (
                  <List.Item
                    onClick={() => setSelectedRole(item.key)}
                    style={{
                      padding: '16px 24px',
                      cursor: 'pointer',
                      background: isActive ? '#f0f5ff' : 'transparent',
                      borderLeft: isActive ? '4px solid #1677ff' : '4px solid transparent',
                      transition: 'all 0.3s'
                    }}
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ color: isActive ? '#1677ff' : 'inherit', fontSize: '15px' }}>
                          {item.name}
                        </Text>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {item.key}
                        </Text>
                      </div>
                      <div style={{ marginTop: 6, fontSize: '13px', color: '#8c8c8c', lineHeight: '18px' }}>
                        {item.desc}
                      </div>
                    </div>
                  </List.Item>
                )
              }}
            />
          </Card>
        </Col>

        {/* 右侧权限勾选 */}
        <Col xs={24} md={16}>
          <Card
            title={
              <span>
                🛡️ 正在为{' '}
                <strong style={{ color: '#1677ff' }}>
                  {ROLES.find((r) => r.key === selectedRole)?.name} ({selectedRole})
                </strong>{' '}
                配置菜单及操作按钮权限
              </span>
            }
            bordered={false}
            extra={
              <Button type="primary" onClick={handleSave} loading={saving} icon={<SettingOutlined />}>
                保存并生效
              </Button>
            }
          >
            <div style={{ marginBottom: 16 }}>
              请勾选该角色允许的操作和菜单模块权限：
            </div>
            <Divider style={{ margin: '12px 0' }} />

            {/* 分组渲染细粒度权限 */}
            {['📊 作战仪表盘', '📢 播报管理', '📊 周复盘汇总', '🎯 目标导入与管理', '⚙️ 系统设置'].map((group) => {
              const groupPerms = PERMISSIONS.filter(p => p.group === group)
              return (
                <Card
                  key={group}
                  title={<Text strong style={{ fontSize: '15px' }}>{group}</Text>}
                  style={{ marginBottom: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.03)', borderRadius: '6px' }}
                  bodyStyle={{ padding: '16px' }}
                >
                  <Row gutter={[12, 12]}>
                    {groupPerms.map((perm) => {
                      const currentPerms = permissionsMap[selectedRole] || []
                      const isChecked = currentPerms.includes(perm.key)

                      return (
                        <Col span={24} key={perm.key}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              border: isChecked ? '1px solid #adc6ff' : '1px solid #f0f0f0',
                              background: isChecked ? '#f9faff' : '#ffffff',
                              borderRadius: '6px',
                              padding: '12px 16px',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ flex: 1, paddingRight: 16 }}>
                              <div style={{ fontSize: '14px', fontWeight: 'bold', color: isChecked ? '#1d39c4' : '#262626' }}>
                                {perm.label}
                              </div>
                              <div style={{ marginTop: 4, fontSize: '12px', color: '#8c8c8c' }}>
                                {perm.desc}
                              </div>
                            </div>
                            <div>
                              <Checkbox
                                checked={isChecked}
                                onChange={(e) => handlePermissionChange(perm.key, e.target.checked)}
                              />
                            </div>
                          </div>
                        </Col>
                      )
                    })}
                  </Row>
                </Card>
              )
            })}
          </Card>
        </Col>
      </Row>
    )
  }

  // 渲染操作审计日志 Tab 的 JSX 结构
  const renderAuditLogsTab = () => {
    return (
      <div style={{ padding: '8px 0' }}>
        {/* 检索过滤工具栏 */}
        <Card bordered={false} bodyStyle={{ padding: '16px 20px', background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: '6px' }}>
          <Space size="middle" wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space size="small" wrap>
              <Text strong style={{ marginRight: 8 }}>日志筛选:</Text>
              
              <Input 
                placeholder="搜索操作人姓名..." 
                value={searchKeyword} 
                onChange={e => setSearchKeyword(e.target.value)} 
                onPressEnter={() => fetchAuditLogs(1)}
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                style={{ width: 180 }}
                allowClear
              />
              
              <Select 
                placeholder="选择模块" 
                value={moduleFilter || undefined} 
                onChange={val => {
                  setModuleFilter(val || '');
                  fetchAuditLogs(1, actionFilter, val || '');
                }}
                style={{ width: 130 }}
                allowClear
              >
                <Select.Option value="user">员工用户</Select.Option>
                <Select.Option value="goal">指标目标</Select.Option>
                <Select.Option value="report">播报管理</Select.Option>
                <Select.Option value="role_permission">权限配置</Select.Option>
              </Select>
              
              <Select 
                placeholder="操作类型" 
                value={actionFilter || undefined} 
                onChange={val => {
                  setActionFilter(val || '');
                  fetchAuditLogs(1, val || '', moduleFilter);
                }}
                style={{ width: 130 }}
                allowClear
              >
                <Select.Option value="CREATE">新建 (CREATE)</Select.Option>
                <Select.Option value="UPDATE">修改 (UPDATE)</Select.Option>
                <Select.Option value="DELETE">删除 (DELETE)</Select.Option>
                <Select.Option value="IMPORT">导入 (IMPORT)</Select.Option>
              </Select>
            </Space>

            <Space>
              <Button type="primary" onClick={() => fetchAuditLogs(1)} icon={<SearchOutlined />}>
                查询
              </Button>
              <Button 
                onClick={() => {
                  setSearchKeyword('');
                  setActionFilter('');
                  setModuleFilter('');
                  fetchAuditLogs(1, '', '', '');
                }}
                icon={<SyncOutlined />}
              >
                重置
              </Button>
            </Space>
          </Space>
        </Card>

        {/* 审计日志数据表 */}
        <Table
          columns={logColumns}
          dataSource={logs}
          rowKey="id"
          loading={logsLoading}
          pagination={{
            current: logsPage,
            pageSize: logsPageSize,
            total: logsTotal,
            onChange: (page) => {
              fetchAuditLogs(page);
            },
            showTotal: (total) => `共 ${total} 条操作日志`,
            size: 'default',
            showSizeChanger: false
          }}
          bordered
          style={{ marginTop: 16 }}
        />

        {/* 详细数据对比 Diff 弹窗 */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔍 审计日志详细变更对比</span>
              <Tag color="blue" style={{ margin: 0 }}>日志ID: {selectedLog?.id}</Tag>
            </div>
          }
          open={diffModalVisible}
          onCancel={() => setDiffModalVisible(false)}
          footer={[
            <Button key="close" type="primary" onClick={() => setDiffModalVisible(false)}>
              确认关闭
            </Button>
          ]}
          width={850}
          centered
          destroyOnClose
        >
          {selectedLog && (
            <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '8px' }}>
              <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
                <Descriptions.Item label="操作时间">
                  {new Date(selectedLog.created_at).toLocaleString('zh-CN', { hour12: false })}
                </Descriptions.Item>
                <Descriptions.Item label="操作人">
                  {selectedLog.user_name || '系统'}{selectedLog.user_id ? ` (ID: ${selectedLog.user_id})` : ''}
                </Descriptions.Item>
                <Descriptions.Item label="操作模块">
                  {selectedLog.target_module === 'user' ? '员工用户 (user)' :
                   selectedLog.target_module === 'goal' ? '指标目标 (goal)' :
                   selectedLog.target_module === 'report' ? '播报管理 (report)' :
                   selectedLog.target_module === 'role_permission' ? '权限配置 (role_permission)' : selectedLog.target_module}
                </Descriptions.Item>
                <Descriptions.Item label="操作类型">
                  <Tag color={
                    selectedLog.action_type === 'CREATE' ? 'green' :
                    selectedLog.action_type === 'UPDATE' ? 'blue' :
                    selectedLog.action_type === 'DELETE' ? 'red' : 'orange'
                  }>
                    {selectedLog.action_type}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="动作描述" span={2}>
                  <strong>{selectedLog.description}</strong>
                </Descriptions.Item>
              </Descriptions>

              <Divider orientation="left" style={{ margin: '16px 0 12px 0', fontSize: '14px', color: '#1f1f1f' }}>
                变更详情差异表 (Data Diff)
              </Divider>
              
              {(!selectedLog.before_state && !selectedLog.after_state) ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#8c8c8c', border: '1px dashed #d9d9d9', borderRadius: '4px', background: '#fafafa' }}>
                  无详细变更数据载荷（可能是纯描述型操作，如删除或清空已记录于描述中）
                </div>
              ) : (
                <Table
                  columns={diffColumns}
                  dataSource={getDiffData(selectedLog.before_state, selectedLog.after_state, selectedLog.action_type)}
                  pagination={false}
                  size="small"
                  rowKey="key"
                  bordered
                  style={{ marginBottom: 16 }}
                />
              )}
            </div>
          )}
        </Modal>
      </div>
    )
  }

  // 选项卡配置项
  const tabItems = [
    {
      key: 'permissions',
      label: (
        <span style={{ fontSize: '15px' }}>
          🔐 角色权限配置
        </span>
      ),
      children: renderPermissionsTab()
    },
    {
      key: 'audit_logs',
      label: (
        <span style={{ fontSize: '15px' }}>
          📜 系统操作审计日志
        </span>
      ),
      children: renderAuditLogsTab()
    }
  ]

  return (
    <div style={{ padding: '4px' }}>
      <Card bordered={false} style={{ marginBottom: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <SafetyCertificateOutlined style={{ fontSize: 24, color: '#1677ff', marginRight: 12 }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>系统配置与操作审计日志</Title>
            <Paragraph style={{ margin: 0, color: '#8c8c8c', marginTop: 4 }}>
              配置后台管理端各角色的菜单与按钮细粒度权限，并对系统关键数据的增加、删除、修改、导入操作进行追溯审计。
            </Paragraph>
          </div>
        </div>
      </Card>

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        type="card" 
        items={tabItems}
        style={{ background: '#fff', padding: '20px 24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      />
    </div>
  )
}

export default Settings
