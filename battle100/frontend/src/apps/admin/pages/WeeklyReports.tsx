import React, { useEffect, useState, useMemo } from 'react'
import {
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Input,
  Form,
  Card,
  Typography,
  message,
  Select,
  Row,
  Col,
  Popconfirm,
  DatePicker,
  Descriptions,
  Checkbox,
  Tabs
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  SyncOutlined,
  FilterOutlined,
  EyeOutlined,
  DownloadOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { get, post, put, del } from '@shared/api/client'
import { useAuthStore } from '@shared/stores/authStore'
import dayjs from 'dayjs'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const { Text } = Typography

// 统一防闪烁、支持多行排版及最大高度限制的可滚动单元格 tooltip 渲染辅助函数
const renderEllipsisText = (content: string, options?: { color?: string, fontWeight?: string }) => {
  if (!content || content === '—') return '—';
  return (
    <Text
      ellipsis={{
        tooltip: {
          title: <div style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto' }}>{content}</div>,
          overlayClassName: 'tooltip-no-pointer-events',
          mouseLeaveDelay: 0.1
        }
      }}
      style={options?.color || options?.fontWeight ? { color: options.color, fontWeight: options.fontWeight } : undefined}
    >
      {content}
    </Text>
  );
};



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

const DEFAULT_TEMPLATES: Record<string, string> = {
  delivery_plan: "项目交付工作：（需要做什么项目、什么内容，到什么节点）\n1. \n2. \n3. ",
  sales_plan: "销售：（新签、回款、营销动作，新签动作包括：新签合同跟进、报价、合同入系统、营销线索等；回款动作包括：对接业主请款、申请开票、定期问询请款情况等；营销动作：获取营销线索、潜在项目分析、拜访客户等）\n1. \n2. \n3. ",
  delivery_actual: "项目交付工作：（做了什么项目，什么内容，到什么节点，幸福动作等）\n1. \n2. \n3. ",
  sales_actual: "销售：（已签约、中标、铁三角现场联动、拜访等）\n1. \n2. \n3. ",
  delivery_highlights: "【项目】\n1. \n2. ",
  sales_highlights: "【销售】\n1. \n2. ",
  delivery_blockers: "【项目难点】\n1. \n2. ",
  sales_blockers: "【销售难点】\n1. \n2. ",
  delivery_support: "项目侧：",
  sales_support: "销售侧：",
  next_delivery_plan: "项目交付工作：（做了什么项目，什么内容，到什么节点）\n1. \n2. \n3. ",
  next_sales_plan: "销售：（新签、回款、营销动作等）\n1. \n2. \n3. "
}

// 判定是否为播报无数据的兜底文本
const isDummyBroadcast = (text: string) => {
  if (!text) return true
  const clean = text.trim()
  return clean === '1. 无相关播报数据' || clean === ''
}

// 判定是否为 CRM 无数据的兜底文本
const isDummyCrmActual = (text: string, isMarketing: boolean) => {
  if (!text) return true
  const clean = text.trim()
  if (isMarketing) {
    return clean === '1. 本周暂无相关的合同新签、到账回款与客户拜访登记。' || clean === ''
  } else {
    return clean === '1. 本周名下负责的正在实施项目推进平稳，无重大子任务或里程碑完成提交。' || clean === ''
  }
}

const WeeklyReports: React.FC = () => {
  const { user } = useAuthStore()
  // 是否属于营销岗/目标官等
  const isMarketing = user?.position_type === 'marketing' || ['target_officer', 'marketing_staff', 'tech_marketing'].includes(user?.role || '');
  // 是否为全局管理权限角色
  const isGlobalUser = user?.role === 'admin' || user?.role === 'target_officer';

  // 当前活动 Tab：'report' 为员工填报周报汇总，'report_horizontal' 为团队周报汇总横板，'crm' 为 CRM 业务数据汇总
  const [activeTab, setActiveTab] = useState<'report' | 'report_horizontal' | 'crm' | 'crm_horizontal'>('report')

  // CRM 业务汇总相关状态
  const [crmReports, setCrmReports] = useState<any[]>([])
  const [crmLoading, setCrmLoading] = useState(false)
  const [crmPage, setCrmPage] = useState(1)
  const [crmPageSize, setCrmPageSize] = useState(10)
  const [crmTotal, setCrmTotal] = useState(0)

  // CRM 业务汇总横板相关独立状态，所有注释必须使用中文
  const [crmHorizontalReports, setCrmHorizontalReports] = useState<any[]>([])
  const [crmHorizontalLoading, setCrmHorizontalLoading] = useState(false)
  const [crmHorizontalPage, setCrmHorizontalPage] = useState(1)
  const [crmHorizontalPageSize, setCrmHorizontalPageSize] = useState(8) // 横板每页默认展示 8 个人(列)
  const [crmHorizontalTotal, setCrmHorizontalTotal] = useState(0)

  // 团队周报汇总横板相关独立状态，所有注释必须使用中文
  const [weeklyHorizontalReports, setWeeklyHorizontalReports] = useState<any[]>([])
  const [weeklyHorizontalLoading, setWeeklyHorizontalLoading] = useState(false)
  const [weeklyHorizontalPage, setWeeklyHorizontalPage] = useState(1)
  const [weeklyHorizontalPageSize, setWeeklyHorizontalPageSize] = useState(8) // 横板每页默认展示 8 个人(列)
  const [weeklyHorizontalTotal, setWeeklyHorizontalTotal] = useState(0)

  // 个人 CRM 业务详情弹窗状态
  const [crmViewVisible, setCrmViewVisible] = useState(false)
  const [viewingCrmReport, setViewingCrmReport] = useState<any>(null)

  // 三级巴筛选状态
  const [weeklyThirdBar, setWeeklyThirdBar] = useState<string>('all')
  const [thirdClassBarOptions, setThirdClassBarOptions] = useState<{ label: string; value: string }[]>([])

  // 人名多选筛选状态与成员下拉选项
  const [searchNames, setSearchNames] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])


  // 周复盘汇总相关状态，默认当前周
  const [weeklyDate, setWeeklyDate] = useState<dayjs.Dayjs>(() => dayjs())
  // 战队筛选：非全局角色默认限制为本战队
  const [weeklyTeamId, setWeeklyTeamId] = useState<string>(
    !isGlobalUser && user?.teamId ? String(user.teamId) : 'all'
  )
  const [weeklyReports, setWeeklyReports] = useState<any[]>([])
  const [weeklyLoading, setWeeklyLoading] = useState(false)

  // 周复盘汇总表分页状态
  const [weeklyPage, setWeeklyPage] = useState(1)
  const [weeklyPageSize, setWeeklyPageSize] = useState(10)
  const [weeklyTotal, setWeeklyTotal] = useState(0)

  // 周报汇总表多选状态
  const [weeklySelectedRowKeys, setWeeklySelectedRowKeys] = useState<React.Key[]>([])

  // 是否已经填写过本周的周报状态
  const [hasMineReport, setHasMineReport] = useState(false)

  // 周报查看弹窗状态
  const [weeklyViewVisible, setWeeklyViewVisible] = useState(false)
  const [viewingWeeklyReport, setViewingWeeklyReport] = useState<any>(null)
  const isViewingMarketing = viewingWeeklyReport?.user_position_type === 'marketing' ||
    ['target_officer', 'marketing_staff', 'tech_marketing'].includes(viewingWeeklyReport?.user_role || '');

  // 周报编辑相关状态
  const [weeklyEditVisible, setWeeklyEditVisible] = useState(false)
  const [editingWeeklyReport, setEditingWeeklyReport] = useState<any>(null)
  const [weeklyEditLoading, setWeeklyEditLoading] = useState(false)
  const [weeklyEditForm] = Form.useForm()

  // 计算给定日期所在周的周一和周日 (自适应 locale)
  const getMondayAndSunday = (dateVal: dayjs.Dayjs) => {
    const day = dateVal.day()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const mon = dateVal.add(diffToMonday, 'day')
    const sun = mon.add(6, 'day')
    return [mon, sun]
  }

  // PC端个人周复盘填写相关状态
  const [weeklyWriteVisible, setWeeklyWriteVisible] = useState(false)
  const [weeklyWriteLoading, setWeeklyWriteLoading] = useState(false)
  const [weeklyExtractLoading, setWeeklyExtractLoading] = useState(false)
  const [weeklyCrmExtractLoading, setWeeklyCrmExtractLoading] = useState(false)
  const [weeklySubmitLoading, setWeeklySubmitLoading] = useState(false)
  const [weeklyStatusToSubmit, setWeeklyStatusToSubmit] = useState<'draft' | 'submitted'>('draft')
  const [weeklyForm] = Form.useForm()

  // ⚡ 智能拉取 CRM 业绩与进度预览弹窗状态
  const [crmPreviewVisible, setCrmPreviewVisible] = useState(false)
  const [crmPreviewData, setCrmPreviewData] = useState<any>(null)
  const [crmSelectedKeys, setCrmSelectedKeys] = useState<Record<string, boolean>>({
    actual: true,
    rate: true,
    highlights: true,
    blockers: true,
    crm_active_projects: true,
    crm_milestone_tasks: true,
    crm_suspended_projects: true,
    crm_no_contract_warning: true,
    crm_unbilled_warning: true,
    crm_unreceived_warning: true,
    crm_health_diagnosis: true
  })

  // AI 助手智能整理状态
  const [weeklyAiOptimizing, setWeeklyAiOptimizing] = useState(false)
  const [aiOptimizeModalVisible, setAiOptimizeModalVisible] = useState(false)
  const [aiOptimizeForm] = Form.useForm()


  const [userPdfExporting, setUserPdfExporting] = useState(false)
  const [userDocxExporting, setUserDocxExporting] = useState(false)

  // 动态计算在当前战队和三级巴过滤下可选的成员姓名列表
  const memberOptions = useMemo(() => {
    if (!allUsers || allUsers.length === 0) return []
    
    const filtered = allUsers.filter((u: any) => {
      // 1. 战队/小组筛选过滤
      // 如果是非全局角色，强制传递自身的 teamId 进行校验
      const targetTeamId = !isGlobalUser && user?.teamId ? String(user.teamId) : weeklyTeamId
      if (targetTeamId && targetTeamId !== 'all') {
        if (String(u.team_id) !== String(targetTeamId)) {
          return false
        }
      }
      
      // 2. 三级巴筛选过滤
      if (weeklyThirdBar && weeklyThirdBar !== 'all') {
        if (u.third_class_bar !== weeklyThirdBar) {
          return false
        }
      }
      
      return true
    })

    const names = Array.from(new Set(filtered.map((u: any) => u.name).filter(Boolean))) as string[]
    names.sort()
    return names.map(name => ({ label: name, value: name }))
  }, [allUsers, weeklyTeamId, weeklyThirdBar, isGlobalUser, user])

  // 当可选成员名单发生变化时，自动将已选中但不符合新筛选范围的人名剔除
  useEffect(() => {
    if (searchNames.length > 0) {
      const validNames = memberOptions.map(opt => opt.value)
      const filtered = searchNames.filter(name => validNames.includes(name))
      if (filtered.length !== searchNames.length) {
        setSearchNames(filtered)
      }
    }
  }, [memberOptions])

  const handleAiOptimizeWeekly = async () => {
    const values = weeklyForm.getFieldsValue()
    const target_plan = isMarketing ? values.sales_plan : values.delivery_plan
    const actual = isMarketing ? values.sales_actual : values.delivery_actual
    const highlights = isMarketing ? values.sales_highlights : values.delivery_highlights
    const blockers = isMarketing ? values.sales_blockers : values.delivery_blockers
    const support = isMarketing ? values.sales_support : values.delivery_support
    const next_plan = isMarketing ? values.next_sales_plan : values.next_delivery_plan

    const isActualEmpty = !actual || actual.trim() === '' || actual.includes('做了什么项目') || actual.includes('销售：（已签约')
    const isHighlightsEmpty = !highlights || highlights.trim() === '' || highlights.includes('【项目】') || highlights.includes('【销售】')
    const isBlockersEmpty = !blockers || blockers.trim() === '' || blockers.includes('项目难点') || blockers.includes('销售难点')
    const isSupportEmpty = !support || support.trim() === '' || support.includes('项目侧：') || support.includes('销售侧：')
    const isNextPlanEmpty = !next_plan || next_plan.trim() === '' || next_plan.includes('项目交付工作') || next_plan.includes('销售：（新签')

    if (isActualEmpty && isHighlightsEmpty && isBlockersEmpty && isSupportEmpty && isNextPlanEmpty) {
      message.warning('当前“本周实际完成”、“本周工作亮点”、“本周工作卡点/难点”、“需要支持”及“下周工作目标”均为空，请先填写或导入数据！')
      return
    }

    setWeeklyAiOptimizing(true)
    try {
      const res = await post<any>('/llm/agents/extractor/chat', {
        variables: {
          target_plan: target_plan || '',
          actual: actual || '',
          highlights: highlights || '',
          blockers: blockers || '',
          support: support || '',
          next_plan: next_plan || ''
        },
        response_format_json: true
      })
      
      const content = res?.data?.content || res?.content
      if (content) {
        aiOptimizeForm.setFieldsValue({
          actual: content.actual || '',
          highlights: content.highlights || '',
          blockers: content.blockers || '',
          support: content.support || '',
          next_plan: content.next_plan || ''
        })
        setAiOptimizeModalVisible(true)
      } else {
        message.error('AI 整理返回的数据格式不正确')
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || 'AI 智能整理失败，请重试')
    } finally {
      setWeeklyAiOptimizing(false)
    }
  }

  const handleConfirmAiOptimize = () => {
    const values = aiOptimizeForm.getFieldsValue()
    
    // 增加回写逻辑：支持项不直接覆盖原内容，若AI整理出新内容，则追加拼接在原内容后
    const oldSupport = weeklyForm.getFieldValue(isMarketing ? 'sales_support' : 'delivery_support') || ''
    const aiSupport = values.support || ''
    let finalSupport = oldSupport
    if (aiSupport.trim() && aiSupport !== '无' && aiSupport !== '暂无') {
      const cleanOld = oldSupport.trim()
      const cleanAi = aiSupport.trim()
      if (cleanOld === '项目侧：' || cleanOld === '销售侧：') {
        finalSupport = cleanAi
      } else if (cleanOld) {
        if (!cleanOld.includes(cleanAi)) {
          finalSupport = `${cleanOld}\n${cleanAi}`
        }
      } else {
        finalSupport = cleanAi
      }
    }

    if (isMarketing) {
      weeklyForm.setFieldsValue({
        sales_actual: values.actual,
        sales_highlights: values.highlights,
        sales_blockers: values.blockers,
        sales_support: finalSupport,
        next_sales_plan: values.next_plan
      })
    } else {
      weeklyForm.setFieldsValue({
        delivery_actual: values.actual,
        delivery_highlights: values.highlights,
        delivery_blockers: values.blockers,
        delivery_support: finalSupport,
        next_delivery_plan: values.next_plan
      })
    }
    setAiOptimizeModalVisible(false)
    message.success('已成功将 AI 整理优化后的内容填回周报表单！')
  }





  // 统一的 PDF 导出逻辑 (基于 DOM 元素边界映射的智能分页，从 DOM 语义结构层面杜绝跨页断裂)
  const handleExportPDF = async (elementId: string, filename: string, setLoader: (loading: boolean) => void) => {
    const element = document.getElementById(elementId)
    if (!element) {
      message.error('未找到可导出的页面节点')
      return
    }
    
    setLoader(true)
    try {
      const scale = 2 // 与 html2canvas scale 保持一致

      // ===== 第一步：截图前扫描 DOM 结构，收集所有安全分页断点 =====
      const containerRect = element.getBoundingClientRect()
      const breakCandidatesSet = new Set<number>()

      // 收集所有代表自然内容边界的元素底部位置（表格行、段落、列表项、卡片、标题等）
      const breakableElements = element.querySelectorAll(
        'h1, h2, h3, h4, h5, h6, p, tr, li, hr, blockquote, ' +
        'table, ul, ol, .ant-card, .ant-descriptions, .ant-descriptions-row, .ant-row'
      )
      breakableElements.forEach(el => {
        const rect = (el as HTMLElement).getBoundingClientRect()
        // 元素底部相对容器顶部的像素距离，乘以 scale 映射到 canvas 坐标系，+4px 确保切在元素外边距区域
        const bottomPx = Math.round((rect.bottom - containerRect.top) * scale) + 4
        if (bottomPx > 0) breakCandidatesSet.add(bottomPx)
      })

      // 同时收集容器直接子元素的底部边界（覆盖未被上方选择器匹配到的自定义 div 容器）
      Array.from(element.children).forEach(child => {
        const rect = (child as HTMLElement).getBoundingClientRect()
        const bottomPx = Math.round((rect.bottom - containerRect.top) * scale) + 4
        if (bottomPx > 0) breakCandidatesSet.add(bottomPx)
      })

      // 排序构建安全分页点有序数组
      const breakPoints = Array.from(breakCandidatesSet).sort((a, b) => a - b)

      // ===== 第二步：高清截图 =====
      const canvas = await html2canvas(element, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })

      const canvasWidth = canvas.width
      const canvasHeight = canvas.height
      const a4Ratio = 297 / 210 // A4 标准高宽比
      const idealPageHeight = Math.floor(canvasWidth * a4Ratio)

      const pdf = new jsPDF('p', 'mm', 'a4')

      // ===== 第三步：基于断点地图进行智能分页 =====
      let currentY = 0
      let pageIndex = 0

      while (currentY < canvasHeight) {
        if (pageIndex > 0) pdf.addPage()

        let sliceEndY: number

        if (currentY + idealPageHeight >= canvasHeight) {
          // 最后一页：取剩余所有内容
          sliceEndY = canvasHeight
        } else {
          const idealCut = currentY + idealPageHeight
          // 搜索范围：理想线向上回退 50%，向下前探 10%
          const minCut = currentY + Math.floor(idealPageHeight * 0.5)
          const maxCut = Math.min(idealCut + Math.floor(idealPageHeight * 0.1), canvasHeight)

          // 在断点列表中找最接近理想切割线的安全位置
          let bestBreak = -1
          let bestDistance = Infinity

          for (const bp of breakPoints) {
            if (bp <= currentY) continue     // 已经在当前页之前，跳过
            if (bp < minCut) continue         // 太靠上，页面会太短
            if (bp > maxCut) break            // 超出最大范围，后续更大不用看了
            const distance = Math.abs(bp - idealCut)
            if (distance < bestDistance) {
              bestDistance = distance
              bestBreak = bp
            }
          }

          sliceEndY = bestBreak > currentY ? bestBreak : idealCut
        }

        const sliceHeight = sliceEndY - currentY

        // 创建当前页的独立 Canvas，固定为 A4 比例尺寸
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvasWidth
        pageCanvas.height = idealPageHeight // 始终保持 A4 比例高度
        const pageCtx = pageCanvas.getContext('2d')

        if (pageCtx) {
          // 先填满白色底色
          pageCtx.fillStyle = '#ffffff'
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
          // 将从长图裁剪出的当前页内容绘制到页面顶部（下方自然留白）
          pageCtx.drawImage(
            canvas,
            0, currentY, canvasWidth, sliceHeight, // 源图裁剪区域
            0, 0, canvasWidth, sliceHeight          // 目标页面顶部对齐
          )
        }

        const pageData = pageCanvas.toDataURL('image/jpeg', 0.95)
        pdf.addImage(pageData, 'JPEG', 0, 0, 210, 297) // 填满 A4 页面 210mm × 297mm

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



  // 个人周报的 Word 导出 (拼接 Markdown 内容后调用后端接口)
  const handleExportUserDocx = async () => {
    if (!viewingWeeklyReport) return
    
    const isMarketingUser = viewingWeeklyReport.user_position_type === 'marketing' ||
      ['target_officer', 'marketing_staff', 'tech_marketing'].includes(viewingWeeklyReport.user_role || '')
      
    const userName = viewingWeeklyReport.user_name
    const title = `${userName}_${selectedMonday}_个人周复盘`
    
    let mdContent = ''
    mdContent += `# 🎯 本周目标计划\n${isMarketingUser ? (viewingWeeklyReport.sales_plan || '—') : (viewingWeeklyReport.delivery_plan || '—')}\n\n`
    mdContent += `# 🔥 本周实际完成\n${isMarketingUser ? (viewingWeeklyReport.sales_actual || '—') : (viewingWeeklyReport.delivery_actual || '—')}\n\n`
    mdContent += `# 📊 计划达成率说明\n${isMarketingUser ? (viewingWeeklyReport.sales_rate || '—') : (viewingWeeklyReport.delivery_rate || '—')}\n\n`
    mdContent += `# 🏆 本周工作亮点\n${isMarketingUser ? (viewingWeeklyReport.sales_highlights || '—') : (viewingWeeklyReport.delivery_highlights || '—')}\n\n`
    mdContent += `# 🚧 本周工作卡点/难点\n${isMarketingUser ? (viewingWeeklyReport.sales_blockers || '—') : (viewingWeeklyReport.delivery_blockers || '—')}\n\n`
    mdContent += `# 🤝 需要支持协调\n${isMarketingUser ? (viewingWeeklyReport.sales_support || '—') : (viewingWeeklyReport.delivery_support || '—')}\n\n`
    mdContent += `# 🚀 下周工作目标\n${isMarketingUser ? (viewingWeeklyReport.next_sales_plan || '—') : (viewingWeeklyReport.next_delivery_plan || '—')}\n`

    setUserDocxExporting(true)
    try {
      const res = await post<any>('/reports/weekly/export-docx', {
        title: title,
        metrics: null, // 个人周报不单独拼装 metrics 表
        content: mdContent
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
      setUserDocxExporting(false)
    }
  }



  // 动态权限校验函数 (支持系统管理员 admin 与默认配置兜底)
  const hasPermission = (perm: string) => {
    if (user?.role === 'admin') return true
    const userPerms = (user as any)?.permissions
    if (!userPerms || userPerms.length === 0) {
      if (perm === 'view_weekly_reports') {
        return true
      }
      if (perm === 'edit_weekly_report' || perm === 'delete_weekly_report') {
        return user?.role === 'admin' || user?.role === 'target_officer'
      }
      return true
    }
    return userPerms.includes(perm)
  }

  // 检查当周自己是否有填写周报记录
  const checkMyReport = async () => {
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      const res = await get<any>(`/reports/weekly/mine?start_date=${startDateStr}`)
      const data = res?.data ? res.data : res
      if (data && data.id) {
        setHasMineReport(true)
      } else {
        setHasMineReport(false)
      }
    } catch (err) {
      setHasMineReport(false)
    }
  }

  // 自动提取当周实际完成
  const handleAutoExtractWeekly = async () => {
    setWeeklyExtractLoading(true)
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      const res = await get<any>(`/reports/weekly/auto-extract?start_date=${startDateStr}`)
      const data = res?.data ? res.data : res
      if (data) {
        weeklyForm.setFieldsValue({
          delivery_actual: data.delivery_actual,
          sales_actual: data.sales_actual
        })
        message.success('已成功导入上周实际完成及本周播报数据！')
      }
    } catch (err) {
      console.error(err)
      message.error('导入上周周报与本周播报数据失败')
    } finally {
      setWeeklyExtractLoading(false)
    }
  }

  // ⚡ 智能拉取 CRM 业绩与进度数据
  const handleAutoExtractCrmWeekly = async () => {
    setWeeklyCrmExtractLoading(true)
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      const res = await get<any>(`/reports/weekly/auto-extract-crm?start_date=${startDateStr}`)
      const data = res?.data ? res.data : res
      if (data) {
        setCrmPreviewData(data)
        
        // 尝试从 localStorage 读取上一次勾选的配置以实现“系统记住勾选偏好”
        const savedKeysStr = localStorage.getItem(isMarketing ? 'crm_selected_keys_marketing' : 'crm_selected_keys_delivery')
        let loadedKeys: Record<string, boolean> | null = null
        if (savedKeysStr) {
          try {
            loadedKeys = JSON.parse(savedKeysStr)
          } catch (e) {
            console.error('解析本地保存的 CRM 勾选状态失败', e)
          }
        }

        if (loadedKeys) {
          // 将已保存的勾选状态和当前状态结合（确保新增的 key 不会因为旧配置而丢失）
          setCrmSelectedKeys({
            actual: loadedKeys.actual !== undefined ? loadedKeys.actual : true,
            rate: loadedKeys.rate !== undefined ? loadedKeys.rate : true,
            highlights: loadedKeys.highlights !== undefined ? loadedKeys.highlights : true,
            blockers: loadedKeys.blockers !== undefined ? loadedKeys.blockers : true,
            crm_active_projects: loadedKeys.crm_active_projects !== undefined ? loadedKeys.crm_active_projects : true,
            crm_milestone_tasks: loadedKeys.crm_milestone_tasks !== undefined ? loadedKeys.crm_milestone_tasks : true,
            crm_suspended_projects: loadedKeys.crm_suspended_projects !== undefined ? loadedKeys.crm_suspended_projects : true,
            crm_no_contract_warning: loadedKeys.crm_no_contract_warning !== undefined ? loadedKeys.crm_no_contract_warning : true,
            crm_unbilled_warning: loadedKeys.crm_unbilled_warning !== undefined ? loadedKeys.crm_unbilled_warning : true,
            crm_unreceived_warning: loadedKeys.crm_unreceived_warning !== undefined ? loadedKeys.crm_unreceived_warning : true,
            crm_health_diagnosis: loadedKeys.crm_health_diagnosis !== undefined ? loadedKeys.crm_health_diagnosis : true
          })
        } else {
          // 首次或无本地保存配置时，使用智能诊断规则进行初次高亮勾选推荐
          const actualVal = isMarketing ? data.sales_actual : data.delivery_actual
          const rateVal = isMarketing ? data.sales_rate : data.delivery_rate
          const highlightsVal = isMarketing ? data.sales_highlights : data.delivery_highlights
          const blockersVal = isMarketing ? data.sales_blockers : data.delivery_blockers

          if (isMarketing) {
            setCrmSelectedKeys({
              actual: !!actualVal && !isDummyCrmActual(actualVal, true),
              rate: !!rateVal && rateVal !== '月度新签与回款指标正在统计中' && rateVal.trim() !== '',
              highlights: !!highlightsVal && highlightsVal !== '1. 本周销售签约及商务拓展平稳推进。' && highlightsVal.trim() !== '',
              blockers: !!blockersVal && blockersVal !== '1. 目前名下意向商机及收款合同暂无重大异常阻碍。' && blockersVal.trim() !== '',
              crm_active_projects: true,
              crm_milestone_tasks: true,
              crm_suspended_projects: true,
              crm_no_contract_warning: true,
              crm_unbilled_warning: true,
              crm_unreceived_warning: true,
              crm_health_diagnosis: true
            })
          } else {
            setCrmSelectedKeys({
              actual: true,
              blockers: true,
              rate: !!rateVal && rateVal !== '月度指标正在统计中' && rateVal.trim() !== '',
              highlights: !!highlightsVal && highlightsVal !== '1. 交付工作处于正常开发推进中，开发交付无积压。' && highlightsVal.trim() !== '',
              crm_active_projects: !!data.crm_active_projects && data.crm_active_projects !== '—',
              crm_milestone_tasks: !!data.crm_milestone_tasks && data.crm_milestone_tasks !== '—',
              crm_suspended_projects: !!data.crm_suspended_projects && data.crm_suspended_projects !== '—',
              crm_no_contract_warning: !!data.crm_no_contract_warning && data.crm_no_contract_warning !== '—',
              crm_unbilled_warning: !!data.crm_unbilled_warning && data.crm_unbilled_warning !== '—',
              crm_unreceived_warning: !!data.crm_unreceived_warning && data.crm_unreceived_warning !== '—',
              crm_health_diagnosis: !!data.crm_health_diagnosis && data.crm_health_diagnosis !== '—' && !data.crm_health_diagnosis.includes('工作饱和度与项目实施状态正常')
            })
          }
        }
        setCrmPreviewVisible(true)
      } else {
        message.warning('未拉取到任何有效的 CRM 数据')
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '智能拉取 CRM 数据失败')
    } finally {
      setWeeklyCrmExtractLoading(false)
    }
  }

  // 确认从预览中导入选中的 CRM 数据
  const handleConfirmImportCrm = () => {
    if (!crmPreviewData) return

    // 保存用户的勾选状态以实现“系统记住勾选结果”
    localStorage.setItem(
      isMarketing ? 'crm_selected_keys_marketing' : 'crm_selected_keys_delivery',
      JSON.stringify(crmSelectedKeys)
    )

    const currentValues = weeklyForm.getFieldsValue()
    const updateValues: Record<string, any> = {}

    if (isMarketing) {
      // 营销岗：保持原先 4 大项导入逻辑
      if (crmSelectedKeys.actual) {
        const currentActual = currentValues.sales_actual || ''
        const crmActual = crmPreviewData.sales_actual || ''
        const isCurrentDummy = isDummyBroadcast(currentActual) || currentActual === (DEFAULT_TEMPLATES.sales_actual || '')
        const isCrmDummy = isDummyCrmActual(crmActual, true)

        let combinedActual = ''
        if (!isCurrentDummy && !isCrmDummy) {
          combinedActual = `${currentActual}\n\n${crmActual}`
        } else if (!isCurrentDummy) {
          combinedActual = currentActual
        } else if (!isCrmDummy) {
          combinedActual = crmActual
        } else {
          combinedActual = crmActual || currentActual
        }
        if (combinedActual) {
          updateValues.sales_actual = combinedActual
        }
      }
      
      if (crmSelectedKeys.blockers) {
        const crmBlockers = crmPreviewData.sales_blockers || ''
        if (crmBlockers) {
          updateValues.sales_blockers = crmBlockers
        }
      }
    } else {
      // 交付岗：按 7 项 CRM 细粒度指标导入
      // 1. 实际完成 (将正在实施项目进度与里程碑明细拼接)
      let prefix = ''
      const deliveryActual = crmPreviewData.delivery_actual || ''
      const match = deliveryActual.match(/^【📊 CRM 本周业绩快照】：.*?\n\n/)
      if (match) {
        prefix = match[0]
      }

      const actualParts: string[] = []
      if (crmSelectedKeys.crm_active_projects && crmPreviewData.crm_active_projects && crmPreviewData.crm_active_projects !== '—') {
        actualParts.push(`目前负责跟进的正在实施项目进度情况如下：\n${crmPreviewData.crm_active_projects}`)
      }
      if (crmSelectedKeys.crm_milestone_tasks && crmPreviewData.crm_milestone_tasks && crmPreviewData.crm_milestone_tasks !== '—') {
        actualParts.push(`本周项目子任务及里程碑节点交付动作明细：\n${crmPreviewData.crm_milestone_tasks}`)
      }

      let crmActual = ''
      if (actualParts.length > 0) {
        crmActual = prefix + actualParts.join('\n\n')
      }

      if (crmActual) {
        const currentActual = currentValues.delivery_actual || ''
        const isCurrentDummy = isDummyBroadcast(currentActual) || currentActual === (DEFAULT_TEMPLATES.delivery_actual || '')
        updateValues.delivery_actual = isCurrentDummy ? crmActual : `${currentActual}\n\n${crmActual}`
      }

      // 2. 卡点难点 (将暂停项目、超期未签合同、有进度未开票、已开票未回款以及健康度诊断 5 项拼接)
      const diagnosisText = (crmSelectedKeys.crm_health_diagnosis && crmPreviewData.crm_health_diagnosis && crmPreviewData.crm_health_diagnosis !== '—' && !crmPreviewData.crm_health_diagnosis.includes('工作饱和度与项目实施状态正常')) 
        ? `【🚨 个人工作饱和度与项目健康度诊断】：\n${crmPreviewData.crm_health_diagnosis}` 
        : ''

      const blockerParts: string[] = []
      if (crmSelectedKeys.crm_suspended_projects && crmPreviewData.crm_suspended_projects && crmPreviewData.crm_suspended_projects !== '—') {
        blockerParts.push(`交付难点：项目处于暂停或异常挂起状态：\n${crmPreviewData.crm_suspended_projects}`)
      }
      if (crmSelectedKeys.crm_no_contract_warning && crmPreviewData.crm_no_contract_warning && crmPreviewData.crm_no_contract_warning !== '—') {
        blockerParts.push(`预设立警（超期未签合同项目）：\n${crmPreviewData.crm_no_contract_warning}`)
      }
      if (crmSelectedKeys.crm_unbilled_warning && crmPreviewData.crm_unbilled_warning && crmPreviewData.crm_unbilled_warning !== '—') {
        blockerParts.push(`交付卡点（有进度未开票项目）：\n${crmPreviewData.crm_unbilled_warning}`)
      }
      if (crmSelectedKeys.crm_unreceived_warning && crmPreviewData.crm_unreceived_warning && crmPreviewData.crm_unreceived_warning !== '—') {
        blockerParts.push(`收欠款预警（已开票未回款项目）：\n${crmPreviewData.crm_unreceived_warning}`)
      }

      let crmBlockers = ''
      const combinedBlockers = blockerParts.join('\n\n')
      if (diagnosisText && combinedBlockers) {
        crmBlockers = `${diagnosisText}\n\n${combinedBlockers}`
      } else if (diagnosisText) {
        crmBlockers = diagnosisText
      } else if (combinedBlockers) {
        crmBlockers = combinedBlockers
      }

      if (crmBlockers) {
        const currentBlockers = currentValues.delivery_blockers || ''
        const isCurrentDummy = currentBlockers.includes('暂无重大的技术难点') || currentBlockers === (DEFAULT_TEMPLATES.delivery_blockers || '')
        updateValues.delivery_blockers = isCurrentDummy ? crmBlockers : `${currentBlockers}\n\n${crmBlockers}`
      }
    }

    // 共通指标：仅营销岗处理计划达成率说明 (rate) 与工作亮点 (highlights)（交付岗不要这两项）
    if (isMarketing) {
      if (crmSelectedKeys.rate) {
        if (crmPreviewData.sales_rate !== undefined && crmPreviewData.sales_rate !== null && crmPreviewData.sales_rate !== '') {
          updateValues.sales_rate = crmPreviewData.sales_rate
        }
      }

      if (crmSelectedKeys.highlights) {
        if (crmPreviewData.sales_highlights !== undefined && crmPreviewData.sales_highlights !== null && crmPreviewData.sales_highlights !== '') {
          updateValues.sales_highlights = crmPreviewData.sales_highlights
        }
      }
    }

    weeklyForm.setFieldsValue(updateValues)
    message.success('已成功将选中的 CRM 业绩与进度数据填入您的周报！')
    setCrmPreviewVisible(false)
  }

  // 打开填写 Modal 并加载已有周报
  const openWeeklyWriteModal = async () => {
    setWeeklyWriteVisible(true)
    setWeeklyWriteLoading(true)
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      weeklyForm.resetFields()
      
      let data: any = null
      let isNewReport = false
      try {
        const res = await get<any>(`/reports/weekly/mine?start_date=${startDateStr}`)
        data = res?.data ? res.data : res
      } catch (err: any) {
        if (err?.response?.status === 404) {
          console.log('该周尚未填写周报')
          isNewReport = true
        } else {
          message.error('拉取历史周报失败')
        }
      }

      // 如果是新填写的周报，尝试拉取上周的周报数据作为初始计划提取来源
      let prevWeekData: any = null
      if (isNewReport) {
        try {
          const prevMonday = mon.subtract(7, 'day').format('YYYY-MM-DD')
          const prevRes = await get<any>(`/reports/weekly/mine?start_date=${prevMonday}`)
          prevWeekData = prevRes?.data ? prevRes.data : prevRes
        } catch (prevErr) {
          console.log('未找到上一周的周报')
        }
      }
      
      const formValues: Record<string, any> = {}
      const fields = [
        'delivery_plan', 'sales_plan',
        'delivery_actual', 'sales_actual',
        'delivery_rate', 'sales_rate',
        'delivery_highlights', 'sales_highlights',
        'delivery_blockers', 'sales_blockers',
        'delivery_support', 'sales_support',
        'next_delivery_plan', 'next_sales_plan'
      ]
      
      fields.forEach(field => {
        let val = data ? data[field] : null
        if (isNewReport && prevWeekData) {
          if (field === 'delivery_plan') {
            val = prevWeekData.next_delivery_plan
          } else if (field === 'sales_plan') {
            val = prevWeekData.next_sales_plan
          }
        }
        if (val !== null && val !== undefined && val !== '') {
          formValues[field] = val
        } else {
          formValues[field] = DEFAULT_TEMPLATES[field] || ''
        }
      })
      weeklyForm.setFieldsValue(formValues)
    } finally {
      setWeeklyWriteLoading(false)
    }
  }

  // 提交/暂存周报
  const handleWeeklySubmit = async (values: any) => {
    setWeeklySubmitLoading(true)
    try {
      const [mon, sun] = getMondayAndSunday(weeklyDate)
      const payload = {
        ...values,
        start_date: mon.format('YYYY-MM-DD'),
        end_date: sun.format('YYYY-MM-DD'),
        status: weeklyStatusToSubmit
      }
      const res = await post<any>('/reports/weekly', payload)
      if (res) {
        message.success(weeklyStatusToSubmit === 'draft' ? '周复盘草稿已暂存' : '周复盘已正式提交')
        setWeeklyWriteVisible(false)
        loadWeeklyReports() // 刷新汇总大表
        checkMyReport() // 刷新自己周报填报的状态
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '保存周报失败')
    } finally {
      setWeeklySubmitLoading(false)
    }
  }

  // 自动保存周复盘草稿核心方法，所有注释必须使用中文
  const handleAutoSaveDraft = async () => {
    // 只有当弹窗处于打开状态时，才执行自动保存
    if (!weeklyWriteVisible) return
    try {
      const values = weeklyForm.getFieldsValue()
      const [mon, sun] = getMondayAndSunday(weeklyDate)
      const payload = {
        ...values,
        start_date: mon.format('YYYY-MM-DD'),
        end_date: sun.format('YYYY-MM-DD'),
        status: 'draft'
      }
      await post<any>('/reports/weekly', payload)
      console.log('【自动存盘】个人周复盘草稿已自动保存（后台静默）')
    } catch (err) {
      console.error('【自动存盘】后台自动保存草稿失败', err)
    }
  }

  // 自动保存草稿侦听器：包含60秒定时及窗口失去焦点/标签页隐藏，所有注释必须使用中文
  useEffect(() => {
    let intervalId: any = null

    const handleWindowBlurOrHide = () => {
      if (weeklyWriteVisible) {
        handleAutoSaveDraft()
      }
    }

    if (weeklyWriteVisible) {
      // 1. 每隔60秒自动执行一次草稿暂存
      intervalId = setInterval(() => {
        handleAutoSaveDraft()
      }, 60000)

      // 2. 监听浏览器标签隐藏与浏览器窗口失去焦点事件
      document.addEventListener('visibilitychange', handleWindowBlurOrHide)
      window.addEventListener('blur', handleWindowBlurOrHide)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
      document.removeEventListener('visibilitychange', handleWindowBlurOrHide)
      window.removeEventListener('blur', handleWindowBlurOrHide)
    }
  }, [weeklyWriteVisible, weeklyDate])

  // 加载选定战队与选定周一的周复盘汇总
  const loadWeeklyReports = async () => {
    setWeeklyLoading(true)
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      
      let url = `/reports/weekly/summary?start_date=${startDateStr}&page=${weeklyPage}&page_size=${weeklyPageSize}`
      // 如果是非全局角色，强制传递自身的 teamId 进行校验
      const targetTeamId = !isGlobalUser && user?.teamId ? String(user.teamId) : weeklyTeamId;
      if (targetTeamId && targetTeamId !== 'all') {
        url += `&team_id=${targetTeamId}`
      }
      if (weeklyThirdBar && weeklyThirdBar !== 'all') {
        url += `&third_class_bar=${encodeURIComponent(weeklyThirdBar)}`
      }
      if (searchNames.length > 0) {
        url += `&user_name=${encodeURIComponent(searchNames.join(','))}`
      }
      
      const res = await get<any>(url)
      const data = res?.data ? res.data : res
      if (data && data.items) {
        setWeeklyReports(data.items)
        setWeeklyTotal(data.total || 0)
      } else {
        setWeeklyReports([])
        setWeeklyTotal(0)
      }
    } catch (err) {
      console.error(err)
      message.error('加载周复盘汇总表失败')
      setWeeklyReports([])
      setWeeklyTotal(0)
    } finally {
      setWeeklyLoading(false)
    }
  }

  // 删除单条周报
  const handleWeeklyDelete = async (id: number) => {
    try {
      const res = await del<any>(`/reports/weekly/${id}`)
      if (res) {
        message.success('周报删除成功')
        loadWeeklyReports()
        checkMyReport()
        setWeeklySelectedRowKeys(prev => prev.filter(k => k !== id))
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '删除周报失败')
    }
  }

  // 批量删除周报
  const handleWeeklyBatchDelete = async () => {
    if (weeklySelectedRowKeys.length === 0) return
    try {
      const res = await post<any>('/reports/weekly/batch-delete', {
        ids: weeklySelectedRowKeys
      })
      if (res) {
        message.success(`成功批量删除 ${weeklySelectedRowKeys.length} 条周报`)
        setWeeklySelectedRowKeys([])
        loadWeeklyReports()
        checkMyReport()
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '批量删除周报失败')
    }
  }

  // 打开编辑周报弹窗
  const openWeeklyEditModal = (record: any) => {
    setEditingWeeklyReport(record)
    setWeeklyEditVisible(true)
    weeklyEditForm.resetFields()
    weeklyEditForm.setFieldsValue({
      delivery_plan: record.delivery_plan || '',
      sales_plan: record.sales_plan || '',
      delivery_actual: record.delivery_actual || '',
      sales_actual: record.sales_actual || '',
      delivery_rate: record.delivery_rate || '',
      sales_rate: record.sales_rate || '',
      delivery_highlights: record.delivery_highlights || '',
      sales_highlights: record.sales_highlights || '',
      delivery_blockers: record.delivery_blockers || '',
      sales_blockers: record.sales_blockers || '',
      delivery_support: record.delivery_support || '',
      sales_support: record.sales_support || '',
      next_delivery_plan: record.next_delivery_plan || '',
      next_sales_plan: record.next_sales_plan || ''
    })
  }

  // 打开查看详情弹窗
  const openWeeklyViewModal = (record: any) => {
    setViewingWeeklyReport(record)
    setWeeklyViewVisible(true)
  }

  // 提交修改他人的周报
  const handleWeeklyEditSubmit = async (values: any) => {
    if (!editingWeeklyReport) return
    setWeeklyEditLoading(true)
    try {
      const res = await put<any>(`/reports/weekly/${editingWeeklyReport.id}`, {
        ...values,
        status: editingWeeklyReport.status // 保持周报原有状态(draft/submitted)
      })
      if (res) {
        message.success('已成功保存修改后的周报')
        setWeeklyEditVisible(false)
        loadWeeklyReports()
        checkMyReport()
      }
    } catch (err: any) {
      console.error(err)
      message.error(err?.response?.data?.detail || '修改周报失败')
    } finally {
      setWeeklyEditLoading(false)
    }
  }

  // 加载选定战队与选定周一的 CRM 业务数据汇总
  const loadCrmReports = async () => {
    setCrmLoading(true)
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      
      let url = `/reports/weekly/crm-summary?start_date=${startDateStr}&page=${crmPage}&page_size=${crmPageSize}`
      // 如果是非全局角色，强制传递自身的 teamId 进行校验
      const targetTeamId = !isGlobalUser && user?.teamId ? String(user.teamId) : weeklyTeamId;
      if (targetTeamId && targetTeamId !== 'all') {
        url += `&team_id=${targetTeamId}`
      }
      if (weeklyThirdBar && weeklyThirdBar !== 'all') {
        url += `&third_class_bar=${encodeURIComponent(weeklyThirdBar)}`
      }
      if (searchNames.length > 0) {
        url += `&user_name=${encodeURIComponent(searchNames.join(','))}`
      }
      
      const res = await get<any>(url)
      const data = res?.data ? res.data : res
      if (data && data.items) {
        setCrmReports(data.items)
        setCrmTotal(data.total || 0)
      } else {
        setCrmReports([])
        setCrmTotal(0)
      }
    } catch (err) {
      console.error(err)
      message.error('加载 CRM 业务数据汇总失败')
      setCrmReports([])
      setCrmTotal(0)
    } finally {
      setCrmLoading(false)
    }
  }

  // 加载选定战队与选定周一的 CRM 业务数据汇总 (横板专用的分页拉取)，所有注释必须使用中文
  const loadCrmHorizontalReports = async () => {
    setCrmHorizontalLoading(true)
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      
      let url = `/reports/weekly/crm-summary?start_date=${startDateStr}&page=${crmHorizontalPage}&page_size=${crmHorizontalPageSize}`
      // 如果是非全局角色，强制传递自身的 teamId 进行校验
      const targetTeamId = !isGlobalUser && user?.teamId ? String(user.teamId) : weeklyTeamId;
      if (targetTeamId && targetTeamId !== 'all') {
        url += `&team_id=${targetTeamId}`
      }
      if (weeklyThirdBar && weeklyThirdBar !== 'all') {
        url += `&third_class_bar=${encodeURIComponent(weeklyThirdBar)}`
      }
      if (searchNames.length > 0) {
        url += `&user_name=${encodeURIComponent(searchNames.join(','))}`
      }
      
      const res = await get<any>(url)
      const data = res?.data ? res.data : res
      if (data && data.items) {
        setCrmHorizontalReports(data.items)
        setCrmHorizontalTotal(data.total || 0)
      } else {
        setCrmHorizontalReports([])
        setCrmHorizontalTotal(0)
      }
    } catch (err) {
      console.error(err)
      message.error('加载 CRM 数据汇总横板失败')
      setCrmHorizontalReports([])
      setCrmHorizontalTotal(0)
    } finally {
      setCrmHorizontalLoading(false)
    }
  }

  // 加载选定战队与选定周一的周报汇总 (横板专用的分页拉取)，所有注释必须使用中文
  const loadWeeklyHorizontalReports = async () => {
    setWeeklyHorizontalLoading(true)
    try {
      const [mon] = getMondayAndSunday(weeklyDate)
      const startDateStr = mon.format('YYYY-MM-DD')
      
      let url = `/reports/weekly/summary?start_date=${startDateStr}&page=${weeklyHorizontalPage}&page_size=${weeklyHorizontalPageSize}`
      // 如果是非全局角色，强制传递自身的 teamId 进行校验
      const targetTeamId = !isGlobalUser && user?.teamId ? String(user.teamId) : weeklyTeamId;
      if (targetTeamId && targetTeamId !== 'all') {
        url += `&team_id=${targetTeamId}`
      }
      if (weeklyThirdBar && weeklyThirdBar !== 'all') {
        url += `&third_class_bar=${encodeURIComponent(weeklyThirdBar)}`
      }
      if (searchNames.length > 0) {
        url += `&user_name=${encodeURIComponent(searchNames.join(','))}`
      }
      
      const res = await get<any>(url)
      const data = res?.data ? res.data : res
      if (data && data.items) {
        setWeeklyHorizontalReports(data.items)
        setWeeklyHorizontalTotal(data.total || 0)
      } else {
        setWeeklyHorizontalReports([])
        setWeeklyHorizontalTotal(0)
      }
    } catch (err) {
      console.error(err)
      message.error('加载团队周报汇总横板失败')
      setWeeklyHorizontalReports([])
      setWeeklyHorizontalTotal(0)
    } finally {
      setWeeklyHorizontalLoading(false)
    }
  }

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

  // 加载系统所有的成员选项
  const loadAllUsers = async () => {
    try {
      const res = await get<any>('/users?page=1&page_size=2000')
      if (res && res.items) {
        setAllUsers(res.items)
      }
    } catch (err) {
      console.error('加载系统成员列表失败:', err)
    }
  }

  // 打开 CRM 查看详情 Modal
  const openCrmViewModal = (record: any) => {
    setViewingCrmReport(record)
    setCrmViewVisible(true)
  }

  useEffect(() => {
    loadThirdClassBars()
    loadAllUsers()
  }, [])

  useEffect(() => {
    if (activeTab === 'report') {
      loadWeeklyReports()
    } else if (activeTab === 'report_horizontal') {
      loadWeeklyHorizontalReports()
    } else if (activeTab === 'crm') {
      loadCrmReports()
    } else if (activeTab === 'crm_horizontal') {
      loadCrmHorizontalReports()
    }
  }, [
    activeTab, 
    weeklyDate, 
    weeklyTeamId, 
    weeklyThirdBar, 
    weeklyPage, 
    weeklyPageSize, 
    weeklyHorizontalPage,
    weeklyHorizontalPageSize,
    crmPage, 
    crmPageSize, 
    crmHorizontalPage, 
    crmHorizontalPageSize, 
    searchNames
  ])

  useEffect(() => {
    checkMyReport()
  }, [weeklyDate])

  const [mon, sun] = getMondayAndSunday(weeklyDate)
  const selectedMonday = mon.format('YYYY-MM-DD')
  const selectedSunday = sun.format('YYYY-MM-DD')

  const isMarketingRecord = (record: any) => {
    return record.user_position_type === 'marketing' || 
      ['target_officer', 'marketing_staff', 'tech_marketing'].includes(record.user_role || '');
  }

  const weeklyColumns = [
    {
      title: '成员姓名',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 100,
      fixed: 'left' as const,
      align: 'center' as const,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '本周目标计划',
      key: 'weekly_plan',
      width: 220,
      render: (_: any, record: any) => {
        const content = isMarketingRecord(record) ? record.sales_plan : record.delivery_plan;
        return renderEllipsisText(content);
      }
    },
    {
      title: '本周实际完成',
      key: 'weekly_actual',
      width: 250,
      render: (_: any, record: any) => {
        const content = isMarketingRecord(record) ? record.sales_actual : record.delivery_actual;
        return renderEllipsisText(content);
      }
    },
    {
      title: '达成率',
      key: 'weekly_rate',
      width: 110,
      align: 'center' as const,
      render: (_: any, record: any) => {
        const isMarketingUser = isMarketingRecord(record);
        const content = isMarketingUser ? record.sales_rate : record.delivery_rate;
        return content ? (
          <Tag color={isMarketingUser ? "geekblue" : "blue"} style={{ maxWidth: '100%', display: 'inline-flex', alignItems: 'center' }}>
            <Text ellipsis={{ tooltip: { title: <div style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto' }}>{content}</div>, overlayClassName: 'tooltip-no-pointer-events', mouseLeaveDelay: 0.1 } }} style={{ color: 'inherit', fontSize: 'inherit' }}>
              {content}
            </Text>
          </Tag>
        ) : '—';
      }
    },
    {
      title: '本周亮点',
      key: 'weekly_highlights',
      width: 200,
      render: (_: any, record: any) => {
        const content = isMarketingRecord(record) ? record.sales_highlights : record.delivery_highlights;
        return renderEllipsisText(content);
      }
    },
    {
      title: '本周卡点',
      key: 'weekly_blockers',
      width: 200,
      render: (_: any, record: any) => {
        const content = isMarketingRecord(record) ? record.sales_blockers : record.delivery_blockers;
        return renderEllipsisText(content);
      }
    },
    {
      title: '支持协调需求',
      key: 'weekly_support',
      width: 180,
      render: (_: any, record: any) => {
        const content = isMarketingRecord(record) ? record.sales_support : record.delivery_support;
        return renderEllipsisText(content);
      }
    },
    {
      title: '下周目标计划',
      key: 'weekly_next_plan',
      width: 200,
      render: (_: any, record: any) => {
        const content = isMarketingRecord(record) ? record.next_sales_plan : record.next_delivery_plan;
        return renderEllipsisText(content);
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (status: string) => {
        return status === 'submitted' ? (
          <Tag color="success">已提交</Tag>
        ) : (
          <Tag color="default">草稿</Tag>
        )
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 170, // 增加宽度容纳查看按钮
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, record: any) => {
        const isOwn = record.user_id === user?.id
        // 拥有编辑权限或本人
        const canEdit = isOwn || hasPermission('edit_weekly_report')
        // 拥有删除权限或本人
        const canDelete = isOwn || hasPermission('delete_weekly_report')
        
        return (
          <Space size="small">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openWeeklyViewModal(record)} style={{ padding: 0 }}>
              查看
            </Button>
            {canEdit && (
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openWeeklyEditModal(record)} style={{ padding: 0 }}>
                编辑
              </Button>
            )}
            {canDelete && (
              <Popconfirm
                title="确定要删除该条周报吗？"
                onConfirm={() => handleWeeklyDelete(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" danger size="small" icon={<DeleteOutlined />} style={{ padding: 0 }}>
                  删除
                </Button>
              </Popconfirm>
            )}
            {!canEdit && !canDelete && '—'}
          </Space>
        )
      }
    }
  ]

  const crmColumns = [
    {
      title: '成员姓名',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 100,
      fixed: 'left' as const,
      align: 'center' as const,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '三级巴',
      dataIndex: 'third_class_bar',
      key: 'third_class_bar',
      width: 150,
      render: (text: string) => text || '—',
    },
    {
      title: '归属战队',
      dataIndex: 'team_name',
      key: 'team_name',
      width: 130,
      render: (text: string) => text || '—',
    },
    {
      title: '正在实施项目进度',
      dataIndex: 'crm_active_projects',
      key: 'crm_active_projects',
      width: 250,
      render: (text: string) => renderEllipsisText(text),
    },
    {
      title: '里程碑与交付动作明细',
      dataIndex: 'crm_milestone_tasks',
      key: 'crm_milestone_tasks',
      width: 300,
      render: (text: string) => renderEllipsisText(text),
    },
    {
      title: '暂停或异常挂起项目',
      dataIndex: 'crm_suspended_projects',
      key: 'crm_suspended_projects',
      width: 250,
      render: (text: string) => renderEllipsisText(text, { color: '#faad14', fontWeight: '500' }),
    },
    {
      title: '预设立立警 (超期未签合同)',
      dataIndex: 'crm_no_contract_warning',
      key: 'crm_no_contract_warning',
      width: 300,
      render: (text: string) => renderEllipsisText(text, { color: '#ff4d4f', fontWeight: '500' }),
    },
    {
      title: '交付卡点 (有进度未开票)',
      dataIndex: 'crm_unbilled_warning',
      key: 'crm_unbilled_warning',
      width: 300,
      render: (text: string) => renderEllipsisText(text, { color: '#faad14', fontWeight: '500' }),
    },
    {
      title: '收欠款预警 (已开票未回款)',
      dataIndex: 'crm_unreceived_warning',
      key: 'crm_unreceived_warning',
      width: 300,
      render: (text: string) => renderEllipsisText(text, { color: '#ff4d4f', fontWeight: '500' }),
    },
    {
      title: '饱和度与健康度诊断',
      dataIndex: 'crm_health_diagnosis',
      key: 'crm_health_diagnosis',
      width: 350,
      render: (text: string) => {
        if (!text || text === '—') return '—';
        const isAlert = text.includes('红色警报') || text.includes('黄色预警');
        return renderEllipsisText(text, isAlert ? { color: '#ff4d4f', fontWeight: '500' } : undefined);
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 110,
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openCrmViewModal(record)}>
          查看 CRM
        </Button>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', minHeight: '70vh' }}>
        {/* 筛选项 */}
        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <Space>
              <FilterOutlined style={{ color: '#1890ff' }} />
              <strong>汇总过滤：</strong>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <DatePicker
              picker="week"
              placeholder="选择填报周"
              style={{ width: '100%' }}
              value={weeklyDate}
              onChange={(val) => {
                if (val) {
                  setWeeklyDate(val)
                  setWeeklyPage(1)
                  setCrmPage(1)
                  setCrmHorizontalPage(1)
                  setWeeklyHorizontalPage(1)
                }
              }}
              allowClear={false}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="按战队/小组筛选"
              value={weeklyTeamId}
              onChange={(val) => {
                setWeeklyTeamId(val)
                setWeeklyPage(1)
                setCrmPage(1)
                setCrmHorizontalPage(1)
                setWeeklyHorizontalPage(1)
              }}
              disabled={!isGlobalUser} // 只有管理员/目标官允许切换战队，非全局角色被锁定
              options={TEAM_OPTIONS}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="按三级巴筛选"
              value={weeklyThirdBar}
              onChange={(val) => {
                setWeeklyThirdBar(val)
                setWeeklyPage(1)
                setCrmPage(1)
                setCrmHorizontalPage(1)
                setWeeklyHorizontalPage(1)
              }}
              options={thirdClassBarOptions}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              mode="multiple"
              allowClear
              showSearch
              style={{ width: '100%' }}
              placeholder="按人名多选筛选"
              value={searchNames}
              onChange={(vals) => {
                setSearchNames(vals)
                setWeeklyPage(1)
                setCrmPage(1)
                setCrmHorizontalPage(1)
                setWeeklyHorizontalPage(1)
              }}
              options={memberOptions}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              maxTagCount="responsive"
            />
          </Col>
          <Col>
            <Space>
              {activeTab === 'report' && weeklySelectedRowKeys.length > 0 && hasPermission('delete_weekly_report') && (
                <Popconfirm
                  title={`确定要删除选中的 ${weeklySelectedRowKeys.length} 条周报吗？`}
                  onConfirm={handleWeeklyBatchDelete}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button type="primary" danger icon={<DeleteOutlined />}>
                    批量删除 ({weeklySelectedRowKeys.length})
                  </Button>
                </Popconfirm>
              )}
              <Button
                type="primary"
                onClick={
                  activeTab === 'report' 
                    ? loadWeeklyReports 
                    : activeTab === 'report_horizontal'
                    ? loadWeeklyHorizontalReports
                    : activeTab === 'crm'
                    ? loadCrmReports
                    : loadCrmHorizontalReports
                }
                icon={<SyncOutlined />}
              >
                刷新周汇总
              </Button>
              {activeTab === 'report' && (
                <Button
                  type="primary"
                  ghost
                  icon={<EditOutlined />}
                  onClick={openWeeklyWriteModal}
                >
                  {hasMineReport ? '修改我的周报' : '填写我的周报'}
                </Button>
              )}

            </Space>
          </Col>
          <Col style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 13, color: '#8c8c8c' }}>
              当前检索周范围：<strong>{selectedMonday} ~ {selectedSunday}</strong>
            </span>
          </Col>
        </Row>

        {/* 双维度汇总 Tabs */}
        <Tabs
          type="card"
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'report' | 'report_horizontal' | 'crm' | 'crm_horizontal')}
          style={{ marginBottom: 16 }}
          items={[
            {
              key: 'report',
              label: <span style={{ fontSize: '14px', fontWeight: 'bold' }}>📝 个人周复盘填报汇总</span>,
              children: (
                <Table
                  dataSource={weeklyReports}
                  columns={weeklyColumns}
                  loading={weeklyLoading}
                  rowKey="id"
                  bordered
                  rowSelection={{
                    selectedRowKeys: weeklySelectedRowKeys,
                    onChange: (keys: React.Key[]) => setWeeklySelectedRowKeys(keys)
                  }}
                  pagination={{
                    current: weeklyPage,
                    pageSize: weeklyPageSize,
                    total: weeklyTotal,
                    onChange: (p, ps) => {
                      setWeeklyPage(p)
                      setWeeklyPageSize(ps)
                    },
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条数据`
                  }}
                  scroll={{ x: 1870 }}
                  sticky={{ offsetScroll: 0, getContainer: () => (document.querySelector('.ant-layout-content') as HTMLElement) || window }}
                  locale={{ emptyText: '该周内此小组/战队暂无提交的周复盘数据' }}
                />
              )
            },
            {
              key: 'report_horizontal',
              label: <span style={{ fontSize: '14px', fontWeight: 'bold' }}>👥 团队周报汇总横板</span>,
              children: (
                <Table
                  dataSource={[
                    { key: 'plan', dimension: '🎯 本周目标计划' },
                    { key: 'actual', dimension: '🔥 本周实际完成' },
                    { key: 'highlights', dimension: '🏆 本周工作亮点' },
                    { key: 'blockers', dimension: '🚧 本周工作卡点/难点' },
                    { key: 'support', dimension: '🤝 需要支持协调' },
                    { key: 'next_plan', dimension: '🚀 下周工作目标' }
                  ]}
                  columns={[
                    {
                      title: '指标/维度',
                      dataIndex: 'dimension',
                      key: 'dimension',
                      width: 150,
                      fixed: 'left' as const,
                      align: 'center' as const,
                      render: (text: string) => <strong>{text}</strong>,
                    },
                    ...weeklyHorizontalReports.map((record: any) => {
                      return {
                        title: (
                          <Space direction="vertical" size={2} style={{ textAlign: 'center', width: '100%' }}>
                            <strong>{record.user_name}</strong>
                            <Tag color={record.user_position_type === 'marketing' ? 'orange' : 'green'} style={{ margin: 0 }}>
                              {record.user_position_type === 'marketing' ? '营销岗' : '交付岗'}
                            </Tag>
                          </Space>
                        ),
                        key: record.user_id,
                        width: 260,
                        render: (_: any, row: any) => {
                          const isMarketingUser = record.user_position_type === 'marketing' ||
                            ['target_officer', 'marketing_staff', 'tech_marketing'].includes(record.user_role || '');
                          
                          let val = '';
                          switch (row.key) {
                            case 'plan':
                              val = isMarketingUser ? record.sales_plan : record.delivery_plan;
                              break;
                            case 'actual':
                              val = isMarketingUser ? record.sales_actual : record.delivery_actual;
                              break;
                            case 'highlights':
                              val = isMarketingUser ? record.sales_highlights : record.delivery_highlights;
                              break;
                            case 'blockers':
                              val = isMarketingUser ? record.sales_blockers : record.delivery_blockers;
                              break;
                            case 'support':
                              val = isMarketingUser ? record.sales_support : record.delivery_support;
                              break;
                            case 'next_plan':
                              val = isMarketingUser ? record.next_sales_plan : record.next_delivery_plan;
                              break;
                          }
                          return (
                            <div style={{
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              maxHeight: '250px',
                              overflowY: 'auto',
                              overflowX: 'hidden',
                              fontSize: '12.5px',
                              width: '100%',
                              minWidth: '220px',
                              maxWidth: '250px',
                              boxSizing: 'border-box',
                              textAlign: 'left'
                            }}>
                              {val || '—'}
                            </div>
                          );
                        }
                      }
                    })
                  ]}
                  loading={weeklyHorizontalLoading}
                  pagination={{
                    current: weeklyHorizontalPage,
                    pageSize: weeklyHorizontalPageSize,
                    total: weeklyHorizontalTotal,
                    onChange: (p, ps) => {
                      setWeeklyHorizontalPage(p)
                      setWeeklyHorizontalPageSize(ps)
                    },
                    pageSizeOptions: ['4', '6', '8', '10', '15'],
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 人`
                  }}
                  bordered
                  scroll={{ x: 'max-content' }}
                  sticky={{ offsetScroll: 0, getContainer: () => (document.querySelector('.ant-layout-content') as HTMLElement) || window }}
                  locale={{ emptyText: '该周内此小组/战队暂无提交的周复盘数据' }}
                />
              )
            },
            {
              key: 'crm_horizontal',
              label: <span style={{ fontSize: '14px', fontWeight: 'bold' }}>👥 CRM 数据汇总横板</span>,
              children: (
                <Table
                  dataSource={[
                    { key: 'active_projects', dimension: '💻 正在实施项目进度' },
                    { key: 'milestone_tasks', dimension: '🎯 里程碑与交付动作' },
                    { key: 'suspended_projects', dimension: '⚠️ 暂停或异常挂起项目' },
                    { key: 'no_contract_warning', dimension: '🔴 合同超期未签预警' },
                    { key: 'unbilled_warning', dimension: '🟡 有进度未开票卡点' },
                    { key: 'unreceived_warning', dimension: '🔴 已开票未回款预警' },
                    { key: 'health_diagnosis', dimension: '🩺 饱和度与健康度诊断' }
                  ]}
                  columns={[
                    {
                      title: '指标/维度',
                      dataIndex: 'dimension',
                      key: 'dimension',
                      width: 170,
                      fixed: 'left' as const,
                      align: 'center' as const,
                      render: (text: string) => <strong>{text}</strong>,
                    },
                    ...crmHorizontalReports.map((record: any) => {
                      return {
                        title: (
                          <Space direction="vertical" size={2} style={{ textAlign: 'center', width: '100%' }}>
                            <strong>{record.user_name}</strong>
                            <Tag color={record.position_type === 'marketing' ? 'orange' : 'green'} style={{ margin: 0 }}>
                              {record.position_type === 'marketing' ? '营销岗' : '交付岗'}
                            </Tag>
                          </Space>
                        ),
                        key: record.user_id,
                        width: 280,
                        render: (_: any, row: any) => {
                          let val = '';
                          let isAlert = false;
                          let isWarning = false;
                          
                          switch (row.key) {
                            case 'active_projects':
                              val = record.crm_active_projects;
                              break;
                            case 'milestone_tasks':
                              val = record.crm_milestone_tasks;
                              break;
                            case 'suspended_projects':
                              val = record.crm_suspended_projects;
                              isWarning = val && val !== '—';
                              break;
                            case 'no_contract_warning':
                              val = record.crm_no_contract_warning;
                              isAlert = val && val !== '—';
                              break;
                            case 'unbilled_warning':
                              val = record.crm_unbilled_warning;
                              isWarning = val && val !== '—';
                              break;
                            case 'unreceived_warning':
                              val = record.crm_unreceived_warning;
                              isAlert = val && val !== '—';
                              break;
                            case 'health_diagnosis':
                              val = record.crm_health_diagnosis;
                              isAlert = val && (val.includes('异常') || val.includes('风险') || val.includes('超负荷'));
                              isWarning = val && (val.includes('警告') || val.includes('偏低'));
                              break;
                          }

                          if (!val || val === '—') return '—';

                          let colorStyle = undefined;
                          if (isAlert) {
                            colorStyle = { color: '#ff4d4f', fontWeight: '500' };
                          } else if (isWarning) {
                            colorStyle = { color: '#faad14', fontWeight: '500' };
                          }

                          return (
                            <div style={{
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              maxHeight: '200px', // 内容太长时展示滑动条限制高度
                              overflowY: 'auto',
                              overflowX: 'hidden', // 限制禁止横向滑动条，防止遮挡文字
                              fontSize: '12.5px',
                              width: '250px', // 限制最大列宽最多这么宽
                              textAlign: 'left',
                              ...colorStyle
                            }}>
                              {val}
                            </div>
                          );
                        }
                      }
                    })
                  ]}
                  loading={crmHorizontalLoading}
                  pagination={{
                    current: crmHorizontalPage,
                    pageSize: crmHorizontalPageSize,
                    total: crmHorizontalTotal,
                    onChange: (p, ps) => {
                      setCrmHorizontalPage(p)
                      setCrmHorizontalPageSize(ps)
                    },
                    pageSizeOptions: ['4', '6', '8', '10', '15'],
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 人`
                  }}
                  bordered
                  scroll={{ x: 'max-content' }}
                  sticky={{ offsetScroll: 0, getContainer: () => (document.querySelector('.ant-layout-content') as HTMLElement) || window }}
                  locale={{ emptyText: '当前战队/三级巴暂无成员的当周 CRM 业务数据' }}
                />
              )
            },
            {
              key: 'crm',
              label: <span style={{ fontSize: '14px', fontWeight: 'bold' }}>⚡ CRM 业务数据智能汇总</span>,
              children: (
                <Table
                  dataSource={crmReports}
                  columns={crmColumns}
                  loading={crmLoading}
                  rowKey="user_id"
                  bordered
                  pagination={{
                    current: crmPage,
                    pageSize: crmPageSize,
                    total: crmTotal,
                    onChange: (p, ps) => {
                      setCrmPage(p)
                      setCrmPageSize(ps)
                    },
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条数据`
                  }}
                  scroll={{ x: 2590 }}
                  sticky={{ offsetScroll: 0, getContainer: () => (document.querySelector('.ant-layout-content') as HTMLElement) || window }}
                  locale={{ emptyText: '该周内此小组/战队暂无匹配的 CRM 业务数据' }}
                />
              )
            }
          ]}
        />

        {/* 周报只读查看Modal弹窗 */}
        <Modal
          title={<strong>🔍 查看员工周复盘详情（周范围：{selectedMonday} ~ {selectedSunday} - 成员：{viewingWeeklyReport?.user_name}）</strong>}
          open={weeklyViewVisible}
          onCancel={() => setWeeklyViewVisible(false)}
          footer={[
            <Button
              key="export-pdf"
              icon={<DownloadOutlined />}
              loading={userPdfExporting}
              onClick={() => handleExportPDF('user-report-pdf-export-temp', `${viewingWeeklyReport?.user_name}_${selectedMonday}_个人周复盘.pdf`, setUserPdfExporting)}
            >
              导出PDF
            </Button>,
            <Button
              key="export-docx"
              icon={<DownloadOutlined />}
              loading={userDocxExporting}
              onClick={handleExportUserDocx}
            >
              导出Word
            </Button>,
            <Button key="close" type="primary" onClick={() => setWeeklyViewVisible(false)}>
              关闭
            </Button>
          ]}
          width={800}
          centered
          destroyOnHidden
        >
          {viewingWeeklyReport && (
            <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '8px' }}>
              <div id="user-report-modal-content" style={{ padding: '16px', backgroundColor: '#ffffff' }}>
                <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="成员姓名"><strong>{viewingWeeklyReport.user_name}</strong></Descriptions.Item>
                <Descriptions.Item label="岗位类别">
                  <Tag color="cyan">
                    {viewingWeeklyReport.user_position_type === 'marketing' ? '营销岗' : '交付及其他'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="填报状态">
                  {viewingWeeklyReport.status === 'submitted' ? (
                    <Tag color="success">已提交</Tag>
                  ) : (
                    <Tag color="default">草稿</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="提交时间">
                  {viewingWeeklyReport.submitted_at 
                    ? dayjs(viewingWeeklyReport.submitted_at).format('YYYY-MM-DD HH:mm:ss')
                    : '—'}
                </Descriptions.Item>
              </Descriptions>

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>🎯 本周目标计划</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                {!isViewingMarketing && (
                  <Col span={24}>
                    <Card title="项目交付计划" size="small" headStyle={{ background: '#f5f5f5' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 60 }}>{viewingWeeklyReport.delivery_plan || '—'}</div>
                    </Card>
                  </Col>
                )}
                {isViewingMarketing && (
                  <Col span={24}>
                    <Card title="销售计划" size="small" headStyle={{ background: '#f5f5f5' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 60 }}>{viewingWeeklyReport.sales_plan || '—'}</div>
                    </Card>
                  </Col>
                )}
              </Row>

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>🔥 本周实际完成</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                {!isViewingMarketing && (
                  <Col span={24}>
                    <Card title="项目交付实际" size="small" headStyle={{ background: '#f6ffed' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 80 }}>{viewingWeeklyReport.delivery_actual || '—'}</div>
                    </Card>
                  </Col>
                )}
                {isViewingMarketing && (
                  <Col span={24}>
                    <Card title="销售实际完成" size="small" headStyle={{ background: '#f6ffed' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 80 }}>{viewingWeeklyReport.sales_actual || '—'}</div>
                    </Card>
                  </Col>
                )}
              </Row>

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>📊 计划达成率说明</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                {!isViewingMarketing && (
                  <Col span={24}>
                    <Card title="项目达成率" size="small" headStyle={{ background: '#e6f7ff' }}>
                      <div><strong>{viewingWeeklyReport.delivery_rate || '—'}</strong></div>
                    </Card>
                  </Col>
                )}
                {isViewingMarketing && (
                  <Col span={24}>
                    <Card title="销售达成率" size="small" headStyle={{ background: '#e6f7ff' }}>
                      <div><strong>{viewingWeeklyReport.sales_rate || '—'}</strong></div>
                    </Card>
                  </Col>
                )}
              </Row>

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>🏆 本周工作亮点</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                {!isViewingMarketing && (
                  <Col span={24}>
                    <Card title="项目亮点" size="small" headStyle={{ background: '#fffb8f' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingWeeklyReport.delivery_highlights || '—'}</div>
                    </Card>
                  </Col>
                )}
                {isViewingMarketing && (
                  <Col span={24}>
                    <Card title="销售亮点" size="small" headStyle={{ background: '#fffb8f' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingWeeklyReport.sales_highlights || '—'}</div>
                    </Card>
                  </Col>
                )}
              </Row>

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>🚧 本周工作卡点/难点</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                {!isViewingMarketing && (
                  <Col span={24}>
                    <Card title="项目难点" size="small" headStyle={{ background: '#fff2e8' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingWeeklyReport.delivery_blockers || '—'}</div>
                    </Card>
                  </Col>
                )}
                {isViewingMarketing && (
                  <Col span={24}>
                    <Card title="销售难点" size="small" headStyle={{ background: '#fff2e8' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingWeeklyReport.sales_blockers || '—'}</div>
                    </Card>
                  </Col>
                )}
              </Row>

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>🤝 需要支持协调</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                {!isViewingMarketing && (
                  <Col span={24}>
                    <Card title="项目侧" size="small" headStyle={{ background: '#feffe6' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingWeeklyReport.delivery_support || '—'}</div>
                    </Card>
                  </Col>
                )}
                {isViewingMarketing && (
                  <Col span={24}>
                    <Card title="销售侧" size="small" headStyle={{ background: '#feffe6' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingWeeklyReport.sales_support || '—'}</div>
                    </Card>
                  </Col>
                )}
              </Row>

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>🚀 下周工作目标</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                {!isViewingMarketing && (
                  <Col span={24}>
                    <Card title="项目交付计划" size="small" headStyle={{ background: '#f5f5f5' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 60 }}>{viewingWeeklyReport.next_delivery_plan || '—'}</div>
                    </Card>
                  </Col>
                )}
                {isViewingMarketing && (
                  <Col span={24}>
                    <Card title="销售计划" size="small" headStyle={{ background: '#f5f5f5' }}>
                      <div style={{ whiteSpace: 'pre-wrap', minHeight: 60 }}>{viewingWeeklyReport.next_sales_plan || '—'}</div>
                    </Card>
                  </Col>
                )}
              </Row>
              </div>
            </div>
          )}
        </Modal>

        {/* 成员 CRM 业务详情 Modal */}
        <Modal
          title={<strong>🔍 查看成员 CRM 业务实时汇总（成员：{viewingCrmReport?.user_name} - 周范围：{selectedMonday} ~ {selectedSunday}）</strong>}
          open={crmViewVisible}
          onCancel={() => setCrmViewVisible(false)}
          footer={[
            <Button key="close" type="primary" onClick={() => setCrmViewVisible(false)}>
              关闭
            </Button>
          ]}
          width={800}
          centered
          destroyOnHidden
        >
          {viewingCrmReport && (
            <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '8px' }}>
              <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="成员姓名"><strong>{viewingCrmReport.user_name}</strong></Descriptions.Item>
                <Descriptions.Item label="岗位类别">
                  <Tag color={viewingCrmReport.position_type === 'marketing' ? 'blue' : 'green'}>
                    {viewingCrmReport.position_type === 'marketing' ? '营销岗' : '交付及其他'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="三级巴">
                  {viewingCrmReport.third_class_bar || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="归属战队">
                  {viewingCrmReport.team_name || '—'}
                </Descriptions.Item>
              </Descriptions>

              {/* 区分营销岗位与交付岗位 */}
              {viewingCrmReport.position_type === 'marketing' ? (
                <>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#722ed1' }}>🔥 当周销售实际完成 (CRM)</div>
                  <Card size="small" style={{ marginBottom: 16 }} headStyle={{ background: '#f6ffed' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 80, fontFamily: 'monospace' }}>{viewingCrmReport.sales_actual || '暂无数据'}</div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#722ed1' }}>📈 月度指标达成率 (CRM)</div>
                  <Card size="small" style={{ marginBottom: 16 }} headStyle={{ background: '#e6f7ff' }}>
                    <div><strong>{viewingCrmReport.sales_rate || '暂无统计指标'}</strong></div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#722ed1' }}>✨ 当周工作亮点 (CRM 诊断)</div>
                  <Card size="small" style={{ marginBottom: 16 }} headStyle={{ background: '#fffb8f' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 50 }}>{viewingCrmReport.sales_highlights || '正常无大额签约/高频客户动作'}</div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#722ed1' }}>⚠️ 销售卡点与异常预警 (CRM 异常)</div>
                  <Card size="small" style={{ marginBottom: 16, border: '1px solid #ffe58f' }} headStyle={{ background: '#fffbe6' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 50, color: viewingCrmReport.sales_blockers?.includes('1. 目前') ? 'inherit' : '#d46b08' }}>{viewingCrmReport.sales_blockers || '无异常'}</div>
                  </Card>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>1、目前负责跟进的正在实施项目进度情况</div>
                  <Card size="small" style={{ marginBottom: 12 }} headStyle={{ background: '#f6ffed' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 40, fontFamily: 'monospace' }}>{viewingCrmReport.crm_active_projects || '—'}</div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#1677ff' }}>2、本周项目子任务及里程碑节点交付动作明细</div>
                  <Card size="small" style={{ marginBottom: 12 }} headStyle={{ background: '#e6f7ff' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 40, fontFamily: 'monospace' }}>{viewingCrmReport.crm_milestone_tasks || '—'}</div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#faad14' }}>3、处于暂停或异常挂起状态的项目</div>
                  <Card size="small" style={{ marginBottom: 12, border: viewingCrmReport.crm_suspended_projects && viewingCrmReport.crm_suspended_projects !== '—' ? '1px solid #ffe58f' : '1px solid #f0f0f0' }} headStyle={{ background: '#fffbe6' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 40, color: viewingCrmReport.crm_suspended_projects && viewingCrmReport.crm_suspended_projects !== '—' ? '#d46b08' : 'inherit', fontWeight: viewingCrmReport.crm_suspended_projects && viewingCrmReport.crm_suspended_projects !== '—' ? '500' : 'normal' }}>
                      {viewingCrmReport.crm_suspended_projects || '—'}
                    </div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#ff4d4f' }}>4、预设立立警 (超期未签合同)</div>
                  <Card size="small" style={{ marginBottom: 12, border: viewingCrmReport.crm_no_contract_warning && viewingCrmReport.crm_no_contract_warning !== '—' ? '1px solid #ffa39e' : '1px solid #f0f0f0' }} headStyle={{ background: '#fff1f0' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 40, color: viewingCrmReport.crm_no_contract_warning && viewingCrmReport.crm_no_contract_warning !== '—' ? '#cf1322' : 'inherit', fontWeight: viewingCrmReport.crm_no_contract_warning && viewingCrmReport.crm_no_contract_warning !== '—' ? '500' : 'normal' }}>
                      {viewingCrmReport.crm_no_contract_warning || '—'}
                    </div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#faad14' }}>5、交付卡点 (有进度未开票)</div>
                  <Card size="small" style={{ marginBottom: 12, border: viewingCrmReport.crm_unbilled_warning && viewingCrmReport.crm_unbilled_warning !== '—' ? '1px solid #ffe58f' : '1px solid #f0f0f0' }} headStyle={{ background: '#fffbe6' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 40, color: viewingCrmReport.crm_unbilled_warning && viewingCrmReport.crm_unbilled_warning !== '—' ? '#d46b08' : 'inherit', fontWeight: viewingCrmReport.crm_unbilled_warning && viewingCrmReport.crm_unbilled_warning !== '—' ? '500' : 'normal' }}>
                      {viewingCrmReport.crm_unbilled_warning || '—'}
                    </div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#ff4d4f' }}>6、收欠款预警 (已开票未回款)</div>
                  <Card size="small" style={{ marginBottom: 12, border: viewingCrmReport.crm_unreceived_warning && viewingCrmReport.crm_unreceived_warning !== '—' ? '1px solid #ffa39e' : '1px solid #f0f0f0' }} headStyle={{ background: '#fff1f0' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 40, color: viewingCrmReport.crm_unreceived_warning && viewingCrmReport.crm_unreceived_warning !== '—' ? '#cf1322' : 'inherit', fontWeight: viewingCrmReport.crm_unreceived_warning && viewingCrmReport.crm_unreceived_warning !== '—' ? '500' : 'normal' }}>
                      {viewingCrmReport.crm_unreceived_warning || '—'}
                    </div>
                  </Card>

                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#722ed1' }}>7、个人工作饱和度与项目健康度诊断</div>
                  <Card size="small" style={{ marginBottom: 16, border: viewingCrmReport.crm_health_diagnosis && (viewingCrmReport.crm_health_diagnosis.includes('红色警报') || viewingCrmReport.crm_health_diagnosis.includes('黄色预警')) ? '1px solid #d3adf7' : '1px solid #f0f0f0' }} headStyle={{ background: '#f9f0ff' }}>
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 40, color: viewingCrmReport.crm_health_diagnosis && (viewingCrmReport.crm_health_diagnosis.includes('红色警报') || viewingCrmReport.crm_health_diagnosis.includes('黄色预警')) ? '#531dab' : 'inherit', fontWeight: viewingCrmReport.crm_health_diagnosis && (viewingCrmReport.crm_health_diagnosis.includes('红色警报') || viewingCrmReport.crm_health_diagnosis.includes('黄色预警')) ? '500' : 'normal' }}>
                      {viewingCrmReport.crm_health_diagnosis || '工作饱和度与项目实施状态正常。'}
                    </div>
                  </Card>
                </>
              )}
            </div>
          )}
        </Modal>

        {/* 周报填写Modal弹窗 */}
        <Modal
          title={<strong>📅 填写我的个人周复盘周报（当前选定周：{selectedMonday} ~ {selectedSunday}）</strong>}
          open={weeklyWriteVisible}
          onCancel={() => setWeeklyWriteVisible(false)}
          footer={[
            <Button key="cancel" onClick={() => setWeeklyWriteVisible(false)}>
              取消
            </Button>,
            <Button
              key="draft"
              onClick={() => {
                setWeeklyStatusToSubmit('draft')
                weeklyForm.submit()
              }}
              loading={weeklySubmitLoading}
            >
              暂存草稿
            </Button>,
            <Button
              key="submit"
              type="primary"
              onClick={() => {
                setWeeklyStatusToSubmit('submitted')
                weeklyForm.submit()
              }}
              loading={weeklySubmitLoading}
            >
              正式提交
            </Button>
          ]}
          width={800}
          destroyOnHidden
        >
          <div style={{ margin: '12px 0' }}>
            <Space style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                ghost
                icon={<SyncOutlined />}
                loading={weeklyExtractLoading}
                onClick={handleAutoExtractWeekly}
              >
                导入上周周报和本周播报
              </Button>
              <Button
                type="primary"
                danger
                icon={<SyncOutlined />}
                loading={weeklyCrmExtractLoading}
                onClick={handleAutoExtractCrmWeekly}
              >
                ⚡ 智能拉取 CRM 业绩与进度
              </Button>
              <Button
                type="primary"
                style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                icon={<SyncOutlined spin={weeklyAiOptimizing} />}
                loading={weeklyAiOptimizing}
                onClick={handleAiOptimizeWeekly}
              >
                🪄 AI 助手智能整理
              </Button>
            </Space>
            
            <Form
              form={weeklyForm}
              layout="vertical"
              onFinish={handleWeeklySubmit}
              loading={weeklyWriteLoading}
            >
              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🎯 本周目标计划</div>
              {!isMarketing && (
                <Form.Item name="delivery_plan" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={3} placeholder="请输入本周的项目交付工作计划..." />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item name="sales_plan" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={3} placeholder="请输入本周的销售工作计划..." />
                </Form.Item>
              )}

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🔥 本周实际完成 (支持一键导入推荐内容)</div>
              {!isMarketing && (
                <Form.Item name="delivery_actual" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={4} placeholder="请输入本周项目交付的实际完成情况..." />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item name="sales_actual" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={4} placeholder="请输入本周销售的实际完成情况..." />
                </Form.Item>
              )}

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>📊 计划达成率说明</div>
              {!isMarketing && (
                <Form.Item name="delivery_rate" style={{ marginBottom: 0 }}>
                  <Input placeholder="例如：90% 或 基本达成" />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item name="sales_rate" style={{ marginBottom: 0 }}>
                  <Input placeholder="例如：80% 或 新签达成100%" />
                </Form.Item>
              )}

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🏆 本周工作亮点</div>
              {!isMarketing && (
                <Form.Item name="delivery_highlights" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={2} placeholder="请输入项目交付侧的亮点..." />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item name="sales_highlights" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={2} placeholder="请输入销售侧的工作亮点..." />
                </Form.Item>
              )}

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🚧 本周工作卡点/难点</div>
              {!isMarketing && (
                <Form.Item name="delivery_blockers" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={2} placeholder="请输入项目交付侧遇到的困难阻碍..." />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item name="sales_blockers" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={2} placeholder="请输入销售侧遇到的困难阻碍..." />
                </Form.Item>
              )}

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🤝 需要支持协调</div>
              {!isMarketing && (
                <Form.Item name="delivery_support" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={2} placeholder="如需要协调其他人或团队支持交付，请填写..." />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item name="sales_support" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={2} placeholder="如需要协调其他人或团队支持销售，请填写..." />
                </Form.Item>
              )}

              <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🚀 下周工作目标</div>
              {!isMarketing && (
                <Form.Item name="next_delivery_plan" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={3} placeholder="请输入下周的项目交付目标计划..." />
                </Form.Item>
              )}
              {isMarketing && (
                <Form.Item name="next_sales_plan" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={3} placeholder="请输入下周的销售目标计划..." />
                </Form.Item>
              )}
            </Form>
          </div>
        </Modal>

        {/* ⚡ 智能拉取 CRM 业绩与进度预览 Modal */}
        <Modal
          title={
            <Space>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1677ff' }}>⚡ 智能拉取 CRM 数据预览与选择导入</span>
            </Space>
          }
          open={crmPreviewVisible}
          zIndex={1100}
          onOk={handleConfirmImportCrm}
          onCancel={() => setCrmPreviewVisible(false)}
          okText="确认填入选中的数据"
          cancelText="取消"
          width={800}
          styles={{ body: { maxHeight: '600px', overflowY: 'auto', padding: '16px' } }}
        >
          {/* 1. 分析环境描述卡片 */}
          <Card 
            size="small" 
            style={{ 
              marginBottom: '16px', 
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', 
              border: '1px solid #d9d9d9',
              borderRadius: '8px' 
            }}
          >
            <Descriptions title="🔍 CRM 关联分析诊断概要" size="small" column={2}>
              <Descriptions.Item label="当前分析对象">
                <Text strong style={{ color: '#102a4c' }}>{user?.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="分析周期">
                <Text strong>{selectedMonday} ~ {selectedSunday}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="匹配分析岗位">
                <Tag color={isMarketing ? 'blue' : 'green'}>
                  {isMarketing ? '营销与销售线 (分析商机/合同/回款/拜访)' : '交付与技术线 (分析正在实施项目/子任务/里程碑)'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="数据库来源">
                <Text type="secondary">gzzdpm 只读实例</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <div style={{ marginBottom: '12px' }}>
            <Text type="secondary">
              说明：系统已智能分析只读 CRM 数据库中的关联信息。请勾选您需要填入周报的板块（带蓝色边框的条目为当前选中的推荐项）：
            </Text>
          </div>

          {/* 2. 各维度展示卡片 */}
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {isMarketing ? (
              <>
                {/* 实际完成 */}
                <Card
                  size="small"
                  title={
                    <Checkbox 
                      checked={crmSelectedKeys.actual} 
                      onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, actual: e.target.checked })}
                    >
                      <span style={{ fontWeight: 'bold' }}>📅 当周实际完成 (销售签约与拜访)</span>
                    </Checkbox>
                  }
                  style={{ border: crmSelectedKeys.actual ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
                  styles={{ body: { backgroundColor: crmSelectedKeys.actual ? '#f0f7ff' : '#fafafa' } }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                    {crmPreviewData?.sales_actual}
                  </div>
                </Card>

                {/* 指标达成率 */}
                <Card
                  size="small"
                  title={
                    <Checkbox 
                      checked={crmSelectedKeys.rate} 
                      onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, rate: e.target.checked })}
                    >
                      <span style={{ fontWeight: 'bold' }}>📈 本月计划达成率指标</span>
                    </Checkbox>
                  }
                  style={{ border: crmSelectedKeys.rate ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
                  styles={{ body: { backgroundColor: crmSelectedKeys.rate ? '#f0f7ff' : '#fafafa' } }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                    {crmPreviewData?.sales_rate}
                  </div>
                </Card>

                {/* 工作亮点 */}
                <Card
                  size="small"
                  title={
                    <Checkbox 
                      checked={crmSelectedKeys.highlights} 
                      onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, highlights: e.target.checked })}
                    >
                      <span style={{ fontWeight: 'bold' }}>✨ 当周工作亮点 (自动诊断建议)</span>
                    </Checkbox>
                  }
                  style={{ border: crmSelectedKeys.highlights ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
                  styles={{ body: { backgroundColor: crmSelectedKeys.highlights ? '#f0f7ff' : '#fafafa' } }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                    {crmPreviewData?.sales_highlights}
                  </div>
                </Card>

                {/* 工作卡点 */}
                <Card
                  size="small"
                  title={
                    <Checkbox 
                      checked={crmSelectedKeys.blockers} 
                      onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, blockers: e.target.checked })}
                    >
                      <span style={{ fontWeight: 'bold' }}>⚠️ 当周工作卡点与异常难点</span>
                    </Checkbox>
                  }
                  style={{ border: crmSelectedKeys.blockers ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
                  styles={{ body: { backgroundColor: crmSelectedKeys.blockers ? '#f0f7ff' : '#fafafa' } }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                    {crmPreviewData?.sales_blockers}
                  </div>
                </Card>
              </>
            ) : (
              <>


                {/* 3. 正在实施项目进度情况 */}
                <Card
                  size="small"
                  title={
                    <Checkbox 
                      checked={crmSelectedKeys.crm_active_projects} 
                      onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, crm_active_projects: e.target.checked })}
                    >
                      <span style={{ fontWeight: 'bold' }}>📅 目前负责跟进的正在实施项目进度情况</span>
                    </Checkbox>
                  }
                  style={{ border: crmSelectedKeys.crm_active_projects ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
                  styles={{ body: { backgroundColor: crmSelectedKeys.crm_active_projects ? '#f0f7ff' : '#fafafa' } }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                    {crmPreviewData?.crm_active_projects || '—'}
                  </div>
                </Card>

                {/* 4. 本周项目子任务及里程碑节点交付动作明细 */}
                <Card
                  size="small"
                  title={
                    <Checkbox 
                      checked={crmSelectedKeys.crm_milestone_tasks} 
                      onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, crm_milestone_tasks: e.target.checked })}
                    >
                      <span style={{ fontWeight: 'bold' }}>🗓 本周项目子任务及里程碑节点交付动作明细</span>
                    </Checkbox>
                  }
                  style={{ border: crmSelectedKeys.crm_milestone_tasks ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
                  styles={{ body: { backgroundColor: crmSelectedKeys.crm_milestone_tasks ? '#f0f7ff' : '#fafafa' } }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                    {crmPreviewData?.crm_milestone_tasks || '—'}
                  </div>
                </Card>

                {/* 5. 处于暂停或异常挂起状态的项目 */}
                <Card
                  size="small"
                  title={
                    <Checkbox 
                      checked={crmSelectedKeys.crm_suspended_projects} 
                      onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, crm_suspended_projects: e.target.checked })}
                    >
                      <span style={{ fontWeight: 'bold', color: '#faad14' }}>⚠️ 处于暂停或异常挂起状态的项目</span>
                    </Checkbox>
                  }
                  style={{ border: crmSelectedKeys.crm_suspended_projects ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
                  styles={{ body: { backgroundColor: crmSelectedKeys.crm_suspended_projects ? '#f0f7ff' : '#fafafa' } }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                    {crmPreviewData?.crm_suspended_projects || '—'}
                  </div>
                </Card>

                {/* 6. 预设立立警 (超期未签合同) */}
                <Card
                  size="small"
                  title={
                    <Checkbox 
                      checked={crmSelectedKeys.crm_no_contract_warning} 
                      onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, crm_no_contract_warning: e.target.checked })}
                    >
                      <span style={{ fontWeight: 'bold', color: '#ff4d4f' }}>🚨 预设立立警 (超期未签合同)</span>
                    </Checkbox>
                  }
                  style={{ border: crmSelectedKeys.crm_no_contract_warning ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
                  styles={{ body: { backgroundColor: crmSelectedKeys.crm_no_contract_warning ? '#f0f7ff' : '#fafafa' } }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                    {crmPreviewData?.crm_no_contract_warning || '—'}
                  </div>
                </Card>

                {/* 7. 交付卡点 (有进度未开票) */}
                <Card
                  size="small"
                  title={
                    <Checkbox 
                      checked={crmSelectedKeys.crm_unbilled_warning} 
                      onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, crm_unbilled_warning: e.target.checked })}
                    >
                      <span style={{ fontWeight: 'bold', color: '#faad14' }}>⚠️ 交付卡点 (有进度未开票)</span>
                    </Checkbox>
                  }
                  style={{ border: crmSelectedKeys.crm_unbilled_warning ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
                  styles={{ body: { backgroundColor: crmSelectedKeys.crm_unbilled_warning ? '#f0f7ff' : '#fafafa' } }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                    {crmPreviewData?.crm_unbilled_warning || '—'}
                  </div>
                </Card>

                {/* 8. 收欠款预警 (已开票未回款) */}
                <Card
                  size="small"
                  title={
                    <Checkbox 
                      checked={crmSelectedKeys.crm_unreceived_warning} 
                      onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, crm_unreceived_warning: e.target.checked })}
                    >
                      <span style={{ fontWeight: 'bold', color: '#ff4d4f' }}>🚨 收欠款预警 (已开票未回款)</span>
                    </Checkbox>
                  }
                  style={{ border: crmSelectedKeys.crm_unreceived_warning ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
                  styles={{ body: { backgroundColor: crmSelectedKeys.crm_unreceived_warning ? '#f0f7ff' : '#fafafa' } }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                    {crmPreviewData?.crm_unreceived_warning || '—'}
                  </div>
                </Card>

                {/* 9. 饱和度与健康度诊断 */}
                <Card
                  size="small"
                  title={
                    <Checkbox 
                      checked={crmSelectedKeys.crm_health_diagnosis} 
                      onChange={(e) => setCrmSelectedKeys({ ...crmSelectedKeys, crm_health_diagnosis: e.target.checked })}
                    >
                      <span style={{ fontWeight: 'bold', color: '#ff4d4f' }}>🩺 饱和度与健康度诊断</span>
                    </Checkbox>
                  }
                  style={{ border: crmSelectedKeys.crm_health_diagnosis ? '1px solid #1677ff' : '1px solid #f0f0f0' }}
                  styles={{ body: { backgroundColor: crmSelectedKeys.crm_health_diagnosis ? '#f0f7ff' : '#fafafa' } }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px', padding: '8px', border: '1px dashed #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                    {crmPreviewData?.crm_health_diagnosis || '—'}
                  </div>
                </Card>
              </>
            )}
          </Space>
        </Modal>

        {/* 🪄 AI 助手智能整理微调确认 Modal */}
        <Modal
          title={
            <Space>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#722ed1' }}>🪄 AI 助手周报整理与优化微调</span>
            </Space>
          }
          open={aiOptimizeModalVisible}
          zIndex={1100}
          onCancel={() => setAiOptimizeModalVisible(false)}
          onOk={handleConfirmAiOptimize}
          okText="确认并填回周报"
          cancelText="取消"
          width={750}
          destroyOnHidden
        >
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f9f0ff', border: '1px solid #d3adf7', borderRadius: '4px', fontSize: '13px', color: '#722ed1' }}>
              💡 以下是 AI 周报助手为您润色整理后的内容，您可以在下方文本框中直接进行微调，确认无误后点击“确认并填回周报”即可自动覆盖并回填主表单。
            </div>
            <Form
              form={aiOptimizeForm}
              layout="vertical"
            >
              <Form.Item
                name="actual"
                label={<span style={{ fontWeight: 'bold' }}>🔥 本周实际完成 (优化后)</span>}
              >
                <Input.TextArea rows={6} placeholder="润色后的本周实际完成情况..." />
              </Form.Item>

              <Form.Item
                name="highlights"
                label={<span style={{ fontWeight: 'bold' }}>🏆 本周工作亮点 (优化后)</span>}
              >
                <Input.TextArea rows={3} placeholder="润色后的本周亮点..." />
              </Form.Item>

              <Form.Item
                name="blockers"
                label={<span style={{ fontWeight: 'bold' }}>🚧 本周工作卡点/难点 (优化后)</span>}
              >
                <Input.TextArea rows={3} placeholder="润色后的本周卡点与难点..." />
              </Form.Item>

              <Form.Item
                name="support"
                label={<span style={{ fontWeight: 'bold' }}>🤝 需要支持协调 (优化后)</span>}
              >
                <Input.TextArea rows={2} placeholder="AI 分析或润色出的需要支持与协调事项（若无，可留空，系统不会覆盖原内容）..." />
              </Form.Item>

              <Form.Item
                name="next_plan"
                label={<span style={{ fontWeight: 'bold' }}>🚀 下周工作目标 (优化后)</span>}
              >
                <Input.TextArea rows={4} placeholder="润色后的下周工作目标..." />
              </Form.Item>
            </Form>
          </div>
        </Modal>

        {/* 周报编辑Modal弹窗 */}
        <Modal
          title={<strong>📅 编辑员工周复盘周报（当前选定周：{selectedMonday} ~ {selectedSunday} - 用户：{editingWeeklyReport?.user_name}）</strong>}
          open={weeklyEditVisible}
          onCancel={() => setWeeklyEditVisible(false)}
          footer={[
            <Button key="cancel" onClick={() => setWeeklyEditVisible(false)}>
              取消
            </Button>,
            <Button
              key="submit"
              type="primary"
              onClick={() => {
                weeklyEditForm.submit()
              }}
              loading={weeklyEditLoading}
            >
              保存修改
            </Button>
          ]}
          width={800}
          destroyOnHidden
        >
          <div style={{ margin: '12px 0' }}>
            <Form
              form={weeklyEditForm}
              layout="vertical"
              onFinish={handleWeeklyEditSubmit}
              loading={weeklyEditLoading}
            >
              {(() => {
                const isEditingMarketing = editingWeeklyReport?.user_position_type === 'marketing' ||
                  ['target_officer', 'marketing_staff', 'tech_marketing'].includes(editingWeeklyReport?.user_role || '');
                
                return (
                  <>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🎯 本周目标计划</div>
                    {!isEditingMarketing && (
                      <Form.Item name="delivery_plan" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={3} placeholder="请输入本周的项目交付工作计划..." />
                      </Form.Item>
                    )}
                    {isEditingMarketing && (
                      <Form.Item name="sales_plan" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={3} placeholder="请输入本周的销售工作计划..." />
                      </Form.Item>
                    )}

                    <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🔥 本周实际完成</div>
                    {!isEditingMarketing && (
                      <Form.Item name="delivery_actual" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={4} placeholder="请输入本周项目交付的实际完成情况..." />
                      </Form.Item>
                    )}
                    {isEditingMarketing && (
                      <Form.Item name="sales_actual" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={4} placeholder="请输入本周销售的实际完成情况..." />
                      </Form.Item>
                    )}

                    <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>📊 计划达成率说明</div>
                    {!isEditingMarketing && (
                      <Form.Item name="delivery_rate" style={{ marginBottom: 0 }}>
                        <Input placeholder="例如：90% 或 基本达成" />
                      </Form.Item>
                    )}
                    {isEditingMarketing && (
                      <Form.Item name="sales_rate" style={{ marginBottom: 0 }}>
                        <Input placeholder="例如：80% 或 新签达成100%" />
                      </Form.Item>
                    )}

                    <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🏆 本周工作亮点</div>
                    {!isEditingMarketing && (
                      <Form.Item name="delivery_highlights" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="请输入项目交付侧的亮点..." />
                      </Form.Item>
                    )}
                    {isEditingMarketing && (
                      <Form.Item name="sales_highlights" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="请输入销售侧的工作亮点..." />
                      </Form.Item>
                    )}

                    <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🚧 本周工作卡点/难点</div>
                    {!isEditingMarketing && (
                      <Form.Item name="delivery_blockers" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="请输入项目交付侧遇到的困难阻碍..." />
                      </Form.Item>
                    )}
                    {isEditingMarketing && (
                      <Form.Item name="sales_blockers" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="请输入销售侧遇到的困难阻碍..." />
                      </Form.Item>
                    )}

                    <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🤝 需要支持协调</div>
                    {!isEditingMarketing && (
                      <Form.Item name="delivery_support" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="如需要协调其他人或团队支持交付，请填写..." />
                      </Form.Item>
                    )}
                    {isEditingMarketing && (
                      <Form.Item name="sales_support" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="如需要协调其他人或团队支持销售，请填写..." />
                      </Form.Item>
                    )}

                    <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 8px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', color: '#262626' }}>🚀 下周工作目标</div>
                    {!isEditingMarketing && (
                      <Form.Item name="next_delivery_plan" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={3} placeholder="请输入下周的项目交付目标计划..." />
                      </Form.Item>
                    )}
                    {isEditingMarketing && (
                      <Form.Item name="next_sales_plan" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={3} placeholder="请输入下周的销售目标计划..." />
                      </Form.Item>
                    )}
                  </>
                )
              })()}
            </Form>
          </div>
        </Modal>





        {/* 隐藏的用于 PDF 导出的个人周复盘渲染模板 */}
        <div style={{ position: 'absolute', top: -9999, left: -9999, width: '794px', zIndex: -100 }}>
          {viewingWeeklyReport && (
            <div id="user-report-pdf-export-temp" style={{ padding: '32px', backgroundColor: '#ffffff', minHeight: '297mm' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1677ff', margin: '0 0 8px 0' }}>
                  🔍 员工周复盘详情
                </h1>
                <div style={{ fontSize: '13px', color: '#595959' }}>
                  周范围：{selectedMonday} ~ {selectedSunday} - 成员：{viewingWeeklyReport.user_name}
                </div>
              </div>

              <Descriptions bordered column={2} size="small" style={{ marginBottom: 20 }}>
                <Descriptions.Item label="成员姓名"><strong>{viewingWeeklyReport.user_name}</strong></Descriptions.Item>
                <Descriptions.Item label="岗位类别">
                  <Tag color="cyan">
                    {viewingWeeklyReport.user_position_type === 'marketing' ? '营销岗' : '交付及其他'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="填报状态">
                  {viewingWeeklyReport.status === 'submitted' ? (
                    <Tag color="success">已提交</Tag>
                  ) : (
                    <Tag color="default">草稿</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="提交时间">
                  {viewingWeeklyReport.submitted_at 
                    ? dayjs(viewingWeeklyReport.submitted_at).format('YYYY-MM-DD HH:mm:ss')
                    : '—'}
                </Descriptions.Item>
              </Descriptions>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff', marginBottom: '6px' }}>🎯 本周目标计划</div>
                  <Card size="small" headStyle={{ background: '#f5f5f5' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#434343' }}>
                      {(isViewingMarketing ? viewingWeeklyReport.sales_plan : viewingWeeklyReport.delivery_plan) || '—'}
                    </div>
                  </Card>
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff', marginBottom: '6px' }}>🔥 本周实际完成</div>
                  <Card size="small" headStyle={{ background: '#f6ffed' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#434343' }}>
                      {(isViewingMarketing ? viewingWeeklyReport.sales_actual : viewingWeeklyReport.delivery_actual) || '—'}
                    </div>
                  </Card>
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff', marginBottom: '6px' }}>📊 计划达成率说明</div>
                  <Card size="small" headStyle={{ background: '#e6f7ff' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#434343' }}>
                      {(isViewingMarketing ? viewingWeeklyReport.sales_rate : viewingWeeklyReport.delivery_rate) || '—'}
                    </div>
                  </Card>
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff', marginBottom: '6px' }}>🏆 本周工作亮点</div>
                  <Card size="small" headStyle={{ background: '#fffb8f' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#434343' }}>
                      {(isViewingMarketing ? viewingWeeklyReport.sales_highlights : viewingWeeklyReport.delivery_highlights) || '—'}
                    </div>
                  </Card>
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff', marginBottom: '6px' }}>🚧 本周工作卡点/难点</div>
                  <Card size="small" headStyle={{ background: '#fff2e8' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#434343' }}>
                      {(isViewingMarketing ? viewingWeeklyReport.sales_blockers : viewingWeeklyReport.delivery_blockers) || '—'}
                    </div>
                  </Card>
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff', marginBottom: '6px' }}>🤝 需要支持协调</div>
                  <Card size="small" headStyle={{ background: '#feffe6' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#434343' }}>
                      {(isViewingMarketing ? viewingWeeklyReport.sales_support : viewingWeeklyReport.delivery_support) || '—'}
                    </div>
                  </Card>
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff', marginBottom: '6px' }}>🚀 下周工作目标</div>
                  <Card size="small" headStyle={{ background: '#f5f5f5' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#434343' }}>
                      {(isViewingMarketing ? viewingWeeklyReport.next_sales_plan : viewingWeeklyReport.next_delivery_plan) || '—'}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 外部自定义 Markdown 渲染预览组件，支持表格、粗体、多级标题和引用块
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

    // 1. 表格
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

    // 2. 列表
    if (line.startsWith('- ') || line.startsWith('* ')) {
      inList = true;
      listItems.push(line.slice(2));
      continue;
    } else {
      flushList();
    }

    // 3. 标题
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

    // 4. 引用
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={elementKey++} style={{ borderLeft: '3px solid #13c2c2', padding: '4px 10px', background: '#e6fffb', margin: '0 0 10px 0', borderRadius: '0 4px 4px 0', fontSize: '12px', color: '#595959' }}>
          {parseInlineMarkdown(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // 5. 空行
    if (line === '') {
      if (elements.length > 0 && elements[elements.length - 1] !== 'br') {
        elements.push(<div key={elementKey++} style={{ height: '6px' }} />);
      }
      continue;
    }

    // 6. 普通行
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

export default WeeklyReports
