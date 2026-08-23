/**
 * TLL Commerce - Shared Utilities
 * API response helpers, error types, and common functions used across modules.
 */

export function ok(data, status = 200) {
  return { status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

export function created(data) {
  return ok(data, 201);
}

export function noContent() {
  return { status: 204, headers: {}, body: '' };
}

export function badRequest(message) {
  return { status: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Bad Request', message }) };
}

export function unauthorized(message = 'Unauthorized') {
  return { status: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized', message }) };
}

export function forbidden(message = 'Forbidden') {
  return { status: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Forbidden', message }) };
}

export function notFound(message = 'Not Found') {
  return { status: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Not Found', message }) };
}

export function conflict(message) {
  return { status: 409, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Conflict', message }) };
}

export function parseBody(ctx) {
  if (!ctx.body) return {};
  if (typeof ctx.body === 'object') return ctx.body;
  try { return JSON.parse(ctx.body); } catch { return {}; }
}

export function parseQuery(ctx) {
  return ctx.query || {};
}

export function toolSuccess(data) {
  return { success: true, data, error: null };
}

export function toolError(message) {
  return { success: false, data: null, error: message };
}

export function generateToken() {
  return 'tk_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export function hashPassword(password) {
  // Simple hash for demo - NOT production secure
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'hashed_' + Math.abs(hash).toString(36);
}

export function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

export function paginate(array, page = 1, pageSize = 20) {
  const p = Math.max(1, parseInt(page) || 1);
  const ps = Math.max(1, Math.min(100, parseInt(pageSize) || 20));
  const start = (p - 1) * ps;
  return {
    items: array.slice(start, start + ps),
    pagination: { page: p, pageSize: ps, total: array.length, totalPages: Math.ceil(array.length / ps) },
  };
}
