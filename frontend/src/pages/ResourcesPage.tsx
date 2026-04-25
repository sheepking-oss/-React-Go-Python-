import { useState, useEffect } from 'react'
import {
  Table,
  Card,
  Button,
  Space,
  Tag,
  Input,
  Popconfirm,
  message,
  Tooltip,
  Image,
  Typography,
  Empty,
  Badge,
} from 'antd'
import {
  EyeOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  VideoCameraOutlined,
  FileOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { resourceApi, taskApi } from '@/services/api'
import type { Resource, Task } from '@/types'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const formatDuration = (seconds: number) => {
  if (!seconds) return '-'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function ResourcesPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [resources, setResources] = useState<Resource[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [searchText, setSearchText] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    loadResources()
    loadTasks()
  }, [currentPage])

  const loadResources = async () => {
    setLoading(true)
    try {
      const response = await resourceApi.list((currentPage - 1) * pageSize, pageSize)
      if (response.data.success) {
        const data = response.data.data!
        setResources(data.items)
        setTotal(data.total)
      }
    } catch (error) {
      message.error('加载资源列表失败')
    } finally {
      setLoading(false)
    }
  }

  const loadTasks = async () => {
    try {
      const response = await taskApi.list(undefined, 0, 1000)
      if (response.data.success) {
        setTasks(response.data.data!.items)
      }
    } catch (error) {
      console.error('Failed to load tasks:', error)
    }
  }

  const getTasksForResource = (resourceId: string) => {
    return tasks.filter((t) => t.resource_id === resourceId)
  }

  const getStatusBadge = (status: Task['status']) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '等待中' },
      queued: { color: 'processing', text: '排队中' },
      processing: { color: 'processing', text: '处理中' },
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '失败' },
      retrying: { color: 'warning', text: '重试中' },
      cancelled: { color: 'default', text: '已取消' },
    }
    const config = statusConfig[status] || { color: 'default', text: status }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  const handleDelete = async (id: string, name: string) => {
    try {
      const response = await resourceApi.delete(id)
      if (response.data.success) {
        message.success(`资源 ${name} 已删除`)
        loadResources()
      } else {
        message.error(response.data.error || '删除失败')
      }
    } catch (error) {
      message.error('删除失败，请重试')
    }
  }

  const columns: ColumnsType<Resource> = [
    {
      title: '封面',
      dataIndex: 'thumbnail',
      key: 'thumbnail',
      width: 120,
      render: (thumbnail: string, record: Resource) => (
        <div style={{ width: 100, height: 60, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {thumbnail ? (
            <Image
              src={`/thumbnails/${thumbnail}`}
              alt={record.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              preview={{ src: `/thumbnails/${thumbnail}` }}
            />
          ) : (
            <VideoCameraOutlined style={{ fontSize: 24, color: '#999' }} />
          )}
        </div>
      ),
    },
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string, record: Resource) => (
        <Tooltip title={name}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileOutlined />
            <Text strong>{name}</Text>
          </div>
        </Tooltip>
      ),
    },
    {
      title: '分辨率',
      key: 'resolution',
      width: 120,
      render: (_: unknown, record: Resource) => {
        if (record.width && record.height) {
          return <Tag>{record.width}×{record.height}</Tag>
        }
        return '-'
      },
    },
    {
      title: '时长',
      key: 'duration',
      width: 100,
      render: (_: unknown, record: Resource) => formatDuration(record.duration),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 150,
      render: (tags: string[]) => (
        <Space size={4} wrap>
          {tags && tags.map((tag) => (
            <Tag key={tag} color="blue" style={{ margin: 2 }}>
              {tag}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '关联任务',
      key: 'tasks',
      width: 150,
      render: (_: unknown, record: Resource) => {
        const resourceTasks = getTasksForResource(record.id)
        if (resourceTasks.length === 0) {
          return <Text type="secondary">无</Text>
        }
        return (
          <Space direction="vertical" size={2}>
            {resourceTasks.slice(0, 2).map((task) => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {getStatusBadge(task.status)}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {task.template_name}
                </Text>
              </div>
            ))}
            {resourceTasks.length > 2 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                还有 {resourceTasks.length - 2} 个任务...
              </Text>
            )}
          </Space>
        )
      },
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_: unknown, record: Resource) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/resources/${record.id}`)}
              size="small"
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定要删除资源 "${record.name}" 吗？此操作不可恢复。`}
            onConfirm={() => handleDelete(record.id, record.name)}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const filteredResources = resources.filter((r) =>
    searchText
      ? r.name.toLowerCase().includes(searchText.toLowerCase()) ||
        r.tags?.some((t) => t.toLowerCase().includes(searchText.toLowerCase()))
      : true
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <FolderOutlined style={{ marginRight: 8 }} />
          资源库
          <Badge count={total} style={{ marginLeft: 12 }} />
        </Title>
        <Space>
          <Input
            placeholder="搜索文件名或标签"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            allowClear
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadResources()
              loadTasks()
            }}
          >
            刷新
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredResources}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: false,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page) => setCurrentPage(page),
          }}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: (
              <Empty
                description="暂无资源，请先上传视频"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>
    </div>
  )
}

export default ResourcesPage
