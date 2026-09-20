import { forwardRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { classNames, host } from "./internal/basic";

export interface AvatarProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  label?: string;
  /** PrimeIcons class string. */
  icon?: string;
  image?: string;
  size?: "normal" | "large" | "xlarge";
  shape?: "square" | "circle";
  ariaLabel?: string;
  ariaLabelledBy?: string;
  onImageError?: (e: unknown) => void;
  /** Projected content, rendered before label/icon/image. */
  children?: ReactNode;
}

/** `<p-avatar>`: `p-avatar` host > label / icon / img. */
export const Avatar = forwardRef<HTMLElement, AvatarProps>(function Avatar(
  { label, icon, image, size = "normal", shape = "square", ariaLabel, ariaLabelledBy, onImageError, className, children, ...rest },
  ref,
) {
  const [failed, setFailed] = useState(false);
  const cls = classNames("p-avatar p-component", image != null && "p-avatar-image", shape === "circle" && "p-avatar-circle", size === "large" && "p-avatar-lg", size === "xlarge" && "p-avatar-xl", className);
  return host(
    "p-avatar",
    { ref, className: cls, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, ...rest },
    children,
    label ? <span className="p-avatar-label">{label}</span> : icon ? <span className={classNames(icon, "p-avatar-icon")} /> : image && !failed ? <img src={image} aria-label={ariaLabel} onError={(e) => { setFailed(true); onImageError?.(e); }} /> : null,
  );
});
