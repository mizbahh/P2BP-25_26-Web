/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement, forwardRef, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PrimeIcon } from "./_inputs/PrimeIcon";
import { cn, deepEquals, resolveField } from "./_inputs/utils";

/**
 * React port of PrimeNG `<p-listbox>` (not used by the current app screens; provided for completeness).
 * `div.p-listbox > (hidden focusable) + div.p-listbox-list-container > ul.p-listbox-list > li.p-listbox-option`.
 *   <Listbox options={items} value={sel} onChange={(e) => setSel(e.value)} optionLabel="label" optionValue="value" multiple filter />
 * Checkbox mode and virtual scroll are not implemented.
 */
export interface ListboxProps {
  options?: any[];
  value?: any;
  onChange?: (e: { originalEvent: React.SyntheticEvent; value: any }) => void;
  optionLabel?: string;
  optionValue?: string;
  optionDisabled?: string;
  multiple?: boolean;
  metaKeySelection?: boolean;
  filter?: boolean;
  filterPlaceholder?: string;
  filterBy?: string;
  striped?: boolean;
  highlightOnSelect?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  fluid?: boolean;
  scrollHeight?: string;
  emptyMessage?: string;
  emptyFilterMessage?: string;
  className?: string;
  style?: CSSProperties;
  listStyleClass?: string;
  listStyle?: CSSProperties;
  tabIndex?: number;
  itemTemplate?: (option: any, index: number) => ReactNode;
  headerTemplate?: ReactNode;
  footerTemplate?: ReactNode;
  onFilter?: (e: { originalEvent: React.SyntheticEvent; filter: string }) => void;
  onClick?: (e: { originalEvent: React.SyntheticEvent; option: any }) => void;
  onDblClick?: (e: { originalEvent: React.SyntheticEvent; option: any }) => void;
  [dataAttr: `data-${string}`]: unknown;
}

export const Listbox = forwardRef<HTMLElement, ListboxProps>(function Listbox(props, ref) {
  const {
    options, value, onChange, optionLabel, optionValue, optionDisabled, multiple = false, metaKeySelection = false, filter = false, filterPlaceholder, filterBy, striped = false, highlightOnSelect = true,
    disabled = false, invalid = false, fluid = false, scrollHeight = "14rem", emptyMessage = "No available options", emptyFilterMessage = "No results found", className, style, listStyleClass, listStyle,
    tabIndex = 0, itemTemplate, headerTemplate, footerTemplate, onFilter, onClick, onDblClick, ...rest
  } = props;
  const id = "pn_id_" + useId().replace(/:/g, "");
  const [focusIdx, setFocusIdx] = useState(-1);
  const [focused, setFocused] = useState(false);
  const [q, setQ] = useState("");
  const listRef = useRef<HTMLUListElement | null>(null);
  const all = options ?? [];
  const label = (o: any) => (typeof o === "object" && o !== null ? String(resolveField(o, optionLabel) ?? "") : String(o ?? ""));
  const val = (o: any) => (optionValue ? resolveField(o, optionValue) : o);
  const dis = (o: any) => !!(optionDisabled && o && resolveField(o, optionDisabled));
  const visible = useMemo(() => {
    if (!filter || !q) return all;
    const s = q.toLowerCase();
    return all.filter((o) => (filterBy ? filterBy.split(",").some((f) => String(resolveField(o, f)).toLowerCase().includes(s)) : label(o).toLowerCase().includes(s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, filter, q, filterBy]);
  const isSel = (o: any) => (multiple ? Array.isArray(value) && value.some((v) => deepEquals(v, val(o))) : deepEquals(val(o), value));

  const choose = (e: React.SyntheticEvent, o: any) => {
    if (disabled || dis(o)) return;
    const selected = isSel(o);
    let nv: any;
    if (multiple) {
      const meta = metaKeySelection && !(e as React.MouseEvent).metaKey && !(e as React.MouseEvent).ctrlKey;
      if (meta) nv = [val(o)];
      else nv = selected ? (value as any[]).filter((v) => !deepEquals(v, val(o))) : [...((value as any[]) ?? []), val(o)];
    } else nv = selected && !metaKeySelection ? null : val(o);
    onChange?.({ originalEvent: e, value: nv });
  };
  return createElement(
    "p-listbox",
    {
      ref,
      className: cn("p-listbox p-component", { "p-listbox-striped": striped, "p-disabled": disabled, "p-invalid": invalid, "p-listbox-fluid": fluid }, className),
      style,
      "data-pc-section": "root",
      "data-pc-name": "listbox",
      ...rest,
    },
    <span key="f" role="presentation" className="p-hidden-accessible p-hidden-focusable" tabIndex={!disabled ? tabIndex : -1} data-p-hidden-focusable="true" />,
    headerTemplate && (
      <div key="h" className="p-listbox-header" data-pc-section="header">
        {headerTemplate}
      </div>
    ),
    filter && (
      <div key="fh" className="p-listbox-header" data-pc-section="header">
        {createElement(
          "p-iconfield",
          { className: "p-iconfield" },
          <input
            type="text"
            role="searchbox"
            value={q}
            disabled={disabled || undefined}
            placeholder={filterPlaceholder}
            aria-owns={id + "_list"}
            className="p-listbox-filter p-component p-inputtext"
            onChange={(e) => {
              setQ(e.target.value);
              onFilter?.({ originalEvent: e, filter: e.target.value });
            }}
          />,
          createElement("p-inputicon", { className: "p-inputicon" }, <PrimeIcon name="search" />),
        )}
      </div>
    ),
    <div key="lc" className={cn("p-listbox-list-container", listStyleClass)} style={{ maxHeight: scrollHeight, ...listStyle }} data-pc-section="listcontainer">
      {visible.length === 0 ? (
        <div className="p-listbox-empty-message" data-pc-section="emptymessage">
          {q ? emptyFilterMessage : emptyMessage}
        </div>
      ) : (
        <ul
          ref={listRef}
          id={id + "_list"}
          className="p-listbox-list"
          role="listbox"
          aria-multiselectable={multiple}
          tabIndex={-1}
          data-pc-section="list"
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setFocusIdx(-1);
          }}
        >
          {visible.map((o, i) => {
            const sel = isSel(o);
            return (
              <li
                key={i}
                id={`${id}_${i}`}
                role="option"
                className={cn("p-listbox-option", { "p-listbox-option-selected": sel && highlightOnSelect, "p-focus": focusIdx === i && focused, "p-disabled": dis(o) })}
                aria-label={label(o)}
                aria-selected={sel}
                aria-setsize={visible.length}
                aria-posinset={i + 1}
                data-p-focused={focusIdx === i}
                data-p-highlight={sel}
                data-p-disabled={dis(o)}
                data-pc-section="option"
                onClick={(e) => {
                  choose(e, o);
                  onClick?.({ originalEvent: e, option: o });
                }}
                onDoubleClick={(e) => onDblClick?.({ originalEvent: e, option: o })}
                onMouseEnter={() => setFocusIdx(i)}
              >
                {itemTemplate ? itemTemplate(o, i) : <span>{label(o)}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>,
    footerTemplate && (
      <div key="ft" data-pc-section="footer">
        {footerTemplate}
      </div>
    ),
  );
});
