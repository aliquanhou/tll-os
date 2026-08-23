/**
 * TLL Commerce - Shipping Module (跨境物流)
 * 物流方式、物流区域、运费模板、发货记录、物流轨迹
 */
import { CommerceDatabase } from '../data/database.js';
import { ok, created, notFound, badRequest, parseBody, parseQuery } from '../utils.js';

export function registerShippingModule(app) {
  const module = app.modules.create({
    name: 'commerce-shipping',
    version: '0.1.0',
    namespace: 'shipping',
    description: '跨境物流模块：物流方式、运费模板、发货、轨迹追踪',
  });
  const db = CommerceDatabase.getInstance();

  // ===== APIs =====

  // 物流方式列表
  module.apis.create({
    method: 'GET', path: '/api/shipping/methods', name: 'list_shipping_methods',
    description: '获取物流方式列表',
    handler: async (ctx) => {
      const items = await db.find('shipping_methods');
      return ok({ items, total: items.length });
    },
  });

  // 创建物流方式
  module.apis.create({
    method: 'POST', path: '/api/shipping/methods', name: 'create_shipping_method',
    description: '创建物流方式',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.name) return badRequest('name is required');
      const item = await db.insert('shipping_methods', {
        name: body.name,
        code: body.code || body.name.toLowerCase().replace(/\s+/g, '_'),
        type: body.type || 'standard', // standard/express/sea/air/economy
        carrier: body.carrier || '',
        estimatedDays: body.estimatedDays || '7-15',
        trackingSupported: body.trackingSupported !== false,
        enabled: body.enabled !== false,
        sort: body.sort || 0,
      });
      return created(item);
    },
  });

  // 物流区域列表
  module.apis.create({
    method: 'GET', path: '/api/shipping/zones', name: 'list_shipping_zones',
    description: '获取物流区域列表',
    handler: async (ctx) => {
      const items = await db.find('shipping_zones');
      return ok({ items, total: items.length });
    },
  });

  // 创建物流区域
  module.apis.create({
    method: 'POST', path: '/api/shipping/zones', name: 'create_shipping_zone',
    description: '创建物流区域（国家分组）',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.name) return badRequest('name is required');
      const item = await db.insert('shipping_zones', {
        name: body.name,
        countries: body.countries || [], // ['CN','US','JP',...]
        region: body.region || 'other', // domestic/asia/europe/namerica/other
        taxRate: body.taxRate || 0, // 关税税率
        enabled: body.enabled !== false,
      });
      return created(item);
    },
  });

  // 运费规则列表
  module.apis.create({
    method: 'GET', path: '/api/shipping/rates', name: 'list_shipping_rates',
    description: '获取运费规则列表',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let items = await db.find('shipping_rates');
      if (q.zoneId) items = items.filter(i => i.zoneId === q.zoneId);
      if (q.methodId) items = items.filter(i => i.methodId === q.methodId);
      return ok({ items, total: items.length });
    },
  });

  // 创建运费规则
  module.apis.create({
    method: 'POST', path: '/api/shipping/rates', name: 'create_shipping_rate',
    description: '创建运费规则',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.zoneId || !body.methodId) return badRequest('zoneId and methodId are required');
      const item = await db.insert('shipping_rates', {
        zoneId: body.zoneId,
        methodId: body.methodId,
        pricingType: body.pricingType || 'weight', // weight/value/fixed
        basePrice: body.basePrice || 0,
        perKg: body.perKg || 0,
        perItem: body.perItem || 0,
        freeThreshold: body.freeThreshold || 0, // 满多少免运费
        minWeight: body.minWeight || 0,
        maxWeight: body.maxWeight || 999,
        enabled: body.enabled !== false,
      });
      return created(item);
    },
  });

  // 计算运费（核心）
  module.apis.create({
    method: 'POST', path: '/api/shipping/calculate', name: 'calculate_shipping',
    description: '计算运费（根据目的国、重量、金额、物流方式）',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      const { country = 'CN', weight = 0, orderAmount = 0, methodId } = body;
      if (weight <= 0) return badRequest('weight must be > 0');

      // 找到目的国所属区域
      const zones = (await db.find('shipping_zones')).filter(z => z.countries.includes(country));
      const zone = zones[0] || (await db.find('shipping_zones')).find(z => z.region === 'other');
      if (!zone) return ok({ country, weight, orderAmount, shippingFee: 0, tax: 0, total: orderAmount, method: null, zone: null, freeShipping: true });

      // 找到匹配的运费规则
      let rates = (await db.find('shipping_rates')).filter(r => r.zoneId === zone.id && r.enabled);
      if (methodId) rates = rates.filter(r => r.methodId === methodId);

      const results = await Promise.all(rates.map(async rate => {
        const method = await db.findById('shipping_methods', rate.methodId);
        let shippingFee = 0;
        let freeShipping = false;

        // 免运费阈值
        if (rate.freeThreshold > 0 && orderAmount >= rate.freeThreshold) {
          shippingFee = 0;
          freeShipping = true;
        } else if (rate.pricingType === 'fixed') {
          shippingFee = rate.basePrice;
        } else if (rate.pricingType === 'weight') {
          shippingFee = rate.basePrice + (weight / 1000) * rate.perKg;
        } else if (rate.pricingType === 'value') {
          shippingFee = rate.basePrice + (orderAmount * rate.perItem / 100);
        }

        // 关税计算（跨境）
        const tax = zone.taxRate > 0 ? Math.round(orderAmount * zone.taxRate / 100) : 0;

        return {
          methodId: rate.methodId,
          methodName: method?.name || 'Unknown',
          methodType: method?.type,
          estimatedDays: method?.estimatedDays,
          shippingFee: Math.round(shippingFee * 100) / 100,
          tax,
          total: Math.round((orderAmount + shippingFee + tax) * 100) / 100,
          freeShipping,
          zone: zone.name,
          country,
        };
      }));

      results.sort((a, b) => a.shippingFee - b.shippingFee);
      return ok({ country, weight, orderAmount, options: results, recommended: results[0] || null });
    },
  });

  // 创建发货记录
  module.apis.create({
    method: 'POST', path: '/api/shipping/shipments', name: 'create_shipment',
    description: '创建发货记录',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.orderId) return badRequest('orderId is required');
      const order = await db.findById('orders', body.orderId);
      if (!order) return notFound('Order not found');

      const method = await db.findById('shipping_methods', body.methodId);
      const shipment = await db.insert('shipments', {
        orderId: body.orderId,
        orderNo: order.orderNo,
        methodId: body.methodId,
        methodName: method?.name || body.methodName || '标准快递',
        trackingNo: body.trackingNo || `TRK${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        carrier: method?.carrier || body.carrier || '',
        status: 'created', // created/picked/in_transit/customs/delivered/failed
        senderAddress: body.senderAddress || {},
        receiverAddress: body.receiverAddress || order.shippingAddress || {},
        weight: body.weight || 0,
        shippingFee: body.shippingFee || 0,
        insuranceFee: body.insuranceFee || 0,
        trackingHistory: [{ status: 'created', location: '仓库', description: '订单已创建发货单', time: new Date().toISOString() }],
        estimatedDelivery: body.estimatedDelivery || '',
      });

      // 更新订单状态为已发货
      if (order.status === 'paid') {
        await db.update('orders', body.orderId, { status: 'shipped', shippedAt: new Date().toISOString(), shipmentId: shipment.id });
      }
      return created(shipment);
    },
  });

  // 获取发货详情
  module.apis.create({
    method: 'GET', path: '/api/shipping/shipments/:id', name: 'get_shipment',
    description: '获取发货详情和轨迹',
    handler: async (ctx) => {
      const item = await db.findById('shipments', ctx.params.id);
      if (!item) return notFound('Shipment not found');
      return ok(item);
    },
  });

  // 添加物流轨迹
  module.apis.create({
    method: 'POST', path: '/api/shipping/shipments/:id/track', name: 'add_tracking',
    description: '添加物流轨迹节点',
    handler: async (ctx) => {
      const shipment = await db.findById('shipments', ctx.params.id);
      if (!shipment) return notFound('Shipment not found');
      const body = parseBody(ctx);
      const track = {
        status: body.status || shipment.status,
        location: body.location || '',
        description: body.description || '',
        time: new Date().toISOString(),
      };
      const history = [...(shipment.trackingHistory || []), track];
      const updated = await db.update('shipments', ctx.params.id, {
        status: body.status || shipment.status,
        trackingHistory: history,
        currentLocation: body.location || shipment.currentLocation,
      });
      return ok(updated);
    },
  });

  // 发货列表
  module.apis.create({
    method: 'GET', path: '/api/shipping/shipments', name: 'list_shipments',
    description: '获取发货记录列表',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      let items = await db.find('shipments');
      if (q.orderId) items = items.filter(i => i.orderId === q.orderId);
      if (q.status) items = items.filter(i => i.status === q.status);
      return ok({ items, total: items.length });
    },
  });

  // ===== Tools =====

  module.tools.create({
    name: 'shipping_calculate',
    description: '计算跨境运费（根据目的国、重量、订单金额）',
    category: 'shipping',
    parameters: {
      type: 'object',
      properties: {
        country: { type: 'string', description: '目的国家代码，如 CN/US/JP' },
        weight: { type: 'number', description: '重量（克）' },
        orderAmount: { type: 'number', description: '订单金额' },
        methodId: { type: 'string', description: '指定物流方式ID（可选）' },
      },
      required: ['country', 'weight', 'orderAmount'],
    },
    handler: async (params) => {
      const resp = await module._app.apis.request('POST', '/shipping/calculate', params);
      return resp.body;
    },
  });

  module.tools.create({
    name: 'shipping_create_shipment',
    description: '为订单创建发货记录',
    category: 'shipping',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        methodId: { type: 'string' },
        trackingNo: { type: 'string' },
        weight: { type: 'number' },
      },
      required: ['orderId'],
    },
    handler: async (params) => {
      const resp = await module._app.apis.request('POST', '/shipping/shipments', params);
      return resp.body;
    },
  });

  module.tools.create({
    name: 'shipping_track',
    description: '查询发货物流轨迹',
    category: 'shipping',
    parameters: {
      type: 'object',
      properties: { shipmentId: { type: 'string' } },
      required: ['shipmentId'],
    },
    handler: async (params) => {
      const resp = await module._app.apis.request('GET', `/shipping/shipments/${params.shipmentId}`);
      return resp.body;
    },
  });

  // ===== Tests =====

  module.tests.create({
    name: 'shipping - 运费计算',
    moduleName: 'commerce-shipping',
    test: async (ctx) => {
      const { assert, application } = ctx;
      const api = async (m, p, b) => { const r = await application.apis.request(m, p, b); return { status: r.status, data: JSON.parse(r.body) }; };

      // 创建物流方式和区域
      await api('POST', '/api/shipping/methods', { name: '测试空运', code: 'test_air', type: 'air', estimatedDays: '3-7' });
      const methodsResp = await api('GET', '/api/shipping/methods');
      assert.true(methodsResp.data.items && methodsResp.data.items.length > 0, 'should have shipping methods');
      const methodId = methodsResp.data.items[0].id;

      await api('POST', '/api/shipping/zones', { name: '测试区', countries: ['US', 'CA'], region: 'test', taxRate: 5 });
      const zonesResp = await api('GET', '/api/shipping/zones');
      const zoneId = zonesResp.data.items[0].id;

      await api('POST', '/api/shipping/rates', { zoneId, methodId, pricingType: 'weight', basePrice: 30, perKg: 80, freeThreshold: 500 });

      // 计算运费
      const result = await api('POST', '/api/shipping/calculate', { country: 'US', weight: 2000, orderAmount: 300 });
      assert.true(result.data.recommended, 'should have recommended shipping');
      assert.true(result.data.recommended.shippingFee > 0, 'shipping fee should be > 0');

      // 免运费
      const freeResult = await api('POST', '/api/shipping/calculate', { country: 'US', weight: 2000, orderAmount: 600 });
      assert.true(freeResult.data.recommended.freeShipping === true, 'should be free shipping over threshold');
    },
  });

  module.tests.create({
    name: 'shipping - 发货和轨迹',
    moduleName: 'commerce-shipping',
    test: async (ctx) => {
      const { assert, application } = ctx;
      const api = async (m, p, b) => { const r = await application.apis.request(m, p, b); return { status: r.status, data: JSON.parse(r.body) }; };

      const methodsResp = await api('GET', '/api/shipping/methods');
      const methodId = methodsResp.data.items[0]?.id;
      assert.true(methodId, 'should have a shipping method');

      // 直接在数据库创建测试订单（避免跨模块依赖）
      await db.insert('orders', {
        id: 'order_ship_test_001', orderNo: 'ORDSHIPTEST001',
        userId: 'test_user', status: 'paid', totalAmount: 500,
        shippingAddress: { recipient: '测试', phone: '13800000000', province: '广东', city: '深圳' },
      });

      // 创建发货
      const shipResp = await api('POST', '/api/shipping/shipments', { orderId: 'order_ship_test_001', methodId, weight: 500 });
      assert.equal(shipResp.status, 201, 'should create shipment');
      assert.true(shipResp.data.trackingNo, 'should have tracking number');
      assert.equal(shipResp.data.status, 'created', 'shipment status should be created');

      // 添加轨迹
      const trackResp = await api('POST', `/api/shipping/shipments/${shipResp.data.id}/track`, { status: 'in_transit', location: '深圳转运中心', description: '包裹已到达' });
      assert.equal(trackResp.status, 200, 'should add tracking');
      assert.equal(trackResp.data.status, 'in_transit', 'status should be updated');

      // 查询详情
      const detailResp = await api('GET', `/api/shipping/shipments/${shipResp.data.id}`);
      assert.true(detailResp.data.trackingHistory && detailResp.data.trackingHistory.length >= 2, 'should have tracking history');
    },
  });

  return module;
}
