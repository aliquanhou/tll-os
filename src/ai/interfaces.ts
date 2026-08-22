/**
 * TLL OS - AI Kernel Contract
 *
 * 定义 AI Kernel 的接口契约。
 * AI 是 TLL OS 的一等公民，AI Kernel 定义了 Agent 如何理解和操作 TLL OS。
 *
 * 这是 TLL OS 11 项核心 Contract 中最关键的 7 项：
 * - Agent Contract
 * - Tool Contract
 * - Skill Contract
 * - AI Context Contract
 * - Permission Contract (AI 部分)
 * - Workflow Contract
 * - (MCP, Task 为辅助 Contract)
 */

import type {
  Container,
  Config,
  Logger,
} from '../kernel/interfaces.js';
import type { Awaitable, JsonObject, JsonValue } from '../common/types/index.js';

// ============================================================
// Agent Contract
// ============================================================

export type AgentRole =
  | 'developer'
  | 'devops'
  | 'support'
  | 'architect'
  | 'tester'
  | 'researcher'
  | 'orchestrator'
  | 'reviewer'
  | 'self-healing'
  | 'custom';

export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  maxSteps: number;
  systemPrompt: string;
  allowedTools: string[];
  allowedSkills: string[];
  memoryEnabled: boolean;
  stream: boolean;
  approvalRequired: boolean;
}

export interface AgentInput {
  message: string;
  attachments?: Array<{ type: string; content: unknown }>;
  metadata?: Record<string, unknown>;
}

export interface AgentResult {
  output: string;
  steps: AgentStep[];
  toolCalls: ToolCallRecord[];
  tokensUsed: TokenUsage;
  duration: number;
  state: AgentState;
}

export type AgentState =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentStep {
  step: number;
  type: 'think' | 'tool_call' | 'tool_result' | 'final';
  content: string;
  timestamp: number;
  toolCall?: ToolCallRecord;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly role: AgentRole;
  readonly description: string;

  config: AgentConfig;
  tools: Tool[];
  skills: Skill[];

  run(input: AgentInput, context?: AgentContext): Awaitable<AgentResult>;
  stream(input: AgentInput, context?: AgentContext): AsyncIterable<AgentEvent>;

  getState(): AgentState;
  reset(): void;
}

export type AgentEvent =
  | { type: 'start'; agentId: string; timestamp: number }
  | { type: 'think'; content: string; timestamp: number }
  | { type: 'tool_call'; toolCall: ToolCallRecord; timestamp: number }
  | { type: 'tool_result'; toolCallId: string; result: ToolResult; timestamp: number }
  | { type: 'approval_required'; toolCall: ToolCallRecord; timestamp: number }
  | { type: 'token'; content: string; timestamp: number }
  | { type: 'complete'; result: AgentResult; timestamp: number }
  | { type: 'error'; error: string; timestamp: number };

// ============================================================
// Tool Contract
// ============================================================

export type ToolCategory =
  | 'module'
  | 'plugin'
  | 'route'
  | 'service'
  | 'database'
  | 'event'
  | 'command'
  | 'test'
  | 'config'
  | 'file'
  | 'search'
  | 'ai'
  | 'system';

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonObject;
  readonly returns?: JsonObject;
  readonly permissions: string[];
  readonly category: ToolCategory;
  readonly deprecated?: boolean;
  readonly replacement?: string;

  execute(args: ToolArgs, context: ToolContext): Awaitable<ToolResult>;
}

export type ToolArgs = Record<string, JsonValue>;

export interface ToolContext {
  agent: Agent;
  permissions: PermissionSet;
  requestId: string;
  container: Container;
  config: Config;
  logger: Logger;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: ToolError;
  metadata?: Record<string, unknown>;
}

export interface ToolError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  args: ToolArgs;
  result?: ToolResult;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'waiting_approval';
  startedAt?: number;
  completedAt?: number;
  approval?: ApprovalResult;
}

export interface ToolRegistry {
  register(tool: Tool): void;
  unregister(name: string): void;
  get(name: string): Tool | null;
  list(category?: ToolCategory): Tool[];
  listForPermissions(permissions: PermissionSet): Tool[];
  listForAgent(agent: Agent): Tool[];
  execute(name: string, args: ToolArgs, context: ToolContext): Awaitable<ToolResult>;
}

// ============================================================
// Skill Contract
// ============================================================

export interface Skill {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly author?: string;

  requiredTools: string[];
  requiredPermissions: string[];
  requiredModels?: string[];

  systemPrompt: string;
  fewShotExamples?: FewShotExample[];
  workflow?: WorkflowDefinition;

  activate?(agent: Agent): Awaitable<void>;
  deactivate?(agent: Agent): Awaitable<void>;
}

export interface FewShotExample {
  input: string;
  output: string;
  toolCalls?: Array<{ name: string; args: ToolArgs }>;
}

export interface SkillRegistry {
  register(skill: Skill): void;
  unregister(name: string): void;
  get(name: string): Skill | null;
  list(): Skill[];
  listForAgent(agent: Agent): Skill[];
}

// ============================================================
// AI Context Contract
// ============================================================

export interface ApplicationMeta {
  name: string;
  version: string;
  tllVersion: string;
  environment: string;
}

export interface AgentContext {
  application: ApplicationMeta;
  modules: Array<{ name: string; version: string; description: string; namespace: string }>;
  plugins: Array<{ name: string; version: string; description: string; state: string; ai_metadata?: unknown }>;
  routes: Array<{ method: string; path: string; name?: string; permissions?: string[] }>;
  services: Array<{ name: string; description?: string }>;
  events: Array<{ name: string; description?: string }>;
  commands: Array<{ name: string; description: string }>;
  config: Record<string, unknown>;
  permissions: PermissionSet;
  tools: Tool[];
  skills: Skill[];
  history: ConversationTurn[];
  memory: MemorySnapshot;
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCallRecord[];
  toolCallId?: string;
  timestamp: number;
}

export interface MemorySnapshot {
  working: Record<string, unknown>;
  shortTerm: Array<{ content: string; type: string; timestamp: number; importance: number }>;
  longTermKeys: string[];
}

export interface ContextBuilder {
  build(agent: Agent, input: AgentInput): Awaitable<AgentContext>;
  buildApplicationMeta(): ApplicationMeta;
  buildModuleInventory(): Array<{ name: string; version: string; description: string }>;
  buildPluginInventory(): Array<{ name: string; version: string; description: string }>;
  buildRouteTable(): Array<{ method: string; path: string; name?: string }>;
  buildServiceInventory(): Array<{ name: string; description?: string }>;
  buildEventInventory(): Array<{ name: string; description?: string }>;
  buildCommandInventory(): Array<{ name: string; description: string }>;
  buildAvailableTools(permissions: PermissionSet): Tool[];
  buildAvailableSkills(permissions: PermissionSet): Skill[];
}

// ============================================================
// Permission Contract (AI 部分)
// ============================================================

export interface PermissionSet {
  has(permission: string): boolean;
  hasAll(permissions: string[]): boolean;
  hasAny(permissions: string[]): boolean;
  list(): string[];
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiresApproval: boolean;
  missingPermissions?: string[];
}

export interface ApprovalResult {
  approved: boolean;
  approver?: string;
  reason?: string;
  timestamp: number;
}

export interface AiPermissionGuard {
  checkToolCall(agent: Agent, tool: Tool, args: ToolArgs): PermissionCheckResult;
  checkOperation(agent: Agent, operation: string, resource: string): boolean;
  requiresApproval(agent: Agent, tool: Tool, args: ToolArgs): boolean;
  requestApproval(agent: Agent, tool: Tool, args: ToolArgs): Awaitable<ApprovalResult>;
  logAudit(agent: Agent, tool: Tool, args: ToolArgs, result: ToolResult): void;
}

// ============================================================
// Memory Contract
// ============================================================

export interface MemoryEntry {
  id: string;
  type: 'conversation' | 'tool_call' | 'error' | 'decision' | 'knowledge' | 'preference';
  content: string;
  metadata: Record<string, unknown>;
  timestamp: number;
  importance: number;
  tags: string[];
}

export interface Memory {
  setWorking(key: string, value: unknown): void;
  getWorking<T>(key: string): T | null;
  clearWorking(): void;

  add(entry: MemoryEntry): void;
  getRecent(limit?: number): MemoryEntry[];
  search(query: string, limit?: number): Awaitable<MemoryEntry[]>;

  remember(key: string, value: unknown, tags?: string[]): Awaitable<void>;
  recall<T>(key: string): Awaitable<T | null>;
  recallByTag(tag: string, limit?: number): Awaitable<MemoryEntry[]>;
  forget(key: string): Awaitable<void>;
}

// ============================================================
// Workflow Contract
// ============================================================

export type WorkflowStepType =
  | 'agent'
  | 'tool'
  | 'condition'
  | 'loop'
  | 'parallel'
  | 'approval'
  | 'code';

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  config: Record<string, unknown>;
  next?: string | Array<{ condition: string; step: string }>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  variables?: Record<string, unknown>;
  onError?: { retry?: number; fallbackStep?: string };
}

export interface WorkflowInput {
  workflowId: string;
  input: Record<string, unknown>;
  context?: Partial<AgentContext>;
}

export interface WorkflowResult {
  success: boolean;
  output: unknown;
  steps: Array<{ stepId: string; status: string; output?: unknown; error?: string }>;
  duration: number;
  error?: string;
}

export interface WorkflowEngine {
  register(definition: WorkflowDefinition): void;
  unregister(id: string): void;
  get(id: string): WorkflowDefinition | null;
  list(): WorkflowDefinition[];
  execute(input: WorkflowInput, context: AgentContext): Awaitable<WorkflowResult>;
}

// ============================================================
// MCP (Model Context Protocol)
// ============================================================

export interface McpServerConfig {
  name: string;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpConnection {
  id: string;
  server: McpServerConfig;
  connected: boolean;
  tools: Array<{ name: string; description: string }>;
}

export interface McpClient {
  connect(server: McpServerConfig): Awaitable<McpConnection>;
  disconnect(connectionId: string): void;
  listTools(connectionId: string): Awaitable<Array<{ name: string; description: string; parameters: JsonObject }>>;
  callTool(connectionId: string, name: string, args: ToolArgs): Awaitable<ToolResult>;
  listConnections(): McpConnection[];
}

// ============================================================
// Task Contract
// ============================================================

export type TaskType = 'agent' | 'workflow' | 'tool' | 'command';
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';

export interface Task {
  id: string;
  type: TaskType;
  input: unknown;
  status: TaskStatus;
  result?: unknown;
  error?: { code: string; message: string };
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  attempts: number;
  maxAttempts: number;
  agentId?: string;
}

export interface TaskManager {
  create(type: TaskType, input: unknown, options?: { maxAttempts?: number; agentId?: string }): Awaitable<Task>;
  execute(taskId: string): Awaitable<Task>;
  queue(taskId: string): void;
  processQueue(): Awaitable<void>;
  get(taskId: string): Task | null;
  list(status?: TaskStatus): Task[];
  listByAgent(agentId: string): Task[];
  cancel(taskId: string): void;
  retry(taskId: string): void;
}

// ============================================================
// LLM Provider
// ============================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCallRecord[];
  toolCallId?: string;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{ name: string; description: string; parameters: JsonObject }>;
}

export interface ChatResponse {
  content: string;
  toolCalls?: Array<{ id: string; name: string; args: ToolArgs }>;
  usage: TokenUsage;
  model: string;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

export interface ChatChunk {
  content?: string;
  toolCall?: { id: string; name: string; argsDelta: string };
  usage?: TokenUsage;
  finishReason?: string;
}

export interface LlmProvider {
  readonly name: string;
  chat(messages: ChatMessage[], options: ChatOptions): Awaitable<ChatResponse>;
  chatStream(messages: ChatMessage[], options: ChatOptions): AsyncIterable<ChatChunk>;
  supportsToolCalls(): boolean;
  supportsStreaming(): boolean;
  getMaxContextLength(): number;
  listModels(): Array<{ id: string; name: string; contextLength: number }>;
}

// ============================================================
// Agent Runtime (编排器)
// ============================================================

export interface AgentRuntime {
  createAgent(role: AgentRole, config?: Partial<AgentConfig>): Agent;
  getAgent(id: string): Agent | null;
  listAgents(): Agent[];
  destroyAgent(id: string): void;

  getToolRegistry(): ToolRegistry;
  getSkillRegistry(): SkillRegistry;
  getContextBuilder(): ContextBuilder;
  getPermissionGuard(): AiPermissionGuard;
  getMemory(): Memory;
  getWorkflowEngine(): WorkflowEngine;
  getTaskManager(): TaskManager;
  getMcpClient(): McpClient;

  setLlmProvider(provider: LlmProvider): void;
  getLlmProvider(): LlmProvider;
}
