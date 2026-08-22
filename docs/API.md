# TLL OS API System 设计

> 文档：API.md
> 版本：0.1.0-blueprint
> 战略修正：API 层的 HTTP Server/Router/Validation 可复用成熟开源组件；TLL OS 必须自研的是 API Contract（统一 API 规范、版本化、AI 可发现的 API 描述）。

---

## 1. API System 概述

TLL OS API System 提供统一的应用编程接口层，是 Application 与外部世界（前端、第三方系统、AI Agent）通信的标准入口。

### 1.1 设计原则

1. **统一规范**：所有 API（Module/Plugin/AI Agent 暴露的）遵循统一的请求/响应规范
2. **AI 可发现**：API 描述是结构化的，AI Agent 可自动解析并调用
3. **版本化**：API 支持版本管理，兼容旧版本客户端
4. **可复用组件**：HTTP 协议处理、路由匹配、参数验证可复用成熟库；TLL OS 定义的是 API Contract 和元数据标准
5. **多协议支持**：REST（第一阶段实现）、OpenAPI、WebSocket、Webhook（接口定义）

### 1.2 造轮子边界（战略修正）

| 组件 | 策略 | 说明 |
|------|------|------|
| HTTP Server | 可复用 | Node.js 内置 `http` 或 `uWebSockets.js` |
| Router | 可复用 | 但 TLL OS 定义 Route Metadata Contract |
| Request Validation | 可复用 | `zod` / `valibot` 等 |
| OpenAPI 生成 | TLL OS 定义 Contract | 基于 Route Metadata 自动生成 |
| API 版本化 | TLL OS 定义标准 | 统一的版本策略 |
| 认证/授权 | TLL OS 定义 Contract | 可复用 JWT/OAuth 库 |
| 限流 | 可复用 | `rate-limiter-flexible` 等 |
| WebSocket | 可复用 | `ws` 库 |
| Webhook | TLL OS 定义 Contract | 统一的 Webhook 注册和签名标准 |

---

## 2. REST API 规范

### 2.1 URL 结构

```
/{api-prefix}/{version}/{resource}/{id?}/{subresource?}/{subid?}
```

- `api-prefix`：默认 `/api`，可配置
- `version`：`v1`、`v2`，第一阶段默认 `v1`
- `resource`：资源名称，复数形式，kebab-case
- `id`：资源标识符
- `subresource`：子资源

示例：
- `GET /api/v1/users` —— 列出用户
- `GET /api/v1/users/123` —— 获取用户详情
- `POST /api/v1/users` —— 创建用户
- `PUT /api/v1/users/123` —— 更新用户
- `DELETE /api/v1/users/123` —— 删除用户
- `GET /api/v1/users/123/orders` —— 获取用户的订单列表

### 2.2 HTTP 方法语义

| 方法 | 语义 | 幂等 | 安全 |
|------|------|------|------|
| `GET` | 获取资源 | 是 | 是 |
| `POST` | 创建资源/执行操作 | 否 | 否 |
| `PUT` | 全量更新资源 | 是 | 否 |
| `PATCH` | 部分更新资源 | 否 | 否 |
| `DELETE` | 删除资源 | 是 | 否 |
| `HEAD` | 获取响应头（同 GET 但无 body） | 是 | 是 |
| `OPTIONS` | 获取资源支持的方法/CORS 信息 | 是 | 是 |

### 2.3 统一响应格式

#### 成功响应

```json
{
  "success": true,
  "data": { },
  "meta": {
    "timestamp": "2026-08-22T10:00:00Z",
    "request_id": "req_abc123",
    "api_version": "v1"
  }
}
```

#### 列表响应（分页）

```json
{
  "success": true,
  "data": [ ],
  "meta": {
    "timestamp": "2026-08-22T10:00:00Z",
    "request_id": "req_abc123",
    "api_version": "v1",
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 156,
      "total_pages": 8,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

#### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [
      {
        "field": "email",
        "message": "邮箱格式不正确",
        "rule": "email"
      }
    ],
    "request_id": "req_abc123"
  }
}
```

### 2.4 标准错误码

| HTTP 状态码 | 错误码 | 说明 |
|-------------|--------|------|
| 400 | `BAD_REQUEST` | 请求格式错误 |
| 400 | `VALIDATION_ERROR` | 参数验证失败 |
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `FORBIDDEN` | 无权限 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 405 | `METHOD_NOT_ALLOWED` | 方法不允许 |
| 409 | `CONFLICT` | 资源冲突 |
| 422 | `UNPROCESSABLE_ENTITY` | 语义错误 |
| 429 | `RATE_LIMITED` | 请求过于频繁 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |
| 502 | `BAD_GATEWAY` | 网关错误 |
| 503 | `SERVICE_UNAVAILABLE` | 服务不可用 |
| 504 | `GATEWAY_TIMEOUT` | 网关超时 |

Module/Plugin 可定义自定义错误码，格式：`{MODULE_OR_PLUGIN_NAME}_{ERROR_CODE}`，如 `ORDER_INSUFFICIENT_STOCK`。

### 2.5 请求头规范

| 请求头 | 说明 | 必填 |
|--------|------|------|
| `Content-Type` | 请求体格式，`application/json` | POST/PUT/PATCH 时必填 |
| `Authorization` | 认证令牌，`Bearer <token>` 或 `ApiKey <key>` | 需要认证的接口必填 |
| `X-API-Version` | API 版本（替代 URL 版本化的备选方案） | 否 |
| `X-Request-ID` | 客户端生成的请求 ID，用于追踪 | 否 |
| `Idempotency-Key` | 幂等键，用于 POST 防重复 | 否 |
| `Accept-Language` | 语言偏好 | 否 |

### 2.6 分页规范

查询参数：
- `page`：页码，默认 1
- `per_page`：每页数量，默认 20，最大 100
- `sort`：排序字段，`-created_at` 表示降序
- `fields`：返回字段筛选，逗号分隔
- `include`：关联资源包含，逗号分隔

---

## 3. API 版本化

### 3.1 版本策略

TLL OS 采用 **URL 路径版本化**（默认）+ **Header 版本化**（可选）双模式。

- 默认：`/api/v1/resource`
- 可选：`/api/resource` + `X-API-Version: v1`

### 3.2 版本生命周期

```
draft → active → deprecated → sunset → removed
```

| 状态 | 说明 | 响应头 |
|------|------|--------|
| `draft` | 开发中，可能变更 | `API-Version-Status: draft` |
| `active` | 稳定版本 | `API-Version-Status: active` |
| `deprecated` | 已弃用，仍可用 | `API-Version-Status: deprecated` + `Deprecation: <date>` + `Sunset: <date>` |
| `sunset` | 即将移除 | `API-Version-Status: sunset` + `Sunset: <date>` |
| `removed` | 已移除，返回 410 | - |

### 3.3 版本化规则

1. **向后兼容的变更**（新增字段、新增可选参数、新增端点）：不需要新版本号
2. **破坏性变更**（删除字段、修改字段类型、修改响应结构、删除端点）：必须新版本号
3. **至少维护两个 active 版本**：当前版本 + 上一个版本
4. **弃用通知期**：至少 90 天

---

## 4. OpenAPI

### 4.1 自动生成

TLL OS 基于 Route Metadata 自动生成 OpenAPI 3.1 规范文档：

- 路由定义中的 `openapi` 元数据 → OpenAPI Path Item
- 请求/响应 Schema → 从 Validator 规则或显式 Schema 生成
- 认证方式 → Security Scheme
- Module/Plugin 分组 → OpenAPI Tags

### 4.2 访问路径

- `GET /api/docs` —— Swagger UI（HTML 页面）
- `GET /api/docs.json` —— OpenAPI JSON
- `GET /api/docs.yaml` —— OpenAPI YAML

### 4.3 AI Agent 与 OpenAPI

AI Agent 通过 OpenAPI 文档理解和调用 API：
1. Agent 获取 `/api/docs.json`
2. 解析可用的端点、参数、响应结构
3. 生成 API 调用代码
4. 执行调用（经过认证和权限检查）
5. 解析响应

这是 AI Agent 操作 TLL OS 应用的标准方式之一（另一种是通过 AI Tool 接口）。

---

## 5. 认证与授权

### 5.1 认证方式

| 方式 | 适用场景 | 说明 |
|------|----------|------|
| API Key | 服务端到服务端 | `Authorization: ApiKey <key>`，简单安全 |
| JWT | 用户认证 | `Authorization: Bearer <token>`，无状态 |
| OAuth 2.0 | 第三方授权 | 授权码模式、客户端凭证模式 |
| Session Cookie | Web 前端 | 传统会话认证 |

第一阶段实现：API Key + JWT。

### 5.2 授权模型

基于角色的访问控制（RBAC）+ 细粒度权限：

```
User → Role(s) → Permission(s) → Resource/Action
```

- 权限格式：`{resource}:{action}`，如 `user:read`、`order:create`、`plugin:install`
- 角色是权限的集合
- Module/Plugin 可注册自定义权限

### 5.3 API 权限声明

路由元数据中声明所需权限：

```typescript
router.get('/users', {
  handler: UserController.index,
  permissions: ['user:read'],
  auth: true,
});
```

中间件在请求处理前检查认证和权限。

---

## 6. 限流

### 6.1 限流策略

| 维度 | 说明 | 默认值 |
|------|------|--------|
| 按 IP | 每个 IP 的请求频率 | 100 次/分钟 |
| 按 API Key | 每个 API Key 的请求频率 | 1000 次/分钟 |
| 按用户 | 每个认证用户的请求频率 | 可配置 |
| 按端点 | 特定端点的限流 | 可配置 |

### 6.2 限流响应

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1724313600
Retry-After: 60
```

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "请求过于频繁，请稍后再试",
    "request_id": "req_abc123"
  }
}
```

---

## 7. WebSocket（接口定义）

### 7.1 用途

- 实时数据推送（通知、聊天、实时更新）
- AI Agent 流式响应
- 实时协作

### 7.2 规范

- 连接路径：`/ws/{channel}`
- 认证：连接时通过查询参数 `token` 或握手时的 Authorization 头
- 消息格式：JSON，包含 `type`、`data`、`request_id`
- 心跳：客户端每 30 秒发送 ping，服务器回复 pong
- 重连：客户端实现指数退避重连

第一阶段：定义接口和协议，具体实现在后续阶段。

---

## 8. Webhook（接口定义）

### 8.1 用途

- 向第三方系统推送事件通知
- Plugin 可注册 Webhook 端点接收外部事件

### 8.2 出站 Webhook（TLL OS → 第三方）

```
事件发生 → Webhook Dispatcher → 查找订阅者 → 签名 → HTTP POST → 重试（失败时）
```

- 签名：`X-TLL-Signature: sha256=<hmac>`
- 重试：指数退避，最多 5 次
- 事件类型：`{module}.{event}` 或 `{plugin}.{event}`

### 8.3 入站 Webhook（第三方 → TLL OS）

- Plugin 可注册 Webhook 端点：`/webhook/{plugin}/{endpoint}`
- 请求经过 Plugin 的权限验证和签名验证
- 第一阶段：定义接口，具体实现在后续阶段

---

## 9. AI Agent 与 API System

### 9.1 Agent 如何知道 API 怎么使用

1. Agent 获取 OpenAPI 文档（`/api/docs.json`）
2. 解析端点、参数、认证方式、响应结构
3. 基于自然语言需求选择合适的端点
4. 生成并执行 API 调用
5. 解析响应，决定下一步

### 9.2 Agent 专属 API

TLL OS 提供 Agent 专用的 API 端点（需要 Agent 认证）：

| 端点 | 说明 |
|------|------|
| `GET /api/agent/modules` | 获取所有 Module 信息（含 AI 元数据） |
| `GET /api/agent/plugins` | 获取所有 Plugin 信息（含 ai_metadata） |
| `GET /api/agent/routes` | 获取所有路由信息 |
| `GET /api/agent/services` | 获取所有可调用服务 |
| `GET /api/agent/events` | 获取所有事件定义 |
| `GET /api/agent/commands` | 获取所有 CLI 命令 |
| `POST /api/agent/command` | 执行 CLI 命令（受限） |
| `POST /api/agent/test` | 运行测试 |
| `GET /api/agent/errors` | 获取最近的错误日志 |
| `POST /api/agent/fix` | 触发自动修复（需审批） |

这些端点让 AI Agent 能够理解 TLL OS 应用的完整结构，并通过标准接口操作应用。

---

## 10. API 测试

### 10.1 API 测试基类

TLL OS 提供 `ApiTestCase`，支持：

- 模拟 HTTP 请求（不需要启动真实服务器）
- 断言响应状态码、响应体、响应头
- 认证模拟（以特定用户/角色发送请求）
- 数据库事务回滚（测试后自动清理）

```typescript
class UserApiTest extends ApiTestCase {
  async testListUsers() {
    const response = await this.get('/api/v1/users', {
      auth: { userId: 1, roles: ['admin'] },
    });
    this.assertStatus(200);
    this.assertJsonStructure({ data: 'array', meta: 'object' });
  }
}
```

### 10.2 API 契约测试

- 验证 API 响应符合 OpenAPI Schema
- 验证破坏性变更检测（版本化规则）
- 验证认证和权限规则

---

## 11. 未实现与 TODO

第一阶段实现：
- [x] REST API 规范设计
- [x] 统一响应格式
- [x] API 版本化策略
- [x] OpenAPI 自动生成设计
- [x] 认证/授权设计
- [x] 限流设计
- [ ] WebSocket 接口定义
- [ ] Webhook 接口定义
- [ ] Agent 专属 API 设计

第二阶段实现：
1. REST API 最小实现（基于 HTTP Runtime + Router）
2. 统一响应中间件
3. 认证中间件（API Key + JWT）
4. 权限中间件
5. 限流中间件
6. OpenAPI 自动生成
7. API 测试基类
8. Agent 专属 API
9. WebSocket 实现
10. Webhook 实现
