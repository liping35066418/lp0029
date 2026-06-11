import type {
  FileInfo,
  Task,
  TaskType,
  ApiResponse,
  WatermarkOptions,
  SplitOptions,
  PageRangeOptions,
} from '../types';

const API_BASE = '/api';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = (await response.json()) as ApiResponse<T>;

  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }

  return data.data as T;
}

export const uploadApi = {
  async initUpload(
    fileName: string,
    fileSize: number,
    totalChunks: number
  ): Promise<{ fileId: string; chunkSize: number }> {
    return request<{ fileId: string; chunkSize: number }>('/upload/init', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileSize, totalChunks }),
    });
  },

  async uploadChunk(
    fileId: string,
    chunkIndex: number,
    chunk: Blob
  ): Promise<{ uploaded: boolean; uploadedChunks: number; totalChunks: number }> {
    const formData = new FormData();
    formData.append('fileId', fileId);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('chunk', chunk);

    const response = await fetch(`${API_BASE}/upload/chunk`, {
      method: 'POST',
      body: formData,
    });

    const data = (await response.json()) as ApiResponse<{
      uploaded: boolean;
      uploadedChunks: number;
      totalChunks: number;
    }>;

    if (!data.success) {
      throw new Error(data.error || '分片上传失败');
    }

    return data.data!;
  },

  async completeUpload(fileId: string): Promise<FileInfo> {
    return request<FileInfo>('/upload/complete', {
      method: 'POST',
      body: JSON.stringify({ fileId }),
    });
  },

  async simpleUpload(file: File): Promise<FileInfo> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/upload/simple`, {
      method: 'POST',
      body: formData,
    });

    const data = (await response.json()) as ApiResponse<FileInfo>;

    if (!data.success) {
      throw new Error(data.error || '上传失败');
    }

    return data.data!;
  },

  async getFileInfo(fileId: string): Promise<FileInfo> {
    return request<FileInfo>(`/upload/${fileId}`);
  },
};

export const taskApi = {
  async createTask(
    type: TaskType,
    fileIds: string[],
    options?: Record<string, unknown>
  ): Promise<{ taskId: string; status: string }> {
    return request<{ taskId: string; status: string }>('/tasks/create', {
      method: 'POST',
      body: JSON.stringify({ type, fileIds, options }),
    });
  },

  async getTask(taskId: string): Promise<Task> {
    return request<Task>(`/tasks/${taskId}`);
  },

  async getAllTasks(): Promise<Task[]> {
    return request<Task[]>('/tasks');
  },

  async pauseTask(taskId: string): Promise<void> {
    await request<void>(`/tasks/${taskId}/pause`, { method: 'POST' });
  },

  async resumeTask(taskId: string): Promise<void> {
    await request<void>(`/tasks/${taskId}/resume`, { method: 'POST' });
  },

  async cancelTask(taskId: string): Promise<void> {
    await request<void>(`/tasks/${taskId}/cancel`, { method: 'POST' });
  },

  async retryTask(taskId: string): Promise<void> {
    await request<void>(`/tasks/${taskId}/retry`, { method: 'POST' });
  },
};

export const downloadApi = {
  getDownloadUrl(fileId: string, fileName?: string): string {
    let url = `${API_BASE}/download/file/${fileId}`;
    if (fileName) {
      url += `?name=${encodeURIComponent(fileName)}`;
    }
    return url;
  },

  getTaskDownloadUrl(taskId: string): string {
    return `${API_BASE}/download/task/${taskId}/download`;
  },

  async createTaskZip(taskId: string): Promise<{ fileId: string; name: string; size: number }> {
    return request<{ fileId: string; name: string; size: number }>(
      `/download/task/${taskId}/zip`,
      { method: 'POST' }
    );
  },
};

export async function uploadFileWithChunks(
  file: File,
  onProgress: (progress: number) => void
): Promise<FileInfo> {
  const chunkSize = 5 * 1024 * 1024;
  const totalChunks = Math.ceil(file.size / chunkSize);

  const { fileId } = await uploadApi.initUpload(file.name, file.size, totalChunks);

  let uploadedChunks = 0;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    const result = await uploadApi.uploadChunk(fileId, i, chunk);
    uploadedChunks = result.uploadedChunks;

    onProgress((uploadedChunks / totalChunks) * 100);
  }

  const fileInfo = await uploadApi.completeUpload(fileId);
  return fileInfo;
}
