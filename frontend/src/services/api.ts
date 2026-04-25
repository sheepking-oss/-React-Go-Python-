import axios from 'axios';
import type { 
  Resource, 
  Task, 
  TranscodeTemplate, 
  LogEntry, 
  QueueStats,
  ApiResponse,
  PaginatedResponse
} from '@/types';

const API_BASE = '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const healthApi = {
  check: () => api.get<ApiResponse>('/health'),
};

export const uploadApi = {
  uploadFiles: (
    files: File[],
    templateId?: string,
    tags?: string[],
    onProgress?: (progress: number) => void
  ) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    if (templateId) {
      formData.append('template_id', templateId);
    }
    if (tags && tags.length > 0) {
      formData.append('tags', tags.join(','));
    }

    return api.post<ApiResponse<{ resources: Resource[]; tasks: Task[] }>>(
      '/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(progress);
          }
        },
      }
    );
  },
};

export const resourceApi = {
  list: (offset = 0, limit = 50) =>
    api.get<ApiResponse<PaginatedResponse<Resource>>>(
      `/resources?offset=${offset}&limit=${limit}`
    ),
  
  get: (id: string) =>
    api.get<ApiResponse<Resource>>(`/resources/${id}`),
  
  delete: (id: string) =>
    api.delete<ApiResponse>(`/resources/${id}`),
};

export const taskApi = {
  list: (status?: string, offset = 0, limit = 50) => {
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString(),
    });
    if (status) {
      params.append('status', status);
    }
    return api.get<ApiResponse<PaginatedResponse<Task>>>(
      `/tasks?${params.toString()}`
    );
  },
  
  get: (id: string) =>
    api.get<ApiResponse<Task>>(`/tasks/${id}`),
  
  retry: (id: string) =>
    api.post<ApiResponse<Task>>(`/tasks/${id}/retry`),
  
  cancel: (id: string) =>
    api.post<ApiResponse<Task>>(`/tasks/${id}/cancel`),
};

export const queueApi = {
  getStats: () =>
    api.get<ApiResponse<QueueStats>>('/queue/stats'),
};

export const templateApi = {
  list: () =>
    api.get<ApiResponse<TranscodeTemplate[]>>('/templates'),
  
  get: (id: string) =>
    api.get<ApiResponse<TranscodeTemplate>>(`/templates/${id}`),
  
  create: (template: Partial<TranscodeTemplate>) =>
    api.post<ApiResponse<TranscodeTemplate>>('/templates', template),
};

export const logApi = {
  list: (taskId?: string, offset = 0, limit = 100) => {
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString(),
    });
    if (taskId) {
      params.append('task_id', taskId);
    }
    return api.get<ApiResponse<PaginatedResponse<LogEntry>>>(
      `/logs?${params.toString()}`
    );
  },
};

export default api;
