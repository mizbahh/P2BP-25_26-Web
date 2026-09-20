import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { classNames, host } from "./internal/basic";

export interface TagProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  value?: string | number;
  severity?: "success" | "info" | "warn" | "danger" | "secondary" | "contrast" | null;
  /** PrimeIcons class string; rendered as `span.p-tag-icon`. */
  icon?: string;
  rounded?: boolean;
  /** `#icon` template: rendered inside `span.p-tag-icon`. */
  iconTemplate?: ReactNode;
  /** Projected content, rendered before the icon/label (like `<ng-content>`). */
  children?: ReactNode;
}

/** `<p-tag>`: classes (incl. className = styleClass) land on the `p-tag` host; label in `span.p-tag-label`. */
export const Tag = forwardRef<HTMLElement, TagProps>(function Tag(
  { value, severity, icon, rounded, iconTemplate, children, className, ...rest },
  ref,
) {
  const cls = classNames("p-tag p-component", severity && `p-tag-${severity}`, rounded && "p-tag-rounded", className);
  return host(
    "p-tag",
    { ref, className: cls, ...rest },
    children,
    !iconTemplate && icon && <span className={classNames("p-tag-icon", icon)} />,
    iconTemplate && <span className="p-tag-icon">{iconTemplate}</span>,
    <span className="p-tag-label">{value}</span>,
  );
});
