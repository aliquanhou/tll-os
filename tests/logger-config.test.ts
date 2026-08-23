/**
 * TLL OS Logger & Configuration Tests
 */
import { Logger, createLogger } from '../src/core/logger.js';
import { ConfigurationManager, getConfig, resetConfig } from '../src/core/config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

async function run() {
  console.log('\n=== Logger & Configuration Tests ===\n');

  // ============================================================
  // 1. Logger Tests
  // ============================================================
  console.log('1. Logger');

  // Capture stdout/stderr
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);
  let stdoutOutput = '';
  let stderrOutput = '';

  process.stdout.write = (chunk: string) => { stdoutOutput += chunk; return true; };
  process.stderr.write = (chunk: string) => { stderrOutput += chunk; return true; };

  try {
    // Basic logging
    const log = new Logger({ level: 'debug', format: 'text' }, 'test-module');
    stdoutOutput = '';
    log.info('test message');
    assert(stdoutOutput.includes('test message'), 'Logger outputs info message');
    assert(stdoutOutput.includes('[INFO]'), 'Logger includes level tag');
    assert(stdoutOutput.includes('[test-module]'), 'Logger includes module name');

    // Debug level
    stdoutOutput = '';
    log.debug('debug message');
    assert(stdoutOutput.includes('debug message'), 'Logger outputs debug at debug level');

    // Level filtering
    const warnLog = new Logger({ level: 'warn', format: 'text' });
    stdoutOutput = '';
    warnLog.info('should not appear');
    assert(!stdoutOutput.includes('should not appear'), 'Logger filters below-level messages');
    stdoutOutput = '';
    warnLog.warn('should appear');
    assert(stdoutOutput.includes('should appear'), 'Logger outputs at-level messages');

    // Error goes to stderr
    stderrOutput = '';
    log.error('error message');
    assert(stderrOutput.includes('error message'), 'Error logs go to stderr');
    assert(stderrOutput.includes('[ERROR]'), 'Error includes ERROR level tag');

    // Fatal goes to stderr
    stderrOutput = '';
    log.fatal('fatal message');
    assert(stderrOutput.includes('fatal message'), 'Fatal logs go to stderr');

    // JSON format
    const jsonLog = new Logger({ level: 'debug', format: 'json' });
    stdoutOutput = '';
    jsonLog.info('json test');
    try {
      const parsed = JSON.parse(stdoutOutput.trim());
      assert(parsed.level === 'info', 'JSON log has level field');
      assert(parsed.message === 'json test', 'JSON log has message field');
      assert(parsed.timestamp !== undefined, 'JSON log has timestamp');
    } catch {
      assert(false, 'JSON log output is valid JSON');
    }

    // Request ID
    const reqLog = new Logger({ level: 'info', format: 'text' }).withRequestId('req-123');
    stdoutOutput = '';
    reqLog.info('with request id');
    assert(stdoutOutput.includes('req-123'), 'Logger includes request ID');

    // Child logger
    const parent = new Logger({ level: 'info', format: 'text' }, 'parent');
    const child = parent.child('child');
    stdoutOutput = '';
    child.info('child message');
    assert(stdoutOutput.includes('[child]'), 'Child logger has its own module name');

    // Context
    stdoutOutput = '';
    log.info('with context', { userId: 123, action: 'login' });
    assert(stdoutOutput.includes('userId'), 'Logger includes context data');

    // Error with Error object
    stderrOutput = '';
    log.error('something failed', new Error('test error'));
    assert(stderrOutput.includes('test error'), 'Logger includes error message');
    assert(stderrOutput.includes('Error'), 'Logger includes error name');

    // isLevelEnabled
    assert(log.isLevelEnabled('info') === true, 'isLevelEnabled returns true for current level');
    assert(warnLog.isLevelEnabled('info') === false, 'isLevelEnabled returns false for below level');

    // setLevel
    const dynamicLog = new Logger({ level: 'info', format: 'text' });
    assert(dynamicLog.getLevel() === 'info', 'getLevel returns current level');
    dynamicLog.setLevel('debug');
    assert(dynamicLog.getLevel() === 'debug', 'setLevel changes level');

    // createLogger helper
    const helperLog = createLogger('helper-module');
    assert(helperLog !== undefined, 'createLogger returns a logger instance');

  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }

  // ============================================================
  // 2. Configuration Tests
  // ============================================================
  console.log('\n2. Configuration');

  // Default config
  resetConfig();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tll-config-test-'));
  const config = new ConfigurationManager(tempDir);
  const cfg = config.getConfig();

  assert(cfg.environment === 'development', 'Default environment is development');
  assert(cfg.appName === 'tll-os-app', 'Default app name is tll-os-app');
  assert(cfg.server.port === 3000, 'Default server port is 3000');
  assert(cfg.server.host === '0.0.0.0', 'Default server host is 0.0.0.0');
  assert(cfg.database.driver === 'memory', 'Default database driver is memory');
  assert(cfg.security.requireAuth === false, 'Default requireAuth is false');
  assert(cfg.logging.level === 'info', 'Default log level is info');
  assert(cfg.debug === true, 'Default debug is true');

  // get method
  assert(config.get('appName') === 'tll-os-app', 'get() returns config section');
  assert(config.get('server').port === 3000, 'get() returns nested config');

  // getPath
  assert(config.getPath('server.port') === 3000, 'getPath() returns nested value');
  assert(config.getPath('nonexistent.path', 'default') === 'default', 'getPath() returns default for missing path');

  // Environment
  assert(config.getEnvironment() === 'development', 'getEnvironment returns current env');
  assert(config.isEnvironment('development') === true, 'isEnvironment returns true for matching env');
  assert(config.isEnvironment('production') === false, 'isEnvironment returns false for non-matching env');

  // Feature flags
  assert(config.isFeatureEnabled('test-feature') === false, 'Feature flag defaults to false');
  config.setFeature('test-feature', true);
  assert(config.isFeatureEnabled('test-feature') === true, 'setFeature enables feature flag');

  // Custom config
  config.setCustom('custom-key', 'custom-value');
  assert(config.getCustom('custom-key') === 'custom-value', 'setCustom/getCustom works');
  assert(config.getCustom('nonexistent', 'fallback') === 'fallback', 'getCustom returns default');

  // Config file loading
  const configFile = path.join(tempDir, 'tll.config.json');
  fs.writeFileSync(configFile, JSON.stringify({
    appName: 'test-app',
    server: { port: 8080 },
    features: { newFeature: true },
  }));
  const fileConfig = new ConfigurationManager(tempDir);
  assert(fileConfig.get('appName') === 'test-app', 'Config loads from tll.config.json');
  assert(fileConfig.get('server').port === 8080, 'Config merges nested values from file');
  assert(fileConfig.isFeatureEnabled('newFeature') === true, 'Config loads feature flags from file');

  // Environment variable overrides
  process.env.TLL_APP_NAME = 'env-app';
  process.env.TLL_SERVER_PORT = '9090';
  process.env.TLL_DEBUG = 'false';
  const envConfig = new ConfigurationManager(tempDir);
  assert(envConfig.get('appName') === 'env-app', 'Env var TLL_APP_NAME overrides config');
  assert(envConfig.get('server').port === 9090, 'Env var TLL_SERVER_PORT overrides config');
  assert(envConfig.get('debug') === false, 'Env var TLL_DEBUG=false sets debug to false');

  // Cleanup env vars
  delete process.env.TLL_APP_NAME;
  delete process.env.TLL_SERVER_PORT;
  delete process.env.TLL_DEBUG;

  // toSafeJSON (redacts secrets)
  const secretConfig = new ConfigurationManager(tempDir);
  secretConfig.getConfig().security.jwtSecret = 'super-secret-jwt';
  secretConfig.getConfig().database.password = 'db-password';
  const safeJSON = secretConfig.toSafeJSON();
  assert(safeJSON.includes('REDACTED'), 'toSafeJSON redacts secrets');
  assert(!safeJSON.includes('super-secret-jwt'), 'toSafeJSON does not include JWT secret');
  assert(!safeJSON.includes('db-password'), 'toSafeJSON does not include DB password');

  // reload
  const reloadConfig = new ConfigurationManager(tempDir);
  const originalPort = reloadConfig.get('server').port;
  fs.writeFileSync(configFile, JSON.stringify({ server: { port: 7777 } }));
  reloadConfig.reload();
  assert(reloadConfig.get('server').port === 7777, 'reload() reloads config from file');

  // getConfig returns a copy (not reference)
  const cfgCopy = config.getConfig();
  cfgCopy.appName = 'modified';
  assert(config.get('appName') !== 'modified', 'getConfig returns a defensive copy');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
