import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import {
  initChunkUpload,
  uploadChunk,
  completeChunkUpload,
  simpleUpload,
  getFileInfo,
} from '../services/uploadService.js';
import { config } from '../config.js';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxChunkSize,
  },
});

router.post('/init', async (req: Request, res: Response) => {
  try {
    const { fileName, fileSize, totalChunks } = req.body;

    if (!fileName || !fileSize || !totalChunks) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数',
      });
      return;
    }

    const result = await initChunkUpload(
      String(fileName),
      Number(fileSize),
      Number(totalChunks)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/chunk', upload.single('chunk'), async (req: Request, res: Response) => {
  try {
    const { fileId, chunkIndex } = req.body;

    if (!fileId || chunkIndex === undefined || !req.file) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数',
      });
      return;
    }

    const result = await uploadChunk(
      String(fileId),
      Number(chunkIndex),
      req.file.buffer
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/complete', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.body;

    if (!fileId) {
      res.status(400).json({
        success: false,
        error: '缺少 fileId',
      });
      return;
    }

    const fileInfo = await completeChunkUpload(String(fileId));

    res.json({
      success: true,
      data: fileInfo,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/simple', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: '没有上传文件',
      });
      return;
    }

    const fileInfo = await simpleUpload(req.file.originalname, req.file.buffer);

    res.json({
      success: true,
      data: fileInfo,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const fileInfo = await getFileInfo(fileId);

    if (!fileInfo) {
      res.status(404).json({
        success: false,
        error: '文件不存在',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: fileInfo.id,
        name: fileInfo.name,
        size: fileInfo.size,
        mimeType: fileInfo.mimeType,
        uploadedAt: fileInfo.uploadedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
