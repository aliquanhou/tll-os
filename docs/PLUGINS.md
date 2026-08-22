# TLL OS Plugin System 设计

> 文档：PLUGINS.md
> 版本：0.1.0-blueprint
> 战略修正：Plugin 系统是 TLL OS 超越传统框架的核心差异化能力。Plugin Contract 是 TLL OS 必须自研的 11 项核心标准之一。

---

## 1. Plugin 概述

Plugin 是 TLL OS 的**第三方可安装单元**，运行时可安装、启用、禁用、升级、卸载。Plugin 是 TLL OS 生态系统的基础。

### 1.1 Plugin vs Module（战略修正后的精确定义）

| 维度 | Module | Plugin |
|------|--------|--------|
| **本质** | 应用内功能单元 | 生态可分发扩展单元 |
| **Contract** | Module Contract（TLL OS 标准） | Plugin Contract（TLL OS 标准，更严格） |
| **来源** | 第一方/应用开发者 | 第三方/生态开发者 |
| **分发** | 随应用代码 | 独立 npm 包 + TLL Plugin Registry |
| **安装** | 放入 `modules/` 目录 | `tll plugin:install <name>` |
| **生命周期** | 随应用启动/停止 | install → enable → [running] → disable → uninstall |
| **运行时管理** | 不可（需改代码重启） | 可（CLI/API 动态管理） |
| **沙箱** | 无 | 有（权限声明 + 依赖隔离 + 资源限制） |
| **依赖** | 应用级 package.json | Plugin 独立 package.json + 依赖锁定 |
| **升级** | 随应用版本控制 | `tll plugin:upgrade` 独立升级 |
| **AI 可发现性** | Agent 通过 Module Registry 发现 | Agent 通过 Plugin Registry + Manifest 发现，可查询可安装插件 |
| **AI 可生成性** | Agent 可生成 Module 骨架 | Agent 可生成完整 Plugin（含 Manifest、权限声明、测试） |
| **典型用途** | 业务功能（用户、内容、订单） | 支付网关、短信服务、存储驱动、主题、AI 技能包 |

### 1.2 设计原则

1. **Plugin Contract 是 TLL OS 核心标准**：所有 Plugin 必须实现标准接口，Agent 通过标准接口理解和操作 Plugin
2. **显式权限**：Plugin 必须在 Manifest 中声明所需权限，运行时按权限限制操作
3. **依赖隔离**：Plugin 有独立的依赖空间，不污染应用全局依赖
4. **可热插拔**：Plugin 可在运行时启用/禁用（第一阶段为进程级，后续阶段支持热加载）
5. **AI 可理解**：Plugin Manifest 包含结构化元数据，AI Agent 可解析并理解 Plugin 的能力、依赖、权限
6. **安全第一**：Plugin 是第三方代码，必须有沙箱边界和审计机制

---

## 2. Plugin 目录结构

```
plugins/
└── payment-stripe/
    ├── tll.plugin.json        # Plugin Manifest（必需）
    ├── index.ts               # Plugin 入口（必需）
    ├── package.json           # Plugin 独立依赖
    ├── routes/
    │   └── index.ts
    ├── controllers/
    ├── services/
    ├── events/
    ├── listeners/
    ├── commands/
    ├── config/
    │   └── index.ts
    ├── migrations/
    ├── tests/
    │   ├── unit/
    │   └── integration/
    ├── resources/
    └── README.md              # Plugin 文档（Agent 可读取理解）
```

---

## 3. Plugin Manifest（Plugin Contract 的核心）

`tll.plugin.json` 是 Plugin 的元数据声明，是 Plugin Contract 的载体。

```json
{
  "name": "payment-stripe",
  "version": "1.2.0",
  "description": "Stripe 支付网关插件，支持信用卡、Apple Pay、Google Pay",
  "author": "TLL OS Ecosystem",
  "license": "MIT",
  "homepage": "https://plugins.tll.os/payment-stripe",
  "repository": "https://github.com/tll-os/plugin-payment-stripe",
  "entry": "index.ts",
  "namespace": "PaymentStripe",
  "type": "payment-gateway",
  "tags": ["payment", "stripe", "credit-card", "apple-pay"],

  "dependencies": {
    "tll": ">=0.1.0 <1.0.0",
    "modules": ["order"],
    "plugins": [],
    "npm": {
      "stripe": "^14.0.0"
    }
  },

  "permissions": {
    "network": ["api.stripe.com"],
    "storage": {
      "read": ["plugins/payment-stripe/data"],
      "write": ["plugins/payment-stripe/data"]
    },
    "database": {
      "tables": ["payments", "refunds"],
      "operations": ["read", "write", "create_table"]
    },
    "events": {
      "publish": ["payment-stripe.*"],
      "subscribe": ["order.created", "order.refunded"]
    },
    "routes": {
      "prefix": "/api/payment-stripe"
    },
    "commands": ["payment-stripe:*"],
    "config": {
      "read": ["plugins.payment-stripe"],
      "write": ["plugins.payment-stripe.api_key"]
    },
    "ai_tools": ["payment_stripe_create_charge", "payment_stripe_refund"]
  },

  "provides": {
    "routes": true,
    "commands": true,
    "events": true,
    "services": ["PaymentGateway"],
    "ai_tools": true,
    "webhooks": true
  },

  "ai_metadata": {
    "summary": "提供 Stripe 支付处理能力，包括创建支付、退款、Webhook 处理",
    "capabilities": [
      "create_charge",
      "refund_payment",
      "handle_webhook",
      "list_payment_methods"
    ],
    "configuration_required": ["api_key", "webhook_secret"],
    "compatible_modules": ["order", "cart", "checkout"]
  },

  "lifecycle": {
    "install": "scripts/install.ts",
    "enable": "scripts/enable.ts",
    "disable": "scripts/disable.ts",
    "upgrade": "scripts/upgrade.ts",
    "uninstall": "scripts/uninstall.ts"
  },

  "config_schema": {
    "api_key": { "type": "string", "required": true, "secret": true },
    "webhook_secret": { "type": "string", "required": true, "secret": true },
    "currency": { "type": "string", "default": "USD" },
    "test_mode": { "type": "boolean", "default": true }
  }
}
```

### 3.1 Manifest 核心字段

| 字段 | 说明 | AI 可理解性 |
|------|------|-------------|
| `name` | Plugin 唯一标识 | Agent 通过名称查询和操作 |
| `version` | 语义化版本 | Agent 可检查兼容性、触发升级 |
| `type` | Plugin 类型（payment-gateway/storage/auth/theme/ai-skill/...） | Agent 可按类型发现和推荐 |
| `tags` | 标签 | Agent 可按标签搜索 |
| `dependencies` | 依赖声明（TLL 版本、Module、Plugin、npm） | Agent 可检查依赖满足情况 |
| `permissions` | 权限声明（网络/存储/数据库/事件/路由/命令/配置/AI Tool） | Agent 可评估安全风险、执行权限检查 |
| `provides` | 能力声明 | Agent 可知道 Plugin 提供了什么 |
| `ai_metadata` | AI 专用元数据（摘要、能力列表、配置要求、兼容模块） | Agent 直接读取理解 Plugin 能力 |
| `lifecycle` | 生命周期脚本 | Agent 可在安装/升级时执行 |
| `config_schema` | 配置 Schema（JSON Schema 子集） | Agent 可验证配置、生成配置表单 |

### 3.2 ai_metadata：AI 理解 Plugin 的关键

`ai_metadata` 是 TLL OS Plugin Contract 区别于传统框架插件系统的核心字段。它让 AI Agent 能够：

1. **理解 Plugin 能做什么**：`summary` + `capabilities`
2. **知道需要什么配置**：`configuration_required`
3. **判断兼容性**：`compatible_modules` + `dependencies`
4. **生成调用代码**：基于 `provides.ai_tools` 和能力描述
5. **安全评估**：结合 `permissions` 评估 Plugin 的安全边界

---

## 4. Plugin 生命周期

### 4.1 状态机

```
                ┌──────────┐
                │ not_installed │
                └─────┬────┘
                      │ install()
                      ▼
                ┌──────────┐
                │ installed │
                └─────┬────┘
                      │ enable()
                      ▼
                ┌──────────┐
    disable() ──│  enabled  │── disable()
                └─────┬────┘
                      │
                      ▼
                ┌──────────┐
                │ disabled │
                └─────┬────┘
                      │ uninstall()
                      ▼
                ┌──────────┐
                │  removed  │
                └──────────┘

升级路径：enabled → disable → upgrade → enable
```

### 4.2 生命周期阶段

| 阶段 | 触发 | 执行内容 | 可失败 |
|------|------|----------|--------|
| `install` | `tll plugin:install` | 下载包、解压、安装 npm 依赖、执行 install 脚本、运行迁移、注册到 Plugin Registry | 是（依赖冲突、权限不足） |
| `enable` | `tll plugin:enable` | 验证依赖满足、验证权限、执行 enable 脚本、注册路由/事件/命令/服务到 Kernel | 是（依赖缺失、权限冲突） |
| `running` | 应用运行中 | 正常提供服务 | - |
| `disable` | `tll plugin:disable` | 执行 disable 脚本、注销路由/事件/命令/服务、清理请求级资源 | 否（强制禁用） |
| `upgrade` | `tll plugin:upgrade` | 下载新版本、备份、执行 upgrade 脚本、运行迁移、验证 | 是（升级失败回滚） |
| `uninstall` | `tll plugin:uninstall` | 执行 uninstall 脚本、清理数据（可选）、移除文件、从 Registry 注销 | 是（数据清理失败） |

### 4.3 Plugin 接口

```typescript
interface TllPlugin {
  readonly manifest: PluginManifest;

  // 生命周期
  install?(ctx: PluginLifecycleContext): Promise<void>;
  enable?(ctx: PluginLifecycleContext): Promise<void>;
  disable?(ctx: PluginLifecycleContext): Promise<void>;
  upgrade?(ctx: PluginLifecycleContext, fromVersion: string): Promise<void>;
  uninstall?(ctx: PluginLifecycleContext): Promise<void>;

  // 注册（同 Module）
  register?(container: Container, config: Config): void | Promise<void>;
  boot?(container: Container, router: Router, cli: CliKernel, scheduler: Scheduler): void | Promise<void>;
  shutdown?(container: Container): void | Promise<void>;
}
```

---

## 5. Plugin 权限系统

### 5.1 权限模型

Plugin 权限采用**最小权限原则**：Plugin 默认无任何权限，必须在 Manifest 中显式声明。

### 5.2 权限类别

| 权限类别 | 控制内容 | 示例 |
|----------|----------|------|
| `network` | 可访问的网络域名 | `["api.stripe.com"]` |
| `storage` | 可读写的文件路径 | `{ read: [...], write: [...] }` |
| `database` | 可操作的数据库表和操作 | `{ tables: ["payments"], operations: ["read","write"] }` |
| `events` | 可发布/订阅的事件 | `{ publish: ["payment.*"], subscribe: ["order.created"] }` |
| `routes` | 可注册的路由前缀 | `{ prefix: "/api/payment-stripe" }` |
| `commands` | 可注册的命令前缀 | `["payment-stripe:*"]` |
| `config` | 可读写的配置键 | `{ read: ["plugins.payment-stripe"], write: [...] }` |
| `ai_tools` | 可注册的 AI Tool 名称 | `["payment_stripe_create_charge"]` |
| `env` | 可读取的环境变量 | `["STRIPE_*"]` |
| `process` | 可执行的系统操作 | `["spawn:node"]`（极敏感，默认禁止） |

### 5.3 权限执行

权限在 Plugin 注册时验证，在运行时强制执行：

1. **注册时**：Plugin Registry 验证 Manifest 中的权限声明是否在允许范围内
2. **运行时**：Plugin 的 Container 是受限容器，所有 Kernel 操作经过 Permission Guard
3. **AI 操作时**：Agent 调用 Plugin 的 Tool 时，Permission Guard 检查 Agent 权限 + Plugin 权限

### 5.4 权限升级

Plugin 需要超出声明范围的权限时，必须：
1. 在新版本 Manifest 中声明新权限
2. 升级时提示用户/管理员审批
3. 未获批准的权限不会被授予

---

## 6. Plugin 管理器

### 6.1 Plugin Manager 接口

```typescript
interface PluginManager {
  // 发现与查询
  discover(directory: string): Promise<DiscoveredPlugin[]>;
  list(): PluginInfo[];
  listEnabled(): PluginInfo[];
  listDisabled(): PluginInfo[];
  get(name: string): PluginInfo | null;
  has(name: string): boolean;
  search(query: string): Promise<PluginInfo[]>;  // 从 Registry 搜索

  // 生命周期
  install(name: string, version?: string): Promise<PluginInfo>;
  enable(name: string): Promise<void>;
  disable(name: string): Promise<void>;
  upgrade(name: string, version?: string): Promise<PluginInfo>;
  uninstall(name: string, removeData?: boolean): Promise<void>;

  // 依赖与权限
  checkDependencies(name: string): DependencyCheckResult;
  checkPermissions(name: string): PermissionCheckResult;
  resolveConflict(pluginA: string, pluginB: string): ConflictResolution;

  // AI 接口
  getAiMetadata(name: string): PluginAiMetadata;
  getCompatiblePlugins(moduleName: string): Promise<PluginInfo[]>;
  recommendPlugins(capability: string): Promise<PluginInfo[]>;
}
```

### 6.2 Plugin Registry

Plugin Registry 是 Plugin 的分发中心，类似 npm registry 但专门针对 TLL OS Plugin。

第一阶段：本地文件系统 Registry（`plugins/` 目录）。
后续阶段：远程 Registry（支持搜索、安装、版本管理）。

---

## 7. AI Agent 与 Plugin

### 7.1 Agent 如何发现 Plugin

```
Agent 查询 Plugin Manager
  → list() / listEnabled() / search(query)
  → 获取 PluginInfo 列表
  → 读取每个 Plugin 的 ai_metadata
  → 理解 Plugin 的能力、依赖、权限
  → 决定是否使用/安装/启用
```

### 7.2 Agent 如何使用 Plugin

1. Agent 通过 Plugin Manager 查询可用 Plugin
2. 读取 Plugin 的 `ai_metadata.capabilities` 和 `provides.ai_tools`
3. 通过 AI Tool Registry 获取 Plugin 注册的 Tool
4. 调用 Tool 执行操作（经过 Permission Guard）
5. 接收 Tool 执行结果

### 7.3 Agent 如何创建 Plugin

```
Agent 接收需求（"我需要一个支付宝支付插件"）
  → 分析需求，确定 Plugin 类型、能力、依赖
  → 查询 Plugin Registry 是否已有同类 Plugin
  → 如无，生成 Plugin 骨架：
      - tll.plugin.json（含 ai_metadata、permissions、config_schema）
      - index.ts（实现 TllPlugin 接口）
      - routes/ controllers/ services/ tests/
  → 生成测试用例
  → 运行测试
  → 发现 Bug → 修复
  → 安装并启用 Plugin
  → 验证功能
```

### 7.4 Agent 如何修改 Plugin

1. Agent 读取 Plugin Manifest 和源代码
2. 理解当前实现
3. 生成修改方案
4. 修改代码
5. 更新 Manifest（如新增权限/能力）
6. 运行测试
7. 如测试通过，执行升级流程

---

## 8. Plugin 管理 CLI

| 命令 | 说明 |
|------|------|
| `tll plugin:list` | 列出所有 Plugin 及其状态 |
| `tll plugin:info <name>` | 查看 Plugin 详细信息（含 ai_metadata） |
| `tll plugin:search <query>` | 搜索可安装的 Plugin |
| `tll plugin:install <name> [version]` | 安装 Plugin |
| `tll plugin:enable <name>` | 启用 Plugin |
| `tll plugin:disable <name>` | 禁用 Plugin |
| `tll plugin:upgrade <name> [version]` | 升级 Plugin |
| `tll plugin:uninstall <name> [--remove-data]` | 卸载 Plugin |
| `tll plugin:make <name>` | 创建 Plugin 骨架 |
| `tll plugin:permissions <name>` | 查看 Plugin 权限声明 |
| `tll plugin:test <name>` | 运行 Plugin 的测试 |
| `tll plugin:ai:describe <name>` | AI 格式输出 Plugin 能力描述 |

---

## 9. Plugin 安全

### 9.1 安全边界

1. **代码隔离**：Plugin 运行在独立的 Module 作用域中（第一阶段），后续阶段支持 VM 沙箱
2. **权限限制**：所有 Kernel 操作经过 Permission Guard
3. **依赖锁定**：Plugin 的 npm 依赖安装在 Plugin 独立目录，不污染全局
4. **审计日志**：Plugin 的所有敏感操作（数据库写入、网络请求、配置修改）记录审计日志
5. **签名验证**：后续阶段支持 Plugin 包签名验证

### 9.2 Plugin 审核

远程 Registry 中的 Plugin 需经过审核：
1. 自动化安全扫描（权限检查、依赖漏洞、恶意代码检测）
2. 人工审核（高权限 Plugin）
3. 社区评分和举报机制

---

## 10. 未实现与 TODO

第一阶段（蓝图阶段）Plugin 系统为**设计文档 + 接口定义**。

第二阶段实现优先级：
1. Plugin Manifest 加载与验证
2. Plugin Manager（发现、列表、查询）
3. Plugin 生命周期（install/enable/disable/uninstall 的最小实现）
4. Plugin 权限系统（声明 + 验证）
5. Plugin 路由/事件/命令/服务注册
6. Plugin ai_metadata 解析
7. Plugin 管理 CLI
8. Plugin 依赖检查
9. Plugin 升级（含回滚）
10. Plugin 沙箱（VM 上下文，后续阶段）
11. 远程 Plugin Registry（后续阶段）
