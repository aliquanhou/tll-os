# TLL OS Protocol 2.0 Specification

> **版本**: 2.0.0
> **状态**: FROZEN
> **冻结日期**: 2026-08-22
> **类型**: Protocol Specification（协议规范，非运行时实现）

---

## 序言

TLL OS 不是一个 Web 框架。不是一个 CMS。不是一个电商平台。

TLL OS 是一套 **AI-Native 通用应用开发协议**——一套人类能学习、Agent 能理解、成熟项目能接入、全球开发者能扩展、并且能通过全球 Agent 的真实实践持续进化的开放开发协议。

本规范定义 TLL OS Protocol 2.0 的核心概念、契约、模型和演进规则。运行时实现（TLL OS Runtime）可以有多个，但必须遵循本协议。

---

## 一、核心原则

### 原则 1：Application Graph 是主要事实来源

Application Graph 是 TLL OS 对应用结构、能力、依赖和关系进行机器可理解描述的**主要事实来源**。

- 是"主要"，不是"唯一"。复杂算法、UI 像素级实现、第三方库特殊用法、底层优化、语言特性等天然来自代码，不强迫全部 Graph 化。
- Agent 通过 Graph 理解应用，而不是在几十万个文件里盲目搜索。
- Graph 描述"应用有什么、能做什么、依赖什么、关系如何"，代码描述"具体怎么实现"。

### 原则 2：AI Agent 是一等公民

传统开发模型：Developer → Code → Framework → Application

TLL OS 开发模型：Developer + AI Agent → TLL OS Protocol → Application → Module / Plugin / Adapter / Tool

Agent 必须能够通过标准协议理解应用、发现能力、选择组件、设计实现、测试修复、构建部署、发现提案。

### 原则 3：不重复造轮子

TLL OS 控制协议、生命周期、扩展模型、权限模型、应用模型、Agent 协议。TLL OS **不**控制每个底层实现。

HTTP → Fastify / Database → Drizzle / Validation → Zod / Queue → BullMQ / Logging → Pino / Testing → Vitest

### 原则 4：Protocol 与 Runtime 分离

Protocol 是稳定的规范。Runtime 是协议的实现，可以有多个、可以重写、可以替换。即使 Runtime 完全重写，遵循 Protocol 2.0 的应用和 Agent 仍然有效。

### 原则 5：全球扩展与进化

TLL OS 允许全球开发者和 Agent 共同发现、验证和贡献改进。Evolution Protocol（TEP）定义了从"发现问题"到"合入协议"的完整流程。

---

## 二、协议架构总览

TLL OS Protocol 2.0 由五个模型组成：

- **应用模型**: Application, Application Graph, Module, Plugin, Event, Permission
- **AI 开发模型**: Agent, Tool, Skill, Context, Workflow
- **生态适配模型**: Adapter, Compatibility Manifest, Capability
- **构建模型**: Projection, BuildTarget
- **演进模型**: Evolution Proposal, TEP

---

## 三、17 项核心契约

| # | 契约 | 模型 | 状态 |
|---|------|------|------|
| 1 | Application | 应用 | stable |
| 2 | Application Graph | 应用 | stable |
| 3 | Module | 应用 | stable |
| 4 | Plugin | 应用 | beta |
| 5 | Agent | AI开发 | beta |
| 6 | Tool | AI开发 | stable |
| 7 | Skill | AI开发 | beta |
| 8 | Context | AI开发 | beta |
| 9 | Permission | 应用 | stable |
| 10 | Workflow | AI开发 | beta |
| 11 | Event | 应用 | stable |
| 12 | Adapter | 生态适配 | beta |
| 13 | Projection | 构建 | beta |
| 14 | BuildTarget | 构建 | beta |
| 15 | Capability | 生态适配 | beta |
| 16 | Compatibility Manifest | 生态适配 | beta |
| 17 | Evolution Proposal | 演进 | beta |

---

## 四、Application Graph 规范

Application Graph 是应用结构、能力、依赖和关系的机器可理解描述，是主要事实来源。

### 节点类型（17 种）

application, module, plugin, adapter, api, model, event, workflow, agent, tool, skill, permission, capability, build_target, config, command, dependency

### 边类型（15 种）

belongs_to, depends_on, provides, calls, triggers, requires, uses, extends, conflicts_with, listens_to, implements, exports, imports, builds_for, maps_to

### Graph 操作

查询（listNodes / getNode / findModules / findApis / ...）、关系查询（getDependencies / getDependents / getRelated）、影响分析（getImpactAnalysis）、序列化（toJSON）、变更（通过 ChangeSet）。

### Graph 不是什么

不是代码的替代品。不是架构图。不是唯一事实来源。

---

## 五、Agent 开发模型规范

### Agent 开发闭环

需求 → 理解（读Graph）→ 选择Capability → 选择Module/Plugin/Adapter → 设计（Graph节点）→ 实现（Projection→代码）→ 测试 → 发现问题 → 修改 → 验证 → BuildTarget → 部署

### Agent 能力层级

- L1: 理解应用（Application Graph）
- L2: 发现和选择组件（Capability, Module, Plugin, Adapter）
- L3: 设计和实现（Application Graph, Projection）
- L4: 测试和修复（Testing, Application Graph）
- L5: 构建和部署（BuildTarget, Projection）
- L6: 发现和提案（Evolution Proposal）

### Tool 与 Skill

- Tool = Agent 可执行的原子能力
- Skill = 利用一组 Tool 完成某类任务的可复用方案（含决策逻辑、错误处理、最佳实践）

---

## 六、生态适配模型规范

### Adapter

连接外部系统，映射外部概念到/从 Application Graph。不包含业务逻辑，只做数据映射和连接。

能力：read（读取映射）、write（写入）、sync（双向同步）、migrate（迁移到原生Module）

### Compatibility Manifest

每个 Adapter 附带：支持的系统和版本、License、可映射/不可映射能力、迁移成本、依赖、兼容等级（full/partial/read-only/experimental）

### Capability Registry

应用通过 Capability 节点声明能做什么。Agent 查询 Capability Registry 发现可用能力。Capability 由 Module/Plugin/Adapter 提供，通过 provides 边关联。

---

## 七、构建模型规范

### Projection

Graph → 输出的投影规则：code（源代码）、openapi（OpenAPI规范）、database（DB Schema）、config（配置文件）、docs（文档）、tests（测试代码）

Projection 是双向的：Graph → 代码（生成），代码 → Graph（同步/发现）

### BuildTarget

应用支持的目标平台：web, h5, apk, exe, miniprogram, ai_agent, industrial, iot, cloud, edge

每个 BuildTarget 有能力矩阵（Capability Matrix），声明支持/不支持哪些能力。

TLL OS 定义 Contract，Web/API 是第一个参考实现，其他目标由社区实现。

---

## 八、演进模型规范（TEP）

### TLL Evolution Protocol 流程

发现问题 → Evolution Proposal（问题描述+影响分析+ChangeSet+自动测试+兼容性验证+AI Review）→ GitHub PR → 维护者审核 → Merge → Protocol/Runtime Release

### Evolution Proposal 结构

id, title, type(feature/bugfix/breaking/deprecation), status, created, author, problem, impact_analysis, change_set, validation, references

### 状态流转

draft → review → approved → merged（或 rejected）

### 版本分离

- Protocol 版本: 2.x（稳定）
- Runtime 版本: 0.x（持续演进）

---

## 九、版本与兼容性策略

- 契约状态: stable / beta / draft / deprecated
- Breaking Change 需要 TEP + RFC，deprecated 保留 2 个 MINOR 版本
- LTS: 每 4 个 Runtime MINOR 选一个，支持 12 个月

---

## 十、Protocol 2.0 范围

### 包含

17 项核心契约定义、Application Graph 主要事实来源、Agent 开发模型 L1-L4、Adapter + Compatibility Manifest、Projection + BuildTarget、Evolution Proposal + TEP、版本兼容性策略

### 不包含（Runtime 范畴）

具体 HTTP 服务器、ORM、CLI 实现、Plugin 沙箱、LLM 集成、Projection 器实现

---

## 十一、目录结构

```
tll-os/
├── protocol/v2/          # Protocol 2.0 规范
├── runtime/              # Runtime 实现（core/public/adapters）
├── schemas/              # JSON Schema
├── adapters/             # 系统 Adapter（Shopify/WordPress/...）
├── projections/          # Projection 模块
├── capabilities/         # Capability 定义
├── examples/             # 示例应用
├── agents/               # Agent 定义
├── proposals/            # TEP 提案
├── tests/                # 测试
└── docs/                 # 文档
```

---

## 十二、最终声明

TLL OS Protocol 2.0 定义了一套 AI-Native 通用应用开发协议。目标不是"做出一个优秀的框架"，而是建立一个能够被人类学习、被 Agent 理解、被成熟项目接入、被全球开发者扩展，并且能够通过全球 Agent 的真实实践持续进化的开放开发协议。

本规范冻结后，任何遵循 TLL OS Protocol 2.0 的运行时实现、应用、Module、Plugin、Adapter、Projection、Agent 和 Evolution Proposal 都是 TLL OS 生态的合法组成部分。

**TLL OS Protocol 2.0 — An AI-Native Universal Application Development Protocol.**

> 本规范为 TLL OS 的宪法。任何对本规范的修改必须通过 TEP 流程。
