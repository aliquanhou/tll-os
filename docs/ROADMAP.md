# TLL OS 路线图

> 文档：ROADMAP.md
> 版本：0.1.0-blueprint
> 战略修正：路线图必须包含 AI-Native Runtime、AI Developer Protocol、AI Module Generation、AI Plugin Generation、AI Testing Loop、AI Self-Healing Application 等 AI-Native 里程碑。第一阶段先完成协议和架构设计，复杂能力后续实现。

---

## 1. 版本规划

TLL OS 采用语义化版本，按阶段交付：

| 版本 | 阶段 | 核心目标 | 状态 |
|------|------|----------|------|
| **0.1.0** | Foundation Phase 1 | 架构蓝图 + 核心 Contract 设计 | 进行中 |
| **0.2.0** | Foundation Phase 2 | Kernel 实现 + Module/Plugin 最小可用 | 计划中 |
| **0.3.0** | Foundation Phase 3 | AI Kernel 最小可用 + Developer Agent | 计划中 |
| **0.4.0** | Foundation Phase 4 | API 系统 + 安全体系 + 测试体系完整 | 计划中 |
| **0.5.0** | Beta | 全功能 Beta + 生态启动 | 计划中 |
| **1.0.0** | GA | 生产就绪 + 完整文档 + 长期支持 | 计划中 |

---

## 2. Foundation Phase 1 (v0.1.0) — 架构蓝图

> **当前阶段**

### 2.1 目标

建立 TLL OS Foundation 的完整架构蓝图，定义所有核心 Contract，不急于实现代码。

### 2.2 交付物

#### 架构文档（12 份）

| 文档 | 状态 |
|------|------|
| ARCHITECTURE.md | ✅ 完成 |
| KERNEL.md | ✅ 完成 |
| MODULES.md | ✅ 完成 |
| PLUGINS.md | ✅ 完成 |
| API.md | ✅ 完成 |
| AI.md | ✅ 完成 |
| CLI.md | ✅ 完成 |
| SECURITY.md | ✅ 完成 |
| TESTING.md | ✅ 完成 |
| CONTRIBUTING.md | ✅ 完成 |
| AGENTS.md | ✅ 完成 |
| ROADMAP.md | ✅ 完成 |

#### 核心 Contract 设计（11 项 TLL OS 必须自研的标准）

| Contract | 定义文档 | 状态 |
|----------|----------|------|
| Application Model | ARCHITECTURE.md / KERNEL.md | ✅ |
| Module Contract | MODULES.md | ✅ |
| Plugin Contract | PLUGINS.md | ✅ |
| Agent Contract | AI.md | ✅ |
| Tool Contract | AI.md | ✅ |
| Skill Contract | AI.md | ✅ |
| AI Context Contract | AI.md | ✅ |
| Permission Contract | SECURITY.md / AI.md | ✅ |
| Workflow Contract | AI.md | ✅ |
| Runtime Lifecycle | KERNEL.md / ARCHITECTURE.md | ✅ |
| Developer/Agent Protocol | AGENTS.md | ✅ |

#### 项目骨架

- [ ] package.json（零运行时依赖）
- [ ] tsconfig.json（ESM、严格模式）
- [ ] 核心接口定义（TypeScript 类型/接口）
- [ ] 目录结构

### 2.3 里程碑

- [x] M1: 六大框架架构研究对比
- [x] M2: 技术选型决策
- [x] M3: 总体架构设计
- [x] M4: Kernel 15 组件设计
- [x] M5: Module/Plugin 系统设计
- [x] M6: API 系统设计
- [x] M7: AI Kernel 设计（核心）
- [x] M8: CLI/Security/Testing 设计
- [x] M9: AGENTS.md（Agent 作为开发者+运行时参与者）
- [x] M10: 全部 12 份文档完成
- [ ] M11: 第一轮架构审查（等待用户审查）
- [ ] M12: 根据审查意见修订
- [ ] M13: 项目骨架搭建

### 2.4 验收标准

1. 12 份架构文档完整，内容可审查
2. 11 项核心 Contract 全部定义
3. 技术选型有明确理由
4. 架构边界清晰，不与传统框架混淆
5. AI-Native 思想贯穿所有设计
6. 项目骨架可编译（tsc --noEmit 通过）

---

## 3. Foundation Phase 2 (v0.2.0) — Kernel 实现

### 3.1 目标

实现 TLL OS Kernel 的核心组件，使 Module/Plugin 系统最小可用。

### 3.2 交付物

#### Kernel 组件实现（按优先级）

1. **Foundation Primitives**：接口、类型、错误类、工具函数
2. **Container**：DI 容器（绑定/解析/作用域/标签/子容器）
3. **Config**：配置管理（.env + 配置文件 + 环境变量覆盖）
4. **Logger**：结构化日志（human/JSON 格式、多通道）
5. **Event**：事件总线（优先级、停止传播、订阅者）
6. **Router**：Trie 树路由（参数提取、路由组、元数据）
7. **Middleware**：中间件管道（洋葱模型）
8. **HTTP Runtime**：基于 node:http 的运行时
9. **Application + Kernel**：生命周期编排（register/boot/terminate）
10. **Validator**：数据验证（内置规则 + 自定义规则）
11. **Cache**：缓存抽象（memory/file 驱动）
12. **Queue**：队列抽象（sync/memory 驱动）
13. **Scheduler**：定时任务调度（Cron 解析）
14. **Security**：认证（API Key + JWT）+ 授权（RBAC）
15. **CLI**：命令运行时 + 内置命令

#### Module 系统实现

- Module Manifest 加载与验证
- Module Registry（发现、注册、拓扑排序）
- Module 生命周期（register/boot/shutdown）
- 路由/服务/事件/命令注册
- Module 管理 CLI（list/info/make/routes/test）
- Module 测试基类

#### Plugin 系统实现（最小版本）

- Plugin Manifest 加载与验证
- Plugin Manager（发现、列表、查询）
- Plugin 生命周期（install/enable/disable/uninstall）
- Plugin 权限声明与验证
- Plugin 管理 CLI（list/info/install/enable/disable/uninstall/make）
- Plugin ai_metadata 解析

#### 最小成功标准验证

- [ ] `tll new my-app` 创建项目
- [ ] `tll serve` 启动 HTTP 服务
- [ ] `tll make:module HelloWorld` 创建 Module
- [ ] Module 自动注册
- [ ] Module 暴露 REST API
- [ ] `tll make:plugin DemoPlugin` 创建 Plugin
- [ ] Plugin 可安装和启用
- [ ] CLI 管理 Module/Plugin
- [ ] 测试全部通过

### 3.3 里程碑

- [ ] M1: Foundation Primitives + Container
- [ ] M2: Config + Logger + Event
- [ ] M3: Router + Middleware + HTTP Runtime
- [ ] M4: Application + Kernel 生命周期
- [ ] M5: Module 系统完整实现
- [ ] M6: Plugin 系统最小实现
- [ ] M7: CLI（new/serve/module/plugin/test）
- [ ] M8: Validator + Cache + Queue + Scheduler
- [ ] M9: Security（认证 + 授权）
- [ ] M10: 测试体系（测试基类 + 测试运行器）
- [ ] M11: 最小成功标准端到端验证
- [ ] M12: v0.2.0 发布

---

## 4. Foundation Phase 3 (v0.3.0) — AI Kernel 最小可用

### 4.1 目标

实现 AI Kernel 的核心能力，使 Developer Agent 可以操作 TLL OS。

### 4.2 交付物

#### AI-Native Runtime

- LLM Provider 抽象（OpenAI 兼容 + Mock）
- Agent Runtime（最小推理循环）
- Context Builder（应用清单加载）
- Tool Registry（注册、发现、权限过滤）
- 内置 Tool（module/plugin/route/service/test/error/file 操作）
- Permission Guard（基础权限检查 + 审批机制）
- Memory（Working + Short-term）
- AI Runtime 入口（HTTP + CLI）

#### AI Developer Protocol

- Agent 操作 TLL OS 的标准接口规范
- Tool Call 协议（请求/响应/错误格式）
- Agent 审批协议（审批请求/响应/超时）
- Agent 审计日志格式
- Agent 上下文协议（Context 构建/传递/序列化）

#### AI Module Generation

- `module-generator` Skill（最小版本）
- Agent 创建 Module 的工作流
- Module 代码生成模板
- Module 测试生成
- 端到端验证：Agent 从需求到可运行 Module

#### AI Plugin Generation

- `plugin-generator` Skill（最小版本）
- Agent 创建 Plugin 的工作流
- Plugin Manifest 生成（含 ai_metadata、权限声明）
- Plugin 安装/启用验证
- 端到端验证：Agent 从需求到可启用 Plugin

#### AI Testing Loop

- `test_run` / `test_coverage` / `error_list` / `error_get` Tool
- 测试结果解析（JSON 格式）
- 失败分析（错误堆栈 → 代码定位）
- 修复循环（修改 → 测试 → 再修改）
- `bug-fixer` Skill（最小版本）
- 端到端验证：Agent 发现 Bug → 修复 → 测试通过

### 4.3 里程碑

- [ ] M1: LLM Provider + Mock Provider
- [ ] M2: Tool Contract + Tool Registry + 内置查询 Tool
- [ ] M3: Agent Runtime（最小推理循环）
- [ ] M4: Context Builder
- [ ] M5: Permission Guard + 审批机制
- [ ] M6: Developer Agent（最小版本）
- [ ] M7: AI Module Generation（module-generator Skill）
- [ ] M8: AI Plugin Generation（plugin-generator Skill）
- [ ] M9: AI Testing Loop（test_run + error_get + 修复循环）
- [ ] M10: Memory（Working + Short-term）
- [ ] M11: AI Runtime 入口（HTTP + CLI）
- [ ] M12: 端到端验证（Agent 创建 Module/Plugin + 修复 Bug）
- [ ] M13: v0.3.0 发布

---

## 5. Foundation Phase 4 (v0.4.0) — 完整基础能力

### 5.1 目标

补全 API 系统、安全体系、测试体系，使 TLL OS Foundation 达到生产可用的基础水平。

### 5.2 交付物

#### API 系统完整实现

- REST API 规范完整实现
- OpenAPI 自动生成
- API 版本化（URL + Header 双模式）
- 认证中间件（API Key + JWT 完整实现）
- 授权中间件（RBAC + 细粒度权限）
- 限流中间件
- CORS / CSRF / 安全响应头
- WebSocket 实现
- Webhook 实现（出站 + 入站）
- Agent 专属 API（`/api/agent/*`）

#### 安全体系完整实现

- 加密服务（AES-256-GCM）
- 密码哈希（bcrypt/Argon2）
- 数据脱敏
- Plugin 沙箱（Module 隔离 + 受限 Container）
- AI Agent 安全（Prompt Injection 防护 + 操作回滚）
- 审计日志（不可篡改 + 查询导出）
- 安全事件告警
- 依赖漏洞扫描
- `tll doctor` 安全检查

#### 测试体系完整实现

- 所有测试基类（Kernel/Module/Plugin/API/AI）
- 断言库扩展
- 测试替身工具（mock/stub/fake）
- 覆盖率报告（text/json/html）
- Watch 模式
- JSON 输出格式
- CI/CD 集成配置
- AI Testing Loop 完整实现

#### CLI 完整实现

- 所有内置命令
- 交互式输入（confirm/ask/choice/progress）
- 自动补全（bash/zsh/fish）
- Module/Plugin 自定义命令注册
- `tll doctor` 环境诊断

### 5.3 里程碑

- [ ] M1: API 系统完整实现
- [ ] M2: 安全体系完整实现
- [ ] M3: 测试体系完整实现
- [ ] M4: CLI 完整实现
- [ ] M5: Plugin 沙箱（Module 隔离）
- [ ] M6: AI Agent 安全增强
- [ ] M7: 性能优化
- [ ] M8: 文档完善（使用文档 + API 文档 + 教程）
- [ ] M9: v0.4.0 发布

---

## 6. Beta (v0.5.0) — 生态启动

### 6.1 目标

发布 Beta 版本，启动生态，收集反馈，稳定 API。

### 6.2 交付物

- 完整的开发者文档
- 示例项目（HelloWorld、Blog、API Service）
- Plugin Registry（远程，最小版本）
- Skill Registry（远程，最小版本）
- 社区贡献指南完善
- 性能基准测试
- 兼容性测试（Node.js 20/22，Linux/macOS/Windows）
- 迁移指南

### 6.3 AI Self-Healing Application

- Self-Healing Agent（预定义错误类型的自动修复）
- 系统健康监控
- 自动修复循环（错误检测 → 分析 → 修复 → 验证）
- 修复审批机制
- 修复回滚能力
- 端到端验证：应用出错 → Self-Healing Agent 自动修复

---

## 7. GA (v1.0.0) — 生产就绪

### 7.1 目标

发布 1.0 正式版，承诺 API 稳定性，提供长期支持。

### 7.2 交付物

- API 稳定性承诺（SemVer 严格执行）
- 长期支持（LTS）计划
- 完整的生产部署文档
- 安全审计报告
- 性能基准报告
- 商业化支持渠道
- 生态系统（Module/Plugin/Skill 市场）

---

## 8. 已实现功能

### Phase 1 (当前)

- [x] 六大框架架构研究对比
- [x] 技术选型决策（TypeScript + Node.js + 零运行时依赖 Kernel）
- [x] 总体架构设计（分层架构 + 数据流）
- [x] 15 个 Kernel 组件设计
- [x] Module 系统设计（Manifest + 生命周期 + 发现注册）
- [x] Plugin 系统设计（Manifest + 权限 + 沙箱 + ai_metadata）
- [x] API 系统设计（REST + OpenAPI + 版本化 + 认证授权）
- [x] AI Kernel 设计（Agent + Tool + Skill + Memory + Context + Workflow + MCP + Permission + Task）
- [x] CLI 设计（Command Contract + 内置命令 + 结构化输出）
- [x] Security 设计（认证 + 授权 + 加密 + Plugin 沙箱 + AI 安全）
- [x] Testing 设计（测试类型 + 测试基类 + AI Testing Loop）
- [x] AGENTS.md（Agent 作为开发者 + 运行时参与者 + 多 Agent 协作）
- [x] 11 项核心 Contract 定义
- [x] 7 条 ADR（架构决策记录）

---

## 9. 未实现功能

### Phase 2 待实现

- [ ] 所有 Kernel 组件的具体代码实现
- [ ] Module 系统代码实现
- [ ] Plugin 系统代码实现
- [ ] CLI 命令实现
- [ ] HTTP Runtime 实现
- [ ] 测试体系代码实现
- [ ] 最小成功标准端到端验证

### Phase 3 待实现

- [ ] AI Kernel 代码实现
- [ ] Developer Agent
- [ ] AI Module Generation
- [ ] AI Plugin Generation
- [ ] AI Testing Loop
- [ ] AI-Native Runtime

### Phase 4 待实现

- [ ] API 系统完整实现
- [ ] 安全体系完整实现
- [ ] Plugin VM 沙箱
- [ ] WebSocket/Webhook
- [ ] Agent 专属 API

### 后续待实现

- [ ] AI Self-Healing Application
- [ ] 多 Agent 协作
- [ ] MCP Server（TLL OS 作为 MCP Server）
- [ ] 长期记忆（向量搜索）
- [ ] 完整 Workflow Engine
- [ ] Plugin Registry（远程）
- [ ] 性能优化
- [ ] 生产部署工具链

---

## 10. 技术债务

| # | 债务 | 影响 | 计划修复版本 |
|---|------|------|-------------|
| 1 | Kernel 零运行时依赖策略可能导致部分组件性能不如成熟库 | 性能 | v0.4.0 评估，必要时引入可选依赖 |
| 2 | Plugin 沙箱第一阶段只有逻辑权限控制，无进程/VM 隔离 | 安全 | v0.4.0（Module 隔离）、v0.5.0（VM 隔离） |
| 3 | AI Agent 的长期记忆需要向量数据库，第一阶段未实现 | 功能 | v0.5.0 |
| 4 | 自研 Trie 路由器可能缺少边界 case 处理 | 稳定性 | v0.2.0 充分测试，v0.4.0 性能优化 |
| 5 | ESM 动态加载 Plugin 在某些 Node.js 版本可能有兼容性问题 | 兼容性 | v0.2.0 测试，要求 Node.js >= 20 |
| 6 | AI Tool 权限模型第一阶段较粗，缺少细粒度资源级权限 | 安全 | v0.3.0 基础权限，v0.4.0 细粒度权限 |
| 7 | 自研 CLI 参数解析器可能不如成熟库功能丰富 | 开发体验 | v0.2.0 评估，必要时引入 |

---

## 11. 下一阶段建议

### 11.1 立即行动（Phase 1 收尾）

1. **完成第一轮架构审查**：用户审查 12 份文档，提出修改意见
2. **根据审查意见修订文档**：确保架构方向正确
3. **搭建项目骨架**：package.json、tsconfig.json、核心接口定义
4. **验证骨架可编译**：`tsc --noEmit` 通过

### 11.2 Phase 2 启动建议

1. **从 Container 开始**：Container 是所有组件的基础，先实现并充分测试
2. **小步迭代**：每个组件实现后立即写测试，不攒一堆再测
3. **持续验证最小成功标准**：每实现一个组件，检查是否向最小成功标准迈进一步
4. **保持零依赖纪律**：Kernel 不引入运行时依赖，遇到困难先评估是否真的需要
5. **文档与代码同步**：实现代码时更新对应文档，确保文档与实现一致

### 11.3 风险提示

1. **自研组件的质量风险**：Container/Router/Event 等自研组件需要充分测试，建议参考成熟框架的测试用例
2. **Plugin 沙箱的实现复杂度**：Node.js 中实现真正的沙箱比较复杂，第一阶段用逻辑权限控制，后续逐步加强
3. **AI Agent 的可靠性**：LLM 的输出不确定，Agent 操作需要有完善的错误处理和回滚机制
4. **范围蔓延**：Foundation 阶段容易被上层需求（商城、CRM）干扰，必须严格遵守"不开发商城业务"的铁律
5. **零依赖与开发效率的平衡**：零依赖策略可能降低开发效率，需要在架构质量和交付速度之间找到平衡

---

## 12. 架构审查清单

等待用户第一轮架构审查时，建议关注以下要点：

### 12.1 方向正确性

- [ ] TLL OS 的定位是否清晰（不是传统框架换皮）
- [ ] AI-Native 思想是否贯穿所有设计
- [ ] 11 项核心 Contract 是否定义完整
- [ ] Module/Plugin 的区别是否明确
- [ ] 造轮子的边界是否合理（哪些自研、哪些复用）

### 12.2 架构质量

- [ ] 分层是否清晰，依赖方向是否正确
- [ ] Kernel 是否足够极简（不包含业务逻辑）
- [ ] 组件职责是否单一，边界是否明确
- [ ] 事件驱动是否合理（组件间通信）
- [ ] 可测试性是否考虑充分

### 12.3 AI-Native 深度

- [ ] Agent 作为开发者的能力是否完整
- [ ] Agent 作为运行时参与者的模式是否合理
- [ ] Tool Contract 是否足够通用
- [ ] AI Context 是否能让 Agent 真正理解应用
- [ ] 权限和安全是否充分考虑 AI 操作
- [ ] Self-Healing 是否有可行的路径

### 12.4 可落地性

- [ ] 技术选型是否合理（TypeScript + Node.js）
- [ ] 零运行时依赖策略是否可行
- [ ] 最小成功标准是否可实现
- [ ] 路线图是否现实
- [ ] 技术债务是否可控

---

> **TLL OS Foundation 0.1 蓝图完成。等待第一轮架构审查。**
>
> 审查通过后，下达第二阶段施工令，开始 Kernel 实现。
