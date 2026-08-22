/**
 * TLL OS - Foundation Primitives
 *
 * 核心类型定义，所有 Kernel 组件共享。
 * 这是 TLL OS 11 项核心 Contract 的基础类型层。
 */

// ============================================================
// 通用类型
// ============================================================

/** 服务标识 Token，可以是字符串、符号或类 */
export type Token<T = unknown> = string | symbol | (new (...args: never[]) => T);

/** JSON 值 */
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject { [key: string]: JsonValue; }
export interface JsonArray extends Array<JsonValue> {}

/** 异步或同步值 */
export type Awaitable<T> = T | Promise<T>;

/** 可销毁对象 */
export interface Disposable {
  dispose(): Awaitable<void>;
}

/** 可启动/停止对象 */
export interface Startable {
  start(): Awaitable<void>;
  stop(): Awaitable<void>;
}

// ============================================================
// 错误类层次
// ============================================================

/** TLL OS 基础错误 */
export class TllError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'TllError';
    this.code = code;
    this.details = details;
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/** 容器错误 */
export class ContainerError extends TllError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'ContainerError';
  }
}

/** 路由错误 */
export class RouterError extends TllError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'RouterError';
  }
}

/** 模块错误 */
export class ModuleError extends TllError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'ModuleError';
  }
}

/** 插件错误 */
export class PluginError extends TllError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'PluginError';
  }
}

/** 权限错误 */
export class PermissionError extends TllError {
  public readonly missingPermissions: string[];

  constructor(message: string, missingPermissions: string[] = []) {
    super('PERMISSION_DENIED', message, { missingPermissions });
    this.name = 'PermissionError';
    this.missingPermissions = missingPermissions;
  }
}

/** AI 错误 */
export class AiError extends TllError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'AiError';
  }
}

// ============================================================
// 生命周期状态
// ============================================================

export type LifecycleState =
  | 'created'
  | 'registering'
  | 'registered'
  | 'booting'
  | 'booted'
  | 'running'
  | 'shutting_down'
  | 'stopped'
  | 'error';

// ============================================================
// HTTP 基础类型
// ============================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'ALL';

export interface HttpHeaders {
  [key: string]: string | string[] | undefined;
}

export interface Request {
  method: HttpMethod;
  url: string;
  path: string;
  query: URLSearchParams;
  headers: HttpHeaders;
  body: unknown;
  params: Record<string, string>;
  requestId: string;
  ip?: string;
}

export interface Response {
  status: number;
  headers: HttpHeaders;
  body: unknown;
  requestId: string;
}

// ============================================================
// 日志类型
// ============================================================

export type LogLevel =
  | 'debug'
  | 'info'
  | 'notice'
  | 'warning'
  | 'error'
  | 'critical'
  | 'alert'
  | 'emergency';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  channel: string;
  context: Record<string, unknown>;
  requestId?: string;
}
