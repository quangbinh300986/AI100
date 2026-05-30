/**
 * 每日填报页面 - 分步表单与照片上传联调
 * 新签合同 → 幸福动作 → 铁三角 → 有效线索 → 工作总结
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Button, Toast, Steps, TextArea, Stepper, ImageUploader } from 'antd-mobile'
import type { ImageUploadItem } from 'antd-mobile'
import { CheckCircleFill } from 'antd-mobile-icons'
import { post } from '@shared/api/client'

/** 填报步骤 */
const stepItems = [
  { title: '新签合同', description: '合同金额(万元)' },
  { title: '幸福动作', description: '动作次数' },
  { title: '铁三角', description: '协作次数' },
  { title: '有效线索', description: '线索数量' },
  { title: '总结及照片', description: '总结与证明' },
]

export default function DailyReport() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    newContracts: 0.0,
    happinessActions: 0,
    ironTriangle: 0,
    validLeads: 0,
    summary: '',
    reflection: '完成今日既定任务，进度符合预期。',
    nextPlan: '继续跟进重点商机，拜访关键决策客户。',
    standup: '早晨三级巴站会已开，对齐今日攻坚策略。'
  })

  // 合同照片附件
  const [contractPhotos, setContractPhotos] = useState<ImageUploadItem[]>([])
  // 幸福动作照片附件
  const [happinessPhotos, setHappinessPhotos] = useState<ImageUploadItem[]>([])

  /** 统一的图片上传中转逻辑，通过后端上传到 Supabase photos 桶 */
  const handleImageUpload = async (file: File): Promise<ImageUploadItem> => {
    const data = new FormData()
    data.append('file', file)
    try {
      const res = (await post<any>('/reports/upload', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })) as any
      if (res && res.url) {
        Toast.show({ icon: 'success', content: '照片上传成功' })
        return {
          url: res.url,
        }
      }
      throw new Error('未获取到照片 URL')
    } catch (e) {
      Toast.show({ icon: 'fail', content: '照片上传失败，请重试' })
      throw e
    }
  }

  /** 下一步 */
  const handleNext = () => {
    if (currentStep < stepItems.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  /** 上一步 */
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  /** 提交填报数据到后端 */
  const handleSubmit = async () => {
    setSubmitting(true)
    const todayStr = new Date().toISOString().split('T')[0]
    
    // 组装符合后端 DailyReportCreate 的 Schema
    const payload = {
      report_date: todayStr,
      contract_amount: formData.newContracts,
      contract_count: formData.newContracts > 0 ? 1 : 0,
      happiness_actions: formData.happinessActions,
      triangle_count: formData.ironTriangle,
      leads_count: formData.validLeads,
      work_summary: formData.summary || '今日工作顺利推进完成。',
      work_reflection: formData.reflection,
      next_day_plan: formData.nextPlan,
      standup_notes: formData.standup,
      details: [
        ...(contractPhotos.length > 0 ? [{
          detail_type: 'contract',
          amount: formData.newContracts,
          description: '今日盖章签约新签合同附件照片证明',
          attachment_urls: contractPhotos.map(p => p.url)
        }] : []),
        ...(happinessPhotos.length > 0 ? [{
          detail_type: 'happiness',
          happiness_level: 20,
          description: '今日落实客户幸福标准动作证明',
          attachment_urls: happinessPhotos.map(p => p.url)
        }] : [])
      ]
    }

    try {
      const res = await post<any>('/reports', payload)
      if (res) {
        setSubmitted(true)
        Toast.show({ icon: 'success', content: '填报提交成功！' })
      }
    } catch (err: any) {
      console.error(err)
      const detail = err?.response?.data?.detail
      Toast.show({ 
        icon: 'fail', 
        content: typeof detail === 'string' ? detail : '提报失败，今天可能已填报过', 
        duration: 3000 
      })
    } finally {
      setSubmitting(false)
    }
  }

  /** 提交成功页面 */
  if (submitted) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          padding: '0 32px',
        }}
      >
        <CheckCircleFill style={{ fontSize: 64, color: '#52c41a' }} />
        <h2 style={{ marginTop: 16, fontSize: 20, fontWeight: 600 }}>填报提交成功</h2>
        <p style={{ color: '#999', marginTop: 8, textAlign: 'center' }}>
          今日数据已成功提报，请等待目标官/战队长审核通过。
        </p>
        <div
          className="card"
          style={{ width: '100%', marginTop: 24, padding: 20, background: '#f5f5f5', borderRadius: 12 }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>今日填报汇总</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <span style={{ color: '#999', fontSize: 12 }}>新签合同</span>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#1677ff' }}>
                {formData.newContracts} <span style={{ fontSize: 12 }}>万</span>
              </div>
            </div>
            <div>
              <span style={{ color: '#999', fontSize: 12 }}>幸福动作</span>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#52c41a' }}>
                {formData.happinessActions} <span style={{ fontSize: 12 }}>次</span>
              </div>
            </div>
            <div>
              <span style={{ color: '#999', fontSize: 12 }}>铁三角协作</span>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#faad14' }}>
                {formData.ironTriangle} <span style={{ fontSize: 12 }}>次</span>
              </div>
            </div>
            <div>
              <span style={{ color: '#999', fontSize: 12 }}>新增有效线索</span>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#ff4d4f' }}>
                {formData.validLeads} <span style={{ fontSize: 12 }}>条</span>
              </div>
            </div>
          </div>
        </div>
        <Button
          color="primary"
          block
          style={{ marginTop: 24, borderRadius: 8, height: 44 }}
          onClick={() => navigate('/m/home')}
        >
          返回首页
        </Button>
      </div>
    )
  }

  return (
    <div className="page-content" style={{ padding: '16px' }}>
      {/* 页面标题 */}
      <div style={{ padding: '16px 0 8px' }}>
        <h2 className="page-title" style={{ fontSize: 22, fontWeight: 'bold' }}>📝 每日冲刺数据填报</h2>
        <p style={{ color: '#999', fontSize: 13, marginTop: 4 }}>
          {new Date().toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </p>
      </div>

      {/* 步骤指示器 */}
      <div className="card" style={{ padding: '16px 12px', marginBottom: 16, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Steps current={currentStep} style={{ '--icon-size': '20px', '--title-font-size': '12px' } as React.CSSProperties}>
          {stepItems.map((item) => (
            <Steps.Step key={item.title} title={item.title} />
          ))}
        </Steps>
      </div>

      {/* 表单内容 */}
      <div className="card" style={{ padding: 24, minHeight: 280, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Form layout="vertical">
          {/* 步骤1：新签合同 */}
          {currentStep === 0 && (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#1677ff' }}>💰 新签合同额</h3>
              <p style={{ color: '#999', fontSize: 13, marginBottom: 20 }}>
                请填写今日新签的合同金额（单位：万元）
              </p>
              <Form.Item label="合同新签额（万元）">
                <Stepper
                  min={0}
                  max={9999}
                  step={0.1}
                  value={formData.newContracts}
                  onChange={(val) => setFormData({ ...formData, newContracts: val ?? 0 })}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              
              {formData.newContracts > 0 && (
                <div style={{ marginTop: 20 }}>
                  <Form.Item label="📎 上传盖章合同照片附件（证明材料）">
                    <ImageUploader
                      value={contractPhotos}
                      onChange={setContractPhotos}
                      upload={handleImageUpload}
                      maxCount={3}
                    />
                  </Form.Item>
                </div>
              )}
            </div>
          )}

          {/* 步骤2：幸福动作 */}
          {currentStep === 1 && (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#52c41a' }}>😊 客户幸福动作</h3>
              <p style={{ color: '#999', fontSize: 13, marginBottom: 20 }}>
                请填写今日针对客户幸福动作的次数（参考幸福度评级）
              </p>
              <Form.Item label="幸福动作次数">
                <Stepper
                  min={0}
                  max={99}
                  value={formData.happinessActions}
                  onChange={(val) => setFormData({ ...formData, happinessActions: val ?? 0 })}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              
              {formData.happinessActions > 0 && (
                <div style={{ marginTop: 20 }}>
                  <Form.Item label="📎 上传客户正反馈截图或现场合影">
                    <ImageUploader
                      value={happinessPhotos}
                      onChange={setHappinessPhotos}
                      upload={handleImageUpload}
                      maxCount={3}
                    />
                  </Form.Item>
                </div>
              )}
            </div>
          )}

          {/* 步骤3：铁三角 */}
          {currentStep === 2 && (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#faad14' }}>🔺 售前铁三角现场联动</h3>
              <p style={{ color: '#999', fontSize: 13, marginBottom: 20 }}>
                请填写今日营销、方案、交付三方现场共同拜访/探讨的次数
              </p>
              <Form.Item label="协作次数">
                <Stepper
                  min={0}
                  max={99}
                  value={formData.ironTriangle}
                  onChange={(val) => setFormData({ ...formData, ironTriangle: val ?? 0 })}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </div>
          )}

          {/* 步骤4：有效线索 */}
          {currentStep === 3 && (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#ff4d4f' }}>🔍 确定有效推进商机线索</h3>
              <p style={{ color: '#999', fontSize: 13, marginBottom: 20 }}>
                请填写今日新确立的系统拓展进度处于 25%-75% 阶段的有效线索数
              </p>
              <Form.Item label="新增有效线索数量">
                <Stepper
                  min={0}
                  max={99}
                  value={formData.validLeads}
                  onChange={(val) => setFormData({ ...formData, validLeads: val ?? 0 })}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </div>
          )}

          {/* 步骤5：工作总结与提交 */}
          {currentStep === 4 && (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>📋 总结与反思</h3>
              <p style={{ color: '#999', fontSize: 13, marginBottom: 20 }}>
                请简要汇报今日的工作纪实与心得
              </p>
              <Form.Item label="今日工作纪实（必填）">
                <TextArea
                  placeholder="请输入今日工作主要内容及攻坚实绩..."
                  maxLength={500}
                  showCount
                  rows={4}
                  value={formData.summary}
                  onChange={(val) => setFormData({ ...formData, summary: val })}
                />
              </Form.Item>
            </div>
          )}
        </Form>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        {currentStep > 0 && (
          <Button
            block
            onClick={handlePrev}
            style={{ borderRadius: 8, height: 44, flex: 1 }}
          >
            上一步
          </Button>
        )}
        {currentStep < stepItems.length - 1 ? (
          <Button
            block
            color="primary"
            onClick={handleNext}
            style={{ borderRadius: 8, height: 44, flex: 1 }}
          >
            下一步
          </Button>
        ) : (
          <Button
            block
            color="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!formData.summary.trim()}
            style={{ borderRadius: 8, height: 44, flex: 1 }}
          >
            提交填报
          </Button>
        )}
      </div>
    </div>
  )
}
