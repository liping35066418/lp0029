import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '..', '..');

export const TEMP_DIR = path.join(ROOT_DIR, 'temp');
export const CHUNKS_DIR = path.join(TEMP_DIR, 'chunks');
export const UPLOADS_DIR = path.join(TEMP_DIR, 'uploads');
export const RESULTS_DIR = path.join(TEMP_DIR, 'results');
export const LOGS_DIR = path.join(TEMP_DIR, 'logs');

export function tempChunkPath(subdir: string, filename: string): string {
  return path.join(CHUNKS_DIR, subdir, filename);
}

export function tempUploadPath(filename: string): string {
  return path.join(UPLOADS_DIR, filename);
}

export function tempResultPath(filename: string): string {
  return path.join(RESULTS_DIR, filename);
}

export function tempLogPath(filename: string): string {
  return path.join(LOGS_DIR, filename);
}
