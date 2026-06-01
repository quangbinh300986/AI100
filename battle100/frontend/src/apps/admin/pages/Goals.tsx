import React, { useEffect, useState, useCallback } from 'react'
import {
  Upload,
  Button,
  Table,
  Select,
  Tag,
  Space,
  Divider,
  Card,
  message,
  Row,
  Col,
  Typography,
  Modal,
  Input,
  Form,
  Tabs,
  DatePicker,
  InputNumber
} from 'antd'
import {
  UploadOutlined,
  FileExcelOutlined,
  SyncOutlined,
  DeleteOutlined,
  TeamOutlined,
  ExclamationCircleFilled,
  SearchOutlined,
  UserOutlined,
  TagsOutlined,
  PlusOutlined,
  EditOutlined,
  CalendarOutlined
} from '@ant-design/icons'
import { get, put, post, del } from '@shared/api/client'
import dayjs from 'dayjs'
import { useAuthStore } from '@shared/stores/authStore'

const { Title, Paragraph } = Typography
const { TabPane } = Tabs

interface UserItem {
  id: number
  name: string
  phone: string
  position?: string
  position_type?: string
  third_class_bar?: string
  role: string
  team_id?: number
  team_name?: string
  is_active: boolean
}

interface PersonalGoalItem {
  id: number
  user_id: number
  user_name: string
  user_phone: string
  team_name: string
  goal_type: string
  base_target: number
  challenge_target: number
  unit: string
  period: string
  created_at: string
  updated_at: string
}

interface TeamGoalItem {
  id: number
  team_id: number
  team_name: string
  category: string
  base_target: number
  red_line_target: number
  gap: number
  original_plan: string
  created_at: string
  updated_at: string
}

interface WeeklyTargetItem {
  id: number
  team_id: number
  team_name: string
  week_number: number
  week_start: string
  week_end: string
  marketing_base_target: number
  marketing_challenge_target: number
  delivery_base_target: number
  delivery_challenge_target: number
  marketing_actual: number
  delivery_actual: number
  created_at: string
  updated_at: string
}

interface PivotRow {
  key: string
  team_id: number
  team_name: string
  zone_name: string
  category: 'marketing' | 'delivery'
  total_base: number
  total_challenge: number
  weeks: Record<number, WeeklyTargetItem>
}

/* 岗位类别选项 */
const POSITION_TYPE_OPTIONS = [
  { label: '全部岗位类别', value: '' },
  { label: '后台', value: 'back_office' },
  { label: '中台', value: 'middle_office' },
  { label: '管理岗', value: 'management' },
  { label: '营销岗', value: 'marketing' },
  { label: '技术岗', value: 'technical' },
  { label: '交付岗', value: 'delivery' },
]

/* 角色选项 */
const ROLE_OPTIONS = [
  { label: '全部角色', value: '' },
  { label: '超级管理员', value: 'admin' },
  { label: '目标官', value: 'target_officer' },
  { label: '数字专员', value: 'digital_specialist' },
  { label: '战队长', value: 'team_leader' },
  { label: '营销', value: 'marketing_staff' },
  { label: '技术营销', value: 'tech_marketing' },
  { label: '普通员工', value: 'staff' },
]

/* 战队选项 */
const TEAM_OPTIONS = [
  { label: '全部战队', value: '' },
  { label: '清远战队', value: '1' },
  { label: '广州一战队', value: '2' },
  { label: '广州二战队', value: '3' },
  { label: '广州三战队（大数据）', value: '4' },
  { label: '佛山战队', value: '5' },
  { label: '湛江战队', value: '6' },
  { label: '云浮战队', value: '7' },
  { label: '东莞战队', value: '8' },
  { label: '茂名战队', value: '9' },
  { label: '未分配', value: 'none' },
]

const TEAM_SELECT_OPTIONS = [
  { label: '清远战队', value: 1 },
  { label: '广州一战队', value: 2 },
  { label: '广州二战队', value: 3 },
  { label: '广州三战队（大数据）', value: 4 },
  { label: '佛山战队', value: 5 },
  { label: '湛江战队', value: 6 },
  { label: '云浮战队', value: 7 },
  { label: '东莞战队', value: 8 },
  { label: '茂名战队', value: 9 },
]

/* 战区定义常量 */
const getZoneName = (teamId: number): string => {
  if ([1, 2, 3].includes(teamId)) return '第一战区'
  if ([4, 5, 6].includes(teamId)) return '第二战区'
  if ([7, 8, 9].includes(teamId)) return '第三战区'
  return '未分配战区'
}

/* 个人目标类型映射 */
const GOAL_TYPE_MAP: Record<string, string> = {
  contract_amount: '新签合同额',
  contract_count: '新签合同单数',
  happiness_action: '客户幸福行动',
  triangle_count: '铁三角拜访',
  leads_count: '有效线索数',
  leads_conversion_rate: '线索转化率',
  new_customer_count: '新客户数',
  happiness_story_count: '客户幸福故事数',
}

/* 百日奋战15周的日期区间定义 */
const WEEK_RANGES = [
  { week: 1, range: '6.1-6.7' },
  { week: 2, range: '6.8-6.14' },
  { week: 3, range: '6.15-6.21' },
  { week: 4, range: '6.22-6.28' },
  { week: 5, range: '6.29-7.5' },
  { week: 6, range: '7.6-7.12' },
  { week: 7, range: '7.13-7.19' },
  { week: 8, range: '7.20-7.26' },
  { week: 9, range: '7.27-8.2' },
  { week: 10, range: '8.3-8.9' },
  { week: 11, range: '8.10-8.16' },
  { week: 12, range: '8.17-8.23' },
  { week: 13, range: '8.24-8.30' },
  { week: 14, range: '8.31-9.6' },
  { week: 15, range: '9.7-9.13' },
]

/* 战队与指标行的透视渲染模板 */
const PIVOT_ROWS_TEMPLATE = [
  { team_id: 1, team_name: '清远战队', category: 'marketing' },
  { team_id: 1, team_name: '清远战队', category: 'delivery' },
  { team_id: 2, team_name: '广州一战队', category: 'marketing' },
  { team_id: 2, team_name: '广州一战队', category: 'delivery' },
  { team_id: 3, team_name: '广州二战队', category: 'marketing' },
  { team_id: 3, team_name: '广州二战队', category: 'delivery' },
  { team_id: 4, team_name: '广州三战队（大数据）', category: 'marketing' },
  { team_id: 4, team_name: '广州三战队（大数据）', category: 'delivery' },
  { team_id: 5, team_name: '佛山战队', category: 'marketing' },
  { team_id: 5, team_name: '佛山战队', category: 'delivery' },
  { team_id: 6, team_name: '湛江战队', category: 'marketing' },
  { team_id: 6, team_name: '湛江战队', category: 'delivery' },
  { team_id: 7, team_name: '云浮战队', category: 'marketing' },
  { team_id: 7, team_name: '云浮战队', category: 'delivery' },
  { team_id: 8, team_name: '东莞战队', category: 'marketing' },
  { team_id: 8, team_name: '东莞战队', category: 'delivery' },
  { team_id: 9, team_name: '茂名战队', category: 'marketing' },
  { team_id: 9, team_name: '茂名战队', category: 'delivery' },
]

const PERSONAL_KPI_CONFIG = [
  { key: 'contract_amount', label: '新签/续签合同额', unit: '万元' },
  { key: 'happiness_action', label: '客户幸福动作完成数', unit: '次' },
  { key: 'triangle_count', label: '售前铁三角联动次数', unit: '次' },
  { key: 'leads_count', label: '有效线索数', unit: '条' },
  { key: 'leads_conversion_rate', label: '线索转化率', unit: '%' },
  { key: 'new_customer_count', label: '新客户数', unit: '个' },
  { key: 'happiness_story_count', label: '幸福故事数', unit: '个' },
  { key: 'contract_count', label: '新签合同单数', unit: '个' }
]

interface PersonalPivotRow {
  key: number
  user_id: number
  user_name: string
  user_phone: string
  position?: string
  position_type?: string
  team_name: string
  team_id?: number
  goals: Record<string, { base_target: number; challenge_target: number; id?: number }>
}

const Goals: React.FC = () => {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const isTargetOfficer = user?.role === 'target_officer'
  const isDigitalSpecialist = user?.role === 'digital_specialist'

  // 统一权限判定函数，超级管理员默认拥有所有权限，无 permissions 字段时兜底为 true
  const hasPerm = (p: string) => {
    if (isAdmin) return true
    return user?.permissions?.includes(p) ?? true
  }

  const [activeTab, setActiveTab] = useState(isAdmin ? 'users' : 'personal')

  // 全局共享的所有人员下拉列表（新增个人目标时检索用）
  const [allUsers, setAllUsers] = useState<{ label: string; value: number }[]>([])

  const loadAllUsersForSelect = async () => {
    try {
      const res = await get<any>('/users?page=1&page_size=1000')
      if (res && res.items) {
        setAllUsers(res.items.map((u: any) => ({ label: `${u.name} (${u.phone})`, value: u.id })))
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadAllUsersForSelect()
  }, [])


  // ==========================================
  // 标签页1：员工与目标官配置 状态与方法
  // ==========================================
  const [users, setUsers] = useState<UserItem[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [usersPageSize, setUsersPageSize] = useState(10)
  const [syncing, setSyncing] = useState(false)
  const [selectedUserRowKeys, setSelectedUserRowKeys] = useState<React.Key[]>([])
  
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterPositionType, setFilterPositionType] = useState('')
  const [filterTeamId, setFilterTeamId] = useState('')
  const [filterRole, setFilterRole] = useState('')

  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [editForm] = Form.useForm()

  const [createUserModalVisible, setCreateUserModalVisible] = useState(false)
  const [createForm] = Form.useForm()

  const [assignTeamModalVisible, setAssignTeamModalVisible] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)

  const [assignRoleModalVisible, setAssignRoleModalVisible] = useState(false)
  const [selectedRole, setSelectedRole] = useState('')

  const [assignPosTypeModalVisible, setAssignPosTypeModalVisible] = useState(false)
  const [selectedPosType, setSelectedPosType] = useState('')

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', String(usersPage))
      params.append('page_size', String(usersPageSize))
      if (searchKeyword) params.append('keyword', searchKeyword)
      if (filterPositionType) params.append('position_type', filterPositionType)
      if (filterRole) params.append('role', filterRole)
      if (filterTeamId === 'none') {
        params.append('team_id', '0')
      } else if (filterTeamId) {
        params.append('team_id', filterTeamId)
      }

      const res = await get<any>(`/users?${params.toString()}`)
      if (res && res.items) {
        setUsers(res.items)
        setUsersTotal(res.total || 0)
      }
    } catch (err) {
      console.error(err)
      message.error('加载人员列表失败')
    } finally {
      setUsersLoading(false)
    }
  }, [usersPage, usersPageSize, searchKeyword, filterPositionType, filterTeamId, filterRole])

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers()
    }
  }, [loadUsers, activeTab])

  const handleSyncFromCrm = async () => {
    setSyncing(true)
    try {
      const res = await post<any>('/import-export/users/sync-dingtalk')
      if (res) {
        message.success(res.message || '一键同步钉钉通讯录成功！')
        loadUsers()
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '同步失败，请检查钉钉配置或网络连接')
    } finally {
      setSyncing(false)
    }
  }

  const handleSearch = () => {
    setUsersPage(1)
    loadUsers()
  }

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (val: string) => {
    setter(val)
    setUsersPage(1)
  }

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      const res = await put(`/users/${userId}`, { role: newRole })
      if (res) {
        message.success('角色权限配置已更新')
        loadUsers()
      }
    } catch (err) {
      message.error('修改权限失败')
    }
  }

  const handleDeleteUser = (record: UserItem) => {
    Modal.confirm({
      title: '确认删除该员工?',
      icon: <ExclamationCircleFilled />,
      content: `这将会删除员工【${record.name}】及其所有填报数据。该操作不可撤销。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          await del(`/users/${record.id}`)
          message.success('删除成功')
          loadUsers()
        } catch (err: any) {
          message.error(err?.response?.data?.detail || '删除失败')
        }
      },
    })
  }

  const handleEditClick = (record: UserItem) => {
    setEditingUser(record)
    setEditModalVisible(true)
    editForm.setFieldsValue({
      name: record.name,
      phone: record.phone,
      position: record.position || '',
      position_type: record.position_type || '',
      third_class_bar: record.third_class_bar || '',
      team_id: record.team_id || null,
      role: record.role
    })
  }

  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields()
      if (!editingUser) return
      
      await put(`/users/${editingUser.id}`, {
        name: values.name,
        phone: values.phone,
        position: values.position || null,
        position_type: values.position_type || null,
        third_class_bar: values.third_class_bar || null,
        team_id: values.team_id,
        role: values.role
      })
      
      message.success('员工信息已成功更新')
      setEditModalVisible(false)
      setEditingUser(null)
      loadUsers()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '保存修改失败')
    }
  }

  const handleCreateUserClick = () => {
    setCreateUserModalVisible(true)
    createForm.resetFields()
    createForm.setFieldsValue({
      password: '123456',
      role: 'staff'
    })
  }

  const handleSaveCreateUser = async () => {
    try {
      const values = await createForm.validateFields()
      await post('/users', {
        name: values.name,
        phone: values.phone,
        password: values.password,
        position: values.position || null,
        position_type: values.position_type || null,
        third_class_bar: values.third_class_bar || null,
        team_id: values.team_id || null,
        role: values.role,
        dingtalk_id: values.dingtalk_id || null,
        crm_user_id: values.crm_user_id || null
      })
      message.success('新员工已成功创建')
      setCreateUserModalVisible(false)
      loadUsers()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '创建员工失败')
    }
  }

  const handleBatchDeleteUsers = () => {
    Modal.confirm({
      title: '确认批量删除选中员工?',
      icon: <ExclamationCircleFilled />,
      content: `这将会删除选中的 ${selectedUserRowKeys.length} 个员工。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          await del('/users/batch/delete', { data: { user_ids: selectedUserRowKeys } })
          message.success('批量删除成功')
          setSelectedUserRowKeys([])
          loadUsers()
        } catch (err: any) {
          message.error(err?.response?.data?.detail || '批量删除失败')
        }
      },
    })
  }

  const handleBatchAssignTeam = async () => {
    if (selectedTeamId === null) {
      message.warning('请选择目标战队')
      return
    }
    try {
      await put('/users/batch/team', {
        user_ids: selectedUserRowKeys,
        team_id: selectedTeamId
      })
      message.success('批量分配战队成功')
      setAssignTeamModalVisible(false)
      setSelectedUserRowKeys([])
      loadUsers()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '批量分配失败')
    }
  }

  const handleBatchAssignRole = async () => {
    if (!selectedRole) {
      message.warning('请选择目标系统角色')
      return
    }
    try {
      await put('/users/batch/role', {
        user_ids: selectedUserRowKeys,
        role: selectedRole
      })
      message.success('批量修改角色成功')
      setAssignRoleModalVisible(false)
      setSelectedUserRowKeys([])
      setSelectedRole('')
      loadUsers()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '批量修改角色失败')
    }
  }

  const handleBatchAssignPosType = async () => {
    if (!selectedPosType) {
      message.warning('请选择目标岗位类别')
      return
    }
    try {
      await put('/users/batch/position-type', {
        user_ids: selectedUserRowKeys,
        position_type: selectedPosType
      })
      message.success('批量修改岗位类别成功')
      setAssignPosTypeModalVisible(false)
      setSelectedUserRowKeys([])
      setSelectedPosType('')
      loadUsers()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '批量修改岗位类别失败')
    }
  }

  // ==========================================
  // 标签页2：个人多维奋斗目标 状态与方法
  // ==========================================
  const [personalPivotData, setPersonalPivotData] = useState<PersonalPivotRow[]>([])
  const [personalLoading, setPersonalLoading] = useState(false)
  const [personalTotal, setPersonalTotal] = useState(0)
  const [personalPage, setPersonalPage] = useState(1)
  const [personalPageSize, setPersonalPageSize] = useState(10)
  
  const [personalKeyword, setPersonalKeyword] = useState('')
  const [personalFilterTeam, setPersonalFilterTeam] = useState('')
  const [selectedPersonalRowKeys, setSelectedPersonalRowKeys] = useState<React.Key[]>([])

  const [personalModalVisible, setPersonalModalVisible] = useState(false)
  const [editingPivotPersonal, setEditingPivotPersonal] = useState<PersonalPivotRow | null>(null)
  const [personalForm] = Form.useForm()

  // 个人目标完成情况 Tab 独享状态
  const [personalActualModalVisible, setPersonalActualModalVisible] = useState(false)
  const [editingActualPivotRow, setEditingActualPivotRow] = useState<PersonalPivotRow | null>(null)
  const [personalActualForm] = Form.useForm()

  const pivotPersonalGoals = (rawGoals: any[]): PersonalPivotRow[] => {
    const userMap: Record<number, PersonalPivotRow> = {}
    rawGoals.forEach(g => {
      const uid = g.user_id
      if (!userMap[uid]) {
        userMap[uid] = {
          key: uid,
          user_id: uid,
          user_name: g.user_name,
          user_phone: g.user_phone,
          position: g.position || '—',
          position_type: g.position_type,
          team_name: g.team_name || '未分配',
          team_id: g.team_id,
          goals: {}
        }
      }
      userMap[uid].goals[g.goal_type] = {
        id: g.id,
        base_target: g.base_target,
        challenge_target: g.challenge_target,
        actual_value: g.actual_value,
        system_value: g.system_value,
        actual: g.actual
      }
    })
    return Object.values(userMap)
  }

  const loadPersonalGoals = useCallback(async () => {
    setPersonalLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', '1')
      params.append('page_size', '2000') // 拉取全量记录，在前端做Pivot透视
      if (personalKeyword) params.append('keyword', personalKeyword)
      if (personalFilterTeam) params.append('team_id', personalFilterTeam)

      const res = await get<any>(`/goals/personal/list?${params.toString()}`)
      if (res && res.items) {
        const pivoted = pivotPersonalGoals(res.items)
        setPersonalPivotData(pivoted)
        setPersonalTotal(pivoted.length)
      }
    } catch (err) {
      console.error(err)
      message.error('加载个人奋斗目标失败')
    } finally {
      setPersonalLoading(false)
    }
  }, [personalKeyword, personalFilterTeam])

  useEffect(() => {
    if (activeTab === 'personal' || activeTab === 'personal_actual') {
      loadPersonalGoals()
    }
  }, [loadPersonalGoals, activeTab])

  const handlePersonalSearch = () => {
    setPersonalPage(1)
    loadPersonalGoals()
  }

  const handleDeletePersonalRow = (record: PersonalPivotRow) => {
    Modal.confirm({
      title: '确认清空该员工的所有奋斗目标吗?',
      icon: <ExclamationCircleFilled />,
      content: `这将会清除员工【${record.user_name}】旗下的所有多维度奋斗目标记录。该操作不可撤销。`,
      okText: '确认清空',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          const idsToDelete = Object.values(record.goals).map(g => g.id).filter(Boolean) as number[]
          if (idsToDelete.length > 0) {
            await post('/goals/personal/batch-delete', { ids: idsToDelete })
          }
          message.success('清空个人目标成功')
          loadPersonalGoals()
        } catch (err) {
          message.error('清除个人目标失败')
        }
      },
    })
  }

  const handleEditPersonalClick = (record: PersonalPivotRow) => {
    setEditingPivotPersonal(record)
    setPersonalModalVisible(true)
    
    // 初始化 8 大指标的值
    const formVals: Record<string, number> = {}
    PERSONAL_KPI_CONFIG.forEach(kpi => {
      const goal = record.goals[kpi.key]
      formVals[`${kpi.key}_base`] = goal?.base_target ?? 0
      formVals[`${kpi.key}_challenge`] = goal?.challenge_target ?? 0
    })
    
    // 如果是编辑，user_id 锁定
    personalForm.setFieldsValue({
      user_id: record.user_id,
      ...formVals
    })
  }

  const handleCreatePersonalClick = () => {
    setEditingPivotPersonal(null)
    setPersonalModalVisible(true)
    personalForm.resetFields()
    
    // 初始化表单为 0
    const formVals: Record<string, number> = {}
    PERSONAL_KPI_CONFIG.forEach(kpi => {
      formVals[`${kpi.key}_base`] = 0
      formVals[`${kpi.key}_challenge`] = 0
    })
    personalForm.setFieldsValue(formVals)
  }

  const handleSavePersonal = async () => {
    try {
      const values = await personalForm.validateFields()
      const targetUserId = editingPivotPersonal ? editingPivotPersonal.user_id : values.user_id
      
      if (!targetUserId) {
        message.warning('请选择目标员工')
        return
      }

      const recordsToUpdate: any[] = []
      PERSONAL_KPI_CONFIG.forEach(kpi => {
        const baseVal = values[`${kpi.key}_base`] ?? 0
        const challengeVal = values[`${kpi.key}_challenge`] ?? 0
        
        const hasValue = baseVal !== 0 || challengeVal !== 0
        const existed = editingPivotPersonal && editingPivotPersonal.goals[kpi.key]
        
        if (hasValue || existed) {
          recordsToUpdate.push({
            user_id: targetUserId,
            goal_type: kpi.key,
            base_target: baseVal,
            challenge_target: challengeVal,
            unit: kpi.unit,
            period: '100天'
          })
        }
      })

      if (recordsToUpdate.length === 0) {
        message.warning('请输入至少一项指标目标数值')
        return
      }

      const res = await post<any>('/goals/personal/batch-update-user-goals', recordsToUpdate)
      if (res) {
        message.success('保存个人多维目标成功')
        setPersonalModalVisible(false)
        setEditingPivotPersonal(null)
        loadPersonalGoals()
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '保存个人奋斗目标失败')
    }
  }

  const handleBatchDeletePersonal = () => {
    Modal.confirm({
      title: '确认批量清除选中员工的奋斗目标吗?',
      icon: <ExclamationCircleFilled />,
      content: `这将会清除选中的 ${selectedPersonalRowKeys.length} 个员工旗下的所有奋斗目标记录。该操作不可撤销。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          const idsToDelete: number[] = []
          selectedPersonalRowKeys.forEach(uid => {
            const pRow = personalPivotData.find(x => x.user_id === Number(uid))
            if (pRow) {
              Object.values(pRow.goals).forEach(g => {
                if (g.id) idsToDelete.push(g.id)
              })
            }
          })
          
          if (idsToDelete.length > 0) {
            await post('/goals/personal/batch-delete', { ids: idsToDelete })
          }
          message.success('批量清空个人奋斗目标成功')
          setSelectedPersonalRowKeys([])
          loadPersonalGoals()
        } catch (err) {
          message.error('批量删除失败')
        }
      },
    })
  }

  // ==========================================
  // 个人实际完成值 Tab 交互处理方法
  // ==========================================
  const handleEditPersonalActualClick = (record: PersonalPivotRow) => {
    setEditingActualPivotRow(record)
    setPersonalActualModalVisible(true)
    
    const formVals: Record<string, any> = {}
    PERSONAL_KPI_CONFIG.forEach(kpi => {
      const goal = record.goals[kpi.key]
      formVals[`${kpi.key}_actual`] = goal?.actual_value ?? null
    })
    
    personalActualForm.setFieldsValue({
      user_id: record.user_id,
      ...formVals
    })
  }

  const handleSavePersonalActual = async () => {
    try {
      const values = await personalActualForm.validateFields()
      const targetUserId = editingActualPivotRow ? editingActualPivotRow.user_id : values.user_id
      
      if (!targetUserId) {
        message.warning('请选择目标员工')
        return
      }

      const recordsToUpdate: any[] = []
      PERSONAL_KPI_CONFIG.forEach(kpi => {
        const goal = editingActualPivotRow?.goals[kpi.key]
        
        // 只有当该指标是新签额，或者该用户已分配了该目标的奋斗目标时，我们才允许并去保存它的 actual_value
        if (kpi.key === 'contract_amount' || goal !== undefined) {
          const actualInput = values[`${kpi.key}_actual`]
          
          recordsToUpdate.push({
            user_id: targetUserId,
            goal_type: kpi.key,
            base_target: goal?.base_target ?? 0.0,
            challenge_target: goal?.challenge_target ?? 0.0,
            unit: kpi.unit,
            period: '100天',
            actual_value: actualInput === undefined || actualInput === '' ? null : actualInput
          })
        }
      })

      if (recordsToUpdate.length === 0) {
        message.warning('无可更新的指标数据')
        return
      }

      const res = await post<any>('/goals/personal/batch-update-user-goals', recordsToUpdate)
      if (res) {
        message.success('保存个人实际完成情况成功')
        setPersonalActualModalVisible(false)
        setEditingActualPivotRow(null)
        loadPersonalGoals()
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '保存个人实际完成情况失败')
    }
  }

  const handleClearPersonalActualRow = (record: PersonalPivotRow) => {
    Modal.confirm({
      title: '确认清空该员工的所有手动实际值吗?',
      icon: <ExclamationCircleFilled />,
      content: `这将会清除员工【${record.user_name}】旗下的所有手动修改的实际完成值，使其重新恢复为系统计算。`,
      okText: '确认清空',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          const recordsToUpdate: any[] = []
          PERSONAL_KPI_CONFIG.forEach(kpi => {
            const goal = record.goals[kpi.key]
            if (goal || kpi.key === 'contract_amount') {
              recordsToUpdate.push({
                user_id: record.user_id,
                goal_type: kpi.key,
                base_target: goal?.base_target ?? 0.0,
                challenge_target: goal?.challenge_target ?? 0.0,
                unit: kpi.unit,
                period: '100天',
                actual_value: null
              })
            }
          })
          
          if (recordsToUpdate.length > 0) {
            await post('/goals/personal/batch-update-user-goals', recordsToUpdate)
          }
          message.success('已恢复系统计算实际值')
          loadPersonalGoals()
        } catch (err) {
          message.error('恢复系统计算实际值失败')
        }
      },
    })
  }

  const handleBatchClearPersonalActual = () => {
    Modal.confirm({
      title: '确认批量清空选中员工的所有手动实际值吗?',
      icon: <ExclamationCircleFilled />,
      content: `这将会清空选中的 ${selectedPersonalRowKeys.length} 个员工的所有手动覆盖实绩。`,
      okText: '确认清空',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          const recordsToUpdate: any[] = []
          selectedPersonalRowKeys.forEach(uid => {
            const pRow = personalPivotData.find(x => x.user_id === Number(uid))
            if (pRow) {
              PERSONAL_KPI_CONFIG.forEach(kpi => {
                const goal = pRow.goals[kpi.key]
                if (goal || kpi.key === 'contract_amount') {
                  recordsToUpdate.push({
                    user_id: pRow.user_id,
                    goal_type: kpi.key,
                    base_target: goal?.base_target ?? 0.0,
                    challenge_target: goal?.challenge_target ?? 0.0,
                    unit: kpi.unit,
                    period: '100天',
                    actual_value: null
                  })
                }
              })
            }
          })
          
          if (recordsToUpdate.length > 0) {
            await post('/goals/personal/batch-update-user-goals', recordsToUpdate)
          }
          message.success('批量恢复系统自动计算成功')
          setSelectedPersonalRowKeys([])
          loadPersonalGoals()
        } catch (err) {
          message.error('批量清空失败')
        }
      },
    })
  }

  // 个人奋斗目标/实际完成值 Excel 统一导出方法
  const handleExportPersonal = (exportType: 'goals' | 'actuals') => {
    const token = localStorage.getItem('battle100_token') || ''
    const keyword = personalKeyword || ''
    const teamId = personalFilterTeam || ''
    
    const params = new URLSearchParams()
    params.append('export_type', exportType)
    params.append('token', token)
    if (keyword) params.append('keyword', keyword)
    if (teamId) params.append('team_id', teamId)
    
    window.location.href = `/api/v1/import-export/goals/personal/export?${params.toString()}`
  }




  // ==========================================
  // 标签页3：战队总奋斗目标 状态与方法
  // ==========================================
  const [teamGoals, setTeamGoals] = useState<TeamGoalItem[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamTotal, setTeamTotal] = useState(0)
  const [teamPage, setTeamPage] = useState(1)
  const [teamPageSize, setTeamPageSize] = useState(10)

  const [teamFilterTeam, setTeamFilterTeam] = useState('')
  const [teamFilterCategory, setTeamFilterCategory] = useState('')
  const [selectedTeamRowKeys, setSelectedTeamRowKeys] = useState<React.Key[]>([])

  const [teamGoalModalVisible, setTeamGoalModalVisible] = useState(false)
  const [editingTeamGoal, setEditingTeamGoal] = useState<TeamGoalItem | null>(null)
  const [teamGoalForm] = Form.useForm()

  const loadTeamGoals = useCallback(async () => {
    setTeamLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', String(teamPage))
      params.append('page_size', String(teamPageSize))
      if (teamFilterTeam) params.append('team_id', teamFilterTeam)
      if (teamFilterCategory) params.append('category', teamFilterCategory)

      const res = await get<any>(`/goals/team/list?${params.toString()}`)
      if (res && res.items) {
        setTeamGoals(res.items)
        setTeamTotal(res.total || 0)
      }
    } catch (err) {
      console.error(err)
      message.error('加载战队总目标失败')
    } finally {
      setTeamLoading(false)
    }
  }, [teamPage, teamPageSize, teamFilterTeam, teamFilterCategory])

  useEffect(() => {
    if (activeTab === 'team') {
      loadTeamGoals()
    }
  }, [loadTeamGoals, activeTab])

  const handleDeleteTeamGoal = (record: TeamGoalItem) => {
    Modal.confirm({
      title: '确认删除该条战队目标记录?',
      icon: <ExclamationCircleFilled />,
      content: `这将会删除【${record.team_name}】的 ${record.category === 'marketing' ? '营销' : '交付'} 保底/挑战总目标。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          await del(`/goals/team/${record.id}`)
          message.success('删除成功')
          loadTeamGoals()
        } catch (err) {
          message.error('删除战队目标失败')
        }
      },
    })
  }

  const handleEditTeamGoalClick = (record: TeamGoalItem) => {
    setEditingTeamGoal(record)
    setTeamGoalModalVisible(true)
    teamGoalForm.setFieldsValue({
      team_id: record.team_id,
      category: record.category,
      base_target: record.base_target,
      red_line_target: record.red_line_target,
      gap: record.gap,
      original_plan: record.original_plan
    })
  }

  const handleCreateTeamGoalClick = () => {
    setEditingTeamGoal(null)
    setTeamGoalModalVisible(true)
    teamGoalForm.resetFields()
    teamGoalForm.setFieldsValue({
      base_target: 0,
      red_line_target: 0,
      gap: 0
    })
  }

  const handleSaveTeamGoal = async () => {
    try {
      const values = await teamGoalForm.validateFields()
      const gapVal = Math.max(0, values.red_line_target - values.base_target)

      if (editingTeamGoal) {
        await put(`/goals/team/${editingTeamGoal.id}`, {
          team_id: values.team_id,
          category: values.category,
          base_target: values.base_target,
          red_line_target: values.red_line_target,
          gap: gapVal,
          original_plan: values.original_plan || null
        })
        message.success('修改战队目标成功')
      } else {
        await post('/goals/team/create-direct', {
          team_id: values.team_id,
          category: values.category,
          base_target: values.base_target,
          red_line_target: values.red_line_target,
          gap: gapVal,
          original_plan: values.original_plan || null
        })
        message.success('创建战队目标成功')
      }
      setTeamGoalModalVisible(false)
      setEditingTeamGoal(null)
      loadTeamGoals()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '保存战队目标失败')
    }
  }

  const handleBatchDeleteTeamGoals = () => {
    Modal.confirm({
      title: '确认批量删除选中的战队目标吗?',
      icon: <ExclamationCircleFilled />,
      content: `这将会彻底删除选中的 ${selectedTeamRowKeys.length} 条战队目标。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          await post('/goals/team/batch-delete', { ids: selectedTeamRowKeys })
          message.success('批量删除战队目标成功')
          setSelectedTeamRowKeys([])
          loadTeamGoals()
        } catch (err) {
          message.error('批量删除失败')
        }
      },
    })
  }


  // ==========================================
  // 标签页 4 & 5：周分解目标（透视矩阵表）状态与方法
  // ==========================================
  const [pivotWeeklyData, setPivotWeeklyData] = useState<PivotRow[]>([])
  const [pivotLoading, setPivotLoading] = useState(false)
  const [pivotEditModalVisible, setPivotEditModalVisible] = useState(false)
  const [editingPivotRow, setEditingPivotRow] = useState<PivotRow | null>(null)
  const [pivotEditForm] = Form.useForm()

  const loadPivotWeeklyData = async () => {
    setPivotLoading(true)
    try {
      // 接口获取所有 WeeklyTarget 记录（不分页）
      const res = await get<WeeklyTargetItem[]>('/goals/weekly')
      if (res) {
        // 透视转换
        const pivoted = pivotWeeklyTargets(res)
        setPivotWeeklyData(pivoted)
      }
    } catch (err) {
      console.error(err)
      message.error('加载周度分解奋斗目标数据失败')
    } finally {
      setPivotLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'weekly_base' || activeTab === 'weekly_challenge') {
      loadPivotWeeklyData()
    }
  }, [activeTab])

  const pivotWeeklyTargets = (rawWeekly: WeeklyTargetItem[]): PivotRow[] => {
    const pivoted = PIVOT_ROWS_TEMPLATE.map(row => {
      const weeksData: Record<number, WeeklyTargetItem> = {}
      
      for (let w = 1; w <= 15; w++) {
        const matched = rawWeekly.find(x => x.team_id === row.team_id && x.week_number === w)
        if (matched) {
          weeksData[w] = matched
        } else {
          // 容错兜底
          weeksData[w] = {
            id: -w,
            team_id: row.team_id,
            team_name: row.team_name,
            week_number: w,
            week_start: '',
            week_end: '',
            marketing_base_target: 0,
            marketing_challenge_target: 0,
            delivery_base_target: 0,
            delivery_challenge_target: 0,
            marketing_actual: 0,
            delivery_actual: 0,
            created_at: '',
            updated_at: ''
          }
        }
      }

      let totalBase = 0
      let totalChallenge = 0
      Object.values(weeksData).forEach(w => {
        if (row.category === 'marketing') {
          totalBase += w.marketing_base_target
          totalChallenge += w.marketing_challenge_target
        } else {
          totalBase += w.delivery_base_target
          totalChallenge += w.delivery_challenge_target
        }
      })

      return {
        key: `${row.team_id}_${row.category}`,
        team_id: row.team_id,
        team_name: row.team_name,
        zone_name: getZoneName(row.team_id),
        category: row.category as 'marketing' | 'delivery',
        total_base: Math.round(totalBase * 100) / 100,
        total_challenge: Math.round(totalChallenge * 100) / 100,
        weeks: weeksData
      }
    })

    // 计算中地顾问 (合计行)
    const computeTotalRow = (cat: 'marketing' | 'delivery'): PivotRow => {
      const weeksData: Record<number, WeeklyTargetItem> = {}
      for (let w = 1; w <= 15; w++) {
        let sumMarketingBase = 0
        let sumMarketingChallenge = 0
        let sumDeliveryBase = 0
        let sumDeliveryChallenge = 0

        pivoted.forEach(p => {
          if (p.category === cat) {
            const wData = p.weeks[w]
            sumMarketingBase += wData.marketing_base_target
            sumMarketingChallenge += wData.marketing_challenge_target
            sumDeliveryBase += wData.delivery_base_target
            sumDeliveryChallenge += wData.delivery_challenge_target
          }
        })

        weeksData[w] = {
          id: -w - (cat === 'marketing' ? 100 : 200),
          team_id: 100,
          team_name: '中地顾问',
          week_number: w,
          week_start: '',
          week_end: '',
          marketing_base_target: sumMarketingBase,
          marketing_challenge_target: sumMarketingChallenge,
          delivery_base_target: sumDeliveryBase,
          delivery_challenge_target: sumDeliveryChallenge,
          marketing_actual: 0,
          delivery_actual: 0,
          created_at: '',
          updated_at: ''
        }
      }

      let totalBase = 0
      let totalChallenge = 0
      Object.values(weeksData).forEach(w => {
        if (cat === 'marketing') {
          totalBase += w.marketing_base_target
          totalChallenge += w.marketing_challenge_target
        } else {
          totalBase += w.delivery_base_target
          totalChallenge += w.delivery_challenge_target
        }
      })

      return {
        key: `total_${cat}`,
        team_id: 100,
        team_name: '中地顾问',
        zone_name: '中地顾问',
        category: cat,
        total_base: Math.round(totalBase * 100) / 100,
        total_challenge: Math.round(totalChallenge * 100) / 100,
        weeks: weeksData
      }
    }

    const marketingTotal = computeTotalRow('marketing')
    const deliveryTotal = computeTotalRow('delivery')

    return [...pivoted, marketingTotal, deliveryTotal]
  }

  const handleEditPivotRowClick = (record: PivotRow) => {
    setEditingPivotRow(record)
    setPivotEditModalVisible(true)
    
    // 初始化 15 周的表单值
    const formVals: Record<string, number> = {}
    WEEK_RANGES.forEach(item => {
      const wData = record.weeks[item.week]
      const isChallengeTab = activeTab === 'weekly_challenge'
      
      const val = record.category === 'marketing'
        ? (isChallengeTab ? wData.marketing_challenge_target : wData.marketing_base_target)
        : (isChallengeTab ? wData.delivery_challenge_target : wData.delivery_base_target)
      
      formVals[`week_${item.week}`] = val
    })
    pivotEditForm.setFieldsValue(formVals)
  }

  const handleSavePivotRow = async () => {
    try {
      const values = await pivotEditForm.validateFields()
      if (!editingPivotRow) return

      const recordsToUpdate: any[] = []
      const isChallengeTab = activeTab === 'weekly_challenge'

      WEEK_RANGES.forEach(item => {
        const wData = editingPivotRow.weeks[item.week]
        const newVal = values[`week_${item.week}`] || 0.0

        let m_base = wData.marketing_base_target
        let m_challenge = wData.marketing_challenge_target
        let d_base = wData.delivery_base_target
        let d_challenge = wData.delivery_challenge_target

        if (editingPivotRow.category === 'marketing') {
          if (!isChallengeTab) {
            m_base = newVal
          } else {
            m_challenge = newVal
          }
        } else {
          if (!isChallengeTab) {
            d_base = newVal
          } else {
            d_challenge = newVal
          }
        }

        recordsToUpdate.push({
          id: wData.id,
          marketing_base_target: m_base,
          marketing_challenge_target: m_challenge,
          delivery_base_target: d_base,
          delivery_challenge_target: d_challenge
        })
      })

      // 提交到批量更新 API
      const res = await post<any>('/goals/weekly/batch-update-records', recordsToUpdate)
      if (res) {
        message.success('修改周目标成功，战队总目标额已级联自动重算刷新！')
        setPivotEditModalVisible(false)
        setEditingPivotRow(null)
        loadPivotWeeklyData()
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '保存周分解目标失败')
    }
  }

  const handleClearAllWeekly = async () => {
    Modal.confirm({
      title: '确认一键清空全部周目标吗?',
      icon: <ExclamationCircleFilled />,
      content: '这将会彻底清除所有战队在全部 15 周内的基础及挑战目标。该操作不可撤销，且大屏及战队大盘目标额将同步自动清零重算。',
      okText: '确认清空',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          setPivotLoading(true)
          // 1. 获取全量周分解记录以收集真实 ID
          const res = await get<WeeklyTargetItem[]>('/goals/weekly')
          if (res && res.length > 0) {
            const idsToDelete = res.map(x => x.id).filter(id => id > 0) // 过滤负数兜底 ID
            if (idsToDelete.length > 0) {
              await post('/goals/weekly/batch-delete', { ids: idsToDelete })
            }
          }
          message.success('已成功清空所有周分解目标，战队大盘已自动重算！')
          loadPivotWeeklyData()
        } catch (err) {
          message.error('清空周度目标失败')
        } finally {
          setPivotLoading(false)
        }
      }
    })
  }


  // ==========================================
  // 各标签页 Table 列定义 (Columns)
  // ==========================================

  // Tab 1：员工与目标官配置列定义
  const userColumns = [
    { title: '工号/ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '姓名', dataIndex: 'name', key: 'name', render: (val: string) => <strong>{val}</strong> },
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '岗位', dataIndex: 'position', key: 'position' },
    { title: '三级巴', dataIndex: 'third_class_bar', key: 'third_class_bar', width: 140, render: (val: string) => val || <span style={{ color: '#bfbfbf' }}>-</span> },
    {
      title: '岗位类别',
      dataIndex: 'position_type',
      key: 'position_type',
      width: 100,
      render: (val: string) => {
        if (val === 'back_office') return <Tag color="default" style={{background: '#333', color: '#fff', borderColor: '#333'}}>后台</Tag>
        if (val === 'middle_office') return <Tag color="orange">中台</Tag>
        if (val === 'management') return <Tag color="purple">管理岗</Tag>
        if (val === 'marketing') return <Tag color="red">营销岗</Tag>
        if (val === 'technical') return <Tag color="cyan">技术岗</Tag>
        if (val === 'delivery') return <Tag color="blue">交付岗</Tag>
        return <Tag color="default">{val || '未分类'}</Tag>
      }
    },
    {
      title: '归属战队',
      dataIndex: 'team_name',
      key: 'team_name',
      width: 140,
      render: (val: string) => val || <span style={{ color: '#999' }}>未分配</span>
    },
    {
      title: '系统权限/角色',
      dataIndex: 'role',
      key: 'role',
      width: 150,
      render: (val: string, record: UserItem) => (
        <Select
          value={val}
          style={{ width: 140 }}
          onChange={(newRole) => handleRoleChange(record.id, newRole)}
        >
          <Select.Option value="admin">超级管理员</Select.Option>
          <Select.Option value="target_officer">目标官</Select.Option>
          <Select.Option value="digital_specialist">数字专员</Select.Option>
          <Select.Option value="team_leader">战队长</Select.Option>
          <Select.Option value="marketing_staff">营销</Select.Option>
          <Select.Option value="tech_marketing">技术营销</Select.Option>
          <Select.Option value="staff">普通员工</Select.Option>
        </Select>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      render: (_: any, record: UserItem) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEditClick(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger onClick={() => handleDeleteUser(record)}>
            删除
          </Button>
        </Space>
      )
    }
  ]

  // Tab 2：个人目标列定义 (透视矩阵多级表头大表)
  const personalColumns = [
    { 
      title: '基本信息',
      fixed: 'left' as const,
      children: [
        { title: '姓名', dataIndex: 'user_name', key: 'user_name', width: 95, fixed: 'left' as const, render: (val: string) => <strong>{val}</strong> },
        { title: '岗位', dataIndex: 'position', key: 'position', width: 120, fixed: 'left' as const },
        { title: '手机号', dataIndex: 'user_phone', key: 'user_phone', width: 125, fixed: 'left' as const },
        { 
          title: '战区', 
          key: 'zone_name', 
          width: 100, 
          fixed: 'left' as const, 
          render: (_: any, record: PersonalPivotRow) => {
            const tId = record.team_id;
            if (!tId) return <span style={{ color: '#999' }}>未分配战区</span>;
            
            const zoneName = getZoneName(tId);
            let tagColor = 'default';
            if (zoneName === '第一战区') tagColor = 'blue';
            if (zoneName === '第二战区') tagColor = 'purple';
            if (zoneName === '第三战区') tagColor = 'magenta';
            
            return <Tag color={tagColor}>{zoneName}</Tag>;
          } 
        },
        { title: '归属战队', dataIndex: 'team_name', key: 'team_name', width: 125, fixed: 'left' as const }
      ]
    },
    ...PERSONAL_KPI_CONFIG.map(kpi => {
      // 这里的指标表头配色，根据不同指标渲染特定的视觉背景，以达到极佳的视觉识别度，与用户的Excel风格呼应且更具现代化质感
      let headerBg = '#fafafa'
      let titleColor = 'rgba(0, 0, 0, 0.85)'
      if (kpi.key === 'contract_amount') {
        headerBg = '#e6f7ff' // 淡青蓝
        titleColor = '#096dd9'
      } else if (kpi.key === 'happiness_action') {
        headerBg = '#feffe6' // 淡金黄
        titleColor = '#ad8b00'
      } else if (kpi.key === 'triangle_count') {
        headerBg = '#f6ffed' // 淡绿色
        titleColor = '#389e0d'
      } else if (kpi.key === 'leads_count') {
        headerBg = '#fff2e8' // 淡红橙
        titleColor = '#d4380d'
      } else if (kpi.key === 'leads_conversion_rate') {
        headerBg = '#f9f0ff' // 淡紫色
        titleColor = '#531dab'
      } else if (kpi.key === 'new_customer_count') {
        headerBg = '#fcffe6' // 淡嫩绿
        titleColor = '#5b8c00'
      } else if (kpi.key === 'happiness_story_count') {
        headerBg = '#fff0f6' // 淡樱粉
        titleColor = '#c41d7f'
      } else if (kpi.key === 'contract_count') {
        headerBg = '#e6fffb' // 淡青绿
        titleColor = '#08979c'
      }

      return {
        title: (
          <div style={{ 
            background: headerBg, 
            color: titleColor,
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
        children: [
          {
            title: '基础目标',
            key: `${kpi.key}_base`,
            width: 85,
            render: (_: any, record: PersonalPivotRow) => {
              const goal = record.goals[kpi.key]
              return goal?.base_target !== undefined ? (
                <span style={{ fontWeight: '500' }}>{goal.base_target}</span>
              ) : <span style={{ color: '#ccc' }}>—</span>
            }
          },
          {
            title: '挑战目标',
            key: `${kpi.key}_challenge`,
            width: 85,
            render: (_: any, record: PersonalPivotRow) => {
              const goal = record.goals[kpi.key]
              return goal?.challenge_target !== undefined ? (
                <span style={{ color: '#722ed1', fontWeight: '500' }}>{goal.challenge_target}</span>
              ) : <span style={{ color: '#ccc' }}>—</span>
            }
          }
        ]
      }
    }),
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: PersonalPivotRow) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} disabled={!hasPerm('manage_base_targets')} onClick={() => handleEditPersonalClick(record)}>编辑</Button>
          {(isAdmin || isTargetOfficer) && (
            <Button type="link" size="small" danger disabled={!hasPerm('clear_targets')} onClick={() => handleDeletePersonalRow(record)}>清空</Button>
          )}
        </Space>
      )
    }
  ]

  // Tab 2.5：个人目标实际完成情况列定义
  const personalActualColumns = [
    { 
      title: '基本信息',
      fixed: 'left' as const,
      children: [
        { title: '姓名', dataIndex: 'user_name', key: 'user_name', width: 95, fixed: 'left' as const, render: (val: string) => <strong>{val}</strong> },
        { title: '岗位', dataIndex: 'position', key: 'position', width: 120, fixed: 'left' as const },
        { title: '手机号', dataIndex: 'user_phone', key: 'user_phone', width: 125, fixed: 'left' as const },
        { 
          title: '战区', 
          key: 'zone_name', 
          width: 100, 
          fixed: 'left' as const, 
          render: (_: any, record: PersonalPivotRow) => {
            const tId = record.team_id;
            if (!tId) return <span style={{ color: '#999' }}>未分配战区</span>;
            
            const zoneName = getZoneName(tId);
            let tagColor = 'default';
            if (zoneName === '第一战区') tagColor = 'blue';
            if (zoneName === '第二战区') tagColor = 'purple';
            if (zoneName === '第三战区') tagColor = 'magenta';
            
            return <Tag color={tagColor}>{zoneName}</Tag>;
          } 
        },
        { title: '归属战队', dataIndex: 'team_name', key: 'team_name', width: 125, fixed: 'left' as const }
      ]
    },
    ...PERSONAL_KPI_CONFIG.map(kpi => {
      let headerBg = '#fafafa'
      let titleColor = 'rgba(0, 0, 0, 0.85)'
      if (kpi.key === 'contract_amount') {
        headerBg = '#e6f7ff'
        titleColor = '#096dd9'
      } else if (kpi.key === 'happiness_action') {
        headerBg = '#feffe6'
        titleColor = '#ad8b00'
      } else if (kpi.key === 'triangle_count') {
        headerBg = '#f6ffed'
        titleColor = '#389e0d'
      } else if (kpi.key === 'leads_count') {
        headerBg = '#fff2e8'
        titleColor = '#d4380d'
      } else if (kpi.key === 'leads_conversion_rate') {
        headerBg = '#f9f0ff'
        titleColor = '#531dab'
      } else if (kpi.key === 'new_customer_count') {
        headerBg = '#fcffe6'
        titleColor = '#5b8c00'
      } else if (kpi.key === 'happiness_story_count') {
        headerBg = '#fff0f6'
        titleColor = '#c41d7f'
      } else if (kpi.key === 'contract_count') {
        headerBg = '#e6fffb'
        titleColor = '#08979c'
      }

      return {
        title: (
          <div style={{ 
            background: headerBg, 
            color: titleColor,
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
        width: 140,
        align: 'center' as const,
        render: (_: any, record: PersonalPivotRow) => {
          const goal = record.goals[kpi.key]
          // 如果非新签额指标，且用户未配有该目标的奋斗目标，说明不考核，显示置灰的“—”
          if (!goal && kpi.key !== 'contract_amount') {
            return <span style={{ color: '#ccc' }}>—</span>
          }
          
          const val = goal ? goal.actual : 0.0
          const baseTarget = goal ? goal.base_target : 0.0
          const isManual = goal && goal.actual_value !== null && goal.actual_value !== undefined

          const actualNode = isManual ? (
            <span 
              style={{ color: '#2f54eb', fontWeight: 'bold', cursor: 'help' }} 
              title={`已由管理员手动覆盖（系统计算原值: ${goal.system_value ?? 0}）`}
            >
              {val} <span style={{ fontSize: '10px' }}>✍️</span>
            </span>
          ) : (
            <span style={{ fontWeight: '500' }}>{val}</span>
          )

          return (
            <div>
              {actualNode}
              <span style={{ color: '#8c8c8c', marginLeft: 4 }} title="基础目标">/ {baseTarget}</span>
            </div>
          )
        }
      }
    }),
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: PersonalPivotRow) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} disabled={!hasPerm('manage_base_targets')} onClick={() => handleEditPersonalActualClick(record)}>编辑</Button>
          {(isAdmin || isTargetOfficer) && (
            <Button type="link" size="small" danger disabled={!hasPerm('clear_targets')} onClick={() => handleClearPersonalActualRow(record)}>清空</Button>
          )}
        </Space>
      )
    }
  ]

  // Tab 3：战队总目标列定义
  const teamGoalColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: '战队名称', dataIndex: 'team_name', key: 'team_name', render: (val: string) => <strong>{val}</strong> },
    {
      title: '目标类别',
      dataIndex: 'category',
      key: 'category',
      width: 130,
      render: (val: string) => val === 'marketing' ? <Tag color="red">营销新签</Tag> : <Tag color="cyan">交付新签</Tag>
    },
    { title: '基础目标', dataIndex: 'base_target', key: 'base_target', render: (val: number) => <span>{val} 万元</span> },
    { title: '挑战目标', dataIndex: 'red_line_target', key: 'red_line_target', render: (val: number) => <span>{val} 万元</span> },
    { title: '原始拆分计划说明', dataIndex: 'original_plan', key: 'original_plan', render: (val: string) => val || <span style={{ color: '#ccc' }}>无备注</span> },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: TeamGoalItem) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEditTeamGoalClick(record)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => handleDeleteTeamGoal(record)}>删除</Button>
        </Space>
      )
    }
  ]

  // 动态生成周目标的 Table columns
  const getPivotTableColumns = (isChallenge: boolean) => {
    const baseColumns = [
      {
        title: '战区',
        dataIndex: 'zone_name',
        key: 'zone_name',
        width: 100,
        fixed: 'left' as const,
        render: (value: string, record: PivotRow, index: number) => {
          let rowSpan = 0
          if (index === 0 || index === 6 || index === 12) {
            rowSpan = 6
          } else if (index === 18) {
            rowSpan = 2
          }
          return {
            children: <strong style={{ color: index >= 18 ? '#fa8c16' : '#1890ff' }}>{value || ''}</strong>,
            props: {
              rowSpan: rowSpan,
            },
          }
        },
      },
      {
        title: '战队名称',
        dataIndex: 'team_name',
        key: 'team_name',
        width: 150,
        fixed: 'left' as const,
        render: (value: string, record: PivotRow, index: number) => {
          let rowSpan = 0
          if (index % 2 === 0) {
            rowSpan = 2
          }
          return {
            children: <strong style={{ color: index >= 18 ? '#fa8c16' : undefined }}>{value || ''}</strong>,
            props: {
              rowSpan: rowSpan,
            },
          }
        },
      },
      {
        title: '指标类别',
        dataIndex: 'category',
        key: 'category',
        width: 110,
        fixed: 'left' as const,
        render: (val: string, record: PivotRow, index: number) => {
          if (!val) return null
          const isMarketing = val === 'marketing'
          return isMarketing 
            ? <Tag color="red" style={{ fontWeight: 'bold' }}>营销新签</Tag> 
            : <Tag color="cyan" style={{ fontWeight: 'bold' }}>交付新签</Tag>
        }
      },
      {
        title: isChallenge ? '挑战目标总额' : '基础目标总额',
        key: 'total_target',
        width: 130,
        fixed: 'left' as const,
        render: (text: any, record: any, index: number) => {
          const rec = record || text
          if (!rec) return null
          const targetVal = isChallenge ? rec.total_challenge : rec.total_base
          return (
            <strong style={{ color: index >= 18 ? '#d4380d' : (isChallenge ? '#722ed1' : '#52c41a') }}>
              {(targetVal || 0).toFixed(2)} 万元
            </strong>
          )
        }
      }
    ]

    // 15 周对应的列
    const weekColumns = WEEK_RANGES.map(item => ({
      title: (
        <div style={{ textAlign: 'center', fontSize: '11px', lineHeight: '1.2' }}>
          <div style={{ color: '#888', fontWeight: 'normal' }}>{item.range}</div>
          <div style={{ fontWeight: 'bold' }}>第 {item.week} 周</div>
        </div>
      ),
      key: `week_${item.week}`,
      width: 95,
      render: (text: any, record: any, index: number) => {
        const rec = record || text
        if (!rec || !rec.weeks) return null
        const wData = rec.weeks[item.week]
        if (!wData) return <div style={{ textAlign: 'center' }}>0.00 万</div>
        const val = rec.category === 'marketing'
          ? (isChallenge ? wData.marketing_challenge_target : wData.marketing_base_target)
          : (isChallenge ? wData.delivery_challenge_target : wData.delivery_base_target)
        return (
          <div style={{ 
            textAlign: 'center', 
            fontWeight: index >= 18 ? 'bold' : '500',
            color: index >= 18 ? '#d4380d' : undefined
          }}>
            {(val || 0).toFixed(2)} 万
          </div>
        )
      }
    }))

    const actionColumn = {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right' as const,
      render: (text: any, record: any, index: number) => {
        const rec = record || text
        if (!rec) return null
        if (index >= 18) {
          return <span style={{ color: '#999', fontSize: '12px' }}>汇总数据</span>
        }
        return (
          <Button type="link" size="small" icon={<EditOutlined />} disabled={!hasPerm('manage_base_targets')} onClick={() => handleEditPivotRowClick(rec)}>
            编辑
          </Button>
        )
      }
    }

    return [...baseColumns, ...weekColumns, actionColumn]
  }


  // ==========================================
  // 附件导入配置
  // ==========================================
  
  const userUploadProps = {
    name: 'file',
    action: '/api/v1/import-export/users/import',
    headers: { Authorization: `Bearer ${localStorage.getItem('battle100_token') || ''}` },
    onChange(info: any) {
      if (info.file.status === 'done') {
        const response = info.file.response
        if (response?.errors && response.errors.length > 0) {
          Modal.warning({
            title: '人员导入完成，但存在部分异常',
            content: (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <p>成功导入用户，但以下记录存在异常：</p>
                <ul>
                  {response.errors.map((err: string, idx: number) => (
                    <li key={idx} style={{ color: '#fa8c16' }}>{err}</li>
                  ))}
                </ul>
              </div>
            ),
            okText: '知道了'
          })
        } else {
          message.success(`${info.file.name} 员工名单导入成功！共导入 ${response?.imported_count || 0} 个用户。`)
        }
        if (activeTab === 'users') loadUsers()
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 导入失败`)
      }
    },
  }

  const weeklyGoalUploadProps = {
    name: 'file',
    action: '/api/v1/import-export/goals/weekly/import',
    headers: { Authorization: `Bearer ${localStorage.getItem('battle100_token') || ''}` },
    onChange(info: any) {
      if (info.file.status === 'done') {
        const response = info.file.response
        if (response?.errors && response.errors.length > 0) {
          Modal.warning({
            title: '周度目标导入成功，但存在部分警告/错误',
            content: (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <p>大部分数据已同步，以下记录未成功匹配或格式有误：</p>
                <ul>
                  {response.errors.map((err: string, idx: number) => (
                    <li key={idx} style={{ color: '#fa8c16' }}>{err}</li>
                  ))}
                </ul>
              </div>
            ),
            okText: '知道了'
          })
        } else {
          message.success(`${info.file.name} 周度目标数据导入成功！共导入 ${response?.imported_count || 0} 条。`)
        }
        if (activeTab === 'weekly_base' || activeTab === 'weekly_challenge') loadPivotWeeklyData()
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 导入失败`)
      }
    },
  }

  const personalGoalUploadProps = {
    name: 'file',
    action: '/api/v1/import-export/goals/personal/import',
    headers: { Authorization: `Bearer ${localStorage.getItem('battle100_token') || ''}` },
    onChange(info: any) {
      if (info.file.status === 'done') {
        const response = info.file.response
        if (response?.errors && response.errors.length > 0) {
          Modal.warning({
            title: '个人目标导入完成，但存在部分异常',
            content: (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <p>成功导入个人目标。以下异常请排查：</p>
                <ul>
                  {response.errors.map((err: string, idx: number) => (
                    <li key={idx} style={{ color: '#fa8c16' }}>{err}</li>
                  ))}
                </ul>
              </div>
            ),
            okText: '知道了'
          })
        } else {
          message.success(`${info.file.name} 个人目标导入成功！共导入/更新 ${response?.imported_count || 0} 条。`)
        }
        if (activeTab === 'personal' || activeTab === 'personal_actual') loadPersonalGoals()
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 导入失败`)
      }
    },
  }


  return (
    <div>
      <h3 style={{ fontSize: 20, marginBottom: 24, fontWeight: 'bold' }}>🎯 目标导入与战区/目标配置中心</h3>

      {/* 导入卡片区 */}
      {(isAdmin || isTargetOfficer) && (
        <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
          {/* 用户名单导入 */}
          {isAdmin && (
            <Col xs={24} md={12}>
              <Card title="📂 批量导入300+员工名单" style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <Paragraph>
                  请先准备好包含姓名、手机号、岗位、岗位类型、角色等基础数据的 Excel 文件。
                </Paragraph>
                <Upload {...userUploadProps} showUploadList={false}>
                  <Button type="primary" icon={<UploadOutlined />} size="large" style={{ background: '#1890ff' }}>
                    选择 Excel 导入员工
                  </Button>
                </Upload>
                <Divider type="vertical" style={{ margin: '0 12px' }} />
                <Button 
                  icon={<FileExcelOutlined />} 
                  href={`/api/v1/import-export/users/export?token=${localStorage.getItem('battle100_token') || ''}`} 
                  target="_blank"
                >
                  导出当前名单
                </Button>
                <div style={{ marginTop: 16 }}>
                  <Button
                    type="dashed"
                    icon={<SyncOutlined spin={syncing} />}
                    onClick={handleSyncFromCrm}
                    loading={syncing}
                    block
                  >
                    从钉钉通讯录一键同步最新员工
                  </Button>
                </div>
              </Card>
            </Col>
          )}

          {/* 目标表导入 */}
          <Col xs={24} md={isAdmin ? 12 : 24}>
            <Card title="📊 批量导入战队及个人奋斗目标" style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <Paragraph>
                系统提供双通道目标导入。请分别选择“周度目标分解”和“个人多维度目标”的 Excel 附件进行上传。
              </Paragraph>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Upload {...weeklyGoalUploadProps} showUploadList={false} disabled={!hasPerm('import_weekly_targets')}>
                  <Button type="primary" icon={<UploadOutlined />} size="large" style={{ background: '#52c41a', borderColor: '#52c41a', width: '100%' }} disabled={!hasPerm('import_weekly_targets')}>
                    导入周度目标分解 Excel (附件1)
                  </Button>
                </Upload>
                <Upload {...personalGoalUploadProps} showUploadList={false} disabled={!hasPerm('import_weekly_targets')}>
                  <Button type="primary" icon={<UploadOutlined />} size="large" style={{ background: '#722ed1', borderColor: '#722ed1', width: '100%' }} disabled={!hasPerm('import_weekly_targets')}>
                    导入个人与战队目标 Excel (附件2, 3, 4)
                  </Button>
                </Upload>
              </Space>
            </Card>
          </Col>
        </Row>
      )}

      {/* 五大维度数据管理 Tab 架构 */}
      <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key)} type="card" size="large">
        
        {/* ================================================================= */}
        {/* TAB 1: 员工与权限配置 */}
        {/* ================================================================= */}
        {isAdmin ? (
          <TabPane tab="👥 员工与权限配置" key="users">
          <Card 
            title={`员工列表与目标官配置（共 ${usersTotal} 人）`}
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            extra={
              <Space>
                {selectedUserRowKeys.length > 0 && (
                  <>
                    <Button type="primary" icon={<UserOutlined />} onClick={() => setAssignRoleModalVisible(true)}>
                      批量分配角色 ({selectedUserRowKeys.length})
                    </Button>
                    <Button type="primary" icon={<TagsOutlined />} onClick={() => setAssignPosTypeModalVisible(true)}>
                      批量分配岗位 ({selectedUserRowKeys.length})
                    </Button>
                    <Button type="primary" icon={<TeamOutlined />} onClick={() => setAssignTeamModalVisible(true)}>
                      批量分配战队 ({selectedUserRowKeys.length})
                    </Button>
                    <Button danger icon={<DeleteOutlined />} onClick={handleBatchDeleteUsers}>
                      批量删除 ({selectedUserRowKeys.length})
                    </Button>
                  </>
                )}
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateUserClick}>
                  新增用户
                </Button>
              </Space>
            }
          >
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={12} md={6}>
                <Input.Search
                  placeholder="搜索姓名或手机号"
                  allowClear
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onSearch={handleSearch}
                  enterButton={<SearchOutlined />}
                />
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Select
                  style={{ width: '100%' }}
                  value={filterPositionType}
                  onChange={handleFilterChange(setFilterPositionType)}
                  options={POSITION_TYPE_OPTIONS}
                />
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Select
                  style={{ width: '100%' }}
                  value={filterTeamId}
                  onChange={handleFilterChange(setFilterTeamId)}
                  options={TEAM_OPTIONS}
                />
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Select
                  style={{ width: '100%' }}
                  value={filterRole}
                  onChange={handleFilterChange(setFilterRole)}
                  options={ROLE_OPTIONS}
                />
              </Col>
            </Row>

            <Table
              rowSelection={{
                selectedRowKeys: selectedUserRowKeys,
                onChange: (keys) => setSelectedUserRowKeys(keys)
              }}
              dataSource={users}
              columns={userColumns}
              rowKey="id"
              loading={usersLoading}
              pagination={{
                current: usersPage,
                pageSize: usersPageSize,
                total: usersTotal,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 人`,
                onChange: (p, ps) => {
                  setUsersPage(p)
                  setUsersPageSize(ps)
                }
              }}
            />
          </Card>
        </TabPane>
      ) : null}

        {/* ================================================================= */}
        {/* TAB 2: 个人多维奋斗目标 */}
        {/* ================================================================= */}
        <TabPane tab="🎯 个人奋斗目标管理" key="personal">
          <Card
            title={`个人奋斗目标矩阵大盘（共 ${personalTotal} 人已配目标）`}
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            extra={
              <Space>
                <Button type="primary" ghost icon={<FileExcelOutlined />} onClick={() => handleExportPersonal('goals')}>
                  导出目标 Excel
                </Button>
                {(isAdmin || isTargetOfficer) && (
                  <Button type="primary" icon={<PlusOutlined />} disabled={!hasPerm('manage_base_targets')} onClick={handleCreatePersonalClick}>
                    手动新增个人目标
                  </Button>
                )}
                {(isAdmin || isTargetOfficer) && selectedPersonalRowKeys.length > 0 && (
                  <Button danger icon={<DeleteOutlined />} disabled={!hasPerm('clear_targets')} onClick={handleBatchDeletePersonal}>
                    批量清空目标 ({selectedPersonalRowKeys.length})
                  </Button>
                )}
              </Space>
            }
          >
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={12} md={6}>
                <Input.Search
                  placeholder="搜索姓名或手机号"
                  allowClear
                  value={personalKeyword}
                  onChange={(e) => setPersonalKeyword(e.target.value)}
                  onSearch={handlePersonalSearch}
                  enterButton={<SearchOutlined />}
                />
              </Col>
              <Col xs={12} sm={6} md={5}>
                <Select
                  style={{ width: '100%' }}
                  value={personalFilterTeam}
                  placeholder="筛选战队"
                  onChange={(val) => { setPersonalFilterTeam(val); setPersonalPage(1); }}
                  options={TEAM_OPTIONS}
                />
              </Col>
            </Row>

            <Table
              rowSelection={{
                selectedRowKeys: selectedPersonalRowKeys,
                onChange: (keys) => setSelectedPersonalRowKeys(keys)
              }}
              dataSource={personalPivotData}
              columns={personalColumns}
              rowKey="user_id"
              loading={personalLoading}
              pagination={{
                current: personalPage,
                pageSize: personalPageSize,
                total: personalTotal,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 人已配目标`,
                onChange: (p, ps) => {
                  setPersonalPage(p)
                  setPersonalPageSize(ps)
                }
              }}
              scroll={{ x: 'max-content' }}
              bordered
            />
          </Card>
        </TabPane>

        {/* ================================================================= */}
        {/* TAB 3: 基础目标周分解 (横向矩阵网格) */}
        {/* ================================================================= */}
        <TabPane tab="📅 基础目标" key="weekly_base">
          <Card
            title="每周滚动分解「基础」奋斗目标透视大盘（单位: 万元）"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            extra={
              (isAdmin || isTargetOfficer) && (
                <Button danger icon={<DeleteOutlined />} disabled={!hasPerm('clear_targets')} onClick={handleClearAllWeekly}>
                  一键清空所有周目标
                </Button>
              )
            }
          >
            <Table
              dataSource={pivotWeeklyData}
              columns={getPivotTableColumns(false)}
              rowKey="key"
              loading={pivotLoading}
              pagination={false} // 18行固定数据，无需分页
              scroll={{ x: 'max-content' }}
              bordered
              rowClassName={(record, index) => index >= 18 ? 'pivot-total-row' : ''}
            />
          </Card>
        </TabPane>

        {/* ================================================================= */}
        {/* TAB 4: 挑战目标周分解 (横向矩阵网格) */}
        {/* ================================================================= */}
        <TabPane tab="🚀 挑战目标" key="weekly_challenge">
          <Card
            title="每周滚动分解「挑战」奋斗目标透视大盘（单位: 万元）"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            extra={
              (isAdmin || isTargetOfficer) && (
                <Button danger icon={<DeleteOutlined />} disabled={!hasPerm('clear_targets')} onClick={handleClearAllWeekly}>
                  一键清空所有周目标
                </Button>
              )
            }
          >
            <Table
              dataSource={pivotWeeklyData}
              columns={getPivotTableColumns(true)}
              rowKey="key"
              loading={pivotLoading}
              pagination={false}
              scroll={{ x: 'max-content' }}
              bordered
              rowClassName={(record, index) => index >= 18 ? 'pivot-total-row' : ''}
            />
          </Card>
        </TabPane>

        {/* ================================================================= */}
        {/* TAB 5: 个人目标实际完成情况 */}
        {/* ================================================================= */}
        <TabPane tab="📈 个人目标完成情况" key="personal_actual">
          <Card
            title={`个人奋斗目标实际完成矩阵大盘（共 ${personalTotal} 人已配目标）`}
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            extra={
              <Space>
                <Button type="primary" ghost icon={<FileExcelOutlined />} onClick={() => handleExportPersonal('actuals')}>
                  导出实绩 Excel
                </Button>
                {(isAdmin || isTargetOfficer) && selectedPersonalRowKeys.length > 0 && (
                  <Button danger icon={<DeleteOutlined />} disabled={!hasPerm('clear_targets')} onClick={handleBatchClearPersonalActual}>
                    批量清空实际完成值 ({selectedPersonalRowKeys.length})
                  </Button>
                )}
              </Space>
            }
          >
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={12} md={6}>
                <Input.Search
                  placeholder="搜索姓名或手机号"
                  allowClear
                  value={personalKeyword}
                  onChange={(e) => setPersonalKeyword(e.target.value)}
                  onSearch={handlePersonalSearch}
                  enterButton={<SearchOutlined />}
                />
              </Col>
              <Col xs={12} sm={6} md={5}>
                <Select
                  style={{ width: '100%' }}
                  value={personalFilterTeam}
                  placeholder="筛选战队"
                  onChange={(val) => { setPersonalFilterTeam(val); setPersonalPage(1); }}
                  options={TEAM_OPTIONS}
                />
              </Col>
            </Row>

            <Table
              rowSelection={{
                selectedRowKeys: selectedPersonalRowKeys,
                onChange: (keys) => setSelectedPersonalRowKeys(keys)
              }}
              dataSource={personalPivotData}
              columns={personalActualColumns}
              rowKey="user_id"
              loading={personalLoading}
              pagination={{
                current: personalPage,
                pageSize: personalPageSize,
                total: personalTotal,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 人已配目标`,
                onChange: (p, ps) => {
                  setPersonalPage(p)
                  setPersonalPageSize(ps)
                }
              }}
              scroll={{ x: 'max-content' }}
              bordered
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* ========================================== */}
      {/* 弹窗区域（Modals） */}
      {/* ========================================== */}

      {/* 员工列表批量操作 Modal */}
      <Modal
        title="批量分配归属战队"
        open={assignTeamModalVisible}
        onOk={handleBatchAssignTeam}
        onCancel={() => setAssignTeamModalVisible(false)}
        okText="确认分配"
        cancelText="取消"
      >
        <div style={{ padding: '24px 0' }}>
          <p>已选择 {selectedUserRowKeys.length} 位员工，请选择你要分配的战队：</p>
          <Select
            style={{ width: '100%' }}
            placeholder="选择目标战队"
            onChange={(val) => setSelectedTeamId(val)}
            options={[
              ...TEAM_SELECT_OPTIONS,
              { label: '【清空归属】(取消分配)', value: null }
            ]}
          />
        </div>
      </Modal>

      <Modal
        title="批量分配系统角色/权限"
        open={assignRoleModalVisible}
        onOk={handleBatchAssignRole}
        onCancel={() => setAssignRoleModalVisible(false)}
        okText="确认修改"
        cancelText="取消"
        destroyOnClose
      >
        <div style={{ padding: '24px 0' }}>
          <p>已选择 {selectedUserRowKeys.length} 位员工，请选择你要分配的系统角色：</p>
          <Select
            style={{ width: '100%' }}
            placeholder="选择目标系统角色"
            onChange={(val) => setSelectedRole(val)}
            options={ROLE_OPTIONS.filter(o => o.value !== '')}
          />
        </div>
      </Modal>

      <Modal
        title="批量分配岗位类别"
        open={assignPosTypeModalVisible}
        onOk={handleBatchAssignPosType}
        onCancel={() => setAssignPosTypeModalVisible(false)}
        okText="确认修改"
        cancelText="取消"
        destroyOnClose
      >
        <div style={{ padding: '24px 0' }}>
          <p>已选择 {selectedUserRowKeys.length} 位员工，请选择你要分配的岗位类别：</p>
          <Select
            style={{ width: '100%' }}
            placeholder="选择目标岗位类别"
            onChange={(val) => setSelectedPosType(val)}
            options={POSITION_TYPE_OPTIONS.filter(o => o.value !== '')}
          />
        </div>
      </Modal>

      {/* 编辑员工 Modal */}
      <Modal
        title="编辑员工信息"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditModalVisible(false)
          setEditingUser(null)
        }}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ paddingTop: 12 }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入员工姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="phone" label="手机号" rules={[
            { required: true, message: '请输入手机号' },
            { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号格式' }
          ]}>
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item name="position" label="岗位">
            <Input placeholder="请输入岗位描述" />
          </Form.Item>
          <Form.Item name="third_class_bar" label="三级巴">
            <Input placeholder="请输入三级巴（如：技术8巴（江门））" />
          </Form.Item>
          <Form.Item name="position_type" label="岗位类别" rules={[{ required: true, message: '请选择岗位类别' }]}>
            <Select placeholder="请选择岗位类别">
              {POSITION_TYPE_OPTIONS.filter(o => o.value !== '').map(o => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="team_id" label="归属战队">
            <Select placeholder="请选择归属战队">
              <Select.Option value={null}>未分配 (空)</Select.Option>
              {TEAM_SELECT_OPTIONS.map(o => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="role" label="系统角色/权限" rules={[{ required: true, message: '请选择系统权限' }]}>
            <Select placeholder="请选择系统权限">
              {ROLE_OPTIONS.filter(o => o.value !== '').map(o => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增员工 Modal */}
      <Modal
        title="新增员工"
        open={createUserModalVisible}
        onOk={handleSaveCreateUser}
        onCancel={() => {
          setCreateUserModalVisible(false)
        }}
        okText="确认创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" style={{ paddingTop: 12 }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入员工姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="phone" label="手机号" rules={[
            { required: true, message: '请输入手机号' },
            { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号格式' }
          ]}>
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item name="password" label="初始登录密码" rules={[
            { required: true, message: '请输入初始登录密码' },
            { min: 6, message: '密码长度不能少于6位' }
          ]}>
            <Input.Password placeholder="请输入初始密码（默认预填：123456）" />
          </Form.Item>
          <Form.Item name="position" label="岗位">
            <Input placeholder="请输入岗位描述" />
          </Form.Item>
          <Form.Item name="third_class_bar" label="三级巴">
            <Input placeholder="请输入三级巴（如：技术8巴（江门））" />
          </Form.Item>
          <Form.Item name="position_type" label="岗位类别" rules={[{ required: true, message: '请选择岗位类别' }]}>
            <Select placeholder="请选择岗位类别">
              {POSITION_TYPE_OPTIONS.filter(o => o.value !== '').map(o => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="team_id" label="归属战队">
            <Select placeholder="请选择归属战队">
              <Select.Option value={null}>未分配 (空)</Select.Option>
              {TEAM_SELECT_OPTIONS.map(o => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="role" label="系统角色/权限" rules={[{ required: true, message: '请选择系统权限' }]}>
            <Select placeholder="请选择系统权限">
              {ROLE_OPTIONS.filter(o => o.value !== '').map(o => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="dingtalk_id" label="钉钉用户ID">
            <Input placeholder="请输入钉钉用户ID（选填，用于考勤或消息对接）" />
          </Form.Item>
          <Form.Item name="crm_user_id" label="CRM系统用户ID">
            <Input placeholder="请输入CRM系统用户ID（选填，用于新签业绩自动关联）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 2. 个人目标新增/修改 Modal */}
      <Modal
        title={editingPivotPersonal ? '编辑个人多维目标' : '手动新增个人奋斗目标'}
        open={personalModalVisible}
        onOk={handleSavePersonal}
        onCancel={() => {
          setPersonalModalVisible(false)
          setEditingPivotPersonal(null)
        }}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ disabled: !hasPerm('manage_base_targets') }}
        width={650}
        destroyOnClose
      >
        <Form form={personalForm} layout="vertical" style={{ paddingTop: 12 }}>
          {!editingPivotPersonal && (
            <Form.Item name="user_id" label="选择员工" rules={[{ required: true, message: '请选择目标员工' }]}>
              <Select
                showSearch
                placeholder="搜索并选择员工"
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={allUsers}
              />
            </Form.Item>
          )}
          {editingPivotPersonal && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
              <strong>当前编辑员工：</strong>
              <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{editingPivotPersonal.user_name}</span> 
              （岗位：{editingPivotPersonal.position || '未设置'}，手机号：{editingPivotPersonal.user_phone}）
            </div>
          )}

          <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: 8 }}>
            {PERSONAL_KPI_CONFIG.map(kpi => (
              <Card 
                key={kpi.key} 
                size="small" 
                title={<span style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>{kpi.label} ({kpi.unit})</span>}
                style={{ marginBottom: 12, border: '1px solid #f0f0f0', borderRadius: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item 
                      name={`${kpi.key}_base`} 
                      label="基础目标" 
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber style={{ width: '100%' }} min={0} placeholder="无目标 (0)" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item 
                      name={`${kpi.key}_challenge`} 
                      label="挑战目标" 
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber style={{ width: '100%' }} min={0} placeholder="无目标 (0)" />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            ))}
          </div>
        </Form>
      </Modal>

      {/* 2.5 个人目标实际完成情况修改 Modal */}
      <Modal
        title="编辑个人实际完成情况"
        open={personalActualModalVisible}
        onOk={handleSavePersonalActual}
        onCancel={() => {
          setPersonalActualModalVisible(false)
          setEditingActualPivotRow(null)
        }}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ disabled: !hasPerm('manage_base_targets') }}
        width={550}
        destroyOnClose
      >
        <Form form={personalActualForm} layout="vertical" style={{ paddingTop: 12 }}>
          {editingActualPivotRow && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
              <strong>当前编辑员工：</strong>
              <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{editingActualPivotRow.user_name}</span> 
              （岗位：{editingActualPivotRow.position || '未设置'}，手机号：{editingActualPivotRow.user_phone}）
            </div>
          )}

          <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: 8 }}>
            {editingActualPivotRow && PERSONAL_KPI_CONFIG
              .filter(kpi => kpi.key === 'contract_amount' || editingActualPivotRow.goals[kpi.key] !== undefined)
              .map(kpi => {
                const goal = editingActualPivotRow.goals[kpi.key]
                const sysVal = goal?.system_value ?? 0
                return (
                  <Card 
                    key={kpi.key} 
                    size="small" 
                    title={<span style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>{kpi.label} ({kpi.unit})</span>}
                    style={{ marginBottom: 12, border: '1px solid #f0f0f0', borderRadius: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
                  >
                    <Form.Item 
                      name={`${kpi.key}_actual`} 
                      label="实际完成值" 
                      style={{ marginBottom: 0 }}
                      help={<span style={{ color: '#8c8c8c', fontSize: '12px' }}>留空表示：清空手动覆盖，恢复由系统自动计算实绩（系统当前计算值: <strong>{sysVal}</strong>）</span>}
                    >
                      <InputNumber style={{ width: '100%' }} placeholder={`系统计算中: ${sysVal}`} />
                    </Form.Item>
                  </Card>
                )
              })}
          </div>
        </Form>
      </Modal>

      {/* 3. 战队目标新增/修改 Modal */}
      <Modal
        title={editingTeamGoal ? '编辑战队奋斗目标' : '手动新增战队总奋斗目标'}
        open={teamGoalModalVisible}
        onOk={handleSaveTeamGoal}
        onCancel={() => {
          setTeamGoalModalVisible(false)
          setEditingTeamGoal(null)
        }}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={teamGoalForm} layout="vertical" style={{ paddingTop: 12 }}>
          <Form.Item name="team_id" label="目标战队" rules={[{ required: true, message: '请选择战队' }]}>
            <Select placeholder="选择战队" disabled={!!editingTeamGoal}>
              {TEAM_SELECT_OPTIONS.map(o => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="category" label="目标分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="选择类别" disabled={!!editingTeamGoal}>
              <Select.Option value="marketing">营销新签</Select.Option>
              <Select.Option value="delivery">交付新签</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="base_target" label="基础目标额 (万元)" rules={[{ required: true, message: '请输入基础新签金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0} placeholder="输入基础目标额" />
          </Form.Item>
          <Form.Item name="red_line_target" label="挑战目标额 (万元)" rules={[{ required: true, message: '请输入挑战目标金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0} placeholder="输入挑战目标额" />
          </Form.Item>
          <Form.Item name="original_plan" label="原始任务说明">
            <Input.TextArea placeholder="记录原始分解或批注" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 4. 周分解行矩阵编辑 Modal */}
      <Modal
        title={
          editingPivotRow
            ? `编辑【${editingPivotRow.team_name} - ${
                editingPivotRow.category === 'marketing' ? '营销新签' : '交付新签'
              }】${activeTab === 'weekly_challenge' ? '挑战' : '基础'}周分解目标`
            : '编辑周度目标'
        }
        open={pivotEditModalVisible}
        onOk={handleSavePivotRow}
        onCancel={() => {
          setPivotEditModalVisible(false)
          setEditingPivotRow(null)
        }}
        okText="保存并同步"
        cancelText="取消"
        okButtonProps={{ disabled: !hasPerm('manage_base_targets') }}
        width={750}
        destroyOnClose
      >
        <div style={{ marginBottom: 16, background: '#f5f5f5', padding: '12px 16px', borderRadius: 4 }}>
          <p style={{ margin: 0 }}>
            战区归属：<strong>{editingPivotRow?.zone_name}</strong> | 战队名：
            <strong>{editingPivotRow?.team_name}</strong>
          </p>
          <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '12px' }}>
            修改以下 15 周的目标值并保存后，系统将自动汇总并更新该战队作战大盘的总目标额。
          </p>
        </div>
        <Form form={pivotEditForm} layout="vertical">
          <Row gutter={[16, 8]}>
            {WEEK_RANGES.map(item => (
              <Col span={8} key={item.week}>
                <Form.Item
                  name={`week_${item.week}`}
                  label={`第 ${item.week} 周 (${item.range})`}
                  rules={[{ required: true, message: '请输入目标值' }]}
                >
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="万元" />
                </Form.Item>
              </Col>
            ))}
          </Row>
        </Form>
      </Modal>

    </div>
  )
}

export default Goals
