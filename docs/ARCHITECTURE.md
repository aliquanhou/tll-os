# TLL OS Foundation 0.1 — Architecture Blueprint

> 版本：0.1.0-blueprint
> 阶段：Foundation Phase 1
> 状态：架构审查稿（待第一轮架构审查）

---

## 0. 文档定位

本文档是 TLL OS Foundation 0.1 的总纲性架构蓝图。它回答三个问题：

1. **TLL OS 是什么、不是什么** —— 架构边界
2. **为什么这样设计** —— 架构研究与技术选型依据
3. **怎么落地** —— 组件划分、接口契约、目录结构、最小成功标准

各子系统的详细设计见同目录下的专项文档：

| 文档 | 覆盖范围 |
|------|----------|
| `KERNEL.md` | 15 个 Kernel 组件的职责、接口、生命周期 |
| `MODULES.md` | Module 元数据、发现、注册、生命周期 |
| `PLUGINS.md` | Plugin 与 Module 的区别、Manifest、权限、安装流程 |
| `API.md` | REST/OpenAPI/WebSocket/Webhook/认证/限流/版本化 |
| `AI.md` | Agent/Tool/Skill/Memory/Context/Workflow/MCP/Permission/Task |
| `CLI.md` | `tll` 命令体系、插件化命令、输出规范 |
| `SECURITY.md` | 认证、授权、加密、CSRF、CORS、审计、Plugin 沙箱 |
| `TESTING.md` | 单元/集成/Kernel/Module/Plugin/API 测试体系 |
| `CONTRIBUTING.md` | 贡献规范、代码风格、PR 流程、架构决策记录 |
| `AGENTS.md` | AI Agent 操作 TLL OS 的标准接口与约束 |
| `ROADMAP.md` | 阶段规划、里程碑、已实现/未实现/技术债务 |

---

## 1. TLL OS 的定义与边界

### 1.1 是什么

TLL OS 是一个**开源、通用、AI-Native 的应用开发操作系统/框架**。

它为开发者提供一套从 Kernel 到 Application 的完整基础设施，使得任何开发者安装后都能创建：

- Web 应用 / API 服务 / SaaS
- 电商 / CRM / ERP / CMS
- AI Agent 应用
- 企业软件 / 行业软件
- 第三方插件和模块

### 1.2 不是什么

- **不是商城**。商城只是未来基于 TLL OS 构建的第一个大型上层应用。
- **不是 Laravel / ThinkPHP 的换皮**。可以学习其设计思想，但 Kernel、Container、Router、Event 等核心必须是 TLL OS 自己的实现和接口契约。
- **不是 UI 框架**。TLL OS Foundation 不绑定任何前端框架，UI 是上层应用的选择。
- **不是特定数据库的 ORM**。Foundation 提供数据访问抽象层，具体驱动由 Module/Plugin 提供。

### 1.3 核心设计哲学

| 原则 | 含义 |
|------|------|
| **Kernel 极简** | Kernel 只定义契约和生命周期，不包含业务逻辑 |
| **AI 一等公民** | AI Agent 通过标准 Tool 接口操作 TLL OS 的一切，与人类开发者对等 |
| **可组合** | 每个组件都是可替换的实现，通过 Container 注入 |
| **零侵入扩展** | Module 和 Plugin 不修改 Kernel 源码，通过标准接口挂载 |
| **可测试** | 每个核心组件必须可独立测试，Kernel 本身必须有 Kernel Test |
| **显式优于隐式** | 注册、依赖、权限都通过 Manifest/Config 显式声明，不依赖约定大于配置的魔法 |

---

## 2. 架构研究：六大框架对比分析

> 研究目的：提炼成熟框架的架构思想，作为 TLL OS 设计的输入。
> 研究原则：只学思想，不抄代码；最终必须形成 TLL OS 自己的 Kernel。

### 2.1 对比总表

| 维度 | Laravel | Symfony | ThinkPHP | NestJS | Django | Spring Boot |
|------|---------|---------|----------|--------|--------|-------------|
| **语言** | PHP | PHP | PHP | TypeScript | Python | Java |
| **架构风格** | 全栈 MVC | 组件化微内核 | 全栈 MVC | 模块化 DI | MTV（MVC变体） | 分层 + 自动配置 |
| **DI 容器** | 服务容器（绑定/解析） | ServiceContainer（编译型） | 容器+门面 | 内置 DI（构造器注入） | 无原生DI（依赖注入第三方） | ApplicationContext（IoC） |
| **路由** | 注解+文件路由 | Annotation/Attribute/YAML/XML | 注解+路由文件 | 装饰器路由 | URLconf（正则路径） | @RequestMapping |
| **中间件** | 全局+路由组 | 事件监听式 | 全局+路由 | 全局/控制器/方法 | Middleware（请求/响应钩子） | Filter/Interceptor |
| **事件** | Event/Listener | EventDispatcher | 事件+监听 | EventEmitter | Signal | ApplicationEvent |
| **队列** | Queue（多驱动） | Messenger | Queue | @MessagePattern | Celery（第三方） | @Async / JMS |
| **调度** | Schedule（Cron式） | Messenger调度 | Crontab | @Cron | celery beat | @Scheduled |
| **配置** | .env + config/*.php | .env + yaml/xml | .env + config | .env + ConfigModule | settings.py | application.yml |
| **模块化** | Package（第三方） | Bundle | 扩展+多应用 | Module（@Module） | App（INSTALLED_APPS） | Starter（自动配置） |
| **插件化** | 弱（Package即插件） | Bundle生命周期 | 弱 | 弱（Module动态加载有限） | App（强约定） | Starter（SPI机制） |
| **CLI** | Artisan | Console | think | Nest CLI | manage.py | Spring Boot Maven/Gradle |
| **测试** | PHPUnit + 特性测试 | PHPUnit | PHPUnit | Jest | pytest | JUnit + Spring Test |
| **AI 集成** | 无原生 | 无原生 | 无原生 | 无原生 | 无原生 | 无原生 |

### 2.2 关键架构思想提炼

#### 2.2.1 Kernel / Application 生命周期

**Laravel**：`bootstrap/app.php` → 创建 Application → 绑定核心服务 → 注册 ServiceProvider → boot → 处理请求 → 终止。ServiceProvider 有 `register()` 和 `boot()` 两个阶段，确保依赖顺序。

**Symfony**：Kernel 管理 Bundle 注册、容器编译、缓存。请求生命周期由 `HttpKernel` 管理，通过 EventDispatcher 派发 `request/exception/view/response/terminate` 事件。

**Spring Boot**：`SpringApplication.run()` → 创建 Environment → 创建 ApplicationContext → 刷新容器（Bean 定义加载、实例化、初始化）→ 触发 ApplicationRunner/CommandLineRunner。自动配置通过 `@Conditional` 系列注解实现条件化 Bean 注册。

**TLL OS 采纳**：
- 两阶段启动：`register()`（绑定服务到容器，不依赖其他服务）→ `boot()`（服务间协作、注册路由/事件/命令）
- Kernel 通过 Event 驱动请求生命周期，而非硬编码流程
- Application 是 Kernel 的宿主，负责环境加载和进程管理

#### 2.2.2 Dependency Injection

**Laravel**：服务容器支持绑定（闭包/单例/实例）、解析（自动依赖注入）、标签、上下文绑定。门面（Facade）是容器解析的静态代理。

**NestJS**：基于 TypeScript 装饰器的 DI，`@Injectable()` 标记 Provider，`@Module()` 声明 providers/imports/exports。支持作用域（DEFAULT/REQUEST/TRANSIENT）。

**Symfony**：编译型容器，服务定义在配置中，编译时解析依赖图生成优化的容器类。支持自动装配（autowiring）。

**TLL OS 采纳**：
- 运行时容器（非编译型），支持动态绑定和解析，适配 Plugin 动态加载场景
- 构造器注入为主，支持属性注入（通过装饰器/标记）
- 服务作用域：Singleton（全局单例）、Request（请求级）、Transient（每次解析新建）
- 不使用 Facade 静态代理（避免全局状态和测试困难），改为通过 Container 接口或构造器注入获取

#### 2.2.3 Router

**Laravel**：路由文件定义，支持 HTTP 动词、参数、正则约束、路由组、中间件、命名路由、资源路由。路由匹配通过编译后的正则集合。

**NestJS**：装饰器路由（`@Controller()` + `@Get()`），路由在 Module 加载时注册到 Express/Fastify 适配器。

**Django**：URLconf 是路径列表，支持正则/路径转换器、include 子路由、命名空间。

**TLL OS 采纳**：
- 基于 Trie 树的路由匹配（非正则集合），支持参数提取、通配符、路由组前缀
- 路由注册来源：Module 路由文件、Plugin 路由、AI Agent 动态路由
- 路由元数据：HTTP 方法、路径、处理器、中间件列表、权限要求、API 版本、OpenAPI 描述
- 不绑定特定 HTTP 库，Router 输出标准的 RouteMatch 对象，由 Runtime 的 HTTP 适配器执行

#### 2.2.4 Event

**Laravel**：Event + Listener，支持事件订阅者、模型事件、通配符监听。事件同步分发，队列监听异步执行。

**Symfony**：EventDispatcher，支持事件优先级、停止传播、订阅者。请求生命周期全部通过事件驱动。

**NestJS**：EventEmitter 封装，支持 `@OnEvent()` 装饰器，异步事件。

**TLL OS 采纳**：
- 同步事件总线（Kernel 内部）+ 异步事件（通过 Queue 驱动）
- 事件优先级（数字越小越先执行）、可停止传播
- 事件订阅者（Subscriber）批量注册多个监听
- 事件必须是可序列化的（支持跨进程/跨服务传递）
- Kernel 生命周期事件：`kernel.booting` / `kernel.booted` / `kernel.request` / `kernel.response` / `kernel.exception` / `kernel.terminating`

#### 2.2.5 Module / Plugin 扩展机制

**Symfony Bundle**：Bundle 是完整的功能单元，有自己的配置、路由、服务、模板。Bundle 在 Kernel 中注册，支持安装/卸载。Bundle 之间通过容器服务和事件通信。

**NestJS Module**：`@Module()` 声明 providers/imports/exports/controllers。支持动态模块（`forRoot()`/`forFeature()`）、全局模块、模块重新导出。

**Django App**：App 通过 `INSTALLED_APPS` 注册，有自己的 models/views/urls/migrations。App 之间通过 model 引用和信号通信。

**Spring Boot Starter**：Starter 通过 SPI（`spring.factories`）自动配置，引入依赖即生效。Starter 是依赖级别的模块化，不是运行时可插拔的。

**TLL OS 采纳**：
- **Module**：第一方功能单元，随应用代码存在，在启动时注册。类似 Symfony Bundle + NestJS Module 的结合。Module 有完整的目录结构和 Manifest。
- **Plugin**：第三方可安装单元，运行时可安装/启用/禁用/卸载。Plugin 有独立的依赖管理、权限声明、沙箱边界。这是 TLL OS 超越传统框架的关键设计。
- Module 和 Plugin 共享相同的注册接口（Registerable），但生命周期和管理方式不同。

#### 2.2.6 CLI

**Artisan**：命令通过 `Command` 类定义，注册在 Console Kernel。支持参数、选项、交互、输出格式。命令可以调度（Schedule）。

**Nest CLI**：基于 Angular CLI，主要是代码生成（`nest g`），不是应用运行时命令。

**manage.py**：Django 的管理命令，App 可以注册自定义命令。

**TLL OS 采纳**：
- `tll` 是全局 CLI，同时支持项目内命令和全局命令
- 命令通过 `Command` 类定义，Module 和 Plugin 都可以注册命令
- 命令分类：`new`、`serve`、`module`、`plugin`、`route`、`migrate`、`test`、`cache`、`doctor`、`ai`
- CLI 输出结构化（支持 `--json` 输出），便于 AI Agent 解析

### 2.3 研究结论：TLL OS 的差异化定位

| 传统框架的局限 | TLL OS 的回应 |
|----------------|---------------|
| AI 无原生支持，需第三方库拼接 | AI Kernel 是一等公民，Agent 通过标准 Tool 操作框架 |
| 扩展机制弱（Package 即一切，无运行时插件） | Module + Plugin 双轨制，Plugin 支持运行时安装/沙箱/权限 |
| 框架与应用边界模糊（框架代码侵入应用） | Kernel 极简，只定义契约；应用逻辑全部在 Module/Plugin 中 |
| CLI 是辅助工具，不是一等接口 | CLI 与 HTTP API 对等，都是 Runtime 的入口，AI Agent 可通过 CLI 操作 |
| 测试需要大量 mock 框架内部 | Kernel 组件全部面向接口，可独立替换为测试实现 |

---

## 3. 技术选型

### 3.1 选型决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| **核心语言** | TypeScript 5.x | 1) AI-Native 生态最成熟（LLM SDK、Agent 框架均优先支持 TS/JS）；2) 类型系统为框架契约提供编译期保障；3) 全栈统一语言降低开发者认知负担；4) CLI 工具链成熟（Node.js 原生支持） |
| **运行时** | Node.js >= 20 LTS（Bun 兼容为后续目标） | 1) LTS 稳定性满足基础设施要求；2) 内置 `node:test`、`node:stream`、`node:http` 减少外部依赖；3) 全球开发者基数最大；4) Bun 兼容在 0.2 阶段评估 |
| **模块系统** | ESM（`"type": "module"`） | 1) 现代标准，支持 top-level await；2) 与 TypeScript 原生兼容；3) 动态 `import()` 支持 Plugin 运行时加载 |
| **HTTP 基础** | Node.js 内置 `node:http`（不使用 Express/Koa） | 1) Kernel 必须有自己的 HTTP 抽象，不绑定第三方框架；2) 内置模块零依赖、启动快；3) Runtime 层提供 HTTP 适配器，未来可替换为 uWebSockets 等高性能实现 |
| **DI 容器** | 自研（TLL Container） | 1) 必须支持 Plugin 动态注册/卸载；2) 需要服务作用域（Singleton/Request/Transient）；3) 传统 DI 库不满足 Plugin 隔离需求 |
| **路由** | 自研 Trie 树路由器 | 1) 性能优于正则集合；2) 支持路由元数据（权限、版本、OpenAPI）；3) 不绑定 Express 路由语义 |
| **测试** | Node.js 内置 `node:test` + `node:assert` | 1) 零外部依赖；2) 原生支持 ESM；3) Foundation 阶段不需要复杂测试框架 |
| **CLI 参数解析** | 自研极简解析器 | 1) CLI 是一等接口，需要完全控制输出格式和插件化命令；2) 不引入 commander/yargs |
| **配置** | `.env` + `config/*.ts` + 环境变量覆盖 | 1) 开发者熟悉的模式；2) TypeScript 配置文件提供类型安全；3) 支持多层级覆盖 |
| **日志** | 自研结构化 Logger | 1) 支持多种输出格式（human/JSON）；2) 支持通道和级别；3) AI Agent 可通过结构化日志解析运行状态 |
| **AI 提供商** | 抽象 LLMProvider 接口，默认 OpenAI 兼容实现 | 1) 不绑定特定模型提供商；2) OpenAI 兼容协议是行业事实标准；3) 后续可添加其他 Provider |
| **数据访问** | 抽象 Repository/DataSource 接口，Foundation 不内置具体 ORM | 1) 保持 Kernel 极简；2) 数据库驱动由 Module/Plugin 提供；3) 第一阶段提供内存实现用于测试 |
| **包管理** | npm（兼容 pnpm/yarn） | 1) Node.js 生态标准；2) Plugin 安装通过 npm 包机制 + TLL OS 注册流程 |

### 3.2 依赖策略

**Foundation 阶段的核心原则：零运行时依赖。**

TLL OS Kernel 的 `package.json` 中 `dependencies` 应为空。所有功能基于 Node.js 内置模块实现。

允许的开发依赖（`devDependencies`）：
- `typescript` —— 编译
- `@types/node` —— 类型定义
- `tsx` —— 开发时直接运行 TS（可选，用于 `tll serve` 开发模式）

这一策略确保：
1. Kernel 启动速度极快（无依赖加载）
2. 供应链攻击面最小
3. 框架体积最小
4. 未来可审计性最高

上层 Module/Plugin 可以自由引入依赖，Kernel 不限制。

### 3.3 不选择的技术及原因

| 技术 | 不选择原因 |
|------|-----------|
| PHP / Laravel 生态 | 用户明确要求不是 Laravel 换皮；PHP 的 AI 生态远弱于 TS |
| Python / Django | AI 生态强但 Web/CLI 全栈体验不如 TS 统一；异步模型复杂 |
| Java / Spring Boot | 启动慢、内存占用高、开发者体验重；不适合快速迭代的 AI-Native 框架 |
| Express / Koa / Fastify | 绑定第三方 HTTP 框架会丧失 Kernel 独立性；TLL OS 需要自己的 HTTP 抽象 |
| tsyringe / inversify | 不满足 Plugin 动态注册/卸载和隔离需求 |
| Jest / Mocha | Foundation 阶段不需要，`node:test` 足够且零依赖 |
| GraphQL | 第一阶段只实现最小 REST API，GraphQL 留到上层 Module |

---

## 4. 总体架构

### 4.1 分层架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │  Modules │ │ Plugins  │ │  Themes  │ │  User Application │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘  │
│       │             │             │                  │            │
├───────┴─────────────┴─────────────┴──────────────────┴────────────┤
│                         API Gateway Layer                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐     │
│  │   REST   │ │ OpenAPI  │ │WebSocket │ │     Webhook      │     │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘     │
├───────┴─────────────┴─────────────┴──────────────────┴────────────┤
│                          Runtime Layer                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  HTTP Runtime  │  CLI Runtime  │  AI Runtime  │  Queue Worker│   │
│  └────────────────┴───────────────┴──────────────┴──────────────┘   │
├───────────────────────────────────────────────────────────────────────┤
│                           Kernel Layer                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │Container│ │Router│ │Middleware│ │ Event │ │Config│ │ Cache │ │Queue│ │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                    │
│  │Scheduler│ │Logger│ │Validator│ │Security│ │  CLI  │                    │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                    │
├───────────────────────────────────────────────────────────────────────┤
│                           AI Kernel Layer                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │ Agent │ │ Tool │ │ Skill│ │Memory│ │Context│ │Workflow│ │ MCP  │ │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ │
├───────────────────────────────────────────────────────────────────────┤
│                        Foundation Primitives                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Interfaces  │  Types  │  Errors  │  Utils  │  Contracts   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

### 4.2 层间依赖规则

```
Application → API Gateway → Runtime → Kernel → Foundation Primitives
                                    ↘ AI Kernel ↗
```

- **上层可以依赖下层，下层不能依赖上层**
- **Kernel 不依赖 AI Kernel**，AI Kernel 通过 Kernel 的标准接口（Container/Event/Tool）挂载
- **Runtime 不依赖具体 Module/Plugin**，只依赖 Kernel 提供的注册接口
- **Module/Plugin 不直接依赖 Kernel 的具体实现**，只依赖 Kernel 暴露的接口契约

### 4.3 核心数据流：HTTP 请求生命周期

```
1. HTTP Runtime 接收请求
   ↓
2. 创建 Request Context（请求级 Container 作用域）
   ↓
3. 派发 kernel.request 事件
   ↓
4. Router 匹配路由 → RouteMatch
   ↓
5. 全局中间件 → 路由组中间件 → 路由中间件（洋葱模型）
   ↓
6. 路由处理器执行（Controller method / 闭包 / AI Agent handler）
   ↓
7. 派发 kernel.response 事件
   ↓
8. 中间件后处理（响应阶段）
   ↓
9. HTTP Runtime 发送响应
   ↓
10. 派发 kernel.terminating 事件（异步清理）
```

异常路径：任何阶段抛出异常 → 派发 `kernel.exception` 事件 → 异常处理器生成响应 → 继续步骤 8。

### 4.4 核心数据流：CLI 命令生命周期

```
1. tll <command> 启动进程
   ↓
2. 加载 .env 和配置
   ↓
3. 创建 Application（register 阶段）
   ↓
4. 发现并注册 Module → 注册 Module 命令
   ↓
5. 发现并注册已启用 Plugin → 注册 Plugin 命令
   ↓
6. boot 阶段
   ↓
7. CLI Runtime 解析命令 → 匹配 Command
   ↓
8. 执行 Command（可访问 Container/Event/Config 等）
   ↓
9. 输出结果
   ↓
10. 进程退出（exit code = Command 返回值）
```

### 4.5 核心数据流：AI Agent 操作流程

```
1. AI Runtime 接收任务（来自 HTTP / CLI / WebSocket / 定时触发）
   ↓
2. 创建 Agent Context（包含用户身份、会话、权限）
   ↓
3. Agent 加载可用 Tool 列表（基于权限过滤）
   ↓
4. LLM 推理 → 选择 Tool + 参数
   ↓
5. Tool 执行（通过 Kernel 标准接口操作 Module/Route/Service/DB/Command/Test）
   ↓
6. Tool 结果返回 Agent
   ↓
7. 重复 4-6 直到任务完成或达到最大步数
   ↓
8. Agent 输出最终结果
   ↓
9. 记录到 Memory（可选）
```

---

## 5. 目录结构

```
tll-os/
├── docs/                          # 架构文档
├── src/
│   ├── common/                    # 基础原语（接口、类型、错误、工具）
│   ├── kernel/                    # Kernel 层
│   │   ├── application/
│   │   ├── container/
│   │   ├── router/
│   │   ├── middleware/
│   │   ├── event/
│   │   ├── config/
│   │   ├── cache/
│   │   ├── queue/
│   │   ├── scheduler/
│   │   ├── logger/
│   │   ├── validator/
│   │   └── security/
│   ├── runtime/                   # Runtime 层
│   │   ├── http/
│   │   ├── cli/
│   │   └── context/
│   ├── module/                    # Module 系统
│   ├── plugin/                    # Plugin 系统
│   ├── api/                       # API 系统
│   ├── ai/                        # AI Kernel
│   ├── cli/                       # CLI 命令
│   └── testing/                   # 测试工具
├── tests/
│   ├── unit/
│   └── integration/
├── examples/
│   └── hello-world/
├── package.json
├── tsconfig.json
└── README.md
```

---

## 6. 最小成功标准（Phase 1 验收清单）

| # | 标准 | 验证方式 | 状态 |
|---|------|----------|------|
| 1 | `tll new my-app` 创建新项目 | CLI 命令执行 + 目录结构检查 | TODO |
| 2 | `tll serve` 启动项目，HTTP 端口可访问 | curl localhost:port 返回响应 | TODO |
| 3 | `tll make:module HelloWorld` 创建 Module | 目录结构 + Manifest 生成 | TODO |
| 4 | Module 自动注册并被 Kernel 发现 | `tll module:list` 显示已注册 | TODO |
| 5 | Module 暴露 REST API，可通过 HTTP 访问 | curl 返回 Module 定义的响应 | TODO |
| 6 | `tll make:plugin DemoPlugin` 创建 Plugin | 目录结构 + Manifest 生成 | TODO |
| 7 | Plugin 可安装和启用 | `tll plugin:install` + `tll plugin:enable` | TODO |
| 8 | CLI 可管理 Module 和 Plugin | list/enable/disable 命令可用 | TODO |
| 9 | 全部测试通过 | `tll test` 退出码 0 | TODO |
| 10 | 完整架构文档输出 | docs/ 下 12 份文档存在且内容完整 | 进行中 |

---

## 7. 架构决策记录（ADR）

### ADR-001：选择 TypeScript 作为核心语言
- **状态**：已采纳
- **背景**：TLL OS 需要 AI-Native、全栈统一、CLI 友好的语言
- **决策**：使用 TypeScript 5.x，Node.js >= 20 LTS
- **后果**：AI 生态集成顺畅；开发者基数大；需要处理 ESM/CJS 兼容

### ADR-002：Kernel 零运行时依赖
- **状态**：已采纳
- **背景**：基础设施框架的供应链安全和启动速度至关重要
- **决策**：Kernel 的 dependencies 为空，全部基于 Node.js 内置模块
- **后果**：需要自研 Container/Router/Event/CLI 解析器等；维护成本增加但可控

### ADR-003：自研 DI 容器而非使用 tsyringe/inversify
- **状态**：已采纳
- **背景**：Plugin 动态注册/卸载和隔离需求超出传统 DI 库能力
- **决策**：自研 TLL Container，支持服务作用域和 Plugin 隔离
- **后果**：需要完整实现 DI 功能；但完全可控，适配 Plugin 场景

### ADR-004：Trie 树路由而非正则集合
- **状态**：已采纳
- **背景**：路由性能和元数据支持是 API 系统的基础
- **决策**：自研基于 Trie 树的路由器
- **后果**：实现复杂度高于正则；但性能更好，支持路由元数据

### ADR-005：Module + Plugin 双轨制
- **状态**：已采纳
- **背景**：传统框架只有一种扩展机制，无法区分第一方模块和第三方插件
- **决策**：Module（第一方、启动时注册）+ Plugin（第三方、运行时可管理）
- **后果**：需要维护两套生命周期管理；但扩展能力远超传统框架

### ADR-006：AI Kernel 独立于 Kernel，通过标准接口挂载
- **状态**：已采纳
- **背景**：AI 是一等公民但不应污染 Kernel 的纯粹性
- **决策**：AI Kernel 作为独立层，通过 Container/Event/Tool 接口与 Kernel 交互
- **后果**：Kernel 保持极简；AI 能力可独立演进和替换

### ADR-007：不使用 Facade 静态代理
- **状态**：已采纳
- **背景**：Facade 模式引入全局状态，增加测试困难
- **决策**：全部通过 Container 接口或构造器注入获取服务
- **后果**：代码稍显冗长；但可测试性和可维护性更好

---

## 10. Protocol 2.0 架构收敛（2026-08-22）

经过 AI × AI 交叉架构审查、真实 Agent 独立开发实验验证，TLL OS 架构正式收敛为 Protocol 2.0。

### 核心定位升级

TLL OS 从"AI-Native 应用开发框架"升级为"**AI-Native 通用应用开发协议**"。

目标不是"做出一个优秀的框架"，而是建立一个能够被人类学习、被 Agent 理解、被成熟项目接入、被全球开发者扩展，并且能够通过全球 Agent 的真实实践持续进化的开放开发协议。

### 五个模型

Protocol 2.0 由五个模型组成：

| 模型 | 核心契约 |
|------|----------|
| 应用模型 | Application, Application Graph, Module, Plugin, Event, Permission |
| AI 开发模型 | Agent, Tool, Skill, Context, Workflow |
| 生态适配模型 | Adapter, Compatibility Manifest, Capability |
| 构建模型 | Projection, BuildTarget |
| 演进模型 | Evolution Proposal, TEP |

### 17 项核心契约

Application, Application Graph, Module, Plugin, Agent, Tool, Skill, Context, Permission, Workflow, Event, Adapter, Projection, BuildTarget, Capability, Compatibility Manifest, Evolution Proposal

### Application Graph 最终定位

**Application Graph 是 TLL OS 对应用结构、能力、依赖和关系进行机器可理解描述的主要事实来源。**

注意：是"主要事实来源"，不是"唯一事实来源"。复杂算法、UI 像素级实现、第三方库特殊用法、底层优化、语言特性等天然来自代码，不强迫全部 Graph 化。

### 关键架构决策

1. **Protocol 与 Runtime 分离**：Protocol 2.0 稳定，Runtime 0.x 持续演进。即使 Runtime 重写，Protocol 2.0 的应用和 Agent 仍然有效。
2. **不重复造轮子**：HTTP→Fastify, Database→Drizzle, Validation→Zod, Queue→BullMQ, Logging→Pino, Testing→Vitest。TLL OS 控制协议和模型，不控制底层实现。
3. **Kernel 极简**：Kernel 只做 Graph Runtime + Lifecycle + Contract Resolver + Event Bus。其他能力通过 Contract + Adapter 接入。
4. **Adapter 是一等概念**：连接外部系统，映射数据，支持迁移。Shopify/WordPress/Medusa 等成熟系统通过 Adapter 接入。
5. **Evolution Protocol (TEP)**：全球开发者和 Agent 共同发现、提案、验证、合入改进。框架不是只有核心维护者维护。

### 验证依据

Protocol 2.0 的冻结基于两个关键实验：

1. **hello-tll-agent PoC**：验证 Agent 只依赖 Public Contract 即可完成创建应用→测试→修复闭环。
2. **autonomous-task-manager 真实 Agent 实验**：验证 Agent 可以自主开发多模块应用（双模块、11 API、Tool、Agent、12 测试全通过），并发现了核心 Bug（路径参数未解析）。

### 权威文档

Protocol 2.0 的完整规范见 [`protocol/v2/SPECIFICATION.md`](../protocol/v2/SPECIFICATION.md)。

新增契约文档：[`CAPABILITY.md`](./CAPABILITY.md)、[`COMPATIBILITY.md`](./COMPATIBILITY.md)、[`ADAPTER.md`](./ADAPTER.md)、[`PROJECTION.md`](./PROJECTION.md)、[`EVOLUTION.md`](./EVOLUTION.md)。

### 下一步

Protocol 2.0 冻结后：
1. 部署 ts.knitoem.com 官方 Developer Hub
2. GitHub 正式开源
3. Runtime 0.2 开始大规模实现（Plugin、HTTP Adapter、CLI、真实 LLM 集成）
4. 全球开发者和 Agent 通过 TEP 共同演进

---

## 8. 风险与开放问题

| # | 风险/问题 | 影响 | 缓解策略 |
|---|-----------|------|----------|
| 1 | Plugin 沙箱在 Node.js 中实现复杂 | Plugin 可能访问全局状态 | 使用 Module 隔离 + 权限检查 + VM 上下文（后续阶段） |
| 2 | 自研组件质量可能不如成熟库 | 稳定性风险 | 充分测试 + 参考成熟实现的测试用例 |
| 3 | ESM 动态加载 Plugin 的兼容性 | 旧版 Node.js 不支持 | 要求 Node.js >= 20 |
| 4 | AI Tool 权限模型设计不足 | Agent 可能越权操作 | 第一阶段建立 Tool Contract 和 Permission 接口，具体策略后续细化 |
| 5 | 零依赖策略可能导致开发效率低 | 交付周期延长 | 严格限定 Foundation 范围，上层 Module/Plugin 可自由使用依赖 |

---

## 9. 第一轮架构审查修正（2026-08-22）

第一轮架构总审查通过，但带条件。以下 5 项修正已在架构加固阶段执行：

### 修正一：Runtime 解耦——TLL OS 不与 Node.js 永久绑定

**原设计**：TypeScript 5.x + Node.js ≥20 + ESM，Kernel 直接使用 Node.js 内置模块。

**修正后**：
```
TLL OS Protocol（与 Runtime 无关）
    ↓
TLL Application Model（与 Runtime 无关）
    ↓
TLL Runtime Adapter（抽象层）
    ├── Node.js Adapter（第一 Runtime）
    ├── Bun Adapter（未来）
    └── 其他 Runtime Adapter（未来）
```

TypeScript 是第一开发语言，不等于 Node.js 是 TLL OS 本身。详见 [`RUNTIME.md`](./RUNTIME.md)。

### 修正二：增加 Application Graph Contract（第 12 项核心 Contract）

**原设计**：11 项核心 Contract，缺少应用结构的统一地图。

**修正后**：增加 **Application Graph Contract**，成为 TLL OS 最重要的概念之一。

Application Graph 描述：
- Application / Modules / Plugins / APIs / Models / Events / Workflows / Agents / Tools / Skills / Permissions / Dependencies / Build Targets

目标：让任何 AI Agent 可以通过 Application Graph 理解一个 TLL OS 应用的完整结构。

详见 [`APPLICATION-GRAPH.md`](./APPLICATION-GRAPH.md)。

### 修正三：停止自研 Trie Router

**原设计**：自研基于 Trie 树的路由器。

**修正后**：定义 **TLL Router Contract**，底层实现可复用成熟组件。

```
TLL Router Contract
       ↓
Fastify Adapter / 其他 Router Adapter
```

TLL OS 控制的是 Contract，不是每个底层实现。Router 是成熟基础设施，不需要重复造轮子。

### 修正四：调整"零依赖"原则

**原设计**：Kernel 零运行时依赖，dependencies 为空。

**修正后**：原则调整为——

> **核心 Contract 最小化依赖 + 底层实现可替换 + 优先复用成熟开源组件。**

| TLL OS 定义 Contract | 底层实现可复用 |
|---------------------|----------------|
| HTTP Contract | Fastify / Express / uWebSockets |
| Router Contract | Fastify Router |
| Database Contract | Drizzle / Prisma / Knex |
| Queue Contract | BullMQ / NATS / Redis |
| Cache Contract | Redis / Memcached |
| Validation Contract | Zod / Valibot |
| Testing Contract | node:test / Vitest |
| Logging Contract | Pino / Winston |

TLL OS 必须自己实现的：Application Graph、Module/Plugin Lifecycle、Agent/Tool/Skill Contract、Developer-Agent Protocol、Container（支持 Plugin 动态隔离）、Permission System。

不为了"零依赖"牺牲安全、性能、可维护性、成熟生态、开发效率。

### 修正五：暂停大规模 Kernel 实现，先做 PoC

**原计划**：按 Container → Router → HTTP → Module → Plugin 顺序实现几十个组件。

**修正后**：先完成 **TLL OS Foundation 0.1 Proof of Concept**，验证 AI-Native 核心设计。

PoC 目标：让一个外部 Agent 通过 TLL OS Public Contract 完成完整开发闭环：
创建 Application → 读取 Graph → 创建 Module → 创建 API → 创建 Tool → 创建 Agent → 创建测试 → 运行测试 → 发现失败 → 分析修复 → 重测通过 → 完成。

**PoC 已完成并验证通过**。详见 [`examples/hello-tll-agent/`](../examples/hello-tll-agent/)。

### 修正后的 Contract 清单（13 项）

| # | Contract | 文档 |
|---|----------|------|
| 1 | Application Model | KERNEL.md |
| 2 | **Application Graph**（新增） | APPLICATION-GRAPH.md |
| 3 | Module Contract | MODULES.md |
| 4 | Plugin Contract | PLUGINS.md |
| 5 | Agent Contract | AI.md |
| 6 | Tool Contract | AI.md |
| 7 | Skill Contract | AI.md |
| 8 | AI Context Contract | AI.md |
| 9 | Permission Contract | SECURITY.md / AI.md |
| 10 | Workflow Contract | AI.md |
| 11 | Runtime Lifecycle | KERNEL.md / RUNTIME.md |
| 12 | Developer-Agent Protocol | AGENTS.md |
| 13 | **Runtime Adapter**（新增） | RUNTIME.md |

统一说明见 [`CONTRACTS.md`](./CONTRACTS.md)。

---

## 10. 下一步（修正后）

PoC 验证通过后，进入 **Foundation 0.2 阶段**：

1. 完善 Public Contract 层（类型、接口、文档）
2. 实现 Application Graph 完整功能（影响分析、ChangeSet、验证）
3. 实现 Runtime Adapter 完整接口（Node.js + Bun 适配）
4. 实现 Module 系统完整生命周期
5. 实现 Plugin 系统（安装/启用/禁用/卸载）
6. 实现 AI Kernel（Agent Runtime、Tool Registry、Context Builder）
7. 实现 CLI（`tll new` / `tll serve` / `tll module` / `tll plugin` / `tll test`）
8. 实现 API 系统（REST + OpenAPI + 认证授权）
9. 实现 Security（认证、授权、Plugin 沙箱、AI Agent 安全）
10. 实现 Testing 体系（测试基类、覆盖率、CI/CD）
11. 端到端验证最小成功标准
12. 真实 LLM 集成验证（用真实 AI Agent 替代脚本化 Agent）

> **PoC 已验证 TLL OS 的 AI-Native 核心设计成立。下一步是将 PoC 验证过的机制扩展为生产级 Foundation。**
