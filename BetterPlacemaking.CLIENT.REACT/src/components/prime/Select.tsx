/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ConnectedOverlay } from "./_inputs/ConnectedOverlay";
import { PrimeIcon } from "./_inputs/PrimeIcon";
import { cn, deepEquals, resolveField, useFluid } from "./_inputs/utils";

/**
 * React port of PrimeNG's `<p-select>` (Angular 20 / PrimeNG 20.3). Emits the same DOM:
 * `p-select.p-select > span.p-select-label + (svg.p-select-clear-icon) + div.p-select-dropdown + p-overlay`.
 * The panel is `div.p-overlay > div.p-overlay-content > div.p-select-overlay`, inside the host unless `appendTo="body"`.
 *
 *   <Select options={roles} value={role} onChange={(e) => setRole(e.value)} optionLabel="label" optionValue="value" className="w-full" />
 */
export interface SelectChangeEvent<V = any> {
  originalEvent: Event | React.SyntheticEvent;
  value: V;
}

export interface SelectProps {
  options?: any[];
  /** Controlled value (the option's `optionValue` field, or the option itself when no optionValue). */
  value?: any;
  onChange?: (e: SelectChangeEvent) => void;
  optionLabel?: string;
  optionValue?: string;
  optionDisabled?: string | ((option: any) => boolean);
  placeholder?: string;
  filter?: boolean;
  filterBy?: string;
  filterPlaceholder?: string;
  resetFilterOnHide?: boolean;
  showClear?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  loading?: boolean;
  fluid?: boolean;
  variant?: "outlined" | "filled";
  size?: "small" | "large";
  checkmark?: boolean;
  /** "body" renders the panel into document.body (PrimeNG `appendTo`). */
  appendTo?: "body" | "self" | string | HTMLElement | null;
  scrollHeight?: string;
  panelStyle?: CSSProperties;
  panelStyleClass?: string;
  emptyMessage?: string;
  emptyFilterMessage?: string;
  dataKey?: string;
  /** PrimeNG `inputId` -> id of the focusable label span (so `<label htmlFor>` works). */
  inputId?: string;
  id?: string;
  name?: string;
  /** PrimeNG `styleClass` -> classes on the root `p-select` element. */
  className?: string;
  style?: CSSProperties;
  tabIndex?: number;
  autoFocus?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  focusOnHover?: boolean;
  autoOptionFocus?: boolean;
  autofocusFilter?: boolean;
  /** `#item` template. */
  itemTemplate?: (option: any, index: number) => ReactNode;
  /** `#selectedItem` template (only called when a value is selected). */
  selectedItemTemplate?: (option: any) => ReactNode;
  /** `#dropdownicon` template. */
  dropdownIcon?: string;
  onShow?: () => void;
  onHide?: () => void;
  onClear?: (e: Event | React.SyntheticEvent) => void;
  onFilter?: (e: { originalEvent: Event | React.SyntheticEvent; filter: string }) => void;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  [dataAttr: `data-${string}`]: unknown;
}

const isPrintable = (k: string) => k.length === 1 && k !== " ";

export const Select = forwardRef<HTMLElement, SelectProps>(function Select(props, ref) {
  const {
    options,
    value,
    onChange,
    optionLabel,
    optionValue,
    optionDisabled,
    placeholder,
    filter = false,
    filterBy,
    filterPlaceholder,
    resetFilterOnHide = true,
    showClear = false,
    disabled = false,
    readOnly = false,
    invalid = false,
    loading = false,
    fluid,
    variant,
    size,
    checkmark = false,
    appendTo,
    scrollHeight = "200px",
    panelStyle,
    panelStyleClass,
    emptyMessage = "No results found",
    emptyFilterMessage = "No results found",
    dataKey,
    inputId,
    id: idProp,
    className,
    style,
    tabIndex = 0,
    autoFocus,
    ariaLabel,
    ariaLabelledBy,
    focusOnHover = true,
    autoOptionFocus = false,
    autofocusFilter = true,
    itemTemplate,
    selectedItemTemplate,
    dropdownIcon,
    onShow,
    onHide,
    onClear,
    onFilter,
    onFocus,
    onBlur,
    onClick,
    ...rest
  } = props;

  const autoId = useId().replace(/:/g, "");
  const id = idProp ?? `pn_id_${autoId}`;
  const rootRef = useRef<HTMLElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const filterRef = useRef<HTMLInputElement | null>(null);
  const listWrapRef = useRef<HTMLDivElement | null>(null);
  const overlayContentRef = useRef<HTMLDivElement | null>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLElement);

  const [overlayVisible, setOverlayVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [filterValue, setFilterValue] = useState("");
  const [clicked, setClicked] = useState(false);
  const searchRef = useRef({ value: "", timer: 0 as any });
  const hasFluid = useFluid(rootRef, fluid);

  const getLabel = useCallback((o: any): string => (optionLabel ? String(resolveField(o, optionLabel) ?? "") : o != null && typeof o === "object" && "label" in o ? String(o.label) : String(o ?? "")), [optionLabel]);
  const getValue = useCallback((o: any) => (optionValue ? resolveField(o, optionValue) : o != null && typeof o === "object" && "value" in o ? o.value : o), [optionValue]);
  const isDisabledOpt = useCallback(
    (o: any) => {
      if (typeof optionDisabled === "function") return optionDisabled(o);
      if (optionDisabled) return !!resolveField(o, optionDisabled);
      return !!(o && typeof o === "object" && o.disabled);
    },
    [optionDisabled],
  );

  const allOptions = useMemo(() => options ?? [], [options]);
  const visibleOptions = useMemo(() => {
    if (!filter || !filterValue) return allOptions;
    const q = filterValue.trim().toLocaleLowerCase();
    const fields = filterBy ? filterBy.split(",") : [optionLabel];
    return allOptions.filter((o) => fields.some((f) => String(f ? resolveField(o, f) : getLabel(o)).toLocaleLowerCase().includes(q)));
  }, [allOptions, filter, filterValue, filterBy, optionLabel, getLabel]);

  const valueEquals = useCallback(
    (o: any) => {
      const ov = getValue(o);
      if (dataKey && ov && value && typeof ov === "object" && typeof value === "object") return resolveField(ov, dataKey) === resolveField(value, dataKey);
      return deepEquals(ov, value);
    },
    [getValue, value, dataKey],
  );

  const selectedIndexAll = allOptions.findIndex(valueEquals);
  const selectedOption = selectedIndexAll !== -1 ? allOptions[selectedIndexAll] : undefined;
  const hasSelected = selectedIndexAll !== -1;
  const label = hasSelected ? getLabel(selectedOption) : placeholder || "p-emptylabel";
  const filled = value !== undefined && value !== null && value !== "" && hasSelected;
  const isValid = (o: any) => o !== undefined && o !== null && !isDisabledOpt(o);
  const findFirst = () => visibleOptions.findIndex(isValid);
  const findLast = () => {
    for (let i = visibleOptions.length - 1; i >= 0; i--) if (isValid(visibleOptions[i])) return i;
    return -1;
  };
  const findSelectedVisible = () => visibleOptions.findIndex((o) => isValid(o) && valueEquals(o));
  const findFirstFocused = () => {
    const s = findSelectedVisible();
    return s < 0 ? findFirst() : s;
  };
  const findLastFocused = () => {
    const s = findSelectedVisible();
    return s < 0 ? findLast() : s;
  };
  const findNext = (i: number) => {
    for (let k = i + 1; k < visibleOptions.length; k++) if (isValid(visibleOptions[k])) return k;
    return i;
  };
  const findPrev = (i: number) => {
    for (let k = i - 1; k >= 0; k--) if (isValid(visibleOptions[k])) return k;
    return i;
  };

  const show = (focusLabel?: boolean) => {
    setOverlayVisible(true);
    setFocusedIndex((cur) => (cur !== -1 ? cur : autoOptionFocus ? findFirstFocused() : findSelectedVisible()));
    if (focusLabel) labelRef.current?.focus();
  };
  const hide = (focusLabel?: boolean) => {
    setOverlayVisible(false);
    setFocusedIndex(-1);
    setClicked(false);
    searchRef.current.value = "";
    if (filter && resetFilterOnHide) setFilterValue("");
    if (focusLabel) labelRef.current?.focus();
  };

  const scrollInView = useCallback((index: number) => {
    const li = overlayContentRef.current?.querySelector<HTMLElement>(`[id$="_${index}"]`);
    li?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  useEffect(() => {
    if (overlayVisible && focusedIndex !== -1) scrollInView(focusedIndex);
  }, [focusedIndex, overlayVisible, scrollInView]);

  const selectOption = (e: Event | React.SyntheticEvent, option: any, hideAfter = true) => {
    if (isDisabledOpt(option)) return;
    if (!valueEquals(option)) {
      const v = getValue(option);
      setFocusedIndex(visibleOptions.indexOf(option));
      onChange?.({ originalEvent: e, value: v });
    }
    if (hideAfter) hide(true);
  };

  const clear = (e: React.SyntheticEvent) => {
    onChange?.({ originalEvent: e, value: null });
    onClear?.(e);
    setFilterValue("");
  };

  const changeFocus = (index: number) => {
    if (focusedIndex !== index) {
      setFocusedIndex(index);
      scrollInView(index);
    }
  };

  const searchOptions = (char: string) => {
    const s = searchRef.current;
    s.value += char;
    let idx = visibleOptions.findIndex((o) => isValid(o) && getLabel(o).toLocaleLowerCase().startsWith(s.value.toLocaleLowerCase()));
    if (idx === -1 && focusedIndex === -1) idx = findFirstFocused();
    if (idx !== -1) setTimeout(() => changeFocus(idx));
    if (s.timer) clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      s.value = "";
      s.timer = 0;
    }, 500);
  };

  const onKeyDown = (e: React.KeyboardEvent, inFilter = false) => {
    if (disabled || readOnly || loading) return;
    const prevent = () => {
      e.preventDefault();
    };
    switch (e.code) {
      case "ArrowDown":
        if (!overlayVisible) show();
        else changeFocus(focusedIndex !== -1 ? findNext(focusedIndex) : clicked ? findFirst() : findFirstFocused());
        prevent();
        break;
      case "ArrowUp":
        if (e.altKey && !inFilter) {
          if (focusedIndex !== -1) selectOption(e, visibleOptions[focusedIndex]);
          if (overlayVisible) hide();
        } else {
          changeFocus(focusedIndex !== -1 ? findPrev(focusedIndex) : clicked ? findLast() : findLastFocused());
          if (!overlayVisible) show();
        }
        prevent();
        e.stopPropagation();
        break;
      case "ArrowLeft":
      case "ArrowRight":
        if (inFilter) setFocusedIndex(-1);
        break;
      case "Delete":
        if (showClear && filled) {
          clear(e);
          prevent();
        }
        break;
      case "Home":
        if (inFilter) break;
        changeFocus(findFirst());
        if (!overlayVisible) show();
        prevent();
        break;
      case "End":
        if (inFilter) break;
        changeFocus(findLast());
        if (!overlayVisible) show();
        prevent();
        break;
      case "PageDown":
        scrollInView(visibleOptions.length - 1);
        prevent();
        break;
      case "PageUp":
        scrollInView(0);
        prevent();
        break;
      case "Space":
      case "Enter":
      case "NumpadEnter":
        if (e.code === "Space" && inFilter) break;
        if (!overlayVisible) {
          setFocusedIndex(-1);
          show();
        } else {
          if (focusedIndex !== -1) selectOption(e, visibleOptions[focusedIndex], !inFilter);
          if (!inFilter) hide();
        }
        prevent();
        break;
      case "Escape":
        if (overlayVisible) {
          hide(true);
          prevent();
          e.stopPropagation();
        }
        break;
      case "Tab":
        if (!inFilter) {
          if (overlayVisible && overlayContentRef.current?.querySelector(".p-select-filter")) {
            filterRef.current?.focus();
            prevent();
          } else {
            if (focusedIndex !== -1 && overlayVisible) selectOption(e, visibleOptions[focusedIndex]);
            if (overlayVisible) hide(filter);
          }
        } else if (overlayVisible) {
          hide(true);
        }
        e.stopPropagation();
        break;
      case "ShiftLeft":
      case "ShiftRight":
        break;
      default:
        if (!inFilter && !e.metaKey && !e.ctrlKey && isPrintable(e.key)) {
          if (!overlayVisible) show();
          searchOptions(e.key);
        }
    }
    setClicked(false);
  };

  const onContainerClick = (e: React.MouseEvent<HTMLElement>) => {
    if (disabled || readOnly || loading) return;
    const t = e.target as HTMLElement;
    if (t.tagName === "INPUT" || t.getAttribute("data-pc-section") === "clearicon" || t.closest('[data-pc-section="clearicon"]')) return;
    if (!overlayContentRef.current?.closest(".p-overlay")?.contains(t)) {
      overlayVisible ? hide(true) : show(true);
    }
    labelRef.current?.focus({ preventScroll: true });
    onClick?.(e);
    setClicked(true);
  };

  useLayoutEffect(() => {
    if (autoFocus) labelRef.current?.focus();
  }, [autoFocus]);

  const showClearIcon = filled && showClear && !disabled;
  const labelClass = cn("p-select-label", {
    "p-placeholder": !!placeholder && label === placeholder,
    "p-select-label-empty": !selectedItemTemplate && (label === undefined || label === null || label === "p-emptylabel" || label.length === 0),
  });

  const listId = `${id}_list`;
  const rootClass = cn(
    "p-select p-component p-inputwrapper",
    {
      "p-disabled": disabled,
      "p-variant-filled": variant === "filled",
      "p-focus": focused,
      "p-invalid": invalid,
      "p-inputwrapper-filled": filled,
      "p-inputwrapper-focus": focused || overlayVisible,
      "p-select-open": overlayVisible,
      "p-select-fluid": hasFluid,
      "p-select-sm p-inputfield-sm": size === "small",
      "p-select-lg p-inputfield-lg": size === "large",
    },
    className,
  );

  const focusedOptionId = focusedIndex !== -1 ? `${id}_${focusedIndex}` : undefined;

  const emptyText = filterValue ? emptyFilterMessage : emptyMessage;
  const isEmpty = visibleOptions.length === 0;

  const rootChildren = (
    <>
      <span
        ref={labelRef}
        className={labelClass}
        id={inputId}
        role="combobox"
        aria-disabled={disabled}
        aria-label={ariaLabel || (label === "p-emptylabel" ? undefined : label)}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={overlayVisible}
        aria-controls={overlayVisible ? listId : undefined}
        tabIndex={!disabled ? tabIndex : -1}
        aria-activedescendant={focused ? focusedOptionId : undefined}
        data-pc-section="label"
        onFocus={(e) => {
          if (disabled) return;
          setFocused(true);
          setFocusedIndex((cur) => (cur !== -1 ? cur : overlayVisible && autoOptionFocus ? findFirstFocused() : -1));
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        onKeyDown={(e) => onKeyDown(e)}
      >
        {selectedItemTemplate && hasSelected
          ? selectedItemTemplate(selectedOption)
          : label === "p-emptylabel"
            ? " "
            : label}
      </span>
      {showClearIcon && <PrimeIcon name="times" className="p-select-clear-icon" section="clearicon" onClick={clear} />}
      <div className="p-select-dropdown" role="button" aria-label="dropdown trigger" aria-haspopup="listbox" aria-expanded={overlayVisible} data-pc-section="dropdown">
        {loading ? (
          <span className="p-select-loading-icon pi pi-spinner pi-spin" data-pc-section="loadingicon" aria-hidden="true" />
        ) : dropdownIcon ? (
          <span className={cn("p-select-dropdown-icon", dropdownIcon)} data-pc-section="dropdownicon" />
        ) : (
          <PrimeIcon name="chevron-down" className="p-select-dropdown-icon" section="dropdownicon" />
        )}
      </div>
      <ConnectedOverlay
        visible={overlayVisible}
        targetRef={rootRef}
        hostName="select"
        appendTo={appendTo}
        alignKey={visibleOptions.length}
        onHide={() => hide()}
        onShow={() => {
          listWrapRef.current
            ?.querySelector<HTMLElement>(".p-select-option.p-select-option-selected")
            ?.scrollIntoView({ block: "nearest", inline: "nearest" });
          if (filter && autofocusFilter) filterRef.current?.focus();
          onShow?.();
        }}
        onAfterHide={() => onHide?.()}
      >
        <div ref={overlayContentRef} className={cn("p-select-overlay p-component-overlay p-component", panelStyleClass)} data-pc-section="overlay" style={panelStyle}>
          <span
            role="presentation"
            className="p-hidden-accessible p-hidden-focusable"
            tabIndex={0}
            data-p-hidden-accessible="true"
            data-p-hidden-focusable="true"
            data-pc-section="hiddenfirstfocusableel"
            onFocus={(e) => (e.relatedTarget === labelRef.current ? (overlayContentRef.current?.querySelector<HTMLElement>("input, [tabindex]:not(.p-hidden-focusable)")?.focus()) : labelRef.current?.focus())}
          />
          {filter && (
            <div className="p-select-header" data-pc-section="header" onClick={(e) => e.stopPropagation()}>
              {createElement(
                "p-iconfield",
                { className: "p-iconfield" },
                <input
                  ref={filterRef}
                  type="text"
                  role="searchbox"
                  autoComplete="off"
                  value={filterValue}
                  className="p-select-filter p-component p-inputtext"
                  data-pc-name="pcinputtext"
                  data-pc-extend="inputtext"
                  data-pc-section="root"
                  placeholder={filterPlaceholder}
                  aria-owns={listId}
                  aria-activedescendant={focusedOptionId}
                  onChange={(e) => {
                    setFilterValue(e.target.value);
                    setFocusedIndex(-1);
                    onFilter?.({ originalEvent: e, filter: e.target.value });
                  }}
                  onKeyDown={(e) => onKeyDown(e, true)}
                  onBlur={() => setFocusedIndex(-1)}
                />,
                createElement("p-inputicon", { className: "p-inputicon" }, <PrimeIcon name="search" />),
              )}
            </div>
          )}
          <div ref={listWrapRef} className="p-select-list-container" data-pc-section="listcontainer" style={{ maxHeight: scrollHeight || "auto" }}>
            <ul id={listId} role="listbox" className="p-select-list" aria-label="Option List" data-pc-section="list">
              {visibleOptions.map((option, i) => {
                const selected = valueEquals(option);
                const dis = isDisabledOpt(option);
                const foc = focusedIndex === i;
                const lbl = getLabel(option);
                return createElement(
                  "p-selectitem",
                  { key: i },
                  <li
                    id={`${id}_${i}`}
                    role="option"
                    className={cn("p-ripple", "p-select-option", { "p-select-option-selected": selected && !checkmark, "p-disabled": dis, "p-focus": foc })}
                    aria-label={lbl}
                    aria-setsize={visibleOptions.length}
                    aria-posinset={i + 1}
                    aria-selected={selected}
                    data-p-focused={foc}
                    data-p-highlight={selected}
                    data-p-disabled={dis}
                    data-pc-section="option"
                    onClick={(e) => selectOption(e, option)}
                    onMouseEnter={() => focusOnHover && setFocusedIndex(i)}
                  >
                    {checkmark && (selected ? <PrimeIcon name="check" className="p-select-option-check-icon" /> : <PrimeIcon name="blank" className="p-select-option-blank-icon" />)}
                    {itemTemplate ? itemTemplate(option, i) : <span data-pc-section="optionlabel">{lbl ?? "empty"}</span>}
                  </li>,
                );
              })}
              {isEmpty && (
                <li className="p-select-empty-message" role="option" data-pc-section="emptymessage">
                  {emptyText}
                </li>
              )}
            </ul>
          </div>
          <span
            role="presentation"
            className="p-hidden-accessible p-hidden-focusable"
            tabIndex={0}
            data-p-hidden-accessible="true"
            data-p-hidden-focusable="true"
            data-pc-section="hiddenlastfocusableel"
            onFocus={() => labelRef.current?.focus()}
          />
        </div>
      </ConnectedOverlay>
    </>
  );

  return createElement(
    "p-select",
    {
      ref: rootRef,
      id: idProp,
      className: rootClass,
      style,
      "data-pc-section": "root",
      "data-pc-name": "select",
      onClick: onContainerClick,
      ...rest,
    },
    rootChildren,
  );
});
