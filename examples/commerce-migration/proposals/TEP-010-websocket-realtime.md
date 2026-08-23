# TEP-010: WebSocket / Real-time

**状态**: Proposed | **日期**: 2026-08-22 | **作者**: TLL OS Commerce Agent

## 问题

Runtime 0.1 仅支持 HTTP 请求-响应模式，无 WebSocket/实时通信能力。以下场景需要实时推送：
- 订单状态变更通知（支付成功、发货提醒）
- 库存预警实时推送
- 后台管理实时数据刷新（仪表盘、订单列表）
- 客服即时通讯
- 多端数据同步

Commerce 项目中，前端通过轮询获取最新数据，效率低且延迟高。

## 当前替代方案

- 前端轮询（setInterval 定时刷新）
- 无服务端推送能力

## 提案

引入 WebSocket Adapter 规范：

```typescript
interface WebSocketAdapter {
  start(server: HttpServer): void;
  broadcast(channel: string, event: string, data: any): void;
  sendTo(clientId: string, event: string, data: any): void;
  on(event: string, handler: (client, data) => void): void;
}

// Module 声明 WebSocket 频道
module.websockets.create({
  channel: 'orders',
  description: '订单状态变更通知',
  events: ['order:created', 'order:paid', 'order:shipped', 'order:completed']
});

// 服务端推送
app.websockets.broadcast('orders', 'order:paid', { orderId: 'ord_123', status: 'paid' });

// 客户端订阅
const ws = new WebSocket('ws://localhost:3000/ws');
ws.send(JSON.stringify({ action: 'subscribe', channel: 'orders' }));
ws.onmessage = (e) => {
  const { event, data } = JSON.parse(e.data);
  if (event === 'order:paid') { /* 更新 UI */ }
};
```

内置能力：
- 频道订阅/取消订阅
- 客户端认证（基于 token）
- 心跳检测
- 断线重连（客户端 SDK）
- 消息持久化（可选）

## 预期收益

- 实时数据推送，替代轮询
- 订单状态、库存预警等实时通知
- 后台仪表盘实时刷新
- 支持客服、协同编辑等复杂交互

## 兼容性

需要配合 TEP-001（HTTP Server Adapter）实现 WebSocket 升级。纯新增能力，不使用时行为不变。
