import { useState, useEffect } from 'react'
import {
  Card,
  Descriptions,
  Button,
  Space,
  Tag,
  Progress,
  Table,
  message,
  Spin,
  Result,
  Typography,
  Divider,
  Alert,
  List,
  Collapse,
} from 'antd'
import {
  ArrowLeftOutlined,
  BarsOutlined,
  ReloadOutlined,
  RetweetOutlined,
  StopOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { taskApi, logApi, resourceApi } from '@/services/api'
import type { Task, LogEntry, Resource } from '@/types'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { Panel } = Collapse

const statusConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  pending: { color: 'default', text: '等待中', icon: <InfoCircleOutlined /> },
  queued: { color: 'processing', text: '排队中', icon: <InfoCircleOutlined /> },
  processing: { color: 'processing', text: '处理中', icon: <InfoCircleOutlined spin /> },
  retrying: { color: 'warning', text: '重试中', icon: <ExclamationCircleOutlined spin /> },
  completed: { color: 'success', text: '已完成', icon: <CheckCircleOutlined /> },
  failed: { color: 'error', text: '失败', icon: <CloseCircleOutlined /> },
  cancelled: { color: 'default', text: '已取消', icon: <ExclamationCircleOutlined /> },
}

const levelConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  info: { color: 'blue', icon: <InfoCircleOutlined /> },
  warning: { color: 'orange', icon: <ExclamationCircleOutlined /> },
  error: { color: 'red', icon: <CloseCircleOutlined /> },
  success: { color: 'green', icon: <CheckCircleOutlined /> },
}

const formatDuration = (seconds: number) => {
  if (!seconds || seconds <= 0) return '-'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hours > 0) {
    return `${hours}小时 ${minutes}分 ${secs}秒`
  }
  if (minutes > 0) {
    return `${minutes}分 ${secs}秒`
  }
  return `${secs}秒`
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState<Task | null>(null)
  const [resource, setResource] = useState<Resource | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  useEffect(() => {
    if (id) {
      loadTask(id)
      loadLogs(id)
    }
  }, [id])

  const loadTask = async (taskId: string) => {
    setLoading(true)
    try {
      const response = await taskApi.get(taskId)
      if (response.data.success) {
        const taskData = response.data.data as Task
        setTask(taskData)
        
        if (taskData.resource_id) {
          loadResource(taskData.resource_id)
        }
      } else {
        message.error('任务不存在或已被删除')
      }
    } catch (error) {
      message.error('加载任务信息失败')
    } finally {
      setLoading(false)
    }
  }

  const loadResource = async (resourceId: string) => {
    try {
      const response = await resourceApi.get(resourceId)
      if (response.data.success) {
        setResource(response.data.data as Resource)
      }
    } catch (error) {
      console.error('Failed to load resource:', error)
    }
  }

  const loadLogs = async (taskId: string) => {
    setLogsLoading(true)
    try {
      const response = await logApi.list(taskId, 0, 500)
      if (response.data.success) {
        setLogs(response.data.data!.items)
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleRetry = async () => {
    if (!task) return
    try {
      const response = await taskApi.retry(task.id)
      if (response.data.success) {
        message.success('任务已重新入队')
        loadTask(task.id)
        loadLogs(task.id)
      } else {
        message.error(response.data.error || '重试失败')
      }
    } catch (error) {
      message.error('重试失败，请重试')
    }
  }

  const handleCancel = async () => {
    if (!task) return
    try {
      const response = await taskApi.cancel(task.id)
      if (response.data.success) {
        message.success('任务已取消')
        loadTask(task.id)
      } else {
        message.error(response.data.error || '取消失败')
      }
    } catch (error) {
      message.error('取消失败，请重试')
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!task) {
    return (
      <Result
        status="404"
        title="任务不存在"
        subTitle="抱歉，您访问的任务不存在或已被删除"
        extra={
          <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => navigate('/tasks')}>
            返回任务队列
          </Button>
        }
      />
    )
  }

  const statusInfo = statusConfig[task.status] || statusConfig.pending
  const isActive = ['pending', 'queued', 'processing', 'retrying'].includes(task.status)

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/tasks')}
          style={{ marginBottom: 16 }}
        >
          返回任务队列
        </Button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            <BarsOutlined style={{ marginRight: 8 }} />
            任务详情
            <Tag icon={statusInfo.icon} color={statusInfo.color} style={{ marginLeft: 16 }}>
              {statusInfo.text}
            </Tag>
          </Title>
          <Space>
            {task.status === 'failed' && (
              <Button
                type="primary"
                icon={<RetweetOutlined />}
                onClick={handleRetry}
              >
                重试任务
              </Button>
            )}
            {isActive && (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={handleCancel}
              >
                取消任务
              </Button>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                loadTask(task.id)
                loadLogs(task.id)
              }}
            >
              刷新
            </Button>
          </Space>
        </div>
      </div>

      {task.status === 'failed' && (
        <Alert
          message="任务执行失败"
          description={
            <div>
              <Paragraph strong>错误信息: {task.error_message || '未知错误'}</Paragraph>
              {task.error_details && (
                <Collapse ghost>
                  <Panel header="查看详细错误信息" key="details">
                    <pre style={{ background: '#fff1f0', padding: 12, borderRadius: 4, overflow: 'auto' }}>
                      {task.error_details}
                    </pre>
                  </Panel>
                </Collapse>
              )}
              <Space>
                <Button type="primary" size="small" onClick={handleRetry}>
                  立即重试
                </Button>
                <Text type="secondary">
                  已重试 {task.retry_count}/{task.max_retries} 次
                </Text>
              </Space>
            </div>
          }
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <Descriptions
          title="任务基本信息"
          bordered
          column={2}
          size="small"
        >
          <Descriptions.Item label="任务ID" span={2}>
            <Text code>{task.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="资源名称">
            {resource ? (
              <Text
                strong
                style={{ cursor: 'pointer', color: '#1890ff' }}
                onClick={() => navigate(`/resources/${task.resource_id}`)}
              >
                {resource.name}
              </Text>
            ) : (
              task.resource_name
            )}
          </Descriptions.Item>
          <Descriptions.Item label="资源ID">
            <Text code>{task.resource_id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="转码模板">
            <Tag color="blue">{task.template_name}</Tag>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              ({task.template_id.slice(0, 12)}...)
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="优先级">
            {task.priority === 0 && <Tag>低</Tag>}
            {task.priority === 50 && <Tag color="blue">正常</Tag>}
            {task.priority === 100 && <Tag color="red">高</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(task.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="排队时间">
            {task.queued_at ? dayjs(task.queued_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {task.started_at ? dayjs(task.started_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="完成时间">
            {task.completed_at ? dayjs(task.completed_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="执行耗时">
            {formatDuration(task.duration_seconds)}
          </Descriptions.Item>
          <Descriptions.Item label="重试次数">
            {task.retry_count} / {task.max_retries}
          </Descriptions.Item>
          <Descriptions.Item label="输出大小">
            {formatFileSize(task.output_size)}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <Descriptions
          title="执行进度"
          bordered
          column={1}
          size="small"
        >
          <Descriptions.Item label="进度">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Progress
                percent={Math.round(task.progress)}
                status={task.status === 'failed' ? 'exception' : task.status === 'completed' ? 'success' : 'active'}
                style={{ flex: 1, minWidth: 300 }}
                strokeWidth={12}
              />
              <Text strong style={{ fontSize: 18 }}>
                {Math.round(task.progress)}%
              </Text>
            </div>
            {task.progress_message && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                当前状态: {task.progress_message}
              </Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Divider />

      <Card
        title={
          <span>
            <InfoCircleOutlined style={{ marginRight: 8 }} />
            执行日志 ({logs.length})
          </span>
        }
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => loadLogs(task.id)}
          >
            刷新日志
          </Button>
        }
      >
        <List
          loading={logsLoading}
          locale={{
            emptyText: (
              <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                暂无日志记录
              </div>
            ),
          }}
          dataSource={logs}
          renderItem={(log) => {
            const levelInfo = levelConfig[log.level] || levelConfig.info
            return (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <div style={{ marginTop: 4 }}>
                      {levelInfo.icon}
                    </div>
                  }
                  title={
                    <Space>
                      <Tag color={levelInfo.color}>{log.level.toUpperCase()}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(log.created_at).format('HH:mm:ss.SSS')}
                      </Text>
                    </Space>
                  }
                  description={
                    <div>
                      <Paragraph style={{ margin: 0 }}>{log.message}</Paragraph>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <Collapse ghost size="small">
                          <Panel header="详细信息" key="details">
                            <pre
                              style={{
                                background: '#fafafa',
                                padding: 8,
                                borderRadius: 4,
                                fontSize: 12,
                                overflow: 'auto',
                              }}
                            >
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </Panel>
                        </Collapse>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )
          }}
        />
      </Card>
    </div>
  )
}

export default TaskDetailPage
