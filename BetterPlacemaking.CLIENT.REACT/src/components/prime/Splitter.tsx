import { Children, createElement, isValidElement, useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";

export interface SplitterPanelProps {
  /** Panel content (PrimeNG `<ng-template pTemplate="panel">` / `<p-splitterPanel>`). */
  children?: ReactNode;
  /** Extra classes / style for this panel's `div.p-splitterpanel`. */
  className?: string;
  style?: CSSProperties;
}

/** Declarative panel. Renders nothing by itself - `<Splitter>` wraps its children in `div.p-splitterpanel`. */
export function SplitterPanel(_props: SplitterPanelProps): null {
  return null;
}

export interface SplitterProps {
  layout?: "horizontal" | "vertical";
  /** Initial sizes in percent, e.g. [50, 50]. */
  panelSizes?: number[];
  /** Minimum sizes in percent. */
  minSizes?: number[];
  gutterSize?: number;
  step?: number;
  /** PrimeNG `styleClass` -> classes on the root `<p-splitter>`. */
  className?: string;
  style?: CSSProperties;
  /** PrimeNG `panelStyleClass` / `panelStyle` (applied to every panel). */
  panelClassName?: string;
  panelStyle?: CSSProperties;
  onResizeEnd?: (e: { sizes: number[] }) => void;
  onResizeStart?: (e: { index: number }) => void;
  children?: ReactNode;
}

function hasNestedSplitter(node: ReactNode): boolean {
  let found = false;
  Children.forEach(node, (c) => {
    if (found || !isValidElement(c)) return;
    const el = c as ReactElement<any>;
    if (el.type === Splitter) found = true;
    else if (el.props?.children) found = hasNestedSplitter(el.props.children);
  });
  return found;
}

/** PrimeNG `<p-splitter>`: `p-splitter p-component p-splitter-<layout>` with `p-splitterpanel` panels and `p-splitter-gutter` handles. */
export function Splitter({
  layout = "horizontal",
  panelSizes = [],
  minSizes = [],
  gutterSize = 4,
  step = 5,
  className,
  style,
  panelClassName,
  panelStyle,
  onResizeEnd,
  onResizeStart,
  children,
}: SplitterProps) {
  const panels = Children.toArray(children).filter((c): c is ReactElement<SplitterPanelProps> => isValidElement(c) && (c as ReactElement).type === SplitterPanel);
  const n = panels.length;
  const horizontal = layout === "horizontal";
  const init = () => panels.map((_, i) => (panelSizes.length - 1 >= i && panelSizes[i] ? panelSizes[i] : 100 / n));
  const [sizes, setSizes] = useState<number[]>(init);
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;
  const rootRef = useRef<HTMLElement | null>(null);
  const [resizing, setResizing] = useState<number | null>(null);
  const drag = useRef<{ index: number; start: number; prev: number; next: number; size: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const key = panelSizes.join(",");

  useEffect(() => {
    setSizes(panels.map((_, i) => (panelSizes.length - 1 >= i && panelSizes[i] ? panelSizes[i] : 100 / n)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, n]);

  const validate = (prev: number, next: number) => {
    if (minSizes.length >= 1 && minSizes[0] && minSizes[0] > prev) return false;
    if (minSizes.length > 1 && minSizes[1] && minSizes[1] > next) return false;
    return true;
  };
  const apply = (i: number, prev: number, next: number) => {
    if (!validate(prev, next)) return;
    setSizes((cur) => {
      const c = [...cur];
      c[i] = prev;
      c[i + 1] = next;
      return c;
    });
  };
  const rootSize = () => {
    const r = rootRef.current?.getBoundingClientRect();
    return (horizontal ? r?.width : r?.height) ?? 1;
  };

  const startDrag = (e: React.MouseEvent, i: number) => {
    const s = sizesRef.current;
    drag.current = { index: i, start: horizontal ? e.pageX : e.pageY, prev: s[i], next: s[i + 1], size: rootSize() };
    setResizing(i);
    onResizeStart?.({ index: i });
    const move = (ev: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      const pos = (((horizontal ? ev.pageX : ev.pageY) - d.start) * 100) / d.size;
      apply(d.index, d.prev + pos, d.next - pos);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      drag.current = null;
      setResizing(null);
      onResizeEnd?.({ sizes: sizesRef.current });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const keyResize = (i: number, dir: number) => {
    // PrimeNG steps in pixels relative to the container: newPrev = 100*(prevPx + step)/size
    const size = rootSize();
    const s = sizesRef.current;
    const prevPx = (s[i] / 100) * size;
    const nextPx = (s[i + 1] / 100) * size;
    const stepPx = step * dir;
    const [np, nn] = horizontal ? [(100 * (prevPx + stepPx)) / size, (100 * (nextPx - stepPx)) / size] : [(100 * (prevPx - stepPx)) / size, (100 * (nextPx + stepPx)) / size];
    apply(i, np, nn);
  };

  const gutterHandleStyle: CSSProperties = horizontal ? { width: `${gutterSize}px` } : { height: `${gutterSize}px` };

  return createElement(
    "p-splitter",
    {
      ref: rootRef,
      className: ["p-splitter p-component", `p-splitter-${layout}`, resizing !== null ? "p-splitter-resizing" : "", className].filter(Boolean).join(" "),
      style: { display: "flex", flexWrap: "nowrap", ...(horizontal ? null : { flexDirection: "column" }), ...style },
      "data-p-gutter-resizing": "false",
      "data-pc-section": "root",
      "data-pc-name": "splitter",
    },
    panels.flatMap((p, i) => {
      const nodes: ReactNode[] = [
        <div
          key={`p${i}`}
          className={["p-splitterpanel", hasNestedSplitter(p.props.children) ? "p-splitterpanel-nested" : "", panelClassName, p.props.className].filter(Boolean).join(" ")}
          tabIndex={-1}
          data-pc-section="panel"
          style={{ ...panelStyle, ...p.props.style, flexBasis: `calc(${sizes[i]}% - ${(n - 1) * gutterSize}px)` }}
        >
          {p.props.children}
        </div>,
      ];
      if (i !== n - 1) {
        nodes.push(
          <div
            key={`g${i}`}
            className={`p-splitter-gutter${resizing === i ? " p-splitter-gutter-resizing" : ""}`}
            role="separator"
            tabIndex={-1}
            data-p-gutter-resizing="false"
            data-pc-section="gutter"
            onMouseDown={(e) => startDrag(e, i)}
          >
            <div
              className="p-splitter-gutter-handle"
              tabIndex={0}
              style={gutterHandleStyle}
              aria-orientation={layout}
              aria-valuenow={Number(sizes[i]).toFixed(4) as unknown as number}
              data-pc-section="gutterhandle"
              onKeyDown={(e) => {
                const map: Record<string, [string, number]> = {
                  ArrowLeft: ["horizontal", -1],
                  ArrowRight: ["horizontal", 1],
                  ArrowDown: ["vertical", -1],
                  ArrowUp: ["vertical", 1],
                };
                const m = map[e.code];
                if (!m) return;
                e.preventDefault();
                if (m[0] === layout) {
                  window.clearTimeout(timer.current);
                  timer.current = window.setTimeout(() => keyResize(i, m[1]), 40);
                }
              }}
              onKeyUp={() => {
                window.clearTimeout(timer.current);
                onResizeEnd?.({ sizes: sizesRef.current });
              }}
            />
          </div>,
        );
      }
      return nodes;
    }),
  );
}
