/**
 * 团队整体周报智能生成及管理页面 (移动端)
 * 支持战队和三级巴级的数据回显、AI 生成、直接编辑、覆盖保存、推送钉钉、复制与导出 Markdown
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Toast, Card, NavBar, TextArea, Tag, DotLoading, Dialog } from 'antd-mobile'
import { LeftOutline, RightOutline, CalendarOutline, FileOutline, SendOutline } from 'antd-mobile-icons'
import { get, post } from '@shared/api/client'
import { useAuthStore } from '@shared/stores/authStore'
import { getMyStats } from '@shared/api/dashboard'

// 日期格式化辅助函数 YYYY-MM-DD
function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取某一日期所在周的周一
function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // 周日特殊处理
  return new Date(date.setDate(diff))
}

export default function GroupWeeklyReport() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // 1. 日期状态 (当周周一)
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const mondayStr = formatDate(monday)
  const sundayStr = formatDate(sunday)

  // 2. 筛选状态 (战队 & 三级巴)
  const [teamList, setTeamList] = useState<Array<{ id: number; name: string }>>([])
  const [thirdClassBarOptions, setThirdClassBarOptions] = useState<string[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all')
  const [selectedThirdBar, setSelectedThirdBar] = useState<string>('all')

  // 是否为全公司管理级视角
  const isAllAccess = ['admin', 'digital_specialist'].includes(user?.role || '')

  // 3. 业务数据状态
  const [content, setContent] = useState<string>('')
  const [metrics, setMetrics] = useState<any>({
    marketing_signed: 0,
    delivery_signed: 0,
    win_bids: 0,
    happiness_count: 0,
    triangle_count: 0,
    valid_leads: 0,
    potential_leads: 0,
    production_value: 0,
    receive_value: 0
  })

  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [savedTime, setSavedTime] = useState('')

  // AI 后台生成状态
  const [aiGeneratingStatus, setAiGeneratingStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')
  const pollingTimerRef = useRef<any>(null)

  // 4. 加载初始数据：所有战队和三级巴选项
  useEffect(() => {
    // 战队列表拉取
    getMyStats()
      .then((statsRes) => {
        if (statsRes?.zone_teams_data) {
          const acc: Array<{ id: number; name: string }> = []
          statsRes.zone_teams_data.forEach((zone: any) => {
            if (zone.teams) {
              zone.teams.forEach((t: any) => {
                if (!acc.some(existing => existing.id === t.team_id)) {
                  acc.push({ id: t.team_id, name: t.team_name })
                }
              })
            }
          })
          setTeamList(acc)
          
          // 根据角色初始选择
          if (!isAllAccess && user?.team_id) {
            setSelectedTeamId(String(user.team_id))
          }
        }
      })
      .catch((err) => console.error('加载战队数据失败:', err))

    // 三级巴列表拉取
    get<string[]>('/users/third-class-bars')
      .then((res) => {
        if (res) {
          setThirdClassBarOptions(res)
        }
      })
      .catch((err) => console.error('加载三级巴失败:', err))
  }, [user, isAllAccess])

  // 5. 拉取当周已保存的团队周报
  const fetchGroupReport = async () => {
    setLoading(true)
    let url = `/reports/weekly/group-report?start_date=${mondayStr}`
    
    const teamParam = selectedTeamId !== 'all' ? selectedTeamId : null
    const barParam = selectedThirdBar !== 'all' ? selectedThirdBar : null
    
    if (teamParam) {
      url += `&team_id=${teamParam}`
    }
    if (barParam) {
      url += `&third_class_bar=${encodeURIComponent(barParam)}`
    }

    try {
      const res = await get<any>(url)
      const data = res?.data ? res.data : res
      if (data && data.id) {
        setContent(data.content || '')
        setMetrics({
          marketing_signed: data.marketing_signed || 0,
          delivery_signed: data.delivery_signed || 0,
          win_bids: data.win_bids || 0,
          happiness_count: data.happiness_count || 0,
          triangle_count: data.triangle_count || 0,
          valid_leads: data.valid_leads || 0,
          potential_leads: data.potential_leads || 0,
          production_value: data.production_value || 0,
          receive_value: data.receive_value || 0
        })
        setIsSaved(true)
        const formatTime = data.updated_at || data.created_at
        setSavedTime(formatTime ? formatTime.slice(0, 19).replace('T', ' ') : '')
      } else {
        resetState()
      }
    } catch (err: any) {
      // 404 说明未生成或保存过，重置状态
      resetState()
    } finally {
      setLoading(false)
    }
  }

  const resetState = () => {
    setContent('')
    setMetrics({
      marketing_signed: 0,
      delivery_signed: 0,
      win_bids: 0,
      happiness_count: 0,
      triangle_count: 0,
      valid_leads: 0,
      potential_leads: 0,
      production_value: 0,
      receive_value: 0
    })
    setIsSaved(false)
    setSavedTime('')
  }

  // 检查后台 AI 生成状态
  const checkAiGeneratingStatus = async (targetMonday: string, targetTeamId: string, targetThirdBar: string) => {
    try {
      let url = `/reports/weekly/generate-status?start_date=${targetMonday}`
      const teamParam = targetTeamId !== 'all' ? targetTeamId : null
      const barParam = targetThirdBar !== 'all' ? targetThirdBar : null
      if (teamParam) {
        url += `&team_id=${teamParam}`
      }
      if (barParam) {
        url += `&third_class_bar=${encodeURIComponent(barParam)}`
      }
      const res = await get<any>(url)
      const status = res?.status || 'idle'
      if (status === 'success') {
        setAiGeneratingStatus('idle')
        Toast.show({ icon: 'success', content: 'AI 团队周报后台生成并自动存盘成功！' })
        fetchGroupReport() // 刷新重新加载数据
        return true
      } else if (status === 'failed') {
        setAiGeneratingStatus('idle')
        Toast.show({ icon: 'fail', content: `AI 团队周报生成失败：${res?.error || '未知错误'}` })
        return true
      } else if (status === 'running') {
        setAiGeneratingStatus('running')
        return false
      }
      setAiGeneratingStatus('idle')
      return true
    } catch (err) {
      console.error('查询 AI 状态失败:', err)
      return false
    }
  }

  // 启动状态轮询
  const startStatusPolling = (targetMonday: string, targetTeamId: string, targetThirdBar: string) => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
    }
    checkAiGeneratingStatus(targetMonday, targetTeamId, targetThirdBar)

    pollingTimerRef.current = setInterval(async () => {
      const isDone = await checkAiGeneratingStatus(targetMonday, targetTeamId, targetThirdBar)
      if (isDone && pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current)
        pollingTimerRef.current = null
      }
    }, 5000)
  }

  // 监听筛选改变，自动加载
  useEffect(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
    setAiGeneratingStatus('idle')

    fetchGroupReport()

    // 检查是否已经在后台生成中
    checkAiGeneratingStatus(mondayStr, selectedTeamId, selectedThirdBar).then((isDone) => {
      if (!isDone) {
        startStatusPolling(mondayStr, selectedTeamId, selectedThirdBar)
      }
    })
  }, [mondayStr, selectedTeamId, selectedThirdBar])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current)
      }
    }
  }, [])

  // 6. 前后周切换
  const handlePrevWeek = () => {
    const prev = new Date(monday)
    prev.setDate(monday.getDate() - 7)
    setMonday(prev)
  }

  const handleNextWeek = () => {
    const next = new Date(monday)
    next.setDate(monday.getDate() + 7)
    setMonday(next)
  }

  // 7. 触发 AI 智能生成
  const handleAiGenerate = async () => {
    setAiGeneratingStatus('running')
    Toast.show({
      content: '已在后台启动 AI 生成任务，请稍候...',
      duration: 2000
    })
    
    let url = `/reports/weekly/generate-group-report?start_date=${mondayStr}`
    const teamParam = selectedTeamId !== 'all' ? selectedTeamId : null
    const barParam = selectedThirdBar !== 'all' ? selectedThirdBar : null
    
    if (teamParam) {
      url += `&team_id=${teamParam}`
    }
    if (barParam) {
      url += `&third_class_bar=${encodeURIComponent(barParam)}`
    }

    try {
      await post<any>(url, {})
      // 启动轮询
      startStatusPolling(mondayStr, selectedTeamId, selectedThirdBar)
    } catch (err: any) {
      console.error(err)
      setAiGeneratingStatus('idle')
      Toast.show({
        icon: 'fail',
        content: err?.response?.data?.detail || 'AI 生成团队周报失败，请稍后重试'
      })
    }
  }

  // 8. 保存存盘
  const handleSave = async () => {
    if (!content.trim()) {
      Toast.show({ icon: 'fail', content: '请先生成或填写周报正文再保存' })
      return
    }

    setActionLoading(true)
    const payload = {
      team_id: selectedTeamId !== 'all' ? parseInt(selectedTeamId) : null,
      third_class_bar: selectedThirdBar !== 'all' ? selectedThirdBar : null,
      start_date: mondayStr,
      end_date: sundayStr,
      content: content,
      marketing_signed: metrics.marketing_signed,
      delivery_signed: metrics.delivery_signed,
      win_bids: metrics.win_bids,
      happiness_count: metrics.happiness_count,
      triangle_count: metrics.triangle_count,
      valid_leads: metrics.valid_leads,
      potential_leads: metrics.potential_leads,
      production_value: metrics.production_value,
      receive_value: metrics.receive_value
    }

    try {
      const res = await post<any>('/reports/weekly/save-group-report', payload)
      const data = res?.data ? res.data : res
      if (data) {
        setIsSaved(true)
        const formatTime = data.updated_at || data.created_at
        setSavedTime(formatTime ? formatTime.slice(0, 19).replace('T', ' ') : '')
        Toast.show({ icon: 'success', content: '团队周报及指标快照已成功存盘！' })
      }
    } catch (err: any) {
      console.error(err)
      Toast.show({ icon: 'fail', content: err?.response?.data?.detail || '保存失败，请稍后重试' })
    } finally {
      setActionLoading(false)
    }
  }

  // 9. 推送钉钉机器人
  const handleSendToDingTalk = async () => {
    if (!content.trim()) {
      Toast.show({ icon: 'fail', content: '请先生成或填写周报正文再推送' })
      return
    }

    setActionLoading(true)
    Toast.show({ icon: 'loading', content: '正在保存并推送至钉钉...', duration: 0 })
    
    // 强制先存盘
    const payload = {
      team_id: selectedTeamId !== 'all' ? parseInt(selectedTeamId) : null,
      third_class_bar: selectedThirdBar !== 'all' ? selectedThirdBar : null,
      start_date: mondayStr,
      end_date: sundayStr,
      content: content,
      marketing_signed: metrics.marketing_signed,
      delivery_signed: metrics.delivery_signed,
      win_bids: metrics.win_bids,
      happiness_count: metrics.happiness_count,
      triangle_count: metrics.triangle_count,
      valid_leads: metrics.valid_leads,
      potential_leads: metrics.potential_leads,
      production_value: metrics.production_value,
      receive_value: metrics.receive_value
    }

    let saveSuccess = false
    try {
      const res = await post<any>('/reports/weekly/save-group-report', payload)
      if (res) {
        saveSuccess = true
        setIsSaved(true)
        const formatTime = res.updated_at || res.created_at
        setSavedTime(formatTime ? formatTime.slice(0, 19).replace('T', ' ') : '')
      }
    } catch (err) {
      console.error('推送前静默存盘失败:', err)
    }

    if (!saveSuccess) {
      Toast.clear()
      Toast.show({ icon: 'fail', content: '系统存盘失败，推送已中断' })
      setActionLoading(false)
      return
    }

    // 调用推送接口
    try {
      const activeTeamName = teamList.find(t => String(t.id) === selectedTeamId)?.name || ''
      const activeBarName = selectedThirdBar !== 'all' ? selectedThirdBar : ''
      let groupName = activeTeamName
      if (activeBarName) {
        groupName = groupName ? `${groupName}-${activeBarName}` : activeBarName
      }
      if (!groupName) {
        groupName = '全公司'
      }

      await post('/reports/weekly/send-group-report-to-dingtalk', {
        group_name: groupName,
        start_date: mondayStr,
        metrics: metrics,
        content: content,
        redirect_url: window.location.origin + '/m/weekly-report'
      })
      
      Toast.clear()
      Dialog.alert({
        content: '🎉 整体周报已复制、成功存盘数据库，并已同步推送至钉钉！',
        confirmText: '我知道了'
      })
    } catch (err: any) {
      console.error(err)
      Toast.clear()
      Dialog.alert({
        content: `⚠️ 周报已成功存盘，但向钉钉推送失败：${err.response?.data?.detail || '网络异常'}`,
        confirmText: '我知道了'
      })
    } finally {
      setActionLoading(false)
    }
  }

  // 10. 高度兼容性的复制到剪切板逻辑
  const handleCopy = () => {
    if (!content.trim()) {
      Toast.show({ icon: 'fail', content: '无周报正文可复制' })
      return
    }

    const textArea = document.createElement('textarea')
    textArea.value = content
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.width = '2em'
    textArea.style.height = '2em'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    textArea.setAttribute('readonly', '')

    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    textArea.setSelectionRange(0, 99999)

    let success = false
    try {
      success = document.execCommand('copy')
    } catch (err) {
      console.error('复制异常:', err)
    }
    document.body.removeChild(textArea)

    if (success) {
      Toast.show({ icon: 'success', content: '周报 Markdown 正文已复制！' })
    } else {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content)
          .then(() => Toast.show({ icon: 'success', content: '周报 Markdown 正文已复制！' }))
          .catch(() => Toast.show({ icon: 'fail', content: '复制失败，请长按选择文本框复制' }))
      } else {
        Toast.show({ icon: 'fail', content: '复制失败，请长按选择文本框复制' })
      }
    }
  }

  // 11. 一键下载为 Markdown 文件
  const handleExportFile = () => {
    if (!content.trim()) {
      Toast.show({ icon: 'fail', content: '无周报正文可供导出' })
      return
    }
    try {
      const activeTeamName = teamList.find(t => String(t.id) === selectedTeamId)?.name || '团队'
      const activeBarName = selectedThirdBar !== 'all' ? selectedThirdBar : ''
      const filename = `${activeTeamName}${activeBarName ? `_${activeBarName}` : ''}_${mondayStr}_整体复盘周报.md`
      
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      Toast.show({ icon: 'success', content: '文件已导出！' })
    } catch (err) {
      console.error('文件导出失败:', err)
      Toast.show({ icon: 'fail', content: '文件导出失败' })
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6fa', paddingBottom: 60 }}>
      {/* 头部导航栏 */}
      <NavBar onBack={() => navigate('/m/profile')} style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #eee' }}>
        团队周报 AI 智能中心
      </NavBar>

      {/* 周时间切换器 */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(135deg, #1890ff, #102a4c)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 12px rgba(24,144,255,0.15)'
      }}>
        <Button size='mini' fill='none' onClick={handlePrevWeek} style={{ color: '#fff', fontSize: 14 }}>
          <LeftOutline /> 上周
        </Button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>
            📅 {mondayStr.slice(5)} ~ {sundayStr.slice(5)}
          </div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
            第 {Math.ceil((monday.getTime() - new Date('2026-06-01').getTime()) / (86400000 * 7)) + 1} 周
          </div>
        </div>
        <Button size='mini' fill='none' onClick={handleNextWeek} style={{ color: '#fff', fontSize: 14 }}>
          下周 <RightOutline />
        </Button>
      </div>

      {/* 筛选面板 */}
      <Card style={{ margin: 12, borderRadius: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 战队选择 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#555', minWidth: 70 }}>战队筛选：</span>
            {isAllAccess ? (
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 8,
                  fontSize: 13,
                  background: '#fff',
                  color: '#333',
                  outline: 'none'
                }}
              >
                <option value="all">选择战队...</option>
                {teamList.map(t => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
              </select>
            ) : (
              <Tag color="primary" style={{ fontSize: 13, padding: '4px 10px', borderRadius: 4 }}>
                {teamList.find(t => String(t.id) === selectedTeamId)?.name || '当前战队'}
              </Tag>
            )}
          </div>

          {/* 三级巴选择 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#555', minWidth: 70 }}>三级巴选：</span>
            <select
              value={selectedThirdBar}
              onChange={(e) => setSelectedThirdBar(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: 8,
                fontSize: 13,
                background: '#fff',
                color: '#333',
                outline: 'none'
              }}
            >
              <option value="all">全部三级巴</option>
              {thirdClassBarOptions.map(bar => (
                <option key={bar} value={bar}>{bar}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* 数据内容渲染区域 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
          <DotLoading color="primary" />
          <div style={{ marginTop: 8 }}>正在加载已存周报快照...</div>
        </div>
      ) : (
        <div style={{ padding: '0 12px' }}>
          {/* 状态指示框 */}
          {aiGeneratingStatus === 'running' ? (
            <div style={{
              textAlign: 'center',
              padding: 10,
              color: '#fa8c16',
              fontSize: 12,
              fontWeight: 'bold',
              backgroundColor: '#fff7e6',
              borderRadius: 8,
              border: '1px solid #ffd591',
              marginBottom: 12
            }}>
              ⚡ AI 正在后台整理生成周报中，您可以继续编辑或浏览旧数据...
            </div>
          ) : isSaved ? (
            <div style={{
              textAlign: 'center',
              padding: 10,
              color: '#52c41a',
              fontSize: 12,
              fontWeight: 'bold',
              backgroundColor: '#f6ffed',
              borderRadius: 8,
              border: '1px solid #b7eb8f',
              marginBottom: 12
            }}>
              ✓ 该团队本周周报已存盘（上次保存：{savedTime}）
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: 10,
              color: '#faad14',
              fontSize: 12,
              fontWeight: 'bold',
              backgroundColor: '#fffbe6',
              borderRadius: 8,
              border: '1px solid #ffe58f',
              marginBottom: 12
            }}>
              ⚠️ 该配置本周尚未保存或内容已发生变更，请生成后及时点击保存！
            </div>
          )}

          {/* 核心指标看板 (PC 端指标的轻量级展现) */}
          <Card title={<span style={{ color: '#1677ff', fontWeight: 'bold' }}>📊 CRM 数据与本周业绩指标看板</span>} style={{ borderRadius: 12, marginBottom: 12 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              padding: '4px 0'
            }}>
              {[
                { title: '营销新签', value: `${metrics.marketing_signed.toFixed(2)}万`, color: '#f5222d' },
                { title: '交付新签', value: `${metrics.delivery_signed.toFixed(2)}万`, color: '#fa8c16' },
                { title: '中标项目', value: `${metrics.win_bids}个`, color: '#52c41a' },
                { title: '有效商机', value: `${metrics.valid_leads}个`, color: '#1890ff' },
                { title: '潜力商机', value: `${metrics.potential_leads}个`, color: '#13c2c2' },
                { title: '幸福行动', value: `${metrics.happiness_count}次`, color: '#eb2f96' },
                { title: '铁三角联动', value: `${metrics.triangle_count}次`, color: '#722ed1' },
                { title: '累计产值', value: `${metrics.production_value.toFixed(2)}万`, color: '#2f54eb' },
                { title: '到账回款', value: `${metrics.receive_value.toFixed(2)}万`, color: '#52c41a' }
              ].map((item, idx) => (
                <div key={idx} style={{
                  background: '#f9f9f9',
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  padding: '8px 4px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 10, color: '#999', marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* 周报正文 Markdown 编辑区域 */}
          <Card title={<span style={{ color: '#722ed1', fontWeight: 'bold' }}>📝 AI 周报复盘正文 (Markdown 文本)</span>} style={{ borderRadius: 12, marginBottom: 16 }}>
            <TextArea
              placeholder="请点击下方的“⚡ AI 智能生成”按钮来自动抓取 CRM 及工作记录并合成团队整体周报；或直接在此输入或修改周报 Markdown 文本内容。"
              autoSize={{ minRows: 12, maxRows: 30 }}
              value={content}
              onChange={(val) => {
                setContent(val)
                setIsSaved(false)
              }}
              style={{
                backgroundColor: '#fafafa',
                padding: 10,
                borderRadius: 8,
                fontSize: 12,
                fontFamily: 'monospace',
                lineHeight: '1.6'
              }}
            />
          </Card>

          {/* 核心操作按钮组 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <Button
              block
              loading={aiGeneratingStatus === 'running'}
              disabled={aiGeneratingStatus === 'running'}
              onClick={handleAiGenerate}
              style={{
                background: aiGeneratingStatus === 'running' 
                  ? '#d9d9d9' 
                  : 'linear-gradient(135deg, #722ed1, #3f1a68)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                height: '42px',
                fontWeight: 'bold',
                boxShadow: '0 4px 10px rgba(114,46,209,0.2)'
              }}
            >
              {aiGeneratingStatus === 'running' ? '⚡ AI 正在后台分析生成中...' : '⚡ AI 智能生成团队周报'}
            </Button>

            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                flex={1}
                loading={actionLoading}
                onClick={handleSave}
                style={{
                  flex: 1,
                  borderRadius: '12px',
                  height: '40px',
                  fontSize: 13,
                  fontWeight: 'bold',
                  backgroundColor: '#fff',
                  border: '1px solid #1677ff',
                  color: '#1677ff'
                }}
              >
                💾 保存周报
              </Button>

              <Button
                flex={1}
                loading={actionLoading}
                onClick={handleSendToDingTalk}
                style={{
                  flex: 1.2,
                  borderRadius: '12px',
                  height: '40px',
                  fontSize: 13,
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #1890ff, #102a4c)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 8px rgba(24,144,255,0.2)'
                }}
              >
                📢 推送至钉钉
              </Button>
            </div>

            {/* 辅助小按钮（复制和导出） */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Button
                onClick={handleCopy}
                style={{
                  flex: 1,
                  borderRadius: '8px',
                  height: '34px',
                  fontSize: 12,
                  backgroundColor: '#fff',
                  border: '1px solid #d9d9d9',
                  color: '#595959',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4
                }}
              >
                📋 复制 Markdown
              </Button>
              <Button
                onClick={handleExportFile}
                style={{
                  flex: 1,
                  borderRadius: '8px',
                  height: '34px',
                  fontSize: 12,
                  backgroundColor: '#fff',
                  border: '1px solid #d9d9d9',
                  color: '#595959',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4
                }}
              >
                📥 导出 .md 文件
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
