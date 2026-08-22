# TLL OS Runtime Adapter 设计

> 文档：RUNTIME.md
> 版本：0.1.0-blueprint
> 状态：**架构加固文档**
> 新增：第一轮架构总审查后追加。核心修正：TLL OS 不与 Node.js 永久绑定。

---

## 0. 为什么必须 Runtime 解耦

第一轮架构审查发现的关键问题：

> 豆包现在定的是 TypeScript 5.x + Node.js ≥20 + ESM。第一阶段这样没问题。但是架构层面必须明确：TLL OS 不等于 Node.js。

如果 TLL OS 与 Node.js 深度绑定，未来会遇到：

1. **无法利用 Bun 的高性能启动**（适合 Serverless / Edge）
2. **无法支持 Deno 等新兴 Runtime**
3. **无法针对特定场景优化**（如嵌入式、边缘计算）
4. **被 Node.js 的 API 和限制锁死**

因此，TLL OS 的架构必须是：

```
TLL OS Protocol（与 Runtime 无关）
    ↓
TLL Application Model（与 Runtime 无关）
    ↓
TLL Runtime Adapter（抽象层）
    ├── Node.js Adapter（第一 Runtime）
    ├── Bun Adapter（未来）
    ├── Deno Adapter（未来）
    └── 其他 Runtime Adapter（未来）
```

**TypeScript 是第一开发语言，不等于 Node.js 是 TLL OS 本身。**

---

## 1. 架构分层

### 1.1 分层图

```
┌─────────────────────────────────────────────────────┐
│                Application Layer                      │
│         Modules / Plugins / Agents / APIs            │
├─────────────────────────────────────────────────────┤
│              TLL OS Protocol Layer                    │
│  Contracts / Application Graph / Lifecycle / Perms   │
├─────────────────────────────────────────────────────┤
│            TLL OS Core Layer                          │
│  Container / Event / Config / Module Registry / ...  │
│  （纯 TypeScript，不依赖任何 Runtime API）             │
├─────────────────────────────────────────────────────┤
│           Runtime Adapter Layer                       │
│  ┌──────────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Node.js Adpt  │ │ Bun Adpt │ │  Future Adpt   │  │
│  │ HTTP/FS/Proc │ │ HTTP/FS  │ │   ...          │  │
│  └──────┬───────┘ └────┬─────┘ └───────┬────────┘  │
├─────────┴───────────────┴────────────────┴───────────┤
│                  Runtime Layer                         │
│            Node.js / Bun / Deno / ...                │
└─────────────────────────────────────────────────────┘
```

### 1.2 依赖规则

- **TLL OS Core 不依赖任何 Runtime API**：不直接使用 `node:http`、`node:fs`、`node:process` 等
- **TLL OS Core 只依赖 Runtime Adapter 接口**：通过接口调用 Runtime 能力
- **Runtime Adapter 实现具体 Runtime 的 API**：将 Node.js/Bun 的 API 适配为 TLL OS 标准接口
- **Application Layer 不直接依赖 Runtime**：通过 TLL OS Core 和 Adapter 间接使用

---

## 2. Runtime Adapter 接口

### 2.1 核心 Adapter 接口

```typescript
interface RuntimeAdapter {
  readonly name: string;               // 'node' | 'bun' | 'deno' | ...
  readonly version: string;            // Runtime 版本
  readonly capabilities: RuntimeCapabilities;

  // HTTP 服务
  createServer(handler: HttpHandler): HttpServer;

  // 文件系统
  fs: FileSystemAdapter;

  // 进程
  process: ProcessAdapter;

  // 网络
  net: NetworkAdapter;

  // 子进程
  childProcess: ChildProcessAdapter;

  // 流
  streams: StreamAdapter;

  // 加密
  crypto: CryptoAdapter;

  // 定时器
  timers: TimerAdapter;

  // 环境
  env: EnvironmentAdapter;
}
```

### 2.2 Runtime Capabilities

```typescript
interface RuntimeCapabilities {
  http: boolean;
  fileSystem: boolean;
  process: boolean;
  network: boolean;
  childProcess: boolean;
  streams: boolean;
  crypto: boolean;
  timers: boolean;
  environment: boolean;
  workers: boolean;              // Worker Threads / Web Workers
  wasm: boolean;                 // WebAssembly
  nativeModules: boolean;        // 原生模块支持
  esm: boolean;                  // ESM 支持
  topLevelAwait: boolean;        // Top-level await
}
```

---

## 3. 各 Adapter 子接口

### 3.1 HTTP Adapter

```typescript
interface HttpHandler {
  (request: HttpRequest): Awaitable<HttpResponse>;
}

interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: ReadableStream<Uint8Array> | null;
  remoteAddress?: string;
}

interface HttpResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body: ReadableStream<Uint8Array> | Uint8Array | string | null;
}

interface HttpServer {
  listen(port: number, host?: string): Awaitable<void>;
  close(): Awaitable<void>;
  port: number;
}
```

**注意**：HTTP Adapter 只定义最基础的 HTTP 接口。Router、Middleware、Body Parser 等在 TLL OS Core 层实现，不依赖具体 Runtime。

**Router 实现策略**（第一轮审查修正）：
- 不自研 Trie Router
- 定义 TLL Router Contract
- 第一阶段可使用成熟 Router 实现（如 Fastify 的路由匹配器）
- 通过 Router Adapter 接入

### 3.2 File System Adapter

```typescript
interface FileSystemAdapter {
  readFile(path: string): Awaitable<Uint8Array>;
  readTextFile(path: string): Awaitable<string>;
  writeFile(path: string, data: Uint8Array | string): Awaitable<void>;
  appendFile(path: string, data: Uint8Array | string): Awaitable<void>;
  deleteFile(path: string): Awaitable<void>;
  exists(path: string): Awaitable<boolean>;
  stat(path: string): Awaitable<FileStat>;
  readDir(path: string): Awaitable<string[]>;
  makeDir(path: string, recursive?: boolean): Awaitable<void>;
  removeDir(path: string, recursive?: boolean): Awaitable<void>;
  rename(oldPath: string, newPath: string): Awaitable<void>;
  copyFile(src: string, dest: string): Awaitable<void>;
  watch(path: string, callback: FileWatchCallback): FileWatcher;
}

interface FileStat {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  mtime: number;
  ctime: number;
}
```

### 3.3 Process Adapter

```typescript
interface ProcessAdapter {
  readonly pid: number;
  readonly platform: string;
  readonly arch: string;
  exit(code?: number): void;
  on(event: 'exit' | 'uncaughtException' | 'unhandledRejection', handler: (...args: unknown[]) => void): void;
  nextTick(callback: () => void): void;
  cwd(): string;
  chdir(path: string): void;
  memoryUsage(): MemoryUsage;
  uptime(): number;
}
```

### 3.4 Environment Adapter

```typescript
interface EnvironmentAdapter {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  has(key: string): boolean;
  all(): Record<string, string>;
  delete(key: string): void;
}
```

### 3.5 其他 Adapter

- `NetworkAdapter`：TCP/UDP 套接字、DNS 解析
- `ChildProcessAdapter`：子进程创建、IPC
- `StreamAdapter`：可读/可写流、管道、转换流
- `CryptoAdapter`：哈希、加密、随机数、证书
- `TimerAdapter`：setTimeout/setInterval/setImmediate

---

## 4. Node.js Adapter 实现

### 4.1 映射关系

| TLL OS Adapter | Node.js 模块 |
|----------------|-------------|
| HttpServer | `node:http` |
| FileSystem | `node:fs/promises` |
| Process | `node:process` |
| Network | `node:net` / `node:dgram` / `node:dns` |
| ChildProcess | `node:child_process` |
| Streams | `node:stream` |
| Crypto | `node:crypto` |
| Timers | `node:timers` |
| Environment | `process.env` |

### 4.2 Adapter 注册

```typescript
// src/adapters/node/index.ts
import { RuntimeAdapter } from '../../public/runtime.js';

export function createNodeAdapter(): RuntimeAdapter {
  return {
    name: 'node',
    version: process.version,
    capabilities: { /* ... */ },
    createServer: (handler) => createNodeHttpServer(handler),
    fs: createNodeFileSystem(),
    process: createNodeProcess(),
    // ...
  };
}
```

---

## 5. Bun Adapter（未来）

### 5.1 映射关系

| TLL OS Adapter | Bun API |
|----------------|---------|
| HttpServer | `Bun.serve()` |
| FileSystem | `Bun.file()` |
| Process | `Bun.process` |
| Crypto | `Bun.password` / `Bun.hash` |
| Environment | `Bun.env` |

Bun 的 HTTP 服务器性能远高于 Node.js，适合高并发场景。Bun Adapter 让 TLL OS 应用可以无缝切换到 Bun 运行时。

---

## 6. Runtime 检测与选择

### 6.1 自动检测

TLL OS 启动时自动检测当前 Runtime 并选择对应的 Adapter：

```typescript
function detectRuntime(): RuntimeAdapter {
  if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') {
    return createBunAdapter();
  }
  if (typeof process !== 'undefined' && process.versions?.node) {
    return createNodeAdapter();
  }
  if (typeof (globalThis as { Deno?: unknown }).Deno !== 'undefined') {
    return createDenoAdapter();
  }
  throw new Error('Unsupported runtime');
}
```

### 6.2 手动指定

应用可以在配置中指定目标 Runtime：

```typescript
// tll.config.ts
export default {
  runtime: 'node',  // 'node' | 'bun' | 'deno' | 'auto'
  buildTargets: [
    { runtime: 'node', format: 'esm', output: 'dist/node' },
    { runtime: 'bun', format: 'esm', output: 'dist/bun' },
  ],
};
```

---

## 7. 多目标构建

TLL OS 支持为多个 Runtime 构建：

```
tll build --target node
tll build --target bun
tll build --target all
```

构建产物：
```
dist/
├── node/
│   ├── index.js
│   └── index.d.ts
├── bun/
│   └── index.js
└── shared/
    └── core.js  (Runtime 无关的核心代码)
```

Application Graph 中的 `BuildTarget` Node 记录了每个应用的构建目标。

---

## 8. Runtime 特定优化

不同 Runtime 有不同的特性，TLL OS 通过 Adapter 层提供统一接口的同时，允许 Runtime 特定的优化：

| 优化 | Node.js | Bun |
|------|---------|-----|
| HTTP 服务器 | `node:http` | `Bun.serve()`（更快） |
| 文件读取 | `fs/promises` | `Bun.file()`（更快） |
| 模块加载 | ESM Loader | 原生 ESM（更快） |
| 打包 | 需要 esbuild/tsc | 原生转译 |
| 热重载 | 需要 nodemon | 原生 --hot |

应用代码不需要修改，只需要切换 Runtime Adapter 即可获得对应优化。

---

## 9. 与 Application Graph 的关系

Runtime Adapter 在 Application Graph 中体现为：

- **Application Node** 的 `metadata.runtime` 字段记录当前 Runtime
- **BuildTarget Node** 记录所有构建目标
- `builds_for` Edge 连接 Application 和 BuildTarget

Agent 可以通过 Application Graph 查询：
- 当前应用运行在什么 Runtime？
- 支持哪些构建目标？
- 切换 Runtime 会影响什么？

---

## 10. 实现计划

| 阶段 | 内容 |
|------|------|
| Foundation 0.1 PoC | Runtime Adapter 接口定义 + Node.js Adapter 最小实现 |
| Foundation 0.2 | 完整 Node.js Adapter + Runtime 自动检测 |
| Foundation 0.3 | Bun Adapter + 多目标构建 |
| Foundation 0.4 | Deno Adapter + Runtime 特定优化 |
| Beta | 边缘 Runtime 适配（Cloudflare Workers / Vercel Edge） |

---

## 11. 未实现与 TODO

第一阶段（PoC）实现：
- [x] Runtime Adapter 接口定义
- [x] RuntimeCapabilities 定义
- [x] HTTP Adapter 接口
- [x] File System Adapter 接口
- [x] Process Adapter 接口
- [x] Environment Adapter 接口
- [ ] Node.js Adapter 完整实现（PoC 中最小实现）
- [ ] Runtime 自动检测
- [ ] Bun Adapter
- [ ] 多目标构建
