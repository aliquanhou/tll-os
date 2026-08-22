# TLL OS Testing 设计

> 文档：TESTING.md
> 版本：0.1.0-blueprint
> 战略修正：测试框架可复用成熟组件（node:test / Vitest），但 TLL OS 必须定义测试 Contract（Kernel Test、Module Test、Plugin Test、AI Test Loop）。AI Agent 运行测试、分析结果、自动修复是 TLL OS 的核心能力之一。

---

## 1. Testing 概述

TLL OS Testing 提供完整的测试体系，确保 Kernel、Module、Plugin、API、AI Agent 的质量。

### 1.1 设计原则

1. **核心组件必须有测试**：没有测试的代码视为未完成
2. **可独立测试**：每个组件可在不启动完整应用的情况下测试
3. **测试金字塔**：大量单元测试 + 适量集成测试 + 少量端到端测试
4. **AI 可运行**：AI Agent 可以通过标准 Tool 运行测试、分析结果、自动修复
5. **零依赖测试运行时**：Foundation 阶段使用 Node.js 内置 `node:test`

### 1.2 测试类型

| 类型 | 范围 | 数量 | 运行时间 | 工具 |
|------|------|------|----------|------|
| **Unit Test** | 单个函数/类 | 多 | 快 | node:test |
| **Integration Test** | 多组件协作 | 中 | 中 | node:test + TestKit |
| **Kernel Test** | Kernel 生命周期 | 少 | 中 | KernelTestCase |
| **Module Test** | 单个 Module | 中 | 中 | ModuleTestCase |
| **Plugin Test** | 单个 Plugin | 中 | 中 | PluginTestCase |
| **API Test** | HTTP API 端点 | 中 | 中 | ApiTestCase |
| **AI Test** | Agent/Tool/Skill | 少 | 慢 | AiTestCase |
| **E2E Test** | 完整应用流程 | 极少 | 慢 | 后续阶段 |

---

## 2. 测试框架

### 2.1 基础框架

Foundation 阶段使用 Node.js 内置 `node:test` + `node:assert`：

- 零外部依赖
- 原生支持 ESM
- 支持 `describe`/`it`/`before`/`after`/`beforeEach`/`afterEach`
- 支持并行测试
- 支持 TAP 输出格式

后续阶段可扩展支持 Vitest（兼容 node:test API，更快的 watch 模式和覆盖率）。

### 2.2 测试目录结构

```
tll-os/
├── tests/
│   ├── unit/                    # Kernel 单元测试
│   │   ├── container.test.ts
│   │   ├── router.test.ts
│   │   ├── event.test.ts
│   │   ├── config.test.ts
│   │   ├── logger.test.ts
│   │   ├── middleware.test.ts
│   │   ├── cache.test.ts
│   │   ├── queue.test.ts
│   │   ├── scheduler.test.ts
│   │   ├── validator.test.ts
│   │   └── cli.test.ts
│   ├── integration/             # Kernel 集成测试
│   │   ├── kernel.test.ts
│   │   ├── application.test.ts
│   │   ├── http-runtime.test.ts
│   │   └── lifecycle.test.ts
│   └── helpers/                 # 测试辅助工具
│       └── index.ts
├── modules/
│   └── hello-world/
│       └── tests/
│           ├── unit/
│           └── integration/
├── plugins/
│   └── demo-plugin/
│       └── tests/
│           ├── unit/
│           └── integration/
└── tll.config.ts                 # 测试配置
```

### 2.3 测试配置

```typescript
// tll.config.ts
export default {
  test: {
    include: ['tests/**/*.test.ts', 'modules/*/tests/**/*.test.ts', 'plugins/*/tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    environment: 'node',
    coverage: {
      enabled: true,
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: { lines: 80, functions: 80, branches: 70, statements: 80 },
      },
    },
    timeout: 10000,
    parallel: true,
  },
};
```

---

## 3. 测试基类 (TestKit)

TLL OS 提供测试基类，简化各类测试的编写。

### 3.1 KernelTestCase

用于测试 Kernel 组件，自动创建测试用的 Application 和 Container。

```typescript
import { KernelTestCase } from '@tll/os/testing';
import { Container } from '@tll/os/kernel/container';
import { Router } from '@tll/os/kernel/router';

class RouterTest extends KernelTestCase {
  protected router: Router;

  async setUp() {
    await super.setUp();
    this.router = this.container.resolve(Router);
  }

  async testStaticRoute() {
    this.router.register({ method: 'GET', path: '/hello', handler: () => 'ok' });
    const match = this.router.match('GET', '/hello');
    this.assert(match !== null);
    this.assert(match.route.path === '/hello');
  }

  async testRouteParams() {
    this.router.register({ method: 'GET', path: '/users/:id', handler: () => 'ok' });
    const match = this.router.match('GET', '/users/123');
    this.assert(match.params.id === '123');
  }
}
```

### 3.2 ModuleTestCase

用于测试单个 Module，自动启动 Module 并提供测试容器。

```typescript
import { ModuleTestCase } from '@tll/os/testing';

class HelloModuleTest extends ModuleTestCase {
  protected moduleName = 'hello-world';

  async testModuleIsRegistered() {
    this.assert(this.module !== null);
    this.assert(this.module.manifest.name === 'hello-world');
  }

  async testIndexRoute() {
    const response = await this.request('GET', '/api/hello-world');
    this.assertStatus(200);
    this.assertJson({ message: 'Hello, World!' });
  }

  async testService() {
    const service = this.container.resolve('HelloWorld.HelloService');
    const result = service.greet('TLL');
    this.assert(result === 'Hello, TLL!');
  }
}
```

### 3.3 PluginTestCase

用于测试单个 Plugin，自动安装/启用 Plugin 并提供测试容器。

```typescript
import { PluginTestCase } from '@tll/os/testing';

class DemoPluginTest extends PluginTestCase {
  protected pluginName = 'demo-plugin';

  async setUp() {
    await super.setUp();  // 自动安装并启用 Plugin
  }

  async testPluginIsEnabled() {
    this.assert(this.plugin !== null);
    this.assert(this.plugin.status === 'enabled');
  }

  async testPluginRoute() {
    const response = await this.request('GET', '/api/demo-plugin/status');
    this.assertStatus(200);
    this.assertJson({ status: 'ok' });
  }
}
```

### 3.4 ApiTestCase

用于测试 HTTP API，模拟请求不需要启动真实服务器。

```typescript
import { ApiTestCase } from '@tll/os/testing';

class UserApiTest extends ApiTestCase {
  async testListUsers() {
    const response = await this.get('/api/v1/users', {
      auth: { userId: 1, roles: ['admin'] },
    });
    this.assertStatus(200);
    this.assertJsonStructure({ data: 'array', meta: 'object' });
  }

  async testCreateUser() {
    const response = await this.post('/api/v1/users', {
      body: { name: 'Test User', email: 'test@example.com' },
      auth: { userId: 1, roles: ['admin'] },
    });
    this.assertStatus(201);
    this.assertJsonPath('data.name', 'Test User');
  }

  async testUnauthorized() {
    const response = await this.get('/api/v1/users');  // 无认证
    this.assertStatus(401);
  }
}
```

### 3.5 AiTestCase

用于测试 AI Agent、Tool、Skill，使用 Mock LLM Provider。

```typescript
import { AiTestCase } from '@tll/os/testing';

class DeveloperAgentTest extends AiTestCase {
  protected agentName = 'developer';

  async setUp() {
    await super.setUp();
    this.useMockLLM([
      { role: 'assistant', content: '', toolCalls: [{ name: 'module_list', args: {} }] },
      { role: 'assistant', content: 'There are 3 modules installed.' },
    ]);
  }

  async testAgentCanListModules() {
    const result = await this.agent.run({ message: 'List all modules' });
    this.assert(result.output.includes('3 modules'));
    this.assertToolCalled('module_list');
  }

  async testToolPermission() {
    this.agent.config.allowedTools = ['module_list'];
    const result = await this.agent.run({ message: 'Install a plugin' });
    this.assert(result.steps.some(s => s.error?.includes('permission')));
  }
}
```

---

## 4. 断言库

TLL OS 提供扩展的断言方法（基于 `node:assert`）：

```typescript
interface TestAssertions {
  // 基础
  assert(condition: boolean, message?: string): void;
  assertEqual(actual: unknown, expected: unknown, message?: string): void;
  assertNotEqual(actual: unknown, expected: unknown): void;
  assertDeepEqual(actual: unknown, expected: unknown): void;
  assertThrows(fn: () => unknown, error?: string | RegExp): void;
  assertAsyncThrows(fn: () => Promise<unknown>, error?: string | RegExp): Promise<void>;

  // HTTP
  assertStatus(status: number): void;
  assertHeader(name: string, value?: string): void;
  assertJson(expected: unknown): void;
  assertJsonPath(path: string, expected: unknown): void;
  assertJsonStructure(structure: Record<string, string>): void;

  // 容器
  assertBound(token: string): void;
  assertResolved(token: string, expected: unknown): void;

  // 事件
  assertEventDispatched(name: string): void;
  assertEventNotDispatched(name: string): void;

  // AI
  assertToolCalled(name: string, args?: unknown): void;
  assertToolNotCalled(name: string): void;
  assertTokenUsage(maxTokens: number): void;
}
```

---

## 5. 测试替身 (Test Doubles)

### 5.1 Mock

```typescript
const mockLogger = this.mock(Logger, {
  info: this.fn(),
  error: this.fn(),
});
mockLogger.info.expectCalledWith('test message');
```

### 5.2 Stub

```typescript
this.stub(Config, 'get', (key) => {
  if (key === 'app.port') return 3000;
  return undefined;
});
```

### 5.3 Fake

```typescript
// 使用内存实现替代真实数据库
this.container.bind(DataSource, () => new InMemoryDataSource());
```

### 5.4 Mock LLM Provider

AI 测试使用 Mock LLM Provider，预设响应序列：

```typescript
this.useMockLLM([
  { role: 'assistant', content: 'First response' },
  { role: 'assistant', content: '', toolCalls: [{ name: 'test_tool', args: { x: 1 } }] },
  { role: 'tool', content: JSON.stringify({ result: 'ok' }) },
  { role: 'assistant', content: 'Final response' },
]);
```

---

## 6. 测试运行

### 6.1 CLI 命令

| 命令 | 说明 |
|------|------|
| `tll test` | 运行全部测试 |
| `tll test:unit` | 仅运行单元测试 |
| `tll test:integration` | 仅运行集成测试 |
| `tll test:module <name>` | 运行指定 Module 的测试 |
| `tll test:plugin <name>` | 运行指定 Plugin 的测试 |
| `tll test:coverage` | 运行测试并生成覆盖率报告 |
| `tll test:watch` | 监听模式运行测试 |
| `tll test <pattern>` | 运行匹配文件名模式的测试 |

### 6.2 测试输出

```
$ tll test

TLL OS Test Runner
─────────────────────────────────────────────
Environment: test
Node.js: v20.0.0
TLL OS: 0.1.0

✓ tests/unit/container.test.ts (12 tests, 12 passed)
✓ tests/unit/router.test.ts (8 tests, 8 passed)
✓ tests/unit/event.test.ts (6 tests, 6 passed)
✓ tests/integration/kernel.test.ts (5 tests, 5 passed)
✓ modules/hello-world/tests/unit/hello.test.ts (3 tests, 3 passed)

Tests: 34 passed, 0 failed, 0 skipped
Time: 1.234s
Coverage: 87.3% (lines), 82.1% (functions), 75.4% (branches)

✓ All tests passed
```

JSON 输出（`--json`）：

```json
{
  "success": true,
  "stats": { "total": 34, "passed": 34, "failed": 0, "skipped": 0 },
  "time": 1234,
  "coverage": { "lines": 87.3, "functions": 82.1, "branches": 75.4 },
  "files": [
    { "path": "tests/unit/container.test.ts", "tests": 12, "passed": 12, "failed": 0 }
  ]
}
```

---

## 7. AI Testing Loop

### 7.1 AI Agent 如何运行测试

1. Agent 调用 `test_run` Tool 运行测试
2. 解析测试结果（JSON 格式）
3. 失败时调用 `error_get` Tool 获取详细错误
4. 分析失败原因
5. 调用 `file_read` / `code_search` 读取相关代码
6. 调用 `file_write` 修改代码
7. 重新运行测试
8. 重复直到通过或达到最大迭代次数

### 7.2 自动修复循环 (Bug Fix Loop)

```
测试失败
  ↓
获取错误详情
  ↓
分析错误堆栈和上下文
  ↓
定位问题代码
  ↓
生成修复方案
  ↓
应用修复
  ↓
运行相关测试
  ├─ 通过 → 完成，记录修复
  └─ 失败 → 检查是否达到最大迭代
              ├─ 未达到 → 重新分析
              └─ 达到 → 报告失败，请求人工介入
```

### 7.3 测试生成 (Test Generation)

AI Agent 可以为现有代码生成测试：

1. 调用 `code_search` / `file_read` 理解代码
2. 分析函数签名、输入输出、边界条件
3. 生成测试用例（正常路径、边界、异常）
4. 调用 `file_write` 写入测试文件
5. 调用 `test_run` 运行测试
6. 修复测试中的问题
7. 完成

---

## 8. 覆盖率要求

### 8.1 最低覆盖率

| 组件类型 | 行覆盖率 | 函数覆盖率 | 分支覆盖率 |
|----------|----------|------------|------------|
| Kernel 核心组件 | 90% | 90% | 80% |
| Module | 80% | 80% | 70% |
| Plugin | 70% | 70% | 60% |
| AI Kernel | 85% | 85% | 75% |

### 8.2 覆盖率报告

- 文本报告（CLI 输出）
- JSON 报告（CI/CD 解析）
- HTML 报告（浏览器查看，逐行高亮）
- 历史趋势（对比上次提交的覆盖率变化）

---

## 9. CI/CD 集成

### 9.1 CI 流程

```
1. 安装依赖
2. 类型检查 (tsc --noEmit)
3. 代码风格检查 (eslint)
4. 运行单元测试
5. 运行集成测试
6. 覆盖率检查（不达标则失败）
7. 构建
8. （可选）端到端测试
```

### 9.2 测试矩阵

- Node.js 版本：20.x, 22.x
- 操作系统：Linux, macOS, Windows
- 数据库：SQLite（测试用）, PostgreSQL, MySQL（后续）

---

## 10. 未实现与 TODO

第一阶段（蓝图阶段）Testing 为**完整的设计文档 + 接口定义**。

第二阶段实现优先级：
1. 测试运行器封装（基于 node:test）
2. 断言库扩展
3. KernelTestCase
4. ModuleTestCase
5. ApiTestCase
6. PluginTestCase
7. AiTestCase（含 Mock LLM Provider）
8. 测试替身工具（mock/stub/fake）
9. `tll test` 命令
10. 覆盖率报告
11. JSON 输出格式
12. AI Testing Loop Tool（test_run, error_get, fix_apply）

后续阶段：
- Watch 模式
- 并行测试优化
- 测试分片（CI 加速）
- 端到端测试
- 视觉回归测试
- 性能测试
