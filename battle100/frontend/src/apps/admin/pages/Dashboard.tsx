import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Progress, Table, List, Button, Tag, Space, Typography, message, Modal, Input, Form, Badge, Select } from 'antd'
import {
  DollarOutlined,
  HeartOutlined,
  SmileOutlined,
  SendOutlined,
  NotificationOutlined,
  FireOutlined,
  RiseOutlined,
  FlagOutlined,
  UserOutlined
} from '@ant-design/icons'
import { getDashboardData, getMyStats, getTeamDetailedMetrics } from '@shared/api/dashboard'
import { get, post } from '@shared/api/client'
import { useAuthStore } from '@shared/stores/authStore'
import type { DashboardData, MyStatsResponse, RankingItem } from '@shared/types'

const { Title, Text } = Typography

const Dashboard: React.FC = () => {
  const { user } = useAuthStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [personalStats, setPersonalStats] = useState<MyStatsResponse['personal_stats'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false)
  const [broadcastForm] = Form.useForm()
  const [currentActionType, setCurrentActionType] = useState<string>('')
  const [usersList, setUsersList] = useState<{ id: number; name: string }[]>([])
  
  const [teamMetricsModalVisible, setTeamMetricsModalVisible] = useState(false)
  const [selectedTeamMetrics, setSelectedTeamMetrics] = useState<any>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

  const roundPct = (num: number) => {
    return Math.round(num * 100) / 100
  }

  const handleViewTeamMetrics = async (teamId: number) => {
    if (!teamId) return
    setTeamMetricsModalVisible(true)
    setMetricsLoading(true)
    setSelectedTeamMetrics(null)
    try {
      const res = await getTeamDetailedMetrics(teamId)
      if (res) {
        setSelectedTeamMetrics(res)
      }
    } catch (err) {
      message.error('获取战队多维度精细化指标失败')
    } finally {
      setMetricsLoading(false)
    }
  }

  // 加载系统内所有真实用户
  const loadUsersList = async () => {
    try {
      const res = await get('/users?page_size=1000')
      if (res && (res as any).items) {
        setUsersList((res as any).items)
      }
    } catch (err) {
      console.error('加载系统用户列表失败', err)
    }
  }

  const handleValuesChange = (changedValues: any, allValues: any) => {
    if (changedValues.actionType !== undefined) {
      const type = changedValues.actionType
      setCurrentActionType(type)
      broadcastForm.setFieldsValue({
        customerName: '',
        amount: '',
        projectName: '',
        contractName: '',
        employeeName: '',
        happinessScore: 20,
        actionDescription: '',
        content: type ? '攻坚一百天，亮剑破六千！今日' : ''
      })
      return
    }

    const { actionType, customerName, amount, projectName, contractName, employeeName, happinessScore, actionDescription } = allValues
    if (!actionType) return
    
    const prefix = '攻坚一百天，亮剑破六千！今日'
    let generated = ''
    
    switch (actionType) {
      case 'lead_25':
        generated = `${prefix}确定有效线索：客户为${customerName || 'XX'}，项目金额${amount || 'XX'}万，赢战百日！`
        break
      case 'lead_75':
        generated = `${prefix}确定${projectName || 'XX'}项目中地承接，客户为${customerName || 'XX'}，项目金额${amount || 'XX'}万，赢战百日！`
        break
      case 'contract':
        generated = `${prefix}确定${contractName || 'XX'}项目走完合同流程，客户为${customerName || 'XX'}，项目金额${amount || 'XX'}万，赢战百日！`
        break
      case 'triangle':
        generated = `${prefix}售前铁三角现场联动，客户分别为${customerName || 'XX'}，为客户幸福而奋斗，赢战百日！`
        break
      case 'happiness':
        generated = `${prefix}${employeeName || 'XX'}做到客户幸福标准${happinessScore ?? 0}分${actionDescription || 'XX'}动作，收到客户正反馈，为客户幸福而奋斗，赢战百日！`
        break
      default:
        break
    }
    
    broadcastForm.setFieldsValue({ content: generated })
  }

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      // 1. 获取全盘大屏概览数据
      const res = await getDashboardData()
      if (res) {
        setData(res as any)
      }

      // 2. 获取当前用户个人级联实绩与目标（用于个人双水位盘展示）
      const statsRes = await getMyStats()
      if (statsRes) {
        setPersonalStats((statsRes as any).personal_stats)
      }
    } catch (err) {
      console.error(err)
      message.error('加载系统作战看板数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    loadUsersList()
  }, [])

  // 发布广播
  const handlePublishBroadcast = async (values: any) => {
    try {
      const res = await post('/broadcast', {
        event_type: 'manual',
        content: values.content,
        push_channel: 'all'
      })
      if (res) {
        message.success('广播发布成功，大屏端与钉钉已同步推送')
        setBroadcastModalVisible(false)
        broadcastForm.resetFields()
        loadData()
      }
    } catch (err) {
      message.error('发布失败')
    }
  }

  const kpis = data?.kpiSummary

  // 构造战队赛马数据
  const teamRankingDataSource: any[] = []
  if (data?.zoneTeamsPK) {
    Object.entries(data.zoneTeamsPK).forEach(([zoneName, teams]) => {
      teams.forEach((t, idx) => {
        teamRankingDataSource.push({
          zoneName,
          rank: t.rank,
          name: t.name,
          score: t.score,
          trend: t.trend,
          key: `${zoneName}-${t.name}`,
          rowSpan: idx === 0 ? teams.length : 0
        })
      })
    })
  }

  const zoneColumns = [
    { 
      title: '战区名称', 
      dataIndex: 'zoneName', 
      key: 'zoneName',
      onCell: (record: any) => ({
        rowSpan: record.rowSpan
      }),
      render: (val: string) => <span style={{ fontWeight: 'bold' }}>{val}</span>
    },
    { 
      title: '区内排名', 
      dataIndex: 'rank', 
      key: 'rank', 
      width: 100, 
      render: (val: number) => <Tag color={val === 1 ? 'gold' : val === 2 ? 'blue' : 'default'}>Top {val}</Tag> 
    },
    { title: '战队名称', dataIndex: 'name', key: 'name' },
    { title: '完成百分比 (%)', dataIndex: 'score', key: 'score', render: (val: number) => <strong>{val}%</strong> },
    { title: '趋势', dataIndex: 'trend', key: 'trend', render: (val: string) => val === 'up' ? <Tag color="success">↑ 上升</Tag> : val === 'down' ? <Tag color="error">↓ 下降</Tag> : <Tag color="warning">→ 持平</Tag> }
  ]

  // 状态灯辅助方法
  const getLightStatus = (light: 'red' | 'yellow' | 'green' | undefined) => {
    if (light === 'green') return 'success'
    if (light === 'yellow') return 'warning'
    return 'error'
  }

  const getLightText = (light: 'red' | 'yellow' | 'green' | undefined) => {
    if (light === 'green') return '势头强劲'
    if (light === 'yellow') return '稍有落后'
    return '预警红灯'
  }

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>⚔️ 百日奋战经营作战大盘 (管理端)</Title>
          <Text type="secondary">
            口号：{data?.slogan || '攻坚一百天，亮剑破六千！'} | 战役倒计时还剩 <strong>{data?.countdown || 71}</strong> 天 | 
            当前登录人：<strong>{user?.name || '管理员'}</strong> ({user?.position || '系统管理员'})
          </Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<FireOutlined />} onClick={loadData} loading={loading}>刷新看板</Button>
            <Button type="primary" icon={<NotificationOutlined />} onClick={() => {
              setBroadcastModalVisible(true)
              broadcastForm.setFieldsValue({
                employeeName: user?.name || ''
              })
            }}>
              发送实时战报
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 第一级：🏆 公司战役总盘四大指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="card-kpi" bordered={false}>
            <Statistic
              title="💰 公司累计新签合同额"
              value={kpis?.newContracts.value}
              precision={2}
              valueStyle={{ color: '#1677ff', fontSize: 26, fontWeight: 700 }}
              prefix={<DollarOutlined />}
              suffix="万元"
            />
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary">目标: {kpis?.newContracts.target}万</Text>
                <Text strong color="#1677ff">{kpis?.newContracts.percentage}%</Text>
              </div>
              <Progress percent={kpis?.newContracts.percentage} size="small" strokeColor="#1677ff" />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="card-kpi" bordered={false}>
            <Statistic
              title="😊 公司客户幸福动作"
              value={kpis?.happinessActions.value}
              valueStyle={{ color: '#52c41a', fontSize: 26, fontWeight: 700 }}
              prefix={<HeartOutlined />}
              suffix="次"
            />
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary">目标: {kpis?.happinessActions.target}次</Text>
                <Text strong color="#52c41a">{kpis?.happinessActions.percentage}%</Text>
              </div>
              <Progress percent={kpis?.happinessActions.percentage} size="small" strokeColor="#52c41a" />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="card-kpi" bordered={false}>
            <Statistic
              title="🤝 售前铁三角联动次数"
              value={kpis?.ironTriangle.value}
              valueStyle={{ color: '#fa8c16', fontSize: 26, fontWeight: 700 }}
              prefix={<SmileOutlined />}
              suffix="次"
            />
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary">目标: {kpis?.ironTriangle.target}次</Text>
                <Text strong color="#fa8c16">{kpis?.ironTriangle.percentage}%</Text>
              </div>
              <Progress percent={kpis?.ironTriangle.percentage} size="small" strokeColor="#fa8c16" />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="card-kpi" bordered={false}>
            <Statistic
              title="🔍 新增有效商机线索"
              value={kpis?.validLeads.value}
              valueStyle={{ color: '#722ed1', fontSize: 26, fontWeight: 700 }}
              prefix={<RiseOutlined />}
              suffix="条"
            />
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary">目标: {kpis?.validLeads.target}条</Text>
                <Text strong color="#722ed1">{kpis?.validLeads.percentage}%</Text>
              </div>
              <Progress percent={kpis?.validLeads.percentage} size="small" strokeColor="#722ed1" />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 第二级：⚔️ 战队双轨（营销/交付）新签九宫格对战PK版 */}
      <Card 
        title={<span><FlagOutlined style={{ marginRight: 8 }} />战队双轨动力大PK (3x3九宫格看板，点击卡片可查看战队多维度指标)</span>} 
        style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
      >
        <Row gutter={[16, 16]}>
          {data?.dualTrackTeams?.map((t, idx) => (
            <Col xs={24} sm={12} md={8} key={t.teamName || idx}>
              <Card
                hoverable
                onClick={() => t.teamId && handleViewTeamMetrics(t.teamId)}
                size="small"
                title={<strong style={{ fontSize: 15, cursor: 'pointer' }}>{t.teamName}</strong>}
                extra={
                  <Space>
                    <Badge status={getLightStatus(t.statusLight)} text={getLightText(t.statusLight)} />
                  </Space>
                }
                style={{
                  background: '#fafafa',
                  border: `1px solid ${t.statusLight === 'red' ? '#ffa39e' : t.statusLight === 'yellow' ? '#ffe58f' : '#d9d9d9'}`,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  <Text type="secondary">战队巴长：</Text><strong>{t.leader}</strong>
                </div>

                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 6, border: '1px solid #f0f0f0', marginTop: 8 }}>
                  {/* 营销新签进度 */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                      <Text type="secondary">营销新签实际/目标</Text>
                      <strong>{t.marketingActual} / {t.marketingTarget} 万 ({t.marketingRate}%)</strong>
                    </div>
                    <Progress percent={t.marketingRate} size="small" strokeColor="#1677ff" showInfo={false} />
                  </div>

                  {/* 交付新签进度 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                      <Text type="secondary">交付新签实际/目标</Text>
                      <strong>{t.deliveryActual} / {t.deliveryTarget} 万 ({t.deliveryRate}%)</strong>
                    </div>
                    <Progress percent={t.deliveryRate} size="small" strokeColor="#52c41a" showInfo={false} />
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 第三级：战区赛马 & 个人英雄榜 & 个人岗位考核水位 */}
      <Row gutter={[16, 16]}>
        {/* 各战区战队冲刺排名 */}
        <Col xs={24} lg={9}>
          <Card title="🏆 各战区战队冲刺排名" bordered={false} style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <Table
              dataSource={teamRankingDataSource}
              columns={zoneColumns}
              rowKey="key"
              pagination={false}
              loading={loading}
              size="small"
              bordered
            />
          </Card>
        </Col>

        {/* 个人英雄榜 */}
        <Col xs={24} lg={8}>
          <Card title="🥇 个人签约战将榜 TOP 5" bordered={false} style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <List
              loading={loading}
              itemLayout="horizontal"
              dataSource={data?.heroBoard?.slice(0, 5)}
              renderItem={(item, index) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#f5f5f5',
                          color: index < 3 ? '#fff' : '#666',
                          textAlign: 'center',
                          lineHeight: '24px',
                          fontWeight: 'bold'
                        }}
                      >
                        {index + 1}
                      </div>
                    }
                    title={<strong>{item.name}</strong>}
                    description={`战队：${item.teamName}`}
                  />
                  <div>
                    <Text strong style={{ color: '#f5222d', fontSize: 14 }}>{item.score} 万元</Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* 个人双轨考核水位 */}
        <Col xs={24} lg={7}>
          <Card title={<span><UserOutlined style={{ marginRight: 8 }} />🎯 我的个人考核双水位</span>} bordered={false} style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            {personalStats && personalStats.length > 0 ? (
              <List
                dataSource={personalStats}
                renderItem={(item) => {
                  const maxVal = Math.max(item.challenge_target, item.actual, 1)
                  const basePct = (item.base_target / maxVal) * 100
                  const challengePct = (item.challenge_target / maxVal) * 100
                  const actualPct = (item.actual / maxVal) * 100

                  return (
                    <div style={{ marginBottom: 14, borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text strong>{item.goal_name}</Text>
                        <Text type="success" strong>实际：{item.actual} {item.unit}</Text>
                      </div>

                      {/* 自定义双轨水位进度条 */}
                      <div style={{ position: 'relative', height: 10, background: '#e8e8e8', borderRadius: 5, margin: '6px 0' }}>
                        {/* 实际值条 */}
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            height: '100%',
                            width: `${Math.min(actualPct, 100)}%`,
                            background: 'linear-gradient(90deg, #1677ff, #00d4ff)',
                            borderRadius: 5
                          }}
                        />
                        {/* 基础水位红色刻度 */}
                        <div
                          style={{
                            position: 'absolute',
                            left: `${basePct}%`,
                            top: -2,
                            bottom: -2,
                            width: 2.5,
                            backgroundColor: '#ff4d4f',
                            zIndex: 2
                          }}
                          title={`基础水位: ${item.base_target}`}
                        />
                        {/* 挑战水位金色刻度 */}
                        <div
                          style={{
                            position: 'absolute',
                            left: `${challengePct}%`,
                            top: -2,
                            bottom: -2,
                            width: 2.5,
                            backgroundColor: '#ffd700',
                            zIndex: 2
                          }}
                          title={`挑战水位: ${item.challenge_target}`}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c' }}>
                        <span>🔴 基础:{item.base_target} ({item.actual >= item.base_target ? '达成✅' : '未达'})</span>
                        <span>🟡 挑战:{item.challenge_target} ({item.actual >= item.challenge_target ? '破线🔥' : '未破'})</span>
                      </div>
                    </div>
                  )
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                系统管理员/中台无个人冲刺考核指标
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 实时动态战报 */}
      <Card title="🔔 战役实时攻坚播报" bordered={false} style={{ marginTop: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <List
          loading={loading}
          dataSource={data?.liveFeed}
          renderItem={(item) => (
            <List.Item>
              <Space>
                <Tag color={item.type === 'contract' ? 'error' : item.type === 'achievement' ? 'success' : 'processing'}>
                  {item.type === 'contract' ? '合同新签' : item.type === 'achievement' ? '幸福动作' : '工作动态'}
                </Tag>
                <Text>{item.content}</Text>
              </Space>
              <Text type="secondary">{item.time}</Text>
            </List.Item>
          )}
        />
      </Card>

      {/* 手动发送播报Modal */}
      <Modal
        title="发布实时战报（广播至4K大屏与钉钉）"
        open={broadcastModalVisible}
        onCancel={() => {
          setBroadcastModalVisible(false)
          setCurrentActionType('')
        }}
        onOk={() => broadcastForm.submit()}
        destroyOnClose
      >
        <Form 
          form={broadcastForm} 
          layout="vertical" 
          onFinish={handlePublishBroadcast}
          onValuesChange={handleValuesChange}
        >
          <Form.Item
            name="actionType"
            label="战报动作类型"
            rules={[{ required: true, message: '请选择战报动作类型' }]}
          >
            <Select placeholder="请选择要发布的战报动作">
              <Select.Option value="lead_25">有效线索确定</Select.Option>
              <Select.Option value="lead_75">中标确定</Select.Option>
              <Select.Option value="contract">已完成合同签订（双方盖章）</Select.Option>
              <Select.Option value="triangle">铁三角联动</Select.Option>
              <Select.Option value="happiness">客户幸福动作</Select.Option>
            </Select>
          </Form.Item>

          {currentActionType === 'lead_25' && (
            <>
              <Form.Item name="customerName" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
                <Input placeholder="例如：腾讯科技有限公司" />
              </Form.Item>
              <Form.Item name="amount" label="项目金额 (万元)" rules={[{ required: true, message: '请输入项目金额' }]}>
                <Input placeholder="例如：50" />
              </Form.Item>
            </>
          )}

          {currentActionType === 'lead_75' && (
            <>
              <Form.Item name="projectName" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
                <Input placeholder="例如：数字底座建设项目" />
              </Form.Item>
              <Form.Item name="customerName" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
                <Input placeholder="例如：阿里巴巴集团" />
              </Form.Item>
              <Form.Item name="amount" label="项目金额 (万元)" rules={[{ required: true, message: '请输入项目金额' }]}>
                <Input placeholder="例如：100" />
              </Form.Item>
            </>
          )}

          {currentActionType === 'contract' && (
            <>
              <Form.Item name="contractName" label="合同/项目名称" rules={[{ required: true, message: '请输入合同名称' }]}>
                <Input placeholder="例如：华为云服务采购合同" />
              </Form.Item>
              <Form.Item name="customerName" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
                <Input placeholder="例如：华为终端有限公司" />
              </Form.Item>
              <Form.Item name="amount" label="合同金额 (万元)" rules={[{ required: true, message: '请输入合同金额' }]}>
                <Input placeholder="例如：120" />
              </Form.Item>
            </>
          )}

          {currentActionType === 'triangle' && (
            <Form.Item name="customerName" label="客户名称" rules={[{ required: true, message: '请输入拜访联动客户' }]}>
              <Input placeholder="例如：广州市规划局" />
            </Form.Item>
          )}

          {currentActionType === 'happiness' && (
            <>
              <Form.Item name="employeeName" label="员工姓名" rules={[{ required: true, message: '请选择做到幸福动作的员工姓名' }]}>
                <Select
                  showSearch
                  placeholder="搜索选择员工姓名，默认为当前登录人"
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    ((option as any)?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={usersList.map(u => ({ value: u.name, label: u.name }))}
                />
              </Form.Item>
              <Form.Item name="happinessScore" label="客户幸福标准分值" rules={[{ required: true, message: '请选择幸福分值' }]}>
                <Select placeholder="选择客户幸福标准分值">
                  <Select.Option value={0}>0分</Select.Option>
                  <Select.Option value={20}>20分</Select.Option>
                  <Select.Option value={50}>50分</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="actionDescription" label="动作描述" rules={[{ required: true, message: '请输入具体关怀与拜访动作' }]}>
                <Input placeholder="例如：关怀与拜访 / 递交了第三期方案成效汇报" />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="content"
            label="最终生成战报文本"
            rules={[{ required: true, message: '战报内容不能为空' }, { max: 150, message: '战报文本不能多于150字' }]}
          >
            <Input.TextArea rows={4} placeholder="选择动作填入要素后自动生成，也可在此手动微调" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 战队多维度精细指标Modal */}
      <Modal
        title={selectedTeamMetrics ? `⚔️ 【${selectedTeamMetrics.team_name}】多维度精细化指标明细` : "加载中..."}
        open={teamMetricsModalVisible}
        onCancel={() => {
          setTeamMetricsModalVisible(false)
          setSelectedTeamMetrics(null)
        }}
        footer={null}
        width={960}
        destroyOnClose
      >
        {metricsLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Progress type="circle" percent={60} status="active" strokeColor="#1677ff" />
            <div style={{ marginTop: 16 }}>正在从 CRM 客户管理系统及本地同步加载最新数据...</div>
          </div>
        ) : selectedTeamMetrics ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, background: '#f5f5f5', padding: '10px 16px', borderRadius: 6 }}>
              <div>
                CRM系统对接状态：
                {selectedTeamMetrics.crm_connected ? (
                  <Tag color="success">🟢 已直连CRM（实时提取有效与潜力线索）</Tag>
                ) : (
                  <Tag color="error">❌ 连接离线（CRM系统暂不可用，无法显示线索指标）</Tag>
                )}
              </div>
              <div>
                数据统计口径：<strong style={{ color: '#1677ff' }}>按本战队全员累加</strong>
              </div>
            </div>
            
            <Table
              dataSource={[
                {
                  key: 'm_contract',
                  name: '💰 营销新签合同额',
                  definition: '合同已加盖双方公章，营销人员所属战队新签总额',
                  target: `${selectedTeamMetrics.marketing_target} 万元`,
                  actual: `${selectedTeamMetrics.marketing_actual} 万元`,
                  rate: selectedTeamMetrics.marketing_target > 0 ? roundPct(selectedTeamMetrics.marketing_actual / selectedTeamMetrics.marketing_target * 100) : 0.0
                },
                {
                  key: 'd_contract',
                  name: '🛠️ 交付新签合同额',
                  definition: '合同已加盖双方公章，技术/交付人员所属战队新签总额',
                  target: `${selectedTeamMetrics.delivery_target} 万元`,
                  actual: `${selectedTeamMetrics.delivery_actual} 万元`,
                  rate: selectedTeamMetrics.delivery_target > 0 ? roundPct(selectedTeamMetrics.delivery_actual / selectedTeamMetrics.delivery_target * 100) : 0.0
                },
                {
                  key: 'valid_leads',
                  name: '🔍 有效需求线索量',
                  definition: 'CRM线索库中进度在 25%~75% 的线索总数量',
                  target: `${selectedTeamMetrics.valid_leads_target} 条`,
                  actual: selectedTeamMetrics.valid_leads_actual !== null ? `${selectedTeamMetrics.valid_leads_actual} 条` : '—',
                  rate: (selectedTeamMetrics.valid_leads_actual !== null && selectedTeamMetrics.valid_leads_target > 0) ? roundPct(selectedTeamMetrics.valid_leads_actual / selectedTeamMetrics.valid_leads_target * 100) : '—'
                },
                {
                  key: 'potential_leads',
                  name: '📈 潜力需求线索量',
                  definition: 'CRM线索库中进度在 5%~10% 的线索数（CRM专属指标）',
                  target: '—',
                  actual: selectedTeamMetrics.potential_leads_actual !== null ? `${selectedTeamMetrics.potential_leads_actual} 条` : '—',
                  rate: '—'
                },
                {
                  key: 'conversion',
                  name: '📊 线索转化率',
                  definition: '新签线索个数 / 上月有效线索池总个数 * 100%（CRM线索转化指标）',
                  target: '—',
                  actual: selectedTeamMetrics.leads_conversion_rate !== null ? `${selectedTeamMetrics.leads_conversion_rate} %` : '—',
                  rate: '—'
                },
                {
                  key: 'new_customer',
                  name: '🆕 战役新客户数',
                  definition: '本战队已审核日报中，新签合同明细里去重客户总数',
                  target: '—',
                  actual: `${selectedTeamMetrics.new_customers_actual} 个`,
                  rate: '—'
                },
                {
                  key: 'renew',
                  name: '🔄 续签合同额',
                  definition: '同一科室两年内再次签订的合同额总数（基于合同描述智能检索）',
                  target: '—',
                  actual: `${selectedTeamMetrics.renew_amount_actual} 万元`,
                  rate: '—'
                },
                {
                  key: 'triangle',
                  name: '🤝 售前铁三角联动',
                  definition: '本战队全体员工共同客户接触、联动拜访累计次数',
                  target: '—',
                  actual: `${selectedTeamMetrics.triangle_actual} 次`,
                  rate: '—'
                },
                {
                  key: 'happiness',
                  name: '😊 客户幸福标准动作',
                  definition: '本战队全员做到幸福关怀动作并收到客户正反馈的次数',
                  target: '—',
                  actual: `${selectedTeamMetrics.happiness_actual} 次`,
                  rate: '—'
                }
              ]}
              columns={[
                { title: '作战多维指标', dataIndex: 'name', key: 'name', width: 200, render: (val: string) => <strong>{val}</strong> },
                { title: '口径/定义解析', dataIndex: 'definition', key: 'definition', width: 320 },
                { title: '保底奋斗目标', dataIndex: 'target', key: 'target', width: 130 },
                { title: '真实实际完成', dataIndex: 'actual', key: 'actual', width: 130, render: (val: string) => <span style={{ color: '#1677ff', fontWeight: 'bold' }}>{val}</span> },
                { 
                  title: '达成进度', 
                  dataIndex: 'rate', 
                  key: 'rate', 
                  render: (val: any) => typeof val === 'number' ? (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Progress percent={val} size="small" style={{ width: 110, marginRight: 8 }} />
                      <span>{val}%</span>
                    </div>
                  ) : val 
                }
              ]}
              pagination={false}
              size="small"
              bordered
            />
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>暂无数据</div>
        )}
      </Modal>
    </div>
  )
}

export default Dashboard
