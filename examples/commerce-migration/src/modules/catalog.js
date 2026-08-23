/**
 * TLL Commerce - Catalog Module
 * Handles products, SKUs, categories, brands, and inventory.
 * This is the core product information management (PIM) module.
 */

import { CommerceDatabase } from '../data/database.js';
import { ok, created, notFound, badRequest, parseBody, parseQuery, paginate, toolSuccess, toolError } from '../utils.js';

export function registerCatalogModule(app) {
  const db = CommerceDatabase.getInstance();
  const mod = app.modules.create({
    name: 'commerce-catalog',
    version: '0.1.0',
    namespace: 'catalog',
    description: '商品目录管理：商品、SKU、分类、品牌、库存',
  });

  // ==================== Categories ====================
  mod.apis.create({
    method: 'GET', path: '/api/catalog/categories', name: 'listCategories',
    description: '获取分类列表（树形结构）',
    handler: async (ctx) => {
      const categories = await db.find('categories', c => c.status === 'active', { sort: ['sort', 'asc'] });
      const tree = buildCategoryTree(categories);
      return ok({ categories: tree });
    },
  });

  mod.apis.create({
    method: 'GET', path: '/api/catalog/categories/:id', name: 'getCategory',
    handler: async (ctx) => {
      const cat = await db.findById('categories', ctx.params.id);
      if (!cat) return notFound('分类不存在');
      return ok(cat);
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/catalog/categories', name: 'createCategory',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.name) return badRequest('分类名称必填');
      const cat = await db.insert('categories', {
        name: body.name, slug: body.slug || slugify(body.name),
        parentId: body.parentId || null, level: body.level || 1,
        sort: body.sort || 0, status: body.status || 'active', icon: body.icon || '',
      });
      return created(cat);
    },
  });

  // ==================== Brands ====================
  mod.apis.create({
    method: 'GET', path: '/api/catalog/brands', name: 'listBrands',
    handler: async () => ok({ brands: await db.find('brands', b => b.status === 'active') }),
  });

  mod.apis.create({
    method: 'GET', path: '/api/catalog/brands/:id', name: 'getBrand',
    handler: async (ctx) => {
      const brand = await db.findById('brands', ctx.params.id);
      if (!brand) return notFound('品牌不存在');
      return ok(brand);
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/catalog/brands', name: 'createBrand',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.name) return badRequest('品牌名称必填');
      const brand = await db.insert('brands', {
        name: body.name, slug: body.slug || slugify(body.name),
        description: body.description || '', logo: body.logo || '',
        country: body.country || 'CN', status: body.status || 'active',
      });
      return created(brand);
    },
  });

  // ==================== Products ====================
  mod.apis.create({
    method: 'GET', path: '/api/catalog/products', name: 'listProducts',
    description: '商品列表，支持分类、品牌、关键词、分页筛选',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let products = await db.find('products', p => p.status === 'active');
      if (q.categoryId) {
        const catIds = await getCategoryAndChildrenIds(db, q.categoryId);
        products = products.filter(p => catIds.includes(p.categoryId));
      }
      if (q.brandId) products = products.filter(p => p.brandId === q.brandId);
      if (q.keyword) {
        const kw = q.keyword.toLowerCase();
        products = products.filter(p => p.name.toLowerCase().includes(kw) || (p.description || '').toLowerCase().includes(kw));
      }
      if (q.minPrice) products = products.filter(p => p.price >= Number(q.minPrice));
      if (q.maxPrice) products = products.filter(p => p.price <= Number(q.maxPrice));
      if (q.sort === 'price_asc') products.sort((a, b) => a.price - b.price);
      else if (q.sort === 'price_desc') products.sort((a, b) => b.price - a.price);
      else products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const result = paginate(products, q.page, q.pageSize);
      // Enrich with brand and category names
      result.items = await Promise.all(result.items.map(p => enrichProduct(db, p)));
      return ok(result);
    },
  });

  mod.apis.create({
    method: 'GET', path: '/api/catalog/products/:id', name: 'getProduct',
    description: '商品详情，包含SKU列表',
    handler: async (ctx) => {
      const product = await db.findById('products', ctx.params.id);
      if (!product) return notFound('商品不存在');
      const skus = await db.find('skus', s => s.productId === product.id && s.status === 'active');
      const brand = await db.findById('brands', product.brandId);
      const category = await db.findById('categories', product.categoryId);
      return ok({ ...await enrichProduct(db, product), skus, brand, category });
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/catalog/products', name: 'createProduct',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.name || !body.price) return badRequest('商品名称和价格必填');
      const product = await db.insert('products', {
        name: body.name, slug: body.slug || slugify(body.name),
        brandId: body.brandId, categoryId: body.categoryId,
        price: Number(body.price), costPrice: Number(body.costPrice) || 0,
        status: body.status || 'active', description: body.description || '',
        shortDescription: body.shortDescription || '', images: body.images || [],
        weight: Number(body.weight) || 0, hasVariants: body.hasVariants || false,
        tags: body.tags || [], seoTitle: body.seoTitle || '', seoDescription: body.seoDescription || '',
      });
      return created(product);
    },
  });

  mod.apis.create({
    method: 'PUT', path: '/api/catalog/products/:id', name: 'updateProduct',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      const updated = await db.update('products', ctx.params.id, body);
      if (!updated) return notFound('商品不存在');
      return ok(updated);
    },
  });

  // ==================== SKUs ====================
  mod.apis.create({
    method: 'GET', path: '/api/catalog/products/:productId/skus', name: 'listProductSkus',
    handler: async (ctx) => {
      const skus = await db.find('skus', s => s.productId === ctx.params.productId && s.status === 'active');
      return ok({ skus });
    },
  });

  mod.apis.create({
    method: 'GET', path: '/api/catalog/skus/:id', name: 'getSku',
    handler: async (ctx) => {
      const sku = await db.findById('skus', ctx.params.id);
      if (!sku) return notFound('SKU不存在');
      const product = await db.findById('products', sku.productId);
      return ok({ ...sku, product });
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/catalog/skus', name: 'createSku',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.productId || !body.skuCode || !body.price) return badRequest('productId、skuCode、price必填');
      const sku = await db.insert('skus', {
        productId: body.productId, skuCode: body.skuCode, name: body.name || body.skuCode,
        attributes: body.attributes || {}, price: Number(body.price),
        costPrice: Number(body.costPrice) || 0, stock: Number(body.stock) || 0,
        status: body.status || 'active',
      });
      // Create inventory record
      await db.insert('inventory', { skuId: sku.id, warehouse: 'default', quantity: sku.stock, reserved: 0, safetyStock: 10 });
      return created(sku);
    },
  });

  // ==================== Inventory ====================
  mod.apis.create({
    method: 'GET', path: '/api/catalog/inventory/:skuId', name: 'getInventory',
    handler: async (ctx) => {
      const inv = await db.findOne('inventory', i => i.skuId === ctx.params.skuId);
      if (!inv) return notFound('库存记录不存在');
      return ok(inv);
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/catalog/inventory/:skuId/adjust', name: 'adjustInventory',
    description: '调整库存（入库/出库）',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      const delta = Number(body.delta);
      if (isNaN(delta)) return badRequest('delta必须是数字');
      const inv = await db.findOne('inventory', i => i.skuId === ctx.params.skuId);
      if (!inv) return notFound('库存记录不存在');
      const newQty = inv.quantity + delta;
      if (newQty < 0) return badRequest('库存不足');
      const updated = await db.update('inventory', inv.id, { quantity: newQty });
      // Sync SKU stock
      const sku = await db.findById('skus', ctx.params.skuId);
      if (sku) await db.update('skus', sku.id, { stock: newQty });
      return ok(updated);
    },
  });

  // ==================== Tools (for Agent) ====================
  mod.tools.create({
    name: 'catalog_search_products',
    description: '搜索商品，支持关键词、分类、品牌、价格范围筛选',
    category: 'catalog',
    parameters: { keyword: 'string', categoryId: 'string', brandId: 'string', minPrice: 'number', maxPrice: 'number', page: 'number', pageSize: 'number' },
    handler: async (params) => {
      let products = await db.find('products', p => p.status === 'active');
      if (params.categoryId) products = products.filter(p => p.categoryId === params.categoryId);
      if (params.brandId) products = products.filter(p => p.brandId === params.brandId);
      if (params.keyword) {
        const kw = params.keyword.toLowerCase();
        products = products.filter(p => p.name.toLowerCase().includes(kw));
      }
      if (params.minPrice) products = products.filter(p => p.price >= params.minPrice);
      if (params.maxPrice) products = products.filter(p => p.price <= params.maxPrice);
      const result = paginate(products, params.page, params.pageSize);
      return toolSuccess(result);
    },
  });

  mod.tools.create({
    name: 'catalog_get_product',
    description: '获取商品详情，包含SKU信息',
    category: 'catalog',
    parameters: { productId: 'string (required)' },
    handler: async (params) => {
      if (!params.productId) return toolError('productId必填');
      const product = await db.findById('products', params.productId);
      if (!product) return toolError('商品不存在');
      const skus = await db.find('skus', s => s.productId === product.id && s.status === 'active');
      return toolSuccess({ product, skus });
    },
  });

  mod.tools.create({
    name: 'catalog_create_product',
    description: '创建新商品',
    category: 'catalog',
    parameters: { name: 'string (required)', price: 'number (required)', brandId: 'string', categoryId: 'string', description: 'string' },
    handler: async (params) => {
      if (!params.name || !params.price) return toolError('name和price必填');
      const product = await db.insert('products', {
        name: params.name, slug: slugify(params.name), price: Number(params.price),
        brandId: params.brandId, categoryId: params.categoryId, description: params.description || '',
        status: 'active', images: [], tags: [],
      });
      return toolSuccess(product);
    },
  });

  mod.tools.create({
    name: 'catalog_check_stock',
    description: '检查SKU库存',
    category: 'catalog',
    parameters: { skuId: 'string (required)' },
    handler: async (params) => {
      if (!params.skuId) return toolError('skuId必填');
      const sku = await db.findById('skus', params.skuId);
      if (!sku) return toolError('SKU不存在');
      const inv = await db.findOne('inventory', i => i.skuId === params.skuId);
      return toolSuccess({ skuId: params.skuId, stock: sku.stock, available: inv ? inv.quantity - inv.reserved : sku.stock });
    },
  });

  // ==================== Tests ====================
  mod.tests.create({
    name: 'catalog - 商品列表和详情',
    test: async (ctx) => {
      const listResp = await ctx.application.apis.request('GET', '/api/catalog/products');
      ctx.assert.true(listResp.status === 200, '商品列表应返回200');
      const listBody = JSON.parse(listResp.body);
      ctx.assert.true(listBody.items.length > 0, '应有商品数据');

      const productId = listBody.items[0].id;
      const detailResp = await ctx.application.apis.request('GET', `/api/catalog/products/${productId}`);
      ctx.assert.true(detailResp.status === 200, '商品详情应返回200');
      const detail = JSON.parse(detailResp.body);
      ctx.assert.true(detail.id === productId, '详情ID应匹配');
      ctx.assert.true(Array.isArray(detail.skus), '应包含SKU列表');
    },
  });

  mod.tests.create({
    name: 'catalog - 分类树形结构',
    test: async (ctx) => {
      const resp = await ctx.application.apis.request('GET', '/api/catalog/categories');
      ctx.assert.true(resp.status === 200);
      const body = JSON.parse(resp.body);
      ctx.assert.true(Array.isArray(body.categories), '应返回分类数组');
      ctx.assert.true(body.categories.length > 0, '应有分类数据');
      // Root categories should have level 1
      ctx.assert.true(body.categories.every(c => c.level === 1), '根分类level应为1');
    },
  });

  mod.tests.create({
    name: 'catalog - 库存调整',
    test: async (ctx) => {
      const sku = (await db.find('skus', s => s.status === 'active'))[0];
      ctx.assert.true(sku, '应有SKU数据');
      const inv = await db.findOne('inventory', i => i.skuId === sku.id);
      ctx.assert.true(inv, '应有库存记录');
      const originalQty = inv.quantity;
      const resp = await ctx.application.apis.request('POST', `/api/catalog/inventory/${sku.id}/adjust`, JSON.stringify({ delta: 5 }));
      ctx.assert.true(resp.status === 200, '库存调整应成功');
      const updatedInv = await db.findOne('inventory', i => i.skuId === sku.id);
      ctx.assert.true(updatedInv.quantity === originalQty + 5, '库存数量应增加5');
      const updatedSku = await db.findById('skus', sku.id);
      ctx.assert.true(updatedSku.stock === originalQty + 5, 'SKU库存应同步增加5');
    },
  });

  return mod;
}

// ==================== Helpers ====================
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80) || 'product';
}

function buildCategoryTree(categories) {
  const map = {};
  const roots = [];
  for (const cat of categories) {
    map[cat.id] = { ...cat, children: [] };
  }
  for (const cat of categories) {
    if (cat.parentId && map[cat.parentId]) {
      map[cat.parentId].children.push(map[cat.id]);
    } else {
      roots.push(map[cat.id]);
    }
  }
  return roots;
}

async function getCategoryAndChildrenIds(db, categoryId) {
  const ids = [categoryId];
  const children = await db.find('categories', c => c.parentId === categoryId);
  for (const child of children) {
    ids.push(...await getCategoryAndChildrenIds(db, child.id));
  }
  return ids;
}

async function enrichProduct(db, product) {
  const brand = await db.findById('brands', product.brandId);
  const category = await db.findById('categories', product.categoryId);
  const skuCount = await db.count('skus', s => s.productId === product.id && s.status === 'active');
  return {
    ...product,
    brandName: brand?.name || '',
    categoryName: category?.name || '',
    skuCount,
  };
}
