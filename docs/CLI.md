# TLL OS CLI 设计

> 文档：CLI.md
> 版本：0.1.0-blueprint
> 战略修正：CLI 是 TLL OS 的一等入口，与 HTTP API 对等。CLI 输出必须结构化（支持 `--json`），便于 AI Agent 解析。CLI 参数解析可复用成熟库，但 Command Contract 是 TLL OS 标准。

---

## 1. CLI 概述

`tll` 是 TLL OS 的命令行工具，是开发者和 AI Agent 操作 TLL OS 的标准入口之一。

### 1.1 设计原则

1. **一等入口**：CLI 与 HTTP API 对等，所有 TLL OS 操作都有对应的 CLI 命令
2. **结构化输出**：支持 `--json` 输出，便于 AI Agent 和脚本解析
3. **插件化命令**：Module 和 Plugin 可以注册自定义命令
4. **一致性**：命令命名、参数风格、输出格式全局一致
5. **可发现**：`tll help`、`tll list`、命令自动补全

### 1.2 命令命名规范

- 主命令：`tll <namespace>:<action>`，如 `tll module:list`
- 别名：常用命令提供短别名，如 `tll modules` = `tll module:list`
- 全局选项：`--help`、`--version`、`--json`、`--verbose`、`--quiet`、`--env`

---

## 2. Command Contract

### 2.1 Command 接口

```typescript
interface Command {
  readonly name: string;              // 命令名，如 "module:list"
  readonly description: string;       // 简短描述
  readonly aliases?: string[];        // 别名
  readonly category: CommandCategory; // 分类
  readonly hidden?: boolean;           // 是否在 help 中隐藏

  arguments: CommandArgument[];
  options: CommandOption[];

  execute(ctx: CommandContext): Promise<number>;  // 返回 exit code
}

type CommandCategory =
  | 'project'    // 项目管理
  | 'module'     // 模块管理
  | 'plugin'     // 插件管理
  | 'route'      // 路由管理
  | 'database'   // 数据库
  | 'test'       // 测试
  | 'cache'      // 缓存
  | 'ai'         // AI Agent
  | 'system'     // 系统
  | 'custom';    // Module/Plugin 自定义

interface CommandArgument {
  name: string;
  description: string;
  required: boolean;
  default?: unknown;
  validator?: (value: string) => boolean;
}

interface CommandOption {
  name: string;           // 长选项，如 "--verbose"
  short?: string;         // 短选项，如 "-v"
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  default?: unknown;
  required?: boolean;
  choices?: string[];     // 可选值限制
}

interface CommandContext {
  args: Record<string, string>;
  options: Record<string, unknown>;
  container: Container;
  config: Config;
  logger: Logger;
  output: CommandOutput;
  application: Application;
}

interface CommandOutput {
  info(message: string): void;
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  table(headers: string[], rows: string[][]): void;
  json(data: unknown): void;
  progress(total: number): ProgressBar;
  confirm(question: string): Promise<boolean>;
  ask(question: string, defaultValue?: string): Promise<string>;
  choice(question: string, choices: string[]): Promise<string>;
}
```

### 2.2 输出格式

#### Human 格式（默认）

```
$ tll module:list

Modules (3)
─────────────────────────────────────────────
  Name          Version  Status    Description
  core          1.0.0    enabled   TLL OS Core
  user          1.2.0    enabled   User Management
  hello-world   0.1.0    enabled   Hello World Example

✓ 3 modules found, 3 enabled
```

#### JSON 格式（`--json`）

```json
{
  "success": true,
  "data": {
    "modules": [
      { "name": "core", "version": "1.0.0", "status": "enabled", "description": "TLL OS Core" },
      { "name": "user", "version": "1.2.0", "status": "enabled", "description": "User Management" },
      { "name": "hello-world", "version": "0.1.0", "status": "enabled", "description": "Hello World Example" }
    ],
    "total": 3,
    "enabled": 3
  },
  "meta": {
    "command": "module:list",
    "timestamp": "2026-08-22T10:00:00Z"
  }
}
```

JSON 输出是 AI Agent 解析 CLI 结果的标准方式。

---

## 3. 内置命令

### 3.1 项目管理

| 命令 | 说明 | 第一阶段 |
|------|------|----------|
| `tll new <name>` | 创建新 TLL OS 项目 | ✓ |
| `tll serve` | 启动开发服务器 | ✓ |
| `tll build` | 构建生产版本 | 后续 |
| `tll start` | 启动生产服务器 | 后续 |
| `tll doctor` | 环境诊断（Node 版本、依赖、配置） | 后续 |
| `tll env` | 查看/设置环境变量 | 后续 |

#### `tll new <name>`

创建新项目骨架：

```
$ tll new my-app
? 项目描述: My TLL OS Application
? 作者: Your Name
? 许可证: MIT
? 包管理器: npm
? 是否启用 TypeScript 严格模式: Yes

Creating TLL OS project "my-app"...
✓ Created directory structure
✓ Generated package.json
✓ Generated tsconfig.json
✓ Generated tll.config.ts
✓ Generated .env.example
✓ Generated README.md
✓ Installed dependencies

Project created successfully!

Next steps:
  cd my-app
  tll serve
```

选项：
- `--template <name>`：使用模板（默认 `default`，后续支持 `api-only`、`saas` 等）
- `--no-git`：不初始化 Git
- `--no-install`：不安装依赖
- `--force`：覆盖已有目录

### 3.2 Module 管理

| 命令 | 说明 | 第一阶段 |
|------|------|----------|
| `tll module:list` | 列出所有 Module | ✓ |
| `tll module:info <name>` | 查看 Module 详情 | ✓ |
| `tll module:make <name>` | 创建 Module 骨架 | ✓ |
| `tll module:routes <name>` | 查看 Module 路由 | ✓ |
| `tll module:commands <name>` | 查看 Module 命令 | 后续 |
| `tll module:events <name>` | 查看 Module 事件 | 后续 |
| `tll module:services <name>` | 查看 Module 服务 | 后续 |
| `tll module:test <name>` | 运行 Module 测试 | ✓ |
| `tll module:enable <name>` | 启用 Module | 后续 |
| `tll module:disable <name>` | 禁用 Module | 后续 |

#### `tll module:make <name>`

```
$ tll module:make blog
? 模块描述: Blog Module
? 命名空间: Blog
? 是否创建路由: Yes
? 是否创建控制器: Yes
? 是否创建服务: Yes
? 是否创建数据库迁移: No
? 是否创建测试: Yes

Creating module "blog"...
✓ Created modules/blog/
✓ Generated tll.module.json
✓ Generated index.ts
✓ Generated routes/index.ts
✓ Generated controllers/BlogController.ts
✓ Generated services/BlogService.ts
✓ Generated tests/unit/blog.test.ts

Module "blog" created successfully.
It will be auto-registered on next startup.
```

### 3.3 Plugin 管理

| 命令 | 说明 | 第一阶段 |
|------|------|----------|
| `tll plugin:list` | 列出所有 Plugin | ✓ |
| `tll plugin:info <name>` | 查看 Plugin 详情（含 ai_metadata） | ✓ |
| `tll plugin:search <query>` | 搜索可安装 Plugin | 后续 |
| `tll plugin:install <name> [version]` | 安装 Plugin | ✓ |
| `tll plugin:enable <name>` | 启用 Plugin | ✓ |
| `tll plugin:disable <name>` | 禁用 Plugin | ✓ |
| `tll plugin:upgrade <name> [version]` | 升级 Plugin | 后续 |
| `tll plugin:uninstall <name>` | 卸载 Plugin | ✓ |
| `tll plugin:make <name>` | 创建 Plugin 骨架 | ✓ |
| `tll plugin:permissions <name>` | 查看 Plugin 权限 | 后续 |
| `tll plugin:test <name>` | 运行 Plugin 测试 | 后续 |
| `tll plugin:ai:describe <name>` | AI 格式描述 Plugin 能力 | 后续 |

### 3.4 路由管理

| 命令 | 说明 | 第一阶段 |
|------|------|----------|
| `tll route:list` | 列出所有路由 | ✓ |
| `tll route:match <method> <path>` | 匹配路由 | 后续 |
| `tll route:cache` | 缓存路由表 | 后续 |
| `tll route:clear` | 清除路由缓存 | 后续 |

#### `tll route:list` 输出

```
Routes (12)
──────────────────────────────────────────────────────────────────
  Method  Path                          Module         Name
  GET     /api/v1/hello-world           hello-world    hello.index
  GET     /api/v1/hello-world/:id       hello-world    hello.show
  POST    /api/v1/hello-world           hello-world    hello.store
  GET     /api/v1/users                  user           user.index
  ...
```

### 3.5 数据库

| 命令 | 说明 | 第一阶段 |
|------|------|----------|
| `tll migrate` | 执行迁移 | 后续 |
| `tll migrate:rollback` | 回滚迁移 | 后续 |
| `tll migrate:reset` | 重置数据库 | 后续 |
| `tll migrate:refresh` | 重置并重新迁移 | 后续 |
| `tll migrate:status` | 查看迁移状态 | 后续 |
| `tll make:migration <name>` | 创建迁移文件 | 后续 |
| `tll db:seed` | 填充种子数据 | 后续 |
| `tll db:wipe` | 清空数据库 | 后续 |

### 3.6 测试

| 命令 | 说明 | 第一阶段 |
|------|------|----------|
| `tll test` | 运行全部测试 | ✓ |
| `tll test:unit` | 运行单元测试 | ✓ |
| `tll test:integration` | 运行集成测试 | ✓ |
| `tll test:module <name>` | 运行指定 Module 测试 | ✓ |
| `tll test:plugin <name>` | 运行指定 Plugin 测试 | 后续 |
| `tll test:coverage` | 运行测试并生成覆盖率报告 | 后续 |
| `tll test:watch` | 监听模式运行测试 | 后续 |

#### `tll test` 输出

```
$ tll test

Running tests...
✓ tests/unit/container.test.ts (12 tests)
✓ tests/unit/router.test.ts (8 tests)
✓ tests/unit/event.test.ts (6 tests)
✓ tests/integration/kernel.test.ts (5 tests)
✓ modules/hello-world/tests/unit/hello.test.ts (3 tests)

Tests: 34 passed, 0 failed
Time: 1.234s
Coverage: 87.3%
```

### 3.7 缓存

| 命令 | 说明 | 第一阶段 |
|------|------|----------|
| `tll cache:clear` | 清除缓存 | 后续 |
| `tll cache:forget <key>` | 删除指定缓存键 | 后续 |
| `tll cache:table` | 生成缓存数据库表 | 后续 |

### 3.8 AI Agent

| 命令 | 说明 | 第一阶段 |
|------|------|----------|
| `tll ai:agent <name>` | 启动交互式 Agent | 后续（接口定义） |
| `tll ai:run "<prompt>"` | 单次运行 Agent | 后续（接口定义） |
| `tll ai:tools` | 列出可用 Tool | 后续（接口定义） |
| `tll ai:skills` | 列出可用 Skill | 后续（接口定义） |
| `tll ai:tasks` | 列出 Agent 任务 | 后续（接口定义） |
| `tll ai:config` | 配置 AI Provider | 后续（接口定义） |

### 3.9 系统

| 命令 | 说明 | 第一阶段 |
|------|------|----------|
| `tll --version` | 显示版本 | ✓ |
| `tll --help` | 显示帮助 | ✓ |
| `tll help [command]` | 显示命令帮助 | ✓ |
| `tll list` | 列出所有命令 | ✓ |
| `tll config:show` | 显示当前配置 | 后续 |
| `tll config:cache` | 缓存配置 | 后续 |
| `tll config:clear` | 清除配置缓存 | 后续 |
| `tll down` | 进入维护模式 | 后续 |
| `tll up` | 退出维护模式 | 后续 |

---

## 4. CLI Runtime

### 4.1 启动流程

```
1. tll <command> [args] [options]
   ↓
2. 解析全局选项（--env, --json, --verbose）
   ↓
3. 加载 .env 和配置
   ↓
4. 创建 Application（register 阶段）
   ↓
5. 发现并注册 Module → 注册 Module 命令
   ↓
6. 发现并注册已启用 Plugin → 注册 Plugin 命令
   ↓
7. boot 阶段
   ↓
8. CLI Runtime 解析命令 → 匹配 Command
   ↓
9. 验证参数和选项
   ↓
10. 执行 Command
    ↓
11. 输出结果
    ↓
12. 进程退出（exit code = Command 返回值）
```

### 4.2 命令注册

- **内置命令**：CLI Kernel 启动时注册
- **Module 命令**：Module 在 `boot()` 中通过 `cli.register()` 注册
- **Plugin 命令**：Plugin 在 `boot()` 中通过 `cli.register()` 注册，命令名自动添加 Plugin 前缀

### 4.3 自动补全

支持 Shell 自动补全（bash/zsh/fish）：

```
$ tll completion bash > /etc/bash_completion.d/tll
$ tll module:<TAB>
module:list     module:info     module:make     module:routes
module:test     module:enable   module:disable
```

---

## 5. AI Agent 与 CLI

### 5.1 Agent 如何使用 CLI

1. Agent 通过 `command_execute` Tool 执行 CLI 命令
2. 始终使用 `--json` 选项获取结构化输出
3. 解析 JSON 结果，决定下一步操作
4. 敏感操作（install/uninstall/fix）需要审批

### 5.2 CLI 命令的 AI 友好性

- 所有命令支持 `--json` 输出
- 错误信息结构化（包含错误码、消息、详情）
- 命令描述清晰，Agent 可通过 `tll list --json` 发现所有命令
- 长操作支持进度输出（JSON 格式的进度事件）

---

## 6. 未实现与 TODO

第一阶段实现：
- [x] CLI 架构设计
- [x] Command Contract
- [x] 输出格式规范
- [ ] 内置命令实现（第二阶段）

第二阶段实现优先级：
1. CLI Runtime（命令解析、匹配、执行）
2. 输出格式化（human + json）
3. `tll --version` / `tll --help` / `tll list`
4. `tll new`（项目创建）
5. `tll serve`（开发服务器）
6. `tll module:list` / `module:info` / `module:make` / `module:routes`
7. `tll plugin:list` / `plugin:info` / `plugin:install` / `plugin:enable` / `plugin:disable`
8. `tll route:list`
9. `tll test`
10. Module/Plugin 自定义命令注册
11. 自动补全
12. 交互式输入（confirm/ask/choice）
