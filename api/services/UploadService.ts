import fs from 'fs-extra';
import path from 'path';
import { config } from '../config.js';
import type { FileInfo } from '../types.js';
import { generateId, validateFile, getMimeType, sanitizeFilename } from '../utils/fileUtils.js';

interface ChunkUploadState {
  fileId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: number;
  chunkDir: string;
  createdAt: number;
}

const chunkStates = new Map<string, ChunkUploadState>();

export async function initChunkUpload(
  fileName: string,
  fileSize: number,
  totalChunks: number
): Promise<{ fileId: string; chunkSize: number }> {
  const validation = validateFile(fileName, fileSize);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const fileId = generateId();
  const chunkDir = path.join(config.paths.chunks, fileId);
  await fs.ensureDir(chunkDir);

  chunkStates.set(fileId, {
    fileId,
    fileName,
    fileSize,
    totalChunks,
    uploadedChunks: 0,
    chunkDir,
    createdAt: Date.now(),
  });

  return {
    fileId,
    chunkSize: config.upload.maxChunkSize,
  };
}

export async function uploadChunk(
  fileId: string,
  chunkIndex: number,
  chunkBuffer: Buffer
): Promise<{ uploaded: boolean; uploadedChunks: number; totalChunks: number }> {
  const state = chunkStates.get(fileId);
  if (!state) {
    throw new Error('上传会话不存在或已过期');
  }

  const chunkPath = path.join(state.chunkDir, `${chunkIndex}.chunk`);
  await fs.writeFile(chunkPath, chunkBuffer);

  state.uploadedChunks++;

  return {
    uploaded: state.uploadedChunks >= state.totalChunks,
    uploadedChunks: state.uploadedChunks,
    totalChunks: state.totalChunks,
  };
}

export async function completeChunkUpload(fileId: string): Promise<FileInfo> {
  const state = chunkStates.get(fileId);
  if (!state) {
    throw new Error('上传会话不存在或已过期');
  }

  if (state.uploadedChunks < state.totalChunks) {
    throw new Error('分片上传未完成');
  }

  const fileIdFinal = generateId();
  const fileExt = path.extname(state.fileName).toLowerCase();
  const finalPath = path.join(config.paths.uploads, `${fileIdFinal}${fileExt}`);

  const writeStream = fs.createWriteStream(finalPath);

  for (let i = 0; i < state.totalChunks; i++) {
    const chunkPath = path.join(state.chunkDir, `${i}.chunk`);
    const chunkBuffer = await fs.readFile(chunkPath);
    writeStream.write(chunkBuffer);
  }

  await new Promise<void>((resolve, reject) => {
    writeStream.end((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  await fs.remove(state.chunkDir);
  chunkStates.delete(fileId);

  const finalSize = (await fs.stat(finalPath)).size;

  const fileInfo: FileInfo = {
    id: fileIdFinal,
    name: sanitizeFilename(state.fileName),
    originalName: state.fileName,
    path: finalPath,
    size: finalSize,
    mimeType: getMimeType(state.fileName),
    uploadedAt: Date.now(),
  };

  return fileInfo;
}

export async function simpleUpload(
  fileName: string,
  fileBuffer: Buffer
): Promise<FileInfo> {
  const validation = validateFile(fileName, fileBuffer.length);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const fileId = generateId();
  const fileExt = path.extname(fileName).toLowerCase();
  const finalPath = path.join(config.paths.uploads, `${fileId}${fileExt}`);

  await fs.writeFile(finalPath, fileBuffer);

  const fileInfo: FileInfo = {
    id: fileId,
    name: sanitizeFilename(fileName),
    originalName: fileName,
    path: finalPath,
    size: fileBuffer.length,
    mimeType: getMimeType(fileName),
    uploadedAt: Date.now(),
  };

  return fileInfo;
}

export function getUploadState(fileId: string): ChunkUploadState | undefined {
  return chunkStates.get(fileId);
}

export function cleanupExpiredUploads(): void {
  const now = Date.now();
  const expireTime = 24 * 60 * 60 * 1000;

  for (const [fileId, state] of chunkStates.entries()) {
    if (now - state.createdAt > expireTime) {
      fs.remove(state.chunkDir).catch(() => {});
      chunkStates.delete(fileId);
    }
  }
}

export async function getFileInfo(fileId: string): Promise<FileInfo | null> {
  const uploadsDir = config.paths.uploads;
  const files = await fs.readdir(uploadsDir);

  for (const file of files) {
    if (file.startsWith(fileId)) {
      const filePath = path.join(uploadsDir, file);
      const stats = await fs.stat(filePath);

      return {
        id: fileId,
        name: file,
        originalName: file,
        path: filePath,
        size: stats.size,
        mimeType: getMimeType(file),
        uploadedAt: stats.mtimeMs,
      };
    }
  }

  return null;
}
