/**
 * TLL Compiler
 *
 * 将 TLL AST 转换为 TLL-IR（Universal Application Model）。
 *
 * 流程：
 *   TLL Source → Lexer → Tokens → Parser → AST → Compiler → TLL-IR
 */

import { TLLFile, BlockNode, PropertyDeclaration, Expression, Identifier, StringLiteral, BlockMember } from '../language/ast/index.js';
import {
  TLLIR,
  IRApplication,
  IRModule,
  IREntity,
  IRField,
  IRFieldType,
  IRApi,
  IRParameter,
  IRAction,
  IREvent,
  IRWorkflow,
  IRWorkflowStep,
  IRAgent,
  IRTool,
  IRPermission,
  IRRole,
  IRView,
  IRTest,
  IRDeployment,
  IRIntegration,
  IRStorage,
  IRGraph,
  IRGraphNode,
  IRGraphEdge,
  IRGraphNodeType,
  IRGraphEdgeType,
  createEmptyIR,
  generateId,
  resetIdCounter,
  TLL_IR_VERSION,
} from '../ir/schema/index.js';

// ============================================================
// Compiler Error
// ============================================================

export class CompilerError extends Error {
  constructor(
    message: string,
    public readonly line?: number,
    public readonly column?: number,
  ) {
    super(`Compiler Error${line ? ` at line ${line}, column ${column}` : ''}: ${message}`);
    this.name = 'CompilerError';
  }
}

// ============================================================
// Compiler
// ============================================================

export class Compiler {
  private ir: TLLIR;
  private currentModuleId: string | null = null;
  private graphNodeMap: Map<string, IRGraphNode> = new Map();
  private graphEdgeMap: Map<string, IRGraphEdge> = new Map();

  constructor() {
    this.ir = createEmptyIR('unnamed');
  }

  /**
   * 编译主入口
   */
  compile(ast: TLLFile): TLLIR {
    resetIdCounter();
    this.ir = createEmptyIR('unnamed');
    this.currentModuleId = null;
    this.graphNodeMap = new Map();
    this.graphEdgeMap = new Map();

    // 添加 application 节点到 graph
    this.addGraphNode(this.ir.application.id, 'application', this.ir.application.name);

    // 处理导入
    if (ast.imports.length > 0) {
      this.ir.imports = ast.imports.map((imp) => imp.source.value);
    }

    // 处理顶层块
    for (const block of ast.blocks) {
      this.compileTopLevelBlock(block);
    }

    // 最终化 graph
    this.ir.graph.nodes = Array.from(this.graphNodeMap.values());
    this.ir.graph.edges = Array.from(this.graphEdgeMap.values());

    // 设置生成时间
    this.ir.generatedAt = new Date().toISOString();
    this.ir.irVersion = TLL_IR_VERSION;

    return this.ir;
  }

  // ========================================================
  // 顶层块编译
  // ========================================================

  private compileTopLevelBlock(block: BlockNode): void {
    switch (block.blockType) {
      case 'application':
        this.compileApplication(block);
        break;
      case 'module':
        this.compileModule(block);
        break;
      case 'entity':
        this.compileEntity(block);
        break;
      case 'api':
        this.compileApi(block);
        break;
      case 'action':
        this.compileAction(block);
        break;
      case 'event':
        this.compileEvent(block);
        break;
      case 'workflow':
        this.compileWorkflow(block);
        break;
      case 'agent':
        this.compileAgent(block);
        break;
      case 'tool':
        this.compileTool(block);
        break;
      case 'permission':
        this.compilePermission(block);
        break;
      case 'role':
        this.compileRole(block);
        break;
      case 'view':
        this.compileView(block);
        break;
      case 'test':
        this.compileTest(block);
        break;
      case 'deployment':
        this.compileDeployment(block);
        break;
      case 'integration':
        this.compileIntegration(block);
        break;
      case 'storage':
        this.compileStorage(block);
        break;
      default:
        // 未知块类型，尝试作为模块处理
        this.compileModule(block);
        break;
    }
  }

  // ========================================================
  // Application
  // ========================================================

  private compileApplication(block: BlockNode): void {
    const name = this.getBlockName(block) || 'Application';
    const appId = `app:${name.toLowerCase().replace(/\s+/g, '-')}`;

    const app: IRApplication = {
      id: appId,
      name,
      version: '0.1.0',
      source: { line: block.line, column: block.column },
    };

    // 解析 identity 块
    for (const member of block.body) {
      if (this.isBlock(member) && member.blockType === 'identity') {
        this.compileIdentity(member, app);
      }
    }

    this.ir.application = app;

    // 更新 graph 中的 application 节点
    const existingNode = this.graphNodeMap.get(appId);
    if (existingNode) {
      existingNode.name = name;
    } else {
      this.addGraphNode(appId, 'application', name);
    }

    // 处理 application 块内的其他内容（作为隐式模块）
    for (const member of block.body) {
      if (this.isBlock(member) && member.blockType !== 'identity') {
        // application 块内的 entity/api 等属于隐式根模块
        this.compileTopLevelBlock(member);
      }
    }
  }

  private compileIdentity(block: BlockNode, app: IRApplication): void {
    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        switch (member.name.name) {
          case 'name':
            app.name = value || app.name;
            break;
          case 'version':
            app.version = value || '0.1.0';
            break;
          case 'description':
            app.description = value;
            break;
          case 'author':
            app.author = value;
            break;
          case 'license':
            app.license = value;
            break;
        }
      }
    }
  }

  // ========================================================
  // Module
  // ========================================================

  private compileModule(block: BlockNode): void {
    const name = this.getBlockName(block) || this.capitalize(block.blockType);
    const moduleId = generateId('module', name);

    const module: IRModule = {
      id: moduleId,
      name,
      entities: [],
      apis: [],
      actions: [],
      events: [],
      workflows: [],
      agents: [],
      tools: [],
      permissions: [],
      roles: [],
      tests: [],
      views: [],
      source: { line: block.line, column: block.column },
    };

    this.ir.modules.push(module);
    this.addGraphNode(moduleId, 'module', name);
    this.addGraphEdge(this.ir.application.id, moduleId, 'contains');

    // 设置当前模块上下文
    const prevModule = this.currentModuleId;
    this.currentModuleId = moduleId;

    // 处理模块内容
    for (const member of block.body) {
      if (this.isBlock(member)) {
        this.compileModuleMember(member, module);
      }
    }

    this.currentModuleId = prevModule;
  }

  private compileModuleMember(block: BlockNode, module: IRModule): void {
    switch (block.blockType) {
      case 'entity': {
        const entity = this.compileEntity(block);
        if (entity) module.entities.push(entity.id);
        break;
      }
      case 'api': {
        const api = this.compileApi(block);
        if (api) module.apis.push(api.id);
        break;
      }
      case 'action': {
        const action = this.compileAction(block);
        if (action) module.actions.push(action.id);
        break;
      }
      case 'event': {
        const event = this.compileEvent(block);
        if (event) module.events.push(event.id);
        break;
      }
      case 'workflow': {
        const workflow = this.compileWorkflow(block);
        if (workflow) module.workflows.push(workflow.id);
        break;
      }
      case 'agent': {
        const agent = this.compileAgent(block);
        if (agent) module.agents.push(agent.id);
        break;
      }
      case 'tool': {
        const tool = this.compileTool(block);
        if (tool) module.tools.push(tool.id);
        break;
      }
      case 'permission': {
        const perm = this.compilePermission(block);
        if (perm) module.permissions.push(perm.id);
        break;
      }
      case 'role': {
        const role = this.compileRole(block);
        if (role) module.roles.push(role.id);
        break;
      }
      case 'test': {
        const test = this.compileTest(block);
        if (test) module.tests.push(test.id);
        break;
      }
      case 'view': {
        const view = this.compileView(block);
        if (view) module.views.push(view.id);
        break;
      }
      default:
        // 忽略未知块
        break;
    }
  }

  // ========================================================
  // Entity
  // ========================================================

  private compileEntity(block: BlockNode): IREntity | null {
    const name = this.getBlockName(block);
    if (!name) return null;

    const entityId = generateId('entity', name);
    const fields: IRField[] = [];

    for (const member of block.body) {
      if (this.isProperty(member)) {
        fields.push(this.compileField(member));
      }
    }

    const entity: IREntity = {
      id: entityId,
      name,
      fields,
      tableName: this.toSnakeCase(name),
      source: { line: block.line, column: block.column },
    };

    this.ir.entities.push(entity);
    this.addGraphNode(entityId, 'entity', name);

    // 关联到当前模块
    if (this.currentModuleId) {
      this.addGraphEdge(this.currentModuleId, entityId, 'contains');
    }

    return entity;
  }

  private compileField(prop: PropertyDeclaration): IRField {
    const field: IRField = {
      name: prop.name.name,
      type: this.compileFieldType(prop),
      optional: prop.optional,
      source: { line: prop.line, column: prop.column },
    };

    // 处理装饰器
    for (const decorator of prop.modifiers) {
      switch (decorator.name.name) {
        case 'unique':
          field.unique = true;
          break;
        case 'index':
          field.indexed = true;
          break;
        case 'default':
          if (decorator.arguments && decorator.arguments.length > 0) {
            field.defaultValue = this.expressionToValue(decorator.arguments[0]);
          }
          break;
      }
    }

    return field;
  }

  private compileFieldType(prop: PropertyDeclaration): IRFieldType {
    const typeName = prop.type.name.toLowerCase();

    if (prop.type.isEnum && prop.type.enumValues) {
      return { kind: 'enum', values: prop.type.enumValues };
    }

    if (prop.type.typeArguments && prop.type.typeArguments.length > 0) {
      if (typeName === 'relation') {
        return { kind: 'relation', entity: prop.type.typeArguments[0].name };
      }
      if (typeName === 'list') {
        return { kind: 'list', itemType: this.compileFieldType({
          ...prop,
          type: prop.type.typeArguments[0],
        }) };
      }
    }

    // 基础类型
    const baseTypes: string[] = [
      'uuid', 'text', 'integer', 'float', 'boolean', 'money',
      'datetime', 'date', 'email', 'url', 'json',
    ];

    if (baseTypes.includes(typeName)) {
      return typeName as IRFieldType;
    }

    // 未知类型，作为 text 处理
    return 'text';
  }

  // ========================================================
  // API
  // ========================================================

  private compileApi(block: BlockNode): IRApi | null {
    // API 块的 parameters 包含 [HTTP_METHOD, path]
    const method = block.parameters && block.parameters.length > 0
      ? this.expressionToString(block.parameters[0])
      : 'GET';
    const path = block.parameters && block.parameters.length > 1
      ? this.expressionToString(block.parameters[1])
      : '/';

    const name = this.getBlockName(block) || `${method} ${path}`;
    const apiId = generateId('api', name);

    const api: IRApi = {
      id: apiId,
      name,
      method: this.normalizeHttpMethod(method),
      path,
      source: { line: block.line, column: block.column },
    };

    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        switch (member.name.name) {
          case 'description':
            api.description = value;
            break;
          case 'permission':
            api.permission = value;
            break;
          case 'return':
            api.returnType = value;
            break;
        }
      } else if (this.isBlock(member)) {
        switch (member.blockType) {
          case 'params':
            api.params = this.compileParameterBlock(member);
            break;
          case 'query':
            api.query = this.compileParameterBlock(member);
            break;
          case 'body':
            api.body = this.compileParameterBlock(member);
            break;
        }
      }
    }

    this.ir.apis.push(api);
    this.addGraphNode(apiId, 'api', name);

    if (this.currentModuleId) {
      this.addGraphEdge(this.currentModuleId, apiId, 'contains');
    }

    return api;
  }

  private compileParameterBlock(block: BlockNode): IRParameter[] {
    const params: IRParameter[] = [];
    for (const member of block.body) {
      if (this.isProperty(member)) {
        params.push({
          name: member.name.name,
          type: member.type.name,
          optional: member.optional,
        });
      }
    }
    return params;
  }

  // ========================================================
  // Action
  // ========================================================

  private compileAction(block: BlockNode): IRAction | null {
    const name = this.getBlockName(block);
    if (!name) return null;

    const actionId = generateId('action', name);
    const action: IRAction = {
      id: actionId,
      name,
      source: { line: block.line, column: block.column },
    };

    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        switch (member.name.name) {
          case 'description':
            action.description = value;
            break;
          case 'permission':
            action.permission = value;
            break;
        }
      } else if (this.isBlock(member)) {
        switch (member.blockType) {
          case 'input':
            action.input = this.compileParameterBlock(member);
            break;
          case 'output':
            action.output = this.compileParameterBlock(member);
            break;
          case 'logic':
            action.logic = this.blockToSource(member);
            break;
        }
      }
    }

    this.ir.actions.push(action);
    this.addGraphNode(actionId, 'action', name);

    if (this.currentModuleId) {
      this.addGraphEdge(this.currentModuleId, actionId, 'contains');
    }

    return action;
  }

  // ========================================================
  // Event
  // ========================================================

  private compileEvent(block: BlockNode): IREvent | null {
    const name = this.getBlockName(block);
    if (!name) return null;

    const eventId = generateId('event', name);
    const event: IREvent = {
      id: eventId,
      name,
      source: { line: block.line, column: block.column },
    };

    for (const member of block.body) {
      if (this.isBlock(member) && member.blockType === 'payload') {
        event.payload = this.compileParameterBlock(member);
      } else if (this.isProperty(member) && member.name.name === 'description') {
        event.description = this.getPropertyStringValue(member);
      }
    }

    this.ir.events.push(event);
    this.addGraphNode(eventId, 'event', name);

    if (this.currentModuleId) {
      this.addGraphEdge(this.currentModuleId, eventId, 'contains');
    }

    return event;
  }

  // ========================================================
  // Workflow
  // ========================================================

  private compileWorkflow(block: BlockNode): IRWorkflow | null {
    const name = this.getBlockName(block);
    if (!name) return null;

    const workflowId = generateId('workflow', name);
    const steps: IRWorkflowStep[] = [];
    let triggerEvent = '';

    for (const member of block.body) {
      if (this.isBlock(member)) {
        if (member.blockType === 'step') {
          steps.push(this.compileWorkflowStep(member));
        }
      } else if (this.isProperty(member) && member.name.name === 'on') {
        // on 后面跟事件名
        // 这在 AST 中可能是属性声明，也可能是表达式
        triggerEvent = this.getPropertyStringValue(member) || '';
      }
    }

    // 处理 on EventName 语法（在 block body 中作为表达式）
    for (const member of block.body) {
      if (!this.isBlock(member) && !this.isProperty(member)) {
        // 可能是 on EventName 的表达式
        const exprStr = this.expressionToString(member as Expression);
        if (exprStr && !triggerEvent) {
          triggerEvent = exprStr;
        }
      }
    }

    const workflow: IRWorkflow = {
      id: workflowId,
      name,
      trigger: {
        type: 'event',
        event: triggerEvent,
      },
      steps,
      source: { line: block.line, column: block.column },
    };

    this.ir.workflows.push(workflow);
    this.addGraphNode(workflowId, 'workflow', name);

    if (this.currentModuleId) {
      this.addGraphEdge(this.currentModuleId, workflowId, 'contains');
    }

    return workflow;
  }

  private compileWorkflowStep(block: BlockNode): IRWorkflowStep {
    const name = this.getBlockName(block) || 'step';
    const stepId = generateId('step', name);
    const step: IRWorkflowStep = {
      id: stepId,
      name,
      action: '',
    };

    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        switch (member.name.name) {
          case 'action':
            step.action = value || '';
            break;
          case 'dependsOn':
            step.dependsOn = value ? value.split(',').map((s) => s.trim()) : [];
            break;
          case 'onError':
            step.onError = this.normalizeOnError(value || 'fail');
            break;
        }
      } else if (this.isBlock(member) && member.blockType === 'input') {
        step.input = this.blockToRecord(member);
      }
    }

    this.addGraphNode(stepId, 'step', name);
    return step;
  }

  // ========================================================
  // Agent
  // ========================================================

  private compileAgent(block: BlockNode): IRAgent | null {
    const name = this.getBlockName(block);
    if (!name) return null;

    const agentId = generateId('agent', name);
    const agent: IRAgent = {
      id: agentId,
      name,
      tools: [],
      permissions: [],
      source: { line: block.line, column: block.column },
    };

    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        switch (member.name.name) {
          case 'description':
            agent.description = value;
            break;
          case 'goal':
            agent.goal = value;
            break;
          case 'model':
            agent.model = value;
            break;
          case 'tools':
            agent.tools = value ? value.split(',').map((s) => s.trim()) : [];
            break;
          case 'permissions':
            agent.permissions = value ? value.split(',').map((s) => s.trim()) : [];
            break;
        }
      } else if (this.isBlock(member)) {
        switch (member.blockType) {
          case 'tools':
            agent.tools = this.compileIdListBlock(member);
            break;
          case 'permissions':
            agent.permissions = this.compileIdListBlock(member);
            break;
          case 'policy':
            agent.policy = this.blockToRecord(member);
            break;
          case 'memory':
            agent.memory = this.compileMemoryBlock(member);
            break;
        }
      }
    }

    this.ir.agents.push(agent);
    this.addGraphNode(agentId, 'agent', name);

    if (this.currentModuleId) {
      this.addGraphEdge(this.currentModuleId, agentId, 'contains');
    }

    return agent;
  }

  private compileIdListBlock(block: BlockNode): string[] {
    const ids: string[] = [];
    for (const member of block.body) {
      if (this.isProperty(member)) {
        ids.push(member.name.name);
      } else if (!this.isBlock(member)) {
        const str = this.expressionToString(member as Expression);
        if (str) ids.push(str);
      }
    }
    return ids;
  }

  private compileMemoryBlock(block: BlockNode): { longTerm?: string[]; shortTerm?: string[] } {
    const memory: { longTerm?: string[]; shortTerm?: string[] } = {};
    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        if (member.name.name === 'longTerm' || member.name.name === 'long_term') {
          memory.longTerm = value ? [value] : [];
        } else if (member.name.name === 'shortTerm' || member.name.name === 'short_term') {
          memory.shortTerm = value ? [value] : [];
        }
      }
    }
    return memory;
  }

  // ========================================================
  // Tool
  // ========================================================

  private compileTool(block: BlockNode): IRTool | null {
    const name = this.getBlockName(block);
    if (!name) return null;

    const toolId = generateId('tool', name);
    const tool: IRTool = {
      id: toolId,
      name,
      source: { line: block.line, column: block.column },
    };

    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        switch (member.name.name) {
          case 'description':
            tool.description = value;
            break;
          case 'permission':
            tool.permission = value;
            break;
          case 'execute':
            tool.execute = value;
            break;
        }
      } else if (this.isBlock(member)) {
        switch (member.blockType) {
          case 'input':
            tool.input = this.compileParameterBlock(member);
            break;
          case 'output':
            tool.output = this.compileParameterBlock(member);
            break;
        }
      }
    }

    this.ir.tools.push(tool);
    this.addGraphNode(toolId, 'tool', name);

    if (this.currentModuleId) {
      this.addGraphEdge(this.currentModuleId, toolId, 'contains');
    }

    return tool;
  }

  // ========================================================
  // Permission
  // ========================================================

  private compilePermission(block: BlockNode): IRPermission | null {
    const name = this.getBlockName(block);
    if (!name) return null;

    const permId = generateId('permission', name);
    const perm: IRPermission = {
      id: permId,
      name,
      source: { line: block.line, column: block.column },
    };

    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        switch (member.name.name) {
          case 'description':
            perm.description = value;
            break;
          case 'resource':
            perm.resource = value;
            break;
          case 'action':
            perm.action = value;
            break;
        }
      }
    }

    this.ir.permissions.push(perm);
    this.addGraphNode(permId, 'permission', name);

    if (this.currentModuleId) {
      this.addGraphEdge(this.currentModuleId, permId, 'contains');
    }

    return perm;
  }

  // ========================================================
  // Role
  // ========================================================

  private compileRole(block: BlockNode): IRRole | null {
    const name = this.getBlockName(block);
    if (!name) return null;

    const roleId = generateId('role', name);
    const role: IRRole = {
      id: roleId,
      name,
      allow: [],
      deny: [],
      source: { line: block.line, column: block.column },
    };

    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        if (member.name.name === 'allow') {
          role.allow = value ? value.split(',').map((s) => s.trim()) : [];
        } else if (member.name.name === 'deny') {
          role.deny = value ? value.split(',').map((s) => s.trim()) : [];
        }
      } else if (this.isBlock(member)) {
        if (member.blockType === 'allow') {
          role.allow = this.compileIdListBlock(member);
        } else if (member.blockType === 'deny') {
          role.deny = this.compileIdListBlock(member);
        }
      }
    }

    this.ir.roles.push(role);
    this.addGraphNode(roleId, 'role', name);
    return role;
  }

  // ========================================================
  // View
  // ========================================================

  private compileView(block: BlockNode): IRView | null {
    const name = this.getBlockName(block);
    if (!name) return null;

    const viewId = generateId('view', name);
    const view: IRView = {
      id: viewId,
      name,
      source: { line: block.line, column: block.column },
    };

    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        switch (member.name.name) {
          case 'description':
            view.description = value;
            break;
          case 'layout':
            view.layout = value;
            break;
          case 'source':
            view.sourceEntity = value;
            break;
          case 'columns':
            view.columns = value ? value.split(',').map((s) => s.trim()) : [];
            break;
          case 'actions':
            view.actions = value ? value.split(',').map((s) => s.trim()) : [];
            break;
          case 'filters':
            view.filters = value ? value.split(',').map((s) => s.trim()) : [];
            break;
        }
      } else if (this.isBlock(member)) {
        switch (member.blockType) {
          case 'columns':
            view.columns = this.compileIdListBlock(member);
            break;
          case 'actions':
            view.actions = this.compileIdListBlock(member);
            break;
          case 'filters':
            view.filters = this.compileIdListBlock(member);
            break;
          case 'cards':
            view.cards = this.compileIdListBlock(member);
            break;
        }
      }
    }

    this.ir.views.push(view);
    this.addGraphNode(viewId, 'view', name);

    if (this.currentModuleId) {
      this.addGraphEdge(this.currentModuleId, viewId, 'contains');
    }

    return view;
  }

  // ========================================================
  // Test
  // ========================================================

  private compileTest(block: BlockNode): IRTest | null {
    const name = this.getBlockName(block) || 'test';
    const testId = generateId('test', name);
    const test: IRTest = {
      id: testId,
      name,
      assertions: [],
      source: { line: block.line, column: block.column },
    };

    for (const member of block.body) {
      if (this.isBlock(member)) {
        switch (member.blockType) {
          case 'setup':
            test.setup = this.blockToSource(member);
            break;
          case 'action':
            test.action = this.blockToSource(member);
            break;
          case 'assert':
            test.assertions?.push(this.blockToSource(member));
            break;
        }
      } else if (this.isProperty(member) && member.name.name === 'description') {
        test.description = this.getPropertyStringValue(member);
      }
    }

    this.ir.tests.push(test);
    this.addGraphNode(testId, 'test', name);
    return test;
  }

  // ========================================================
  // Deployment
  // ========================================================

  private compileDeployment(block: BlockNode): IRDeployment | null {
    const name = this.getBlockName(block) || 'production';
    const deployId = generateId('deployment', name);
    const deploy: IRDeployment = {
      id: deployId,
      name,
      type: '',
      adapter: '',
      source: { line: block.line, column: block.column },
    } as IRDeployment;

    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        switch (member.name.name) {
          case 'target':
            deploy.target = value;
            break;
          case 'runtime':
            deploy.runtime = value;
            break;
          case 'ssl':
            deploy.ssl = this.normalizeSsl(value || 'auto');
            break;
        }
      } else if (this.isBlock(member)) {
        switch (member.blockType) {
          case 'database':
            deploy.database = this.compileDatabaseBlock(member);
            break;
          case 'domains':
            deploy.domains = this.compileStringList(member);
            break;
          case 'scaling':
            deploy.scaling = this.compileScalingBlock(member);
            break;
          case 'env':
            deploy.env = this.blockToRecord(member);
            break;
        }
      }
    }

    this.ir.deployments.push(deploy);
    this.addGraphNode(deployId, 'deployment', name);
    return deploy;
  }

  private compileDatabaseBlock(block: BlockNode): { type: string; version?: string } {
    const db: { type: string; version?: string } = { type: 'postgresql' };
    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        if (member.name.name === 'type') db.type = value || 'postgresql';
        else if (member.name.name === 'version') db.version = value;
      }
    }
    return db;
  }

  private compileScalingBlock(block: BlockNode): { min?: number; max?: number; cpuThreshold?: number } {
    const scaling: { min?: number; max?: number; cpuThreshold?: number } = {};
    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        if (member.name.name === 'min') scaling.min = parseInt(value || '0', 10);
        else if (member.name.name === 'max') scaling.max = parseInt(value || '0', 10);
      }
    }
    return scaling;
  }

  // ========================================================
  // Integration
  // ========================================================

  private compileIntegration(block: BlockNode): IRIntegration | null {
    const name = this.getBlockName(block);
    if (!name) return null;

    const integId = generateId('integration', name);
    const integ: IRIntegration = {
      id: integId,
      name,
      type: '',
      adapter: '',
      source: { line: block.line, column: block.column },
    };

    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        switch (member.name.name) {
          case 'type':
            integ.type = value || '';
            break;
          case 'adapter':
            integ.adapter = value || '';
            break;
          case 'description':
            integ.description = value;
            break;
        }
      } else if (this.isBlock(member)) {
        if (member.blockType === 'config') {
          integ.config = this.blockToRecord(member);
        } else if (member.blockType === 'capabilities') {
          integ.capabilities = this.compileIdListBlock(member);
        }
      }
    }

    this.ir.integrations.push(integ);
    this.addGraphNode(integId, 'integration', name);
    return integ;
  }

  // ========================================================
  // Storage
  // ========================================================

  private compileStorage(block: BlockNode): IRStorage | null {
    const name = this.getBlockName(block) || 'default';
    const storageId = generateId('storage', name);
    const storage: IRStorage = {
      id: storageId,
      name,
      type: '',
      source: { line: block.line, column: block.column },
    };

    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        switch (member.name.name) {
          case 'type':
            storage.type = value || '';
            break;
          case 'connection':
            storage.connection = value;
            break;
          case 'description':
            storage.description = value;
            break;
        }
      } else if (this.isBlock(member) && member.blockType === 'pool') {
        storage.pool = this.compilePoolBlock(member);
      }
    }

    this.ir.storages.push(storage);
    this.addGraphNode(storageId, 'storage', name);
    return storage;
  }

  private compilePoolBlock(block: BlockNode): { min?: number; max?: number } {
    const pool: { min?: number; max?: number } = {};
    for (const member of block.body) {
      if (this.isProperty(member)) {
        const value = this.getPropertyStringValue(member);
        if (member.name.name === 'min') pool.min = parseInt(value || '0', 10);
        else if (member.name.name === 'max') pool.max = parseInt(value || '0', 10);
      }
    }
    return pool;
  }

  // ========================================================
  // Graph 辅助方法
  // ========================================================

  private addGraphNode(id: string, type: IRGraphNodeType, name: string): void {
    if (!this.graphNodeMap.has(id)) {
      this.graphNodeMap.set(id, { id, type, name });
    }
  }

  private addGraphEdge(source: string, target: string, type: IRGraphEdgeType): void {
    const edgeId = `edge:${source}:${type}:${target}`;
    if (!this.graphEdgeMap.has(edgeId)) {
      this.graphEdgeMap.set(edgeId, { id: edgeId, source, target, type });
    }
  }

  // ========================================================
  // AST 辅助方法
  // ========================================================

  private isBlock(member: BlockMember): member is BlockNode {
    return member.kind === 'Block';
  }

  private isProperty(member: BlockMember): member is PropertyDeclaration {
    return member.kind === 'PropertyDeclaration';
  }

  private getBlockName(block: BlockNode): string | null {
    if (!block.name) return null;
    if (block.name.kind === 'Identifier') return block.name.name;
    if (block.name.kind === 'StringLiteral') return block.name.value;
    return null;
  }

  private getPropertyStringValue(prop: PropertyDeclaration): string | null {
    // 属性值在 type 字段中（TLL 语法 name: value）
    // 但 value 可能是字符串、数字、标识符等
    // 我们需要从 AST 中提取
    // 实际上，TLL 的属性声明是 name: type，值在 type 中
    // 对于简单的字符串值，type.name 就是值
    // 但这不够准确，需要更好的处理

    // 简化：返回 type.name 作为字符串值
    return prop.type.name || null;
  }

  private expressionToString(expr: Expression): string {
    switch (expr.kind) {
      case 'StringLiteral':
        return expr.value;
      case 'Identifier':
        return expr.name;
      case 'NumberLiteral':
        return String(expr.value);
      case 'BooleanLiteral':
        return String(expr.value);
      case 'MoneyLiteral':
        return `${expr.amount} ${expr.currency}`;
      case 'MemberExpression':
        return `${this.expressionToString(expr.object)}.${expr.property.name}`;
      case 'CallExpression':
        return `${this.expressionToString(expr.callee)}()`;
      default:
        return '';
    }
  }

  private expressionToValue(expr: Expression): unknown {
    switch (expr.kind) {
      case 'StringLiteral':
        return expr.value;
      case 'NumberLiteral':
        return expr.value;
      case 'BooleanLiteral':
        return expr.value;
      case 'NullLiteral':
        return null;
      case 'MoneyLiteral':
        return { amount: expr.amount, currency: expr.currency };
      case 'ArrayExpression':
        return expr.elements.map((e) => this.expressionToValue(e));
      case 'ObjectExpression':
        const obj: Record<string, unknown> = {};
        for (const prop of expr.properties) {
          const key = prop.key.kind === 'Identifier' ? prop.key.name : prop.key.value;
          obj[key] = this.expressionToValue(prop.value);
        }
        return obj;
      default:
        return this.expressionToString(expr);
    }
  }

  private blockToSource(block: BlockNode): string {
    // 将块内容转换为源码字符串（简化版）
    const lines: string[] = [];
    for (const member of block.body) {
      if (this.isProperty(member)) {
        lines.push(`${member.name.name}: ${member.type.name}`);
      } else if (this.isBlock(member)) {
        lines.push(`${member.blockType} { ... }`);
      } else {
        lines.push(this.expressionToString(member as Expression));
      }
    }
    return lines.join('\n');
  }

  private blockToRecord(block: BlockNode): Record<string, string> {
    const record: Record<string, string> = {};
    for (const member of block.body) {
      if (this.isProperty(member)) {
        record[member.name.name] = this.getPropertyStringValue(member) || '';
      }
    }
    return record;
  }

  private compileStringList(block: BlockNode): string[] {
    const list: string[] = [];
    for (const member of block.body) {
      if (this.isProperty(member)) {
        list.push(member.name.name);
      } else if (!this.isBlock(member)) {
        const str = this.expressionToString(member as Expression);
        if (str) list.push(str);
      }
    }
    return list;
  }

  // ========================================================
  // 工具方法
  // ========================================================

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private toSnakeCase(s: string): string {
    return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  private normalizeHttpMethod(method: string): IRApi['method'] {
    const upper = method.toUpperCase();
    const valid: IRApi['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    return (valid.includes(upper as IRApi['method']) ? upper : 'GET') as IRApi['method'];
  }

  private normalizeOnError(value: string): IRWorkflowStep['onError'] {
    const valid: IRWorkflowStep['onError'][] = ['retry', 'skip', 'fail', 'compensate'];
    return (valid.includes(value as IRWorkflowStep['onError']) ? value : 'fail') as IRWorkflowStep['onError'];
  }

  private normalizeSsl(value: string): IRDeployment['ssl'] {
    const valid: IRDeployment['ssl'][] = ['auto', 'manual', 'none'];
    return (valid.includes(value as IRDeployment['ssl']) ? value : 'auto') as IRDeployment['ssl'];
  }
}

// ============================================================
// 便捷函数
// ============================================================

/**
 * 编译 TLL 源代码为 TLL-IR
 */
export function compile(source: string): TLLIR {
  const { Lexer } = require('../language/lexer/index.js');
  const { Parser } = require('../language/parser/index.js');
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const compiler = new Compiler();
  return compiler.compile(ast);
}

/**
 * 编译 AST 为 TLL-IR
 */
export function compileAST(ast: TLLFile): TLLIR {
  const compiler = new Compiler();
  return compiler.compile(ast);
}

/**
 * 将 TLL-IR 序列化为 JSON 字符串
 */
export function serializeIR(ir: TLLIR): string {
  return JSON.stringify(ir, null, 2);
}

/**
 * 从 JSON 字符串反序列化 TLL-IR
 */
export function deserializeIR(json: string): TLLIR {
  return JSON.parse(json) as TLLIR;
}
