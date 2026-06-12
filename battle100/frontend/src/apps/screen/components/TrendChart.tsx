import React from 'react'
import ReactECharts from 'echarts-for-react'

interface TrendChartProps {
  theme?: string
  weeklyTrend?: {
    dates: string[]
    newContracts: number[]
    newContractsTarget?: number[]
    newContractsChallengeTarget?: number[]
    happinessActions: number[]
    ironTriangle: number[]
    validLeads: number[]
  }
}

const TrendChart: React.FC<TrendChartProps> = ({ theme = 'theme-light-red', weeklyTrend }) => {
  // 默认周趋势置空，防止显示虚假对比数据
  const defaultTrend = {
    dates: [],
    newContracts: [],
    newContractsTarget: [],
    newContractsChallengeTarget: [],
    happinessActions: [],
    ironTriangle: [],
    validLeads: []
  }

  // 计算当前战役所处的真实周次 (2026-06-01 为第一周第一天)，所有注释必须使用中文
  const getCampaignWeek = () => {
    const startDate = new Date(2026, 5, 1); // 2026-06-01 (JS中月份从0开始，5表示6月)
    const today = new Date();
    startDate.setHours(0, 0, 0, 0);
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (todayZero < startDate) return 1;
    const diffTime = todayZero.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const week = Math.floor(diffDays / 7) + 1;
    return Math.min(Math.max(week, 1), 15);
  }

  const currentWeek = getCampaignWeek()
  const maxDisplayWeek = Math.min(Math.max(3, currentWeek + 1), 15)

  const trend = weeklyTrend || defaultTrend
  
  // 根据当前进度局部截取并放大展示，所有注释必须使用中文
  const dates = trend.dates.slice(0, maxDisplayWeek)
  const contracts = trend.newContracts.slice(0, maxDisplayWeek)
  
  const baseTargetsFull = trend.newContractsTarget && trend.newContractsTarget.length > 0
    ? trend.newContractsTarget
    : trend.dates.map((_, idx) => Math.round((idx + 1) * (6200 / 15) * 100) / 100)
  const baseTargets = baseTargetsFull.slice(0, maxDisplayWeek)

  const challengeTargetsFull = trend.newContractsChallengeTarget && trend.newContractsChallengeTarget.length > 0
    ? trend.newContractsChallengeTarget
    : trend.dates.map((_, idx) => Math.round((idx + 1) * (8000 / 15) * 100) / 100)
  const challengeTargets = challengeTargetsFull.slice(0, maxDisplayWeek)

  // 根据当前主题，计算 ECharts 配色方案
  let axisTextColor = '#4a2a2a'
  let gridLineColor = 'rgba(212,175,55,0.15)'
  let tooltipBg = 'rgba(255, 255, 255, 0.96)'
  let tooltipBorder = '#d4af37'
  let tooltipTextColor = '#3c1515'
  let lineColor = '#1677ff'
  let areaColorStart = 'rgba(22,119,255,0.15)'
  let targetLineColor = '#fa8c16'
  let challengeLineColor = '#ff4d4f'

  if (theme === 'theme-dark-red') {
    axisTextColor = 'rgba(255,255,255,0.7)'
    gridLineColor = 'rgba(255,255,255,0.06)'
    tooltipBg = 'rgba(30, 8, 8, 0.95)'
    tooltipBorder = '#40a9ff'
    tooltipTextColor = '#ffffff'
    lineColor = '#40a9ff'
    areaColorStart = 'rgba(64,169,255,0.2)'
    targetLineColor = '#fa8c16'
    challengeLineColor = '#ffd700'
  } else if (theme === 'theme-gold') {
    axisTextColor = '#5c4c2d'
    gridLineColor = 'rgba(184,134,11,0.15)'
    tooltipBg = 'rgba(255, 255, 255, 0.96)'
    tooltipBorder = '#1890ff'
    tooltipTextColor = '#4a3c1c'
    lineColor = '#096dd9'
    areaColorStart = 'rgba(24,144,255,0.2)'
    targetLineColor = '#fa8c16'
    challengeLineColor = '#d46b08'
  }

  // 配置 ECharts Option
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: tooltipTextColor, fontSize: 13, fontWeight: 'bold' },
      borderWidth: 1,
    },
    legend: {
      data: ['新签合同额 (实际)', '基础目标 (累计)', '挑战目标 (累计)'],
      textStyle: { color: axisTextColor, fontSize: 13, fontWeight: 'bold' },
      top: '0%'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%', // 增大底部留白，保证 X 轴文本在容器内完美显现，不被截断
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: gridLineColor } },
      axisLabel: { color: axisTextColor, fontSize: 12, fontWeight: 'bold' }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: gridLineColor } },
      splitLine: { lineStyle: { color: gridLineColor } },
      axisLabel: { color: axisTextColor, fontSize: 12, fontWeight: 'bold' }
    },
    series: [
      {
        name: '新签合同额 (实际)',
        type: 'line',
        data: contracts,
        smooth: true,
        showSymbol: true,
        symbolSize: 8,
        itemStyle: { color: lineColor },
        lineStyle: { width: 3.5, shadowBlur: 10, shadowColor: areaColorStart },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: areaColorStart },
              { offset: 1, color: 'rgba(255,255,255,0)' }
            ]
          }
        }
      },
      {
        name: '基础目标 (累计)',
        type: 'line',
        data: baseTargets,
        smooth: true,
        lineStyle: { type: 'dashed', width: 2, color: targetLineColor },
        itemStyle: { color: targetLineColor }
      },
      {
        name: '挑战目标 (累计)',
        type: 'line',
        data: challengeTargets,
        smooth: true,
        lineStyle: { type: 'dashed', width: 2, color: challengeLineColor },
        itemStyle: { color: challengeLineColor }
      }
    ]
  }

  const isScrollTheme = theme === 'theme-light-red' || theme === 'theme-gold'

  return (
    <div
      className={`screen-card ${isScrollTheme ? 'scroll-paper' : ''}`}
      style={{
        padding: isScrollTheme ? '1.25rem 1.5rem' : '1.25rem', // 对齐中间栏 padding
        height: '100%', // 高度设为 100% 自适应
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box' // 强制使用 border-box 避免向下溢出
      }}
    >
      {/* 宣纸四角包边 */}
      {isScrollTheme && <div className="scroll-corner-decor-top-right" style={{ transform: 'scale(0.6)' }} />}
      {isScrollTheme && <div className="scroll-corner-decor-bottom-left" style={{ transform: 'scale(0.6)' }} />}

      <h3
        style={{
          margin: '0 0 0.8rem 0', // 压缩底部边距
          fontSize: '1.15rem', // 对齐中间栏标题字号
          color: theme === 'theme-gold' ? '#8b6508' : '#b71c1c',
          borderBottom: '2px solid var(--border-color)',
          paddingBottom: '0.6rem', // 对齐中间栏标题间隙
          fontWeight: 'bold',
          flexShrink: 0
        }}
      >
        📈 累计合同新签周趋势对比 (万元)
      </h3>
      <div style={{ flex: 1, width: '100%', minHeight: 0, overflow: 'hidden' }}>
        <ReactECharts key={theme} option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  )
}

export default TrendChart
