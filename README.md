# TLL OS

**An AI-Native Universal Application Development Protocol.**

Not a framework. Not a CMS. Not an ecommerce platform. A shared protocol that humans and AI Agents can both read, understand, and execute.

---

## Three Ways to Enter TLL OS

```
Human Developer          AI Agent               Existing Software
      ↓                     ↓                          ↓
  TLL OS                TLL OS                    Adapter
      ↓                     ↓                          ↓
  Application           Application               Application
      ↓                     ↓                          ↓
  Application Graph     Application Graph         Application Graph
      ↓                     ↓                          ↓
  BuildTarget           BuildTarget               BuildTarget
  (Web/H5/APK/EXE/     (Web/H5/APK/EXE/         (Web/H5/APK/EXE/
   AI Agent/IoT)         AI Agent/IoT)             AI Agent/IoT)
```

- **Human Developer** — Write code using the TLL OS Public Contract. Build modules, APIs, tools, agents.
- **AI Agent** — Read the protocol, understand the Application Graph, design and implement applications autonomously.
- **Existing Software** — Connect Shopify, WordPress, Medusa, Laravel, any system through Adapters. Migrate, sync, or coexist.

---

## Quick Start

```bash
git clone https://github.com/tll-os/tll-os.git
cd tll-os
npm install
npm test
```

You should see:

```
✓ hello-tll-agent: 3/3 tests
✓ autonomous-task-manager: 12/12 tests
✓ stranger-agent-inventory: 8/8 tests
Total: 23/23 tests passed, 0 failed
✅ All tests passed! TLL OS is ready.
```

### Run an Example

```bash
# Minimal PoC — Agent creates app, tests, fixes bug, re-tests
npm run test:hello

# Real Agent experiment — dual-module app with 11 APIs, Tool, Agent
npm run test:task-manager

# Stranger Agent test — Agent with NO prior knowledge builds inventory app
npm run test:stranger
```

### Create Your First Application

```typescript
import { createTllOS } from '@tll/os/public';

// Only ever import from /public — never touch internal implementation
const app = createTllOS({
  name: 'my-app',
  version: '0.1.0',
});

// Create a module
const module = app.registerModule({
  name: 'hello',
  version: '1.0.0',
});

// Create an API
module.registerApi({
  method: 'GET',
  path: '/api/hello',
  handler: async () => ({ message: 'Hello, TLL OS!' }),
});

// Create a Tool for Agents
module.registerTool({
  name: 'greet',
  description: 'Greet a user',
  parameters: { name: { type: 'string', required: true } },
  execute: async (params) => ({ greeting: `Hello, ${params.name}!` }),
});

// Read the Application Graph
const graph = app.getGraph();
console.log(`Nodes: ${graph.listNodes().length}`);

// Run tests
const results = await app.runTests();
console.log(`${results.passed}/${results.total} passed`);
```

---

## For AI Agents

If you are an AI Agent using TLL OS for the first time:

1. **Read** `https://ts.knitoem.com/agent/index.json` — discover all structured resources
2. **Read** `https://ts.knitoem.com/agent/protocol.json` — understand Protocol 2.0
3. **Read** `https://ts.knitoem.com/agent/contracts.json` — learn all 17 contracts
4. **Read** `https://ts.knitoem.com/agent/examples.json` — study verified examples
5. **Create** an Application using `createTllOS()` from `@tll/os/public`
6. **Build** modules, APIs, tools, agents through the Public Contract
7. **Test** with `app.runTests()`, fix failures, verify

**Rule**: Only import from `@tll/os/public`. Never import internal implementation (`core/`, `adapters/`, `kernel/`).

**Agent Development Loop**:
```
Requirement → Read Graph → Select Capability → Select Module/Plugin/Adapter
→ Design (Graph nodes) → Implement (Projection → code) → Test
→ Discover issues → Fix → Verify → BuildTarget → Deploy
```

---

## Protocol 2.0 — Five Models, 17 Contracts

TLL OS Protocol 2.0 consists of five interconnected models:

| Model | Contracts | Purpose |
|-------|-----------|---------|
| **Application** | Application, Application Graph, Module, Plugin, Event, Permission | Define what an app is and how it's structured |
| **AI Development** | Agent, Tool, Skill, Context, Workflow | Define how AI Agents develop and operate apps |
| **Ecosystem** | Adapter, Compatibility Manifest, Capability | Define how external systems connect |
| **Build** | Projection, BuildTarget | Define how Graph projects to output platforms |
| **Evolution** | Evolution Proposal, TEP | Define how the protocol evolves |

### Application Graph — The Primary Source of Truth

The Application Graph is a machine-readable map of your entire application: modules, APIs, models, events, dependencies, agents, tools, capabilities. AI doesn't search through files — it reads the Graph.

**17 node types**: application, module, plugin, adapter, api, model, event, workflow, agent, tool, skill, permission, capability, build_target, config, command, dependency

**15 edge types**: belongs_to, depends_on, provides, calls, triggers, requires, uses, extends, conflicts_with, listens_to, implements, exports, imports, builds_for, maps_to

---

## Protocol vs Runtime

TLL OS is separated into two independent layers:

```
TLL OS Protocol 2.0          TLL OS Runtime 0.1
(稳定的规范)                   (参考实现)
     │                              │
     ├── 17 Contracts              ├── src/public/ (Public Contract)
     ├── 5 Models                  ├── src/core/ (内存版最小实现)
     ├── Application Graph         ├── src/adapters/node/ (Node.js Adapter)
     ├── Agent Protocol            └── examples/ (验证示例)
     └── TEP Evolution
```

- **Protocol** is stable. Breaking changes require Protocol 3.0.
- **Runtime** evolves rapidly (0.x → 1.0).
- Anyone can implement their own TLL Runtime in any language, as long as it follows Protocol 2.0.
- Even if the Runtime is completely rewritten, Protocol 2.0 applications and Agents remain valid.

---

## Don't Reinvent the Wheel

TLL OS controls protocols and models — not every low-level implementation.

| Concern | TLL OS Uses |
|---------|-------------|
| HTTP Server | Fastify |
| Database ORM | Drizzle |
| Validation | Zod |
| Queue | BullMQ / NATS |
| Logging | Pino |
| Testing | Vitest |
| Cache | Redis |
| Ecommerce | Shopify / Medusa / Shopware (via Adapter) |
| CMS | WordPress / Strapi (via Adapter) |
| ERP | Odoo / ERPNext (via Adapter) |

TLL OS unifies standards, not implementations.

---

## Project Structure

```
tll-os/
├── protocol/v2/              # Protocol 2.0 Specification (冻结)
│   ├── SPECIFICATION.md      # 宪法
│   └── FREEZE.md             # 冻结记录
├── src/                       # Runtime 0.1 参考实现
│   ├── public/                # Public Contract (唯一入口)
│   │   ├── types.ts           # 17项契约类型定义
│   │   └── index.ts           # createTllOS() 入口
│   ├── core/                  # 内存版最小实现
│   └── adapters/node/         # Node.js Runtime Adapter
├── examples/                  # 验证示例
│   ├── hello-tll-agent/       # 最小PoC (3测试)
│   └── autonomous-task-manager/ # 真实Agent实验 (12测试)
├── docs/                      # 架构文档
├── tests/                     # 测试运行器
├── LICENSE                    # Apache 2.0
├── NOTICE
├── TRADEMARK.md
├── README.md
└── package.json
```

---

## Verified Examples

| Example | Modules | APIs | Tools | Agents | Tests | Status |
|---------|---------|------|-------|--------|-------|--------|
| hello-tll-agent | 1 | 1 | 1 | 1 | 3/3 | ✅ |
| autonomous-task-manager | 2 | 11 | 1 (6 ops) | 1 | 12/12 | ✅ |

The autonomous-task-manager experiment is the critical validation: an Agent that has never seen TLL OS source code independently builds a dual-module application with cross-module dependencies, 11 REST APIs, a unified Tool, and an intent-parsing Agent — all through the Public Contract.

This experiment also discovered and fixed a core bug (API path parameter parsing) that unit tests missed — proving that real Agent experiments find bugs unit tests can't.

---

## Evolution — TEP

TLL OS evolves through the **TLL Evolution Protocol (TEP)**:

```
Discover → Propose → Validate (auto-test + AI review) → Review (human)
→ Merge → Release
```

Anyone (human or AI Agent) can submit a TEP. Types: `feature`, `bugfix`, `breaking`, `deprecation`, `refactor`.

See [`docs/evolution/TEP.md`](docs/evolution/TEP.md) for the full process.

---

## Resources

- **Developer Hub**: https://ts.knitoem.com
- **For AI Agents**: https://ts.knitoem.com/agents.html
- **Agent JSON**: https://ts.knitoem.com/agent/index.json
- **Protocol Spec**: [`protocol/v2/SPECIFICATION.md`](protocol/v2/SPECIFICATION.md)
- **Architecture Docs**: [`docs/`](docs/)

---

## License

- **Code**: Apache License 2.0 — see [`LICENSE`](LICENSE)
- **Trademark**: TLL OS name and logo are independently protected — see [`TRADEMARK.md`](TRADEMARK.md)
- Open source code ≠ open trademark.

---

**TLL OS Protocol 2.0 — An AI-Native Universal Application Development Protocol.**
