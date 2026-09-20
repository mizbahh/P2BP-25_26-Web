/** Shared helpers for Dialog / Toast / ConfirmDialog (mirrors PrimeNG's ZIndexUtils + blockBodyScroll). Internal. */

const zStack: number[] = [];
const BASE_MODAL = 1100;

/** Like PrimeNG ZIndexUtils.generateZIndex("modal", base): first overlay gets 1102 (mask = 1101), then +2 each. */
export function pushZIndex(base = 0): number {
  const last = zStack.length ? zStack[zStack.length - 1] : BASE_MODAL + base;
  const z = last + 2;
  zStack.push(z);
  return z;
}
export function releaseZIndex(z: number) {
  const i = zStack.lastIndexOf(z);
  if (i >= 0) zStack.splice(i, 1);
}
export function currentZIndex(): number {
  return zStack.length ? zStack[zStack.length - 1] : 0;
}

let scrollLocks = 0;
export function blockBodyScroll() {
  if (scrollLocks++ > 0) return;
  const w = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.setProperty("--p-scrollbar-width", `${w}px`);
  document.body.classList.add("p-overflow-hidden");
}
export function unblockBodyScroll() {
  if (scrollLocks === 0) return;
  if (--scrollLocks > 0) return;
  document.body.classList.remove("p-overflow-hidden");
  document.body.style.removeProperty("--p-scrollbar-width");
}

const FOCUSABLE =
  'button:not([tabindex="-1"]):not([disabled]):not([style*="display:none"]):not([hidden]), [href][clientHeight][clientWidth]:not([tabindex="-1"]):not([disabled]), input:not([tabindex="-1"]):not([disabled]), select:not([tabindex="-1"]):not([disabled]), textarea:not([tabindex="-1"]):not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled]), [contenteditable]:not([tabindex="-1"]):not([disabled])';

export function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !el.hasAttribute("data-p-hidden-focusable") && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden",
  );
}

export const PRIME_TRANSITION = "150ms cubic-bezier(0, 0, 0.2, 1)";
