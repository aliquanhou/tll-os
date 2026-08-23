/**
 * TLL Language Toolchain Tests
 *
 * 测试 Lexer → Parser → Compiler 完整流程。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

import { Lexer, TokenType } from '../language/lexer/index.js';
import { Parser } from '../language/parser/index.js';
import { Compiler } from '../compiler/index.js';
import { TLL_IR_VERSION } from '../ir/schema/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ============================================================
// Lexer Tests
// ============================================================

describe('TLL Lexer', () => {
  it('should tokenize simple application block', () => {
    const source = `application Blog {
  identity {
    name: "Test App"
    version: "1.0.0"
  }
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0].type).toBe(TokenType.APPLICATION);
    expect(tokens[0].value).toBe('application');
    expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
  });

  it('should tokenize keywords correctly', () => {
    const source = 'entity User { id: uuid name: text }';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    const types = tokens.map((t) => t.type);
    expect(types).toContain(TokenType.ENTITY);
    expect(types).toContain(TokenType.IDENTIFIER);
    expect(types).toContain(TokenType.COLON);
    expect(types).toContain(TokenType.LBRACE);
    expect(types).toContain(TokenType.RBRACE);
  });

  it('should tokenize string literals', () => {
    const source = 'name: "Hello World"';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    const stringToken = tokens.find((t) => t.type === TokenType.STRING);
    expect(stringToken).toBeDefined();
    expect(stringToken?.value).toBe('Hello World');
  });

  it('should tokenize numbers', () => {
    const source = 'count: 42 price: 99.99';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    const numbers = tokens.filter((t) => t.type === TokenType.NUMBER);
    expect(numbers.length).toBe(2);
    expect(numbers[0].value).toBe('42');
    expect(numbers[1].value).toBe('99.99');
  });

  it('should tokenize money literals', () => {
    const source = 'price: 99.99 USD';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    const moneyToken = tokens.find((t) => t.type === TokenType.MONEY);
    expect(moneyToken).toBeDefined();
    expect(moneyToken?.value).toBe('99.99 USD');
  });

  it('should tokenize operators', () => {
    const source = 'a == b && c != d || e > f';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    const types = tokens.map((t) => t.type);
    expect(types).toContain(TokenType.EQ);
    expect(types).toContain(TokenType.AND);
    expect(types).toContain(TokenType.NEQ);
    expect(types).toContain(TokenType.OR);
    expect(types).toContain(TokenType.GT);
  });

  it('should skip comments', () => {
    const source = `// This is a comment
application Test {
  /* multi-line
     comment */
  name: "test"
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    // 不应该有注释 token
    const hasComment = tokens.some((t) => t.value.includes('comment') && t.type !== TokenType.STRING);
    expect(hasComment).toBe(false);
  });

  it('should track line and column numbers', () => {
    const source = `application Test {
  name: "test"
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    expect(tokens[0].line).toBe(1);
    expect(tokens[0].column).toBe(1);
  });

  it('should throw on unterminated string', () => {
    const source = 'name: "unterminated';
    const lexer = new Lexer(source);
    expect(() => lexer.tokenize()).toThrow();
  });
});

// ============================================================
// Parser Tests
// ============================================================

describe('TLL Parser', () => {
  it('should parse simple application block', () => {
    const source = `application Blog {
  identity {
    name: "Test App"
    version: "1.0.0"
  }
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.kind).toBe('TLLFile');
    expect(ast.blocks.length).toBe(1);
    expect(ast.blocks[0].blockType).toBe('application');
  });

  it('should parse entity with fields', () => {
    const source = `entity User {
  id: uuid
  name: text
  email: email
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.blocks.length).toBe(1);
    const entityBlock = ast.blocks[0];
    expect(entityBlock.blockType).toBe('entity');
    expect(entityBlock.body.length).toBe(3);
  });

  it('should parse API endpoint', () => {
    const source = `api GET "/users" {
  description: "List users"
  return User.list()
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.blocks.length).toBe(1);
    const apiBlock = ast.blocks[0];
    expect(apiBlock.blockType).toBe('api');
    expect(apiBlock.parameters?.length).toBe(2);
  });

  it('should parse module with nested blocks', () => {
    const source = `module User {
  entity User {
    id: uuid
    name: text
  }

  api GET "/users" {
    return User.list()
  }
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.blocks.length).toBe(1);
    const moduleBlock = ast.blocks[0];
    expect(moduleBlock.blockType).toBe('module');
    expect(moduleBlock.body.length).toBe(2);
  });

  it('should parse role with allow/deny', () => {
    const source = `role Admin {
  allow: *
  deny: user.delete
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.blocks.length).toBe(1);
    expect(ast.blocks[0].blockType).toBe('role');
  });
});

// ============================================================
// Compiler Tests
// ============================================================

describe('TLL Compiler', () => {
  it('should compile simple application to TLL-IR', () => {
    const source = `application Blog {
  identity {
    name: "Test Blog"
    version: "1.0.0"
  }
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const ir = compiler.compile(ast);

    expect(ir.irVersion).toBe(TLL_IR_VERSION);
    expect(ir.application.name).toBe('Test Blog');
    expect(ir.application.version).toBe('1.0.0');
  });

  it('should compile entity with fields', () => {
    const source = `entity User {
  id: uuid
  name: text
  email: email
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const ir = compiler.compile(ast);

    expect(ir.entities.length).toBe(1);
    expect(ir.entities[0].name).toBe('User');
    expect(ir.entities[0].fields.length).toBe(3);
    expect(ir.entities[0].fields[0].name).toBe('id');
  });

  it('should compile API endpoints', () => {
    const source = `api GET "/users" {
  description: "List users"
  permission: user.read
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const ir = compiler.compile(ast);

    expect(ir.apis.length).toBe(1);
    expect(ir.apis[0].method).toBe('GET');
    expect(ir.apis[0].path).toBe('/users');
  });

  it('should compile module with nested entities and APIs', () => {
    const source = `module User {
  entity User {
    id: uuid
    name: text
  }

  api GET "/users" {
    return User.list()
  }
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const ir = compiler.compile(ast);

    expect(ir.modules.length).toBe(1);
    expect(ir.modules[0].name).toBe('User');
    expect(ir.entities.length).toBe(1);
    expect(ir.apis.length).toBe(1);
    expect(ir.modules[0].entities.length).toBe(1);
    expect(ir.modules[0].apis.length).toBe(1);
  });

  it('should build application graph', () => {
    const source = `module User {
  entity User {
    id: uuid
    name: text
  }
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const ir = compiler.compile(ast);

    expect(ir.graph.nodes.length).toBeGreaterThanOrEqual(2);
    expect(ir.graph.edges.length).toBeGreaterThanOrEqual(1);

    const moduleNode = ir.graph.nodes.find((n) => n.type === 'module');
    expect(moduleNode).toBeDefined();

    const entityNode = ir.graph.nodes.find((n) => n.type === 'entity');
    expect(entityNode).toBeDefined();

    const containsEdge = ir.graph.edges.find((e) => e.type === 'contains');
    expect(containsEdge).toBeDefined();
  });

  it('should compile permissions and roles', () => {
    const source = `permission user.read {
  description: "Read users"
}

role Admin {
  allow: *
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const ir = compiler.compile(ast);

    expect(ir.permissions.length).toBe(1);
    expect(ir.roles.length).toBe(1);
    expect(ir.roles[0].name).toBe('Admin');
  });

  it('should compile agent and tools', () => {
    const source = `agent ContentEditor {
  goal: "Edit content"
  tools: searchPost
  permissions: post.read
}

tool searchPost {
  input {
    keyword: text
  }
  output {
    posts: list
  }
  permission: post.read
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const ir = compiler.compile(ast);

    expect(ir.agents.length).toBe(1);
    expect(ir.agents[0].name).toBe('ContentEditor');
    expect(ir.tools.length).toBe(1);
    expect(ir.tools[0].name).toBe('searchPost');
  });
});

// ============================================================
// Integration Test: Full blog.tll compilation
// ============================================================

describe('TLL Full Pipeline', () => {
  it('should compile the complete blog.tll example', () => {
    const blogPath = join(__dirname, '..', 'examples', 'blog.tll');
    const source = readFileSync(blogPath, 'utf-8');

    // Lexer
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    expect(tokens.length).toBeGreaterThan(100);

    // Parser
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast.blocks.length).toBeGreaterThanOrEqual(1);

    // Compiler
    const compiler = new Compiler();
    const ir = compiler.compile(ast);

    // Verify IR structure
    expect(ir.irVersion).toBe(TLL_IR_VERSION);
    expect(ir.application.name).toBe('TLL Blog');
    expect(ir.application.version).toBe('1.0.0');

    // Verify modules
    expect(ir.modules.length).toBeGreaterThanOrEqual(4);
    const moduleNames = ir.modules.map((m) => m.name);
    expect(moduleNames).toContain('User');
    expect(moduleNames).toContain('Content');
    expect(moduleNames).toContain('Security');

    // Verify entities
    expect(ir.entities.length).toBeGreaterThanOrEqual(3);
    const entityNames = ir.entities.map((e) => e.name);
    expect(entityNames).toContain('User');
    expect(entityNames).toContain('Post');
    expect(entityNames).toContain('Category');
    expect(entityNames).toContain('Comment');

    // Verify APIs
    expect(ir.apis.length).toBeGreaterThanOrEqual(5);

    // Verify permissions and roles
    expect(ir.permissions.length).toBeGreaterThanOrEqual(3);
    expect(ir.roles.length).toBeGreaterThanOrEqual(2);

    // Verify agents and tools
    expect(ir.agents.length).toBeGreaterThanOrEqual(1);
    expect(ir.tools.length).toBeGreaterThanOrEqual(1);

    // Verify views
    expect(ir.views.length).toBeGreaterThanOrEqual(1);

    // Verify tests
    expect(ir.tests.length).toBeGreaterThanOrEqual(1);

    // Verify deployments
    expect(ir.deployments.length).toBeGreaterThanOrEqual(1);

    // Verify graph
    expect(ir.graph.nodes.length).toBeGreaterThan(10);
    expect(ir.graph.edges.length).toBeGreaterThan(5);

    // Verify IR is serializable
    const json = JSON.stringify(ir, null, 2);
    expect(json.length).toBeGreaterThan(1000);
    const parsed = JSON.parse(json);
    expect(parsed.application.name).toBe('TLL Blog');
  });

  it('should produce valid JSON output', () => {
    const source = `application Test {
  identity {
    name: "Test"
    version: "0.1.0"
  }

  entity Item {
    id: uuid
    name: text
  }
}`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const ir = compiler.compile(ast);

    const json = JSON.stringify(ir, null, 2);
    expect(() => JSON.parse(json)).not.toThrow();

    const parsed = JSON.parse(json);
    expect(parsed.irVersion).toBeDefined();
    expect(parsed.application).toBeDefined();
    expect(parsed.graph).toBeDefined();
    expect(parsed.graph.nodes).toBeDefined();
    expect(parsed.graph.edges).toBeDefined();
  });
});
