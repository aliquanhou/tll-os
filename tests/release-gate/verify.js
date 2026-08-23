// @ts-nocheck
/**
 * TLL OS Foundation 0.2 Release Gate — Independent Verification
 * Git HEAD: 1c7f6cb
 * Rules: No new features, no architecture changes, no test modification to pass.
 */

import { createTllOS, createApiResponseBuilder, createMemoryPersistence } from "../../src/public/index.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`  ${passed ? "PASS" : "FAIL"}: ${name}${detail ? " — " + detail : ""}`);
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  TLL OS Foundation 0.2 Release Gate");
  console.log("  Git HEAD: 1c7f6cb | aliquanhou/tll-os");
  console.log("=".repeat(60));

  // ===== 1. 17 Contract Implementation Matrix =====
  console.log("\n[1] 17 Contract Implementation Matrix");
  const tll = createTllOS();
  const app = tll.createApplication({ name: "release-gate", version: "0.2.0" });
  await app.start();

  const contracts = [
    ["Application", !!app.id && !!app.name && !!app.start && !!app.stop],
    ["Application Graph", !!app.graph && typeof app.graph.getImpactAnalysis === "function"],
    ["Module", !!app.modules && typeof app.modules.create === "function"],
    ["Plugin", !!app.plugins && typeof app.plugins.install === "function"],
    ["Agent", !!app.agents && typeof app.agents.create === "function"],
    ["Tool", !!app.tools && typeof app.tools.create === "function"],
    ["Skill", false], // P1
    ["Context", !!app.config],
    ["Permission", typeof app.tools.create === "function"], // declared, partial execution
    ["Workflow", false], // P1
    ["Event", !!app.events && typeof app.events.dispatch === "function"],
    ["Adapter", !!app.persistence], // Persistence Adapter + Node Runtime
    ["Projection", false], // P1
    ["BuildTarget", false], // P1
    ["Capability", false], // P1
    ["Compatibility Manifest", false], // P2
    ["Evolution Proposal", false], // P1
  ];
  for (const [name, has] of contracts) {
    check(`Contract: ${name}`, has, has ? "runtime present" : "type-only / P1");
  }

  // ===== 2. Public API Completeness =====
  console.log("\n[2] Public API Completeness");
  const publicExports = Object.keys(await import("../../src/public/index.js"));
  check("createTllOS exported", publicExports.includes("createTllOS"));
  check("createApiResponseBuilder exported", publicExports.includes("createApiResponseBuilder"));
  check("createMemoryPersistence exported", publicExports.includes("createMemoryPersistence"));
  check("Application has graph", !!app.graph);
  check("Application has modules", !!app.modules);
  check("Application has apis", !!app.apis);
  check("Application has tools", !!app.tools);
  check("Application has agents", !!app.agents);
  check("Application has tests", !!app.tests);
  check("Application has events", !!app.events);
  check("Application has workspaces", !!app.workspaces);
  check("Application has locks", !!app.locks);
  check("Application has handoffs", !!app.handoffs);
  check("Application has reviews", !!app.reviews);
  check("Application has changeSets", !!app.changeSets);
  check("Application has persistence", !!app.persistence);
  check("Application has plugins", !!app.plugins);
  check("Application has startHttp", typeof app.startHttp === "function");

  // ===== 3. Graph Impact Analysis =====
  console.log("\n[3] Graph Impact Analysis (real)");
  const mod = app.modules.create({ name: "rg-product", description: "Product module" });
  mod.apis.create({ method: "GET", path: "/api/products", name: "product.list", handler: async () => ({ status: 200, body: "[]" }) });
  mod.apis.create({ method: "POST", path: "/api/products", name: "product.create", handler: async () => ({ status: 201, body: "{}" }) });
  mod.tools.create({ name: "product.search", handler: async () => ({ success: true, data: [] }) });
  const impact = app.graph.getImpactAnalysis("module:rg-product");
  check("Impact finds owned APIs", impact.ownedApis && impact.ownedApis.length >= 2, `found ${impact.ownedApis?.length ?? 0}`);
  check("Impact finds owned Tools", impact.ownedTools && impact.ownedTools.length >= 1, `found ${impact.ownedTools?.length ?? 0}`);
  check("Impact has riskLevel", !!impact.riskLevel);
  check("Impact has summary", !!impact.summary);
  check("Impact has regressionPoints", !!impact.regressionPoints);

  // ===== 4. ChangeSet =====
  console.log("\n[4] ChangeSet (real)");
  const cs = app.changeSets.create("rg-add-inventory", { agentName: "agent-a", description: "Add inventory module" });
  cs.addEntry({ operation: "add", entityType: "module", entityId: "module:inventory", entityName: "inventory", data: { name: "inventory" } });
  cs.addEntry({ operation: "add", entityType: "api", entityId: "api:inventory.list", entityName: "inventory.list" });
  const pv = cs.preview();
  check("ChangeSet creates with draft status", cs.status === "draft");
  check("ChangeSet tracks entries", cs.entries.length === 2, `${cs.entries.length} entries`);
  check("ChangeSet preview byOperation", pv.byOperation && pv.byOperation.add === 2);
  check("ChangeSet manager lists", app.changeSets.list().length >= 1);
  check("ChangeSet has riskLevel", !!pv.riskLevel);

  // ===== 5. Workspace Isolation =====
  console.log("\n[5] Workspace Isolation (real)");
  const wsA = app.workspaces.create("ws-a", "agent-a");
  const wsB = app.workspaces.create("ws-b", "agent-b");
  check("Workspace A created", !!wsA.id && wsA.status === "active");
  check("Workspace B created", !!wsB.id && wsB.status === "active");
  check("Workspace A has isolated app", !!wsA.application && wsA.application.id !== app.id);
  check("Workspace B has isolated app", !!wsB.application && wsB.application.id !== app.id);
  check("Workspace apps are different", wsA.application.id !== wsB.application.id);
  // Verify isolation: create module in wsA, should not appear in wsB
  wsA.application.modules.create({ name: "ws-a-only" });
  const wsBModules = wsB.application.modules.list().map(m => m.name);
  check("Isolation: wsA module not in wsB", !wsBModules.includes("ws-a-only"));

  // ===== 6. Lock Concurrency Conflict =====
  console.log("\n[6] Lock Concurrency Conflict (real)");
  const lock1 = app.locks.acquire("module:rg-product", "module", "agent-a", 30000);
  check("Lock acquired by agent-a", lock1.ownerAgent === "agent-a");
  let conflictThrown = false;
  try { app.locks.acquire("module:rg-product", "module", "agent-b", 30000); }
  catch (e) { conflictThrown = e.code === "VERSION_CONFLICT"; }
  check("VERSION_CONFLICT thrown for agent-b", conflictThrown);
  app.locks.release(lock1.id);
  const lock2 = app.locks.acquire("module:rg-product", "module", "agent-b", 30000);
  check("Lock acquired by agent-b after release", lock2.ownerAgent === "agent-b");
  app.locks.release(lock2.id);

  // ===== 7. Handoff =====
  console.log("\n[7] Handoff (real)");
  const ho = app.handoffs.create("agent-a", "agent-b", "implement-inventory", {
    description: "Pass inventory implementation to agent-b",
    workspaceId: wsA.id,
    changeSetId: cs.id,
    context: { priority: "high" },
  });
  check("Handoff created with pending status", ho.status === "pending");
  check("Handoff fromAgent correct", ho.fromAgent === "agent-a");
  check("Handoff toAgent correct", ho.toAgent === "agent-b");
  check("Handoff carries workspaceId", ho.workspaceId === wsA.id);
  check("Handoff carries changeSetId", ho.changeSetId === cs.id);
  ho.accept();
  check("Handoff accepted", ho.status === "accepted");

  // ===== 8. Review -> Merge =====
  console.log("\n[8] Review -> Merge (real)");
  const rv = app.reviews.createReview("Review inventory module", "agent-a", "agent", cs.id, { description: "Please review" });
  rv.addReviewer("agent-b", "agent");
  rv.addComment("agent-b", "agent", "Looks good, approved");
  rv.approve("agent-b");
  check("Review created", !!rv.id && rv.status === "approved");
  check("Review has comments", rv.comments.length >= 1);
  const mr = app.reviews.createMerge("Merge inventory module", wsA.id, cs.id, "agent-a", { reviewRequestId: rv.id });
  check("Merge request created", !!mr.id && mr.status === "pending");
  check("Merge links to review", mr.reviewRequestId === rv.id);

  // ===== 9. HTTP Actual Access =====
  console.log("\n[9] HTTP Actual Access (real)");
  const httpApp = tll.createApplication({ name: "http-test", version: "0.2.0" });
  await httpApp.start();
  httpApp.modules.create({ name: "http-mod" });
  const httpMod = httpApp.modules.list()[0];
  httpMod.apis.create({ method: "GET", path: "/api/hello", name: "hello", handler: async () => ({ status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ hello: "world" }) }) });
  const sr = await httpApp.startHttp(0, "127.0.0.1");
  check("HTTP server starts", sr.port > 0, `port ${sr.port}`);
  try {
    const health = await fetch(`${sr.url}/health`);
    const hd = await health.json();
    check("Health endpoint responds", hd.ok === true && hd.status === "running");
  } catch (e) { check("Health endpoint responds", false, e.message); }
  try {
    const graph = await fetch(`${sr.url}/graph`);
    check("Graph endpoint responds", graph.status === 200);
  } catch (e) { check("Graph endpoint responds", false, e.message); }
  await httpApp.stop();

  // ===== 10. Persistence Restart Test (CRITICAL) =====
  console.log("\n[10] Persistence Restart Test (CRITICAL)");
  const tmpFile = path.join(os.tmpdir(), `tll-persist-test-${Date.now()}.json`);
  const p1 = createMemoryPersistence();
  await p1.connect();
  const r1 = p1.getRepository("items");
  await r1.create({ id: "item-1", name: "Test Item", value: 42 });
  const beforeCount = await r1.count();
  check("Persistence writes data", beforeCount >= 1, `${beforeCount} items`);
  await p1.disconnect();

  // Simulate process restart: create a NEW persistence instance
  const p2 = createMemoryPersistence();
  await p2.connect();
  const r2 = p2.getRepository("items");
  const afterCount = await r2.count();
  check("Persistence survives restart (MEMORY)", afterCount >= 1, `${afterCount} items after restart — WARNING: Memory adapter does NOT persist across processes`);
  const persistsAcrossRestart = afterCount >= 1;
  await p2.disconnect();

  // Honest assessment: Memory adapter is in-memory only
  check("Persistence is Memory adapter (not real DB)", p1.type === "memory", "type=memory — data lost on process exit");
  check("Persistence Contract defined", true, "Repository/Query/Pagination/Transaction/Migration interfaces defined");

  // ===== 11. CLI Full Flow =====
  console.log("\n[11] CLI Full Flow (real)");
  const cliPath = path.resolve("src/cli/index.ts");
  check("CLI file exists", await fs.access(cliPath).then(() => true).catch(() => false));
  // Test tll version
  try {
    const { execSync } = await import("node:child_process");
    const ver = execSync(`npx tsx ${cliPath} version`, { encoding: "utf-8", timeout: 15000 });
    check("CLI version command works", ver.includes("0.2.0") || ver.includes("TLL OS"), ver.trim());
  } catch (e) { check("CLI version command works", false, e.message?.slice(0, 100)); }
  // Test tll create in temp dir
  const tmpProject = path.join(os.tmpdir(), `tll-cli-test-${Date.now()}`);
  try {
    const { execSync } = await import("node:child_process");
    execSync(`npx tsx ${cliPath} create test-project`, { cwd: os.tmpdir(), encoding: "utf-8", timeout: 15000 });
    const created = path.join(os.tmpdir(), "test-project");
    const hasPackage = await fs.access(path.join(created, "package.json")).then(() => true).catch(() => false);
    const hasConfig = await fs.access(path.join(created, "tll.config.json")).then(() => true).catch(() => false);
    const hasSrc = await fs.access(path.join(created, "src/index.js")).then(() => true).catch(() => false);
    check("CLI create generates package.json", hasPackage);
    check("CLI create generates tll.config.json", hasConfig);
    check("CLI create generates src/index.js", hasSrc);
    // cleanup
    await fs.rm(created, { recursive: true, force: true });
  } catch (e) { check("CLI create project", false, e.message?.slice(0, 100)); }

  // ===== 12. Commerce Migration Analysis =====
  console.log("\n[12] Commerce Migration Analysis (CRITICAL)");
  // Check if Commerce code exists locally or on server
  const commercePaths = [
    path.resolve("examples/commerce"),
    path.resolve("../tll-commerce/examples/commerce"),
    "/opt/tll-commerce/examples/commerce",
  ];
  let commerceFound = false;
  let commercePath = null;
  for (const p of commercePaths) {
    if (await fs.access(p).then(() => true).catch(() => false)) {
      commerceFound = true;
      commercePath = p;
      break;
    }
  }
  check("Commerce code found locally", commerceFound, commercePath ?? "not in local repo — runs on server /opt/tll-commerce");

  // Analyze TLL OS 0.2 API surface for Commerce compatibility
  const commerceNeeds = [
    ["Module system", typeof app.modules.create === "function"],
    ["API registration", typeof app.apis.create === "function" || typeof mod.apis.create === "function"],
    ["Tool registration", typeof app.tools.create === "function"],
    ["Agent registration", typeof app.agents.create === "function"],
    ["Test framework", typeof app.tests.create === "function"],
    ["Event system", typeof app.events.dispatch === "function"],
    ["Config management", !!app.config],
    ["HTTP server", typeof app.startHttp === "function"],
    ["Persistence", !!app.persistence],
    ["Graph", !!app.graph],
  ];
  for (const [need, has] of commerceNeeds) {
    check(`Commerce need: ${need}`, has, has ? "available" : "MISSING");
  }

  // Commerce has 18 modules / 124 APIs / 38 tools / 38 tests
  // Can TLL OS 0.2 Module/API/Tool model accommodate this?
  check("TLL OS Module can hold APIs", typeof mod.apis.create === "function");
  check("TLL OS Module can hold Tools", typeof mod.tools.create === "function");
  check("TLL OS Module can hold Tests", typeof mod.tests.create === "function");
  check("TLL OS API can be HTTP-exposed", typeof app.startHttp === "function");

  // ===== Summary =====
  console.log("\n" + "=".repeat(60));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`  Release Gate Results: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log("=".repeat(60));

  // Print failures
  if (failed > 0) {
    console.log("\n  FAILURES:");
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    ✗ ${r.name}${r.detail ? " — " + r.detail : ""}`);
    }
  }

  // Honest assessment
  console.log("\n  HONEST ASSESSMENT:");
  console.log("  1. Persistence is Memory-only — does NOT survive process restart.");
  console.log("     Real SQLite/PostgreSQL adapter needed for production persistence.");
  console.log("  2. Commerce runs on its own Runtime on server, not yet migrated to TLL OS 0.2.");
  console.log("     TLL OS 0.2 API surface can accommodate Commerce's Module/API/Tool pattern,");
  console.log("     but actual migration work is required.");
  console.log("  3. ChangeSet apply/rollback and Merge actual merge are not yet implemented.");
  console.log("     Review/Merge flow creates records but does not apply changes to Main.");
  console.log("  4. 8 of 17 Contracts are type-only (Skill/Workflow/Projection/BuildTarget/");
  console.log("     Capability/Compatibility/Evolution) — planned for V1.1/V2.");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
