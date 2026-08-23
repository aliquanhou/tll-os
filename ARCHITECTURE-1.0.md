# TLL OS 1.0 — 总体架构蓝图

> 状态：DRAFT v0.1
> 日期：2026-08-23
> 定位：TLL OS 从 TypeScript Reference Runtime 演进为自主语言 + 自主 IR + 自主 Runtime 的通用应用开发操作系统。

---

## 一、产品最终定位

TLL OS 不是 PHP 框架、不是 JavaScript 框架、不是 Node.js 框架、不是 AI Agent 框架、不是 CMS/ERP/Commerce Framework、不是代码生成器、不是 PHP→JS 转换器。

**TLL OS = 面向人类开发者与 AI Agent 的自主应用操作系统。**

核心目标：

```
                    TLL OS
                       │
        ┌──────────────┼──────────────┐
        │              │              │
      开发            运行            部署
        │              │              │
        ▼              ▼              ▼
 TLL Language     TLL Runtime      TLL Deploy
        │              │              │
        └──────────────┼──────────────┘
                       │
                    TLL-IR
                       │
              Universal App Model
```

用户最终不需要知道 PHP/JavaScript/TypeScript/Node.js/Express/Laravel/Django——这些全部属于外部生态。

---

## 二、七层架构

```
                    TLL OS
                       │
┌──────────────────────▼──────────────────────┐
│ 7. Ecosystem                                │
│ Marketplace / Templates / Plugins / Agents  │
├─────────────────────────────────────────────┤
│ 6. Studio                                   │
│ IDE / Visual Builder / AI Developer         │
├─────────────────────────────────────────────┤
│ 5. Deployment                               │
│ Build / Package / Deploy / Cloud            │
├─────────────────────────────────────────────┤
│ 4. Runtime                                  │
│ HTTP / Data / Workflow / Agent / Security   │
├─────────────────────────────────────────────┤
│ 3. TLL-IR                                   │
│ Universal Application Model                 │
├─────────────────────────────────────────────┤
│ 2. TLL Language                             │
│ Application Programming Language            │
├─────────────────────────────────────────────┤
│ 1. Kernel / Protocol                        │
│ Graph / Contract / Event / Capability       │
└─────────────────────────────────────────────┘
```

### 第 1 层：Kernel / Protocol（已完成 Foundation 0.2）

- Application Graph
- 17 Contracts
- Module / Plugin / Agent / Tool / Event / Permission
- ChangeSet / Workspace / Lock / Review
- Persistence / Security / HTTP / CLI / Testing

### 第 2 层：TLL Language（Runtime 0.3 开始）

Application-Native Language，为开发完整应用而设计。

一等公民：application, module, entity, field, api, action, event, workflow, view, component, agent, tool, permission, policy, integration, storage, test, deployment。

### 第 3 层：TLL-IR（Runtime 0.3 开始）

Universal Application Model——通用应用中间表示。

TLL 源码 → Compiler → TLL-IR → Runtime。

TLL-IR 可以输出到：Native Runtime / WASM Runtime / Server Runtime / Edge Runtime / External Adapter。

### 第 4 层：TLL Runtime（Runtime 0.6 开始 Rust 实现）

服务器真正运行的东西。包含：Application Engine / HTTP Engine / Data Engine / Event Engine / Workflow Engine / Agent Engine / Security Engine / Plugin Engine / Scheduler / Deployment Engine。

最终使用 Rust 实现（系统软件级：高并发、低内存、单文件部署、安全）。

### 第 5 层：Deployment

tll build → my-app.tllapp → tll deploy → 服务器运行。

### 第 6 层：Studio

TLL Studio / IDE——人类开发者 + AI Agent 的开发入口。

### 第 7 层：Ecosystem

TLL Marketplace——Modules / Plugins / Adapters / UI / Themes / Agents / Workflows / Templates / Applications。

---

## 三、现有资产定位

| 资产 | 定位 | 状态 |
|------|------|------|
| TypeScript Runtime 0.2 | 第一代参考 Runtime / Bootstrap Runtime | ✅ 稳定 |
| Protocol 2.0 | 第 1 层 Kernel/Protocol 的宪法 | ✅ 冻结 |
| Application Graph | TLL-IR 的雏形 | ✅ 可用 |
| Commerce v0.2 | 第一个 Reference Application（基于 TS Runtime） | ✅ 可用 |
| Developer Hub | 官网 + Agent JSON 入口 | ✅ 可用 |

**现有 TypeScript Runtime 不废弃**，它负责帮助我们把真正的 TLL Runtime 造出来。未来 TLL Language Compiler 的第一版也用 TypeScript 实现，验证语言设计后再考虑迁移。

---

## 四、版本路线

### Foundation 0.2（已完成）

- TypeScript Reference Runtime
- Protocol 2.0 冻结
- Application Graph
- 17 Contracts（10 项有运行时实现）
- Persistence / HTTP / CLI / Security / Testing
- ChangeSet / Workspace / Lock / Review
- 281/281 测试通过

### Runtime 0.3（当前阶段）

**目标：TLL-IR v0.1 + Language Parser + AST + Semantic Model + Compiler Architecture**

交付物：
- TLL Language Specification v0.1
- TLL Lexer（词法分析器）
- TLL AST 定义
- TLL Parser（语法分析器）
- TLL-IR Schema v0.1
- Semantic Model
- Compiler（TLL 源码 → AST → TLL-IR）
- 示例：blog.tll 完整编译通过
- 测试覆盖

### Runtime 0.4

**目标：TLL Language Alpha**

加入：Entity / Module / API / Action / Event / Permission 的完整语言支持。

### Runtime 0.5

**目标：Workflow / Agent / Tool / UI / Deployment**

加入语言级别的 Workflow、Agent、Tool、View、Deployment 定义。

### Runtime 0.6

**目标：Rust Runtime Alpha**

TLL-IR → Rust Runtime，开始脱离 Node.js。

### Runtime 0.7

**目标：SQLite / PostgreSQL / HTTP / Security / Scheduler / Plugin**

迁移到 Rust Runtime 的完整基础设施。

### Runtime 0.8

**目标：TLL Studio / CLI / Agent Developer / Visual Graph**

### Runtime 0.9

**目标：PHP Importer / JS Importer / Python Importer / Legacy Migration**

### TLL OS 1.0

**最终目标：**
- TLL Language 1.0
- TLL-IR 1.0
- TLL Runtime 1.0（Rust）
- TLL Compiler 1.0
- TLL Studio 1.0
- TLL CLI 1.0
- TLL Deployment 1.0
- TLL Agent System 1.0
- TLL Plugin System 1.0
- TLL Marketplace
- Legacy Import System

**1.0 的服务器可以只安装 TLL Runtime，不需要 PHP、Node.js、Python 就能运行一个纯 TLL 应用。**

---

## 五、TLL Language 核心设计原则

1. **Application-Native**：语言为开发完整应用而设计，不是通用编程语言。
2. **Declarative First**：优先声明式描述（entity/api/permission/workflow），命令式逻辑作为补充。
3. **AI-Readable**：语法设计同时考虑人类可读性和 AI Agent 可解析性。
4. **Graph-Native**：语言结构直接映射到 Application Graph。
5. **One Way to Do Things**：每个应用概念只有一种语言表达方式，避免歧义。
6. **Progressive Disclosure**：简单应用只需简单语法，复杂能力通过可选块启用。

---

## 六、TLL-IR 设计原则

1. **Universal**：不绑定任何特定语言或运行时。
2. **Serializable**：可以序列化为 JSON/YAML，便于存储、传输、版本控制。
3. **Graph-Based**：以 Application Graph 为核心，节点 + 边描述应用结构。
4. **Validatable**：可以静态验证完整性、一致性、权限。
5. **Executable**：Runtime 可以直接加载 TLL-IR 并运行应用。
6. **Composable**：多个 TLL-IR 可以组合（Module 组合为 Application）。

---

## 七、仓库目录结构（演进目标）

```
tll-os/
├── language/
│   ├── lexer/          # 词法分析器
│   ├── parser/         # 语法分析器
│   ├── ast/            # AST 节点定义
│   ├── semantic/       # 语义分析
│   └── specification/  # 语言规范
├── ir/
│   ├── schema/         # TLL-IR Schema
│   ├── graph/          # Graph 模型
│   └── validator/      # IR 验证器
├── compiler/           # 编译器（TLL → AST → TLL-IR）
├── runtime/            # Runtime（当前为 TS 实现，未来 Rust）
│   ├── core/
│   ├── http/
│   ├── data/
│   ├── workflow/
│   ├── agent/
│   ├── security/
│   └── plugin/
├── studio/             # TLL Studio（未来）
├── cli/                # CLI 工具
├── adapters/           # 外部适配器
├── importers/          # 外部语言导入器（PHP/JS/Python）
├── examples/           # 示例应用
├── tests/              # 测试
├── protocol/           # Protocol 2.0 规范
└── website/            # 官网 / Developer Hub
```

---

## 八、第一稳定版定义

TLL OS Stable Foundation 1.0 必须保证：

```
TLL Language
      ↓
Compiler
      ↓
TLL-IR
      ↓
Runtime
      ↓
Server
      ↓
Web Application
```

这个闭环真实跑通。

验证标准：用 TLL 开发一个 Blog 应用（用户/文章/评论/登录/权限/API/后台/数据库），然后 `tll build` + `tll deploy` 到一台干净 Linux 服务器。服务器没有 PHP、没有 Node.js、没有 Python，依然可以访问网站、调用 API、读写数据库、登录、权限、运行 Workflow、运行 Agent。

**这一天，才是真正意义上的 TLL OS 诞生。**

---

## 九、与现有 Foundation 0.2 的关系

- Foundation 0.2 的 Application Graph = 未来 TLL-IR 的雏形
- Foundation 0.2 的 Module/API/Tool/Agent = TLL Language 一等公民的运行时验证
- Foundation 0.2 的 Contract = TLL-IR Schema 的基础
- Foundation 0.2 的 ChangeSet/Workspace/Lock/Review = 多 Agent 协作的运行时验证
- TypeScript Runtime = Bootstrap Runtime，用于验证语言设计和构建 Compiler

**之前的工作没有浪费，而是为自主语言时代打好了地基。**
