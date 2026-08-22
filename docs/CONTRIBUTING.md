# TLL OS 贡献指南

> 文档：CONTRIBUTING.md
> 版本：0.1.0-blueprint

---

## 1. 欢迎贡献

TLL OS 是一个开源项目，欢迎任何形式的贡献：代码、文档、测试、Bug 报告、功能建议、架构讨论。

### 1.1 贡献类型

| 类型 | 说明 |
|------|------|
| **代码贡献** | 新功能、Bug 修复、性能优化、重构 |
| **文档贡献** | 架构文档、使用文档、API 文档、教程 |
| **测试贡献** | 单元测试、集成测试、测试用例补充 |
| **Module/Plugin** | 开发新的 Module 或 Plugin，提交到生态 |
| **Bug 报告** | 报告发现的问题，附带复现步骤 |
| **功能建议** | 提出新功能或改进建议 |
| **架构讨论** | 参与架构设计讨论和 ADR 决策 |
| **AI Agent** | 开发新的 Agent、Tool、Skill |

---

## 2. 代码规范

### 2.1 语言与风格

- **语言**：TypeScript 5.x，严格模式（`strict: true`）
- **模块系统**：ESM（`"type": "module"`）
- **缩进**：2 空格
- **引号**：单引号
- **分号**：必须使用
- **行宽**：最大 120 字符
- **命名**：
  - 类/接口/类型：PascalCase（`Application`, `RouteDefinition`）
  - 函数/变量/方法：camelCase（`handleRequest`, `maxRetries`）
  - 常量：UPPER_SNAKE_CASE（`DEFAULT_PORT`, `MAX_RETRIES`）
  - 文件：kebab-case（`route-matcher.ts`, `event-dispatcher.ts`）
- **接口命名**：不加 `I` 前缀（`Container` 而非 `IContainer`）
- **类型别名**：PascalCase，使用 `type` 而非 `interface` 当定义联合类型或函数类型时

### 2.2 ESLint 配置

项目使用 ESLint + TypeScript 插件，规则包括：
- `@typescript-eslint/no-explicit-any`：禁止使用 `any`（使用 `unknown` 替代）
- `@typescript-eslint/no-unused-vars`：禁止未使用的变量
- `@typescript-eslint/explicit-function-return-type`：导出函数必须显式声明返回类型
- `no-console`：禁止使用 `console`（使用 Logger）
- `prefer-const`：优先使用 `const`
- `no-throw-literal`：必须抛出 Error 对象

### 2.3 代码组织

- 每个文件一个主要导出（类/接口/函数）
- 相关文件放在同一目录
- 导入顺序：Node.js 内置模块 → 第三方模块 → 项目内部模块 → 类型导入
- 循环依赖：禁止，通过事件或接口解耦
- 文件长度：建议不超过 300 行，超过时考虑拆分

---

## 3. 架构规范

### 3.1 分层规则

- **Kernel 不依赖上层**：Kernel 代码不能 import Module/Plugin/API/AI 的代码
- **Module/Plugin 不直接依赖 Kernel 实现**：只依赖 Kernel 暴露的接口
- **Runtime 不依赖具体 Module/Plugin**：只依赖注册接口
- **AI Kernel 通过标准接口操作 Kernel**：不直接访问 Kernel 内部状态

### 3.2 接口优先

- 所有公共组件必须先定义接口，再提供实现
- 接口放在 `interfaces/` 目录，实现放在同目录或 `implementations/` 子目录
- 通过 Container 注入依赖，不直接 `new` 实现类
- 新增功能必须考虑是否需要定义新的 Contract

### 3.3 事件驱动

- 组件间通信优先使用 Event，而非直接调用
- 事件名称：`{domain}.{action}`，如 `kernel.booted`、`module.installed`
- 事件必须是可序列化的
- 事件监听器必须处理异常，不能影响事件分发

### 3.4 配置管理

- 所有可配置项通过 Config 接口读取，不直接读 `process.env`
- 配置键：点号分隔，如 `database.host`
- 敏感配置（密钥、密码）必须标记为 secret，日志中脱敏
- 新增配置项必须在文档中说明

---

## 4. 开发流程

### 4.1 Git 工作流

- **主分支**：`main`（稳定版本）、`develop`（开发分支）
- **功能分支**：`feature/{description}`，如 `feature/ai-tool-registry`
- **修复分支**：`fix/{description}`，如 `fix/router-param-parsing`
- **发布分支**：`release/{version}`，如 `release/0.1.0`
- **提交信息**：Conventional Commits 规范

```
feat(router): add support for optional route parameters
fix(container): resolve circular dependency detection error
docs(architecture): update ADR-003 with plugin isolation details
test(event): add tests for event priority ordering
refactor(logger): simplify structured log formatting
chore: update dependencies
```

### 4.2 Pull Request 流程

1. Fork 仓库或创建功能分支
2. 编写代码和测试
3. 运行 `tll test` 确保所有测试通过
4. 运行 `tsc --noEmit` 确保类型检查通过
5. 运行 ESLint 确保代码风格符合规范
6. 提交 PR，填写 PR 模板（描述、变更类型、测试说明）
7. 等待代码审查
8. 根据审查意见修改
9. 合并到 `develop` 分支

### 4.3 PR 模板

```markdown
## 描述
[简要描述这个 PR 的变更内容]

## 变更类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 性能优化
- [ ] 重构
- [ ] 文档
- [ ] 测试
- [ ] 其他（请说明）

## 关联 Issue
[关联的 Issue 编号，如 #123]

## 测试说明
- [ ] 单元测试已添加/更新
- [ ] 集成测试已添加/更新
- [ ] 所有测试通过 (`tll test`)
- [ ] 类型检查通过 (`tsc --noEmit`)

## 架构影响
- [ ] 新增接口/Contract
- [ ] 修改现有接口（破坏性变更）
- [ ] 新增 ADR
- [ ] 无架构影响

## 截图/日志（如适用）
```

---

## 5. 测试规范

### 5.1 测试要求

- **所有新功能必须有测试**：没有测试的 PR 不会被合并
- **Bug 修复必须有回归测试**：复现 Bug 的测试，确保不会再次出现
- **测试命名**：`{被测对象}.test.ts`，如 `container.test.ts`
- **测试描述**：清晰说明测试场景，如 `should resolve singleton instance`

### 5.2 测试编写规范

- 每个测试独立，不依赖其他测试的执行顺序
- 使用 `setUp`/`tearDown` 准备和清理测试环境
- 测试数据使用工厂函数或 Builder 模式创建
- Mock 外部依赖（数据库、网络、LLM API）
- 测试断言要精确，避免过于宽泛的断言

### 5.3 覆盖率

- Kernel 核心组件：行覆盖率 >= 90%
- Module：行覆盖率 >= 80%
- Plugin：行覆盖率 >= 70%
- 覆盖率下降的 PR 需要说明原因

---

## 6. 文档规范

### 6.1 代码文档

- 所有公共 API 必须有 TSDoc 注释
- 注释包含：描述、参数说明、返回值说明、抛出异常说明
- 复杂算法需要内联注释说明思路

```typescript
/**
 * 匹配 HTTP 请求到已注册的路由。
 *
 * 使用 Trie 树进行高效路径匹配，支持参数提取和通配符。
 *
 * @param method - HTTP 方法（GET/POST/PUT/DELETE/PATCH）
 * @param path - 请求路径，如 "/users/123"
 * @returns 匹配结果，包含路由定义和提取的参数；未匹配返回 null
 * @throws {RouterError} 当路由表未初始化时
 */
match(method: string, path: string): RouteMatch | null {
  // ...
}
```

### 6.2 架构文档

- 架构决策记录在 `docs/ARCHITECTURE.md` 的 ADR 部分
- 每个子系统有专门的设计文档（`docs/KERNEL.md`、`docs/AI.md` 等）
- 重大架构变更必须更新相关文档
- 文档中的代码示例必须是可运行的

### 6.3 Module/Plugin 文档

- 每个 Module/Plugin 必须有 README.md
- README 包含：描述、安装、配置、使用示例、API 文档、开发指南
- Plugin 的 README 必须包含 ai_metadata 中声明的能力的详细说明

---

## 7. 发布流程

### 7.1 版本号

遵循语义化版本（SemVer）：
- `MAJOR`：破坏性变更
- `MINOR`：向后兼容的新功能
- `PATCH`：向后兼容的 Bug 修复

### 7.2 发布检查清单

- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] 代码风格检查通过
- [ ] 覆盖率达标
- [ ] 文档已更新
- [ ] CHANGELOG 已更新
- [ ] 破坏性变更已标注并提供迁移指南
- [ ] 示例项目已验证
- [ ] 性能基准测试无显著回退

---

## 8. 社区规范

### 8.1 行为准则

- 尊重他人，友善沟通
- 接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

### 8.2 沟通渠道

- GitHub Issues：Bug 报告、功能建议
- GitHub Discussions：架构讨论、问答
- 代码审查：PR 评论

### 8.3 问题报告

报告 Bug 时请包含：
- TLL OS 版本
- Node.js 版本
- 操作系统
- 复现步骤
- 预期行为
- 实际行为
- 错误日志（脱敏后）
- 最小复现代码（如可能）

---

## 9. AI Agent 贡献

TLL OS 鼓励使用 AI Agent 辅助开发，但必须遵守：

1. **AI 生成的代码必须经过人工审查**
2. **AI 生成的代码必须有测试**
3. **AI 生成的代码必须符合代码规范**
4. **AI 不能替代架构决策**，架构变更必须人工讨论和批准
5. **使用 AI 辅助开发时，在 PR 中说明哪些部分使用了 AI**
6. **AI Agent 操作 TLL OS 时必须遵守 `AGENTS.md` 中的规范**

---

## 10. 许可证

TLL OS 采用 MIT 许可证（详见 LICENSE 文件）。贡献代码即同意该代码以 MIT 许可证发布。
