import { Router, type Request, type Response } from 'express';
import { getResultFilePath, createZipPackage } from '../services/downloadService.js';
import { taskQueue } from '../services/taskQueue.js';
import type { FileInfo } from '../types.js';

const router = Router();

router.get('/file/:fileId', (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const filePath = getResultFilePath(fileId);

    if (!filePath) {
      res.status(404).json({
        success: false,
        error: '文件不存在',
      });
      return;
    }

    const fileName = req.query.name ? String(req.query.name) : filePath.split('/').pop() || 'download';

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('下载失败:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: '下载失败',
          });
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/task/:taskId/zip', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = taskQueue.getTask(taskId);

    if (!task) {
      res.status(404).json({
        success: false,
        error: '任务不存在',
      });
      return;
    }

    if (task.status !== 'completed' || !task.resultFiles || task.resultFiles.length === 0) {
      res.status(400).json({
        success: false,
        error: '任务未完成或没有结果文件',
      });
      return;
    }

    const zipFile = await createZipPackage(
      task.resultFiles,
      `PDF处理结果_${task.id}.zip`
    );

    res.json({
      success: true,
      data: {
        fileId: zipFile.id,
        name: zipFile.name,
        size: zipFile.size,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/all-completed/download', async (req: Request, res: Response) => {
  try {
    const allTasks = taskQueue.getAllTasks();
    const completedTasks = allTasks.filter(
      (task) => task.status === 'completed' && task.resultFiles && task.resultFiles.length > 0
    );

    if (completedTasks.length === 0) {
      res.status(400).json({
        success: false,
        error: '没有已完成的任务',
      });
      return;
    }

    const allFiles: FileInfo[] = [];
    const taskNameMap = new Map<string, number>();

    for (const task of completedTasks) {
      const taskLabel = task.type;
      const count = taskNameMap.get(taskLabel) || 0;
      taskNameMap.set(taskLabel, count + 1);

      for (const file of task.resultFiles!) {
        const taskDirName = count > 0 ? `${taskLabel}_${count + 1}` : taskLabel;
        allFiles.push({
          ...file,
          originalName: `${taskDirName}/${file.originalName || file.name}`,
        });
      }
    }

    const zipFile = await createZipPackage(
      allFiles,
      `全部任务结果_${Date.now()}.zip`
    );

    res.download(zipFile.path, zipFile.name, (err) => {
      if (err) {
        console.error('下载失败:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: '下载失败',
          });
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/task/:taskId/download', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = taskQueue.getTask(taskId);

    if (!task) {
      res.status(404).json({
        success: false,
        error: '任务不存在',
      });
      return;
    }

    if (task.status !== 'completed' || !task.resultFiles || task.resultFiles.length === 0) {
      res.status(400).json({
        success: false,
        error: '任务未完成或没有结果文件',
      });
      return;
    }

    if (task.resultFiles.length === 1) {
      const file = task.resultFiles[0];
      res.download(file.path, file.name, (err) => {
        if (err) {
          console.error('下载失败:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              error: '下载失败',
            });
          }
        }
      });
    } else {
      const zipFile = await createZipPackage(
        task.resultFiles,
        `PDF处理结果_${task.id}.zip`
      );

      res.download(zipFile.path, zipFile.name, (err) => {
        if (err) {
          console.error('下载失败:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              error: '下载失败',
            });
          }
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
