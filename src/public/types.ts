/**
 * TLL OS - Public Contract Types
 *
 * 这是 TLL OS 对外暴露的所有公开类型定义。
 * 外部 Agent 和第三方开发者只能依赖这里导出的类型。
 *
 * 这是 TLL OS 13 项 Public Contracts 的统一类型定义。
 */

// ============================================================
// 通用类型
// ============================================================

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject { [key: string]: JsonValue; }
export interface JsonArray extends Array<JsonValue> {}
export type Awaitable<T> = T | Promise<T>;

// ============================================================
// 1. Application Model Contract
// ============================================================

export interface ApplicationConfig {
  name: string;
  version: string;
  description?: string;
  environment?: string;
  runtime?: string;
}

export interface Application {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly state: ApplicationState;

  // 子系统访问入口（Agent 通过这些入口操作应用）
  readonly graph: ApplicationGraph;
  readonly modules: ModuleManager;
  readonly apis: ApiManager;
  readonly tools: ToolManager;
  readonly agents: AgentManager;
  readonly tests: TestManager;
  readonly events: EventManager;
  readonly config: ConfigManager;

  // 生命周期
  start(): Awaitable<void>;
  stop(): Awaitable<void>;
}

export type ApplicationState = 'created' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';

// ============================================================
// 2. Application Graph Contract
// ============================================================

export type GraphNodeType =
  | 'application' | 'module' | 'plugin' | 'api' | 'model' | 'event'
  | 'workflow' | 'agent' | 'tool' | 'skill' | 'permission' | 'command'
  | 'config' | 'dependency' | 'build_target';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  name: string;
  description?: string;
  version?: string;
  status?: string;
  capabilities?: string[];
  permissions?: string[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export type GraphEdgeType =
  | 'belongs_to' | 'depends_on' | 'provides' | 'calls' | 'triggers'
  | 'requires' | 'uses' | 'extends' | 'conflicts_with' | 'listens_to'
  | 'implements' | 'exports' | 'imports' | 'builds_for';

export interface GraphEdge {
  id: string;
  type: GraphEdgeType;
  source: string;
  target: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface ApplicationGraph {
  // 节点查询
  listNodes(type?: GraphNodeType): GraphNode[];
  getNode(id: string): GraphNode | null;
  hasNode(id: string): boolean;

  // 边查询
  listEdges(type?: GraphEdgeType): GraphEdge[];
  getEdge(id: string): GraphEdge | null;

  // 语义查询（Agent 最常用）
  findModules(): GraphNode[];
  findPlugins(): GraphNode[];
  findApis(): GraphNode[];
  findApisByModule(moduleName: string): GraphNode[];
  findTools(): GraphNode[];
  findToolsByModule(moduleName: string): GraphNode[];
  findAgents(): GraphNode[];
  findEvents(): GraphNode[];
  findModels(): GraphNode[];
  findModelsByModule(moduleName: string): GraphNode[];
  findCommands(): GraphNode[];
  findDependencies(): GraphNode[];

  // 关系查询
  getDependencies(nodeId: string): GraphEdge[];
  getDependents(nodeId: string): GraphEdge[];
  getRelated(nodeId: string, edgeType?: GraphEdgeType): GraphNode[];

  // 影响分析
  getImpactAnalysis(nodeId: string): ImpactAnalysisResult;

  // 序列化
  toJSON(): GraphSnapshot;
}

export interface ImpactAnalysisResult {
  node: GraphNode;
  directDependents: GraphNode[];
  indirectDependents: GraphNode[];
  affectedApis: GraphNode[];
  affectedAgents: GraphNode[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface GraphSnapshot {
  version: string;
  application: { name: string; version: string };
  nodes: GraphNode[];
  edges: GraphEdge[];
  generatedAt: number;
}

// ============================================================
// 3. Module Contract
// ============================================================

export interface ModuleConfig {
  name: string;
  description?: string;
  namespace?: string;
  version?: string;
  dependencies?: string[];
}

export interface Module {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly namespace: string;
  readonly version: string;
  readonly state: ModuleState;

  // 子资源
  readonly apis: ApiManager;
  readonly tools: ToolManager;
  readonly tests: TestManager;
  readonly events: EventManager;
  readonly config: ConfigManager;

  // 服务注册（Module 可以注册服务函数）
  registerService(name: string, implementation: unknown): void;
  getService<T = unknown>(name: string): T | null;
  listServices(): string[];
}

export type ModuleState = 'registered' | 'booting' | 'active' | 'inactive' | 'error';

export interface ModuleManager {
  create(config: ModuleConfig): Module;
  get(name: string): Module | null;
  has(name: string): boolean;
  list(): Module[];
  remove(name: string): void;
}

// ============================================================
// 4. API Contract
// ============================================================

export interface ApiDefinition {
  method: HttpMethod;
  path: string;
  name?: string;
  description?: string;
  handler: ApiHandler;
  version?: string;
  authRequired?: boolean;
  permissions?: string[];
  requestSchema?: JsonObject;
  responseSchema?: JsonObject;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'ALL';

export interface ApiRequest {
  method: HttpMethod;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  params: Record<string, string>;
  body: unknown;
}

export interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export type ApiHandler = (request: ApiRequest) => Awaitable<ApiResponse | unknown>;

export interface ApiEndpoint {
  readonly id: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly name: string;
  readonly description: string;
  readonly moduleName?: string;
  readonly handler: ApiHandler;

  // 模拟调用（不需要启动 HTTP 服务器）
  invoke(request: Partial<ApiRequest>): Awaitable<ApiResponse>;
}

export interface ApiManager {
  create(definition: ApiDefinition): ApiEndpoint;
  get(name: string): ApiEndpoint | null;
  has(name: string): boolean;
  list(): ApiEndpoint[];
  remove(name: string): void;

  // 路由匹配
  match(method: string, path: string): ApiEndpoint | null;

  // 模拟请求（不需要真实 HTTP 服务器）
  request(method: string, path: string, body?: unknown): Awaitable<ApiResponse>;
}

// ============================================================
// 5. Tool Contract
// ============================================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonObject;          // JSON Schema
  returns?: JsonObject;
  permissions?: string[];
  category?: string;
  handler: ToolHandler;
}

export type ToolHandler = (args: Record<string, JsonValue>, context: ToolContext) => Awaitable<ToolResult>;

export interface ToolContext {
  applicationName: string;
  moduleName?: string;
  agentName?: string;
  requestId: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

export interface Tool {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonObject;
  readonly permissions: string[];
  readonly category: string;
  readonly moduleName?: string;

  invoke(args: Record<string, JsonValue>, context?: Partial<ToolContext>): Awaitable<ToolResult>;
}

export interface ToolManager {
  create(definition: ToolDefinition): Tool;
  get(name: string): Tool | null;
  has(name: string): boolean;
  list(category?: string): Tool[];
  remove(name: string): void;
}

// ============================================================
// 6. Agent Contract
// ============================================================

export interface AgentConfig {
  name: string;
  role: string;
  description?: string;
  systemPrompt?: string;
  tools?: string[];               // 可用 Tool 名称列表
  permissions?: string[];
  model?: string;
  maxSteps?: number;
}

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly description: string;
  readonly tools: string[];
  readonly permissions: string[];

  // 执行任务（PoC 中为脚本化执行，真实实现中调用 LLM）
  run(input: string, context?: Record<string, unknown>): Awaitable<AgentResult>;

  // 注册自定义执行逻辑（PoC 中用于模拟 Agent 行为）
  setExecutor(executor: AgentExecutor): void;
}

export type AgentExecutor = (input: string, context: AgentExecutionContext) => Awaitable<AgentResult>;

export interface AgentExecutionContext {
  application: Application;
  availableTools: Tool[];
  agentName: string;
  requestId: string;
}

export interface AgentResult {
  output: string;
  steps: AgentStep[];
  toolCalls: Array<{ tool: string; args: Record<string, JsonValue>; result: ToolResult }>;
  success: boolean;
}

export interface AgentStep {
  step: number;
  type: 'think' | 'tool_call' | 'tool_result' | 'final';
  content: string;
}

export interface AgentManager {
  create(config: AgentConfig): Agent;
  get(name: string): Agent | null;
  has(name: string): boolean;
  list(): Agent[];
  remove(name: string): void;
}

// ============================================================
// 7. Testing Contract
// ============================================================

export interface TestDefinition {
  name: string;
  description?: string;
  moduleName?: string;
  test: TestFunction;
}

export type TestFunction = (context: TestContext) => Awaitable<void>;

export interface TestContext {
  application: Application;
  module?: Module;
  assert: TestAssertions;
}

export interface TestAssertions {
  equal(actual: unknown, expected: unknown, message?: string): void;
  notEqual(actual: unknown, expected: unknown, message?: string): void;
  true(value: unknown, message?: string): void;
  false(value: unknown, message?: string): void;
  throws(fn: () => unknown, error?: string | RegExp): void;
  deepEqual(actual: unknown, expected: unknown, message?: string): void;
}

export interface TestCase {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly moduleName?: string;
  readonly state: TestState;
  result?: TestResult;

  run(): Awaitable<TestResult>;
}

export type TestState = 'pending' | 'running' | 'passed' | 'failed' | 'error';

export interface TestResult {
  passed: boolean;
  name: string;
  duration: number;
  error?: { message: string; stack?: string };
}

export interface TestSuiteResult {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  duration: number;
  results: TestResult[];
}

export interface TestManager {
  create(definition: TestDefinition): TestCase;
  get(name: string): TestCase | null;
  has(name: string): boolean;
  list(): TestCase[];
  remove(name: string): void;

  // 运行测试
  runAll(): Awaitable<TestSuiteResult>;
  runByModule(moduleName: string): Awaitable<TestSuiteResult>;
  runSingle(name: string): Awaitable<TestResult>;
}

// ============================================================
// 8. Event Contract
// ============================================================

export interface EventDefinition {
  name: string;
  description?: string;
  moduleName?: string;
  payloadSchema?: JsonObject;
}

export interface TllEvent<T = unknown> {
  name: string;
  payload: T;
  timestamp: number;
  source?: string;
}

export type EventListener<T = unknown> = (event: TllEvent<T>) => Awaitable<void>;

export interface EventManager {
  define(definition: EventDefinition): void;
  on<T>(name: string, listener: EventListener<T>): void;
  off(name: string, listener: EventListener): void;
  dispatch<T>(name: string, payload?: T): Awaitable<TllEvent<T>>;
  list(): EventDefinition[];
  listeners(name: string): EventListener[];
}

// ============================================================
// 9. Config Contract
// ============================================================

export interface ConfigManager {
  get<T = unknown>(key: string, defaultValue?: T): T;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  all(): Record<string, unknown>;
}

// ============================================================
// 10. Runtime Adapter Contract
// ============================================================

export interface RuntimeAdapter {
  readonly name: string;
  readonly version: string;

  // HTTP（PoC 中不需要真实 HTTP，用 ApiManager.request 模拟）
  createServer?(handler: (request: ApiRequest) => Awaitable<ApiResponse>): { listen(port: number): Awaitable<void>; close(): Awaitable<void> };

  // 文件系统
  fs: {
    readFile(path: string): Awaitable<string>;
    writeFile(path: string, data: string): Awaitable<void>;
    exists(path: string): Awaitable<boolean>;
    readDir(path: string): Awaitable<string[]>;
  };

  // 环境
  env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    all(): Record<string, string>;
  };

  // 进程
  process: {
    exit(code?: number): void;
    cwd(): string;
  };
}

// ============================================================
// 11. TLL OS 入口（Agent 通过这个创建和访问应用）
// ============================================================

export interface TllOS {
  // 创建应用
  createApplication(config: ApplicationConfig): Application;

  // 获取应用
  getApplication(name: string): Application | null;

  // 列出所有应用
  listApplications(): Application[];

  // 获取 Runtime Adapter
  getRuntime(): RuntimeAdapter;

  // Contract 信息（Agent 可以查询支持的 Contract 版本）
  getContracts(): ContractInfo[];
}

export interface ContractInfo {
  name: string;
  version: string;
  description: string;
  status: 'stable' | 'beta' | 'draft';
}

// 全局入口函数
export declare function createTllOS(runtime?: RuntimeAdapter): TllOS;

// ============================================================
// 12. Capability Contract（Protocol 2.0 新增）
// ============================================================

export interface CapabilityManifest {
  name: string;
  description: string;
  version: string;
  status: 'stable' | 'beta' | 'draft' | 'deprecated';
  providedBy: { type: 'module' | 'plugin' | 'adapter'; id: string };
  features: CapabilityFeature[];
  dependencies?: string[];
  compatibility?: { platforms: string[]; notSupported?: string[] };
  metadata?: Record<string, unknown>;
}

export interface CapabilityFeature {
  name: string;
  description?: string;
  supported: boolean;
  limitations?: string[];
}

export interface CapabilityRegistry {
  list(): CapabilityManifest[];
  get(name: string): CapabilityManifest | null;
  has(name: string): boolean;
  findByCategory(category: string): CapabilityManifest[];
  findByProvider(providerId: string): CapabilityManifest[];
  check(name: string): boolean;
  findMissing(required: string[]): string[];
  register(manifest: CapabilityManifest): void;
  unregister(name: string): void;
}

// ============================================================
// 13. Compatibility Manifest Contract（Protocol 2.0 新增）
// ============================================================

export interface CompatibilityManifest {
  adapter: { name: string; version: string; author?: string; license?: string };
  externalSystem: {
    name: string;
    versions: string[];
    apiType: 'REST' | 'GraphQL' | 'SOAP' | 'SDK' | 'Database';
    authentication: 'OAuth2' | 'APIKey' | 'BasicAuth' | 'None';
  };
  capabilityMapping: CompatibilityMapping[];
  migration: MigrationAssessment;
  dependencies: {
    tllOsVersion: string;
    runtimeVersion?: string;
    requiredCapabilities: string[];
    optionalCapabilities?: string[];
    externalDependencies?: string[];
  };
  compatibilityLevel: 'production' | 'beta' | 'experimental' | 'deprecated';
  tested?: {
    unitTests: boolean;
    integrationTests: boolean;
    e2eTests: boolean;
    testedVersions: string[];
  };
}

export interface CompatibilityMapping {
  external: string;
  tllCapability: string;
  tllNodeType: string;
  supportLevel: 'full' | 'partial' | 'read_only' | 'not_supported';
  notes?: string;
  limitations?: string[];
}

export interface MigrationAssessment {
  estimatedEffort: 'low' | 'medium' | 'high' | 'extreme';
  estimatedHours?: string;
  complexity: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  prerequisites?: string[];
  recommendedOrder?: string[];
  knownIssues?: string[];
}

// ============================================================
// 14. Adapter Contract（Protocol 2.0 新增）
// ============================================================

export interface AdapterManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  externalSystem: { name: string; apiType: string; baseUrl?: string };
  capabilities: Array<'read' | 'write' | 'sync' | 'migrate'>;
  entityMappings: AdapterEntityMapping[];
  configSchema: JsonObject;
  permissions?: string[];
  compatibilityManifest?: string;
}

export interface AdapterEntityMapping {
  external: string;
  tllNodeType: string;
  tllModelName?: string;
  fieldMappings: AdapterFieldMapping[];
  unsupportedFields?: string[];
}

export interface AdapterFieldMapping {
  external: string;
  tll: string;
  transform?: string;
}

export interface Adapter {
  readonly manifest: AdapterManifest;
  readonly state: 'configured' | 'connected' | 'disconnected' | 'error';
  configure(config: Record<string, unknown>): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  read(entityType: string, filter?: Record<string, unknown>): Promise<unknown[]>;
  write(entityType: string, data: unknown): Promise<unknown>;
  sync?(entityType: string, direction?: 'pull' | 'push' | 'bidirectional'): Promise<SyncResult>;
  migrate?(entityType: string, options?: MigrationOptions): Promise<MigrationResult>;
  healthCheck(): Promise<boolean>;
}

export interface SyncResult {
  synced: number;
  conflicts: number;
  errors: string[];
}

export interface MigrationOptions {
  targetModule?: string;
  includeData?: boolean;
  dryRun?: boolean;
}

export interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: string[];
  generatedModule?: string;
}

export interface AdapterRegistry {
  list(): AdapterManifest[];
  get(name: string): AdapterManifest | null;
  has(name: string): boolean;
  findByExternalSystem(systemName: string): AdapterManifest[];
  findByCapability(capability: 'read' | 'write' | 'sync' | 'migrate'): AdapterManifest[];
  create(manifest: AdapterManifest): Adapter;
  remove(name: string): void;
}

// ============================================================
// 15. Projection Contract（Protocol 2.0 新增）
// ============================================================

export interface ProjectionManifest {
  name: string;
  version: string;
  description: string;
  outputType: 'code' | 'openapi' | 'database' | 'config' | 'docs' | 'tests' | 'graphql' | 'typescript';
  language?: string;
  supportsNodes: string[];
  rules: ProjectionRule[];
  templates?: Record<string, string>;
  sync?: { watch?: string[]; parser?: string; updateGraphOnChange?: boolean };
}

export interface ProjectionRule {
  nodeType: string;
  output: string;
  template?: string;
  dependencies?: string[];
  imports?: string[];
}

export interface ProjectionEngine {
  readonly manifest: ProjectionManifest;
  project(graph: ApplicationGraph, options?: ProjectionOptions): Promise<ProjectionOutput[]>;
  projectNode(node: GraphNode, options?: ProjectionOptions): Promise<ProjectionOutput>;
  validate(graph: ApplicationGraph): Promise<ProjectionValidationResult>;
  capabilityMatrix?(): Record<string, boolean>;
}

export interface ProjectionOptions {
  target?: string;
  outputDir?: string;
  dryRun?: boolean;
  overwrite?: boolean;
  conflictStrategy?: 'graph_wins' | 'code_wins' | 'merge' | 'ask';
}

export interface ProjectionOutput {
  path: string;
  content: string;
  nodeType: string;
  nodeId?: string;
  operation: 'create' | 'update' | 'delete';
}

export interface ProjectionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================
// 16. BuildTarget Contract（Protocol 2.0 新增）
// ============================================================

export interface BuildTargetManifest {
  name: string;
  platform: 'web' | 'h5' | 'apk' | 'exe' | 'miniprogram' | 'ai_agent' | 'industrial' | 'iot' | 'cloud' | 'edge' | string;
  version: string;
  description: string;
  projection: string;
  capabilityMatrix: Record<string, boolean>;
  config?: JsonObject;
}

export interface BuildTarget {
  readonly manifest: BuildTargetManifest;
  build(graph: ApplicationGraph, options?: BuildOptions): Promise<BuildResult>;
  devServe?(graph: ApplicationGraph, options?: DevOptions): Promise<DevServer>;
  validate(graph: ApplicationGraph): Promise<BuildValidationResult>;
}

export interface BuildOptions {
  outputDir?: string;
  mode?: 'development' | 'production';
  minify?: boolean;
  sourceMap?: boolean;
}

export interface BuildResult {
  success: boolean;
  outputDir?: string;
  artifacts: string[];
  errors: string[];
  warnings: string[];
  duration: number;
}

export interface DevOptions {
  port?: number;
  host?: string;
  hotReload?: boolean;
}

export interface DevServer {
  port: number;
  url: string;
  stop(): Promise<void>;
}

export interface BuildValidationResult {
  valid: boolean;
  missingCapabilities: string[];
  errors: string[];
  warnings: string[];
}

// ============================================================
// 17. Evolution Proposal Contract（Protocol 2.0 新增）
// ============================================================

export interface EvolutionProposal {
  id: string;
  title: string;
  type: 'feature' | 'bugfix' | 'breaking' | 'deprecation' | 'refactor';
  status: 'draft' | 'review' | 'approved' | 'rejected' | 'merged';
  created: number;
  updated: number;
  author: { type: 'agent' | 'human'; id: string; source?: string };
  problem: string;
  impactAnalysis: ImpactAnalysis;
  changeSet: ChangeSet;
  validation: ProposalValidation;
  references?: string[];
  discussionUrl?: string;
  prUrl?: string;
}

export interface ImpactAnalysis {
  affectedContracts: string[];
  affectedNodes: string[];
  affectedModules?: string[];
  breaking: boolean;
  backwardCompatible: boolean;
  migrationRequired: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  graphChanges?: GraphChange[];
}

export interface GraphChange {
  operation: 'add_node_type' | 'remove_node_type' | 'add_edge_type' | 'remove_edge_type' | 'modify_node' | 'modify_edge';
  target: string;
  description: string;
}

export interface ChangeSet {
  protocolChanges?: FileChange[];
  runtimeChanges?: FileChange[];
  testChanges?: FileChange[];
  docChanges?: FileChange[];
}

export interface FileChange {
  file: string;
  change: string;
  operation?: 'create' | 'modify' | 'delete';
}

export interface ProposalValidation {
  testsPassed: boolean;
  testCount?: number;
  testCoverage?: string;
  compatibilityVerified: boolean;
  aiReview: 'approved' | 'rejected' | 'pending';
  aiReviewNotes?: string;
  humanReview: 'approved' | 'rejected' | 'pending';
}

export interface TEPEngine {
  create(proposal: Omit<EvolutionProposal, 'id' | 'created' | 'updated' | 'status'>): EvolutionProposal;
  get(id: string): EvolutionProposal | null;
  list(status?: EvolutionProposal['status']): EvolutionProposal[];
  update(id: string, patch: Partial<EvolutionProposal>): EvolutionProposal | null;
  submitForReview(id: string): Promise<EvolutionProposal | null>;
  runAIReview(id: string): Promise<ProposalValidation>;
  merge(id: string): Promise<boolean>;
  reject(id: string, reason: string): EvolutionProposal | null;
}
