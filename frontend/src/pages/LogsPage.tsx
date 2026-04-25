import { useState, useEffect } from 'react'
import {
  Table,
  Card,
  Button,
  Space,
  Tag,
  Input,
  message,
  Tooltip,
  Typography,
  Empty,
  Descriptions,
  Drawer,
} from 'antd'
import {
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { logApi } from '@/services/api'
import type { LogEntry } from '@/types'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography

const levelConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  info: { color: 'blue', icon: <InfoCircleOutlined /> },
  warning: { color: 'orange', icon: <ExclamationCircleOutlined /> },
  error: { color: 'red', icon: <CloseCircleOutlined /> },
  success: { color: 'green', icon: <CheckCircleOutlined /> },
}

function LogsPage() {
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)
  const [searchText, setSearchText] = useState('')
  const [taskIdFilter, setTaskIdFilter] = useState('')
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)

  useEffect(() => {
    loadLogs()
  }, [currentPage, taskIdFilter])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const response = await logApi.list(
        taskIdFilter || undefined,
        (currentPage - 1) * pageSize,
        pageSize
      )
      if (response.data.success) {
        const data = response.data.data!
        setLogs(data.items)
        setTotal(data.total)
      }
    } catch (error) {
      message.error('加载日志列表失败')
    } finally {
      setLoading(false)
    }
  }

  const showLogDetail = (log: LogEntry) => {
    setSelectedLog(log)
    setDrawerVisible(true)
  }

  const filteredLogs = logs.filter((log) =>
    searchText
      ? log.message.toLowerCase().includes(searchText.toLowerCase()) ||
        log.task_id.toLowerCase().includes(searchText.toLowerCase()) ||
        log.resource_id.toLowerCase().includes(searchText.toLowerCase())
      : true
  )

  const columns: ColumnsType<LogEntry> = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: string) => {
        const config = levelConfig[level] || levelConfig.info
        return (
          <Tag icon={config.icon} color={config.color}>
            {level.toUpperCase()}
          </Tag>
        )
      },
    },
    {
      title: '任务ID',
      dataIndex: 'task_id',
      key: 'task_id',
      width: 120,
      render: (taskId: string) => (
        <Tooltip title={taskId}>
          {taskId ? (
            <Text code style={{ fontSize: 12, cursor: 'pointer' }} onClick={() => setTaskIdFilter(taskId)}>
              {taskId.slice(0, 12)}...
            </Text>
          ) : (
            <Text type="secondary">-</Text>
          )}
        </Tooltip>
      ),
    },
    {
      title: '资源ID',
      dataIndex: 'resource_id',
      key: 'resource_id',
      width: 120,
      render: (resourceId: string) => (
        <Tooltip title={resourceId}>
          {resourceId ? (
            <Text code style={{ fontSize: 12 }}>
              {resourceId.slice(0, 12)}...
            </Text>
          ) : (
            <Text type="secondary">-</Text>
          )}
        </Tooltip>
      ),
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (message: string) => (
        <Tooltip title={message}>
          <Text>{message}</Text>
        </Tooltip>
      ),
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      width: 100,
      render: (details: Record<string, string>) => (
        details && Object.keys(details).length > 0 ? (
          <Tag color="purple">有详情</Tag>
        ) : (
          <Text type="secondary">无</Text>
        )
      ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss.SSS'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_: unknown, record: LogEntry) => (
        <Tooltip title="查看详情">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => showLogDetail(record)}
            size="small"
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          日志查询
        </Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => loadLogs()}
        >
          刷新
        </Button>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索消息内容或ID"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 300 }}
            allowClear
          />
          <Input
            placeholder="按任务ID筛选"
            value={taskIdFilter}
            onChange={(e) => {
              setTaskIdFilter(e.target.value)
              setCurrentPage(1)
            }}
            prefix={<SearchOutlined />}
            style={{ width: 300 }}
            allowClear
          />
        </Space>

        <Table
          columns={columns}
          dataSource={filteredLogs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: false,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条日志`,
            onChange: (page) => setCurrentPage(page),
          }}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: (
              <Empty
                description="暂无日志记录"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      <Drawer
        title="日志详情"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={600}
      >
        {selectedLog && (
          <div>
            <Descriptions
              bordered
              column={1}
              size="small"
            >
              <Descriptions.Item label="日志ID">
                <Text code>{selectedLog.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="级别">
                <Tag
                  icon={levelConfig[selectedLog.level]?.icon}
                  color={levelConfig[selectedLog.level]?.color}
                >
                  {selectedLog.level.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="任务ID">
                {selectedLog.task_id ? (
                  <Text code>{selectedLog.task_id}</Text>
                ) : (
                  <Text type="secondary">-</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="资源ID">
                {selectedLog.resource_id ? (
                  <Text code>{selectedLog.resource_id}</Text>
                ) : (
                  <Text type="secondary">-</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="消息">
                <Paragraph>{selectedLog.message}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(selectedLog.created_at).format('YYYY-MM-DD HH:mm:ss.SSS')}
              </Descriptions.Item>
            </Descriptions>

            {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>详细信息</Title>
                <Card size="small">
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </Card>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default LogsPage
