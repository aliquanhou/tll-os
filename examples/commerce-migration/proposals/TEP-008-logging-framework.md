# TEP-008: Logging Framework

**状态**: Proposed | **日期**: 2026-08-22 | **作者**: TLL OS Commerce Agent

## 问题

Runtime 0.1 无日志框架。Module 使用 `console.log` 输出日志，无法控制日志级别、格式、输出目标。生产环境需要结构化日志（JSON）、日志分级（debug/info/warn/error）、日志聚合（ELK/Loki）。

## 当前替代方案

- `console.log` / `console.error` 输出
- 无日志级别控制
- 无请求追踪 ID

## 提案

引入日志框架：

```typescript
interface Logger {
  debug(message: string, meta?: object): void;
  info(message: string, meta?: object): void;
  warn(message: string, meta?: object): void;
  error(message: string, meta?: object, error?: Error): void;
  child(bindings: object): Logger;  // 创建子 logger，绑定上下文
}

// Application 日志
const logger = app.logger;
logger.info('Application started', { port: 3000 });

// Module 日志（自动绑定 moduleName）
const logger = module.logger;
logger.info('Order created', { orderId: 'ord_123', amount: 99.99 });

// API 请求日志（自动绑定 requestId）
app.use(requestLogger);  // 中间件，每个请求生成 requestId
```

日志格式：
- **开发环境**: 人类可读格式（带颜色）
- **生产环境**: JSON 结构化日志

输出目标：
- Console（默认）
- File（按日期轮转）
- HTTP（发送到日志聚合服务）

内置日志中间件：
- **requestLogger**: 记录每个 API 请求的方法、路径、状态码、耗时
- **errorLogger**: 捕获未处理异常，记录错误堆栈

## 预期收益

- 结构化日志，便于检索和分析
- 请求追踪 ID，支持分布式链路追踪
- 日志级别控制，生产环境关闭 debug
- Module 自动绑定上下文，无需手动传递 logger

## 兼容性

纯新增能力。`console.log` 继续可用，但推荐使用 `module.logger`。
