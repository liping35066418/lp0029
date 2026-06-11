import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  XCircle,
  RotateCcw,
  Download,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  PauseCircle,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { TASK_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from '../types';
import type { Task } from '../types';
import { formatFileSize, formatDate } from '../utils/format';
import { taskApi, downloadApi } from '../services/api';

const getStatusIcon = (status: Task['status']) => {
  switch (status) {
    case 'pending':
      return <Clock className="w-4 h-4" />;
    case 'processing':
      return <Loader2 className="w-4 h-4 animate-spin" />;
    case 'paused':
      return <PauseCircle className="w-4 h-4" />;
    case 'completed':
      return <CheckCircle2 className="w-4 h-4" />;
    case 'failed':
      return <AlertTriangle className="w-4 h-4" />;
    case 'cancelled':
      return <XCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

interface TaskItemProps {
  task: Task;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { updateTask } = useAppStore();

  const handlePause = async () => {
    setIsLoading(true);
    try {
      await taskApi.pauseTask(task.id);
      updateTask(task.id, { status: 'paused' });
    } catch (error) {
      console.error('暂停失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    try {
      await taskApi.resumeTask(task.id);
      updateTask(task.id, { status: 'processing' });
    } catch (error) {
      console.error('恢复失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('确定要取消此任务吗？')) return;
    setIsLoading(true);
    try {
      await taskApi.cancelTask(task.id);
      updateTask(task.id, { status: 'cancelled' });
    } catch (error) {
      console.error('取消失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    setIsLoading(true);
    try {
      await taskApi.retryTask(task.id);
      updateTask(task.id, { status: 'pending', progress: 0, error: undefined });
    } catch (error) {
      console.error('重试失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    const url = downloadApi.getTaskDownloadUrl(task.id);
    window.open(url, '_blank');
  };

  const canPause = task.status === 'processing' || task.status === 'pending';
  const canResume = task.status === 'paused';
  const canCancel = task.status === 'processing' || task.status === 'pending' || task.status === 'paused';
  const canRetry = task.status === 'failed' || task.status === 'cancelled';
  const canDownload = task.status === 'completed' && task.resultFiles && task.resultFiles.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
          <FileText className="w-5 h-5 text-gray-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-800">
                {TASK_TYPE_LABELS[task.type] || task.type}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white ${STATUS_COLORS[task.status]}`}
              >
                {getStatusIcon(task.status)}
                {STATUS_LABELS[task.status]}
              </span>
            </div>
            <span className="text-xs text-gray-400">
              {formatDate(task.createdAt)}
            </span>
          </div>

          <p className="text-sm text-gray-500 mb-3">
            {task.files.length} 个文件
            {task.resultFiles && ` · ${task.resultFiles.length} 个结果`}
            {task.retryCount > 0 && ` · 重试 ${task.retryCount} 次`}
          </p>

          {(task.status === 'processing' || task.status === 'paused') && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">处理进度</span>
                <span className="text-xs font-medium text-gray-700">
                  {task.progress.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            </div>
          )}

          {task.error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-600">{task.error}</p>
            </div>
          )}

          {task.resultFiles && task.resultFiles.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-600 mb-2">结果文件:</p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {task.resultFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-xs bg-gray-50 px-2 py-1.5 rounded"
                  >
                    <span className="truncate text-gray-700">{file.name}</span>
                    <span className="text-gray-500 flex-shrink-0 ml-2">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {canPause && (
              <button
                onClick={handlePause}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50"
              >
                <Pause className="w-4 h-4" />
                暂停
              </button>
            )}
            {canResume && (
              <button
                onClick={handleResume}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                继续
              </button>
            )}
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                取消
              </button>
            )}
            {canRetry && (
              <button
                onClick={handleRetry}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                重试
              </button>
            )}
            {canDownload && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors ml-auto"
              >
                <Download className="w-4 h-4" />
                下载
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TaskPanel: React.FC = () => {
  const { tasks, fetchTasks } = useAppStore();
  const [filter, setFilter] = useState<'all' | Task['status']>('all');

  useEffect(() => {
    void fetchTasks();

    const interval = setInterval(() => {
      void fetchTasks();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchTasks]);

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const filters: { key: 'all' | Task['status']; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'processing', label: '处理中' },
    { key: 'pending', label: '等待中' },
    { key: 'completed', label: '已完成' },
    { key: 'failed', label: '失败' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">任务列表</h2>
            <p className="text-sm text-gray-500 mt-1">共 {tasks.length} 个任务</p>
          </div>
          <button
            onClick={() => void fetchTasks()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === f.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无任务</p>
            <p className="text-sm text-gray-400 mt-1">上传文件并开始处理</p>
          </div>
        ) : (
          filteredTasks.map((task) => <TaskItem key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
};
