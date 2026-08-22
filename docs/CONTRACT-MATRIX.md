# TLL OS Protocol 2.0 — Contract Matrix

> 17 Contracts × Type × Runtime × Public API × Contract Test 完整矩阵
> Foundation 0.2 施工后状态

## 完整矩阵

| # | Contract | Type | Runtime | Public API | Test | 状态 |
|---|----------|------|---------|------------|------|------|
| 1 | Application | ✅ | ✅ | ✅ | ✅ | 完整实现 |
| 2 | Application Graph | ✅ | ✅ | ✅ | ✅ | Impact Analysis 修复完成 |
| 3 | Module | ✅ | ✅ | ✅ | ✅ | 完整实现 |
| 4 | Plugin | ✅ | ✅ | ✅ | ✅ | P0-11 最小实现完成 |
| 5 | Agent | ✅ | ✅ | ✅ | ✅ | 基础 Agent + Workspace/Lock/Handoff |
| 6 | Tool | ✅ | ✅ | ✅ | ✅ | 输入校验 + 权限执行点 |
| 7 | Skill | ✅ | ❌ | ❌ | ❌ | P1（V1.1） |
| 8 | Context | ✅ | ✅ | ✅ | ✅ | 完整实现 |
| 9 | Permission | ✅ | ⚠️ | ⚠️ | ⚠️ | 声明 + 执行点，完整执行在 P1 |
| 10 | Workflow | ✅ | ❌ | ❌ | ❌ | P1（V1.1） |
| 11 | Event | ✅ | ✅ | ✅ | ✅ | 内存版完整 |
| 12 | Adapter | ✅ | ⚠️ | ⚠️ | ⚠️ | Node Runtime Adapter + Persistence Adapter |
| 13 | Projection | ✅ | ❌ | ❌ | ❌ | P1（V1.1） |
| 14 | BuildTarget | ✅ | ❌ | ❌ | ❌ | P1（V1.1） |
| 15 | Capability | ✅ | ❌ | ❌ | ❌ | P1（V1.1） |
| 16 | Compatibility Manifest | ✅ | ❌ | ❌ | ❌ | P2（后续扩展） |
| 17 | Evolution Proposal | ✅ | ❌ | ❌ | ❌ | P1（V1.1 TEP 闭环） |

## 统计

- **完整实现（Type+Runtime+Public API+Test）**：9/17（53%）
- **部分实现**：4/17（24%）
- **仅类型定义**：4/17（23%）

## Foundation 0.2 新增实现的 Contract

| Contract | 新增能力 |
|----------|---------|
| Application Graph | Impact Analysis 修复（belongs_to/depends_on/calls/uses/tests/modifies） |
| Plugin | install/enable/disable/uninstall + 依赖检查 + 事件 + 配置 |
| Agent | Workspace + Lock/Version + Handoff + Review/Merge（Multi-Agent 协作套件） |
| Tool | JSON Schema 输入校验 + 权限执行点 |
| Adapter | Persistence Adapter（Memory 实现）+ HTTP Adapter 集成 |
| Permission | 权限声明 + 执行点预留 |

## Contract ↔ Runtime 一致性原则

1. **Protocol 有定义 → Runtime 必须有实现**：不允许出现"Protocol 有但 Runtime 没有"的情况（当前 4 项仅类型定义，标记为 P1/P2）
2. **Runtime 有实现 → Protocol 必须有定义**：不允许 Runtime 出现 Protocol 未定义的能力
3. **Public API 必须通过 `src/public/index.ts` 导出**：Agent 不允许直接依赖内部实现
4. **每个 Contract 必须有自动化测试**：Foundation 0.2 已建立 40 项 P0 测试覆盖

## 下一阶段（V1.1）需要落地的 Contract

1. **Skill**：可复用 Agent 能力方案（一组 Tool + 决策逻辑 + 最佳实践）
2. **Workflow**：Agent 开发工作流 + 业务工作流引擎
3. **Projection**：Graph ↔ 代码/OpenAPI/DB Schema 双向投影
4. **BuildTarget**：dev→test→build→production 标准流程
5. **Capability**：应用能力声明 + Registry
6. **Evolution Proposal**：TEP 闭环（提案→AI Review→审核→Merge→发布）
7. **Permission**：完整权限执行（API Auth + Agent Permission + Tool Permission + Secret + Audit Log）
