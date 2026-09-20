import { forwardRef, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { classNames, host } from "./internal/basic";
import { RIPPLE_CLASS, useRipple } from "./Ripple";

export interface ToggleButtonChangeEvent {
  originalEvent: MouseEvent | KeyboardEvent;
  checked: boolean;
}

export interface ToggleButtonProps {
  /** Checked state (PrimeNG ngModel). Omit for uncontrolled (`defaultChecked`). */
  value?: boolean;
  defaultChecked?: boolean;
  /** Called with the new checked boolean. */
  onChange?: (checked: boolean, event: ToggleButtonChangeEvent) => void;
  onLabel?: string;
  offLabel?: string;
  /** PrimeIcons class strings. */
  onIcon?: string;
  offIcon?: string;
  iconPos?: "left" | "right";
  size?: "small" | "large";
  fluid?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** When false the button can't be unchecked once checked. Default true. */
  allowEmpty?: boolean;
  tabIndex?: number;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  /** `#content` template: replaces icon+label. */
  contentTemplate?: (checked: boolean) => ReactNode;
  /** `#icon` template. */
  iconTemplate?: (checked: boolean) => ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
  title?: string;
}

/** `<p-togglebutton>`: `p-togglebutton` host (role=button) > `span.p-togglebutton-content` > icon + `span.p-togglebutton-label`. */
export const ToggleButton = forwardRef<HTMLElement, ToggleButtonProps>(function ToggleButton(props, ref) {
  const { value, defaultChecked, onChange, onLabel, offLabel, onIcon, offIcon, iconPos = "left", size, fluid, disabled, invalid, allowEmpty, tabIndex, ariaLabel, ariaLabelledBy, contentTemplate, iconTemplate, className, style, ...hostRest } = props;
  const local = useRef<HTMLElement | null>(null);
  useRipple(local);
  const [inner, setInner] = useState(!!defaultChecked);
  const controlled = value !== undefined;
  const checked = controlled ? !!value : inner;

  const toggle = (e: MouseEvent | KeyboardEvent) => {
    if (disabled || (allowEmpty === false && checked)) return;
    const next = !checked;
    if (!controlled) setInner(next);
    onChange?.(next, { originalEvent: e, checked: next });
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Enter" || e.code === "Space") {
      toggle(e);
      e.preventDefault();
    }
  };
  const cls = classNames(
    RIPPLE_CLASS,
    "p-togglebutton p-component",
    checked && "p-togglebutton-checked",
    invalid && "p-invalid",
    disabled && "p-disabled",
    size === "small" && "p-togglebutton-sm p-inputfield-sm",
    size === "large" && "p-togglebutton-lg p-inputfield-lg",
    fluid && "p-togglebutton-fluid",
    className,
  );
  const label = checked ? (onLabel ? onLabel : " ") : offLabel ? offLabel : " ";
  return host(
    "p-togglebutton",
    {
      ref: (n: HTMLElement | null) => {
        local.current = n;
        if (typeof ref === "function") ref(n);
        else if (ref) ref.current = n;
      },
      className: cls,
      style,
      role: "button",
      "aria-labelledby": ariaLabelledBy,
      "aria-label": ariaLabel,
      "aria-pressed": checked ? "true" : "false",
      tabIndex: tabIndex !== undefined ? tabIndex : !disabled ? 0 : -1,
      "data-pc-name": "togglebutton",
      onClick: toggle,
      onKeyDown,
      ...hostRest,
    },
    <span className="p-togglebutton-content">
      {contentTemplate ? (
        contentTemplate(checked)
      ) : (
        <>
          {iconTemplate ? iconTemplate(checked) : (onIcon || offIcon) && <span className={classNames("p-togglebutton-icon", checked ? onIcon : offIcon, iconPos === "left" ? "p-togglebutton-icon-left" : "p-togglebutton-icon-right")} />}
          <span className="p-togglebutton-label">{label}</span>
        </>
      )}
    </span>,
  );
});
