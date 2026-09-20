import { forwardRef, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Button } from "./Button";
import { classNames, host, MinusIcon, PlusIcon, useUniqueId } from "./internal/basic";

export interface PanelToggleEvent {
  originalEvent: MouseEvent | KeyboardEvent;
  collapsed: boolean;
}

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "children" | "onToggle" | "onBeforeToggle"> {
  /** Plain text title (`span.p-panel-title`). */
  header?: string;
  toggleable?: boolean;
  /** Controlled collapsed state (PrimeNG `[(collapsed)]`). Omit for uncontrolled. */
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  /** Called with the new collapsed value (PrimeNG `collapsedChange`). */
  onCollapsedChange?: (collapsed: boolean) => void;
  onBeforeToggle?: (event: PanelToggleEvent) => void;
  onAfterToggle?: (event: PanelToggleEvent) => void;
  /** Which element toggles: the header icon button (default) or the whole header. */
  toggler?: "icon" | "header";
  iconPos?: "start" | "end" | "center";
  showHeader?: boolean;
  transitionOptions?: string;
  toggleButtonAriaLabel?: string;
  /** `<ng-template #header>`: rendered after the title span. */
  headerTemplate?: ReactNode;
  /** `<ng-template #icons>`: rendered inside `.p-panel-header-actions` before the toggle button. */
  iconsTemplate?: ReactNode;
  /** `<ng-template #headericons>`: replaces the plus/minus icon of the toggle button. */
  headerIconsTemplate?: (collapsed: boolean) => ReactNode;
  /** `<ng-template #footer>` / `<p-footer>`. */
  footerTemplate?: ReactNode;
  children?: ReactNode;
  /** Class on the `p-panel` host (PrimeNG `styleClass` and template `class`). */
  className?: string;
  style?: CSSProperties;
}

/** `<p-panel>`: `p-panel` host > `.p-panel-header` + `.p-panel-content-container` > `.p-panel-content`. */
export const Panel = forwardRef<HTMLElement, PanelProps>(function Panel(
  {
    header, toggleable, collapsed: collapsedProp, defaultCollapsed = false, onCollapsedChange, onBeforeToggle, onAfterToggle,
    toggler = "icon", iconPos = "end", showHeader = true, transitionOptions = "400ms cubic-bezier(0.86, 0, 0.07, 1)",
    toggleButtonAriaLabel, headerTemplate, iconsTemplate, headerIconsTemplate, footerTemplate, children, className, id: idProp, ...rest
  },
  ref,
) {
  const autoId = useUniqueId();
  const id = idProp ?? autoId;
  const [inner, setInner] = useState(defaultCollapsed);
  const collapsed = collapsedProp ?? inner;
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animating = useRef(false);
  const prevCollapsed = useRef(collapsed);
  const lastEvent = useRef<MouseEvent | KeyboardEvent | null>(null);

  const toggle = (e: MouseEvent | KeyboardEvent) => {
    if (animating.current || !toggleable) return;
    animating.current = true;
    lastEvent.current = e;
    onBeforeToggle?.({ originalEvent: e, collapsed });
    const next = !collapsed;
    if (collapsedProp === undefined) setInner(next);
    onCollapsedChange?.(next);
    e.preventDefault();
  };

  // Height animation (PrimeNG animates `height` between 0 and auto) + focusable children tabindex handling.
  useLayoutEffect(() => {
    const el = containerRef.current;
    const wrap = wrapperRef.current;
    if (wrap) {
      wrap.querySelectorAll<HTMLElement>("input, button, select, a, textarea, [tabindex]").forEach((f) => {
        if (collapsed) {
          if (!f.hasAttribute("data-p-tabindex")) f.setAttribute("data-p-tabindex", f.getAttribute("tabindex") ?? "");
          f.setAttribute("tabindex", "-1");
        } else if (f.hasAttribute("data-p-tabindex")) {
          const prev = f.getAttribute("data-p-tabindex");
          if (prev) f.setAttribute("tabindex", prev);
          else f.removeAttribute("tabindex");
          f.removeAttribute("data-p-tabindex");
        }
      });
    }
    if (prevCollapsed.current === collapsed) return;
    prevCollapsed.current = collapsed;
    if (!el) return;
    const done = () => {
      el.style.transition = "";
      if (!collapsed) el.style.height = "";
      el.removeEventListener("transitionend", done);
      animating.current = false;
      const ev = lastEvent.current;
      if (ev) onAfterToggle?.({ originalEvent: ev, collapsed });
    };
    el.style.transition = "none";
    el.style.height = "auto";
    const full = el.scrollHeight;
    el.style.height = collapsed ? `${full}px` : "0px";
    void el.offsetHeight;
    el.style.transition = `height ${transitionOptions}`;
    el.style.height = collapsed ? "0px" : `${full}px`;
    el.addEventListener("transitionend", done);
    const safety = window.setTimeout(done, 800);
    return () => {
      window.clearTimeout(safety);
      el.removeEventListener("transitionend", done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  const rootCls = classNames(
    "p-panel p-component",
    toggleable && "p-panel-toggleable",
    !collapsed && toggleable && "p-panel-expanded",
    collapsed && toggleable && "p-panel-collapsed",
    className,
  );
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.code === "Enter" || e.code === "Space") {
      toggle(e);
      e.preventDefault();
    }
  };
  const hasFooter = footerTemplate !== undefined && footerTemplate !== null && footerTemplate !== false;
  return host(
    "p-panel",
    { ref, id, className: rootCls, "data-p": toggleable ? "toggleable" : undefined, ...rest },
    showHeader && (
      <div className="p-panel-header" id={`${id}-titlebar`} onClick={(e) => toggler === "header" && toggle(e)}>
        {header && (
          <span className="p-panel-title" id={`${id}_header`}>
            {header}
          </span>
        )}
        {headerTemplate}
        <div className={classNames("p-panel-header-actions", iconPos === "start" && "p-panel-icons-start", iconPos === "end" && "p-panel-icons-end", iconPos === "center" && "p-panel-icons-center")}>
          {iconsTemplate}
          {toggleable && (
            <Button
              id={`${id}_header`}
              severity="secondary"
              text
              rounded
              type="button"
              role="button"
              className="p-panel-toggle-button"
              aria-label={toggleButtonAriaLabel ?? header}
              aria-controls={`${id}_content`}
              aria-expanded={!collapsed}
              onClick={(e) => toggler === "icon" && toggle(e)}
              onKeyDown={onKeyDown}
              iconTemplate={headerIconsTemplate ? headerIconsTemplate(collapsed) : collapsed ? <PlusIcon /> : <MinusIcon />}
            />
          )}
        </div>
      </div>
    ),
    <div
      ref={containerRef}
      className="p-panel-content-container"
      id={`${id}_content`}
      role="region"
      aria-labelledby={`${id}_header`}
      aria-hidden={collapsed ? true : undefined}
      tabIndex={collapsed ? -1 : undefined}
      style={collapsed ? { height: 0 } : undefined}
    >
      <div className="p-panel-content" ref={wrapperRef}>
        {children}
      </div>
      {hasFooter && <div className="p-panel-footer">{footerTemplate}</div>}
    </div>,
  );
});
