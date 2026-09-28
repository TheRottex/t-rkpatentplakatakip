const TOKEN_KEY = "bloktakip_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { ...options, headers, body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "İstek başarısız.");
  return payload;
}

export const api = {
  health: () => request("/api/health"),
  search: (q) => request(`/api/plates/search?q=${encodeURIComponent(q)}`),
  me: () => request("/api/me"),
  login: (body) => request("/api/auth/login", { method: "POST", body }),
  register: (body) => request("/api/auth/register", { method: "POST", body }),
  plates: () => request("/api/plates"),
  addPlate: (body) => request("/api/plates", { method: "POST", body }),
  removePlate: (id) => request(`/api/plates/${id}`, { method: "DELETE" }),
};
