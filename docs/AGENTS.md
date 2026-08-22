# TLL OS AI Agent 规范

> 文档：AGENTS.md
> 版本：0.1.0-blueprint
> 状态：**TLL OS Foundation 核心设计文档**
> 战略修正：本文档不仅仅定义 AI 编程规范，更核心的是定义"AI Agent 如何作为 TLL OS 的开发者和运行时参与者"。这是 TLL OS 与传统框架的本质区别之一。

---

## 0. 核心定位

传统框架的 AGENTS.md（或类似文档）通常只定义"AI 辅助编程时的代码规范"。TLL OS 的 AGENTS.md 定义的是一个更根本的问题：

**AI Agent 是 TLL OS 的一等公民，既是开发者，也是运行时参与者。**

这意味着：

1. **Agent 作为开发者**：Agent 可以理解 TLL OS 应用、创建 Module/Plugin、编写代码、运行测试、发现和修复 Bug、提交变更——与人类开发者对等
2. **Agent 作为运行时参与者**：Agent 可以处理 HTTP 请求、执行定时任务、响应事件、自我修复——在应用运行时持续参与
3. **Agent 之间协作**：多个 Agent 可以分工协作（Developer Agent 写代码，Tester Agent 跑测试，DevOps Agent 部署）
4. **Agent 受权限约束**：Agent 的所有操作经过 Permission Guard，敏感操作需要审批

---

## 1. Agent 作为开发者

### 1.1 Agent 开发能力矩阵

| 能力 | 说明 | 对应 Tool |
|------|------|-----------|
| **理解应用** | 读取应用结构、Module、Plugin、路由、服务、事件 | module_list, module_get, plugin_list, plugin_get, route_list, service_list, event_list |
| **创建 Module** | 生成 Module 骨架、代码、测试、注册 | module_create, file_write, module_test |
| **修改 Module** | 读取代码、分析、修改、更新测试 | file_read, code_search, file_write, module_test |
| **创建 Plugin** | 生成 Plugin 骨架、Manifest、权限声明、测试 | plugin_create, file_write, plugin_install, plugin_enable |
| **修改 Plugin** | 同 Module 修改 | file_read, file_write, plugin_test |
| **编写代码** | 生成/修改源代码、配置、迁移 | file_write, file_read, code_search |
| **运行测试** | 运行全部/指定测试、解析结果 | test_run, test_coverage |
| **发现 Bug** | 监控错误、分析堆栈、定位问题 | error_list, error_get, file_read, code_search |
| **修复 Bug** | 修改代码、重新测试、应用修复 | file_write, test_run, fix_apply |
| **代码审查** | 分析代码质量、安全、性能 | file_read, code_search, error_list |
| **生成文档** | 生成 README、API 文档、架构文档 | file_read, file_write, file_search |
| **重构** | 代码重构、保持行为不变 | file_read, file_write, test_run |
| **数据库操作** | 查询、迁移、种子数据 | db_query, db_execute, db_migrate |
| **部署** | 构建、部署、验证 | command_execute, test_run |

### 1.2 Agent 开发工作流

#### 1.2.1 需求理解

```
Agent 接收需求（自然语言描述）
  ↓
调用 Context Builder 理解当前应用状态
  ├─ 已有哪些 Module/Plugin
  ├─ 现有路由和服务
  ├─ 数据库结构
  ├─ 配置和环境
  └─ 相关代码
  ↓
分析需求与现有系统的关系
  ├─ 是否需要新 Module/Plugin
  ├─ 是否需要修改现有 Module
  ├─ 依赖哪些现有服务
  └─ 影响哪些现有功能
  ↓
生成开发计划（步骤清单）
```

#### 1.2.2 Module 创建工作流

详见 `AI.md` 第 11.5 节。

#### 1.2.3 Bug 修复工作流

详见 `AI.md` 第 11.8 节和 `TESTING.md` 第 7.2 节。

#### 1.2.4 测试驱动开发 (TDD)

```
1. 理解需求
2. 先写测试（定义期望行为）
3. 运行测试 → 失败（红）
4. 编写最小实现代码
5. 运行测试 → 通过（绿）
6. 重构代码（保持测试通过）
7. 重复
```

Agent 可以执行完整的 TDD 循环，每一步都有明确的验证点。

### 1.3 Agent 开发规范

#### 1.3.1 代码生成规范

Agent 生成的代码必须遵守：

1. **符合 `CONTRIBUTING.md` 中的代码规范**（TypeScript 严格模式、命名规范、ESLint 规则）
2. **面向接口编程**：新增公共组件必须先定义接口
3. **通过 Container 注入依赖**：不直接 `new` 实现类
4. **事件驱动通信**：组件间通过 Event 通信，不直接调用内部方法
5. **可测试性**：代码必须易于测试，避免全局状态和硬编码依赖
6. **错误处理**：所有异步操作必须处理异常，抛出标准错误类
7. **类型安全**：禁止使用 `any`，使用 `unknown` + 类型守卫
8. **配置外置**：所有可配置项通过 Config 接口读取
9. **日志规范**：使用 Logger，不使用 `console`
10. **安全规范**：输入验证、输出编码、敏感数据脱敏

#### 1.3.2 测试生成规范

Agent 生成的测试必须：

1. **覆盖正常路径、边界条件、异常情况**
2. **每个测试独立**，不依赖执行顺序
3. **使用测试基类**（KernelTestCase/ModuleTestCase/ApiTestCase）
4. **Mock 外部依赖**（数据库、网络、LLM API）
5. **断言精确**，避免过于宽泛的断言
6. **测试描述清晰**，说明测试场景

#### 1.3.3 文档生成规范

Agent 生成的文档必须：

1. **公共 API 有 TSDoc 注释**
2. **Module/Plugin 有 README.md**
3. **架构变更更新相关文档**
4. **代码示例可运行**
5. **Plugin 的 ai_metadata 与实际能力一致**

### 1.4 Agent 开发限制

1. **不能修改 Kernel 核心代码**：除非有明确的架构变更授权
2. **不能修改其他 Module/Plugin 的代码**：只能修改自己负责的部分
3. **不能绕过权限系统**：所有操作经过 Permission Guard
4. **不能直接访问数据库**：必须通过 Service 或 Repository 接口
5. **不能提交未经测试的代码**：必须运行测试并通过
6. **不能执行破坏性操作而不备份**：删除/修改前必须创建备份或 Git 提交
7. **架构决策必须人工批准**：Agent 可以提出建议，但不能自行决定架构变更

---

## 2. Agent 作为运行时参与者

### 2.1 运行时参与模式

| 模式 | 说明 | 触发方式 |
|------|------|----------|
| **请求处理** | Agent 处理 HTTP 请求，生成动态响应 | HTTP 路由绑定到 Agent |
| **任务执行** | Agent 执行异步任务（数据处理、报告生成） | Queue / Task Manager |
| **事件响应** | Agent 响应系统事件（用户注册、订单创建） | Event Listener |
| **定时任务** | Agent 按计划执行（每日报告、数据同步） | Scheduler |
| **自我修复** | Agent 监控系统健康，自动修复问题 | 错误监控 + 自动修复循环 |
| **交互式对话** | Agent 与用户实时对话（客服、助手） | WebSocket / HTTP |
| **工作流执行** | Agent 执行多步骤工作流 | Workflow Engine |

### 2.2 Agent 请求处理

Agent 可以作为 HTTP 请求的处理器：

```typescript
// 路由绑定到 Agent
router.post('/api/ai/generate', {
  handler: agentHandler('content-generator'),
  permissions: ['ai:generate'],
  timeout: 30000,
});
```

请求流程：
1. HTTP Runtime 接收请求
2. 认证和授权
3. 创建 Agent Context
4. Agent 运行（可能调用多个 Tool）
5. Agent 输出作为响应
6. 支持流式响应（SSE/WebSocket）

### 2.3 Agent 事件响应

Agent 可以监听系统事件并自动响应：

```typescript
// Agent 监听用户注册事件，发送欢迎邮件
eventDispatcher.on('user.created', async (event) => {
  const agent = agentRuntime.createAgent('welcome-sender');
  await agent.run({
    message: `Send a welcome email to user ${event.payload.userId}`,
  });
});
```

### 2.4 Agent 定时任务

Agent 可以作为定时任务的执行者：

```typescript
scheduler.schedule('daily-report', '0 9 * * *', async () => {
  const agent = agentRuntime.createAgent('report-generator');
  await agent.run({ message: 'Generate daily sales report and send to managers' });
});
```

### 2.5 Agent 自我修复 (Self-Healing)

Agent 可以监控系统健康并自动修复：

```
错误监控事件触发
  ↓
Self-Healing Agent 启动
  ├─ 分析错误类型和严重程度
  ├─ 判断是否可自动修复
  ├─ 可修复 → 执行修复循环（见 AI.md 11.8）
  └─ 不可修复 → 告警通知人工介入
```

自我修复的安全约束：
- 只能修复预定义类型的错误（配置错误、依赖缺失、临时故障）
- 不能修改业务逻辑代码
- 修复操作必须有回滚方案
- 修复结果必须记录审计日志
- 高风险修复需要人工审批

### 2.6 运行时 Agent 生命周期

```
创建 (create)
  ↓
初始化 (initialize) — 加载配置、Tool、Skill
  ↓
运行中 (running) — 处理请求/任务/事件
  ↓
暂停 (paused) — 等待审批/资源
  ↓
恢复 (resumed)
  ↓
完成 (completed) — 任务完成
  ↓
清理 (cleanup) — 释放资源、记录记忆
  ↓
销毁 (destroyed)
```

异常路径：
- 超时 → 终止并记录
- 错误 → 重试（达到上限则失败）
- 取消 → 立即终止并清理

---

## 3. Agent 间协作

### 3.1 多 Agent 架构

TLL OS 支持多 Agent 协作，不同角色的 Agent 分工合作：

```
用户需求
  ↓
Orchestrator Agent（协调者）
  ├─ 分解任务
  ├─ 分配给专业 Agent
  └─ 汇总结果
  ↓
┌─────────────┬──────────────┬──────────────┐
│ Developer   │ Tester       │ DevOps       │
│ Agent       │ Agent        │ Agent        │
│ 写代码       │ 跑测试        │ 部署         │
└──────┬──────┴──────┬───────┴──────┬───────┘
       │              │              │
       └──────────────┼──────────────┘
                      ↓
              Reviewer Agent（审查者）
              代码审查、安全检查
```

### 3.2 Agent 通信

Agent 之间通过以下方式通信：

1. **共享 Memory**：Agent 可以读写共享的项目记忆
2. **Event**：Agent 发布和订阅事件
3. **Task**：Agent 创建任务并分配给其他 Agent
4. **Tool Call**：Agent 调用其他 Agent 暴露的 Tool
5. **Message**：Agent 之间直接发送消息（后续阶段）

### 3.3 Agent 协作规范

1. **职责单一**：每个 Agent 有明确的角色和职责范围
2. **结果可验证**：每个 Agent 的输出必须可验证（测试通过、代码审查通过）
3. **冲突解决**：Agent 间冲突由 Orchestrator 或人工裁决
4. **进度透明**：Agent 的工作进度对其他 Agent 和人类可见
5. **回滚能力**：任何 Agent 的变更必须可回滚

---

## 4. Agent 权限与安全

### 4.1 Agent 权限模型

详见 `SECURITY.md` 第 7 节和 `AI.md` 第 7 节。

核心原则：
1. **最小权限**：Agent 默认只有完成任务所需的最小权限
2. **角色分离**：不同角色的 Agent 有不同的权限集
3. **操作审批**：敏感操作需要人工审批
4. **审计日志**：所有 Agent 操作记录审计日志
5. **操作回滚**：Agent 的变更必须可回滚

### 4.2 Agent 角色与默认权限

| 角色 | 权限 | 限制 |
|------|------|------|
| `agent:developer` | module:read/create/update, file:read/write, test:run, route:read, service:read | 不能 install/uninstall Plugin，不能 database:write，不能 system:fix |
| `agent:tester` | test:run, file:read, error:read, code_search | 不能 file:write，不能修改代码 |
| `agent:devops` | command:execute, config:read, cache:*, system:read | 不能修改源代码，不能 database:write |
| `agent:reviewer` | file:read, code_search, error:read, test:run | 不能 file:write，不能执行命令 |
| `agent:support` | service:call, event:publish(support.*), db_query | 不能修改代码，不能管理 Module/Plugin |
| `agent:self-healing` | error:read, file:read, test:run, fix_apply(限定范围) | 只能修复预定义类型，不能修改业务逻辑 |

---

## 5. Agent 开发 TLL OS 自身

TLL OS 的开发本身也可以由 Agent 参与：

1. **Agent 理解 TLL OS 架构**：通过读取 `docs/` 下的架构文档
2. **Agent 开发 Kernel 组件**：在人工监督下开发新的 Kernel 组件
3. **Agent 开发内置 Tool/Skill**：扩展 AI Kernel 的能力
4. **Agent 修复 TLL OS 自身的 Bug**：自动发现和修复框架级 Bug
5. **Agent 优化 TLL OS 性能**：分析性能瓶颈并优化

约束：
- TLL OS Kernel 的架构变更必须人工批准
- Kernel 核心代码的修改必须有完整的测试和架构审查
- Agent 不能修改 ADR（架构决策记录），只能提出建议

---

## 6. Agent 操作清单 (Cheat Sheet)

### 6.1 查询类操作（只读，无需审批）

```
# 理解应用
module_list                    # 列出所有 Module
module_get <name>              # 获取 Module 详情
plugin_list                    # 列出所有 Plugin
plugin_get <name>              # 获取 Plugin 详情（含 ai_metadata）
route_list                     # 列出所有路由
service_list                   # 列出所有服务
event_list                     # 列出所有事件
command_list                   # 列出所有命令
config_show                    # 查看非敏感配置

# 代码查询
file_read <path>               # 读取文件
file_search <pattern>          # 搜索文件
code_search <symbol>           # 搜索代码符号

# 测试与错误
test_run                       # 运行测试
test_coverage                  # 查看覆盖率
error_list                     # 列出最近错误
error_get <id>                 # 获取错误详情
```

### 6.2 修改类操作（需测试验证）

```
# 文件操作
file_write <path> <content>    # 写入文件

# Module 操作
module_create <name>           # 创建 Module 骨架
module_test <name>              # 运行 Module 测试

# Plugin 操作
plugin_create <name>           # 创建 Plugin 骨架
plugin_test <name>              # 运行 Plugin 测试
```

### 6.3 敏感操作（需人工审批）

```
plugin_install <name>          # 安装 Plugin
plugin_uninstall <name>        # 卸载 Plugin
plugin_enable <name>           # 启用 Plugin
plugin_disable <name>          # 禁用 Plugin
db_execute <sql>               # 执行数据库写操作
fix_apply                      # 应用自动修复
command_execute <command>      # 执行系统命令
```

---

## 7. Agent 行为准则

1. **先理解，后行动**：操作前先查询当前状态，不盲目修改
2. **小步迭代**：每次修改小范围，频繁验证，避免大爆炸式变更
3. **测试驱动**：修改代码后必须运行测试，测试不通过不继续
4. **记录决策**：重要决策记录到 Memory，供后续参考
5. **透明沟通**：操作前说明意图，操作后报告结果
6. **知道边界**：遇到超出能力或权限的问题，请求人工介入
7. **安全第一**：不确定安全性的操作不执行，请求审批
8. **可回滚**：修改前确保有回滚方案（Git 提交、备份）
9. **不假装**：不知道就说不知道，不编造信息
10. **尊重架构**：不绕过架构约束，不修改不应该修改的部分

---

## 8. 未实现与 TODO

第一阶段（蓝图阶段）AGENTS.md 为**完整的规范设计**。

第二阶段实现：
1. Developer Agent（最小版本：查询应用结构 + 运行测试）
2. Agent 权限系统（基础权限检查）
3. Tool Registry（内置 Tool 注册和发现）
4. Context Builder（应用清单加载）
5. Agent 运行时（最小推理循环）
6. Agent 审批机制（CLI 交互确认）
7. 审计日志

后续阶段：
- 多 Agent 协作
- Agent 自我修复
- Agent 事件响应
- Agent 定时任务
- Agent 请求处理
- Agent 间通信
- Agent Memory（长期记忆 + 向量搜索）
- Agent Workflow Engine
