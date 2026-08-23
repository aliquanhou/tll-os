/**
 * TLL OS - Security Module (P1)
 *
 * API Key 管理、权限执行、认证中间件、输入校验。
 */

import type { PersistenceAdapter } from '../public/types.js';
import { createMemoryPersistence } from './persistence.js';

// ============================================================
// Types
// ============================================================

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  status: 'active' | 'revoked' | 'expired';
  createdAt: number;
  expiresAt?: number;
  lastUsedAt?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AuthResult {
  authenticated: boolean;
  apiKey?: ApiKey;
  error?: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  missing?: string[];
}

export interface SecurityConfig {
  apiKeyHeader?: string;
  requireAuth?: boolean;
  defaultPermissions?: string[];
}

// ============================================================
// API Key Manager
// ============================================================

export class ApiKeyManager {
  private persistence: PersistenceAdapter;
  private keys: Map<string, ApiKey> = new Map();

  constructor(persistence?: PersistenceAdapter) {
    this.persistence = persistence ?? createMemoryPersistence();
  }

  async connect(): Promise<void> {
    if (!this.persistence.isConnected()) {
      await this.persistence.connect();
    }
    // Load existing keys from persistence
    const repo = this.persistence.getRepository<ApiKey>('api_keys');
    const existing = await repo.find();
    for (const key of existing) {
      this.keys.set(key.key, key);
    }
  }

  async createKey(options: {
    name: string;
    permissions?: string[];
    expiresIn?: number; // milliseconds
    metadata?: Record<string, unknown>;
  }): Promise<ApiKey> {
    const key = `tll_${this.generateRandomString(32)}`;
    const now = Date.now();
    const apiKey: ApiKey = {
      id: `key_${now.toString(36)}_${this.generateRandomString(8)}`,
      key,
      name: options.name,
      permissions: options.permissions ?? ['*'],
      status: 'active',
      createdAt: now,
      expiresAt: options.expiresIn ? now + options.expiresIn : undefined,
      metadata: options.metadata,
    };

    this.keys.set(key, apiKey);

    // Persist
    const repo = this.persistence.getRepository<ApiKey>('api_keys');
    await repo.create(apiKey);

    return apiKey;
  }

  async validateKey(key: string): Promise<AuthResult> {
    const apiKey = this.keys.get(key);
    if (!apiKey) {
      return { authenticated: false, error: 'Invalid API key' };
    }
    if (apiKey.status !== 'active') {
      return { authenticated: false, error: `API key is ${apiKey.status}` };
    }
    if (apiKey.expiresAt && Date.now() > apiKey.expiresAt) {
      apiKey.status = 'expired';
      return { authenticated: false, error: 'API key expired' };
    }
    // Update last used
    apiKey.lastUsedAt = Date.now();
    return { authenticated: true, apiKey };
  }

  async revokeKey(keyId: string): Promise<boolean> {
    for (const apiKey of this.keys.values()) {
      if (apiKey.id === keyId) {
        apiKey.status = 'revoked';
        const repo = this.persistence.getRepository<ApiKey>('api_keys');
        await repo.update(apiKey.id, { status: 'revoked' });
        return true;
      }
    }
    return false;
  }

  listKeys(): ApiKey[] {
    return Array.from(this.keys.values());
  }

  private generateRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// ============================================================
// Permission Checker
// ============================================================

export class PermissionChecker {
  /**
   * Check if an agent with given permissions can access a resource requiring specific permissions.
   * Wildcard '*' grants all permissions.
   */
  static check(agentPermissions: string[], requiredPermissions: string[]): PermissionCheckResult {
    if (requiredPermissions.length === 0) {
      return { allowed: true };
    }
    if (agentPermissions.includes('*')) {
      return { allowed: true };
    }
    const missing = requiredPermissions.filter(p => !agentPermissions.includes(p));
    if (missing.length > 0) {
      return { allowed: false, missing };
    }
    return { allowed: true };
  }

  /**
   * Check if a specific permission is granted.
   */
  static hasPermission(agentPermissions: string[], permission: string): boolean {
    return agentPermissions.includes('*') || agentPermissions.includes(permission);
  }
}

// ============================================================
// Security Middleware for HTTP
// ============================================================

export interface SecurityMiddlewareContext {
  headers: Record<string, string>;
  method: string;
  path: string;
  apiKeyManager: ApiKeyManager;
  config: SecurityConfig;
}

export interface SecurityMiddlewareResult {
  authenticated: boolean;
  apiKey?: ApiKey;
  statusCode?: number;
  error?: string;
}

export class SecurityMiddleware {
  private apiKeyManager: ApiKeyManager;
  private config: Required<SecurityConfig>;

  constructor(apiKeyManager: ApiKeyManager, config?: SecurityConfig) {
    this.apiKeyManager = apiKeyManager;
    this.config = {
      apiKeyHeader: config?.apiKeyHeader ?? 'x-api-key',
      requireAuth: config?.requireAuth ?? false,
      defaultPermissions: config?.defaultPermissions ?? ['read'],
    };
  }

  async authenticate(ctx: SecurityMiddlewareContext): Promise<SecurityMiddlewareResult> {
    const headerName = this.config.apiKeyHeader.toLowerCase();
    const apiKeyValue = ctx.headers[headerName] ?? ctx.headers['authorization']?.replace('Bearer ', '');

    if (!apiKeyValue) {
      if (this.config.requireAuth) {
        return { authenticated: false, statusCode: 401, error: 'API key required' };
      }
      // No auth required, return default permissions
      return {
        authenticated: false,
        apiKey: {
          id: 'anonymous',
          key: 'anonymous',
          name: 'Anonymous',
          permissions: this.config.defaultPermissions,
          status: 'active',
          createdAt: Date.now(),
        },
      };
    }

    const result = await this.apiKeyManager.validateKey(apiKeyValue);
    if (!result.authenticated) {
      return { authenticated: false, statusCode: 401, error: result.error };
    }

    return { authenticated: true, apiKey: result.apiKey };
  }

  /**
   * Check if the authenticated API key has the required permissions.
   */
  checkPermissions(apiKey: ApiKey | undefined, required: string[]): PermissionCheckResult {
    const permissions = apiKey?.permissions ?? this.config.defaultPermissions;
    return PermissionChecker.check(permissions, required);
  }
}

// ============================================================
// Input Validation Helper
// ============================================================

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
}

export class InputValidator {
  /**
   * Validate required fields in a request body.
   */
  static requireFields(body: Record<string, unknown>, fields: string[]): ValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    for (const field of fields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        errors.push({ field, message: `Field '${field}' is required` });
      }
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate field types.
   */
  static validateTypes(body: Record<string, unknown>, schema: Record<string, string>): ValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    for (const [field, expectedType] of Object.entries(schema)) {
      const value = body[field];
      if (value === undefined) continue; // optional field
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== expectedType) {
        errors.push({ field, message: `Field '${field}' expected type '${expectedType}', got '${actualType}'` });
      }
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate string length.
   */
  static validateLength(value: string, field: string, min?: number, max?: number): ValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    if (min !== undefined && value.length < min) {
      errors.push({ field, message: `Field '${field}' must be at least ${min} characters` });
    }
    if (max !== undefined && value.length > max) {
      errors.push({ field, message: `Field '${field}' must be at most ${max} characters` });
    }
    return { valid: errors.length === 0, errors };
  }
}

// ============================================================
// Unified Error Response Builder
// ============================================================

export interface ErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

export class ErrorResponseBuilder {
  static build(code: string, message: string, requestId: string, details?: unknown): ErrorResponse {
    return {
      ok: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        requestId,
      },
    };
  }

  static validationError(errors: Array<{ field: string; message: string }>, requestId: string): ErrorResponse {
    return this.build('validation_error', 'Input validation failed', requestId, { fields: errors });
  }

  static unauthorized(requestId: string, message?: string): ErrorResponse {
    return this.build('unauthorized', message ?? 'Authentication required', requestId);
  }

  static forbidden(requestId: string, missing?: string[]): ErrorResponse {
    return this.build('forbidden', 'Insufficient permissions', requestId, missing ? { missingPermissions: missing } : undefined);
  }

  static notFound(resource: string, requestId: string): ErrorResponse {
    return this.build('not_found', `${resource} not found`, requestId);
  }

  static conflict(message: string, requestId: string): ErrorResponse {
    return this.build('conflict', message, requestId);
  }

  static internalError(error: Error | string, requestId: string): ErrorResponse {
    const message = error instanceof Error ? error.message : String(error);
    return this.build('internal_error', message, requestId);
  }
}

// ============================================================
// Unified Success Response Builder
// ============================================================

export interface SuccessResponse<T = unknown> {
  ok: true;
  data: T;
  requestId: string;
  meta?: Record<string, unknown>;
}

export class SuccessResponseBuilder {
  static build<T>(data: T, requestId: string, meta?: Record<string, unknown>): SuccessResponse<T> {
    return {
      ok: true,
      data,
      requestId,
      ...(meta ? { meta } : {}),
    };
  }

  static paginated<T>(items: T[], total: number, page: number, pageSize: number, requestId: string): SuccessResponse<{ items: T[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const totalPages = Math.ceil(total / pageSize);
    return this.build({ items, total, page, pageSize, totalPages }, requestId);
  }

  static created<T>(data: T, requestId: string): SuccessResponse<T> {
    return this.build(data, requestId);
  }
}

// ============================================================
// Request ID Generator
// ============================================================

let requestIdCounter = 0;
export function generateRequestId(): string {
  requestIdCounter++;
  return `req_${Date.now().toString(36)}_${requestIdCounter.toString(36)}`;
}
