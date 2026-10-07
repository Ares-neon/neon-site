// Exporta cada slide como PNG 1080x1350 em out/<nome>/.
// Uso: node render.mjs erros dr julia
//   erros    → erros.html
//   dr/julia → case.html?c=dr (chaves de cases.js)
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const keys = process.argv.slice(2);
if (!keys.length) keys.push("dr");

const urlFor = key => existsSync(join(here, `${key}.html`))
  ? pathToFileURL(join(here, `${key}.html`)).href
  : pathToFileURL(join(here, "case.html")).href + `?c=${key}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1160, height: 1400 } });

for (const key of keys) {
  await page.goto(urlFor(key), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const out = join(here, "out", key);
  await mkdir(out, { recursive: true });
  const slides = await page.$$(".slide");
  for (const [i, el] of slides.entries()) {
    await el.screenshot({ path: join(out, `${String(i + 1).padStart(2, "0")}.png`) });
  }
  const pending = await page.$$eval(".ph, .slot", els => els.length);
  console.log(`${key}: ${slides.length} slides em ${out}` + (pending ? ` · ${pending} campos ainda em amarelo` : " · pronto para postar"));
}

await browser.close();
