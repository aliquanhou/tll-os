/**
 * TLL OS - Kernel 核心接口定义
 *
 * 定义 Kernel 层 15 个组件的接口契约。
 * 这是 TLL OS Application Model + Runtime Lifecycle Contract 的代码化表达。
 *
 * 注意：这里只定义接口，不提供实现。
 * 实现在 Foundation Phase 2 完成。
 */

import type {
  Token,
  Awaitable,
  HttpMethod,
  Request,
  Response,
  LifecycleState,
} from '../common/types/index.js';

// ============================================================
// Container (DI 容器)
// ============================================================

export type ServiceScope = 'singleton' | 'request' | 'transient';

export interface Container {
  /** 绑定服务工厂 */
  bind<T>(token: Token<T>, factory: (c: Container) => T, scope?: ServiceScope): void;
  /** 绑定单例 */
  singleton<T>(token: Token<T>, factory: (c: Container) => T): void;
  /** 绑定已有实例 */
  instance<T>(token: Token<T>, value: T): void;
  /** 解析服务 */
  resolve<T>(token: Token<T>): T;
  /** 解析所有同名服务 */
  resolveAll<T>(token: Token<T>): T[];
  /** 检查服务是否已绑定 */
  has(token: Token): boolean;
  /** 标签服务 */
  tag(tokens: Token[], tag: string): void;
  /** 按标签解析服务 */
  resolveTagged<T>(tag: string): T[];
  /** 创建子容器（Request 作用域） */
  createScope(): Container;
  /** 销毁容器，释放资源 */
  dispose(): Awaitable<void>;
}

// ============================================================
// Config (配置管理)
// ============================================================

export interface Config {
  get<T>(key: string, defaultValue?: T): T;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  all(): Record<string, unknown>;
  loadFromFile(path: string): Awaitable<void>;
  loadFromEnv(): void;
}

// ============================================================
// Logger (日志)
// ============================================================

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  notice(message: string, context?: Record<string, unknown>): void;
  warning(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  critical(message: string, context?: Record<string, unknown>): void;
  alert(message: string, context?: Record<string, unknown>): void;
  emergency(message: string, context?: Record<string, unknown>): void;
  channel(name: string): Logger;
  withContext(context: Record<string, unknown>): Logger;
}

// ============================================================
// Event (事件总线)
// ============================================================

export interface TllEvent<T = unknown> {
  name: string;
  payload: T;
  timestamp: number;
  propagationStopped: boolean;
  stopPropagation(): void;
}

export type EventListener<T = unknown> = (event: TllEvent<T>) => Awaitable<void>;

export interface EventSubscriber {
  subscribe(dispatcher: EventDispatcher): void;
}

export interface EventDispatcher {
  on<T>(name: string, listener: EventListener<T>, priority?: number): void;
  once<T>(name: string, listener: EventListener<T>): void;
  off(name: string, listener: EventListener): void;
  dispatch<T>(name: string, payload?: T): Awaitable<TllEvent<T>>;
  subscribe(subscriber: EventSubscriber): void;
  listeners(name: string): EventListener[];
}

// ============================================================
// Router (路由)
// ============================================================

export type RouteHandler = (ctx: RequestContext) => Awaitable<Response | unknown>;

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  middleware: Middleware[];
  version?: string;
  permissions?: string[];
  name?: string;
  description?: string;
}

export interface RouteMatch {
  route: RouteDefinition;
  params: Record<string, string>;
  query: URLSearchParams;
}

export interface Router {
  register(def: RouteDefinition): void;
  match(method: string, path: string): RouteMatch | null;
  group(prefix: string, middleware: Middleware[], callback: (r: Router) => void): void;
  list(): RouteDefinition[];
  findByName(name: string): RouteDefinition | null;
  generateUrl(name: string, params?: Record<string, string>): string;
}

// ============================================================
// Middleware (中间件)
// ============================================================

export type NextFunction = () => Awaitable<Response>;

export interface Middleware {
  name: string;
  handle(ctx: RequestContext, next: NextFunction): Awaitable<Response>;
}

export interface MiddlewarePipeline {
  use(mw: Middleware): void;
  useGlobal(mw: Middleware): void;
  execute(ctx: RequestContext, handler: RouteHandler): Awaitable<Response>;
}

// ============================================================
// Request Context (请求上下文)
// ============================================================

export interface RequestContext {
  request: Request;
  container: Container;
  config: Config;
  logger: Logger;
  events: EventDispatcher;
  route?: RouteMatch;
  auth?: AuthResult;
  set(key: string, value: unknown): void;
  get<T>(key: string): T | undefined;
}

// ============================================================
// Auth (认证结果)
// ============================================================

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  roles: string[];
  permissions: string[];
  tokenType: 'api-key' | 'jwt' | 'session' | 'anonymous';
}

// ============================================================
// Cache (缓存)
// ============================================================

export interface CacheStore {
  get<T>(key: string): Awaitable<T | null>;
  set(key: string, value: unknown, ttl?: number): Awaitable<void>;
  has(key: string): Awaitable<boolean>;
  forget(key: string): Awaitable<void>;
  flush(): Awaitable<void>;
  increment(key: string, amount?: number): Awaitable<number>;
  decrement(key: string, amount?: number): Awaitable<number>;
  remember<T>(key: string, ttl: number, factory: () => Awaitable<T>): Awaitable<T>;
}

export interface CacheManager {
  store(name?: string): CacheStore;
  extend(name: string, factory: (config: Config) => CacheStore): void;
}

// ============================================================
// Queue (队列)
// ============================================================

export interface Job {
  name: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  timeout: number;
  handle(): Awaitable<void>;
  failed(error: Error): void;
}

export interface Queue {
  push(job: Job, queue?: string): Awaitable<string>;
  later(job: Job, delay: number, queue?: string): Awaitable<string>;
  process(queue?: string, handler?: (job: Job) => Awaitable<void>): void;
  size(queue?: string): Awaitable<number>;
}

// ============================================================
// Scheduler (调度器)
// ============================================================

export interface ScheduledTask {
  name: string;
  expression: string;
  handler: () => Awaitable<void>;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

export interface Scheduler {
  schedule(name: string, expression: string, handler: () => Awaitable<void>): void;
  unschedule(name: string): void;
  list(): ScheduledTask[];
  start(): void;
  stop(): void;
  runDue(): Awaitable<void>;
}

// ============================================================
// Validator (验证器)
// ============================================================

export interface ValidationRule {
  validate(value: unknown, ctx: unknown): boolean | Awaitable<boolean>;
  message(): string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
  validated: Record<string, unknown>;
}

export interface Validator {
  validate(data: Record<string, unknown>, rules: Record<string, string | ValidationRule[]>): ValidationResult;
  validateAsync(data: Record<string, unknown>, rules: Record<string, string | ValidationRule[]>): Awaitable<ValidationResult>;
  extend(name: string, rule: ValidationRule): void;
}

// ============================================================
// Kernel (核心编排器)
// ============================================================

export interface Kernel {
  readonly application: Application;
  readonly container: Container;
  readonly state: LifecycleState;

  boot(): Awaitable<void>;
  handleRequest(request: Request): Awaitable<Response>;
  terminate(): Awaitable<void>;
  isBooted(): boolean;
}

// ============================================================
// Application (应用宿主)
// ============================================================

export interface Application {
  readonly kernel: Kernel;
  readonly container: Container;
  readonly config: Config;
  readonly version: string;

  register(): Awaitable<void>;
  boot(): Awaitable<void>;
  terminate(): Awaitable<void>;
  isBooted(): boolean;
  getState(): LifecycleState;
}

// ============================================================
// Service Provider (服务提供者 - Module/Plugin 注册用)
// ============================================================

export interface ServiceProvider {
  register(container: Container, config: Config): Awaitable<void>;
  boot?(container: Container): Awaitable<void>;
  shutdown?(container: Container): Awaitable<void>;
}
