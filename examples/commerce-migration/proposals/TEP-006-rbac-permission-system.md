# TEP-006: RBAC Permission System

**状态**: Proposed | **日期**: 2026-08-22 | **作者**: TLL OS Commerce Agent

## 问题

Runtime 0.1 无权限系统。所有 API 和 Tool 可匿名调用，无法区分管理员和普通用户。Commerce 项目用 `user.role` 字段（admin/customer/b2b）简化实现，但没有统一的权限校验机制，admin 模块的仪表盘 API 实际上任何人都能调用。

## 当前替代方案

- `user.role` 字段标记用户角色
- customer 模块部分 API 手动检查 token
- 无统一的权限校验入口

## 提案

引入 RBAC（基于角色的访问控制）系统：

```typescript
interface Permission {
  resource: string;   // 'product', 'order', 'user'
  action: string;     // 'create', 'read', 'update', 'delete'
  scope?: string;     // 'own', 'team', 'all'
}

interface Role {
  name: string;
  permissions: Permission[];
}

// Module 声明 API 所需权限
module.apis.create({
  method: 'DELETE',
  path: '/products/:id',
  handler,
  permissions: [{ resource: 'product', action: 'delete', scope: 'all' }]
});

// Tool 声明权限
module.tools.create({
  name: 'delete_product',
  handler,
  permissions: [{ resource: 'product', action: 'delete' }]
});
```

Runtime 在调用 API/Tool 前自动校验权限，无权限返回 403。

内置角色：
- **admin**: 全部权限
- **manager**: 商品/订单/用户管理权限
- **customer**: 自身数据权限
- **guest**: 只读公开数据权限

## 预期收益

- 统一的权限管理，避免安全漏洞
- 支持细粒度权限控制（资源+操作+范围）
- API/Tool 自声明权限，文档与实现一致
- 可扩展为 ABAC（基于属性的访问控制）

## 兼容性

需要配合 TEP-005（中间件）实现权限校验。不声明权限的 API/Tool 默认为公开访问，与 Runtime 0.1 行为一致。
