import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { createStore } from "./db.js";

dotenv.config();

const email = String(process.env.TPPLAKA_ADMIN_EMAIL || "").trim().toLowerCase();
const password = String(process.env.TPPLAKA_ADMIN_PASSWORD || "");
if (!email.includes("@") || password.length < 12) {
  throw new Error("TPPLAKA_ADMIN_EMAIL and a 12+ character TPPLAKA_ADMIN_PASSWORD are required.");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const store = createStore(path.resolve(root, process.env.DATA_DIR || "./data"));
if (store.hasAdmins()) throw new Error("An administrator already exists; bootstrap refused.");

const user = store.createLocalUser({
  email,
  passwordHash: await bcrypt.hash(password, 12),
  displayName: email,
  role: "admin",
});
console.log(`Administrator created for ${user.email}. Remove TPPLAKA_ADMIN_PASSWORD now.`);