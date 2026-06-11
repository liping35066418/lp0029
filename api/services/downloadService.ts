import fs from 'fs-extra';
import path from 'path';
import * as archiver from 'archiver';
const archiverFn = (archiver as unknown as { default: typeof archiver }).default || archiver;
import type { FileInfo } from '../types.js';
import { config } from '../config.js';
import { generateId } from '../utils/fileUtils.js';

export async function createZipPackage(
  files: FileInfo[],
  zipName?: string
): Promise<FileInfo> {
  const zipId = generateId();
  const zipFileName = zipName || `处理结果_${Date.now()}.zip`;
  const zipPath = path.join(config.paths.results, `${zipId}.zip`);

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = (archiverFn as unknown as (format: string, options: Record<string, unknown>) => archiver.Archiver)('zip', {
      zlib: { level: 9 },
    });

    output.on('close', () => {
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    const nameCounts = new Map<string, number>();

    for (const file of files) {
      let fileName = file.originalName || file.name;

      const count = nameCounts.get(fileName) || 0;
      if (count > 0) {
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        fileName = `${baseName}_${count + 1}${ext}`;
      }
      nameCounts.set(file.originalName || file.name, count + 1);

      archive.file(file.path, { name: fileName });
    }

    void archive.finalize();
  });

  const stats = await fs.stat(zipPath);

  return {
    id: zipId,
    name: zipFileName,
    originalName: zipFileName,
    path: zipPath,
    size: stats.size,
    mimeType: 'application/zip',
    uploadedAt: Date.now(),
  };
}

export function getResultFilePath(fileId: string): string | null {
  const resultsDir = config.paths.results;
  const files = fs.readdirSync(resultsDir);

  for (const file of files) {
    if (file.startsWith(fileId)) {
      return path.join(resultsDir, file);
    }
  }

  return null;
}

export async function getResultFileInfo(fileId: string): Promise<FileInfo | null> {
  const filePath = getResultFilePath(fileId);
  if (!filePath) return null;

  const stats = await fs.stat(filePath);
  const fileName = path.basename(filePath);

  return {
    id: fileId,
    name: fileName,
    originalName: fileName,
    path: filePath,
    size: stats.size,
    mimeType: getMimeTypeFromPath(filePath),
    uploadedAt: stats.mtimeMs,
  };
}

function getMimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
  };
  return mimeMap[ext] || 'application/octet-stream';
}
