const TOKEN_KEY = "bloktakip_token";
const OFFLINE_PLATES_KEY = "tpplaka_offline_plates_v1";
const OFFLINE_USER_KEY = "tpplaka_offline_user_v1";
const OFFLINE_ENABLED = import.meta.env?.VITE_OFFLINE_ENABLED === "true";

export function isOfflineEnabled() {
  return OFFLINE_ENABLED;
}

export function getOfflineSnapshot() {
  if (!OFFLINE_ENABLED) return null;
  try {
    const snapshot = JSON.parse(localStorage.getItem(OFFLINE_PLATES_KEY) || "null");
    return Array.isArray(snapshot?.items) ? snapshot : null;
  } catch {
    return null;
  }
}

export function getOfflineUser() {
  if (!OFFLINE_ENABLED) return null;
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveOfflineUser(user) {
  if (!OFFLINE_ENABLED || !user) return;
  try {
    localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(user));
  } catch {
    // Offline fallback remains optional if browser storage is unavailable.
  }
}

export function clearOfflineData() {
  try {
    localStorage.removeItem(OFFLINE_PLATES_KEY);
    localStorage.removeItem(OFFLINE_USER_KEY);
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}

function saveOfflineSnapshot(payload) {
  if (!OFFLINE_ENABLED || !Array.isArray(payload.items)) return;
  try {
    localStorage.setItem(OFFLINE_PLATES_KEY, JSON.stringify({
      items: payload.items,
      stats: payload.stats,
      savedAt: new Date().toISOString(),
    }));
  } catch {
    throw new Error("Çevrimdışı kayıtlar bu cihazda saklanamadı. Cihaz depolama alanını kontrol edin.");
  }
}

function cachedPlatesOrThrow() {
  const snapshot = getOfflineSnapshot();
  if (!snapshot?.items?.length) {
    throw new Error("Bu cihazda çevrimdışı veri yok. İnternet bağlantısıyla giriş yapıp verileri eşitleyin.");
  }
  return snapshot;
}

export function searchCachedPlates(items, query) {
  const key = String(query || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!key) return { query: query || "", exact: [], similar: [] };
  const exact = items.filter((row) => String(row.plaka || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === key);
  if (exact.length) return { query, exact, similar: [] };
  const similar = items.filter((row) => String(row.plaka || "").toUpperCase().replace(/[^A-Z0-9]/g, "").includes(key)).slice(0, 24);
  return { query, exact: [], similar };
}

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
  const response = await fetch(path, {
    ...options,
    headers,
    cache: options.method && options.method !== "GET" ? options.cache : "no-store",
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "İstek başarısız.");
  return payload;
}

export const api = {
  health: () => request("/api/health"),
  search: async (q) => {
    if (OFFLINE_ENABLED && navigator.onLine === false) {
      return searchCachedPlates(cachedPlatesOrThrow().items, q);
    }
    try {
      return await request(`/api/plates/search?q=${encodeURIComponent(q)}`);
    } catch (error) {
      if (!OFFLINE_ENABLED) throw error;
      return searchCachedPlates(cachedPlatesOrThrow().items, q);
    }
  },
  me: () => request("/api/me"),
  login: (body) => request("/api/auth/login", { method: "POST", body }),
  register: (body) => request("/api/auth/register", { method: "POST", body }),
  plates: async () => {
    if (OFFLINE_ENABLED && navigator.onLine === false) return cachedPlatesOrThrow();
    try {
      const payload = await request("/api/plates");
      saveOfflineSnapshot(payload);
      return payload;
    } catch (error) {
      if (!OFFLINE_ENABLED) throw error;
      return cachedPlatesOrThrow();
    }
  },
  addPlate: (body) => request("/api/plates", { method: "POST", body }),
  downloadPlateTemplate: async () => {
    const token = getToken();
    const response = await fetch("/api/plates/template", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Excel şablonu indirilemedi.");
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "tpplaka-plaka-sablonu.xlsx";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  importPlates: (file) => {
    const body = new FormData();
    body.append("file", file);
    return request("/api/plates/import", { method: "POST", body });
  },
  removePlate: (id) => request(`/api/plates/${id}`, { method: "DELETE" }),
};
