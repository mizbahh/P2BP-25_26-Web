import { createElement, forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { alignOverlay } from "./_inputs/ConnectedOverlay";
import { PrimeIcon } from "./_inputs/PrimeIcon";
import { cn, useFluid } from "./_inputs/utils";

/**
 * React port of PrimeNG `<p-password>`: `p-password > input.p-password-input + svg.p-password-toggle-mask-icon (+ div.p-password-overlay)`.
 *   <Password inputId="pw" value={pw} onChange={setPw} feedback={false} toggleMask fluid inputStyleClass="w-full" />
 * `onChange(value: string)` replaces ngModelChange. `className` = PrimeNG `styleClass` (root p-password).
 */
export interface PasswordProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "style" | "size" | "id"> {
  value?: string | null;
  onChange?: (value: string) => void;
  inputId?: string;
  feedback?: boolean;
  toggleMask?: boolean;
  showClear?: boolean;
  fluid?: boolean;
  invalid?: boolean;
  variant?: "outlined" | "filled";
  promptLabel?: string;
  weakLabel?: string;
  mediumLabel?: string;
  strongLabel?: string;
  mediumRegex?: string;
  strongRegex?: string;
  appendTo?: "body" | "self" | string | HTMLElement | null;
  /** root element classes / style (PrimeNG styleClass / style) */
  className?: string;
  style?: CSSProperties;
  inputStyleClass?: string;
  inputStyle?: CSSProperties;
  headerTemplate?: ReactNode;
  footerTemplate?: ReactNode;
  /** custom overlay body (replaces the meter) */
  contentTemplate?: ReactNode;
  autoFocus?: boolean;
}

export const Password = forwardRef<HTMLElement, PasswordProps>(function Password(
  {
    value, onChange, inputId, feedback = true, toggleMask = false, showClear = false, fluid, invalid, variant, promptLabel = "Enter a password", weakLabel = "Weak", mediumLabel = "Medium",
    strongLabel = "Strong", mediumRegex = "^(((?=.*[a-z])(?=.*[A-Z]))|((?=.*[a-z])(?=.*[0-9]))|((?=.*[A-Z])(?=.*[0-9])))(?=.{6,})", strongRegex = "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,})",
    appendTo, className, style, inputStyleClass, inputStyle, headerTemplate, footerTemplate, contentTemplate, onFocus, onBlur, onKeyUp, disabled, ...rest
  },
  ref,
) {
  const rootRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLElement);
  const hasFluid = useFluid(rootRef, fluid);
  const [focused, setFocused] = useState(false);
  const [unmasked, setUnmasked] = useState(false);
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState(promptLabel);
  const [meter, setMeter] = useState<{ strength: string; width: string } | null>(null);
  const v = value ?? "";
  const filled = v.length > 0;
  const mode: "self" | "body" = appendTo && appendTo !== "self" ? "body" : "self";

  const update = (val: string) => {
    let level = 0;
    if (new RegExp(strongRegex).test(val)) level = 3;
    else if (new RegExp(mediumRegex).test(val)) level = 2;
    else if (val.length) level = 1;
    if (level === 1) { setText(weakLabel); setMeter({ strength: "weak", width: "33.33%" }); }
    else if (level === 2) { setText(mediumLabel); setMeter({ strength: "medium", width: "66.66%" }); }
    else if (level === 3) { setText(strongLabel); setMeter({ strength: "strong", width: "100%" }); }
    else { setText(promptLabel); setMeter(null); }
  };

  useLayoutEffect(() => {
    const o = overlayRef.current;
    const i = inputRef.current;
    if (!visible || !o || !i) return;
    o.style.zIndex = "1002";
    alignOverlay(o, i, mode, true);
    if (typeof o.animate === "function") o.animate([{ opacity: 0, transform: "scaleY(0.8)" }, { opacity: 1, transform: "none" }], { duration: 120, easing: "cubic-bezier(0, 0, 0.2, 1)" });
  }, [visible, mode]);
  useEffect(() => {
    if (!visible) return;
    const hide = () => setVisible(false);
    window.addEventListener("resize", hide);
    return () => window.removeEventListener("resize", hide);
  }, [visible]);

  const container = mode === "body" ? (appendTo === "body" ? document.body : typeof appendTo === "string" ? (document.querySelector(appendTo) as HTMLElement | null) : (appendTo as HTMLElement)) : null;

  const overlay = visible ? (
    <div ref={overlayRef} className="p-password-overlay p-component" style={{ position: "absolute" }} data-pc-section="overlay">
      {headerTemplate}
      {contentTemplate ?? (
        <div className="p-password-content" data-pc-section="content">
          <div className="p-password-meter" data-pc-section="meter">
            <div className={cn("p-password-meter-label", meter && "p-password-meter-" + meter.strength)} style={{ width: meter ? meter.width : "" }} data-pc-section="meterlabel" />
          </div>
          <div className="p-password-meter-text" data-pc-section="metertext">
            {text}
          </div>
        </div>
      )}
      {footerTemplate}
    </div>
  ) : null;

  return createElement(
    "p-password",
    {
      ref: rootRef,
      className: cn("p-password p-component p-inputwrapper", { "p-inputwrapper-filled": filled, "p-variant-filled": variant === "filled", "p-inputwrapper-focus": focused, "p-password-fluid": hasFluid }, className),
      style: { position: mode === "self" ? "relative" : undefined, ...style },
      "data-pc-section": "root",
      "data-pc-name": "password",
    },
    <input
      {...rest}
      ref={inputRef}
      id={inputId}
      type={unmasked ? "text" : "password"}
      value={v}
      disabled={disabled}
      style={inputStyle}
      className={cn("p-password-input", inputStyleClass, "p-component p-inputtext", { "p-filled": filled, "p-invalid": invalid, "p-variant-filled": variant === "filled", "p-inputtext-fluid": hasFluid })}
      data-pc-name="pcinputtext"
      data-pc-extend="inputtext"
      data-pc-section="root"
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={(e) => {
        setFocused(true);
        if (feedback) setVisible(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        if (feedback) setVisible(false);
        onBlur?.(e);
      }}
      onKeyUp={(e) => {
        if (feedback) {
          update((e.target as HTMLInputElement).value);
          if (e.code === "Escape") return setVisible(false);
          if (!visible) setVisible(true);
        }
        onKeyUp?.(e);
      }}
    />,
    showClear && value != null && <PrimeIcon key="clear" name="times" className="p-password-clear-icon" onClick={() => onChange?.("")} />,
    toggleMask &&
      (unmasked ? (
        <PrimeIcon key="mask" name="eyeslash" className="p-password-toggle-mask-icon p-password-mask-icon" section="maskicon" onClick={() => setUnmasked(false)} />
      ) : (
        <PrimeIcon key="unmask" name="eye" className="p-password-toggle-mask-icon p-password-unmask-icon" section="unmaskicon" onClick={() => setUnmasked(true)} />
      )),
    mode === "self" || !container ? overlay : overlay ? createPortal(overlay, container) : null,
  );
});
