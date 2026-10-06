import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { createStore } from "./db.js";
import { createVortexClient } from "./vortex.js";
import { createAuth } from "./auth.js";
import { createPlateTemplate, parsePlateUpload } from "./import.js";

dotenv.config();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4400);
const dataDir = path.resolve(root, process.env.DATA_DIR || "./data");
const seedCsv = path.resolve(root, process.env.SEED_CSV || "./data/plates.csv");
const jwtSecret = requiredSecret(process.env.JWT_SECRET);
const guestSessionsEnabled = process.env.VITE_ALLOW_GUEST_SESSIONS === "true";
const corsOrigins = (process.env.CORS_ORIGINS || process.env.PUBLIC_BASE_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === "production" && corsOrigins.length === 0) {
    throw new Error("CORS_ORIGINS or PUBLIC_BASE_URL is required in production.");
}

const store = createStore(dataDir, seedCsv);
const plateUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter(_request, file, callback) {
          if (![".csv", ".xlsx"].includes(path.extname(file.originalname).toLowerCase())) {
                  const error = new Error("Yalnızca .csv veya .xlsx dosyası yükleyebilirsiniz.");
                  error.status = 415;
                  return callback(error);
          }
          callback(null, true);
    },
});
const vortex = createVortexClient({
    baseUrl: process.env.VORTEX_SERVER_URL || "",
    registerPath: process.env.VORTEX_AUTH_REGISTER || "/api/auth/register",
    loginPath: process.env.VORTEX_AUTH_LOGIN || "/api/auth/login",
    mePath: process.env.VORTEX_AUTH_ME || "/api/me",
    timeoutMs: Number(process.env.VORTEX_TIMEOUT_MS || 8000),
});
const auth = createAuth({ store, vortex, jwtSecret, allowGuestSessions: guestSessionsEnabled });

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", "loopback");
app.use(securityHeaders);
app.use(cors({ origin: corsOrigin(corsOrigins) }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", rateLimit({ limit: 10, windowMs: 60_000 }));
app.use("/api", rateLimit({ limit: 120, windowMs: 60_000 }));

app.get("/api/health", (_request, response) => {
    response.json({
          ok: true,
          name: "TPPlaka",
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

app.post("/api/auth/guest", (_request, response) => {
    try {
          response.json(auth.guest());
    } catch (error) {
          response.status(error.status || 403).json({ error: error.message });
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

app.get("/api/plates/search", auth.requireUser, (request, response) => {
    response.json({ query: request.query.q || "", ...store.search(request.query.q || "") });
});

app.get("/api/plates", auth.requireUser, (_request, response) => {
    response.json({ items: store.listPlates(), stats: store.stats() });
});

app.get("/api/plates/template", auth.requireAdmin, async (_request, response, next) => {
    try {
          response.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          response.attachment("tpplaka-plaka-sablonu.xlsx");
          response.send(await createPlateTemplate());
    } catch (error) {
          next(error);
    }
});

app.post("/api/plates", auth.requireAdmin, (request, response) => {
    try {
          response.status(201).json(store.addPlate(request.body || {}));
    } catch (error) {
          response.status(400).json({ error: error.message });
    }
});

app.post("/api/plates/import", auth.requireAdmin, plateUpload.single("file"), async (request, response, next) => {
    if (!request.file) return response.status(400).json({ error: "Yüklenecek CSV veya Excel dosyası seçin." });
    try {
          const rows = await parsePlateUpload(request.file);
          const result = store.addPlates(rows);
          response.status(201).json({ ...result, total: rows.length });
    } catch (error) {
          response.status(400).json({ error: error.message || "Dosya okunamadı." });
    }
});

app.delete("/api/plates/:id", auth.requireAdmin, (request, response) => {
    const removed = store.removePlate(request.params.id);
    response.status(removed ? 204 : 404).end();
});

app.use((error, _request, response, next) => {
    if (error instanceof multer.MulterError) {
          const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
          const message = error.code === "LIMIT_FILE_SIZE"
            ? "Dosya boyutu en fazla 5 MB olabilir."
                  : "Yalnızca bir CSV veya Excel dosyası yükleyebilirsiniz.";
          return response.status(status).json({ error: message });
    }
    if (error.status && error.status < 500) return response.status(error.status).json({ error: error.message });
    next(error);
});

const dist = path.join(root, "dist");
app.use(express.static(dist, {
    setHeaders(response, filePath) {
          if (path.basename(filePath) === "sw.js") response.setHeader("Cache-Control", "no-store");
    },
}));
app.get("*", (request, response, next) => {
    if (request.path.startsWith("/api")) return next();
    response.sendFile(path.join(dist, "index.html"), (error) => (error ? next() : undefined));
});

app.listen(port, host, () => {
    console.log(`TPPlaka http://${host}:${port}`);
    console.log(`Vortex: ${vortex.enabled ? process.env.VORTEX_SERVER_URL : "kapalı (yerel hesap)"}`);
});

function requiredSecret(value) {
    if (!value || value.length < 32 || value.includes("replace-before") || value.includes("dev-secret")) {
          throw new Error("JWT_SECRET must be at least 32 characters and must not use a placeholder.");
    }
    return value;
}

function corsOrigin(origins) {
    return (origin, callback) => {
          if (!origin || origins.includes(origin)) return callback(null, true);
          callback(new Error("Origin is not allowed."));
    };
}

function securityHeaders(_request, response, next) {
    response.set({
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    next();
}

function rateLimit({ limit, windowMs }) {
    const hits = new Map();
    return (request, response, next) => {
          const now = Date.now();
          const id = request.ip || request.socket.remoteAddress || "unknown";
          const entry = hits.get(id);
          const active = entry && entry.until > now ? entry : { count: 0, until: now + windowMs };
          active.count += 1;
          hits.set(id, active);
          if (active.count > limit) return response.status(429).json({ error: "Çok fazla istek. Lütfen kısa süre sonra tekrar deneyin." });
          if (hits.size > 10_000) {
                  for (const [staleId, stale] of hits) if (stale.until <= now) hits.delete(staleId);
          }
          next();
    };
}
