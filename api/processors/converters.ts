import fs from 'fs-extra';
import path from 'path';
import { createRequire } from 'module';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import type { Task, FileInfo } from '../types.js';

const require = createRequire(import.meta.url);
const pdfParseFn = require('pdf-parse') as (data: Buffer) => Promise<{ text: string }>;
import { config } from '../config.js';
import { generateId, sanitizeFilename, getFileExtension } from '../utils/fileUtils.js';

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

export async function pdfToTxt(task: Task, taskQueue: TaskQueueType): Promise<FileInfo[]> {
  const resultFiles: FileInfo[] = [];
  const totalFiles = task.files.length;
  let processed = 0;

  for (const file of task.files) {
    checkCancelledOrPaused(task.id, taskQueue);

    const dataBuffer = await fs.readFile(file.path);
    const data = await pdfParseFn(dataBuffer);

    const fileName = `${sanitizeFilename(file.originalName.replace(/\.[^.]+$/, ''))}.txt`;
    const resultPath = path.join(config.paths.results, `${generateId()}.txt`);
    await fs.writeFile(resultPath, data.text, 'utf-8');

    const stat = await fs.stat(resultPath);
    resultFiles.push({
      id: generateId(),
      name: fileName,
      originalName: fileName,
      path: resultPath,
      size: stat.size,
      mimeType: 'text/plain',
      uploadedAt: Date.now(),
    });

    processed++;
    taskQueue.updateProgress(task.id, (processed / totalFiles) * 100);
  }

  return resultFiles;
}

export async function txtToPdf(task: Task, taskQueue: TaskQueueType): Promise<FileInfo[]> {
  const resultFiles: FileInfo[] = [];
  const totalFiles = task.files.length;
  let processed = 0;

  for (const file of task.files) {
    checkCancelledOrPaused(task.id, taskQueue);

    const text = await fs.readFile(file.path, 'utf-8');
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 50;
    const fontSize = 12;
    const lineHeight = fontSize * 1.5;
    const charsPerLine = Math.floor((pageWidth - margin * 2) / (fontSize * 0.6));

    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph.length === 0) {
        lines.push('');
        continue;
      }
      let currentLine = '';
      for (const char of paragraph) {
        if (currentLine.length >= charsPerLine) {
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine += char;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }

    const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);
    const totalPages = Math.ceil(lines.length / linesPerPage);

    for (let i = 0; i < totalPages; i++) {
      checkCancelledOrPaused(task.id, taskQueue);

      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const startLine = i * linesPerPage;
      const endLine = Math.min(startLine + linesPerPage, lines.length);

      let yPos = pageHeight - margin;

      for (let j = startLine; j < endLine; j++) {
        yPos -= lineHeight;
        page.drawText(lines[j], {
          x: margin,
          y: yPos,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const fileName = `${sanitizeFilename(file.originalName.replace(/\.[^.]+$/, ''))}.pdf`;
    const resultPath = path.join(config.paths.results, `${generateId()}.pdf`);
    await fs.writeFile(resultPath, pdfBytes);

    resultFiles.push({
      id: generateId(),
      name: fileName,
      originalName: fileName,
      path: resultPath,
      size: pdfBytes.length,
      mimeType: 'application/pdf',
      uploadedAt: Date.now(),
    });

    processed++;
    taskQueue.updateProgress(task.id, (processed / totalFiles) * 100);
  }

  return resultFiles;
}

export async function imagesToPdf(task: Task, taskQueue: TaskQueueType): Promise<FileInfo[]> {
  const resultFiles: FileInfo[] = [];
  const options = task.options as { merge?: boolean; pageSize?: string };

  if (options.merge) {
    const pdfDoc = await PDFDocument.create();
    const totalImages = task.files.length;

    for (let i = 0; i < task.files.length; i++) {
      checkCancelledOrPaused(task.id, taskQueue);

      const file = task.files[i];
      const imageBuffer = await fs.readFile(file.path);
      const ext = getFileExtension(file.name);

      let image;
      let imgWidth: number;
      let imgHeight: number;

      try {
        const metadata = await sharp(imageBuffer).metadata();
        imgWidth = metadata.width || 800;
        imgHeight = metadata.height || 600;

        if (ext === '.png') {
          image = await pdfDoc.embedPng(imageBuffer);
        } else if (ext === '.jpg' || ext === '.jpeg') {
          image = await pdfDoc.embedJpg(imageBuffer);
        } else {
          const convertedBuffer = await sharp(imageBuffer).jpeg().toBuffer();
          image = await pdfDoc.embedJpg(convertedBuffer);
        }
      } catch {
        const convertedBuffer = await sharp(imageBuffer).jpeg().toBuffer();
        const metadata = await sharp(convertedBuffer).metadata();
        imgWidth = metadata.width || 800;
        imgHeight = metadata.height || 600;
        image = await pdfDoc.embedJpg(convertedBuffer);
      }

      const pageWidth = options.pageSize === 'a4' ? 595 : imgWidth;
      const pageHeight = options.pageSize === 'a4' ? 842 : imgHeight;

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      if (options.pageSize === 'a4') {
        const ratio = Math.min(
          (pageWidth - 40) / imgWidth,
          (pageHeight - 40) / imgHeight
        );
        const drawWidth = imgWidth * ratio;
        const drawHeight = imgHeight * ratio;
        const x = (pageWidth - drawWidth) / 2;
        const y = (pageHeight - drawHeight) / 2;
        page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });
      } else {
        page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
      }

      taskQueue.updateProgress(task.id, ((i + 1) / totalImages) * 100);
    }

    const pdfBytes = await pdfDoc.save();
    const fileName = `图片合并_${Date.now()}.pdf`;
    const resultPath = path.join(config.paths.results, `${generateId()}.pdf`);
    await fs.writeFile(resultPath, pdfBytes);

    resultFiles.push({
      id: generateId(),
      name: fileName,
      originalName: fileName,
      path: resultPath,
      size: pdfBytes.length,
      mimeType: 'application/pdf',
      uploadedAt: Date.now(),
    });
  } else {
    let processed = 0;
    for (const file of task.files) {
      checkCancelledOrPaused(task.id, taskQueue);

      const pdfDoc = await PDFDocument.create();
      const imageBuffer = await fs.readFile(file.path);
      const ext = getFileExtension(file.name);

      let image;
      let imgWidth: number;
      let imgHeight: number;

      try {
        const metadata = await sharp(imageBuffer).metadata();
        imgWidth = metadata.width || 800;
        imgHeight = metadata.height || 600;

        if (ext === '.png') {
          image = await pdfDoc.embedPng(imageBuffer);
        } else if (ext === '.jpg' || ext === '.jpeg') {
          image = await pdfDoc.embedJpg(imageBuffer);
        } else {
          const convertedBuffer = await sharp(imageBuffer).jpeg().toBuffer();
          image = await pdfDoc.embedJpg(convertedBuffer);
        }
      } catch {
        const convertedBuffer = await sharp(imageBuffer).jpeg().toBuffer();
        const metadata = await sharp(convertedBuffer).metadata();
        imgWidth = metadata.width || 800;
        imgHeight = metadata.height || 600;
        image = await pdfDoc.embedJpg(convertedBuffer);
      }

      const page = pdfDoc.addPage([imgWidth, imgHeight]);
      page.drawImage(image, { x: 0, y: 0, width: imgWidth, height: imgHeight });

      const pdfBytes = await pdfDoc.save();
      const fileName = `${sanitizeFilename(file.originalName.replace(/\.[^.]+$/, ''))}.pdf`;
      const resultPath = path.join(config.paths.results, `${generateId()}.pdf`);
      await fs.writeFile(resultPath, pdfBytes);

      resultFiles.push({
        id: generateId(),
        name: fileName,
        originalName: fileName,
        path: resultPath,
        size: pdfBytes.length,
        mimeType: 'application/pdf',
        uploadedAt: Date.now(),
      });

      processed++;
      taskQueue.updateProgress(task.id, (processed / task.files.length) * 100);
    }
  }

  return resultFiles;
}

export async function pdfToImages(task: Task, taskQueue: TaskQueueType): Promise<FileInfo[]> {
  const resultFiles: FileInfo[] = [];
  const options = task.options as { format?: string; quality?: number; dpi?: number };
  const format = (options.format || 'png') as 'png' | 'jpeg';
  const quality = options.quality || 80;

  const totalFiles = task.files.length;
  let fileProcessed = 0;

  for (const file of task.files) {
    checkCancelledOrPaused(task.id, taskQueue);

    const pdfBytes = await fs.readFile(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();

    for (let i = 0; i < totalPages; i++) {
      checkCancelledOrPaused(task.id, taskQueue);

      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();

      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
      newPdf.addPage(copiedPage);
      const singlePageBytes = await newPdf.save();

      const pngBuffer = Buffer.from(singlePageBytes);

      let imageBuffer: Buffer;
      if (format === 'jpeg') {
        imageBuffer = await sharp(pngBuffer)
          .jpeg({ quality })
          .toBuffer();
      } else {
        imageBuffer = await sharp(pngBuffer)
          .png()
          .toBuffer();
      }

      const ext = format === 'jpeg' ? 'jpg' : 'png';
      const fileName = `${sanitizeFilename(file.originalName.replace('.pdf', ''))}_第${i + 1}页.${ext}`;
      const resultPath = path.join(config.paths.results, `${generateId()}.${ext}`);
      await fs.writeFile(resultPath, imageBuffer);

      resultFiles.push({
        id: generateId(),
        name: fileName,
        originalName: fileName,
        path: resultPath,
        size: imageBuffer.length,
        mimeType: format === 'jpeg' ? 'image/jpeg' : 'image/png',
        uploadedAt: Date.now(),
      });

      const overallProgress =
        ((fileProcessed + (i + 1) / totalPages) / totalFiles) * 100;
      taskQueue.updateProgress(task.id, overallProgress);
    }

    fileProcessed++;
  }

  return resultFiles;
}

export async function pdfToWord(task: Task, taskQueue: TaskQueueType): Promise<FileInfo[]> {
  const resultFiles: FileInfo[] = [];
  const totalFiles = task.files.length;
  let processed = 0;

  for (const file of task.files) {
    checkCancelledOrPaused(task.id, taskQueue);

    const dataBuffer = await fs.readFile(file.path);
    const data = await pdfParseFn(dataBuffer);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.6; }
    .page { page-break-after: always; }
  </style>
</head>
<body>
  <div class="page">
    <pre style="white-space: pre-wrap; font-family: inherit;">${data.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </div>
</body>
</html>
`;

    const docContent = createSimpleDocx(data.text);

    const fileName = `${sanitizeFilename(file.originalName.replace('.pdf', ''))}.docx`;
    const resultPath = path.join(config.paths.results, `${generateId()}.docx`);
    await fs.writeFile(resultPath, docContent);

    const stat = await fs.stat(resultPath);
    resultFiles.push({
      id: generateId(),
      name: fileName,
      originalName: fileName,
      path: resultPath,
      size: stat.size,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      uploadedAt: Date.now(),
    });

    void htmlContent;

    processed++;
    taskQueue.updateProgress(task.id, (processed / totalFiles) * 100);
  }

  return resultFiles;
}

function createSimpleDocx(text: string): Buffer {
  const lines = text.split('\n');
  const bodyParagraphs = lines
    .map((line) => {
      const escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
    })
    .join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyParagraphs}</w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

  const { zlibSync, strToU8, zipSync } = require('fflate');

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypesXml),
    '_rels/.rels': strToU8(relsXml),
    'word/document.xml': strToU8(documentXml),
    'word/_rels/document.xml.rels': strToU8(docRelsXml),
  };

  return Buffer.from(zipSync(files, { level: 6 }));
}

export async function wordToPdf(task: Task, taskQueue: TaskQueueType): Promise<FileInfo[]> {
  const resultFiles: FileInfo[] = [];
  const totalFiles = task.files.length;
  let processed = 0;

  for (const file of task.files) {
    checkCancelledOrPaused(task.id, taskQueue);

    try {
      const fileBuffer = await fs.readFile(file.path);
      const text = await extractTextFromDocx(fileBuffer);

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pageWidth = 595;
      const pageHeight = 842;
      const margin = 50;
      const fontSize = 12;
      const lineHeight = fontSize * 1.5;
      const charsPerLine = Math.floor((pageWidth - margin * 2) / (fontSize * 0.6));

      const lines: string[] = [];
      const paragraphs = text.split('\n');

      for (const paragraph of paragraphs) {
        if (paragraph.length === 0) {
          lines.push('');
          continue;
        }
        let currentLine = '';
        for (const char of paragraph) {
          if (currentLine.length >= charsPerLine) {
            lines.push(currentLine);
            currentLine = char;
          } else {
            currentLine += char;
          }
        }
        if (currentLine) {
          lines.push(currentLine);
        }
      }

      const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);
      const totalPages = Math.ceil(lines.length / linesPerPage);

      for (let i = 0; i < totalPages; i++) {
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        const startLine = i * linesPerPage;
        const endLine = Math.min(startLine + linesPerPage, lines.length);

        let yPos = pageHeight - margin;

        for (let j = startLine; j < endLine; j++) {
          yPos -= lineHeight;
          page.drawText(lines[j], {
            x: margin,
            y: yPos,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const fileName = `${sanitizeFilename(file.originalName.replace(/\.[^.]+$/, ''))}.pdf`;
      const resultPath = path.join(config.paths.results, `${generateId()}.pdf`);
      await fs.writeFile(resultPath, pdfBytes);

      resultFiles.push({
        id: generateId(),
        name: fileName,
        originalName: fileName,
        path: resultPath,
        size: pdfBytes.length,
        mimeType: 'application/pdf',
        uploadedAt: Date.now(),
      });
    } catch (error) {
      throw new Error(`文件 ${file.name} 转换失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    processed++;
    taskQueue.updateProgress(task.id, (processed / totalFiles) * 100);
  }

  return resultFiles;
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const { unzipSync, strFromU8 } = await import('fflate');

  try {
    const unzipped = unzipSync(new Uint8Array(buffer));
    const documentXml = unzipped['word/document.xml'];

    if (!documentXml) {
      return '';
    }

    const xmlStr = strFromU8(documentXml);
    const text = xmlStr
      .replace(/<w:p[^>]*>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    return text.trim();
  } catch {
    return '';
  }
}
