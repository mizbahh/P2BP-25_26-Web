import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CSS = fs.readFileSync(path.join(HERE, "../../BetterPlacemaking.CLIENT.REACT/src/theme/aura-cyan.css"), "utf8");
const extra = `<p-tag class="p-tag p-component p-tag-success"><span class="p-tag-label">Active</span></p-tag> <p-tag class="p-tag p-component"><span class="p-tag-label">Primary</span></p-tag>
<p-message class="p-message p-component p-message-info"><div class="p-message-content"><span class="p-message-text">Info message</span></div></p-message>
<p-checkbox class="p-checkbox p-component"><input type="checkbox" class="p-checkbox-input"><div class="p-checkbox-box"></div></p-checkbox>`;
const grab = () => {
  const P = ["color","background-color","border-top-color","border-top-width","border-radius","box-shadow","opacity"];
  const root = document.querySelector(".p-card"); const out = [];
  for (const e of [root, ...root.querySelectorAll("*")]) { const c = getComputedStyle(e); const o = { t: e.tagName + "." + (e.getAttribute("class") || "") }; for (const p of P) o[p] = c.getPropertyValue(p); out.push(o); }
  return out;
};
export default async function run(page) {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto("http://localhost:4200/login", { waitUntil: "load" }).catch(() => {});
  await page.waitForTimeout(1200);
  const card = await page.evaluate(() => document.querySelector(".p-card").outerHTML);
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  const res = {};
  for (const m of ["light", "dark"]) {
    await page.evaluate((d) => document.documentElement.classList.toggle("app-dark-mode", d), m === "dark");
    await page.waitForTimeout(300);
    res["ref-" + m] = await page.evaluate(`(${grab.toString()})()`);
  }
  const bg = (m) => (m === "dark" ? "var(--p-surface-950)" : "var(--p-surface-0)");
  for (const m of ["light", "dark"]) {
    await page.setContent(`<!doctype html><html class="${m === "dark" ? "app-dark-mode" : ""}"><head><style>${CSS}</style><style>html{font-size:14px}body{margin:0;padding:24px;font-family:${font};background:${bg(m)};color:var(--p-text-color)}</style></head><body>${extra}<br>${card}</body></html>`);
    await page.waitForTimeout(300);
    res["new-" + m] = await page.evaluate(`(${grab.toString()})()`);
    await page.screenshot({ path: path.join(HERE, "out", `theme-check-${m}.png`) });
  }
  let d = 0, t = 0;
  for (const m of ["light", "dark"]) res["ref-" + m].forEach((a, i) => { const b = res["new-" + m][i]; for (const k in a) { if (k === "t") continue; t++; if (a[k] !== b[k]) { d++; if (d < 20) console.log(m, a.t.slice(0, 40), k, a[k], "|", b[k]); } } });
  return `elements ${res["ref-light"].length}/${res["new-light"].length}, props compared ${t}, diffs ${d}`;
}
