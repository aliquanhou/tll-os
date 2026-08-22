# TLL OS Security 设计

> 文档：SECURITY.md
> 版本：0.1.0-blueprint
> 战略修正：Security 是 TLL OS 的基础层。认证/加密可复用成熟库，但 Permission Contract（含 AI Agent 权限）是 TLL OS 必须自研的核心标准之一。Plugin 沙箱和 AI 操作安全是 TLL OS 超越传统框架的安全设计重点。

---

## 1. Security 概述

TLL OS Security 提供完整的安全体系，覆盖认证、授权、加密、防护、审计、Plugin 沙箱、AI Agent 安全。

### 1.1 设计原则

1. **默认安全**：安全选项默认启用，而非可选
2. **最小权限**：所有主体（用户、服务、Plugin、Agent）默认无权限，需显式授予
3. **纵深防御**：多层安全控制，一层被突破仍有后续防护
4. **可审计**：所有敏感操作记录审计日志
5. **AI 安全**：AI Agent 的操作必须经过权限检查和审批机制

### 1.2 安全层次

```
┌─────────────────────────────────────────┐
│  Network Layer (HTTPS, CORS, Rate Limit)│
├─────────────────────────────────────────┤
│  Authentication (API Key, JWT, Session) │
├─────────────────────────────────────────┤
│  Authorization (RBAC + Permission)       │
├─────────────────────────────────────────┤
│  Application Security (CSRF, XSS, SQLi) │
├─────────────────────────────────────────┤
│  Plugin Sandbox (权限隔离, 资源限制)     │
├─────────────────────────────────────────┤
│  AI Agent Security (权限, 审批, 审计)    │
├─────────────────────────────────────────┤
│  Data Security (加密, 脱敏, 备份)        │
├─────────────────────────────────────────┤
│  Audit & Monitoring (日志, 告警, 追踪)   │
└─────────────────────────────────────────┘
```

---

## 2. 认证 (Authentication)

### 2.1 认证方式

| 方式 | 适用场景 | 说明 |
|------|----------|------|
| API Key | 服务端到服务端 | 静态密钥，简单安全 |
| JWT | 用户认证 | 无状态令牌，含用户信息和权限 |
| Session Cookie | Web 前端 | 传统会话，服务端存储 |
| OAuth 2.0 | 第三方授权 | 授权码、客户端凭证模式 |
| mTLS | 高安全服务间通信 | 双向证书认证 |

第一阶段实现：API Key + JWT。

### 2.2 API Key

- 格式：`tll_sk_<32字节随机数>`（服务端密钥）/ `tll_pk_<32字节随机数>`（公开密钥）
- 存储：哈希后存储（SHA-256），不存明文
- 传递：`Authorization: ApiKey <key>` 或 `X-API-Key: <key>`
- 权限：每个 API Key 关联权限集，可限制可访问的端点和操作
- 轮换：支持密钥轮换，旧密钥有过渡期

### 2.3 JWT

- 算法：RS256（非对称，推荐）或 HS256（对称）
- 结构：Header.Payload.Signature
- Payload 包含：`sub`（用户ID）、`roles`、`permissions`、`exp`、`iat`、`iss`、`aud`
- 刷新：Access Token（短期，15分钟）+ Refresh Token（长期，7天）
- 吊销：支持令牌黑名单（Redis 或数据库）

### 2.4 Auth Manager 接口

```typescript
interface AuthManager {
  // 认证
  authenticate(request: Request): Promise<AuthResult>;
  login(credentials: Credentials): Promise<TokenPair>;
  logout(token: string): Promise<void>;
  refresh(refreshToken: string): Promise<TokenPair>;

  // API Key
  createApiKey(name: string, permissions: string[], expiresAt?: Date): Promise<ApiKey>;
  revokeApiKey(id: string): Promise<void>;
  validateApiKey(key: string): Promise<AuthResult | null>;

  // JWT
  issueToken(user: AuthUser): TokenPair;
  verifyToken(token: string): AuthResult | null;
  revokeToken(token: string): void;
}

interface AuthResult {
  authenticated: boolean;
  user?: AuthUser;
  permissions: PermissionSet;
  tokenType: 'api-key' | 'jwt' | 'session' | 'anonymous';
  error?: string;
}

interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  metadata: Record<string, unknown>;
}
```

---

## 3. 授权 (Authorization)

### 3.1 权限模型

基于角色的访问控制（RBAC）+ 细粒度权限：

```
Subject (User/Service/Plugin/Agent)
    ↓
Role(s) → Permission(s) → Resource:Action
```

### 3.2 权限格式

```
{resource}:{action}
```

示例：
- `user:read`、`user:create`、`user:update`、`user:delete`
- `module:read`、`module:create`、`module:update`
- `plugin:read`、`plugin:install`、`plugin:manage`
- `database:read`、`database:write`、`database:migrate`
- `file:read`、`file:write`
- `command:execute`
- `test:run`
- `system:fix`（自动修复，高敏感）

通配符：`*` 表示所有权限，`user:*` 表示用户资源的所有操作。

### 3.3 内置角色

| 角色 | 权限 | 说明 |
|------|------|------|
| `super-admin` | `*` | 超级管理员，所有权限 |
| `admin` | 大部分管理权限 | 应用管理员 |
| `developer` | 代码、测试、Module/Plugin 管理 | 开发者 |
| `operator` | 部署、监控、日志 | 运维 |
| `api-user` | API 访问 | API 使用者 |
| `viewer` | 只读 | 只读用户 |
| `agent:developer` | Agent 开发权限（受限） | AI Developer Agent |
| `agent:support` | Agent 客服权限（受限） | AI Support Agent |
| `anonymous` | 公开端点访问 | 未认证用户 |

### 3.4 Authorization Manager 接口

```typescript
interface AuthorizationManager {
  // 权限检查
  can(subject: Subject, permission: string, resource?: string): boolean;
  canAny(subject: Subject, permissions: string[]): boolean;
  canAll(subject: Subject, permissions: string[]): boolean;
  require(subject: Subject, permission: string): void;  // 不满足则抛出异常

  // 角色管理
  assignRole(subjectId: string, role: string): void;
  revokeRole(subjectId: string, role: string): void;
  getRoles(subjectId: string): string[];

  // 权限管理
  grantPermission(subjectId: string, permission: string): void;
  revokePermission(subjectId: string, permission: string): void;
  getPermissions(subject: Subject): PermissionSet;

  // 角色定义
  defineRole(name: string, permissions: string[], description?: string): void;
  listRoles(): RoleDefinition[];
}

interface Subject {
  type: 'user' | 'service' | 'plugin' | 'agent';
  id: string;
  roles: string[];
  permissions: string[];
}
```

### 3.5 路由级授权

路由元数据中声明权限要求，中间件自动检查：

```typescript
router.delete('/users/:id', {
  handler: UserController.destroy,
  permissions: ['user:delete'],
  auth: true,
});
```

---

## 4. 应用安全

### 4.1 CSRF 防护

- 状态变更请求（POST/PUT/PATCH/DELETE）需要 CSRF Token
- Token 存储在 Session 或 Cookie 中，请求时通过 Header 或表单字段传递
- API Key/JWT 认证的请求默认豁免 CSRF（使用 Authorization 头而非 Cookie）

### 4.2 XSS 防护

- 输出自动转义（模板引擎层面）
- Content-Security-Policy 响应头
- 禁止内联脚本（CSP `script-src 'self'`）

### 4.3 SQL 注入防护

- 使用参数化查询（ORM/查询构建器层面）
- 禁止拼接 SQL 字符串
- 输入验证和类型转换

### 4.4 CORS

- 可配置的允许源列表
- 支持凭证（Credentials）
- 可配置的允许方法和头
- 预检请求缓存

### 4.5 安全响应头

| 头 | 值 | 说明 |
|----|-----|------|
| `X-Content-Type-Options` | `nosniff` | 禁止 MIME 嗅探 |
| `X-Frame-Options` | `DENY` / `SAMEORIGIN` | 防止点击劫持 |
| `X-XSS-Protection` | `1; mode=block` | XSS 过滤 |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | 强制 HTTPS |
| `Content-Security-Policy` | 可配置 | 内容安全策略 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 引用策略 |

---

## 5. 数据安全

### 5.1 加密

- **传输加密**：HTTPS/TLS 1.2+
- **存储加密**：敏感字段（密码、API Key、密钥）加密存储
- **密码哈希**：bcrypt（cost factor 12）或 Argon2id
- **加密服务**：提供 `EncryptionService` 接口，支持 AES-256-GCM

### 5.2 数据脱敏

- 日志中自动脱敏敏感字段（密码、token、信用卡号、身份证号）
- API 响应中可配置字段脱敏
- 审计日志中保留必要信息但脱敏敏感数据

### 5.3 备份与恢复

- 数据库定期备份（可配置策略）
- 加密备份存储
- 恢复测试流程

---

## 6. Plugin 沙箱

### 6.1 安全边界

Plugin 是第三方代码，必须有严格的安全边界：

1. **权限声明**：Plugin 在 Manifest 中声明所需权限，未声明的权限不可用
2. **权限验证**：Plugin 的所有 Kernel 操作经过 Permission Guard
3. **依赖隔离**：Plugin 的 npm 依赖安装在独立目录，不污染全局
4. **网络限制**：Plugin 只能访问 Manifest 中声明的网络域名
5. **文件系统限制**：Plugin 只能读写 Manifest 中声明的路径
6. **审计日志**：Plugin 的敏感操作全部记录

### 6.2 沙箱实现策略

| 阶段 | 策略 | 说明 |
|------|------|------|
| 第一阶段 | 权限声明 + Permission Guard | 逻辑层面的权限控制 |
| 第二阶段 | Module 隔离 + 受限 Container | Plugin 使用独立的 Container 命名空间 |
| 第三阶段 | VM 上下文隔离 | 使用 Node.js `vm` 模块或 Worker Threads 隔离执行 |
| 后续 | 进程级隔离 | Plugin 运行在独立子进程中，通过 IPC 通信 |

### 6.3 Plugin 权限类别

详见 `PLUGINS.md` 第 5 节。

---

## 7. AI Agent 安全

### 7.1 安全挑战

AI Agent 操作 TLL OS 带来独特的安全挑战：
1. Agent 可能执行破坏性操作（删除数据、修改代码、安装恶意 Plugin）
2. Agent 可能被 Prompt Injection 攻击
3. Agent 的决策过程不透明，难以预测
4. Agent 可能越权操作

### 7.2 安全机制

#### 7.2.1 权限控制

- Agent 有独立的权限集，不继承用户的全部权限
- Agent 角色（`agent:developer`、`agent:support`）有预定义的受限权限
- Agent 调用 Tool 时经过 Permission Guard 检查
- 高敏感操作需要额外审批

#### 7.2.2 人工审批

以下操作默认需要人工审批：
- `plugin:install` / `plugin:uninstall`
- `database:write`（修改/删除数据）
- `file:write`（修改源代码）
- `system:fix`（自动修复）
- `command:execute`（执行系统命令）
- 涉及金额的操作

审批方式：
- CLI 交互确认
- HTTP 回调（Webhook 通知审批）
- 预配置的自动审批规则（CI/CD 环境，限定范围）

#### 7.2.3 操作审计

- Agent 的所有 Tool 调用记录审计日志
- 审计日志包含：Agent ID、Tool 名称、参数、结果、时间、权限检查结果
- 审计日志不可篡改（追加写入，哈希链）
- 支持审计日志查询和导出

#### 7.2.4 Prompt Injection 防护

- 系统提示词与用户输入严格分离
- Tool 结果标记为不可信数据
- 敏感操作不依赖纯文本指令，需要结构化确认
- Agent 的系统提示词包含安全约束

#### 7.2.5 操作回滚

- Agent 的文件修改操作支持 Git 版本控制，可回滚
- 数据库操作支持事务，失败时回滚
- Plugin 安装支持卸载和回滚
- 关键操作前自动创建快照

### 7.3 AI Permission Guard 接口

```typescript
interface AiPermissionGuard {
  checkToolCall(agent: Agent, tool: Tool, args: ToolArgs): PermissionCheckResult;
  checkOperation(agent: Agent, operation: string, resource: string): boolean;
  requiresApproval(agent: Agent, tool: Tool, args: ToolArgs): boolean;
  requestApproval(agent: Agent, tool: Tool, args: ToolArgs): Promise<ApprovalResult>;
  logAudit(agent: Agent, tool: Tool, args: ToolArgs, result: ToolResult): void;
}

interface ApprovalResult {
  approved: boolean;
  approver?: string;
  reason?: string;
  timestamp: number;
}
```

---

## 8. 审计与监控

### 8.1 审计日志

所有敏感操作记录审计日志：

```typescript
interface AuditLog {
  id: string;
  timestamp: number;
  actor: {
    type: 'user' | 'service' | 'plugin' | 'agent' | 'system';
    id: string;
    name?: string;
  };
  action: string;           // 操作类型，如 "user.delete"、"plugin.install"
  resource: string;         // 操作对象，如 "user:123"、"plugin:payment-stripe"
  result: 'success' | 'failure' | 'pending';
  ip?: string;
  userAgent?: string;
  requestId?: string;
  details?: Record<string, unknown>;
  previousState?: unknown;   // 操作前状态（用于回滚）
  newState?: unknown;        // 操作后状态
}
```

### 8.2 安全事件

可配置的安全事件告警：
- 多次认证失败（暴力破解检测）
- 异常权限提升
- 敏感数据批量导出
- Plugin 安装/卸载
- AI Agent 执行高敏感操作
- 审计日志篡改检测

### 8.3 安全扫描

- 依赖漏洞扫描（npm audit）
- Plugin 安全扫描（安装前自动扫描）
- 配置安全检查（`tll doctor` 中的安全项）

---

## 9. 安全配置

```typescript
// config/security.ts
export default {
  auth: {
    default: 'jwt',
    apiKey: { enabled: true, header: 'X-API-Key' },
    jwt: {
      enabled: true,
      algorithm: 'RS256',
      accessTokenTtl: '15m',
      refreshTokenTtl: '7d',
      issuer: 'tll-os',
    },
    session: { enabled: false },
  },
  authorization: {
    defaultRoles: ['viewer'],
    superAdminRole: 'super-admin',
  },
  cors: {
    enabled: true,
    origins: ['https://example.com'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
  csrf: { enabled: true, except: ['api'] },
  rateLimit: {
    enabled: true,
    windowMs: 60000,
    max: 100,
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    key: env('APP_KEY'),
  },
  password: {
    algorithm: 'bcrypt',
    rounds: 12,
  },
  plugin: {
    sandbox: true,
    requireSignature: false,  // 后续阶段启用
    autoScan: true,
  },
  ai: {
    requireApproval: ['plugin:install', 'database:write', 'file:write', 'system:fix'],
    auditAllActions: true,
    maxSteps: 50,
  },
  headers: {
    xContentTypeOptions: 'nosniff',
    xFrameOptions: 'SAMEORIGIN',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  },
};
```

---

## 10. 未实现与 TODO

第一阶段（蓝图阶段）Security 为**完整的设计文档 + 接口定义**。

第二阶段实现优先级：
1. AuthManager（API Key + JWT）
2. AuthorizationManager（RBAC + 权限检查）
3. 认证中间件
4. 授权中间件
5. CORS 中间件
6. 安全响应头中间件
7. 限流中间件
8. CSRF 防护
9. EncryptionService
10. 密码哈希
11. Plugin Permission Guard
12. AI Permission Guard（基础权限检查 + 审批机制）
13. 审计日志
14. `tll doctor` 安全检查项

后续阶段：
- Plugin VM 沙箱
- Plugin 签名验证
- 安全事件告警
- 自动安全扫描
- 数据脱敏
- mTLS 支持
