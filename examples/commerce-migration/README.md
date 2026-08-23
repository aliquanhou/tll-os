# TLL OS Commerce

> 基于 TLL OS Runtime 0.1 构建的独立电商平台 — TLL OS 的"成人礼"实战项目

TLL OS Commerce 是一个完整可运行的独立商城，验证了外部 Agent 仅依赖 TLL OS 公开协议就能构建真实应用的可行性。

## 特性

- **12 个业务 Module**: 商品/SKU/分类/品牌/库存、用户/地址/会员、购物车、订单、支付、优惠券、多语言/多币种、B2B、文件、后台管理、Agent 编排、前台 BFF
- **72 个 API**: RESTful 风格，覆盖全部业务操作
- **25 个 Tool**: 供 Agent 调用的原子业务工具
- **26 个测试**: 全链路自动化测试
- **6 个 H5 页面**: 商品列表、商品详情、购物车、结算、订单、后台管理
- **Agent 端到端工作流**: 搜索→加购→下单→支付→查单，8 步全自动
- **B2C + B2B**: 支持零售和企业采购（阶梯价、信用额度、账期）
- **多语言多币种**: 8 种语言、8 种货币

## 快速开始

```bash
cd examples/commerce

# 运行完整验证（Agent 工作流 + 测试）
node agent.js

# 启动 HTTP 服务器
node server.js
# 访问 http://localhost:3000
```

## 测试账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | admin@tllcommerce.com | admin123 |
| 普通客户 | customer@example.com | customer123 |
| B2B 客户 | b2b@company.com | b2b123 |

## Docker

```bash
docker build -t tll-commerce:0.1.0 .
docker run -d -p 3000:3000 tll-commerce:0.1.0
```

## 文档

- [架构决策文档](docs/ARCHITECTURE.md)
- [部署说明](docs/DEPLOYMENT.md)
- [最终报告](docs/FINAL-REPORT.md)
- [TEP 提案](proposals/)

## 技术栈

- **Runtime**: TLL OS Runtime 0.1（内存实现）
- **语言**: JavaScript (ESM)
- **前端**: 纯 HTML/CSS/JS（无框架）
- **HTTP**: Node 原生 http 模块
- **数据库**: 内存 Map（21 个集合）
- **零依赖**: 无第三方 npm 包

## License

MIT
