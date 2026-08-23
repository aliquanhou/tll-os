/**
 * TLL Language AST (Abstract Syntax Tree)
 *
 * 定义 TLL 源代码解析后的语法树节点。
 * 所有节点都包含位置信息（行号、列号），用于错误报告和 Source Map。
 */

// ============================================================
// 基础节点接口
// ============================================================

export interface ASTNode {
  kind: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

// ============================================================
// 字面量和表达式
// ============================================================

export interface StringLiteral extends ASTNode {
  kind: 'StringLiteral';
  value: string;
}

export interface NumberLiteral extends ASTNode {
  kind: 'NumberLiteral';
  value: number;
  raw: string;
}

export interface MoneyLiteral extends ASTNode {
  kind: 'MoneyLiteral';
  amount: number;
  currency: string;
  raw: string;
}

export interface BooleanLiteral extends ASTNode {
  kind: 'BooleanLiteral';
  value: boolean;
}

export interface NullLiteral extends ASTNode {
  kind: 'NullLiteral';
}

export interface Identifier extends ASTNode {
  kind: 'Identifier';
  name: string;
}

export interface MemberExpression extends ASTNode {
  kind: 'MemberExpression';
  object: Expression;
  property: Identifier;
}

export interface CallExpression extends ASTNode {
  kind: 'CallExpression';
  callee: Expression;
  arguments: Expression[];
}

export interface ArrayExpression extends ASTNode {
  kind: 'ArrayExpression';
  elements: Expression[];
}

export interface ObjectExpression extends ASTNode {
  kind: 'ObjectExpression';
  properties: ObjectProperty[];
}

export interface ObjectProperty extends ASTNode {
  kind: 'ObjectProperty';
  key: Identifier | StringLiteral;
  value: Expression;
}

export interface BinaryExpression extends ASTNode {
  kind: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression extends ASTNode {
  kind: 'UnaryExpression';
  operator: string;
  argument: Expression;
}

export interface VariableDeclaration extends ASTNode {
  kind: 'VariableDeclaration';
  kindType: 'const' | 'let';
  name: Identifier;
  initializer: Expression;
}

export interface ReturnStatement extends ASTNode {
  kind: 'ReturnStatement';
  argument: Expression | null;
}

export interface IfStatement extends ASTNode {
  kind: 'IfStatement';
  condition: Expression;
  consequent: Statement[];
  alternate: Statement[] | null;
}

export interface ForStatement extends ASTNode {
  kind: 'ForStatement';
  variable: Identifier;
  iterable: Expression;
  body: Statement[];
}

export interface ExpressionStatement extends ASTNode {
  kind: 'ExpressionStatement';
  expression: Expression;
}

export type Expression =
  | StringLiteral
  | NumberLiteral
  | MoneyLiteral
  | BooleanLiteral
  | NullLiteral
  | Identifier
  | MemberExpression
  | CallExpression
  | ArrayExpression
  | ObjectExpression
  | BinaryExpression
  | UnaryExpression;

export type Statement =
  | VariableDeclaration
  | ReturnStatement
  | IfStatement
  | ForStatement
  | ExpressionStatement;

// ============================================================
// 属性声明（field: type @modifier）
// ============================================================

export interface PropertyDeclaration extends ASTNode {
  kind: 'PropertyDeclaration';
  name: Identifier;
  type: TypeReference;
  optional: boolean;
  modifiers: Decorator[];
  defaultValue?: Expression;
}

export interface TypeReference extends ASTNode {
  kind: 'TypeReference';
  name: string;
  typeArguments?: TypeReference[];
  isEnum?: boolean;
  enumValues?: string[];
}

export interface Decorator extends ASTNode {
  kind: 'Decorator';
  name: Identifier;
  arguments?: Expression[];
}

// ============================================================
// 块节点（通用容器）
// ============================================================

export interface BlockNode extends ASTNode {
  kind: 'Block';
  blockType: string;       // 块类型名（如 "entity", "api", "action"）
  name?: Identifier | StringLiteral;  // 块名称（可选）
  parameters?: Expression[];          // 块参数（如 API 的 HTTP 方法和路径）
  body: BlockMember[];                // 块内容
}

export type BlockMember =
  | PropertyDeclaration
  | BlockNode
  | Statement
  | Expression;

// ============================================================
// 顶层节点
// ============================================================

export interface ImportDeclaration extends ASTNode {
  kind: 'ImportDeclaration';
  source: StringLiteral;
  alias?: Identifier;
}

export interface TLLFile extends ASTNode {
  kind: 'TLLFile';
  imports: ImportDeclaration[];
  blocks: BlockNode[];
}

// ============================================================
// 便捷类型守卫
// ============================================================

export function isBlockNode(node: ASTNode): node is BlockNode {
  return node.kind === 'Block';
}

export function isPropertyDeclaration(node: ASTNode): node is PropertyDeclaration {
  return node.kind === 'PropertyDeclaration';
}

export function isExpression(node: ASTNode): node is Expression {
  return [
    'StringLiteral', 'NumberLiteral', 'MoneyLiteral', 'BooleanLiteral',
    'NullLiteral', 'Identifier', 'MemberExpression', 'CallExpression',
    'ArrayExpression', 'ObjectExpression', 'BinaryExpression', 'UnaryExpression',
  ].includes(node.kind);
}

export function isStatement(node: ASTNode): node is Statement {
  return [
    'VariableDeclaration', 'ReturnStatement', 'IfStatement',
    'ForStatement', 'ExpressionStatement',
  ].includes(node.kind);
}
