import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import taskRoutes from './routes/tasks.js';
import downloadRoutes from './routes/download.js';
import { ensureDirectories } from './utils/fileUtils.js';
import { cleanupService } from './services/cleanup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

await ensureDirectories();

cleanupService.start();

const app: express.Application = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/download', downloadRoutes);

app.use('/api/health', (req: Request, res: Response, next: NextFunction): void => {
  res.status(200).json({
    success: true,
    message: 'PDF处理服务运行正常',
    timestamp: new Date().toISOString(),
  });
});

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API错误:', error);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  cleanupService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  cleanupService.stop();
  process.exit(0);
});

export default app;
