import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { classNames, host } from "./internal/basic";

export interface DividerProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  layout?: "horizontal" | "vertical";
  type?: "solid" | "dashed" | "dotted";
  align?: "left" | "center" | "right" | "top" | "bottom";
  children?: ReactNode;
}

/** `<p-divider>`: `p-divider` host [role=separator] > `.p-divider-content`. */
export const Divider = forwardRef<HTMLElement, DividerProps>(function Divider(
  { layout = "horizontal", type = "solid", align, className, children, ...rest },
  ref,
) {
  const h = layout === "horizontal";
  const cls = classNames(
    "p-divider p-component",
    `p-divider-${layout}`,
    `p-divider-${type}`,
    h && (!align || align === "left") && "p-divider-left",
    h && align === "center" && "p-divider-center",
    h && align === "right" && "p-divider-right",
    !h && align === "top" && "p-divider-top",
    !h && (!align || align === "center") && "p-divider-center",
    !h && align === "bottom" && "p-divider-bottom",
    className,
  );
  return host("p-divider", { ref, className: cls, role: "separator", "aria-orientation": layout, ...rest }, <div className="p-divider-content">{children}</div>);
});
