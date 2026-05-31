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

  const trend = weeklyTrend || defaultTrend
  const dates = trend.dates
  const contracts = trend.newContracts
  
  // 基础目标与挑战目标累计（若后端无数据则使用原逻辑的平均分解进行兜底：基础 6200/15，挑战 8000/15）
  const baseTargets = trend.newContractsTarget && trend.newContractsTarget.length > 0
    ? trend.newContractsTarget
    : dates.map((_, idx) => Math.round((idx + 1) * (6200 / 15) * 100) / 100)

  const challengeTargets = trend.newContractsChallengeTarget && trend.newContractsChallengeTarget.length > 0
    ? trend.newContractsChallengeTarget
    : dates.map((_, idx) => Math.round((idx + 1) * (8000 / 15) * 100) / 100)

  // 根据当前主题，计算 ECharts 配色方案
  let axisTextColor = '#4a2a2a'
  let gridLineColor = 'rgba(212,175,55,0.15)'
  let tooltipBg = 'rgba(255, 255, 255, 0.96)'
  let tooltipBorder = '#d4af37'
  let tooltipTextColor = '#3c1515'
  let lineColor = '#b71c1c'
  let areaColorStart = 'rgba(183,28,28,0.2)'
  let targetLineColor = '#fa8c16'
  let challengeLineColor = '#ff4d4f'

  if (theme === 'theme-dark-red') {
    axisTextColor = 'rgba(255,255,255,0.7)'
    gridLineColor = 'rgba(255,255,255,0.06)'
    tooltipBg = 'rgba(30, 8, 8, 0.95)'
    tooltipBorder = '#ff4d4f'
    tooltipTextColor = '#ffffff'
    lineColor = '#ff4d4f'
    areaColorStart = 'rgba(255,77,79,0.25)'
    targetLineColor = '#fa8c16'
    challengeLineColor = '#ffd700'
  } else if (theme === 'theme-gold') {
    axisTextColor = '#5c4c2d'
    gridLineColor = 'rgba(184,134,11,0.15)'
    tooltipBg = 'rgba(255, 255, 255, 0.96)'
    tooltipBorder = '#b8860b'
    tooltipTextColor = '#4a3c1c'
    lineColor = '#8b6508'
    areaColorStart = 'rgba(184,134,11,0.25)'
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
      bottom: '3%',
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
        padding: isScrollTheme ? '1.5rem 1.8rem' : '1.5rem',
        height: 'calc(100% - 3rem)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 宣纸四角包边 */}
      {isScrollTheme && <div className="scroll-corner-decor-top-right" />}
      {isScrollTheme && <div className="scroll-corner-decor-bottom-left" />}

      <h3
        style={{
          margin: '0 0 1rem 0',
          fontSize: '1.2rem',
          color: lineColor,
          borderBottom: '2px solid var(--border-color)',
          paddingBottom: '0.8rem',
          fontWeight: 'bold'
        }}
      >
        📈 累计合同新签周趋势对比 (万元)
      </h3>
      <div style={{ flex: 1, width: '100%' }}>
        <ReactECharts key={theme} option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  )
}

export default TrendChart
