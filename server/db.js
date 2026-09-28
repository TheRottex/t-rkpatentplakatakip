import fs from "node:fs";
import path from "node:path";

export function createStore(dataDir, seedCsv) {
  fs.mkdirSync(dataDir, { recursive: true });
  const platesPath = path.join(dataDir, "plates.json");
  const usersPath = path.join(dataDir, "users.json");

  let plates = readJson(platesPath, []);
  let users = readJson(usersPath, []);

  if (!plates.length && seedCsv && fs.existsSync(seedCsv)) {
    plates = parseCsv(fs.readFileSync(seedCsv, "utf8"));
    writeJson(platesPath, plates);
  }

  return {
    listPlates() {
      return plates;
    },
    search(query) {
      const key = norm(query);
      if (!key) return { exact: [], similar: [] };
      const exact = plates.filter((row) => norm(row.plaka) === key);
      if (exact.length) return { exact, similar: [] };
      const similar = plates.filter((row) => norm(row.plaka).includes(key)).slice(0, 24);
      return { exact: [], similar };
    },
    addPlate(row) {
      const item = {
        id: crypto.randomUUID(),
        plaka: String(row.plaka || "").trim(),
        blok: String(row.blok || "").trim(),
        daire: String(row.daire || "").trim(),
        createdAt: new Date().toISOString(),
      };
      if (!norm(item.plaka) || !item.blok || !item.daire) {
        throw new Error("Plaka, blok ve daire alanlarının tümü gereklidir.");
      }
      if (plates.some((plate) => norm(plate.plaka) === norm(item.plaka))) {
        throw new Error("Bu plaka zaten kayıtlı.");
      }
      plates.push(item);
      writeJson(platesPath, plates);
      return item;
    },
    addPlates(rows) {
      const known = new Set(plates.map((plate) => norm(plate.plaka)));
      const additions = [];
      let duplicates = 0;

      for (const row of rows) {
        const item = {
          id: crypto.randomUUID(),
          plaka: String(row.plaka || "").trim(),
          blok: String(row.blok || "").trim(),
          daire: String(row.daire || "").trim(),
          createdAt: new Date().toISOString(),
        };
        const key = norm(item.plaka);
        if (!key || !item.blok || !item.daire) {
          throw new Error("Plaka, blok ve daire alanlarının tümü gereklidir.");
        }
        if (known.has(key)) {
          duplicates += 1;
          continue;
        }
        known.add(key);
        additions.push(item);
      }

      if (additions.length) {
        plates.push(...additions);
        writeJson(platesPath, plates);
      }
      return { added: additions.length, duplicates };
    },
    removePlate(id) {
      const before = plates.length;
      plates = plates.filter((row) => row.id !== id);
      writeJson(platesPath, plates);
      return before !== plates.length;
    },
    stats() {
      const blocks = new Set(plates.map((row) => row.blok).filter(Boolean));
      return { rows: plates.length, uniquePlates: new Set(plates.map((row) => norm(row.plaka))).size, blocks: blocks.size };
    },
    findUserByEmail(email) {
      return users.find((u) => u.email.toLowerCase() === String(email).toLowerCase()) || null;
    },
    findUserById(id) {
      return users.find((u) => u.id === id) || null;
    },
    upsertVortexUser(profile) {
      const email = String(profile.email || "").toLowerCase();
      let user = users.find((u) => u.vortexId === profile.id || (email && u.email === email));
      if (!user) {
        user = {
          id: crypto.randomUUID(),
          email,
          displayName: profile.displayName || profile.nickname || email,
          vortexId: profile.id || null,
          passwordHash: null,
          role: "member",
          createdAt: new Date().toISOString(),
        };
        users.push(user);
      } else {
        user.vortexId = profile.id || user.vortexId;
        user.displayName = profile.displayName || profile.nickname || user.displayName;
        if (email) user.email = email;
      }
      writeJson(usersPath, users);
      return user;
    },
    createLocalUser({ email, passwordHash, displayName, role = "member" }) {
      if (this.findUserByEmail(email)) throw new Error("Bu e-posta zaten kayıtlı.");
      const user = {
        id: crypto.randomUUID(),
        email: String(email).toLowerCase(),
        displayName: displayName || email,
        vortexId: null,
        passwordHash,
        role,
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      writeJson(usersPath, users);
      return user;
    },
    hasAdmins() {
      return users.some((user) => user.role === "admin");
    },
  };
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

export function norm(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function parseCsv(text) {
  const rows = [];
  for (const line of String(text).split(/\r?\n/)) {
    const ln = line.trim();
    if (!ln || ln.startsWith("#")) continue;
    if (/blok|daire|plaka/i.test(ln) && /[;,\t]/.test(ln)) continue;
    let parts;
    if (ln.includes(";")) parts = ln.split(";");
    else if (ln.includes(",")) parts = ln.split(",");
    else if (ln.includes("\t")) parts = ln.split("\t");
    else parts = ln.split(/\s+/);
    parts = parts.map((part) => part.trim());
    if (parts.length < 3) continue;
    let plaka, blok, daire;
    if (/^\d{2}/.test(parts[0]) || /^[A-Z]/i.test(parts[0])) {
      plaka = parts[0];
      blok = parts[1];
      daire = parts[2];
    } else {
      blok = parts[0];
      daire = parts[1];
      plaka = parts[2];
    }
    if (!norm(plaka)) continue;
    rows.push({
      id: crypto.randomUUID(),
      plaka,
      blok,
      daire,
      createdAt: new Date().toISOString(),
    });
  }
  return rows;
}
