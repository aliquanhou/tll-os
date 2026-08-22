# TLL OS Foundation 0.2 — Baseline Report

> 审计基准：真实仓库 `aliquanhou/tll-os`，Foundation 0.2 施工前状态。
> Runtime 版本：0.1.0 → 0.2.0
> Protocol 版本：2.0.0 FROZEN

## 一、施工前基线状态

### Protocol 17 Contracts 矩阵

| Contract | Type | Runtime | Public API | Test | 施工前状态 |
|----------|------|---------|------------|------|-----------|
| Application | ✅ | ✅ | ✅ | ✅ | 完整 |
| Application Graph | ✅ | ⚠️ Partial | ✅ | ⚠️ | Impact Analysis 有 Bug（belongs_to 不追踪） |
| Module | ✅ | ✅ | ✅ | ✅ | 完整 |
| Plugin | ✅ | ❌ | ❌ | ❌ | 仅类型定义 |
| Agent | ✅ | ⚠️ Partial | ✅ | ⚠️ | 无 Identity/Workspace/Lock |
| Tool | ✅ | ⚠️ Partial | ✅ | ⚠️ | 无输入校验/权限执行 |
| Skill | ✅ | ❌ | ❌ | ❌ | 仅类型定义 |
| Context | ✅ | ✅ | ✅ | ✅ | 完整 |
| Permission | ✅ | ❌ | ❌ | ❌ | 仅声明字段，不执行 |
| Workflow | ✅ | ❌ | ❌ | ❌ | 仅类型定义 |
| Event | ✅ | ✅ | ✅ | ✅ | 内存版完整 |
| Adapter | ✅ | ❌ | ❌ | ❌ | 仅 Node Runtime Adapter |
| Projection | ✅ | ❌ | ❌ | ❌ | 仅类型定义 |
| BuildTarget | ✅ | ❌ | ❌ | ❌ | 仅类型定义 |
| Capability | ✅ | ❌ | ❌ | ❌ | 仅类型定义 |
| Compatibility Manifest | ✅ | ❌ | ❌ | ❌ | 仅类型定义 |
| Evolution Proposal | ✅ | ❌ | ❌ | ❌ | 仅类型定义 |

### 核心能力基线

| 能力 | 施工前状态 |
|------|-----------|
| Persistence | ❌ 纯内存 Map，进程重启丢失 |
| HTTP Server | ❌ RuntimeAdapter.createServer 存在但 Application 不调用 |
| ChangeSet | ❌ 仅类型定义 |
| Multi-Agent Workspace | ❌ 不存在 |
| Agent Lock/Version | ❌ 不存在 |
| Handoff | ❌ 不存在 |
| Review/Merge | ❌ 不存在 |
| CLI | ❌ 仅设计文档，无 bin |
| API Contract 标准化 | ❌ 各 API 自定义返回格式 |
| Contract Test | ❌ 无自动化 Contract 测试 |

### 基线测试结果

- hello-tll-agent: 3/3
- autonomous-task-manager: 12/12
- stranger-agent-inventory: 8/8
- **总计：23/23 通过**

## 二、关键问题识别

1. **Graph Impact Analysis 不可用**：API/Tool 通过 `belongs_to` 关联 Module，但 Impact Analysis 只查 `depends_on` 边，导致修改 Module 后查不到归属资源。
2. **Tool 无输入校验**：`parameters` 是 JSON Schema 但 `invoke` 不校验。
3. **Permission 字段声明但不执行**：Agent/Tool 的 permissions 字段存在但代码中从不检查。
4. **CONTRACTS 数组不一致**：core/index.ts 列 13 项，Protocol 2.0 定义 17 项。
5. **GraphNodeType 缺 adapter**：types.ts 只 16 种，spec 17 种。
6. **双轨制**：src/index.ts 导出一套与 Protocol 2.0 不兼容的 blueprint 接口。

## 三、Foundation 0.2 施工目标

将上述 ❌ 和 ⚠️ 项全部推进到 ✅，重点实现 12 个 P0 项，使 TLL OS 从"协议已立、基座未建"推进到"可承载真实项目开发"的 Foundation 0.2。
