/**
 * TLL Commerce - Seed Data
 * Populates the in-memory database with sample products, categories, brands, users, etc.
 */

import { CommerceDatabase } from './database.js';
import { hashPassword } from '../utils.js';

export async function seedDatabase(db = CommerceDatabase.getInstance()) {
  await db.clearAll();

  // === Membership Levels ===
  await db.insert('membership_levels', { id: 'mlevel_000001', name: '普通会员', level: 0, discount: 1.0, minSpent: 0, benefits: ['基础购物'] });
  await db.insert('membership_levels', { id: 'mlevel_000002', name: '银卡会员', level: 1, discount: 0.95, minSpent: 1000, benefits: ['95折优惠', '优先客服'] });
  await db.insert('membership_levels', { id: 'mlevel_000003', name: '金卡会员', level: 2, discount: 0.90, minSpent: 5000, benefits: ['9折优惠', '免费 shipping', '专属客服'] });
  await db.insert('membership_levels', { id: 'mlevel_000004', name: '钻石会员', level: 3, discount: 0.85, minSpent: 20000, benefits: ['85折优惠', '免费 shipping', '专属客服', '生日礼包'] });

  // === Brands ===
  await db.insert('brands', { id: 'brand_000001', name: 'TechPro', slug: 'techpro', description: '专业电子设备品牌', logo: '/images/brands/techpro.png', country: 'CN', status: 'active' });
  await db.insert('brands', { id: 'brand_000002', name: 'EcoLife', slug: 'ecolife', description: '环保生活方式品牌', logo: '/images/brands/ecolife.png', country: 'DE', status: 'active' });
  await db.insert('brands', { id: 'brand_000003', name: 'StyleCraft', slug: 'stylecraft', description: '时尚服饰品牌', logo: '/images/brands/stylecraft.png', country: 'FR', status: 'active' });

  // === Categories ===
  await db.insert('categories', { id: 'cat_000001', name: '电子产品', slug: 'electronics', parentId: null, level: 1, sort: 1, status: 'active', icon: '📱' });
  await db.insert('categories', { id: 'cat_000002', name: '手机', slug: 'phones', parentId: 'cat_000001', level: 2, sort: 1, status: 'active', icon: '📱' });
  await db.insert('categories', { id: 'cat_000003', name: '电脑', slug: 'computers', parentId: 'cat_000001', level: 2, sort: 2, status: 'active', icon: '💻' });
  await db.insert('categories', { id: 'cat_000004', name: '家居生活', slug: 'home', parentId: null, level: 1, sort: 2, status: 'active', icon: '🏠' });
  await db.insert('categories', { id: 'cat_000005', name: '厨房用品', slug: 'kitchen', parentId: 'cat_000004', level: 2, sort: 1, status: 'active', icon: '🍳' });
  await db.insert('categories', { id: 'cat_000006', name: '服饰鞋包', slug: 'fashion', parentId: null, level: 1, sort: 3, status: 'active', icon: '👗' });

  // === Products ===
  const products = [
    { id: 'prod_000001', name: 'TechPro X1 智能手机', slug: 'techpro-x1', brandId: 'brand_000001', categoryId: 'cat_000002', price: 3999, costPrice: 2800, status: 'active', description: '旗舰级智能手机，6.7寸OLED屏幕，5000mAh电池', shortDescription: '旗舰智能手机', images: ['/images/products/x1-1.jpg', '/images/products/x1-2.jpg'], weight: 195, hasVariants: true, tags: ['手机', '旗舰', '5G'], seoTitle: 'TechPro X1 智能手机 - 旗舰5G手机', seoDescription: 'TechPro X1 旗舰智能手机' },
    { id: 'prod_000002', name: 'TechPro Book 14 笔记本', slug: 'techpro-book14', brandId: 'brand_000001', categoryId: 'cat_000003', price: 6999, costPrice: 5200, status: 'active', description: '轻薄商务笔记本，14寸2K屏，16GB内存，512GB SSD', shortDescription: '轻薄商务笔记本', images: ['/images/products/book14-1.jpg'], weight: 1350, hasVariants: true, tags: ['笔记本', '商务', '轻薄'], seoTitle: 'TechPro Book 14 轻薄商务笔记本', seoDescription: '14寸2K屏轻薄笔记本' },
    { id: 'prod_000003', name: 'EcoLife 环保保温杯', slug: 'ecolife-thermos', brandId: 'brand_000002', categoryId: 'cat_000005', price: 129, costPrice: 65, status: 'active', description: '316不锈钢保温杯，500ml，12小时保温', shortDescription: '316不锈钢保温杯', images: ['/images/products/thermos-1.jpg'], weight: 280, hasVariants: true, tags: ['保温杯', '环保', '不锈钢'], seoTitle: 'EcoLife 环保保温杯 500ml', seoDescription: '316不锈钢12小时保温' },
    { id: 'prod_000004', name: 'EcoLife 竹纤维餐具套装', slug: 'ecolife-bamboo-set', brandId: 'brand_000002', categoryId: 'cat_000005', price: 89, costPrice: 40, status: 'active', description: '天然竹纤维餐具6件套，可降解，环保健康', shortDescription: '竹纤维餐具6件套', images: ['/images/products/bamboo-1.jpg'], weight: 350, hasVariants: false, tags: ['餐具', '环保', '竹纤维'], seoTitle: 'EcoLife 竹纤维餐具套装', seoDescription: '天然可降解环保餐具' },
    { id: 'prod_000005', name: 'StyleCraft 经典棉质T恤', slug: 'stylecraft-cotton-tee', brandId: 'brand_000003', categoryId: 'cat_000006', price: 99, costPrice: 35, status: 'active', description: '100%精梳棉，经典版型，多色可选', shortDescription: '100%精梳棉经典T恤', images: ['/images/products/tee-1.jpg'], weight: 180, hasVariants: true, tags: ['T恤', '棉质', '经典'], seoTitle: 'StyleCraft 经典棉质T恤', seoDescription: '100%精梳棉多色经典T恤' },
    { id: 'prod_000006', name: 'TechPro 无线蓝牙耳机', slug: 'techpro-earbuds', brandId: 'brand_000001', categoryId: 'cat_000001', price: 599, costPrice: 280, status: 'active', description: '主动降噪，30小时续航，IPX5防水', shortDescription: '主动降噪无线耳机', images: ['/images/products/earbuds-1.jpg'], weight: 50, hasVariants: true, tags: ['耳机', '无线', '降噪'], seoTitle: 'TechPro 无线蓝牙耳机 主动降噪', seoDescription: '30小时续航IPX5防水' },
  ];
  for (const p of products) await db.insert('products', p);

  // === SKUs ===
  const skus = [
    { id: 'sku_000001', productId: 'prod_000001', skuCode: 'TP-X1-128-BLK', name: 'X1 128GB 曜石黑', attributes: { color: '曜石黑', storage: '128GB' }, price: 3999, costPrice: 2800, stock: 150, status: 'active' },
    { id: 'sku_000002', productId: 'prod_000001', skuCode: 'TP-X1-256-BLK', name: 'X1 256GB 曜石黑', attributes: { color: '曜石黑', storage: '256GB' }, price: 4499, costPrice: 3200, stock: 80, status: 'active' },
    { id: 'sku_000003', productId: 'prod_000001', skuCode: 'TP-X1-128-WHT', name: 'X1 128GB 月光白', attributes: { color: '月光白', storage: '128GB' }, price: 3999, costPrice: 2800, stock: 120, status: 'active' },
    { id: 'sku_000004', productId: 'prod_000002', skuCode: 'TP-B14-16-512', name: 'Book14 16GB/512GB', attributes: { ram: '16GB', storage: '512GB' }, price: 6999, costPrice: 5200, stock: 60, status: 'active' },
    { id: 'sku_000005', productId: 'prod_000002', skuCode: 'TP-B14-32-1T', name: 'Book14 32GB/1TB', attributes: { ram: '32GB', storage: '1TB' }, price: 8999, costPrice: 6800, stock: 30, status: 'active' },
    { id: 'sku_000006', productId: 'prod_000003', skuCode: 'EL-TH-500-BLK', name: '保温杯 500ml 黑色', attributes: { color: '黑色', capacity: '500ml' }, price: 129, costPrice: 65, stock: 500, status: 'active' },
    { id: 'sku_000007', productId: 'prod_000003', skuCode: 'EL-TH-500-GRN', name: '保温杯 500ml 绿色', attributes: { color: '绿色', capacity: '500ml' }, price: 129, costPrice: 65, stock: 300, status: 'active' },
    { id: 'sku_000008', productId: 'prod_000004', skuCode: 'EL-BS-6PC', name: '竹纤维餐具6件套', attributes: {}, price: 89, costPrice: 40, stock: 200, status: 'active' },
    { id: 'sku_000009', productId: 'prod_000005', skuCode: 'SC-CT-M-BLK', name: '棉质T恤 M 黑色', attributes: { size: 'M', color: '黑色' }, price: 99, costPrice: 35, stock: 400, status: 'active' },
    { id: 'sku_000010', productId: 'prod_000005', skuCode: 'SC-CT-L-WHT', name: '棉质T恤 L 白色', attributes: { size: 'L', color: '白色' }, price: 99, costPrice: 35, stock: 350, status: 'active' },
    { id: 'sku_000011', productId: 'prod_000005', skuCode: 'SC-CT-XL-BLU', name: '棉质T恤 XL 蓝色', attributes: { size: 'XL', color: '蓝色' }, price: 99, costPrice: 35, stock: 200, status: 'active' },
    { id: 'sku_000012', productId: 'prod_000006', skuCode: 'TP-EB-WHT', name: '无线耳机 白色', attributes: { color: '白色' }, price: 599, costPrice: 280, stock: 250, status: 'active' },
    { id: 'sku_000013', productId: 'prod_000006', skuCode: 'TP-EB-BLK', name: '无线耳机 黑色', attributes: { color: '黑色' }, price: 599, costPrice: 280, stock: 300, status: 'active' },
  ];
  for (const s of skus) await db.insert('skus', s);

  // === Inventory records (linked to SKUs) ===
  for (const sku of skus) {
    await db.insert('inventory', { id: await db.nextId('inventory'), skuId: sku.id, warehouse: 'default', quantity: sku.stock, reserved: 0, safetyStock: 10 });
  }

  // === Users ===
  await db.insert('users', { id: 'user_000001', email: 'admin@tllcommerce.com', username: 'admin', passwordHash: hashPassword('admin123'), role: 'admin', status: 'active', membershipLevelId: 'mlevel_000004', totalSpent: 25000, phone: '13800000001', firstName: '系统', lastName: '管理员', avatar: '/images/avatars/admin.png', createdAt: '2025-01-01T00:00:00Z' });
  await db.insert('users', { id: 'user_000002', email: 'customer@example.com', username: 'customer', passwordHash: hashPassword('customer123'), role: 'customer', status: 'active', membershipLevelId: 'mlevel_000002', totalSpent: 1500, phone: '13800000002', firstName: '张', lastName: '三', avatar: '/images/avatars/customer.png', createdAt: '2025-06-15T00:00:00Z' });
  await db.insert('users', { id: 'user_000003', email: 'b2b@company.com', username: 'b2bbuyer', passwordHash: hashPassword('b2b123'), role: 'b2b', status: 'active', membershipLevelId: 'mlevel_000003', totalSpent: 8000, phone: '13800000003', firstName: '李', lastName: '采购', avatar: '/images/avatars/b2b.png', companyId: 'comp_000001', createdAt: '2025-03-10T00:00:00Z' });

  // === Addresses ===
  await db.insert('addresses', { id: 'addr_000001', userId: 'user_000002', label: '家', recipient: '张三', phone: '13800000002', country: 'CN', province: '广东省', city: '惠州市', district: '大亚湾区', detail: '科技创新园A栋1001室', zipCode: '516000', isDefault: true });
  await db.insert('addresses', { id: 'addr_000002', userId: 'user_000002', label: '公司', recipient: '张三', phone: '13800000002', country: 'CN', province: '广东省', city: '深圳市', district: '南山区', detail: '科技园路88号', zipCode: '518000', isDefault: false });
  await db.insert('addresses', { id: 'addr_000003', userId: 'user_000003', label: '公司仓库', recipient: '李采购', phone: '13800000003', country: 'CN', province: '浙江省', city: '杭州市', district: '余杭区', detail: '未来科技城B区仓库', zipCode: '311100', isDefault: true });

  // === B2B Companies ===
  await db.insert('companies', { id: 'comp_000001', name: '杭州优选贸易有限公司', taxNumber: '91330100MA2XXXXXX', contactName: '李采购', contactPhone: '13800000003', address: '浙江省杭州市余杭区未来科技城', creditLimit: 50000, currentCredit: 12000, status: 'active', discountRate: 0.88, paymentTerms: 'net30' });

  // === Coupons ===
  await db.insert('coupons', { id: 'cpn_000001', code: 'WELCOME10', name: '新人立减10元', type: 'fixed', value: 10, minOrderAmount: 0, maxDiscount: 10, totalCount: 1000, usedCount: 150, perUserLimit: 1, validFrom: '2025-01-01T00:00:00Z', validTo: '2027-12-31T23:59:59Z', status: 'active', applicableCategories: [], applicableProducts: [] });
  await db.insert('coupons', { id: 'cpn_000002', code: 'SAVE50', name: '满500减50', type: 'fixed', value: 50, minOrderAmount: 500, maxDiscount: 50, totalCount: 500, usedCount: 80, perUserLimit: 3, validFrom: '2025-01-01T00:00:00Z', validTo: '2027-12-31T23:59:59Z', status: 'active', applicableCategories: [], applicableProducts: [] });
  await db.insert('coupons', { id: 'cpn_000003', code: 'ECO15', name: '环保品类85折', type: 'percent', value: 15, minOrderAmount: 0, maxDiscount: 100, totalCount: 300, usedCount: 45, perUserLimit: 2, validFrom: '2025-01-01T00:00:00Z', validTo: '2027-12-31T23:59:59Z', status: 'active', applicableCategories: ['cat_000004'], applicableProducts: [] });
  await db.insert('coupons', { id: 'cpn_000004', code: 'B2B10', name: 'B2B专享9折', type: 'percent', value: 10, minOrderAmount: 1000, maxDiscount: 500, totalCount: 100, usedCount: 12, perUserLimit: 5, validFrom: '2025-01-01T00:00:00Z', validTo: '2027-12-31T23:59:59Z', status: 'active', applicableCategories: [], applicableProducts: [], b2bOnly: true });

  
  // === Shipping Methods ===
  await db.insert('shipping_methods', { id: 'sm_000001', name: '标准国际快递', code: 'standard_express', type: 'standard', carrier: 'DHL', estimatedDays: '7-15', trackingSupported: true, enabled: true, sort: 1 });
  await db.insert('shipping_methods', { id: 'sm_000002', name: '国际空运', code: 'air_freight', type: 'air', carrier: 'FedEx', estimatedDays: '3-7', trackingSupported: true, enabled: true, sort: 2 });
  await db.insert('shipping_methods', { id: 'sm_000003', name: '国际海运', code: 'sea_freight', type: 'sea', carrier: 'COSCO', estimatedDays: '20-40', trackingSupported: true, enabled: true, sort: 3 });
  await db.insert('shipping_methods', { id: 'sm_000004', name: '经济小包', code: 'economy_packet', type: 'economy', carrier: 'China Post', estimatedDays: '15-30', trackingSupported: false, enabled: true, sort: 4 });
  await db.insert('shipping_methods', { id: 'sm_000005', name: '国内顺丰', code: 'sf_express', type: 'express', carrier: 'SF Express', estimatedDays: '1-3', trackingSupported: true, enabled: true, sort: 5 });

  // === Shipping Zones ===
  await db.insert('shipping_zones', { id: 'sz_000001', name: '中国大陆', countries: ['CN'], region: 'domestic', taxRate: 0, enabled: true });
  await db.insert('shipping_zones', { id: 'sz_000002', name: '亚太区', countries: ['JP','KR','SG','MY','TH','VN','ID','PH','AU','NZ'], region: 'asia', taxRate: 5, enabled: true });
  await db.insert('shipping_zones', { id: 'sz_000003', name: '欧洲区', countries: ['GB','DE','FR','IT','ES','NL','BE','AT','CH','SE','NO','DK','FI','IE','PT','GR'], region: 'europe', taxRate: 20, enabled: true });
  await db.insert('shipping_zones', { id: 'sz_000004', name: '北美区', countries: ['US','CA','MX'], region: 'namerica', taxRate: 8, enabled: true });
  await db.insert('shipping_zones', { id: 'sz_000005', name: '其他地区', countries: [], region: 'other', taxRate: 10, enabled: true });

  // === Shipping Rates ===
  await db.insert('shipping_rates', { id: 'sr_000001', zoneId: 'sz_000001', methodId: 'sm_000005', pricingType: 'weight', basePrice: 12, perKg: 2, freeThreshold: 99, enabled: true });
  await db.insert('shipping_rates', { id: 'sr_000002', zoneId: 'sz_000002', methodId: 'sm_000001', pricingType: 'weight', basePrice: 45, perKg: 60, freeThreshold: 0, enabled: true });
  await db.insert('shipping_rates', { id: 'sr_000003', zoneId: 'sz_000002', methodId: 'sm_000002', pricingType: 'weight', basePrice: 80, perKg: 120, freeThreshold: 0, enabled: true });
  await db.insert('shipping_rates', { id: 'sr_000004', zoneId: 'sz_000003', methodId: 'sm_000001', pricingType: 'weight', basePrice: 60, perKg: 80, freeThreshold: 0, enabled: true });
  await db.insert('shipping_rates', { id: 'sr_000005', zoneId: 'sz_000003', methodId: 'sm_000003', pricingType: 'weight', basePrice: 30, perKg: 25, freeThreshold: 0, minWeight: 10000, enabled: true });
  await db.insert('shipping_rates', { id: 'sr_000006', zoneId: 'sz_000004', methodId: 'sm_000001', pricingType: 'weight', basePrice: 50, perKg: 70, freeThreshold: 0, enabled: true });
  await db.insert('shipping_rates', { id: 'sr_000007', zoneId: 'sz_000004', methodId: 'sm_000002', pricingType: 'weight', basePrice: 90, perKg: 130, freeThreshold: 0, enabled: true });
  await db.insert('shipping_rates', { id: 'sr_000008', zoneId: 'sz_000005', methodId: 'sm_000004', pricingType: 'fixed', basePrice: 25, perKg: 0, freeThreshold: 0, maxWeight: 2000, enabled: true });

  // === Suppliers ===
  await db.insert('suppliers', { id: 'sup_000001', name: '深圳华强电子科技', code: 'SUP001', contact: '陈经理', phone: '13900000001', email: 'chen@hq.com', country: 'CN', settlementMethod: 'monthly', creditLimit: 100000, usedCredit: 25000, currency: 'CNY', taxRate: 13, status: 'active', rating: 5 });
  await db.insert('suppliers', { id: 'sup_000002', name: '义乌小商品供应链', code: 'SUP002', contact: '王总', phone: '13900000002', email: 'wang@yw.com', country: 'CN', settlementMethod: 'weekly', creditLimit: 50000, usedCredit: 8000, currency: 'CNY', taxRate: 13, status: 'active', rating: 4 });
  await db.insert('suppliers', { id: 'sup_000003', name: '东莞服装制造厂', code: 'SUP003', contact: '李厂长', phone: '13900000003', email: 'li@dg.com', country: 'CN', settlementMethod: 'monthly', creditLimit: 80000, usedCredit: 15000, currency: 'CNY', taxRate: 13, status: 'active', rating: 4 });

  // === Merchants ===
  await db.insert('merchants', { id: 'mer_000001', name: '环球优品跨境旗舰店', code: 'MER001', contact: '林总', phone: '13900000010', email: 'merchant@g.com', plan: 'pro', status: 'active', feeRate: 2.0, settlementCycle: 'weekly', minSettlementAmount: 100, currency: 'CNY', supportedCountries: ['US','GB','DE','FR','JP','AU'], shippingFrom: 'CN', activatedAt: '2025-06-01T00:00:00Z' });
  await db.insert('merchants', { id: 'mer_000002', name: '数码海外专营店', code: 'MER002', contact: '赵经理', phone: '13900000011', email: 'digital@s.com', plan: 'standard', status: 'active', feeRate: 3.0, settlementCycle: 'monthly', minSettlementAmount: 200, currency: 'CNY', supportedCountries: ['US','CA','GB'], shippingFrom: 'CN', activatedAt: '2025-08-15T00:00:00Z' });
  await db.insert('merchants', { id: 'mer_000003', name: '家居生活优选店', code: 'MER003', contact: '周店长', phone: '13900000012', email: 'home@s.com', plan: 'free', status: 'pending', feeRate: 5.0, settlementCycle: 'monthly', minSettlementAmount: 500, currency: 'CNY', supportedCountries: ['CN'], shippingFrom: 'CN', activatedAt: null });

  // === Promotions ===
  await db.insert('promotions', { id: 'prom_000001', name: '新人首单满减', type: 'full_reduction', status: 'active', startAt: '2025-01-01T00:00:00Z', endAt: '2027-12-31T23:59:59Z', fullReductionRules: [{threshold:100,discount:10},{threshold:200,discount:30},{threshold:500,discount:80}], usedCount: 1234, stackable: true, priority: 10 });
  await db.insert('promotions', { id: 'prom_000002', name: '限时8折特惠', type: 'flash_sale', status: 'active', startAt: '2026-08-01T00:00:00Z', endAt: '2026-09-30T23:59:59Z', discountRate: 80, maxDiscountPerOrder: 500, usedCount: 567, stackable: false, priority: 5 });

  // === Promotion Items ===
  await db.insert('promotion_items', { id: 'pi_000001', promotionId: 'prom_000002', productId: 'prod_000001', productName: 'TechPro X1', originalPrice: 3999, promoPrice: 3199, discountRate: 80, stock: 100, sold: 45, limitPerUser: 2, status: 'active' });
  await db.insert('promotion_items', { id: 'pi_000002', promotionId: 'prom_000002', productId: 'prod_000006', productName: 'SoundWave 耳机', originalPrice: 299, promoPrice: 239, discountRate: 80, stock: 200, sold: 120, limitPerUser: 3, status: 'active' });


  return db;
}
