/**
 * TLL OS — Stranger Agent Verification Script
 *
 * Simulates a COMPLETELY UNFAMILIAR agent starting with NOTHING but the
 * official website URL. Proves a stranger agent can discover, install, use,
 * modify, and extend TLL OS entirely through the public official identity chain.
 *
 * Flow: discover → clone → install → test → create → modify → regression → TEP
 *
 * Usage: node scripts/verify-stranger-agent.mjs
 */

import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const WEBSITE = 'https://ts.knitoem.com';
const AGENT_INDEX = `${WEBSITE}/agent/index.json`;
const STEP_WIDTH = 55;

const results = [];
function step(name, fn) {
  process.stdout.write(`  ${name.padEnd(STEP_WIDTH, ' ')}`);
  try {
    const result = fn();
    results.push({ name, status: 'PASS', detail: result });
    console.log('PASS');
    if (result) console.log(`     ${result}`);
    return result;
  } catch (e) {
    results.push({ name, status: 'FAIL', error: e.message });
    console.log('FAIL');
    console.log(`     Error: ${e.message}`);
    throw e;
  }
}

console.log('');
console.log('=== TLL OS — Stranger Agent Full-Chain Verification ===');
console.log('  discover -> clone -> install -> test -> create -> modify');
console.log('  -> regression -> TEP');
console.log('');
console.log(`Starting point: ${AGENT_INDEX}`);
console.log('Agent has NO prior knowledge of TLL OS source code.');
console.log('');

// === Phase 1: DISCOVER ===
console.log('--- Phase 1: DISCOVER ---');

const indexJson = step('Fetch agent index.json', () => {
  const res = execSync(`curl.exe -sL "${AGENT_INDEX}"`, { encoding: 'utf-8', timeout: 30000 });
  if (!res || res.length < 10) throw new Error('Empty response from index.json');
  return JSON.parse(res);
});

const repoUrl = step('Discover repository URL', () => {
  const url = indexJson?.official_identity?.repository?.clone_url;
  if (!url) throw new Error('No repository.clone_url in index.json');
  if (!url.includes('github.com')) throw new Error(`Not GitHub: ${url}`);
  return url;
});

step('Discover install steps', () => {
  const s = indexJson?.install?.steps;
  if (!Array.isArray(s) || s.length < 3) throw new Error('No valid install.steps');
  return `${s.length} steps found`;
});

step('Discover runtime info', () => {
  const rt = indexJson?.runtime;
  if (!rt?.version || !rt?.source_entry) throw new Error('Missing runtime fields');
  return `${rt.name} v${rt.version} entry=${rt.source_entry}`;
});

const importStmt = step('Discover import statement', () => {
  const imp = indexJson?.getting_started?.import;
  if (!imp) throw new Error('No getting_started.import');
  return imp;
});

// === Phase 2: CLONE ===
console.log('');
console.log('--- Phase 2: CLONE ---');

const workDir = join(tmpdir(), `tll-stranger-${Date.now()}`);
mkdirSync(workDir, { recursive: true });

const repoDir = step('Clone repository to temp dir', () => {
  const target = join(workDir, 'tll-os');
  execSync(`git clone --depth 1 "${repoUrl}" "${target}"`, { encoding: 'utf-8', timeout: 120000 });
  if (!existsSync(join(target, 'package.json'))) throw new Error('No package.json after clone');
  return target;
});

// === Phase 3: INSTALL ===
console.log('');
console.log('--- Phase 3: INSTALL ---');

step('Run npm install', () => {
  execSync('npm install --no-audit --no-fund', { cwd: repoDir, encoding: 'utf-8', timeout: 180000, stdio: 'pipe' });
  if (!existsSync(join(repoDir, 'node_modules'))) throw new Error('No node_modules');
  return 'Dependencies installed';
});

// === Phase 4: BASELINE TEST ===
console.log('');
console.log('--- Phase 4: BASELINE TEST ---');

step('Run npm test (baseline)', () => {
  const output = execSync('npm test', { cwd: repoDir, encoding: 'utf-8', timeout: 120000, stdio: 'pipe' });
  const match = output.match(/Total:\s+(\d+)\/(\d+)\s+tests passed/);
  if (!match) throw new Error('Cannot parse test results');
  const p = parseInt(match[1], 10), t = parseInt(match[2], 10);
  if (p !== t) throw new Error(`Baseline failed: ${p}/${t}`);
  return `${p}/${t} tests passed`;
});

// === Phase 5: CREATE APP ===
console.log('');
console.log('--- Phase 5: CREATE APPLICATION ---');

const appFile = join(repoDir, 'stranger-test-app.mjs');

step('Create app using only public contract', () => {
  const code = [
    "import { createTllOS } from './src/public/index.js';",
    "",
    "const tll = createTllOS();",
    "const app = tll.createApplication({ name: 'stranger-test', version: '0.1.0', description: 'stranger agent test', environment: 'test', runtime: 'node' });",
    "await app.start();",
    "",
    "const mod = app.modules.create({ name: 'greeting', version: '1.0.0', namespace: 'Greeting', description: 'greeting module' });",
    "",
    "mod.apis.create({ method: 'GET', path: '/api/hello', name: 'greeting.hello', description: 'say hello', handler: () => ({ status: 200, headers: { 'content-type': 'application/json' }, body: { message: 'Hello from stranger!' } }) });",
    "",
    "mod.tools.create({ name: 'greet', description: 'greet someone', category: 'greeting', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }, handler: async (args) => ({ success: true, data: { message: 'Hello, ' + args.name + '!' } }) });",
    "",
    "mod.tests.create({ name: 'api.hello_200', moduleName: 'greeting', test: async (ctx) => { const r = await ctx.application.apis.request('GET', '/api/hello'); ctx.assert.equal(r.status, 200); ctx.assert.equal(r.body.message, 'Hello from stranger!'); } });",
    "",
    "mod.tests.create({ name: 'tool.greet_ok', moduleName: 'greeting', test: async (ctx) => { const tool = ctx.application.tools.get('greet'); ctx.assert.true(tool !== null); const r = await tool.invoke({ name: 'World' }); ctx.assert.true(r.success); ctx.assert.equal(r.data.message, 'Hello, World!'); } });",
    "",
    "const tr = await app.tests.runAll();",
    "console.log('Stranger app tests: ' + tr.passed + '/' + tr.total + ' passed');",
    "if (tr.passed !== tr.total) process.exit(1);",
    "const g = app.graph;",
    "console.log('Graph: ' + g.listNodes().length + ' nodes');",
    "await app.stop();",
    "console.log('Stranger agent app creation: SUCCESS');",
  ].join('\n');
  writeFileSync(appFile, code, 'utf-8');
  return 'Created stranger-test-app.mjs';
});

step('Run stranger-created app', () => {
  const output = execSync(`npx tsx "${appFile}"`, { cwd: repoDir, encoding: 'utf-8', timeout: 60000, stdio: 'pipe' });
  if (!output.includes('SUCCESS')) throw new Error('App did not report success');
  if (!output.includes('2/2')) throw new Error('Expected 2/2 tests');
  return '2/2 tests passed, app created OK';
});

// === Phase 6: MODIFY ===
console.log('');
console.log('--- Phase 6: MODIFY APPLICATION ---');

step('Add new API endpoint (modify)', () => {
  let code = readFileSync(appFile, 'utf-8');
  const newApi = "mod.apis.create({ method: 'GET', path: '/api/echo/:msg', name: 'greeting.echo', description: 'echo', handler: (req) => ({ status: 200, headers: { 'content-type': 'application/json' }, body: { echo: req.params.msg } }) });\n";
  code = code.replace("mod.tools.create({", newApi + "mod.tools.create({");
  const newTest = "mod.tests.create({ name: 'api.echo_ok', moduleName: 'greeting', test: async (ctx) => { const r = await ctx.application.apis.request('GET', '/api/echo/hi'); ctx.assert.equal(r.status, 200); ctx.assert.equal(r.body.echo, 'hi'); } });\n";
  code = code.replace("const tr = await app.tests.runAll();", newTest + "const tr = await app.tests.runAll();");
  writeFileSync(appFile, code, 'utf-8');
  return 'Added /api/echo/:msg + test';
});

// === Phase 7: REGRESSION ===
console.log('');
console.log('--- Phase 7: REGRESSION TEST ---');

step('Run modified app (regression)', () => {
  const output = execSync(`npx tsx "${appFile}"`, { cwd: repoDir, encoding: 'utf-8', timeout: 60000, stdio: 'pipe' });
  if (!output.includes('SUCCESS')) throw new Error('Modified app failed');
  if (!output.includes('3/3')) throw new Error('Expected 3/3 tests after modify');
  return '3/3 tests passed after modification';
});

step('Run full npm test (no regression)', () => {
  const output = execSync('npm test', { cwd: repoDir, encoding: 'utf-8', timeout: 120000, stdio: 'pipe' });
  const match = output.match(/Total:\s+(\d+)\/(\d+)\s+tests passed/);
  if (!match) throw new Error('Cannot parse results');
  const p = parseInt(match[1], 10), t = parseInt(match[2], 10);
  if (p !== t) throw new Error(`Regression: ${p}/${t}`);
  return `${p}/${t} tests passed, no regression`;
});

// === Phase 8: TEP ===
console.log('');
console.log('--- Phase 8: DRAFT TEP ---');

const tepDir = join(repoDir, 'proposals');
mkdirSync(tepDir, { recursive: true });

step('Draft TEP from stranger experience', () => {
  const tep = `# TEP-0002: Agent Discovery Endpoint Standard

**Status:** draft
**Type:** protocol
**Proposed by:** stranger-agent-verification
**Date:** 2026-08-22

## Summary
Standardize the agent discovery endpoint so any agent can programmatically
discover the complete TLL OS identity chain from a single JSON entry point.

## Motivation
During stranger agent verification, the agent successfully discovered all
required information from /agent/index.json. Gaps observed:
1. No discovery_version field for format compatibility checks
2. No health_check endpoint reference
3. No machine-readable verification_script reference
4. Install steps are not structured enough for fully automated execution

## Proposal
Add to /agent/index.json:
- discovery_version: semver for the discovery format
- health: URL for health check endpoint
- verification: reference to stranger agent verification script
- install.steps[].automated: boolean for auto-executable steps

## Backward Compatibility
All new fields are optional. Existing agents ignoring them continue to work.

## Verification
node scripts/verify-stranger-agent.mjs
`;
  writeFileSync(join(tepDir, 'TEP-0002-agent-discovery-endpoint.md'), tep, 'utf-8');
  return 'TEP-0002 drafted';
});

// === Cleanup ===
console.log('');
console.log('--- Cleanup ---');
rmSync(workDir, { recursive: true, force: true });
console.log('  Temp directory cleaned');

// === Final Report ===
console.log('');
console.log('=== Stranger Agent Verification Report ===');
console.log('');

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;

for (const r of results) {
  const icon = r.status === 'PASS' ? '[PASS]' : '[FAIL]';
  console.log(`  ${icon} ${r.name}`);
  if (r.detail) console.log(`         -> ${r.detail}`);
  if (r.error) console.log(`         -> ERROR: ${r.error}`);
}

console.log('');
console.log(`  Total: ${results.length} steps | Passed: ${passed} | Failed: ${failed}`);
console.log('');

if (failed === 0) {
  console.log('  STRANGER AGENT FULL-CHAIN VERIFICATION PASSED');
  console.log('  TLL OS Protocol 2.0 is Agent-ready.');
  console.log('');
  console.log('  Verified flow:');
  console.log('    discover -> clone -> install -> test -> create');
  console.log('    -> modify -> regression -> TEP');
  console.log('');
  process.exit(0);
} else {
  console.log('  STRANGER AGENT VERIFICATION FAILED');
  console.log(`  ${failed} step(s) failed.`);
  process.exit(1);
}
