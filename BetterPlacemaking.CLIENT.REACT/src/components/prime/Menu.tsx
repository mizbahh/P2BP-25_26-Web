import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

/**
 * React port of PrimeNG's <p-menu>. Emits the same DOM/class contract PrimeNG renders
 * (`p-menu` > `ul.p-menu-list` > `li.p-menu-submenu-label` / `li.p-menu-item` >
 * `div.p-menu-item-content` > `a.p-menu-item-link`) so the captured Aura CSS applies verbatim.
 */
export interface MenuItem {
  label?: string;
  /** PrimeIcons class string, e.g. "pi pi-cog" (default item template only). */
  icon?: string;
  /** Router path - renders the link as a react-router <Link>. */
  routerLink?: string;
  command?: (event: { originalEvent: SyntheticEvent; item: MenuItem }) => void;
  separator?: boolean;
  disabled?: boolean;
  visible?: boolean;
  /** Group children: renders `label` as a submenu heading followed by these items. */
  items?: MenuItem[];
  [key: string]: unknown;
}

export interface MenuHandle {
  toggle: (event: SyntheticEvent | Event) => void;
  hide: () => void;
}

interface MenuProps<T extends MenuItem> {
  model: T[];
  popup?: boolean;
  /** PrimeNG `styleClass` - extra classes on the root element. */
  styleClass?: string;
  /** PrimeNG `#item` template: rendered inside `div.p-menu-item-content`. */
  itemTemplate?: (item: T) => ReactNode;
}

function MenuInner<T extends MenuItem>(
  { model, popup = false, styleClass, itemTemplate }: MenuProps<T>,
  ref: React.ForwardedRef<MenuHandle>,
) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const hide = useCallback(() => {
    setVisible(false);
    setPos(null);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      toggle: (event) => {
        if (visible) {
          hide();
          return;
        }
        targetRef.current = (event.currentTarget as HTMLElement | null) ?? (event.target as HTMLElement | null);
        setVisible(true);
      },
      hide,
    }),
    [visible, hide],
  );

  // Mirrors PrimeNG's DomHandler.absolutePosition: below the anchor, left-aligned; flip above when it would overflow.
  useLayoutEffect(() => {
    if (!popup || !visible || !overlayRef.current || !targetRef.current) return;
    const overlay = overlayRef.current;
    const rect = targetRef.current.getBoundingClientRect();
    const oh = overlay.offsetHeight;
    const ow = overlay.offsetWidth;
    let top = rect.bottom + window.scrollY;
    if (rect.bottom + oh > window.innerHeight && rect.top - oh > 0) top = rect.top - oh + window.scrollY;
    let left = rect.left + window.scrollX;
    if (rect.left + ow > window.innerWidth) left = Math.max(0, window.innerWidth - ow) + window.scrollX;
    setPos({ top, left });
  }, [popup, visible]);

  useEffect(() => {
    if (!popup || !visible) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (overlayRef.current?.contains(t) || targetRef.current?.contains(t)) return;
      hide();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", hide);
    };
  }, [popup, visible, hide]);

  const renderItem = (item: MenuItem, key: string) => {
    if (item.visible === false) return null;
    if (item.separator) return <li key={key} role="separator" className="p-menu-separator" />;

    const onClick = (originalEvent: SyntheticEvent) => {
      if (item.disabled) return;
      item.command?.({ originalEvent, item });
      if (popup) hide();
    };

    let content: ReactNode;
    if (itemTemplate) {
      content = itemTemplate(item as T);
    } else {
      const inner = (
        <>
          {item.icon && <span className={`p-menu-item-icon ${item.icon}`} />}
          <span className="p-menu-item-label">{item.label}</span>
        </>
      );
      content = item.routerLink ? (
        <Link to={item.routerLink} className="p-menu-item-link" tabIndex={-1}>
          {inner}
        </Link>
      ) : (
        <a className="p-menu-item-link" tabIndex={-1}>
          {inner}
        </a>
      );
    }

    return (
      <li
        key={key}
        role="menuitem"
        className={`p-menu-item${item.disabled ? " p-disabled" : ""}`}
        aria-label={item.label}
        aria-disabled={item.disabled ? "true" : "false"}
        data-p-disabled={item.disabled ? "true" : "false"}
      >
        <div className="p-menu-item-content" onClick={onClick}>
          {content}
        </div>
      </li>
    );
  };

  const list = (
    <ul role="menu" className="p-menu-list" id={`${id}_list`} tabIndex={0}>
      {model.map((entry, i) =>
        entry.items ? (
          <FragmentGroup key={`g${i}`}>
            <li role="none" className="p-menu-submenu-label">
              <span>{entry.label}</span>
            </li>
            {entry.items.map((child, j) => renderItem(child, `g${i}-${j}`))}
          </FragmentGroup>
        ) : (
          renderItem(entry, `i${i}`)
        ),
      )}
    </ul>
  );

  if (!popup) {
    return (
      <div className={`p-component p-menu${styleClass ? ` ${styleClass}` : ""}`} data-pc-name="menu" id={id} style={{ position: "relative" }}>
        {list}
      </div>
    );
  }

  if (!visible) return null;
  return createPortal(
    <div
      ref={overlayRef}
      className={`p-component p-menu p-menu-overlay${styleClass ? ` ${styleClass}` : ""}`}
      data-pc-name="menu"
      id={id}
      style={{ position: "absolute", top: pos?.top ?? 0, left: pos?.left ?? 0, zIndex: 1100, visibility: pos ? "visible" : "hidden" }}
    >
      {list}
    </div>,
    document.body,
  );
}

function FragmentGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export const Menu = forwardRef(MenuInner) as <T extends MenuItem>(
  props: MenuProps<T> & { ref?: React.Ref<MenuHandle> },
) => ReturnType<typeof MenuInner>;
