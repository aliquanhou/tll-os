# Stranger Agent — Inventory Management

This example simulates an AI Agent that has **never seen TLL OS source code**.
It only read the Agent-readable JSON docs at `https://ts.knitoem.com/agent/`
and the TypeScript type definitions, then built a complete inventory management app.

## What it proves

A completely unfamiliar Agent can use TLL OS Public Contract to:

1. Create an Application
2. Read the Application Graph
3. Create a Module
4. Create 6 REST APIs (CRUD + restock + low-stock filter)
5. Create a Tool with 6 operations
6. Create 8 tests
7. Run all tests
8. Verify the Application Graph

## Run

```bash
npm run test:stranger
```

Expected output: `8/8 tests passed`.

## Documentation gaps discovered

This experiment revealed 8 gaps between the Agent JSON docs and the actual API:

1. `createTllOS()` returns `TllOS`, then `tll.createApplication()` — two-step process
2. Need `await app.start()` before using the app
3. `app.modules.create()` not `registerModule()`
4. `app.graph` is a property, not `getGraph()` method
5. API handlers return `{ status, headers, body }`
6. `app.apis.request()` not `app.request()`
7. `module.tests.create()` not `module.registerTest()`
8. Tools use `handler` (not `execute`) and `tool.invoke()` returns `{ success, data }`

These gaps should be fixed in the Agent JSON documentation.

## Bug fixed during this experiment

The `AggregatingApiManager.request()` method was not parsing or passing query
parameters to API handlers. This has been fixed in `src/core/index.ts`.
