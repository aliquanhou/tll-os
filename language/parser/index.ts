/**
 * TLL Language Parser
 *
 * 递归下降语法分析器，将 token 流转换为 AST。
 *
 * TLL 是块驱动的声明式语言，核心语法是：
 *   blockType [name] [parameters] { members }
 *   propertyName: type [@modifier]
 */

import { Token, TokenType, LexerError } from '../lexer/index.js';
import {
  ASTNode,
  TLLFile,
  BlockNode,
  BlockMember,
  PropertyDeclaration,
  TypeReference,
  Decorator,
  ImportDeclaration,
  Expression,
  Statement,
  StringLiteral,
  NumberLiteral,
  MoneyLiteral,
  BooleanLiteral,
  NullLiteral,
  Identifier,
  MemberExpression,
  CallExpression,
  ArrayExpression,
  ObjectExpression,
  ObjectProperty,
  BinaryExpression,
  UnaryExpression,
  VariableDeclaration,
  ReturnStatement,
  IfStatement,
  ForStatement,
  ExpressionStatement,
} from '../ast/index.js';

// ============================================================
// Parser Error
// ============================================================

export class ParserError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
    public readonly expected?: string,
    public readonly found?: string,
  ) {
    super(`Parser Error at line ${line}, column ${column}: ${message}`);
    this.name = 'ParserError';
  }
}

// ============================================================
// Parser
// ============================================================

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * 解析主入口
   */
  parse(): TLLFile {
    this.pos = 0;
    const imports: ImportDeclaration[] = [];
    const blocks: BlockNode[] = [];

    while (!this.isAtEnd()) {
      if (this.check(TokenType.IMPORT)) {
        imports.push(this.parseImport());
      } else {
        blocks.push(this.parseBlock());
      }
    }

    return {
      kind: 'TLLFile',
      imports,
      blocks,
      line: 1,
      column: 1,
    };
  }

  // ========================================================
  // Token 辅助方法
  // ========================================================

  private peek(): Token {
    return this.tokens[this.pos] || this.tokens[this.tokens.length - 1];
  }

  private previous(): Token {
    return this.tokens[this.pos - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private checkValue(value: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().value === value;
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.pos++;
    }
    return this.previous();
  }

  private expect(type: TokenType, message?: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    const token = this.peek();
    throw new ParserError(
      message || `Expected ${type}, found '${token.value}'`,
      token.line,
      token.column,
      type,
      token.value,
    );
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  // ========================================================
  // 解析 Import
  // ========================================================

  private parseImport(): ImportDeclaration {
    const start = this.peek();
    this.expect(TokenType.IMPORT);

    const source = this.parseStringLiteral();

    let alias: Identifier | undefined;
    if (this.match(TokenType.AS)) {
      alias = this.parseIdentifier();
    }

    return {
      kind: 'ImportDeclaration',
      source,
      alias,
      line: start.line,
      column: start.column,
    };
  }

  // ========================================================
  // 解析块（核心语法）
  // ========================================================

  private parseBlock(): BlockNode {
    const start = this.peek();
    const blockTypeToken = this.advance();
    const blockType = blockTypeToken.value;

    // 解析块名称（可选）
    let name: Identifier | StringLiteral | undefined;
    if (this.check(TokenType.IDENTIFIER)) {
      name = this.parseIdentifier();
      // 处理成员表达式块名：permission user.read
      let nameStr = name.name;
      while (this.check(TokenType.DOT)) {
        this.advance();
        const prop = this.parsePropertyName();
        nameStr += '.' + prop.name;
      }
      name = { ...name, name: nameStr };
    } else if (this.check(TokenType.STRING)) {
      name = this.parseStringLiteral();
    }

    // 解析块参数（如 API 的 HTTP 方法和路径）
    const parameters: Expression[] = [];
    while (!this.check(TokenType.LBRACE) && !this.isAtEnd()) {
      parameters.push(this.parseExpression());
    }

    // 解析块体
    this.expect(TokenType.LBRACE, `Expected '{' after block '${blockType}'`);
    const body = this.parseBlockBody();
    const endToken = this.expect(TokenType.RBRACE, `Expected '}' to close block '${blockType}'`);

    return {
      kind: 'Block',
      blockType,
      name,
      parameters,
      body,
      line: start.line,
      column: start.column,
      endLine: endToken.line,
      endColumn: endToken.column,
    };
  }

  private parseBlockBody(): BlockMember[] {
    const members: BlockMember[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const member = this.parseBlockMember();
      if (member) {
        members.push(member);
      }
    }

    return members;
  }

  private parseBlockMember(): BlockMember | null {
    const token = this.peek();
    const nextToken = this.tokens[this.pos + 1];
    const nextNextToken = this.tokens[this.pos + 2];

    // 属性声明：任何 token（包括关键字）后面跟 : 或 ?: 都作为属性名
    if (
      (nextToken && nextToken.type === TokenType.COLON) ||
      (nextToken && nextToken.type === TokenType.QUESTION && nextNextToken && nextNextToken.type === TokenType.COLON)
    ) {
      return this.parsePropertyDeclaration();
    }

    // 子块：关键字开头（且后面不是 :）
    if (this.isBlockKeyword(token.type)) {
      return this.parseBlock();
    }

    // 语句（嵌入式表达式语言）
    if (this.check(TokenType.CONST) || this.check(TokenType.LET)) {
      return this.parseVariableDeclaration();
    }
    if (this.check(TokenType.RETURN)) {
      return this.parseReturnStatement();
    }
    if (this.check(TokenType.IF)) {
      return this.parseIfStatement();
    }
    if (this.check(TokenType.FOR)) {
      return this.parseForStatement();
    }

    // 表达式语句
    if (this.isExpressionStart(token.type)) {
      return this.parseExpressionStatement();
    }

    // 未知 token，跳过并报错
    throw new ParserError(
      `Unexpected token '${token.value}' (${token.type})`,
      token.line,
      token.column,
    );
  }

  private isBlockKeyword(type: TokenType): boolean {
    const blockKeywords = [
      TokenType.APPLICATION, TokenType.IDENTITY, TokenType.MODULE,
      TokenType.ENTITY, TokenType.API, TokenType.ACTION, TokenType.EVENT,
      TokenType.WORKFLOW, TokenType.STEP, TokenType.AGENT, TokenType.TOOL,
      TokenType.PERMISSION, TokenType.ROLE, TokenType.VIEW, TokenType.COMPONENT,
      TokenType.TEST, TokenType.DEPLOYMENT, TokenType.INTEGRATION, TokenType.STORAGE,
      TokenType.QUERY, TokenType.PARAMS, TokenType.BODY, TokenType.INPUT,
      TokenType.OUTPUT, TokenType.LOGIC, TokenType.PAYLOAD, TokenType.POLICY,
      TokenType.SETUP, TokenType.ASSERT, TokenType.CONFIG, TokenType.DATABASE,
      TokenType.SCALING, TokenType.POOL, TokenType.ENV, TokenType.MEMORY,
      TokenType.CAPABILITIES, TokenType.FILTERS, TokenType.COLUMNS, TokenType.ACTIONS,
      TokenType.CARDS, TokenType.TABLE, TokenType.TOOLS,
    ];
    return blockKeywords.includes(type);
  }

  private isExpressionStart(type: TokenType): boolean {
    return [
      TokenType.STRING, TokenType.NUMBER, TokenType.MONEY, TokenType.BOOLEAN,
      TokenType.NULL, TokenType.IDENTIFIER, TokenType.LPAREN, TokenType.LBRACKET,
      TokenType.LBRACE, TokenType.NOT, TokenType.MINUS, TokenType.CREATE, TokenType.STAR,
    ].includes(type);
  }

  // ========================================================
  // 解析属性声明
  // ========================================================

  private parsePropertyDeclaration(): PropertyDeclaration {
    const start = this.peek();
    const name = this.parsePropertyName();

    // 处理 name?: type 语法
    let optional = false;
    if (this.check(TokenType.QUESTION)) {
      optional = true;
      this.advance();
    }

    this.expect(TokenType.COLON, "Expected ':' after property name");

    const type = this.parseTypeReference();

    // 处理成员表达式属性值：allow: user.read, permission: product.write
    let memberExpr = type.name;
    while (this.check(TokenType.DOT)) {
      this.advance();
      const prop = this.parsePropertyName();
      memberExpr += '.' + prop.name;
    }
    type.name = memberExpr;

    // 处理多行列表属性值：tools:\n  item1\n  item2
    // 收集后续的列表值（标识符或字面量，且不是块成员的开始）
    const listValues: string[] = [type.name];
    while (this.isListItemContinuation()) {
      const valueToken = this.advance();
      let value = valueToken.value;
      // 处理列表值中的成员表达式：post.read, post.write
      while (this.check(TokenType.DOT)) {
        this.advance();
        const prop = this.parsePropertyName();
        value += '.' + prop.name;
      }
      listValues.push(value);
    }
    if (listValues.length > 1) {
      type.name = listValues.join(', ');
    }

    // 解析装饰器
    const modifiers: Decorator[] = [];
    while (this.check(TokenType.AT)) {
      modifiers.push(this.parseDecorator());
    }

    return {
      kind: 'PropertyDeclaration',
      name,
      type,
      optional,
      modifiers,
      line: start.line,
      column: start.column,
    };
  }

  private isListItemContinuation(): boolean {
    const token = this.peek();
    const nextToken = this.tokens[this.pos + 1];
    const nextNextToken = this.tokens[this.pos + 2];

    // 列表值可以是标识符、字符串、数字、关键字（如 author、status 等）
    if (!this.check(TokenType.IDENTIFIER) && !this.check(TokenType.STRING) &&
        !this.check(TokenType.NUMBER) && !this.isKeyword(token.type)) {
      return false;
    }

    // 不能是块关键字
    if (this.isBlockKeyword(token.type)) {
      return false;
    }

    // 不能是属性声明的开始（后面跟 : 或 ?:）
    if (nextToken && nextToken.type === TokenType.COLON) {
      return false;
    }
    if (nextToken && nextToken.type === TokenType.QUESTION && nextNextToken && nextNextToken.type === TokenType.COLON) {
      return false;
    }

    // 不能是语句关键字
    if (this.check(TokenType.CONST) || this.check(TokenType.LET) || this.check(TokenType.RETURN) ||
        this.check(TokenType.IF) || this.check(TokenType.FOR) || this.check(TokenType.CREATE)) {
      return false;
    }

    return true;
  }

  private parsePropertyName(): Identifier {
    const token = this.peek();
    // 属性名可以是标识符或关键字
    if (this.check(TokenType.IDENTIFIER) || this.isKeyword(token.type)) {
      this.advance();
      return {
        kind: 'Identifier',
        name: token.value,
        line: token.line,
        column: token.column,
      };
    }
    throw new ParserError(
      `Expected property name, found '${token.value}'`,
      token.line,
      token.column,
    );
  }

  private isKeyword(type: TokenType): boolean {
    const nonKeywords = [
      TokenType.IDENTIFIER, TokenType.STRING, TokenType.NUMBER, TokenType.MONEY,
      TokenType.BOOLEAN, TokenType.NULL, TokenType.EOF, TokenType.NEWLINE,
      TokenType.PLUS, TokenType.MINUS, TokenType.STAR, TokenType.SLASH, TokenType.PERCENT,
      TokenType.EQ, TokenType.NEQ, TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE,
      TokenType.AND, TokenType.OR, TokenType.NOT, TokenType.COLON, TokenType.ASSIGN,
      TokenType.DOT, TokenType.QUESTION, TokenType.AT, TokenType.COMMA, TokenType.ARROW,
      TokenType.LPAREN, TokenType.RPAREN, TokenType.LBRACKET, TokenType.RBRACKET,
      TokenType.LBRACE, TokenType.RBRACE,
    ];
    return !nonKeywords.includes(type);
  }

  private isHttpMethod(type: TokenType): boolean {
    return [
      TokenType.GET, TokenType.POST, TokenType.PUT, TokenType.PATCH,
      TokenType.DELETE, TokenType.HEAD, TokenType.OPTIONS,
    ].includes(type);
  }

  private parseTypeReference(): TypeReference {
    const start = this.peek();
    const nameToken = this.advance();
    const name = nameToken.value;

    const typeRef: TypeReference = {
      kind: 'TypeReference',
      name,
      line: start.line,
      column: start.column,
    };

    // 枚举类型：enum(value1, value2, ...)
    if (name === 'enum' && this.check(TokenType.LPAREN)) {
      typeRef.isEnum = true;
      typeRef.enumValues = [];
      this.advance(); // (
      while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
        const val = this.advance();
        typeRef.enumValues.push(val.value);
        if (this.check(TokenType.COMMA)) {
          this.advance();
        }
      }
      this.expect(TokenType.RPAREN, "Expected ')' after enum values");
    }

    // 泛型类型：list(type), relation(type)
    if (this.check(TokenType.LPAREN)) {
      this.advance(); // (
      typeRef.typeArguments = [this.parseTypeReference()];
      this.expect(TokenType.RPAREN, "Expected ')' after type argument");
    }

    return typeRef;
  }

  private parseDecorator(): Decorator {
    const start = this.peek();
    this.expect(TokenType.AT);
    const name = this.parsePropertyName();

    let args: Expression[] | undefined;
    if (this.check(TokenType.LPAREN)) {
      this.advance(); // (
      args = [];
      while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
        args.push(this.parseExpression());
        if (this.check(TokenType.COMMA)) {
          this.advance();
        }
      }
      this.expect(TokenType.RPAREN, "Expected ')' after decorator arguments");
    }

    return {
      kind: 'Decorator',
      name,
      arguments: args,
      line: start.line,
      column: start.column,
    };
  }

  // ========================================================
  // 解析语句（嵌入式表达式语言）
  // ========================================================

  private parseVariableDeclaration(): VariableDeclaration {
    const start = this.peek();
    const kindType = this.check(TokenType.CONST) ? 'const' : 'let';
    this.advance(); // const or let

    const name = this.parseIdentifier();
    this.expect(TokenType.ASSIGN, "Expected '=' in variable declaration");
    const initializer = this.parseExpression();

    return {
      kind: 'VariableDeclaration',
      kindType,
      name,
      initializer,
      line: start.line,
      column: start.column,
    };
  }

  private parseReturnStatement(): ReturnStatement {
    const start = this.peek();
    this.expect(TokenType.RETURN);

    let argument: Expression | null = null;
    if (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      argument = this.parseExpression();
    }

    return {
      kind: 'ReturnStatement',
      argument,
      line: start.line,
      column: start.column,
    };
  }

  private parseIfStatement(): IfStatement {
    const start = this.peek();
    this.expect(TokenType.IF);
    const condition = this.parseExpression();
    this.expect(TokenType.COLON, "Expected ':' after if condition");

    const consequent = this.parseStatementBlock();

    let alternate: Statement[] | null = null;
    if (this.check(TokenType.ELSE)) {
      this.advance();
      this.expect(TokenType.COLON, "Expected ':' after else");
      alternate = this.parseStatementBlock();
    }

    return {
      kind: 'IfStatement',
      condition,
      consequent,
      alternate,
      line: start.line,
      column: start.column,
    };
  }

  private parseForStatement(): ForStatement {
    const start = this.peek();
    this.expect(TokenType.FOR);
    const variable = this.parseIdentifier();
    this.expect(TokenType.IN, "Expected 'in' in for statement");
    const iterable = this.parseExpression();
    this.expect(TokenType.COLON, "Expected ':' after for expression");

    const body = this.parseStatementBlock();

    return {
      kind: 'ForStatement',
      variable,
      iterable,
      body,
      line: start.line,
      column: start.column,
    };
  }

  private parseStatementBlock(): Statement[] {
    const statements: Statement[] = [];

    // TLL 使用缩进行或 {} 块
    // 简化：使用 {} 块
    if (this.check(TokenType.LBRACE)) {
      this.advance();
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        const stmt = this.parseStatement();
        if (stmt) statements.push(stmt);
      }
      this.expect(TokenType.RBRACE, "Expected '}' to close statement block");
    } else {
      // 单行语句
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }

    return statements;
  }

  private parseStatement(): Statement | null {
    if (this.check(TokenType.CONST) || this.check(TokenType.LET)) {
      return this.parseVariableDeclaration();
    }
    if (this.check(TokenType.RETURN)) {
      return this.parseReturnStatement();
    }
    if (this.check(TokenType.IF)) {
      return this.parseIfStatement();
    }
    if (this.check(TokenType.FOR)) {
      return this.parseForStatement();
    }
    return this.parseExpressionStatement();
  }

  private parseExpressionStatement(): ExpressionStatement {
    const start = this.peek();
    const expression = this.parseExpression();
    return {
      kind: 'ExpressionStatement',
      expression,
      line: start.line,
      column: start.column,
    };
  }

  // ========================================================
  // 解析表达式
  // ========================================================

  private parseExpression(): Expression {
    return this.parseAssignment();
  }

  private parseAssignment(): Expression {
    const left = this.parseLogicalOr();

    if (this.check(TokenType.ASSIGN)) {
      this.advance();
      const value = this.parseAssignment();
      return {
        kind: 'BinaryExpression',
        operator: '=',
        left,
        right: value,
        line: left.line,
        column: left.column,
      } as BinaryExpression;
    }

    return left;
  }

  private parseLogicalOr(): Expression {
    let left = this.parseLogicalAnd();

    while (this.check(TokenType.OR)) {
      const op = this.advance();
      const right = this.parseLogicalAnd();
      left = {
        kind: 'BinaryExpression',
        operator: op.value,
        left,
        right,
        line: left.line,
        column: left.column,
      };
    }

    return left;
  }

  private parseLogicalAnd(): Expression {
    let left = this.parseEquality();

    while (this.check(TokenType.AND)) {
      const op = this.advance();
      const right = this.parseEquality();
      left = {
        kind: 'BinaryExpression',
        operator: op.value,
        left,
        right,
        line: left.line,
        column: left.column,
      };
    }

    return left;
  }

  private parseEquality(): Expression {
    let left = this.parseComparison();

    while (this.check(TokenType.EQ) || this.check(TokenType.NEQ)) {
      const op = this.advance();
      const right = this.parseComparison();
      left = {
        kind: 'BinaryExpression',
        operator: op.value,
        left,
        right,
        line: left.line,
        column: left.column,
      };
    }

    return left;
  }

  private parseComparison(): Expression {
    let left = this.parseAdditive();

    while (
      this.check(TokenType.LT) || this.check(TokenType.GT) ||
      this.check(TokenType.LTE) || this.check(TokenType.GTE)
    ) {
      const op = this.advance();
      const right = this.parseAdditive();
      left = {
        kind: 'BinaryExpression',
        operator: op.value,
        left,
        right,
        line: left.line,
        column: left.column,
      };
    }

    return left;
  }

  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();

    while (this.check(TokenType.PLUS) || this.check(TokenType.MINUS)) {
      const op = this.advance();
      const right = this.parseMultiplicative();
      left = {
        kind: 'BinaryExpression',
        operator: op.value,
        left,
        right,
        line: left.line,
        column: left.column,
      };
    }

    return left;
  }

  private parseMultiplicative(): Expression {
    let left = this.parseUnary();

    while (
      this.check(TokenType.STAR) || this.check(TokenType.SLASH) ||
      this.check(TokenType.PERCENT)
    ) {
      const op = this.advance();
      const right = this.parseUnary();
      left = {
        kind: 'BinaryExpression',
        operator: op.value,
        left,
        right,
        line: left.line,
        column: left.column,
      };
    }

    return left;
  }

  private parseUnary(): Expression {
    if (this.check(TokenType.NOT) || this.check(TokenType.MINUS)) {
      const start = this.peek();
      const op = this.advance();
      const argument = this.parseUnary();
      return {
        kind: 'UnaryExpression',
        operator: op.value,
        argument,
        line: start.line,
        column: start.column,
      };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expression = this.parsePrimary();

    while (true) {
      if (this.check(TokenType.DOT)) {
        this.advance();
        const property = this.parsePropertyName();
        expression = {
          kind: 'MemberExpression',
          object: expression,
          property,
          line: expression.line,
          column: expression.column,
        };
      } else if (this.check(TokenType.LPAREN)) {
        this.advance();
        const args: Expression[] = [];
        while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
          args.push(this.parseExpression());
          if (this.check(TokenType.COMMA)) {
            this.advance();
          }
        }
        this.expect(TokenType.RPAREN, "Expected ')' after function call");
        expression = {
          kind: 'CallExpression',
          callee: expression,
          arguments: args,
          line: expression.line,
          column: expression.column,
        };
      } else if (this.check(TokenType.LBRACKET)) {
        this.advance();
        const index = this.parseExpression();
        this.expect(TokenType.RBRACKET, "Expected ']' after index");
        expression = {
          kind: 'MemberExpression',
          object: expression,
          property: { kind: 'Identifier', name: 'computed', line: index.line, column: index.column } as Identifier,
          line: expression.line,
          column: expression.column,
        };
      } else {
        break;
      }
    }

    return expression;
  }

  private parsePrimary(): Expression {
    const token = this.peek();

    if (this.check(TokenType.STRING)) {
      return this.parseStringLiteral();
    }

    if (this.check(TokenType.NUMBER)) {
      return this.parseNumberLiteral();
    }

    if (this.check(TokenType.MONEY)) {
      return this.parseMoneyLiteral();
    }

    if (this.check(TokenType.BOOLEAN)) {
      this.advance();
      return {
        kind: 'BooleanLiteral',
        value: token.value === 'true',
        line: token.line,
        column: token.column,
      } as BooleanLiteral;
    }

    if (this.check(TokenType.NULL)) {
      this.advance();
      return {
        kind: 'NullLiteral',
        line: token.line,
        column: token.column,
      } as NullLiteral;
    }

    if (this.check(TokenType.IDENTIFIER)) {
      return this.parseIdentifier();
    }

    // HTTP 方法关键字作为标识符（API 块参数）
    if (this.isHttpMethod(token.type)) {
      this.advance();
      return {
        kind: 'Identifier',
        name: token.value,
        line: token.line,
        column: token.column,
      } as Identifier;
    }

    // 通配符 *
    if (this.check(TokenType.STAR)) {
      this.advance();
      return {
        kind: 'Identifier',
        name: '*',
        line: token.line,
        column: token.column,
      } as Identifier;
    }

    if (this.check(TokenType.LPAREN)) {
      this.advance();
      const expression = this.parseExpression();
      this.expect(TokenType.RPAREN, "Expected ')' after grouped expression");
      return expression;
    }

    if (this.check(TokenType.LBRACKET)) {
      return this.parseArrayExpression();
    }

    if (this.check(TokenType.LBRACE)) {
      return this.parseObjectExpression();
    }

    // CREATE 关键字作为表达式（create Entity { ... }）
    if (this.check(TokenType.CREATE)) {
      this.advance();
      const entityName = this.parseIdentifier();
      // create 后面可能跟 { ... } 对象
      let args: Expression[] = [];
      if (this.check(TokenType.LBRACE)) {
        args = [this.parseObjectExpression()];
      }
      return {
        kind: 'CallExpression',
        callee: {
          kind: 'MemberExpression',
          object: entityName,
          property: { kind: 'Identifier', name: 'create', line: token.line, column: token.column } as Identifier,
          line: token.line,
          column: token.column,
        } as MemberExpression,
        arguments: args,
        line: token.line,
        column: token.column,
      } as CallExpression;
    }

    // 通用处理：任何非运算符/分隔符/EOF 的 token 都可以作为标识符
    // 这允许 body、permission、module 等关键字在表达式中作为标识符使用
    if (this.isKeyword(token.type) || this.isHttpMethod(token.type)) {
      this.advance();
      return {
        kind: 'Identifier',
        name: token.value,
        line: token.line,
        column: token.column,
      } as Identifier;
    }

    throw new ParserError(
      `Unexpected token '${token.value}' (${token.type}) in expression`,
      token.line,
      token.column,
    );
  }

  private parseArrayExpression(): ArrayExpression {
    const start = this.peek();
    this.expect(TokenType.LBRACKET);
    const elements: Expression[] = [];

    while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
      elements.push(this.parseExpression());
      if (this.check(TokenType.COMMA)) {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACKET, "Expected ']' to close array");

    return {
      kind: 'ArrayExpression',
      elements,
      line: start.line,
      column: start.column,
    };
  }

  private parseObjectExpression(): ObjectExpression {
    const start = this.peek();
    this.expect(TokenType.LBRACE);
    const properties: ObjectProperty[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const key = this.check(TokenType.STRING) ? this.parseStringLiteral() : this.parsePropertyName();
      this.expect(TokenType.COLON, "Expected ':' after object property key");
      const value = this.parseExpression();
      properties.push({
        kind: 'ObjectProperty',
        key,
        value,
        line: key.line,
        column: key.column,
      });
      if (this.check(TokenType.COMMA)) {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE, "Expected '}' to close object");

    return {
      kind: 'ObjectExpression',
      properties,
      line: start.line,
      column: start.column,
    };
  }

  // ========================================================
  // 解析基础字面量
  // ========================================================

  private parseStringLiteral(): StringLiteral {
    const token = this.expect(TokenType.STRING);
    return {
      kind: 'StringLiteral',
      value: token.value,
      line: token.line,
      column: token.column,
    };
  }

  private parseNumberLiteral(): NumberLiteral {
    const token = this.expect(TokenType.NUMBER);
    return {
      kind: 'NumberLiteral',
      value: parseFloat(token.value),
      raw: token.value,
      line: token.line,
      column: token.column,
    };
  }

  private parseMoneyLiteral(): MoneyLiteral {
    const token = this.expect(TokenType.MONEY);
    const parts = token.value.split(' ');
    return {
      kind: 'MoneyLiteral',
      amount: parseFloat(parts[0]),
      currency: parts[1] || 'USD',
      raw: token.value,
      line: token.line,
      column: token.column,
    };
  }

  private parseIdentifier(): Identifier {
    const token = this.expect(TokenType.IDENTIFIER, 'Expected identifier');
    return {
      kind: 'Identifier',
      name: token.value,
      line: token.line,
      column: token.column,
    };
  }
}

// ============================================================
// 便捷函数
// ============================================================

/**
 * 对 TLL 源代码进行解析，返回 AST
 */
export function parse(source: string): TLLFile {
  const { Lexer } = require('../lexer/index.js');
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * 从 token 流解析，返回 AST
 */
export function parseTokens(tokens: Token[]): TLLFile {
  const parser = new Parser(tokens);
  return parser.parse();
}
