import { Router, type Request, type Response } from 'express';
import { taskQueue } from '../services/taskQueue.js';
import { getFileInfo } from '../services/uploadService.js';
import type { TaskType, FileInfo } from '../types.js';

const router = Router();

router.post('/create', async (req: Request, res: Response) => {
  try {
    const { type, fileIds, options } = req.body as {
      type: TaskType;
      fileIds: string[];
      options?: Record<string, unknown>;
    };

    if (!type || !fileIds || fileIds.length === 0) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数',
      });
      return;
    }

    const files: FileInfo[] = [];
    for (const fileId of fileIds) {
      const fileInfo = await getFileInfo(fileId);
      if (!fileInfo) {
        res.status(404).json({
          success: false,
          error: `文件 ${fileId} 不存在`,
        });
        return;
      }
      files.push(fileInfo);
    }

    const task = taskQueue.createTask(type, files, options || {});

    res.json({
      success: true,
      data: {
        taskId: task.id,
        status: task.status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/:taskId', (req: Request, res: Response) => {
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

    res.json({
      success: true,
      data: {
        id: task.id,
        type: task.type,
        status: task.status,
        progress: task.progress,
        error: task.error,
        retryCount: task.retryCount,
        maxRetries: task.maxRetries,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        files: task.files.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
        })),
        resultFiles: task.resultFiles?.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/', (_req: Request, res: Response) => {
  try {
    const tasks = taskQueue.getAllTasks();

    res.json({
      success: true,
      data: tasks.map((task) => ({
        id: task.id,
        type: task.type,
        status: task.status,
        progress: task.progress,
        error: task.error,
        retryCount: task.retryCount,
        maxRetries: task.maxRetries,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        files: task.files.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
        })),
        resultFiles: task.resultFiles?.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
        })),
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/:taskId/pause', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const success = await taskQueue.pauseTask(taskId);

    if (!success) {
      res.status(400).json({
        success: false,
        error: '无法暂停任务',
      });
      return;
    }

    res.json({
      success: true,
      message: '任务已暂停',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/:taskId/resume', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const success = await taskQueue.resumeTask(taskId);

    if (!success) {
      res.status(400).json({
        success: false,
        error: '无法恢复任务',
      });
      return;
    }

    res.json({
      success: true,
      message: '任务已恢复',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/:taskId/cancel', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const success = await taskQueue.cancelTask(taskId);

    if (!success) {
      res.status(400).json({
        success: false,
        error: '无法取消任务',
      });
      return;
    }

    res.json({
      success: true,
      message: '任务已取消',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/:taskId/retry', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const success = await taskQueue.retryTask(taskId);

    if (!success) {
      res.status(400).json({
        success: false,
        error: '无法重试任务',
      });
      return;
    }

    res.json({
      success: true,
      message: '任务已重新加入队列',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
