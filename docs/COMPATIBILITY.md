# TLL OS — Compatibility Manifest Contract

> **协议版本**: 2.0 | **契约状态**: beta | **所属模型**: 生态适配模型

---

## 一、Compatibility Manifest 是什么

Compatibility Manifest 是 Adapter 对外部系统兼容性的结构化声明。它告诉 Agent 和开发者：

- 这个 Adapter 支持哪个外部系统的哪个版本
- 哪些能力可以映射到 TLL OS，哪些不能
- 迁移成本如何
- 有哪些依赖和限制
- 兼容等级是什么

---

## 二、为什么需要 Compatibility Manifest

没有 Compatibility Manifest 时：
```
Agent: "我要从 Shopify 迁移到 TLL OS"
  ↓
读 Adapter 代码 → 发现支持 Product 映射 → 不确定 Order 是否支持
  ↓
试迁移 → 发现 Customer 不支持 → 回滚
  ↓
耗时、试错、不可预测
```

有 Compatibility Manifest 时：
```
Agent: "我要从 Shopify 迁移到 TLL OS"
  ↓
读 Compatibility Manifest:
  - Product: full support (双向映射)
  - Order: partial (只读，不支持退款状态)
  - Customer: not supported (需要手动迁移)
  - 迁移成本: medium (预计 4-8 小时)
  ↓
Agent 提前知道范围和成本，制定迁移计划
```

---

## 三、Compatibility Manifest 格式

```yaml
# Adapter 基本信息
adapter:
  name: shopify-adapter
  version: "1.0.0"
  author: tll-os-community
  license: MIT

# 外部系统信息
external_system:
  name: Shopify
  versions: ["2024-01", "2024-04", "2024-07"]  # 支持的 API 版本
  api_type: REST  # REST | GraphQL | SOAP | SDK | Database
  authentication: OAuth2  # OAuth2 | APIKey | BasicAuth | None

# 能力映射
capability_mapping:
  - external: Product
    tll_capability: product_catalog
    tll_node_type: model
    support_level: full  # full | partial | read_only | not_supported
    notes: "支持标准 Product 字段，Metafield 映射为 metadata"
    limitations: []

  - external: Order
    tll_capability: order_management
    tll_node_type: model
    support_level: partial
    notes: "支持订单基本信息，退款状态不支持双向同步"
    limitations:
      - "refund_status: 只读"
      - "fulfillment: 不支持部分发货"

  - external: Customer
    tll_capability: customer_management
    tll_node_type: model
    support_level: not_supported
    notes: "Customer 数据需要手动迁移，建议使用 CSV 导入"
    limitations: []

  - external: Collection
    tll_capability: category_management
    tll_node_type: model
    support_level: read_only
    notes: "只读 Collection 数据，不支持写回 Shopify"
    limitations: []

# 迁移评估
migration:
  estimated_effort: medium  # low | medium | high | extreme
  estimated_hours: "4-8"
  complexity: medium
  risk_level: medium
  prerequisites:
    - "Shopify API 凭证"
    - "TLL OS product_catalog capability 已安装"
  recommended_order:
    - "1. 迁移 Product"
    - "2. 迁移 Collection"
    - "3. 迁移 Order（只读）"
    - "4. 手动迁移 Customer"
  known_issues:
    - "Product Metafield 超过 100 个时可能丢失部分字段"
    - "Order 退款状态无法同步"

# 依赖
dependencies:
  tll_os_version: ">=2.0.0"
  runtime_version: ">=0.2.0"
  required_capabilities:
    - product_catalog
  optional_capabilities:
    - order_management
  external_dependencies:
    - "Shopify Admin API access"

# 兼容等级
compatibility_level: production  # production | beta | experimental | deprecated

# 测试状态
tested:
  unit_tests: true
  integration_tests: true
  e2e_tests: false
  tested_versions: ["2024-01", "2024-04"]
```

---

## 四、支持等级定义

| 等级 | 说明 |
|------|------|
| `full` | 完整双向映射，所有字段支持读写 |
| `partial` | 部分支持，有明确的限制列表 |
| `read_only` | 只能从外部系统读取，不能写回 |
| `not_supported` | 不支持，需要手动处理或使用其他方式 |

---

## 五、兼容等级定义

| 等级 | 说明 |
|------|------|
| `production` | 经过生产验证，可用于生产环境 |
| `beta` | 功能完整但未经充分生产验证 |
| `experimental` | 实验性，可能有重大变更 |
| `deprecated` | 已废弃，不建议使用 |

---

## 六、Agent 如何使用 Compatibility Manifest

### 场景 1：选择 Adapter

```
Agent: "我要连接 Shopify"
  ↓
查询 Adapter Registry → 找到 shopify-adapter
  ↓
读取 Compatibility Manifest:
  - compatibility_level: production ✓
  - required_capabilities: [product_catalog] ✓ (已安装)
  - 支持的版本: ["2024-01", "2024-04", "2024-07"]
  ↓
确认可用，配置连接
```

### 场景 2：迁移规划

```
Agent: "我要从 Shopify 迁移到原生 TLL OS Module"
  ↓
读取 Compatibility Manifest 的 migration 部分:
  - estimated_effort: medium (4-8小时)
  - recommended_order: Product → Collection → Order → Customer(手动)
  - known_issues: [...]
  ↓
制定迁移计划，按顺序执行
```

### 场景 3：能力缺口分析

```
Agent: "这个应用需要 multi_currency 能力"
  ↓
查询 Capability Registry → 未找到
  ↓
查询 Adapter Registry → 找到 shopify-adapter 提供 multi_currency
  ↓
读取 Compatibility Manifest:
  - external: Currency
  - support_level: read_only
  ↓
Agent 知道可以通过 Adapter 获取汇率数据（只读），
如果需要写回则需要其他方案
```

---

## 七、第一阶段实现范围

Protocol 2.0 定义 Compatibility Manifest 格式。Runtime 0.x 实现：
- Manifest 的 YAML/JSON 解析和验证
- Adapter Registry 中的 Manifest 查询
- Agent 通过标准接口读取 Manifest
- 支持等级和兼容等级的枚举定义

Manifest 的自动生成、兼容性自动验证留到后续版本。
