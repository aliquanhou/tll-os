# TLL OS — Adapter Contract

> **协议版本**: 2.0 | **契约状态**: beta | **所属模型**: 生态适配模型

---

## 一、Adapter 是什么

Adapter 是 TLL OS 连接外部系统的桥梁。它将外部系统的概念映射到 Application Graph，也可以将 Graph 节点写入外部系统。

Adapter **不包含业务逻辑**，只做数据映射、连接管理和同步。

---

## 二、Adapter 与 Module/Plugin 的区别

| 概念 | 本质 | 生命周期 | 示例 |
|------|------|----------|------|
| **Module** | 原生业务逻辑，随应用发布 | 随应用 | 博客模块、用户模块 |
| **Plugin** | 运行时安装的第三方扩展 | 安装/启用/禁用/卸载 | SEO 插件、分析插件 |
| **Adapter** | 连接外部系统，映射数据 | 配置/连接/同步/断开 | Shopify Adapter、WordPress Adapter |

Adapter 可以实现为 Plugin（运行时安装），但概念上它是独立的一等概念。

---

## 三、Adapter 能力

| 能力 | 说明 |
|------|------|
| `read` | 从外部系统读取数据，映射为 Graph 节点 |
| `write` | 将 Graph 节点写入外部系统 |
| `sync` | 双向同步，处理冲突 |
| `migrate` | 从外部系统迁移到原生 Module（最有价值的能力） |

每个 Adapter 在 Manifest 中声明它支持哪些能力。

---

## 四、Adapter Manifest

```yaml
name: shopify-adapter
version: "1.0.0"
description: "Connect TLL OS to Shopify"
author: tll-os-community
license: MIT

# 外部系统
external_system:
  name: Shopify
  api_type: GraphQL
  base_url: "https://{store}.myshopify.com/admin/api"

# 支持的能力
capabilities: [read, write, sync, migrate]

# 实体映射
entity_mappings:
  - external: Product
    tll_node_type: model
    tll_model_name: Product
    field_mappings:
      - external: id
        tll: externalId
      - external: title
        tll: name
      - external: variants
        tll: skus
        transform: "array_map"
    unsupported_fields:
      - metafields_global

  - external: Order
    tll_node_type: model
    tll_model_name: Order
    field_mappings: [...]

# 配置 Schema（Zod 格式或 JSON Schema）
config_schema:
  type: object
  required: [store_name, access_token]
  properties:
    store_name: { type: string }
    access_token: { type: string, secret: true }
    api_version: { type: string, default: "2024-07" }

# 权限
permissions:
  - "shopify:read_products"
  - "shopify:write_orders"

# 兼容性（引用 Compatibility Manifest）
compatibility_manifest: ./compatibility.yaml
```

---

## 五、Adapter 生命周期

```
configure → connect → read/write/sync/migrate → disconnect
```

| 阶段 | 说明 |
|------|------|
| `configure` | 验证配置，建立连接参数 |
| `connect` | 连接外部系统，验证凭证 |
| `read` | 读取外部数据，映射为 Graph 节点 |
| `write` | 将 Graph 节点写入外部系统 |
| `sync` | 双向同步，冲突解决 |
| `migrate` | 迁移到原生 Module（生成 Module 代码 + 数据） |
| `disconnect` | 断开连接，清理资源 |
| `healthCheck` | 检查连接状态 |

---

## 六、迁移是一等操作

Adapter 最重要的能力不是"连接 Shopify"，而是**"从 Shopify 迁移到 TLL OS 原生 Module"**。

迁移流程：

```
1. Adapter 读取外部系统数据，映射为 Graph 节点
2. Agent 分析 Graph，生成原生 Module 代码投影
3. 运行测试验证数据一致性
4. 切换流量到原生 Module
5. 断开 Adapter
```

这使得 TLL OS 可以吸收任何成熟系统的数据和业务逻辑，而不是重新发明。

---

## 七、优先 Adapter

| 优先级 | Adapter | 理由 |
|--------|---------|------|
| P0 | Shopify | 电商事实标准，最大迁移来源 |
| P0 | WordPress | CMS 事实标准，最大内容迁移来源 |
| P1 | Medusa | 开源电商，TypeScript 技术栈接近 |
| P1 | Strapi | 开源 CMS，TypeScript |
| P2 | Shopware / Bagisto / Aimeos | 其他电商系统 |
| P2 | Odoo / ERPNext | ERP 系统 |

---

## 八、第一阶段实现范围

Protocol 2.0 定义 Adapter Contract。Runtime 0.x 实现：
- Adapter Manifest 格式和验证
- Adapter 生命周期接口（configure/connect/read/write/disconnect/healthCheck）
- 实体映射的基本机制
- Adapter Registry（发现和查询 Adapter）
- Shopify Adapter 作为参考实现（只读 + 迁移）

双向同步、冲突解决、复杂字段转换留到后续版本。
