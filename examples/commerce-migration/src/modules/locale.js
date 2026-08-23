/**
 * TLL Commerce - Locale Module
 * Multi-language (i18n) and multi-currency support.
 * Supports language switching, currency conversion, and locale-specific formatting.
 */

import { CommerceDatabase } from '../data/database.js';
import { ok, parseQuery, toolSuccess } from '../utils.js';

export const LANGUAGES = [
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳', default: true },
  { code: 'zh-TW', name: '繁體中文', flag: '🇭🇰' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
  { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
  { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
  { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
];

export const CURRENCIES = [
  { code: 'CNY', symbol: '¥', name: '人民币', rate: 1.0, default: true },
  { code: 'USD', symbol: '$', name: 'US Dollar', rate: 0.14 },
  { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.13 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', rate: 21.5 },
  { code: 'GBP', symbol: '£', name: 'British Pound', rate: 0.11 },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', rate: 190 },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', rate: 1.09 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rate: 0.22 },
];

// Translation dictionaries (key -> { langCode: translation })
const TRANSLATIONS = {
  'app.name': { 'zh-CN': 'TLL商城', 'zh-TW': 'TLL商城', 'en-US': 'TLL Store', 'ja-JP': 'TLLストア', 'ko-KR': 'TLL 스토어', 'de-DE': 'TLL Shop', 'fr-FR': 'Boutique TLL', 'es-ES': 'Tienda TLL' },
  'nav.home': { 'zh-CN': '首页', 'en-US': 'Home', 'ja-JP': 'ホーム', 'ko-KR': '홈', 'de-DE': 'Startseite', 'fr-FR': 'Accueil', 'es-ES': 'Inicio' },
  'nav.products': { 'zh-CN': '商品', 'en-US': 'Products', 'ja-JP': '商品', 'ko-KR': '상품', 'de-DE': 'Produkte', 'fr-FR': 'Produits', 'es-ES': 'Productos' },
  'nav.cart': { 'zh-CN': '购物车', 'en-US': 'Cart', 'ja-JP': 'カート', 'ko-KR': '장바구니', 'de-DE': 'Warenkorb', 'fr-FR': 'Panier', 'es-ES': 'Carrito' },
  'nav.account': { 'zh-CN': '我的', 'en-US': 'Account', 'ja-JP': 'マイページ', 'ko-KR': '계정', 'de-DE': 'Konto', 'fr-FR': 'Compte', 'es-ES': 'Cuenta' },
  'product.addToCart': { 'zh-CN': '加入购物车', 'en-US': 'Add to Cart', 'ja-JP': 'カートに追加', 'ko-KR': '장바구니에 추가', 'de-DE': 'In den Warenkorb', 'fr-FR': 'Ajouter au panier', 'es-ES': 'Añadir al carrito' },
  'product.buyNow': { 'zh-CN': '立即购买', 'en-US': 'Buy Now', 'ja-JP': '今すぐ購入', 'ko-KR': '지금 구매', 'de-DE': 'Jetzt kaufen', 'fr-FR': 'Acheter maintenant', 'es-ES': 'Comprar ahora' },
  'cart.empty': { 'zh-CN': '购物车是空的', 'en-US': 'Your cart is empty', 'ja-JP': 'カートは空です', 'ko-KR': '장바구니가 비어있습니다', 'de-DE': 'Ihr Warenkorb ist leer', 'fr-FR': 'Votre panier est vide', 'es-ES': 'Su carrito está vacío' },
  'cart.checkout': { 'zh-CN': '去结算', 'en-US': 'Checkout', 'ja-JP': 'チェックアウト', 'ko-KR': '결제하기', 'de-DE': 'Zur Kasse', 'fr-FR': 'Passer la commande', 'es-ES': 'Pagar' },
  'order.total': { 'zh-CN': '合计', 'en-US': 'Total', 'ja-JP': '合計', 'ko-KR': '합계', 'de-DE': 'Gesamt', 'fr-FR': 'Total', 'es-ES': 'Total' },
  'common.loading': { 'zh-CN': '加载中...', 'en-US': 'Loading...', 'ja-JP': '読み込み中...', 'ko-KR': '로딩중...', 'de-DE': 'Laden...', 'fr-FR': 'Chargement...', 'es-ES': 'Cargando...' },
  'common.search': { 'zh-CN': '搜索', 'en-US': 'Search', 'ja-JP': '検索', 'ko-KR': '검색', 'de-DE': 'Suchen', 'fr-FN': 'Rechercher', 'es-ES': 'Buscar' },
};

export function registerLocaleModule(app) {
  const mod = app.modules.create({
    name: 'commerce-locale',
    version: '0.1.0',
    namespace: 'locale',
    description: '多语言和多币种支持',
  });

  // ==================== APIs ====================
  mod.apis.create({
    method: 'GET', path: '/api/locale/languages', name: 'listLanguages',
    handler: async () => ok({ languages: LANGUAGES }),
  });

  mod.apis.create({
    method: 'GET', path: '/api/locale/currencies', name: 'listCurrencies',
    handler: async () => ok({ currencies: CURRENCIES }),
  });

  mod.apis.create({
    method: 'GET', path: '/api/locale/translations', name: 'getTranslations',
    description: '获取指定语言的翻译字典',
    handler: async (ctx) => {
      const lang = parseQuery(ctx).lang || 'zh-CN';
      const dict = {};
      for (const [key, langs] of Object.entries(TRANSLATIONS)) {
        dict[key] = langs[lang] || langs['zh-CN'] || key;
      }
      return ok({ language: lang, translations: dict });
    },
  });

  mod.apis.create({
    method: 'GET', path: '/api/locale/convert', name: 'convertCurrency',
    description: '货币转换',
    handler: async (ctx) => {
      const q = parseQuery(ctx);
      const amount = Number(q.amount) || 0;
      const from = q.from || 'CNY';
      const to = q.to || 'USD';
      const fromCur = CURRENCIES.find(c => c.code === from);
      const toCur = CURRENCIES.find(c => c.code === to);
      if (!fromCur || !toCur) return ok({ error: 'Unsupported currency' });
      // Convert via CNY base
      const inCny = amount / fromCur.rate;
      const converted = inCny * toCur.rate;
      return ok({
        amount, from, to, converted: Math.round(converted * 100) / 100,
        symbol: toCur.symbol, rate: toCur.rate / fromCur.rate,
      });
    },
  });

  // ==================== Tools ====================
  mod.tools.create({
    name: 'locale_convert_currency',
    description: '货币转换',
    category: 'locale',
    parameters: { amount: 'number (required)', from: 'string (default: CNY)', to: 'string (default: USD)' },
    handler: async (params) => {
      const amount = Number(params.amount) || 0;
      const from = params.from || 'CNY';
      const to = params.to || 'USD';
      const fromCur = CURRENCIES.find(c => c.code === from);
      const toCur = CURRENCIES.find(c => c.code === to);
      if (!fromCur || !toCur) return toolSuccess({ error: 'Unsupported currency' });
      const inCny = amount / fromCur.rate;
      const converted = Math.round(inCny * toCur.rate * 100) / 100;
      return toolSuccess({ amount, from, to, converted, symbol: toCur.symbol });
    },
  });

  mod.tools.create({
    name: 'locale_get_translations',
    description: '获取翻译字典',
    category: 'locale',
    parameters: { lang: 'string (default: zh-CN)' },
    handler: async (params) => {
      const lang = params.lang || 'zh-CN';
      const dict = {};
      for (const [key, langs] of Object.entries(TRANSLATIONS)) {
        dict[key] = langs[lang] || langs['zh-CN'] || key;
      }
      return toolSuccess({ language: lang, translations: dict });
    },
  });

  // ==================== Tests ====================
  mod.tests.create({
    name: 'locale - 语言和币种列表',
    test: async (ctx) => {
      const langResp = await ctx.application.apis.request('GET', '/api/locale/languages');
      ctx.assert.true(langResp.status === 200);
      const langs = JSON.parse(langResp.body).languages;
      ctx.assert.true(langs.length >= 8, '应有至少8种语言');
      ctx.assert.true(langs[0].code === 'zh-CN', '默认语言应为zh-CN');

      const curResp = await ctx.application.apis.request('GET', '/api/locale/currencies');
      ctx.assert.true(curResp.status === 200);
      const curs = JSON.parse(curResp.body).currencies;
      ctx.assert.true(curs.length >= 8, '应有至少8种币种');
    },
  });

  mod.tests.create({
    name: 'locale - 货币转换',
    test: async (ctx) => {
      const resp = await ctx.application.apis.request('GET', '/api/locale/convert?amount=100&from=CNY&to=USD');
      ctx.assert.true(resp.status === 200);
      const body = JSON.parse(resp.body);
      ctx.assert.true(body.converted > 0, '转换结果应大于0');
      ctx.assert.true(body.from === 'CNY');
      ctx.assert.true(body.to === 'USD');
    },
  });

  mod.tests.create({
    name: 'locale - 翻译字典',
    test: async (ctx) => {
      const resp = await ctx.application.apis.request('GET', '/api/locale/translations?lang=en-US');
      ctx.assert.true(resp.status === 200);
      const body = JSON.parse(resp.body);
      ctx.assert.true(body.translations['app.name'] === 'TLL Store', '英文翻译应正确');
      ctx.assert.true(body.translations['nav.home'] === 'Home');
    },
  });

  return mod;
}
