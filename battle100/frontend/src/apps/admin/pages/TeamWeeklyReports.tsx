import React, { useEffect, useState, useRef } from 'react'
import {
  Card,
  Row,
  Col,
  Space,
  Button,
  Input,
  DatePicker,
  Select,
  Radio,
  Typography,
  Alert,
  Tag,
  Spin,
  message
} from 'antd'
import {
  FileTextOutlined,
  SyncOutlined,
  CopyOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  SendOutlined,
  SaveOutlined,
  DatabaseOutlined
} from '@ant-design/icons'
import { get, post } from '@shared/api/client'
import { useAuthStore } from '@shared/stores/authStore'
import dayjs from 'dayjs'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const { Title, Paragraph, Text } = Typography

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

const TeamWeeklyReports: React.FC = () => {
  const { user } = useAuthStore()

  // 默认根据用户角色载入战队和周日期
  const defaultTeam = user && ['team_leader'].includes(user.role || '') ? String(user.team_id || 'all') : 'all'
  const [weeklyDate, setWeeklyDate] = useState<dayjs.Dayjs>(dayjs())
  const [weeklyTeamId, setWeeklyTeamId] = useState<string>(defaultTeam)
  const [weeklyThirdBar, setWeeklyThirdBar] = useState<string>('all')
  const [thirdClassBarOptions, setThirdClassBarOptions] = useState<any[]>([])

  // 团队整体周报相关状态
  const [groupReportLoading, setGroupReportLoading] = useState(false)
  const [groupReportContent, setGroupReportContent] = useState('')
  const [hasSavedReport, setHasSavedReport] = useState(false)
  const [savedReportTime, setSavedReportTime] = useState('')
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit')

  // AI 智能生成状态
  const [aiGeneratingStatus, setAiGeneratingStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')
  const pollingTimerRef = useRef<any>(null)

  // 导出/同步状态
  const [dingSending, setDingSending] = useState(false)
  const [groupPdfExporting, setGroupPdfExporting] = useState(false)
  const [groupDocxExporting, setGroupDocxExporting] = useState(false)

  // 9个财务与播报核心指标
  const [groupMetrics, setGroupMetrics] = useState<any>({
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

  // 计算给定日期所在周的周一和周日
  const getMondayAndSunday = (dateVal: dayjs.Dayjs) => {
    const day = dateVal.day()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const mon = dateVal.add(diffToMonday, 'day')
    const sun = mon.add(6, 'day')
    return [mon, sun]
  }

  const [mon, sun] = getMondayAndSunday(weeklyDate)
  const selectedMonday = mon.format('YYYY-MM-DD')
  const selectedSunday = sun.format('YYYY-MM-DD')

  // 判定是否有生成团队整体周报的权限
  const allowedGroupReport = ['admin', 'target_officer', 'team_leader', 'digital_specialist'].includes(user?.role || '')

  // 加载系统所有的三级巴选项
  const loadThirdClassBars = async () => {
    try {
      const res = await get<string[]>('/users/third-class-bars')
      if (res) {
        const opts = [
          { label: '全部三级巴', value: 'all' },
          ...res.map((bar: string) => ({ label: bar, value: bar }))
        ]
        setThirdClassBarOptions(opts)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // 获取当前所选团队名称
  const getGroupNameText = () => {
    if (weeklyThirdBar && weeklyThirdBar !== 'all') {
      return weeklyThirdBar
    }
    if (weeklyTeamId && weeklyTeamId !== 'all') {
      const opt = TEAM_OPTIONS.find(o => o.value === weeklyTeamId)
      return opt ? opt.label : ''
    }
    return '全部战队'
  }

  // 获取已存的团队整体周报
  const fetchGroupReport = async (autoGenerate = false) => {
    if (weeklyTeamId === 'all' && weeklyThirdBar === 'all') {
      message.warning('请选择具体的战队或三级巴组织进行查看！')
      return
    }

    setGroupReportLoading(true)
    try {
      const startDateStr = mon.format('YYYY-MM-DD')
      let url = `/reports/weekly/group-report?start_date=${startDateStr}`
      if (weeklyTeamId && weeklyTeamId !== 'all') {
        url += `&team_id=${weeklyTeamId}`
      }
      if (weeklyThirdBar && weeklyThirdBar !== 'all') {
        url += `&third_class_bar=${encodeURIComponent(weeklyThirdBar)}`
      }

      try {
        const res = await get<any>(url)
        const data = res?.data ? res.data : res
        if (data && data.id) {
          setGroupReportContent(data.content)
          setGroupMetrics({
            marketing_signed: data.marketing_signed,
            delivery_signed: data.delivery_signed,
            win_bids: data.win_bids,
            happiness_count: data.happiness_count,
            triangle_count: data.triangle_count,
            valid_leads: data.valid_leads,
            potential_leads: data.potential_leads,
            production_value: data.production_value,
            receive_value: data.receive_value
          })
          setHasSavedReport(true)
          setSavedReportTime(dayjs(data.updated_at || data.created_at).format('YYYY-MM-DD HH:mm:ss'))
          message.success('已加载已存档的团队整体周报！')
        } else {
          setGroupReportContent('')
          setHasSavedReport(false)
          setSavedReportTime('')
          if (autoGenerate) {
            await triggerAiGenerateGroupReport()
          } else {
            message.info('当前周次该战队暂无已存的整体周报，您可以点击“重新由 AI 智能生成”开始生成。')
          }
        }
      } catch (err: any) {
        const status = err?.response?.status || err?.status
        const detail = err?.response?.data?.detail || ''
        if (status === 404 || detail.includes('未找到该周') || detail.includes('不存在') || detail.includes('Not Found')) {
          setGroupReportContent('')
          setHasSavedReport(false)
          setSavedReportTime('')
          if (autoGenerate) {
            await triggerAiGenerateGroupReport()
          } else {
            message.info('当前周次该战队暂无已存的整体周报，您可以点击“重新由 AI 智能生成”开始生成。')
          }
        } else {
          throw err
        }
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '获取团队整体周报失败')
    } finally {
      setGroupReportLoading(false)
    }
  }

  // 检查后台 AI 生成状态
  const checkAiGeneratingStatus = async (targetMonday: string, targetTeamId: string, targetThirdBar: string) => {
    try {
      let url = `/reports/weekly/generate-status?start_date=${targetMonday}`
      if (targetTeamId && targetTeamId !== 'all') {
        url += `&team_id=${targetTeamId}`
      }
      if (targetThirdBar && targetThirdBar !== 'all') {
        url += `&third_class_bar=${encodeURIComponent(targetThirdBar)}`
      }
      const res = await get<any>(url)
      const status = res?.status || 'idle'
      if (status === 'success') {
        setAiGeneratingStatus('idle')
        message.success('AI 团队周报后台整理生成并自动存盘成功！')
        // 自动刷新重新加载数据
        fetchGroupReport(false)
        return true
      } else if (status === 'failed') {
        setAiGeneratingStatus('idle')
        message.error(`AI 团队周报生成失败：${res?.error || '未知错误'}`)
        return true
      } else if (status === 'running') {
        setAiGeneratingStatus('running')
        return false
      }
      setAiGeneratingStatus('idle')
      return true
    } catch (err) {
      console.error('查询 AI 状态出错:', err)
      return false
    }
  }

  // 启动状态轮询
  const startStatusPolling = (targetMonday: string, targetTeamId: string, targetThirdBar: string) => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
    }
    // 立即查一次
    checkAiGeneratingStatus(targetMonday, targetTeamId, targetThirdBar)

    pollingTimerRef.current = setInterval(async () => {
      const isDone = await checkAiGeneratingStatus(targetMonday, targetTeamId, targetThirdBar)
      if (isDone && pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current)
        pollingTimerRef.current = null
      }
    }, 5000)
  }

  // 重新由 AI 智能整理生成整体周报
  const triggerAiGenerateGroupReport = async () => {
    if (weeklyTeamId === 'all' && weeklyThirdBar === 'all') {
      message.warning('请选择具体的战队或三级巴组织！')
      return
    }

    setAiGeneratingStatus('running')
    try {
      const startDateStr = mon.format('YYYY-MM-DD')
      let url = `/reports/weekly/generate-group-report?start_date=${startDateStr}`
      if (weeklyTeamId && weeklyTeamId !== 'all') {
        url += `&team_id=${weeklyTeamId}`
      }
      if (weeklyThirdBar && weeklyThirdBar !== 'all') {
        url += `&third_class_bar=${encodeURIComponent(weeklyThirdBar)}`
      }

      const res = await post<any>(url, {})
      message.info(res?.message || '已在后台启动 AI 整理生成任务，您可继续其他操作...')
      startStatusPolling(startDateStr, weeklyTeamId, weeklyThirdBar)
    } catch (err: any) {
      console.error(err)
      setAiGeneratingStatus('idle')
      message.error(err?.response?.data?.detail || 'AI 生成团队周报失败，请确认该团队是否有已激活成员及相关数据')
    }
  }

  // 保存至系统数据库
  const handleSaveGroupReport = async () => {
    if (!groupReportContent.trim()) {
      message.warning('没有可保存的内容')
      return
    }
    setGroupReportLoading(true)
    try {
      const payload = {
        team_id: weeklyTeamId !== 'all' ? parseInt(weeklyTeamId) : null,
        third_class_bar: weeklyThirdBar !== 'all' ? weeklyThirdBar : null,
        start_date: mon.format('YYYY-MM-DD'),
        end_date: sun.format('YYYY-MM-DD'),
        content: groupReportContent,
        marketing_signed: groupMetrics.marketing_signed,
        delivery_signed: groupMetrics.delivery_signed,
        win_bids: groupMetrics.win_bids,
        happiness_count: groupMetrics.happiness_count,
        triangle_count: groupMetrics.triangle_count,
        valid_leads: groupMetrics.valid_leads,
        potential_leads: groupMetrics.potential_leads,
        production_value: groupMetrics.production_value,
        receive_value: groupMetrics.receive_value
      }

      const res = await post<any>('/reports/weekly/save-group-report', payload)
      const data = res?.data ? res.data : res
      if (data) {
        setHasSavedReport(true)
        setSavedReportTime(dayjs(data.updated_at || data.created_at).format('YYYY-MM-DD HH:mm:ss'))
        message.success('团队整体周报及数据指标快照已成功存盘！')
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '保存团队整体周报失败')
    } finally {
      setGroupReportLoading(false)
    }
  }

  // 复制整体周报 Markdown 文本
  const handleCopyGroupReportText = async () => {
    if (!groupReportContent) {
      message.warning('当前无整体周报内容可复制')
      return
    }
    try {
      await navigator.clipboard.writeText(groupReportContent)
      message.success('整体周报 Markdown 文本已复制到剪贴板')
    } catch (err) {
      console.error(err)
      message.error('浏览器拒绝了复制操作，请手动选择复制')
    }
  }

  // 一键复制并发送至钉钉机器人
  const handleCopyAndSendToDingtalk = async () => {
    if (!groupReportContent) {
      message.warning('当前无整体周报内容可复制并发送')
      return
    }
    let copySuccess = false
    try {
      await navigator.clipboard.writeText(groupReportContent)
      copySuccess = true
    } catch (err) {
      console.error(err)
    }

    setDingSending(true)
    const startDateStr = mon.format('YYYY-MM-DD')

    // 1. 自动存盘到系统数据库
    try {
      const savePayload = {
        team_id: weeklyTeamId !== 'all' ? parseInt(weeklyTeamId) : null,
        third_class_bar: weeklyThirdBar !== 'all' ? weeklyThirdBar : null,
        start_date: startDateStr,
        end_date: sun.format('YYYY-MM-DD'),
        content: groupReportContent,
        marketing_signed: groupMetrics.marketing_signed,
        delivery_signed: groupMetrics.delivery_signed,
        win_bids: groupMetrics.win_bids,
        happiness_count: groupMetrics.happiness_count,
        triangle_count: groupMetrics.triangle_count,
        valid_leads: groupMetrics.valid_leads,
        potential_leads: groupMetrics.potential_leads,
        production_value: groupMetrics.production_value,
        receive_value: groupMetrics.receive_value
      }

      const saveRes = await post<any>('/reports/weekly/save-group-report', savePayload)
      const saveData = saveRes?.data ? saveRes.data : saveRes
      if (saveData) {
        setHasSavedReport(true)
        setSavedReportTime(dayjs(saveData.updated_at || saveData.created_at).format('YYYY-MM-DD HH:mm:ss'))
      }
    } catch (err: any) {
      console.error(err)
      const errMsg = err.response?.data?.detail || '保存失败，请重试'
      if (copySuccess) {
        message.warn(`周报已复制到剪贴板，但同步存盘至系统数据库失败：${errMsg}`)
      } else {
        message.error(`同步存盘至系统数据库失败：${errMsg}`)
      }
      setDingSending(false)
      return
    }

    // 2. 发送到钉钉机器人
    try {
      await post('/reports/weekly/send-group-report-to-dingtalk', {
        group_name: getGroupNameText(),
        start_date: startDateStr,
        metrics: groupMetrics,
        content: groupReportContent,
        redirect_url: window.location.origin + '/admin/weekly-reports'
      })

      if (copySuccess) {
        message.success('整体周报已复制、成功存盘数据库，并已同步推送至钉钉！')
      } else {
        message.success('整体周报已成功存盘数据库并推送至钉钉！(剪贴板复制失败，请手动复制)')
      }
    } catch (err: any) {
      console.error(err)
      const errMsg = err.response?.data?.detail || '推送失败，请重试'
      if (copySuccess) {
        message.warn(`周报已复制并成功存盘至系统数据库，但同步推送至钉钉机器人失败：${errMsg}`)
      } else {
        message.warn(`周报已成功存盘至系统数据库，但同步推送至钉钉机器人失败：${errMsg}`)
      }
    } finally {
      setDingSending(false)
    }
  }

  // 导出为 .md 文件
  const handleExportGroupReportFile = () => {
    if (!groupReportContent) {
      message.warning('无内容可导出')
      return
    }
    try {
      const groupName = getGroupNameText()
      const filename = `${groupName || '团队'}_${selectedMonday}_整体复盘周报.md`

      const blob = new Blob([groupReportContent], { type: 'text/markdown;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      message.success('整体周报已导出为 Markdown 文件')
    } catch (err) {
      console.error(err)
      message.error('导出文件失败')
    }
  }

  // 团队整体周报的 Word 导出 (调用后端 docx_exporter)
  const handleExportGroupDocx = async () => {
    if (!groupReportContent) {
      message.warning('无内容可导出')
      return
    }
    const groupName = getGroupNameText()
    const title = `${groupName || '团队'}_${selectedMonday}_整体复盘周报`

    setGroupDocxExporting(true)
    try {
      const res = await post<any>('/reports/weekly/export-docx', {
        title: title,
        metrics: groupMetrics,
        content: groupReportContent
      }, {
        responseType: 'blob'
      })

      const blob = res as unknown as Blob
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${title}.docx`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      message.success('Word 文档导出成功！')
    } catch (err: any) {
      console.error('导出 Word 异常:', err)
      message.error(err?.response?.data?.detail || '导出 Word 文档失败')
    } finally {
      setGroupDocxExporting(false)
    }
  }

  // 统一的 PDF 导出逻辑
  const handleExportPDF = async (elementId: string, filename: string, setLoader: (loading: boolean) => void) => {
    const element = document.getElementById(elementId)
    if (!element) {
      message.error('未找到可导出的页面节点')
      return
    }

    setLoader(true)
    try {
      const scale = 2
      const containerRect = element.getBoundingClientRect()
      const breakCandidatesSet = new Set<number>()

      const breakableElements = element.querySelectorAll(
        'h1, h2, h3, h4, h5, h6, p, tr, li, hr, blockquote, ' +
        'table, ul, ol, .ant-card, .ant-descriptions, .ant-descriptions-row, .ant-row'
      )
      breakableElements.forEach(el => {
        const rect = (el as HTMLElement).getBoundingClientRect()
        const bottomPx = Math.round((rect.bottom - containerRect.top) * scale) + 4
        if (bottomPx > 0) breakCandidatesSet.add(bottomPx)
      })

      Array.from(element.children).forEach(child => {
        const rect = (child as HTMLElement).getBoundingClientRect()
        const bottomPx = Math.round((rect.bottom - containerRect.top) * scale) + 4
        if (bottomPx > 0) breakCandidatesSet.add(bottomPx)
      })

      const breakPoints = Array.from(breakCandidatesSet).sort((a, b) => a - b)

      const canvas = await html2canvas(element, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })

      const canvasWidth = canvas.width
      const canvasHeight = canvas.height
      const a4Ratio = 297 / 210
      const idealPageHeight = Math.floor(canvasWidth * a4Ratio)

      const pdf = new jsPDF('p', 'mm', 'a4')
      let currentY = 0
      let pageIndex = 0

      while (currentY < canvasHeight) {
        if (pageIndex > 0) pdf.addPage()

        let sliceEndY: number
        if (currentY + idealPageHeight >= canvasHeight) {
          sliceEndY = canvasHeight
        } else {
          const idealCut = currentY + idealPageHeight
          const minCut = currentY + Math.floor(idealPageHeight * 0.5)
          const maxCut = Math.min(idealCut + Math.floor(idealPageHeight * 0.1), canvasHeight)

          let bestBreak = -1
          let bestDistance = Infinity

          for (const bp of breakPoints) {
            if (bp <= currentY) continue
            if (bp < minCut) continue
            if (bp > maxCut) break
            const distance = Math.abs(bp - idealCut)
            if (distance < bestDistance) {
              bestDistance = distance
              bestBreak = bp
            }
          }

          sliceEndY = bestBreak > currentY ? bestBreak : idealCut
        }

        const sliceHeight = sliceEndY - currentY
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvasWidth
        pageCanvas.height = idealPageHeight
        const pageCtx = pageCanvas.getContext('2d')

        if (pageCtx) {
          pageCtx.fillStyle = '#ffffff'
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
          pageCtx.drawImage(
            canvas,
            0, currentY, canvasWidth, sliceHeight,
            0, 0, canvasWidth, sliceHeight
          )
        }

        const pageData = pageCanvas.toDataURL('image/jpeg', 0.95)
        pdf.addImage(pageData, 'JPEG', 0, 0, 210, 297)

        currentY = sliceEndY
        pageIndex++
      }

      pdf.save(filename)
      message.success('PDF 战报下载成功！')
    } catch (err: any) {
      console.error('导出 PDF 异常:', err)
      message.error('导出 PDF 战报失败')
    } finally {
      setLoader(false)
    }
  }

  // 初始化拉取三级巴
  useEffect(() => {
    loadThirdClassBars()
  }, [])

  // 当团队或日期变化且并非 'all' 时，自动加载已存周报
  useEffect(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
    setAiGeneratingStatus('idle')

    if (weeklyTeamId !== 'all' || weeklyThirdBar !== 'all') {
      fetchGroupReport(false)
      const startDateStr = mon.format('YYYY-MM-DD')
      checkAiGeneratingStatus(startDateStr, weeklyTeamId, weeklyThirdBar).then((isDone) => {
        if (!isDone) {
          startStatusPolling(startDateStr, weeklyTeamId, weeklyThirdBar)
        }
      })
    } else {
      setGroupReportContent('')
      setHasSavedReport(false)
      setSavedReportTime('')
    }
  }, [weeklyDate, weeklyTeamId, weeklyThirdBar])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current)
      }
    }
  }, [])

  return (
    <div style={{ padding: '4px' }}>
      {/* 头部导航卡片 */}
      <Card bordered={false} style={{ marginBottom: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <FileTextOutlined style={{ fontSize: 24, color: '#13c2c2', marginRight: 12 }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>团队整体周复盘</Title>
            <Paragraph style={{ margin: 0, color: '#8c8c8c', marginTop: 4 }}>
              针对各战队及三级巴组织，智能汇总并提炼团队各成员周报核心内容，形成团队整体复盘快照，并支持一键推送钉钉及多格式文件导出。
            </Paragraph>
          </div>
        </div>
      </Card>

      {/* 筛选过滤工具栏 */}
      <Card bordered={false} style={{ marginBottom: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={6} md={5}>
            <DatePicker
              picker="week"
              value={weeklyDate}
              onChange={(date) => {
                if (date) setWeeklyDate(date)
              }}
              style={{ width: '100%' }}
              allowClear={false}
            />
          </Col>
          <Col xs={24} sm={6} md={5}>
            <Select
              style={{ width: '100%' }}
              value={weeklyTeamId}
              onChange={(val) => {
                setWeeklyTeamId(val)
                if (val !== 'all') setWeeklyThirdBar('all')
              }}
              options={TEAM_OPTIONS}
            />
          </Col>
          <Col xs={24} sm={6} md={5}>
            <Select
              style={{ width: '100%' }}
              value={weeklyThirdBar}
              onChange={(val) => {
                setWeeklyThirdBar(val)
                if (val !== 'all') setWeeklyTeamId('all')
              }}
              options={thirdClassBarOptions}
            />
          </Col>
          <Col xs={24} sm={6} md={9}>
            <Space>
              <Button
                type="primary"
                icon={<SyncOutlined />}
                loading={groupReportLoading}
                onClick={() => fetchGroupReport(false)}
                disabled={weeklyTeamId === 'all' && weeklyThirdBar === 'all'}
              >
                刷新与获取
              </Button>
              {allowedGroupReport && (
                <Button
                  style={{
                    backgroundColor: (weeklyTeamId === 'all' && weeklyThirdBar === 'all') || aiGeneratingStatus === 'running' ? undefined : '#13c2c2',
                    borderColor: (weeklyTeamId === 'all' && weeklyThirdBar === 'all') || aiGeneratingStatus === 'running' ? undefined : '#13c2c2',
                    color: (weeklyTeamId === 'all' && weeklyThirdBar === 'all') || aiGeneratingStatus === 'running' ? undefined : '#fff'
                  }}
                  disabled={(weeklyTeamId === 'all' && weeklyThirdBar === 'all') || aiGeneratingStatus === 'running'}
                  icon={aiGeneratingStatus === 'running' ? <SyncOutlined spin /> : <FileTextOutlined />}
                  onClick={triggerAiGenerateGroupReport}
                >
                  {aiGeneratingStatus === 'running' ? 'AI 正在后台分析中...' : '重新由 AI 智能生成'}
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 当未选择具体团队时显示引导卡片 */}
      {weeklyTeamId === 'all' && weeklyThirdBar === 'all' ? (
        <Card bordered={false} style={{ textAlign: 'center', padding: '60px 0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <Title level={5} style={{ color: '#8c8c8c' }}>请在上方选择具体的战队或三级巴组织，开始查看或生成整体周报！</Title>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 1. 指标看板区 */}
          <Card 
            title={<strong>📊 团队核心财务与播报指标看板（所选：{getGroupNameText()}）</strong>}
            bordered={false} 
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '8px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#595959' }}>营销新签合同额</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#389e0d', marginTop: 4 }}>
                  {groupMetrics.marketing_signed?.toFixed(2)} 万元
                </span>
              </div>
              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '8px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#595959' }}>交付新签合同额</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#389e0d', marginTop: 4 }}>
                  {groupMetrics.delivery_signed?.toFixed(2)} 万元
                </span>
              </div>
              <div style={{ background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '8px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#595959' }}>中标项目个数</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#096dd9', marginTop: 4 }}>
                  {groupMetrics.win_bids} 个
                </span>
              </div>
              <div style={{ background: '#fffbe6', border: '1px solid #ffd591', borderRadius: '8px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#595959' }}>幸福动作个数</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#d46b08', marginTop: 4 }}>
                  {groupMetrics.happiness_count} 次
                </span>
              </div>
              <div style={{ background: '#fffbe6', border: '1px solid #ffd591', borderRadius: '8px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#595959' }}>铁三角联动次数</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#d46b08', marginTop: 4 }}>
                  {groupMetrics.triangle_count} 次
                </span>
              </div>
              <div style={{ background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: '8px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#595959' }}>有效商机线索量</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1d39c4', marginTop: 4 }}>
                  {groupMetrics.valid_leads} 个
                </span>
              </div>
              <div style={{ background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: '8px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#595959' }}>潜力商机线索量</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1d39c4', marginTop: 4 }}>
                  {groupMetrics.potential_leads} 个
                </span>
              </div>
              <div style={{ background: '#fff0f6', border: '1px solid #ffadd2', borderRadius: '8px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#595959' }}>CRM 累计产值</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#c41d7f', marginTop: 4 }}>
                  {groupMetrics.production_value?.toFixed(2)} 万元
                </span>
              </div>
              <div style={{ background: '#fff0f6', border: '1px solid #ffadd2', borderRadius: '8px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#595959' }}>CRM 到账回款额</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#c41d7f', marginTop: 4 }}>
                  {groupMetrics.receive_value?.toFixed(2)} 万元
                </span>
              </div>
            </div>
          </Card>

          {/* 2. 编辑预览区 */}
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>📝 团队整体周报正文</span>
                <Radio.Group 
                  value={previewMode} 
                  onChange={(e) => setPreviewMode(e.target.value)} 
                  size="small"
                >
                  <Radio.Button value="edit">
                    <EditOutlined /> 编辑源码
                  </Radio.Button>
                  <Radio.Button value="preview">
                    <EyeOutlined /> 实时预览
                  </Radio.Button>
                </Radio.Group>
              </div>
            }
            bordered={false} 
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
          >
            {/* 存盘状态 Alert */}
            {aiGeneratingStatus === 'running' ? (
              <Alert
                message={
                  <span style={{ fontSize: '13px' }}>
                    <strong>⚡ AI 正在后台为您重新整理生成团队周报中，请稍候...</strong>
                    在生成期间，您可以继续浏览和编辑旧数据。生成完毕后系统会自动存盘并刷新数据展示。
                  </span>
                }
                type="warning"
                showIcon
                icon={<SyncOutlined spin />}
                style={{ marginBottom: 16 }}
              />
            ) : (
              <Alert
                message={
                  <span style={{ fontSize: '13px' }}>
                    <strong>{hasSavedReport ? "已加载系统数据库存档快照" : "当前内容由 AI 智能生成（暂未存盘）"}</strong>。
                    {hasSavedReport 
                      ? `（存档时间：${savedReportTime}）。您可以随时直接微调内容，或点击上方的“重新由 AI 智能生成”刷新内容并保存覆盖。`
                      : "您可以在下方直接进行编辑润色调整，确认后点击底部的“保存至系统数据库”存盘。"
                    }
                  </span>
                }
                type={hasSavedReport ? "success" : "info"}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {groupReportLoading ? (
              <div style={{ textAlign: 'center', padding: '100px 0', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
                <Spin tip="AI 正在分析并整理团队成员的周复盘数据中，这可能需要一点时间..." />
              </div>
            ) : (
              <div>
                {previewMode === 'edit' ? (
                  <Input.TextArea
                    rows={22}
                    value={groupReportContent}
                    onChange={(e) => setGroupReportContent(e.target.value)}
                    placeholder="大模型正在分析和生成中，这可能需要一点时间..."
                    style={{ fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.6', backgroundColor: '#fafafa' }}
                  />
                ) : (
                  <MarkdownPreview text={groupReportContent} />
                )}
              </div>
            )}
          </Card>

          {/* 3. 底部操作底栏 */}
          <Card bordered={false} style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space size="middle" wrap>
                  <Button 
                    type="primary" 
                    icon={<SaveOutlined />}
                    loading={groupReportLoading}
                    onClick={handleSaveGroupReport}
                  >
                    保存至系统数据库
                  </Button>
                  <Button 
                    icon={<SendOutlined />} 
                    loading={dingSending}
                    onClick={handleCopyAndSendToDingtalk}
                  >
                    一键复制并发送到钉钉
                  </Button>
                  <Button 
                    icon={<CopyOutlined />} 
                    onClick={handleCopyGroupReportText}
                  >
                    仅复制Markdown
                  </Button>
                </Space>
              </Col>
              <Col>
                <Space size="middle" wrap>
                  <Button 
                    icon={<DownloadOutlined />} 
                    onClick={handleExportGroupReportFile}
                  >
                    导出 Markdown (.md)
                  </Button>
                  <Button 
                    icon={<DownloadOutlined />} 
                    loading={groupPdfExporting}
                    onClick={() => handleExportPDF('group-report-pdf-export-temp', `${getGroupNameText()}_${selectedMonday}_整体复盘周报.pdf`, setGroupPdfExporting)}
                  >
                    导出 PDF战报
                  </Button>
                  <Button 
                    icon={<DownloadOutlined />} 
                    loading={groupDocxExporting}
                    onClick={handleExportGroupDocx}
                  >
                    导出 Word 文档
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </div>
      )}

      {/* 隐藏的用于 PDF 导出的整体周报渲染模板 */}
      <div style={{ position: 'absolute', top: -9999, left: -9999, width: '794px', zIndex: -100 }}>
        <div id="group-report-pdf-export-temp" style={{ padding: '32px', backgroundColor: '#ffffff', minHeight: '297mm' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#102a4c', margin: '0 0 8px 0' }}>
              📅 团队整体复盘周报（{getGroupNameText()}）
            </h1>
            <div style={{ fontSize: '13px', color: '#595959' }}>
              时间跨度：{selectedMonday} ~ {selectedSunday}
            </div>
          </div>

          <div style={{ marginBottom: '20px', border: '1px solid #e8e8e8', borderRadius: '4px', padding: '16px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '12px', color: '#102a4c' }}>📊 团队核心财务与播报指标汇总</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div>营销新签：<strong>{groupMetrics.marketing_signed?.toFixed(2)} 万元</strong></div>
              <div>交付新签：<strong>{groupMetrics.delivery_signed?.toFixed(2)} 万元</strong></div>
              <div>中标个数：<strong>{groupMetrics.win_bids} 个</strong></div>
              <div>幸福动作：<strong>{groupMetrics.happiness_count} 次</strong></div>
              <div>铁三角数：<strong>{groupMetrics.triangle_count} 次</strong></div>
              <div>有效商机：<strong>{groupMetrics.valid_leads} 个</strong></div>
              <div>潜力商机：<strong>{groupMetrics.potential_leads} 个</strong></div>
              <div>CRM产值：<strong>{groupMetrics.production_value?.toFixed(2)} 万元</strong></div>
              <div>回款金额：<strong>{groupMetrics.receive_value?.toFixed(2)} 万元</strong></div>
            </div>
          </div>

          <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#262626', marginBottom: '12px', borderBottom: '1px solid #e8e8e8', paddingBottom: '4px' }}>📝 团队整体周报正文</div>
          <MarkdownPreview text={groupReportContent} />
        </div>
      </div>
    </div>
  )
}

// 外部自定义 Markdown 渲染预览组件
interface MarkdownPreviewProps {
  text: string;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ text }) => {
  if (!text) return <div style={{ color: '#bfbfbf', fontStyle: 'italic', padding: '20px' }}>暂无内容</div>;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let tableAligns: ('left' | 'center' | 'right')[] = [];
  
  let inList = false;
  let listItems: string[] = [];

  const parseInlineMarkdown = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*)/g;
    const splitParts = str.split(regex);
    
    splitParts.forEach((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        parts.push(<strong key={index}>{part.slice(2, -2)}</strong>);
      } else {
        parts.push(part);
      }
    });
    return parts;
  };

  const renderTable = (headers: string[], rows: string[][], aligns: ('left' | 'center' | 'right')[], key: number) => {
    return (
      <div key={key} style={{ overflowX: 'auto', marginBottom: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #f0f0f0' }}>
          <thead>
            <tr style={{ backgroundColor: '#fafafa' }}>
              {headers.map((h, i) => (
                <th 
                  key={i} 
                  style={{ 
                    border: '1px solid #f0f0f0', 
                    padding: '6px 10px', 
                    fontWeight: '600', 
                    textAlign: aligns[i] || 'left',
                    color: '#262626'
                  }}
                >
                  {parseInlineMarkdown(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} style={{ backgroundColor: rIdx % 2 === 1 ? '#fafafa' : '#fff' }}>
                {row.map((cell, cIdx) => (
                  <td 
                    key={cIdx} 
                    style={{ 
                      border: '1px solid #f0f0f0', 
                      padding: '6px 10px', 
                      textAlign: aligns[cIdx] || 'left',
                      color: '#595959'
                    }}
                  >
                    {parseInlineMarkdown(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderList = (items: string[], key: number) => {
    return (
      <ul key={key} style={{ paddingLeft: '18px', marginBottom: '12px', listStyleType: 'disc' }}>
        {items.map((item, i) => (
          <li key={i} style={{ marginBottom: '4px', fontSize: '12.5px', lineHeight: '1.5', color: '#434343' }}>
            {parseInlineMarkdown(item)}
          </li>
        ))}
      </ul>
    );
  };

  let elementKey = 0;

  const flushTable = () => {
    if (inTable) {
      elements.push(renderTable(tableHeaders, tableRows, tableAligns, elementKey++));
      inTable = false;
      tableHeaders = [];
      tableRows = [];
      tableAligns = [];
    }
  };

  const flushList = () => {
    if (inList) {
      elements.push(renderList(listItems, elementKey++));
      inList = false;
      listItems = [];
    }
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();

    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
      const cells = line.split('|').map(c => c.trim()).slice(1, -1);
      
      if (!inTable) {
        tableHeaders = cells;
        inTable = true;
        if (idx + 1 < lines.length) {
          const nextLine = lines[idx + 1].trim();
          if (nextLine.startsWith('|') && nextLine.includes('---')) {
            const alignCells = nextLine.split('|').map(c => c.trim()).slice(1, -1);
            tableAligns = alignCells.map(c => {
              if (c.startsWith(':') && c.endsWith(':')) return 'center';
              if (c.endsWith(':')) return 'right';
              return 'left';
            });
            idx++;
          }
        }
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      inList = true;
      listItems.push(line.slice(2));
      continue;
    } else {
      flushList();
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={elementKey++} style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '2px solid #f0f0f0', paddingBottom: '6px', marginTop: '12px', marginBottom: '10px', color: '#141414' }}>
          {parseInlineMarkdown(line.slice(2))}
        </h1>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={elementKey++} style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '10px', marginBottom: '6px', color: '#1f1f1f', borderLeft: '3px solid #13c2c2', paddingLeft: '8px' }}>
          {parseInlineMarkdown(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={elementKey++} style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '8px', marginBottom: '4px', color: '#434343' }}>
          {parseInlineMarkdown(line.slice(4))}
        </h3>
      );
      continue;
    }

    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={elementKey++} style={{ borderLeft: '3px solid #13c2c2', padding: '4px 10px', background: '#e6fffb', margin: '0 0 10px 0', borderRadius: '0 4px 4px 0', fontSize: '12px', color: '#595959' }}>
          {parseInlineMarkdown(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    if (line === '') {
      if (elements.length > 0 && elements[elements.length - 1] !== 'br') {
        elements.push(<div key={elementKey++} style={{ height: '6px' }} />);
      }
      continue;
    }

    elements.push(
      <p key={elementKey++} style={{ fontSize: '12.5px', lineHeight: '1.5', marginBottom: '6px', color: '#262626' }}>
        {parseInlineMarkdown(line)}
      </p>
    );
  }

  flushTable();
  flushList();

  return (
    <div 
      className="markdown-body" 
      style={{ 
        padding: '16px', 
        background: '#fff', 
        border: '1px solid #d9d9d9', 
        borderRadius: '6px', 
        minHeight: '380px',
        color: '#262626',
        textAlign: 'left'
      }}
    >
      {elements}
    </div>
  );
};

export default TeamWeeklyReports;
