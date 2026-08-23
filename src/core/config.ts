/**
 * TLL OS - Configuration Management (P1)
 *
 * 多环境配置：配置文件 + 环境变量覆盖 + 默认值 + 类型安全。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export type Environment = 'development' | 'test' | 'staging' | 'production';

export interface DatabaseConfig {
  driver: 'sqlite' | 'postgresql' | 'mysql' | 'memory';
  path?: string;
  host?: string;
  port?: number;
  name?: string;
  user?: string;
  password?: string;
}

export interface ServerConfig {
  host: string;
  port: number;
  cors: boolean;
  corsOrigin: string;
}

export interface SecurityConfig {
  apiKeyHeader: string;
  requireAuth: boolean;
  jwtSecret?: string;
  jwtExpiresIn?: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  format: 'json' | 'text';
}

export interface TllOSConfig {
  environment: Environment;
  appName: string;
  appVersion: string;
  debug: boolean;
  server: ServerConfig;
  database: DatabaseConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
  features: Record<string, boolean>;
  custom: Record<string, unknown>;
}

const DEFAULT_CONFIG: TllOSConfig = {
  environment: 'development',
  appName: 'tll-os-app',
  appVersion: '0.1.0',
  debug: true,
  server: {
    host: '0.0.0.0',
    port: 3000,
    cors: true,
    corsOrigin: '*',
  },
  database: {
    driver: 'memory',
  },
  security: {
    apiKeyHeader: 'x-api-key',
    requireAuth: false,
  },
  logging: {
    level: 'info',
    format: 'text',
  },
  features: {},
  custom: {},
};

export class ConfigurationManager {
  private config: TllOSConfig;
  private configDir: string;
  private env: Environment;

  constructor(configDir?: string) {
    this.configDir = configDir ?? process.cwd();
    this.env = (process.env.TLL_ENV as Environment) ?? (process.env.NODE_ENV as Environment) ?? 'development';
    this.config = this.loadConfig();
  }

  private loadConfig(): TllOSConfig {
    let config = { ...DEFAULT_CONFIG, environment: this.env };

    // Load from config file (tll.config.json or tll.config.js)
    const jsonConfigPath = path.join(this.configDir, 'tll.config.json');
    const jsConfigPath = path.join(this.configDir, 'tll.config.js');

    if (fs.existsSync(jsonConfigPath)) {
      try {
        const fileConfig = JSON.parse(fs.readFileSync(jsonConfigPath, 'utf-8'));
        config = this.deepMerge(config, fileConfig);
      } catch {
        // Ignore invalid config file
      }
    } else if (fs.existsSync(jsConfigPath)) {
      try {
        // Dynamic import for JS config
        const fileConfig = require(jsConfigPath);
        config = this.deepMerge(config, fileConfig.default ?? fileConfig);
      } catch {
        // Ignore invalid config file
      }
    }

    // Environment-specific override (tll.config.production.json etc.)
    const envConfigPath = path.join(this.configDir, `tll.config.${this.env}.json`);
    if (fs.existsSync(envConfigPath)) {
      try {
        const envConfig = JSON.parse(fs.readFileSync(envConfigPath, 'utf-8'));
        config = this.deepMerge(config, envConfig);
      } catch {
        // Ignore
      }
    }

    // Environment variable overrides
    config = this.applyEnvOverrides(config);

    return config;
  }

  private applyEnvOverrides(config: TllOSConfig): TllOSConfig {
    const result = { ...config };

    if (process.env.TLL_APP_NAME) result.appName = process.env.TLL_APP_NAME;
    if (process.env.TLL_APP_VERSION) result.appVersion = process.env.TLL_APP_VERSION;
    if (process.env.TLL_DEBUG !== undefined) result.debug = process.env.TLL_DEBUG === 'true';
    if (process.env.TLL_SERVER_HOST) result.server = { ...result.server, host: process.env.TLL_SERVER_HOST };
    if (process.env.TLL_SERVER_PORT) result.server = { ...result.server, port: parseInt(process.env.TLL_SERVER_PORT, 10) };
    if (process.env.TLL_SERVER_CORS !== undefined) result.server = { ...result.server, cors: process.env.TLL_SERVER_CORS === 'true' };
    if (process.env.TLL_SERVER_CORS_ORIGIN) result.server = { ...result.server, corsOrigin: process.env.TLL_SERVER_CORS_ORIGIN };
    if (process.env.TLL_DB_DRIVER) result.database = { ...result.database, driver: process.env.TLL_DB_DRIVER as DatabaseConfig['driver'] };
    if (process.env.TLL_DB_PATH) result.database = { ...result.database, path: process.env.TLL_DB_PATH };
    if (process.env.TLL_DB_HOST) result.database = { ...result.database, host: process.env.TLL_DB_HOST };
    if (process.env.TLL_DB_PORT) result.database = { ...result.database, port: parseInt(process.env.TLL_DB_PORT, 10) };
    if (process.env.TLL_DB_NAME) result.database = { ...result.database, name: process.env.TLL_DB_NAME };
    if (process.env.TLL_SECURITY_API_KEY_HEADER) result.security = { ...result.security, apiKeyHeader: process.env.TLL_SECURITY_API_KEY_HEADER };
    if (process.env.TLL_SECURITY_REQUIRE_AUTH !== undefined) result.security = { ...result.security, requireAuth: process.env.TLL_SECURITY_REQUIRE_AUTH === 'true' };
    if (process.env.TLL_SECURITY_JWT_SECRET) result.security = { ...result.security, jwtSecret: process.env.TLL_SECURITY_JWT_SECRET };
    if (process.env.TLL_LOG_LEVEL) result.logging = { ...result.logging, level: process.env.TLL_LOG_LEVEL as LoggingConfig['level'] };
    if (process.env.TLL_LOG_FORMAT) result.logging = { ...result.logging, format: process.env.TLL_LOG_FORMAT as LoggingConfig['format'] };

    return result;
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] ?? {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  /** Get full config */
  getConfig(): TllOSConfig {
    return { ...this.config };
  }

  /** Get a specific section */
  get<K extends keyof TllOSConfig>(key: K): TllOSConfig[K] {
    return this.config[key];
  }

  /** Get a nested value by dot path */
  getPath<T = unknown>(path: string, defaultValue?: T): T {
    const parts = path.split('.');
    let current: any = this.config;
    for (const part of parts) {
      if (current === undefined || current === null) return defaultValue as T;
      current = current[part];
    }
    return (current ?? defaultValue) as T;
  }

  /** Get current environment */
  getEnvironment(): Environment {
    return this.env;
  }

  /** Check if current environment matches */
  isEnvironment(env: Environment): boolean {
    return this.env === env;
  }

  /** Check if a feature flag is enabled */
  isFeatureEnabled(feature: string): boolean {
    return this.config.features[feature] === true;
  }

  /** Enable/disable a feature flag at runtime */
  setFeature(feature: string, enabled: boolean): void {
    this.config.features[feature] = enabled;
  }

  /** Set a custom config value at runtime */
  setCustom(key: string, value: unknown): void {
    this.config.custom[key] = value;
  }

  /** Get a custom config value */
  getCustom<T = unknown>(key: string, defaultValue?: T): T {
    return (this.config.custom[key] ?? defaultValue) as T;
  }

  /** Reload config from disk */
  reload(): void {
    this.config = this.loadConfig();
  }

  /** Export config as JSON (for debugging, excludes secrets) */
  toSafeJSON(): string {
    const safe = { ...this.config };
    if (safe.security.jwtSecret) safe.security = { ...safe.security, jwtSecret: '***REDACTED***' };
    if (safe.database.password) safe.database = { ...safe.database, password: '***REDACTED***' };
    return JSON.stringify(safe, null, 2);
  }
}

/** Global default configuration manager */
let globalConfig: ConfigurationManager | null = null;

export function getConfig(configDir?: string): ConfigurationManager {
  if (!globalConfig) {
    globalConfig = new ConfigurationManager(configDir);
  }
  return globalConfig;
}

export function resetConfig(): void {
  globalConfig = null;
}
