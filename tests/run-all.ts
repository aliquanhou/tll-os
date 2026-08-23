/**
 * TLL OS — Unified Test Runner
 * Runs all unit/integration tests and verified examples, aggregates results.
 * This is what `npm test` executes.
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

interface TestResult {
  name: string;
  path: string;
  category: 'unit' | 'integration' | 'example';
  passed: number;
  total: number;
  failed: number;
  output: string;
  success: boolean;
  duration: number;
}

function runTest(name: string, relativePath: string, category: TestResult['category']): TestResult {
  const start = Date.now();
  let output = '';
  let exitCode = 0;
  try {
    output = execSync(`npx tsx ${relativePath}`, {
      cwd: root,
      encoding: 'utf-8',
      timeout: 120000,
      stdio: 'pipe',
    });
  } catch (e: any) {
    output = (e.stdout || '') + (e.stderr || '');
    exitCode = e.status || 1;
  }
  const duration = Date.now() - start;

  // Extract test counts from output — take the LAST occurrence
  // Format 1: "N/M passed" or "N/M 通过"
  const allMatches = [...output.matchAll(/(\d+)\/(\d+)\s*(?:通过|passed)/gi)];
  const passMatch = allMatches.length > 0 ? allMatches[allMatches.length - 1] : null;

  // Format 2: "N passed, M failed" (from unit tests)
  const allPassedMatches = [...output.matchAll(/(\d+)\s*passed,\s*(\d+)\s*failed/gi)];
  const passedMatch = allPassedMatches.length > 0 ? allPassedMatches[allPassedMatches.length - 1] : null;

  let passed = 0;
  let total = 0;

  if (passMatch) {
    passed = parseInt(passMatch[1], 10);
    total = parseInt(passMatch[2], 10);
  } else if (passedMatch) {
    passed = parseInt(passedMatch[1], 10);
    const failedCount = parseInt(passedMatch[2], 10);
    total = passed + failedCount;
  }

  const failed = total - passed;
  const success = exitCode === 0 && passed === total && total > 0;

  return { name, path: relativePath, category, passed, total, failed, output, success, duration };
}

console.log('');
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║           TLL OS — Test Suite Runner                 ║');
console.log('║      Protocol 2.0 · Runtime 0.2 · Foundation        ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log('');

// Auto-discover unit/integration tests in tests/ directory
const testFiles = readdirSync(__dirname)
  .filter(f => f.endsWith('.test.ts'))
  .map(f => ({ name: f.replace('.test.ts', ''), path: `tests/${f}`, category: 'unit' as const }));

// Example tests (in examples/ directory)
const exampleTests = [
  { name: 'hello-tll-agent', path: 'examples/hello-tll-agent/agent.ts', category: 'example' as const },
  { name: 'autonomous-task-manager', path: 'examples/autonomous-task-manager/agent.ts', category: 'example' as const },
  { name: 'stranger-agent-inventory', path: 'examples/stranger-agent-inventory/agent.ts', category: 'example' as const },
];

const allTests = [...testFiles, ...exampleTests];
const results: TestResult[] = [];

for (const test of allTests) {
  const categoryLabel = test.category === 'example' ? 'EXAMPLE' : test.category.toUpperCase();
  console.log(`▶ [${categoryLabel}] ${test.name}`);
  const result = runTest(test.name, test.path, test.category);
  results.push(result);

  const status = result.success ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${status} — ${result.passed}/${result.total} tests (${result.duration}ms)`);
  if (!result.success) {
    console.log('  --- Output (last 20 lines) ---');
    console.log(result.output.split('\n').slice(-20).map(l => '  ' + l).join('\n'));
  }
  console.log('');
}

// Summary
const totalPassed = results.reduce((s, r) => s + r.passed, 0);
const totalTests = results.reduce((s, r) => s + r.total, 0);
const totalFailed = results.reduce((s, r) => s + r.failed, 0);
const allPassed = results.every(r => r.success);
const unitResults = results.filter(r => r.category !== 'example');
const exampleResults = results.filter(r => r.category === 'example');

console.log('══════════════════════════════════════════════════════');
console.log('  TLL OS Test Summary');
console.log('══════════════════════════════════════════════════════');
console.log(`  Unit/Integration Tests (${unitResults.length} suites):`);
for (const r of unitResults) {
  const icon = r.success ? '✓' : '✗';
  console.log(`    ${icon} ${r.name}: ${r.passed}/${r.total} tests`);
}
console.log(`  Example Tests (${exampleResults.length} suites):`);
for (const r of exampleResults) {
  const icon = r.success ? '✓' : '✗';
  console.log(`    ${icon} ${r.name}: ${r.passed}/${r.total} tests`);
}
console.log('──────────────────────────────────────────────────────');
console.log(`  Total: ${totalPassed}/${totalTests} tests passed, ${totalFailed} failed`);
console.log(`  Suites: ${results.length} total, ${results.filter(r => r.success).length} passing`);
console.log('══════════════════════════════════════════════════════');
console.log('');

if (allPassed) {
  console.log('✅ All tests passed! TLL OS Foundation 0.2 is verified.');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. See output above.');
  process.exit(1);
}
