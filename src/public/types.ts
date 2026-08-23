/**
 * TLL OS - Public Contract Types
 *
 * 这是 TLL OS 对外暴露的所有公开类型定义。
 * 外部 Agent 和第三方开发者只能依赖这里导出的类型。
 *
 * 这是 TLL OS 17 项 Public Contracts 的统一类型定义。
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

  // Multi-Agent 协作（P0-2 ~ P0-6）
  readonly workspaces: WorkspaceManager;
  readonly locks: LockManager;
  readonly handoffs: HandoffManager;
  readonly reviews: ReviewManager;
  readonly changeSets: ChangeSetManager;

  // Persistence & Plugin（P0-7, P0-11）
  readonly persistence: PersistenceAdapter;
  readonly plugins: PluginManager;

  // 生命周期
  start(): Awaitable<void>;
  stop(): Awaitable<void>;

  // HTTP 服务器（P0-8）
  startHttp(port?: number, host?: string): Promise<{ port: number; url: string }>;
}

export type ApplicationState = 'created' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';

// ============================================================
// 2. Application Graph Contract
// ============================================================

export type GraphNodeType =
  | 'application' | 'module' | 'plugin' | 'api' | 'model' | 'event'
  | 'workflow' | 'agent' | 'tool' | 'skill' | 'permission' | 'command'
  | 'config' | 'dependency' | 'build_target' | 'adapter';

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
  // 归属资源（belongs_to 反向：这个节点拥有什么）
  ownedApis: GraphNode[];
  ownedTools: GraphNode[];
  ownedTests: GraphNode[];
  ownedAgents: GraphNode[];
  ownedModels: GraphNode[];
  ownedEvents: GraphNode[];
  // 受影响汇总
  affectedModules: GraphNode[];
  affectedApis: GraphNode[];
  affectedTools: GraphNode[];
  affectedAgents: GraphNode[];
  affectedTests: GraphNode[];
  // 调用链影响（calls/uses 边）
  callers: GraphNode[];
  callees: GraphNode[];
  // 回归分析
  regressionPoints: Array<{ node: GraphNode; reason: string; severity: 'low' | 'medium' | 'high' | 'critical' }>;
  dependencyPaths: Array<{ path: string[]; risk: 'low' | 'medium' | 'high' | 'critical' }>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
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
// 4b. 统一 API 响应 Contract（P0-9）
// ============================================================

export type ApiErrorCode =
  | 'validation_error'
  | 'not_found'
  | 'unauthorized'
  | 'forbidden'
  | 'conflict'
  | 'rate_limited'
  | 'internal_error'
  | 'service_unavailable'
  | 'bad_request';

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface StandardApiResponse<T = unknown> {
  ok: boolean;
  data: T | null;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[];
    requestId: string;
  } | null;
  requestId: string;
  timestamp: number;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// 标准响应构造器类型
export interface ApiResponseBuilder {
  ok<T>(data: T, pagination?: PaginationInfo): StandardApiResponse<T>;
  created<T>(data: T): StandardApiResponse<T>;
  badRequest(message: string, details?: ApiErrorDetail[]): StandardApiResponse;
  notFound(resource: string): StandardApiResponse;
  unauthorized(message?: string): StandardApiResponse;
  forbidden(message?: string): StandardApiResponse;
  conflict(message: string): StandardApiResponse;
  validationError(details: ApiErrorDetail[]): StandardApiResponse;
  internalError(message?: string): StandardApiResponse;
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
  permissions?: string[];
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string; missingPermissions?: string[] };
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

// ============================================================
// 18. Runtime ChangeSet Contract（P0-2）
// ============================================================

export type ChangeOperation = 'add' | 'modify' | 'remove';
export type ChangeEntityType = 'module' | 'api' | 'tool' | 'agent' | 'test' | 'event' | 'config' | 'model' | 'graph_node' | 'graph_edge' | 'plugin';

export interface ChangeEntry {
  id: string;
  operation: ChangeOperation;
  entityType: ChangeEntityType;
  entityId: string;
  entityName?: string;
  before?: unknown;
  after?: unknown;
  timestamp: number;
  agentName?: string;
  description?: string;
}

export type ChangeSetStatus = 'draft' | 'previewed' | 'validated' | 'applied' | 'rolled_back' | 'conflict';

export interface RuntimeChangeSet {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly agentName?: string;
  readonly workspaceId?: string;
  status: ChangeSetStatus;
  readonly createdAt: number;
  updatedAt: number;

  entries: ChangeEntry[];

  // 依赖与风险
  dependencies: string[];
  affectedNodeIds: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  // 操作
  addEntry(entry: Omit<ChangeEntry, 'id' | 'timestamp'>): void;
  preview(): ChangeSetPreview;
  validate(): ChangeSetValidationResult;
  apply(): Promise<ChangeSetApplyResult>;
  rollback(): Promise<boolean>;
  toJSON(): ChangeSetSnapshot;
}

export interface ChangeSetPreview {
  totalChanges: number;
  byOperation: Record<ChangeOperation, number>;
  byEntityType: Record<string, number>;
  affectedModules: string[];
  affectedApis: string[];
  affectedTools: string[];
  affectedTests: string[];
  estimatedRisk: 'low' | 'medium' | 'high' | 'critical';
  conflicts: string[];
}

export interface ChangeSetValidationResult {
  valid: boolean;
  errors: Array<{ entryId?: string; message: string; code: string }>;
  warnings: Array<{ entryId?: string; message: string }>;
  requiresTests: string[];
}

export interface ChangeSetApplyResult {
  success: boolean;
  appliedCount: number;
  failedCount: number;
  errors: Array<{ entryId: string; message: string }>;
  newGraphSnapshot?: GraphSnapshot;
}

export interface ChangeSetSnapshot {
  id: string;
  name: string;
  status: ChangeSetStatus;
  agentName?: string;
  workspaceId?: string;
  entries: ChangeEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface ChangeSetManager {
  create(name: string, options?: { description?: string; agentName?: string; workspaceId?: string }): RuntimeChangeSet;
  get(id: string): RuntimeChangeSet | null;
  list(status?: ChangeSetStatus): RuntimeChangeSet[];
  listByWorkspace(workspaceId: string): RuntimeChangeSet[];
  listByAgent(agentName: string): RuntimeChangeSet[];
  remove(id: string): void;
}

// ============================================================
// 19. Workspace Contract（P0-3）
// ============================================================

export type WorkspaceStatus = 'active' | 'merged' | 'abandoned' | 'conflict';

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly agentName: string;
  readonly baseGraphSnapshot: GraphSnapshot;
  status: WorkspaceStatus;
  readonly createdAt: number;
  updatedAt: number;

  // 工作区内的 Application（独立状态，不直接影响主 Application）
  readonly application: Application;

  // ChangeSet
  readonly changeSets: ChangeSetManager;

  // 操作
  createChangeSet(name: string, description?: string): RuntimeChangeSet;
  getCurrentChangeSet(): RuntimeChangeSet | null;
  commit(changeSetId: string): Promise<ChangeSetApplyResult>;
  diff(): ChangeSetPreview;
  abandon(): void;
}

export interface WorkspaceManager {
  create(name: string, agentName: string, options?: { description?: string }): Workspace;
  get(id: string): Workspace | null;
  getByName(name: string): Workspace | null;
  list(status?: WorkspaceStatus): Workspace[];
  listByAgent(agentName: string): Workspace[];
  getActiveWorkspaces(): Workspace[];
  remove(id: string): void;
}

// ============================================================
// 20. Resource Lock Contract（P0-4）
// ============================================================

export interface ResourceLock {
  readonly id: string;
  readonly resourceId: string;
  readonly resourceType: ChangeEntityType;
  readonly ownerAgent: string;
  readonly version: number;
  readonly acquiredAt: number;
  readonly expiresAt: number;
  readonly status: 'active' | 'expired' | 'released';

  isExpired(): boolean;
  release(): void;
  extend(ttlMs: number): void;
}

export interface VersionConflictError {
  code: 'VERSION_CONFLICT';
  resourceId: string;
  resourceType: ChangeEntityType;
  expectedVersion: number;
  actualVersion: number;
  ownerAgent: string;
  message: string;
}

export interface LockManager {
  acquire(resourceId: string, resourceType: ChangeEntityType, agentName: string, ttlMs?: number): ResourceLock;
  release(lockId: string): boolean;
  get(resourceId: string): ResourceLock | null;
  listActive(): ResourceLock[];
  listByAgent(agentName: string): ResourceLock[];
  checkVersion(resourceId: string, expectedVersion: number): { ok: boolean; actualVersion: number };
  incrementVersion(resourceId: string): number;
  getVersion(resourceId: string): number;
}

// ============================================================
// 21. Agent Handoff Contract（P0-5）
// ============================================================

export type HandoffStatus = 'pending' | 'accepted' | 'rejected' | 'completed';

export interface AgentHandoff {
  readonly id: string;
  readonly fromAgent: string;
  readonly toAgent: string;
  readonly task: string;
  readonly description?: string;
  status: HandoffStatus;
  readonly createdAt: number;
  updatedAt: number;

  // 上下文
  readonly workspaceId?: string;
  readonly changeSetId?: string;
  graphSnapshot?: GraphSnapshot;
  unresolvedIssues: string[];
  context: Record<string, unknown>;

  // 操作
  accept(): void;
  reject(reason: string): void;
  complete(summary: string): void;
  addIssue(issue: string): void;
}

export interface HandoffManager {
  create(fromAgent: string, toAgent: string, task: string, options?: {
    description?: string;
    workspaceId?: string;
    changeSetId?: string;
    graphSnapshot?: GraphSnapshot;
    context?: Record<string, unknown>;
  }): AgentHandoff;
  get(id: string): AgentHandoff | null;
  list(status?: HandoffStatus): AgentHandoff[];
  listByAgent(agentName: string): AgentHandoff[];
  listIncoming(agentName: string): AgentHandoff[];
  listOutgoing(agentName: string): AgentHandoff[];
  remove(id: string): void;
}

// ============================================================
// 22. Review / Merge Contract（P0-6）
// ============================================================

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';
export type MergeStatus = 'pending' | 'approved' | 'rejected' | 'merged' | 'conflict';

export interface ReviewComment {
  id: string;
  author: string;
  authorType: 'agent' | 'human';
  content: string;
  createdAt: number;
  changeEntryId?: string;
}

export interface ReviewRequest {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly author: string;
  readonly authorType: 'agent' | 'human';
  readonly changeSetId: string;
  readonly workspaceId?: string;
  status: ReviewStatus;
  readonly createdAt: number;
  updatedAt: number;

  reviewers: Array<{ name: string; type: 'agent' | 'human'; status: ReviewStatus }>;
  comments: ReviewComment[];

  // 操作
  addReviewer(name: string, type: 'agent' | 'human'): void;
  addComment(author: string, authorType: 'agent' | 'human', content: string, changeEntryId?: string): ReviewComment;
  approve(reviewer: string): void;
  reject(reviewer: string, reason: string): void;
  requestChanges(reviewer: string, reason: string): void;
}

export interface MergeRequest {
  readonly id: string;
  readonly title: string;
  readonly sourceWorkspaceId: string;
  readonly targetWorkspaceId: string; // 'main' 或其他 workspace
  readonly changeSetId: string;
  readonly author: string;
  status: MergeStatus;
  readonly createdAt: number;
  updatedAt: number;

  reviewRequestId?: string;
  conflictDetails?: string[];
  mergeResult?: ChangeSetApplyResult;

  // 操作
  approve(): void;
  reject(reason: string): void;
  merge(): Promise<ChangeSetApplyResult>;
}

export interface ReviewManager {
  createReview(title: string, author: string, authorType: 'agent' | 'human', changeSetId: string, options?: {
    description?: string;
    workspaceId?: string;
  }): ReviewRequest;
  getReview(id: string): ReviewRequest | null;
  listReviews(status?: ReviewStatus): ReviewRequest[];

  createMerge(title: string, sourceWorkspaceId: string, changeSetId: string, author: string, options?: {
    targetWorkspaceId?: string;
    reviewRequestId?: string;
  }): MergeRequest;
  getMerge(id: string): MergeRequest | null;
  listMerges(status?: MergeStatus): MergeRequest[];
}

// ============================================================
// 23. Persistence Contract（P0-7）
// ============================================================

export interface PersistenceAdapter {
  readonly name: string;
  readonly type: 'memory' | 'sqlite' | 'postgresql' | 'mongodb' | string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  getRepository<T extends Record<string, unknown>>(collection: string): Repository<T>;
  transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  migrate(migrations: Migration[]): Promise<PersistenceMigrationResult>;
}

export interface Repository<T extends Record<string, unknown>> {
  readonly collection: string;

  create(data: Partial<T>): Promise<T>;
  createMany(data: Array<Partial<T>>): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findOne(query: Query): Promise<T | null>;
  find(query?: Query): Promise<T[]>;
  findPaginated(query?: Query, pagination?: PaginationParams): Promise<PaginationResult<T>>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  updateMany(query: Query, data: Partial<T>): Promise<number>;
  delete(id: string): Promise<boolean>;
  deleteMany(query: Query): Promise<number>;
  count(query?: Query): Promise<number>;
  exists(query: Query): Promise<boolean>;
}

export interface Query {
  filter?: Record<string, unknown>;
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
  limit?: number;
  offset?: number;
  select?: string[];
}

export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Transaction {
  readonly id: string;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  getRepository<T extends Record<string, unknown>>(collection: string): Repository<T>;
}

export interface Migration {
  id: string;
  name: string;
  up: (adapter: PersistenceAdapter) => Promise<void>;
  down?: (adapter: PersistenceAdapter) => Promise<void>;
}

export interface PersistenceMigrationResult {
  applied: string[];
  skipped: string[];
  failed: Array<{ id: string; error: string }>;
}

// ============================================================
// 24. Plugin Contract Runtime（P0-11）
// ============================================================

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  main: string;
  dependencies?: string[];
  permissions?: string[];
  capabilities?: string[];
  configSchema?: JsonObject;
}

export type PluginState = 'installed' | 'enabled' | 'disabled' | 'error';

export interface PluginInstance {
  readonly manifest: PluginManifest;
  readonly state: PluginState;
  readonly installedAt: number;
  enabledAt?: number;

  enable(): Promise<void>;
  disable(): Promise<void>;
  uninstall(): Promise<void>;
  getConfig(): Record<string, unknown>;
  setConfig(key: string, value: unknown): void;
}

export interface PluginManager {
  install(manifest: PluginManifest, code?: unknown): Promise<PluginInstance>;
  uninstall(name: string): Promise<boolean>;
  enable(name: string): Promise<PluginInstance | null>;
  disable(name: string): Promise<PluginInstance | null>;
  get(name: string): PluginInstance | null;
  list(state?: PluginState): PluginInstance[];
  has(name: string): boolean;
}
