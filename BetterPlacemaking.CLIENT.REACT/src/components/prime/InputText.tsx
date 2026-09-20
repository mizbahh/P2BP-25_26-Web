import { forwardRef, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { classNames } from "./internal/basic";

export interface InputTextClassOptions {
  filled?: boolean;
  /** PrimeNG `pSize`. */
  pSize?: "small" | "large";
  invalid?: boolean;
  variant?: "filled" | "outlined";
  fluid?: boolean;
  className?: string;
}

/**
 * Class string PrimeNG's `pInputText` directive puts on its host. Use directly for non-`<input>` hosts,
 * e.g. `<textarea className={inputTextClass({ filled: !!notes, className: "w-full" })} />`.
 */
export function inputTextClass({ filled, pSize, invalid, variant, fluid, className }: InputTextClassOptions = {}): string {
  return classNames(
    "p-inputtext p-component",
    filled && "p-filled",
    pSize === "small" && "p-inputtext-sm",
    pSize === "large" && "p-inputtext-lg",
    invalid && "p-invalid",
    variant === "filled" && "p-variant-filled",
    fluid && "p-inputtext-fluid",
    className,
  );
}

export interface InputTextProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** PrimeNG `pSize` (the native `size` attribute is not exposed). */
  pSize?: "small" | "large";
  invalid?: boolean;
  variant?: "filled" | "outlined";
  fluid?: boolean;
}

/** `<input pInputText>`: a native input with `p-inputtext p-component` (+ `p-filled`, `p-invalid`, size...). className is appended. */
export const InputText = forwardRef<HTMLInputElement, InputTextProps>(function InputText(
  { pSize, invalid, variant, fluid, className, onInput, value, defaultValue, ...rest },
  ref,
) {
  const innerRef = useRef<HTMLInputElement | null>(null);
  const controlled = value !== undefined;
  const [uncontrolledFilled, setFilled] = useState(defaultValue !== undefined && String(defaultValue) !== "");
  const filled = controlled ? String(value ?? "") !== "" : uncontrolledFilled;
  useLayoutEffect(() => {
    if (!controlled && innerRef.current) setFilled(innerRef.current.value !== "");
  });
  const handleInput: NonNullable<InputHTMLAttributes<HTMLInputElement>["onInput"]> = (e) => {
    if (!controlled) setFilled(e.currentTarget.value !== "");
    onInput?.(e);
  };
  return (
    <input
      {...rest}
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      {...(controlled ? { value } : { defaultValue })}
      onInput={handleInput}
      className={inputTextClass({ filled, pSize, invalid, variant, fluid, className })}
    />
  );
});
