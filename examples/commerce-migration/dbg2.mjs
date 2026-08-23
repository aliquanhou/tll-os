import { createTllOS } from '../../src/public/index.js';
import { seedDatabase } from './src/data/seed.js';
import { CommerceDatabase } from './src/data/database.js';
import { registerShippingModule } from './src/modules/shipping.js';
import { registerPromotionModule } from './src/modules/promotion.js';

const tll = createTllOS();
const app = tll.createApplication({ name: 'dbg', version: '0.1.0' });
seedDatabase(CommerceDatabase.getInstance());
registerShippingModule(app);
registerPromotionModule(app);
await app.start();

const db = CommerceDatabase.getInstance();
console.log('DB shipping_methods count:', db.find('shipping_methods').length);
console.log('DB promotions count:', db.find('promotions').length);

const r = await app.apis.request('GET', '/shipping/methods');
console.log('\nGET /shipping/methods:');
console.log('  status:', r.status);
console.log('  body keys:', Object.keys(r.body));
console.log('  body.items:', r.body.items ? r.body.items.length : 'UNDEFINED');
console.log('  body:', JSON.stringify(r.body).substring(0, 200));

const r2 = await app.apis.request('POST', '/promotions/calculate', { orderAmount: 150 });
console.log('\nPOST /promotions/calculate:');
console.log('  status:', r2.status);
console.log('  body:', JSON.stringify(r2.body));
