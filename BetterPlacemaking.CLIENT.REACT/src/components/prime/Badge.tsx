import { forwardRef, type HTMLAttributes } from "react";
import { classNames, host } from "./internal/basic";

export type BadgeSeverity = "secondary" | "info" | "success" | "warn" | "danger" | "contrast" | null;

export interface BadgeProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Text/number shown. Empty/undefined -> renders the dot variant (`p-badge-dot`). */
  value?: string | number | null;
  severity?: BadgeSeverity;
  /** PrimeNG `size` / `badgeSize`. */
  size?: "small" | "large" | "xlarge";
  /** Hides the badge (`display: none`). */
  badgeDisabled?: boolean;
}

/** `<p-badge>`: class + text land on the `p-badge` host element. */
export const Badge = forwardRef<HTMLElement, BadgeProps>(function Badge(
  { value, severity, size, badgeDisabled, className, style, ...rest },
  ref,
) {
  const empty = value === undefined || value === null || value === "";
  const cls = classNames(
    "p-badge p-component",
    !empty && String(value).length === 1 && "p-badge-circle",
    empty && "p-badge-dot",
    size === "small" && "p-badge-sm",
    size === "large" && "p-badge-lg",
    size === "xlarge" && "p-badge-xl",
    severity && `p-badge-${severity}`,
    className,
  );
  return host("p-badge", { ref, className: cls, style: badgeDisabled ? { ...style, display: "none" } : style, ...rest }, empty ? undefined : String(value));
});
