/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement, forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ConnectedOverlay } from "./_inputs/ConnectedOverlay";
import { PrimeIcon } from "./_inputs/PrimeIcon";
import { cn, resolveField, useFluid } from "./_inputs/utils";

/**
 * React port of PrimeNG `<p-autocomplete>` (single selection): `p-autocomplete > input.p-autocomplete-input + button.p-autocomplete-dropdown + p-overlay`.
 *   <AutoComplete value={sel} onChange={setSel} suggestions={list} completeMethod={(e) => filter(e.query)} optionLabel="label"
 *      dropdown forceSelection appendTo="body" placeholder="Search..." className="w-full" />
 * `value` is the selected option object (or the typed string while editing); `onChange(value)` replaces ngModelChange.
 * Multiple mode (chips) is not implemented.
 */
export interface AutoCompleteProps {
  value?: any;
  onChange?: (value: any) => void;
  suggestions?: any[];
  completeMethod?: (e: { originalEvent: Event | React.SyntheticEvent; query: string }) => void;
  optionLabel?: string;
  optionDisabled?: string;
  dropdown?: boolean;
  dropdownMode?: "blank" | "current";
  forceSelection?: boolean;
  showClear?: boolean;
  minLength?: number;
  delay?: number;
  loading?: boolean;
  showEmptyMessage?: boolean;
  emptyMessage?: string;
  placeholder?: string;
  inputId?: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  fluid?: boolean;
  appendTo?: "body" | "self" | string | HTMLElement | null;
  scrollHeight?: string;
  panelStyleClass?: string;
  panelStyle?: CSSProperties;
  className?: string;
  style?: CSSProperties;
  inputStyleClass?: string;
  inputStyle?: CSSProperties;
  tabIndex?: number;
  autoFocus?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  autoHighlight?: boolean;
  itemTemplate?: (option: any, index: number) => ReactNode;
  onSelect?: (e: { originalEvent: Event | React.SyntheticEvent; value: any }) => void;
  onClear?: () => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onShow?: () => void;
  onHide?: () => void;
  onDropdownClick?: (e: { originalEvent: React.MouseEvent; query: string }) => void;
  [dataAttr: `data-${string}`]: unknown;
}

export const AutoComplete = forwardRef<HTMLElement, AutoCompleteProps>(function AutoComplete(props, ref) {
  const {
    value, onChange, suggestions, completeMethod, optionLabel, optionDisabled, dropdown = false, dropdownMode = "blank", forceSelection = false, showClear = false, minLength = 1, delay = 300,
    loading = false, showEmptyMessage = true, emptyMessage = "No results found", placeholder, inputId, name, disabled = false, readOnly = false, invalid = false, fluid, appendTo,
    scrollHeight = "200px", panelStyleClass, panelStyle, className, style, inputStyleClass, inputStyle, tabIndex, autoFocus, ariaLabel, ariaLabelledBy, autoHighlight = false, itemTemplate,
    onSelect, onClear, onFocus, onBlur, onShow, onHide, onDropdownClick, ...rest
  } = props;
  const id = "pn_id_" + useId().replace(/:/g, "");
  const rootRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLElement);
  const hasFluid = useFluid(rootRef, fluid);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const [typed, setTyped] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const list = suggestions ?? [];

  const label = (o: any): string => (o === null || o === undefined ? "" : typeof o === "object" ? String(resolveField(o, optionLabel) ?? "") : String(o));
  const disabledOpt = (o: any) => !!(optionDisabled && o && typeof o === "object" && resolveField(o, optionDisabled));
  const inputValue = typed ?? (value === null || value === undefined ? "" : label(value));
  const filled = value !== null && value !== undefined && value !== "";
  const isSelected = (o: any) => filled && typeof value === "object" && label(value) === label(o);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  const search = (e: React.SyntheticEvent | Event, query: string) => {
    completeMethod?.({ originalEvent: e, query });
  };
  const show = () => {
    setOpen(true);
    setFocusIdx(autoHighlight ? 0 : -1);
  };
  const hide = () => {
    setOpen(false);
    setFocusIdx(-1);
  };
  const select = (e: React.SyntheticEvent, o: any) => {
    if (disabledOpt(o)) return;
    setTyped(null);
    onChange?.(o);
    onSelect?.({ originalEvent: e, value: o });
    hide();
    inputRef.current?.focus();
  };
  const next = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < list.length; i += dir) if (!disabledOpt(list[i])) return i;
    return from;
  };

  useEffect(() => {
    // show / hide the panel when suggestions arrive for an active search
    if (typed !== null || open) {
      if (list.length > 0 && focused && !open && typed) show();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions]);

  const showPanel = open && (list.length > 0 || (showEmptyMessage && (typed ?? "").length >= minLength) || (dropdown && !list.length && showEmptyMessage));
  const listId = id + "_list";

  return createElement(
    "p-autocomplete",
    {
      ref: rootRef,
      className: cn(
        "p-autocomplete p-component p-inputwrapper",
        { "p-invalid": invalid, "p-focus": focused, "p-inputwrapper-filled": filled, "p-inputwrapper-focus": (focused && !disabled) || open, "p-autocomplete-open": open, "p-autocomplete-clearable": showClear && !disabled, "p-autocomplete-fluid": hasFluid },
        className,
      ),
      style: { position: "relative", ...style },
      "data-pc-section": "root",
      "data-pc-name": "autocomplete",
      ...rest,
    },
    <input
      key="input"
      ref={inputRef}
      id={inputId}
      name={name}
      type="text"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-activedescendant={focused && focusIdx !== -1 ? `${id}_${focusIdx}` : undefined}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      value={inputValue}
      placeholder={placeholder}
      tabIndex={!disabled ? tabIndex : -1}
      readOnly={readOnly || undefined}
      disabled={disabled || undefined}
      style={inputStyle}
      className={cn("p-autocomplete-input", inputStyleClass, "p-component p-inputtext", { "p-filled": !!inputValue, "p-invalid": invalid, "p-inputtext-fluid": hasFluid })}
      data-pc-name="pcinputtext"
      data-pc-extend="inputtext"
      data-pc-section="root"
      onChange={(e) => {
        const q = e.target.value;
        setTyped(q);
        if (!forceSelection) onChange?.(q);
        if (timer.current) window.clearTimeout(timer.current);
        if (q.length === 0) {
          hide();
          if (!forceSelection) onChange?.(q);
        } else if (q.length >= minLength) {
          timer.current = window.setTimeout(() => {
            search(e, q);
            show();
          }, delay);
        } else hide();
      }}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        if (forceSelection && typed !== null) {
          const m = list.find((o) => label(o).toLowerCase() === typed.toLowerCase());
          if (m) onChange?.(m);
          else if (typeof value !== "object" || value === null) onChange?.(null);
          setTyped(null);
        }
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (disabled || readOnly) return;
        if (e.key === "ArrowDown") {
          if (!open) {
            if (list.length) show();
          } else setFocusIdx(next(focusIdx, 1));
          e.preventDefault();
        } else if (e.key === "ArrowUp") {
          if (open) setFocusIdx(next(focusIdx === -1 ? list.length : focusIdx, -1));
          e.preventDefault();
        } else if (e.key === "Enter") {
          if (open && focusIdx !== -1) select(e, list[focusIdx]);
          if (open) e.preventDefault();
          hide();
        } else if (e.key === "Escape") {
          if (open) {
            hide();
            e.preventDefault();
          }
        } else if (e.key === "Tab") {
          if (open && focusIdx !== -1) select(e, list[focusIdx]);
          hide();
        }
      }}
    />,
    showClear && filled && !disabled && !loading && <PrimeIcon key="clear" name="times" className="p-autocomplete-clear-icon" section="clearicon" onClick={() => { setTyped(null); onChange?.(null); onClear?.(); }} />,
    loading && <PrimeIcon key="loader" name="spinner" className="p-autocomplete-loader" spin />,
    dropdown && (
      <button
        key="dd"
        type="button"
        className="p-ripple p-autocomplete-dropdown"
        aria-label="dropdown"
        disabled={disabled}
        tabIndex={tabIndex}
        data-pc-section="dropdown"
        onClick={(e) => {
          if (disabled) return;
          const q = dropdownMode === "current" ? inputRef.current?.value ?? "" : "";
          onDropdownClick?.({ originalEvent: e, query: q });
          inputRef.current?.focus();
          if (open) hide();
          else {
            search(e, q);
            show();
          }
        }}
      >
        <PrimeIcon name="chevron-down" section="dropdown" />
      </button>
    ),
    <ConnectedOverlay key="ov" visible={showPanel} targetRef={rootRef} hostName="autocomplete" appendTo={appendTo} onHide={() => hide()} onShow={onShow} onAfterHide={onHide} alignKey={list.length}>
      <div className={cn("p-autocomplete-overlay p-component-overlay p-component", panelStyleClass)} data-pc-section="overlay" style={panelStyle}>
        <div className="p-autocomplete-list-container" data-pc-section="listcontainer" style={{ maxHeight: scrollHeight }} tabIndex={-1}>
          <ul id={listId} className="p-autocomplete-list" role="listbox" aria-label="Option List" data-pc-section="list">
            {list.map((o, i) => {
              const sel = isSelected(o);
              const dis = disabledOpt(o);
              return (
                <li
                  key={i}
                  id={`${id}_${i}`}
                  className={cn("p-ripple", "p-autocomplete-option", { "p-autocomplete-option-selected": sel, "p-focus": focusIdx === i, "p-disabled": dis })}
                  role="option"
                  aria-label={label(o)}
                  aria-selected={sel}
                  aria-disabled={dis}
                  aria-setsize={list.length}
                  aria-posinset={i + 1}
                  data-p-focused={focusIdx === i}
                  data-pc-section="option"
                  onClick={(e) => select(e, o)}
                  onMouseEnter={() => setFocusIdx(i)}
                >
                  {itemTemplate ? itemTemplate(o, i) : <span>{label(o)}</span>}
                </li>
              );
            })}
            {list.length === 0 && showEmptyMessage && (
              <li className="p-autocomplete-empty-message" data-pc-section="emptymessage">
                {emptyMessage}
              </li>
            )}
          </ul>
        </div>
      </div>
      <span role="status" aria-live="polite" className="p-hidden-accessible" />
    </ConnectedOverlay>,
  );
});
