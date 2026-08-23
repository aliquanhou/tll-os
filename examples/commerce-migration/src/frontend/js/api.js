// TLL Commerce - API Client
// Simple fetch-based API client for the H5 frontend.

const API_BASE = 'api';
const USER_ID_KEY = 'tll_user_id';
const TOKEN_KEY = 'tll_token';

const Store = {
  getUserId() { return localStorage.getItem(USER_ID_KEY) || 'guest_' + Date.now(); },
  setUserId(id) { localStorage.setItem(USER_ID_KEY, id); },
  getToken() { return localStorage.getItem(TOKEN_KEY); },
  setToken(t) { localStorage.setItem(TOKEN_KEY, t); },
  clear() { localStorage.removeItem(USER_ID_KEY); localStorage.removeItem(TOKEN_KEY); },
};

async function request(method, path, body) {
  const url = API_BASE + path;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const token = Store.getToken();
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  try {
    const resp = await fetch(url, opts);
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: resp.status, data };
  } catch (err) {
    return { status: 0, data: { error: 'Network Error', message: err.message } };
  }
}

const API = {
  // Storefront
  getHome: () => request('GET', '/storefront/home'),
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', '/storefront/products' + (qs ? '?' + qs : ''));
  },
  getProduct: (id) => request('GET', '/storefront/products/' + id),
  getCheckout: (userId) => request('GET', '/storefront/checkout?userId=' + encodeURIComponent(userId)),
  getUserCenter: (userId) => request('GET', '/storefront/user-center?userId=' + encodeURIComponent(userId)),

  // Catalog
  searchProducts: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', '/catalog/products' + (qs ? '?' + qs : ''));
  },
  getCategories: () => request('GET', '/catalog/categories'),
  getBrands: () => request('GET', '/catalog/brands'),

  // Cart
  getCart: (userId) => request('GET', '/cart?userId=' + encodeURIComponent(userId)),
  addToCart: (userId, skuId, quantity) => request('POST', '/cart/items', { userId, skuId, quantity }),
  updateCartItem: (itemId, quantity) => request('PUT', '/cart/items/' + itemId, { quantity }),
  removeCartItem: (itemId) => request('DELETE', '/cart/items/' + itemId),

  // Order
  createOrder: (data) => request('POST', '/orders', data),
  getOrders: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', '/orders' + (qs ? '?' + qs : ''));
  },
  getOrder: (id) => request('GET', '/orders/' + id),

  // Payment
  getPaymentMethods: () => request('GET', '/payment/methods'),
  createPayment: (orderId, method) => request('POST', '/payment/create', { orderId, method }),
  payOrder: async (orderId, method) => {
    const create = await request('POST', '/payment/create', { orderId, method });
    if (create.status === 201 && create.data.transactionId) {
      await request('POST', '/payment/notify', { transactionId: create.data.transactionId });
    }
    return create;
  },

  // Customer
  login: (email, password) => request('POST', '/customer/auth/login', { email, password }),
  register: (data) => request('POST', '/customer/auth/register', data),
  getAddresses: (token) => request('GET', '/customer/addresses?token=' + encodeURIComponent(token)),
  createAddress: (token, data) => request('POST', '/customer/addresses?token=' + encodeURIComponent(token), data),

  // Marketing
  validateCoupon: (code, orderAmount) => request('POST', '/marketing/coupons/validate', { code, orderAmount }),
  getCoupons: () => request('GET', '/marketing/coupons'),

  // Locale
  getLanguages: () => request('GET', '/locale/languages'),
  getCurrencies: () => request('GET', '/locale/currencies'),
  convertCurrency: (amount, from, to) => request('GET', `/locale/convert?amount=${amount}&from=${from}&to=${to}`),

  // Admin
  getDashboard: () => request('GET', '/admin/dashboard'),
  getAdminOrders: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', '/admin/orders' + (qs ? '?' + qs : ''));
  },
  getAdminProducts: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', '/admin/products' + (qs ? '?' + qs : ''));
  },
  getSystemInfo: () => request('GET', '/admin/system'),
};

// Toast utility
function toast(msg, duration = 2000) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

// Format price
function formatPrice(amount, currency = 'CNY') {
  const symbols = { CNY: '¥', USD: '$', EUR: '€', JPY: '¥', GBP: '£', KRW: '₩', HKD: 'HK$', AUD: 'A$' };
  return (symbols[currency] || '¥') + Number(amount).toFixed(2);
}

// Get product emoji based on category/name
function getProductEmoji(product) {
  const name = (product.name || '').toLowerCase();
  if (name.includes('手机') || name.includes('phone')) return '📱';
  if (name.includes('笔记本') || name.includes('电脑') || name.includes('book')) return '💻';
  if (name.includes('耳机') || name.includes('ear')) return '🎧';
  if (name.includes('保温') || name.includes('thermos')) return '🍵';
  if (name.includes('餐具') || name.includes('bamboo')) return '🍽️';
  if (name.includes('t恤') || name.includes('tee') || name.includes('衣服')) return '👕';
  return '📦';
}
