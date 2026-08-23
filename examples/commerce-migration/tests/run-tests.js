/**
 * TLL Commerce - Test Runner
 * Standalone test runner: `npm test`
 * Creates a fresh application, registers all modules, seeds data, and runs all tests.
 */

import { createTllOS } from '../../../src/public/index.js';
import { seedDatabase } from '../src/data/seed.js';
import { CommerceDatabase } from '../src/data/database.js';

import { registerCatalogModule } from '../src/modules/catalog.js';
import { registerCustomerModule } from '../src/modules/customer.js';
import { registerCartModule } from '../src/modules/cart.js';
import { registerOrderModule } from '../src/modules/order.js';
import { registerPaymentModule } from '../src/modules/payment.js';
import { registerMarketingModule } from '../src/modules/marketing.js';
import { registerLocaleModule } from '../src/modules/locale.js';
import { registerB2BModule } from '../src/modules/b2b.js';
import { registerFileModule } from '../src/modules/file.js';
import { registerAdminModule } from '../src/modules/admin.js';
import { registerAgentModule } from '../src/modules/agent.js';
import { registerStorefrontModule } from '../src/modules/storefront.js';
import { registerShippingModule } from '../src/modules/shipping.js';
import { registerSupplierModule } from '../src/modules/supplier.js';
import { registerMerchantModule } from '../src/modules/merchant.js';
import { registerSettlementModule } from '../src/modules/settlement.js';
import { registerAnalyticsModule } from '../src/modules/analytics.js';
import { registerPromotionModule } from '../src/modules/promotion.js';

async function runTests() {
  console.log('TLL Commerce Test Suite');
  console.log('========================');
  console.log('');

  // Fresh database
  CommerceDatabase.reset();
  seedDatabase();

  // Create app
  const tll = createTllOS();
  const app = tll.createApplication({ name: 'tll-commerce-test', version: '0.2.0' });

  // Register all modules
  const modules = [
    registerCatalogModule, registerCustomerModule, registerCartModule,
    registerOrderModule, registerPaymentModule, registerMarketingModule,
    registerLocaleModule, registerB2BModule, registerFileModule,
    registerShippingModule, registerSupplierModule, registerMerchantModule,
    registerSettlementModule, registerAnalyticsModule, registerPromotionModule,
    registerAdminModule, registerAgentModule, registerStorefrontModule,
  ];
  for (const registerFn of modules) registerFn(app);

  await app.start();

  console.log(`Modules: ${app.status.modules}, APIs: ${app.status.apis}, Tools: ${app.status.tools}, Tests: ${app.status.tests}`);
  console.log('');

  // Run tests
  const result = await app.tests.runAll();

  console.log(`Results: ${result.passed}/${result.total} passed, ${result.failed} failed, ${result.errors} errors (${result.duration}ms)`);
  console.log('');

  for (const r of result.results) {
    const icon = r.status === 'passed' ? '✓' : '✗';
    console.log(`  ${icon} [${r.module}] ${r.name} (${r.duration}ms)${r.error ? ' - ' + r.error : ''}`);
  }

  console.log('');
  if (result.failed === 0 && result.errors === 0) {
    console.log('ALL TESTS PASSED ✓');
    process.exit(0);
  } else {
    console.log('SOME TESTS FAILED ✗');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
