import fs from 'fs-extra';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import type { Task, FileInfo } from '../types.js';
import { config } from '../config.js';
import { generateId, parsePageRanges, sanitizeFilename } from '../utils/fileUtils.js';

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

export async function splitPdf(task: Task, taskQueue: TaskQueueType): Promise<FileInfo[]> {
  const file = task.files[0];
  if (!file) throw new Error('缺少输入文件');

  const options = task.options as unknown as { mode: 'single' | 'range' | 'every'; ranges?: string; every?: number };
  const resultFiles: FileInfo[] = [];

  const pdfBytes = await fs.readFile(file.path);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  if (options.mode === 'single') {
    for (let i = 0; i < totalPages; i++) {
      checkCancelledOrPaused(task.id, taskQueue);

      const newPdf = await PDFDocument.create();
      const [page] = await newPdf.copyPages(pdfDoc, [i]);
      newPdf.addPage(page);

      const newPdfBytes = await newPdf.save();
      const fileName = `${sanitizeFilename(file.originalName.replace('.pdf', ''))}_第${i + 1}页.pdf`;
      const resultPath = path.join(config.paths.results, `${generateId()}.pdf`);
      await fs.writeFile(resultPath, newPdfBytes);

      resultFiles.push({
        id: generateId(),
        name: fileName,
        originalName: fileName,
        path: resultPath,
        size: newPdfBytes.length,
        mimeType: 'application/pdf',
        uploadedAt: Date.now(),
      });

      taskQueue.updateProgress(task.id, ((i + 1) / totalPages) * 100);
    }
  } else if (options.mode === 'range' && options.ranges) {
    const pages = parsePageRanges(options.ranges, totalPages);
    const totalSplits = pages.length;
    let processed = 0;

    for (const pageNum of pages) {
      checkCancelledOrPaused(task.id, taskQueue);

      const newPdf = await PDFDocument.create();
      const [page] = await newPdf.copyPages(pdfDoc, [pageNum - 1]);
      newPdf.addPage(page);

      const newPdfBytes = await newPdf.save();
      const fileName = `${sanitizeFilename(file.originalName.replace('.pdf', ''))}_第${pageNum}页.pdf`;
      const resultPath = path.join(config.paths.results, `${generateId()}.pdf`);
      await fs.writeFile(resultPath, newPdfBytes);

      resultFiles.push({
        id: generateId(),
        name: fileName,
        originalName: fileName,
        path: resultPath,
        size: newPdfBytes.length,
        mimeType: 'application/pdf',
        uploadedAt: Date.now(),
      });

      processed++;
      taskQueue.updateProgress(task.id, (processed / totalSplits) * 100);
    }
  } else if (options.mode === 'every' && options.every) {
    const everyN = options.every;
    let currentPage = 0;
    let partNum = 1;

    while (currentPage < totalPages) {
      checkCancelledOrPaused(task.id, taskQueue);

      const endPage = Math.min(currentPage + everyN, totalPages);
      const pageIndices = [];
      for (let i = currentPage; i < endPage; i++) {
        pageIndices.push(i);
      }

      const newPdf = await PDFDocument.create();
      const pages = await newPdf.copyPages(pdfDoc, pageIndices);
      for (const page of pages) {
        newPdf.addPage(page);
      }

      const newPdfBytes = await newPdf.save();
      const fileName = `${sanitizeFilename(file.originalName.replace('.pdf', ''))}_part${partNum}.pdf`;
      const resultPath = path.join(config.paths.results, `${generateId()}.pdf`);
      await fs.writeFile(resultPath, newPdfBytes);

      resultFiles.push({
        id: generateId(),
        name: fileName,
        originalName: fileName,
        path: resultPath,
        size: newPdfBytes.length,
        mimeType: 'application/pdf',
        uploadedAt: Date.now(),
      });

      currentPage = endPage;
      partNum++;
      taskQueue.updateProgress(task.id, (currentPage / totalPages) * 100);
    }
  }

  return resultFiles;
}

export async function mergePdfs(task: Task, taskQueue: TaskQueueType): Promise<FileInfo[]> {
  const files = task.files;
  if (files.length < 2) throw new Error('至少需要2个文件才能合并');

  const options = task.options as { order?: string[] };
  const order = options.order || files.map((f) => f.id);

  const orderedFiles = order
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is FileInfo => f !== undefined);

  const mergedPdf = await PDFDocument.create();
  let processed = 0;

  for (const file of orderedFiles) {
    checkCancelledOrPaused(task.id, taskQueue);

    const pdfBytes = await fs.readFile(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    for (const page of pages) {
      mergedPdf.addPage(page);
    }

    processed++;
    taskQueue.updateProgress(task.id, (processed / orderedFiles.length) * 100);
  }

  const mergedBytes = await mergedPdf.save();
  const fileName = `合并文档_${Date.now()}.pdf`;
  const resultPath = path.join(config.paths.results, `${generateId()}.pdf`);
  await fs.writeFile(resultPath, mergedBytes);

  return [
    {
      id: generateId(),
      name: fileName,
      originalName: fileName,
      path: resultPath,
      size: mergedBytes.length,
      mimeType: 'application/pdf',
      uploadedAt: Date.now(),
    },
  ];
}

export async function extractPages(task: Task, taskQueue: TaskQueueType): Promise<FileInfo[]> {
  const file = task.files[0];
  if (!file) throw new Error('缺少输入文件');

  const options = task.options as { ranges: string };
  if (!options.ranges) throw new Error('请指定提取的页码范围');

  const pdfBytes = await fs.readFile(file.path);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  const pagesToExtract = parsePageRanges(options.ranges, totalPages);

  if (pagesToExtract.length === 0) {
    throw new Error('没有匹配的页码');
  }

  checkCancelledOrPaused(task.id, taskQueue);

  const newPdf = await PDFDocument.create();
  const pageIndices = pagesToExtract.map((p) => p - 1);
  const pages = await newPdf.copyPages(pdfDoc, pageIndices);

  for (let i = 0; i < pages.length; i++) {
    newPdf.addPage(pages[i]);
    taskQueue.updateProgress(task.id, ((i + 1) / pages.length) * 100);
  }

  const newPdfBytes = await newPdf.save();
  const fileName = `${sanitizeFilename(file.originalName.replace('.pdf', ''))}_提取.pdf`;
  const resultPath = path.join(config.paths.results, `${generateId()}.pdf`);
  await fs.writeFile(resultPath, newPdfBytes);

  return [
    {
      id: generateId(),
      name: fileName,
      originalName: fileName,
      path: resultPath,
      size: newPdfBytes.length,
      mimeType: 'application/pdf',
      uploadedAt: Date.now(),
    },
  ];
}

export async function deletePages(task: Task, taskQueue: TaskQueueType): Promise<FileInfo[]> {
  const file = task.files[0];
  if (!file) throw new Error('缺少输入文件');

  const options = task.options as { ranges: string };
  if (!options.ranges) throw new Error('请指定删除的页码范围');

  const pdfBytes = await fs.readFile(file.path);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  const pagesToDelete = parsePageRanges(options.ranges, totalPages);

  if (pagesToDelete.length === 0) {
    throw new Error('没有匹配的页码');
  }

  if (pagesToDelete.length >= totalPages) {
    throw new Error('不能删除所有页面');
  }

  checkCancelledOrPaused(task.id, taskQueue);

  const deleteSet = new Set(pagesToDelete.map((p) => p - 1));
  const keepIndices: number[] = [];
  for (let i = 0; i < totalPages; i++) {
    if (!deleteSet.has(i)) {
      keepIndices.push(i);
    }
  }

  const newPdf = await PDFDocument.create();
  const pages = await newPdf.copyPages(pdfDoc, keepIndices);

  for (let i = 0; i < pages.length; i++) {
    newPdf.addPage(pages[i]);
    taskQueue.updateProgress(task.id, ((i + 1) / pages.length) * 100);
  }

  const newPdfBytes = await newPdf.save();
  const fileName = `${sanitizeFilename(file.originalName.replace('.pdf', ''))}_删除后.pdf`;
  const resultPath = path.join(config.paths.results, `${generateId()}.pdf`);
  await fs.writeFile(resultPath, newPdfBytes);

  return [
    {
      id: generateId(),
      name: fileName,
      originalName: fileName,
      path: resultPath,
      size: newPdfBytes.length,
      mimeType: 'application/pdf',
      uploadedAt: Date.now(),
    },
  ];
}
