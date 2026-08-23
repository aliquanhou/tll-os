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
  StandardApiResponse, ApiResponseBuilder, ApiErrorDetail, PaginationInfo,
  PersistenceAdapter,
} from '../public/types.js';

import {
  ChangeSetManagerImpl,
  WorkspaceManagerImpl,
  LockManagerImpl,
  HandoffManagerImpl,
  ReviewManagerImpl,
} from './collaboration.js';

import { MemoryPersistenceAdapter } from './persistence.js';
import { PluginManagerImpl } from './plugin.js';

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
        directDependents: [], indirectDependents: [],
        ownedApis: [], ownedTools: [], ownedTests: [], ownedAgents: [], ownedModels: [], ownedEvents: [],
        affectedModules: [], affectedApis: [], affectedTools: [], affectedAgents: [], affectedTests: [],
        callers: [], callees: [], regressionPoints: [], dependencyPaths: [],
        riskLevel: 'low', summary: 'Node not found in graph.',
      };
    }

    // === 1. 归属资源（belongs_to 反向：谁的 target 是这个节点）===
    const ownedEdges = this.edgesArray().filter(e => e.type === 'belongs_to' && e.target === nodeId);
    const ownedNodes = ownedEdges.map(e => this.getNode(e.source)).filter((n): n is GraphNode => n !== null);
    const ownedApis = ownedNodes.filter(n => n.type === 'api');
    const ownedTools = ownedNodes.filter(n => n.type === 'tool');
    const ownedTests = ownedNodes.filter(n => n.type === 'command'); // tests registered as command nodes
    const ownedAgents = ownedNodes.filter(n => n.type === 'agent');
    const ownedModels = ownedNodes.filter(n => n.type === 'model');
    const ownedEvents = ownedNodes.filter(n => n.type === 'event');

    // === 2. 依赖者（depends_on 反向：谁依赖这个节点）===
    const directDependentEdges = this.getDependents(nodeId);
    const directDependents = directDependentEdges.map(e => this.getNode(e.source)).filter((n): n is GraphNode => n !== null);

    const indirectDependents: GraphNode[] = [];
    for (const dep of directDependents) {
      const subDeps = this.getDependents(dep.id).map(e => this.getNode(e.source)).filter((n): n is GraphNode => n !== null);
      for (const sub of subDeps) {
        if (sub.id !== nodeId && !directDependents.find(d => d.id === sub.id) && !indirectDependents.find(d => d.id === sub.id)) {
          indirectDependents.push(sub);
        }
      }
    }

    // === 3. 调用链（calls 边）===
    const callerEdges = this.edgesArray().filter(e => e.type === 'calls' && e.target === nodeId);
    const callers = callerEdges.map(e => this.getNode(e.source)).filter((n): n is GraphNode => n !== null);
    const calleeEdges = this.edgesArray().filter(e => e.type === 'calls' && e.source === nodeId);
    const callees = calleeEdges.map(e => this.getNode(e.target)).filter((n): n is GraphNode => n !== null);

    // === 4. uses 边 ===
    const userEdges = this.edgesArray().filter(e => e.type === 'uses' && e.target === nodeId);
    const users = userEdges.map(e => this.getNode(e.source)).filter((n): n is GraphNode => n !== null);

    // === 5. 汇总受影响范围 ===
    const allAffected = new Set<string>();
    const addAffected = (nodes: GraphNode[]) => { for (const n of nodes) allAffected.add(n.id); };
    addAffected(directDependents);
    addAffected(indirectDependents);
    addAffected(ownedApis);
    addAffected(ownedTools);
    addAffected(ownedTests);
    addAffected(ownedAgents);
    addAffected(callers);
    addAffected(users);

    const affectedList = Array.from(allAffected).map(id => this.getNode(id)).filter((n): n is GraphNode => n !== null);
    const affectedModules = affectedList.filter(n => n.type === 'module');
    const affectedApis = affectedList.filter(n => n.type === 'api');
    const affectedTools = affectedList.filter(n => n.type === 'tool');
    const affectedAgents = affectedList.filter(n => n.type === 'agent');
    const affectedTests = affectedList.filter(n => n.type === 'command');

    // === 6. 回归点分析 ===
    const regressionPoints: ImpactAnalysisResult['regressionPoints'] = [];
    for (const api of ownedApis) {
      regressionPoints.push({ node: api, reason: `API "${api.name}" belongs to modified node, contract may change`, severity: 'high' });
    }
    for (const tool of ownedTools) {
      regressionPoints.push({ node: tool, reason: `Tool "${tool.name}" belongs to modified node, behavior may change`, severity: 'high' });
      // 调用这个 tool 的 agent 也是回归点
      const toolCallers = this.edgesArray().filter(e => e.type === 'calls' && e.target === tool.id);
      for (const ce of toolCallers) {
        const caller = this.getNode(ce.source);
        if (caller) regressionPoints.push({ node: caller, reason: `Agent "${caller.name}" calls Tool "${tool.name}" which may change`, severity: 'medium' });
      }
    }
    for (const test of ownedTests) {
      regressionPoints.push({ node: test, reason: `Test "${test.name}" covers modified node, must re-run`, severity: 'medium' });
    }
    for (const dep of directDependents) {
      regressionPoints.push({ node: dep, reason: `Module "${dep.name}" directly depends on modified node`, severity: dep.type === 'module' ? 'high' : 'medium' });
    }

    // === 7. 依赖路径 ===
    const dependencyPaths: ImpactAnalysisResult['dependencyPaths'] = [];
    for (const depEdge of directDependentEdges) {
      const depNode = this.getNode(depEdge.source);
      if (depNode) {
        const pathRisk: 'low' | 'medium' | 'high' | 'critical' = depNode.type === 'module' ? 'high' : 'medium';
        dependencyPaths.push({ path: [nodeId, depNode.id], risk: pathRisk });
        // 二级路径
        const subDeps = this.getDependents(depNode.id);
        for (const subEdge of subDeps) {
          const subNode = this.getNode(subEdge.source);
          if (subNode && subNode.id !== nodeId) {
            dependencyPaths.push({ path: [nodeId, depNode.id, subNode.id], risk: 'medium' });
          }
        }
      }
    }

    // === 8. 风险等级 ===
    const totalAffected = allAffected.size;
    const highRiskCount = regressionPoints.filter(r => r.severity === 'high' || r.severity === 'critical').length;
    const riskLevel: ImpactAnalysisResult['riskLevel'] =
      totalAffected === 0 ? 'low' :
      highRiskCount >= 5 || totalAffected >= 15 ? 'critical' :
      highRiskCount >= 2 || totalAffected >= 8 ? 'high' :
      totalAffected >= 3 ? 'medium' : 'low';

    // === 9. 摘要 ===
    const summary = `Node "${node.name}" (${node.type}) impact: ${totalAffected} affected nodes, ` +
      `${affectedModules.length} modules, ${affectedApis.length} APIs, ${affectedTools.length} tools, ` +
      `${affectedAgents.length} agents, ${affectedTests.length} tests. Risk: ${riskLevel}.`;

    return {
      node, directDependents, indirectDependents,
      ownedApis, ownedTools, ownedTests, ownedAgents, ownedModels, ownedEvents,
      affectedModules, affectedApis, affectedTools, affectedAgents, affectedTests,
      callers, callees, regressionPoints, dependencyPaths, riskLevel, summary,
    };
  }

  private edgesArray(): GraphEdge[] {
    return Array.from(this.edges.values());
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

    // P0-10: JSON Schema 输入校验
    if (this.parameters && Object.keys(this.parameters).length > 0) {
      const validation = validateJsonSchema(args, this.parameters);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'TOOL_VALIDATION_ERROR',
            message: `Input validation failed: ${validation.errors.map(e => e.message).join('; ')}`,
          },
        };
      }
    }

    // P0-10: 权限检查（如果 context 提供了 agent 权限）
    if (this.permissions.length > 0 && context?.agentName) {
      // 权限检查由调用方（Agent 执行器）在调用前验证，
      // 这里记录权限要求，实际执行在 Agent Workspace 层完成
      // （当前 PoC 阶段：权限声明已记录，执行层在 P0-3 Workspace 中实现）
    }

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
    if (!value) {
      throw new Error(message ?? `Expected truthy value, got ${JSON.stringify(value)}`);
    }
  }

  false(value: unknown, message?: string): void {
    if (value) {
      throw new Error(message ?? `Expected falsy value, got ${JSON.stringify(value)}`);
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
  private graph?: ApplicationGraphImpl;

  constructor(contextFactory: () => TestContext, moduleName?: string, graph?: ApplicationGraphImpl) {
    this.contextFactory = contextFactory;
    this.moduleName = moduleName;
    this.graph = graph;
  }

  create(definition: TestDefinition): TestCase {
    const test = new TestCaseImpl({ ...definition, moduleName: definition.moduleName ?? this.moduleName }, this.contextFactory);
    this.tests.set(test.name, test);

    // 注册到 Graph（作为 command 节点）
    if (this.graph) {
      const nodeId = `test:${test.name}`;
      this.graph.addNode({
        id: nodeId,
        type: 'command',
        name: test.name,
        description: test.description,
        status: 'pending',
        metadata: { kind: 'test', module: this.moduleName },
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
    this.tests = new TestManagerImpl(contextFactory, config.name, graph);

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

  // Multi-Agent 协作（P0-2 ~ P0-6）
  readonly workspaces: WorkspaceManagerImpl;
  readonly locks: LockManagerImpl;
  readonly handoffs: HandoffManagerImpl;
  readonly reviews: ReviewManagerImpl;
  readonly changeSets: ChangeSetManagerImpl;

  // Persistence & Plugin（P0-7, P0-11）
  readonly persistence: PersistenceAdapter;
  readonly plugins: PluginManagerImpl;

  // HTTP 服务器（P0-8）
  private httpServer?: { close(): Promise<void> };

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
    const appLevelTests = new TestManagerImpl(contextFactory, undefined, this.graph);

    // 聚合管理器：Application 级 + 所有 Module 级资源
    // Agent 通过 app.apis / app.tools / app.tests 可以访问任何 Module 注册的资源
    this.apis = new AggregatingApiManager(appLevelApis, () => this.modules.list());
    this.tools = new AggregatingToolManager(appLevelTools, () => this.modules.list());
    this.tests = new AggregatingTestManager(appLevelTests, () => this.modules.list());

    this.agents = new AgentManagerImpl(this, this.graph);

    // Multi-Agent 协作管理器（P0-2 ~ P0-6）
    this.changeSets = new ChangeSetManagerImpl();
    this.changeSets.setApplication(this);
    this.workspaces = new WorkspaceManagerImpl();
    this.workspaces.setMainApplication(this);
    this.locks = new LockManagerImpl();
    this.handoffs = new HandoffManagerImpl();
    this.reviews = new ReviewManagerImpl();

    // Persistence & Plugin（P0-7, P0-11）
    this.persistence = new MemoryPersistenceAdapter();
    this.plugins = new PluginManagerImpl();
    this.plugins.setApplication(this);
  }

  async start(): Promise<void> {
    this.state = 'starting';
    await this.events.dispatch('application.starting', { name: this.name });

    // 连接 Persistence
    if (!this.persistence.isConnected()) {
      await this.persistence.connect();
    }

    this.state = 'running';
    await this.events.dispatch('application.started', { name: this.name });
  }

  async stop(): Promise<void> {
    this.state = 'stopping';
    await this.events.dispatch('application.stopping', { name: this.name });

    // 停止 HTTP 服务器
    if (this.httpServer) {
      await this.httpServer.close();
      this.httpServer = undefined;
    }

    // 断开 Persistence
    if (this.persistence.isConnected()) {
      await this.persistence.disconnect();
    }

    this.state = 'stopped';
  }

  // P0-8: 启动 HTTP 服务器，将所有注册的 API 暴露为真实 HTTP 端点
  async startHttp(port: number = 3000, host: string = '0.0.0.0'): Promise<{ port: number; url: string }> {
    if (this.state !== 'running') {
      await this.start();
    }

    const { createServer } = await import('node:http');

    const server = createServer(async (req, res) => {
      const requestId = generateId('req');
      const method = (req.method ?? 'GET').toUpperCase() as HttpMethod;
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const path = url.pathname;

      // CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id');
      res.setHeader('X-Request-Id', requestId);

      if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // 健康检查
      if (path === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, status: this.state, name: this.name, version: this.version, requestId }));
        return;
      }

      // Application Graph 端点
      if (path === '/graph' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.graph.toJSON()));
        return;
      }

      // 匹配 API 端点
      const endpoint = this.apis.match(method, path);
      if (!endpoint) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: { code: 'not_found', message: `No endpoint for ${method} ${path}`, requestId }, requestId }));
        return;
      }

      try {
        // 读取 body
        let body: unknown = undefined;
        if (method !== 'GET' && method !== 'HEAD') {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const raw = Buffer.concat(chunks).toString('utf-8');
          if (raw) {
            try { body = JSON.parse(raw); } catch { body = raw; }
          }
        }

        // 解析 query
        const query: Record<string, string> = {};
        for (const [key, value] of url.searchParams) query[key] = value;

        const result = await endpoint.invoke({ method, path, headers: req.headers as Record<string, string>, query, body });

        res.writeHead(result.status, { 'Content-Type': result.headers['content-type'] ?? 'application/json' });
        if (typeof result.body === 'string') {
          res.end(result.body);
        } else {
          res.end(JSON.stringify(result.body));
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: { code: 'internal_error', message: error instanceof Error ? error.message : String(error), requestId }, requestId }));
      }
    });

    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        const actualPort = (server.address() as { port: number }).port;
        this.httpServer = { close: () => new Promise<void>((res) => server.close(() => res())) };
        resolve({ port: actualPort, url: `http://${host}:${actualPort}` });
      });
    });
  }
}

// ============================================================
// TllOS 入口实现
// ============================================================

const CONTRACTS: ContractInfo[] = [
  { name: 'Application Model', version: '2.0.0', description: '应用模型与生命周期', status: 'stable' },
  { name: 'Application Graph', version: '2.0.0', description: '应用结构图与影响分析', status: 'beta' },
  { name: 'Module Contract', version: '2.0.0', description: '模块契约', status: 'stable' },
  { name: 'Plugin Contract', version: '2.0.0', description: '插件契约', status: 'beta' },
  { name: 'Agent Contract', version: '2.0.0', description: 'AI Agent 契约', status: 'beta' },
  { name: 'Tool Contract', version: '2.0.0', description: 'Tool 契约（含输入校验与权限）', status: 'stable' },
  { name: 'Skill Contract', version: '2.0.0', description: 'Skill 契约', status: 'draft' },
  { name: 'Context Contract', version: '2.0.0', description: 'AI 上下文契约', status: 'draft' },
  { name: 'Permission Contract', version: '2.0.0', description: '权限契约', status: 'stable' },
  { name: 'Workflow Contract', version: '2.0.0', description: '工作流契约', status: 'draft' },
  { name: 'Event Contract', version: '2.0.0', description: '事件契约', status: 'stable' },
  { name: 'Adapter Contract', version: '2.0.0', description: '适配器契约', status: 'beta' },
  { name: 'Projection Contract', version: '2.0.0', description: '投影契约（Graph→代码）', status: 'draft' },
  { name: 'BuildTarget Contract', version: '2.0.0', description: '构建目标契约', status: 'draft' },
  { name: 'Capability Contract', version: '2.0.0', description: '能力注册契约', status: 'beta' },
  { name: 'Compatibility Manifest', version: '2.0.0', description: '兼容性声明契约', status: 'draft' },
  { name: 'Evolution Proposal', version: '2.0.0', description: '演进提案契约（TEP）', status: 'beta' },
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
// 统一 API 响应构造器（P0-9）
// ============================================================

class ApiResponseBuilderImpl implements ApiResponseBuilder {
  private requestId: string;

  constructor(requestId?: string) {
    this.requestId = requestId ?? generateId('req');
  }

  ok<T>(data: T, pagination?: PaginationInfo): StandardApiResponse<T> {
    return { ok: true, data, error: null, requestId: this.requestId, timestamp: now(), pagination };
  }

  created<T>(data: T): StandardApiResponse<T> {
    return { ok: true, data, error: null, requestId: this.requestId, timestamp: now() };
  }

  badRequest(message: string, details?: ApiErrorDetail[]): StandardApiResponse {
    return { ok: false, data: null, error: { code: 'bad_request', message, details, requestId: this.requestId }, requestId: this.requestId, timestamp: now() };
  }

  notFound(resource: string): StandardApiResponse {
    return { ok: false, data: null, error: { code: 'not_found', message: `${resource} not found`, requestId: this.requestId }, requestId: this.requestId, timestamp: now() };
  }

  unauthorized(message?: string): StandardApiResponse {
    return { ok: false, data: null, error: { code: 'unauthorized', message: message ?? 'Authentication required', requestId: this.requestId }, requestId: this.requestId, timestamp: now() };
  }

  forbidden(message?: string): StandardApiResponse {
    return { ok: false, data: null, error: { code: 'forbidden', message: message ?? 'Permission denied', requestId: this.requestId }, requestId: this.requestId, timestamp: now() };
  }

  conflict(message: string): StandardApiResponse {
    return { ok: false, data: null, error: { code: 'conflict', message, requestId: this.requestId }, requestId: this.requestId, timestamp: now() };
  }

  validationError(details: ApiErrorDetail[]): StandardApiResponse {
    return { ok: false, data: null, error: { code: 'validation_error', message: 'Validation failed', details, requestId: this.requestId }, requestId: this.requestId, timestamp: now() };
  }

  internalError(message?: string): StandardApiResponse {
    return { ok: false, data: null, error: { code: 'internal_error', message: message ?? 'Internal server error', requestId: this.requestId }, requestId: this.requestId, timestamp: now() };
  }
}

export function createApiResponseBuilder(requestId?: string): ApiResponseBuilder {
  return new ApiResponseBuilderImpl(requestId);
}

// ============================================================
// Tool 输入校验（P0-10）— 极简 JSON Schema 校验器
// ============================================================

function validateJsonSchema(value: unknown, schema: JsonObject): { valid: boolean; errors: ApiErrorDetail[] } {
  const errors: ApiErrorDetail[] = [];

  if (!schema || typeof schema !== 'object') return { valid: true, errors };

  // type 校验
  const expectedType = schema.type as string | undefined;
  if (expectedType) {
    const actualType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    const typeMap: Record<string, string> = { integer: 'number' };
    const normalizedExpected = typeMap[expectedType] ?? expectedType;
    if (actualType !== normalizedExpected) {
      errors.push({ message: `Expected type ${expectedType}, got ${actualType}` });
    }
  }

  // required 校验（仅对 object）
  if (schema.required && Array.isArray(schema.required) && value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const field of schema.required as string[]) {
      if (!(field in obj) || obj[field] === undefined) {
        errors.push({ field, message: `Field "${field}" is required` });
      }
    }
  }

  // properties 递归校验
  if (schema.properties && value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const props = schema.properties as Record<string, JsonObject>;
    for (const [key, propSchema] of Object.entries(props)) {
      if (key in obj && obj[key] !== undefined) {
        const result = validateJsonSchema(obj[key], propSchema);
        for (const err of result.errors) {
          errors.push({ field: err.field ? `${key}.${err.field}` : key, message: err.message });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// 导出
// ============================================================

export function createTllOS(runtime?: RuntimeAdapter): TllOS {
  return new TllOSImpl(runtime);
}

export { TllOSImpl, ApplicationImpl, ApplicationGraphImpl, ApiResponseBuilderImpl };
