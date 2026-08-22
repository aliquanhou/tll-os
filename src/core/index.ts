/**
 * TLL OS - Core Implementation (Minimal for PoC)
 *
 * 内存版最小实现，支撑 hello-tll-agent PoC 运行。
 * 这不是生产实现，只是为了验证 Public Contract 可以支撑 Agent 完成完整闭环。
 */

import type {
  Application, ApplicationConfig, ApplicationState,
  ApplicationGraph, GraphNode, GraphNodeType, GraphEdge, GraphEdgeType,
  ImpactAnalysisResult, GraphSnapshot,
  Module, ModuleConfig, ModuleState, ModuleManager,
  ApiManager, ApiEndpoint, ApiDefinition, ApiRequest, ApiResponse, ApiHandler, HttpMethod,
  Tool, ToolDefinition, ToolManager, ToolResult, ToolContext, ToolHandler,
  Agent, AgentConfig, AgentManager, AgentResult, AgentExecutor, AgentExecutionContext, AgentStep,
  TestManager, TestCase, TestDefinition, TestResult, TestSuiteResult, TestState, TestContext, TestAssertions, TestFunction,
  EventManager, EventDefinition, TllEvent, EventListener,
  ConfigManager,
  RuntimeAdapter,
  TllOS, ContractInfo,
  JsonValue, JsonObject,
} from '../public/types.js';

// ============================================================
// 工具函数
// ============================================================

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter++;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

function now(): number {
  return Date.now();
}

// ============================================================
// Application Graph 实现
// ============================================================

class ApplicationGraphImpl implements ApplicationGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private appName: string;
  private appVersion: string;

  constructor(appName: string, appVersion: string) {
    this.appName = appName;
    this.appVersion = appVersion;
    // 添加 Application 节点
    this.addNode({
      id: 'application:root',
      type: 'application',
      name: appName,
      version: appVersion,
      status: 'active',
      metadata: { runtime: 'node' },
      createdAt: now(),
      updatedAt: now(),
    });
  }

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  removeNode(id: string): void {
    this.nodes.delete(id);
    // 移除相关边
    for (const [edgeId, edge] of this.edges) {
      if (edge.source === id || edge.target === id) {
        this.edges.delete(edgeId);
      }
    }
  }

  getNode(id: string): GraphNode | null {
    return this.nodes.get(id) ?? null;
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  updateNode(id: string, patch: Partial<GraphNode>): void {
    const node = this.nodes.get(id);
    if (node) {
      Object.assign(node, patch, { updatedAt: now() });
    }
  }

  listNodes(type?: GraphNodeType): GraphNode[] {
    const all = Array.from(this.nodes.values());
    return type ? all.filter(n => n.type === type) : all;
  }

  addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
  }

  removeEdge(id: string): void {
    this.edges.delete(id);
  }

  getEdge(id: string): GraphEdge | null {
    return this.edges.get(id) ?? null;
  }

  listEdges(type?: GraphEdgeType): GraphEdge[] {
    const all = Array.from(this.edges.values());
    return type ? all.filter(e => e.type === type) : all;
  }

  // 语义查询
  findModules(): GraphNode[] { return this.listNodes('module'); }
  findPlugins(): GraphNode[] { return this.listNodes('plugin'); }
  findApis(): GraphNode[] { return this.listNodes('api'); }
  findTools(): GraphNode[] { return this.listNodes('tool'); }
  findAgents(): GraphNode[] { return this.listNodes('agent'); }
  findEvents(): GraphNode[] { return this.listNodes('event'); }
  findModels(): GraphNode[] { return this.listNodes('model'); }
  findCommands(): GraphNode[] { return this.listNodes('command'); }
  findDependencies(): GraphNode[] { return this.listNodes('dependency'); }

  findApisByModule(moduleName: string): GraphNode[] {
    return this.listEdges('belongs_to')
      .filter(e => e.target === `module:${moduleName}`)
      .map(e => this.getNode(e.source))
      .filter((n): n is GraphNode => n !== null && n.type === 'api');
  }

  findToolsByModule(moduleName: string): GraphNode[] {
    return this.listEdges('belongs_to')
      .filter(e => e.target === `module:${moduleName}`)
      .map(e => this.getNode(e.source))
      .filter((n): n is GraphNode => n !== null && n.type === 'tool');
  }

  findModelsByModule(moduleName: string): GraphNode[] {
    return this.listEdges('uses')
      .filter(e => e.source === `module:${moduleName}` && this.getNode(e.target)?.type === 'model')
      .map(e => this.getNode(e.target))
      .filter((n): n is GraphNode => n !== null);
  }

  // 关系查询
  getDependencies(nodeId: string): GraphEdge[] {
    return this.listEdges().filter(e => e.source === nodeId && e.type === 'depends_on');
  }

  getDependents(nodeId: string): GraphEdge[] {
    return this.listEdges().filter(e => e.target === nodeId && e.type === 'depends_on');
  }

  getRelated(nodeId: string, edgeType?: GraphEdgeType): GraphNode[] {
    const edges = edgeType
      ? this.listEdges(edgeType).filter(e => e.source === nodeId || e.target === nodeId)
      : this.listEdges().filter(e => e.source === nodeId || e.target === nodeId);
    const relatedIds = new Set<string>();
    for (const edge of edges) {
      if (edge.source !== nodeId) relatedIds.add(edge.source);
      if (edge.target !== nodeId) relatedIds.add(edge.target);
    }
    return Array.from(relatedIds).map(id => this.getNode(id)).filter((n): n is GraphNode => n !== null);
  }

  getImpactAnalysis(nodeId: string): ImpactAnalysisResult {
    const node = this.getNode(nodeId);
    if (!node) {
      return {
        node: { id: nodeId, type: 'application', name: 'unknown', createdAt: 0, updatedAt: 0 },
        directDependents: [],
        indirectDependents: [],
        affectedApis: [],
        affectedAgents: [],
        riskLevel: 'low',
      };
    }

    const directDependentEdges = this.getDependents(nodeId);
    const directDependents = directDependentEdges.map(e => this.getNode(e.source)).filter((n): n is GraphNode => n !== null);

    const indirectDependents: GraphNode[] = [];
    for (const dep of directDependents) {
      const subDeps = this.getDependents(dep.id).map(e => this.getNode(e.source)).filter((n): n is GraphNode => n !== null);
      for (const sub of subDeps) {
        if (!directDependents.find(d => d.id === sub.id) && !indirectDependents.find(d => d.id === sub.id)) {
          indirectDependents.push(sub);
        }
      }
    }

    const affectedApis = [...directDependents, ...indirectDependents].filter(n => n.type === 'api');
    const affectedAgents = [...directDependents, ...indirectDependents].filter(n => n.type === 'agent');

    const totalAffected = directDependents.length + indirectDependents.length;
    const riskLevel: ImpactAnalysisResult['riskLevel'] =
      totalAffected === 0 ? 'low' :
      totalAffected <= 3 ? 'medium' :
      totalAffected <= 10 ? 'high' : 'critical';

    return { node, directDependents, indirectDependents, affectedApis, affectedAgents, riskLevel };
  }

  toJSON(): GraphSnapshot {
    return {
      version: '1.0.0',
      application: { name: this.appName, version: this.appVersion },
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      generatedAt: now(),
    };
  }
}

// ============================================================
// Config Manager 实现
// ============================================================

class ConfigManagerImpl implements ConfigManager {
  private store: Map<string, unknown> = new Map();

  get<T = unknown>(key: string, defaultValue?: T): T {
    return (this.store.has(key) ? this.store.get(key) : defaultValue) as T;
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  all(): Record<string, unknown> {
    return Object.fromEntries(this.store);
  }
}

// ============================================================
// Event Manager 实现
// ============================================================

class EventManagerImpl implements EventManager {
  private definitions: Map<string, EventDefinition> = new Map();
  private listenerMap: Map<string, Set<EventListener>> = new Map();

  define(definition: EventDefinition): void {
    this.definitions.set(definition.name, definition);
  }

  on<T>(name: string, listener: EventListener<T>): void {
    if (!this.listenerMap.has(name)) {
      this.listenerMap.set(name, new Set());
    }
    this.listenerMap.get(name)!.add(listener as EventListener);
  }

  off(name: string, listener: EventListener): void {
    this.listenerMap.get(name)?.delete(listener);
  }

  async dispatch<T>(name: string, payload?: T): Promise<TllEvent<T>> {
    const event: TllEvent<T> = { name, payload: payload as T, timestamp: now() };
    const listeners = this.listenerMap.get(name);
    if (listeners) {
      for (const listener of listeners) {
        await listener(event);
      }
    }
    return event;
  }

  list(): EventDefinition[] {
    return Array.from(this.definitions.values());
  }

  listeners(name: string): EventListener[] {
    return Array.from(this.listenerMap.get(name) ?? []);
  }
}

// ============================================================
// API Manager 实现
// ============================================================

class ApiEndpointImpl implements ApiEndpoint {
  readonly id: string;
  readonly method: ApiDefinition['method'];
  readonly path: string;
  readonly name: string;
  readonly description: string;
  readonly moduleName?: string;
  readonly handler: ApiHandler;

  constructor(def: ApiDefinition, moduleName?: string) {
    this.id = generateId('api');
    this.method = def.method;
    this.path = def.path;
    this.name = def.name ?? `${def.method.toLowerCase()}_${def.path.replace(/\//g, '_')}`;
    this.description = def.description ?? '';
    this.moduleName = moduleName;
    this.handler = def.handler;
  }

  async invoke(request: Partial<ApiRequest>): Promise<ApiResponse> {
    // 解析路径参数（从 endpoint path 模式中提取 :param）
    const requestPath = request.path ?? this.path;
    const parsedParams: Record<string, string> = { ...(request.params ?? {}) };
    const patternSegments = this.path.split('/');
    const pathOnly = requestPath.split('?')[0] ?? requestPath;
    const pathSegments = pathOnly.split('/');
    for (let i = 0; i < patternSegments.length; i++) {
      const seg = patternSegments[i];
      const val = pathSegments[i];
      if (seg && val && seg.startsWith(':')) {
        parsedParams[seg.slice(1)] = decodeURIComponent(val);
      }
    }

    const fullRequest: ApiRequest = {
      method: request.method ?? this.method,
      path: requestPath,
      headers: request.headers ?? {},
      query: request.query ?? {},
      params: parsedParams,
      body: request.body,
    };
    const result = await this.handler(fullRequest);
    if (result && typeof result === 'object' && 'status' in result) {
      return result as ApiResponse;
    }
    return { status: 200, headers: { 'content-type': 'application/json' }, body: result };
  }
}

class ApiManagerImpl implements ApiManager {
  private endpoints: Map<string, ApiEndpoint> = new Map();
  private moduleName?: string;
  private graph?: ApplicationGraphImpl;

  constructor(moduleName?: string, graph?: ApplicationGraphImpl) {
    this.moduleName = moduleName;
    this.graph = graph;
  }

  create(definition: ApiDefinition): ApiEndpoint {
    const endpoint = new ApiEndpointImpl(definition, this.moduleName);
    this.endpoints.set(endpoint.name, endpoint);

    // 同步到 Graph
    if (this.graph) {
      const nodeId = `api:${endpoint.name}`;
      this.graph.addNode({
        id: nodeId,
        type: 'api',
        name: endpoint.name,
        description: endpoint.description,
        status: 'active',
        permissions: definition.permissions,
        metadata: { method: endpoint.method, path: endpoint.path, module: this.moduleName },
        createdAt: now(),
        updatedAt: now(),
      });
      if (this.moduleName) {
        this.graph.addEdge({
          id: generateId('edge'),
          type: 'belongs_to',
          source: nodeId,
          target: `module:${this.moduleName}`,
          createdAt: now(),
        });
      }
    }

    return endpoint;
  }

  get(name: string): ApiEndpoint | null {
    return this.endpoints.get(name) ?? null;
  }

  has(name: string): boolean {
    return this.endpoints.has(name);
  }

  list(): ApiEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  remove(name: string): void {
    this.endpoints.delete(name);
  }

  match(method: string, path: string): ApiEndpoint | null {
    // 剥离 query string，只匹配路径部分
    const pathOnly = path.split('?')[0] ?? path;
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.method !== method && endpoint.method !== 'ALL') continue;
      // 简单路径匹配（支持 :param）
      const pattern = endpoint.path.replace(/:[^/]+/g, '[^/]+');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(pathOnly)) return endpoint;
    }
    return null;
  }

  async request(method: string, path: string, body?: unknown): Promise<ApiResponse> {
    const endpoint = this.match(method, path);
    if (!endpoint) {
      return { status: 404, headers: {}, body: { error: 'Not Found', path } };
    }
    // 解析 query 参数
    const query: Record<string, string> = {};
    const queryIndex = path.indexOf('?');
    if (queryIndex >= 0) {
      const searchParams = new URLSearchParams(path.slice(queryIndex + 1));
      for (const [key, value] of searchParams) {
        query[key] = value;
      }
    }
    return endpoint.invoke({ method: method as HttpMethod, path: path.split('?')[0] ?? path, body, query });
  }
}

// ============================================================
// Tool Manager 实现
// ============================================================

class ToolImpl implements Tool {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonObject;
  readonly permissions: string[];
  readonly category: string;
  readonly moduleName?: string;
  private handler: ToolHandler;

  constructor(def: ToolDefinition, moduleName?: string) {
    this.id = generateId('tool');
    this.name = def.name;
    this.description = def.description;
    this.parameters = def.parameters;
    this.permissions = def.permissions ?? [];
    this.category = def.category ?? 'custom';
    this.moduleName = moduleName;
    this.handler = def.handler;
  }

  async invoke(args: Record<string, JsonValue>, context?: Partial<ToolContext>): Promise<ToolResult> {
    const fullContext: ToolContext = {
      applicationName: context?.applicationName ?? 'unknown',
      moduleName: this.moduleName,
      agentName: context?.agentName,
      requestId: context?.requestId ?? generateId('req'),
    };
    try {
      const result = await this.handler(args, fullContext);
      return result;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TOOL_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}

class ToolManagerImpl implements ToolManager {
  private tools: Map<string, Tool> = new Map();
  private moduleName?: string;
  private graph?: ApplicationGraphImpl;

  constructor(moduleName?: string, graph?: ApplicationGraphImpl) {
    this.moduleName = moduleName;
    this.graph = graph;
  }

  create(definition: ToolDefinition): Tool {
    const tool = new ToolImpl(definition, this.moduleName);
    this.tools.set(tool.name, tool);

    if (this.graph) {
      const nodeId = `tool:${tool.name}`;
      this.graph.addNode({
        id: nodeId,
        type: 'tool',
        name: tool.name,
        description: tool.description,
        status: 'active',
        permissions: tool.permissions,
        capabilities: [tool.category],
        metadata: { category: tool.category, module: this.moduleName, parameters: tool.parameters },
        createdAt: now(),
        updatedAt: now(),
      });
      if (this.moduleName) {
        this.graph.addEdge({
          id: generateId('edge'),
          type: 'belongs_to',
          source: nodeId,
          target: `module:${this.moduleName}`,
          createdAt: now(),
        });
      }
    }

    return tool;
  }

  get(name: string): Tool | null {
    return this.tools.get(name) ?? null;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(category?: string): Tool[] {
    const all = Array.from(this.tools.values());
    return category ? all.filter(t => t.category === category) : all;
  }

  remove(name: string): void {
    this.tools.delete(name);
  }
}

// ============================================================
// Test Manager 实现
// ============================================================

class TestAssertionsImpl implements TestAssertions {
  equal(actual: unknown, expected: unknown, message?: string): void {
    if (actual !== expected) {
      throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  notEqual(actual: unknown, expected: unknown, message?: string): void {
    if (actual === expected) {
      throw new Error(message ?? `Expected not ${JSON.stringify(expected)}`);
    }
  }

  true(value: unknown, message?: string): void {
    if (value !== true) {
      throw new Error(message ?? `Expected true, got ${JSON.stringify(value)}`);
    }
  }

  false(value: unknown, message?: string): void {
    if (value !== false) {
      throw new Error(message ?? `Expected false, got ${JSON.stringify(value)}`);
    }
  }

  throws(fn: () => unknown, error?: string | RegExp): void {
    try {
      fn();
      throw new Error('Expected function to throw');
    } catch (e) {
      if (e instanceof Error && e.message === 'Expected function to throw') throw e;
      if (error) {
        const msg = e instanceof Error ? e.message : String(e);
        if (typeof error === 'string' && !msg.includes(error)) {
          throw new Error(`Expected error containing "${error}", got "${msg}"`);
        }
        if (error instanceof RegExp && !error.test(msg)) {
          throw new Error(`Expected error matching ${error}, got "${msg}"`);
        }
      }
    }
  }

  deepEqual(actual: unknown, expected: unknown, message?: string): void {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
      throw new Error(message ?? `Expected ${expectedJson}, got ${actualJson}`);
    }
  }
}

class TestCaseImpl implements TestCase {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly moduleName?: string;
  state: TestState = 'pending';
  result?: TestResult;
  private testFn: TestFunction;
  private contextFactory: () => TestContext;

  constructor(def: TestDefinition, contextFactory: () => TestContext) {
    this.id = generateId('test');
    this.name = def.name;
    this.description = def.description ?? '';
    this.moduleName = def.moduleName;
    this.testFn = def.test;
    this.contextFactory = contextFactory;
  }

  async run(): Promise<TestResult> {
    this.state = 'running';
    const startTime = now();
    try {
      await this.testFn(this.contextFactory());
      const duration = now() - startTime;
      this.state = 'passed';
      this.result = { passed: true, name: this.name, duration };
      return this.result;
    } catch (error) {
      const duration = now() - startTime;
      this.state = 'failed';
      this.result = {
        passed: false,
        name: this.name,
        duration,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      };
      return this.result;
    }
  }
}

class TestManagerImpl implements TestManager {
  private tests: Map<string, TestCase> = new Map();
  private moduleName?: string;
  private contextFactory: () => TestContext;

  constructor(contextFactory: () => TestContext, moduleName?: string) {
    this.contextFactory = contextFactory;
    this.moduleName = moduleName;
  }

  create(definition: TestDefinition): TestCase {
    const test = new TestCaseImpl({ ...definition, moduleName: definition.moduleName ?? this.moduleName }, this.contextFactory);
    this.tests.set(test.name, test);
    return test;
  }

  get(name: string): TestCase | null {
    return this.tests.get(name) ?? null;
  }

  has(name: string): boolean {
    return this.tests.has(name);
  }

  list(): TestCase[] {
    return Array.from(this.tests.values());
  }

  remove(name: string): void {
    this.tests.delete(name);
  }

  async runAll(): Promise<TestSuiteResult> {
    return this.runTests(Array.from(this.tests.values()));
  }

  async runByModule(moduleName: string): Promise<TestSuiteResult> {
    const tests = Array.from(this.tests.values()).filter(t => t.moduleName === moduleName);
    return this.runTests(tests);
  }

  async runSingle(name: string): Promise<TestResult> {
    const test = this.tests.get(name);
    if (!test) {
      return { passed: false, name, duration: 0, error: { message: `Test "${name}" not found` } };
    }
    return test.run();
  }

  private async runTests(tests: TestCase[]): Promise<TestSuiteResult> {
    const startTime = now();
    const results: TestResult[] = [];
    let passed = 0, failed = 0, errors = 0;

    for (const test of tests) {
      const result = await test.run();
      results.push(result);
      if (result.passed) passed++;
      else { failed++; if (test.state === 'error') errors++; }
    }

    return {
      total: tests.length,
      passed,
      failed,
      errors,
      duration: now() - startTime,
      results,
    };
  }
}

// ============================================================
// Module 实现
// ============================================================

class ModuleImpl implements Module {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly namespace: string;
  readonly version: string;
  state: ModuleState = 'registered';

  readonly apis: ApiManager;
  readonly tools: ToolManager;
  readonly tests: TestManager;
  readonly events: EventManager;
  readonly config: ConfigManager;

  private services: Map<string, unknown> = new Map();

  constructor(config: ModuleConfig, graph: ApplicationGraphImpl, application: Application) {
    this.id = generateId('module');
    this.name = config.name;
    this.description = config.description ?? '';
    this.namespace = config.namespace ?? config.name;
    this.version = config.version ?? '0.1.0';

    this.apis = new ApiManagerImpl(config.name, graph);
    this.tools = new ToolManagerImpl(config.name, graph);
    this.events = new EventManagerImpl();
    this.config = new ConfigManagerImpl();

    const contextFactory = (): TestContext => ({
      application,
      module: this,
      assert: new TestAssertionsImpl(),
    });
    this.tests = new TestManagerImpl(contextFactory, config.name);

    // 注册到 Graph
    graph.addNode({
      id: `module:${this.name}`,
      type: 'module',
      name: this.name,
      description: this.description,
      version: this.version,
      status: 'active',
      capabilities: [],
      metadata: { namespace: this.namespace },
      createdAt: now(),
      updatedAt: now(),
    });

    // 依赖关系
    for (const dep of config.dependencies ?? []) {
      graph.addEdge({
        id: generateId('edge'),
        type: 'depends_on',
        source: `module:${this.name}`,
        target: `module:${dep}`,
        createdAt: now(),
      });
    }
  }

  registerService(name: string, implementation: unknown): void {
    this.services.set(name, implementation);
  }

  getService<T = unknown>(name: string): T | null {
    return (this.services.get(name) as T) ?? null;
  }

  listServices(): string[] {
    return Array.from(this.services.keys());
  }
}

class ModuleManagerImpl implements ModuleManager {
  private modules: Map<string, Module> = new Map();
  private graph: ApplicationGraphImpl;
  private application: Application;

  constructor(graph: ApplicationGraphImpl, application: Application) {
    this.graph = graph;
    this.application = application;
  }

  create(config: ModuleConfig): Module {
    const module = new ModuleImpl(config, this.graph, this.application);
    this.modules.set(module.name, module);
    return module;
  }

  get(name: string): Module | null {
    return this.modules.get(name) ?? null;
  }

  has(name: string): boolean {
    return this.modules.has(name);
  }

  list(): Module[] {
    return Array.from(this.modules.values());
  }

  remove(name: string): void {
    this.modules.delete(name);
    this.graph.removeNode(`module:${name}`);
  }
}

// ============================================================
// Agent 实现
// ============================================================

class AgentImpl implements Agent {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly description: string;
  readonly tools: string[];
  readonly permissions: string[];
  private executor?: AgentExecutor;
  private application: Application;

  constructor(config: AgentConfig, application: Application, graph: ApplicationGraphImpl) {
    this.id = generateId('agent');
    this.name = config.name;
    this.role = config.role;
    this.description = config.description ?? '';
    this.tools = config.tools ?? [];
    this.permissions = config.permissions ?? [];
    this.application = application;

    // 注册到 Graph
    graph.addNode({
      id: `agent:${this.name}`,
      type: 'agent',
      name: this.name,
      description: this.description,
      status: 'active',
      permissions: this.permissions,
      capabilities: [this.role],
      metadata: { role: this.role, tools: this.tools, model: config.model },
      createdAt: now(),
      updatedAt: now(),
    });

    // Agent 调用 Tool 的边
    for (const toolName of this.tools) {
      graph.addEdge({
        id: generateId('edge'),
        type: 'calls',
        source: `agent:${this.name}`,
        target: `tool:${toolName}`,
        createdAt: now(),
      });
    }
  }

  setExecutor(executor: AgentExecutor): void {
    this.executor = executor;
  }

  async run(input: string, _context?: Record<string, unknown>): Promise<AgentResult> {
    const availableTools = this.tools
      .map(name => this.application.tools.get(name))
      .filter((t): t is Tool => t !== null);

    const execContext: AgentExecutionContext = {
      application: this.application,
      availableTools,
      agentName: this.name,
      requestId: generateId('req'),
    };

    const steps: AgentStep[] = [];
    const toolCalls: AgentResult['toolCalls'] = [];

    steps.push({ step: 1, type: 'think', content: `Received input: ${input}` });

    if (this.executor) {
      try {
        const result = await this.executor(input, execContext);
        steps.push({ step: 2, type: 'final', content: result.output });
        return { ...result, steps: [...steps, ...result.steps] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        steps.push({ step: 2, type: 'final', content: `Error: ${msg}` });
        return { output: `Error: ${msg}`, steps, toolCalls, success: false };
      }
    }

    // 默认执行：简单回显（PoC 中 Agent 应该设置 executor）
    const output = `Agent "${this.name}" received: ${input}. (No executor set, using default response.)`;
    steps.push({ step: 2, type: 'final', content: output });
    return { output, steps, toolCalls, success: true };
  }
}

class AgentManagerImpl implements AgentManager {
  private agents: Map<string, Agent> = new Map();
  private application: Application;
  private graph: ApplicationGraphImpl;

  constructor(application: Application, graph: ApplicationGraphImpl) {
    this.application = application;
    this.graph = graph;
  }

  create(config: AgentConfig): Agent {
    const agent = new AgentImpl(config, this.application, this.graph);
    this.agents.set(agent.name, agent);
    return agent;
  }

  get(name: string): Agent | null {
    return this.agents.get(name) ?? null;
  }

  has(name: string): boolean {
    return this.agents.has(name);
  }

  list(): Agent[] {
    return Array.from(this.agents.values());
  }

  remove(name: string): void {
    this.agents.delete(name);
    this.graph.removeNode(`agent:${name}`);
  }
}

// ============================================================
// 聚合管理器（Application 级聚合所有 Module 级资源）
// ============================================================

/**
 * 聚合 API 管理器：Application.apis 同时包含 Application 级和所有 Module 级的 API。
 * Agent 通过 app.apis.request() 可以调用任何 Module 注册的 API。
 */
class AggregatingApiManager implements ApiManager {
  private appLevel: ApiManagerImpl;
  private getModules: () => Module[];

  constructor(appLevel: ApiManagerImpl, getModules: () => Module[]) {
    this.appLevel = appLevel;
    this.getModules = getModules;
  }

  create(definition: ApiDefinition): ApiEndpoint {
    return this.appLevel.create(definition);
  }

  get(name: string): ApiEndpoint | null {
    let found = this.appLevel.get(name);
    if (found) return found;
    for (const mod of this.getModules()) {
      found = mod.apis.get(name);
      if (found) return found;
    }
    return null;
  }

  has(name: string): boolean {
    return this.get(name) !== null;
  }

  list(): ApiEndpoint[] {
    const all = [...this.appLevel.list()];
    for (const mod of this.getModules()) {
      all.push(...mod.apis.list());
    }
    return all;
  }

  remove(name: string): void {
    this.appLevel.remove(name);
  }

  match(method: string, path: string): ApiEndpoint | null {
    let found = this.appLevel.match(method, path);
    if (found) return found;
    for (const mod of this.getModules()) {
      found = mod.apis.match(method, path);
      if (found) return found;
    }
    return null;
  }

  async request(method: string, path: string, body?: unknown): Promise<ApiResponse> {
    const endpoint = this.match(method, path);
    if (!endpoint) {
      return { status: 404, headers: {}, body: { error: 'Not Found', path } };
    }
    const query: Record<string, string> = {};
    const queryIndex = path.indexOf('?');
    if (queryIndex >= 0) {
      const searchParams = new URLSearchParams(path.slice(queryIndex + 1));
      for (const [key, value] of searchParams) {
        query[key] = value;
      }
    }
    return endpoint.invoke({ method: method as HttpMethod, path: path.split('?')[0] ?? path, body, query });
  }
}

/**
 * 聚合 Tool 管理器：Application.tools 同时包含 Application 级和所有 Module 级的 Tool。
 * Agent 通过 app.tools.get() 可以找到任何 Module 注册的 Tool。
 */
class AggregatingToolManager implements ToolManager {
  private appLevel: ToolManagerImpl;
  private getModules: () => Module[];

  constructor(appLevel: ToolManagerImpl, getModules: () => Module[]) {
    this.appLevel = appLevel;
    this.getModules = getModules;
  }

  create(definition: ToolDefinition): Tool {
    return this.appLevel.create(definition);
  }

  get(name: string): Tool | null {
    let found = this.appLevel.get(name);
    if (found) return found;
    for (const mod of this.getModules()) {
      found = mod.tools.get(name);
      if (found) return found;
    }
    return null;
  }

  has(name: string): boolean {
    return this.get(name) !== null;
  }

  list(category?: string): Tool[] {
    const all = [...this.appLevel.list(category)];
    for (const mod of this.getModules()) {
      all.push(...mod.tools.list(category));
    }
    return all;
  }

  remove(name: string): void {
    this.appLevel.remove(name);
  }
}

/**
 * 聚合 Test 管理器：Application.tests 同时包含 Application 级和所有 Module 级的测试。
 * app.tests.runAll() 会运行所有 Module 的测试。
 */
class AggregatingTestManager implements TestManager {
  private appLevel: TestManagerImpl;
  private getModules: () => Module[];

  constructor(appLevel: TestManagerImpl, getModules: () => Module[]) {
    this.appLevel = appLevel;
    this.getModules = getModules;
  }

  create(definition: TestDefinition): TestCase {
    return this.appLevel.create(definition);
  }

  get(name: string): TestCase | null {
    let found = this.appLevel.get(name);
    if (found) return found;
    for (const mod of this.getModules()) {
      found = mod.tests.get(name);
      if (found) return found;
    }
    return null;
  }

  has(name: string): boolean {
    return this.get(name) !== null;
  }

  list(): TestCase[] {
    const all = [...this.appLevel.list()];
    for (const mod of this.getModules()) {
      all.push(...mod.tests.list());
    }
    return all;
  }

  remove(name: string): void {
    this.appLevel.remove(name);
  }

  async runAll(): Promise<TestSuiteResult> {
    const allTests = this.list();
    const results: TestResult[] = [];
    let passed = 0, failed = 0, errors = 0;
    const startTime = now();

    for (const test of allTests) {
      const result = await test.run();
      results.push(result);
      if (result.passed) passed++;
      else { failed++; if (test.state === 'error') errors++; }
    }

    return { total: allTests.length, passed, failed, errors, duration: now() - startTime, results };
  }

  async runByModule(moduleName: string): Promise<TestSuiteResult> {
    const mod = this.getModules().find(m => m.name === moduleName);
    if (!mod) {
      return { total: 0, passed: 0, failed: 0, errors: 0, duration: 0, results: [] };
    }
    return mod.tests.runAll();
  }

  async runSingle(name: string): Promise<TestResult> {
    const test = this.get(name);
    if (!test) {
      return { passed: false, name, duration: 0, error: { message: `Test "${name}" not found` } };
    }
    return test.run();
  }
}

// ============================================================
// Application 实现
// ============================================================

class ApplicationImpl implements Application {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  state: ApplicationState = 'created';

  readonly graph: ApplicationGraphImpl;
  readonly modules: ModuleManager;
  readonly apis: ApiManager;
  readonly tools: ToolManager;
  readonly agents: AgentManager;
  readonly tests: TestManager;
  readonly events: EventManager;
  readonly config: ConfigManager;

  constructor(config: ApplicationConfig) {
    this.id = generateId('app');
    this.name = config.name;
    this.version = config.version;

    this.graph = new ApplicationGraphImpl(config.name, config.version);
    this.events = new EventManagerImpl();
    this.config = new ConfigManagerImpl();

    // 设置默认配置
    this.config.set('app.name', config.name);
    this.config.set('app.version', config.version);
    this.config.set('app.environment', config.environment ?? 'development');
    this.config.set('app.runtime', config.runtime ?? 'node');

    this.modules = new ModuleManagerImpl(this.graph, this);

    // Application 级管理器（内部实现）
    const appLevelApis = new ApiManagerImpl(undefined, this.graph);
    const appLevelTools = new ToolManagerImpl(undefined, this.graph);
    const contextFactory = (): TestContext => ({
      application: this,
      assert: new TestAssertionsImpl(),
    });
    const appLevelTests = new TestManagerImpl(contextFactory);

    // 聚合管理器：Application 级 + 所有 Module 级资源
    // Agent 通过 app.apis / app.tools / app.tests 可以访问任何 Module 注册的资源
    this.apis = new AggregatingApiManager(appLevelApis, () => this.modules.list());
    this.tools = new AggregatingToolManager(appLevelTools, () => this.modules.list());
    this.tests = new AggregatingTestManager(appLevelTests, () => this.modules.list());

    this.agents = new AgentManagerImpl(this, this.graph);
  }

  async start(): Promise<void> {
    this.state = 'starting';
    await this.events.dispatch('application.starting', { name: this.name });
    this.state = 'running';
    await this.events.dispatch('application.started', { name: this.name });
  }

  async stop(): Promise<void> {
    this.state = 'stopping';
    await this.events.dispatch('application.stopping', { name: this.name });
    this.state = 'stopped';
  }
}

// ============================================================
// TllOS 入口实现
// ============================================================

const CONTRACTS: ContractInfo[] = [
  { name: 'Application Model', version: '1.0.0', description: '应用模型与生命周期', status: 'stable' },
  { name: 'Application Graph', version: '1.0.0', description: '应用结构图', status: 'beta' },
  { name: 'Module Contract', version: '1.0.0', description: '模块契约', status: 'stable' },
  { name: 'Plugin Contract', version: '1.0.0', description: '插件契约', status: 'beta' },
  { name: 'Agent Contract', version: '1.0.0', description: 'AI Agent 契约', status: 'beta' },
  { name: 'Tool Contract', version: '1.0.0', description: 'Tool 契约', status: 'stable' },
  { name: 'Skill Contract', version: '0.1.0', description: 'Skill 契约', status: 'draft' },
  { name: 'AI Context Contract', version: '0.1.0', description: 'AI 上下文契约', status: 'draft' },
  { name: 'Permission Contract', version: '1.0.0', description: '权限契约', status: 'stable' },
  { name: 'Workflow Contract', version: '0.1.0', description: '工作流契约', status: 'draft' },
  { name: 'Runtime Lifecycle', version: '1.0.0', description: '运行时生命周期', status: 'stable' },
  { name: 'Developer-Agent Protocol', version: '0.1.0', description: '开发者-Agent 协议', status: 'draft' },
  { name: 'Runtime Adapter', version: '0.1.0', description: '运行时适配器', status: 'beta' },
];

class TllOSImpl implements TllOS {
  private applications: Map<string, Application> = new Map();
  private runtime: RuntimeAdapter;

  constructor(runtime?: RuntimeAdapter) {
    this.runtime = runtime ?? createDefaultRuntime();
  }

  createApplication(config: ApplicationConfig): Application {
    const app = new ApplicationImpl(config);
    this.applications.set(app.name, app);
    return app;
  }

  getApplication(name: string): Application | null {
    return this.applications.get(name) ?? null;
  }

  listApplications(): Application[] {
    return Array.from(this.applications.values());
  }

  getRuntime(): RuntimeAdapter {
    return this.runtime;
  }

  getContracts(): ContractInfo[] {
    return CONTRACTS;
  }
}

// ============================================================
// 默认 Runtime Adapter（Node.js）
// ============================================================

function createDefaultRuntime(): RuntimeAdapter {
  // 动态检测运行时
  const globalAny = globalThis as unknown as { Bun?: { version: string } };
  const isBun = typeof globalAny.Bun !== 'undefined';
  const runtimeName = isBun ? 'bun' : 'node';
  const runtimeVersion = isBun
    ? globalAny.Bun!.version
    : (typeof process !== 'undefined' ? process.version : 'unknown');

  return {
    name: runtimeName,
    version: runtimeVersion,
    fs: {
      async readFile(path: string): Promise<string> {
        const fs = await import('node:fs/promises');
        return fs.readFile(path, 'utf-8');
      },
      async writeFile(path: string, data: string): Promise<void> {
        const fs = await import('node:fs/promises');
        await fs.writeFile(path, data, 'utf-8');
      },
      async exists(path: string): Promise<boolean> {
        const fs = await import('node:fs/promises');
        try { await fs.access(path); return true; } catch { return false; }
      },
      async readDir(path: string): Promise<string[]> {
        const fs = await import('node:fs/promises');
        return fs.readdir(path);
      },
    },
    env: {
      get(key: string): string | undefined {
        return typeof process !== 'undefined' ? process.env[key] : undefined;
      },
      set(key: string, value: string): void {
        if (typeof process !== 'undefined') process.env[key] = value;
      },
      all(): Record<string, string> {
        if (typeof process === 'undefined') return {};
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(process.env)) {
          if (value !== undefined) result[key] = value;
        }
        return result;
      },
    },
    process: {
      exit(code?: number): void {
        if (typeof process !== 'undefined') process.exit(code);
      },
      cwd(): string {
        return typeof process !== 'undefined' ? process.cwd() : '/';
      },
    },
  };
}

// ============================================================
// 导出
// ============================================================

export function createTllOS(runtime?: RuntimeAdapter): TllOS {
  return new TllOSImpl(runtime);
}

export { TllOSImpl, ApplicationImpl, ApplicationGraphImpl };
