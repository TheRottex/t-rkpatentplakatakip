import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { createServer } from "node:http";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createStore } from "../server/db.js";
import { parsePlateUpload } from "../server/import.js";
import { createVortexClient } from "../server/vortex.js";

test("ordinary users are members, never automatic administrators", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tpplaka-"));
  try {
    const store = createStore(dir);
    const user = store.createLocalUser({ email: "member@example.com", passwordHash: "hash" });
    assert.equal(user.role, "member");
    assert.equal(store.hasAdmins(), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a stalled Vortex request times out with a controlled unavailable result", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const vortex = createVortexClient({
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    registerPath: "/register",
    loginPath: "/login",
    mePath: "/me",
    timeoutMs: 30,
  });
  try {
    const result = await vortex.login({ email: "member@example.com", password: "password" });
    assert.equal(result.ok, false);
    assert.equal(result.unavailable, true);
    assert.equal(result.error, "Vortex yanıt vermedi.");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("administrator role is assigned only when explicitly requested", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tpplaka-"));
  try {
    const store = createStore(dir);
    const admin = store.createLocalUser({
      email: "admin@example.com",
      passwordHash: "hash",
      role: "admin",
    });
    assert.equal(admin.role, "admin");
    assert.equal(store.hasAdmins(), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CSV upload reads headered, semicolon-delimited rows", async () => {
  const rows = await parsePlateUpload({
    originalname: "plates.csv",
    buffer: Buffer.from("plaka;blok;daire\n06ABC06;C2/47;2\n", "utf8"),
  });
  assert.deepEqual(rows, [{ plaka: "06ABC06", blok: "C2/47", daire: "2" }]);
});

test("bulk plate import skips existing plates without duplicating them", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tpplaka-"));
  try {
    const store = createStore(dir);
    store.addPlate({ plaka: "06ABC06", blok: "C2/47", daire: "2" });
    const result = store.addPlates([
      { plaka: "06 ABC 06", blok: "C2/47", daire: "2" },
      { plaka: "34XYZ34", blok: "A2", daire: "12" },
    ]);
    assert.deepEqual(result, { added: 1, duplicates: 1 });
    assert.equal(store.listPlates().length, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("XLSX upload maps Turkish column headings", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Plakalar");
  sheet.addRow(["Plaka", "Blok", "Daire"]);
  sheet.addRow(["34XYZ34", "A2", 12]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const rows = await parsePlateUpload({ originalname: "plates.xlsx", buffer });
  assert.deepEqual(rows, [{ plaka: "34XYZ34", blok: "A2", daire: "12" }]);
});