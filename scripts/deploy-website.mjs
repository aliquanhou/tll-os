#!/usr/bin/env node
/**
 * TLL OS - Website Deploy Script
 *
 * Deploys the website/ directory to the production server via SCP.
 * Requires SSH key access to the server.
 *
 * Usage: node scripts/deploy-website.mjs [--server=user@host] [--path=/remote/path]
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WEBSITE_DIR = join(ROOT, 'website');

// Parse args
const args = process.argv.slice(2);
const serverArg = args.find(a => a.startsWith('--server='));
const pathArg = args.find(a => a.startsWith('--path='));

const SERVER = serverArg ? serverArg.split('=')[1] : 'root@1.117.221.61';
const REMOTE_PATH = pathArg ? pathArg.split('=')[1] : '/www/wwwroot/ts.knitoem.com';

console.log('\n╔══════════════════════════════════════╗');
console.log('║   TLL OS Website Deploy              ║');
console.log('╚══════════════════════════════════════╝\n');

console.log(`  Server: ${SERVER}`);
console.log(`  Remote path: ${REMOTE_PATH}`);
console.log(`  Local source: ${WEBSITE_DIR}\n`);

// Verify website directory exists
if (!existsSync(WEBSITE_DIR)) {
  console.error('  ✗ website/ directory not found!');
  console.error('  Run "node scripts/sync-website.mjs" first.');
  process.exit(1);
}

// Step 1: Run sync first
console.log('Step 1: Syncing website from repository...');
try {
  execSync('node scripts/sync-website.mjs', { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  console.error('  ✗ Sync failed:', e.message);
  process.exit(1);
}

// Step 2: Deploy via SCP (rsync if available, otherwise scp)
console.log('\nStep 2: Deploying to server...');

try {
  // Try rsync first (more efficient)
  execSync(`rsync -avz --delete ${WEBSITE_DIR}/ ${SERVER}:${REMOTE_PATH}/`, {
    cwd: ROOT,
    stdio: 'inherit',
    timeout: 120000,
  });
  console.log('\n  ✓ Deployed via rsync');
} catch (e) {
  // Fallback to scp
  console.log('  rsync not available, using scp...');
  try {
    execSync(`scp -r ${WEBSITE_DIR}/* ${SERVER}:${REMOTE_PATH}/`, {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: 120000,
    });
    console.log('\n  ✓ Deployed via scp');
  } catch (e2) {
    console.error('\n  ✗ Deploy failed:', e2.message);
    process.exit(1);
  }
}

// Step 3: Verify deployment
console.log('\nStep 3: Verifying deployment...');
try {
  const result = execSync(`ssh ${SERVER} "ls -la ${REMOTE_PATH}/agent/index.json && cat ${REMOTE_PATH}/agent/index.json | head -5"`, {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 30000,
  });
  console.log(result);
  console.log('  ✓ Deployment verified');
} catch (e) {
  console.warn('  ⚠ Verification failed (SSH may not be configured):', e.message);
}

console.log('\n╔══════════════════════════════════════╗');
console.log('║   Deploy Complete!                    ║');
console.log('╚══════════════════════════════════════╝\n');
console.log(`  Website: https://ts.knitoem.com`);
console.log(`  Agent entry: https://ts.knitoem.com/agent/index.json\n`);
