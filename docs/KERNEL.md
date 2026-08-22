# TLL OS Kernel 设计

> 文档：KERNEL.md
> 版本：0.1.0-blueprint

---

## 1. Kernel 概述

TLL OS Kernel 是框架的核心层，提供 15 个基础组件。Kernel 只定义契约和生命周期，不包含任何业务逻辑。

### 1.1 设计原则

1. **面向接口**：每个组件通过接口暴露能力，具体实现可替换
2. **零业务逻辑**：Kernel 不处理商品、订单、用户等业务概念
3. **可独立测试**：每个组件可在不启动完整 Application 的情况下测试
4. **事件驱动**：组件间通过 Event 通信，不直接调用彼此的内部方法
5. **容器管理**：所有组件实例由 Container 管理，不使用全局单例

### 1.2 组件依赖关系

```
Application
  ├── Kernel (生命周期编排)
  ├── Container (服务注册与解析)
  ├── Config (配置读取)
  ├── Logger (日志)
  ├── Event (事件总线)
  ├── Router (路由匹配)
  ├── Middleware (中间件管道)
  ├── Cache (缓存)
  ├── Queue (队列)
  ├── Scheduler (调度器)
  ├── Validator (数据验证)
  ├── Security (安全)
  └── CLI (命令注册与执行)
```

依赖方向：所有组件依赖 Container 和 Config；Event 被多数组件依赖；Router 依赖 Middleware；CLI 依赖 Container。

---

## 2. 组件详细设计

### 2.1 TLL Application

**职责**：应用宿主，负责环境加载、Kernel 创建、进程管理。

**生命周期**：
```
constructor() → loadEnvironment() → createKernel() → register() → boot() → [handle request/command] → terminate()
```

**核心接口**：
```typescript
interface Application {
  readonly kernel: Kernel;
  readonly container: Container;
  readonly config: Config;

  register(): Promise<void>;  // 注册所有 ServiceProvider
  boot(): Promise<void>;      // 启动所有服务
  terminate(): Promise<void>; // 优雅终止
  isBooted(): boolean;
}
```

**边界**：
- 不处理 HTTP 请求（由 HTTP Runtime 处理）
- 不处理 CLI 命令（由 CLI Runtime 处理）
- 只负责编排 Kernel 生命周期

---

### 2.2 TLL Kernel

**职责**：核心编排器，管理请求/命令生命周期，协调各组件。

**生命周期事件**：
| 事件 | 触发时机 | 用途 |
|------|----------|------|
| `kernel.booting` | register 完成后，boot 开始前 | 服务注册后的预处理 |
| `kernel.booted` | boot 完成后 | 所有服务就绪通知 |
| `kernel.request` | HTTP 请求到达时 | 请求预处理、认证、日志 |
| `kernel.response` | 响应生成后 | 响应后处理、日志 |
| `kernel.exception` | 异常抛出时 | 异常处理、错误响应生成 |
| `kernel.terminating` | 进程终止前 | 资源清理、连接关闭 |

**核心接口**：
```typescript
interface Kernel {
  readonly application: Application;
  readonly container: Container;

  boot(): Promise<void>;
  handleRequest(request: Request): Promise<Response>;
  handleCommand(input: CommandInput): Promise<CommandOutput>;
  terminate(): Promise<void>;
}
```

---

### 2.3 TLL Container（DI 容器）

**职责**：服务注册、解析、依赖注入、生命周期管理。

**服务作用域**：
| 作用域 | 行为 | 用途 |
|--------|------|------|
| `Singleton` | 全局唯一实例 | 配置、日志、事件总线、路由表 |
| `Request` | 每个请求/命令一个实例 | 请求上下文、认证用户、数据库连接 |
| `Transient` | 每次解析新建实例 | 验证器、临时工具对象 |

**绑定方式**：
```typescript
interface Container {
  // 绑定
  bind<T>(token: Token<T>, factory: (c: Container) => T, scope?: Scope): void;
  singleton<T>(token: Token<T>, factory: (c: Container) => T): void;
  instance<T>(token: Token<T>, value: T): void;

  // 解析
  resolve<T>(token: Token<T>): T;
  resolveAll<T>(token: Token<T>): T[];

  // 标签
  tag(tokens: Token[], tag: string): void;
  resolveTagged<T>(tag: string): T[];

  // 生命周期
  createScope(): Container;  // 创建子容器（Request 作用域）
  dispose(): Promise<void>;
}
```

**Plugin 隔离**：每个 Plugin 拥有独立的 Container 命名空间，Plugin 内绑定的服务默认不污染全局容器，需通过 `exports` 显式暴露。

**自动注入**：支持构造器参数自动解析（基于 TypeScript 类型元数据或显式 `@Inject()` 装饰器）。

---

### 2.4 TLL Router

**职责**：路由注册、匹配、参数提取。

**实现**：基于 Trie 树的路由匹配器。

**路由元数据**：
```typescript
interface RouteDefinition {
  method: HttpMethod;           // GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS/ALL
  path: string;                  // /users/:id/posts/:postId
  handler: RouteHandler;         // 处理函数或 Controller 方法引用
  middleware: Middleware[];      // 路由级中间件
  version?: string;              // API 版本（v1/v2）
  permissions?: string[];        // 所需权限
  name?: string;                 // 路由名称（用于 URL 生成）
  openapi?: OpenAPIRouteMeta;    // OpenAPI 描述
}

interface RouteMatch {
  route: RouteDefinition;
  params: Record<string, string>;  // 路径参数
  query: URLSearchParams;
}
```

**核心接口**：
```typescript
interface Router {
  register(def: RouteDefinition): void;
  match(method: string, path: string): RouteMatch | null;
  group(prefix: string, middleware: Middleware[], callback: (r: Router) => void): void;
  list(): RouteDefinition[];
  findByName(name: string): RouteDefinition | null;
  generateUrl(name: string, params?: Record<string, string>): string;
}
```

**路径语法**：
- 静态段：`/users`
- 参数段：`/users/:id`（匹配非空字符串）
- 可选参数：`/users/:id?`
- 通配符：`/files/*path`（匹配剩余全部路径）
- 正则约束：`/users/:id(\\d+)`

---

### 2.5 TLL Middleware

**职责**：请求/响应的管道式处理，洋葱模型。

**中间件接口**：
```typescript
interface Middleware {
  name: string;
  handle(ctx: RequestContext, next: NextFunction): Promise<Response>;
}

type NextFunction = () => Promise<Response>;
```

**执行顺序**：
```
Request → [Global MW 1] → [Global MW 2] → [Group MW] → [Route MW] → Handler
Response ← [Global MW 1] ← [Global MW 2] ← [Group MW] ← [Route MW] ← Handler
```

**内置中间件**：
| 中间件 | 职责 |
|--------|------|
| `RequestLogger` | 请求日志 |
| `Cors` | 跨域处理 |
| `BodyParser` | 请求体解析（JSON/Form/Text） |
| `Auth` | 认证（API Key/JWT） |
| `RateLimiter` | 限流 |
| `ErrorHandler` | 异常捕获与响应转换 |

**核心接口**：
```typescript
interface MiddlewarePipeline {
  use(mw: Middleware): void;
  useGlobal(mw: Middleware): void;
  execute(ctx: RequestContext, handler: RouteHandler): Promise<Response>;
}
```

---

### 2.6 TLL Event

**职责**：事件注册、分发、监听管理。

**事件对象**：
```typescript
interface TllEvent<T = unknown> {
  name: string;
  payload: T;
  timestamp: number;
  propagationStopped: boolean;
  stopPropagation(): void;
}
```

**监听器**：
```typescript
type EventListener<T = unknown> = (event: TllEvent<T>) => void | Promise<void>;

interface EventSubscriber {
  subscribe(dispatcher: EventDispatcher): void;
}
```

**核心接口**：
```typescript
interface EventDispatcher {
  on<T>(name: string, listener: EventListener<T>, priority?: number): void;
  once<T>(name: string, listener: EventListener<T>): void;
  off(name: string, listener: EventListener): void;
  dispatch<T>(name: string, payload?: T): Promise<TllEvent<T>>;
  subscribe(subscriber: EventSubscriber): void;
  listeners(name: string): EventListener[];
}
```

**同步 vs 异步**：
- `dispatch()` 默认同步执行所有监听器
- 需要异步执行的监听器可内部使用 Queue
- 事件对象必须可序列化（支持跨进程传递）

---

### 2.7 TLL Config

**职责**：配置加载、读取、覆盖、类型安全。

**配置层级**（优先级从低到高）：
```
默认值 → config/*.ts 文件 → .env 文件 → 环境变量 → 运行时参数
```

**核心接口**：
```typescript
interface Config {
  get<T>(key: string, defaultValue?: T): T;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  all(): Record<string, unknown>;
  loadFromFile(path: string): Promise<void>;
  loadFromEnv(): void;
}
```

**配置键约定**：点号分隔，如 `database.host`、`app.port`、`api.version`。

**Module 配置**：每个 Module 可提供默认配置，通过 `config/modules/<module-name>.ts` 覆盖。

---

### 2.8 TLL Cache

**职责**：缓存抽象层，支持多驱动。

**核心接口**：
```typescript
interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  forget(key: string): Promise<void>;
  flush(): Promise<void>;
  increment(key: string, amount?: number): Promise<number>;
  decrement(key: string, amount?: number): Promise<number>;
  remember<T>(key: string, ttl: number, factory: () => Promise<T>): Promise<T>;
}

interface CacheManager {
  store(name?: string): CacheStore;
  extend(name: string, factory: (config: Config) => CacheStore): void;
}
```

**内置驱动**：
| 驱动 | 用途 |
|------|------|
| `memory` | 内存缓存（开发/测试用，进程内） |
| `file` | 文件缓存（单节点部署） |

**后续驱动**（由 Module/Plugin 提供）：Redis、Memcached、数据库缓存。

**缓存键前缀**：支持全局前缀和 Module 前缀，避免键冲突。

---

### 2.9 TLL Queue

**职责**：异步任务队列抽象层，支持多驱动。

**核心接口**：
```typescript
interface Job {
  name: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  timeout: number;
  handle(): Promise<void>;
  failed(error: Error): void;
}

interface Queue {
  push(job: Job, queue?: string): Promise<string>;  // 返回 Job ID
  later(job: Job, delay: number, queue?: string): Promise<string>;
  process(queue?: string, handler?: (job: Job) => Promise<void>): void;
  size(queue?: string): Promise<number>;
}
```

**内置驱动**：
| 驱动 | 用途 |
|------|------|
| `sync` | 同步执行（开发/测试用） |
| `memory` | 内存队列（单进程，进程重启丢失） |

**后续驱动**（由 Module/Plugin 提供）：Redis Queue、BullMQ、数据库队列、RabbitMQ。

**任务状态**：pending → processing → completed / failed / retrying。

---

### 2.10 TLL Scheduler

**职责**：定时任务调度，Cron 表达式驱动。

**核心接口**：
```typescript
interface ScheduledTask {
  name: string;
  expression: string;  // Cron 表达式
  handler: () => void | Promise<void>;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

interface Scheduler {
  schedule(name: string, expression: string, handler: () => void | Promise<void>): void;
  unschedule(name: string): void;
  list(): ScheduledTask[];
  start(): void;
  stop(): void;
  runDue(): Promise<void>;  // 手动触发到期任务（测试用）
}
```

**Cron 表达式**：标准 5 段式 `分 时 日 月 周`，支持 `*`、`,`、`-`、`/`、`L`、`W`、`#`。

**调度精度**：最小 1 分钟。秒级调度由 Queue 的 `later()` 实现。

**任务来源**：Module 可在 boot 阶段注册定时任务；Plugin 可通过 Manifest 声明定时任务。

---

### 2.11 TLL Logger

**职责**：结构化日志，支持多通道、多级别、多格式。

**日志级别**（从低到高）：`debug` < `info` < `notice` < `warning` < `error` < `critical` < `alert` < `emergency`

**核心接口**：
```typescript
interface Logger {
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
```

**输出格式**：
- `human`：人类可读格式（开发用）
- `json`：JSON 行格式（生产用，便于日志收集系统解析）

**内置通道**：`console`（标准输出）、`file`（文件）。

**结构化上下文**：每条日志可携带键值对上下文，AI Agent 可通过结构化日志解析运行状态。

---

### 2.12 TLL Validator

**职责**：数据验证，支持声明式规则。

**核心接口**：
```typescript
interface ValidationRule {
  validate(value: unknown, ctx: ValidationContext): boolean | Promise<boolean>;
  message(): string;
}

interface Validator {
  validate(data: Record<string, unknown>, rules: Record<string, string | ValidationRule[]>): ValidationResult;
  validateAsync(data: Record<string, unknown>, rules: Record<string, string | ValidationRule[]>): Promise<ValidationResult>;
  extend(name: string, rule: ValidationRule): void;
}

interface ValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
  validated: Record<string, unknown>;
}
```

**内置规则**：`required`、`string`、`number`、`boolean`、`array`、`object`、`email`、`url`、`min`、`max`、`between`、`in`、`not_in`、`regex`、`date`、`integer`、`uuid`、`json`、`confirmed`、`unique`（需数据库支持）。

**规则语法**：字符串管道式 `required|string|min:3|max:255`，或数组式 `[required(), string(), min(3)]`。

---

### 2.13 TLL Security

**职责**：认证、授权、加密、CSRF、CORS、审计。

**详见 `SECURITY.md`**。

**Kernel 层核心接口**：
```typescript
interface SecurityManager {
  auth: AuthManager;
  authorization: AuthorizationManager;
  encryption: EncryptionService;
  csrf: CsrfProtection;
  cors: CorsPolicy;
  audit: AuditLogger;
}
```

---

### 2.14 TLL CLI

**职责**：命令注册、解析、执行、输出格式化。

**详见 `CLI.md`**。

**Kernel 层核心接口**：
```typescript
interface Command {
  name: string;
  description: string;
  arguments: CommandArgument[];
  options: CommandOption[];
  execute(ctx: CommandContext): Promise<number>;  // 返回 exit code
}

interface CliKernel {
  register(command: Command): void;
  run(args: string[]): Promise<number>;
  list(): Command[];
}
```

---

### 2.15 TLL Runtime

**职责**：运行时环境，连接 Kernel 与外部世界（HTTP/CLI/AI/Queue Worker）。

**详见 `ARCHITECTURE.md` 第 4.3-4.5 节**。

**Runtime 类型**：
| Runtime | 入口 | 用途 |
|---------|------|------|
| `HttpRuntime` | `tll serve` / 生产服务器 | 处理 HTTP 请求 |
| `CliRuntime` | `tll <command>` | 执行 CLI 命令 |
| `AiRuntime` | HTTP/CLI/WS 触发 | 运行 AI Agent |
| `QueueWorker` | `tll queue:work` | 消费队列任务 |

每个 Runtime 创建独立的 Request 级 Container 作用域，共享 Kernel 的 Singleton 服务。

---

## 3. Kernel 启动序列图

```
Application.bootstrap()
  │
  ├─ 1. loadEnvironment()          # 加载 .env
  ├─ 2. createContainer()          # 创建 DI 容器
  ├─ 3. loadConfig()               # 加载配置
  ├─ 4. createKernel()             # 创建 Kernel
  ├─ 5. registerCoreServices()     # 注册 Kernel 核心服务到容器
  │
  ├─ 6. register() 阶段
  │   ├─ 6.1 发现并注册 Module（register 阶段）
  │   ├─ 6.2 发现并注册已启用 Plugin（register 阶段）
  │   └─ 6.3 每个 Module/Plugin 绑定自己的服务到容器
  │
  ├─ 7. dispatch('kernel.booting')
  │
  ├─ 8. boot() 阶段
  │   ├─ 8.1 启动 EventDispatcher
  │   ├─ 8.2 启动 Router（注册所有路由）
  │   ├─ 8.3 启动 MiddlewarePipeline
  │   ├─ 8.4 启动 Scheduler
  │   ├─ 8.5 每个 Module/Plugin 的 boot()
  │   └─ 8.6 注册 CLI 命令
  │
  ├─ 9. dispatch('kernel.booted')
  │
  └─ 10. Application 就绪，等待 Runtime 调用
```

---

## 4. 组件测试要求

每个 Kernel 组件必须有独立的单元测试，测试不依赖其他组件的具体实现（使用接口 mock）。

| 组件 | 测试重点 |
|------|----------|
| Container | 绑定/解析、作用域、标签、子容器、循环依赖检测 |
| Router | Trie 树匹配、参数提取、路由组、404、方法不匹配 |
| Middleware | 洋葱模型执行顺序、短路、异常传递 |
| Event | 优先级、停止传播、订阅者、once、异步监听 |
| Config | 层级覆盖、类型安全、环境变量加载 |
| Cache | get/set/forget/flush/remember/increment |
| Queue | push/process/later/失败重试 |
| Scheduler | Cron 解析、下次运行时间计算、任务触发 |
| Logger | 级别过滤、通道、结构化上下文、格式输出 |
| Validator | 所有内置规则、自定义规则、错误消息 |
| CLI | 参数解析、选项解析、命令匹配、输出格式化 |

---

## 5. 未实现与 TODO

第一阶段（蓝图阶段）所有 Kernel 组件均为**接口定义 + 设计文档**，具体实现在第二阶段（Kernel 实现阶段）完成。

优先级排序（第二阶段实现顺序）：
1. Container（所有组件的基础）
2. Config
3. Logger
4. Event
5. Router
6. Middleware
7. Application + Kernel 生命周期
8. HTTP Runtime
9. Validator
10. Cache
11. Queue
12. Scheduler
13. Security
14. CLI
