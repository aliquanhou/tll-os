/**
 * TLL Language Toolchain
 *
 * TLL 语言工具链统一入口。
 *
 * 流程：
 *   TLL Source → Lexer → Tokens → Parser → AST → Compiler → TLL-IR
 *
 * 用法：
 *   import { lex, parse, compile, TLLLanguage } from './language';
 *
 *   const tokens = lex(source);
 *   const ast = parse(source);
 *   const ir = compile(source);
 */

export { Lexer, lex, formatTokens, TokenType, Token, LexerError } from './lexer/index.js';
export { Parser, parse, parseTokens, ParserError } from './parser/index.js';
export * from './ast/index.js';

/**
 * TLL Language 工具链门面类
 */
export class TLLLanguage {
  /**
   * 词法分析
   */
  static lex(source: string) {
    const { Lexer } = require('./lexer/index.js');
    const lexer = new Lexer(source);
    return lexer.tokenize();
  }

  /**
   * 语法分析
   */
  static parse(source: string) {
    const { Lexer } = require('./lexer/index.js');
    const { Parser } = require('./parser/index.js');
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
  }

  /**
   * 编译为 TLL-IR
   */
  static compile(source: string) {
    const { compile } = require('../compiler/index.js');
    return compile(source);
  }

  /**
   * 完整流程：源码 → TLL-IR JSON
   */
  static compileToJSON(source: string): string {
    const ir = this.compile(source);
    return JSON.stringify(ir, null, 2);
  }
}
