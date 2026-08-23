/**
 * TLL Commerce - HTTP Server
 * Serves the H5 frontend static pages and proxies API requests to the TLL OS application.
 * This is the bridge between the browser and the TLL OS Runtime.
 *
 * Usage: node server.js
 * Then open http://localhost:3000
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createTllOS } from '../../src/public/index.js';
import { seedDatabase } from './src/data/seed.js';
import { CommerceDatabase } from './src/data/database.js';

import { registerCatalogModule } from './src/modules/catalog.js';
import { registerCustomerModule } from './src/modules/customer.js';
import { registerCartModule } from './src/modules/cart.js';
import { registerOrderModule } from './src/modules/order.js';
import { registerPaymentModule } from './src/modules/payment.js';
import { registerMarketingModule } from './src/modules/marketing.js';
import { registerLocaleModule } from './src/modules/locale.js';
import { registerB2BModule } from './src/modules/b2b.js';
import { registerFileModule } from './src/modules/file.js';
import { registerAdminModule } from './src/modules/admin.js';
import { registerAgentModule } from './src/modules/agent.js';
import { registerStorefrontModule } from './src/modules/storefront.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.join(__dirname, 'src', 'frontend');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function createApp() {
  CommerceDatabase.reset();
  seedDatabase();

  const tll = createTllOS();
  const app = tll.createApplication({ name: 'tll-commerce', version: '0.1.0' });

  const modules = [
    registerCatalogModule, registerCustomerModule, registerCartModule,
    registerOrderModule, registerPaymentModule, registerMarketingModule,
    registerLocaleModule, registerB2BModule, registerFileModule,
    registerAdminModule, registerAgentModule, registerStorefrontModule,
  ];
  for (const fn of modules) fn(app);

  await app.start();
  return app;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function serveStatic(res, filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(FRONTEND_DIR, 'index.html');
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

async function main() {
  const app = await createApp();
  console.log(`TLL Commerce server starting...`);
  console.log(`  Modules: ${app.status.modules}, APIs: ${app.status.apis}, Tools: ${app.status.tools}`);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    try {
      // API proxy
      if (pathname.startsWith('/api/')) {
        const body = req.method !== 'GET' && req.method !== 'DELETE' ? await readBody(req) : undefined;
        const apiPath = pathname + (url.search || '');
        const result = await app.apis.request(req.method, apiPath, body);
        res.writeHead(result.status, result.headers);
        res.end(result.body);
        return;
      }

      // Static files
      let filePath = path.join(FRONTEND_DIR, pathname);
      // Security: prevent path traversal
      if (!filePath.startsWith(FRONTEND_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      serveStatic(res, filePath);
    } catch (err) {
      console.error('Server error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
    }
  });

  server.listen(PORT, () => {
    console.log('');
    console.log(`╔══════════════════════════════════════════════════╗`);
    console.log(`║  TLL Commerce H5 独立站已启动                      ║`);
    console.log(`║  地址: http://localhost:${PORT}                       ║`);
    console.log(`║  前台: http://localhost:${PORT}/                      ║`);
    console.log(`║  后台: http://localhost:${PORT}/admin.html            ║`);
    console.log(`╚══════════════════════════════════════════════════╝`);
    console.log('');
    console.log('测试账号: customer@example.com / customer123');
    console.log('管理员:   admin@tllcommerce.com / admin123');
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
