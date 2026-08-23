/**
 * TLL Commerce - Supplier Module (供应商管理)
 * 供应商、供应商商品关联、采购单
 */
import { CommerceDatabase } from '../data/database.js';
import { ok, created, notFound, badRequest, parseBody, parseQuery } from '../utils.js';

export function registerSupplierModule(app) {
  const module = app.modules.create({
    name: 'commerce-supplier',
    version: '0.1.0',
    namespace: 'supplier',
    description: '供应商模块：供应商管理、供应商商品、采购单',
  });
  const db = CommerceDatabase.getInstance();

  // ===== APIs =====

  // 供应商列表
  module.apis.create({
    method: 'GET', path: '/api/supplier/suppliers', name: 'list_suppliers',
    description: '获取供应商列表',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let items = await db.find('suppliers');
      if (q.keyword) items = items.filter(i => i.name.includes(q.keyword) || i.contact.includes(q.keyword));
      if (q.status) items = items.filter(i => i.status === q.status);
      return ok({ items, total: items.length });
    },
  });

  // 供应商详情
  module.apis.create({
    method: 'GET', path: '/api/supplier/suppliers/:id', name: 'get_supplier',
    description: '获取供应商详情',
    handler: async (ctx) => {
      const item = await db.findById('suppliers', ctx.params.id);
      if (!item) return notFound('Supplier not found');
      const products = (await db.find('supplier_products')).filter(sp => sp.supplierId === item.id);
      return ok({ ...item, products });
    },
  });

  // 创建供应商
  module.apis.create({
    method: 'POST', path: '/api/supplier/suppliers', name: 'create_supplier',
    description: '创建供应商',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.name) return badRequest('name is required');
      const item = await db.insert('suppliers', {
        name: body.name,
        code: body.code || `SUP${Date.now()}`,
        contact: body.contact || '',
        phone: body.phone || '',
        email: body.email || '',
        address: body.address || {},
        country: body.country || 'CN',
        settlementMethod: body.settlementMethod || 'monthly', // monthly/weekly/prepaid/cod
        creditLimit: body.creditLimit || 0,
        usedCredit: 0,
        currency: body.currency || 'CNY',
        taxRate: body.taxRate || 13,
        bankAccount: body.bankAccount || {},
        status: body.status || 'active', // active/inactive/blacklisted
        rating: body.rating || 5,
        notes: body.notes || '',
      });
      return created(item);
    },
  });

  // 更新供应商
  module.apis.create({
    method: 'PUT', path: '/api/supplier/suppliers/:id', name: 'update_supplier',
    description: '更新供应商',
    handler: async (ctx) => {
      const item = await db.findById('suppliers', ctx.params.id);
      if (!item) return notFound('Supplier not found');
      const body = parseBody(ctx);
      const updated = await db.update('suppliers', ctx.params.id, body);
      return ok(updated);
    },
  });

  // 供应商商品关联列表
  module.apis.create({
    method: 'GET', path: '/api/supplier/suppliers/:id/products', name: 'list_supplier_products',
    description: '获取供应商的商品列表',
    handler: async (ctx) => {
      const items = (await db.find('supplier_products')).filter(sp => sp.supplierId === ctx.params.id);
      const enriched = await Promise.all(items.map(async sp => {
        const product = await db.findById('products', sp.productId);
        return { ...sp, productName: product?.name, productSku: product?.skuCode };
      }));
      return ok({ items: enriched, total: enriched.length });
    },
  });

  // 添加供应商商品
  module.apis.create({
    method: 'POST', path: '/api/supplier/supplier-products', name: 'create_supplier_product',
    description: '添加供应商商品关联',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.supplierId || !body.productId) return badRequest('supplierId and productId are required');
      const item = await db.insert('supplier_products', {
        supplierId: body.supplierId,
        productId: body.productId,
        supplierSku: body.supplierSku || '',
        purchasePrice: body.purchasePrice || 0,
        moq: body.moq || 1, // 最小起订量
        leadTime: body.leadTime || 7, // 交货期（天）
        currency: body.currency || 'CNY',
        isPrimary: body.isPrimary !== false,
        status: body.status || 'active',
      });
      return created(item);
    },
  });

  // 采购单列表
  module.apis.create({
    method: 'GET', path: '/api/supplier/purchase-orders', name: 'list_purchase_orders',
    description: '获取采购单列表',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let items = await db.find('purchase_orders');
      if (q.supplierId) items = items.filter(i => i.supplierId === q.supplierId);
      if (q.status) items = items.filter(i => i.status === q.status);
      return ok({ items, total: items.length });
    },
  });

  // 创建采购单
  module.apis.create({
    method: 'POST', path: '/api/supplier/purchase-orders', name: 'create_purchase_order',
    description: '创建采购单',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.supplierId || !body.items || !body.items.length) return badRequest('supplierId and items are required');
      const supplier = await db.findById('suppliers', body.supplierId);
      if (!supplier) return notFound('Supplier not found');

      let totalAmount = 0;
      const items = await Promise.all(body.items.map(async it => {
        const sp = (await db.find('supplier_products')).find(x => x.supplierId === body.supplierId && x.productId === it.productId);
        const price = it.price || sp?.purchasePrice || 0;
        const amount = price * it.quantity;
        totalAmount += amount;
        const prod = await db.findById('products', it.productId);
        return {
          productId: it.productId,
          productName: it.productName || prod?.name || '',
          supplierSku: sp?.supplierSku || '',
          quantity: it.quantity,
          price,
          amount,
          receivedQuantity: 0,
        };
      }));

      const po = await db.insert('purchase_orders', {
        poNo: `PO${Date.now()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
        supplierId: body.supplierId,
        supplierName: supplier.name,
        items,
        totalAmount,
        currency: body.currency || supplier.currency || 'CNY',
        status: 'draft', // draft/submitted/confirmed/shipped/received/closed/cancelled
        expectedDate: body.expectedDate || '',
        warehouse: body.warehouse || 'default',
        notes: body.notes || '',
        createdBy: body.createdBy || 'system',
      });
      return created(po);
    },
  });

  // 采购单详情
  module.apis.create({
    method: 'GET', path: '/api/supplier/purchase-orders/:id', name: 'get_purchase_order',
    description: '获取采购单详情',
    handler: async (ctx) => {
      const item = await db.findById('purchase_orders', ctx.params.id);
      if (!item) return notFound('Purchase order not found');
      return ok(item);
    },
  });

  // 更新采购单状态
  module.apis.create({
    method: 'PUT', path: '/api/supplier/purchase-orders/:id/status', name: 'update_po_status',
    description: '更新采购单状态（提交/确认/发货/收货/关闭）',
    handler: async (ctx) => {
      const po = await db.findById('purchase_orders', ctx.params.id);
      if (!po) return notFound('Purchase order not found');
      const body = parseBody(ctx);
      const validTransitions = {
        draft: ['submitted', 'cancelled'],
        submitted: ['confirmed', 'cancelled'],
        confirmed: ['shipped', 'cancelled'],
        shipped: ['received'],
        received: ['closed'],
      };
      const allowed = validTransitions[po.status] || [];
      if (!allowed.includes(body.status)) return badRequest(`Invalid status transition: ${po.status} -> ${body.status}`);
      const updated = await db.update('purchase_orders', ctx.params.id, { status: body.status, ...(body.status === 'received' ? { receivedAt: new Date().toISOString() } : {}) });
      return ok(updated);
    },
  });

  // ===== Tools =====

  module.tools.create({
    name: 'supplier_list',
    description: '获取供应商列表',
    category: 'supplier',
    parameters: { type: 'object', properties: { keyword: { type: 'string' }, status: { type: 'string' } } },
    handler: async (params) => {
      const qs = new URLSearchParams(params).toString();
      const resp = await module._app.apis.request('GET', '/suppliers' + (qs ? '?' + qs : ''));
      return resp.body;
    },
  });

  module.tools.create({
    name: 'supplier_create_po',
    description: '创建采购单',
    category: 'supplier',
    parameters: {
      type: 'object',
      properties: {
        supplierId: { type: 'string' },
        items: { type: 'array', items: { type: 'object', properties: { productId: { type: 'string' }, quantity: { type: 'number' }, price: { type: 'number' } } } },
        expectedDate: { type: 'string' },
      },
      required: ['supplierId', 'items'],
    },
    handler: async (params) => {
      const resp = await module._app.apis.request('POST', '/purchase-orders', params);
      return resp.body;
    },
  });

  // ===== Tests =====

  module.tests.create({
    name: 'supplier - 供应商CRUD',
    moduleName: 'commerce-supplier',
    test: async (ctx) => {
      const { assert, application } = ctx;
      const api = async (m, p, b) => { const r = await application.apis.request(m, p, b); return { status: r.status, data: JSON.parse(r.body) }; };

      const createResp = await api('POST', '/api/supplier/suppliers', { name: '深圳电子科技有限公司', contact: '张经理', phone: '13900000001', creditLimit: 50000, settlementMethod: 'monthly' });
      assert.equal(createResp.status, 201, 'should create supplier');
      const supplierId = createResp.data.id;

      const listResp = await api('GET', '/api/supplier/suppliers');
      assert.true(listResp.data.items && listResp.data.items.length > 0, 'should list suppliers');

      const getResp = await api('GET', `/api/supplier/suppliers/${supplierId}`);
      assert.equal(getResp.data.name, '深圳电子科技有限公司', 'should get supplier detail');

      const updateResp = await api('PUT', `/api/supplier/suppliers/${supplierId}`, { contact: '李经理' });
      assert.equal(updateResp.data.contact, '李经理', 'should update supplier');
    },
  });

  module.tests.create({
    name: 'supplier - 采购单流程',
    moduleName: 'commerce-supplier',
    test: async (ctx) => {
      const { assert, application } = ctx;
      const api = async (m, p, b) => { const r = await application.apis.request(m, p, b); return { status: r.status, data: JSON.parse(r.body) }; };

      const supResp = await api('POST', '/api/supplier/suppliers', { name: '义乌小商品供应商', contact: '王总', phone: '13900000002' });
      const supplierId = supResp.data.id;

      await api('POST', '/api/supplier/supplier-products', { supplierId, productId: 'prod_000001', purchasePrice: 2500, moq: 10, leadTime: 14 });

      const poResp = await api('POST', '/api/supplier/purchase-orders', { supplierId, items: [{ productId: 'prod_000001', quantity: 20, price: 2500 }], expectedDate: '2026-09-15' });
      assert.equal(poResp.status, 201, 'should create PO');
      assert.equal(poResp.data.totalAmount, 50000, 'PO total should be 50000');
      assert.equal(poResp.data.status, 'draft', 'PO status should be draft');

      await api('PUT', `/api/supplier/purchase-orders/${poResp.data.id}/status`, { status: 'submitted' });
      await api('PUT', `/api/supplier/purchase-orders/${poResp.data.id}/status`, { status: 'confirmed' });
      const detailResp = await api('GET', `/api/supplier/purchase-orders/${poResp.data.id}`);
      assert.equal(detailResp.data.status, 'confirmed', 'PO should be confirmed');
    },
  });

  return module;
}
