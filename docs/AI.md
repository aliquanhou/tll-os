# TLL OS AI Kernel 设计

> 文档：AI.md
> 版本：0.1.0-blueprint
> 状态：**TLL OS Foundation 核心设计文档**
> 战略修正：AI 是 TLL OS 的一等公民，不是普通的 AIService。AI Kernel 定义的 Agent/Tool/Skill/Context/Permission/Workflow Contract 是 TLL OS 必须自研的 11 项核心标准中的 7 项。

---

## 0. 为什么 AI Kernel 是 TLL OS 的灵魂

传统框架的开发模型：

```
Developer → Code → Framework → Application
```

TLL OS 的开发模型：

```
Developer + AI Agent
        ↓
   TLL OS (AI-Native Runtime)
        ↓
   Application
        ↓
Module / Plugin / Tool / Workflow
```

这不是"在框架里加一个 AI 助手"。这是**重新定义应用的开发和运行模型**：

1. **AI Agent 是 TLL OS 的一等开发者**：与人类开发者对等，通过标准接口理解、创建、修改、测试、修复应用
2. **AI Agent 是 TLL OS 的运行时参与者**：可以处理请求、执行任务、响应事件、自我修复
3. **TLL OS 的一切都是 AI 可理解的**：Module Manifest、Plugin Manifest、Route Metadata、API Schema、Event 定义、Service 接口——全部结构化，Agent 可解析
4. **TLL OS 的一切都是 AI 可操作的**：通过标准 Tool 接口，Agent 可以查询/创建/修改/测试/部署任何组件

如果 AI Kernel 设计得好，TLL OS 才真正有自己的灵魂。如果只是做一个传统框架 + AI 插件，那 TLL OS 就没有存在的意义。

---

## 1. AI Kernel 架构

### 1.1 分层

```
┌─────────────────────────────────────────────────────┐
│                  Agent Application Layer              │
│  Developer Agent / DevOps Agent / Support Agent / ...│
├─────────────────────────────────────────────────────┤
│                   Agent Runtime Layer                 │
│  Agent Orchestrator / Task Manager / Loop Engine     │
├─────────────────────────────────────────────────────┤
│                   Capability Layer                    │
│  Tool Registry / Skill Registry / Workflow Engine    │
├─────────────────────────────────────────────────────┤
│                   Context Layer                       │
│  Context Builder / Memory / Permission Guard         │
├─────────────────────────────────────────────────────┤
│                   Provider Layer                      │
│  LLM Provider (OpenAI-compatible / Anthropic / ...)  │
├─────────────────────────────────────────────────────┤
│                 TLL OS Kernel (标准接口)              │
│  Container / Router / Event / Config / CLI / Module  │
└─────────────────────────────────────────────────────┘
```

### 1.2 核心组件

| 组件 | 职责 | Contract 类型 |
|------|------|---------------|
| **Agent** | AI 代理的运行时，管理推理循环、Tool 调用、状态 | Agent Contract |
| **Tool** | Agent 可调用的能力单元，封装 TLL OS 操作 | Tool Contract |
| **Skill** | 可复用的 Agent 能力包，包含 Prompt + Tool + Workflow | Skill Contract |
| **Memory** | Agent 的短期/长期记忆，支持上下文持久化 | Memory Contract |
| **Context** | Agent 运行时的上下文构建，包含应用结构、权限、历史 | AI Context Contract |
| **Workflow** | 多步骤 Agent 任务编排，支持条件、循环、并行 | Workflow Contract |
| **MCP** | Model Context Protocol 支持，连接外部工具和数据源 | MCP Contract |
| **Permission** | Agent 操作的权限控制，安全边界 | Permission Contract |
| **Task** | Agent 任务的管理、排队、执行、追踪 | Task Contract |

---

## 2. Agent Contract

### 2.1 Agent 定义

Agent 是 TLL OS 中 AI 能力的运行时单元。每个 Agent 有：

- **身份**：名称、角色、描述
- **能力**：可用的 Tool 列表、Skill 列表
- **权限**：可执行的操作范围
- **记忆**：短期上下文 + 长期记忆
- **行为**：系统提示词、推理参数、最大步数

### 2.2 Agent 接口

```typescript
interface Agent {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly description: string;

  // 配置
  config: AgentConfig;

  // 能力
  tools: Tool[];
  skills: Skill[];

  // 运行
  run(input: AgentInput, context?: AgentContext): Promise<AgentResult>;
  stream(input: AgentInput, context?: AgentContext): AsyncIterable<AgentEvent>;

  // 状态
  getState(): AgentState;
  reset(): void;
}

interface AgentConfig {
  model: string;                    // 模型标识，如 "gpt-4o"
  temperature: number;              // 温度
  maxTokens: number;                // 最大输出 token
  maxSteps: number;                 // 最大推理步数（Tool 调用次数）
  systemPrompt: string;             // 系统提示词
  allowedTools: string[];           // 允许使用的 Tool（空=全部可用）
  allowedSkills: string[];          // 允许使用的 Skill
  memoryEnabled: boolean;           // 是否启用长期记忆
  stream: boolean;                  // 是否流式输出
  approvalRequired: boolean;        // 敏感操作是否需要人工审批
}

interface AgentInput {
  message: string;                  // 用户输入
  attachments?: Attachment[];       // 附件
  metadata?: Record<string, unknown>;
}

interface AgentResult {
  output: string;                   // 最终输出
  steps: AgentStep[];               // 执行步骤
  toolCalls: ToolCall[];            // Tool 调用记录
  tokensUsed: TokenUsage;           // Token 消耗
  duration: number;                 // 执行时长（ms）
  state: AgentState;                // 最终状态
}
```

### 2.3 Agent 推理循环

```
1. 构建 Context（应用结构 + 权限 + 历史 + 记忆）
   ↓
2. 组装 Prompt（system + context + user input + tool definitions）
   ↓
3. 调用 LLM
   ↓
4. 解析响应：
   ├─ 纯文本 → 最终输出，结束
   └─ Tool Call → 继续步骤 5
   ↓
5. 权限检查（Permission Guard）
   ↓
6. 执行 Tool
   ↓
7. 记录 Tool 结果到上下文
   ↓
8. 检查步数限制 → 未超限则回到步骤 3
   ↓
9. 最终输出
```

### 2.4 内置 Agent 类型

| Agent | 角色 | 用途 |
|-------|------|------|
| `Developer` | 开发者 | 创建/修改 Module、Plugin、编写代码、运行测试 |
| `DevOps` | 运维 | 部署、监控、日志分析、性能优化 |
| `Support` | 客服 | 回答用户问题、查询数据、执行操作 |
| `Architect` | 架构师 | 架构审查、技术选型、设计评审 |
| `Tester` | 测试工程师 | 生成测试用例、运行测试、分析覆盖率 |
| `Researcher` | 研究员 | 信息检索、文档分析、知识整理 |

第一阶段：定义 Agent Contract，实现 Developer Agent 的最小版本。

---

## 3. Tool Contract

### 3.1 Tool 定义

Tool 是 Agent 可调用的能力单元，是 Agent 操作 TLL OS 的标准接口。

每个 Tool 有：
- **名称**：唯一标识，kebab-case 或 snake_case
- **描述**：自然语言描述，供 LLM 理解何时使用
- **参数 Schema**：JSON Schema，定义输入参数
- **返回 Schema**：JSON Schema，定义返回值
- **权限要求**：执行此 Tool 需要的权限
- **执行函数**：实际的执行逻辑

### 3.2 Tool 接口

```typescript
interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonSchema;       // 输入参数 Schema
  readonly returns?: JsonSchema;          // 返回值 Schema
  readonly permissions: string[];         // 所需权限
  readonly category: ToolCategory;        // 分类
  readonly deprecated?: boolean;
  readonly replacement?: string;

  execute(args: ToolArgs, context: ToolContext): Promise<ToolResult>;
}

type ToolCategory =
  | 'module'        // Module 操作
  | 'plugin'        // Plugin 操作
  | 'route'         // 路由查询
  | 'service'       // 服务调用
  | 'database'      // 数据库操作
  | 'event'         // 事件发布/订阅
  | 'command'       // CLI 命令执行
  | 'test'          // 测试运行
  | 'config'        // 配置读写
  | 'file'          // 文件操作
  | 'search'        // 搜索
  | 'ai'            // AI 相关（调用其他 Agent）
  | 'system';       // 系统操作

interface ToolContext {
  agent: Agent;
  permissions: PermissionSet;
  requestId: string;
  container: Container;
  logger: Logger;
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: ToolError;
  metadata?: Record<string, unknown>;
}
```

### 3.3 TLL OS 内置 Tool（第一阶段目标）

#### Module 操作

| Tool | 描述 | 权限 |
|------|------|------|
| `module_list` | 列出所有 Module | `module:read` |
| `module_get` | 获取 Module 详细信息 | `module:read` |
| `module_create` | 创建新 Module 骨架 | `module:create` |
| `module_update` | 修改 Module 配置 | `module:update` |
| `module_routes` | 获取 Module 的路由 | `module:read` |
| `module_services` | 获取 Module 的服务 | `module:read` |
| `module_events` | 获取 Module 的事件 | `module:read` |
| `module_commands` | 获取 Module 的命令 | `module:read` |
| `module_test` | 运行 Module 的测试 | `module:test` |

#### Plugin 操作

| Tool | 描述 | 权限 |
|------|------|------|
| `plugin_list` | 列出所有 Plugin | `plugin:read` |
| `plugin_get` | 获取 Plugin 详细信息（含 ai_metadata） | `plugin:read` |
| `plugin_search` | 搜索可安装的 Plugin | `plugin:read` |
| `plugin_install` | 安装 Plugin | `plugin:install` |
| `plugin_enable` | 启用 Plugin | `plugin:manage` |
| `plugin_disable` | 禁用 Plugin | `plugin:manage` |
| `plugin_upgrade` | 升级 Plugin | `plugin:manage` |
| `plugin_uninstall` | 卸载 Plugin | `plugin:manage` |
| `plugin_create` | 创建 Plugin 骨架 | `plugin:create` |

#### 路由与服务

| Tool | 描述 | 权限 |
|------|------|------|
| `route_list` | 列出所有路由 | `route:read` |
| `route_match` | 匹配路由 | `route:read` |
| `service_call` | 调用已注册的服务 | `service:call` |
| `service_list` | 列出可调用的服务 | `service:read` |

#### 数据库

| Tool | 描述 | 权限 |
|------|------|------|
| `db_query` | 执行查询（只读） | `database:read` |
| `db_execute` | 执行写操作 | `database:write` |
| `db_schema` | 获取数据库表结构 | `database:read` |
| `db_migrate` | 执行迁移 | `database:migrate` |

#### 事件与命令

| Tool | 描述 | 权限 |
|------|------|------|
| `event_publish` | 发布事件 | `event:publish` |
| `event_list` | 列出事件定义 | `event:read` |
| `command_execute` | 执行 CLI 命令 | `command:execute` |
| `command_list` | 列出可用命令 | `command:read` |

#### 测试与修复

| Tool | 描述 | 权限 |
|------|------|------|
| `test_run` | 运行测试 | `test:run` |
| `test_coverage` | 获取测试覆盖率 | `test:read` |
| `error_list` | 获取最近错误 | `system:read` |
| `error_get` | 获取错误详情 | `system:read` |
| `fix_apply` | 应用修复（需审批） | `system:fix` |

#### 文件与搜索

| Tool | 描述 | 权限 |
|------|------|------|
| `file_read` | 读取文件 | `file:read` |
| `file_write` | 写入文件 | `file:write` |
| `file_search` | 搜索文件内容 | `file:read` |
| `code_search` | 代码搜索（符号/引用） | `file:read` |

### 3.4 Tool Registry

```typescript
interface ToolRegistry {
  register(tool: Tool): void;
  unregister(name: string): void;
  get(name: string): Tool | null;
  list(category?: ToolCategory): Tool[];
  listForPermissions(permissions: PermissionSet): Tool[];
  listForAgent(agent: Agent): Tool[];
  execute(name: string, args: ToolArgs, context: ToolContext): Promise<ToolResult>;
}
```

Module 和 Plugin 可以注册自定义 Tool，Agent 通过 Tool Registry 发现和调用。

---

## 4. Skill Contract

### 4.1 Skill 定义

Skill 是可复用的 Agent 能力包，包含：
- **Prompt 模板**：针对特定任务的系统提示词
- **Tool 集合**：完成任务所需的 Tool
- **Workflow**：多步骤任务编排
- **示例**：Few-shot 示例

Skill 让 Agent 能够快速获得特定领域的专业能力，而不需要每次重新配置。

### 4.2 Skill 接口

```typescript
interface Skill {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly author?: string;

  // 能力声明
  requiredTools: string[];           // 需要的 Tool
  requiredPermissions: string[];     // 需要的权限
  requiredModels?: string[];         // 推荐的模型

  // Prompt
  systemPrompt: string;              // 系统提示词模板
  fewShotExamples?: FewShotExample[];

  // Workflow（可选，复杂 Skill 使用）
  workflow?: WorkflowDefinition;

  // 生命周期
  activate?(agent: Agent): void | Promise<void>;
  deactivate?(agent: Agent): void | Promise<void>;
}

interface FewShotExample {
  input: string;
  output: string;
  toolCalls?: ToolCall[];
}
```

### 4.3 内置 Skill（第一阶段目标）

| Skill | 用途 | 包含 Tool |
|-------|------|-----------|
| `module-generator` | 生成 Module 骨架和代码 | module_create, file_write, route_list, test_run |
| `plugin-generator` | 生成 Plugin 骨架和代码 | plugin_create, file_write, plugin_install, test_run |
| `code-reviewer` | 代码审查 | file_read, code_search, error_list |
| `bug-fixer` | 自动发现和修复 Bug | error_list, file_read, file_write, test_run, fix_apply |
| `test-writer` | 生成测试用例 | file_read, code_search, file_write, test_run |
| `api-integrator` | API 集成（基于 OpenAPI） | route_list, service_call, file_write |
| `doc-writer` | 文档生成 | file_read, file_search, file_write |
| `refactor` | 代码重构 | file_read, code_search, file_write, test_run |

Skill 可以由 Module/Plugin 提供，也可以从 Skill Registry 安装。

---

## 5. Memory Contract

### 5.1 Memory 层次

```
┌─────────────────────────────────────┐
│  Working Memory (当前上下文)         │
│  - 当前对话历史                       │
│  - 当前任务状态                       │
│  - 已加载的 Module/Plugin 信息       │
├─────────────────────────────────────┤
│  Short-term Memory (短期记忆)         │
│  - 最近 N 轮对话                      │
│  - 最近执行的 Tool 和结果             │
│  - 最近的错误和修复                   │
├─────────────────────────────────────┤
│  Long-term Memory (长期记忆)          │
│  - 项目知识（架构、约定、历史决策）    │
│  - 用户偏好                           │
│  - 已学习的模式和规则                 │
│  - 持久化存储                         │
└─────────────────────────────────────┘
```

### 5.2 Memory 接口

```typescript
interface Memory {
  // Working Memory
  setWorking(key: string, value: unknown): void;
  getWorking<T>(key: string): T | null;
  clearWorking(): void;

  // Short-term Memory
  add(entry: MemoryEntry): void;
  getRecent(limit?: number): MemoryEntry[];
  search(query: string, limit?: number): Promise<MemoryEntry[]>;

  // Long-term Memory
  remember(key: string, value: unknown, tags?: string[]): Promise<void>;
  recall<T>(key: string): Promise<T | null>;
  recallByTag(tag: string, limit?: number): Promise<MemoryEntry[]>;
  forget(key: string): Promise<void>;
}

interface MemoryEntry {
  id: string;
  type: 'conversation' | 'tool_call' | 'error' | 'decision' | 'knowledge' | 'preference';
  content: string;
  metadata: Record<string, unknown>;
  timestamp: number;
  importance: number;  // 0-1，用于记忆筛选
  tags: string[];
}
```

### 5.3 记忆策略

1. **Working Memory**：每次 Agent 运行时构建，运行结束后清除
2. **Short-term Memory**：滑动窗口，保留最近 N 条（默认 50），超出后按重要性淘汰
3. **Long-term Memory**：持久化存储，支持向量搜索（后续阶段），第一阶段使用键值存储

---

## 6. AI Context Contract

### 6.1 Context 定义

AI Context 是 Agent 运行时的完整上下文，是 Agent 理解 TLL OS 应用的关键。

Context 包含：
1. **应用元数据**：应用名称、版本、TLL OS 版本
2. **Module 清单**：所有已注册 Module 的 Manifest 和能力
3. **Plugin 清单**：所有已启用 Plugin 的 Manifest 和 ai_metadata
4. **路由表**：所有已注册路由的元数据
5. **服务清单**：容器中可调用的服务
6. **事件清单**：所有事件定义和监听者
7. **命令清单**：所有 CLI 命令
8. **配置摘要**：非敏感配置项
9. **权限集**：当前 Agent 的权限
10. **对话历史**：最近的对话
11. **记忆**：短期和长期记忆
12. **可用 Tool**：基于权限过滤后的 Tool 列表
13. **可用 Skill**：基于权限过滤后的 Skill 列表

### 6.2 Context Builder

```typescript
interface ContextBuilder {
  build(agent: Agent, input: AgentInput): Promise<AgentContext>;

  // 各部分构建
  buildApplicationMeta(): ApplicationMeta;
  buildModuleInventory(): ModuleInfo[];
  buildPluginInventory(): PluginInfo[];
  buildRouteTable(): RouteInfo[];
  buildServiceInventory(): ServiceInfo[];
  buildEventInventory(): EventInfo[];
  buildCommandInventory(): CommandInfo[];
  buildConfigSummary(): Record<string, unknown>;
  buildAvailableTools(permissions: PermissionSet): Tool[];
  buildAvailableSkills(permissions: PermissionSet): Skill[];
}

interface AgentContext {
  application: ApplicationMeta;
  modules: ModuleInfo[];
  plugins: PluginInfo[];
  routes: RouteInfo[];
  services: ServiceInfo[];
  events: EventInfo[];
  commands: CommandInfo[];
  config: Record<string, unknown>;
  permissions: PermissionSet;
  tools: Tool[];
  skills: Skill[];
  history: ConversationTurn[];
  memory: MemorySnapshot;
}
```

### 6.3 Context 优化策略

完整的 Context 可能非常大，需要优化：

1. **按需加载**：默认只加载清单（名称、描述），详细信息在 Agent 请求时通过 Tool 获取
2. **摘要压缩**：对长列表进行摘要，保留关键信息
3. **优先级排序**：按相关性排序，最重要的信息放在前面
4. **Token 预算**：Context 总大小不超过模型的上下文窗口，超出时按重要性淘汰

第一阶段：实现基础的 Context Builder，支持清单加载和按需详情。

---

## 7. Permission Contract

### 7.1 AI 权限模型

Agent 的权限独立于用户权限，但可以关联。Agent 操作 TLL OS 时必须经过权限检查。

### 7.2 权限层次

```
Agent Role → Agent Permission Set → Tool Permission → Operation Permission
```

1. **Agent Role**：预定义的角色（Developer/DevOps/Support/...），每个角色有默认权限集
2. **Agent Permission Set**：当前 Agent 的具体权限，可以是角色权限 + 额外权限
3. **Tool Permission**：每个 Tool 声明所需权限，Agent 必须拥有这些权限才能调用
4. **Operation Permission**：Tool 执行时的具体操作权限（如读哪个表、写哪个文件）

### 7.3 权限接口

```typescript
interface PermissionSet {
  has(permission: string): boolean;
  hasAll(permissions: string[]): boolean;
  hasAny(permissions: string[]): boolean;
  list(): string[];
}

interface PermissionGuard {
  check(agent: Agent, tool: Tool, args: ToolArgs): PermissionCheckResult;
  checkOperation(agent: Agent, operation: string, resource: string): boolean;
  requireApproval(agent: Agent, tool: Tool, args: ToolArgs): boolean;
}

interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiresApproval: boolean;
  missingPermissions?: string[];
}
```

### 7.4 敏感操作审批

以下操作默认需要人工审批：
- `plugin_install` / `plugin_uninstall`
- `db_execute`（写操作）
- `file_write`（修改源代码）
- `fix_apply`（应用自动修复）
- `command_execute`（执行系统命令）

审批可以通过：
- CLI 交互确认
- HTTP 回调通知
- 预配置的自动审批规则（CI/CD 场景）

---

## 8. Workflow Contract

### 8.1 Workflow 定义

Workflow 是多步骤 Agent 任务的编排，支持条件分支、循环、并行、人工审批。

Workflow 让复杂任务（如"生成一个完整的 Module 并通过测试"）可以被定义、复用、追踪。

### 8.2 Workflow 接口

```typescript
interface Workflow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly definition: WorkflowDefinition;

  execute(input: WorkflowInput, context: AgentContext): Promise<WorkflowResult>;
  getState(): WorkflowState;
  pause(): void;
  resume(): void;
  cancel(): void;
}

interface WorkflowDefinition {
  steps: WorkflowStep[];
  variables?: Record<string, unknown>;
  onError?: ErrorHandler;
}

interface WorkflowStep {
  id: string;
  name: string;
  type: 'agent' | 'tool' | 'condition' | 'loop' | 'parallel' | 'approval' | 'code';
  config: StepConfig;
  next?: string | NextCondition[];  // 下一步 ID 或条件分支
}

type StepConfig =
  | { agent: string; prompt: string; outputVar?: string }
  | { tool: string; args: Record<string, unknown>; outputVar?: string }
  | { condition: string; trueStep: string; falseStep: string }
  | { loop: string; itemsVar: string; bodyStep: string }
  | { parallel: string[]; wait: 'all' | 'any' }
  | { approval: string; timeout?: number }
  | { code: string };  // 自定义代码（受限沙箱）

interface WorkflowResult {
  success: boolean;
  output: unknown;
  steps: StepExecution[];
  duration: number;
  error?: WorkflowError;
}
```

### 8.3 内置 Workflow（第一阶段目标）

| Workflow | 用途 | 步骤 |
|----------|------|------|
| `module-generate` | 生成完整 Module | 分析需求 → 生成 Manifest → 生成代码 → 生成测试 → 运行测试 → 修复 Bug → 完成 |
| `plugin-generate` | 生成完整 Plugin | 分析需求 → 生成 Manifest → 生成代码 → 生成测试 → 安装 → 启用 → 验证 |
| `bug-fix-loop` | 自动修复 Bug | 获取错误 → 分析原因 → 修改代码 → 运行测试 → 未通过则循环 → 通过则完成 |
| `code-review` | 代码审查 | 读取代码 → 分析问题 → 生成报告 → 建议修复 |
| `test-generation` | 生成测试 | 分析代码 → 生成测试用例 → 运行测试 → 调整 → 完成 |
| `deploy` | 部署 | 运行测试 → 构建 → 备份 → 部署 → 验证 → 回滚（失败时） |

---

## 9. MCP (Model Context Protocol)

### 9.1 MCP 支持

TLL OS 支持 Model Context Protocol，允许 Agent 连接外部工具和数据源。

MCP 让 TLL OS 的 Agent 可以：
- 连接外部 MCP Server（如数据库、文件系统、第三方 API）
- 将 TLL OS 自身作为 MCP Server 暴露给外部 Agent
- 统一管理内部 Tool 和外部 MCP Tool

### 9.2 MCP 接口

```typescript
interface McpClient {
  connect(server: McpServerConfig): Promise<McpConnection>;
  disconnect(connectionId: string): void;
  listTools(connectionId: string): Promise<McpTool[]>;
  callTool(connectionId: string, name: string, args: unknown): Promise<McpToolResult>;
  listConnections(): McpConnectionInfo[];
}

interface McpServer {
  // TLL OS 作为 MCP Server
  start(port: number): Promise<void>;
  stop(): void;
  registerTool(tool: Tool): void;
  registerResource(uri: string, handler: () => Promise<unknown>): void;
  registerPrompt(name: string, handler: (args: unknown) => Promise<string>): void;
}
```

第一阶段：定义 MCP Contract，实现 TLL OS 作为 MCP Client 的最小版本（连接外部 MCP Server）。

---

## 10. Task Contract

### 10.1 Task 定义

Task 是 Agent 执行的工作单元，可以是同步的（立即执行）或异步的（排队执行）。

Task 管理包括：排队、执行、追踪、重试、取消。

### 10.2 Task 接口

```typescript
interface Task {
  readonly id: string;
  readonly type: 'agent' | 'workflow' | 'tool' | 'command';
  readonly input: unknown;
  status: TaskStatus;
  result?: unknown;
  error?: TaskError;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  attempts: number;
  maxAttempts: number;
}

type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';

interface TaskManager {
  // 创建
  create(type: Task['type'], input: unknown, options?: TaskOptions): Promise<Task>;

  // 执行
  execute(taskId: string): Promise<Task>;
  queue(taskId: string): void;
  processQueue(): Promise<void>;

  // 查询
  get(taskId: string): Task | null;
  list(status?: TaskStatus): Task[];
  listByAgent(agentId: string): Task[];

  // 控制
  cancel(taskId: string): void;
  retry(taskId: string): void;
}
```

---

## 11. AI Agent 如何操作 TLL OS（核心设计问题）

### 11.1 Agent 如何理解一个 TLL OS 应用

```
Agent 启动
  ↓
Context Builder 构建应用上下文
  ├─ 读取 Application Meta（名称、版本、TLL OS 版本）
  ├─ 查询 Module Registry → 获取所有 Module Manifest
  ├─ 查询 Plugin Manager → 获取所有 Plugin Manifest + ai_metadata
  ├─ 查询 Router → 获取所有路由（含权限、版本、OpenAPI 描述）
  ├─ 查询 Container → 获取可调用服务列表
  ├─ 查询 EventDispatcher → 获取事件定义
  ├─ 查询 CliKernel → 获取命令列表
  ├─ 读取非敏感配置
  └─ 加载记忆（项目知识、历史决策）
  ↓
Agent 获得应用的完整结构化画像
  ↓
Agent 可以回答："这个应用有哪些模块？""有哪些 API？""支付功能是怎么实现的？"
```

### 11.2 Agent 如何发现 Module

1. 调用 `module_list` Tool → 获取 Module 清单
2. 对感兴趣的 Module 调用 `module_get` Tool → 获取详细信息
3. 读取 Module 的 Manifest、路由、服务、事件、命令
4. 如需查看代码，调用 `file_read` Tool 读取 Module 源代码

### 11.3 Agent 如何发现 Plugin

1. 调用 `plugin_list` Tool → 获取已安装 Plugin
2. 调用 `plugin_search` Tool → 搜索可安装的 Plugin
3. 读取 Plugin 的 `ai_metadata` → 快速理解 Plugin 能力
4. 如需详细信息，调用 `plugin_get` Tool

### 11.4 Agent 如何知道某个 API 怎么使用

1. 获取 OpenAPI 文档（`/api/docs.json`）或调用 `route_list` Tool
2. 解析端点的路径、方法、参数、请求体、响应体
3. 查看认证要求和权限要求
4. 生成 API 调用代码
5. 通过 `service_call` Tool 或直接 HTTP 调用执行

### 11.5 Agent 如何创建 Module

```
1. 理解需求（用户输入："我要一个库存模块"）
   ↓
2. 分析现有应用（Context Builder）
   ├─ 检查是否已有相关 Module
   ├─ 分析数据库结构
   ├─ 分析现有事件和服务
   └─ 确定依赖关系
   ↓
3. 设计 Module
   ├─ 确定 Module 名称、命名空间
   ├─ 设计数据模型
   ├─ 设计 API 路由
   ├─ 设计服务接口
   ├─ 设计事件
   └─ 确定依赖的 Module/Plugin
   ↓
4. 调用 `module_create` Tool → 生成 Module 骨架
   ↓
5. 调用 `file_write` Tool → 写入代码
   ├─ Manifest (tll.module.json)
   ├─ 入口 (index.ts)
   ├─ Controllers
   ├─ Services
   ├─ Models
   ├─ Routes
   ├─ Events
   └─ Config
   ↓
6. 调用 `file_write` Tool → 生成测试
   ↓
7. 调用 `module_test` Tool → 运行测试
   ↓
8. 测试失败 → 调用 `error_list` / `error_get` → 分析错误
   ↓
9. 调用 `file_write` Tool → 修复代码
   ↓
10. 重复 7-9 直到测试通过
    ↓
11. 注册路由、事件、命令（Module boot 时自动完成）
    ↓
12. 提交变更（Git）
    ↓
13. 完成
```

### 11.6 Agent 如何修改 Module

1. 调用 `module_get` Tool → 理解当前 Module
2. 调用 `file_read` / `code_search` Tool → 读取相关代码
3. 分析修改影响（哪些路由、服务、事件、测试会受影响）
4. 调用 `file_write` Tool → 修改代码
5. 更新相关测试
6. 调用 `module_test` Tool → 运行测试
7. 测试失败 → 修复循环
8. 测试通过 → 完成

### 11.7 Agent 如何运行测试

1. 调用 `test_run` Tool → 运行全部或指定测试
2. 解析测试结果（通过/失败/错误/覆盖率）
3. 失败时调用 `error_get` Tool → 获取详细错误
4. 分析失败原因
5. 修复代码
6. 重新运行测试

### 11.8 Agent 如何发现错误并修复

```
1. 监控（定时任务 / 事件触发 / 用户报告）
   ↓
2. 调用 `error_list` Tool → 获取最近错误
   ↓
3. 调用 `error_get` Tool → 获取错误详情（堆栈、上下文、相关请求）
   ↓
4. 分析错误
   ├─ 确定错误来源（哪个 Module/Plugin/文件）
   ├─ 分析根本原因
   └─ 确定修复方案
   ↓
5. 调用 `file_read` Tool → 读取相关代码
   ↓
6. 调用 `file_write` Tool → 修复代码
   ↓
7. 调用 `test_run` Tool → 运行相关测试
   ↓
8. 测试通过 → 调用 `fix_apply` Tool → 应用修复（需审批）
   ↓
9. 记录到 Memory（错误模式、修复方案）
   ↓
10. 完成
```

### 11.9 Agent 如何通过权限系统安全地执行操作

1. Agent 启动时加载 Permission Set
2. 调用 Tool 前，Permission Guard 检查：
   - Agent 是否拥有 Tool 所需权限
   - 操作是否在允许的资源范围内
   - 操作是否需要人工审批
3. 权限不足 → 拒绝执行，返回错误
4. 需要审批 → 暂停执行，请求审批
5. 审批通过 → 继续执行
6. 所有操作记录审计日志

---

## 12. LLM Provider 抽象

### 12.1 Provider 接口

```typescript
interface LlmProvider {
  readonly name: string;

  chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse>;
  chatStream(messages: ChatMessage[], options: ChatOptions): AsyncIterable<ChatChunk>;

  // 能力查询
  supportsToolCalls(): boolean;
  supportsStreaming(): boolean;
  getMaxContextLength(): number;
  listModels(): ModelInfo[];
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}
```

### 12.2 内置 Provider

| Provider | 说明 |
|----------|------|
| `openai-compatible` | OpenAI 兼容协议（默认，支持 OpenAI、Azure OpenAI、本地模型等） |
| `anthropic` | Anthropic Claude（后续阶段） |
| `google` | Google Gemini（后续阶段） |
| `mock` | Mock Provider（测试用，返回预设响应） |

第一阶段：实现 OpenAI 兼容 Provider + Mock Provider。

---

## 13. AI Runtime 入口

### 13.1 HTTP 入口

- `POST /api/agent/run` —— 同步运行 Agent
- `POST /api/agent/stream` —— 流式运行 Agent（SSE）
- `POST /api/agent/task` —— 创建异步任务
- `GET /api/agent/task/:id` —— 查询任务状态
- `GET /api/agent/tools` —— 获取可用 Tool 列表
- `GET /api/agent/skills` —— 获取可用 Skill 列表

### 13.2 CLI 入口

- `tll ai:agent <name>` —— 启动交互式 Agent
- `tll ai:run "<prompt>"` —— 单次运行 Agent
- `tll ai:tools` —— 列出可用 Tool
- `tll ai:skills` —— 列出可用 Skill
- `tll ai:tasks` —— 列出 Agent 任务

### 13.3 WebSocket 入口

- `ws://host/ws/agent` —— 交互式 Agent WebSocket 连接

---

## 14. 未实现与 TODO

第一阶段（蓝图阶段）AI Kernel 为**完整的 Contract 设计 + 接口定义**。

第二阶段实现优先级：
1. LLM Provider 抽象（OpenAI 兼容 + Mock）
2. Tool Contract + Tool Registry
3. 内置 Tool（module_list, module_get, route_list, service_list, test_run, error_list）
4. Agent Contract + Agent Runtime（最小推理循环）
5. Context Builder（应用清单加载）
6. Permission Guard（基础权限检查）
7. Memory（Working + Short-term）
8. Developer Agent（最小版本：能查询应用结构、运行测试）
9. Skill Contract + 内置 Skill（module-generator 最小版本）
10. Workflow Contract（接口定义）
11. Task Manager（基础排队和执行）
12. MCP Client（最小版本）
13. AI Runtime 入口（HTTP + CLI）

后续阶段：
- 长期记忆（向量搜索）
- 完整的 Workflow Engine
- MCP Server（TLL OS 作为 MCP Server）
- 自动修复循环（bug-fix-loop）
- Agent 间协作（多 Agent 系统）
- AI Self-Healing Application
