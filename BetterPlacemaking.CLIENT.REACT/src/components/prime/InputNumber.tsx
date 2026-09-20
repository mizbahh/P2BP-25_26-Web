import { createElement, forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PrimeIcon } from "./_inputs/PrimeIcon";
import { cn, useFluid } from "./_inputs/utils";

/**
 * React port of PrimeNG `<p-inputnumber>`: `p-inputnumber > input.p-inputnumber-input + (button group | increment/decrement buttons)`.
 *   <InputNumber value={n} onChange={setN} min={2} max={20} useGrouping={false} showButtons buttonLayout="horizontal"
 *      decrementButtonIcon="pi pi-minus" incrementButtonIcon="pi pi-plus" className="bp-stepper-medium" />
 * `value: number | null`, `onChange(value: number | null)` replaces ngModelChange. `className` = PrimeNG styleClass.
 */
export interface InputNumberProps {
  value?: number | null;
  onChange?: (value: number | null) => void;
  min?: number | null;
  max?: number | null;
  step?: number;
  showButtons?: boolean;
  buttonLayout?: "stacked" | "horizontal" | "vertical";
  incrementButtonIcon?: string;
  decrementButtonIcon?: string;
  incrementButtonClass?: string;
  decrementButtonClass?: string;
  mode?: "decimal" | "currency";
  currency?: string;
  locale?: string;
  useGrouping?: boolean;
  minFractionDigits?: number;
  maxFractionDigits?: number;
  prefix?: string;
  suffix?: string;
  allowEmpty?: boolean;
  showClear?: boolean;
  placeholder?: string;
  inputId?: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  fluid?: boolean;
  tabIndex?: number;
  autoFocus?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  className?: string;
  style?: CSSProperties;
  inputStyleClass?: string;
  inputStyle?: CSSProperties;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  incrementButtonIconTemplate?: ReactNode;
  decrementButtonIconTemplate?: ReactNode;
  [dataAttr: `data-${string}`]: unknown;
}

export const InputNumber = forwardRef<HTMLElement, InputNumberProps>(function InputNumber(props, ref) {
  const {
    value, onChange, min = null, max = null, step = 1, showButtons = false, buttonLayout = "stacked", incrementButtonIcon, decrementButtonIcon, incrementButtonClass, decrementButtonClass,
    mode = "decimal", currency, locale = "en-US", useGrouping = true, minFractionDigits, maxFractionDigits, prefix, suffix, allowEmpty = true, showClear = false, placeholder, inputId, name,
    disabled = false, readOnly = false, invalid = false, fluid, tabIndex, autoFocus, ariaLabel, ariaLabelledBy, className, style, inputStyleClass, inputStyle, onFocus, onBlur,
    incrementButtonIconTemplate, decrementButtonIconTemplate, ...rest
  } = props;
  const rootRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLElement);
  const hasFluid = useFluid(rootRef, fluid);
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState<string | null>(null); // raw text while editing
  const timer = useRef<number | null>(null);
  const cur = useRef<number | null>(value ?? null);
  cur.current = value ?? null;

  const fmt = (n: number | null | undefined) => {
    if (n === null || n === undefined || isNaN(n)) return "";
    const o: Intl.NumberFormatOptions = { useGrouping, style: mode === "currency" ? "currency" : "decimal", currency: mode === "currency" ? currency || "USD" : undefined };
    if (minFractionDigits !== undefined) o.minimumFractionDigits = minFractionDigits;
    if (maxFractionDigits !== undefined) o.maximumFractionDigits = maxFractionDigits;
    else if (minFractionDigits !== undefined && minFractionDigits > 3) o.maximumFractionDigits = minFractionDigits;
    let s = new Intl.NumberFormat(locale, o).format(n);
    if (prefix) s = prefix + s;
    if (suffix) s += suffix;
    return s;
  };
  const clamp = (n: number) => {
    if (max !== null && n > max) return max;
    if (min !== null && n < min) return min;
    return n;
  };
  const roundTo = (n: number) => {
    const d = maxFractionDigits ?? (mode === "currency" ? 2 : 3);
    const f = Math.pow(10, d);
    return Math.round(n * f) / f;
  };
  const parse = (s: string): number | null => {
    let t = s;
    if (prefix) t = t.split(prefix).join("");
    if (suffix) t = t.split(suffix).join("");
    t = t.replace(/[^0-9.\-]/g, "");
    if (t === "" || t === "-" || t === ".") return null;
    const n = Number(t);
    return isNaN(n) ? null : n;
  };

  const spin = (dir: 1 | -1, mult = 1) => {
    const base = cur.current ?? 0;
    const nv = clamp(roundTo(base + dir * step * mult));
    cur.current = nv;
    setText(null);
    onChange?.(nv);
  };
  const clearTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const repeat = (dir: 1 | -1, iv?: number) => {
    clearTimer();
    timer.current = window.setTimeout(() => repeat(dir, 40), iv || 500);
    spin(dir);
  };
  useEffect(() => () => clearTimer(), []);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const displayed = text ?? fmt(value);
  const filled = value !== null && value !== undefined;

  const btn = (kind: "increment" | "decrement") => {
    const dir = kind === "increment" ? 1 : -1;
    const icon = kind === "increment" ? incrementButtonIcon : decrementButtonIcon;
    const tpl = kind === "increment" ? incrementButtonIconTemplate : decrementButtonIconTemplate;
    return (
      <button
        key={kind}
        type="button"
        className={cn(`p-inputnumber-button p-inputnumber-${kind}-button`, kind === "increment" ? incrementButtonClass : decrementButtonClass)}
        disabled={disabled || undefined}
        tabIndex={-1}
        aria-hidden="true"
        data-pc-section={`${kind}button`}
        onMouseDown={(e) => {
          if (disabled || readOnly) return;
          inputRef.current?.focus();
          repeat(dir);
          e.preventDefault();
        }}
        onMouseUp={clearTimer}
        onMouseLeave={clearTimer}
        onKeyDown={(e) => {
          if (e.code === "Space" || e.code === "Enter") repeat(dir);
        }}
        onKeyUp={clearTimer}
      >
        {icon ? <span className={icon} data-pc-section={`${kind}buttonicon`} /> : (tpl ?? <PrimeIcon name={kind === "increment" ? "angle-up" : "angle-down"} section={`${kind}buttonicon`} />)}
      </button>
    );
  };

  const commit = () => {
    if (text === null) return;
    let n = parse(text);
    if (n === null) {
      if (!allowEmpty) n = clamp(0);
    } else n = clamp(n);
    setText(null);
    if (n !== cur.current) onChange?.(n);
  };

  return createElement(
    "p-inputnumber",
    {
      ref: rootRef,
      className: cn(
        "p-inputnumber p-component p-inputwrapper",
        {
          "p-inputwrapper-filled": filled || allowEmpty === false,
          "p-inputwrapper-focus": focused,
          "p-inputnumber-stacked": showButtons && buttonLayout === "stacked",
          "p-inputnumber-horizontal": showButtons && buttonLayout === "horizontal",
          "p-inputnumber-vertical": showButtons && buttonLayout === "vertical",
          "p-inputnumber-fluid": hasFluid,
          "p-invalid": invalid,
        },
        className,
      ),
      style,
      "data-pc-section": "root",
      "data-pc-name": "inputnumber",
      ...rest,
    },
    <input
      ref={inputRef}
      id={inputId}
      name={name}
      role="spinbutton"
      inputMode="decimal"
      className={cn("p-inputnumber-input p-component p-inputtext", inputStyleClass, { "p-filled": filled, "p-invalid": invalid })}
      style={inputStyle}
      value={displayed}
      aria-valuemin={min ?? undefined}
      aria-valuemax={max ?? undefined}
      aria-valuenow={value ?? undefined}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      placeholder={placeholder}
      tabIndex={tabIndex}
      min={min ?? undefined}
      max={max ?? undefined}
      step={step ?? 1}
      readOnly={readOnly || undefined}
      disabled={disabled || undefined}
      data-pc-name="pcinputtext"
      data-pc-extend="inputtext"
      data-pc-section="root"
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const n = parse(raw);
        if (n !== null && !/[.]$/.test(raw) && !/\.\d*0$/.test(raw)) onChange?.(n);
        else if (n === null && raw === "") onChange?.(null);
      }}
      onKeyDown={(e) => {
        if (readOnly) return;
        if (e.key === "ArrowUp") {
          spin(1);
          e.preventDefault();
        } else if (e.key === "ArrowDown") {
          spin(-1);
          e.preventDefault();
        } else if (e.key === "Home" && min !== null) {
          onChange?.(min);
          setText(null);
          e.preventDefault();
        } else if (e.key === "End" && max !== null) {
          onChange?.(max);
          setText(null);
          e.preventDefault();
        } else if (e.key === "Enter" || e.key === "Tab") commit();
        else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !/[0-9.\-]/.test(e.key)) e.preventDefault();
      }}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        commit();
        onBlur?.(e);
      }}
    />,
    buttonLayout !== "vertical" && showClear && !!value && <PrimeIcon key="clear" name="times" className="p-inputnumber-clear-icon" section="clearicon" onClick={() => onChange?.(null)} />,
    showButtons && buttonLayout === "stacked" && (
      <span key="grp" className="p-inputnumber-button-group" data-pc-section="buttongroup">
        {btn("increment")}
        {btn("decrement")}
      </span>
    ),
    showButtons && buttonLayout !== "stacked" && btn("increment"),
    showButtons && buttonLayout !== "stacked" && btn("decrement"),
  );
});
