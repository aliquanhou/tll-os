# Autonomous Task Manager — TLL OS 真实 Agent 独立开发实验

> 这是 TLL OS Protocol 2.0 的关键验证实验。

## 实验目标

验证一个**只接触 TLL OS Public Contract + 公开文档 + 现有 Example** 的真实 AI Agent，能否从零开发一个多模块应用，并完成设计、实现、测试、修复和运行。

这比 hello-tll-agent 的单模块 Demo 前进了一大步：它证明 Public Contract 不是"只能写 Demo"的玩具接口，而是可以支撑真实多模块应用开发的标准。

## 实验约束

- Agent **只 import `src/public/index.ts`**，不访问任何内部实现（`core/`、`adapters/`）
- Agent 自主决定：模块划分、API 设计、Service 实现、Tool 设计、Agent 设计、测试方案
- 所有操作通过 Public Contract 完成

## 应用架构

```
Task Manager App
├── project 模块
│   ├── projectService（内存 CRUD）
│   └── 5 个 REST API（list/get/create/update/delete）
├── task 模块（dependencies: ["project"]）
│   ├── taskService（CRUD + 项目存在性验证）
│   ├── 6 个 REST API（含 /api/projects/:id/tasks 跨模块查询）
│   └── manage_task Tool（6 种操作：create/list/get/update/delete/changeStatus）
└── task_manager_agent（意图解析 → 调用 Tool → 返回结果）
```

## 验证结果

| 验证项 | 结果 |
|--------|------|
| 测试 | 12/12 全部通过 |
| Application Graph | 16 节点 / 14 边 |
| 跨模块依赖 | task 模块声明依赖 project，taskService 创建时验证项目存在 |
| Agent → Tool 关系 | Graph 中正确记录 calls 边 |
| Agent 端到端 | list 成功 + create 成功（任务实际被创建） |
| tsc 编译 | 零错误 |

## 实验中发现并修复的核心 Bug

**`ApiEndpointImpl.invoke` 不解析路径参数**：handler 中 `req.params.id` 始终为 `undefined`，导致所有带 `:id` 的 REST API 返回 404。

这是一个有价值的发现——**正是通过真实 Agent 开发复杂应用，才暴露了 hello-tll-agent（没有路径参数）没有覆盖到的核心缺陷**。这验证了"真实 Agent 实验"比"写单元测试"更能发现架构层面的问题。

## 运行

```bash
# 在 tll-os 根目录下
npx tsx examples/autonomous-task-manager/agent.ts
```

## 这个实验证明了什么

1. ✅ Public Contract 足以支撑真实多模块应用开发
2. ✅ Agent 可以自主设计模块架构和跨模块依赖
3. ✅ Agent 可以实现完整 CRUD + 跨模块验证
4. ✅ Agent 可以设计统一入口的 Tool（多种操作）
5. ✅ Agent 可以设计带意图解析的 Agent
6. ✅ Agent 可以写入全面覆盖的测试并全部通过
7. ✅ Application Graph 正确反映双模块、API、Tool、Agent 及依赖关系
8. ✅ 真实 Agent 实验能发现单元测试覆盖不到的核心 Bug

## TLL OS Protocol 2.0 的意义

这个实验是 TLL OS 从"一个 AI 友好的框架"转向"AI-Native 通用应用开发协议"的关键验证点。

它证明了：
- Agent 不需要理解 TLL OS 内部实现
- Agent 只需要 Public Contract 就能开发真实应用
- Application Graph 是 Agent 理解应用的有效地图
- 这套协议可以支撑全球开发者和 Agent 共同开发

这是 TLL OS Protocol 2.0 冻结的核心依据之一。
