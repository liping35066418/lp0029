import { useState } from 'react';
import { Upload, ListTodo, FileText } from 'lucide-react';
import { DragDropUpload } from '../components/DragDropUpload';
import { FileList } from '../components/FileList';
import { FeaturePanel } from '../components/FeaturePanel';
import { TaskPanel } from '../components/TaskPanel';
import { useAppStore } from '../store/appStore';

export default function Home() {
  const { activeTab, setActiveTab, uploadedFiles } = useAppStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">PDF工具箱</h1>
                <p className="text-xs text-gray-500">专业的PDF综合处理工具</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'upload'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Upload className="w-4 h-4" />
                文件处理
              </button>
              <button
                onClick={() => setActiveTab('tasks')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'tasks'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <ListTodo className="w-4 h-4" />
                任务列表
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'upload' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <DragDropUpload />

              {uploadedFiles.length > 0 && <FileList />}
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <FeaturePanel />
              </div>
            </div>
          </div>
        ) : (
          <TaskPanel />
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white/50 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>PDF工具箱 - 专业的PDF在线处理工具</p>
            <p className="mt-1">支持格式转换、拆分合并、水印添加、加密解密等多种功能</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
