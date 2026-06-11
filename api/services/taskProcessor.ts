import type { Task, FileInfo } from '../types.js';
import type { ITaskQueue } from './taskQueue.js';
import { splitPdf, mergePdfs, extractPages, deletePages } from '../processors/pdfOperations.js';
import { addTextWatermark, addImageWatermark } from '../processors/watermark.js';
import {
  pdfToTxt,
  txtToPdf,
  imagesToPdf,
  pdfToImages,
  pdfToWord,
  wordToPdf,
} from '../processors/converters.js';
import { decryptPdf, repairPdf } from '../processors/pdfUtils.js';

export async function processTask(task: Task, taskQueue: ITaskQueue): Promise<void> {
  try {
    let resultFiles: FileInfo[] = [];

    switch (task.type) {
      case 'pdf-split':
        resultFiles = await splitPdf(task, taskQueue);
        break;
      case 'pdf-merge':
        resultFiles = await mergePdfs(task, taskQueue);
        break;
      case 'pdf-extract':
        resultFiles = await extractPages(task, taskQueue);
        break;
      case 'pdf-delete':
        resultFiles = await deletePages(task, taskQueue);
        break;
      case 'pdf-watermark-text':
        resultFiles = await addTextWatermark(task, taskQueue);
        break;
      case 'pdf-watermark-image':
        resultFiles = await addImageWatermark(task, taskQueue);
        break;
      case 'pdf-to-txt':
        resultFiles = await pdfToTxt(task, taskQueue);
        break;
      case 'txt-to-pdf':
        resultFiles = await txtToPdf(task, taskQueue);
        break;
      case 'pdf-to-image':
        resultFiles = await pdfToImages(task, taskQueue);
        break;
      case 'image-to-pdf':
        resultFiles = await imagesToPdf(task, taskQueue);
        break;
      case 'pdf-to-word':
        resultFiles = await pdfToWord(task, taskQueue);
        break;
      case 'word-to-pdf':
        resultFiles = await wordToPdf(task, taskQueue);
        break;
      case 'pdf-decrypt':
        resultFiles = await decryptPdf(task, taskQueue);
        break;
      case 'pdf-repair':
        resultFiles = await repairPdf(task, taskQueue);
        break;
      default:
        throw new Error(`不支持的任务类型: ${task.type}`);
    }

    taskQueue.completeTask(task.id, resultFiles);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    taskQueue.failTask(task.id, errorMessage);
  }
}
