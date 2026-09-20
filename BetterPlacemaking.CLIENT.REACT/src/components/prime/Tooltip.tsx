import { Children, cloneElement, isValidElement, useEffect, useRef, type ReactElement, type ReactNode } from "react";

/**
 * Port of PrimeNG's `pTooltip` directive. Wrap the single element that carries the directive; no extra DOM is added.
 * The tooltip is created imperatively exactly like PrimeNG: `div.p-tooltip.p-component.p-tooltip-<pos>[role=tooltip] > div.p-tooltip-arrow + div.p-tooltip-text`
 * appended to document.body, aligned with PrimeNG's alignTop/Bottom/Left/Right (+ fallbacks when out of viewport), faded in over 250ms.
 *
 *   <Tooltip content="Delete" position="left"><Button icon="pi pi-trash" /></Tooltip>
 *   <Tooltip content={disabled ? "Why disabled" : ""} position="top"> ... </Tooltip>   (empty content = no tooltip)
 *
 * The child must forward onMouseEnter/onMouseLeave/onFocus/onBlur/onClick and `ref` (DOM elements and the Button component do).
 */
export type TooltipPosition = "top" | "bottom" | "left" | "right";
export interface TooltipProps {
  content?: ReactNode | string | null;
  /** PrimeNG default is "right" */
  position?: TooltipPosition;
  showDelay?: number;
  hideDelay?: number;
  /** ms after which the tooltip hides itself */
  life?: number;
  disabled?: boolean;
  /** treat string content as text (default true, like `[escape]`); false renders HTML */
  escape?: boolean;
  /** PrimeNG tooltipStyleClass */
  className?: string;
  positionStyle?: string;
  positionTop?: number;
  positionLeft?: number;
  /** "hover" (default) or "focus" */
  event?: "hover" | "focus" | "both";
  autoHide?: boolean;
  appendTo?: "body" | "target" | HTMLElement;
  children: ReactElement;
}

let z = 1100;

export function Tooltip({ content, position = "right", showDelay, hideDelay, life, disabled, escape = true, className, positionStyle, positionTop = 0, positionLeft = 0, event = "hover", autoHide = true, appendTo = "body", children }: TooltipProps) {
  const child = Children.only(children);
  const elRef = useRef<HTMLElement | null>(null);
  const container = useRef<HTMLDivElement | null>(null);
  const showT = useRef<number | undefined>(undefined);
  const hideT = useRef<number | undefined>(undefined);
  const lifeT = useRef<number | undefined>(undefined);
  const opts = useRef({ content, position, escape, className, positionStyle, positionTop, positionLeft, appendTo, disabled, life, showDelay, hideDelay, autoHide });
  opts.current = { content, position, escape, className, positionStyle, positionTop, positionLeft, appendTo, disabled, life, showDelay, hideDelay, autoHide };

  const remove = () => {
    container.current?.remove();
    container.current = null;
  };
  const clearAll = () => {
    window.clearTimeout(showT.current);
    window.clearTimeout(hideT.current);
    window.clearTimeout(lifeT.current);
    showT.current = hideT.current = lifeT.current = undefined;
  };
  const hide = () => {
    clearAll();
    remove();
  };

  const show = () => {
    const o = opts.current;
    const host = elRef.current;
    if (!host || o.disabled || o.content === undefined || o.content === null || o.content === "" || typeof o.content === "boolean") return;
    remove();
    const c = document.createElement("div");
    c.className = "p-tooltip p-component";
    c.setAttribute("role", "tooltip");
    c.setAttribute("data-pc-section", "root");
    const arrow = document.createElement("div");
    arrow.className = "p-tooltip-arrow";
    arrow.setAttribute("data-pc-section", "arrow");
    const text = document.createElement("div");
    text.className = "p-tooltip-text";
    text.setAttribute("data-pc-section", "text");
    if (typeof o.content === "string" && !o.escape) text.innerHTML = o.content;
    else text.textContent = typeof o.content === "string" || typeof o.content === "number" ? String(o.content) : "";
    c.appendChild(arrow);
    c.appendChild(text);
    if (o.positionStyle) c.style.position = o.positionStyle;
    (o.appendTo === "body" ? document.body : o.appendTo === "target" ? host : o.appendTo).appendChild(c);
    c.style.display = "none";
    c.style.pointerEvents = o.autoHide ? "none" : "unset";
    container.current = c;
    c.style.display = "inline-block";

    const hostOffset = () => {
      if (o.appendTo === "body" || o.appendTo === "target") {
        const r = host.getBoundingClientRect();
        return { left: r.left + (window.pageXOffset || 0), top: r.top + (window.pageYOffset || 0) };
      }
      return { left: 0, top: 0 };
    };
    const place = (l: number, t: number) => {
      const h = hostOffset();
      c.style.left = h.left + l + o.positionLeft + "px";
      c.style.top = h.top + t + o.positionTop + "px";
    };
    const pre = (p: string) => {
      c.style.left = "-999px";
      c.style.top = "-999px";
      c.className = ["p-tooltip p-component", "p-tooltip-" + p, o.className].filter(Boolean).join(" ");
    };
    const active = host.nodeName.startsWith("P-") ? (host.querySelector(".p-component") as HTMLElement) ?? host : host;
    const fns: Record<TooltipPosition, () => void> = {
      right: () => {
        pre("right");
        place(active.offsetWidth, (active.offsetHeight - c.offsetHeight) / 2);
        Object.assign(arrow.style, { top: "50%", right: "", bottom: "", left: "0" });
      },
      left: () => {
        pre("left");
        place(-c.offsetWidth, (host.offsetHeight - c.offsetHeight) / 2);
        Object.assign(arrow.style, { top: "50%", right: "0", bottom: "", left: "" });
      },
      top: () => {
        pre("top");
        place((host.offsetWidth - c.offsetWidth) / 2, -c.offsetHeight);
        Object.assign(arrow.style, { top: "", right: "", bottom: "0", left: c.offsetWidth / 2 + "px" });
      },
      bottom: () => {
        pre("bottom");
        place((host.offsetWidth - c.offsetWidth) / 2, host.offsetHeight);
        Object.assign(arrow.style, { top: "0", right: "", bottom: "", left: c.offsetWidth / 2 + "px" });
      },
    };
    const prio: Record<TooltipPosition, TooltipPosition[]> = { top: ["top", "bottom", "right", "left"], bottom: ["bottom", "top", "right", "left"], left: ["left", "right", "top", "bottom"], right: ["right", "left", "top", "bottom"] };
    const oob = () => {
      const r = c.getBoundingClientRect();
      return r.left + c.offsetWidth > window.innerWidth || r.left < 0 || r.top < 0 || r.top + c.offsetHeight > window.innerHeight;
    };
    (prio[o.position] ?? []).forEach((p, i) => {
      if (i === 0) fns[p]();
      else if (oob()) fns[p]();
    });
    c.style.zIndex = String(++z);
    if (typeof c.animate === "function") c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
  };

  const activate = () => {
    const o = opts.current;
    clearAll();
    if (o.showDelay) {
      showT.current = window.setTimeout(show, o.showDelay);
      showT.current;
    } else show();
    if (o.life) lifeT.current = window.setTimeout(hide, o.showDelay ? o.life + o.showDelay : o.life);
  };
  const deactivate = () => {
    const o = opts.current;
    window.clearTimeout(showT.current);
    window.clearTimeout(lifeT.current);
    if (o.hideDelay) hideT.current = window.setTimeout(hide, o.hideDelay);
    else hide();
  };

  useEffect(() => {
    if (!container.current) return;
    // live-update text when content changes while visible
    const t = container.current.querySelector(".p-tooltip-text");
    if (t && typeof content === "string") t.textContent = content;
    if (!content) hide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);
  useEffect(() => {
    const onResize = () => hide();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      hide();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isValidElement(child)) return child;
  const cp = child.props as Record<string, any>;
  const chain = (name: string, fn: (e: any) => void) => (e: any) => {
    fn(e);
    cp[name]?.(e);
  };
  const childRef = (child as any).props?.ref ?? (child as any).ref;
  const setRef = (el: HTMLElement | null) => {
    elRef.current = el;
    if (typeof childRef === "function") childRef(el);
    else if (childRef && typeof childRef === "object") childRef.current = el;
  };
  const handlers: Record<string, unknown> = { ref: setRef };
  if (event === "hover" || event === "both") {
    handlers.onMouseEnter = chain("onMouseEnter", (e) => {
      elRef.current = e.currentTarget.closest?.("p-button") ?? e.currentTarget;
      if (!container.current && !showT.current) activate();
    });
    handlers.onMouseLeave = chain("onMouseLeave", () => deactivate());
    handlers.onClick = chain("onClick", () => deactivate());
  }
  if (event === "focus" || event === "both") {
    handlers.onFocus = chain("onFocus", () => activate());
    handlers.onBlur = chain("onBlur", () => deactivate());
  }
  return cloneElement(child as ReactElement<any>, handlers);
}
