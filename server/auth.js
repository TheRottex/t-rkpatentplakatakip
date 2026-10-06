import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { extractProfile, extractToken } from "./vortex.js";

export function createAuth({ store, vortex, jwtSecret, allowGuestSessions = false }) {
    function sign(user) {
          return jwt.sign(
            { sub: user.id, email: user.email, role: user.role, vortexId: user.vortexId },
                  jwtSecret,
            { expiresIn: "30d" }
                );
    }

  function readToken(request) {
        const header = request.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : null;
        if (!token) return null;
        try {
                return jwt.verify(token, jwtSecret);
        } catch {
                return null;
        }
  }

  async function register(input) {
        const email = String(input.email || "").trim().toLowerCase();
        const password = String(input.password || "");
        if (!email.includes("@") || password.length < 8) {
                throw Object.assign(new Error("Geçerli bir e-posta ve en az 8 karakterlik parola gerekir."), { status: 400 });
        }
        const remote = await vortex.register(input);
        if (remote.ok) {
                const vortexToken = extractToken(remote.payload);
                let profile = extractProfile(remote.payload, email);
                if (vortexToken) {
                          const me = await vortex.me(vortexToken);
                          if (me.ok) profile = extractProfile(me.payload, email);
                }
                const user = store.upsertVortexUser(profile);
                return { token: sign(user), user: publicUser(user), via: "vortex" };
        }
        if (!remote.skipped && !remote.unavailable) {
                throw Object.assign(new Error("Vortex hesabı oluşturulamadı. E-posta bilgilerini kontrol edin."), { status: 400 });
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const user = store.createLocalUser({
                email,
                passwordHash,
                displayName: input.displayName || input.nickname || `${input.firstName || ""} ${input.lastName || ""}`.trim(),
        });
        return { token: sign(user), user: publicUser(user), via: "local" };
  }

  async function login(input) {
        const email = String(input.email || "").trim().toLowerCase();
        const password = String(input.password || "");
        const remote = await vortex.login(input);
        if (remote.ok) {
                const vortexToken = extractToken(remote.payload);
                let profile = extractProfile(remote.payload, email);
                if (vortexToken) {
                          const me = await vortex.me(vortexToken);
                          if (me.ok) profile = extractProfile(me.payload, email);
                }
                const user = store.upsertVortexUser(profile);
                return { token: sign(user), user: publicUser(user), via: "vortex" };
        }
        const user = store.findUserByEmail(email);
        if (user?.passwordHash && await bcrypt.compare(password, user.passwordHash)) {
                return { token: sign(user), user: publicUser(user), via: "local" };
        }
        if (!remote.skipped && !remote.unavailable) {
                throw Object.assign(new Error("Vortex hesabı doğrulanamadı. E-posta ve parolayı kontrol edin."), { status: 401 });
        }
        throw Object.assign(new Error("E-posta veya parola hatalı."), { status: 401 });
  }

  function guest() {
        if (!allowGuestSessions) throw Object.assign(new Error("Misafir oturumları kapalı."), { status: 403 });
        const token = jwt.sign({ sub: "guest", email: null, role: "guest", vortexId: null }, jwtSecret, { expiresIn: "24h" });
        return { token, user: { id: "guest", email: null, displayName: "Misafir", role: "guest", vortexLinked: false }, via: "guest" };
  }

  function requireUser(request, response, next) {
        const payload = readToken(request);
        if (!payload) return response.status(401).json({ error: "Oturum gerekli." });
        if (payload.sub === "guest" && payload.role === "guest") {
                if (!allowGuestSessions) return response.status(401).json({ error: "Misafir oturumları kapalı." });
                request.user = { id: "guest", email: null, displayName: "Misafir", role: "guest", vortexId: null };
                return next();
        }
        const user = store.findUserById(payload.sub);
        if (!user) return response.status(401).json({ error: "Oturum geçersiz." });
        request.user = user;
        next();
  }

  function requireAdmin(request, response, next) {
        requireUser(request, response, () => {
                if (request.user.role !== "admin") return response.status(403).json({ error: "Bu işlem için yönetici hesabı gerekir." });
                next();
        });
  }

  return { register, login, guest, requireUser, requireAdmin };
}

function publicUser(user) {
    return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          vortexLinked: Boolean(user.vortexId),
    };
}
