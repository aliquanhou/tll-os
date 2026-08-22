// @ts-nocheck
import { createTllOS, createApiResponseBuilder, createMemoryPersistence } from "../src/public/index.js";

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) { passed++; console.log("  PASS:", msg); } else { failed++; console.error("  FAIL:", msg); } }

async function run() {
  console.log("\n=== TLL OS Foundation 0.2 P0 Verification ===\n");
  const tll = createTllOS();
  const app = tll.createApplication({ name: "foundation-test", version: "0.2.0" });
  await app.start();

  // P0-9 API Contract
  console.log("\n[P0-9] API Contract");
  const b = createApiResponseBuilder();
  const ok = b.ok({ hello: "world" });
  assert(ok.ok === true, "ok response ok=true");
  assert(ok.data.hello === "world", "ok response has data");
  assert(ok.requestId, "ok response has requestId");
  const nf = b.notFound("r");
  assert(nf.ok === false && nf.error.code === "not_found", "notFound correct");

  // P0-10 Tool Contract
  console.log("\n[P0-10] Tool Contract");
  const tool = app.tools.create({ name: "math.add", description: "Add", parameters: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } }, required: ["a", "b"] }, handler: async (input) => ({ success: true, data: { result: input.a + input.b } }) });
  const gr = await tool.invoke({ a: 2, b: 3 });
  assert(gr.success === true && gr.data.result === 5, "tool valid input succeeds");
  const br = await tool.invoke({ a: "x" });
  assert(br.success === false, "tool invalid input fails validation");

  // P0-1 Graph Impact Analysis
  console.log("\n[P0-1] Graph Impact Analysis");
  const mod = app.modules.create({ name: "test-module", description: "Test" });
  mod.apis.create({ method: "GET", path: "/api/test", handler: async () => ({ status: 200, body: "ok" }) });
  mod.tools.create({ name: "test.tool", handler: async () => ({ ok: true }) });
  const impact = app.graph.getImpactAnalysis("module:test-module");
  assert(impact.ownedApis && impact.ownedApis.length >= 1, "Impact finds owned APIs via belongs_to");
  assert(impact.ownedTools && impact.ownedTools.length >= 1, "Impact finds owned Tools");
  assert(impact.riskLevel, "Impact has riskLevel");
  assert(impact.summary, "Impact has summary");

  // P0-7 Persistence
  console.log("\n[P0-7] Persistence");
  const p = createMemoryPersistence();
  await p.connect();
  assert(p.isConnected(), "Persistence connects");
  const repo = p.getRepository("users");
  const u = await repo.create({ name: "Alice", email: "a@t.com" });
  assert(u.id && u.name === "Alice", "Repository creates record");
  assert((await repo.findById(u.id)).name === "Alice", "Repository finds by id");
  const pg = await repo.findPaginated({}, { page: 1, pageSize: 10 });
  assert(pg.total >= 1, "Repository pagination works");
  assert((await repo.count()) >= 1, "Repository count works");
  await p.disconnect();
  assert(app.persistence.type === "memory", "App has persistence adapter");
  await app.persistence.connect();
  const ar = app.persistence.getRepository("items");
  await ar.create({ name: "i1" });
  assert((await ar.count()) >= 1, "App persistence works");

  // P0-11 Plugin
  console.log("\n[P0-11] Plugin");
  const pl = await app.plugins.install({ name: "test-plugin", version: "1.0.0", main: "index.js" });
  assert(pl.state === "installed", "Plugin installs");
  assert(app.plugins.has("test-plugin"), "Plugin manager has plugin");
  await app.plugins.enable("test-plugin");
  assert(app.plugins.get("test-plugin").state === "enabled", "Plugin enables");
  await app.plugins.disable("test-plugin");
  assert(app.plugins.get("test-plugin").state === "disabled", "Plugin disables");

  // P0-2 ChangeSet
  console.log("\n[P0-2] ChangeSet");
  const cs = app.changeSets.create("test-cs", { description: "Test", agentName: "agent-a" });
  assert(cs.id && cs.status === "draft", "ChangeSet creates with status=draft");
  cs.addEntry({ operation: "add", entityType: "module", entityId: "mod1", data: { name: "new-mod" } });
  assert(cs.entries.length === 1, "ChangeSet tracks entries");
  const pv = cs.preview();
  assert(pv.byOperation && pv.byOperation.add >= 1, "ChangeSet preview shows byOperation");
  assert(app.changeSets.list().length >= 1, "ChangeSet manager lists");

  // P0-3 Workspace
  console.log("\n[P0-3] Workspace");
  const ws = app.workspaces.create("ws-a", "agent-a", { description: "Test" });
  assert(ws.id && ws.status === "active", "Workspace creates");
  assert(app.workspaces.list().length >= 1, "Workspace manager lists");
  const wsApp = ws.application;
  assert(wsApp && wsApp.name, "Workspace has isolated app");

  // P0-4 Lock/Version
  console.log("\n[P0-4] Lock/Version");
  const lock = app.locks.acquire("module:test-module", "module", "agent-a", 30000);
  assert(lock && lock.ownerAgent === "agent-a", "Lock acquired");
  let conflict = false;
  try { app.locks.acquire("module:test-module", "module", "agent-b", 30000); } catch { conflict = true; }
  assert(conflict, "Second lock causes conflict");
  app.locks.release(lock.id);
  const lock2 = app.locks.acquire("module:test-module", "module", "agent-b", 30000);
  assert(lock2.ownerAgent === "agent-b", "Lock acquired after release");

  // P0-5 Handoff
  console.log("\n[P0-5] Handoff");
  const ho = app.handoffs.create("agent-a", "agent-b", "task-1", { description: "Pass", workspaceId: ws.id });
  assert(ho.id && ho.status === "pending", "Handoff creates");
  assert(ho.fromAgent === "agent-a" && ho.toAgent === "agent-b", "Handoff correct agents");
  ho.accept();
  assert(ho.status === "accepted", "Handoff accepted");

  // P0-6 Review/Merge
  console.log("\n[P0-6] Review/Merge");
  const rv = app.reviews.createReview("Test review", "agent-a", "agent", cs.id, { description: "Review" });
  assert(rv.id && rv.status === "pending", "Review creates");
  rv.addReviewer("agent-b", "agent"); rv.addComment("agent-b", "agent", "Looks good");
  assert(rv.comments.length === 1, "Review accepts comments");
  rv.approve("agent-b");
  assert(rv.status === "approved", "Review approved");
  const mr = app.reviews.createMerge("Test merge", ws.id, cs.id, "agent-a", { reviewRequestId: rv.id });
  assert(mr.id && mr.status === "pending", "Merge request creates");

  // P0-8 HTTP
  console.log("\n[P0-8] HTTP Server");
  const hr = await app.startHttp(0, "127.0.0.1");
  assert(hr.port > 0 && hr.url, "HTTP server starts");
  try {
    const res = await fetch(hr.url + "/health");
    const d = await res.json();
    assert(d.ok === true && d.status === "running", "Health endpoint responds");
  } catch (e) { assert(false, "Health failed: " + e.message); }
  await app.stop();

  console.log("\n" + "=".repeat(50));
  console.log("  Foundation 0.2 P0 Results: " + passed + " passed, " + failed + " failed, " + (passed+failed) + " total");
  console.log("=".repeat(50));
  if (failed > 0) process.exit(1);
  return { passed, failed, total: passed + failed };
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });




