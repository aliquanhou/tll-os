# TLL OS Commerce — 架构决策文档

> 版本: 0.1.0 | 日期: 2026-08-22 | 作者: TLL OS 外部开发 Agent

## 1. 概述

TLL OS Commerce 是基于 TLL OS Runtime 0.1 构建的独立电商平台，作为 TLL OS 的"成人礼"实战项目。

**核心约束**: 全程仅依赖 TLL OS Public Contract，未修改 Protocol 2.0，未修改 Runtime 核心代码。

## 2. Module 拆分

采用业务域边界驱动拆分，12 个 Module:

1. commerce-catalog — 商品/SKU/分类/品牌/库存
2. commerce-customer — 用户/地址/会员
3. commerce-cart — 购物车
4. commerce-order — 订单
5. commerce-payment — 支付
6. commerce-marketing — 优惠券
7. commerce-locale — 多语言/多币种
8. commerce-b2b — 企业/批量报价
9. commerce-file — 文件
10. commerce-admin — 后台管理
11. commerce-agent — Agent 编排
12. commerce-storefront — 前台 BFF

## 3. API 设计

RESTful + BFF 分层。storefront 聚合层 → 业务 Module 原子层 → 内存数据库。

关键 API: POST /orders（库存预占+金额计算+优惠券）、POST /payment/notify（支付回调+库存扣减）、POST /b2b/quote（阶梯折扣+信用额度）。

## 4. 数据模型

21 个内存 Map 集合，关系型设计，ID 前缀规范。库存双写（sku.stock + inventory.quantity/reserved），订单快照冗余。

## 5. Agent/Tool

25 个 Tool，agent_full_shopping_flow 编排 8 步: 搜索→详情→登录→加购→地址→下单→支付→查单。

## 6. 前端

纯 HTML/CSS/JS，移动端优先，6 页面，js/api.js 统一封装。

## 7. HTTP 桥接

server.js 原生 http，静态服务 + /api/* 代理。

## 8. 测试

26 个测试，每 Module 自带，黑盒测试。

## 9. TEP 提案

10 个: HTTP Adapter、Persistence Adapter、CLI、Graph Auto-Edges、Middleware、RBAC、Config Center、Logging、Health Check、WebSocket。

## 10. 技术债务

无持久化、无权限、无并发、无事务、Graph 无边、支付 mock。
