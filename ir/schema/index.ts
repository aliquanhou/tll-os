/**
 * TLL-IR Schema v0.1
 *
 * Universal Application Model —— 通用应用中间表示。
 *
 * TLL 源代码 → Compiler → TLL-IR → Runtime
 *
 * TLL-IR 是可序列化的 JSON，包含应用的完整结构描述。
 * 它是 Application Graph 的机器可读形式，也是 Runtime 的执行输入。
 */

// ============================================================
// IR 版本
// ============================================================

export const TLL_IR_VERSION = '0.1.0';

// ============================================================
// 基础类型
// ============================================================

export interface IRBase {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface IRSourceLocation {
  file?: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

// ============================================================
// Application
// ============================================================

export interface IRApplication extends IRBase {
  version: string;
  author?: string;
  license?: string;
  source?: IRSourceLocation;
}

// ============================================================
// Module
// ============================================================

export interface IRModule extends IRBase {
  entities: string[];      // entity IDs
  apis: string[];          // api IDs
  actions: string[];       // action IDs
  events: string[];        // event IDs
  workflows: string[];     // workflow IDs
  agents: string[];        // agent IDs
  tools: string[];         // tool IDs
  permissions: string[];   // permission IDs
  roles: string[];         // role IDs
  tests: string[];         // test IDs
  views: string[];         // view IDs
  source?: IRSourceLocation;
}

// ============================================================
// Entity (Data Model)
// ============================================================

export interface IREntity extends IRBase {
  fields: IRField[];
  tableName?: string;
  source?: IRSourceLocation;
}

export interface IRField {
  name: string;
  type: IRFieldType;
  optional: boolean;
  unique?: boolean;
  indexed?: boolean;
  defaultValue?: unknown;
  description?: string;
  source?: IRSourceLocation;
}

export type IRFieldType =
  | 'uuid'
  | 'text'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'money'
  | 'datetime'
  | 'date'
  | 'email'
  | 'url'
  | 'json'
  | { kind: 'enum'; values: string[] }
  | { kind: 'relation'; entity: string }
  | { kind: 'list'; itemType: IRFieldType };

export interface IRMoney {
  amount: number;
  currency: string;
}

// ============================================================
// API
// ============================================================

export interface IRApi extends IRBase {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  path: string;
  params?: IRParameter[];
  query?: IRParameter[];
  body?: IRParameter[];
  returnType?: string;
  permission?: string;
  source?: IRSourceLocation;
}

export interface IRParameter {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
  defaultValue?: unknown;
}

// ============================================================
// Action
// ============================================================

export interface IRAction extends IRBase {
  input?: IRParameter[];
  output?: IRParameter[];
  permission?: string;
  logic?: string;           // 嵌入式表达式语言的源码
  source?: IRSourceLocation;
}

// ============================================================
// Event
// ============================================================

export interface IREvent extends IRBase {
  payload?: IRParameter[];
  source?: IRSourceLocation;
}

// ============================================================
// Workflow
// ============================================================

export interface IRWorkflow extends IRBase {
  trigger: {
    type: 'event';
    event: string;           // event ID
  };
  steps: IRWorkflowStep[];
  source?: IRSourceLocation;
}

export interface IRWorkflowStep {
  id: string;
  name: string;
  action: string;           // action ID
  input?: Record<string, unknown>;
  dependsOn?: string[];     // step IDs
  onError?: 'retry' | 'skip' | 'fail' | 'compensate';
  retryCount?: number;
  condition?: string;
}

// ============================================================
// Agent
// ============================================================

export interface IRAgent extends IRBase {
  goal?: string;
  model?: string;
  tools: string[];          // tool IDs
  permissions: string[];    // permission IDs
  memory?: IRAgentMemory;
  policy?: Record<string, unknown>;
  source?: IRSourceLocation;
}

export interface IRAgentMemory {
  longTerm?: string[];
  shortTerm?: string[];
}

// ============================================================
// Tool
// ============================================================

export interface IRTool extends IRBase {
  input?: IRParameter[];
  output?: IRParameter[];
  permission?: string;
  execute?: string;         // 执行逻辑的源码
  source?: IRSourceLocation;
}

// ============================================================
// Permission & Role
// ============================================================

export interface IRPermission extends IRBase {
  resource?: string;
  action?: string;
  source?: IRSourceLocation;
}

export interface IRRole extends IRBase {
  allow: string[];          // permission IDs or '*'
  deny: string[];           // permission IDs
  source?: IRSourceLocation;
}

// ============================================================
// View (UI)
// ============================================================

export interface IRView extends IRBase {
  layout?: string;
  sourceEntity?: string;    // entity ID
  columns?: string[];
  actions?: string[];
  filters?: string[];
  cards?: string[];
  table?: string;
  source?: IRSourceLocation;
}

// ============================================================
// Test
// ============================================================

export interface IRTest extends IRBase {
  setup?: string;           // setup 逻辑源码
  action?: string;          // action 逻辑源码
  assertions?: string[];    // 断言表达式
  source?: IRSourceLocation;
}

// ============================================================
// Deployment
// ============================================================

export interface IRDeployment extends IRBase {
  target?: string;
  runtime?: string;
  database?: {
    type: string;
    version?: string;
  };
  domains?: string[];
  ssl?: 'auto' | 'manual' | 'none';
  scaling?: {
    min?: number;
    max?: number;
    cpuThreshold?: number;
  };
  env?: Record<string, string>;
  source?: IRSourceLocation;
}

// ============================================================
// Integration
// ============================================================

export interface IRIntegration extends IRBase {
  type: string;
  adapter: string;
  config?: Record<string, string>;
  capabilities?: string[];
  source?: IRSourceLocation;
}

// ============================================================
// Storage
// ============================================================

export interface IRStorage extends IRBase {
  type: string;
  connection?: string;
  pool?: {
    min?: number;
    max?: number;
  };
  source?: IRSourceLocation;
}

// ============================================================
// Application Graph
// ============================================================

export interface IRGraphNode {
  id: string;
  type: IRGraphNodeType;
  name: string;
  properties?: Record<string, unknown>;
}

export type IRGraphNodeType =
  | 'application'
  | 'module'
  | 'entity'
  | 'field'
  | 'api'
  | 'action'
  | 'event'
  | 'workflow'
  | 'step'
  | 'agent'
  | 'tool'
  | 'permission'
  | 'role'
  | 'view'
  | 'test'
  | 'deployment'
  | 'integration'
  | 'storage';

export interface IRGraphEdge {
  id: string;
  source: string;           // node ID
  target: string;           // node ID
  type: IRGraphEdgeType;
  properties?: Record<string, unknown>;
}

export type IRGraphEdgeType =
  | 'contains'              // module contains entity
  | 'belongs_to'            // api belongs_to module
  | 'depends_on'            // module depends_on another module
  | 'calls'                 // action calls tool
  | 'uses'                  // agent uses tool
  | 'triggers'              // event triggers workflow
  | 'invokes'               // api invokes action
  | 'tests'                 // test tests entity/api
  | 'modifies'              // action modifies entity
  | 'reads'                 // api reads entity
  | 'has_permission'        // role has_permission
  | 'related_to';           // entity related_to another entity

export interface IRGraph {
  nodes: IRGraphNode[];
  edges: IRGraphEdge[];
}

// ============================================================
// Dependencies
// ============================================================

export interface IRDependency {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'adapter' | 'plugin';
  source?: string;
}

// ============================================================
// TLL-IR 根对象
// ============================================================

export interface TLLIR {
  irVersion: string;
  generatedAt: string;
  compilerVersion?: string;

  application: IRApplication;

  modules: IRModule[];
  entities: IREntity[];
  apis: IRApi[];
  actions: IRAction[];
  events: IREvent[];
  workflows: IRWorkflow[];
  agents: IRAgent[];
  tools: IRTool[];
  permissions: IRPermission[];
  roles: IRRole[];
  views: IRView[];
  tests: IRTest[];
  deployments: IRDeployment[];
  integrations: IRIntegration[];
  storages: IRStorage[];

  graph: IRGraph;
  dependencies: IRDependency[];

  imports?: string[];       // 导入的其他 TLL 文件
}

// ============================================================
// 便捷构造函数
// ============================================================

export function createEmptyIR(appName: string, appVersion: string = '0.1.0'): TLLIR {
  const appId = `app:${appName.toLowerCase().replace(/\s+/g, '-')}`;
  return {
    irVersion: TLL_IR_VERSION,
    generatedAt: new Date().toISOString(),
    application: {
      id: appId,
      name: appName,
      version: appVersion,
    },
    modules: [],
    entities: [],
    apis: [],
    actions: [],
    events: [],
    workflows: [],
    agents: [],
    tools: [],
    permissions: [],
    roles: [],
    views: [],
    tests: [],
    deployments: [],
    integrations: [],
    storages: [],
    graph: {
      nodes: [
        {
          id: appId,
          type: 'application',
          name: appName,
        },
      ],
      edges: [],
    },
    dependencies: [],
  };
}

// ============================================================
// ID 生成器
// ============================================================

let idCounter = 0;

export function generateId(prefix: string, name: string): string {
  idCounter++;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${prefix}:${slug}:${idCounter.toString(36)}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}
