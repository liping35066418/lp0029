import React, { useCallback, useRef } from 'react';
import { Upload, FileText } from 'lucide-react';
import { useAppStore } from '../store/appStore';

export const DragDropUpload: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isDragging, setIsDragging, uploadFiles } = useAppStore();

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDragging) {
        setIsDragging(true);
      }
    },
    [isDragging, setIsDragging]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;

      if (
        x < rect.left ||
        x > rect.right ||
        y < rect.top ||
        y > rect.bottom
      ) {
        setIsDragging(false);
      }
    },
    [setIsDragging]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        void uploadFiles(files);
      }
    },
    [setIsDragging, uploadFiles]
  );

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void uploadFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const allowedFormats = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

  return (
    <div
      className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
        isDragging
          ? 'border-blue-500 bg-blue-50 scale-[1.02]'
          : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex flex-col items-center gap-4">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
            isDragging ? 'bg-blue-500 scale-110' : 'bg-blue-100'
          }`}
        >
          <Upload
            className={`w-10 h-10 transition-colors ${
              isDragging ? 'text-white' : 'text-blue-500'
            }`}
          />
        </div>

        <div>
          <p className="text-xl font-semibold text-gray-800 mb-2">
            {isDragging ? '释放文件开始上传' : '拖拽文件到此处上传'}
          </p>
          <p className="text-gray-500 mb-3">
            或点击选择文件，支持批量上传
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <FileText className="w-4 h-4" />
            <span>支持格式：{allowedFormats.join('、')}</span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            单文件最大 500MB
          </p>
        </div>
      </div>

      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/5 rounded-2xl pointer-events-none" />
      )}
    </div>
  );
};
