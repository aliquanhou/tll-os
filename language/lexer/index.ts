/**
 * TLL Language Lexer
 *
 * 将 TLL 源代码转换为 token 流。
 * 每个 token 包含类型、值、行号、列号。
 */

// ============================================================
// Token Types
// ============================================================

export enum TokenType {
  // Literals
  IDENTIFIER = 'IDENTIFIER',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  MONEY = 'MONEY',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',

  // Keywords - Application
  APPLICATION = 'APPLICATION',
  IDENTITY = 'IDENTITY',
  MODULE = 'MODULE',

  // Keywords - Data
  ENTITY = 'ENTITY',
  FIELD = 'FIELD',
  ENUM = 'ENUM',
  RELATION = 'RELATION',
  LIST = 'LIST',

  // Keywords - API
  API = 'API',
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  PARAMS = 'PARAMS',
  QUERY = 'QUERY',
  BODY = 'BODY',
  RETURN = 'RETURN',

  // Keywords - Logic
  ACTION = 'ACTION',
  INPUT = 'INPUT',
  OUTPUT = 'OUTPUT',
  LOGIC = 'LOGIC',
  EXECUTE = 'EXECUTE',

  // Keywords - Event & Workflow
  EVENT = 'EVENT',
  PAYLOAD = 'PAYLOAD',
  WORKFLOW = 'WORKFLOW',
  ON = 'ON',
  STEP = 'STEP',
  DEPENDS_ON = 'DEPENDS_ON',
  ON_ERROR = 'ON_ERROR',

  // Keywords - Agent & Tool
  AGENT = 'AGENT',
  TOOL = 'TOOL',
  GOAL = 'GOAL',
  MODEL = 'MODEL',
  TOOLS = 'TOOLS',
  MEMORY = 'MEMORY',
  POLICY = 'POLICY',

  // Keywords - Permission & Security
  PERMISSION = 'PERMISSION',
  ROLE = 'ROLE',
  ALLOW = 'ALLOW',
  DENY = 'DENY',

  // Keywords - UI
  VIEW = 'VIEW',
  COMPONENT = 'COMPONENT',
  LAYOUT = 'LAYOUT',
  SOURCE = 'SOURCE',
  COLUMNS = 'COLUMNS',
  ACTIONS = 'ACTIONS',
  FILTERS = 'FILTERS',
  CARDS = 'CARDS',
  TABLE = 'TABLE',

  // Keywords - Test
  TEST = 'TEST',
  SETUP = 'SETUP',
  ASSERT = 'ASSERT',
  CREATE = 'CREATE',

  // Keywords - Deployment & Integration
  DEPLOYMENT = 'DEPLOYMENT',
  TARGET = 'TARGET',
  DATABASE = 'DATABASE',
  DOMAINS = 'DOMAINS',
  SSL = 'SSL',
  INTEGRATION = 'INTEGRATION',
  TYPE = 'TYPE',
  ADAPTER = 'ADAPTER',
  CONFIG = 'CONFIG',
  CAPABILITIES = 'CAPABILITIES',
  STORAGE = 'STORAGE',
  CONNECTION = 'CONNECTION',
  POOL = 'POOL',
  ENV = 'ENV',
  SCALING = 'SCALING',

  // Keywords - Control Flow (embedded expression)
  IF = 'IF',
  ELSE = 'ELSE',
  WHEN = 'WHEN',
  MATCH = 'MATCH',
  DEFAULT = 'DEFAULT',
  CONST = 'CONST',
  LET = 'LET',
  FOR = 'FOR',
  IN = 'IN',
  WHILE = 'WHILE',

  // Keywords - Import
  IMPORT = 'IMPORT',
  AS = 'AS',
  FROM = 'FROM',

  // Keywords - Misc
  DESCRIPTION = 'DESCRIPTION',
  NAME = 'NAME',
  VERSION = 'VERSION',
  AUTHOR = 'AUTHOR',
  LICENSE = 'LICENSE',

  // Operators
  PLUS = 'PLUS',           // +
  MINUS = 'MINUS',         // -
  STAR = 'STAR',           // *
  SLASH = 'SLASH',         // /
  PERCENT = 'PERCENT',     // %
  EQ = 'EQ',               // ==
  NEQ = 'NEQ',             // !=
  LT = 'LT',               // <
  GT = 'GT',               // >
  LTE = 'LTE',             // <=
  GTE = 'GTE',             // >=
  AND = 'AND',             // &&
  OR = 'OR',               // ||
  NOT = 'NOT',             // !
  COLON = 'COLON',         // :
  ASSIGN = 'ASSIGN',       // =
  DOT = 'DOT',             // .
  QUESTION = 'QUESTION',   // ?
  AT = 'AT',               // @
  COMMA = 'COMMA',         // ,
  ARROW = 'ARROW',         // ->

  // Delimiters
  LPAREN = 'LPAREN',       // (
  RPAREN = 'RPAREN',       // )
  LBRACKET = 'LBRACKET',   // [
  RBRACKET = 'RBRACKET',   // ]
  LBRACE = 'LBRACE',       // {
  RBRACE = 'RBRACE',       // }

  // Special
  EOF = 'EOF',
  NEWLINE = 'NEWLINE',
}

// ============================================================
// Token Interface
// ============================================================

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  raw?: string;
}

// ============================================================
// Keyword Map
// ============================================================

const KEYWORDS: Record<string, TokenType> = {
  // Application
  application: TokenType.APPLICATION,
  identity: TokenType.IDENTITY,
  module: TokenType.MODULE,

  // Data
  entity: TokenType.ENTITY,
  field: TokenType.FIELD,
  enum: TokenType.ENUM,
  relation: TokenType.RELATION,
  list: TokenType.LIST,

  // API
  api: TokenType.API,
  GET: TokenType.GET,
  POST: TokenType.POST,
  PUT: TokenType.PUT,
  PATCH: TokenType.PATCH,
  DELETE: TokenType.DELETE,
  HEAD: TokenType.HEAD,
  OPTIONS: TokenType.OPTIONS,
  params: TokenType.PARAMS,
  query: TokenType.QUERY,
  body: TokenType.BODY,
  return: TokenType.RETURN,

  // Logic
  action: TokenType.ACTION,
  input: TokenType.INPUT,
  output: TokenType.OUTPUT,
  logic: TokenType.LOGIC,
  execute: TokenType.EXECUTE,

  // Event & Workflow
  event: TokenType.EVENT,
  payload: TokenType.PAYLOAD,
  workflow: TokenType.WORKFLOW,
  on: TokenType.ON,
  step: TokenType.STEP,
  dependsOn: TokenType.DEPENDS_ON,
  onError: TokenType.ON_ERROR,

  // Agent & Tool
  agent: TokenType.AGENT,
  tool: TokenType.TOOL,
  goal: TokenType.GOAL,
  model: TokenType.MODEL,
  tools: TokenType.TOOLS,
  memory: TokenType.MEMORY,
  policy: TokenType.POLICY,

  // Permission
  permission: TokenType.PERMISSION,
  role: TokenType.ROLE,
  allow: TokenType.ALLOW,
  deny: TokenType.DENY,

  // UI
  view: TokenType.VIEW,
  component: TokenType.COMPONENT,
  layout: TokenType.LAYOUT,
  source: TokenType.SOURCE,
  columns: TokenType.COLUMNS,
  actions: TokenType.ACTIONS,
  filters: TokenType.FILTERS,
  cards: TokenType.CARDS,
  table: TokenType.TABLE,

  // Test
  test: TokenType.TEST,
  setup: TokenType.SETUP,
  assert: TokenType.ASSERT,
  create: TokenType.CREATE,

  // Deployment & Integration
  deployment: TokenType.DEPLOYMENT,
  target: TokenType.TARGET,
  database: TokenType.DATABASE,
  domains: TokenType.DOMAINS,
  ssl: TokenType.SSL,
  integration: TokenType.INTEGRATION,
  type: TokenType.TYPE,
  adapter: TokenType.ADAPTER,
  config: TokenType.CONFIG,
  capabilities: TokenType.CAPABILITIES,
  storage: TokenType.STORAGE,
  connection: TokenType.CONNECTION,
  pool: TokenType.POOL,
  env: TokenType.ENV,
  scaling: TokenType.SCALING,

  // Control Flow
  if: TokenType.IF,
  else: TokenType.ELSE,
  when: TokenType.WHEN,
  match: TokenType.MATCH,
  default: TokenType.DEFAULT,
  const: TokenType.CONST,
  let: TokenType.LET,
  for: TokenType.FOR,
  in: TokenType.IN,
  while: TokenType.WHILE,

  // Import
  import: TokenType.IMPORT,
  as: TokenType.AS,
  from: TokenType.FROM,

  // Misc
  description: TokenType.DESCRIPTION,
  name: TokenType.NAME,
  version: TokenType.VERSION,
  author: TokenType.AUTHOR,
  license: TokenType.LICENSE,

  // Literals
  true: TokenType.BOOLEAN,
  false: TokenType.BOOLEAN,
  null: TokenType.NULL,
};

// 货币代码
const CURRENCY_CODES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'AUD', 'CAD',
  'CHF', 'SGD', 'SEK', 'KRW', 'NZD', 'INR', 'MXN', 'TWD',
  'ZAR', 'RUB', 'BRL', 'TRY', 'AED', 'SAR', 'THB', 'MYR',
  'IDR', 'PHP', 'VND', 'PLN', 'NOK', 'DKK', 'CZK', 'HUF',
  'ILS', 'CLP', 'COP', 'PEN', 'ARS', 'EGP', 'NGN', 'KES',
]);

// ============================================================
// Lexer Error
// ============================================================

export class LexerError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
  ) {
    super(`Lexer Error at line ${line}, column ${column}: ${message}`);
    this.name = 'LexerError';
  }
}

// ============================================================
// Lexer
// ============================================================

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  /**
   * 词法分析主入口
   */
  tokenize(): Token[] {
    this.tokens = [];
    this.pos = 0;
    this.line = 1;
    this.column = 1;

    while (this.pos < this.source.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.source.length) break;

      const token = this.readToken();
      if (token) {
        this.tokens.push(token);
      }
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      line: this.line,
      column: this.column,
    });

    return this.tokens;
  }

  // ========================================================
  // 字符辅助方法
  // ========================================================

  private peek(offset: number = 0): string {
    return this.source[this.pos + offset] || '';
  }

  private advance(): string {
    const ch = this.source[this.pos];
    this.pos++;
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private isAlpha(ch: string): boolean {
    return /[a-zA-Z_]/.test(ch);
  }

  private isAlphaNumeric(ch: string): boolean {
    return /[a-zA-Z0-9_]/.test(ch);
  }

  private isDigit(ch: string): boolean {
    return /[0-9]/.test(ch);
  }

  private isWhitespace(ch: string): boolean {
    return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
  }

  // ========================================================
  // 跳过空白和注释
  // ========================================================

  private skipWhitespaceAndComments(): void {
    while (!this.isAtEnd()) {
      const ch = this.peek();

      // 空白
      if (this.isWhitespace(ch)) {
        this.advance();
        continue;
      }

      // 单行注释 //
      if (ch === '/' && this.peek(1) === '/') {
        while (!this.isAtEnd() && this.peek() !== '\n') {
          this.advance();
        }
        continue;
      }

      // 多行注释 /* */
      if (ch === '/' && this.peek(1) === '*') {
        this.advance(); // /
        this.advance(); // *
        while (!this.isAtEnd()) {
          if (this.peek() === '*' && this.peek(1) === '/') {
            this.advance(); // *
            this.advance(); // /
            break;
          }
          this.advance();
        }
        continue;
      }

      break;
    }
  }

  // ========================================================
  // 读取一个 Token
  // ========================================================

  private readToken(): Token | null {
    const startLine = this.line;
    const startColumn = this.column;
    const ch = this.peek();

    // 标识符或关键字
    if (this.isAlpha(ch)) {
      return this.readIdentifier(startLine, startColumn);
    }

    // 数字
    if (this.isDigit(ch)) {
      return this.readNumber(startLine, startColumn);
    }

    // 字符串
    if (ch === '"') {
      return this.readString(startLine, startColumn);
    }

    // 运算符和分隔符
    return this.readOperator(startLine, startColumn);
  }

  // ========================================================
  // 读取标识符或关键字
  // ========================================================

  private readIdentifier(startLine: number, startColumn: number): Token {
    let value = '';
    while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
      value += this.advance();
    }

    // 检查是否是关键字
    const keywordType = KEYWORDS[value];
    if (keywordType) {
      return {
        type: keywordType,
        value,
        line: startLine,
        column: startColumn,
      };
    }

    // 检查是否是 HTTP 方法（大写）
    const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    if (httpMethods.includes(value)) {
      return {
        type: TokenType[value as keyof typeof TokenType] || TokenType.IDENTIFIER,
        value,
        line: startLine,
        column: startColumn,
      };
    }

    return {
      type: TokenType.IDENTIFIER,
      value,
      line: startLine,
      column: startColumn,
    };
  }

  // ========================================================
  // 读取数字（可能是货币）
  // ========================================================

  private readNumber(startLine: number, startColumn: number): Token {
    let value = '';
    let isFloat = false;

    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      value += this.advance();
    }

    // 小数点
    if (this.peek() === '.' && this.isDigit(this.peek(1))) {
      isFloat = true;
      value += this.advance(); // .
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    // 检查是否是货币（数字后面跟空格和货币代码）
    if (this.peek() === ' ' || this.peek() === '\t') {
      const savedPos = this.pos;
      const savedLine = this.line;
      const savedColumn = this.column;

      // 跳过空格
      while (!this.isAtEnd() && (this.peek() === ' ' || this.peek() === '\t')) {
        this.advance();
      }

      // 读取可能的货币代码
      let currency = '';
      while (!this.isAtEnd() && /[A-Z]/.test(this.peek())) {
        currency += this.advance();
      }

      if (currency && CURRENCY_CODES.has(currency)) {
        return {
          type: TokenType.MONEY,
          value: `${value} ${currency}`,
          line: startLine,
          column: startColumn,
          raw: `${value} ${currency}`,
        };
      }

      // 不是货币，回退
      this.pos = savedPos;
      this.line = savedLine;
      this.column = savedColumn;
    }

    return {
      type: TokenType.NUMBER,
      value,
      line: startLine,
      column: startColumn,
    };
  }

  // ========================================================
  // 读取字符串
  // ========================================================

  private readString(startLine: number, startColumn: number): Token {
    this.advance(); // 跳过开头的 "

    // 检查是否是多行字符串 """
    if (this.peek() === '"' && this.peek(1) === '"') {
      this.advance(); // "
      this.advance(); // "
      return this.readMultilineString(startLine, startColumn);
    }

    let value = '';
    while (!this.isAtEnd() && this.peek() !== '"') {
      const ch = this.advance();

      if (ch === '\\') {
        const next = this.advance();
        switch (next) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case 'r': value += '\r'; break;
          case '0': value += '\0'; break;
          default: value += next; break;
        }
      } else {
        value += ch;
      }
    }

    if (this.isAtEnd()) {
      throw new LexerError('Unterminated string literal', startLine, startColumn);
    }

    this.advance(); // 跳过结尾的 "

    return {
      type: TokenType.STRING,
      value,
      line: startLine,
      column: startColumn,
    };
  }

  private readMultilineString(startLine: number, startColumn: number): Token {
    let value = '';
    while (!this.isAtEnd()) {
      if (this.peek() === '"' && this.peek(1) === '"' && this.peek(2) === '"') {
        this.advance(); // "
        this.advance(); // "
        this.advance(); // "
        return {
          type: TokenType.STRING,
          value,
          line: startLine,
          column: startColumn,
        };
      }
      value += this.advance();
    }

    throw new LexerError('Unterminated multiline string', startLine, startColumn);
  }

  // ========================================================
  // 读取运算符和分隔符
  // ========================================================

  private readOperator(startLine: number, startColumn: number): Token {
    const ch = this.advance();

    switch (ch) {
      case '+':
        return this.makeToken(TokenType.PLUS, '+', startLine, startColumn);
      case '-':
        if (this.peek() === '>') {
          this.advance();
          return this.makeToken(TokenType.ARROW, '->', startLine, startColumn);
        }
        return this.makeToken(TokenType.MINUS, '-', startLine, startColumn);
      case '*':
        return this.makeToken(TokenType.STAR, '*', startLine, startColumn);
      case '/':
        return this.makeToken(TokenType.SLASH, '/', startLine, startColumn);
      case '%':
        return this.makeToken(TokenType.PERCENT, '%', startLine, startColumn);
      case '=':
        if (this.peek() === '=') {
          this.advance();
          return this.makeToken(TokenType.EQ, '==', startLine, startColumn);
        }
        return this.makeToken(TokenType.ASSIGN, '=', startLine, startColumn);
      case '!':
        if (this.peek() === '=') {
          this.advance();
          return this.makeToken(TokenType.NEQ, '!=', startLine, startColumn);
        }
        return this.makeToken(TokenType.NOT, '!', startLine, startColumn);
      case '<':
        if (this.peek() === '=') {
          this.advance();
          return this.makeToken(TokenType.LTE, '<=', startLine, startColumn);
        }
        return this.makeToken(TokenType.LT, '<', startLine, startColumn);
      case '>':
        if (this.peek() === '=') {
          this.advance();
          return this.makeToken(TokenType.GTE, '>=', startLine, startColumn);
        }
        return this.makeToken(TokenType.GT, '>', startLine, startColumn);
      case '&':
        if (this.peek() === '&') {
          this.advance();
          return this.makeToken(TokenType.AND, '&&', startLine, startColumn);
        }
        throw new LexerError('Unexpected single &', startLine, startColumn);
      case '|':
        if (this.peek() === '|') {
          this.advance();
          return this.makeToken(TokenType.OR, '||', startLine, startColumn);
        }
        throw new LexerError('Unexpected single |', startLine, startColumn);
      case ':':
        return this.makeToken(TokenType.COLON, ':', startLine, startColumn);
      case '.':
        return this.makeToken(TokenType.DOT, '.', startLine, startColumn);
      case '?':
        return this.makeToken(TokenType.QUESTION, '?', startLine, startColumn);
      case '@':
        return this.makeToken(TokenType.AT, '@', startLine, startColumn);
      case ',':
        return this.makeToken(TokenType.COMMA, ',', startLine, startColumn);
      case '(':
        return this.makeToken(TokenType.LPAREN, '(', startLine, startColumn);
      case ')':
        return this.makeToken(TokenType.RPAREN, ')', startLine, startColumn);
      case '[':
        return this.makeToken(TokenType.LBRACKET, '[', startLine, startColumn);
      case ']':
        return this.makeToken(TokenType.RBRACKET, ']', startLine, startColumn);
      case '{':
        return this.makeToken(TokenType.LBRACE, '{', startLine, startColumn);
      case '}':
        return this.makeToken(TokenType.RBRACE, '}', startLine, startColumn);
      default:
        throw new LexerError(`Unexpected character: '${ch}'`, startLine, startColumn);
    }
  }

  private makeToken(type: TokenType, value: string, line: number, column: number): Token {
    return { type, value, line, column };
  }
}

// ============================================================
// 便捷函数
// ============================================================

/**
 * 对 TLL 源代码进行词法分析
 */
export function lex(source: string): Token[] {
  const lexer = new Lexer(source);
  return lexer.tokenize();
}

/**
 * 将 token 流格式化为可读字符串（用于调试）
 */
export function formatTokens(tokens: Token[]): string {
  return tokens
    .map((t) => `${String(t.line).padStart(4)}:${String(t.column).padStart(3)}  ${t.type.padEnd(20)} ${JSON.stringify(t.value)}`)
    .join('\n');
}
