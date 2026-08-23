# TEP-001: HTTP Server Adapter

**状态**: Proposed | **日期**: 2026-08-22 | **作者**: TLL OS Commerce Agent

## 问题

Runtime 0.1 的 `app.apis.request(method, path, body)` 是进程内调用，不监听 HTTP 端口。外部客户端（浏览器、移动端、第三方系统）无法直接调用 TLL OS Application 的 API。

## 当前替代方案

每个项目自行编写 HTTP 服务器桥接层（如 commerce 项目的 `server.js`），用 Node 原生 http 模块监听端口，将 `/api/*` 请求转发到 `app.apis.request`。

## 提案

在 TLL OS Runtime 中引入 HTTP Server Adapter 规范：

```typescript
interface HttpServerAdapter {
  start(app: Application, port: number, host?: string): Promise<void>;
  stop(): Promise<void>;
}
```

Runtime 提供默认的 Node 原生 http 实现，同时支持第三方 Adapter（Express、Koa、Fastify、Deno、Bun 等）。

Application 配置中增加：

```typescript
interface ApplicationConfig {
  http?: {
    enabled: boolean;
    port: number;
    host: string;
    adapter?: HttpServerAdapter;
    prefix?: string; // 默认 '/api'
    static?: { root: string; prefix: string };
  };
}
```

## 预期收益

- 项目无需自行编写 HTTP 桥接代码
- 统一的请求/响应处理（CORS、body 解析、错误处理、日志）
- 支持多种运行时（Node/Deno/Bun）
- 内置静态文件服务

## 兼容性

完全向后兼容，不启用 http 配置时行为与 Runtime 0.1 一致。
