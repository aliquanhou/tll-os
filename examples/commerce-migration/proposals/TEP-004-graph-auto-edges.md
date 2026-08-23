# TEP-004: Graph Auto-Edges

**状态**: Proposed | **日期**: 2026-08-22 | **作者**: TLL OS Commerce Agent

## 问题

Runtime 0.1 的 Application Graph 只有节点（module/api/tool/test），没有边。Graph 无法表达 Module 之间的依赖关系（如 order Module 调用 cart Module 的 API），也无法表达 API/Tool/Test 与 Module 的归属关系之外的关联。Commerce 项目导出的 Graph 有 135 个节点但 0 条边，可视化价值有限。

## 当前替代方案

无。Module 之间通过 `app.apis.request()` 内部调用，但 Runtime 不追踪这些调用关系。开发者只能通过阅读代码理解模块依赖。

## 提案

在 Graph 中自动建立边关系：

1. **归属边**: Module → API、Module → Tool、Module → Test（注册时自动建立）
2. **调用边**: API/Tool handler 中调用 `app.apis.request()` 或 `app.tools.invoke()` 时，自动记录调用关系（通过 Proxy 包装 app.apis/tools）
3. **测试边**: Test → 被测试的 API/Tool（通过 ctx 追踪）
4. **数据流边**: 可选，Module 声明依赖的数据集合

Graph 导出增加 edges 数组：

```json
{
  "nodes": [...],
  "edges": [
    {"from": "module:commerce-order", "to": "api:commerce-cart:/cart", "type": "calls"},
    {"from": "module:commerce-order", "to": "module:commerce-catalog", "type": "depends_on"},
    {"from": "test:commerce-order:create_order", "to": "api:commerce-order:/orders", "type": "tests"}
  ]
}
```

## 预期收益

- Application Graph 可可视化模块依赖拓扑
- 可检测循环依赖
- 可分析变更影响范围（修改一个 Module 会影响哪些下游）
- 支持架构治理（限制模块间非法依赖）

## 兼容性

纯新增能力，不影响现有节点注册。边关系为可选，不建立边时行为与 Runtime 0.1 一致。
