import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';

export async function ensureDirectories(): Promise<void> {
  const dirs = [
    config.paths.temp,
    config.paths.uploads,
    config.paths.chunks,
    config.paths.results,
    config.paths.logs,
  ];
  for (const dir of dirs) {
    await fs.ensureDir(dir);
  }
}

export function generateId(): string {
  return uuidv4();
}

export function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export function getMimeType(filename: string): string {
  const ext = getFileExtension(filename);
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

export function validateFile(filename: string, size: number): { valid: boolean; reason?: string } {
  const ext = getFileExtension(filename);
  if (!config.upload.allowedExtensions.includes(ext)) {
    return { valid: false, reason: `不支持的文件格式: ${ext}` };
  }
  if (size > config.upload.maxFileSize) {
    return { valid: false, reason: `文件大小超过限制: ${(size / 1024 / 1024).toFixed(2)}MB` };
  }
  return { valid: true };
}

export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return stats.size;
}

export async function moveFile(src: string, dest: string): Promise<void> {
  await fs.move(src, dest, { overwrite: true });
}

export async function deleteFile(filePath: string): Promise<void> {
  if (await fs.pathExists(filePath)) {
    await fs.remove(filePath);
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function parsePageRanges(rangeStr: string, totalPages: number): number[] {
  const pages: Set<number> = new Set();
  const parts = rangeStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end)) continue;

      const actualStart = Math.max(1, Math.min(start, end));
      const actualEnd = Math.min(totalPages, Math.max(start, end));

      for (let i = actualStart; i <= actualEnd; i++) {
        pages.add(i);
      }
    } else {
      const page = parseInt(trimmed, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        pages.add(page);
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

export async function writeTaskLog(taskId: string, message: string): Promise<void> {
  const logPath = path.join(config.paths.logs, `${taskId}.log`);
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  await fs.appendFile(logPath, logEntry, 'utf-8');
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[<>:"/\\|?*]/g, '_');
}
