import { forwardRef, useImperativeHandle, useRef, useState, type ChangeEvent, type CSSProperties, type FocusEvent, type ReactNode } from "react";
import { CheckIcon, classNames, host, MinusIcon } from "./internal/basic";

export interface CheckboxProps {
  /**
   * Model (PrimeNG ngModel). Binary mode (`binary`): boolean (or trueValue/falseValue). Group mode: array of the
   * checked `itemValue`s. Omit for uncontrolled binary mode (use `defaultChecked`).
   */
  value?: unknown;
  /** Group mode: the value this checkbox contributes to the array (PrimeNG's `[value]` input). */
  itemValue?: unknown;
  binary?: boolean;
  trueValue?: unknown;
  falseValue?: unknown;
  defaultChecked?: boolean;
  /** Forces the checked state, ignoring `value`. */
  checked?: boolean;
  indeterminate?: boolean;
  /** Called with the new model: boolean/trueValue/falseValue (binary) or the new array (group). */
  onChange?: (value: any, event: ChangeEvent<HTMLInputElement>) => void;
  inputId?: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
  variant?: "filled" | "outlined";
  size?: "small" | "large";
  tabIndex?: number;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  /** Custom class of the native input (`p-checkbox-input`). */
  inputClassName?: string;
  inputStyle?: CSSProperties;
  /** Custom check icon class (`p-checkbox-icon` span) instead of the SVG. */
  checkboxIcon?: string;
  /** `#icon` template: `(checked) => node`. */
  checkboxIconTemplate?: (checked: boolean) => ReactNode;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  /** Class on the `p-checkbox` host (PrimeNG styleClass). */
  className?: string;
  style?: CSSProperties;
  id?: string;
  title?: string;
}

const eq = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** `<p-checkbox>`: `p-checkbox` host > `input.p-checkbox-input` + `div.p-checkbox-box` > svg.p-checkbox-icon. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(props, ref) {
  const {
    value, itemValue, binary, trueValue = true, falseValue = false, defaultChecked, checked: checkedProp, indeterminate, onChange,
    inputId, name, disabled, readOnly, required, invalid, variant, size, tabIndex, ariaLabel, ariaLabelledBy, inputClassName, inputStyle,
    checkboxIcon, checkboxIconTemplate, onFocus, onBlur, className, style, ...hostRest
  } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const [inner, setInner] = useState<boolean>(!!defaultChecked);
  const controlled = value !== undefined || checkedProp !== undefined;

  let checked: boolean;
  if (checkedProp !== undefined) checked = checkedProp;
  else if (!controlled) checked = inner;
  else if (binary) checked = eq(value, trueValue);
  else checked = Array.isArray(value) && value.some((v) => eq(v, itemValue));

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (readOnly || disabled) return;
    let next: unknown;
    if (binary || !Array.isArray(value)) {
      next = indeterminate ? trueValue : checked ? falseValue : trueValue;
      if (!controlled) setInner(!checked);
    } else {
      next = checked || indeterminate ? value.filter((v) => !eq(v, itemValue)) : [...value, itemValue];
    }
    onChange?.(next, e);
  };

  const cls = classNames(
    "p-checkbox p-component",
    checked && "p-checkbox-checked p-highlight",
    disabled && "p-disabled",
    invalid && "p-invalid",
    variant === "filled" && "p-variant-filled",
    size === "small" && "p-checkbox-sm p-inputfield-sm",
    size === "large" && "p-checkbox-lg p-inputfield-lg",
    className,
  );
  return host(
    "p-checkbox",
    { className: cls, style, "data-p-highlight": String(checked), "data-p-checked": String(checked), "data-p-disabled": String(!!disabled), ...hostRest },
    <input
      ref={inputRef}
      id={inputId}
      type="checkbox"
      value={itemValue === undefined || typeof itemValue === "object" ? undefined : String(itemValue)}
      name={name}
      checked={checked}
      tabIndex={tabIndex}
      required={required || undefined}
      readOnly={readOnly || undefined}
      disabled={disabled || undefined}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      style={inputStyle}
      className={classNames("p-checkbox-input", inputClassName)}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={handleChange}
    />,
    <div className="p-checkbox-box">
      {checkboxIconTemplate ? (
        checkboxIconTemplate(checked)
      ) : (
        <>
          {checked && (checkboxIcon ? <span className={classNames("p-checkbox-icon", checkboxIcon)} /> : <CheckIcon className="p-checkbox-icon" />)}
          {indeterminate && <MinusIcon className="p-checkbox-icon" />}
        </>
      )}
    </div>,
  );
});
