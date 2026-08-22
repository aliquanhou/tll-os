/**
 * TLL OS - Plugin Contract
 *
 * 定义 Plugin 系统的接口契约。
 * Plugin 是 TLL OS 的第三方可安装单元，有独立的权限和生命周期。
 *
 * 这是 TLL OS 11 项核心 Contract 之一：Plugin Contract。
 * Plugin Contract 比 Module Contract 更严格，增加了权限声明、
 * 依赖隔离、ai_metadata（AI 可理解元数据）等能力。
 */

import type {
  Container,
  Config,
  Router,
  EventDispatcher,
  Scheduler,
  Logger,
} from '../kernel/interfaces.js';
import type { Awaitable, JsonObject } from '../common/types/index.js';

// ============================================================
// Plugin 状态
// ============================================================

export type PluginState =
  | 'not_installed'
  | 'installed'
  | 'enabled'
  | 'disabled'
  | 'error';

// ============================================================
// Plugin Manifest
// ============================================================

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  entry: string;
  namespace: string;
  type: PluginType;
  tags?: string[];

  dependencies: {
    tll: string;
    modules?: string[];
    plugins?: string[];
    npm?: Record<string, string>;
  };

  permissions: PluginPermissions;

  provides: {
    routes?: boolean;
    commands?: boolean;
    events?: boolean;
    services?: string[];
    ai_tools?: boolean;
    webhooks?: boolean;
  };

  /** AI 专用元数据 —— 让 Agent 能够理解 Plugin 的能力 */
  ai_metadata: PluginAiMetadata;

  lifecycle?: {
    install?: string;
    enable?: string;
    disable?: string;
    upgrade?: string;
    uninstall?: string;
  };

  config_schema?: Record<string, PluginConfigField>;
}

export type PluginType =
  | 'payment-gateway'
  | 'storage'
  | 'auth'
  | 'theme'
  | 'ai-skill'
  | 'integration'
  | 'tool'
  | 'custom';

// ============================================================
// Plugin 权限声明
// ============================================================

export interface PluginPermissions {
  network?: string[];
  storage?: {
    read?: string[];
    write?: string[];
  };
  database?: {
    tables?: string[];
    operations?: Array<'read' | 'write' | 'create_table' | 'drop_table'>;
  };
  events?: {
    publish?: string[];
    subscribe?: string[];
  };
  routes?: {
    prefix?: string;
  };
  commands?: string[];
  config?: {
    read?: string[];
    write?: string[];
  };
  ai_tools?: string[];
  env?: string[];
  process?: string[];
}

// ============================================================
// Plugin AI 元数据
// ============================================================

/**
 * ai_metadata 是 TLL OS Plugin Contract 的核心差异化字段。
 * 它让 AI Agent 能够快速理解 Plugin 的能力、配置要求、兼容性，
 * 而不需要阅读源代码。
 */
export interface PluginAiMetadata {
  summary: string;
  capabilities: string[];
  configuration_required: string[];
  compatible_modules: string[];
  usage_examples?: Array<{
    description: string;
    tool?: string;
    args?: JsonObject;
  }>;
}

// ============================================================
// Plugin 配置 Schema
// ============================================================

export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  default?: unknown;
  secret?: boolean;
  description?: string;
  enum?: string[];
}

// ============================================================
// Plugin 接口
// ============================================================

export interface TllPlugin {
  readonly manifest: PluginManifest;
  readonly state: PluginState;

  /** 安装时执行（创建表、初始化数据等） */
  install?(ctx: PluginLifecycleContext): Awaitable<void>;
  /** 启用时执行（注册路由、事件、命令等） */
  enable?(ctx: PluginLifecycleContext): Awaitable<void>;
  /** 禁用时执行（清理资源） */
  disable?(ctx: PluginLifecycleContext): Awaitable<void>;
  /** 升级时执行 */
  upgrade?(ctx: PluginLifecycleContext, fromVersion: string): Awaitable<void>;
  /** 卸载时执行（清理数据，可选） */
  uninstall?(ctx: PluginLifecycleContext, removeData?: boolean): Awaitable<void>;

  register(container: Container, config: Config): Awaitable<void>;
  boot?(
    container: Container,
    router: Router,
    events: EventDispatcher,
    scheduler: Scheduler,
  ): Awaitable<void>;
  shutdown?(container: Container): Awaitable<void>;
}

// ============================================================
// Plugin 生命周期上下文
// ============================================================

export interface PluginLifecycleContext {
  container: Container;
  config: Config;
  logger: Logger;
  events: EventDispatcher;
  pluginPath: string;
  manifest: PluginManifest;
}

// ============================================================
// Plugin Manager
// ============================================================

export interface DiscoveredPlugin {
  manifest: PluginManifest;
  path: string;
  state: PluginState;
}

export interface DependencyCheckResult {
  satisfied: boolean;
  missing: Array<{ type: 'module' | 'plugin' | 'npm' | 'tll'; name: string; required: string }>;
  conflicts: Array<{ plugin: string; reason: string }>;
}

export interface PermissionCheckResult {
  allowed: boolean;
  requested: string[];
  granted: string[];
  denied: string[];
  requiresApproval: string[];
}

export interface PluginManager {
  // 发现与查询
  discover(directory: string): Awaitable<DiscoveredPlugin[]>;
  list(): PluginInfo[];
  listEnabled(): PluginInfo[];
  listDisabled(): PluginInfo[];
  get(name: string): PluginInfo | null;
  has(name: string): boolean;
  search(query: string): Awaitable<PluginInfo[]>;

  // 生命周期
  install(name: string, version?: string): Awaitable<PluginInfo>;
  enable(name: string): Awaitable<void>;
  disable(name: string): Awaitable<void>;
  upgrade(name: string, version?: string): Awaitable<PluginInfo>;
  uninstall(name: string, removeData?: boolean): Awaitable<void>;

  // 依赖与权限
  checkDependencies(name: string): DependencyCheckResult;
  checkPermissions(name: string): PermissionCheckResult;

  // AI 接口
  getAiMetadata(name: string): PluginAiMetadata | null;
  getCompatiblePlugins(moduleName: string): Awaitable<PluginInfo[]>;
  recommendPlugins(capability: string): Awaitable<PluginInfo[]>;
}

// ============================================================
// Plugin 信息（用于查询和 AI 理解）
// ============================================================

export interface PluginInfo {
  name: string;
  version: string;
  description: string;
  type: PluginType;
  state: PluginState;
  namespace: string;
  author?: string;
  tags: string[];
  dependencies: {
    tll: string;
    modules: string[];
    plugins: string[];
  };
  permissions: PluginPermissions;
  provides: string[];
  ai_metadata: PluginAiMetadata;
  installedAt?: number;
  enabledAt?: number;
  configKeys: string[];
}
