/**
 * TLL OS Security Module Tests
 * Tests: API Key Manager, Permission Checker, Security Middleware,
 * Input Validator, Error/Success Response Builders, Tool Permission Execution
 */
import { createTllOS } from '../src/core/index.js';
import {
  ApiKeyManager, PermissionChecker, SecurityMiddleware,
  InputValidator, ErrorResponseBuilder, SuccessResponseBuilder,
  generateRequestId,
} from '../src/core/security.js';
import { createMemoryPersistence } from '../src/core/persistence.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

async function run() {
  console.log('\n=== Security Module Tests ===\n');

  // 1. API Key Manager
  console.log('1. API Key Manager');
  const persistence = createMemoryPersistence();
  await persistence.connect();
  const keyManager = new ApiKeyManager(persistence);
  await keyManager.connect();

  const key1 = await keyManager.createKey({ name: 'test-key-1', permissions: ['read', 'write'] });
  assert(key1.key.startsWith('tll_'), 'API key starts with tll_ prefix');
  assert(key1.permissions.length === 2, 'API key has 2 permissions');
  assert(key1.status === 'active', 'API key status is active');

  const validateResult = await keyManager.validateKey(key1.key);
  assert(validateResult.authenticated === true, 'Valid API key authenticates');
  assert(validateResult.apiKey?.name === 'test-key-1', 'Authenticated key has correct name');

  const invalidResult = await keyManager.validateKey('tll_invalid_key_12345');
  assert(invalidResult.authenticated === false, 'Invalid API key fails authentication');
  assert(invalidResult.error === 'Invalid API key', 'Invalid key returns correct error');

  const revoked = await keyManager.revokeKey(key1.id);
  assert(revoked === true, 'API key revoked successfully');
  const afterRevoke = await keyManager.validateKey(key1.key);
  assert(afterRevoke.authenticated === false, 'Revoked key fails authentication');
  assert(afterRevoke.error?.includes('revoked'), 'Revoked key returns revoked error');

  const allKeys = keyManager.listKeys();
  assert(allKeys.length === 1, 'List keys returns 1 key');

  // 2. Permission Checker
  console.log('\n2. Permission Checker');
  const check1 = PermissionChecker.check(['read', 'write'], ['read']);
  assert(check1.allowed === true, 'Agent with read permission can access read resource');

  const check2 = PermissionChecker.check(['read'], ['write']);
  assert(check2.allowed === false, 'Agent without write permission denied');
  assert(check2.missing?.includes('write'), 'Missing permission listed');

  const check3 = PermissionChecker.check(['*'], ['read', 'write', 'admin']);
  assert(check3.allowed === true, 'Wildcard * grants all permissions');

  const check4 = PermissionChecker.check(['read'], []);
  assert(check4.allowed === true, 'No required permissions always allowed');

  assert(PermissionChecker.hasPermission(['read', 'write'], 'read') === true, 'hasPermission returns true for granted');
  assert(PermissionChecker.hasPermission(['read'], 'write') === false, 'hasPermission returns false for not granted');
  assert(PermissionChecker.hasPermission(['*'], 'anything') === true, 'hasPermission wildcard works');

  // 3. Security Middleware
  console.log('\n3. Security Middleware');
  const keyManager2 = new ApiKeyManager(createMemoryPersistence());
  await keyManager2.connect();
  const adminKey = await keyManager2.createKey({ name: 'admin', permissions: ['*'] });
  const readKey = await keyManager2.createKey({ name: 'reader', permissions: ['read'] });

  const middleware = new SecurityMiddleware(keyManager2, { requireAuth: true, apiKeyHeader: 'x-api-key' });

  const authResult1 = await middleware.authenticate({
    headers: { 'x-api-key': adminKey.key }, method: 'GET', path: '/api/test',
    apiKeyManager: keyManager2, config: {},
  });
  assert(authResult1.authenticated === true, 'Middleware authenticates valid API key');
  assert(authResult1.apiKey?.name === 'admin', 'Middleware returns correct key');

  const authResult2 = await middleware.authenticate({
    headers: {}, method: 'GET', path: '/api/test',
    apiKeyManager: keyManager2, config: {},
  });
  assert(authResult2.authenticated === false, 'Middleware rejects request without API key when requireAuth=true');
  assert(authResult2.statusCode === 401, 'Middleware returns 401 for missing key');

  const permCheck1 = middleware.checkPermissions(authResult1.apiKey, ['read', 'write']);
  assert(permCheck1.allowed === true, 'Admin key (*) passes permission check');

  const authResult3 = await middleware.authenticate({
    headers: { 'x-api-key': readKey.key }, method: 'GET', path: '/api/test',
    apiKeyManager: keyManager2, config: {},
  });
  const permCheck2 = middleware.checkPermissions(authResult3.apiKey, ['write']);
  assert(permCheck2.allowed === false, 'Read key denied write permission');
  assert(permCheck2.missing?.includes('write'), 'Missing write permission listed');

  // 4. Input Validator
  console.log('\n4. Input Validator');
  const body1 = { name: 'test', email: 'test@example.com', age: 25 };
  const reqResult = InputValidator.requireFields(body1, ['name', 'email']);
  assert(reqResult.valid === true, 'Required fields present passes validation');

  const reqResult2 = InputValidator.requireFields(body1, ['name', 'password']);
  assert(reqResult2.valid === false, 'Missing required field fails validation');
  assert(reqResult2.errors.some(e => e.field === 'password'), 'Missing field listed in errors');

  const typeResult = InputValidator.validateTypes(body1, { name: 'string', age: 'number' });
  assert(typeResult.valid === true, 'Correct types pass validation');

  const typeResult2 = InputValidator.validateTypes(body1, { name: 'number' });
  assert(typeResult2.valid === false, 'Wrong type fails validation');
  assert(typeResult2.errors[0].field === 'name', 'Wrong type field listed');

  const lenResult = InputValidator.validateLength('hello', 'name', 3, 10);
  assert(lenResult.valid === true, 'String within length range passes');

  const lenResult2 = InputValidator.validateLength('ab', 'name', 3);
  assert(lenResult2.valid === false, 'String too short fails');

  // 5. Error Response Builder
  console.log('\n5. Error Response Builder');
  const reqId = generateRequestId();
  assert(reqId.startsWith('req_'), 'Request ID starts with req_');

  const errResp = ErrorResponseBuilder.build('test_error', 'Test message', reqId);
  assert(errResp.ok === false, 'Error response ok=false');
  assert(errResp.error.code === 'test_error', 'Error response has correct code');
  assert(errResp.error.message === 'Test message', 'Error response has correct message');
  assert(errResp.error.requestId === reqId, 'Error response has requestId');

  const valErr = ErrorResponseBuilder.validationError([{ field: 'name', message: 'required' }], reqId);
  assert(valErr.error.code === 'validation_error', 'Validation error has correct code');
  assert((valErr.error.details as any).fields.length === 1, 'Validation error includes field details');

  const notFoundErr = ErrorResponseBuilder.notFound('User', reqId);
  assert(notFoundErr.error.code === 'not_found', 'Not found error has correct code');
  assert(notFoundErr.error.message.includes('User'), 'Not found message includes resource name');

  const forbiddenErr = ErrorResponseBuilder.forbidden(reqId, ['admin']);
  assert(forbiddenErr.error.code === 'forbidden', 'Forbidden error has correct code');
  assert((forbiddenErr.error.details as any).missingPermissions.includes('admin'), 'Forbidden includes missing permissions');

  // 6. Success Response Builder
  console.log('\n6. Success Response Builder');
  const succResp = SuccessResponseBuilder.build({ id: 1, name: 'test' }, reqId);
  assert(succResp.ok === true, 'Success response ok=true');
  assert((succResp.data as any).id === 1, 'Success response has correct data');
  assert(succResp.requestId === reqId, 'Success response has requestId');

  const pagResp = SuccessResponseBuilder.paginated([1, 2, 3], 100, 1, 10, reqId);
  assert((pagResp.data as any).items.length === 3, 'Paginated response has items');
  assert((pagResp.data as any).total === 100, 'Paginated response has total');
  assert((pagResp.data as any).totalPages === 10, 'Paginated response has totalPages');

  // 7. Tool Permission Execution (integration test)
  console.log('\n7. Tool Permission Execution (integration)');
  const tll = createTllOS();
  const app = tll.createApplication({ name: 'security-test', version: '1.0.0' });

  const restrictedTool = app.tools.create({
    name: 'admin_action',
    description: 'Requires admin permission',
    parameters: { type: 'object', properties: {} },
    permissions: ['admin'],
    handler: async () => ({ success: true, data: { result: 'done' } }),
  });

  // Call without permissions
  const resultNoPerm = await restrictedTool.invoke({}, { applicationName: 'test', requestId: reqId, permissions: ['read'] });
  assert(resultNoPerm.success === false, 'Tool call without required permission fails');
  assert(resultNoPerm.error?.code === 'TOOL_PERMISSION_DENIED', 'Permission denied error code correct');
  assert(resultNoPerm.error?.missingPermissions?.includes('admin'), 'Missing permission listed');

  // Call with wildcard permission
  const resultWildcard = await restrictedTool.invoke({}, { applicationName: 'test', requestId: reqId, permissions: ['*'] });
  assert(resultWildcard.success === true, 'Tool call with wildcard permission succeeds');

  // Call with exact permission
  const resultExact = await restrictedTool.invoke({}, { applicationName: 'test', requestId: reqId, permissions: ['admin'] });
  assert(resultExact.success === true, 'Tool call with exact permission succeeds');

  // Tool with no permissions required
  const openTool = app.tools.create({
    name: 'public_action',
    description: 'No permission required',
    parameters: { type: 'object', properties: {} },
    permissions: [],
    handler: async () => ({ success: true, data: { result: 'public' } }),
  });
  const resultOpen = await openTool.invoke({}, { applicationName: 'test', requestId: reqId });
  assert(resultOpen.success === true, 'Tool with no permissions always succeeds');

  // 8. API Key Expiration
  console.log('\n8. API Key Expiration');
  const keyManager3 = new ApiKeyManager(createMemoryPersistence());
  await keyManager3.connect();
  const expiringKey = await keyManager3.createKey({ name: 'short-lived', permissions: ['read'], expiresIn: 100 });
  const validNow = await keyManager3.validateKey(expiringKey.key);
  assert(validNow.authenticated === true, 'Key valid before expiration');

  await new Promise(resolve => setTimeout(resolve, 150));
  const expiredResult = await keyManager3.validateKey(expiringKey.key);
  assert(expiredResult.authenticated === false, 'Key invalid after expiration');
  assert(expiredResult.error?.includes('expired'), 'Expired key returns expired error');

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
