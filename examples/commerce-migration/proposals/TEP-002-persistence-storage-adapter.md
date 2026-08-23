# TEP-002: Persistence Storage Adapter

**状态**: Proposed | **日期**: 2026-08-22 | **作者**: TLL OS Commerce Agent

## 问题

Runtime 0.1 无持久化能力，所有数据存储在进程内存中。Application 重启后数据全部丢失，无法用于生产环境。Commerce 项目用 21 个内存 Map 模拟数据库，但这只是开发期方案。

## 当前替代方案

每个项目自行实现数据持久化（写入 JSON 文件、连接数据库等）。Commerce 项目完全使用内存 Map，重启后重新加载种子数据。

## 提案

引入 Storage Adapter 规范，将数据持久化从业务逻辑中解耦：

```typescript
interface StorageAdapter {
  get(collection: string, id: string): Promise<any | null>;
  set(collection: string, id: string, data: any): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  list(collection: string, options?: ListOptions): Promise<{ items: any[]; total: number }>;
  find(collection: string, query: Query): Promise<any[]>;
  count(collection: string, query?: Query): Promise<number>;
  transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
}
```

Runtime 提供默认的内存实现（MemoryStorage），同时支持 Adapter：
- **FileStorage**: JSON 文件持久化，适合小型项目
- **SqliteStorage**: 嵌入式 SQLite，适合单机部署
- **PostgresStorage / MySQLStorage**: 关系型数据库，适合生产环境
- **MongoStorage**: 文档数据库

Module 可以声明自己的数据集合，Runtime 自动管理 schema 迁移。

## 预期收益

- 业务 Module 无需关心存储实现
- 支持从开发到生产的平滑升级（Memory → File → Sqlite → Postgres）
- 内置事务支持，解决 Runtime 0.1 无事务的问题
- 统一的查询语法，Module 代码可移植

## 兼容性

MemoryStorage 作为默认实现，行为与 Runtime 0.1 一致。Module 需要适配新的 Storage API，属于破坏性变更，建议在 Runtime 1.0 前引入。
