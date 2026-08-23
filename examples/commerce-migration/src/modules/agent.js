/**
 * TLL Commerce - Agent Module
 * Provides Agent-facing tools and orchestrates the end-to-end shopping workflow.
 * This module demonstrates how an Agent can use TLL OS Tools to complete a full
 * commerce workflow: search product -> add to cart -> create order -> pay -> view order.
 */

import { CommerceDatabase } from '../data/database.js';
import { toolSuccess, toolError } from '../utils.js';

// TLL OS 0.2 compatibility: app.tools.invoke doesn't exist, use get().invoke()
function makeInvokeTool(app) {
  return async (name, args) => {
    const tool = app.tools.get(name);
    if (!tool) return { success: false, error: `Tool ${name} not found`, data: null };
    return tool.invoke(args || {});
  };
}

export function registerAgentModule(app) {
  const invokeTool = makeInvokeTool(app);
  const db = CommerceDatabase.getInstance();
  const mod = app.modules.create({
    name: 'commerce-agent',
    version: '0.1.0',
    namespace: 'agent',
    description: 'Agent工具和工作流编排：端到端购物流程自动化',
  });

  // ==================== Agent Workflow Tool ====================
  mod.tools.create({
    name: 'agent_full_shopping_flow',
    description: '执行完整购物流程：搜索商品 -> 查看详情 -> 加入购物车 -> 创建订单 -> 支付 -> 查看订单。这是TLL OS Agent能力的核心验证工具。',
    category: 'agent',
    parameters: {
      keyword: 'string - 搜索关键词',
      userId: 'string - 用户ID（可选，默认创建新用户）',
      quantity: 'number - 购买数量（默认1）',
      paymentMethod: 'string - 支付方式（默认alipay）',
    },
    handler: async (params) => {
      const workflow = { steps: [], startTime: Date.now() };
      try {
        // Step 1: Search products
        workflow.steps.push({ step: 'search_product', status: 'running' });
        const searchResult = await invokeTool('catalog_search_products', {
          keyword: params.keyword || '',
          pageSize: 5,
        });
        if (!searchResult.success || !searchResult.data.items?.length) {
          return toolError('未找到商品');
        }
        const product = searchResult.data.items[0];
        workflow.steps[workflow.steps.length - 1] = { step: 'search_product', status: 'done', productId: product.id, productName: product.name };

        // Step 2: Get product detail with SKUs
        workflow.steps.push({ step: 'get_product_detail', status: 'running' });
        const detailResult = await invokeTool('catalog_get_product', { productId: product.id });
        if (!detailResult.success || !detailResult.data.skus?.length) {
          return toolError('商品无可用SKU');
        }
        const sku = detailResult.data.skus[0];
        workflow.steps[workflow.steps.length - 1] = { step: 'get_product_detail', status: 'done', skuId: sku.id, skuCode: sku.skuCode, price: sku.price };

        // Step 3: Get or create user
        workflow.steps.push({ step: 'get_or_create_user', status: 'running' });
        let userId = params.userId;
        if (!userId) {
          const email = `agent_${Date.now()}@tllcommerce.com`;
          const loginResult = await invokeTool('customer_login', { email: 'customer@example.com', password: 'customer123' });
          if (loginResult.success) {
            userId = loginResult.data.user.id;
          } else {
            return toolError('用户登录失败');
          }
        }
        workflow.steps[workflow.steps.length - 1] = { step: 'get_or_create_user', status: 'done', userId };

        // Step 4: Add to cart
        workflow.steps.push({ step: 'add_to_cart', status: 'running' });
        const cartResult = await invokeTool('cart_add', {
          userId,
          skuId: sku.id,
          quantity: params.quantity || 1,
        });
        if (!cartResult.success) return toolError('加入购物车失败: ' + cartResult.error);
        workflow.steps[workflow.steps.length - 1] = { step: 'add_to_cart', status: 'done', cartTotal: cartResult.data.totalAmount };

        // Step 5: Get user address
        workflow.steps.push({ step: 'get_address', status: 'running' });
        const addrResult = await invokeTool('customer_list_addresses', { userId });
        let addressId;
        if (addrResult.success && addrResult.data.addresses?.length) {
          addressId = addrResult.data.addresses[0].id;
        } else {
          // Create a default address
          const addr = await db.insert('addresses', {
            userId, label: '默认', recipient: 'Agent用户', phone: '13800000000',
            country: 'CN', province: '广东省', city: '惠州市', district: '大亚湾区',
            detail: 'Agent测试地址', zipCode: '516000', isDefault: true,
          });
          addressId = addr.id;
        }
        workflow.steps[workflow.steps.length - 1] = { step: 'get_address', status: 'done', addressId };

        // Step 6: Create order
        workflow.steps.push({ step: 'create_order', status: 'running' });
        const orderResult = await invokeTool('order_create', { userId, addressId });
        if (!orderResult.success) return toolError('创建订单失败: ' + orderResult.error);
        const order = orderResult.data;
        workflow.steps[workflow.steps.length - 1] = { step: 'create_order', status: 'done', orderId: order.id, orderNo: order.orderNo, totalAmount: order.totalAmount };

        // Step 7: Pay
        workflow.steps.push({ step: 'pay_order', status: 'running' });
        const payResult = await invokeTool('payment_pay', { orderId: order.id, method: params.paymentMethod || 'alipay' });
        if (!payResult.success) return toolError('支付失败: ' + payResult.error);
        workflow.steps[workflow.steps.length - 1] = { step: 'pay_order', status: 'done', transactionId: payResult.data.transactionId };

        // Step 8: View final order
        workflow.steps.push({ step: 'view_order', status: 'running' });
        const finalOrderResult = await invokeTool('order_get', { orderId: order.id });
        workflow.steps[workflow.steps.length - 1] = { step: 'view_order', status: 'done', orderStatus: finalOrderResult.data?.status };

        workflow.duration = Date.now() - workflow.startTime;
        workflow.status = 'completed';
        workflow.finalOrder = finalOrderResult.data;

        return toolSuccess(workflow);
      } catch (err) {
        workflow.status = 'failed';
        workflow.error = err.message;
        workflow.duration = Date.now() - workflow.startTime;
        return toolError('工作流异常: ' + err.message);
      }
    },
  });

  // ==================== Agent Info Tool ====================
  mod.tools.create({
    name: 'agent_list_available_tools',
    description: '列出所有Agent可用的工具及其分类',
    category: 'agent',
    parameters: {},
    handler: async () => {
      const tools = app.tools.list();
      const byCategory = {};
      for (const tool of tools) {
        if (!byCategory[tool.category]) byCategory[tool.category] = [];
        byCategory[tool.category].push({ name: tool.name, description: tool.description, parameters: tool.parameters });
      }
      return toolSuccess({ total: tools.length, byCategory });
    },
  });

  // ==================== Tests ====================
  mod.tests.create({
    name: 'agent - 端到端完整购物流程',
    test: async (ctx) => {
      const result = await invokeTool('agent_full_shopping_flow', {
        keyword: '手机',
        quantity: 1,
      });
      ctx.assert.true(result.success === true, 'Agent工作流应成功: ' + (result.error || ''));
      const wf = result.data;
      ctx.assert.true(wf.status === 'completed', '工作流状态应为completed');
      ctx.assert.true(wf.steps.length === 8, '应有8个步骤');
      ctx.assert.true(wf.steps.every(s => s.status === 'done'), '所有步骤应完成');
      ctx.assert.true(wf.finalOrder, '应有最终订单');
      ctx.assert.true(wf.finalOrder.status === 'paid', '订单状态应为paid');
    },
  });

  mod.tests.create({
    name: 'agent - 可用工具列表',
    test: async (ctx) => {
      const result = await invokeTool('agent_list_available_tools', {});
      ctx.assert.true(result.success === true);
      ctx.assert.true(result.data.total >= 10, '应有至少10个工具');
      ctx.assert.true(result.data.byCategory.catalog, '应有catalog分类工具');
      ctx.assert.true(result.data.byCategory.cart, '应有cart分类工具');
      ctx.assert.true(result.data.byCategory.order, '应有order分类工具');
    },
  });

  return mod;
}
