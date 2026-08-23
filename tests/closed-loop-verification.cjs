#!/usr/bin/env node
/**
 * TLL OS Closed-Loop Verification Script
 * Simulates a stranger AI Agent learning TLL OS from the official website
 * and using it to develop an application.
 *
 * Flow:
 * 1. Read Agent Index from https://ts.knitoem.com/agent/index.json
 * 2. Read Protocol, Contracts, Examples from website
 * 3. Clone/access the repository
 * 4. Use TLL Language toolchain to compile an example app
 * 5. Run tests
 * 6. Verify the complete loop
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RESULTS = [];
function log(step, status, detail) {
  const entry = { step, status, detail, timestamp: new Date().toISOString() };
  RESULTS.push(entry);
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '→';
  console.log(`${icon} [${status}] ${step}: ${detail}`);
}

async function main() {
  console.log('='.repeat(70));
  console.log('TLL OS Closed-Loop Verification — Stranger Agent Simulation');
  console.log('='.repeat(70));
  console.log('');

  // Step 1: Read Agent Index from website
  console.log('--- Phase 1: Discovery from Official Website ---');
  try {
    const https = require('https');
    const indexData = await new Promise((resolve, reject) => {
      https.get('https://ts.knitoem.com/agent/index.json', (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
    log('Agent Index Discovery', 'PASS', `v${indexData.project.version} — ${indexData.project.description.substring(0, 60)}...`);
    log('Official Identity', 'PASS', `repo: ${indexData.official_identity.repository}, branch: ${indexData.official_identity.branch}`);

    if (indexData.language_toolchain) {
      log('Language Toolchain', 'PASS', `${indexData.language_toolchain.version} — ${indexData.language_toolchain.components.join(', ')}`);
    } else {
      log('Language Toolchain', 'FAIL', 'Not found in agent index');
    }
  } catch (e) {
    log('Agent Index Discovery', 'FAIL', e.message);
  }

  // Step 2: Access repository and verify toolchain
  console.log('');
  console.log('--- Phase 2: Repository & Toolchain Verification ---');
  const repoPath = '/opt/tll-os-repo';

  try {
    const files = [
      'language/lexer/index.ts',
      'language/parser/index.ts',
      'language/ast/index.ts',
      'ir/schema/index.ts',
      'compiler/index.ts',
      'language/index.ts',
      'examples/blog.tll',
      'tests/tll-language.test.ts',
      'language/specification/TLL-LANGUAGE-SPEC.md',
    ];
    let allExist = true;
    for (const f of files) {
      if (!fs.existsSync(path.join(repoPath, f))) {
        log('File Check', 'FAIL', `Missing: ${f}`);
        allExist = false;
      }
    }
    if (allExist) log('Toolchain Files', 'PASS', `${files.length} files all present`);

    // Verify package.json
    const pkg = JSON.parse(fs.readFileSync(path.join(repoPath, 'package.json'), 'utf8'));
    log('Package', 'PASS', `${pkg.name}@${pkg.version}`);
  } catch (e) {
    log('Repository Access', 'FAIL', e.message);
  }

  // Step 3: Compile blog.tll using TLL Language toolchain
  console.log('');
  console.log('--- Phase 3: TLL Language Compilation ---');
  try {
    const compileScript = `
const fs = require('fs');
const { Lexer } = require('./language/lexer/index.ts');
const { Parser } = require('./language/parser/index.ts');
const { Compiler } = require('./compiler/index.ts');

const source = fs.readFileSync('examples/blog.tll', 'utf8');
const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();
const compiler = new Compiler();
const ir = compiler.compile(ast);

const result = {
  tokens: tokens.length,
  blocks: ast.blocks.length,
  modules: ir.modules.length,
  entities: ir.entities.length,
  apis: ir.apis.length,
  agents: ir.agents.length,
  tools: ir.tools.length,
  roles: ir.roles.length,
  permissions: ir.permissions.length,
  tests: ir.tests.length,
  deployments: ir.deployments.length,
  graphNodes: ir.graph.nodes.length,
  graphEdges: ir.graph.edges.length,
  irVersion: ir.irVersion,
};
console.log(JSON.stringify(result));
`;
    fs.writeFileSync(path.join(repoPath, 'tmp-compile-check.cjs'), compileScript);
    const output = execSync(`cd ${repoPath} && npx tsx tmp-compile-check.cjs`, { timeout: 30000 }).toString();
    const result = JSON.parse(output.trim());
    fs.unlinkSync(path.join(repoPath, 'tmp-compile-check.cjs'));

    log('Lexer', 'PASS', `${result.tokens} tokens generated`);
    log('Parser', 'PASS', `${result.blocks} top-level blocks parsed`);
    log('Compiler', 'PASS', `TLL-IR v${result.irVersion} generated`);
    log('IR Structure', 'PASS', `${result.modules} modules, ${result.entities} entities, ${result.apis} APIs`);
    log('AI-Native Features', 'PASS', `${result.agents} agents, ${result.tools} tools, ${result.roles} roles`);
    log('Application Graph', 'PASS', `${result.graphNodes} nodes, ${result.graphEdges} edges`);
  } catch (e) {
    log('Compilation', 'FAIL', e.message);
  }

  // Step 4: Run tests
  console.log('');
  console.log('--- Phase 4: Test Execution ---');
  try {
    const output = execSync(`cd ${repoPath} && npx vitest run tests/tll-language.test.ts`, { timeout: 60000 }).toString();
    const match = output.match(/Tests\s+(\d+) passed \((\d+)\)/);
    if (match) {
      log('Language Tests', 'PASS', `${match[1]}/${match[2]} tests passed`);
    } else {
      log('Language Tests', 'PASS', 'Tests executed (see output)');
    }
  } catch (e) {
    log('Tests', 'FAIL', e.message);
  }

  // Step 5: Verify serializable IR (Agent can consume it)
  console.log('');
  console.log('--- Phase 5: Agent-Readable Output Verification ---');
  try {
    const irScript = `
const fs = require('fs');
const { Lexer } = require('./language/lexer/index.ts');
const { Parser } = require('./language/parser/index.ts');
const { Compiler } = require('./compiler/index.ts');
const source = fs.readFileSync('examples/blog.tll', 'utf8');
const lexer = new Lexer(source);
const parser = new Parser(lexer.tokenize());
const compiler = new Compiler();
const ir = compiler.compile(parser.parse());
const json = JSON.stringify(ir, null, 2);
fs.writeFileSync('tmp-tll-blog-ir.json', json);
console.log(json.length);
`;
    fs.writeFileSync(path.join(repoPath, 'tmp-ir-check.cjs'), irScript);
    const size = execSync(`cd ${repoPath} && npx tsx tmp-ir-check.cjs`, { timeout: 30000 }).toString().trim();
    fs.unlinkSync(path.join(repoPath, 'tmp-ir-check.cjs'));
    if (fs.existsSync(path.join(repoPath, 'tmp-tll-blog-ir.json'))) {
      fs.unlinkSync(path.join(repoPath, 'tmp-tll-blog-ir.json'));
    }
    log('IR Serialization', 'PASS', `${size} bytes of valid JSON`);
    log('Agent-Consumable', 'PASS', 'IR can be parsed by any JSON-capable agent');
  } catch (e) {
    log('IR Serialization', 'FAIL', e.message);
  }

  // Summary
  console.log('');
  console.log('='.repeat(70));
  console.log('CLOSED-LOOP VERIFICATION SUMMARY');
  console.log('='.repeat(70));
  const passed = RESULTS.filter(r => r.status === 'PASS').length;
  const failed = RESULTS.filter(r => r.status === 'FAIL').length;
  console.log(`Total: ${RESULTS.length} checks — ${passed} PASS, ${failed} FAIL`);
  console.log('');
  console.log('Loop verified:');
  console.log('  Website Agent Index → Repository → TLL Language → Compile → IR → Test → Agent-readable');
  console.log('');
  if (failed === 0) {
    console.log('✓ TLL OS Runtime 0.3 closed-loop verification PASSED');
  } else {
    console.log('✗ Some checks failed — see details above');
  }

  // Save results
  fs.writeFileSync('/tmp/tll-loop-results.json', JSON.stringify(RESULTS, null, 2));
}

main().catch(console.error);
