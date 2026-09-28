const REGISTER_BODY_KEYS = ["email", "password", "firstName", "lastName", "nickname", "displayName", "birthDate", "phone"];

export function createVortexClient({ baseUrl, registerPath, loginPath, mePath }) {
  const enabled = Boolean(baseUrl);

  async function request(path, { method = "GET", token, body } = {}) {
    const url = new URL(path, baseUrl);
    const headers = { Accept: "application/json" };
    if (body) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    return { ok: response.ok, status: response.status, payload };
  }

  return {
    enabled,
    async register(input) {
      if (!enabled) return { ok: false, skipped: true };
      const body = {};
      for (const key of REGISTER_BODY_KEYS) {
        if (input[key] != null && input[key] !== "") body[key] = input[key];
      }
      return request(registerPath, { method: "POST", body });
    },
    async login(input) {
      if (!enabled) return { ok: false, skipped: true };
      return request(loginPath, { method: "POST", body: { email: input.email, password: input.password } });
    },
    async me(token) {
      if (!enabled || !token) return { ok: false, skipped: true };
      return request(mePath, { token });
    },
  };
}

export function extractToken(payload) {
  if (!payload || typeof payload !== "object") return null;
  return (
    payload.accessToken ||
    payload.token ||
    payload.access_token ||
    payload.jwt ||
    (payload.auth && (payload.auth.accessToken || payload.auth.token)) ||
    null
  );
}

export function extractProfile(payload, fallbackEmail) {
  const source = payload?.user || payload?.profile || payload || {};
  return {
    id: String(source.id || source.userId || source.sub || fallbackEmail || ""),
    email: source.email || fallbackEmail || "",
    displayName: source.displayName || source.nickname || source.name || source.firstName || fallbackEmail,
    nickname: source.nickname || "",
  };
}
