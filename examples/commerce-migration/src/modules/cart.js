/**
 * TLL Commerce - Cart Module
 * Shopping cart management: add/remove items, update quantities, price calculation.
 */

import { CommerceDatabase } from '../data/database.js';
import { ok, created, notFound, badRequest, parseBody, toolSuccess, toolError } from '../utils.js';

export function registerCartModule(app) {
  const db = CommerceDatabase.getInstance();
  const mod = app.modules.create({
    name: 'commerce-cart',
    version: '0.1.0',
    namespace: 'cart',
    description: '购物车管理：添加、删除、修改数量、价格计算',
  });

  // ==================== APIs ====================
  mod.apis.create({
    method: 'GET', path: '/api/cart', name: 'getCart',
    description: '获取当前用户购物车',
    handler: async (ctx) => {
      const userId = ctx.query?.userId || 'guest';
      const cart = await getOrCreateCart(db, userId);
      return ok(await enrichCart(db, cart));
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/cart/items', name: 'addToCart',
    description: '添加商品到购物车',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      const userId = body.userId || ctx.query?.userId || 'guest';
      if (!body.skuId || !body.quantity) return badRequest('skuId和quantity必填');
      const sku = await db.findById('skus', body.skuId);
      if (!sku || sku.status !== 'active') return notFound('SKU不存在或已下架');
      const qty = Number(body.quantity);
      if (qty <= 0) return badRequest('数量必须大于0');
      if (qty > sku.stock) return badRequest('库存不足');

      const cart = await getOrCreateCart(db, userId);
      const existing = await db.findOne('cart_items', i => i.cartId === cart.id && i.skuId === body.skuId);
      if (existing) {
        const newQty = existing.quantity + qty;
        if (newQty > sku.stock) return badRequest('库存不足');
        await db.update('cart_items', existing.id, { quantity: newQty });
      } else {
        await db.insert('cart_items', { cartId: cart.id, skuId: body.skuId, quantity: qty, price: sku.price });
      }
      const updated = await enrichCart(db, cart);
      return ok(updated);
    },
  });

  mod.apis.create({
    method: 'PUT', path: '/api/cart/items/:itemId', name: 'updateCartItem',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      const item = await db.findById('cart_items', ctx.params.itemId);
      if (!item) return notFound('购物车项不存在');
      if (body.quantity !== undefined) {
        const qty = Number(body.quantity);
        if (qty <= 0) {
          await db.remove('cart_items', ctx.params.itemId);
        } else {
          const sku = await db.findById('skus', item.skuId);
          if (qty > (sku?.stock || 0)) return badRequest('库存不足');
          await db.update('cart_items', ctx.params.itemId, { quantity: qty });
        }
      }
      const cart = await db.findById('carts', item.cartId);
      return ok(await enrichCart(db, cart));
    },
  });

  mod.apis.create({
    method: 'DELETE', path: '/api/cart/items/:itemId', name: 'removeCartItem',
    handler: async (ctx) => {
      const item = await db.findById('cart_items', ctx.params.itemId);
      if (!item) return notFound('购物车项不存在');
      const cartId = item.cartId;
      await db.remove('cart_items', ctx.params.itemId);
      const cart = await db.findById('carts', cartId);
      return ok(await enrichCart(db, cart));
    },
  });

  mod.apis.create({
    method: 'POST', path: '/api/cart/clear', name: 'clearCart',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      const userId = body.userId || ctx.query?.userId || 'guest';
      const cart = await db.findOne('carts', c => c.userId === userId);
      if (cart) {
        const items = await db.find('cart_items', i => i.cartId === cart.id);
        for (const item of items) await db.remove('cart_items', item.id);
      }
      return ok({ success: true });
    },
  });

  // ==================== Tools ====================
  mod.tools.create({
    name: 'cart_add',
    description: '添加商品到购物车',
    category: 'cart',
    parameters: { userId: 'string', skuId: 'string (required)', quantity: 'number (required)' },
    handler: async (params) => {
      if (!params.skuId || !params.quantity) return toolError('skuId和quantity必填');
      const sku = await db.findById('skus', params.skuId);
      if (!sku) return toolError('SKU不存在');
      const userId = params.userId || 'guest';
      const cart = await getOrCreateCart(db, userId);
      const existing = await db.findOne('cart_items', i => i.cartId === cart.id && i.skuId === params.skuId);
      if (existing) {
        await db.update('cart_items', existing.id, { quantity: existing.quantity + Number(params.quantity) });
      } else {
        await db.insert('cart_items', { cartId: cart.id, skuId: params.skuId, quantity: Number(params.quantity), price: sku.price });
      }
      return toolSuccess(await enrichCart(db, cart));
    },
  });

  mod.tools.create({
    name: 'cart_get',
    description: '获取购物车详情',
    category: 'cart',
    parameters: { userId: 'string' },
    handler: async (params) => {
      const userId = params.userId || 'guest';
      const cart = await getOrCreateCart(db, userId);
      return toolSuccess(await enrichCart(db, cart));
    },
  });

  mod.tools.create({
    name: 'cart_clear',
    description: '清空购物车',
    category: 'cart',
    parameters: { userId: 'string' },
    handler: async (params) => {
      const userId = params.userId || 'guest';
      const cart = await db.findOne('carts', c => c.userId === userId);
      if (cart) {
        const items = await db.find('cart_items', i => i.cartId === cart.id);
        for (const item of items) await db.remove('cart_items', item.id);
      }
      return toolSuccess({ success: true });
    },
  });

  // ==================== Tests ====================
  mod.tests.create({
    name: 'cart - 添加和获取购物车',
    test: async (ctx) => {
      const sku = (await db.find('skus', s => s.status === 'active'))[0];
      ctx.assert.true(sku, '应有SKU');
      const userId = 'test_cart_' + Date.now();

      const addResp = await ctx.application.apis.request('POST', '/api/cart/items',
        JSON.stringify({ userId, skuId: sku.id, quantity: 2 }));
      ctx.assert.true(addResp.status === 200, '添加购物车应返回200');
      const addBody = JSON.parse(addResp.body);
      ctx.assert.true(addBody.items.length === 1, '购物车应有1件商品');
      ctx.assert.true(addBody.totalQuantity === 2, '总数量应为2');

      const getResp = await ctx.application.apis.request('GET', `/api/cart?userId=${userId}`);
      ctx.assert.true(getResp.status === 200);
      const getBody = JSON.parse(getResp.body);
      ctx.assert.true(getBody.items.length === 1, '获取购物车应有1件商品');
    },
  });

  mod.tests.create({
    name: 'cart - 修改数量和删除',
    test: async (ctx) => {
      const sku = (await db.find('skus', s => s.status === 'active'))[0];
      const userId = 'test_cart2_' + Date.now();
      const addResp = await ctx.application.apis.request('POST', '/api/cart/items',
        JSON.stringify({ userId, skuId: sku.id, quantity: 1 }));
      const cart = JSON.parse(addResp.body);
      const itemId = cart.items[0].id;

      const updateResp = await ctx.application.apis.request('PUT', `/api/cart/items/${itemId}`,
        JSON.stringify({ quantity: 5 }));
      ctx.assert.true(updateResp.status === 200);
      const updated = JSON.parse(updateResp.body);
      ctx.assert.true(updated.totalQuantity === 5, '数量应更新为5');

      const delResp = await ctx.application.apis.request('DELETE', `/api/cart/items/${itemId}`);
      ctx.assert.true(delResp.status === 200);
      const afterDel = JSON.parse(delResp.body);
      ctx.assert.true(afterDel.items.length === 0, '删除后购物车应为空');
    },
  });

  return mod;
}

// ==================== Helpers ====================
async function getOrCreateCart(db, userId) {
  let cart = await db.findOne('carts', c => c.userId === userId);
  if (!cart) {
    cart = await db.insert('carts', { userId, status: 'active' });
  }
  return cart;
}

async function enrichCart(db, cart) {
  const items = await db.find('cart_items', i => i.cartId === cart.id);
  const enriched = await Promise.all(items.map(async item => {
    const sku = await db.findById('skus', item.skuId);
    const product = sku ? await db.findById('products', sku.productId) : null;
    return {
      ...item,
      sku,
      productName: product?.name || '',
      productImage: product?.images?.[0] || '',
      subtotal: item.quantity * item.price,
    };
  }));
  const totalAmount = enriched.reduce((sum, i) => sum + i.subtotal, 0);
  const totalQuantity = enriched.reduce((sum, i) => sum + i.quantity, 0);
  return { ...cart, items: enriched, totalAmount, totalQuantity, itemCount: enriched.length };
}
