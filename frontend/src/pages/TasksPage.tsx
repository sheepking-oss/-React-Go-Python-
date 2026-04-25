import { useState, useEffect } from 'react'
import {
  Table,
  Card,
  Button,
  Space,
  Tag,
  Select,
  Popconfirm,
  message,
  Tooltip,
  Typography,
  Empty,
  Progress,
  Badge,
  Statistic,
  Row,
  Col,
} from 'antd'
import {
  EyeOutlined,
  RetweetOutlined,
  StopOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { taskApi, queueApi } from '@/services/api'
import type { Task, QueueStats } from '@/types'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '等待中', value: 'pending' },
  { label: '排队中', value: 'queued' },
  { label: '处理中', value: 'processing' },
  { label: '重试中', value: 'retrying' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' },
]

const statusConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  pending: { color: 'default', text: '等待中', icon: <ClockCircleOutlined /> },
  queued: { color: 'processing', text: '排队中', icon: <PlayCircleOutlined /> },
  processing: { color: 'processing', text: '处理中', icon: <LoadingOutlined spin /> },
  retrying: { color: 'warning', text: '重试中', icon: <RetweetOutlined spin /> },
  completed: { color: 'success', text: '已完成', icon: <CheckCircleOutlined /> },
  failed: { color: 'error', text: '失败', icon: <CloseCircleOutlined /> },
  cancelled: { color: 'default', text: '已取消', icon: <PauseCircleOutlined /> },
}

const formatDuration = (seconds: number) => {
  if (!seconds || seconds <= 0) return '-'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function TasksPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [stats, setStats] = useState<QueueStats | null>(null)

  useEffect(() => {
    loadTasks()
    loadStats()
  }, [currentPage, statusFilter])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const response = await taskApi.list(
        statusFilter || undefined,
        (currentPage - 1) * pageSize,
        pageSize
      )
      if (response.data.success) {
        const data = response.data.data!
        setTasks(data.items)
        setTotal(data.total)
      }
    } catch (error) {
      message.error('加载任务列表失败')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await queueApi.getStats()
      if (response.data.success) {
        setStats(response.data.data as QueueStats)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const handleRetry = async (task: Task) => {
    try {
      const response = await taskApi.retry(task.id)
      if (response.data.success) {
        message.success(`任务 ${task.id.slice(0, 8)} 已重新入队`)
        loadTasks()
        loadStats()
      } else {
        message.error(response.data.error || '重试失败')
      }
    } catch (error) {
      message.error('重试失败，请重试')
    }
  }

  const handleCancel = async (task: Task) => {
    try {
      const response = await taskApi.cancel(task.id)
      if (response.data.success) {
        message.success(`任务 ${task.id.slice(0, 8)} 已取消`)
        loadTasks()
        loadStats()
      } else {
        message.error(response.data.error || '取消失败')
      }
    } catch (error) {
      message.error('取消失败，请重试')
    }
  }

  const columns: ColumnsType<Task> = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => (
        <Tooltip title={id}>
          <Text code style={{ fontSize: 12 }}>
            {id.slice(0, 8)}...
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '资源名称',
      dataIndex: 'resource_name',
      key: 'resource_name',
      ellipsis: true,
      render: (name: string) => (
        <Tooltip title={name}>
          <Text strong>{name}</Text>
        </Tooltip>
      ),
    },
    {
      title: '转码模板',
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
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.text}
          </Tag>
        )
      },
    },
    {
      title: '进度',
      key: 'progress',
      width: 200,
      render: (_: unknown, record: Task) => {
        const isProcessing = ['processing', 'queued', 'retrying'].includes(record.status)
        const status = record.status === 'failed' ? 'exception' : record.status === 'completed' ? 'success' : 'active'
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress
              percent={Math.round(record.progress)}
              status={status}
              size="small"
              strokeWidth={8}
              style={{ minWidth: 120 }}
            />
            {isProcessing && record.progress_message && (
              <Tooltip title={record.progress_message}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.progress_message}
                </Text>
              </Tooltip>
            )}
          </div>
        )
      },
    },
    {
      title: '重试',
      key: 'retry',
      width: 100,
      render: (_: unknown, record: Task) => {
        if (record.retry_count === 0 && record.max_retries === 0) return '-'
        return (
          <Text type={record.retry_count >= record.max_retries ? 'danger' : 'secondary'}>
            {record.retry_count}/{record.max_retries}
          </Text>
        )
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
      width: 160,
      fixed: 'right',
      render: (_: unknown, record: Task) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/tasks/${record.id}`)}
              size="small"
            />
          </Tooltip>
          
          {record.status === 'failed' && (
            <Tooltip title="重试任务">
              <Button
                type="link"
                icon={<RetweetOutlined />}
                onClick={() => handleRetry(record)}
                size="small"
              />
            </Tooltip>
          )}
          
          {['pending', 'queued', 'processing', 'retrying'].includes(record.status) && (
            <Popconfirm
              title="确认取消"
              description="确定要取消该任务吗？"
              onConfirm={() => handleCancel(record)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="取消任务">
                <Button
                  type="link"
                  danger
                  icon={<StopOutlined />}
                  size="small"
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <BarsOutlined style={{ marginRight: 8 }} />
          任务队列
        </Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            loadTasks()
            loadStats()
          }}
        >
          刷新
        </Button>
      </div>

      {stats && (
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={3}>
              <Statistic
                title="队列中"
                value={stats.queued}
                prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
              />
            </Col>
            <Col span={3}>
              <Statistic
                title="处理中"
                value={stats.processing}
                prefix={<LoadingOutlined style={{ color: '#fa8c16' }} spin />}
              />
            </Col>
            <Col span={3}>
              <Statistic
                title="已完成"
                value={stats.completed}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              />
            </Col>
            <Col span={3}>
              <Statistic
                title="失败"
                value={stats.failed}
                prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              />
            </Col>
            <Col span={3}>
              <Statistic
                title="工作进程"
                value={stats.active_workers}
                suffix={`/ ${stats.max_workers}`}
                prefix={<PlayCircleOutlined style={{ color: '#13c2c2' }} />}
              />
            </Col>
          </Row>
        </Card>
      )}

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 150 }}
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value)
              setCurrentPage(1)
            }}
            options={statusOptions}
            allowClear
          />
          {tasks.some((t) => t.status === 'failed') && (
            <Button
              type="primary"
              icon={<RetweetOutlined />}
              onClick={() => {
                const failedTasks = tasks.filter((t) => t.status === 'failed')
                failedTasks.forEach((task) => handleRetry(task))
              }}
            >
              重试所有失败任务
            </Button>
          )}
        </Space>

        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: false,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条任务`,
            onChange: (page) => setCurrentPage(page),
          }}
          scroll={{ x: 1400 }}
          locale={{
            emptyText: (
              <Empty
                description="暂无任务"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>
    </div>
  )
}

export default TasksPage
