# TLL OS Public Contracts

> 文档：CONTRACTS.md
> 版本：0.1.0-blueprint
> 状态：**TLL OS 协议总纲**
> 新增：第一轮架构总审查后追加。统一说明所有 TLL OS Public Contracts。

---

## 0. 什么是 Contract

Contract（契约）是 TLL OS 与外部世界（包括 AI Agent、第三方开发者、上层应用）之间的正式协议。

Contract 定义了：
- **接口**：有哪些操作可以调用
- **数据结构**：输入输出的格式
- **行为约束**：调用时必须遵守的规则
- **生命周期**：对象的创建、使用、销毁
- **版本策略**：如何演进而不破坏兼容性

**Contract 是 TLL OS 最核心的资产。** TLL OS 控制的是 Contract，而不是每一个底层实现。

---

## 1. Contract 总览

TLL OS 目前定义了 **13 项 Public Contracts**：

| # | Contract | 定义文档 | 代码位置 | 状态 |
|---|----------|----------|----------|------|
| 1 | **Application Model** | ARCHITECTURE.md / KERNEL.md | `src/public/application.ts` | ✅ 已定义 |
| 2 | **Application Graph** | APPLICATION-GRAPH.md | `src/public/graph.ts` | ✅ 已定义 |
| 3 | **Module Contract** | MODULES.md | `src/public/module.ts` | ✅ 已定义 |
| 4 | **Plugin Contract** | PLUGINS.md | `src/public/plugin.ts` | ✅ 已定义 |
| 5 | **Agent Contract** | AI.md | `src/public/agent.ts` | ✅ 已定义 |
| 6 | **Tool Contract** | AI.md | `src/public/tool.ts` | ✅ 已定义 |
| 7 | **Skill Contract** | AI.md | `src/public/skill.ts` | ✅ 已定义 |
| 8 | **AI Context Contract** | AI.md | `src/public/context.ts` | ✅ 已定义 |
| 9 | **Permission Contract** | SECURITY.md / AI.md | `src/public/permission.ts` | ✅ 已定义 |
| 10 | **Workflow Contract** | AI.md | `src/public/workflow.ts` | ✅ 已定义 |
| 11 | **Runtime Lifecycle** | KERNEL.md / RUNTIME.md | `src/public/lifecycle.ts` | ✅ 已定义 |
| 12 | **Developer-Agent Protocol** | AGENTS.md | `src/public/developer.ts` | ✅ 已定义 |
| 13 | **Runtime Adapter** | RUNTIME.md | `src/public/runtime.ts` | ✅ 已定义 |

---

## 2. Contract 分层

```
┌─────────────────────────────────────────────────────┐
│              Application Layer Contracts             │
│  Module / Plugin / API / Command / Config            │
├─────────────────────────────────────────────────────┤
│               AI-Native Contracts                    │
│  Agent / Tool / Skill / Context / Workflow / Perm    │
├─────────────────────────────────────────────────────┤
│              Core Contracts                           │
│  Application / Application Graph / Lifecycle         │
├─────────────────────────────────────────────────────┤
│              Foundation Contracts                     │
│  Runtime Adapter / Container / Event / Config        │
└─────────────────────────────────────────────────────┘
```

### 2.1 Foundation Contracts（基础层）

最底层的 Contract，所有其他 Contract 依赖它们。

- **Runtime Adapter**：TLL OS 与具体 JavaScript Runtime 之间的抽象
- **Container**：依赖注入容器
- **Event**：事件总线
- **Config**：配置管理

### 2.2 Core Contracts（核心层）

TLL OS 的核心概念，定义应用的基本结构。

- **Application Model**：应用是什么、如何启动、如何终止
- **Application Graph**：应用结构的完整地图
- **Runtime Lifecycle**：应用从创建到终止的状态机

### 2.3 Application Layer Contracts（应用层）

定义应用的功能单元。

- **Module Contract**：第一方功能单元
- **Plugin Contract**：第三方可安装单元
- **API Contract**：HTTP API 规范
- **Command Contract**：CLI 命令规范
- **Config Contract**：配置规范

### 2.4 AI-Native Contracts（AI 原生层）

TLL OS 区别于传统框架的核心 Contract。

- **Agent Contract**：AI 代理的运行时
- **Tool Contract**：Agent 可调用的能力单元
- **Skill Contract**：可复用的 Agent 能力包
- **AI Context Contract**：Agent 运行时的上下文
- **Workflow Contract**：多步骤任务编排
- **Permission Contract**：Agent 操作的权限控制

---

## 3. Contract 版本策略

### 3.1 版本号

每个 Contract 有独立的版本号，遵循语义化版本：

- **MAJOR**：破坏性变更（不兼容）
- **MINOR**：向后兼容的新增功能
- **PATCH**：向后兼容的 Bug 修复

### 3.2 兼容性规则

1. **Contract 一旦发布，不可破坏性修改**：必须发布新版本
2. **旧版本 Contract 至少维护两个 MAJOR 版本**
3. **废弃的 Contract 必须有迁移指南**
4. **Agent 可以查询 Contract 版本**，确保兼容性

### 3.3 Contract 协商

Agent 连接 TLL OS 时，进行 Contract 版本协商：

```
Agent → TLL OS: 我支持 Agent Contract v2.x, Tool Contract v1.x
TLL OS → Agent: 我支持 Agent Contract v2.3, Tool Contract v1.5
协商结果: 使用 Agent Contract v2.3, Tool Contract v1.5
```

---

## 4. Contract 可发现性

AI Agent 可以通过标准接口发现所有可用的 Contract：

```typescript
interface ContractRegistry {
  list(): ContractInfo[];
  get(name: string): ContractInfo | null;
  getSchema(name: string, version?: string): JsonObject;
  negotiate(name: string, supportedVersions: string[]): string | null;
}

interface ContractInfo {
  name: string;
  version: string;
  description: string;
  status: 'stable' | 'beta' | 'deprecated' | 'draft';
  documentationUrl: string;
}
```

---

## 5. 造轮子边界（第一轮审查修正）

### 5.1 TLL OS 控制什么

TLL OS 控制的是 **Contract**，不是底层实现：

| TLL OS 定义 Contract | 底层实现可复用 |
|---------------------|----------------|
| HTTP Contract | Fastify / Express / uWebSockets |
| Router Contract | Fastify Router / 自定义 |
| Database Contract | Drizzle / Prisma / Knex |
| Queue Contract | BullMQ / NATS / Redis |
| Cache Contract | Redis / Memcached |
| Validation Contract | Zod / Valibot |
| Testing Contract | node:test / Vitest / Jest |
| Logging Contract | Pino / Winston |

### 5.2 TLL OS 必须自己实现什么

以下部分 TLL OS 必须自己实现，因为它们是 TLL OS 的核心差异化能力：

1. **Application Graph**：TLL OS 独有的应用结构地图
2. **Module/Plugin Lifecycle**：TLL OS 的扩展机制
3. **Agent/Tool/Skill Contract**：AI-Native 核心
4. **Developer-Agent Protocol**：Agent 开发协议
5. **Container**：需要支持 Plugin 动态注册/卸载和隔离
6. **Permission System**：需要支持 Agent 权限和 Plugin 沙箱

### 5.3 原则

> **核心 Contract 最小化依赖 + 底层实现可替换 + 优先复用成熟开源组件。**

不为了"自主可控"重复制造成熟基础设施。我们真正要控制的是 Contract、Lifecycle、Extension、Permission、Application Model、Agent Protocol。

---

## 6. Contract 与 Application Graph

每个 Contract 在 Application Graph 中都有对应的 Node 类型：

| Contract | Graph Node Type |
|----------|----------------|
| Application Model | `application` |
| Application Graph | （Graph 本身） |
| Module Contract | `module` |
| Plugin Contract | `plugin` |
| API Contract | `api` |
| Agent Contract | `agent` |
| Tool Contract | `tool` |
| Skill Contract | `skill` |
| Workflow Contract | `workflow` |
| Permission Contract | `permission` |
| Command Contract | `command` |
| Config Contract | `config` |
| Runtime Adapter | `build_target` |

Agent 通过 Application Graph 可以发现应用中所有 Contract 的实例。

---

## 7. Contract 测试

每个 Contract 必须有 **Contract Test**，验证实现是否符合 Contract 定义：

```typescript
interface ContractTestSuite {
  contractName: string;
  contractVersion: string;
  tests: Array<{
    name: string;
    description: string;
    run: (implementation: unknown) => Awaitable<TestResult>;
  }>;
}
```

第三方实现 TLL OS Contract 时，可以运行 Contract Test Suite 验证兼容性。

---

## 8. PoC 中的 Contract 验证

在 `examples/hello-tll-agent/` PoC 中，验证以下 Contract：

1. **Application Model Contract**：创建 Application
2. **Application Graph Contract**：读取和查询 Application Graph
3. **Module Contract**：创建 Module
4. **API Contract**：创建 API
5. **Tool Contract**：创建 Tool
6. **Agent Contract**：创建 Agent
7. **Testing Contract**：创建和运行测试
8. **Developer-Agent Protocol**：Agent 通过 Public Contract 完成所有操作，不依赖内部实现

PoC 的核心验证目标：**一个外部 Agent 能不能在不了解 TLL OS 内部源码的情况下，通过 Public Contract 完成一个小项目？**

---

## 9. 未实现与 TODO

第一阶段（PoC）：
- [x] 13 项 Contract 的接口定义
- [x] Contract 分层和版本策略
- [x] 造轮子边界明确
- [ ] Contract Registry 实现
- [ ] Contract Test Suite 实现
- [ ] Contract 版本协商实现
- [ ] 所有 Contract 的完整实现（第二阶段）

---

## 10. 参考文档

各 Contract 的详细定义见：

- [ARCHITECTURE.md](./ARCHITECTURE.md) — 总体架构
- [KERNEL.md](./KERNEL.md) — Kernel 组件
- [APPLICATION-GRAPH.md](./APPLICATION-GRAPH.md) — Application Graph
- [MODULES.md](./MODULES.md) — Module Contract
- [PLUGINS.md](./PLUGINS.md) — Plugin Contract
- [API.md](./API.md) — API Contract
- [AI.md](./AI.md) — AI Kernel Contracts (Agent/Tool/Skill/Context/Workflow)
- [CLI.md](./CLI.md) — Command Contract
- [SECURITY.md](./SECURITY.md) — Permission Contract
- [TESTING.md](./TESTING.md) — Testing Contract
- [AGENTS.md](./AGENTS.md) — Developer-Agent Protocol
- [RUNTIME.md](./RUNTIME.md) — Runtime Adapter
