import { useEffect, type RefObject } from "react";

/**
 * PrimeNG `pRipple` port. Adds the `p-ripple` class (callers put it in their className) and, when ripple is
 * enabled globally (PrimeNG `providePrimeNG({ ripple: true })`, off in the original app), appends the
 * `span.p-ink` element and animates it on mousedown - exactly what the directive does.
 */
export const RIPPLE_CLASS = "p-ripple";

export const rippleConfig = { enabled: false };

export function setRippleEnabled(enabled: boolean) {
  rippleConfig.enabled = enabled;
}

export function useRipple(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !rippleConfig.enabled) return;
    const ink = document.createElement("span");
    ink.className = "p-ink";
    ink.setAttribute("aria-hidden", "true");
    ink.setAttribute("role", "presentation");
    el.appendChild(ink);
    let timeout: number | undefined;
    const onEnd = () => {
      if (timeout) window.clearTimeout(timeout);
      ink.classList.remove("p-ink-active");
    };
    const onDown = (e: MouseEvent) => {
      if (getComputedStyle(ink).display === "none") return;
      ink.classList.remove("p-ink-active");
      if (!ink.offsetHeight && !ink.offsetWidth) {
        const d = Math.max(el.offsetWidth, el.offsetHeight);
        ink.style.height = `${d}px`;
        ink.style.width = `${d}px`;
      }
      const rect = el.getBoundingClientRect();
      ink.style.top = `${e.clientY - rect.top - ink.offsetHeight / 2}px`;
      ink.style.left = `${e.clientX - rect.left - ink.offsetWidth / 2}px`;
      ink.classList.add("p-ink-active");
      timeout = window.setTimeout(() => ink.classList.remove("p-ink-active"), 401);
    };
    ink.addEventListener("animationend", onEnd);
    el.addEventListener("mousedown", onDown);
    return () => {
      el.removeEventListener("mousedown", onDown);
      ink.removeEventListener("animationend", onEnd);
      if (timeout) window.clearTimeout(timeout);
      ink.remove();
    };
  }, [ref]);
}
