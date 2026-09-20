import {
  createElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { PrimeSvgIcon } from "./PrimeSvgIcon";
import {
  blockBodyScroll,
  currentZIndex,
  getFocusable,
  pushZIndex,
  releaseZIndex,
  unblockBodyScroll,
} from "./primeOverlayUtils";

type DialogPosition = "center" | "top" | "bottom" | "left" | "right" | "topleft" | "topright" | "bottomleft" | "bottomright";

export interface DialogProps {
  /** `[(visible)]` -> `visible` + `onHide`. */
  visible: boolean;
  /**
   * Called when the user asks to close (X button, Escape, dismissable-mask click). Set `visible` to false in it.
   * (PrimeNG's `visibleChange(false)`.)
   */
  onHide?: () => void;
  /** Called after the enter animation / after the leave animation finished (PrimeNG `onShow` / (animation done) part of `onHide`). */
  onShow?: () => void;
  onAfterHide?: () => void;
  header?: string;
  /** PrimeNG `#header` template: replaces the title text (rendered before the header actions). */
  headerTemplate?: ReactNode;
  /** PrimeNG `#footer` template -> `div.p-dialog-footer`. */
  footer?: ReactNode;
  /** Dialog content (PrimeNG default slot / `#content`). */
  children?: ReactNode;

  modal?: boolean;
  dismissableMask?: boolean;
  closable?: boolean;
  closeOnEscape?: boolean;
  /** PrimeNG default true. */
  draggable?: boolean;
  /** PrimeNG default true (renders `.p-resizable-handle`). */
  resizable?: boolean;
  maximizable?: boolean;
  showHeader?: boolean;
  blockScroll?: boolean;
  focusOnShow?: boolean;
  focusTrap?: boolean;
  keepInViewport?: boolean;
  position?: DialogPosition;

  /** PrimeNG `styleClass` -> classes on `div.p-dialog` root. */
  className?: string;
  /** PrimeNG `[style]` -> inline style on `div.p-dialog` root (width/height here). */
  style?: CSSProperties;
  contentStyle?: CSSProperties;
  contentClassName?: string;
  maskClassName?: string;
  maskStyle?: CSSProperties;
  /** `{ "960px": "75vw" }` -> media-query width overrides. */
  breakpoints?: Record<string, string>;
  role?: string;
  closeAriaLabel?: string;
  /** "body" moves the mask to document.body (ConfirmDialog does this); default keeps it inside the `<p-dialog>` host like PrimeNG. */
  appendTo?: "body" | "self" | null;
  baseZIndex?: number;
  /** Internal: `data-pc-name` (PrimeNG: "dialog" | "pcdialog"). */
  pcName?: string;
  /** Internal: host element `hostName` attribute (DynamicDialog). */
  hostName?: string;
}

const TIMING = { duration: 150, easing: "cubic-bezier(0, 0, 0.2, 1)" };
let breakpointSeq = 0;

export function Dialog({
  visible,
  onHide,
  onShow,
  onAfterHide,
  header,
  headerTemplate,
  footer,
  children,
  modal = false,
  dismissableMask = false,
  closable = true,
  closeOnEscape = true,
  draggable = true,
  resizable = true,
  maximizable = false,
  showHeader = true,
  focusOnShow = true,
  focusTrap = true,
  keepInViewport = true,
  position = "center",
  className,
  style,
  contentStyle,
  contentClassName,
  maskClassName,
  maskStyle,
  breakpoints,
  role = "dialog",
  closeAriaLabel,
  appendTo = null,
  baseZIndex = 0,
  pcName = "dialog",
  hostName,
}: DialogProps) {
  const uid = useId();
  const titleId = `pn_id_${uid.replace(/[^a-zA-Z0-9]/g, "")}_header`;
  const [mounted, setMounted] = useState(visible);
  const [leaving, setLeaving] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [z, setZ] = useState<number | null>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onHide, onShow, onAfterHide });
  cb.current = { onHide, onShow, onAfterHide };
  const bpAttr = useRef(`pn_bp_${++breakpointSeq}`).current;

  // mount / unmount with leave animation
  useEffect(() => {
    if (visible) {
      setLeaving(false);
      setMounted(true);
    } else if (mounted) {
      setLeaving(true);
      const el = rootRef.current;
      const anim = el?.animate(
        [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.7)" }],
        { ...TIMING, fill: "forwards" },
      );
      const done = () => {
        setMounted(false);
        setLeaving(false);
        setMaximized(false);
        cb.current.onAfterHide?.();
      };
      if (anim) {
        anim.onfinish = done;
        return () => {
          anim.onfinish = null;
        };
      }
      done();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // z-index, scroll lock, enter animation, focus
  const shownRef = useRef(false);
  useLayoutEffect(() => {
    if (!mounted || shownRef.current) return;
    shownRef.current = true;
    const zi = pushZIndex(baseZIndex);
    setZ(zi);
    if (modal) blockBodyScroll();
    const enter = rootRef.current?.animate([{ opacity: 0, transform: "scale(0.7)" }, { opacity: 1, transform: "none" }], TIMING);
    if (enter) enter.onfinish = () => cb.current.onShow?.();
    let t: number | undefined;
    if (focusOnShow) {
      t = window.setTimeout(() => {
        const pick = [contentRef.current, footerRef.current, headerRef.current].map(getFocusable).find((l) => l.length);
        pick?.[0]?.focus();
      }, 150);
    }
    return () => {
      shownRef.current = false;
      if (t) window.clearTimeout(t);
      releaseZIndex(zi);
      if (modal) unblockBodyScroll();
      setZ(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const close = useCallback(() => cb.current.onHide?.(), []);

  // Escape (topmost dialog only)
  useEffect(() => {
    if (!mounted || !closeOnEscape || !closable || z == null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && currentZIndex() === z) close();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [mounted, closeOnEscape, closable, z, close]);

  // dismissable mask (mousedown on the mask itself)
  useEffect(() => {
    if (!mounted || !modal || !dismissableMask || !closable) return;
    const el = maskRef.current;
    if (!el) return;
    const h = (e: MouseEvent) => {
      if (e.target === el) close();
    };
    el.addEventListener("mousedown", h);
    return () => el.removeEventListener("mousedown", h);
  }, [mounted, modal, dismissableMask, closable, close]);

  // breakpoints -> <style> media queries (same approach as PrimeNG)
  useEffect(() => {
    if (!breakpoints) return;
    const st = document.createElement("style");
    st.textContent = Object.entries(breakpoints)
      .map(([bp, w]) => `@media screen and (max-width: ${bp}) { .p-dialog[${bpAttr}]:not(.p-dialog-maximized) { width: ${w} !important; } }`)
      .join("\n");
    document.head.appendChild(st);
    return () => {
      st.remove();
    };
  }, [breakpoints, bpAttr]);

  // maximize when not modal: lock scroll
  useEffect(() => {
    if (!maximized || modal) return;
    blockBodyScroll();
    return () => unblockBodyScroll();
  }, [maximized, modal]);

  // drag
  const drag = useRef<{ x: number; y: number } | null>(null);
  const onHeaderMouseDown = (e: ReactMouseEvent) => {
    if (!draggable || maximized) return;
    if ((e.target as HTMLElement).closest("button")) return;
    const el = rootRef.current;
    if (!el) return;
    drag.current = { x: e.pageX, y: e.pageY };
    el.style.margin = "0";
    document.body.classList.add("p-unselectable-text");
  };
  const resize = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!mounted) return;
    const move = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (drag.current) {
        const dx = e.pageX - drag.current.x;
        const dy = e.pageY - drag.current.y;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const left = r.left + dx - parseFloat(cs.marginLeft);
        const top = r.top + dy - parseFloat(cs.marginTop);
        el.style.position = "fixed";
        if (keepInViewport) {
          if (left >= 0 && left + r.width < window.innerWidth) {
            el.style.left = `${left}px`;
            drag.current.x = e.pageX;
          }
          if (top >= 0 && top + r.height < window.innerHeight) {
            el.style.top = `${top}px`;
            drag.current.y = e.pageY;
          }
        } else {
          el.style.left = `${left}px`;
          el.style.top = `${top}px`;
          drag.current = { x: e.pageX, y: e.pageY };
        }
      } else if (resize.current) {
        const dx = e.pageX - resize.current.x;
        const dy = e.pageY - resize.current.y;
        const r = el.getBoundingClientRect();
        const moved = !parseInt(el.style.top) || !parseInt(el.style.left);
        const w = r.width + dx * (moved ? 2 : 1);
        const h = r.height + dy * (moved ? 2 : 1);
        if (r.left + w < window.innerWidth) el.style.width = `${w}px`;
        if (r.top + h < window.innerHeight && contentRef.current) {
          contentRef.current.style.height = `${contentRef.current.getBoundingClientRect().height + h - r.height}px`;
          if (el.style.height) el.style.height = `${h}px`;
        }
        resize.current = { x: e.pageX, y: e.pageY };
      }
    };
    const up = () => {
      if (drag.current || resize.current) document.body.classList.remove("p-unselectable-text");
      drag.current = null;
      resize.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [mounted, keepInViewport]);

  // focus trap sentinels
  const focusEdge = (last: boolean) => {
    const list = getFocusable(rootRef.current);
    (last ? list[list.length - 1] : list[0])?.focus();
  };

  const p = position;
  const justify = /left/.test(p) ? "flex-start" : /right/.test(p) ? "flex-end" : "center";
  const align = /^top/.test(p) ? "flex-start" : /^bottom/.test(p) ? "flex-end" : "center";
  const positionCls = ["left", "right", "top", "topleft", "topright", "bottom", "bottomleft", "bottomright"].includes(p) ? `p-dialog-${p}` : "";

  const btnBase = "p-ripple p-button p-button-icon-only p-button-rounded p-button-secondary p-button-text p-component";
  const mask = mounted ? (
    <div
      ref={maskRef}
      className={["p-dialog-mask", modal ? "p-overlay-mask p-overlay-mask-enter" : "", positionCls, leaving && modal ? "p-overlay-mask-leave" : "", maskClassName]
        .filter(Boolean)
        .join(" ")}
      data-pc-section="mask"
      style={{
        position: "fixed",
        height: "100%",
        width: "100%",
        left: 0,
        top: 0,
        display: "flex",
        justifyContent: justify,
        alignItems: align,
        pointerEvents: modal ? "auto" : "none",
        zIndex: z != null ? z - 1 : undefined,
        ...maskStyle,
      }}
    >
      <div
        ref={rootRef}
        {...({ pfocustrap: "", ...(breakpoints ? { [bpAttr]: "" } : {}) } as object)}
        className={["p-dialog p-component", maximized ? "p-dialog-maximized" : "", className].filter(Boolean).join(" ")}
        role={role}
        aria-modal="true"
        aria-labelledby={header != null && !headerTemplate ? titleId : undefined}
        data-pc-name={pcName}
        {...(pcName === "pcdialog" ? { "data-pc-extend": "dialog" } : {})}
        data-pc-section="root"
        style={{ display: "flex", flexDirection: "column", pointerEvents: "auto", ...style, zIndex: z ?? undefined }}
      >
        {focusTrap ? (
          <span
            className="p-hidden-accessible p-hidden-focusable"
            tabIndex={0}
            role="presentation"
            aria-hidden="true"
            data-p-hidden-accessible="true"
            data-p-hidden-focusable="true"
            data-pc-section="firstfocusableelement"
            onFocus={() => focusEdge(true)}
          />
        ) : null}
        {resizable ? (
          <div
            className="p-resizable-handle"
            data-pc-section="resizehandle"
            style={{ zIndex: 90 }}
            onMouseDown={(e) => {
              resize.current = { x: e.pageX, y: e.pageY };
              document.body.classList.add("p-unselectable-text");
            }}
          />
        ) : null}
        {showHeader ? (
          <div ref={headerRef} className="p-dialog-header" data-pc-section="header" onMouseDown={onHeaderMouseDown}>
            {!headerTemplate ? (
              <span id={titleId} className="p-dialog-title" data-pc-section="title">
                {header}
              </span>
            ) : (
              headerTemplate
            )}
            <div className="p-dialog-header-actions" data-pc-section="headeractions">
              {maximizable
                ? createElement(
                    "p-button",
                    { "data-pc-section": "host" },
                    <button
                      type="button"
                      {...({ pripple: "" } as object)}
                      className={`${btnBase} p-dialog-maximize-button`}
                      aria-label={maximized ? "Minimize" : "Maximize"}
                      tabIndex={0}
                      data-pc-name="pcmaximizebutton"
                      data-pc-extend="button"
                      data-pc-section="root"
                      onClick={() => setMaximized((m) => !m)}
                    >
                      <PrimeSvgIcon name={maximized ? "window-minimize" : "window-maximize"} />
                    </button>,
                  )
                : null}
              {closable
                ? createElement(
                    "p-button",
                    { "data-pc-section": "host" },
                    <button
                      type="button"
                      {...({ pripple: "" } as object)}
                      className={`${btnBase} p-dialog-close-button`}
                      aria-label={closeAriaLabel || undefined}
                      data-pc-name="pcclosebutton"
                      data-pc-extend="button"
                      data-pc-section="root"
                      onClick={(e) => {
                        e.preventDefault();
                        close();
                      }}
                    >
                      <PrimeSvgIcon name="times" />
                    </button>,
                  )
                : null}
            </div>
          </div>
        ) : null}
        <div ref={contentRef} className={["p-dialog-content", contentClassName].filter(Boolean).join(" ")} data-pc-section="content" style={contentStyle}>
          {children}
        </div>
        {footer ? (
          <div ref={footerRef} className="p-dialog-footer" data-pc-section="footer">
            {footer}
          </div>
        ) : null}
        {focusTrap ? (
          <span
            className="p-hidden-accessible p-hidden-focusable"
            tabIndex={0}
            role="presentation"
            aria-hidden="true"
            data-p-hidden-accessible="true"
            data-p-hidden-focusable="true"
            data-pc-section="lastfocusableelement"
            onFocus={() => focusEdge(false)}
          />
        ) : null}
      </div>
    </div>
  ) : null;

  return createElement(
    "p-dialog",
    { role: role === "dialog" ? undefined : role, "data-pc-section": "host", ...(hostName ? { hostname: hostName } : {}), ...(header && !hostName && appendTo !== "body" ? { header } : {}) },
    appendTo === "body" && mask ? createPortal(mask, document.body) : mask,
  );
}
