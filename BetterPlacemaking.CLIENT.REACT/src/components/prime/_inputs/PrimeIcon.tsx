import { useId } from "react";
import { ICON_MARKUP } from "./iconMarkup";

export type PrimeIconName = keyof typeof ICON_MARKUP;

/**
 * Renders PrimeNG's inline SVG icons exactly as `<svg data-p-icon="name" class="... p-icon">`.
 * Internal helper shared by the input components.
 */
export function PrimeIcon({
  name,
  className,
  onClick,
  section,
  spin,
}: {
  name: PrimeIconName;
  className?: string;
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  /** value of data-pc-section */
  section?: string;
  spin?: boolean;
}) {
  const uid = "pn_id_" + useId().replace(/:/g, "");
  const html = ICON_MARKUP[name].replaceAll("__ID__", uid);
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-p-icon={name}
      className={[className, "p-icon", spin ? "p-icon-spin" : ""].filter(Boolean).join(" ")}
      data-pc-section={section}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
