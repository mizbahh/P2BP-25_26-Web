import { forwardRef, useImperativeHandle, useRef, type ButtonHTMLAttributes, type CSSProperties, type FocusEvent, type MouseEvent, type ReactNode } from "react";
import { Badge } from "./Badge";
import { classNames, host, SpinnerIcon } from "./internal/basic";
import { RIPPLE_CLASS, useRipple } from "./Ripple";

export type ButtonSeverity = "secondary" | "success" | "info" | "warn" | "danger" | "help" | "contrast";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "onFocus" | "onBlur" | "className" | "style" | "type" | "children"> {
  label?: string;
  /** PrimeIcons class string, e.g. "pi pi-refresh". */
  icon?: string;
  iconPos?: "left" | "right" | "top" | "bottom";
  severity?: ButtonSeverity;
  outlined?: boolean;
  text?: boolean;
  rounded?: boolean;
  raised?: boolean;
  plain?: boolean;
  link?: boolean;
  /** PrimeNG `variant="text" | "outlined"` (same effect as `text` / `outlined`). */
  variant?: "text" | "outlined";
  size?: "small" | "large";
  loading?: boolean;
  loadingIcon?: string;
  /** Text of the badge rendered after the label. */
  badge?: string | number;
  badgeSeverity?: "secondary" | "info" | "success" | "warn" | "danger" | "contrast";
  disabled?: boolean;
  fluid?: boolean;
  type?: "button" | "submit" | "reset";
  ariaLabel?: string;
  /** PrimeNG `styleClass`: lands on the inner `<button>` (NOT the `<p-button>` host). */
  className?: string;
  /** PrimeNG `style`: applied to the inner `<button>`. */
  style?: CSSProperties;
  /** The `class="..."` attribute written on `<p-button>` in Angular templates: lands on the host element. */
  hostClassName?: string;
  /** Inline style on the `<p-button>` host element. */
  hostStyle?: CSSProperties;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onFocus?: (event: FocusEvent<HTMLButtonElement>) => void;
  onBlur?: (event: FocusEvent<HTMLButtonElement>) => void;
  /** `<ng-template #icon>`: custom icon node rendered instead of the `icon` span (counts as an icon for icon-only). */
  iconTemplate?: ReactNode;
  /** Projected content variant: rendered inside the button before the icon/label (like `<ng-content>`). */
  children?: ReactNode;
}

/**
 * `<p-button>`: `p-button` host element wrapping `button.p-button`. `className` is PrimeNG's `styleClass`
 * (inner button); use `hostClassName` for what Angular templates write as `class="..."` on `<p-button>`.
 * Remaining native props (id, title, aria-*, data-*, tabIndex...) land on the inner button.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    label, icon, iconPos = "left", severity, outlined, text, rounded, raised, plain, link, variant, size, loading, loadingIcon,
    badge, badgeSeverity = "secondary", iconTemplate, disabled, fluid, type = "button", ariaLabel, className, style, hostClassName, hostStyle,
    onClick, onFocus, onBlur, children, ...rest
  },
  ref,
) {
  const btnRef = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => btnRef.current as HTMLButtonElement);
  useRipple(btnRef);

  const hasChildren = children !== undefined && children !== null && children !== false;
  const iconOnly = !!(icon || loadingIcon || iconTemplate) && !label;
  const vertical = (iconPos === "top" || iconPos === "bottom") && !!label;
  const cls = classNames(
    RIPPLE_CLASS,
    "p-button p-component",
    iconOnly && "p-button-icon-only",
    vertical && "p-button-vertical",
    loading && "p-button-loading",
    link && "p-button-link",
    severity && `p-button-${severity}`,
    raised && "p-button-raised",
    rounded && "p-button-rounded",
    (text || variant === "text") && "p-button-text",
    (outlined || variant === "outlined") && "p-button-outlined",
    size === "small" && "p-button-sm",
    size === "large" && "p-button-lg",
    plain && "p-button-plain",
    fluid && "p-button-fluid",
    className,
  );
  const iconPosClass = label && `p-button-icon-${iconPos}`;
  const spinnerCls = classNames(
    "p-button-loading-icon",
    "p-button-loading-icon pi-spin",
    loadingIcon,
    "p-button-icon",
    icon,
    iconPos === "left" && label && "p-button-icon-left",
    iconPos === "right" && label && "p-button-icon-right",
    iconPos === "top" && label && "p-button-icon-top",
    iconPos === "bottom" && label && "p-button-icon-bottom",
  );

  const inner = (
    <button
      {...rest}
      ref={btnRef}
      type={type}
      aria-label={ariaLabel}
      style={style}
      disabled={disabled || loading}
      className={cls}
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {children}
      {loading &&
        (loadingIcon ? (
          <span className={classNames("p-button-loading-icon", "pi-spin", loadingIcon)} aria-hidden="true" />
        ) : (
          <SpinnerIcon spin className={spinnerCls} aria-hidden="true" />
        ))}
      {!loading && icon && <span className={classNames("icon", "p-button-icon", iconPosClass, icon)} />}
      {!loading && !icon && iconTemplate}
      {!hasChildren && label && (
        <span className="p-button-label" aria-hidden={icon ? (label ? "false" : "true") : undefined}>
          {label}
        </span>
      )}
      {!hasChildren && badge !== undefined && badge !== null && badge !== "" && <Badge value={badge} severity={badgeSeverity} />}
    </button>
  );
  return host("p-button", { className: hostClassName, style: hostStyle }, inner);
});
