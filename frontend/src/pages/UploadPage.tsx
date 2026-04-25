import { useState, useEffect } from 'react'
import {
  Card,
  Upload,
  Button,
  Select,
  Input,
  Space,
  message,
  Progress,
  Alert,
  Typography,
  Tag,
  List,
  Tooltip,
  Collapse,
  Divider,
  Badge,
} from 'antd'
import {
  UploadOutlined,
  PlusOutlined,
  VideoCameraOutlined,
  FileOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { UploadProps, RcFile } from 'antd/es/upload'
import { uploadApi, templateApi } from '@/services/api'
import type { 
  TranscodeTemplate, 
  Task, 
  Resource, 
  FileUploadResult,
  UploadResultData
} from '@/types'
import { useNavigate } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Panel } = Collapse

const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/avi',
  'video/x-matroska',
  'video/quicktime',
  'video/x-ms-wmv',
  'video/x-flv',
  'video/webm',
  'video/x-m4v',
]

const ACCEPTED_EXTENSIONS = [
  '.mp4',
  '.avi',
  '.mkv',
  '.mov',
  '.wmv',
  '.flv',
  '.webm',
  '.m4v',
]

type FileItemStatus = 'pending' | 'uploading' | 'success' | 'failed'

interface FileItem {
  uid: string
  file: File
  status: FileItemStatus
  progress: number
  errorCode?: string
  errorMessage?: string
  taskId?: string
  resourceId?: string
}

const errorCodeMessages: Record<string, { label: string; color: string }> = {
  invalid_type: { label: '格式错误', color: 'red' },
  file_too_large: { label: '文件过大', color: 'orange' },
  file_too_small: { label: '文件为空', color: 'orange' },
  read_error: { label: '读取错误', color: 'red' },
  save_error: { label: '保存错误', color: 'red' },
  internal_error: { label: '内部错误', color: 'red' },
}

function UploadPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<TranscodeTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [tags, setTags] = useState<string>('')
  const [fileItems, setFileItems] = useState<FileItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [uploadResult, setUploadResult] = useState<UploadResultData | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const response = await templateApi.list()
      if (response.data.success) {
        const templateList = response.data.data || []
        setTemplates(templateList)
        const defaultTemplate = templateList.find((t) => t.is_default)
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate.id)
        }
      }
    } catch (error) {
      message.error('加载转码模板失败')
    }
  }

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    const newFileItem: FileItem = {
      uid: file.uid,
      file: file as File,
      status: 'pending',
      progress: 0,
    }
    setFileItems((prev) => [...prev, newFileItem])
    return false
  }

  const handleRemove = (file: any) => {
    setFileItems((prev) => prev.filter((f) => f.uid !== file.uid))
  }

  const clearAllFiles = () => {
    setFileItems([])
    setUploadResult(null)
  }

  const handleUpload = async () => {
    if (fileItems.length === 0) {
      message.warning('请先选择要上传的视频文件')
      return
    }

    setUploading(true)
    setOverallProgress(0)
    setUploadResult(null)

    setFileItems((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'uploading' as FileItemStatus,
        progress: 0,
      }))
    )

    try {
      const tagArray = tags
        ? tags.split(',').map((t) => t.trim()).filter((t) => t)
        : []

      const files = fileItems.map((item) => item.file)

      const response = await uploadApi.uploadFiles(
        files,
        selectedTemplate || undefined,
        tagArray.length > 0 ? tagArray : undefined,
        (progress) => setOverallProgress(progress)
      )

      if (response.data.success !== undefined && response.data.data) {
        const result = response.data.data
        setUploadResult(result)

        setFileItems((prev) => {
          return prev.map((item, index) => {
            const uploadResultItem = result.results[index]
            if (uploadResultItem) {
              if (uploadResultItem.success) {
                return {
                  ...item,
                  status: 'success' as FileItemStatus,
                  progress: 100,
                  taskId: uploadResultItem.task_id,
                  resourceId: uploadResultItem.resource_id,
                }
              } else {
                return {
                  ...item,
                  status: 'failed' as FileItemStatus,
                  progress: 0,
                  errorCode: uploadResultItem.error_code,
                  errorMessage: uploadResultItem.error_message,
                  taskId: uploadResultItem.task_id,
                }
              }
            }
            return item
          })
        })

        if (result.failed_count === 0) {
          message.success(`成功上传 ${result.success_count} 个文件，任务已创建`)
        } else if (result.success_count === 0) {
          message.error(`全部 ${result.failed_count} 个文件上传失败`)
        } else {
          message.warning(
            `部分上传成功：成功 ${result.success_count} 个，失败 ${result.failed_count} 个`
          )
        }
      }
    } catch (error: any) {
      message.error(error.message || '上传失败，请重试')
      setFileItems((prev) =>
        prev.map((item) => ({
          ...item,
          status: 'failed' as FileItemStatus,
          errorMessage: '上传请求失败',
        }))
      )
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  const getStatusIcon = (status: FileItemStatus) => {
    switch (status) {
      case 'pending':
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />
      case 'uploading':
        return <UploadOutlined style={{ color: '#1890ff' }} spin />
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return null
    }
  }

  const getStatusTag = (status: FileItemStatus, errorCode?: string) => {
    switch (status) {
      case 'pending':
        return <Tag color="blue">等待上传</Tag>
      case 'uploading':
        return <Tag color="processing">上传中</Tag>
      case 'success':
        return <Tag color="success">上传成功</Tag>
      case 'failed':
        if (errorCode && errorCodeMessages[errorCode]) {
          return (
            <Tag color={errorCodeMessages[errorCode].color}>
              {errorCodeMessages[errorCode].label}
            </Tag>
          )
        }
        return <Tag color="error">上传失败</Tag>
      default:
        return null
    }
  }

  const pendingCount = fileItems.filter((f) => f.status === 'pending').length
  const uploadingCount = fileItems.filter((f) => f.status === 'uploading').length
  const successCount = fileItems.filter((f) => f.status === 'success').length
  const failedCount = fileItems.filter((f) => f.status === 'failed').length

  const uploadProps: UploadProps = {
    beforeUpload,
    fileList: fileItems.map((item) => ({
      uid: item.uid,
      name: item.file.name,
      size: item.file.size,
      status: item.status === 'failed' ? 'error' : item.status === 'success' ? 'done' : 'uploading' as any,
    })),
    onRemove: handleRemove,
    multiple: true,
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <UploadOutlined style={{ marginRight: 8 }} />
        上传视频
      </Title>

      {uploadResult && uploadResult.failed_count > 0 && (
        <Alert
          type="warning"
          message="部分文件上传失败"
          description={
            <div>
              <p>成功: {uploadResult.success_count} 个，失败: {uploadResult.failed_count} 个</p>
              <p style={{ marginBottom: 0 }}>
                失败的文件已在任务列表中标记，可以查看失败原因。请检查文件格式和大小后重试。
              </p>
            </div>
          }
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {uploadResult && uploadResult.failed_count === 0 && uploadResult.total > 0 && (
        <Alert
          type="success"
          message="全部上传成功"
          description={
            <div>
              <p>已创建 {uploadResult.tasks.length} 个转码任务</p>
              <Button
                type="link"
                onClick={() => navigate('/tasks')}
                style={{ padding: 0 }}
              >
                查看任务队列
              </Button>
            </div>
          }
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong style={{ marginBottom: 8, display: 'block' }}>
              选择转码模板
            </Text>
            <Select
              style={{ width: 400 }}
              placeholder="请选择转码模板"
              value={selectedTemplate}
              onChange={setSelectedTemplate}
              options={templates.map((t) => ({
                label: (
                  <span>
                    {t.name}
                    {t.is_default && (
                      <Tag color="blue" style={{ marginLeft: 8 }}>
                        默认
                      </Tag>
                    )}
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t.video.width}x{t.video.height} @ {t.video.bitrate}kbps
                    </Text>
                  </span>
                ),
                value: t.id,
              }))}
            />
          </div>

          <div>
            <Text strong style={{ marginBottom: 8, display: 'block' }}>
              添加标签（可选，多个标签用逗号分隔）
            </Text>
            <TextArea
              placeholder="例如：教学视频, 课程, 2024年"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              rows={2}
              style={{ width: 400 }}
            />
          </div>

          <div>
            <Text strong style={{ marginBottom: 8, display: 'block' }}>
              选择视频文件
            </Text>
            <Upload.Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <PlusOutlined style={{ color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">点击或拖拽视频文件到此处上传</p>
              <p className="ant-upload-hint">
                支持 MP4, AVI, MKV, MOV, WMV, FLV, WebM 格式，单文件最大 2GB。
                <br />
                不支持的文件会自动标记失败，不影响其他文件上传。
              </p>
            </Upload.Dragger>
          </div>

          {fileItems.length > 0 && (
            <Card
              size="small"
              title={
                <Space>
                  <FileOutlined />
                  <span>文件列表</span>
                  <Badge count={fileItems.length} style={{ backgroundColor: '#1890ff' }} />
                  {successCount > 0 && (
                    <Badge count={successCount} style={{ backgroundColor: '#52c41a' }} />
                  )}
                  {failedCount > 0 && (
                    <Badge count={failedCount} style={{ backgroundColor: '#ff4d4f' }} />
                  )}
                </Space>
              }
              extra={
                !uploading && (
                  <Button size="small" danger onClick={clearAllFiles}>
                    清空列表
                  </Button>
                )
              }
            >
              <List
                dataSource={fileItems}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      !uploading && (
                        <Button
                          type="text"
                          danger
                          size="small"
                          onClick={() => handleRemove({ uid: item.uid } as any)}
                        >
                          移除
                        </Button>
                      ),
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<div style={{ fontSize: 20 }}>{getStatusIcon(item.status)}</div>}
                      title={
                        <Space>
                          <VideoCameraOutlined />
                          <Text strong>{item.file.name}</Text>
                          {getStatusTag(item.status, item.errorCode)}
                        </Space>
                      }
                      description={
                        <div>
                          <Space>
                            <Text type="secondary">{formatFileSize(item.file.size)}</Text>
                            {item.status === 'uploading' && (
                              <Progress
                                percent={item.progress}
                                size="small"
                                style={{ width: 100 }}
                              />
                            )}
                          </Space>
                          {item.status === 'failed' && item.errorMessage && (
                            <div style={{ marginTop: 8 }}>
                              <Collapse ghost size="small">
                                <Panel
                                  header={
                                    <Space>
                                      <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                                      <Text type="danger">查看失败原因</Text>
                                    </Space>
                                  }
                                  key="error"
                                >
                                  <Alert
                                    message="错误详情"
                                    description={item.errorMessage}
                                    type="error"
                                    showIcon
                                    size="small"
                                  />
                                  {item.taskId && (
                                    <div style={{ marginTop: 8 }}>
                                      <Text type="secondary">
                                        任务ID: {item.taskId}
                                        <br />
                                        可在任务列表中查看详情
                                      </Text>
                                    </div>
                                  )}
                                </Panel>
                              </Collapse>
                            </div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}

          {uploading && (
            <div>
              <Progress
                percent={overallProgress}
                status="active"
                format={(percent) => `上传中... ${percent}%`}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                请不要关闭页面，正在处理文件...
              </Text>
            </div>
          )}

          <div style={{ textAlign: 'center', paddingTop: 16 }}>
            <Space>
              <Button
                type="primary"
                size="large"
                icon={<UploadOutlined />}
                onClick={handleUpload}
                loading={uploading}
                disabled={fileItems.length === 0}
                style={{ width: 200 }}
              >
                开始上传
              </Button>
              {uploadResult && uploadResult.tasks.length > 0 && (
                <Button
                  size="large"
                  onClick={() => navigate('/tasks')}
                >
                  查看任务队列
                </Button>
              )}
            </Space>
          </div>
        </Space>
      </Card>

      <Divider />

      <Card
        title={
          <span>
            <InfoCircleOutlined style={{ marginRight: 8 }} />
            上传规则说明
          </span>
        }
        size="small"
        style={{ marginTop: 24 }}
      >
        <List
          split={false}
          dataSource={[
            {
              title: '支持的视频格式',
              description: 'MP4, AVI, MKV, MOV, WMV, FLV, WebM, M4V',
            },
            {
              title: '文件大小限制',
              description: '单文件最大 2GB，超出会被标记为失败',
            },
            {
              title: '批量处理方式',
              description: '每个文件独立校验、独立执行、独立报错。失败的文件不影响其他文件处理。',
            },
            {
              title: '失败处理',
              description: '失败的文件会创建失败状态的任务，记录错误原因。可在任务列表中查看详情。',
            },
          ]}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={<Text strong>{item.title}</Text>}
                description={item.description}
              />
            </List.Item>
          )}
        />
      </Card>

      {templates.length > 0 && (
        <Card
          title={
            <span>
              <VideoCameraOutlined style={{ marginRight: 8 }} />
              可用转码模板
            </span>
          }
          style={{ marginTop: 24 }}
        >
          <List
            grid={{ gutter: 16, column: 3 }}
            dataSource={templates}
            renderItem={(template) => (
              <List.Item>
                <Card
                  size="small"
                  title={
                    <Space>
                      {template.name}
                      {template.is_default && <Tag color="blue">默认</Tag>}
                    </Space>
                  }
                >
                  <div style={{ fontSize: 13, color: '#666' }}>
                    <p>
                      分辨率: <strong>{template.video.width}x{template.video.height}</strong>
                    </p>
                    <p>
                      码率: <strong>{template.video.bitrate} kbps</strong>
                    </p>
                    <p>
                      帧率: <strong>{template.video.fps} FPS</strong>
                    </p>
                    <p>
                      编码: <strong>{template.video.codec}</strong>
                    </p>
                    <p style={{ marginTop: 8, fontSize: 12 }}>
                      {template.description}
                    </p>
                  </div>
                </Card>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  )
}

export default UploadPage
