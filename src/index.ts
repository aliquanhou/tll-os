/**
 * TLL OS - 主入口
 *
 * TLL OS 是一个 AI-Native 的应用开发框架。
 * 这是 Foundation 0.1 蓝图版本，包含核心接口定义。
 *
 * 具体实现在 Foundation Phase 2 完成。
 */

// Foundation Primitives
export * from './common/index.js';

// Kernel 接口
export type {
  Container,
  Config,
  Logger,
  EventDispatcher,
  EventListener,
  EventSubscriber,
  TllEvent,
  Router,
  RouteDefinition,
  RouteMatch,
  RouteHandler,
  Middleware,
  MiddlewarePipeline,
  NextFunction,
  RequestContext,
  AuthResult,
  CacheStore,
  CacheManager,
  Job,
  Queue,
  ScheduledTask,
  Scheduler,
  ValidationRule,
  ValidationResult,
  Validator,
  Kernel,
  Application,
  ServiceProvider,
  ServiceScope,
} from './kernel/interfaces.js';

// Module Contract
export type {
  ModuleManifest,
  TllModule,
  ModuleRegistry,
  DiscoveredModule,
  ModuleInfo,
} from './module/interfaces.js';

// Plugin Contract
export type {
  PluginManifest,
  PluginState,
  PluginType,
  PluginPermissions,
  PluginAiMetadata,
  PluginConfigField,
  TllPlugin,
  PluginLifecycleContext,
  PluginManager,
  DiscoveredPlugin,
  DependencyCheckResult,
  PermissionCheckResult as PluginPermissionCheckResult,
  PluginInfo,
} from './plugin/interfaces.js';

// AI Kernel Contract
export type {
  Agent,
  AgentRole,
  AgentConfig,
  AgentInput,
  AgentResult,
  AgentState,
  AgentStep,
  AgentEvent,
  TokenUsage,
  Tool,
  ToolCategory,
  ToolArgs,
  ToolContext,
  ToolResult,
  ToolError,
  ToolCallRecord,
  ToolRegistry,
  Skill,
  SkillRegistry,
  FewShotExample,
  AgentContext,
  ApplicationMeta,
  ConversationTurn,
  MemorySnapshot,
  ContextBuilder,
  PermissionSet,
  PermissionCheckResult,
  ApprovalResult,
  AiPermissionGuard,
  Memory,
  MemoryEntry,
  WorkflowDefinition,
  WorkflowStep,
  WorkflowStepType,
  WorkflowInput,
  WorkflowResult,
  WorkflowEngine,
  McpServerConfig,
  McpConnection,
  McpClient,
  Task,
  TaskType,
  TaskStatus,
  TaskManager,
  LlmProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ChatChunk,
  AgentRuntime,
} from './ai/interfaces.js';

// 版本信息
export const TLL_OS_VERSION = '0.1.0-blueprint';
