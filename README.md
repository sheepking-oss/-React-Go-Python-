# 视频转码与资源管理平台

一个基于 React + Go + Python 技术栈的企业级视频转码与资源管理后台平台，支持视频上传、批量转码、任务调度、状态监控、失败重试等完整功能。

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (React)                              │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────┤
│ 上传页面 │ 资源库   │ 任务队列 │ 日志查询 │ 资源详情 │ 任务详情 │
└──────────┴──────────┴──────────┴──────────┴──────────┴─────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        调度层 (Go)                                │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│  任务调度器   │  队列管理     │  状态维护     │  文件接口服务      │
├──────────────┴──────────────┴──────────────┴───────────────────┤
│  批量任务处理  │  失败重试机制  │  模板化转码  │  日志追踪系统      │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        处理层 (Python)                            │
├──────────────────┬──────────────────┬───────────────────────────┤
│   视频分析器      │   封面生成器      │      转码执行器            │
│ (ffprobe获取元信息)│ (ffmpeg截图+优化) │ (ffmpeg模板化转码+HLS)   │
└──────────────────┴──────────────────┴───────────────────────────┘
```

## 功能特性

### 前端功能 (React)
- **上传页面**：多文件拖拽上传、转码模板选择、标签管理、上传进度显示
- **资源库**：资源列表展示、搜索筛选、标签管理、封面预览、批量操作
- **任务队列**：任务状态监控、进度追踪、重试/取消操作、统计面板
- **日志查询**：按任务筛选、日志级别过滤、详情查看、搜索功能
- **资源详情**：视频信息展示、分辨率/时长/码率、关联任务列表
- **任务详情**：进度追踪、执行日志、失败原因、重试功能

### 后端功能 (Go)
- **任务调度**：多工作进程并发处理、优先级队列、状态流转管理
- **状态维护**：完整的任务生命周期、持久化存储、实时更新
- **失败重试**：可配置重试次数、指数退避延迟、手动重试触发
- **模板管理**：预置多种转码模板、自定义模板创建、默认模板设置
- **文件接口**：文件上传下载、静态资源服务、缩略图访问

### 处理功能 (Python)
- **视频分析**：使用 ffprobe 获取分辨率、帧率、码率、编码格式等元信息
- **封面生成**：智能选择关键帧、多尺寸缩略图生成、图片压缩优化
- **转码执行**：基于 FFmpeg 的模板化转码、HLS 流媒体输出、进度监控

## 状态流转设计

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
                    ▼                                             │
  ┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────┐
  │ pending  │──▶│  queued  │──▶│  processing  │──▶│ completed│
  │  (等待)   │   │  (排队)   │   │   (处理中)    │   │  (完成)   │
  └──────────┘   └──────────┘   └──────┬───────┘   └──────────┘
                                        │
                                        │ 失败
                                        ▼
                                  ┌──────────┐
                                  │  failed  │
                                  │  (失败)   │
                                  └────┬─────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
              ┌──────────┐      ┌──────────┐      ┌───────────┐
              │ retrying │      │ cancelled│      │(手动重试)  │
              │ (重试中)  │      │ (已取消)  │      │ 回queued  │
              └────┬─────┘      └──────────┘      └───────────┘
                   │
                   ▼
              回 processing
```

## 项目结构

```
-React-Go-Python-/
├── README.md
├── frontend/                    # React 前端
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx            # 入口文件
│       ├── App.tsx             # 路由配置
│       ├── index.css           # 全局样式
│       ├── types/              # TypeScript 类型定义
│       │   └── index.ts
│       ├── services/           # API 服务
│       │   └── api.ts
│       ├── components/         # 公共组件
│       │   └── Layout.tsx      # 布局组件
│       └── pages/              # 页面组件
│           ├── UploadPage.tsx
│           ├── ResourcesPage.tsx
│           ├── TasksPage.tsx
│           ├── LogsPage.tsx
│           ├── ResourceDetailPage.tsx
│           └── TaskDetailPage.tsx
│
├── backend/
│   ├── go/                      # Go 后端服务
│   │   ├── go.mod
│   │   ├── main.go              # 主入口
│   │   ├── config/              # 配置管理
│   │   │   └── config.go
│   │   ├── models/              # 数据模型
│   │   │   └── models.go
│   │   ├── store/               # 数据存储
│   │   │   └── store.go
│   │   ├── queue/               # 任务队列
│   │   │   └── queue.go
│   │   ├── handlers/            # HTTP 处理器
│   │   │   └── handlers.go
│   │   └── logger/              # 日志配置
│   │       └── logger.go
│   │
│   └── python/                  # Python 视频处理
│       ├── requirements.txt
│       ├── main.py              # 主入口
│       ├── video_analyzer.py    # 视频分析器
│       ├── thumbnail_generator.py # 封面生成器
│       └── transcoder.py        # 转码执行器
```

## 快速开始

### 环境要求

- Go 1.21+
- Python 3.9+
- Node.js 18+
- FFmpeg (包含 ffprobe)

### 安装步骤

#### 1. 安装 FFmpeg

**Windows:**
```powershell
# 使用 winget 安装
winget install ffmpeg

# 或使用 chocolatey
choco install ffmpeg
```

**验证安装:**
```powershell
ffmpeg -version
ffprobe -version
```

#### 2. 启动 Go 后端

```powershell
cd backend/go

# 下载依赖
go mod download

# 运行服务
go run main.go
```

服务将在 `http://localhost:8080` 启动

#### 3. 安装 Python 依赖

```powershell
cd backend/python

# 创建虚拟环境 (推荐)
python -m venv venv
.\venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

#### 4. 启动 React 前端

```powershell
cd frontend

# 安装依赖
npm install

# 开发模式运行
npm run dev
```

前端将在 `http://localhost:3000` 启动

### 生产部署

#### 构建前端

```powershell
cd frontend
npm run build
```

构建产物将输出到 `backend/go/static` 目录，Go 服务会自动提供这些静态文件。

#### 启动完整服务

```powershell
cd backend/go
go run main.go
```

访问 `http://localhost:8080` 即可使用完整功能。

## 转码模板

系统预置了三种常用转码模板：

| 模板名称 | 分辨率 | 码率 | 帧率 | 用途 |
|---------|--------|------|------|------|
| 1080p 高质量 | 1920×1080 | 8000 kbps | 30 FPS | 专业场景、高画质需求 |
| 720p 标准 | 1280×720 | 4000 kbps | 30 FPS | 通用场景、平衡质量体积 |
| 480p 低码率 | 854×480 | 2000 kbps | 25 FPS | 网络传输、节省带宽 |

### 模板参数说明

```go
type VideoSettings struct {
    Codec       string  // 视频编码: libx264, libx265, vp9
    Width       int     // 宽度
    Height      int     // 高度
    Bitrate     int     // 目标码率 (kbps)
    CRF         int     // 恒定质量因子 (0-51, 越小质量越好)
    FPS         float64 // 帧率
    Preset      string  // 预设: ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow
    Profile     string  // H.264 级别: baseline, main, high, high10, high422, high444
    Level       string  // H.264 层级: 3.0, 3.1, 4.0, 4.1, 5.0, 5.1
    PixelFormat string  // 像素格式: yuv420p, yuv422p, yuv444p
}

type AudioSettings struct {
    Codec     string // 音频编码: aac, mp3, opus
    Bitrate   int    // 码率 (kbps)
    Channels  int    // 声道数
    SampleRate int   // 采样率
}

type OutputSettings struct {
    Format            string // 输出格式: mp4, mkv, webm, hls
    Container         string // 容器格式
    SegmentTime       int    // HLS 分段时长 (秒)
    GenerateThumbnail bool   // 是否生成缩略图
    GenerateHLS       bool   // 是否生成 HLS 流媒体
}
```

## API 接口

### 基础接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/v1/health | 健康检查 |

### 资源管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/v1/resources | 获取资源列表 |
| GET | /api/v1/resources/:id | 获取资源详情 |
| DELETE | /api/v1/resources/:id | 删除资源 |

### 任务管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/v1/tasks | 获取任务列表 |
| GET | /api/v1/tasks/:id | 获取任务详情 |
| POST | /api/v1/tasks/:id/retry | 重试失败任务 |
| POST | /api/v1/tasks/:id/cancel | 取消任务 |
| GET | /api/v1/queue/stats | 获取队列统计 |

### 模板管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/v1/templates | 获取模板列表 |
| GET | /api/v1/templates/:id | 获取模板详情 |
| POST | /api/v1/templates | 创建自定义模板 |

### 日志管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/v1/logs | 获取日志列表 |

### 文件上传

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/upload | 上传视频文件 |

**请求参数 (multipart/form-data):**
- `files`: 视频文件 (可多选)
- `template_id`: 转码模板 ID (可选，使用默认模板)
- `tags`: 标签列表，逗号分隔 (可选)

## 配置说明

Go 服务配置文件 `config.json` (首次运行自动生成):

```json
{
  "server": {
    "port": "8080",
    "static_dir": "./static",
    "max_upload_mb": 2048
  },
  "storage": {
    "upload_dir": "./storage/uploads",
    "output_dir": "./storage/outputs",
    "thumbnail_dir": "./storage/thumbnails",
    "database_dir": "./storage/db"
  },
  "queue": {
    "max_workers": 2,
    "retry_limit": 3,
    "retry_delay_seconds": 30,
    "poll_interval_seconds": 5
  },
  "transcoder": {
    "python_script_path": "../python/main.py",
    "python_env": "python",
    "temp_dir": "./temp"
  },
  "logging": {
    "level": "info",
    "output_dir": "./logs",
    "max_size_mb": 100,
    "max_backups": 10,
    "max_age_days": 30
  }
}
```

## 注意事项

1. **FFmpeg 路径**: 确保 `ffmpeg` 和 `ffprobe` 命令可在系统 PATH 中访问
2. **文件权限**: 确保存储目录有读写权限
3. **资源限制**: 根据服务器配置调整 `max_workers` 参数
4. **Python 环境**: 如果使用虚拟环境，需要在配置中指定正确的 `python_env` 路径

## 开发建议

1. 使用 `npm run dev` 进行前端开发，支持热更新
2. Go 服务使用 `go run main.go` 运行，修改代码后需要重启
3. 生产环境建议使用系统服务管理器 (如 systemd) 管理进程
4. 大文件上传建议使用分片上传，当前实现支持 2GB 以内单文件
