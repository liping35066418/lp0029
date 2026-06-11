import React, { useState } from 'react';
import {
  FileText,
  Image,
  FileSpreadsheet,
  Scissors,
  Combine,
  Sticker,
  Lock,
  Wrench,
  ArrowRightLeft,
  X,
  Play,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { TaskType, WatermarkOptions, SplitOptions } from '../types';

interface FeatureItem {
  type: TaskType;
  label: string;
  icon: React.ReactNode;
  category: string;
  description: string;
}

const features: FeatureItem[] = [
  { type: 'pdf-to-word', label: 'PDF转Word', icon: <FileText className="w-5 h-5" />, category: '格式转换', description: '将PDF文件转换为Word文档' },
  { type: 'word-to-pdf', label: 'Word转PDF', icon: <FileSpreadsheet className="w-5 h-5" />, category: '格式转换', description: '将Word文档转换为PDF' },
  { type: 'pdf-to-image', label: 'PDF转图片', icon: <Image className="w-5 h-5" />, category: '格式转换', description: '将PDF每页转换为图片' },
  { type: 'image-to-pdf', label: '图片转PDF', icon: <Image className="w-5 h-5" />, category: '格式转换', description: '将图片转换为PDF文件' },
  { type: 'pdf-to-txt', label: 'PDF转TXT', icon: <FileText className="w-5 h-5" />, category: '格式转换', description: '提取PDF中的文本内容' },
  { type: 'txt-to-pdf', label: 'TXT转PDF', icon: <FileSpreadsheet className="w-5 h-5" />, category: '格式转换', description: '将文本文件转换为PDF' },
  { type: 'pdf-split', label: 'PDF拆分', icon: <Scissors className="w-5 h-5" />, category: 'PDF操作', description: '将PDF拆分为多个文件' },
  { type: 'pdf-merge', label: 'PDF合并', icon: <Combine className="w-5 h-5" />, category: 'PDF操作', description: '将多个PDF合并为一个' },
  { type: 'pdf-extract', label: '页面提取', icon: <ArrowRightLeft className="w-5 h-5" />, category: 'PDF操作', description: '提取指定页码为新PDF' },
  { type: 'pdf-delete', label: '删除页面', icon: <X className="w-5 h-5" />, category: 'PDF操作', description: '删除指定页码的页面' },
  { type: 'pdf-watermark-text', label: '文字水印', icon: <Sticker className="w-5 h-5" />, category: '水印', description: '添加文字水印到PDF' },
  { type: 'pdf-watermark-image', label: '图片水印', icon: <Sticker className="w-5 h-5" />, category: '水印', description: '添加图片水印到PDF' },
  { type: 'pdf-decrypt', label: '解密PDF', icon: <Lock className="w-5 h-5" />, category: '工具', description: '解除PDF密码保护' },
  { type: 'pdf-repair', label: '修复PDF', icon: <Wrench className="w-5 h-5" />, category: '工具', description: '修复损坏的PDF文件' },
];

const categories = ['格式转换', 'PDF操作', '水印', '工具'];

export const FeaturePanel: React.FC = () => {
  const { activeFeature, setActiveFeature, selectedFileIds, createTask } = useAppStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [splitOptions, setSplitOptions] = useState<SplitOptions>({
    mode: 'single',
    ranges: '',
    every: 2,
  });

  const [pageRanges, setPageRanges] = useState('');

  const [watermarkText, setWatermarkText] = useState<WatermarkOptions>({
    text: '机密文件',
    opacity: 0.3,
    position: 'tile',
    size: 40,
    angle: -30,
    density: 1,
    color: '#666666',
  });

  const [watermarkImage, setWatermarkImage] = useState<WatermarkOptions & { imageFileId?: string }>({
    opacity: 0.5,
    position: 'tile',
    size: 100,
    angle: -30,
    density: 1,
    color: '',
    imageFileId: '',
  });

  const [decryptPassword, setDecryptPassword] = useState('');

  const [imageToPdfOptions, setImageToPdfOptions] = useState({
    merge: true,
    pageSize: 'original',
  });

  const [pdfToImageOptions, setPdfToImageOptions] = useState({
    format: 'png',
    quality: 80,
  });

  const handleStartTask = async () => {
    if (!activeFeature) return;
    if (selectedFileIds.length === 0) {
      setError('请先选择文件');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let options: Record<string, unknown> = {};

      switch (activeFeature) {
        case 'pdf-split':
          options = { ...splitOptions } as Record<string, unknown>;
          break;
        case 'pdf-extract':
        case 'pdf-delete':
          options = { ranges: pageRanges };
          break;
        case 'pdf-watermark-text':
          options = { ...watermarkText } as Record<string, unknown>;
          break;
        case 'pdf-watermark-image':
          options = { ...watermarkImage } as Record<string, unknown>;
          break;
        case 'pdf-decrypt':
          options = { password: decryptPassword };
          break;
        case 'image-to-pdf':
          options = { ...imageToPdfOptions } as Record<string, unknown>;
          break;
        case 'pdf-to-image':
          options = { ...pdfToImageOptions } as Record<string, unknown>;
          break;
      }

      await createTask(activeFeature, options);
      setActiveFeature(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建任务失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderOptions = () => {
    if (!activeFeature) return null;

    switch (activeFeature) {
      case 'pdf-split':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">拆分方式</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="splitMode"
                    checked={splitOptions.mode === 'single'}
                    onChange={() => setSplitOptions({ ...splitOptions, mode: 'single' })}
                    className="text-blue-500"
                  />
                  <span className="text-sm">每页拆分为单独文件</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="splitMode"
                    checked={splitOptions.mode === 'every'}
                    onChange={() => setSplitOptions({ ...splitOptions, mode: 'every' })}
                    className="text-blue-500"
                  />
                  <span className="text-sm">每N页拆分一个文件</span>
                </label>
                {splitOptions.mode === 'every' && (
                  <input
                    type="number"
                    min="1"
                    value={splitOptions.every}
                    onChange={(e) => setSplitOptions({ ...splitOptions, every: parseInt(e.target.value) || 1 })}
                    className="w-24 ml-6 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="splitMode"
                    checked={splitOptions.mode === 'range'}
                    onChange={() => setSplitOptions({ ...splitOptions, mode: 'range' })}
                    className="text-blue-500"
                  />
                  <span className="text-sm">按指定页码拆分</span>
                </label>
                {splitOptions.mode === 'range' && (
                  <input
                    type="text"
                    placeholder="例如: 1-3,5,7-10"
                    value={splitOptions.ranges}
                    onChange={(e) => setSplitOptions({ ...splitOptions, ranges: e.target.value })}
                    className="w-full ml-6 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                )}
              </div>
            </div>
          </div>
        );

      case 'pdf-extract':
      case 'pdf-delete':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                页码范围
              </label>
              <input
                type="text"
                placeholder="例如: 1-3,5,7-10"
                value={pageRanges}
                onChange={(e) => setPageRanges(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                支持单页（如 5）、范围（如 1-5）、逗号分隔（如 1,3,5-8）
              </p>
            </div>
          </div>
        );

      case 'pdf-watermark-text':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">水印文字</label>
              <input
                type="text"
                value={watermarkText.text}
                onChange={(e) => setWatermarkText({ ...watermarkText, text: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                水印位置: {watermarkText.position}
              </label>
              <select
                value={watermarkText.position}
                onChange={(e) => setWatermarkText({ ...watermarkText, position: e.target.value as WatermarkOptions['position'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="tile">平铺</option>
                <option value="center">居中</option>
                <option value="top-left">左上角</option>
                <option value="top-right">右上角</option>
                <option value="bottom-left">左下角</option>
                <option value="bottom-right">右下角</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                透明度: {watermarkText.opacity}
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={watermarkText.opacity}
                onChange={(e) => setWatermarkText({ ...watermarkText, opacity: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                字号: {watermarkText.size}px
              </label>
              <input
                type="range"
                min="12"
                max="100"
                step="2"
                value={watermarkText.size}
                onChange={(e) => setWatermarkText({ ...watermarkText, size: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            {watermarkText.position === 'tile' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  密度: {watermarkText.density}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.5"
                  value={watermarkText.density}
                  onChange={(e) => setWatermarkText({ ...watermarkText, density: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                旋转角度: {watermarkText.angle}°
              </label>
              <input
                type="range"
                min="-90"
                max="90"
                step="5"
                value={watermarkText.angle}
                onChange={(e) => setWatermarkText({ ...watermarkText, angle: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">颜色</label>
              <input
                type="color"
                value={watermarkText.color}
                onChange={(e) => setWatermarkText({ ...watermarkText, color: e.target.value })}
                className="w-full h-10 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        );

      case 'pdf-watermark-image':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">水印图片文件ID</label>
              <input
                type="text"
                placeholder="请输入水印图片的文件ID"
                value={watermarkImage.imageFileId}
                onChange={(e) => setWatermarkImage({ ...watermarkImage, imageFileId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                请先上传水印图片，然后将其ID填入此处
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                水印位置
              </label>
              <select
                value={watermarkImage.position}
                onChange={(e) => setWatermarkImage({ ...watermarkImage, position: e.target.value as WatermarkOptions['position'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="tile">平铺</option>
                <option value="center">居中</option>
                <option value="top-left">左上角</option>
                <option value="top-right">右上角</option>
                <option value="bottom-left">左下角</option>
                <option value="bottom-right">右下角</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                透明度: {watermarkImage.opacity}
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={watermarkImage.opacity}
                onChange={(e) => setWatermarkImage({ ...watermarkImage, opacity: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                大小: {watermarkImage.size}px
              </label>
              <input
                type="range"
                min="20"
                max="300"
                step="10"
                value={watermarkImage.size}
                onChange={(e) => setWatermarkImage({ ...watermarkImage, size: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            {watermarkImage.position === 'tile' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  密度: {watermarkImage.density}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.5"
                  value={watermarkImage.density}
                  onChange={(e) => setWatermarkImage({ ...watermarkImage, density: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                旋转角度: {watermarkImage.angle}°
              </label>
              <input
                type="range"
                min="-90"
                max="90"
                step="5"
                value={watermarkImage.angle}
                onChange={(e) => setWatermarkImage({ ...watermarkImage, angle: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        );

      case 'pdf-decrypt':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">PDF密码</label>
              <input
                type="password"
                placeholder="请输入PDF打开密码"
                value={decryptPassword}
                onChange={(e) => setDecryptPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        );

      case 'image-to-pdf':
        return (
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={imageToPdfOptions.merge}
                  onChange={(e) => setImageToPdfOptions({ ...imageToPdfOptions, merge: e.target.checked })}
                  className="text-blue-500"
                />
                <span className="text-sm">合并为单个PDF</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">页面尺寸</label>
              <select
                value={imageToPdfOptions.pageSize}
                onChange={(e) => setImageToPdfOptions({ ...imageToPdfOptions, pageSize: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="original">原始尺寸</option>
                <option value="a4">A4 尺寸</option>
              </select>
            </div>
          </div>
        );

      case 'pdf-to-image':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">图片格式</label>
              <select
                value={pdfToImageOptions.format}
                onChange={(e) => setPdfToImageOptions({ ...pdfToImageOptions, format: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
              </select>
            </div>
            {pdfToImageOptions.format === 'jpeg' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  质量: {pdfToImageOptions.quality}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={pdfToImageOptions.quality}
                  onChange={(e) => setPdfToImageOptions({ ...pdfToImageOptions, quality: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
            )}
          </div>
        );

      default:
        return <p className="text-gray-500 text-sm">点击开始处理</p>;
    }
  };

  const activeFeatureInfo = features.find((f) => f.type === activeFeature);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800">功能操作</h2>
        <p className="text-sm text-gray-500 mt-1">选择要执行的操作</p>
      </div>

      {!activeFeature ? (
        <div className="p-4 space-y-6">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-gray-600 mb-3 px-2">{category}</h3>
              <div className="grid grid-cols-2 gap-2">
                {features
                  .filter((f) => f.category === category)
                  .map((feature) => (
                    <button
                      key={feature.type}
                      onClick={() => setActiveFeature(feature.type)}
                      disabled={selectedFileIds.length === 0}
                      className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 text-left transition-all hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                        {feature.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{feature.label}</p>
                        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                          {feature.description}
                        </p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                {activeFeatureInfo?.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">{activeFeatureInfo?.label}</h3>
                <p className="text-xs text-gray-500">已选择 {selectedFileIds.length} 个文件</p>
              </div>
            </div>
            <button
              onClick={() => setActiveFeature(null)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-6">{renderOptions()}</div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleStartTask}
            disabled={isProcessing || selectedFileIds.length === 0}
            className="w-full py-3 px-4 bg-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-5 h-5" />
            {isProcessing ? '处理中...' : '开始处理'}
          </button>
        </div>
      )}
    </div>
  );
};
