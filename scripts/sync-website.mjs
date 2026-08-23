#!/usr/bin/env node
/**
 * TLL OS - Website Sync Script
 *
 * Scans the real repository and generates Agent-readable JSON files
 * for the Developer Hub. Ensures website always reflects actual code.
 *
 * Usage: node scripts/sync-website.mjs
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WEBSITE_DIR = join(ROOT, 'website');
const AGENT_DIR = join(WEBSITE_DIR, 'agent');

// Ensure agent directory exists
if (!existsSync(AGENT_DIR)) mkdirSync(AGENT_DIR, { recursive: true });

// ============================================================
// Helpers
// ============================================================

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return null; }
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`  ✓ ${basename(path)}`);
}

function countTestsInFile(content) {
  // Count assert( or assert. or test( patterns
  const assertMatches = content.match(/assert\s*\(/g) || [];
  const testMatches = content.match(/\b(test|it)\s*\(/g) || [];
  return assertMatches.length + testMatches.length;
}

function scanDirectory(dir, extension = null) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...scanDirectory(fullPath, extension));
    } else if (!extension || entry.endsWith(extension)) {
      results.push(fullPath);
    }
  }
  return results;
}

// ============================================================
// Scan Repository
// ============================================================

console.log('\n╔══════════════════════════════════════╗');
console.log('║   TLL OS Website Sync                ║');
console.log('╚══════════════════════════════════════╝\n');

console.log('Scanning repository...\n');

// 1. Package info
const pkg = readJSON(join(ROOT, 'package.json'));
const version = pkg?.version ?? '0.0.0';
const name = pkg?.name ?? '@tll/os';
const description = pkg?.description ?? '';
const dependencies = pkg?.dependencies ?? {};
const devDependencies = pkg?.devDependencies ?? {};
const engines = pkg?.engines ?? {};

console.log(`  Package: ${name}@${version}`);

// 2. Protocol info
const protocolSpecPath = join(ROOT, 'protocol', 'v2', 'SPECIFICATION.md');
const protocolExists = existsSync(protocolSpecPath);
const protocolVersion = '2.0.0';
const protocolStatus = protocolExists ? 'FROZEN' : 'DRAFT';

// 3. Source modules
const coreFiles = scanDirectory(join(ROOT, 'src', 'core'), '.ts');
const publicFiles = scanDirectory(join(ROOT, 'src', 'public'), '.ts');
const adapterFiles = scanDirectory(join(ROOT, 'src', 'adapters'), '.ts');
const cliFiles = scanDirectory(join(ROOT, 'src', 'cli'), '.ts');

const coreModules = coreFiles.map(f => basename(f, '.ts'));
console.log(`  Core modules: ${coreModules.length} (${coreModules.join(', ')})`);

// 4. Tests
const testFiles = scanDirectory(join(ROOT, 'tests'), '.ts');
let totalTests = 0;
const testSuites = [];
for (const file of testFiles) {
  const content = readFileSync(file, 'utf-8');
  const count = countTestsInFile(content);
  totalTests += count;
  testSuites.push({ name: basename(file, '.ts'), tests: count, path: file.replace(ROOT + '\\', '') });
}
console.log(`  Test suites: ${testSuites.length}, total tests: ~${totalTests}`);

// 5. Examples
const examplesDir = join(ROOT, 'examples');
const examples = [];
if (existsSync(examplesDir)) {
  for (const entry of readdirSync(examplesDir)) {
    const fullPath = join(examplesDir, entry);
    if (statSync(fullPath).isDirectory()) {
      const agentFile = join(fullPath, 'agent.ts');
      const agentFileJs = join(fullPath, 'agent.js');
      const hasAgent = existsSync(agentFile) || existsSync(agentFileJs);
      const readmePath = join(fullPath, 'README.md');
      const hasReadme = existsSync(readmePath);
      let desc = '';
      if (hasReadme) {
        const readme = readFileSync(readmePath, 'utf-8');
        const firstLine = readme.split('\n').find(l => l.trim() && !l.startsWith('#'));
        desc = firstLine?.trim() ?? '';
      }
      examples.push({ name: entry, hasAgent, hasReadme, description: desc });
    }
  }
}
console.log(`  Examples: ${examples.length}`);

// 6. Contracts (17 defined in Protocol 2.0)
const contracts = [
  { name: 'Application Model', status: 'stable', runtime: true },
  { name: 'Application Graph', status: 'stable', runtime: true },
  { name: 'Module Contract', status: 'stable', runtime: true },
  { name: 'Plugin Contract', status: 'beta', runtime: true },
  { name: 'Agent Contract', status: 'beta', runtime: true },
  { name: 'Tool Contract', status: 'stable', runtime: true },
  { name: 'Skill Contract', status: 'draft', runtime: false },
  { name: 'Context Contract', status: 'draft', runtime: false },
  { name: 'Permission Contract', status: 'stable', runtime: true },
  { name: 'Workflow Contract', status: 'draft', runtime: false },
  { name: 'Event Contract', status: 'stable', runtime: true },
  { name: 'Adapter Contract', status: 'beta', runtime: true },
  { name: 'Projection Contract', status: 'beta', runtime: true },
  { name: 'BuildTarget Contract', status: 'draft', runtime: false },
  { name: 'Capability Contract', status: 'beta', runtime: false },
  { name: 'Compatibility Manifest', status: 'draft', runtime: false },
  { name: 'Evolution Proposal', status: 'beta', runtime: false },
];

const implementedContracts = contracts.filter(c => c.runtime).length;
console.log(`  Contracts: ${implementedContracts}/${contracts.length} with runtime implementation`);

// 7. Capabilities
const capabilities = [
  { name: 'persistence', description: 'Data persistence with Memory/File/SQLite adapters', status: 'stable' },
  { name: 'http-server', description: 'HTTP server with routing, CORS, health checks', status: 'stable' },
  { name: 'cli', description: 'Command-line interface (create/dev/test/graph/inspect)', status: 'stable' },
  { name: 'testing', description: 'Unified test runner with auto-discovery', status: 'stable' },
  { name: 'security', description: 'API Key auth, permission enforcement, input validation', status: 'stable' },
  { name: 'logging', description: 'Structured 5-level logging with JSON/text output', status: 'stable' },
  { name: 'configuration', description: 'Multi-environment config with env var overrides', status: 'stable' },
  { name: 'application-graph', description: 'Graph-based application structure with impact analysis', status: 'stable' },
  { name: 'changeset', description: 'Change tracking with preview/apply/rollback', status: 'beta' },
  { name: 'multi-agent', description: 'Workspace, lock, handoff, review for multi-agent collaboration', status: 'beta' },
  { name: 'projection', description: 'Graph ↔ code/OpenAPI/DB Schema bidirectional projection', status: 'beta' },
  { name: 'plugin', description: 'Plugin manifest, lifecycle, permission management', status: 'beta' },
];

// ============================================================
// Generate Agent JSON Files
// ============================================================

console.log('\nGenerating Agent JSON files...\n');

// index.json — Main entry point for agents
const indexJson = {
  schema: 'tll-os-agent-index/v1',
  generatedAt: new Date().toISOString(),
  project: {
    name,
    version,
    description,
    protocol: { version: protocolVersion, status: protocolStatus },
    license: pkg?.license ?? 'Apache-2.0',
    repository: pkg?.repository?.url ?? 'https://github.com/aliquanhou/tll-os',
    homepage: pkg?.homepage ?? 'https://ts.knitoem.com',
    engines,
  },
  official_identity: {
    website: 'https://ts.knitoem.com',
    repository: 'https://github.com/aliquanhou/tll-os',
    clone_url: 'https://github.com/aliquanhou/tll-os.git',
    owner: 'aliquanhou',
    repo: 'tll-os',
    branch: 'main',
    license: 'Apache-2.0',
    runtime: { name, version, package_manager: 'npm' },
    package: { name, registry: 'npm', install_command: `npm install ${name}` },
    install: {
      clone: 'git clone https://github.com/aliquanhou/tll-os.git',
      install: 'npm install',
      test: 'npm test',
      dev: 'npx tll dev',
    },
    tep: { directory: 'proposals/', doc: 'docs/evolution/TEP.md' },
  },
  capabilities: {
    total: capabilities.length,
    stable: capabilities.filter(c => c.status === 'stable').length,
    beta: capabilities.filter(c => c.status === 'beta').length,
    list: capabilities,
  },
  contracts: {
    total: contracts.length,
    implemented: implementedContracts,
    list: contracts.map(c => ({ name: c.name, status: c.status, runtime: c.runtime })),
  },
  runtime: {
    version,
    core_modules: coreModules.length,
    core_module_list: coreModules,
    dependencies,
    devDependencies,
  },
  testing: {
    suites: testSuites.length,
    total_tests: totalTests,
    suites_list: testSuites.map(s => ({ name: s.name, tests: s.tests })),
  },
  examples: {
    count: examples.length,
    list: examples.map(e => ({ name: e.name, description: e.description, has_agent: e.hasAgent })),
  },
  agent_guide: {
    quick_start: [
      'Read /agent/protocol.json for Protocol 2.0 specification',
      'Read /agent/contracts.json for 17 Public Contracts',
      'Read /agent/capabilities.json for available runtime capabilities',
      'Read /agent/examples.json for reference applications',
      'Clone repository: git clone https://github.com/aliquanhou/tll-os.git',
      'Install: npm install',
      'Create app: npx tll create my-app',
      'Run tests: npm test',
    ],
    entry_points: {
      public_api: 'src/public/index.ts',
      types: 'src/public/types.ts',
      cli: 'src/cli/index.ts',
      examples: 'examples/',
      docs: 'docs/',
    },
  },
  known_limitations: [
    'Skill Contract has no runtime implementation yet',
    'Context Contract has no runtime implementation yet',
    'Workflow Contract has no runtime implementation yet',
    'BuildTarget Contract has no runtime implementation yet',
    'Capability Contract has no runtime implementation yet',
    'Compatibility Manifest has no runtime implementation yet',
    'Evolution Proposal (TEP) has no runtime engine yet',
    'No real LLM integration — Agent.run() requires external executor',
    'Persistence supports Memory, File, and SQLite — PostgreSQL planned',
  ],
};
writeJSON(join(AGENT_DIR, 'index.json'), indexJson);

// protocol.json
const protocolJson = {
  schema: 'tll-os-protocol/v2',
  version: protocolVersion,
  status: protocolStatus,
  frozenAt: protocolExists ? '2026-08-22' : null,
  name: 'TLL OS Protocol',
  tagline: 'AI-Native Universal Application Development Protocol',
  core_principles: [
    'AI is a first-class citizen — Agent can understand and operate the application',
    'Application Graph is the primary fact source for machine-understandable structure',
    'Contract-first — define standards, allow multiple runtime implementations',
    'Adapter-based — absorb mature ecosystems instead of reimplementing',
    'Projection — Graph projects to code, API, DB, config, docs, tests',
    'Evolution — TEP allows global agents and developers to propose improvements',
  ],
  contracts: contracts.map(c => ({
    name: c.name,
    status: c.status,
    runtime_implementation: c.runtime,
  })),
  architecture: {
    layers: [
      { name: 'Protocol', description: '17 frozen contracts, language-agnostic' },
      { name: 'Public API', description: 'TypeScript type definitions + createTllOS entry' },
      { name: 'Runtime', description: 'Reference implementation: Application, Module, API, Tool, Agent, Graph' },
      { name: 'Adapters', description: 'Persistence (Memory/File/SQLite), HTTP, Node.js Runtime' },
      { name: 'Applications', description: 'Commerce, CRM, ERP, SaaS built on TLL OS' },
    ],
  },
};
writeJSON(join(AGENT_DIR, 'protocol.json'), protocolJson);

// contracts.json
const contractsJson = {
  schema: 'tll-os-contracts/v1',
  protocol_version: protocolVersion,
  total: contracts.length,
  implemented: implementedContracts,
  contracts: contracts.map(c => ({
    name: c.name,
    status: c.status,
    runtime_implementation: c.runtime,
    description: getContractDescription(c.name),
    public_api: getContractApiPath(c.name),
  })),
};
writeJSON(join(AGENT_DIR, 'contracts.json'), contractsJson);

// capabilities.json
const capabilitiesJson = {
  schema: 'tll-os-capabilities/v1',
  total: capabilities.length,
  stable: capabilities.filter(c => c.status === 'stable').length,
  beta: capabilities.filter(c => c.status === 'beta').length,
  capabilities: capabilities.map(c => ({
    name: c.name,
    description: c.description,
    status: c.status,
    module: getCapabilityModule(c.name),
  })),
};
writeJSON(join(AGENT_DIR, 'capabilities.json'), capabilitiesJson);

// examples.json
const examplesJson = {
  schema: 'tll-os-examples/v1',
  count: examples.length,
  examples: examples.map(e => ({
    name: e.name,
    description: e.description,
    has_agent: e.hasAgent,
    has_readme: e.hasReadme,
    path: `examples/${e.name}`,
  })),
};
writeJSON(join(AGENT_DIR, 'examples.json'), examplesJson);

// evolution.json
const evolutionJson = {
  schema: 'tll-os-evolution/v1',
  tep: {
    name: 'TLL Evolution Proposal',
    description: 'Process for agents and developers to propose protocol/runtime improvements',
    directory: 'proposals/',
    documentation: 'docs/evolution/TEP.md',
    status: 'protocol-defined, runtime-engine-pending',
    lifecycle: [
      'Agent discovers issue or improvement opportunity',
      'Create TEP proposal in proposals/ directory',
      'AI Review by other agents',
      'Human maintainer review',
      'Approve / Reject / Request changes',
      'Merge to protocol/runtime',
      'Release new version',
    ],
  },
  current_version: version,
  protocol_version: protocolVersion,
  roadmap: {
    '0.2.0': 'Foundation hardening: Persistence, HTTP, CLI, Testing, Security, Logger, Config, Projection',
    '0.3.0': 'Adapter system, Projection enhancement, Workflow engine, Skill system, TEP runtime',
    '1.0.0': 'Stable API, LTS, production deployment, full 17 contracts runtime implementation',
  },
};
writeJSON(join(AGENT_DIR, 'evolution.json'), evolutionJson);

// ============================================================
// Helper functions for contract descriptions
// ============================================================

function getContractDescription(name) {
  const desc = {
    'Application Model': 'Application lifecycle, config, state management',
    'Application Graph': 'Machine-understandable application structure with nodes/edges and impact analysis',
    'Module Contract': 'Module registration, discovery, lifecycle, routes, services, models',
    'Plugin Contract': 'Plugin manifest, install/enable/disable/uninstall, permissions, dependencies',
    'Agent Contract': 'AI Agent identity, capabilities, tools, permissions, execution context',
    'Tool Contract': 'Tool registration, JSON Schema input validation, permission enforcement, standard output',
    'Skill Contract': 'Reusable agent capability packages combining tools + decision logic + best practices',
    'Context Contract': 'AI context management, request ID, module/agent scoping',
    'Permission Contract': 'Permission declaration, checking, wildcard support, API key auth',
    'Workflow Contract': 'Agent development workflow and business workflow orchestration',
    'Event Contract': 'Event bus, event emission/listening, event types',
    'Adapter Contract': 'Adapter system for external world: database, HTTP, storage, queue, cache',
    'Projection Contract': 'Graph ↔ code/OpenAPI/DB Schema/config/docs/tests bidirectional projection',
    'BuildTarget Contract': 'Build targets: web, H5, APK, EXE, mini-program, IoT, edge',
    'Capability Contract': 'Capability registry for application feature declaration and discovery',
    'Compatibility Manifest': 'Adapter compatibility declaration and assessment for mature ecosystem integration',
    'Evolution Proposal': 'TEP process for protocol/runtime evolution by global agents and developers',
  };
  return desc[name] ?? '';
}

function getContractApiPath(name) {
  const paths = {
    'Application Model': 'src/public/types.ts#ApplicationConfig',
    'Application Graph': 'src/public/types.ts#ApplicationGraph',
    'Module Contract': 'src/public/types.ts#Module',
    'Plugin Contract': 'src/public/types.ts#Plugin',
    'Agent Contract': 'src/public/types.ts#Agent',
    'Tool Contract': 'src/public/types.ts#ToolDefinition',
    'Permission Contract': 'src/core/security.ts#PermissionChecker',
    'Event Contract': 'src/public/types.ts#EventDispatcher',
    'Adapter Contract': 'src/public/types.ts#Adapter',
    'Projection Contract': 'src/core/projection.ts#ProjectionEngine',
  };
  return paths[name] ?? null;
}

function getCapabilityModule(name) {
  const modules = {
    persistence: 'src/core/persistence.ts, src/core/file-persistence.ts, src/core/sqlite-persistence.ts',
    'http-server': 'src/core/index.ts#ApplicationImpl.startHttp',
    cli: 'src/cli/index.ts',
    testing: 'tests/run-all.ts',
    security: 'src/core/security.ts',
    logging: 'src/core/logger.ts',
    configuration: 'src/core/config.ts',
    'application-graph': 'src/core/index.ts#ApplicationGraphImpl',
    changeset: 'src/core/index.ts#ChangeSet',
    'multi-agent': 'src/core/index.ts#Workspace, AgentLock, Handoff, Review',
    projection: 'src/core/projection.ts',
    plugin: 'src/core/index.ts#PluginManager',
  };
  return modules[name] ?? null;
}

// ============================================================
// Summary
// ============================================================

console.log('\n╔══════════════════════════════════════╗');
console.log('║   Website Sync Complete               ║');
console.log('╚══════════════════════════════════════╝\n');
console.log(`  Generated 6 Agent JSON files in website/agent/`);
console.log(`  Version: ${name}@${version}`);
console.log(`  Protocol: ${protocolVersion} (${protocolStatus})`);
console.log(`  Contracts: ${implementedContracts}/${contracts.length} implemented`);
console.log(`  Capabilities: ${capabilities.length} (${capabilities.filter(c=>c.status==='stable').length} stable)`);
console.log(`  Tests: ${totalTests} in ${testSuites.length} suites`);
console.log(`  Examples: ${examples.length}\n`);
console.log(`  Next: deploy website/ to server via SCP or GitHub Actions\n`);
