import {
  Children,
  Fragment,
  createContext,
  createElement,
  isValidElement,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { Paginator, type PageState } from "./Paginator";
import { PrimeSvgIcon } from "./PrimeSvgIcon";

/* ------------------------------------------------------------------------------------------------
 * Column (declarative, config only)
 * ---------------------------------------------------------------------------------------------- */
export interface ColumnProps<T = any> {
  /** Property name on the row (used for default body text, sorting, sort icon). */
  field?: string;
  /** `<th>` content. */
  header?: ReactNode;
  /** `<tfoot><th>` content (a tfoot row is rendered when any column has a footer). */
  footer?: ReactNode;
  /** PrimeNG `pSortableColumn`: renders `th.p-datatable-sortable-column` + sort icon; needs `field` (or `sortField`). */
  sortable?: boolean;
  /** PrimeNG `[pSortableColumn]` field override / custom sort key. */
  sortField?: string;
  /** PrimeNG `#body` cell template: return cell content (rendered inside `<td>`). */
  body?: (row: T, ctx: { rowIndex: number; column: ColumnProps<T> }) => ReactNode;
  /** Classes / style on the body `<td>`. */
  className?: string;
  style?: CSSProperties;
  /** Classes / style on the header `<th>` (PrimeNG `headerStyleClass`/`headerStyle`). */
  headerClassName?: string;
  headerStyle?: CSSProperties;
  footerClassName?: string;
  footerStyle?: CSSProperties;
  /** Shortcut for the selection column (header select-all checkbox + row checkbox). Width defaults to 3rem like PrimeNG apps use. */
  selectionMode?: "multiple" | "single";
  /** Comparator used for client-side sort of this column. */
  sortFn?: (a: T, b: T) => number;
}

/** Declarative column definition. Renders nothing itself - `<DataTable>` reads its props. */
export function Column<T = any>(_props: ColumnProps<T>): null {
  return null;
}

/* ------------------------------------------------------------------------------------------------
 * Selection context + TableCheckbox / TableHeaderCheckbox (p-tableCheckbox, p-tableHeaderCheckbox)
 * ---------------------------------------------------------------------------------------------- */
interface DataTableCtx {
  selection: any[];
  isSelected: (row: any) => boolean;
  toggle: (row: any) => void;
  allSelected: boolean;
  toggleAll: () => void;
  pageRows: any[];
}
const Ctx = createContext<DataTableCtx | null>(null);

function CheckboxDom({
  checked,
  disabled,
  pcName,
  ariaLabel,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  pcName: string;
  ariaLabel?: string;
  onChange: () => void;
}) {
  return createElement(
    "p-checkbox",
    {
      "data-p-highlight": String(checked),
      "data-p-checked": String(checked),
      "data-p-disabled": String(!!disabled),
      className: `p-checkbox p-component${checked ? " p-checkbox-checked p-highlight" : ""}${disabled ? " p-disabled" : ""}`,
      "data-pc-section": "root",
      "data-pc-name": pcName,
      "data-pc-extend": "checkbox",
      onClick: (e: React.MouseEvent) => {
        if (disabled) return;
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        onChange();
      },
    },
    <input
      type="checkbox"
      className="p-checkbox-input"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      data-pc-section="input"
      onChange={onChange}
    />,
    <div className="p-checkbox-box" data-pc-section="box">
      {checked ? <PrimeSvgIcon name="check" className="p-checkbox-icon" data-pc-section="icon" /> : null}
    </div>,
  );
}

/** PrimeNG `<p-tableCheckbox [value]="row">` - use inside a body template. */
export function TableCheckbox({ value, disabled, ariaLabel }: { value: any; disabled?: boolean; ariaLabel?: string }) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const checked = ctx.isSelected(value);
  return createElement(
    "p-tablecheckbox",
    { "data-pc-section": "checkbox" },
    <CheckboxDom
      checked={checked}
      disabled={disabled}
      pcName="pccheckbox"
      ariaLabel={ariaLabel ?? (checked ? "Row Selected" : "Row Unselected")}
      onChange={() => ctx.toggle(value)}
    />,
  );
}

/** PrimeNG `<p-tableHeaderCheckbox />` - use inside a header template. */
export function TableHeaderCheckbox({ disabled }: { disabled?: boolean }) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const isDisabled = disabled ?? ctx.pageRows.length === 0;
  return createElement(
    "p-tableheadercheckbox",
    { "data-pc-section": "headercheckbox" },
    <CheckboxDom
      checked={ctx.allSelected}
      disabled={isDisabled}
      pcName="pccheckbox"
      ariaLabel={ctx.allSelected ? "All items selected" : "All items unselected"}
      onChange={ctx.toggleAll}
    />,
  );
}

/* ------------------------------------------------------------------------------------------------
 * DataTable
 * ---------------------------------------------------------------------------------------------- */
export interface DataTableBodyContext<T> {
  /** Index within the full (sorted) value array. */
  rowIndex: number;
  columns: ColumnProps<T>[];
  expanded: boolean;
}

export interface DataTableProps<T = any> {
  value?: T[] | null;
  /** Declarative columns: `<Column field header sortable body />`. Omit when using headerTemplate/bodyTemplate. */
  children?: ReactNode;

  /* templates (Angular ng-template equivalents) */
  /** PrimeNG `#caption`: content of `div.p-datatable-header`. */
  caption?: ReactNode;
  /** PrimeNG `#header`: raw content of `<thead>` (usually one or more `<tr>`). Overrides the auto header from `<Column>`s. */
  headerTemplate?: (columns: ColumnProps<T>[]) => ReactNode;
  /** PrimeNG `#body`: raw `<tr>` for one row. Overrides the auto rows from `<Column>`s. Keyed automatically. */
  bodyTemplate?: (row: T, ctx: DataTableBodyContext<T>) => ReactNode;
  /** PrimeNG `#footer`: raw content of `<tfoot>`. */
  footerTemplate?: (columns: ColumnProps<T>[]) => ReactNode;
  /** PrimeNG `#emptymessage`: raw `<tr><td colspan>` shown when there are no rows and not loading. */
  emptyMessage?: ReactNode | ((columns: ColumnProps<T>[]) => ReactNode);
  /** PrimeNG `#summary`: rendered in `div.p-datatable-tfoot` below the paginator. */
  summary?: ReactNode;
  /** PrimeNG `#expandedrow`: raw `<tr>` rendered after an expanded row. */
  expandedRowTemplate?: (row: T, ctx: DataTableBodyContext<T>) => ReactNode;
  /** Keys (by `dataKey`) of expanded rows: `{ [key]: true }`. */
  expandedRowKeys?: Record<string, boolean>;

  /* appearance */
  /** PrimeNG `styleClass` AND `class`: applied to the root `<p-table>` element. */
  className?: string;
  style?: CSSProperties;
  tableStyle?: CSSProperties;
  /** PrimeNG `tableStyleClass`. */
  tableClassName?: string;
  size?: "small" | "large";
  stripedRows?: boolean;
  showGridlines?: boolean;
  rowHover?: boolean;
  scrollable?: boolean;
  /** e.g. "260px"; sets `max-height` on `.p-datatable-table-container`. */
  scrollHeight?: string;
  loading?: boolean;
  /** PrimeNG `showLoader` (default true). */
  showLoader?: boolean;
  loadingIcon?: string;

  /* paginator */
  paginator?: boolean;
  rows?: number;
  first?: number;
  onPage?: (e: PageState) => void;
  paginatorPosition?: "top" | "bottom" | "both";
  alwaysShowPaginator?: boolean;
  pageLinks?: number;
  showCurrentPageReport?: boolean;
  currentPageReportTemplate?: string;
  showFirstLastIcon?: boolean;
  paginatorClassName?: string;
  paginatorLeft?: ReactNode;
  paginatorRight?: ReactNode;
  /** If set, the value is treated as the current page only and `totalRecords` drives the paginator (lazy). */
  totalRecords?: number;
  lazy?: boolean;

  /* selection */
  selectionMode?: "single" | "multiple";
  selection?: T[] | T | null;
  onSelectionChange?: (selection: any) => void;
  dataKey?: string;

  /* sorting (single-column) */
  sortField?: string;
  sortOrder?: 1 | -1 | 0;
  onSort?: (e: { field: string; order: 1 | -1 | 0 }) => void;
  /** Per-row extra class for auto rows built from `<Column>`s. */
  rowClassName?: (row: T, index: number) => string | undefined;
}

function getColumns<T>(children: ReactNode): ColumnProps<T>[] {
  const cols: ColumnProps<T>[] = [];
  const walk = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      const el = child as ReactElement<any>;
      if (el.type === Column) cols.push(el.props);
      else if (el.type === Fragment) walk(el.props.children);
    });
  };
  walk(children);
  return cols;
}

function resolve(row: any, field?: string) {
  if (!field) return undefined;
  return field.split(".").reduce((o, k) => (o == null ? o : o[k]), row);
}

function compare(a: any, b: any) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b, undefined, { numeric: true });
  return a < b ? -1 : a > b ? 1 : 0;
}

export function DataTable<T = any>(props: DataTableProps<T>) {
  const {
    value, children, caption, headerTemplate, bodyTemplate, footerTemplate, emptyMessage, summary,
    expandedRowTemplate, expandedRowKeys, className, style, tableStyle, tableClassName, size, stripedRows,
    showGridlines, rowHover, scrollable, scrollHeight, loading, showLoader = true, loadingIcon,
    paginator, rows = 0, first: firstProp, onPage, paginatorPosition = "bottom", alwaysShowPaginator = true,
    pageLinks = 5, showCurrentPageReport, currentPageReportTemplate, showFirstLastIcon, paginatorClassName,
    paginatorLeft, paginatorRight, totalRecords: totalRecordsProp, lazy,
    selectionMode, selection, onSelectionChange, dataKey, sortField: sortFieldProp, sortOrder: sortOrderProp,
    onSort, rowClassName,
  } = props;

  const columns = useMemo(() => getColumns<T>(children), [children]);
  const data = value ?? [];

  const [firstState, setFirstState] = useState(0);
  const first = firstProp ?? firstState;
  const [sortState, setSortState] = useState<{ field?: string; order: 1 | -1 | 0 }>({ order: 0 });
  const sortField = sortFieldProp !== undefined ? sortFieldProp : sortState.field;
  const sortOrder = sortOrderProp !== undefined ? sortOrderProp : sortState.order;

  const sorted = useMemo(() => {
    if (lazy || !sortField || !sortOrder) return data;
    const col = columns.find((c) => (c.sortField ?? c.field) === sortField);
    const out = [...data];
    out.sort((a, b) => sortOrder * (col?.sortFn ? col.sortFn(a, b) : compare(resolve(a, sortField), resolve(b, sortField))));
    return out;
  }, [data, columns, sortField, sortOrder, lazy]);

  const total = totalRecordsProp ?? sorted.length;
  const pageRows = paginator && rows > 0 && !lazy ? sorted.slice(first, first + rows) : sorted;

  const keyOf = (row: any, i: number) => (dataKey ? String(resolve(row, dataKey) ?? i) : String(i));
  const selArr: any[] = Array.isArray(selection) ? selection : selection != null ? [selection] : [];
  const isSelected = (row: any) =>
    selArr.some((s) => (dataKey ? resolve(s, dataKey) === resolve(row, dataKey) : s === row));
  const toggle = (row: any) => {
    if (selectionMode === "single") {
      onSelectionChange?.(isSelected(row) ? null : row);
      return;
    }
    onSelectionChange?.(isSelected(row) ? selArr.filter((s) => (dataKey ? resolve(s, dataKey) !== resolve(row, dataKey) : s !== row)) : [...selArr, row]);
  };
  const allSelected = pageRows.length > 0 && pageRows.every(isSelected);
  const toggleAll = () => {
    if (allSelected) onSelectionChange?.(selArr.filter((s) => !pageRows.some((r) => (dataKey ? resolve(r, dataKey) === resolve(s, dataKey) : r === s))));
    else onSelectionChange?.([...selArr, ...pageRows.filter((r) => !isSelected(r))]);
  };
  const ctx: DataTableCtx = { selection: selArr, isSelected, toggle, allSelected, toggleAll, pageRows };

  const handlePage = (e: PageState) => {
    setFirstState(e.first);
    onPage?.(e);
  };
  const handleSort = (field: string) => {
    const order: 1 | -1 | 0 = sortField === field ? (sortOrder === 1 ? -1 : sortOrder === -1 ? 0 : 1) : 1;
    setSortState({ field, order });
    onSort?.({ field, order });
  };

  const rootCls = [
    className,
    "p-datatable p-component",
    rowHover || selectionMode ? "p-datatable-hoverable" : "",
    scrollable ? "p-datatable-scrollable" : "",
    scrollable && scrollHeight === "flex" ? "p-datatable-flex-scrollable" : "",
    stripedRows ? "p-datatable-striped" : "",
    showGridlines ? "p-datatable-gridlines" : "",
    size === "small" ? "p-datatable-sm" : "",
    size === "large" ? "p-datatable-lg" : "",
  ].filter(Boolean).join(" ");

  const paginatorEl = (pos: string) => (
    <Paginator
      key={`pg-${pos}`}
      totalRecords={total}
      rows={rows}
      first={first}
      pageLinkSize={pageLinks}
      alwaysShow={alwaysShowPaginator}
      showCurrentPageReport={showCurrentPageReport}
      currentPageReportTemplate={currentPageReportTemplate}
      showFirstLastIcon={showFirstLastIcon}
      templateLeft={paginatorLeft}
      templateRight={paginatorRight}
      className={paginatorClassName}
      onPageChange={handlePage}
    />
  );

  const selCol = (c: ColumnProps<T>) => c.selectionMode !== undefined;

  const autoHeader = () => (
    <tr>
      {columns.map((c, i) => {
        if (selCol(c)) {
          return (
            <th key={i} className={c.headerClassName} style={{ width: "3rem", ...c.headerStyle }}>
              {c.selectionMode === "multiple" ? <TableHeaderCheckbox /> : null}
            </th>
          );
        }
        const field = c.sortField ?? c.field;
        if (c.sortable && field) {
          const active = sortField === field && sortOrder !== 0;
          const icon = !active ? "sort-alt" : sortOrder === 1 ? "sort-amount-up-alt" : "sort-amount-down";
          return (
            <th
              key={i}
              className={[c.headerClassName, "p-datatable-sortable-column", active ? "p-datatable-column-sorted" : ""].filter(Boolean).join(" ")}
              style={c.headerStyle}
              tabIndex={0}
              role="columnheader"
              aria-sort={active ? (sortOrder === 1 ? "ascending" : "descending") : "none"}
              onClick={() => handleSort(field)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSort(field);
                }
              }}
            >
              {c.header}
              {createElement("p-sorticon", null, <PrimeSvgIcon name={icon} className="p-datatable-sort-icon" />)}
            </th>
          );
        }
        return (
          <th key={i} className={c.headerClassName} style={c.headerStyle}>
            {c.header}
          </th>
        );
      })}
    </tr>
  );

  const autoRow = (row: T, idx: number) => (
    <tr key={keyOf(row, idx)} className={rowClassName?.(row, idx)}>
      {columns.map((c, i) => (
        <td key={i} className={c.className} style={c.style}>
          {selCol(c) ? <TableCheckbox value={row} /> : c.body ? c.body(row, { rowIndex: idx, column: c }) : (resolve(row, c.field) as ReactNode)}
        </td>
      ))}
    </tr>
  );

  const hasFooter = !!footerTemplate || columns.some((c) => c.footer !== undefined);
  const isEmpty = pageRows.length === 0;

  return (
    <Ctx.Provider value={ctx}>
      {createElement(
        "p-table",
        { className: rootCls, style, "data-pc-section": "root", "data-pc-name": "table" },
        loading && showLoader ? (
          <div className="p-datatable-mask p-overlay-mask" data-pc-section="mask">
            {loadingIcon ? (
              <i className={`p-datatable-loading-icon ${loadingIcon}`} data-pc-section="loadingicon" />
            ) : (
              <PrimeSvgIcon name="spinner" spin className="p-datatable-loading-icon" data-pc-section="loadingicon" />
            )}
          </div>
        ) : null,
        caption !== undefined && caption !== null ? (
          <div className="p-datatable-header" data-pc-section="header">
            {caption}
          </div>
        ) : null,
        paginator && (paginatorPosition === "top" || paginatorPosition === "both") ? paginatorEl("top") : null,
        <div
          className="p-datatable-table-container"
          data-pc-section="tablecontainer"
          style={{ ...(scrollHeight ? { maxHeight: scrollHeight } : null), overflow: "auto" }}
        >
          <table
            role="table"
            className={["p-datatable-table", scrollable ? "p-datatable-scrollable-table" : "", tableClassName].filter(Boolean).join(" ")}
            style={tableStyle}
            data-pc-section="table"
          >
            <thead role="rowgroup" className="p-datatable-thead" data-pc-section="thead" style={{ position: "sticky" }}>
              {headerTemplate ? headerTemplate(columns) : columns.length ? autoHeader() : null}
            </thead>
            <tbody role="rowgroup" className="p-datatable-tbody" data-pc-section="tbody">
              {pageRows.map((row, i) => {
                const idx = paginator && !lazy ? first + i : i;
                const key = keyOf(row, idx);
                const expanded = !!expandedRowKeys?.[key];
                const bctx = { rowIndex: idx, columns, expanded };
                return (
                  <Fragment key={key}>
                    {bodyTemplate ? bodyTemplate(row, bctx) : autoRow(row, idx)}
                    {expanded && expandedRowTemplate ? expandedRowTemplate(row, bctx) : null}
                  </Fragment>
                );
              })}
              {isEmpty && !loading
                ? typeof emptyMessage === "function"
                  ? emptyMessage(columns)
                  : emptyMessage
                : null}
            </tbody>
            {hasFooter ? (
              <tfoot role="rowgroup" className="p-datatable-tfoot" data-pc-section="tfoot" style={{ position: "sticky" }}>
                {footerTemplate ? (
                  footerTemplate(columns)
                ) : (
                  <tr>
                    {columns.map((c, i) => (
                      <td key={i} className={c.footerClassName} style={c.footerStyle}>
                        {c.footer}
                      </td>
                    ))}
                  </tr>
                )}
              </tfoot>
            ) : null}
          </table>
        </div>,
        paginator && (paginatorPosition === "bottom" || paginatorPosition === "both") ? paginatorEl("bottom") : null,
        summary ? (
          <div className="p-datatable-tfoot" data-pc-section="footer">
            {summary}
          </div>
        ) : null,
      )}
    </Ctx.Provider>
  );
}
