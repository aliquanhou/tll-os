/**
 * TLL OS - Module Contract
 *
 * 定义 Module 系统的接口契约。
 * Module 是 TLL OS 的第一方功能单元。
 *
 * 这是 TLL OS 11 项核心 Contract 之一：Module Contract。
 */

import type {
  Container,
  Config,
  Router,
  EventDispatcher,
  Scheduler,
} from '../kernel/interfaces.js';
import type { Awaitable, LifecycleState } from '../common/types/index.js';

// ============================================================
// Module Manifest
// ============================================================

export interface ModuleManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  entry: string;
  namespace: string;
  dependencies?: {
    modules?: string[];
    plugins?: string[];
  };
  provides?: {
    routes?: boolean;
    commands?: boolean;
    events?: boolean;
    migrations?: boolean;
    services?: string[];
  };
  config?: {
    default?: string;
  };
  tags?: string[];
  priority?: number;
}

// ============================================================
// Module 接口
// ============================================================

export interface TllModule {
  readonly manifest: ModuleManifest;

  /**
   * 注册阶段：绑定服务到容器，注册事件监听
   * 此阶段不依赖其他 Module 的服务
   */
  register(container: Container, config: Config): Awaitable<void>;

  /**
   * 启动阶段：注册路由、命令、定时任务
   * 此阶段可以依赖其他 Module 已注册的服务
   */
  boot?(
    container: Container,
    router: Router,
    events: EventDispatcher,
    scheduler: Scheduler,
  ): Awaitable<void>;

  /** 关闭阶段：清理资源 */
  shutdown?(container: Container): Awaitable<void>;
}

// ============================================================
// Module Registry
// ============================================================

export interface DiscoveredModule {
  manifest: ModuleManifest;
  path: string;
}

export interface ModuleRegistry {
  /** 扫描目录发现 Module */
  discover(directory: string): Awaitable<DiscoveredModule[]>;
  /** 注册 Module */
  register(module: TllModule): void;
  /** 注销 Module */
  unregister(name: string): void;
  /** 获取 Module */
  get(name: string): TllModule | null;
  /** 检查 Module 是否存在 */
  has(name: string): boolean;
  /** 列出所有 Module */
  list(): TllModule[];
  /** 按标签列出 Module */
  listByTag(tag: string): TllModule[];
  /** 获取启动顺序（拓扑排序） */
  getBootOrder(): TllModule[];
  /** 启动所有 Module */
  bootAll(
    container: Container,
    router: Router,
    events: EventDispatcher,
    scheduler: Scheduler,
  ): Awaitable<void>;
  /** 关闭所有 Module */
  shutdownAll(container: Container): Awaitable<void>;
  /** 获取 Module 状态 */
  getState(name: string): LifecycleState;
}

// ============================================================
// Module 信息（用于查询和 AI 理解）
// ============================================================

export interface ModuleInfo {
  name: string;
  version: string;
  description: string;
  namespace: string;
  state: LifecycleState;
  dependencies: string[];
  tags: string[];
  routes: Array<{ method: string; path: string; name?: string }>;
  services: string[];
  events: string[];
  commands: string[];
  configKeys: string[];
}
