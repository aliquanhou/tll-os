# TLL OS PoC: Hello TLL Agent

> 验证 TLL OS AI-Native 核心设计的最小闭环证明。

## 这是什么

这是 TLL OS Foundation 0.1 的 Proof of Concept。它验证一个核心假设：

> **一个外部 AI Agent 能不能在不了解 TLL OS 内部源码的情况下，通过公开协议完成一个小项目？**

## 验证的完整闭环

```
1. 创建 Application
   ↓
2. 读取 Application Graph
   ↓
3. 创建 Module
   ↓
4. 创建 API
   ↓
5. 创建 Tool
   ↓
6. 创建 Agent
   ↓
7. 创建测试（初始失败——故意埋了一个 Bug）
   ↓
8. 执行测试 → 发现失败
   ↓
9. 分析错误 → 修改代码（修复 Bug）
   ↓
10. 再次执行测试 → 全部通过
    ↓
11. 完成 Application，输出 Graph 报告
```

## 关键约束

`agent.ts` **只导入 `../../src/public/index.js`**，不导入任何内部实现（`core/`、`adapters/`）。

这模拟了真实场景中外部 Agent 只能通过 Public Contract 操作 TLL OS 的情况。

## 运行

```bash
# 在 tll-os 根目录下
npx tsx examples/hello-tll-agent/agent.ts
```

## 预期输出

- Step 1-7: 成功创建 Application、Module、API、Tool、Agent、测试
- Step 8: 测试运行，1 个失败（greetingService 返回 "Hello" 而非 "Hello, TLL OS!"）
- Step 9: Agent 分析错误根因，修复 greetingService
- Step 10: 重新运行测试，全部通过
- Step 11: 输出 Application Graph 最终状态和验证结论

## 这个 PoC 证明了什么

1. **Application Graph 是 AI 理解应用的地图**：Agent 通过 Graph 查询模块、API、Tool、Agent 的关系
2. **Public Contract 足够支撑完整开发**：Agent 不需要访问内部实现就能创建和操作应用
3. **AI 测试-修复闭环可行**：Agent 可以发现测试失败、分析根因、修复代码、重新验证
4. **Module/API/Tool/Agent 统一在 Application Graph 中**：所有实体都有节点和关系
5. **Runtime 解耦**：PoC 运行在 Node.js 上，但架构上支持其他 Runtime

## 这个 PoC 没有证明什么

- 真实 LLM 推理（PoC 中 Agent 执行逻辑是脚本化的，不是 LLM 自动决策）
- 真实 HTTP 服务器（API 调用是内存模拟的）
- Plugin 系统（PoC 只验证了 Module）
- 多 Runtime（只验证了 Node.js）
- 性能和可扩展性

这些是后续阶段的验证目标。
