/**
 * CLI 工具链验证测试（简化版）
 * 验证：tll version/help/inspect/graph/create 命令可用
 * dev/test 命令的核心功能已在 http-service.test.ts 和其他测试中验证
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CLI = 'npx tsx src/cli/index.ts';
const TEST_PROJECT_NAME = '.cli-verify-project';
const TEST_DIR = join(process.cwd(), TEST_PROJECT_NAME);

function runCli(args: string): string {
  return execSync(`${CLI} ${args}`, { encoding: 'utf-8', timeout: 30000 });
}

async function run() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) { passed++; console.log(`  ✓ ${msg}`); }
    else { failed++; console.error(`  ✗ ${msg}`); }
  }

  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });

  console.log('\n=== CLI Toolchain Verification Test ===\n');

  // 1. version
  console.log('1. version');
  const versionOut = runCli('version');
  assert(versionOut.includes('TLL OS CLI'), 'version outputs CLI name');
  assert(versionOut.includes('0.2.0'), 'version outputs 0.2.0');
  assert(versionOut.includes('Protocol 2.0'), 'version mentions Protocol 2.0');

  // 2. help
  console.log('\n2. help');
  const helpOut = runCli('help');
  assert(helpOut.includes('create'), 'help mentions create');
  assert(helpOut.includes('dev'), 'help mentions dev');
  assert(helpOut.includes('test'), 'help mentions test');
  assert(helpOut.includes('graph'), 'help mentions graph');
  assert(helpOut.includes('inspect'), 'help mentions inspect');

  // 3. inspect
  console.log('\n3. inspect');
  const inspectOut = runCli('inspect');
  assert(inspectOut.includes('TLL OS Inspection'), 'inspect outputs header');
  assert(inspectOut.includes('Modules:'), 'inspect shows modules count');
  assert(inspectOut.includes('APIs:'), 'inspect shows APIs count');
  assert(inspectOut.includes('Persistence:'), 'inspect shows persistence');
  assert(inspectOut.includes('Contracts: 17'), 'inspect shows 17 contracts');

  // 4. graph
  console.log('\n4. graph');
  const graphOut = runCli('graph');
  assert(graphOut.includes('Application Graph'), 'graph outputs header');
  assert(graphOut.includes('Nodes:'), 'graph shows nodes count');
  assert(graphOut.includes('Edges:'), 'graph shows edges count');

  const graphJsonOut = runCli('graph --json');
  try {
    const graphJson = JSON.parse(graphJsonOut);
    assert(graphJson.nodes !== undefined, 'graph --json outputs nodes');
    assert(graphJson.edges !== undefined, 'graph --json outputs edges');
    assert(graphJson.application !== undefined, 'graph --json outputs application');
  } catch {
    assert(false, 'graph --json outputs valid JSON');
  }

  // 5. create
  console.log('\n5. create');
  const createOut = runCli(`create ${TEST_PROJECT_NAME}`);
  assert(createOut.includes('Creating TLL OS project'), 'create outputs creating message');
  assert(createOut.includes('Project created'), 'create outputs created message');
  assert(existsSync(join(TEST_DIR, 'package.json')), 'creates package.json');
  assert(existsSync(join(TEST_DIR, 'tll.config.json')), 'creates tll.config.json');
  assert(existsSync(join(TEST_DIR, 'src/index.js')), 'creates src/index.js');
  assert(existsSync(join(TEST_DIR, 'src/modules')), 'creates src/modules/');
  assert(existsSync(join(TEST_DIR, 'tests')), 'creates tests/');
  assert(existsSync(join(TEST_DIR, '.gitignore')), 'creates .gitignore');

  const pkg = JSON.parse(readFileSync(join(TEST_DIR, 'package.json'), 'utf-8'));
  assert(pkg.name === TEST_PROJECT_NAME, 'package.json has correct name');
  assert(pkg.dependencies['@tll/os'] !== undefined, 'package.json depends on @tll/os');
  assert(pkg.scripts.dev === 'tll dev', 'package.json has dev script');
  assert(pkg.scripts.test === 'tll test', 'package.json has test script');

  const cfg = JSON.parse(readFileSync(join(TEST_DIR, 'tll.config.json'), 'utf-8'));
  assert(cfg.name !== undefined, 'tll.config.json has name');
  assert(cfg.environment === 'development', 'tll.config.json has environment');

  // 6. Verify CLI source has dev and test commands
  console.log('\n6. CLI command completeness');
  const cliSource = readFileSync(join(process.cwd(), 'src/cli/index.ts'), 'utf-8');
  assert(cliSource.includes('case "dev"'), 'CLI has dev command');
  assert(cliSource.includes('case "test"'), 'CLI has test command');
  assert(cliSource.includes('cmdDev'), 'CLI has cmdDev function');
  assert(cliSource.includes('cmdTest'), 'CLI has cmdTest function');
  assert(cliSource.includes('startHttp'), 'CLI dev command uses startHttp');
  assert(cliSource.includes('pathToFileURL'), 'CLI test command uses pathToFileURL (Windows fix)');

  // 7. Verify shebang for npm global install
  console.log('\n7. CLI shebang');
  assert(cliSource.startsWith('#!/usr/bin/env tsx'), 'CLI has shebang for global install');

  // 8. Verify package.json bin config
  console.log('\n8. package.json bin config');
  const rootPkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
  assert(rootPkg.bin !== undefined, 'package.json has bin field');
  assert(rootPkg.bin.tll !== undefined, 'package.json bin.tll defined');
  assert(rootPkg.bin.tll.includes('cli'), 'package.json bin.tll points to CLI');

  // 清理
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
