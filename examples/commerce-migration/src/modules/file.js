/**
 * TLL Commerce - File Module
 * In-memory file storage for product images, user avatars, and other assets.
 * In production, this would be replaced with S3/OSS adapter.
 */

import { CommerceDatabase } from '../data/database.js';
import { ok, created, notFound, badRequest, parseBody, toolSuccess, toolError } from '../utils.js';

export function registerFileModule(app) {
  const db = CommerceDatabase.getInstance();
  const mod = app.modules.create({
    name: 'commerce-file',
    version: '0.1.0',
    namespace: 'file',
    description: '文件管理：内存文件存储、上传、下载',
  });

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  // ==================== APIs ====================
  mod.apis.create({
    method: 'POST', path: '/api/files/upload', name: 'uploadFile',
    description: '上传文件（base64编码内容）',
    handler: async (ctx) => {
      const body = parseBody(ctx);
      if (!body.name || !body.content) return badRequest('name和content必填');
      const mimeType = body.mimeType || 'application/octet-stream';
      if (!ALLOWED_TYPES.includes(mimeType) && !body.allowUnsafe) return badRequest('不支持的文件类型');
      const size = Buffer.from(body.content, 'base64').length;
      if (size > MAX_SIZE) return badRequest('文件大小超过限制');

      const file = await db.insert('files', {
        name: body.name, originalName: body.originalName || body.name,
        mimeType, size, url: `/files/${await db.nextId('file')}`,
        storage: 'memory', category: body.category || 'general',
        uploadedBy: body.uploadedBy || 'system',
        content: body.content, // base64 stored in memory
      });
      return created({ id: file.id, name: file.name, url: file.url, size: file.size, mimeType: file.mimeType });
    },
  });

  mod.apis.create({
    method: 'GET', path: '/api/files/:id', name: 'getFile',
    handler: async (ctx) => {
      const file = await db.findById('files', ctx.params.id);
      if (!file) return notFound('文件不存在');
      const { content, ...meta } = file;
      return ok(meta);
    },
  });

  mod.apis.create({
    method: 'GET', path: '/api/files', name: 'listFiles',
    handler: async (ctx) => {
      const q = ctx.query || {};
      let files = await db.find('files');
      if (q.category) files = files.filter(f => f.category === q.category);
      const result = files.map(({ content, ...meta }) => meta);
      return ok({ files: result, total: result.length });
    },
  });

  mod.apis.create({
    method: 'DELETE', path: '/api/files/:id', name: 'deleteFile',
    handler: async (ctx) => {
      const file = await db.findById('files', ctx.params.id);
      if (!file) return notFound('文件不存在');
      await db.remove('files', ctx.params.id);
      return ok({ success: true });
    },
  });

  // ==================== Tools ====================
  mod.tools.create({
    name: 'file_upload',
    description: '上传文件',
    category: 'file',
    parameters: { name: 'string (required)', content: 'string (base64, required)', mimeType: 'string', category: 'string' },
    handler: async (params) => {
      if (!params.name || !params.content) return toolError('name和content必填');
      const resp = await app.apis.request('POST', '/api/files/upload', JSON.stringify(params));
      if (resp.status !== 201) return toolError(JSON.parse(resp.body).message || '上传失败');
      return toolSuccess(JSON.parse(resp.body));
    },
  });

  // ==================== Tests ====================
  mod.tests.create({
    name: 'file - 上传和获取文件',
    test: async (ctx) => {
      const content = Buffer.from('test file content').toString('base64');
      const uploadResp = await ctx.application.apis.request('POST', '/api/files/upload',
        JSON.stringify({ name: 'test.txt', content, mimeType: 'text/plain', category: 'test' }));
      ctx.assert.true(uploadResp.status === 201, '上传应返回201');
      const file = JSON.parse(uploadResp.body);
      ctx.assert.true(file.id, '应有文件ID');
      ctx.assert.true(file.size > 0, '文件大小应大于0');

      const getResp = await ctx.application.apis.request('GET', `/api/files/${file.id}`);
      ctx.assert.true(getResp.status === 200);
      const meta = JSON.parse(getResp.body);
      ctx.assert.true(meta.name === 'test.txt');
    },
  });

  return mod;
}
