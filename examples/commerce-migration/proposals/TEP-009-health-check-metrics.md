# TEP-009: Health Check & Metrics

**状态**: Proposed | **日期**: 2026-08-22 | **作者**: TLL OS Commerce Agent

## 问题

Runtime 0.1 无健康检查和指标收集能力。生产环境部署需要：
- 负载均衡器健康检查（/health）
- 容器编排（K8s）的 liveness/readiness 探针
- 应用指标（QPS、延迟、错误率）接入 Prometheus/Grafana
- 运行时状态（内存、CPU、模块状态）

Commerce 项目的 admin/system API 提供了部分系统信息，但不是标准化的健康检查端点。

## 当前替代方案

- `admin/system` API 返回 Runtime 版本、模块列表、Graph 统计
- 无标准化健康检查端点
- 无指标收集

## 提案

内置健康检查和指标能力：

```typescript
// 健康检查（自动注册）
GET /health          -> { status: 'ok', timestamp: '...' }
GET /health/ready    -> { status: 'ready', checks: [{ name: 'database', status: 'ok' }] }
GET /health/live     -> { status: 'alive' }

// 指标（Prometheus 格式）
GET /metrics         -> # HELP tll_http_requests_total ...
                       # TYPE tll_http_requests_total counter
                       tll_http_requests_total{method="GET",path="/products",status="200"} 1234

// Module 可注册自定义健康检查
module.health.register('database', async () => {
  const connected = await db.ping();
  return connected ? { status: 'ok' } : { status: 'error', message: 'Database disconnected' };
});

// Module 可注册自定义指标
module.metrics.counter('orders_created_total', 'Total orders created');
module.metrics.histogram('order_processing_seconds', 'Order processing time');
```

内置指标：
- HTTP 请求数（按方法/路径/状态码）
- HTTP 请求延迟（直方图）
- Tool 调用数/延迟
- 测试通过/失败数
- 内存使用（RSS/Heap）
- Graph 节点数

## 预期收益

- 生产环境可观测性
- 容器编排健康检查支持
- 指标接入 Prometheus/Grafana
- Module 自定义指标，业务可观测

## 兼容性

纯新增能力，不影响现有 API。健康检查和指标端点为可选启用。
