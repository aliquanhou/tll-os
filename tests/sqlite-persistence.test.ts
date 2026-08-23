/**
 * SQLite Persistence Adapter 验证测试
 * 验证：CRUD / Query / Pagination / Transaction / Migration / 跨进程持久化
 */
import { createSqlitePersistence } from '../src/public/index.js';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_DIR = join(process.cwd(), '.sqlite-test');
const DB_PATH = join(TEST_DIR, 'test.db');

async function run() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ ${msg}`);
    } else {
      failed++;
      console.error(`  ✗ ${msg}`);
    }
  }

  // 清理
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });

  console.log('\n=== SQLite Persistence Adapter Test ===\n');

  // 1. 连接
  console.log('1. Connect');
  const db = createSqlitePersistence(DB_PATH);
  await db.connect();
  assert(db.isConnected(), 'database connected');
  assert(db.name === 'sqlite', 'adapter name is sqlite');
  assert(db.type === 'sqlite', 'adapter type is sqlite');

  // 2. CRUD
  console.log('\n2. CRUD');
  const users = db.getRepository<{ id: string; name: string; age: number; role: string }>('users');

  const u1 = await users.create({ name: 'Alice', age: 30, role: 'admin' });
  assert(u1.id !== undefined, 'create returns id');
  assert(u1.name === 'Alice', 'create stores name');
  assert(u1.createdAt !== undefined, 'create sets createdAt');

  const u2 = await users.create({ name: 'Bob', age: 25, role: 'user' });
  const u3 = await users.create({ name: 'Charlie', age: 35, role: 'admin' });

  const found = await users.findById(u1.id);
  assert(found !== null && found.name === 'Alice', 'findById returns correct record');

  const all = await users.find();
  assert(all.length === 3, `find returns all records (${all.length}/3)`);

  const updated = await users.update(u1.id, { age: 31 });
  assert(updated !== null && updated.age === 31, 'update modifies record');
  assert(updated!.updatedAt > updated!.createdAt, 'update sets updatedAt');

  const deleted = await users.delete(u2.id);
  assert(deleted === true, 'delete returns true');
  const afterDelete = await users.find();
  assert(afterDelete.length === 2, `after delete count is 2 (${afterDelete.length})`);

  // 3. Query filter
  console.log('\n3. Query Filter');
  const admins = await users.find({ filter: { role: 'admin' } });
  assert(admins.length === 2, `filter by role=admin returns 2 (${admins.length})`);

  const over30 = await users.find({ filter: { age: { $gt: 30 } } });
  assert(over30.length === 2, `filter age > 30 returns 2 (${over30.length})`);

  const sorted = await users.find({ sort: [{ field: 'age', order: 'asc' }] });
  assert(sorted[0].age <= sorted[1].age, 'sort ascending works');

  const limited = await users.find({ limit: 1 });
  assert(limited.length === 1, 'limit works');

  const count = await users.count();
  assert(count === 2, `count returns 2 (${count})`);

  const exists = await users.exists({ filter: { name: 'Alice' } });
  assert(exists === true, 'exists returns true for matching record');

  // 4. Pagination
  console.log('\n4. Pagination');
  // 先加更多数据
  for (let i = 0; i < 5; i++) {
    await users.create({ name: `User${i}`, age: 20 + i, role: 'user' });
  }
  const page1 = await users.findPaginated({}, { page: 1, pageSize: 3 });
  assert(page1.items.length === 3, `page 1 has 3 items (${page1.items.length})`);
  assert(page1.total === 7, `total is 7 (${page1.total})`);
  assert(page1.totalPages === 3, `totalPages is 3 (${page1.totalPages})`);
  assert(page1.hasNext === true, 'hasNext is true');
  assert(page1.hasPrev === false, 'hasPrev is false');

  // 5. Transaction
  console.log('\n5. Transaction');
  const txResult = await db.transaction(async (tx) => {
    const txUsers = tx.getRepository<{ id: string; name: string }>('tx_users');
    await txUsers.create({ name: 'TxUser1' });
    await txUsers.create({ name: 'TxUser2' });
    return 'committed';
  });
  assert(txResult === 'committed', 'transaction commits');

  const txUsersRepo = db.getRepository<{ id: string; name: string }>('tx_users');
  const txCount = await txUsersRepo.count();
  assert(txCount === 2, `transaction data persisted (${txCount})`);

  // 事务回滚
  try {
    await db.transaction(async (tx) => {
      const rollbackRepo = tx.getRepository<{ id: string; name: string }>('rollback_test');
      await rollbackRepo.create({ name: 'ShouldNotExist' });
      throw new Error('intentional rollback');
    });
  } catch (e) {
    // expected
  }
  const rollbackRepo = db.getRepository<{ id: string; name: string }>('rollback_test');
  const rollbackCount = await rollbackRepo.count();
  assert(rollbackCount === 0, `rolled back data not persisted (${rollbackCount})`);

  // 6. Migration
  console.log('\n6. Migration');
  const migrationResult = await db.migrate([
    {
      id: '001_init',
      name: 'Initialize test data',
      up: async (adapter) => {
        const repo = adapter.getRepository<{ id: string; value: string }>('migrated_data');
        await repo.create({ value: 'from_migration' });
      },
    },
  ]);
  assert(migrationResult.applied.includes('001_init'), 'migration applied');

  // 再次运行应该跳过
  const migrationResult2 = await db.migrate([
    {
      id: '001_init',
      name: 'Initialize test data',
      up: async () => {},
    },
  ]);
  assert(migrationResult2.skipped.includes('001_init'), 'migration skipped on second run');

  const migratedRepo = db.getRepository<{ id: string; value: string }>('migrated_data');
  const migratedCount = await migratedRepo.count();
  assert(migratedCount === 1, `migrated data exists (${migratedCount})`);

  // 7. 断开连接
  console.log('\n7. Disconnect & Reconnect (persistence verification)');
  await db.disconnect();
  assert(!db.isConnected(), 'database disconnected');

  // 重新连接，验证数据持久化
  const db2 = createSqlitePersistence(DB_PATH);
  await db2.connect();
  const users2 = db2.getRepository<{ id: string; name: string; age: number }>('users');
  const persistedCount = await users2.count();
  assert(persistedCount === 7, `data persisted across reconnect (${persistedCount}/7)`);

  const alice = await users2.findOne({ filter: { name: 'Alice' } });
  assert(alice !== null && alice.age === 31, `Alice persisted with updated age (${alice?.age})`);

  await db2.disconnect();

  // 8. createMany
  console.log('\n8. createMany');
  const db3 = createSqlitePersistence(DB_PATH);
  await db3.connect();
  const batchRepo = db3.getRepository<{ id: string; name: string }>('batch_test');
  const batch = await batchRepo.createMany([
    { name: 'Batch1' },
    { name: 'Batch2' },
    { name: 'Batch3' },
  ]);
  assert(batch.length === 3, `createMany returns 3 (${batch.length})`);
  const batchCount = await batchRepo.count();
  assert(batchCount === 3, `batch data persisted (${batchCount})`);
  await db3.disconnect();

  // 总结
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

  // 清理
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
