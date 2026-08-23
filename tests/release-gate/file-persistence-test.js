// @ts-nocheck
import { createFilePersistence } from "../../src/public/index.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

const baseDir = path.join(os.tmpdir(), `tll-file-test-${Date.now()}`);
console.log("Test dir:", baseDir);

// Phase 1: Write data
const p1 = createFilePersistence(baseDir);
await p1.connect();
const r1 = p1.getRepository("products");
await r1.create({ id: "prod-1", name: "Widget", price: 9.99, stock: 100 });
await r1.create({ id: "prod-2", name: "Gadget", price: 19.99, stock: 50 });
console.log("Phase 1: wrote", await r1.count(), "items");
await p1.disconnect();

// Phase 2: Simulate process restart - new instance, same dir
const p2 = createFilePersistence(baseDir);
await p2.connect();
const r2 = p2.getRepository("products");
const count = await r2.count();
console.log("Phase 2: after restart, found", count, "items");
const prod1 = await r2.findById("prod-1");
const prod2 = await r2.findById("prod-2");
console.log("  prod-1:", prod1?.name, prod1?.price);
console.log("  prod-2:", prod2?.name, prod2?.price);
await p2.disconnect();

// Verify files exist on disk
const files = await fs.readdir(baseDir);
console.log("Files on disk:", files);

if (count === 2 && prod1?.name === "Widget" && prod2?.name === "Gadget") {
  console.log("\nPASS: File persistence survives process restart!");
  await fs.rm(baseDir, { recursive: true, force: true });
  process.exit(0);
} else {
  console.log("\nFAIL: File persistence did not survive restart");
  process.exit(1);
}

