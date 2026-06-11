import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { ROOT_DIR } from './paths.js';

export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  pdf: ['application/pdf'],
  word: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  image: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp'],
  txt: ['text/plain'],
};

export const ALLOWED_EXTENSIONS = {
  pdf: ['.pdf'],
  word: ['.doc', '.docx'],
  image: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'],
  txt: ['.txt'],
};

export const MAX_FILE_SIZE = 100 * 1024 * 1024;
export const CHUNK_SIZE = 2 * 1024 * 1024;

export function generateId(): string {
  return uuidv4().replace(/-/g, '');
}

export function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export function getMimeCategory(mimeType: string): string | null {
  for (const [cat, types] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (types.includes(mimeType)) return cat;
  }
  return null;
}

export function validateFile(filename: string, mimeType: string, size: number): { valid: boolean; error?: string } {
  const ext = getFileExtension(filename);
  const allowedExts = Object.values(ALLOWED_EXTENSIONS).flat();
  if (!allowedExts.includes(ext)) {
    return { valid: false, error: `不支持的文件格式: ${ext}` };
  }
  const allowedMimes = Object.values(ALLOWED_MIME_TYPES).flat();
  if (!allowedMimes.includes(mimeType)) {
    return { valid: false, error: `不支持的MIME类型: ${mimeType}` };
  }
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: `文件大小超过限制: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB` };
  }
  return { valid: true };
}

export function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function safeUnlink(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function parsePageRanges(input: string): number[] {
  const pages = new Set<number>();
  const parts = input.split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end) || start > end || start < 1) continue;
      for (let i = start; i <= end; i++) pages.add(i);
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p > 0) pages.add(p);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export function pathSafe(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}
