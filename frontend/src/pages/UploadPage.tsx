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
} from 'antd'
import {
  UploadOutlined,
  PlusOutlined,
  VideoCameraOutlined,
  FileOutlined,
} from '@ant-design/icons'
import type { UploadProps, RcFile } from 'antd/es/upload'
import { uploadApi, templateApi } from '@/services/api'
import type { TranscodeTemplate, Task, Resource } from '@/types'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography
const { TextArea } = Input

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

function UploadPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<TranscodeTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [tags, setTags] = useState<string>('')
  const [fileList, setFileList] = useState<RcFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResults, setUploadResults] = useState<{
    resources: Resource[]
    tasks: Task[]
  } | null>(null)

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
    const isVideo =
      ACCEPTED_VIDEO_TYPES.includes(file.type) ||
      ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))

    if (!isVideo) {
      message.error('只能上传视频文件！')
      return Upload.LIST_IGNORE
    }

    const isLt2G = file.size / 1024 / 1024 < 2048
    if (!isLt2G) {
      message.error('视频文件不能超过 2GB！')
      return Upload.LIST_IGNORE
    }

    setFileList((prev) => [...prev, file as RcFile])
    return false
  }

  const handleRemove = (file: any) => {
    const index = fileList.findIndex((f) => f.uid === file.uid)
    if (index > -1) {
      setFileList((prev) => prev.filter((f) => f.uid !== file.uid))
    }
  }

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择要上传的视频文件')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setUploadResults(null)

    try {
      const tagArray = tags
        ? tags.split(',').map((t) => t.trim()).filter((t) => t)
        : []

      const response = await uploadApi.uploadFiles(
        fileList,
        selectedTemplate || undefined,
        tagArray.length > 0 ? tagArray : undefined,
        (progress) => setUploadProgress(progress)
      )

      if (response.data.success) {
        message.success(`成功上传 ${fileList.length} 个文件，任务已创建`)
        setUploadResults(response.data.data)
        setFileList([])
        setTags('')
        setUploadProgress(100)
      } else {
        message.error(response.data.error || '上传失败')
      }
    } catch (error: any) {
      message.error(error.message || '上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const uploadProps: UploadProps = {
    beforeUpload,
    fileList: fileList.map((f) => ({
      uid: f.uid,
      name: f.name,
      size: f.size,
      status: 'done' as const,
    })),
    onRemove: handleRemove,
    multiple: true,
    accept: ACCEPTED_VIDEO_TYPES.join(','),
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <UploadOutlined style={{ marginRight: 8 }} />
        上传视频
      </Title>

      {uploadResults && (
        <Alert
          type="success"
          message="上传成功"
          description={
            <div>
              <p>已创建 {uploadResults.tasks.length} 个转码任务</p>
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
                支持 MP4, AVI, MKV, MOV, WMV, FLV, WebM 格式，单文件最大 2GB
              </p>
            </Upload.Dragger>
          </div>

          {fileList.length > 0 && (
            <Card
              size="small"
              title={
                <span>
                  <FileOutlined style={{ marginRight: 8 }} />
                  已选择 {fileList.length} 个文件
                </span>
              }
            >
              <List
                size="small"
                dataSource={fileList}
                renderItem={(file) => (
                  <List.Item>
                    <Space>
                      <VideoCameraOutlined />
                      <Text>{file.name}</Text>
                      <Text type="secondary">{formatFileSize(file.size)}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          )}

          {uploading && (
            <Progress
              percent={uploadProgress}
              status="active"
              format={(percent) => `上传中... ${percent}%`}
            />
          )}

          <div style={{ textAlign: 'center', paddingTop: 16 }}>
            <Button
              type="primary"
              size="large"
              icon={<UploadOutlined />}
              onClick={handleUpload}
              loading={uploading}
              disabled={fileList.length === 0}
              style={{ width: 200 }}
            >
              开始上传并创建任务
            </Button>
          </div>
        </Space>
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
