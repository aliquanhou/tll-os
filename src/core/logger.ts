/**
 * TLL OS - Structured Logger (P1)
 *
 * 结构化日志：级别、Request ID、JSON 输出、上下文关联。
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  module?: string;
  context?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

export interface LoggerConfig {
  level?: LogLevel;
  format?: 'json' | 'text';
  output?: 'stdout' | 'file';
  filePath?: string;
  includeTimestamp?: boolean;
  includeRequestId?: boolean;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export class Logger {
  private config: Required<LoggerConfig>;
  private moduleName?: string;
  private requestId?: string;

  constructor(config?: LoggerConfig, moduleName?: string) {
    this.config = {
      level: config?.level ?? (process.env.TLL_LOG_LEVEL as LogLevel) ?? 'info',
      format: config?.format ?? (process.env.TLL_LOG_FORMAT as 'json' | 'text') ?? 'text',
      output: config?.output ?? 'stdout',
      filePath: config?.filePath ?? 'tll-os.log',
      includeTimestamp: config?.includeTimestamp ?? true,
      includeRequestId: config?.includeRequestId ?? true,
    };
    this.moduleName = moduleName;
  }

  /** Create a child logger with module context */
  child(moduleName: string): Logger {
    const child = new Logger(this.config, moduleName);
    child.requestId = this.requestId;
    return child;
  }

  /** Set request ID for this logger instance */
  withRequestId(requestId: string): Logger {
    const clone = new Logger(this.config, this.moduleName);
    clone.requestId = requestId;
    return clone;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | Record<string, unknown>): void {
    if (error instanceof Error) {
      this.log('error', message, { error: { name: error.name, message: error.message, stack: error.stack } });
    } else {
      this.log('error', message, error);
    }
  }

  fatal(message: string, error?: Error): void {
    this.log('fatal', message, error ? { error: { name: error.name, message: error.message, stack: error.stack } } : undefined);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.config.level]) return;

    const entry: LogEntry = {
      timestamp: this.config.includeTimestamp ? new Date().toISOString() : '',
      level,
      message,
      ...(this.config.includeRequestId && this.requestId ? { requestId: this.requestId } : {}),
      ...(this.moduleName ? { module: this.moduleName } : {}),
      ...(context ? { context } : {}),
    };

    const output = this.config.format === 'json'
      ? JSON.stringify(entry)
      : this.formatText(entry);

    if (level === 'error' || level === 'fatal') {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }

  private formatText(entry: LogEntry): string {
    const parts: string[] = [];
    if (entry.timestamp) parts.push(entry.timestamp);
    parts.push(`[${entry.level.toUpperCase()}]`);
    if (entry.module) parts.push(`[${entry.module}]`);
    if (entry.requestId) parts.push(`[req:${entry.requestId}]`);
    parts.push(entry.message);
    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context));
    }
    return parts.join(' ');
  }

  /** Check if a level is currently enabled */
  isLevelEnabled(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.config.level];
  }

  /** Get current log level */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /** Set log level at runtime */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
}

/** Global default logger instance */
export const logger = new Logger();

/** Create a module-scoped logger */
export function createLogger(moduleName: string, config?: LoggerConfig): Logger {
  return new Logger(config, moduleName);
}
