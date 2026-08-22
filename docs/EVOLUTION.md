# TLL OS — Evolution Proposal & TEP

> **协议版本**: 2.0 | **契约状态**: beta | **所属模型**: 演进模型

---

## 一、Evolution 是什么

Evolution 定义 TLL OS 如何被全球开发者和 Agent 共同发现、提案、验证和合入改进。

TLL OS 不是只有核心维护者维护的框架。它允许任何 Agent 在真实使用中发现问题、生成提案、自动测试、提交 PR，经过 AI Review 和 Human Review 后合入。

---

## 二、TEP — TLL Evolution Protocol

TEP 是 TLL OS 的演进流程，定义从"发现问题"到"合入协议/运行时"的完整路径。

### 流程

```
真实项目 / Agent 实践
   ↓
发现：Bug / 优化 / 新能力 / 协议缺陷
   ↓
Evolution Proposal (TEP)
   ├── 问题描述
   ├── 影响分析（基于 Application Graph）
   ├── ChangeSet（Graph 变更 + 代码变更）
   ├── 自动测试
   ├── 兼容性验证（Compatibility Manifest）
   └── AI Review
   ↓
GitHub PR
   ↓
维护者审核（Human Review）
   ↓
Merge
   ↓
Protocol / Runtime Release
```

---

## 三、Evolution Proposal 结构

```yaml
# TEP 基本信息
id: TEP-0001
title: "Add WebSocket support to API Contract"
type: feature  # feature | bugfix | breaking | deprecation | refactor
status: draft  # draft | review | approved | rejected | merged
created: 2026-08-22
updated: 2026-08-22
author:
  type: agent  # agent | human
  id: agent:task_manager_agent  # 或 human:username
  source: "autonomous-task-manager experiment"

# 问题描述
problem: |
  API Contract only supports REST endpoints.
  Real-time features (chat, notifications, live updates)
  require WebSocket support.
  Discovered while building task-manager-app's
  real-time task update feature.

# 影响分析
impact_analysis:
  affected_contracts: [API]
  affected_nodes: [api]
  affected_modules: []
  breaking: false
  backward_compatible: true
  migration_required: false
  risk_level: low

  # Graph 影响分析
  graph_changes:
    - add_node_type: websocket
    - add_edge_type: subscribes_to
    - affected_existing_nodes: [api]

# ChangeSet
change_set:
  # Protocol 变更
  protocol_changes:
    - file: protocol/v2/API.md
      change: "Add WebSocket endpoint type and subscription handler"
    - file: protocol/v2/SPECIFICATION.md
      change: "Add websocket to API contract capabilities"

  # Runtime 变更
  runtime_changes:
    - file: runtime/src/public/types.ts
      change: "Add WebSocketEndpoint interface and WsHandler type"
    - file: runtime/src/core/api/index.ts
      change: "Add WebSocket endpoint registration and matching"

  # 测试变更
  test_changes:
    - file: tests/integration/websocket.test.ts
      change: "Add WebSocket endpoint creation and message handling tests"

  # 文档变更
  doc_changes:
    - file: docs/API.md
      change: "Add WebSocket section with examples"

# 验证
validation:
  tests_passed: true
  test_count: 12
  test_coverage: "95%"
  compatibility_verified: true
  ai_review: approved
  ai_review_notes: "Implementation follows existing API patterns. No breaking changes."
  human_review: pending

# 参考
references:
  - "autonomous-task-manager experiment (real-time updates)"
  - "Fastify WebSocket plugin"
  - "Issue #42: Real-time feature request"

# 讨论链接
discussion: "https://github.com/tll-os/tll-os/discussions/123"
pr: "https://github.com/tll-os/tll-os/pull/456"
```

---

## 四、TEP 类型

| 类型 | 说明 | 审核要求 |
|------|------|----------|
| `feature` | 新功能/新能力 | AI Review + Human Review |
| `bugfix` | Bug 修复 | AI Review + Human Review（简单修复可仅 AI Review） |
| `breaking` | Breaking Change | AI Review + Human Review + RFC + 迁移指南 |
| `deprecation` | 废弃契约/功能 | AI Review + Human Review + 替代方案 |
| `refactor` | 重构（不改变行为） | AI Review（可选 Human Review） |

---

## 五、TEP 状态流转

```
draft → review → approved → merged
              ↓
           rejected
```

| 状态 | 说明 |
|------|------|
| `draft` | Proposal 已创建，正在完善 ChangeSet 和测试 |
| `review` | AI Review 完成，等待 Human Review |
| `approved` | 维护者批准，等待合入 |
| `rejected` | 被拒绝，记录原因 |
| `merged` | 已合入，随下一个版本发布 |

---

## 六、AI Review 检查清单

AI Review 自动检查以下项：

| 检查项 | 说明 |
|--------|------|
| Contract 一致性 | 代码实现是否与 Contract 类型一致 |
| 架构边界 | 是否有越界操作（Module 操作 Kernel 内部等） |
| 测试充分性 | 新代码是否有足够测试 |
| 重复造轮子 | 是否有成熟开源项目可以替代 |
| 安全性 | 是否有安全漏洞（注入、越权、敏感信息泄露） |
| 兼容性 | 是否破坏现有 Contract 或 API |
| 性能 | 是否有明显的性能问题 |
| Graph 一致性 | Graph 变更是否经过验证 |
| 文档完整性 | 是否有对应的文档更新 |

AI Review 不通过的 TEP 不进入 Human Review。

---

## 七、Agent 如何发起 TEP

### 场景 1：Agent 在开发中发现 Bug

```
1. Agent 运行测试 → 发现失败
2. Agent 分析失败 → 定位到 TLL OS Runtime 的 Bug
3. Agent 创建 TEP:
   - type: bugfix
   - problem: 描述 Bug
   - change_set: 修复代码 + 回归测试
4. Agent 运行测试验证修复
5. AI Review 自动通过
6. 提交 PR → Human Review → Merge
```

### 场景 2：Agent 发现缺少能力

```
1. Agent 开发应用 → 发现需要 WebSocket 支持
2. Agent 查询 Capability Registry → 未找到
3. Agent 查询 Adapter Registry → 未找到合适的
4. Agent 创建 TEP:
   - type: feature
   - problem: 描述缺少的能力和使用场景
   - change_set: 添加 WebSocket Contract + 实现 + 测试 + 文档
5. Agent 实现并测试
6. AI Review → Human Review → Merge
```

### 场景 3：Agent 发现协议缺陷

```
1. Agent 使用 Application Graph → 发现影响分析不准确
2. Agent 分析 → 定位到 Graph Contract 的设计缺陷
3. Agent 创建 TEP:
   - type: breaking（如果需要修改 Contract）
   - problem: 描述协议缺陷
   - impact_analysis: 分析影响范围
   - change_set: 修改 Contract + 迁移工具 + 测试
4. 需要 RFC 和迁移指南
5. AI Review → Human Review → 下一个 MAJOR 版本合入
```

---

## 八、Protocol 与 Runtime 的独立演进

### Protocol 演进

- Protocol 2.x 是稳定的，Breaking Change 需要 Protocol 3.0
- Protocol 的变更必须通过 TEP + RFC
- Protocol 版本独立于 Runtime 版本

### Runtime 演进

- Runtime 0.x 可以频繁迭代（每周/每两周）
- Runtime 的 Bug 修复和新功能通过 TEP 流程
- Runtime 1.0 是第一个生产就绪版本

### 分离的好处

- 即使 Runtime 完全重写，Protocol 2.0 的应用和 Agent 仍然有效
- 全球开发者可以实现自己的 Runtime（Python/Go/Rust），只要遵循 Protocol
- Protocol 的稳定性保证了生态的长期可持续性

---

## 九、第一阶段实现范围

Protocol 2.0 定义 Evolution Proposal Contract 和 TEP 流程。Runtime 0.x 实现：
- TEP 模板和格式验证
- 基本的 AI Review 检查清单（Contract 一致性、测试充分性）
- TEP 状态管理
- GitHub PR 模板
- Agent 发起 TEP 的标准流程

自动化 ChangeSet 生成、完整的 AI Review、自动兼容性验证留到后续版本。
