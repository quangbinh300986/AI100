import React, { useEffect, useState } from 'react'
import { Table, Tag, Space, Button, Modal, Input, Form, Badge, Card, Typography, message } from 'antd'
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons'
import { get, post } from '@shared/api/client'

const { Text } = Typography

interface ReportItem {
  id: number
  user_id: number
  user_name?: string
  report_date: string
  contract_amount: number
  contract_count: number
  happiness_actions: number
  triangle_count: number
  leads_count: number
  work_summary?: string
  work_reflection?: string
  next_day_plan?: string
  standup_notes?: string
  status: string
  submitted_at?: string
  details?: any[]
}

const Reports: React.FC = () => {
  const [reports, setReports] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  
  // 审核相关的模态框状态
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null)
  const [rejectVisible, setRejectVisible] = useState(false)
  const [rejectForm] = Form.useForm()

  // 加载数据
  const loadReports = async () => {
    setLoading(true)
    try {
      const res = await get<any>(`/reports?page=${page}&page_size=${pageSize}`)
      if (res && res.data) {
        const items = res.data.items || []
        const formatted = items.map((x: any) => ({
          ...x,
          user_name: x.user_name || `员工ID:${x.user_id}`
        }))
        setReports(formatted)
        setTotal(res.data.total || 0)
      } else {
        // Fallback Mock 数据
        const mockReports: ReportItem[] = [
          {
            id: 1,
            user_id: 101,
            user_name: '苏志辉',
            report_date: '2026-05-30',
            contract_amount: 85.0,
            contract_count: 1,
            happiness_actions: 1,
            triangle_count: 2,
            leads_count: 1,
            work_summary: '今日完成广州分部项目洽谈，签订合同。拜访重点大客户进行铁三角协同工作。',
            work_reflection: '线索跟进时效性还可以再提高。',
            next_day_plan: '明日开展回款对接。',
            status: 'submitted',
            submitted_at: '2026-05-30 18:30:00',
            details: [
              {
                id: 10,
                detail_type: 'contract',
                customer_name: '广州市自然资源局',
                amount: 85.0,
                description: '完成了年度规划设计合同签约。'
              },
              {
                id: 11,
                detail_type: 'happiness',
                customer_name: '清远规划局',
                happiness_level: 50,
                description: '提供政策解读中地课堂讲座，客户对此极为满意并公开表示感谢。'
              }
            ]
          },
          {
            id: 2,
            user_id: 102,
            user_name: '陈露',
            report_date: '2026-05-30',
            contract_amount: 0,
            contract_count: 0,
            happiness_actions: 2,
            triangle_count: 0,
            leads_count: 0,
            work_summary: '进行日常客户拜访和维护。解决客户在使用系统中的部分咨询。',
            status: 'submitted',
            submitted_at: '2026-05-30 17:45:00',
            details: [
              {
                id: 12,
                detail_type: 'happiness',
                customer_name: '中山国土局',
                happiness_level: 20,
                description: '提前两天交付了分析成果，并提出了对应的风险预防方案。'
              }
            ]
          }
        ]
        setReports(mockReports)
        setTotal(2)
      }
    } catch (err) {
      console.error(err)
      message.error('加载填报列表失败，显示演示数据')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [page, pageSize])

  // 执行审核
  const handleReview = async (reportId: number, action: 'approved' | 'rejected', reason?: string) => {
    try {
      const res = await post(`/reports/${reportId}/review`, {
        action: action,
        reason: reason || ''
      })
      if (res) {
        message.success(action === 'approved' ? '审核已通过' : '已成功驳回')
        setDetailVisible(false)
        setRejectVisible(false)
        loadReports()
      }
    } catch (err) {
      message.error('审核提交失败')
    }
  }

  const columns = [
    { title: '日期', dataIndex: 'report_date', key: 'report_date' },
    { title: '填报人', dataIndex: 'user_name', key: 'user_name' },
    { title: '新签金额(万)', dataIndex: 'contract_amount', key: 'contract_amount', render: (val: number) => <span style={{ color: '#f5222d', fontWeight: 'bold' }}>{val}</span> },
    { title: '幸福动作(次)', dataIndex: 'happiness_actions', key: 'happiness_actions' },
    { title: '铁三角联动(次)', dataIndex: 'triangle_count', key: 'triangle_count' },
    { title: '有效线索(条)', dataIndex: 'leads_count', key: 'leads_count' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => {
        if (val === 'submitted') return <Tag color="warning">待审核</Tag>
        if (val === 'approved') return <Tag color="success">已通过</Tag>
        return <Tag color="default">已驳回</Tag>
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ReportItem) => (
        <Space>
          <Button
            type="primary"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedReport(record)
              setDetailVisible(true)
            }}
          >
            详情与审核
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div>
      <h3 style={{ fontSize: 20, marginBottom: 24, fontWeight: 'bold' }}>📋 员工每日填报审核面板</h3>
      <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Table
          dataSource={reports}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            }
          }}
        />
      </Card>

      {/* 详情与审核Modal */}
      <Modal
        title={selectedReport ? `${selectedReport.user_name} 的每日填报详情` : '填报详情'}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={700}
        footer={
          selectedReport && selectedReport.status === 'submitted' ? (
            <Space>
              <Button
                type="dashed"
                danger
                icon={<CloseOutlined />}
                onClick={() => setRejectVisible(true)}
              >
                驳回
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => handleReview(selectedReport.id, 'approved')}
              >
                审核通过
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedReport && (
          <div style={{ padding: '12px 0' }}>
            <p><strong>填报日期：</strong>{selectedReport.report_date}</p>
            <p><strong>提交时间：</strong>{selectedReport.submitted_at || '无'}</p>
            
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px 0' }}><strong>今日工作小结：</strong></p>
              <p style={{ margin: 0, color: '#555' }}>{selectedReport.work_summary || '无'}</p>
            </div>

            {selectedReport.work_reflection && (
              <div style={{ background: '#fff2e8', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px 0', color: '#d4380d' }}><strong>今日工作反思：</strong></p>
                <p style={{ margin: 0, color: '#a6331b' }}>{selectedReport.work_reflection}</p>
              </div>
            )}

            {/* 明细动作 */}
            <h4 style={{ margin: '16px 0 8px 0' }}>💡 指标填报动作明细：</h4>
            {selectedReport.details && selectedReport.details.length > 0 ? (
              selectedReport.details.map((detail: any, idx: number) => (
                <Card size="small" key={detail.id || idx} style={{ marginBottom: 12, borderLeft: '4px solid #1890ff' }}>
                  <p style={{ margin: 0 }}>
                    <strong>类型：</strong>
                    <Tag color={detail.detail_type === 'contract' ? 'error' : detail.detail_type === 'happiness' ? 'success' : 'processing'}>
                      {detail.detail_type === 'contract' ? '合同新签' : detail.detail_type === 'happiness' ? '幸福动作' : '有效线索'}
                    </Tag>
                  </p>
                  <p style={{ margin: '4px 0 0 0' }}><strong>业主单位：</strong>{detail.customer_name}</p>
                  {detail.amount && <p style={{ margin: '4px 0 0 0' }}><strong>金额：</strong>{detail.amount} 万元</p>}
                  {detail.happiness_level !== undefined && (
                    <p style={{ margin: '4px 0 0 0' }}><strong>客户幸福等级分值：</strong><span style={{ color: '#389e0d', fontWeight: 'bold' }}>{detail.happiness_level} 分</span></p>
                  )}
                  <p style={{ margin: '4px 0 0 0' }}><strong>具体说明：</strong>{detail.description}</p>
                </Card>
              ))
            ) : (
              <p style={{ color: '#999' }}>无明细数据</p>
            )}
          </div>
        )}
      </Modal>

      {/* 驳回意见Modal */}
      <Modal
        title="填写驳回原因"
        open={rejectVisible}
        onCancel={() => setRejectVisible(false)}
        onOk={() => rejectForm.submit()}
      >
        <Form
          form={rejectForm}
          onFinish={(values) => {
            if (selectedReport) {
              handleReview(selectedReport.id, 'rejected', values.reason)
            }
          }}
        >
          <Form.Item
            name="reason"
            label="驳回原因说明"
            rules={[{ required: true, message: '请填写驳回原因' }]}
          >
            <Input.TextArea placeholder="请输入驳回具体原因，方便员工修改后重新提交..." rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Reports
