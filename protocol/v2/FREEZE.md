# TLL OS Protocol 2.0 — 冻结记录

> **冻结日期**: 2026-08-22
> **版本**: 2.0.0
> **状态**: FROZEN

---

## 冻结依据

Protocol 2.0 的冻结基于以下验证：

### 1. AI × AI 交叉架构审查

- 豆包独立架构评审报告（15 个关键问题的独立回答）
- 用户交叉审查（3 处修正 + 2 个新增概念）
- 合并后形成 17 项核心契约 + 5 个模型的最终架构

### 2. hello-tll-agent PoC

- 验证 Agent 只依赖 Public Contract 即可完成完整开发闭环
- 创建应用 → 读取 Graph → 创建 Module → 创建 API → 创建 Tool → 创建 Agent → 创建测试 → 测试失败 → 分析修复 → 重测通过
- 3/3 测试通过

### 3. autonomous-task-manager 真实 Agent 实验

- 验证 Agent 可以自主开发多模块应用
- 双模块（project + task）、11 个 REST API、manage_task Tool（6 种操作）、task_manager_agent
- 跨模块依赖验证（task 依赖 project）
- 12/12 测试通过
- 实验中发现并修复了核心 Bug（API 路径参数未解析）

### 4. 编译验证

- `tsc --noEmit` 零错误
- 所有 Public Contract 类型定义通过严格模式编译

---

## Protocol 2.0 包含

### 五个模型

1. **应用模型**: Application, Application Graph, Module, Plugin, Event, Permission
2. **AI 开发模型**: Agent, Tool, Skill, Context, Workflow
3. **生态适配模型**: Adapter, Compatibility Manifest, Capability
4. **构建模型**: Projection, BuildTarget
5. **演进模型**: Evolution Proposal, TEP

### 17 项核心契约

Application, Application Graph, Module, Plugin, Agent, Tool, Skill, Context, Permission, Workflow, Event, Adapter, Projection, BuildTarget, Capability, Compatibility Manifest, Evolution Proposal

### 核心原则

1. Application Graph 是主要事实来源（不是唯一）
2. AI Agent 是一等公民
3. 不重复造轮子
4. Protocol 与 Runtime 分离
5. 全球扩展与进化

---

## 文档清单

### Protocol 规范
- `protocol/v2/SPECIFICATION.md` — 宪法（本规范）

### 架构文档（docs/）
- `ARCHITECTURE.md` — 总纲（含 Protocol 2.0 收敛说明）
- `KERNEL.md` — Kernel 设计
- `MODULES.md` — Module Contract
- `PLUGINS.md` — Plugin Contract
- `API.md` — API 系统
- `AI.md` — AI Kernel / Agent 开发模型
- `CLI.md` — CLI 设计
- `SECURITY.md` — 安全
- `TESTING.md` — 测试体系
- `CONTRIBUTING.md` — 贡献指南
- `AGENTS.md` — Agent 作为开发者和运行时参与者
- `ROADMAP.md` — 路线图
- `APPLICATION-GRAPH.md` — Application Graph Contract
- `RUNTIME.md` — Runtime Adapter 设计
- `CONTRACTS.md` — 13 项 Contract 总纲（1.0 版）
- `CAPABILITY.md` — Capability Contract（2.0 新增）
- `COMPATIBILITY.md` — Compatibility Manifest Contract（2.0 新增）
- `ADAPTER.md` — Adapter Contract（2.0 新增）
- `PROJECTION.md` — Projection Contract（2.0 新增）
- `EVOLUTION.md` — Evolution Proposal & TEP（2.0 新增）

### 示例（examples/）
- `hello-tll-agent/` — 最小 PoC（单模块，测试-修复闭环）
- `autonomous-task-manager/` — 真实 Agent 独立开发实验（双模块，12 测试）

### 源码（src/）
- `public/types.ts` — 17 项 Public Contract 类型定义
- `public/index.ts` — Public 层入口
- `core/index.ts` — Runtime 最小实现（内存版）
- `adapters/node/index.ts` — Node.js Runtime Adapter

---

## 已知限制（Runtime 0.1）

Protocol 2.0 已冻结，但 Runtime 实现仍处于 0.1 阶段：

| 能力 | Protocol 定义 | Runtime 实现 |
|------|--------------|-------------|
| Application Graph | ✅ | ✅ 内存版（节点/边/查询/影响分析） |
| Module | ✅ | ✅ 内存版（CRUD Service/API/Tool/Test） |
| Plugin | ✅ | ❌ 未实现 |
| Adapter | ✅ | ❌ 未实现（只有 Contract 类型） |
| Projection | ✅ | ❌ 未实现 |
| BuildTarget | ✅ | ❌ 未实现 |
| Capability | ✅ | ❌ 未实现 |
| Compatibility Manifest | ✅ | ❌ 未实现 |
| Evolution Proposal | ✅ | ❌ 未实现 |
| Agent | ✅ | ✅ 脚本化执行（非真实 LLM） |
| Tool | ✅ | ✅ |
| Skill | ✅ | ❌ 未实现 |
| Workflow | ✅ | ❌ 未实现 |
| Event | ✅ | ✅ 内存版 |
| Permission | ✅ | ❌ 未实现（只有声明） |
| HTTP Server | ✅ | ❌ 内存模拟（ApiManager.request） |
| Database | ✅ | ❌ 内存 Map |
| CLI | ✅ | ❌ 未实现 |

Runtime 0.2 将开始大规模实现这些能力。

---

## 下一步

1. **部署 ts.knitoem.com** — TLL OS Developer Hub（官方验收站）
2. **GitHub 正式开源** — 发布 Protocol 2.0 + Runtime 0.1
3. **Runtime 0.2 施工** — Plugin、HTTP Adapter(Fastify)、CLI、真实 LLM 集成、Adapter 参考实现(Shopify)
4. **全球演进** — 通过 TEP 接受全球开发者和 Agent 的贡献

---

**TLL OS Protocol 2.0 — An AI-Native Universal Application Development Protocol.**

> 本协议自冻结之日起生效。任何对本协议的修改必须通过 TEP 流程。
