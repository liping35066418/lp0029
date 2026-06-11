import fs from 'fs-extra';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import type { Task, FileInfo } from '../types.js';
import { config } from '../config.js';
import { generateId, sanitizeFilename } from '../utils/fileUtils.js';

type TaskQueueType = {
  updateProgress: (taskId: string, progress: number) => void;
  isCancelled: (taskId: string) => boolean;
  isPaused: (taskId: string) => boolean;
};

function checkCancelledOrPaused(taskId: string, taskQueue: TaskQueueType): void {
  if (taskQueue.isCancelled(taskId)) {
    throw new Error('任务已取消');
  }
  if (taskQueue.isPaused(taskId)) {
    throw new Error('任务已暂停');
  }
}

export async function decryptPdf(task: Task, taskQueue: TaskQueueType): Promise<FileInfo[]> {
  const resultFiles: FileInfo[] = [];
  const options = task.options as { password?: string };
  const password = options.password || '';

  const totalFiles = task.files.length;
  let processed = 0;

  for (const file of task.files) {
    checkCancelledOrPaused(task.id, taskQueue);

    try {
      const pdfBytes = await fs.readFile(file.path);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loadOptions: any = {};
      if (password) {
        loadOptions.password = password;
      }
      const pdfDoc = await PDFDocument.load(pdfBytes, loadOptions);

      const decryptedBytes = await pdfDoc.save();
      const fileName = `${sanitizeFilename(file.originalName.replace('.pdf', ''))}_解密.pdf`;
      const resultPath = path.join(config.paths.results, `${generateId()}.pdf`);
      await fs.writeFile(resultPath, decryptedBytes);

      resultFiles.push({
        id: generateId(),
        name: fileName,
        originalName: fileName,
        path: resultPath,
        size: decryptedBytes.length,
        mimeType: 'application/pdf',
        uploadedAt: Date.now(),
      });
    } catch (error) {
      if (password) {
        throw new Error(`文件 ${file.name} 解密失败，请检查密码是否正确`);
      } else {
        throw new Error(`文件 ${file.name} 处理失败，可能已加密或文件已损坏`);
      }
    }

    processed++;
    taskQueue.updateProgress(task.id, (processed / totalFiles) * 100);
  }

  return resultFiles;
}

export async function repairPdf(task: Task, taskQueue: TaskQueueType): Promise<FileInfo[]> {
  const resultFiles: FileInfo[] = [];

  const totalFiles = task.files.length;
  let processed = 0;

  for (const file of task.files) {
    checkCancelledOrPaused(task.id, taskQueue);

    try {
      const pdfBytes = await fs.readFile(file.path);

      let pdfDoc;
      try {
        pdfDoc = await PDFDocument.load(pdfBytes, {
          ignoreEncryption: true,
        });
      } catch {
        try {
          const cleanBytes = attemptPdfRepair(pdfBytes);
          pdfDoc = await PDFDocument.load(cleanBytes);
        } catch (innerError) {
          throw new Error(`文件 ${file.name} 无法修复: ${innerError instanceof Error ? innerError.message : String(innerError)}`);
        }
      }

      const repairedBytes = await pdfDoc.save();
      const fileName = `${sanitizeFilename(file.originalName.replace('.pdf', ''))}_修复.pdf`;
      const resultPath = path.join(config.paths.results, `${generateId()}.pdf`);
      await fs.writeFile(resultPath, repairedBytes);

      resultFiles.push({
        id: generateId(),
        name: fileName,
        originalName: fileName,
        path: resultPath,
        size: repairedBytes.length,
        mimeType: 'application/pdf',
        uploadedAt: Date.now(),
      });
    } catch (error) {
      throw new Error(`文件 ${file.name} 修复失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    processed++;
    taskQueue.updateProgress(task.id, (processed / totalFiles) * 100);
  }

  return resultFiles;
}

function attemptPdfRepair(pdfBytes: Buffer): Buffer {
  const content = pdfBytes.toString('binary');

  let startIndex = content.indexOf('%PDF-');
  if (startIndex === -1) {
    startIndex = 0;
  }

  let endIndex = content.lastIndexOf('%%EOF');
  if (endIndex === -1) {
    endIndex = content.length;
  } else {
    endIndex += 6;
  }

  const repaired = content.slice(startIndex, endIndex);

  if (!repaired.includes('xref')) {
    throw new Error('PDF文件缺少xref表，无法修复');
  }

  return Buffer.from(repaired, 'binary');
}
