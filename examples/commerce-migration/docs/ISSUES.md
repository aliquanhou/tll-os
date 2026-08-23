# TLL OS Commerce — 开发过程问题记录

> 版本: 0.2.0 (跨境 SaaS 升级) | 最后更新: 2026-08-22
> 分类: capability gap / API issue / Contract issue / TEP proposal / Runtime bug fixed / reusable pattern / app-specific

## 一、Capability Gaps（能力不足）

### CG-001: 无持久化存储
- **分类**: capability gap
- **描述**: Runtime 0.1 全部数据在内存 Map，Application 重启后数据丢失。跨境 SaaS 需要商户数据、订单历史、结算记录长期持久化。
- **影响**: 无法用于生产环境
- **当前替代**: 内存 Map + 种子数据重新加载
- **对应 TEP**: TEP-002 Persistence Storage Adapter

### CG-002: 无 HTTP Server
- **分类**: capability gap
- **描述**: Runtime 0.1 的 app.apis.request 是进程内调用，不监听端口。前端浏览器、第三方系统无法直接调用。
- **影响**: 每个项目需自行编写 HTTP 桥接
- **当前替代**: server.js 原生 http 桥接
- **对应 TEP**: TEP-001 HTTP Server Adapter

### CG-003: 无权限/RBAC 系统
- **分类**: capability gap
- **描述**: Runtime 0.1 无统一权限校验。跨境 SaaS 需要区分平台管理员、商户管理员、商户员工、买家等多级权限。
- **影响**: 安全隐患，admin API 可匿名访问
- **当前替代**: user.role 字段简化，部分 API 手动检查 token
- **对应 TEP**: TEP-006 RBAC Permission System

### CG-004: 无中间件机制
- **分类**: capability gap
- **描述**: API handler 是单一函数，无法统一注入鉴权、限流、CORS、日志、请求体校验等横切逻辑。
- **影响**: 代码重复，安全策略不一致
- **当前替代**: utils.js 提供 authUser() 等辅助函数，需手动调用
- **对应 TEP**: TEP-005 Middleware / Interceptor

### CG-005: 无事务支持
- **分类**: capability gap
- **描述**: 订单创建涉及多集合写入（orders/order_items/inventory/cart/coupons/settlements），中途失败可能数据不一致。跨境结算涉及资金流水，对事务要求更高。
- **影响**: 极端情况下数据不一致
- **当前替代**: 同步代码顺序执行，无回滚
- **对应 TEP**: TEP-002 (Storage Adapter 需提供事务)

### CG-006: 无并发控制
- **分类**: capability gap
- **描述**: 内存 Map 无锁，高并发下库存可能超卖。秒杀场景（Promotion 模块）对并发控制要求极高。
- **影响**: 库存超卖
- **当前替代**: 无
- **对应 TEP**: 新 TEP draft — Concurrency Control (见 TEP-DRAFT-001)

### CG-007: 无配置中心
- **分类**: capability gap
- **描述**: 跨境 SaaS 需要多环境配置（开发/测试/生产）、商户级配置（费率、结算周期、物流模板）、功能开关。
- **影响**: 配置硬编码，无法热更新
- **当前替代**: 模块内常量
- **对应 TEP**: TEP-007 Configuration Center

### CG-008: 无日志框架
- **分类**: capability gap
- **描述**: 生产环境需要结构化日志、请求追踪 ID、日志分级。跨境结算涉及资金，审计日志至关重要。
- **影响**: 排查困难，无法审计
- **当前替代**: console.log
- **对应 TEP**: TEP-008 Logging Framework

### CG-009: Graph 无边关系
- **分类**: capability gap
- **描述**: ApplicationGraph 只有节点没有边，无法可视化模块依赖、检测循环依赖、分析变更影响范围。SaaS 模块增多后（18+ Modules），依赖管理变得重要。
- **影响**: 架构不可视，依赖不可治理
- **当前替代**: 手动记录模块依赖
- **对应 TEP**: TEP-004 Graph Auto-Edges

### CG-010: 无定时任务/调度器
- **分类**: capability gap
- **描述**: 跨境 SaaS 需要定时任务：自动确认收货、结算单生成（月度/周度）、库存预警、促销活动上下架、订单超时取消。
- **影响**: 需外部 cron 或手动触发
- **当前替代**: 无（结算单手动生成）
- **对应 TEP**: 新 TEP draft — Scheduler / Cron (见 TEP-DRAFT-002)

### CG-011: 无 WebSocket/实时推送
- **分类**: capability gap
- **描述**: 商户后台需要实时订单通知、库存预警推送。买家需要订单状态变更实时通知。
- **影响**: 前端轮询，效率低
- **当前替代**: 前端轮询
- **对应 TEP**: TEP-010 WebSocket / Real-time

### CG-012: 无文件流式存储
- **分类**: capability gap
- **描述**: 跨境商品需要大量图片（主图、详情图、SKU 图），base64 存储导致内存暴涨。
- **影响**: 内存溢出风险
- **当前替代**: base64 内存存储，10MB 限制
- **对应 TEP**: 新 TEP draft — File Storage Adapter (见 TEP-DRAFT-003)

---

## 二、API Issues（API 设计不合理）

### AI-001: API 路径无命名空间隔离
- **分类**: API issue
- **描述**: 不同 Module 的 API 路径可能冲突。如 catalog 模块的 `/products` 和 storefront 模块的 `/storefront/products` 靠前缀区分，但 Module 注册时 Runtime 不做冲突检测。
- **建议**: Runtime 应在 Module 注册时自动添加命名空间前缀，或提供路径冲突检测。
- **状态**: 记录，待 TEP

### AI-002: Tool handler 无上下文参数
- **分类**: API issue
- **描述**: tool.handler(params) 只接收参数，无法获取当前 Application、Module、调用者信息。Agent 编排时需要知道调用来源（哪个 Tool 调用了哪个 Tool）。
- **建议**: handler 签名改为 (params, ctx)，ctx 含 application/module/caller/requestId。
- **状态**: 记录，待 TEP

### AI-003: 测试无 beforeEach/afterEach 钩子
- **分类**: API issue
- **描述**: TestRunner 只支持单个 test 函数，无 setup/teardown。测试间数据隔离困难——Agent 工作流运行后扣减了库存，导致后续库存测试基线不准。
- **建议**: 支持 test.beforeEach/test.afterEach，或测试运行前自动重置数据。
- **状态**: 已通过用 inventory.quantity 做基线规避，但根本问题未解决

### AI-004: API 响应无统一错误格式
- **分类**: API issue
- **描述**: 错误响应格式不统一。有的返回 {error: "message"}，有的返回 {message: "...", code: "..."}，500 错误直接返回异常堆栈。
- **建议**: 统一错误格式 {error: {code, message, details}}，生产环境不暴露堆栈。
- **状态**: 记录，Commerce 项目内已尽量统一

### AI-005: 列表 API 分页参数不统一
- **分类**: API issue
- **描述**: 有的 Module 用 page/pageSize，有的用 offset/limit，有的用 cursor。排序参数也不统一（sort/orderBy/sortBy）。
- **建议**: Protocol 应定义标准列表 API 契约：page, pageSize, sort, order, keyword, filters。
- **状态**: 记录，Commerce 项目内尽量统一为 page/pageSize

---

## 三、Contract Issues / TEP Proposals

### TEP-001 ~ TEP-010
详见 `proposals/` 目录下的 10 个正式 TEP 提案。

### TEP-DRAFT-001: Concurrency Control
- **分类**: TEP draft (新提案)
- **描述**: Runtime 需要提供并发控制原语（分布式锁、乐观锁、原子操作），支持秒杀、库存扣减等高并发场景。
- **触发场景**: Promotion 模块的限时秒杀需要原子库存扣减
- **状态**: Draft，待正式提交

### TEP-DRAFT-002: Scheduler / Cron
- **分类**: TEP draft (新提案)
- **描述**: Runtime 需要内置定时任务调度器，支持 cron 表达式、一次性延迟任务、任务重试、任务日志。
- **触发场景**: Settlement 模块需要月度自动结算、订单超时自动取消
- **状态**: Draft，待正式提交

### TEP-DRAFT-003: File Storage Adapter
- **分类**: TEP draft (新提案)
- **描述**: Runtime 需要文件存储 Adapter 规范，支持本地文件系统、S3/OSS、CDN，流式上传下载，大文件分片。
- **触发场景**: 跨境商品图片存储、结算报表导出
- **状态**: Draft，待正式提交

### TEP-DRAFT-004: Event Bus / Pub-Sub
- **分类**: TEP draft (新提案)
- **描述**: Runtime 需要事件总线，支持 Module 间解耦通信（订单支付成功 → 触发结算 → 触发库存扣减 → 触发通知）。当前用直接 API 调用，模块间耦合度高。
- **触发场景**: Order 模块支付成功后需要通知 Settlement、Inventory、Notification 多个模块
- **状态**: Draft，待正式提交

---

## 四、Runtime Bugs Fixed

### BUG-001: order.js addressId 未定义
- **分类**: Runtime bug fixed (Application 层 bug，非 Runtime 核心)
- **描述**: order.js 第 87 行，创建订单时 `addressId` 简写属性未定义，导致 ReferenceError。订单创建 500，支付测试失败，Agent E2E 失败。
- **修复**: 改为 `addressId: body.addressId`
- **影响范围**: 订单创建全链路
- **状态**: 已修复并验证

### BUG-002: 库存测试基线不准
- **分类**: Runtime bug fixed (测试隔离问题)
- **描述**: Agent 工作流在测试前运行，扣减了 sku.stock 但未同步 inventory.quantity，导致库存调整测试用 sku.stock 做基线时断言失败。
- **修复**: 改用 inventory.quantity 做基线，验证 inventory.quantity 和 sku.stock 都增加
- **根本原因**: TestRunner 无 beforeEach/afterEach（见 AI-003）
- **状态**: 已规避，根本问题待 TEP 解决

### BUG-003: tests/run-tests.js 导入路径错误
- **分类**: Runtime bug fixed (路径问题)
- **描述**: 从 tests/ 子目录导入 runtime public 层，路径应为 `../../../src/public/index.js`，误写为 `../../`。
- **修复**: 修正相对路径
- **状态**: 已修复

---

## 五、Reusable Patterns（可复用通用能力 — 应进入 Protocol）

以下是在 Commerce 开发过程中自然产生的、具有通用性的模式，建议未来进入 TLL OS Protocol 或 Runtime 核心：

### RP-001: 内存数据库模式 (CommerceDatabase)
- **分类**: reusable pattern
- **描述**: 用 Map 集合模拟关系型数据库，提供 CRUD/find/paginate/stats 统一接口，ID 自动生成带前缀。这个模式几乎适用于所有数据密集型 Application。
- **通用性**: 高 — 任何需要数据存储的 Application 都需要
- **建议**: 进入 Runtime 核心作为 MemoryStorage 默认实现（配合 TEP-002）

### RP-002: API 响应助手 (ok/created/notFound/badRequest)
- **分类**: reusable pattern
- **描述**: 统一的 API 响应格式助手函数，封装 {status, headers, body}。减少每个 handler 的样板代码。
- **通用性**: 高 — 所有有 API 的 Module 都需要
- **建议**: 进入 Runtime 核心，作为 ApiContext 的内置方法

### RP-003: Tool 响应助手 (toolSuccess/toolError)
- **分类**: reusable pattern
- **描述**: 统一的 Tool 响应格式，封装 {success, data, error}。
- **通用性**: 高
- **建议**: 进入 Runtime 核心，作为 ToolContext 的内置方法

### RP-004: 库存双写模式 (sku.stock + inventory.quantity/reserved)
- **分类**: reusable pattern
- **描述**: 展示库存（sku.stock）与实际库存（inventory.quantity）分离，支持预占（reserved）。下单预占、支付扣减、取消释放。这是电商库存管理的标准模式，但也适用于任何需要资源预占的场景（酒店预订、票务等）。
- **通用性**: 中高 — 适用于资源预占类应用
- **建议**: 可提炼为 Inventory Contract，进入 Protocol

### RP-005: 订单快照模式
- **分类**: reusable pattern
- **描述**: 订单创建时快照商品价格、SKU 信息、地址信息，不关联源表。保证历史订单不受后续商品变更影响。适用于任何交易类应用。
- **通用性**: 中高 — 交易类应用通用
- **建议**: 可提炼为 Order Contract 的一部分

### RP-006: BFF 聚合层模式 (storefront Module)
- **分类**: reusable pattern
- **描述**: 专门的前台聚合 Module，为前端减少请求次数，组合多个业务 Module 的数据。前端不直接调用业务 API，而是通过 BFF 层。
- **通用性**: 高 — 任何有前端的 Application 都需要 BFF
- **建议**: 进入 Protocol 作为推荐架构模式

### RP-007: Agent 工作流编排模式 (agent_full_shopping_flow)
- **分类**: reusable pattern
- **描述**: 一个 Tool 编排多个 Tool 调用，形成端到端工作流，每步记录状态和耗时。这是 Agent 化应用的核心模式。
- **通用性**: 高 — 任何 AI-Native Application 都需要
- **建议**: 进入 Runtime 核心，提供 Workflow/Agent 编排原语（新 TEP）

### RP-008: 会员自动升级模式
- **分类**: reusable pattern
- **描述**: 基于用户累计消费自动升级会员等级，享受折扣。适用于任何有会员体系的应用。
- **通用性**: 中 — 零售/服务类应用通用
- **建议**: 应用专属，暂不进入 Protocol

### RP-009: 结算分账模式 (Settlement)
- **分类**: reusable pattern
- **描述**: 多商户平台按周期生成结算单，扣除平台手续费后结算给商户。适用于任何平台型/SaaS 应用。
- **通用性**: 中 — 平台型应用通用
- **建议**: 可提炼为 Settlement Contract，进入 Protocol（平台型应用通用）

### RP-010: 跨境物流运费模板模式 (Shipping)
- **分类**: reusable pattern
- **描述**: 按物流区域（国家分组）+ 重量/金额阶梯计算运费，支持免费阈值、跨境关税。适用于任何跨境/多区域电商。
- **通用性**: 中 — 跨境电商通用
- **建议**: 应用专属，暂不进入 Protocol

---

## 六、App-Specific Logic（应用专属逻辑 — 留在 Application 内）

以下是 Commerce 专属、不具有通用性的逻辑，明确留在 Application 内：

1. **商品分类树结构** — 电商专属，其他类型应用不需要
2. **SKU 属性矩阵** — 电商专属
3. **优惠券规则** (fixed/percent/minAmount/maxDiscount) — 营销专属
4. **支付方式** (alipay/wechat/card/cod/balance) — 支付渠道专属
5. **B2B 阶梯报价** (10+/50+/100+ 折扣) — B2B 电商专属
6. **跨境关税计算** — 跨境电商专属
7. **商户费率配置** — SaaS 电商专属
8. **热销商品 TOP5** — 电商运营专属
9. **种子数据** (6 商品/13 SKU/3 用户) — 项目专属

---

## 七、关键发现：TLL OS 是否开始"自己长东西"？

**结论：是的，TLL OS 已经开始自然产生可复用的通用能力。**

证据：
1. **CommerceDatabase 模式** (RP-001) 在开发过程中自然形成，不是 Protocol 预先定义的，但它适用于所有数据密集型应用。这是 Agent 在实战中"长出来"的通用能力。
2. **API/Tool 响应助手** (RP-002, RP-003) 是为了减少重复代码自然产生的，本质上是 Runtime 应该提供的内置方法。
3. **BFF 聚合层** (RP-006) 是为了优化前端体验自然产生的架构模式，不是 Protocol 规定的，但具有通用性。
4. **Agent 工作流编排** (RP-007) 是为了验证端到端流程自然产生的，本质上是 AI-Native 应用的核心原语。
5. **4 个新 TEP draft** (Concurrency/Scheduler/FileStorage/EventBus) 都是在跨境 SaaS 深化过程中自然发现的能力缺口，不是预先规划的。

这验证了 TLL OS 的核心假设：**Protocol 不预先定义所有软件类型，而是提供一套允许 Agent 在实战中持续创造、组合、验证和演进应用的开发宇宙。Agent 在开发过程中自然产生的通用能力，通过 TEP 机制反馈到 Protocol，形成"应用生长 → 通用能力提炼 → Protocol 进化 → 更多应用生长"的无限循环。**

当前阶段：Agent-ready ✅（Agent 能独立开发完整应用），Production-ready ⏳（缺持久化/权限/并发等生产能力），Universal-ready ⏳（通用能力提炼和 Protocol 进化机制刚启动）。
