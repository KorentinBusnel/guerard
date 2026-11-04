/**
 * Publie le thème forêt comme style hébergé MapMap : `npm run create:style`.
 *
 * - Première fois : `POST /styles` (version 1).
 * - Ensuite (MAPMAP_STYLE_ID connu) : `POST /styles/{id}` avec `{ theme }`, nouvelle
 *   version immuable.
 * Écrit l'URL versionnée dans `.env.local` (VITE_MAPMAP_STYLE_URL), lue par Vite.
 * Requiert MAPMAP_API_KEY (clé serveur, `.env`).
 */
import fs from "node:fs";
import path from "node:path";
import { forestTheme } from "../src/map/theme";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_LOCAL = path.join(ROOT, ".env.local");
const BASE = process.env.MAPMAP_BASE_URL ?? "https://api.mapmap.ai";

for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(ROOT, file));
  } catch {
    // fichier absent
  }
}

function upsertEnv(file: string, values: Record<string, string>) {
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  for (const [k, v] of Object.entries(values)) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text}${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`;
  }
  fs.writeFileSync(file, text);
}

async function main() {
  const key = process.env.MAPMAP_API_KEY;
  if (!key) {
    console.error("MAPMAP_API_KEY manquant (clé serveur snk_… dans .env). Voir .env.example.");
    process.exit(1);
  }
  const id = process.env.MAPMAP_STYLE_ID;
  const url = id ? `${BASE}/styles/${encodeURIComponent(id)}` : `${BASE}/styles`;
  const body = id ? { theme: forestTheme } : { name: forestTheme.name, theme: forestTheme };

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    // 422 : `problems` nomme le slot/la couche fautive et les valeurs acceptées
    console.error(`${id ? "Publication" : "Création"} refusée : HTTP ${res.status}\n${text}`);
    process.exit(1);
  }
  const out = JSON.parse(text) as { id: string; version: number; style_url: string };
  upsertEnv(ENV_LOCAL, { MAPMAP_STYLE_ID: out.id, VITE_MAPMAP_STYLE_URL: out.style_url });
  console.log(`✔ Style ${out.id} v${out.version}\n  ${out.style_url}\n  → .env.local (relancer npm run dev)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
