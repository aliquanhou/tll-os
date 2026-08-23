# TEP-005: Middleware / Interceptor

**状态**: Proposed | **日期**: 2026-08-22 | **作者**: TLL OS Commerce Agent

## 问题

Runtime 0.1 的 API handler 是单一函数，无中间件机制。横切关注点（鉴权、日志、限流、CORS、请求体解析、错误处理）需要在每个 handler 中手动实现，导致代码重复且不一致。Commerce 项目中，customer 模块的地址 API 手动检查 token，其他模块完全无鉴权，就是因为缺乏统一的中间件机制。

## 当前替代方案

在每个 handler 中手动编写横切逻辑。Commerce 项目的 `utils.js` 提供了 `authUser()` 辅助函数，但需要每个 API 手动调用。

## 提案

引入中间件机制，支持全局、Module 级、API 级三层中间件：

```typescript
type Middleware = (ctx: ApiContext, next: () => Promise<ApiResponse>) => Promise<ApiResponse>;

// 全局中间件
app.use(middleware);

// Module 级中间件
module.use(middleware);

// API 级中间件
module.apis.create({ method, path, handler, middlewares: [auth, rateLimit] });
```

内置中间件：
- **auth**: 鉴权（基于 token/session）
- **rbac**: 角色权限检查
- **rateLimit**: 限流
- **cors**: 跨域处理
- **logger**: 请求日志
- **validate**: 请求体校验（基于 JSON Schema）
- **compress**: 响应压缩
- **cache**: 响应缓存

## 预期收益

- 横切逻辑统一实现，消除代码重复
- 鉴权/权限可集中管理，避免遗漏
- 支持 AOP 风格的编程模型
- Module 可声明所需中间件，Runtime 自动装配

## 兼容性

纯新增能力，不使用中间件时 handler 行为不变。
