import fs from 'fs-extra';
import path from 'path';
import { config } from '../config.js';

export class CleanupService {
  private timer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.timer) return;

    console.log('[Cleanup] 定时清理服务已启动');

    this.timer = setInterval(() => {
      void this.cleanup().catch((err) => {
        console.error('[Cleanup] 清理失败:', err);
      });
    }, config.cleanup.interval);

    void this.cleanup().catch((err) => {
      console.error('[Cleanup] 初始清理失败:', err);
    });
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[Cleanup] 定时清理服务已停止');
    }
  }

  private async cleanup(): Promise<void> {
    console.log('[Cleanup] 开始清理过期文件...');

    const now = Date.now();
    let cleanedCount = 0;
    let cleanedSize = 0;

    const dirs = [config.paths.uploads, config.paths.chunks, config.paths.results, config.paths.logs];

    for (const dir of dirs) {
      try {
        const result = await this.cleanupDirectory(dir, now);
        cleanedCount += result.count;
        cleanedSize += result.size;
      } catch (err) {
        console.error(`[Cleanup] 清理目录 ${dir} 失败:`, err);
      }
    }

    console.log(
      `[Cleanup] 清理完成，共清理 ${cleanedCount} 个文件，释放 ${(cleanedSize / 1024 / 1024).toFixed(2)} MB`
    );
  }

  private async cleanupDirectory(dir: string, now: number): Promise<{ count: number; size: number }> {
    let count = 0;
    let size = 0;

    if (!(await fs.pathExists(dir))) {
      return { count, size };
    }

    const files = await fs.readdir(dir);

    for (const file of files) {
      if (file === '.gitkeep') continue;

      const filePath = path.join(dir, file);
      try {
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
          const result = await this.cleanupDirectory(filePath, now);
          count += result.count;
          size += result.size;

          const subFiles = await fs.readdir(filePath);
          if (subFiles.length === 0 || subFiles.every((f) => f === '.gitkeep')) {
            await fs.rmdir(filePath).catch(() => {});
          }
        } else if (stats.isFile()) {
          const age = now - stats.mtimeMs;
          if (age > config.cleanup.fileMaxAge) {
            size += stats.size;
            await fs.remove(filePath);
            count++;
          }
        }
      } catch {
        // 忽略单个文件的错误
      }
    }

    return { count, size };
  }
}

export const cleanupService = new CleanupService();
