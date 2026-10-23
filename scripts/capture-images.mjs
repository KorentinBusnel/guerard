// Images statiques capturées depuis la page elle-même : `npm run capture:images`
// (après `npm run build`). Sert l'image OG et le fond de carte sans WebGL tant que le
// rendu Static Map de MapMap ne couvre pas la France (cf. scripts/static-map.ts).
//
// Navigateur : CHROME_PATH (exécutable Chromium/Chrome), sinon le Chrome installé.
// La carte (logo MapMap + attribution compris) est capturée telle qu'affichée.
import fs from "node:fs";
import path from "node:path";
import { preview } from "vite";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "public/img");
const shots = [
  { mode: "og", file: "og.jpg", width: 1200, height: 630, type: "image/jpeg", quality: 0.86 },
  { mode: "fallback", file: "carte-fallback.webp", width: 1280, height: 800, type: "image/webp", quality: 0.8 },
];

const server = await preview({ root, preview: { port: 4179, strictPort: true }, logLevel: "warn" });
const base = "http://localhost:4179/";
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" }),
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
try {
  fs.mkdirSync(outDir, { recursive: true });
  for (const s of shots) {
    const page = await browser.newPage({ viewport: { width: s.width, height: s.height } });
    await page.goto(`${base}?capture=${s.mode}`);
    await page.waitForSelector("html.map-ready", { timeout: 120_000 });
    // attendre que les tuiles du cadrage final soient là
    await page.waitForFunction(() => document.body.hasAttribute("data-map-ready"), null, { timeout: 120_000 });
    await page.waitForTimeout(4000);
    const png = await page.screenshot({ type: "png" });
    // ré-encodage (WebP/JPEG) par le navigateur : pas de dépendance d'image native
    const dataUrl = await page.evaluate(
      async ({ b64, type, quality }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext("2d").drawImage(img, 0, 0);
        return c.toDataURL(type, quality);
      },
      { b64: png.toString("base64"), type: s.type, quality: s.quality },
    );
    fs.writeFileSync(path.join(outDir, s.file), Buffer.from(dataUrl.split(",")[1], "base64"));
    console.log(`✔ public/img/${s.file}`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
