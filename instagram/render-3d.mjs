// Renderiza os objetos 3D de 3d/scene.html em PNG transparente (3d/<obj>.png).
// Uso: node render-3d.mjs            (todos)
//      node render-3d.mjs coin hook  (só esses)
import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ALL = ["logo", "logo-dark", "coin", "megaphone", "gear", "cursor", "chart", "hook"];
const objs = process.argv.length > 2 ? process.argv.slice(2) : ALL;

// WebGL por software, funciona sem GPU
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
page.on("pageerror", e => console.error("erro na página:", e.message));

for (const obj of objs) {
  await page.goto(pathToFileURL(join(here, "3d", "scene.html")).href + `?obj=${obj}`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.locator("canvas").screenshot({ path: join(here, "3d", `${obj}.png`), omitBackground: true });
  console.log(`3d/${obj}.png`);
}

await browser.close();
