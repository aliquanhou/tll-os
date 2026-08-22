# TLL OS Foundation 0.1 — AI 独立架构评审报告

> **评审角色**：独立架构评审者（不代表原设计方立场）
> **评审范围**：TLL OS Foundation 0.1 全部架构设计 + PoC 验证结果
> **评审原则**：不为维护之前的设计而维护；可以否定现有方案；可以提出新 Contract；可以提出应删除的 Contract；可以提出不应由 TLL OS 自己实现的部分
> **评审日期**：2026-08-22
> **状态**：待交叉审查

---

## 一、核心判断（Executive Summary）

### TLL OS 最核心、最不可替代的东西是什么？

**不是框架，不是 Module 系统，不是 AI Kernel，而是 Application Graph。**

更准确地说：**Application Graph 作为整个应用的唯一事实来源（Single Source of Truth），代码是 Graph 的投影（Projection），而不是反过来。**

传统框架：代码 → 运行 → 应用。代码是事实来源。
TLL OS 应该是：Graph → 投影为代码 → 运行 → 应用。Graph 是事实来源。

这是 TLL OS 与所有现有框架的根本分野。如果 Graph 退化为"代码生成的元数据"或"架构图"，TLL OS 就失去了灵魂，变成又一个带 AI 插件的框架。

**PoC 验证了什么**：Agent 可以通过 Public Contract 创建应用、测试、修复。这证明了"公共标准层/内部实现层分离"是可行的。

**PoC 没有验证什么**：Graph 作为事实来源。当前 PoC 中，代码（调用 API 创建对象）是主动方，Graph 是被动记录方。这是方向正确但尚未完成的范式转换。

### 总体评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 战略方向 | ⭐⭐⭐⭐⭐ | AI-Native Runtime + 标准 + Agent 协议，方向正确 |
| Public Contract 分离 | ⭐⭐⭐⭐⭐ | PoC 证明 Agent 只依赖公开层即可工作，这是关键突破 |
| Application Graph 定位 | ⭐⭐⭐ | 概念正确，但当前是被动元数据，未成为事实来源 |
| 架构边界清晰度 | ⭐⭐⭐ | Kernel/Module/Plugin/Adapter/Application/Agent 六者边界有模糊地带 |
| 避免重复造轮子 | ⭐⭐⭐⭐ | 原则已调整，但尚未落到具体"吸收哪些成熟项目"的决策 |
| Compatibility Layer | ⭐ | 完全缺失，这是最大的架构空白 |
| 多目标构建 | ⭐⭐ | 概念提及，未形成 Contract |
| Agent 自维护 | ⭐ | 概念提及，未形成协议 |
| 生产就绪度 | ⭐⭐ | PoC 级，距离生产级 Foundation 还有大量工作 |

---

## 二、15 个关键问题的独立回答

### Q1. TLL OS 最核心、最不可替代的东西到底是什么？

**Application Graph 作为应用的唯一事实来源。**

展开说：
- Graph 不是"架构图"，不是"元数据"，不是"文档"。
- Graph 是应用本身。代码、配置、数据库 Schema、API 文档、测试，都是 Graph 的投影。
- 你可以从 Graph 重新生成全部代码。你也可以通过修改代码来更新 Graph（双向同步）。
- Agent 不需要读代码就能理解应用——它读 Graph。
- Agent 修改应用不需要写代码——它修改 Graph，然后 Graph 投影为代码。

如果 TLL OS 做不到这一点，它就没有不可替代性。Fastify + Drizzle + Zod + 一堆 AI 工具就能替代它。

### Q2. Application Graph 是否应该成为核心基础设施？目前设计还缺什么？

**是，而且应该是唯一的核心基础设施。Kernel 的其他组件都应该围绕 Graph 组织。**

当前设计的缺失：

| 缺失项 | 严重程度 | 说明 |
|--------|----------|------|
| **Graph 不是事实来源** | 🔴 致命 | 当前代码创建 Graph 节点，应该反过来：Graph 定义应用，代码是投影 |
| **缺少 Projection 系统** | 🔴 致命 | Graph → 代码、Graph → OpenAPI、Graph → DB Schema、Graph → 测试，完全缺失 |
| **缺少 Node Schema 系统** | 🟠 高 | 15 种节点类型是松散定义的，没有严格的 Schema 校验。节点应该有必填字段、约束、继承关系 |
| **缺少 Graph 版本控制** | 🟠 高 | Graph Schema 本身需要版本化。Graph 状态的历史/回滚/差异对比缺失 |
| **缺少约束验证引擎** | 🟠 高 | "API 必须属于某个 Module"、"Agent 调用的 Tool 必须存在"这类约束没有自动验证 |
| **缺少联邦/组合机制** | 🟡 中 | Plugin 的 Graph 如何与 Application Graph 组合？所有权、冲突解决、隔离边界缺失 |
| **缺少时间维度** | 🟡 中 | Graph 只描述当前状态，不描述演化历史。Agent 无法知道"这个 Module 什么时候加的、为什么加" |
| **节点类型不全** | 🟡 中 | 缺少：Data Model/Entity、Migration、View/UI Component、Cron Job、Webhook、Config/Settings、Secret、Build Target、Deployment、Environment |

**关键架构决策建议**：Graph 应该有自己的 Schema 定义语言（可以是 JSON Schema + TypeScript 类型），每种节点类型有严格的 Schema。Graph 的变更应该通过 ChangeSet 提交，ChangeSet 经过约束验证后才能应用。

### Q3. 当前 Public Contract 是否真正足以让"完全不了解 TLL OS 的外部 Agent"开发完整应用？

**不足。差距很大。**

PoC 中的 Agent 是"了解 TLL OS 的 Agent"——它知道要调用 `createTllOS()`、`app.modules.create()`、`greetingModule.apis.create()`。一个完全不了解 TLL OS 的 Agent 做不到这些。

缺失的关键能力：

| 缺失能力 | 说明 |
|----------|------|
| **Contract 发现协议** | Agent 如何知道有哪些 Contract、每个 Contract 有什么方法？需要 `tll contracts list` / `app.contracts.describe(name)` 这种自省 API |
| **项目结构协议** | Agent 创建文件时，文件应该放哪里？标准目录结构是什么？需要 Project Layout Contract |
| **代码生成协议** | Agent 如何写实际代码文件？当前 PoC 是内存对象，真实应用需要磁盘文件。需要 Code Generation Contract |
| **构建/运行协议** | Agent 如何构建和运行应用？`tll build` / `tll serve` 的标准接口 |
| **依赖管理协议** | Agent 如何添加 npm 包？如何声明 Module 依赖？ |
| **错误诊断协议** | 操作失败时，Agent 如何获取结构化的错误信息和修复建议？ |
| **迁移/修改协议** | Agent 如何安全地修改已有 Module？需要 ChangeSet + 影响分析 + 回滚 |
| **交互式引导** | 完全不了解的 Agent 需要"我想做 X，应该用哪些 Contract"的引导能力 |

**建议**：增加 `Developer-Agent Protocol` 的具体子协议，包括 Discovery、Project Layout、Code Generation、Build、Dependency、Error Recovery、Migration。当前的 Developer-Agent Protocol 太抽象，没有可执行的接口定义。

### Q4. Agent Development Protocol 还缺什么？

当前 Agent Development Protocol 基本是概念性的，缺少可执行的协议定义。具体缺失：

| 缺失协议 | 说明 |
|----------|------|
| **Agent 能力声明** | Agent 应该声明自己能做什么（代码生成、测试、调试、部署等），TLL OS 根据能力分配任务 |
| **任务规范格式** | 标准的 Task Specification（JSON Schema），描述"做什么、约束、验收标准" |
| **Plan-Execute-Verify 循环协议** | Agent 接任务后 → 生成计划 → 执行 → 验证 → 迭代，每个阶段有标准接口 |
| **多 Agent 协作协议** | 多个 Agent 如何分工、通信、交接？需要 Message Bus + Task Queue + 状态同步 |
| **Human-in-the-Loop 协议** | 哪些操作需要人类批准？批准/拒绝/修改的标准接口 |
| **回滚协议** | Agent 的修改如何回滚？ChangeSet + Snapshot + Undo |
| **测试协议** | Agent 写测试的标准方式：测试模板、覆盖率要求、测试结果格式 |
| **调试协议** | Agent 诊断失败的标准方式：读取日志、复现、定位、修复 |
| **知识检索协议** | Agent 如何查询 TLL OS 文档、Contract、示例？标准的 RAG 接口 |
| **Agent 身份与权限** | Agent 有身份、权限范围、操作审计。不是所有 Agent 都能做所有操作 |

**关键建议**：Agent Development Protocol 不应该是一个 Contract，而应该是一组子协议的集合。先实现最核心的 3 个：Task Specification、Plan-Execute-Verify、Human-in-the-Loop。

### Q5. 我们是否正在重复造轮子？哪些能力应该直接复用成熟开源项目？

**是，有重复造轮子的风险。特别是 Kernel 的 15 组件设计，大部分不需要自己实现。**

TLL OS 应该自己实现的（不可替代的核心）：
- Application Graph（事实来源 + Projection + 约束验证）
- Module/Plugin 生命周期（与 Graph 集成）
- Agent/Tool Contract（与 Graph 集成）
- Developer-Agent Protocol
- Compatibility Layer / Adapter System
- Project 脚手架和 Graph → 代码投影

TLL OS **不应该**自己实现的（直接复用成熟项目）：

| 能力 | 推荐成熟项目 | 理由 |
|------|-------------|------|
| HTTP Server / Router | **Fastify** 或 **Hono** | 成熟、高性能、TypeScript 友好。TLL OS 只定义 HTTP Contract，用 Adapter 接入 |
| ORM / Database | **Drizzle ORM** | TypeScript-native、SQL-first、轻量。TLL OS 定义 Data Model Contract，Drizzle 做投影 |
| 验证 | **Zod** | 事实标准。TLL OS 的节点 Schema、Config Schema、API 请求验证都用 Zod |
| 队列 | **BullMQ**（Redis）或 **NATS** | 成熟。TLL OS 定义 Queue Contract |
| 缓存 | **Redis** / **Upstash** | 不需要自己造 |
| 日志 | **Pino** | 高性能、结构化日志 |
| 测试 | **Vitest** | TypeScript 友好、快 |
| CLI 框架 | **Citty** 或 **Clipanion** | 不需要自己写命令解析 |
| 配置 | **dotenv** + Zod 校验 | 标准做法 |
| 认证 | **Lucia** 或 **Auth.js** | 成熟。TLL OS 定义 Auth Contract |
| API 文档 | **Scalar** + Zod-to-OpenAPI | 从 Schema 自动生成文档 |
| 文件监听 / HMR | **Vite** 或 **chokidar** | 不需要自己造 |
| DI 容器 | **不需要** | AI-Native 架构中，Graph 就是依赖解析器。传统 DI 容器是多余的 |

**关键架构决策**：TLL OS 的 `dependencies` 不应该是空的。它应该明确依赖 Fastify、Drizzle、Zod、Pino、Vitest 等成熟项目。TLL OS 的价值在于把这些项目通过 Application Graph 和 Agent Protocol 组织成一个 AI-Native 开发体验，而不是重新实现它们。

### Q6. 如何设计 Compatibility Layer / Adapter System？

**这是 TLL OS 当前最大的架构空白，也是决定 TLL OS 能否成功的关键之一。**

如果没有 Compatibility Layer，TLL OS 最终会变成"我们自己又造了一套商城/CMS/ERP"，这恰恰违背最初战略。

#### Adapter 与 Module/Plugin 的区别

| 概念 | 本质 | 生命周期 | 示例 |
|------|------|----------|------|
| Module | 原生业务逻辑，打包为 Graph 节点 | 随应用发布 | 博客模块、用户模块 |
| Plugin | 运行时安装的第三方代码，有沙箱和权限 | 安装/启用/禁用/卸载 | SEO 插件、分析插件 |
| **Adapter** | **连接外部系统，映射外部概念到/从 Graph** | 配置/连接/同步/断开 | Shopify Adapter、WordPress Adapter |

Adapter 不是 Module，也不是 Plugin。Adapter 是 TLL OS 与外部世界的桥梁。

#### Adapter Contract 设计

```
AdapterManifest
├── name, version, description
├── externalSystem: { name, version, apiType }
├── capabilities: [read, write, sync, migrate]
├── entityMappings: [
│   { external: "Product", tllNodeType: "model", tllNodeSchema: "..." }
│   { external: "Order", tllNodeType: "model", tllNodeSchema: "..." }
│ ]
├── permissions: [...]
└── configSchema: { ... }  // Zod Schema

AdapterLifecycle
├── configure(config) → 验证配置，建立连接
├── connect() → 连接外部系统
├── disconnect() → 断开
├── read(entityType, filter) → 从外部读取，映射为 Graph 节点
├── write(entityType, graphNode) → 将 Graph 节点写入外部系统
├── sync(entityType, direction) → 双向同步
├── migrate(entityType, options) → 从外部系统迁移到原生 Module
└── healthCheck() → 连接状态

AdapterPermission
├── 只读 / 只写 / 读写
├── 可操作的实体类型白名单
├── 数据转换规则（外部字段 → TLL 字段）
└── 冲突解决策略（external-wins / tll-wins / manual）
```

#### 迁移是一等操作

Adapter 最重要的能力不是"连接 Shopify"，而是**"从 Shopify 迁移到 TLL OS 原生 Module"**。

迁移流程：
1. Adapter 读取外部系统数据，映射为 Graph 节点
2. Agent 分析 Graph，生成原生 Module 代码投影
3. 运行测试验证数据一致性
4. 切换流量到原生 Module
5. 断开 Adapter

这样 TLL OS 可以吸收任何成熟系统的数据和业务逻辑，而不是重新发明它们。

#### 建议优先实现的 Adapter

| 优先级 | Adapter | 理由 |
|--------|---------|------|
| P0 | **Shopify Adapter** | 电商事实标准，最大的迁移来源 |
| P0 | **WordPress Adapter** | CMS 事实标准，最大的内容迁移来源 |
| P1 | **Medusa Adapter** | 开源电商，技术栈接近（TypeScript） |
| P1 | **Strapi Adapter** | 开源 CMS，TypeScript |
| P2 | **Shopware / Bagisto / Aimeos** | 其他电商系统 |
| P2 | **ERP 系统（Odoo / ERPNext）** | 企业资源管理 |

### Q7. TLL OS 如何支持不同 Application Target？

**核心思路：Application Graph 是目标无关的，Build Target 是 Graph 的投影。**

```
Application Graph（唯一事实来源，目标无关）
       ↓
BuildTarget Contract（投影协议）
       ↓
┌─────────┬─────────┬─────────┬─────────┬──────────┬──────────┬────────────┐
↓         ↓         ↓         ↓         ↓          ↓          ↓            ↓
Web       H5        APK       EXE       小程序     AI Agent   工业软件
(PWA/SPA) (移动端)  (RN/Expo) (Electron/ (微信/    (Headless/ (PLC/SCADA/
                              Tauri)    支付宝)    MCP)       边缘计算)
```

#### BuildTarget 是 Graph 节点类型

每个 Application 在 Graph 中声明它支持哪些 Build Target：

```
Graph Node: BuildTarget
├── type: "build_target"
├── name: "web"
├── platform: "browser"
├── capabilities: ["http", "dom", "localStorage", "serviceWorker"]
├── projection: "@tll/projection-web"
└── config: { ... }
```

#### Projection Contract

每个 Build Target 有一个 Projection 模块，负责将 Graph 投影为目标特定的代码和配置：

```
ProjectionContract
├── project(graph, targetConfig) → 生成目标代码/配置
├── validate(graph, targetConfig) → 验证 Graph 是否支持该目标
├── capabilityMatrix() → 返回该目标支持/不支持的能力
└── devServer(graph, targetConfig) → 启动开发服务器
```

#### 能力矩阵（Capability Matrix）

不是所有功能在所有目标上都可用。例如：
- 小程序不支持文件系统、不支持 Service Worker
- AI Agent（Headless）不支持 UI 组件
- 工业软件需要实时性、确定性

TLL OS 应该在 Graph 中声明每个节点需要什么能力，Projection 时检查目标是否满足。不满足时给出明确的降级或错误。

#### TLL OS 不需要自己实现所有目标

TLL OS 只需要：
1. 定义 BuildTarget Contract 和 Projection Contract
2. 提供 Web/API 目标的参考实现（第一个目标）
3. 其他目标由社区或第三方通过 Adapter/Projection 模块实现

#### 关键建议

- **Web/API 是第一个目标**，必须做到生产级
- **APK/EXE 通过 Electron/Tauri/React Native 包装 Web 层**，不需要原生重写
- **小程序通过适配层**（如 Taro/uniapp 的思路），但 TLL OS 定义自己的 Projection Contract
- **AI Agent 目标是 Headless 模式**，没有 UI，只有 API + Tool + Graph
- **工业软件目标需要实时运行时**，这是长期目标，第一阶段不碰

### Q8. Kernel、Module、Plugin、Adapter、Application、Agent 六者边界是否清晰？

**不清晰。有几个关键模糊地带需要重新定义。**

#### 当前问题

1. **Kernel vs Core**：原始设计有 15 个 Kernel 组件，PoC 实现叫 Core。两者关系不清。
2. **Module vs Plugin**：概念上 Module 是原生的、Plugin 是第三方的，但能力上几乎一样。边界模糊。
3. **Adapter 不存在**：当前 13 个 Contract 中没有 Adapter Contract。
4. **AI Kernel 是多余的分层**：AI 不应该是一个独立的 Kernel 组件。AI 操作 Graph，Agent/Tool/Skill 是 Graph 中的节点类型。
5. **Application 只是 Graph 的容器**：Application 的概念需要更精确——它是一个 Graph 实例 + 配置 + 运行时状态。

#### 重新定义的边界

```
┌─────────────────────────────────────────────────────────┐
│                    Kernel（引擎层）                       │
│  职责：Graph 运行时 + 生命周期 + Contract 解析 + 事件总线  │
│  不包含：HTTP、数据库、队列、缓存、路由、验证               │
│  这些都通过 Contract + Adapter 接入                        │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│                  Application（实例层）                     │
│  职责：一个 Graph 实例 + 配置 + 运行时状态                  │
│  一个 Kernel 可以运行多个 Application（理论上）             │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌──────────┬───────────┬───────────┬──────────────────────┐
↓          ↓           ↓           ↓                      ↓
Module    Plugin      Adapter     Agent                  (Graph Nodes)
(原生代码) (第三方代码) (外部连接)  (自主执行者)
```

#### 精确定义

| 概念 | 定义 | 关键特征 | 示例 |
|------|------|----------|------|
| **Kernel** | 运行 Graph 的引擎。只做 4 件事：Graph 运行时、生命周期、Contract 解析、事件总线 | 极小、稳定、零业务逻辑 | GraphEngine、LifecycleManager、ContractResolver、EventBus |
| **Application** | 一个 Graph 实例 + 配置 + 运行时状态 | 有独立的 Graph、Config、State | "我的博客"、"客户 A 的商城" |
| **Module** | 随应用发布的原生业务逻辑，打包为一组 Graph 节点 | 代码在应用仓库中，无沙箱，完全信任 | 用户模块、博客模块、订单模块 |
| **Plugin** | 运行时从外部源安装的代码，有沙箱和权限控制 | 代码不在应用仓库中，有沙箱，权限受限 | SEO 插件、支付插件、分析插件 |
| **Adapter** | 连接外部系统，映射外部概念到/从 Graph | 不包含业务逻辑，只做数据映射和连接 | Shopify Adapter、WordPress Adapter |
| **Agent** | 读取/修改 Graph、使用 Tool、执行 Workflow 的自主实体 | 有身份、权限、操作审计 | 开发 Agent、测试 Agent、运维 Agent |

#### 关键架构决策

1. **删除"AI Kernel"这个分层**：AI 不是 Kernel 组件。Agent/Tool/Skill 是 Graph 中的节点类型，Kernel 不需要知道 AI 的存在。
2. **Module 和 Plugin 的区别是分发方式，不是能力**：Module 随应用发布（代码在仓库中），Plugin 运行时安装（代码从外部源加载）。两者能力相同，但 Plugin 有沙箱和权限。
3. **Adapter 是独立的一等概念**：需要增加 Adapter Contract（第 14 个 Contract）。
4. **Kernel 应该极简**：从 15 个组件缩减到 4 个核心组件。其他能力通过 Contract + Adapter 接入。

### Q9. 如何让 GitHub Repository 同时成为"人类教材"和"AI Agent 可执行教材"？

**核心原则：文档、示例、测试、Contract 四位一体，机器可读，人类可理解。**

#### 仓库结构设计

```
tll-os/
├── contracts/              # Contract 定义（TypeScript 类型 + JSON Schema）
│   ├── application.graph.ts
│   ├── module.ts
│   ├── plugin.ts
│   ├── adapter.ts
│   ├── agent.ts
│   └── ...
├── docs/                   # 人类可读文档
│   ├── getting-started/
│   ├── concepts/
│   ├── guides/
│   └── reference/          # 从 contracts/ 自动生成
├── examples/               # 可执行示例（每个示例也是测试）
│   ├── hello-tll-agent/
│   ├── blog-module/
│   ├── shopify-migration/
│   └── ...
├── tests/                  # 测试（也是最可靠的文档）
│   ├── contracts/          # Contract 一致性测试
│   ├── kernel/
│   ├── integration/
│   └── e2e/
├── rfc/                    # RFC 提案
│   ├── 0001-application-graph.md
│   ├── 0002-adapter-system.md
│   └── ...
├── schemas/                # JSON Schema（配置、Manifest、Task 等）
│   ├── module-manifest.json
│   ├── plugin-manifest.json
│   ├── adapter-manifest.json
│   └── task-specification.json
├── projections/            # Graph → 代码投影器
│   ├── web/
│   ├── openapi/
│   └── drizzle/
└── .tll/                   # AI Agent 专用配置
    ├── agent-knowledge.json   # Agent 学习索引
    ├── capability-matrix.json # 能力矩阵
    └── review-checklist.json  # AI Review 检查清单
```

#### 机器可读文档

每个文档有 YAML frontmatter：

```yaml
---
title: "Application Graph 概念"
contract: "application-graph"
version: "1.0.0"
status: "stable"  # stable | beta | draft | deprecated
examples: ["examples/hello-tll-agent"]
tests: ["tests/contracts/application-graph.test.ts"]
related: ["module", "plugin", "agent"]
---
```

Agent 可以通过 frontmatter 快速定位相关 Contract、示例、测试。

#### 示例即测试

每个 `examples/` 目录下的示例同时是一个可运行的测试。Agent 可以：
1. 阅读示例代码理解概念
2. 运行示例验证行为
3. 修改示例做实验
4. 查看测试断言理解预期行为

#### Contract 即文档

`contracts/` 目录下的 TypeScript 类型是 Contract 的权威定义。`docs/reference/` 从类型自动生成，不会出现"文档和代码不一致"的问题。

#### Agent 学习索引

`.tll/agent-knowledge.json` 是一个结构化索引，告诉 Agent：
- 有哪些 Contract，每个 Contract 的状态和版本
- 每个 Contract 对应的文档、示例、测试路径
- 常见任务的推荐 Contract 组合
- 已知的陷阱和最佳实践

Agent 第一次接触 TLL OS 时读取这个索引，就知道从哪里开始学习。

### Q10. 如何让 Agent 自动读取 Contract、Schema、Docs、Examples、Tests 并学习 TLL OS？

#### `tll learn` 命令

TLL OS CLI 提供 `tll learn` 命令，Agent 运行后获得结构化的 TLL OS 知识包：

```
$ tll learn --format json --depth comprehensive

{
  "contracts": [
    {
      "name": "application-graph",
      "version": "1.0.0",
      "status": "stable",
      "description": "...",
      "types": [...],        // 从 TypeScript 类型提取
      "methods": [...],      // 接口方法列表
      "examples": [...],     // 示例代码片段
      "tests": [...],        // 测试用例摘要
      "commonMistakes": [...]
    },
    ...
  ],
  "taskPatterns": [
    {
      "task": "创建一个新 Module",
      "steps": [...],
      "contracts": ["module", "application-graph"],
      "example": "examples/blog-module"
    },
    ...
  ],
  "architecture": { ... }
}
```

#### 运行时自省 API

Application 实例提供 Contract 自省：

```typescript
app.contracts.list()           // 列出所有 Contract
app.contracts.describe(name)   // 获取某个 Contract 的详细信息
app.graph.schema()             // 获取 Graph Node Schema
app.capabilities()             // 获取当前应用的能力矩阵
```

Agent 不需要读源码，通过这些 API 就能了解 TLL OS 的能力。

#### 渐进式学习

Agent 不需要一次性学习所有 Contract。学习路径：
1. **核心 3 个**：Application Graph、Module、Agent（能创建基本应用）
2. **进阶 3 个**：Plugin、Adapter、Tool（能扩展和集成）
3. **专业**：Workflow、Permission、BuildTarget 等（按需学习）

`tll learn --depth core` 只输出核心 Contract，减少认知负担。

#### 验证学习效果

Agent 学习后，可以通过 `tll learn --verify` 运行一组"理解测试"：
- 给出一个任务描述，Agent 选择正确的 Contract
- 给出一段代码，Agent 识别它用了哪些 Contract
- 给出一个错误，Agent 选择正确的修复方向

这确保 Agent 真正理解了 TLL OS，而不是只是读了文档。

### Q11. 如何让 Agent 参与 TLL OS 自身的 Bug 修复、测试、RFC、PR 和版本迭代？

#### Agent 自维护协议

TLL OS Repository 本身就是一个 TLL OS Application（自举）。Agent 可以通过标准协议操作它：

```
TLL OS Repository（自身就是一个 Application）
       ↓
Agent 读取 Graph + Contract + Docs + Tests + Examples
       ↓
发现问题（Bug / 缺失测试 / 文档过时 / Contract 不一致）
       ↓
生成 RFC（新 Contract / 重大变更）或 PR（Bug 修复 / 测试补充）
       ↓
AI Review（另一个 Agent 审查）
       ↓
Human Review（人类决策层审查）
       ↓
Merge → 自动版本号 → 发布
```

#### 标准化的 Agent PR 模板

每个 Agent 提交的 PR 必须包含：

```markdown
## PR 类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 测试补充
- [ ] 文档更新
- [ ] Contract 变更（需要 RFC）
- [ ] 重构

## Graph 影响分析
- 影响的 Node 类型：[...]
- 影响的 Edge 类型：[...]
- 是否有 Breaking Change：是/否
- 兼容性评估：[...]

## 测试
- 新增测试：[...]
- 测试结果：全部通过 / 有失败
- 覆盖率变化：+X%

## 自检清单
- [ ] Contract 类型已更新
- [ ] 文档已更新
- [ ] 示例已更新（如需要）
- [ ] 无重复造轮子
- [ ] 遵循架构边界
```

#### AI Review Pipeline

PR 提交后，自动触发 AI Review：
1. **Contract 一致性检查**：代码实现是否与 Contract 类型一致？
2. **架构边界检查**：是否有越界操作？（如 Module 直接操作 Kernel 内部）
3. **测试充分性检查**：新代码是否有足够测试？
4. **重复造轮子检查**：是否有成熟开源项目可以替代？
5. **安全检查**：是否有安全漏洞？

AI Review 不通过的 PR 不进入 Human Review。

#### `tll doctor` — Agent 自诊断

Agent 可以运行 `tll doctor` 扫描 TLL OS 自身的健康状况：
- Contract 实现覆盖率（哪些 Contract 只有类型没有实现）
- 测试覆盖率
- 文档与代码一致性
- 依赖过时检查
- 已知 Issue 扫描
- 性能基准对比

`doctor` 输出结构化报告，Agent 可以基于报告自动创建修复 PR。

#### RFC 流程

任何 Contract 变更或重大架构变更需要 RFC：
1. Agent 在 `rfc/` 目录创建提案（使用标准模板）
2. 社区讨论（人类 + AI）
3. AI Review（技术可行性）
4. Human Decision（人类决策层批准/拒绝）
5. 批准后进入实现阶段
6. 实现完成后 RFC 状态变为 "active"

#### 版本迭代

- Agent 分析 PR 内容，自动建议 SemVer 版本号（patch/minor/major）
- Breaking Change 需要 Migration Guide
- 每个版本有 Changelog（自动生成 + 人工审核）
- LTS 版本每 N 个 minor 版本一个，支持 12 个月

### Q12. 如何设计 LTS、Breaking Change、RFC、Compatibility Policy？

#### 版本策略

```
TLL OS 版本号：MAJOR.MINOR.PATCH
- MAJOR：不兼容的 Contract 变更
- MINOR：新增 Contract / 功能，向后兼容
- PATCH：Bug 修复，向后兼容

Graph Schema 版本：独立于 TLL OS 版本
- graph-schema-1.0.0, graph-schema-1.1.0, ...
- Graph Schema 变更有自己的 RFC 和兼容性策略
```

#### Contract 状态生命周期

```
draft → beta → stable → deprecated → removed
  │       │       │          │           │
  │       │       │          │           └─ 下一个 MAJOR 版本删除
  │       │       │          └─ 保留 2 个 MINOR 版本，有替代方案
  │       │       └─ 承诺不做 Breaking Change（除非安全漏洞）
  │       └─ 可能有 Breaking Change，但需要 Migration Guide
  └─ 随时可能变更
```

每个 Contract 在类型定义和文档中标注状态：

```typescript
/**
 * Application Graph Contract
 * @status stable
 * @version 1.0.0
 * @since 0.1.0
 */
export interface ApplicationGraph { ... }
```

#### Breaking Change 策略

1. **任何 stable Contract 的 Breaking Change 需要 RFC**
2. **Deprecated Contract 保留 2 个 MINOR 版本**后才删除
3. **每个 Breaking Change 必须有自动化迁移工具**（`tll migrate --from 0.1 --to 0.2`）
4. **Breaking Change 在 MAJOR 版本中发布**
5. **Graph Schema 的 Breaking Change 有独立的迁移路径**

#### Compatibility Policy

| 兼容维度 | 策略 |
|----------|------|
| Contract 兼容 | stable Contract 在 MAJOR 版本内保持兼容 |
| Graph Schema 兼容 | Graph Schema 有版本号，旧版本 Graph 可以自动升级 |
| Adapter 兼容 | Adapter 声明支持的 TLL OS 版本范围，超出范围给出警告 |
| Plugin 兼容 | Plugin Manifest 声明支持的 TLL OS 版本和 Contract 版本 |
| Runtime 兼容 | Node.js ≥20，Bun（未来），其他 Runtime 通过 Adapter |
| 投影兼容 | Projection 模块声明支持的 Graph Schema 版本 |

#### LTS 策略

- 每 4 个 MINOR 版本选一个为 LTS（如 0.4、0.8、1.0）
- LTS 版本支持 12 个月的 Bug 修复和安全更新
- LTS 版本不添加新功能
- 企业用户建议使用 LTS 版本

#### RFC 流程（详细）

```
1. 提案：在 rfc/ 目录创建 0000-xxx.md（使用模板）
2. 讨论：至少 7 天公开讨论期（人类 + AI）
3. AI Review：技术可行性、架构一致性、重复造轮子检查
4. Human Decision：人类决策层投票（批准 / 拒绝 / 需要修改）
5. 实现：批准后分配实现者（人类或 Agent）
6. 验证：实现完成后运行完整测试 + Contract 一致性检查
7. 发布：随下一个 MINOR/MAJOR 版本发布
8. 状态：RFC 变为 "active"，记录在案
```

RFC 模板包含：背景、目标、非目标、设计方案、替代方案、兼容性影响、迁移策略、测试计划、开放问题。

### Q13. 如果现在重新设计 Foundation 0.1，你会推翻哪些现有设计？

**以下是我会明确推翻或重大修改的设计：**

#### 🔴 推翻：Kernel 有 15 个组件

**原设计**：Kernel 包含 Application、Container、Router、Middleware、Event、Config、Cache、Queue、Scheduler、Logger、Validator、Security、CLI 等 15 个组件。

**问题**：这是传统框架的思路。TLL OS 的 Kernel 应该极简，大部分能力通过 Contract + Adapter 接入。

**新设计**：Kernel 只做 4 件事：
1. **Graph Runtime**：Graph 的存储、查询、变更、验证
2. **Lifecycle**：Application/Module/Plugin 的启动/停止/升级
3. **Contract Resolver**：Contract 的注册、发现、版本管理
4. **Event Bus**：事件的发布/订阅

其他一切（HTTP、数据库、队列、缓存、路由、验证、日志）都不是 Kernel，而是通过 Contract 接入的 Adapter 或 Module。

#### 🔴 推翻："AI Kernel"作为独立分层

**原设计**：AI Kernel 是 Kernel 的一个组件，包含 Agent、Tool、Skill、Memory、Context、Workflow、MCP、Permission、Task。

**问题**：AI 不应该是一个独立的子系统。AI 操作 Graph，Agent/Tool/Skill 是 Graph 中的节点类型。把 AI 独立成一个 Kernel 组件，会导致"AI 和应用是两张皮"。

**新设计**：删除"AI Kernel"分层。Agent/Tool/Skill 是 Graph Node 类型，和 Module/API/Model 平等。Kernel 不需要知道 AI 的存在。Agent Development Protocol 是独立的协议层，不是 Kernel 组件。

#### 🔴 推翻：Module 有 Controller/Service/Model 结构

**原设计**：每个 Module 包含 Controller、Service、Model、Routes、Events、Commands、Config、Migrations、Tests、Resources。

**问题**：这是传统 MVC 模式。AI-Native 架构中，Module 不应该由文件结构定义，而应该由 Graph 节点定义。

**新设计**：Module 是"一组有共同所有者的 Graph 节点"。Module 的内容由 Graph 决定，不是由目录结构决定。代码投影可以生成任何结构，但 Module 的定义是 Graph 中的一组节点，有共同的 `owner: "module:xxx"` 属性。

#### 🟠 重大修改："零运行时依赖"原则

**原设计**：Kernel 零运行时依赖，`dependencies: {}`。

**问题**：已经调整为"核心 Contract 最小化依赖"，但还不够。应该明确拥抱成熟依赖。

**新设计**：TLL OS 明确依赖 Fastify（HTTP）、Drizzle（数据库）、Zod（验证）、Pino（日志）、Vitest（测试）等成熟项目。`dependencies` 不是空的，而是精心选择的成熟项目集合。TLL OS 的价值在于通过 Graph 和 Agent Protocol 组织这些项目，而不是重新实现它们。

#### 🟠 重大修改：Plugin 沙箱用 VM 实现

**原设计**：Plugin 沙箱通过 VM 上下文隔离实现。

**问题**：Node.js 的 VM 模块不是真正的安全沙箱，实现复杂且容易有漏洞。第一阶段不需要这么重的机制。

**新设计**：第一阶段用**基于权限的沙箱**（Capability-based Security）。Plugin 声明它需要哪些权限，TLL OS 在运行时检查每次操作。VM 隔离作为第二阶段的增强，不是第一阶段的必需。

#### 🟡 建议删除：Skill Contract（暂时）

**原设计**：Skill 是 AI Kernel 的一个 Contract，和 Tool 并列。

**问题**：Skill 的定义太模糊。Skill 和 Tool 的区别是什么？Skill 是"可复用的 Agent 能力"还是"预定义的 Prompt 模板"？当前没有清晰定义。

**建议**：第一阶段删除独立的 Skill Contract，将其合并到 Tool（增加 `type: 'tool' | 'skill'` 字段）。等有真实使用场景后再重新独立。

#### 🟡 建议删除：Workflow Contract（暂时）

**原设计**：Workflow 是 AI Kernel 的一个 Contract。

**问题**：Workflow 的定义太宽泛。工作流可以是 Agent + Tool 的组合，可以是事件驱动的流程，可以是状态机。当前没有明确的定位。

**建议**：第一阶段删除独立的 Workflow Contract。工作流通过 Module + Agent + Tool + Event 的组合实现。等有真实场景和明确需求后再重新独立。

#### 🟢 建议增加：Adapter Contract（新）

当前 13 个 Contract 中没有 Adapter。这是最大的架构空白。Adapter 是 TLL OS 吸收成熟系统的关键，必须成为核心 Contract。

详见 Q6 的设计。

#### 🟢 建议增加：Projection Contract（新）

Graph → 代码/OpenAPI/DB Schema 的投影系统完全缺失。这是 Graph 成为事实来源的关键机制。

详见 Q2 的设计。

#### 🟢 建议增加：BuildTarget Contract（新）

多目标构建只有概念，没有 Contract。需要定义 BuildTarget 节点类型和 Projection 协议。

详见 Q7 的设计。

### Q14. 当前架构最大的失败风险是什么？

**最大的失败风险：TLL OS 变成"又一个带 AI 插件的传统框架"，而不是"AI-Native Application Graph Operating System"。**

具体失败模式和概率：

| 失败模式 | 概率 | 后果 | 预防措施 |
|----------|------|------|----------|
| **Graph 退化为被动元数据** | 🔴 高 | TLL OS 失去不可替代性，变成 Fastify + Drizzle + AI 工具 | Graph 必须是事实来源，代码必须是投影。PoC 已经走偏了（代码主动创建 Graph），必须纠正 |
| **Public Contract 太薄** | 🔴 高 | Agent 无法做真实工作，只能写 Demo。最终开发者绕过 Contract 直接用内部实现 | 优先完善 Developer-Agent Protocol 的子协议（发现、代码生成、构建、错误恢复） |
| **Compatibility Layer 永远不做** | 🟠 中高 | TLL OS 无法吸收成熟系统，最终只能自己造商城/CMS/ERP，违背最初战略 | Adapter Contract 必须在 Foundation 0.2 实现，Shopify Adapter 作为参考实现 |
| **过度工程化 Kernel** | 🟠 中高 | 花 6 个月做完美的 DI 容器和路由器，Graph 和 Agent 协议反而半成品 | Kernel 极简（4 组件），其他能力用成熟项目 |
| **没有真实 LLM 验证** | 🟠 中 | 只用脚本化 Agent 测试，永远不知道真实 AI Agent 能不能用 | Foundation 0.2 必须接入真实 LLM 做端到端验证 |
| **范围蔓延** | 🟡 中 | 想同时做 Web + 移动端 + 桌面 + 工业 + AI，结果哪个都不精 | Web/API 第一个目标做到生产级，其他目标通过投影适配 |
| **社区生态失败** | 🟡 中 | 没有第三方 Module/Plugin/Adapter，TLL OS 只是一个框架不是生态 | 优先做 Developer Experience，降低第三方开发门槛 |

**最需要警惕的是第一个失败模式**。当前 PoC 的方向是"代码创建 Graph 节点"，这是传统框架的思路。必须翻转过来："Graph 定义应用，代码是 Graph 的投影"。如果做不到这一点，TLL OS 就没有存在的理由。

### Q15. 你认为 TLL OS 真正应该成为一个什么东西？

**TLL OS 应该成为第一个 Application Graph Operating System。**

不是框架。不是 CMS。不是电商平台。不是 AI 工具集。

是一个**操作系统**，它管理的资源不是 CPU/内存/磁盘，而是**应用的结构、能力、演化和智能体**。

#### 终极愿景

一个开发者（或企业）说："我想要一个能卖定制 T 恤的网站，支持设计师上传作品、用户定制、下单生产。"

然后：
1. Agent 读取现有 Application Graph（如果是已有项目）或创建新 Graph
2. Agent 分析需求，在 Graph 中添加/修改节点：Product Module、Designer Module、Customization Tool、Order Workflow、Payment Adapter
3. Agent 检查 Compatibility Layer：是否可以从 Shopify/Medusa 迁移已有功能？
4. Agent 生成代码投影：后端 API、数据库 Schema、前端页面、测试
5. Agent 运行测试，发现问题，修复
6. Agent 部署到指定 Build Target（Web + 小程序）
7. 人类在关键决策点审查和批准

整个过程中，**Graph 是唯一的事实来源**。代码、配置、数据库、文档、测试都是 Graph 的投影，可以随时重新生成。Agent 不需要理解代码细节，它理解 Graph。

#### TLL OS 的不可替代性

| 维度 | 传统框架 | TLL OS |
|------|----------|--------|
| 事实来源 | 代码 | Application Graph |
| Agent 理解应用 | 读代码（困难、易错） | 读 Graph（结构化、机器可读） |
| 修改应用 | 改代码（需要理解代码库） | 改 Graph（标准接口、约束验证） |
| 集成外部系统 | 写集成代码（每个系统单独写） | Adapter（标准映射、可复用） |
| 多目标部署 | 每个目标单独开发 | Graph 投影（一次定义，多目标投影） |
| 应用演化 | Git 历史（代码层面） | Graph 历史 + ChangeSet（语义层面） |
| AI 参与开发 | AI 写代码（和人类一样） | AI 操作 Graph（更高层次、更安全） |

#### TLL OS 不是什么

- ❌ 不是"更好的 Laravel/NestJS"——那些是框架，TLL OS 是操作系统
- ❌ 不是"AI 代码生成器"——代码生成是投影系统的一个功能，不是核心
- ❌ 不是"低代码平台"——TLL OS 面向开发者和 Agent，不是非技术用户
- ❌ 不是"商城系统"——商城是基于 TLL OS 开发的第一个大型应用之一
- ❌ 不是"又一个开源框架"——TLL OS 的目标是成为 AI 时代的应用基础设施

#### 一句话定义

> **TLL OS 是第一个以 Application Graph 为事实来源、以 Agent 为一等公民、以 Compatibility Layer 吸收成熟生态、以 Projection 支持多目标部署的 AI-Native Application Operating System。**

---

## 三、Contract 变更建议

### 建议删除的 Contract

| Contract | 理由 | 处理方式 |
|----------|------|----------|
| Skill | 定义模糊，与 Tool 区别不清 | 合并到 Tool（增加 type 字段） |
| Workflow | 定义太宽泛，可通过 Module+Agent+Tool+Event 组合实现 | 第一阶段移除，有真实场景后重新设计 |

### 建议增加的 Contract

| Contract | 优先级 | 理由 |
|----------|--------|------|
| **Adapter** | P0 | 吸收成熟系统的关键，当前完全缺失 |
| **Projection** | P0 | Graph 成为事实来源的关键机制 |
| **BuildTarget** | P1 | 多目标部署需要标准 Contract |
| **Task Specification** | P1 | Agent Development Protocol 的核心子协议 |
| **ChangeSet** | P1 | Graph 变更的标准格式，支持回滚和审计 |

### 建议重大修改的 Contract

| Contract | 修改内容 |
|----------|----------|
| Application Graph | 从"被动元数据"改为"事实来源"；增加 Node Schema、约束验证、Projection 接口、ChangeSet |
| Module | 从"Controller/Service/Model 结构"改为"一组有共同所有者的 Graph 节点" |
| Plugin | 沙箱从 VM 改为权限-based；明确与 Module 的区别是分发方式 |
| Agent | 从"AI Kernel 组件"改为"Graph 节点类型 + Agent Development Protocol" |
| Developer-Agent Protocol | 从抽象概念改为具体子协议集合：Discovery、Task Spec、Plan-Execute-Verify、Human-in-the-Loop、Error Recovery |

### 修正后的核心 Contract 清单（13 → 14 项）

| # | Contract | 状态 | 说明 |
|---|----------|------|------|
| 1 | Application Model | stable | 应用模型与生命周期 |
| 2 | Application Graph | **修改** | 事实来源 + Projection + ChangeSet |
| 3 | Module Contract | **修改** | Graph 节点集合，非 MVC 结构 |
| 4 | Plugin Contract | **修改** | 权限沙箱，运行时安装 |
| 5 | **Adapter Contract** | **新增 P0** | 外部系统连接与迁移 |
| 6 | Agent Contract | **修改** | Graph 节点 + 开发协议 |
| 7 | Tool Contract | stable | （合并 Skill） |
| 8 | AI Context Contract | beta | 保留 |
| 9 | Permission Contract | stable | 保留 |
| 10 | Runtime Lifecycle | stable | 保留 |
| 11 | Developer-Agent Protocol | **修改** | 具体子协议集合 |
| 12 | Runtime Adapter | beta | 保留 |
| 13 | **Projection Contract** | **新增 P0** | Graph → 代码/OpenAPI/DB Schema |
| 14 | **BuildTarget Contract** | **新增 P1** | 多目标部署 |

> 注：Skill 和 Workflow 从核心 Contract 中移除，第一阶段不独立实现。

---

## 四、架构变更建议

### 4.1 Kernel 极简重构

```
原 Kernel（15 组件）→ 新 Kernel（4 核心）

原：Application, Container, Router, Middleware, Event, Config,
    Cache, Queue, Scheduler, Logger, Validator, Security, CLI, ...

新：
1. GraphRuntime    — Graph 存储、查询、变更、验证、Projection
2. LifecycleManager — Application/Module/Plugin 的生命周期
3. ContractResolver — Contract 注册、发现、版本管理
4. EventBus        — 事件发布/订阅
```

其他能力通过 Contract + Adapter 接入：
- HTTP → Fastify Adapter
- Database → Drizzle Adapter
- Queue → BullMQ Adapter
- Cache → Redis Adapter
- Validation → Zod（直接使用，不需要 Adapter）
- Logging → Pino（直接使用）
- Testing → Vitest（直接使用）

### 4.2 Graph 作为事实来源的范式翻转

```
当前（PoC）：代码 → 创建 Graph 节点 → Graph 记录
应该是：Graph（定义应用）→ Projection → 代码 + 配置 + Schema + 测试

实现路径：
1. Graph 有严格的 Node Schema（每种节点类型有必填字段和约束）
2. Graph 变更通过 ChangeSet 提交（原子性、可验证、可回滚）
3. Projection 系统监听 Graph 变更，自动更新代码投影
4. 代码修改可以反向同步到 Graph（双向同步，但 Graph 是权威）
5. Agent 操作 Graph，不直接操作代码
```

### 4.3 六者边界重新定义

详见 Q8。核心是：Kernel（引擎）→ Application（实例）→ Module/Plugin/Adapter/Agent（Graph 节点的不同类型）。

### 4.4 Compatibility Layer 成为核心层

```
TLL OS
├── Kernel（4 核心组件）
├── Application Graph（事实来源）
├── Public Contracts（14 项）
├── Projection System（Graph → 多目标）
├── Compatibility Layer（Adapter System）★ 新增核心层
│   ├── Adapter Contract
│   ├── Shopify Adapter（参考实现）
│   ├── WordPress Adapter（参考实现）
│   └── Adapter SDK（第三方开发 Adapter 的工具）
├── Agent Development Protocol
└── Runtime Adapters（Node.js / Bun / ...）
```

---

## 五、Foundation 0.2 优先级建议（基于本评审）

**不建议**按原计划"Plugin → HTTP → CLI → LLM"顺序施工。建议按以下优先级：

### P0 — 必须先做（决定 TLL OS 生死）

1. **Graph 作为事实来源的范式翻转**：Node Schema + ChangeSet + 约束验证
2. **Projection System**：Graph → 代码（TypeScript）、Graph → OpenAPI、Graph → DB Schema（Drizzle）
3. **Adapter Contract + Shopify Adapter 参考实现**：证明 TLL OS 能吸收成熟系统
4. **Developer-Agent Protocol 子协议**：Discovery + Task Specification + Plan-Execute-Verify
5. **真实 LLM 端到端验证**：用真实 AI Agent（不是脚本化）从零开发一个小应用

### P1 — 重要但不紧急

6. **BuildTarget Contract + Web 投影**：第一个目标做到生产级
7. **Plugin 系统（权限沙箱版）**：运行时安装 + 权限控制
8. **CLI（tll new / serve / learn / doctor）**：开发者体验
9. **HTTP Adapter（Fastify）**：生产级 HTTP 服务器
10. **Database Adapter（Drizzle）**：生产级数据库

### P2 — 后续阶段

11. 多目标投影（APK/EXE/小程序）
12. VM 级 Plugin 沙箱
13. Workflow Contract（重新设计）
14. Skill Contract（重新设计）
15. 工业软件目标支持
16. Agent 自维护（RFC/PR/版本迭代自动化）

---

## 六、最终结论

### TLL OS Foundation 0.1 的成就

1. ✅ 战略方向正确：AI-Native Application Runtime + 标准 + Agent 协议
2. ✅ Public Contract 分离验证成功：Agent 只依赖公开层即可工作
3. ✅ PoC 跑通完整闭环：创建 → 测试 → 失败 → 修复 → 通过
4. ✅ 13 项 Contract 有了第一版定义
5. ✅ Application Graph 概念被提出并验证了基础能力

### TLL OS Foundation 0.1 的根本问题

1. 🔴 **Graph 还不是事实来源**：当前是代码创建 Graph，应该反过来。这是最根本的范式问题。
2. 🔴 **Compatibility Layer 完全缺失**：没有 Adapter，TLL OS 无法吸收成熟系统。
3. 🟠 **Developer-Agent Protocol 太抽象**：没有可执行的子协议，真实 Agent 无法使用。
4. 🟠 **Kernel 过于庞大**：15 组件是传统框架思路，应该极简到 4 核心。
5. 🟡 **"AI Kernel"分层是错误的**：AI 不是独立子系统，Agent/Tool 是 Graph 节点。

### 最关键的一句话

**TLL OS 的灵魂是 Application Graph 作为事实来源。如果做不到这一点，TLL OS 就没有不可替代性，就会变成又一个带 AI 插件的传统框架。PoC 验证了公共层分离，但还没有验证 Graph 作为事实来源。Foundation 0.2 必须完成这个范式翻转。**

---

> **本报告为独立架构评审观点，不代表原设计方立场。等待交叉审查。**
> **评审者可以完全不同意本报告的任何结论。**
> **交叉审查后，删除错误设计，合并优秀设计，冻结 Foundation，开源发布。**
