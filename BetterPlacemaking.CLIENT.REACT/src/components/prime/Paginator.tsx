import { createElement, type CSSProperties, type ReactNode } from "react";
import { PrimeSvgIcon } from "./PrimeSvgIcon";

export interface PageState {
  page: number;
  first: number;
  rows: number;
  pageCount: number;
}

export interface PaginatorProps {
  /** Total number of records. */
  totalRecords: number;
  /** Rows per page. */
  rows: number;
  /** Index of the first record (controlled). */
  first?: number;
  /** PrimeNG `pageLinkSize` (default 5). */
  pageLinkSize?: number;
  /** PrimeNG `alwaysShow` (default true): when false the paginator is hidden if there is a single page. */
  alwaysShow?: boolean;
  showFirstLastIcon?: boolean;
  showPageLinks?: boolean;
  showCurrentPageReport?: boolean;
  /** Placeholders: {currentPage} {totalPages} {first} {last} {rows} {totalRecords}. */
  currentPageReportTemplate?: string;
  /** PrimeNG `templateLeft` / `templateRight` (rendered in p-paginator-content-start/-end). */
  templateLeft?: ReactNode | ((state: PageState) => ReactNode);
  templateRight?: ReactNode | ((state: PageState) => ReactNode);
  /** PrimeNG `(onPageChange)`. */
  onPageChange?: (event: PageState) => void;
  /** PrimeNG styleClass - appended to the root `p-paginator p-component`. */
  className?: string;
  style?: CSSProperties;
}

/**
 * PrimeNG `<p-paginator>`. The host element is the real `<p-paginator class="p-component p-paginator">` custom element.
 * Not implemented (unused by the app): rowsPerPageOptions dropdown, jump-to-page dropdown/input.
 */
export function Paginator({
  totalRecords,
  rows,
  first = 0,
  pageLinkSize = 5,
  alwaysShow = true,
  showFirstLastIcon = true,
  showPageLinks = true,
  showCurrentPageReport = false,
  currentPageReportTemplate = "{currentPage} of {totalPages}",
  templateLeft,
  templateRight,
  onPageChange,
  className,
  style,
}: PaginatorProps) {
  const pageCount = Math.ceil(totalRecords / rows) || 1;
  const page = Math.floor(first / rows);
  const empty = pageCount === 0 || totalRecords === 0;
  const isFirst = page === 0;
  const isLast = page === pageCount - 1;

  const visible = Math.min(pageLinkSize, pageCount);
  let start = Math.max(0, Math.ceil(page - visible / 2));
  const end = Math.min(pageCount - 1, start + visible - 1);
  start = Math.max(0, start - (pageLinkSize - (end - start + 1)));
  const links: number[] = [];
  for (let i = start; i <= end; i++) links.push(i + 1);

  const go = (p: number) => {
    if (p < 0 || p > pageCount - 1) return;
    onPageChange?.({ page: p, first: rows * p, rows, pageCount });
  };
  const state: PageState = { page, first, rows, pageCount };

  const report = currentPageReportTemplate
    .replace("{currentPage}", String(pageCount > 0 ? page + 1 : 0))
    .replace("{totalPages}", String(pageCount))
    .replace("{first}", String(totalRecords > 0 ? first + 1 : 0))
    .replace("{last}", String(Math.min(first + rows, totalRecords)))
    .replace("{rows}", String(rows))
    .replace("{totalRecords}", String(totalRecords));

  const render = (t: PaginatorProps["templateLeft"]) => (typeof t === "function" ? t(state) : t);
  const btn = (
    key: string,
    cls: string,
    disabled: boolean,
    setDisabledAttr: boolean,
    label: string,
    onClick: () => void,
    icon: string,
    iconCls: string,
  ) => (
    <button
      key={key}
      type="button"
      {...({ pripple: "" } as object)}
      className={`p-ripple ${disabled ? "p-disabled " : ""}${cls}`}
      disabled={setDisabledAttr ? disabled : undefined}
      aria-label={label}
      data-pc-section={key}
      onClick={onClick}
    >
      <PrimeSvgIcon name={icon} className={iconCls} data-pc-section={`${key}icon`} />
    </button>
  );

  const hidden = !alwaysShow && pageCount <= 1;
  return createElement(
    "p-paginator",
    {
      className: ["p-component p-paginator", className].filter(Boolean).join(" "),
      style: hidden ? { ...style, display: "none" } : style,
      "data-pc-section": "root",
      "data-pc-name": "pcpaginator",
      "data-pc-extend": "paginator",
    },
    templateLeft ? <div className="p-paginator-content-start">{render(templateLeft)}</div> : null,
    showCurrentPageReport ? <span className="p-paginator-current">{report}</span> : null,
    showFirstLastIcon
      ? btn("first", "p-paginator-first", isFirst || empty, false, "First Page", () => go(0), "angle-double-left", "p-paginator-first-icon")
      : null,
    btn("prev", "p-paginator-prev", isFirst || empty, true, "Previous Page", () => go(page - 1), "angle-left", "p-paginator-prev-icon"),
    showPageLinks ? (
      <span className="p-paginator-pages" data-pc-section="pages">
        {links.map((n) => (
          <button
            key={n}
            type="button"
            {...({ pripple: "" } as object)}
            className={`p-ripple p-paginator-page${n - 1 === page ? " p-paginator-page-selected" : ""}`}
            aria-label={String(n)}
            aria-current={n - 1 === page ? "page" : undefined}
            data-pc-section="page"
            onClick={() => go(n - 1)}
          >
            {` ${n} `}
          </button>
        ))}
      </span>
    ) : null,
    btn("next", "p-paginator-next", isLast || empty, true, "Next Page", () => go(page + 1), "angle-right", "p-paginator-next-icon"),
    showFirstLastIcon
      ? btn("last", "p-paginator-last", isLast || empty, true, "Last Page", () => go(pageCount - 1), "angle-double-right", "p-paginator-last-icon")
      : null,
    templateRight ? <div className="p-paginator-content-end">{render(templateRight)}</div> : null,
  );
}
