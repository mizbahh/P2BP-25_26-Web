import { useId, type CSSProperties } from "react";
import { PRIME_SVG_ICONS } from "./primeSvgIcons.generated";

export interface PrimeSvgIconProps {
  /** PrimeNG icon name, i.e. the `data-p-icon` value (e.g. "times", "check", "angle-left", "spinner"). */
  name: keyof typeof PRIME_SVG_ICONS | (string & {});
  className?: string;
  spin?: boolean;
  style?: CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
  [key: `data-${string}`]: string | undefined;
}

/**
 * The inline SVG PrimeNG's `BaseIcon` renders: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"
 * data-p-icon="<name>" class="p-icon [extra]">` with PrimeNG's exact path data.
 */
export function PrimeSvgIcon({ name, className, spin, style, ...rest }: PrimeSvgIconProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const inner = (PRIME_SVG_ICONS[name] ?? "").replaceAll("__ID__", `pn_id_${uid}`);
  const cls = [className ?? "", "p-icon", spin ? "p-icon-spin" : ""].filter(Boolean).join(" ");
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-p-icon={name}
      className={cls}
      style={style}
      {...rest}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
