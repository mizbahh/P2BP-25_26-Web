import { createElement, useEffect, useRef, useState, type CSSProperties } from "react";
import { Dialog } from "./Dialog";
import { usePrimeServices, type Confirmation } from "./primeServicesContext";

export interface ConfirmDialogProps {
  /** PrimeNG `key`: only `confirm({ key })` calls with the same key open this instance. */
  confirmKey?: string;
  /** PrimeNG `styleClass` (extra classes on `div.p-dialog.p-confirmdialog`). */
  className?: string;
  style?: CSSProperties;
  maskClassName?: string;
  position?: "center" | "top" | "bottom" | "left" | "right" | "topleft" | "topright" | "bottomleft" | "bottomright";
}

function ConfirmButton({
  kind,
  label,
  icon,
  styleClass,
  onClick,
  buttonRef,
}: {
  kind: "accept" | "reject";
  label: string;
  icon?: string;
  styleClass?: string;
  onClick: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return createElement(
    "p-button",
    { "data-pc-section": "host" },
    <button
      ref={buttonRef}
      type="button"
      {...({ pripple: "" } as object)}
      className={["p-ripple p-button", styleClass, "p-component", `p-confirmdialog-${kind}-button`].filter(Boolean).join(" ")}
      data-pc-name={`pc${kind}button`}
      data-pc-extend="button"
      data-pc-section="root"
      onClick={onClick}
    >
      {icon ? <span className={`p-button-icon p-button-icon-left ${icon}`} data-pc-section="icon" /> : null}
      <span className="p-button-label" aria-hidden={icon ? "false" : undefined} data-pc-section="label">
        {label}
      </span>
    </button>,
  );
}

/**
 * PrimeNG `<p-confirmDialog>`. The PrimeServicesProvider already mounts ONE default (key-less) instance, so pages normally
 * do not render it; render `<ConfirmDialog confirmKey="x" />` only for keyed confirmations.
 */
export function ConfirmDialog({ confirmKey, className, style, maskClassName, position }: ConfirmDialogProps) {
  const { bus } = usePrimeServices();
  const [conf, setConf] = useState<Confirmation | null>(null);
  const [visible, setVisible] = useState(false);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const confRef = useRef<Confirmation | null>(null);

  useEffect(
    () =>
      bus.onConfirm((c) => {
        if (!c) {
          setVisible(false);
          return;
        }
        if (c.key === confirmKey) {
          confRef.current = c;
          setConf(c);
          setVisible(true);
        }
      }),
    [bus, confirmKey],
  );

  useEffect(() => {
    if (!visible || !conf || conf.defaultFocus === "none") return;
    const t = window.setTimeout(() => {
      if (conf.defaultFocus === "reject") document.querySelector<HTMLElement>(".p-confirmdialog-reject-button")?.focus();
      else acceptRef.current?.focus();
    }, 160);
    return () => window.clearTimeout(t);
  }, [visible, conf]);

  const hide = () => setVisible(false);
  const accept = () => {
    const c = confRef.current;
    hide();
    c?.accept?.();
  };
  const reject = () => {
    const c = confRef.current;
    hide();
    c?.reject?.();
  };

  const c = conf;
  return createElement(
    "p-confirmdialog",
    { "data-pc-section": "host" },
    <Dialog
      visible={visible}
      onHide={reject}
      onAfterHide={() => setConf(null)}
      role="alertdialog"
      appendTo="body"
      modal
      header={c?.header}
      closable={c?.closable ?? true}
      closeOnEscape={c?.closeOnEscape ?? true}
      dismissableMask={c?.dismissableMask ?? false}
      focusOnShow={false}
      closeAriaLabel=""
      className={["p-confirmdialog", className].filter(Boolean).join(" ")}
      maskClassName={maskClassName}
      style={style}
      position={position}
      footer={
        c ? (
          <>
            {c.rejectVisible !== false ? (
              <ConfirmButton kind="reject" label={c.rejectLabel || "No"} icon={c.rejectIcon} styleClass={c.rejectButtonStyleClass} onClick={reject} />
            ) : null}
            {c.acceptVisible !== false ? (
              <ConfirmButton kind="accept" label={c.acceptLabel || "Yes"} icon={c.acceptIcon} styleClass={c.acceptButtonStyleClass} onClick={accept} buttonRef={acceptRef} />
            ) : null}
          </>
        ) : null
      }
    >
      {c ? (
        <>
          {c.icon ? <i className={`${c.icon} p-confirmdialog-icon`} data-pc-section="icon" /> : null}
          <span className="p-confirmdialog-message" data-pc-section="message" dangerouslySetInnerHTML={{ __html: c.message ?? "" }} />
        </>
      ) : null}
    </Dialog>,
  );
}
