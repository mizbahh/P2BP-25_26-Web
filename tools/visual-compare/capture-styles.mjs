import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export default async function run(page) {
  const api = "http://localhost:5123";
  const login = await fetch(`${api}/api/login/authenticate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "demo@example.com", password: "DemoPass123!" }) }).then(r => r.json());
  const projects = await fetch(`${api}/api/project`, { headers: { Authorization: `Bearer ${login.Token}` } }).then(r => r.json());
  const P = projects.find(p => p.Title === "Demo Plaza")?.Id ?? projects[0].Id;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://localhost:4200/login", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(600);
  const inputs = await page.locator("input").all();
  await inputs[0].fill("demo@example.com"); await page.locator('input[type="password"]').first().fill("DemoPass123!");
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.waitForTimeout(2200);
  const seen = {};
  const dump = () => page.evaluate(() => [...document.querySelectorAll("style")].map(s => ({ id: s.getAttribute("data-primeng-style-id"), css: s.textContent })));
  for (const r of ["/projects", `/${P}/dashboard`, `/${P}/devices`, `/${P}/vision`, `/${P}/fusion`, `/${P}/model`, `/${P}/admin/permissions`, `/${P}/admin/users`, "/user-settings"]) {
    await page.goto("http://localhost:4200" + r, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1500);
    for (const s of await dump()) if (s.id && s.id !== "fa-auto-css" && !seen[s.id]) seen[s.id] = s.css;
  }
  const arr = Object.entries(seen).map(([id, css]) => ({ id, len: css.length, css }));
  fs.writeFileSync(path.join(HERE, "out/all-styles.json"), JSON.stringify(arr));
  return arr.map(a => a.id).join(" ");
}
