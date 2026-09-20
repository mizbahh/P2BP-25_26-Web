// Prints bounding boxes + a few computed styles for selectors, so ref vs new can be diffed numerically.
//
//   SHOT_APP=ref|new  SHOT_PATH=/{P}/dashboard  MEASURE='[".main-wrapper > div:first-child", "nav"]'  [SHOT_DARK=1] [SHOT_CLICK=..]
//   node ~/.claude/skills/browser-automation/browser.mjs http://localhost:4200/login --script tools/visual-compare/measure.mjs
//
// Output (JSON): { selector: [ { x, y, w, h, fontSize, fontWeight, color, bg, padding, margin, radius } ... first 4 matches ] }
import shot from "./shot.mjs";

export default async function run(page) {
  process.env.SHOT_OUT = process.env.SHOT_OUT || "/dev/null";
  await shot(page).catch(() => {});
  const selectors = JSON.parse(process.env.MEASURE || "[]");
  return page.evaluate((sels) => {
    const out = {};
    for (const sel of sels) {
      out[sel] = [...document.querySelectorAll(sel)].slice(0, 4).map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const r1 = (n) => Math.round(n * 10) / 10;
        return {
          x: r1(r.x), y: r1(r.y), w: r1(r.width), h: r1(r.height),
          fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight, color: cs.color, bg: cs.backgroundColor,
          padding: cs.padding, margin: cs.margin, radius: cs.borderRadius, border: cs.border,
        };
      });
    }
    return out;
  }, selectors);
}
