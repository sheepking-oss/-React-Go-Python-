import { useState, useEffect } from 'react'
import {
  Card,
  Descriptions,
  Button,
  Space,
  Tag,
  Image,
  Table,
  message,
  Spin,
  Result,
  Typography,
  Divider,
} from 'antd'
import {
  ArrowLeftOutlined,
  VideoCameraOutlined,
  ReloadOutlined,
  EyeOutlined,
  RetweetOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { resourceApi, taskApi } from '@/services/api'
import type { Resource, Task } from '@/types'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const statusConfig: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '等待中' },
  queued: { color: 'processing', text: '排队中' },
  processing: { color: 'processing', text: '处理中' },
  retrying: { color: 'warning', text: '重试中' },
  completed: { color: 'success', text: '已完成' },
  failed: { color: 'error', text: '失败' },
  cancelled: { color: 'default', text: '已取消' },
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const formatDuration = (seconds: number) => {
  if (!seconds || seconds <= 0) return '-'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [resource, setResource] = useState<Resource | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)

  useEffect(() => {
    if (id) {
      loadResource(id)
      loadTasks(id)
    }
  }, [id])

  const loadResource = async (resourceId: string) => {
    setLoading(true)
    try {
      const response = await resourceApi.get(resourceId)
      if (response.data.success) {
        setResource(response.data.data as Resource)
      } else {
        message.error('资源不存在或已被删除')
      }
    } catch (error) {
      message.error('加载资源信息失败')
    } finally {
      setLoading(false)
    }
  }

  const loadTasks = async (resourceId: string) => {
    setTasksLoading(true)
    try {
      const response = await taskApi.list(undefined, 0, 100)
      if (response.data.success) {
        const allTasks = response.data.data!.items
        const resourceTasks = allTasks.filter((t) => t.resource_id === resourceId)
        setTasks(resourceTasks)
      }
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setTasksLoading(false)
    }
  }

  const handleRetryTask = async (task: Task) => {
    try {
      const response = await taskApi.retry(task.id)
      if (response.data.success) {
        message.success(`任务 ${task.id.slice(0, 8)} 已重新入队`)
        loadTasks(id!)
      } else {
        message.error(response.data.error || '重试失败')
      }
    } catch (error) {
      message.error('重试失败，请重试')
    }
  }

  const handleCancelTask = async (task: Task) => {
    try {
      const response = await taskApi.cancel(task.id)
      if (response.data.success) {
        message.success(`任务 ${task.id.slice(0, 8)} 已取消`)
        loadTasks(id!)
      } else {
        message.error(response.data.error || '取消失败')
      }
    } catch (error) {
      message.error('取消失败，请重试')
    }
  }

  const taskColumns: ColumnsType<Task> = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (taskId: string) => (
        <Text code style={{ fontSize: 12 }}>
          {taskId.slice(0, 12)}...
        </Text>
      ),
    },
    {
      title: '模板',
      dataIndex: 'template_name',
      key: 'template_name',
      width: 120,
      render: (name: string) => <Tag color="blue">{name}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: Task['status']) => {
        const config = statusConfig[status] || statusConfig.pending
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 200,
      render: (progress: number, record: Task) => {
        const status = record.status === 'failed' ? 'exception' : record.status === 'completed' ? 'success' : 'active'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 150 }}>
              <div
                style={{
                  height: 8,
                  background: '#f0f0f0',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    background:
                      record.status === 'completed'
                        ? '#52c41a'
                        : record.status === 'failed'
                        ? '#ff4d4f'
                        : '#1890ff',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {Math.round(progress)}%
            </Text>
          </div>
        )
      },
    },
    {
      title: '重试',
      key: 'retry',
      width: 80,
      render: (_: unknown, record: Task) => {
        if (record.retry_count === 0 && record.max_retries === 0) return '-'
        return `${record.retry_count}/${record.max_retries}`
      },
    },
    {
      title: '耗时',
      key: 'duration',
      width: 100,
      render: (_: unknown, record: Task) => formatDuration(record.duration_seconds),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => dayjs(time).format('MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: Task) => (
        <Space size="small">
          {record.status === 'failed' && (
            <Button
              type="link"
              icon={<RetweetOutlined />}
              onClick={() => handleRetryTask(record)}
              size="small"
            >
              重试
            </Button>
          )}
          {['pending', 'queued', 'processing', 'retrying'].includes(record.status) && (
            <Button
              type="link"
              danger
              icon={<StopOutlined />}
              onClick={() => handleCancelTask(record)}
              size="small"
            >
              取消
            </Button>
          )}
        </Space>
      ),
    },
  ]

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!resource) {
    return (
      <Result
        status="404"
        title="资源不存在"
        subTitle="抱歉，您访问的资源不存在或已被删除"
        extra={
          <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => navigate('/resources')}>
            返回资源库
          </Button>
        }
      />
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/resources')}
          style={{ marginBottom: 16 }}
        >
          返回资源库
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          <VideoCameraOutlined style={{ marginRight: 8 }} />
          资源详情 - {resource.name}
        </Title>
      </div>

      <Card>
        <div style={{ display: 'flex', gap: 32 }}>
          <div style={{ width: 400 }}>
            <Card
              size="small"
              title="封面预览"
              extra={
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => loadResource(id!)}
                >
                  刷新
                </Button>
              }
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  background: '#f0f0f0',
                  borderRadius: 8,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {resource.thumbnail ? (
                  <Image
                    src={`/thumbnails/${resource.thumbnail}`}
                    alt={resource.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <VideoCameraOutlined style={{ fontSize: 64, color: '#999' }} />
                )}
              </div>
            </Card>
          </div>

          <div style={{ flex: 1 }}>
            <Descriptions
              title="基本信息"
              bordered
              column={2}
              size="small"
            >
              <Descriptions.Item label="资源ID" span={2}>
                <Text code>{resource.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="文件名">
                {resource.name}
              </Descriptions.Item>
              <Descriptions.Item label="原始文件名">
                {resource.original_name}
              </Descriptions.Item>
              <Descriptions.Item label="文件大小">
                {formatFileSize(resource.size)}
              </Descriptions.Item>
              <Descriptions.Item label="文件类型">
                <Tag color="blue">{resource.file_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="MIME类型">
                <Text type="secondary">{resource.mime_type}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="标签">
                <Space wrap>
                  {resource.tags && resource.tags.length > 0 ? (
                    resource.tags.map((tag) => (
                      <Tag key={tag} color="green">
                        {tag}
                      </Tag>
                    ))
                  ) : (
                    <Text type="secondary">无</Text>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="上传时间">
                {dayjs(resource.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Descriptions
              title="视频信息"
              bordered
              column={2}
              size="small"
            >
              <Descriptions.Item label="分辨率">
                {resource.width && resource.height ? (
                  <Tag color="purple">
                    {resource.width} × {resource.height}
                  </Tag>
                ) : (
                  <Text type="secondary">未知</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="时长">
                {formatDuration(resource.duration)}
              </Descriptions.Item>
              <Descriptions.Item label="视频编码">
                {resource.codec || <Text type="secondary">未知</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="码率">
                {resource.bitrate ? (
                  `${(resource.bitrate / 1000).toFixed(1)} kbps`
                ) : (
                  <Text type="secondary">未知</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="帧率">
                {resource.fps ? `${resource.fps} FPS` : <Text type="secondary">未知</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="缩略图">
                {resource.thumbnail ? (
                  <Tag color="green">已生成</Tag>
                ) : (
                  <Text type="secondary">未生成</Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </div>
        </div>
      </Card>

      <Divider />

      <Card
        title={
          <span>
            <EyeOutlined style={{ marginRight: 8 }} />
            关联任务 ({tasks.length})
          </span>
        }
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => loadTasks(id!)}
          >
            刷新
          </Button>
        }
      >
        <Table
          columns={taskColumns}
          dataSource={tasks}
          rowKey="id"
          loading={tasksLoading}
          pagination={false}
          locale={{
            emptyText: (
              <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                暂无关联任务
              </div>
            ),
          }}
        />
      </Card>
    </div>
  )
}

export default ResourceDetailPage
