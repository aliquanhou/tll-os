/**
 * TLL OS - Projection System (Runtime 0.3)
 *
 * Graph ↔ 代码/OpenAPI/DB Schema 双向投影。
 * 这是 Agent 自动开发的核心能力：Agent 通过 Graph 理解应用，
 * Projection 将 Graph 转化为可执行代码，也可以从代码反向构建 Graph。
 */

import type {
  ApplicationGraph, GraphNode, GraphEdge, GraphNodeType,
  ApiDefinition, ToolDefinition, Module,
} from '../public/types.js';

// ============================================================
// Types
// ============================================================

export interface ProjectionFile {
  path: string;
  content: string;
  language: 'typescript' | 'javascript' | 'json' | 'sql' | 'yaml' | 'markdown';
  nodeId?: string;
  description?: string;
}

export interface ProjectionResult {
  files: ProjectionFile[];
  warnings: string[];
  errors: string[];
  stats: {
    totalNodes: number;
    projectedNodes: number;
    totalFiles: number;
  };
}

export interface OpenAPISchema {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
}

export interface OpenAPIOperation {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Array<{ name: string; in: string; required?: boolean; schema: Record<string, unknown> }>;
  requestBody?: { content: Record<string, { schema: Record<string, unknown> }> };
  responses: Record<string, { description: string; content?: Record<string, { schema: Record<string, unknown> }> }>;
}

export interface DBSchema {
  tables: DBTable[];
}

export interface DBTable {
  name: string;
  columns: DBColumn[];
  primaryKey?: string[];
  indexes?: Array<{ name: string; columns: string[]; unique?: boolean }>;
}

export interface DBColumn {
  name: string;
  type: 'string' | 'integer' | 'real' | 'boolean' | 'json' | 'datetime';
  nullable?: boolean;
  default?: unknown;
  primaryKey?: boolean;
  unique?: boolean;
  references?: { table: string; column: string };
}

// ============================================================
// Projection Engine
// ============================================================

export class ProjectionEngine {
  private graph: ApplicationGraph;

  constructor(graph: ApplicationGraph) {
    this.graph = graph;
  }

  /**
   * Project entire Graph to code files.
   * Generates module files, API files, tool files, config files.
   */
  projectToCode(): ProjectionResult {
    const files: ProjectionFile[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    const allNodes = this.graph.listNodes();
    const modules = this.graph.findModules();

    // Project each module
    for (const moduleNode of modules) {
      try {
        const moduleFiles = this.projectModule(moduleNode);
        files.push(...moduleFiles);
      } catch (e) {
        errors.push(`Failed to project module ${moduleNode.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Project application-level config
    const appNodes = allNodes.filter(n => n.type === 'application');
    if (appNodes.length > 0) {
      files.push(this.projectAppConfig(appNodes[0]));
    }

    return {
      files,
      warnings,
      errors,
      stats: {
        totalNodes: allNodes.length,
        projectedNodes: modules.length + (appNodes.length > 0 ? 1 : 0),
        totalFiles: files.length,
      },
    };
  }

  /**
   * Project a single module node to code files.
   */
  private projectModule(moduleNode: GraphNode): ProjectionFile[] {
    const files: ProjectionFile[] = [];
    const moduleName = moduleNode.name;
    const moduleId = moduleNode.id;

    // Find APIs belonging to this module
    const apiEdges = this.graph.getEdges().filter(
      e => e.type === 'belongs_to' && e.target === moduleId
    );
    const apiNodes = apiEdges
      .map(e => this.graph.getNode(e.source))
      .filter((n): n is GraphNode => n !== null && n.type === 'api');

    // Find tools belonging to this module
    const toolNodes = apiEdges
      .map(e => this.graph.getNode(e.source))
      .filter((n): n is GraphNode => n !== null && n.type === 'tool');

    // Find models (data entities)
    const modelNodes = apiEdges
      .map(e => this.graph.getNode(e.source))
      .filter((n): n is GraphNode => n !== null && n.type === 'model');

    // Generate module index file
    files.push({
      path: `src/modules/${moduleName}/index.ts`,
      content: this.generateModuleIndex(moduleNode, apiNodes, toolNodes, modelNodes),
      language: 'typescript',
      nodeId: moduleId,
      description: `Module entry point for ${moduleName}`,
    });

    // Generate API file if there are APIs
    if (apiNodes.length > 0) {
      files.push({
        path: `src/modules/${moduleName}/api.ts`,
        content: this.generateApiFile(moduleName, apiNodes),
        language: 'typescript',
        description: `API handlers for ${moduleName}`,
      });
    }

    // Generate tool file if there are tools
    if (toolNodes.length > 0) {
      files.push({
        path: `src/modules/${moduleName}/tools.ts`,
        content: this.generateToolFile(moduleName, toolNodes),
        language: 'typescript',
        description: `Tool definitions for ${moduleName}`,
      });
    }

    // Generate model/schema file if there are models
    if (modelNodes.length > 0) {
      files.push({
        path: `src/modules/${moduleName}/models.ts`,
        content: this.generateModelFile(moduleName, modelNodes),
        language: 'typescript',
        description: `Data models for ${moduleName}`,
      });
    }

    return files;
  }

  /**
   * Generate module index file content.
   */
  private generateModuleIndex(
    moduleNode: GraphNode,
    apiNodes: GraphNode[],
    toolNodes: GraphNode[],
    modelNodes: GraphNode[],
  ): string {
    const lines: string[] = [];
    lines.push('/**');
    lines.push(` * TLL OS Module: ${moduleNode.name}`);
    if (moduleNode.description) lines.push(` * ${moduleNode.description}`);
    lines.push(` * Auto-generated by TLL OS Projection Engine.`);
    lines.push(' */');
    lines.push('');
    lines.push(`import type { Module, ModuleConfig } from '@tll/os';`);
    lines.push('');

    if (apiNodes.length > 0) {
      lines.push(`import { registerApis } from './api.js';`);
    }
    if (toolNodes.length > 0) {
      lines.push(`import { registerTools } from './tools.js';`);
    }
    lines.push('');

    lines.push(`export const ${this.toCamelCase(moduleNode.name)}ModuleConfig: ModuleConfig = {`);
    lines.push(`  name: '${moduleNode.name}',`);
    if (moduleNode.description) lines.push(`  description: '${moduleNode.description}',`);
    lines.push(`  version: '${moduleNode.version ?? '0.1.0'}',`);
    if (moduleNode.capabilities && moduleNode.capabilities.length > 0) {
      lines.push(`  capabilities: ${JSON.stringify(moduleNode.capabilities)},`);
    }
    lines.push('};');
    lines.push('');

    lines.push(`export function register${this.toPascalCase(moduleNode.name)}Module(app: any): void {`);
    lines.push(`  const module = app.modules.create(${this.toCamelCase(moduleNode.name)}ModuleConfig);`);
    lines.push('');
    if (apiNodes.length > 0) {
      lines.push(`  registerApis(module);`);
    }
    if (toolNodes.length > 0) {
      lines.push(`  registerTools(module);`);
    }
    lines.push('}');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate API handler file content.
   */
  private generateApiFile(moduleName: string, apiNodes: GraphNode[]): string {
    const lines: string[] = [];
    lines.push('/**');
    lines.push(` * API handlers for ${moduleName} module.`);
    lines.push(' * Auto-generated by TLL OS Projection Engine.');
    lines.push(' */');
    lines.push('');
    lines.push(`import type { Module, ApiDefinition } from '@tll/os';`);
    lines.push('');

    for (const api of apiNodes) {
      const method = (api.metadata?.method as string) ?? 'GET';
      const path = (api.metadata?.path as string) ?? `/${api.name}`;
      lines.push(`/** ${method} ${path} — ${api.description ?? api.name} */`);
      lines.push(`async function ${this.toCamelCase(api.name)}Handler(req: any, res: any): Promise<void> {`);
      lines.push(`  // TODO: Implement ${api.name} API handler`);
      lines.push(`  res.json({ ok: true, data: { message: '${api.name} not implemented yet' } });`);
      lines.push(`}`);
      lines.push('');
    }

    lines.push(`export function registerApis(module: Module): void {`);
    for (const api of apiNodes) {
      const method = (api.metadata?.method as string) ?? 'GET';
      const path = (api.metadata?.path as string) ?? `/${api.name}`;
      lines.push(`  module.apis.create({`);
      lines.push(`    name: '${api.name}',`);
      lines.push(`    method: '${method.toLowerCase()}',`);
      lines.push(`    path: '${path}',`);
      if (api.description) lines.push(`    description: '${api.description}',`);
      lines.push(`    handler: ${this.toCamelCase(api.name)}Handler,`);
      lines.push(`  });`);
    }
    lines.push(`}`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate tool definitions file content.
   */
  private generateToolFile(moduleName: string, toolNodes: GraphNode[]): string {
    const lines: string[] = [];
    lines.push('/**');
    lines.push(` * Tool definitions for ${moduleName} module.`);
    lines.push(' * Auto-generated by TLL OS Projection Engine.');
    lines.push(' */');
    lines.push('');
    lines.push(`import type { Module, ToolDefinition, ToolResult, ToolContext } from '@tll/os';`);
    lines.push('');

    for (const tool of toolNodes) {
      lines.push(`/** Tool: ${tool.name} — ${tool.description ?? ''} */`);
      lines.push(`async function ${this.toCamelCase(tool.name)}(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {`);
      lines.push(`  // TODO: Implement ${tool.name} tool`);
      lines.push(`  return { success: true, data: { message: '${tool.name} not implemented yet' } };`);
      lines.push(`}`);
      lines.push('');
    }

    lines.push(`export function registerTools(module: Module): void {`);
    for (const tool of toolNodes) {
      lines.push(`  module.tools.create({`);
      lines.push(`    name: '${tool.name}',`);
      if (tool.description) lines.push(`    description: '${tool.description}',`);
      lines.push(`    parameters: ${JSON.stringify(tool.metadata?.parameters ?? { type: 'object', properties: {} })},`);
      if (tool.permissions && tool.permissions.length > 0) {
        lines.push(`    permissions: ${JSON.stringify(tool.permissions)},`);
      }
      lines.push(`    handler: ${this.toCamelCase(tool.name)},`);
      lines.push(`  });`);
    }
    lines.push(`}`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate data model file content.
   */
  private generateModelFile(moduleName: string, modelNodes: GraphNode[]): string {
    const lines: string[] = [];
    lines.push('/**');
    lines.push(` * Data models for ${moduleName} module.`);
    lines.push(' * Auto-generated by TLL OS Projection Engine.');
    lines.push(' */');
    lines.push('');

    for (const model of modelNodes) {
      const fields = (model.metadata?.fields as Record<string, { type: string; required?: boolean }>) ?? {};
      lines.push(`export interface ${this.toPascalCase(model.name)} {`);
      for (const [fieldName, fieldDef] of Object.entries(fields)) {
        const tsType = this.toTsType(fieldDef.type);
        const optional = fieldDef.required ? '' : '?';
        lines.push(`  ${fieldName}${optional}: ${tsType};`);
      }
      if (Object.keys(fields).length === 0) {
        lines.push(`  // TODO: Define fields for ${model.name}`);
        lines.push(`  id: string;`);
      }
      lines.push(`}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Project application config file.
   */
  private projectAppConfig(appNode: GraphNode): ProjectionFile {
    const config = {
      name: appNode.name,
      version: appNode.version ?? '0.1.0',
      environment: 'development',
      ...(appNode.description ? { description: appNode.description } : {}),
      ...(appNode.capabilities ? { capabilities: appNode.capabilities } : {}),
    };

    return {
      path: 'tll.config.json',
      content: JSON.stringify(config, null, 2),
      language: 'json',
      nodeId: appNode.id,
      description: 'Application configuration',
    };
  }

  // ============================================================
  // OpenAPI Projection
  // ============================================================

  /**
   * Project Graph to OpenAPI 3.0 Schema.
   */
  projectToOpenAPI(): OpenAPISchema {
    const appNodes = this.graph.listNodes('application');
    const appName = appNodes.length > 0 ? appNodes[0].name : 'TLL OS Application';
    const appVersion = appNodes.length > 0 ? (appNodes[0].version ?? '0.1.0') : '0.1.0';

    const apiNodes = this.graph.listNodes('api');
    const paths: Record<string, Record<string, OpenAPIOperation>> = {};

    for (const api of apiNodes) {
      const method = ((api.metadata?.method as string) ?? 'GET').toLowerCase();
      const path = (api.metadata?.path as string) ?? `/${api.name}`;

      if (!paths[path]) paths[path] = {};

      const operation: OpenAPIOperation = {
        summary: api.name,
        ...(api.description ? { description: api.description } : {}),
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { ok: { type: 'boolean' }, data: { type: 'object' } } },
              },
            },
          },
        },
      };

      // Extract path parameters
      const paramMatches = path.match(/:(\w+)/g);
      if (paramMatches) {
        operation.parameters = paramMatches.map(p => ({
          name: p.slice(1),
          in: 'path',
          required: true,
          schema: { type: 'string' },
        }));
      }

      // Find module tag
      const belongsEdges = this.graph.getEdges().filter(
        e => e.type === 'belongs_to' && e.source === api.id
      );
      if (belongsEdges.length > 0) {
        const moduleNode = this.graph.getNode(belongsEdges[0].target);
        if (moduleNode) {
          operation.tags = [moduleNode.name];
        }
      }

      paths[path][method] = operation;
    }

    return {
      openapi: '3.0.0',
      info: {
        title: appName,
        version: appVersion,
        description: 'Auto-generated by TLL OS Projection Engine',
      },
      paths,
      components: {
        schemas: {},
        securitySchemes: {
          apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
        },
      },
    };
  }

  // ============================================================
  // DB Schema Projection
  // ============================================================

  /**
   * Project Graph model nodes to DB Schema (SQL DDL).
   */
  projectToDBSchema(): DBSchema {
    const modelNodes = this.graph.listNodes('model');
    const tables: DBTable[] = [];

    for (const model of modelNodes) {
      const fields = (model.metadata?.fields as Record<string, { type: string; required?: boolean; primaryKey?: boolean; unique?: boolean; references?: { table: string; column: string } }>) ?? {};
      const columns: DBColumn[] = [];

      // Always add id column
      columns.push({ name: 'id', type: 'string', primaryKey: true, nullable: false });

      for (const [fieldName, fieldDef] of Object.entries(fields)) {
        if (fieldName === 'id') continue;
        columns.push({
          name: fieldName,
          type: (fieldDef.type as DBColumn['type']) ?? 'string',
          nullable: !fieldDef.required,
          primaryKey: fieldDef.primaryKey,
          unique: fieldDef.unique,
          references: fieldDef.references,
        });
      }

      // Add timestamps
      columns.push({ name: 'created_at', type: 'datetime', nullable: false });
      columns.push({ name: 'updated_at', type: 'datetime', nullable: false });

      tables.push({
        name: this.toSnakeCase(model.name),
        columns,
        primaryKey: ['id'],
      });
    }

    return { tables };
  }

  /**
   * Generate SQL CREATE TABLE statements from DB Schema.
   */
  generateSQL(schema: DBSchema): string {
    const statements: string[] = [];

    for (const table of schema.tables) {
      const lines: string[] = [];
      lines.push(`CREATE TABLE IF NOT EXISTS ${table.name} (`);

      const colDefs = table.columns.map(col => {
        let def = `  ${col.name} ${this.toSQLType(col.type)}`;
        if (col.primaryKey) def += ' PRIMARY KEY';
        if (!col.nullable && !col.primaryKey) def += ' NOT NULL';
        if (col.unique) def += ' UNIQUE';
        if (col.references) def += ` REFERENCES ${col.references.table}(${col.references.column})`;
        return def;
      });

      lines.push(colDefs.join(',\n'));
      lines.push(');');
      statements.push(lines.join('\n'));
    }

    return statements.join('\n\n');
  }

  // ============================================================
  // Reverse Projection: Code → Graph
  // ============================================================

  /**
   * Parse a module code file and extract Graph nodes.
   * This is a simplified parser that extracts module config, APIs, and tools.
   */
  parseModuleCode(code: string, filePath: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const now = Date.now();

    // Extract module name from config
    const nameMatch = code.match(/name:\s*['"]([^'"]+)['"]/);
    const moduleName = nameMatch ? nameMatch[1] : this.basenameToModuleName(filePath);

    const moduleNode: GraphNode = {
      id: `module_${moduleName}`,
      type: 'module',
      name: moduleName,
      description: this.extractDescription(code),
      version: this.extractVersion(code) ?? '0.1.0',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      metadata: { sourceFile: filePath },
    };
    nodes.push(moduleNode);

    // Extract API definitions
    const apiMatches = code.matchAll(/apis\.create\(\s*\{([^}]+)\}/gs);
    for (const match of apiMatches) {
      const block = match[1];
      const apiName = this.extractField(block, 'name');
      const apiMethod = this.extractField(block, 'method') ?? 'GET';
      const apiPath = this.extractField(block, 'path') ?? `/${apiName}`;

      if (apiName) {
        const apiNode: GraphNode = {
          id: `api_${apiName}`,
          type: 'api',
          name: apiName,
          description: this.extractField(block, 'description'),
          status: 'active',
          createdAt: now,
          updatedAt: now,
          metadata: { method: apiMethod.toUpperCase(), path: apiPath, sourceFile: filePath },
        };
        nodes.push(apiNode);
        edges.push({
          id: `edge_api_${apiName}_belongs`,
          type: 'belongs_to',
          source: apiNode.id,
          target: moduleNode.id,
          createdAt: now,
        });
      }
    }

    // Extract tool definitions
    const toolMatches = code.matchAll(/tools\.create\(\s*\{([^}]+)\}/gs);
    for (const match of toolMatches) {
      const block = match[1];
      const toolName = this.extractField(block, 'name');

      if (toolName) {
        const toolNode: GraphNode = {
          id: `tool_${toolName}`,
          type: 'tool',
          name: toolName,
          description: this.extractField(block, 'description'),
          status: 'active',
          createdAt: now,
          updatedAt: now,
          metadata: { sourceFile: filePath },
        };
        nodes.push(toolNode);
        edges.push({
          id: `edge_tool_${toolName}_belongs`,
          type: 'belongs_to',
          source: toolNode.id,
          target: moduleNode.id,
          createdAt: now,
        });
      }
    }

    return { nodes, edges };
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  private toCamelCase(str: string): string {
    return str.replace(/[-_](\w)/g, (_, c) => c.toUpperCase()).replace(/^(\w)/, (_, c) => c.toLowerCase());
  }

  private toPascalCase(str: string): string {
    return str.replace(/[-_](\w)/g, (_, c) => c.toUpperCase()).replace(/^(\w)/, (_, c) => c.toUpperCase());
  }

  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  private toTsType(type: string): string {
    const map: Record<string, string> = {
      string: 'string',
      integer: 'number',
      number: 'number',
      real: 'number',
      boolean: 'boolean',
      json: 'Record<string, unknown>',
      object: 'Record<string, unknown>',
      array: 'unknown[]',
      datetime: 'string',
      date: 'string',
    };
    return map[type] ?? 'unknown';
  }

  private toSQLType(type: string): string {
    const map: Record<string, string> = {
      string: 'TEXT',
      integer: 'INTEGER',
      number: 'REAL',
      real: 'REAL',
      boolean: 'INTEGER',
      json: 'TEXT',
      datetime: 'TEXT',
      date: 'TEXT',
    };
    return map[type] ?? 'TEXT';
  }

  private basenameToModuleName(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/');
    const fileName = parts[parts.length - 1].replace(/\.(ts|js)$/, '');
    return fileName === 'index' ? (parts[parts.length - 2] ?? 'unknown') : fileName;
  }

  private extractDescription(code: string): string | undefined {
    const match = code.match(/\/\*\*\s*\n\s*\*\s*(.+?)\s*\n/);
    return match ? match[1] : undefined;
  }

  private extractVersion(code: string): string | undefined {
    const match = code.match(/version:\s*['"]([^'"]+)['"]/);
    return match ? match[1] : undefined;
  }

  private extractField(block: string, field: string): string | undefined {
    const match = block.match(new RegExp(`${field}:\\s*['"]([^'"]+)['"]`));
    return match ? match[1] : undefined;
  }
}
