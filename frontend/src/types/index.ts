export type TaskStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'retrying' | 'cancelled';

export type TaskPriority = 0 | 50 | 100;

export interface Resource {
  id: string;
  name: string;
  original_name: string;
  path: string;
  size: number;
  mime_type: string;
  file_type: string;
  tags: string[];
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  fps: number;
  thumbnail: string;
  metadata: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  resource_id: string;
  resource_name: string;
  template_id: string;
  template_name: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  progress_message: string;
  output_path: string;
  output_size: number;
  retry_count: number;
  max_retries: number;
  error_message: string;
  error_details: string;
  started_at?: string;
  completed_at?: string;
  queued_at?: string;
  duration_seconds: number;
  metadata: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface VideoSettings {
  codec: string;
  width: number;
  height: number;
  bitrate: number;
  crf: number;
  fps: number;
  preset: string;
  profile: string;
  level: string;
  pixel_format: string;
}

export interface AudioSettings {
  codec: string;
  bitrate: number;
  channels: number;
  sample_rate: number;
}

export interface OutputSettings {
  format: string;
  container: string;
  segment_time: number;
  generate_thumbnail: boolean;
  generate_hls: boolean;
}

export interface TranscodeTemplate {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  video: VideoSettings;
  audio: AudioSettings;
  output: OutputSettings;
  metadata: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface LogEntry {
  id: string;
  task_id: string;
  resource_id: string;
  level: string;
  message: string;
  details: Record<string, string>;
  created_at: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface QueueStats {
  max_workers: number;
  active_workers: number;
  running_tasks: number;
  queued: number;
  processing: number;
  failed: number;
  completed: number;
}
