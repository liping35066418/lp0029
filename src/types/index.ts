export type TaskStatus = 'pending' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type TaskType =
  | 'pdf-to-word'
  | 'word-to-pdf'
  | 'pdf-to-image'
  | 'image-to-pdf'
  | 'pdf-to-txt'
  | 'txt-to-pdf'
  | 'pdf-split'
  | 'pdf-merge'
  | 'pdf-extract'
  | 'pdf-delete'
  | 'pdf-watermark-text'
  | 'pdf-watermark-image'
  | 'pdf-decrypt'
  | 'pdf-repair';

export interface FileInfo {
  id: string;
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
}

export interface UploadingFile {
  fileId: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'paused' | 'completed' | 'error';
  error?: string;
}

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  progress: number;
  error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  files: { id: string; name: string; size: number }[];
  resultFiles?: { id: string; name: string; size: number }[];
}

export interface WatermarkOptions {
  text?: string;
  imageFileId?: string;
  opacity: number;
  position: 'center' | 'tile' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size: number;
  angle: number;
  density: number;
  color: string;
}

export interface PageRangeOptions {
  ranges: string;
}

export interface SplitOptions {
  mode: 'single' | 'range' | 'every';
  ranges?: string;
  every?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  'pdf-to-word': 'PDF转Word',
  'word-to-pdf': 'Word转PDF',
  'pdf-to-image': 'PDF转图片',
  'image-to-pdf': '图片转PDF',
  'pdf-to-txt': 'PDF转TXT',
  'txt-to-pdf': 'TXT转PDF',
  'pdf-split': 'PDF拆分',
  'pdf-merge': 'PDF合并',
  'pdf-extract': '页面提取',
  'pdf-delete': '删除页面',
  'pdf-watermark-text': '文字水印',
  'pdf-watermark-image': '图片水印',
  'pdf-decrypt': '解密PDF',
  'pdf-repair': '修复PDF',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '等待中',
  processing: '处理中',
  paused: '已暂停',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-yellow-500',
  processing: 'bg-blue-500',
  paused: 'bg-orange-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  cancelled: 'bg-gray-500',
};
