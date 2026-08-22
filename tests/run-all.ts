/**
 * TLL OS — Unified Test Runner
 * Runs all verified examples and aggregates results.
 * This is what `npm test` executes.
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

interface ExampleResult {
  name: string;
  path: string;
  passed: number;
  total: number;
  failed: number;
  output: string;
  success: boolean;
}

function runExample(name: string, relativePath: string): ExampleResult {
  let output = '';
  let exitCode = 0;
  try {
    output = execSync(`npx tsx ${relativePath}`, {
      cwd: root,
      encoding: 'utf-8',
      timeout: 60000,
      stdio: 'pipe',
    });
  } catch (e: any) {
    output = (e.stdout || '') + (e.stderr || '');
    exitCode = e.status || 1;
  }

  // Extract test counts from output — take the LAST occurrence
  // (examples may have intentional fail-then-fix loops)
  const allMatches = [...output.matchAll(/(\d+)\/(\d+)\s*(?:通过|passed)/gi)];
  const passMatch = allMatches.length > 0 ? allMatches[allMatches.length - 1] : null;
  const allFailMatches = [...output.matchAll(/(\d+)\s*(?:失败|failed)/gi)];
  const failMatch = allFailMatches.length > 0 ? allFailMatches[allFailMatches.length - 1] : null;

  const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
  const total = passMatch ? parseInt(passMatch[2], 10) : 0;
  const failed = failMatch ? parseInt(failMatch[1], 10) : total - passed;
  const success = exitCode === 0 && passed === total && total > 0;

  return { name, path: relativePath, passed, total, failed, output, success };
}

console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║         TLL OS — Test Suite Runner               ║');
console.log('║    Protocol 2.0 · Runtime 0.1                    ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log('');

const examples = [
  { name: 'hello-tll-agent', path: 'examples/hello-tll-agent/agent.ts' },
  { name: 'autonomous-task-manager', path: 'examples/autonomous-task-manager/agent.ts' },
  { name: 'stranger-agent-inventory', path: 'examples/stranger-agent-inventory/agent.ts' },
];

const results: ExampleResult[] = [];

for (const ex of examples) {
  console.log(`▶ Running: ${ex.name}`);
  const result = runExample(ex.name, ex.path);
  results.push(result);

  const status = result.success ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${status} — ${result.passed}/${result.total} tests passed`);
  if (!result.success) {
    console.log('  --- Output ---');
    console.log(result.output.split('\n').map(l => '  ' + l).join('\n'));
  }
  console.log('');
}

// Summary
const totalPassed = results.reduce((s, r) => s + r.passed, 0);
const totalTests = results.reduce((s, r) => s + r.total, 0);
const totalFailed = results.reduce((s, r) => s + r.failed, 0);
const allPassed = results.every(r => r.success);

console.log('══════════════════════════════════════════════════');
console.log('  TLL OS Test Summary');
console.log('══════════════════════════════════════════════════');
for (const r of results) {
  const icon = r.success ? '✓' : '✗';
  console.log(`  ${icon} ${r.name}: ${r.passed}/${r.total} tests`);
}
console.log('──────────────────────────────────────────────────');
console.log(`  Total: ${totalPassed}/${totalTests} tests passed, ${totalFailed} failed`);
console.log('══════════════════════════════════════════════════');
console.log('');

if (allPassed) {
  console.log('✅ All tests passed! TLL OS is ready.');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. See output above.');
  process.exit(1);
}
