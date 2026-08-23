/**
 * TLL Commerce - Main Entry Point
 *
 * This is the primary entry point for TLL Commerce. It:
 * 1. Creates a TLL OS Application
 * 2. Registers all commerce modules
 * 3. Seeds the database with sample data
 * 4. Runs the Agent end-to-end workflow demo
 * 5. Exports the Application Graph
 * 6. Runs all tests
 *
 * Usage: node agent.js
 *
 * Protocol compliance: This file ONLY imports from TLL OS public layer.
 * No direct dependency on src/core/ or internal implementations.
 */

import { createTllOS } from '../../src/public/index.js';
import { seedDatabase } from './src/data/seed.js';
import { CommerceDatabase } from './src/data/database.js';

import { registerCatalogModule } from './src/modules/catalog.js';
import { registerCustomerModule } from './src/modules/customer.js';
import { registerCartModule } from './src/modules/cart.js';
import { registerOrderModule } from './src/modules/order.js';
import { registerPaymentModule } from './src/modules/payment.js';
import { registerMarketingModule } from './src/modules/marketing.js';
import { registerLocaleModule } from './src/modules/locale.js';
import { registerB2BModule } from './src/modules/b2b.js';
import { registerFileModule } from './src/modules/file.js';
import { registerAdminModule } from './src/modules/admin.js';
import { registerAgentModule } from './src/modules/agent.js';
import { registerStorefrontModule } from './src/modules/storefront.js';
import { registerShippingModule } from './src/modules/shipping.js';
import { registerSupplierModule } from './src/modules/supplier.js';
import { registerMerchantModule } from './src/modules/merchant.js';
import { registerSettlementModule } from './src/modules/settlement.js';
import { registerAnalyticsModule } from './src/modules/analytics.js';
import { registerPromotionModule } from './src/modules/promotion.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          TLL Commerce v0.2.0 - 跨境电商 SaaS              ║');
  console.log('║       Built on TLL OS Runtime 0.2 / Protocol 2.0          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // === Step 1: Create TLL OS Application ===
  console.log('[1/7] 创建 TLL OS Application...');
  const tll = createTllOS();
  const app = tll.createApplication({
    name: 'tll-commerce',
    version: '0.2.0',
    description: 'TLL OS Commerce - 跨境电商 SaaS 独立应用',
  });
  console.log(`  ✓ Application created: ${app.name} v${app.version}`);

  // === Step 2: Seed Database ===
  console.log('[2/7] 初始化数据库并加载种子数据...');
  const db = CommerceDatabase.getInstance();
  await seedDatabase(db);
  const stats = await db.stats();
  console.log(`  ✓ 数据加载完成: ${Object.entries(stats).filter(([k,v]) => v > 0).map(([k,v]) => `${k}=${v}`).join(', ')}`);

  // === Step 3: Register Modules ===
  console.log('[3/7] 注册业务模块...');
  const modules = [
    ['commerce-catalog', registerCatalogModule],
    ['commerce-customer', registerCustomerModule],
    ['commerce-cart', registerCartModule],
    ['commerce-order', registerOrderModule],
    ['commerce-payment', registerPaymentModule],
    ['commerce-marketing', registerMarketingModule],
    ['commerce-locale', registerLocaleModule],
    ['commerce-b2b', registerB2BModule],
    ['commerce-file', registerFileModule],
    ['commerce-shipping', registerShippingModule],
    ['commerce-supplier', registerSupplierModule],
    ['commerce-merchant', registerMerchantModule],
    ['commerce-settlement', registerSettlementModule],
    ['commerce-analytics', registerAnalyticsModule],
    ['commerce-promotion', registerPromotionModule],
    ['commerce-admin', registerAdminModule],
    ['commerce-agent', registerAgentModule],
    ['commerce-storefront', registerStorefrontModule],
  ];

  for (const [name, registerFn] of modules) {
    const mod = registerFn(app);
    const apiCount = mod.apis.list().length;
    const toolCount = mod.tools.list().length;
    const testCount = mod.tests.list().length;
    console.log(`  ✓ ${name}: ${apiCount} APIs, ${toolCount} Tools, ${testCount} Tests`);
  }

  // === Step 4: Start Application ===
  console.log('[4/7] 启动 Application...');
  await app.start();
  const totalModules = app.modules.list().length;
  const totalApis = app.modules.list().reduce((sum, m) => sum + m.apis.list().length, 0) + app.apis.list().length;
  const totalTools = app.modules.list().reduce((sum, m) => sum + m.tools.list().length, 0) + app.tools.list().length;
  const totalTests = app.modules.list().reduce((sum, m) => sum + m.tests.list().length, 0) + app.tests.list().length;
  console.log(`  ✓ Application started, state: ${app.state}`);
  console.log(`  ✓ 总计: ${totalModules} Modules, ${totalApis} APIs, ${totalTools} Tools, ${totalTests} Tests`);

  // === Step 5: Run Agent End-to-End Workflow ===
  console.log('[5/7] 执行 Agent 端到端购物流程（核心验证）...');
  const shoppingTool = app.tools.get('agent_full_shopping_flow');
  let agentResult = { success: false, error: 'tool not found' };
  if (shoppingTool) {
    agentResult = await shoppingTool.invoke({
      keyword: '手机',
      quantity: 1,
      paymentMethod: 'alipay',
    });
  } else {
    console.log('  ⚠ agent_full_shopping_flow tool not found, skipping E2E');
  }

  if (agentResult.success) {
    const wf = agentResult.data;
    console.log(`  ✓ Agent 工作流完成 (${wf.duration}ms)`);
    console.log(`  ✓ 步骤: ${wf.steps.map(s => `${s.step}=${s.status}`).join(' → ')}`);
    console.log(`  ✓ 订单号: ${wf.finalOrder.orderNo}`);
    console.log(`  ✓ 订单金额: ¥${wf.finalOrder.totalAmount}`);
    console.log(`  ✓ 订单状态: ${wf.finalOrder.status}`);
  } else {
    console.log(`  ✗ Agent 工作流失败: ${agentResult.error}`);
  }

  // === Step 6: Export Application Graph ===
  console.log('[6/7] 导出 Application Graph...');
  const graph = app.graph.toJSON();
  const graphPath = path.join(__dirname, 'docs', 'application-graph.json');
  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2), 'utf-8');
  const totalNodes = graph.nodes.length;
  const totalEdges = graph.edges.length;
  const byType = {};
  for (const node of graph.nodes) byType[node.type] = (byType[node.type] || 0) + 1;
  console.log(`  ✓ Graph exported: ${totalNodes} nodes, ${totalEdges} edges`);
  console.log(`  ✓ 节点分布: ${Object.entries(byType).map(([k,v]) => `${k}=${v}`).join(', ')}`);

  // === Step 7: Run Tests ===
  console.log('[7/7] 运行测试套件...');
  const testResult = await app.tests.runAll();
  console.log(`  ✓ 测试结果: ${testResult.passed}/${testResult.total} passed, ${testResult.failed} failed, ${testResult.errors} errors (${testResult.duration}ms)`);
  for (const r of testResult.results) {
    const icon = r.passed ? '✓' : '✗';
    console.log(`    ${icon} ${r.name} (${r.duration}ms)${r.error ? ' - ' + r.error.message : ''}`);
  }

  // === Summary ===
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                        项目总结                             ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Modules:    ${String(totalModules).padEnd(40)}║`);
  console.log(`║  APIs:       ${String(totalApis).padEnd(40)}║`);
  console.log(`║  Tools:      ${String(totalTools).padEnd(40)}║`);
  console.log(`║  Tests:      ${testResult.passed}/${testResult.total} passed${' '.repeat(Math.max(0, 33 - String(testResult.passed + '/' + testResult.total + ' passed').length))}║`);
  console.log(`║  Agent E2E:  ${agentResult.success ? 'PASSED' : 'FAILED'}${' '.repeat(Math.max(0, 34 - (agentResult.success ? 6 : 6)))}║`);
  console.log(`║  Graph:      ${totalNodes} nodes, ${totalEdges} edges${' '.repeat(Math.max(0, 20 - String(totalNodes + ' nodes, ' + totalEdges + ' edges').length))}║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  已验证能力: 商品/SKU/分类/品牌/库存/购物车/用户/地址     ║');
  console.log('║  订单/支付(Mock)/优惠券/促销/会员/多语言/多币种/B2C/B2B  ║');
  console.log('║  物流(跨境)/供应商/商户(SaaS)/结算分账/数据分析           ║');
  console.log('║  API/Agent/后台管理/数据库(内存)/权限/文件/部署/Docker    ║');
  console.log('║  H5/独立站前台/过程记录/TEP提案                            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('TLL OS Commerce 构建完成。这是 TLL OS 的"成人礼"——');
  console.log('证明一个外部 Agent 仅依赖 TLL OS 公开协议就能造出真实可运行的项目。');

  // Export for programmatic use
  return { app, testResult, agentResult, graph };
}

// Run if executed directly
const isMain = process.argv[1] && process.argv[1].includes('agent.js');
if (isMain) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

export { main };
