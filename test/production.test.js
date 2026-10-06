import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { createServer } from "node:http";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createStore } from "../server/db.js";
import { createAuth } from "../server/auth.js";
import { createPlateTemplate, parsePlateUpload } from "../server/import.js";
import { createVortexClient } from "../server/vortex.js";
import jwt from "jsonwebtoken";
import { searchCachedPlates } from "../client/src/api.js";

test("offline plate search normalizes exact and partial matches", () => {
  const plates = [
    { id: "one", plaka: "06 ABC 06", isim: "Örnek Sürücü" },
    { id: "two", plaka: "34 XYZ 34", isim: "Başka Sürücü" },
  ];
  assert.equal(searchCachedPlates(plates, "06ABC06").exact[0].id, "one");
  assert.equal(searchCachedPlates(plates, "xyz").similar[0].id, "two");
});

test("guest sessions are disabled by default and reject legacy tokens", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tpplaka-"));
  const jwtSecret = "test-secret-that-is-long-enough-for-a-test";
  try {
    const auth = createAuth({ store: createStore(dir), vortex: {}, jwtSecret });
    assert.throws(() => auth.guest(), /Misafir oturumları kapalı\./);
    const token = jwt.sign({ sub: "guest", role: "guest" }, jwtSecret);
    let statusCode;
    auth.requireUser(
      { headers: { authorization: `Bearer ${token}` } },
      { status(code) { statusCode = code; return this; }, json() {} },
      () => { throw new Error("A guest token was accepted while guest mode was disabled."); },
    );
    assert.equal(statusCode, 401);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("configured guest sessions can read data but cannot administer", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tpplaka-"));
  const jwtSecret = "test-secret-that-is-long-enough-for-a-test";
  try {
    const auth = createAuth({ store: createStore(dir), vortex: {}, jwtSecret, allowGuestSessions: true });
    const session = auth.guest();
    let guestUser;
    auth.requireUser(
      { headers: { authorization: `Bearer ${session.token}` } },
      { status(code) { return { json() { return code; } }; } },
      () => { guestUser = "guest"; },
    );
    assert.equal(guestUser, "guest");
    let statusCode;
    auth.requireAdmin(
      { headers: { authorization: `Bearer ${session.token}` } },
      { status(code) { statusCode = code; return this; }, json() {} },
      () => { throw new Error("Guest session unexpectedly received admin access."); },
    );
    assert.equal(statusCode, 403);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

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
    const admin = store.createLocalUser({ email: "admin@example.com", passwordHash: "hash", role: "admin" });
    assert.equal(admin.role, "admin");
    assert.equal(store.hasAdmins(), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CSV upload reads headered, semicolon-delimited rows", async () => {
  const rows = await parsePlateUpload({ originalname: "plates.csv", buffer: Buffer.from("plaka;blok;daire\n06ABC06;C2/47;2\n", "utf8") });
  assert.deepEqual(rows, [{ isim: "", plaka: "06ABC06", blok: "C2/47", daire: "2" }]);
});

test("bulk plate import skips existing plates without duplicating them", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tpplaka-"));
  try {
    const store = createStore(dir);
    store.addPlate({ isim: "Örnek Sürücü", plaka: "06ABC06", blok: "C2/47", daire: "2" });
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
  assert.deepEqual(rows, [{ isim: "", plaka: "34XYZ34", blok: "A2", daire: "12" }]);
});

test("source workbook imports driver name and plate without locations", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Aboneler");
  sheet.addRow(["SÜRÜCÜ AD SOYAD", "PLAKA"]);
  sheet.addRow(["Örnek Sürücü", "06ABC06"]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const rows = await parsePlateUpload({ originalname: "aboneler.xlsx", buffer });
  assert.deepEqual(rows, [{ isim: "Örnek Sürücü", plaka: "06ABC06", blok: "", daire: "" }]);
});

test("Excel template has name and plate columns plus optional locations", async () => {
  const buffer = await createPlateTemplate();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets[0].getRow(1).values.slice(1), ["SÜRÜCÜ AD SOYAD", "PLAKA", "BLOK", "DAİRE"]);
});

test("upload rejects a row with only one optional location field", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Plakalar");
  sheet.addRow(["SÜRÜCÜ AD SOYAD", "PLAKA", "BLOK", "DAİRE"]);
  sheet.addRow(["Örnek Sürücü", "06ABC06", "A1", ""]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await assert.rejects(parsePlateUpload({ originalname: "plates.xlsx", buffer }), /isim ve plaka gerekli; blok\/daire varsa ikisini de doldurun/i);
});

test("named spreadsheet schema rejects a missing driver name", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Plakalar");
  sheet.addRow(["SÜRÜCÜ AD SOYAD", "PLAKA", "BLOK", "DAİRE"]);
  sheet.getCell("A2").value = " ";
  sheet.getCell("B2").value = "06ABC06";
  sheet.getCell("C2").value = "A1";
  sheet.getCell("D2").value = "2";
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await assert.rejects(parsePlateUpload({ originalname: "plates.xlsx", buffer }), /isim ve plaka gerekli; blok\/daire varsa ikisini de doldurun/i);
});

test("named plates with no location are returned without block or unit values", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tpplaka-"));
  try {
    const store = createStore(dir);
    store.addPlates([{ isim: "Örnek Sürücü", plaka: "06ABC06", blok: "", daire: "" }]);
    const record = store.search("06ABC06").exact[0];
    assert.equal(record.isim, "Örnek Sürücü");
    assert.equal(record.blok, "");
    assert.equal(record.daire, "");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("manual plate entry still requires a name, block, and unit", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tpplaka-"));
  try {
    const store = createStore(dir);
    assert.throws(() => store.addPlate({ plaka: "06ABC06", blok: "A1", daire: "2" }), /İsim ve plaka gereklidir; blok veya daire varsa ikisini de doldurun\./);
    assert.throws(() => store.addPlate({ isim: "Örnek Sürücü", plaka: "06ABC06", blok: "A1", daire: "" }), /İsim ve plaka gereklidir; blok veya daire varsa ikisini de doldurun\./);
    assert.equal(store.listPlates().length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
