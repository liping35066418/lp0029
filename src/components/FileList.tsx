import React from 'react';
import {
  FileText,
  Image,
  File,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { formatFileSize } from '../utils/format';
import type { FileInfo, UploadingFile } from '../types';

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext || '')) {
    return <FileText className="w-6 h-6 text-red-500" />;
  }
  if (['doc', 'docx'].includes(ext || '')) {
    return <FileText className="w-6 h-6 text-blue-500" />;
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext || '')) {
    return <Image className="w-6 h-6 text-green-500" />;
  }
  if (['txt'].includes(ext || '')) {
    return <FileText className="w-6 h-6 text-gray-500" />;
  }
  return <File className="w-6 h-6 text-gray-500" />;
};

interface UploadingFileItemProps {
  file: UploadingFile;
}

const UploadingFileItem: React.FC<UploadingFileItemProps> = ({ file }) => {
  const { removeUploadingFile } = useAppStore();

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
      <div className="flex-shrink-0">{getFileIcon(file.name)}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-gray-800 truncate" title={file.name}>
            {file.name}
          </p>
          <button
            onClick={() => removeUploadingFile(file.fileId)}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                file.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${file.progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 flex-shrink-0 w-12 text-right">
            {file.progress.toFixed(0)}%
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          {file.status === 'uploading' && (
            <>
              <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
              <span className="text-xs text-blue-500">上传中...</span>
            </>
          )}
          {file.status === 'completed' && (
            <>
              <CheckCircle className="w-3 h-3 text-green-500" />
              <span className="text-xs text-green-500">上传完成</span>
            </>
          )}
          {file.status === 'error' && (
            <>
              <AlertCircle className="w-3 h-3 text-red-500" />
              <span className="text-xs text-red-500">{file.error || '上传失败'}</span>
            </>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            {formatFileSize(file.size)}
          </span>
        </div>
      </div>
    </div>
  );
};

interface UploadedFileItemProps {
  file: FileInfo;
  isSelected: boolean;
  onToggle: () => void;
  onRemove: () => void;
}

const UploadedFileItem: React.FC<UploadedFileItemProps> = ({
  file,
  isSelected,
  onToggle,
  onRemove,
}) => {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
      onClick={onToggle}
    >
      <div className="flex-shrink-0 text-gray-400 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="flex-shrink-0">
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-blue-500 border-blue-500'
              : 'border-gray-300 group-hover:border-blue-400'
          }`}
        >
          {isSelected && (
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </div>

      <div className="flex-shrink-0">{getFileIcon(file.name)}</div>

      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium text-gray-800 truncate"
          title={file.name}
        >
          {file.name}
        </p>
        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

export const FileList: React.FC = () => {
  const {
    uploadingFiles,
    uploadedFiles,
    selectedFileIds,
    toggleFileSelection,
    removeUploadedFile,
    selectAllFiles,
    clearSelection,
    clearUploadedFiles,
  } = useAppStore();

  const allSelected =
    uploadedFiles.length > 0 && selectedFileIds.length === uploadedFiles.length;

  return (
    <div className="space-y-4">
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            正在上传 ({uploadingFiles.length})
          </h3>
          <div className="space-y-2">
            {uploadingFiles.map((file) => (
              <UploadingFileItem key={file.fileId} file={file} />
            ))}
          </div>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              已上传文件 ({uploadedFiles.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={allSelected ? clearSelection : selectAllFiles}
                className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
              >
                {allSelected ? '取消全选' : '全选'}
              </button>
              <span className="text-xs text-gray-400">|</span>
              <button
                onClick={clearUploadedFiles}
                className="text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                清空
              </button>
            </div>
          </div>

          {selectedFileIds.length > 0 && (
            <div className="p-2 bg-blue-50 rounded-lg text-sm text-blue-600">
              已选择 {selectedFileIds.length} 个文件
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {uploadedFiles.map((file) => (
              <UploadedFileItem
                key={file.id}
                file={file}
                isSelected={selectedFileIds.includes(file.id)}
                onToggle={() => toggleFileSelection(file.id)}
                onRemove={() => removeUploadedFile(file.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
