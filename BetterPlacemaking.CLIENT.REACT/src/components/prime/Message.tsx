import { forwardRef, useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { classNames, host, TimesIcon } from "./internal/basic";
import { RIPPLE_CLASS } from "./Ripple";

export interface MessageProps {
  severity?: "success" | "info" | "warn" | "error" | "secondary" | "contrast";
  variant?: "outlined" | "simple";
  size?: "small" | "large";
  /** Plain text (or HTML when `escape` is false). */
  text?: string;
  /** Default true. When false `text` is injected as HTML. */
  escape?: boolean;
  /** PrimeIcons class string for the leading `i.p-message-icon`. */
  icon?: string;
  /** Custom leading icon node (`#icon` template). */
  iconTemplate?: ReactNode;
  closable?: boolean;
  closeIcon?: string;
  closeAriaLabel?: string;
  /** Auto hides after N ms. */
  life?: number;
  onClose?: (event?: MouseEvent<HTMLButtonElement>) => void;
  /** Full replacement of the content (`#container` template). Gets a `close` callback. */
  containerTemplate?: (ctx: { close: () => void }) => ReactNode;
  /** Projected content: rendered in a second `span.p-message-text` after `text` (as PrimeNG does). */
  children?: ReactNode;
  /** PrimeNG `styleClass`: lands on the inner `div.p-message` root. */
  className?: string;
  style?: CSSProperties;
  /** Class on the `<p-message>` host wrapper (Angular `class="..."`). */
  hostClassName?: string;
  id?: string;
}

/** `<p-message>` (PrimeNG 20): `p-message` host > `div.p-message[role=alert]` > `div.p-message-content`. */
export const Message = forwardRef<HTMLDivElement, MessageProps>(function Message(
  { severity = "info", variant, size, text, escape = true, icon, iconTemplate, closable, closeIcon, closeAriaLabel, life, onClose, containerTemplate, children, className, style, hostClassName, id },
  ref,
) {
  const [visible, setVisible] = useState(true);
  const close = (e?: MouseEvent<HTMLButtonElement>) => {
    setVisible(false);
    onClose?.(e);
  };
  useEffect(() => {
    if (!life) return;
    const t = window.setTimeout(() => setVisible(false), life);
    return () => window.clearTimeout(t);
  }, [life]);
  if (!visible) return host("p-message", { className: hostClassName });

  const cls = classNames(
    "p-message p-component",
    `p-message-${severity}`,
    variant && `p-message-${variant}`,
    size === "small" && "p-message-sm",
    size === "large" && "p-message-lg",
    className,
  );
  return host(
    "p-message",
    { className: hostClassName },
    <div ref={ref} id={id} className={cls} style={style} aria-live="polite" role="alert">
      <div className="p-message-content">
        {iconTemplate}
        {icon && <i className={classNames("p-message-icon", icon)} />}
        {containerTemplate ? (
          containerTemplate({ close: () => close() })
        ) : (
          <>
            {!escape ? (
              <div>
                <span className="p-message-text" dangerouslySetInnerHTML={{ __html: text ?? "" }} />
              </div>
            ) : (
              text && <span className="p-message-text">{text}</span>
            )}
            <span className="p-message-text">{children}</span>
          </>
        )}
        {closable && (
          <button type="button" className={classNames(RIPPLE_CLASS, "p-message-close-button")} aria-label={closeAriaLabel} onClick={close}>
            {closeIcon ? <i className={classNames("p-message-close-icon", closeIcon)} /> : <TimesIcon className="p-message-close-icon" />}
          </button>
        )}
      </div>
    </div>,
  );
});
