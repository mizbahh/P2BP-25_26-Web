import { createElement, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * Port of PrimeNG's <p-overlay> (overlay mode) + DomHandler.alignOverlay.
 * Renders `<p-overlay hostname data-pc-section="host">` in place; its `div.p-overlay > div.p-overlay-content`
 * lives inside it (appendTo "self") or in document.body (appendTo "body"). Positioning, min-width, z-index,
 * enter (scaleY .8 + fade, .12s) / leave (.1s fade) animation, outside-click / scroll / resize hiding match PrimeNG.
 */
export interface ConnectedOverlayProps {
  visible: boolean;
  /** element the overlay is anchored to (PrimeNG `[target]="'@parent'"`). */
  targetRef: RefObject<HTMLElement | null>;
  hostName: string;
  /** "body" | "self" (default) | CSS selector | element */
  appendTo?: "body" | "self" | string | HTMLElement | null;
  onHide?: (reason: "outside" | "scroll" | "resize") => void;
  /** Called after the overlay has been aligned and shown. */
  onShow?: () => void;
  /** Called once the leave animation is done and the overlay is unmounted. */
  onAfterHide?: () => void;
  styleClass?: string;
  style?: CSSProperties;
  /** Re-run alignment when this changes (e.g. content size changed). */
  alignKey?: unknown;
  /** Set min-width to the anchor's width (Select, AutoComplete, DatePicker(no)). Default true like PrimeNG. */
  matchTargetWidth?: boolean;
  /** Extra DOM element(s) that should not count as "outside" for click handling. */
  children: ReactNode;
}

let zCounter = 0;

function getScrollableParents(el: HTMLElement | null): HTMLElement[] {
  const res: HTMLElement[] = [];
  const rx = /(auto|scroll)/;
  let p = el?.parentElement ?? null;
  while (p) {
    const cs = getComputedStyle(p);
    if (rx.test(cs.overflow) || rx.test(cs.overflowX) || rx.test(cs.overflowY)) res.push(p);
    p = p.parentElement;
  }
  return res;
}

function closestRelative(el: HTMLElement | null): HTMLElement | null {
  while (el) {
    if (getComputedStyle(el).position === "relative") return el;
    el = el.parentElement;
  }
  return null;
}

export function alignOverlay(overlay: HTMLElement, target: HTMLElement, appendTo: "self" | "body" | "other", matchWidth = true) {
  if (matchWidth) overlay.style.minWidth = `${target.offsetWidth}px`;
  const dims = { width: overlay.offsetWidth, height: overlay.offsetHeight };
  const tRect = target.getBoundingClientRect();
  const tH = target.offsetHeight;
  const tW = target.offsetWidth;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = window.innerHeight;
  if (appendTo === "self") {
    const rel = closestRelative(overlay);
    const relRect = rel?.getBoundingClientRect() ?? { top: -scrollTop, left: -scrollLeft };
    let top: number;
    let left: number;
    let origin = "top";
    if (tRect.top + tH + dims.height > vh) {
      top = tRect.top - relRect.top - dims.height;
      origin = "bottom";
      if (tRect.top + top < 0) top = -1 * tRect.top;
    } else {
      top = tH + tRect.top - relRect.top;
    }
    const overflow = tRect.left + dims.width - vw;
    if (dims.width > vw) left = (tRect.left - relRect.left) * -1;
    else if (overflow > 0) left = tRect.left - relRect.left - overflow;
    else left = tRect.left - relRect.left;
    overlay.style.top = top + "px";
    overlay.style.left = left + "px";
    overlay.style.transformOrigin = origin;
    overlay.style.marginTop = origin === "bottom" ? "calc(2px * -1)" : "2px";
  } else {
    let top: number;
    let left: number;
    if (tRect.top + tH + dims.height > vh) {
      top = tRect.top + scrollTop - dims.height;
      overlay.style.transformOrigin = "bottom";
      if (top < 0) top = scrollTop;
    } else {
      top = tH + tRect.top + scrollTop;
      overlay.style.transformOrigin = "top";
    }
    if (tRect.left + dims.width > vw) left = Math.max(0, tRect.left + scrollLeft + tW - dims.width);
    else left = tRect.left + scrollLeft;
    overlay.style.top = top + "px";
    overlay.style.left = left + "px";
    overlay.style.marginTop = overlay.style.transformOrigin.includes("bottom") ? "calc(2px * -1)" : "2px";
  }
}

export function ConnectedOverlay({
  visible,
  targetRef,
  hostName,
  appendTo,
  onHide,
  onShow,
  onAfterHide,
  styleClass,
  style,
  alignKey,
  matchTargetWidth = true,
  children,
}: ConnectedOverlayProps) {
  const [mounted, setMounted] = useState(visible);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const clickedInside = useRef(false);
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  const onAfterHideRef = useRef(onAfterHide);
  onAfterHideRef.current = onAfterHide;

  if (visible && !mounted) setMounted(true);

  const mode: "self" | "body" | "other" = appendTo === "body" ? "body" : !appendTo || appendTo === "self" ? "self" : "other";
  const container: HTMLElement | null =
    mode === "body"
      ? document.body
      : mode === "other"
        ? typeof appendTo === "string"
          ? (document.querySelector(appendTo) as HTMLElement | null)
          : (appendTo as HTMLElement)
        : null;

  const align = useCallback(() => {
    const o = overlayRef.current;
    const t = targetRef.current;
    if (o && t) alignOverlay(o, t, mode, matchTargetWidth);
  }, [targetRef, mode, matchTargetWidth]);

  // enter: position + animate
  useLayoutEffect(() => {
    if (!visible || !mounted) return;
    const o = overlayRef.current;
    const c = contentRef.current;
    if (!o || !c) return;
    o.style.zIndex = String(1000 + ++zCounter);
    align();
    if (typeof c.animate === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      c.animate([{ transform: "scaleY(0.8)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 120, easing: "cubic-bezier(0, 0, 0.2, 1)" });
    }
    onShowRef.current?.();
    return () => {
      zCounter = Math.max(0, zCounter - 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mounted]);

  useLayoutEffect(() => {
    if (visible && mounted) align();
  }, [alignKey, visible, mounted, align]);

  // leave animation
  useEffect(() => {
    if (visible || !mounted) return;
    const c = contentRef.current;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setMounted(false);
      onAfterHideRef.current?.();
    };
    if (c && typeof c.animate === "function") {
      const a = c.animate([{ opacity: 1 }, { transform: "scaleY(0.8)", opacity: 0 }], { duration: 100, easing: "linear", fill: "forwards" });
      a.onfinish = finish;
      a.oncancel = finish;
      return () => {
        done = true;
      };
    }
    finish();
  }, [visible, mounted]);

  // listeners while visible
  useEffect(() => {
    if (!visible) return;
    const hide = (r: "outside" | "scroll" | "resize") => onHideRef.current?.(r);
    const onDocClick = (e: MouseEvent) => {
      const t = targetRef.current;
      const target = e.target as Node | null;
      const targetClicked = !!t && !!target && (t === target || (!clickedInside.current && t.contains(target)));
      const outside = !targetClicked && !clickedInside.current;
      if (outside && e.button !== 2) hide("outside");
      clickedInside.current = false;
    };
    const onResize = () => {
      if (!("ontouchstart" in window || navigator.maxTouchPoints > 0)) hide("resize");
    };
    const onScroll = () => hide("scroll");
    document.addEventListener("click", onDocClick);
    window.addEventListener("resize", onResize);
    const parents = getScrollableParents(targetRef.current);
    parents.forEach((p) => p.addEventListener("scroll", onScroll));
    return () => {
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("resize", onResize);
      parents.forEach((p) => p.removeEventListener("scroll", onScroll));
    };
  }, [visible, targetRef]);

  let overlayEl: ReactNode = null;
  if (mounted) {
    overlayEl = (
      <div
        ref={overlayRef}
        className={["p-component", "p-overlay", styleClass].filter(Boolean).join(" ")}
        data-pc-name="pcoverlay"
        data-pc-extend="overlay"
        data-pc-section="root"
        style={style}
        onClickCapture={() => {
          clickedInside.current = true;
        }}
      >
        <div ref={contentRef} className="p-overlay-content" data-pc-section="content">
          {children}
        </div>
      </div>
    );
  }

  const host = createElement("p-overlay", { hostname: hostName, "data-pc-section": "host" }, mode === "self" || !container ? overlayEl : null);
  return (
    <>
      {host}
      {mode !== "self" && container && overlayEl ? createPortal(overlayEl, container) : null}
    </>
  );
}
