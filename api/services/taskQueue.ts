import { EventEmitter } from 'events';
import { config } from '../config.js';
import type { Task, TaskType, TaskStatus, FileInfo } from '../types.js';
import { generateId, writeTaskLog } from '../utils/fileUtils.js';
import { processTask } from './taskProcessor.js';

export interface ITaskQueue {
  createTask: (type: TaskType, files: FileInfo[], options?: Record<string, unknown>) => Task;
  getTask: (taskId: string) => Task | undefined;
  getAllTasks: () => Task[];
  pauseTask: (taskId: string) => Promise<boolean>;
  resumeTask: (taskId: string) => Promise<boolean>;
  cancelTask: (taskId: string) => Promise<boolean>;
  retryTask: (taskId: string) => Promise<boolean>;
  updateProgress: (taskId: string, progress: number) => void;
  completeTask: (taskId: string, resultFiles: FileInfo[]) => void;
  failTask: (taskId: string, error: string) => void;
  isCancelled: (taskId: string) => boolean;
  isPaused: (taskId: string) => boolean;
}

class TaskQueue extends EventEmitter implements ITaskQueue {
  private tasks: Map<string, Task> = new Map();
  private pendingQueue: string[] = [];
  private processingTasks: Set<string> = new Set();
  private pausedTasks: Set<string> = new Set();
  private cancelledTasks: Set<string> = new Set();

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  createTask(type: TaskType, files: FileInfo[], options: Record<string, unknown> = {}): Task {
    const taskId = generateId();
    const task: Task = {
      id: taskId,
      type,
      status: 'pending',
      progress: 0,
      files,
      options,
      retryCount: 0,
      maxRetries: config.task.maxRetries,
      createdAt: Date.now(),
    };

    this.tasks.set(taskId, task);
    this.pendingQueue.push(taskId);
    this.emit('task:created', task);
    void writeTaskLog(taskId, `任务创建: ${type}`);

    void this.processNext();

    return task;
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  async pauseTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'processing') {
      task.status = 'paused';
      task.pausedAt = Date.now();
      this.pausedTasks.add(taskId);
      this.processingTasks.delete(taskId);
      this.emit('task:paused', task);
      void writeTaskLog(taskId, '任务暂停');
      void this.processNext();
      return true;
    }

    if (task.status === 'pending') {
      task.status = 'paused';
      task.pausedAt = Date.now();
      this.pausedTasks.add(taskId);
      this.pendingQueue = this.pendingQueue.filter((id) => id !== taskId);
      this.emit('task:paused', task);
      void writeTaskLog(taskId, '任务暂停');
      return true;
    }

    return false;
  }

  async resumeTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'paused') return false;

    task.status = 'pending';
    this.pausedTasks.delete(taskId);
    this.pendingQueue.push(taskId);
    this.emit('task:resumed', task);
    void writeTaskLog(taskId, '任务恢复');
    void this.processNext();

    return true;
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'completed' || task.status === 'cancelled' || task.status === 'failed') {
      return false;
    }

    task.status = 'cancelled';
    this.cancelledTasks.add(taskId);

    if (this.processingTasks.has(taskId)) {
      this.processingTasks.delete(taskId);
    } else {
      this.pendingQueue = this.pendingQueue.filter((id) => id !== taskId);
    }

    if (this.pausedTasks.has(taskId)) {
      this.pausedTasks.delete(taskId);
    }

    this.emit('task:cancelled', task);
    void writeTaskLog(taskId, '任务取消');
    void this.processNext();

    return true;
  }

  async retryTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status !== 'failed' && task.status !== 'cancelled') return false;

    if (task.retryCount >= task.maxRetries) {
      return false;
    }

    task.retryCount++;
    task.status = 'pending';
    task.progress = 0;
    task.error = undefined;
    task.startedAt = undefined;
    task.completedAt = undefined;
    task.resultFiles = undefined;

    this.cancelledTasks.delete(taskId);
    this.pendingQueue.push(taskId);

    this.emit('task:retry', task);
    void writeTaskLog(taskId, `任务重试 (${task.retryCount}/${task.maxRetries})`);
    void this.processNext();

    return true;
  }

  updateProgress(taskId: string, progress: number): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.progress = Math.min(100, Math.max(0, progress));
      this.emit('task:progress', task);
    }
  }

  completeTask(taskId: string, resultFiles: FileInfo[]): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.progress = 100;
      task.resultFiles = resultFiles;
      task.completedAt = Date.now();
      this.processingTasks.delete(taskId);
      this.emit('task:completed', task);
      void writeTaskLog(taskId, '任务完成');
      void this.processNext();
    }
  }

  failTask(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = error;
      task.completedAt = Date.now();
      this.processingTasks.delete(taskId);
      this.emit('task:failed', task);
      void writeTaskLog(taskId, `任务失败: ${error}`);
      void this.processNext();
    }
  }

  private async processNext(): Promise<void> {
    while (
      this.processingTasks.size < config.task.maxConcurrent &&
      this.pendingQueue.length > 0
    ) {
      const taskId = this.pendingQueue.shift();
      if (!taskId) break;

      const task = this.tasks.get(taskId);
      if (!task) continue;

      if (this.pausedTasks.has(taskId) || this.cancelledTasks.has(taskId)) {
        continue;
      }

      task.status = 'processing';
      task.startedAt = Date.now();
      this.processingTasks.add(taskId);
      this.emit('task:started', task);
      void writeTaskLog(taskId, '任务开始执行');

      void processTask(task, this).catch((err) => {
        this.failTask(taskId, err instanceof Error ? err.message : String(err));
      });
    }
  }

  isCancelled(taskId: string): boolean {
    return this.cancelledTasks.has(taskId);
  }

  isPaused(taskId: string): boolean {
    return this.pausedTasks.has(taskId);
  }
}

export const taskQueue = new TaskQueue();
