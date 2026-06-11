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
  path: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
}

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  progress: number;
  files: FileInfo[];
  options: Record<string, unknown>;
  resultFiles?: FileInfo[];
  error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  pausedAt?: number;
}

export interface UploadChunkParams {
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  fileSize: number;
}

export interface WatermarkOptions {
  text?: string;
  imagePath?: string;
  opacity: number;
  position: 'center' | 'tile' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size: number;
  angle: number;
  density: number;
  color?: string;
}

export interface PageRangeOptions {
  ranges: string;
}

export interface MergeOptions {
  order: string[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
