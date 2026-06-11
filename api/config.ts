import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: parseInt(process.env.PORT || '8649', 10),

  upload: {
    maxFileSize: 500 * 1024 * 1024,
    maxChunkSize: 5 * 1024 * 1024,
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp',
    ],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
  },

  paths: {
    temp: path.resolve(__dirname, '../temp'),
    uploads: path.resolve(__dirname, '../temp/uploads'),
    chunks: path.resolve(__dirname, '../temp/chunks'),
    results: path.resolve(__dirname, '../temp/results'),
    logs: path.resolve(__dirname, '../temp/logs'),
  },

  task: {
    maxConcurrent: 3,
    maxRetries: 3,
    taskTimeout: 30 * 60 * 1000,
  },

  cleanup: {
    interval: 60 * 60 * 1000,
    fileMaxAge: 24 * 60 * 60 * 1000,
  },

  watermark: {
    defaultOpacity: 0.3,
    defaultSize: 40,
    defaultDensity: 1,
  },
};
