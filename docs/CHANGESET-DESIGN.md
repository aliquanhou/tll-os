# TLL OS ChangeSet Design

> P0-2: ChangeSet 机制设计文档
> 核心目标：Agent 不应该直接无痕修改主 Application，所有修改必须可追踪、可预览、可验证、可回滚。

## 一、设计原则

1. **不可变主分支**：Main Application 不允许直接修改，所有变更通过 ChangeSet 提交
2. **完整追踪**：每次修改产生 Added/Modified/Removed/Dependencies/Tests/Risk 记录
3. **预览优先**：应用 ChangeSet 前必须可预览影响范围
4. **可验证**：ChangeSet 可验证一致性和冲突
5. **可回滚**：应用后可回滚到应用前状态

## 二、核心数据结构

### ChangeEntry

```typescript
interface ChangeEntry {
  id: string;
  operation: 'add' | 'modify' | 'remove';
  entityType: 'module' | 'api' | 'tool' | 'agent' | 'test' | 'model' | 'event' | 'config' | 'plugin' | 'workflow' | 'permission' | string;
  entityId: string;
  entityName?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}
```

### RuntimeChangeSet

```typescript
interface RuntimeChangeSet {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly agentName?: string;
  readonly workspaceId?: string;
  status: 'draft' | 'pending' | 'applied' | 'rolled_back' | 'conflict';
  entries: ChangeEntry[];
  dependencies: string[];
  affectedNodeIds: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
```

### ChangeSetPreview

```typescript
interface ChangeSetPreview {
  totalChanges: number;
  byOperation: { add: number; modify: number; remove: number };
  byEntityType: Record<string, number>;
  affectedModules: string[];
  affectedApis: string[];
  affectedTools: string[];
  affectedTests: string[];
  conflicts: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
```

## 三、核心操作

### 1. createChangeSet(name, options)

创建一个新的 ChangeSet，状态为 `draft`。

```typescript
const cs = app.changeSets.create("add-user-module", {
  description: "Add user management module",
  agentName: "agent-a",
  workspaceId: "ws-xxx",
});
```

### 2. addEntry(entry)

向 ChangeSet 添加一个变更条目。

```typescript
cs.addEntry({
  operation: "add",
  entityType: "module",
  entityId: "module:user",
  entityName: "user",
  data: { name: "user", description: "User management" },
});
```

### 3. preview()

预览 ChangeSet 的影响范围，不应用任何变更。

```typescript
const preview = cs.preview();
// {
//   totalChanges: 5,
//   byOperation: { add: 3, modify: 1, remove: 1 },
//   byEntityType: { module: 1, api: 3, test: 1 },
//   affectedModules: ["user"],
//   affectedApis: ["user.list", "user.get", "user.create"],
//   affectedTests: ["user.test"],
//   conflicts: [],
//   riskLevel: "medium",
// }
```

### 4. validate()

验证 ChangeSet 的一致性：
- 检查是否有重复的 entityId
- 检查 remove 操作的实体是否存在
- 检查 modify 操作的实体是否存在
- 检查依赖是否满足
- 检查是否有冲突

### 5. apply()

应用 ChangeSet 到主 Application：
1. 验证 ChangeSet
2. 快照当前 Graph（用于回滚）
3. 按顺序应用所有 entries
4. 更新 Graph 节点和边
5. 状态改为 `applied`

### 6. rollback()

回滚 ChangeSet：
1. 恢复到应用前的 Graph 快照
2. 状态改为 `rolled_back`

## 四、与 Application Graph 的集成

ChangeSet 与 Application Graph 深度集成：

1. **addEntry 时自动追踪**：添加 entry 时，entityId 自动加入 affectedNodeIds
2. **preview 时查询 Graph**：预览时通过 Graph 查询受影响的 API/Tool/Test/Agent
3. **apply 时更新 Graph**：应用时自动添加/修改/删除 Graph 节点和边
4. **rollback 时恢复 Graph**：回滚时从快照恢复 Graph

## 五、与 Multi-Agent 协作的集成

1. **Workspace 隔离**：每个 Workspace 有独立的 ChangeSet 管理器
2. **Agent 归属**：ChangeSet 记录 agentName，追踪是谁做的修改
3. **Review 流程**：ChangeSet 提交后通过 Review/Merge 流程审核
4. **冲突检测**：多个 Agent 的 ChangeSet 可能修改同一资源，validate 时检测冲突

## 六、风险等级评估

ChangeSet 自动评估风险等级：

| 等级 | 条件 |
|------|------|
| low | 仅新增，不修改/删除现有资源 |
| medium | 修改现有资源，但不影响其他 Module |
| high | 修改核心 Module 或删除资源，影响多个依赖 |
| critical | 修改 Application 核心配置或 Protocol 相关资源 |

## 七、测试覆盖

Foundation P0 测试覆盖：
- ✅ ChangeSet 创建（status=draft）
- ✅ 添加 ChangeEntry
- ✅ preview（byOperation 统计）
- ✅ ChangeSetManager 列表管理

下一阶段（V1.1）需要增加：
- ⏳ validate（一致性检查）
- ⏳ apply（应用到主 Application）
- ⏳ rollback（回滚）
- ⏳ 冲突检测
- ⏳ 与 Graph Impact Analysis 联动
