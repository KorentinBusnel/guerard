// MapLibre 6 charge son worker via `import.meta.url`, que Vite ne résout pas :
// sans ces deux fichiers servis par l'app, la carte reste blanche (cf. docs MapMap,
// « Under a bundler, serve the worker yourself »). Copiés à chaque dev/build pour
// rester alignés sur la version installée de maplibre-gl.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const from = path.join(root, "node_modules/maplibre-gl/dist");
const to = path.join(root, "public/vendor/maplibre");
fs.mkdirSync(to, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  fs.copyFileSync(path.join(from, file), path.join(to, file));
}
console.log("maplibre worker → public/vendor/maplibre/");
