# TLL OS — Capability Contract

> **协议版本**: 2.0 | **契约状态**: beta | **所属模型**: 生态适配模型

---

## 一、Capability 是什么

Capability 是 TLL OS 应用对"我能做什么"的机器可理解声明。

Agent 不需要遍历所有 Module/Plugin/Adapter 来发现应用能做什么。它查询 Capability Registry，就能知道应用提供了哪些能力、每个能力由谁提供、依赖什么。

---

## 二、为什么需要 Capability

### 传统方式（没有 Capability）

```
Agent: "我要做跨境商城，这个应用有支付能力吗？"
  ↓
遍历所有 Module → 找到 payment Module → 看代码 → 确认支持 Stripe
  ↓
再遍历所有 Plugin → 找到 currency_conversion Plugin → 确认支持多币种
  ↓
耗时、易错、依赖代码阅读
```

### TLL OS 方式（有 Capability）

```
Agent: "我要做跨境商城，这个应用有支付能力吗？"
  ↓
查询 Capability Registry:
  - payment: provided by module:payment, supports Stripe/PayPal
  - multi_currency: provided by plugin:currency_conversion
  - shipping_calculation: NOT AVAILABLE
  ↓
立即知道有什么、缺什么、由谁提供
```

---

## 三、Capability 定义

### Capability Manifest

```yaml
name: payment
description: "Payment processing capability"
version: "1.0.0"
status: stable  # stable | beta | draft | deprecated

provided_by:
  type: module  # module | plugin | adapter
  id: module:payment

features:
  - name: credit_card
    description: "Credit card payment"
    supported: true
  - name: paypal
    description: "PayPal payment"
    supported: true
  - name: alipay
    description: "Alipay payment"
    supported: false

dependencies:
  - capability: authentication
  - capability: order_management

compatibility:
  platforms: [web, h5, apk]
  not_supported: [miniprogram]

metadata:
  category: commerce
  tags: [payment, checkout, ecommerce]
```

### Capability Graph 节点

Capability 在 Application Graph 中是一种节点类型：

```
GraphNode:
  type: "capability"
  name: "payment"
  capabilities: ["credit_card", "paypal"]
  metadata: { provided_by: "module:payment", category: "commerce" }
```

通过 `provides` 边与提供方关联：
```
module:payment --provides--> capability:payment
plugin:currency --provides--> capability:multi_currency
```

---

## 四、Capability Registry

Capability Registry 是应用中所有 Capability 的注册中心。

### Agent 可执行的操作

| 操作 | 说明 |
|------|------|
| `list()` | 列出所有 Capability |
| `get(name)` | 获取某个 Capability 详情 |
| `findByCategory(category)` | 按类别查找 |
| `findByProvider(providerId)` | 查找某个 Module/Plugin/Adapter 提供的 Capability |
| `check(name)` | 检查某个 Capability 是否可用 |
| `findMissing(required[])` | 检查缺少哪些必需的 Capability |

### Capability 组合

Agent 可以组合多个 Capability 来完成复杂任务：

```
任务: "搭建跨境商城"
  ↓
需要 Capability:
  - product_catalog ✓ (module:catalog)
  - payment ✓ (module:payment)
  - shopping_cart ✓ (module:cart)
  - order_management ✓ (module:order)
  - multi_currency ✓ (plugin:currency)
  - international_shipping ✗ (MISSING)
  ↓
Agent 发现缺少 international_shipping
  ↓
查询 Adapter: 有没有 Shopify/Shopware 的 shipping Adapter？
  ↓
安装 Adapter 或创建 Module
```

---

## 五、Capability 与 Module/Plugin/Adapter 的关系

```
Capability（能力声明）
     ↑ provides
     │
┌────┼────┐
↓    ↓    ↓
Module Plugin Adapter
(原生) (第三方) (外部系统)
```

- **Module** 提供原生能力（如 module:payment 提供 payment capability）
- **Plugin** 提供扩展能力（如 plugin:seo 提供 seo capability）
- **Adapter** 提供外部系统能力（如 adapter:shopify 提供 product_catalog capability，映射自 Shopify）

同一个 Capability 可以由多个提供方提供，Agent 可以选择使用哪个。

---

## 六、Capability 与 BuildTarget

每个 Capability 声明它支持哪些 BuildTarget：

```yaml
name: file_upload
compatibility:
  platforms: [web, h5, apk, exe]
  not_supported: [ai_agent, miniprogram]  # Headless Agent 没有文件系统
```

Agent 在选择 BuildTarget 时，检查所有必需 Capability 是否在该目标上可用。

---

## 七、第一阶段实现范围

Protocol 2.0 定义 Capability Contract。Runtime 0.x 实现：
- Capability Manifest 格式
- Capability Registry 的查询接口
- Graph 中 capability 节点和 provides 边
- Agent 通过 Graph 查询 Capability

复杂的 Capability 组合优化、冲突检测、动态加载留到后续版本。
