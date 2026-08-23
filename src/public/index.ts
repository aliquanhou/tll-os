/**
 * TLL OS - Public Entry Point
 *
 * 这是 TLL OS 对外暴露的唯一入口。
 * 外部 Agent 和第三方开发者只能从这里导入。
 *
 * 内部实现（core/）对外部不可见，只能通过 Public Contract 访问。
 */

// 重新导出所有公开类型
export * from './types.js';

// 导出 createTllOS 工厂函数（内部实现对外部透明）
export { createTllOS, createApiResponseBuilder } from '../core/index.js';
export { createMemoryPersistence } from '../core/persistence.js';
export { createFilePersistence } from '../core/file-persistence.js';
export { createSqlitePersistence } from '../core/sqlite-persistence.js';
export {
  ApiKeyManager, PermissionChecker, SecurityMiddleware, InputValidator,
  ErrorResponseBuilder, SuccessResponseBuilder, generateRequestId,
} from '../core/security.js';
export type {
  ApiKey, AuthResult, PermissionCheckResult, SecurityConfig,
  SecurityMiddlewareContext, SecurityMiddlewareResult,
  ValidationResult, ErrorResponse, SuccessResponse,
} from '../core/security.js';
export { Logger, logger, createLogger } from '../core/logger.js';
export type { LogLevel, LogEntry, LoggerConfig } from '../core/logger.js';
export { ConfigurationManager, getConfig, resetConfig } from '../core/config.js';
export type { Environment, DatabaseConfig, ServerConfig, SecurityConfig as SecurityConfigType, LoggingConfig, TllOSConfig } from '../core/config.js';
export { ProjectionEngine } from '../core/projection.js';
export type { ProjectionFile, ProjectionResult, OpenAPISchema, OpenAPIOperation, DBSchema, DBTable, DBColumn } from '../core/projection.js';
