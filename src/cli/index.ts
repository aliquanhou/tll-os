// @ts-nocheck
import { createTllOS } from "../core/index.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const CWD = process.cwd();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] ?? "help";
  switch (command) {
    case "create": await cmdCreate(args.slice(1)); break;
    case "dev": await cmdDev(args.slice(1)); break;
    case "test": await cmdTest(args.slice(1)); break;
    case "graph": await cmdGraph(args.slice(1)); break;
    case "inspect": await cmdInspect(); break;
    case "version": case "--version": case "-v": printVersion(); break;
    default: printHelp(); break;
  }
}

async function cmdCreate(args) {
  const name = args[0];
  if (!name) { console.error("Usage: tll create <project-name>"); process.exit(1); }
  const projectDir = path.join(CWD, name);
  try { await fs.access(projectDir); console.error("Directory exists"); process.exit(1); } catch {}
  console.log("Creating TLL OS project:", name);
  await fs.mkdir(path.join(projectDir, "src/modules"), { recursive: true });
  await fs.mkdir(path.join(projectDir, "src/plugins"), { recursive: true });
  await fs.mkdir(path.join(projectDir, "tests"), { recursive: true });
  const pkg = { name, version: "0.1.0", type: "module", main: "src/index.js",
    scripts: { dev: "tll dev", test: "tll test" },
    dependencies: { "@tll/os": "^0.2.0" }, tll: { protocol: "2.0", runtime: "0.2" } };
  await fs.writeFile(path.join(projectDir, "package.json"), JSON.stringify(pkg, null, 2));
  const cfg = { name, version: "0.1.0", environment: "development", modules: [], plugins: [] };
  await fs.writeFile(path.join(projectDir, "tll.config.json"), JSON.stringify(cfg, null, 2));
  const indexJs = "import { createTllOS } from '@tll/os';\nconst tll = createTllOS();\nconst app = tll.createApplication({ name: '" + name + "', version: '0.1.0' });\nexport default app;\n";
  await fs.writeFile(path.join(projectDir, "src/index.js"), indexJs);
  await fs.writeFile(path.join(projectDir, ".gitignore"), "node_modules/\ndist/\n.env\n*.log\n");
  console.log("Project created:", projectDir);
}

async function cmdDev(args) {
  const portIdx = args.indexOf("--port");
  const port = portIdx >= 0 && args[portIdx + 1] ? parseInt(args[portIdx + 1], 10) : 3000;
  console.log("Starting TLL OS dev server...");
  let appConfig = { name: "dev-app", version: "0.1.0" };
  try { const raw = await fs.readFile(path.join(CWD, "tll.config.json"), "utf-8"); appConfig = JSON.parse(raw); } catch {}
  const tll = createTllOS();
  const app = tll.createApplication(appConfig);
  await app.persistence.connect();
  const { url } = await app.startHttp(port);
  console.log("TLL OS dev server:", url);
  console.log("Health:", url + "/health", "| Graph:", url + "/graph");
  process.on("SIGINT", async () => { console.log("Stopping..."); await app.stop(); process.exit(0); });
}

async function cmdTest(args) {
  const filter = args[0];
  console.log("Running tests" + (filter ? " (" + filter + ")" : "") + "...");
  const tll = createTllOS();
  const app = tll.createApplication({ name: "test-runner", version: "0.1.0" });
  const testsDir = path.join(CWD, "tests");
  let passed = 0, failed = 0;
  try {
    const files = (await fs.readdir(testsDir)).filter(f => f.endsWith(".test.js") || f.endsWith(".test.ts"));
    for (const file of files) {
      if (filter && !file.includes(filter)) continue;
      console.log("  ", file);
      try { const mod = await import(path.join(testsDir, file)); if (typeof mod.run === "function") { const r = await mod.run(app); if (r.passed) passed++; else failed++; } }
      catch (e) { console.error("    Error:", e.message); failed++; }
    }
  } catch { console.log("  (No tests directory)"); }
  console.log("Tests:", passed + failed, "total,", passed, "passed,", failed, "failed");
  if (failed > 0) process.exit(1);
}

async function cmdGraph(args) {
  const json = args.includes("--json");
  const tll = createTllOS();
  const app = tll.createApplication({ name: "graph-inspector", version: "0.1.0" });
  const snap = app.graph.toJSON();
  if (json) { console.log(JSON.stringify(snap, null, 2)); return; }
  console.log("\n  Application Graph:", snap.application.name, "v" + snap.application.version);
  console.log("  Nodes:", snap.nodes.length, "| Edges:", snap.edges.length);
  const types = new Map();
  for (const n of snap.nodes) types.set(n.type, (types.get(n.type) ?? 0) + 1);
  for (const [t, c] of types) console.log("    " + t + ":", c);
  console.log("");
}

async function cmdInspect() {
  const tll = createTllOS();
  const app = tll.createApplication({ name: "inspector", version: "0.1.0" });
  console.log("\n  TLL OS Inspection:", app.name, "v" + app.version, "[" + app.state + "]");
  console.log("  Modules:", app.modules.list().length, "APIs:", app.apis.list().length, "Tools:", app.tools.list().length);
  console.log("  Agents:", app.agents.list().length, "Tests:", app.tests.list().length, "Plugins:", app.plugins.list().length);
  console.log("  Workspaces:", app.workspaces.list().length, "ChangeSets:", app.changeSets.list().length);
  console.log("  Graph:", app.graph.listNodes().length, "nodes,", app.graph.listEdges().length, "edges");
  console.log("  Persistence:", app.persistence.type, "[" + (app.persistence.isConnected() ? "connected" : "disconnected") + "]");
  console.log("  Contracts:", tll.getContracts().length);
  console.log("");
}

function printHelp() {
  console.log("\n  TLL OS CLI\n\n  Usage: tll <command>\n\n  Commands:\n    create <name>  Create new application\n    dev [--port N] Start dev server (default 3000)\n    test [filter]  Run tests\n    graph [--json] View Application Graph\n    inspect        Inspect application state\n    version        Show version\n    help           Show help\n");
}

function printVersion() { console.log("TLL OS CLI v0.2.0 (Protocol 2.0, Runtime 0.2)"); }

main().catch(e => { console.error("Fatal:", e); process.exit(1); });

