import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, theme, Badge } from 'antd'
import {
  UploadOutlined,
  FolderOutlined,
  BarsOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { queueApi } from '@/services/api'
import type { QueueStats } from '@/types'

const { Header, Sider, Content } = AntLayout

const menuItems: MenuProps['items'] = [
  {
    key: '/upload',
    icon: <UploadOutlined />,
    label: '上传视频',
  },
  {
    key: '/resources',
    icon: <FolderOutlined />,
    label: '资源库',
  },
  {
    key: '/tasks',
    icon: <BarsOutlined />,
    label: '任务队列',
  },
  {
    key: '/logs',
    icon: <FileTextOutlined />,
    label: '日志查询',
  },
]

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [stats, setStats] = useState<QueueStats | null>(null)
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const selectedKey = location.pathname.startsWith('/resources/') 
    ? '/resources' 
    : location.pathname.startsWith('/tasks/')
    ? '/tasks'
    : location.pathname === '/' 
    ? '/upload' 
    : location.pathname

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await queueApi.getStats()
        if (response.data.success) {
          setStats(response.data.data as QueueStats)
        }
      } catch (error) {
        console.error('Failed to fetch queue stats:', error)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key)
  }

  const getMenuItem = (key: string, icon: React.ReactNode, label: string) => {
    let badgeCount = 0
    
    if (key === '/tasks' && stats) {
      badgeCount = stats.queued + stats.processing
    }

    return {
      key,
      icon,
      label: (
        <span>
          {label}
          {badgeCount > 0 && (
            <Badge
              count={badgeCount}
              size="small"
              style={{ marginLeft: 8 }}
            />
          )}
        </span>
      ),
    }
  }

  const dynamicMenuItems = [
    getMenuItem('/upload', <UploadOutlined />, '上传视频'),
    getMenuItem('/resources', <FolderOutlined />, '资源库'),
    getMenuItem('/tasks', <BarsOutlined />, '任务队列'),
    getMenuItem('/logs', <FileTextOutlined />, '日志查询'),
  ]

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        width={240}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 16px',
          }}
        >
          <VideoCameraOutlined
            style={{ fontSize: 24, color: '#1890ff', marginRight: 8 }}
          />
          {!collapsed && (
            <span
              style={{
                color: 'white',
                fontSize: 16,
                fontWeight: 'bold',
              }}
            >
              视频转码平台
            </span>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={dynamicMenuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <AntLayout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '100%',
              padding: '0 24px',
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 500 }}>
              视频转码与资源管理平台
            </span>
            <div style={{ display: 'flex', gap: 24 }}>
              {stats && (
                <>
                  <span style={{ fontSize: 13, color: '#666' }}>
                    队列中: <strong style={{ color: '#1890ff' }}>{stats.queued}</strong>
                  </span>
                  <span style={{ fontSize: 13, color: '#666' }}>
                    处理中: <strong style={{ color: '#fa8c16' }}>{stats.processing}</strong>
                  </span>
                  <span style={{ fontSize: 13, color: '#666' }}>
                    已完成: <strong style={{ color: '#52c41a' }}>{stats.completed}</strong>
                  </span>
                  <span style={{ fontSize: 13, color: '#666' }}>
                    失败: <strong style={{ color: '#ff4d4f' }}>{stats.failed}</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
