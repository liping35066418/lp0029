import fs from 'fs-extra';
import path from 'path';
import { createRequire } from 'module';
import { config } from '../config.js';

const require = createRequire(import.meta.url);
const http = require('http') as typeof import('http');
const https = require('https') as typeof import('https');

const CJK_FONT_URL = 'https://raw.githubusercontent.com/adobe-fonts/source-han-sans/release/OTF/SimplifiedChinese/SourceHanSansSC-Regular.otf';
const CJK_FONT_FILENAME = 'SourceHanSansSC-Regular.otf';

function getFontCachePath(): string {
  return path.join(config.paths.temp, 'fonts', CJK_FONT_FILENAME);
}

function containsCJK(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/.test(text);
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    fs.ensureDirSync(dir);

    const file = fs.createWriteStream(destPath);
    const request = (targetUrl: string) => {
      const client = targetUrl.startsWith('https') ? https : http;
      client.get(targetUrl, (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          request(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`下载字体失败: HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlinkSync(destPath);
        reject(err);
      });
    };
    request(url);
  });
}

let cachedFontBytes: Uint8Array | null = null;

async function loadCJKFontBytes(): Promise<Uint8Array> {
  if (cachedFontBytes) {
    return cachedFontBytes;
  }

  const fontPath = getFontCachePath();

  if (!(await fs.pathExists(fontPath))) {
    await downloadFile(CJK_FONT_URL, fontPath);
  }

  const buffer = await fs.readFile(fontPath);
  cachedFontBytes = new Uint8Array(buffer);
  return cachedFontBytes;
}

export { containsCJK, loadCJKFontBytes };
