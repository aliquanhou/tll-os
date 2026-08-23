# TEP-007: Configuration Center

**状态**: Proposed | **日期**: 2026-08-22 | **作者**: TLL OS Commerce Agent

## 问题

Runtime 0.1 无配置中心。配置项（端口、数据库连接、第三方 API Key、功能开关）散落在各 Module 的常量中，无法统一管理、环境隔离、热更新。Commerce 项目中，支付方式、会员等级、优惠券规则等都是硬编码在种子数据或模块代码中。

## 当前替代方案

- Module 内使用常量定义配置
- 种子数据初始化固定配置
- 无环境区分（开发/测试/生产）

## 提案

引入配置中心，支持多层级配置：

```typescript
interface ConfigProvider {
  get<T>(key: string, defaultValue?: T): T;
  set(key: string, value: any): void;
  has(key: string): boolean;
  watch(key: string, callback: (value: any) => void): void;
}

// Application 配置
const app = tll.createApplication({
  config: {
    port: 3000,
    database: { url: 'postgres://...' },
    payment: { alipay: { appId: '...', appSecret: '...' } },
    features: { b2b: true, multiCurrency: true }
  }
});

// Module 内读取
const port = app.config.get('port', 3000);
const b2bEnabled = app.config.get('features.b2b', false);
```

支持的配置源（按优先级）：
1. 环境变量（`TLL_PORT=3000`）
2. 配置文件（`tll.config.json` / `tll.config.yaml`）
3. Application 代码配置
4. 默认值

支持热更新：通过 `watch()` 监听配置变更，Module 可动态响应。

## 预期收益

- 配置集中管理，环境隔离
- 敏感信息（API Key）不硬编码在代码中
- 功能开关支持灰度发布
- 配置热更新，无需重启

## 兼容性

纯新增能力，不使用配置中心时 Module 内常量继续生效。
