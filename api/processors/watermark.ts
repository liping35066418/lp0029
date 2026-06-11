import fs from 'fs-extra';
import path from 'path';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import type { Task, FileInfo, WatermarkOptions } from '../types.js';
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

function parseColor(colorStr: string | undefined): { r: number; g: number; b: number } {
  if (!colorStr) return { r: 0.5, g: 0.5, b: 0.5 };

  if (colorStr.startsWith('#')) {
    const hex = colorStr.slice(1);
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
      };
    }
  }

  return { r: 0.5, g: 0.5, b: 0.5 };
}

export async function addTextWatermark(task: Task, taskQueue: TaskQueueType): Promise<FileInfo[]> {
  const resultFiles: FileInfo[] = [];
  const opts = task.options as unknown as WatermarkOptions;
  const text = opts.text || '水印';
  const opacity = opts.opacity ?? config.watermark.defaultOpacity;
  const size = opts.size ?? config.watermark.defaultSize;
  const angle = opts.angle ?? -30;
  const position = opts.position || 'tile';
  const density = opts.density ?? 1;
  const color = parseColor(opts.color);

  const totalFiles = task.files.length;
  let fileProcessed = 0;

  for (const file of task.files) {
    checkCancelledOrPaused(task.id, taskQueue);

    const pdfBytes = await fs.readFile(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    for (let i = 0; i < totalPages; i++) {
      checkCancelledOrPaused(task.id, taskQueue);

      const page = pages[i];
      const { width, height } = page.getSize();

      if (position === 'tile') {
        const xGap = (size * text.length) / density + 50;
        const yGap = (size * 3) / density;

        for (let y = -height / 2; y < height * 1.5; y += yGap) {
          for (let x = -width / 2; x < width * 1.5; x += xGap) {
            page.drawText(text, {
              x,
              y,
              size,
              font: helveticaFont,
              color: rgb(color.r, color.g, color.b),
              opacity,
              rotate: degrees(angle),
            });
          }
        }
      } else {
        let x = width / 2;
        let y = height / 2;

        const textWidth = helveticaFont.widthOfTextAtSize(text, size);
        const textHeight = size;

        switch (position) {
          case 'center':
            x = (width - textWidth) / 2;
            y = (height - textHeight) / 2;
            break;
          case 'top-left':
            x = 30;
            y = height - size - 30;
            break;
          case 'top-right':
            x = width - textWidth - 30;
            y = height - size - 30;
            break;
          case 'bottom-left':
            x = 30;
            y = 30;
            break;
          case 'bottom-right':
            x = width - textWidth - 30;
            y = 30;
            break;
        }

        page.drawText(text, {
          x,
          y,
          size,
          font: helveticaFont,
          color: rgb(color.r, color.g, color.b),
          opacity,
          rotate: degrees(position === 'center' ? angle : 0),
        });
      }

      const overallProgress =
        ((fileProcessed + (i + 1) / totalPages) / totalFiles) * 100;
      taskQueue.updateProgress(task.id, overallProgress);
    }

    const watermarkedBytes = await pdfDoc.save();
    const fileName = `${sanitizeFilename(file.originalName.replace('.pdf', ''))}_水印.pdf`;
    const resultPath = path.join(config.paths.results, `${generateId()}.pdf`);
    await fs.writeFile(resultPath, watermarkedBytes);

    resultFiles.push({
      id: generateId(),
      name: fileName,
      originalName: fileName,
      path: resultPath,
      size: watermarkedBytes.length,
      mimeType: 'application/pdf',
      uploadedAt: Date.now(),
    });

    fileProcessed++;
  }

  return resultFiles;
}

export async function addImageWatermark(task: Task, taskQueue: TaskQueueType): Promise<FileInfo[]> {
  const resultFiles: FileInfo[] = [];
  const opts = task.options as unknown as WatermarkOptions & { imageFileId?: string };
  const opacity = opts.opacity ?? config.watermark.defaultOpacity;
  const position = opts.position || 'tile';
  const size = opts.size ?? 100;
  const density = opts.density ?? 1;
  const angle = opts.angle ?? -30;

  const imageFile = task.files.find((f) => f.id === opts.imageFileId);
  const pdfFiles = task.files.filter((f) => f.id !== opts.imageFileId);

  if (!imageFile) {
    throw new Error('请提供水印图片');
  }

  const imageBytes = await fs.readFile(imageFile.path);
  const imageExt = path.extname(imageFile.name).toLowerCase();

  const totalFiles = pdfFiles.length;
  let fileProcessed = 0;

  for (const file of pdfFiles) {
    checkCancelledOrPaused(task.id, taskQueue);

    const pdfBytes = await fs.readFile(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    let watermarkImage;
    if (imageExt === '.png') {
      watermarkImage = await pdfDoc.embedPng(imageBytes);
    } else {
      watermarkImage = await pdfDoc.embedJpg(imageBytes);
    }

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    const imgRatio = watermarkImage.width / watermarkImage.height;
    const imgWidth = size;
    const imgHeight = size / imgRatio;

    for (let i = 0; i < totalPages; i++) {
      checkCancelledOrPaused(task.id, taskQueue);

      const page = pages[i];
      const { width, height } = page.getSize();

      if (position === 'tile') {
        const xGap = (imgWidth + 50) / density;
        const yGap = (imgHeight + 50) / density;

        for (let y = -height / 2; y < height * 1.5; y += yGap) {
          for (let x = -width / 2; x < width * 1.5; x += xGap) {
            page.drawImage(watermarkImage, {
              x,
              y,
              width: imgWidth,
              height: imgHeight,
              opacity,
              rotate: degrees(angle),
            });
          }
        }
      } else {
        let x = width / 2 - imgWidth / 2;
        let y = height / 2 - imgHeight / 2;

        switch (position) {
          case 'center':
            x = (width - imgWidth) / 2;
            y = (height - imgHeight) / 2;
            break;
          case 'top-left':
            x = 30;
            y = height - imgHeight - 30;
            break;
          case 'top-right':
            x = width - imgWidth - 30;
            y = height - imgHeight - 30;
            break;
          case 'bottom-left':
            x = 30;
            y = 30;
            break;
          case 'bottom-right':
            x = width - imgWidth - 30;
            y = 30;
            break;
        }

        page.drawImage(watermarkImage, {
          x,
          y,
          width: imgWidth,
          height: imgHeight,
          opacity,
          rotate: degrees(position === 'center' ? angle : 0),
        });
      }

      const overallProgress =
        ((fileProcessed + (i + 1) / totalPages) / totalFiles) * 100;
      taskQueue.updateProgress(task.id, overallProgress);
    }

    const watermarkedBytes = await pdfDoc.save();
    const fileName = `${sanitizeFilename(file.originalName.replace('.pdf', ''))}_图片水印.pdf`;
    const resultPath = path.join(config.paths.results, `${generateId()}.pdf`);
    await fs.writeFile(resultPath, watermarkedBytes);

    resultFiles.push({
      id: generateId(),
      name: fileName,
      originalName: fileName,
      path: resultPath,
      size: watermarkedBytes.length,
      mimeType: 'application/pdf',
      uploadedAt: Date.now(),
    });

    fileProcessed++;
  }

  return resultFiles;
}
