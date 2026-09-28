import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createStore } from "../server/db.js";
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