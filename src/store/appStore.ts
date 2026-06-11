import { create } from 'zustand';
import type { FileInfo, Task, UploadingFile, TaskType } from '../types';
import { uploadFileWithChunks, taskApi } from '../services/api';

interface AppState {
  uploadedFiles: FileInfo[];
  uploadingFiles: UploadingFile[];
  tasks: Task[];
  selectedFileIds: string[];
  activeTab: 'upload' | 'tasks';
  activeFeature: TaskType | null;
  isDragging: boolean;

  setIsDragging: (dragging: boolean) => void;
  setActiveTab: (tab: 'upload' | 'tasks') => void;
  setActiveFeature: (feature: TaskType | null) => void;

  addUploadingFile: (file: UploadingFile) => void;
  updateUploadingProgress: (fileId: string, progress: number) => void;
  setUploadingError: (fileId: string, error: string) => void;
  removeUploadingFile: (fileId: string) => void;

  addUploadedFile: (file: FileInfo) => void;
  removeUploadedFile: (fileId: string) => void;
  clearUploadedFiles: () => void;

  toggleFileSelection: (fileId: string) => void;
  selectAllFiles: () => void;
  clearSelection: () => void;

  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
  fetchTasks: () => Promise<void>;
  pollTaskStatus: (taskId: string) => () => void;

  uploadFile: (file: File) => Promise<void>;
  uploadFiles: (files: FileList | File[]) => Promise<void>;

  createTask: (type: TaskType, options?: Record<string, unknown>) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  uploadedFiles: [],
  uploadingFiles: [],
  tasks: [],
  selectedFileIds: [],
  activeTab: 'upload',
  activeFeature: null,
  isDragging: false,

  setIsDragging: (dragging) => set({ isDragging: dragging }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveFeature: (feature) => set({ activeFeature: feature }),

  addUploadingFile: (file) =>
    set((state) => ({
      uploadingFiles: [...state.uploadingFiles, file],
    })),

  updateUploadingProgress: (fileId, progress) =>
    set((state) => ({
      uploadingFiles: state.uploadingFiles.map((f) =>
        f.fileId === fileId ? { ...f, progress } : f
      ),
    })),

  setUploadingError: (fileId, error) =>
    set((state) => ({
      uploadingFiles: state.uploadingFiles.map((f) =>
        f.fileId === fileId ? { ...f, status: 'error', error } : f
      ),
    })),

  removeUploadingFile: (fileId) =>
    set((state) => ({
      uploadingFiles: state.uploadingFiles.filter((f) => f.fileId !== fileId),
    })),

  addUploadedFile: (file) =>
    set((state) => ({
      uploadedFiles: [...state.uploadedFiles, file],
    })),

  removeUploadedFile: (fileId) =>
    set((state) => ({
      uploadedFiles: state.uploadedFiles.filter((f) => f.id !== fileId),
      selectedFileIds: state.selectedFileIds.filter((id) => id !== fileId),
    })),

  clearUploadedFiles: () =>
    set({ uploadedFiles: [], selectedFileIds: [] }),

  toggleFileSelection: (fileId) =>
    set((state) => ({
      selectedFileIds: state.selectedFileIds.includes(fileId)
        ? state.selectedFileIds.filter((id) => id !== fileId)
        : [...state.selectedFileIds, fileId],
    })),

  selectAllFiles: () =>
    set((state) => ({
      selectedFileIds: state.uploadedFiles.map((f) => f.id),
    })),

  clearSelection: () => set({ selectedFileIds: [] }),

  addTask: (task) =>
    set((state) => ({
      tasks: [task, ...state.tasks],
    })),

  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates } : t
      ),
    })),

  removeTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    })),

  fetchTasks: async () => {
    try {
      const tasks = await taskApi.getAllTasks();
      set({ tasks });
    } catch (error) {
      console.error('获取任务列表失败:', error);
    }
  },

  pollTaskStatus: (taskId) => {
    let stopped = false;

    const poll = async () => {
      if (stopped) return;

      try {
        const task = await taskApi.getTask(taskId);
        get().updateTask(taskId, task);

        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
          return;
        }
      } catch (error) {
        console.error('获取任务状态失败:', error);
      }

      setTimeout(poll, 2000);
    };

    void poll();

    return () => {
      stopped = true;
    };
  },

  uploadFile: async (file) => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;

    get().addUploadingFile({
      fileId: tempId,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading',
    });

    try {
      const fileInfo = await uploadFileWithChunks(file, (progress) => {
        get().updateUploadingProgress(tempId, progress);
      });

      get().removeUploadingFile(tempId);
      get().addUploadedFile(fileInfo);
    } catch (error) {
      get().setUploadingError(
        tempId,
        error instanceof Error ? error.message : '上传失败'
      );
    }
  },

  uploadFiles: async (files) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      void get().uploadFile(file);
    }
  },

  createTask: async (type, options) => {
    const state = get();
    const fileIds = state.selectedFileIds;

    if (fileIds.length === 0) {
      throw new Error('请先选择文件');
    }

    const result = await taskApi.createTask(type, fileIds, options);

    const newTask: Task = {
      id: result.taskId,
      type,
      status: 'pending',
      progress: 0,
      retryCount: 0,
      maxRetries: 3,
      createdAt: Date.now(),
      files: fileIds.map((id) => {
        const file = state.uploadedFiles.find((f) => f.id === id);
        return {
          id,
          name: file?.name || '',
          size: file?.size || 0,
        };
      }),
    };

    get().addTask(newTask);
    void get().pollTaskStatus(newTask.id);
  },
}));
