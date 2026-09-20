// Pixel-diffs two PNGs (ref vs new) and writes a highlighted diff image. No dependencies (uses the headless browser's canvas).
//
//   DIFF_A=/abs/ref.png DIFF_B=/abs/new.png [DIFF_OUT=/abs/diff.png] [DIFF_THRESHOLD=24]
//   node ~/.claude/skills/browser-automation/browser.mjs about:blank --script tools/visual-compare/diff.mjs
//
// Returns { differingPercent, size, hotCells } - hotCells is a 12x8 grid ranking where the differences are (x/y in px).
// The diff image shows ref dimmed, with differing pixels in red.
import fs from "node:fs";

export default async function run(page) {
  const a = fs.readFileSync(process.env.DIFF_A).toString("base64");
  const b = fs.readFileSync(process.env.DIFF_B).toString("base64");
  const threshold = Number(process.env.DIFF_THRESHOLD || 24);
  const res = await page.evaluate(
    async ({ a, b, threshold }) => {
      const load = (d) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + d; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const x = c.getContext("2d", { willReadFrequently: true });
      x.fillStyle = "#f0f"; x.fillRect(0, 0, w, h); x.drawImage(ia, 0, 0);
      const da = x.getImageData(0, 0, w, h);
      x.fillStyle = "#0f0"; x.fillRect(0, 0, w, h); x.drawImage(ib, 0, 0);
      const db = x.getImageData(0, 0, w, h);
      const out = x.createImageData(w, h);
      const GX = 12, GY = 8, cells = new Array(GX * GY).fill(0);
      let diff = 0;
      for (let i = 0; i < w * h; i++) {
        const p = i * 4;
        const d = Math.abs(da.data[p] - db.data[p]) + Math.abs(da.data[p + 1] - db.data[p + 1]) + Math.abs(da.data[p + 2] - db.data[p + 2]);
        if (d > threshold) {
          diff++;
          out.data[p] = 255; out.data[p + 1] = 0; out.data[p + 2] = 0; out.data[p + 3] = 255;
          const px = i % w, py = (i / w) | 0;
          cells[Math.min(GY - 1, ((py / h) * GY) | 0) * GX + Math.min(GX - 1, ((px / w) * GX) | 0)]++;
        } else {
          const g = 255 - (255 - da.data[p]) * 0.25;
          out.data[p] = out.data[p + 1] = out.data[p + 2] = g; out.data[p + 3] = 255;
        }
      }
      x.putImageData(out, 0, 0);
      const cw = w / GX, ch = h / GY;
      const hotCells = cells
        .map((n, i) => ({ x: Math.round((i % GX) * cw), y: Math.round(((i / GX) | 0) * ch), w: Math.round(cw), h: Math.round(ch), diffPercent: Math.round((n / (cw * ch)) * 1000) / 10 }))
        .filter((c) => c.diffPercent > 0.5)
        .sort((p, q) => q.diffPercent - p.diffPercent)
        .slice(0, 10);
      return { differingPercent: Math.round((diff / (w * h)) * 10000) / 100, size: [ia.width, ia.height, ib.width, ib.height], hotCells, png: c.toDataURL("image/png").split(",")[1] };
    },
    { a, b, threshold },
  );
  const out = process.env.DIFF_OUT || process.env.DIFF_B.replace(/\.png$/, "-diff.png");
  fs.writeFileSync(out, Buffer.from(res.png, "base64"));
  delete res.png;
  return { ...res, diffImage: out };
}
