# TLL OS Application Graph Contract

> 文档：APPLICATION-GRAPH.md
> 版本：0.1.0-blueprint
> 状态：**TLL OS 核心概念文档**
> 新增：第一轮架构总审查后追加的第 12 项核心 Contract

---

## 0. 为什么 Application Graph 是 TLL OS 最重要的概念之一

传统框架中，一个应用的结构散落在各处：
- 路由在路由文件里
- 服务在容器里
- 数据库表在迁移文件里
- 事件在代码里
- 依赖在 package.json 里
- 权限在配置里

人类开发者可以通过阅读代码和文档来理解应用。但 **AI Agent 不能**。

AI Agent 需要一个**结构化的、可查询的、完整的应用地图**，来回答：

- 这个应用有什么？
- 模块之间是什么关系？
- 哪个 API 属于哪个模块？
- 哪个数据库表属于哪个模块？
- 哪个 Agent 可以调用什么？
- 哪个 Plugin 提供什么？
- 哪些依赖互相连接？
- 修改某个模块会影响什么？

**Application Graph 就是这张地图。**

它不是一个可选的辅助工具，而是 TLL OS AI-Native 设计的核心基础设施。没有 Application Graph，AI Agent 就无法真正理解和操作一个 TLL OS 应用。

---

## 1. Application Graph 定义

Application Graph 是一个**有向属性图（Directed Property Graph）**，描述一个 TLL OS 应用的完整结构和关系。

```
Application
  │
  ├── Nodes（节点）
  │   ├── Module
  │   ├── Plugin
  │   ├── API
  │   ├── Model
  │   ├── Event
  │   ├── Workflow
  │   ├── Agent
  │   ├── Tool
  │   ├── Skill
  │   ├── Permission
  │   ├── Command
  │   ├── Config
  │   └── Dependency
  │
  └── Edges（边）
      ├── belongs_to     （API belongs_to Module）
      ├── depends_on     （Module depends_on Module）
      ├── provides       （Plugin provides Tool）
      ├── calls          （Agent calls Tool）
      ├── triggers       （Event triggers Workflow）
      ├── requires       （API requires Permission）
      ├── uses           （Module uses Model）
      ├── extends        （Plugin extends Module）
      └── conflicts_with （Plugin conflicts_with Plugin）
```

---

## 2. Graph Node（节点）

### 2.1 Node 基础接口

```typescript
interface GraphNode {
  id: string;                    // 唯一标识，格式：{type}:{name}，如 "module:user"
  type: NodeType;                // 节点类型
  name: string;                  // 名称
  description?: string;          // 描述
  version?: string;              // 版本
  status?: NodeStatus;           // 状态
  capabilities?: string[];       // 能力标签
  permissions?: string[];        // 权限要求
  metadata?: Record<string, unknown>;  // 类型特定的元数据
  createdAt: number;
  updatedAt: number;
}

type NodeType =
  | 'application'
  | 'module'
  | 'plugin'
  | 'api'
  | 'model'
  | 'event'
  | 'workflow'
  | 'agent'
  | 'tool'
  | 'skill'
  | 'permission'
  | 'command'
  | 'config'
  | 'dependency'
  | 'build_target';

type NodeStatus =
  | 'active'
  | 'inactive'
  | 'draft'
  | 'deprecated'
  | 'error';
```

### 2.2 各类型节点的元数据

#### Application Node

```typescript
interface ApplicationNode extends GraphNode {
  type: 'application';
  metadata: {
    tllVersion: string;
    runtime: string;             // 'node' | 'bun' | ...
    environment: string;
    entryPoint: string;
  };
}
```

#### Module Node

```typescript
interface ModuleNode extends GraphNode {
  type: 'module';
  metadata: {
    namespace: string;
    entry: string;
    routes: string[];             // API node IDs
    services: string[];
    events: string[];             // Event node IDs
    commands: string[];           // Command node IDs
    models: string[];             // Model node IDs
    dependencies: string[];       // Module/Plugin node IDs
  };
}
```

#### Plugin Node

```typescript
interface PluginNode extends GraphNode {
  type: 'plugin';
  metadata: {
    pluginType: string;           // 'payment-gateway' | 'storage' | ...
    state: 'installed' | 'enabled' | 'disabled';
    permissions: string[];
    provides: string[];           // Tool/Service/API node IDs
    aiSummary?: string;           // AI 可理解的能力摘要
    aiCapabilities?: string[];
  };
}
```

#### API Node

```typescript
interface ApiNode extends GraphNode {
  type: 'api';
  metadata: {
    method: string;               // 'GET' | 'POST' | ...
    path: string;
    module: string;               // Module node ID
    version?: string;
    authRequired: boolean;
    permissions: string[];
    requestSchema?: JsonObject;
    responseSchema?: JsonObject;
  };
}
```

#### Model Node

```typescript
interface ModelNode extends GraphNode {
  type: 'model';
  metadata: {
    module: string;
    tableName?: string;
    fields: Array<{ name: string; type: string; required: boolean }>;
    relationships: Array<{ type: string; target: string }>;
  };
}
```

#### Event Node

```typescript
interface EventNode extends GraphNode {
  type: 'event';
  metadata: {
    module?: string;
    plugin?: string;
    payloadSchema?: JsonObject;
    listeners: string[];          // Module/Plugin/Agent node IDs
  };
}
```

#### Workflow Node

```typescript
interface WorkflowNode extends GraphNode {
  type: 'workflow';
  metadata: {
    steps: string[];              // Step definitions
    triggers: string[];           // Event/API node IDs
    agents: string[];             // Agent node IDs
  };
}
```

#### Agent Node

```typescript
interface AgentNode extends GraphNode {
  type: 'agent';
  metadata: {
    role: string;                 // 'developer' | 'support' | ...
    tools: string[];              // Tool node IDs
    skills: string[];             // Skill node IDs
    permissions: string[];
    model?: string;
  };
}
```

#### Tool Node

```typescript
interface ToolNode extends GraphNode {
  type: 'tool';
  metadata: {
    category: string;
    module?: string;
    plugin?: string;
    parameters: JsonObject;
    returns?: JsonObject;
    permissions: string[];
  };
}
```

#### Skill Node

```typescript
interface SkillNode extends GraphNode {
  type: 'skill';
  metadata: {
    requiredTools: string[];
    requiredPermissions: string[];
    systemPrompt?: string;
  };
}
```

#### Permission Node

```typescript
interface PermissionNode extends GraphNode {
  type: 'permission';
  metadata: {
    resource: string;
    action: string;
    grantedTo: string[];          // Role/Agent/Plugin node IDs
  };
}
```

#### Command Node

```typescript
interface CommandNode extends GraphNode {
  type: 'command';
  metadata: {
    module?: string;
    plugin?: string;
    arguments: Array<{ name: string; required: boolean }>;
    options: Array<{ name: string; type: string }>;
  };
}
```

#### Config Node

```typescript
interface ConfigNode extends GraphNode {
  type: 'config';
  metadata: {
    module?: string;
    plugin?: string;
    schema?: JsonObject;
    secret: boolean;
  };
}
```

#### Dependency Node

```typescript
interface DependencyNode extends GraphNode {
  type: 'dependency';
  metadata: {
    packageName: string;
    versionRange: string;
    source: 'npm' | 'tll-registry' | 'local';
    usedBy: string[];             // Module/Plugin node IDs
  };
}
```

#### Build Target Node

```typescript
interface BuildTargetNode extends GraphNode {
  type: 'build_target';
  metadata: {
    runtime: string;              // 'node' | 'bun' | ...
    format: string;               // 'esm' | 'cjs'
    outputPath: string;
    entryPoint: string;
  };
}
```

---

## 3. Graph Edge（边）

### 3.1 Edge 基础接口

```typescript
interface GraphEdge {
  id: string;                     // 唯一标识
  type: EdgeType;                 // 边类型
  source: string;                 // 源节点 ID
  target: string;                 // 目标节点 ID
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

type EdgeType =
  | 'belongs_to'
  | 'depends_on'
  | 'provides'
  | 'calls'
  | 'triggers'
  | 'requires'
  | 'uses'
  | 'extends'
  | 'conflicts_with'
  | 'listens_to'
  | 'implements'
  | 'exports'
  | 'imports'
  | 'builds_for';
```

### 3.2 边类型说明

| 边类型 | 源 → 目标 | 说明 |
|--------|-----------|------|
| `belongs_to` | API → Module | API 属于哪个 Module |
| `depends_on` | Module → Module/Plugin/Dependency | 依赖关系 |
| `provides` | Plugin → Tool/Service/API | Plugin 提供的能力 |
| `calls` | Agent → Tool/API/Command | Agent 调用什么 |
| `triggers` | Event → Workflow/Agent | 事件触发什么 |
| `requires` | API/Tool → Permission | 需要什么权限 |
| `uses` | Module → Model/Service | 使用什么资源 |
| `extends` | Plugin → Module | Plugin 扩展哪个 Module |
| `conflicts_with` | Plugin → Plugin | 插件冲突 |
| `listens_to` | Module/Plugin/Agent → Event | 监听什么事件 |
| `implements` | Module → ServiceContract | 实现什么契约 |
| `exports` | Module → Service/Tool | 导出什么 |
| `imports` | Module → Service/Tool | 导入什么 |
| `builds_for` | Application → BuildTarget | 构建目标 |

---

## 4. Application Graph 接口

### 4.1 核心接口

```typescript
interface ApplicationGraph {
  // 节点操作
  addNode(node: GraphNode): void;
  removeNode(id: string): void;
  getNode(id: string): GraphNode | null;
  hasNode(id: string): boolean;
  updateNode(id: string, patch: Partial<GraphNode>): void;
  listNodes(type?: NodeType): GraphNode[];

  // 边操作
  addEdge(edge: GraphEdge): void;
  removeEdge(id: string): void;
  getEdge(id: string): GraphEdge | null;
  listEdges(type?: EdgeType): GraphEdge[];

  // 查询（Agent 最常用的操作）
  findModules(): ModuleNode[];
  findPlugins(): PluginNode[];
  findApis(): ApiNode[];
  findApisByModule(moduleName: string): ApiNode[];
  findModelsByModule(moduleName: string): ModelNode[];
  findToolsByModule(moduleName: string): ToolNode[];
  findToolsByPlugin(pluginName: string): ToolNode[];
  findAgents(): AgentNode[];
  findEvents(): EventNode[];
  findWorkflows(): WorkflowNode[];
  findCommands(): CommandNode[];
  findPermissions(): PermissionNode[];
  findDependencies(): DependencyNode[];
  findBuildTargets(): BuildTargetNode[];

  // 关系查询
  getDependencies(nodeId: string): GraphEdge[];      // 出边：依赖什么
  getDependents(nodeId: string): GraphEdge[];        // 入边：被什么依赖
  getRelated(nodeId: string, edgeType?: EdgeType): GraphNode[];
  getImpactAnalysis(nodeId: string): ImpactAnalysisResult;  // 修改此节点会影响什么

  // 序列化
  toJSON(): GraphSnapshot;
  fromJSON(snapshot: GraphSnapshot): void;

  // 变更
  commit(changeSet: ChangeSet): void;
  getHistory(limit?: number): ChangeSet[];
}
```

### 4.2 影响分析

```typescript
interface ImpactAnalysisResult {
  node: GraphNode;
  directDependents: GraphNode[];     // 直接依赖者
  indirectDependents: GraphNode[];   // 间接依赖者
  affectedApis: ApiNode[];
  affectedAgents: AgentNode[];
  affectedWorkflows: WorkflowNode[];
  affectedTests: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  breakingChanges: string[];
}
```

这是 AI Agent 修改代码前必须调用的操作——先分析影响范围，再决定是否修改、如何修改。

---

## 5. ChangeSet（变更集）

Application Graph 支持版本化的变更管理，每次变更都是一个 ChangeSet。

```typescript
interface ChangeSet {
  id: string;
  message: string;                  // 变更描述
  author: {
    type: 'human' | 'agent';
    id: string;
    name: string;
  };
  timestamp: number;
  changes: Array<{
    op: 'add' | 'remove' | 'update';
    entityType: 'node' | 'edge';
    entityId: string;
    before?: GraphNode | GraphEdge;
    after?: GraphNode | GraphEdge;
  }>;
  parentChangeSetId?: string;       // 父变更集（支持分支）
  metadata?: Record<string, unknown>;
}
```

ChangeSet 让 AI Agent 的每一次修改都可追溯、可回滚、可审查。

---

## 6. Graph Builder（图构建器）

Application Graph 不是手动维护的，而是通过 Graph Builder 自动从应用结构中构建。

```typescript
interface GraphBuilder {
  // 从 Application 构建完整 Graph
  build(application: Application): ApplicationGraph;

  // 增量更新
  addModule(graph: ApplicationGraph, module: TllModule): void;
  removeModule(graph: ApplicationGraph, moduleName: string): void;
  addPlugin(graph: ApplicationGraph, plugin: TllPlugin): void;
  removePlugin(graph: ApplicationGraph, pluginName: string): void;
  addApi(graph: ApplicationGraph, api: ApiDefinition): void;
  addTool(graph: ApplicationGraph, tool: Tool): void;
  addAgent(graph: ApplicationGraph, agent: Agent): void;
  addEvent(graph: ApplicationGraph, event: EventDefinition): void;

  // 验证
  validate(graph: ApplicationGraph): GraphValidationResult;
}

interface GraphValidationResult {
  valid: boolean;
  errors: Array<{ nodeId?: string; edgeId?: string; message: string }>;
  warnings: Array<{ nodeId?: string; message: string }>;
  orphanNodes: string[];            // 没有任何边的节点
  circularDependencies: string[][]; // 循环依赖
}
```

---

## 7. Agent 如何使用 Application Graph

### 7.1 典型查询流程

```
Agent 接收需求（"我要给用户模块增加一个重置密码功能"）
  ↓
1. graph.findModules() → 获取所有 Module
2. graph.getNode("module:user") → 查看 user 模块详情
3. graph.findApisByModule("user") → 查看现有 API
4. graph.findModelsByModule("user") → 查看数据模型
5. graph.findEvents() → 查看是否有相关事件
6. graph.getImpactAnalysis("module:user") → 分析修改影响
  ↓
Agent 理解了现有结构，开始设计变更
  ↓
7. 创建 ChangeSet（新增 API、Model、Event）
8. graph.commit(changeSet) → 应用变更
9. graph.validate() → 验证图完整性
  ↓
完成
```

### 7.2 Graph 查询是 Agent 的"眼睛"

没有 Application Graph，Agent 就是盲人——它只能通过阅读源代码来理解应用，这既慢又不可靠。

有了 Application Graph，Agent 可以：
- **毫秒级查询**应用结构
- **精确理解**模块间关系
- **安全修改**（先做影响分析）
- **自动验证**（图完整性检查）
- **可追溯**（ChangeSet 历史）

---

## 8. Graph 序列化与交换

Application Graph 可以序列化为 JSON，用于：
- Agent 之间交换应用结构
- 远程调试
- 架构文档生成
- 可视化工具

```typescript
interface GraphSnapshot {
  version: string;
  application: {
    name: string;
    version: string;
    tllVersion: string;
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
  generatedAt: number;
}
```

---

## 9. 与其他 Contract 的关系

Application Graph 不是孤立的，它整合了所有其他 Contract 的信息：

| Contract | Graph 中的体现 |
|----------|---------------|
| Application Model | Application Node + BuildTarget Node |
| Module Contract | Module Node + belongs_to/depends_on edges |
| Plugin Contract | Plugin Node + provides/extends/conflicts_with edges |
| Agent Contract | Agent Node + calls edges |
| Tool Contract | Tool Node + calls/provides edges |
| Skill Contract | Skill Node |
| AI Context Contract | Graph 是 Context 的核心数据源 |
| Permission Contract | Permission Node + requires edges |
| Workflow Contract | Workflow Node + triggers edges |
| Runtime Lifecycle | Node status + ChangeSet |
| Developer-Agent Protocol | Graph 查询 API + ChangeSet commit |

**Application Graph 是所有 Contract 的交汇点，是 AI 理解 TLL OS 应用的单一真相来源（Single Source of Truth）。**

---

## 10. 实现计划

| 阶段 | 内容 |
|------|------|
| Foundation 0.1 PoC | 最小 Graph 实现：节点/边/基本查询/从 Module 构建 |
| Foundation 0.2 | 完整 Graph Builder + 影响分析 + ChangeSet |
| Foundation 0.3 | Graph 验证 + 序列化 + Agent 查询优化 |
| Foundation 0.4 | 实时 Graph 更新（Module/Plugin 变更自动同步） |
| Beta | Graph 可视化工具 + 远程 Graph 查询 API |

---

## 11. 未实现与 TODO

第一阶段（PoC）实现：
- [x] Graph Node/Edge 接口定义
- [x] Application Graph 接口定义
- [x] 基本查询方法（findModules/findApisByModule 等）
- [x] 从 Module/Plugin/API/Tool/Agent 构建 Graph
- [ ] 影响分析（PoC 中最小实现）
- [ ] ChangeSet（PoC 中最小实现）
- [ ] Graph 验证
- [ ] 序列化
- [ ] 实时更新
