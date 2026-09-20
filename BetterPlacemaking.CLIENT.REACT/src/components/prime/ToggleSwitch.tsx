import { forwardRef, useImperativeHandle, useRef, useState, type ChangeEvent, type CSSProperties, type FocusEvent, type ReactNode } from "react";
import { classNames, host } from "./internal/basic";

export interface ToggleSwitchProps {
  /** Model (PrimeNG ngModel). Boolean, or `trueValue`/`falseValue`. Omit for uncontrolled (`defaultChecked`). */
  value?: unknown;
  defaultChecked?: boolean;
  trueValue?: unknown;
  falseValue?: unknown;
  onChange?: (value: any, event: ChangeEvent<HTMLInputElement>) => void;
  inputId?: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
  tabIndex?: number;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  /** `#handle` template. */
  handleTemplate?: (checked: boolean) => ReactNode;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  /** Class on the `p-toggleswitch` host. */
  className?: string;
  style?: CSSProperties;
  id?: string;
  title?: string;
}

/** `<p-toggleswitch>`: host (inline `position: relative`) > `input.p-toggleswitch-input[role=switch]` + `.p-toggleswitch-slider` > `.p-toggleswitch-handle`. */
export const ToggleSwitch = forwardRef<HTMLInputElement, ToggleSwitchProps>(function ToggleSwitch(props, ref) {
  const { value, defaultChecked, trueValue = true, falseValue = false, onChange, inputId, name, disabled, readOnly, required, invalid, tabIndex, ariaLabel, ariaLabelledBy, handleTemplate, onFocus, onBlur, className, style, ...hostRest } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const [inner, setInner] = useState(!!defaultChecked);
  const controlled = value !== undefined;
  const checked = controlled ? value === trueValue : inner;
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (disabled || readOnly) return;
    if (!controlled) setInner(!checked);
    onChange?.(checked ? falseValue : trueValue, e);
  };
  return host(
    "p-toggleswitch",
    {
      className: classNames("p-toggleswitch p-component", checked && "p-toggleswitch-checked", disabled && "p-disabled", invalid && "p-invalid", className),
      style: { position: "relative", ...style },
      "data-pc-name": "toggleswitch",
      ...hostRest,
    },
    <input
      ref={inputRef}
      id={inputId}
      type="checkbox"
      role="switch"
      className="p-toggleswitch-input"
      checked={checked}
      required={required || undefined}
      disabled={disabled || undefined}
      aria-checked={checked}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      name={name}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={handleChange}
    />,
    <div className="p-toggleswitch-slider">
      <div className="p-toggleswitch-handle">{handleTemplate?.(checked)}</div>
    </div>,
  );
});
