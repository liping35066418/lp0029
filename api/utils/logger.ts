import fs from 'fs';
import path from 'path';
import { LOGS_DIR } from './paths.js';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export class Logger {
  private taskId: string;
  private logPath: string;

  constructor(taskId: string = 'system') {
    this.taskId = taskId;
    this.logPath = path.join(LOGS_DIR, `task-${taskId}.log`);
    this.ensureLogDir();
  }

  private ensureLogDir() {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
  }

  private format(level: LogLevel, message: string, data?: unknown): string {
    const time = new Date().toISOString();
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${time}] [${level}] [${this.taskId}] ${message}${dataStr}\n`;
  }

  private write(level: LogLevel, message: string, data?: unknown) {
    const line = this.format(level, message, data);
    try {
      fs.appendFileSync(this.logPath, line, { encoding: 'utf-8' });
    } catch (err) {
      console.error('Logger write failed:', err);
    }
    if (level === 'ERROR') {
      console.error(line.trim());
    } else {
      console.log(line.trim());
    }
  }

  info(message: string, data?: unknown) { this.write('INFO', message, data); }
  warn(message: string, data?: unknown) { this.write('WARN', message, data); }
  error(message: string, data?: unknown) { this.write('ERROR', message, data); }
  debug(message: string, data?: unknown) { this.write('DEBUG', message, data); }
}

export function getLogger(taskId?: string) {
  return new Logger(taskId);
}
