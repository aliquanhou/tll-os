# TLL OS Module System 设计

> 文档：MODULES.md
> 版本：0.1.0-blueprint

---

## 1. Module 概述

Module 是 TLL OS 的**第一方功能单元**，随应用代码存在，在应用启动时注册。Module 是构建 TLL OS 应用的基本组织方式。

### 1.1 Module vs Plugin

| 维度 | Module | Plugin |
|------|--------|--------|
| 来源 | 第一方（应用开发者编写） | 第三方（可从外部安装） |
| 存在位置 | 应用代码仓库内 `modules/` 目录 | 独立包，安装到 `plugins/` 目录 |
| 注册时机 | 应用启动时自动发现并注册 | 安装后启用，运行时可管理 |
| 生命周期 | 随应用启动/停止 | install/enable/disable/upgrade/uninstall |
| 沙箱 | 无（与应用同进程同权限） | 有（权限声明、依赖隔离） |
| 依赖管理 | 应用级 package.json | Plugin 独立 package.json |
| 升级方式 | 随应用代码版本控制 | 通过 `tll plugin:upgrade` 独立升级 |
| 典型用途 | 业务功能模块（用户、内容、订单） | 可插拔扩展（支付网关、短信服务、主题） |

### 1.2 设计原则

1. **零侵入**：Module 不修改 Kernel 源码，通过标准接口挂载
2. **可独立测试**：每个 Module 可独立启动和测试
3. **显式注册**：Module 通过 Manifest 声明元数据，不依赖目录约定
4. **不污染 Kernel**：Module 的服务、路由、事件都有命名空间隔离
5. **可组合**：Module 之间通过 Container 服务和 Event 通信，不直接引用彼此代码

---

## 2. Module 目录结构

```
modules/
└── hello-world/
    ├── tll.module.json        # Module Manifest（必需）
    ├── index.ts               # Module 入口（必需）
    ├── routes/
    │   └── index.ts           # 路由定义
    ├── controllers/
    │   └── HelloController.ts
    ├── services/
    │   └── HelloService.ts
    ├── models/
    │   └── HelloModel.ts
    ├── events/
    │   └── HelloEvents.ts
    ├── listeners/
    │   └── HelloListener.ts
    ├── commands/
    │   └── HelloCommand.ts
    ├── config/
    │   └── index.ts           # Module 默认配置
    ├── migrations/
    │   └── 001_create_hello_table.ts
    ├── tests/
    │   ├── unit/
    │   └── integration/
    └── resources/
        ├── views/
        └── lang/
```

**最小 Module** 只需要 `tll.module.json` + `index.ts`，其他目录按需创建。

---

## 3. Module Manifest

`tll.module.json` 是 Module 的元数据声明文件。

```json
{
  "name": "hello-world",
  "version": "1.0.0",
  "description": "Hello World 示例模块",
  "author": "TLL OS",
  "license": "MIT",
  "entry": "index.ts",
  "namespace": "HelloWorld",
  "dependencies": {
    "modules": ["core"],
    "plugins": []
  },
  "provides": {
    "routes": true,
    "commands": true,
    "events": true,
    "migrations": true
  },
  "config": {
    "default": "config/index.ts"
  },
  "tags": ["example", "demo"]
}
```

### 3.1 Manifest 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | Module 唯一标识，kebab-case |
| `version` | string | 是 | 语义化版本号 |
| `description` | string | 否 | Module 描述 |
| `author` | string | 否 | 作者 |
| `license` | string | 否 | 许可证 |
| `entry` | string | 是 | 入口文件路径 |
| `namespace` | string | 是 | 命名空间前缀，用于服务、路由、事件的隔离 |
| `dependencies.modules` | string[] | 否 | 依赖的其他 Module 名称列表 |
| `dependencies.plugins` | string[] | 否 | 依赖的 Plugin 名称列表 |
| `provides.routes` | boolean | 否 | 是否提供路由 |
| `provides.commands` | boolean | 否 | 是否提供 CLI 命令 |
| `provides.events` | boolean | 否 | 是否提供事件 |
| `provides.migrations` | boolean | 否 | 是否提供数据库迁移 |
| `config.default` | string | 否 | 默认配置文件路径 |
| `tags` | string[] | 否 | 标签，用于分类和搜索 |

---

## 4. Module 入口与生命周期

### 4.1 Module 接口

```typescript
interface TllModule {
  readonly manifest: ModuleManifest;

  /**
   * 注册阶段：绑定服务到容器，注册事件监听
   * 此阶段不依赖其他 Module 的服务
   */
  register(container: Container, config: Config): void | Promise<void>;

  /**
   * 启动阶段：注册路由、命令、定时任务
   * 此阶段可以依赖其他 Module 已注册的服务
   */
  boot(container: Container, router: Router, cli: CliKernel, scheduler: Scheduler): void | Promise<void>;

  /**
   * 关闭阶段：清理资源
   */
  shutdown?(container: Container): void | Promise<void>;
}
```

### 4.2 生命周期状态

```
discovered → registering → registered → booting → booted → [running] → shutting_down → stopped
```

| 状态 | 说明 |
|------|------|
| `discovered` | Manifest 已加载，Module 类未实例化 |
| `registering` | 正在执行 register() |
| `registered` | register() 完成，服务已绑定到容器 |
| `booting` | 正在执行 boot() |
| `booted` | boot() 完成，路由/命令/事件已注册 |
| `running` | 正常运行中 |
| `shutting_down` | 正在执行 shutdown() |
| `stopped` | 已停止 |

### 4.3 启动顺序

Module 按依赖关系拓扑排序启动：
1. 无依赖的 Module 先启动
2. 被依赖的 Module 先于依赖者启动
3. 同一层级的 Module 按 Manifest 中的 `priority` 字段排序（默认 0）
4. 循环依赖检测：启动前检测，发现循环依赖则抛出异常

---

## 5. Module 发现与注册

### 5.1 发现机制

Module 发现有三种方式：

1. **目录扫描**：扫描 `modules/` 目录下的所有子目录，查找 `tll.module.json`
2. **配置声明**：在 `config/modules.ts` 中显式声明 Module 列表
3. **编程注册**：在 Application 启动代码中手动调用 `moduleRegistry.register()`

### 5.2 注册流程

```
1. 发现 Module（扫描目录/读取配置）
   ↓
2. 加载 Manifest（tll.module.json）
   ↓
3. 验证 Manifest（必填字段、名称唯一性、版本格式）
   ↓
4. 依赖解析（检查依赖的 Module/Plugin 是否存在）
   ↓
5. 拓扑排序（按依赖关系排序启动顺序）
   ↓
6. 实例化 Module（动态 import 入口文件）
   ↓
7. register 阶段（按排序依次执行 register()）
   ↓
8. boot 阶段（按排序依次执行 boot()）
   ↓
9. Module 就绪
```

### 5.3 Module Registry 接口

```typescript
interface ModuleRegistry {
  discover(directory: string): Promise<DiscoveredModule[]>;
  register(module: TllModule): void;
  unregister(name: string): void;
  get(name: string): TllModule | null;
  has(name: string): boolean;
  list(): TllModule[];
  listByTag(tag: string): TllModule[];
  bootAll(): Promise<void>;
  shutdownAll(): Promise<void>;
  getBootOrder(): TllModule[];  // 拓扑排序后的启动顺序
}
```

---

## 6. Module 能力

### 6.1 路由

Module 在 `boot()` 中通过 Router 注册路由：

```typescript
boot(container, router, cli, scheduler) {
  router.group('/api/hello-world', [AuthMiddleware], (r) => {
    r.get('/', (ctx) => container.resolve(HelloController).index(ctx));
    r.get('/:id', (ctx) => container.resolve(HelloController).show(ctx));
    r.post('/', (ctx) => container.resolve(HelloController).store(ctx));
  });
}
```

路由自动添加 Module 命名空间前缀，避免冲突。

### 6.2 服务

Module 在 `register()` 中绑定服务到容器：

```typescript
register(container, config) {
  container.singleton(HelloService, (c) => new HelloService(c.resolve(Logger)));
}
```

服务 Token 自动添加 Module 命名空间前缀，如 `HelloWorld.HelloService`。

### 6.3 事件

Module 可以定义和监听事件：

```typescript
// 定义事件
const HelloCreatedEvent = 'hello-world.created';

// 监听事件
register(container, config) {
  const events = container.resolve(EventDispatcher);
  events.on(HelloCreatedEvent, (event) => {
    container.resolve(Logger).info('Hello created', event.payload);
  });
}
```

事件名称自动添加 Module 命名空间前缀。

### 6.4 CLI 命令

Module 在 `boot()` 中注册命令：

```typescript
boot(container, router, cli, scheduler) {
  cli.register(new HelloCommand(container));
}
```

命令名称自动添加 Module 前缀，如 `hello-world:greet`。

### 6.5 定时任务

Module 在 `boot()` 中注册定时任务：

```typescript
boot(container, router, cli, scheduler) {
  scheduler.schedule('hello-world:daily-greeting', '0 9 * * *', () => {
    container.resolve(HelloService).sendDailyGreeting();
  });
}
```

### 6.6 配置

Module 提供默认配置，应用可通过 `config/modules/hello-world.ts` 覆盖：

```typescript
// modules/hello-world/config/index.ts
export default {
  greeting: 'Hello, World!',
  maxLength: 255,
};
```

### 6.7 数据库迁移

Module 的 `migrations/` 目录包含迁移文件，通过 `tll migrate` 执行。

迁移文件命名：`{序号}_{描述}.ts`，如 `001_create_hello_table.ts`。

---

## 7. Module 间通信

Module 之间**不直接引用彼此的代码**，通过以下方式通信：

### 7.1 Container 服务

被依赖的 Module 在 `register()` 中暴露服务，依赖方在 `boot()` 中解析使用：

```typescript
// Module A 暴露服务
register(container) {
  container.singleton('UserService', (c) => new UserService());
}

// Module B 使用服务（需在 Manifest 中声明依赖 module: user）
boot(container) {
  const userService = container.resolve<UserService>('UserService');
}
```

### 7.2 Event

Module 通过事件解耦通信：

```typescript
// Module A 发布事件
events.dispatch('user.created', { userId: 123 });

// Module B 监听事件（需在 Manifest 中声明依赖 module: user）
events.on('user.created', (event) => { /* 处理 */ });
```

### 7.3 契约接口

Module 可以定义接口契约，其他 Module 实现该接口：

```typescript
// Module A 定义接口
interface PaymentProvider {
  pay(amount: number): Promise<PaymentResult>;
}

// Module B 实现接口并绑定
container.singleton('PaymentProvider', (c) => new StripePaymentProvider());
```

---

## 8. Module 管理 CLI

| 命令 | 说明 |
|------|------|
| `tll module:list` | 列出所有已注册 Module 及其状态 |
| `tll module:info <name>` | 查看 Module 详细信息 |
| `tll module:make <name>` | 创建新 Module 骨架 |
| `tll module:routes <name>` | 查看 Module 注册的路由 |
| `tll module:commands <name>` | 查看 Module 注册的命令 |
| `tll module:events <name>` | 查看 Module 注册的事件 |
| `tll module:test <name>` | 运行指定 Module 的测试 |

---

## 9. Module 测试

每个 Module 必须有独立的测试目录 `tests/`，包含：

- **单元测试**：测试 Service、Model、Validator 等
- **集成测试**：测试路由、命令、事件联动
- **Module 测试基类**：TLL OS 提供 `ModuleTestCase`，自动启动 Module 并提供测试容器

```typescript
// tests/integration/hello.test.ts
import { ModuleTestCase } from '@tll/os/testing';

class HelloModuleTest extends ModuleTestCase {
  protected moduleName = 'hello-world';

  async testIndexRoute() {
    const response = await this.request('GET', '/api/hello-world');
    this.assert(response.status === 200);
    this.assert(response.body.message === 'Hello, World!');
  }
}
```

---

## 10. 未实现与 TODO

第一阶段（蓝图阶段）Module 系统为**设计文档 + 接口定义**，具体实现在第二阶段完成。

第二阶段实现优先级：
1. Module Manifest 加载与验证
2. Module Registry（发现、注册、拓扑排序）
3. Module 生命周期（register/boot/shutdown）
4. 路由注册
5. 服务注册
6. 事件注册
7. CLI 命令注册
8. 定时任务注册
9. 配置合并
10. Module 管理 CLI
11. Module 测试基类
12. 数据库迁移（需数据访问层支持）
