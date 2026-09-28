import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createStore } from "./db.js";
import { createVortexClient } from "./vortex.js";
import { createAuth } from "./auth.js";

dotenv.config();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4400);
const dataDir = path.resolve(root, process.env.DATA_DIR || "./data");
const seedCsv = path.resolve(root, process.env.SEED_CSV || "./data/plates.csv");

const store = createStore(dataDir, seedCsv);
const vortex = createVortexClient({
  baseUrl: process.env.VORTEX_SERVER_URL || "",
  registerPath: process.env.VORTEX_AUTH_REGISTER || "/api/auth/register",
  loginPath: process.env.VORTEX_AUTH_LOGIN || "/api/auth/login",
  mePath: process.env.VORTEX_AUTH_ME || "/api/me",
});
const auth = createAuth({
  store,
  vortex,
  jwtSecret: process.env.JWT_SECRET || "bloktakip-dev-secret",
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    name: "BlokTakip",
    vortex: vortex.enabled,
    stats: store.stats(),
  });
});

app.post("/api/auth/register", async (request, response) => {
  try {
    response.status(201).json(await auth.register(request.body || {}));
  } catch (error) {
    response.status(error.status || 400).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (request, response) => {
  try {
    response.json(await auth.login(request.body || {}));
  } catch (error) {
    response.status(error.status || 400).json({ error: error.message });
  }
});

app.get("/api/me", auth.requireUser, (request, response) => {
  response.json({
    id: request.user.id,
    email: request.user.email,
    displayName: request.user.displayName,
    role: request.user.role,
    vortexLinked: Boolean(request.user.vortexId),
  });
});

app.get("/api/plates/search", (request, response) => {
  response.json({ query: request.query.q || "", ...store.search(request.query.q || "") });
});

app.get("/api/plates", auth.requireUser, (_request, response) => {
  response.json({ items: store.listPlates(), stats: store.stats() });
});

app.post("/api/plates", auth.requireAdmin, (request, response) => {
  try {
    response.status(201).json(store.addPlate(request.body || {}));
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.delete("/api/plates/:id", auth.requireAdmin, (request, response) => {
  const removed = store.removePlate(request.params.id);
  response.status(removed ? 204 : 404).end();
});

const dist = path.join(root, "dist");
app.use(express.static(dist));
app.get("*", (request, response, next) => {
  if (request.path.startsWith("/api")) return next();
  response.sendFile(path.join(dist, "index.html"), (error) => (error ? next() : undefined));
});

app.listen(port, () => {
  console.log(`BlokTakip http://127.0.0.1:${port}`);
  console.log(`Vortex: ${vortex.enabled ? process.env.VORTEX_SERVER_URL : "kapalı (yerel hesap)"}`);
});
