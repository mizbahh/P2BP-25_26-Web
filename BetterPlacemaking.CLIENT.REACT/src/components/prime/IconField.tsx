import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { classNames, host } from "./internal/basic";

export interface IconFieldProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Default "left" (icon before the input). */
  iconPosition?: "left" | "right";
  children?: ReactNode;
}

/** `<p-iconfield>`: `p-iconfield p-iconfield-left` host wrapping `<InputIcon>` + an `<InputText>`. */
export const IconField = forwardRef<HTMLElement, IconFieldProps>(function IconField(
  { iconPosition = "left", className, children, ...rest },
  ref,
) {
  return host(
    "p-iconfield",
    { ref, className: classNames("p-iconfield", iconPosition === "left" && "p-iconfield-left", iconPosition === "right" && "p-iconfield-right", className), ...rest },
    children,
  );
});

export interface InputIconProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** `className` is PrimeNG's styleClass - pass the icon class here, e.g. className="pi pi-search". */
  children?: ReactNode;
}

/** `<p-inputicon styleClass="pi pi-search">`: `p-inputicon` host element (icon class goes in className). */
export const InputIcon = forwardRef<HTMLElement, InputIconProps>(function InputIcon({ className, children, ...rest }, ref) {
  return host("p-inputicon", { ref, className: classNames("p-inputicon", className), ...rest }, children);
});
