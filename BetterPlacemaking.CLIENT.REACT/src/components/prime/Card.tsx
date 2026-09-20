import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { classNames, host } from "./internal/basic";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title" | "children"> {
  /** PrimeNG `header` input: plain-text title (`div.p-card-title`). */
  header?: string;
  /** PrimeNG `subheader` input: plain-text subtitle. */
  subheader?: string;
  /** `<ng-template #header>` slot (image/toolbar above the body): `div.p-card-header`. */
  headerTemplate?: ReactNode;
  /** `<ng-template #title>` slot (replaces `header` text). */
  titleTemplate?: ReactNode;
  /** `<ng-template #subtitle>` slot. */
  subtitleTemplate?: ReactNode;
  /** `<ng-template #footer>` slot: `div.p-card-footer`. */
  footerTemplate?: ReactNode;
  /** Card content (`div.p-card-content`). */
  children?: ReactNode;
  /** Both PrimeNG `styleClass` and the template `class="..."` land on the `p-card` host (className). */
  className?: string;
}

/** `<p-card>`: `p-card.p-card` host > [`.p-card-header`] + `.p-card-body` > title/subtitle/content/footer. */
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { header, subheader, headerTemplate, titleTemplate, subtitleTemplate, footerTemplate, children, className, ...rest },
  ref,
) {
  const has = (n: ReactNode) => n !== undefined && n !== null && n !== false;
  return host(
    "p-card",
    { ref, className: classNames("p-card p-component", className), ...rest },
    has(headerTemplate) && <div className="p-card-header">{headerTemplate}</div>,
    <div className="p-card-body">
      {(header || has(titleTemplate)) && <div className="p-card-title">{has(titleTemplate) ? titleTemplate : header}</div>}
      {(subheader || has(subtitleTemplate)) && <div className="p-card-subtitle">{has(subtitleTemplate) ? subtitleTemplate : subheader}</div>}
      <div className="p-card-content">{children}</div>
      {has(footerTemplate) && <div className="p-card-footer">{footerTemplate}</div>}
    </div>,
  );
});
