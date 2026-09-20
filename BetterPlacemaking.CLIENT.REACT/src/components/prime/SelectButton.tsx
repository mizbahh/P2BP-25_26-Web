import { type CSSProperties, type ReactNode } from "react";
import { classNames, host } from "./internal/basic";
import { ToggleButton } from "./ToggleButton";

export interface SelectButtonProps<T = any> {
  options: T[];
  /** Property (or function) of an option holding its label. Default: option itself if string, else `label`. */
  optionLabel?: string | ((option: T) => string);
  optionValue?: string | ((option: T) => unknown);
  optionDisabled?: string | ((option: T) => boolean);
  multiple?: boolean;
  allowEmpty?: boolean;
  /** Model (ngModel): the selected value (single) or array of values (multiple). */
  value?: unknown;
  onChange?: (value: any) => void;
  disabled?: boolean;
  invalid?: boolean;
  fluid?: boolean;
  size?: "small" | "large";
  /** `#item` template. */
  itemTemplate?: (option: T, index: number) => ReactNode;
  ariaLabelledBy?: string;
  /** PrimeNG `styleClass` is applied to each inner toggle button; `className` here goes on the host (`p-selectbutton`). */
  className?: string;
  /** PrimeNG `styleClass` for each option (`p-togglebutton`). */
  itemClassName?: string;
  style?: CSSProperties;
  id?: string;
}

const get = (o: any, f: string | ((o: any) => any) | undefined, fallback: (o: any) => any) =>
  typeof f === "function" ? f(o) : f && o && typeof o === "object" ? o[f] : fallback(o);
const eq = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** `<p-selectbutton>`: `p-selectbutton[role=group]` > one `p-togglebutton` per option. */
export function SelectButton<T = any>({
  options, optionLabel, optionValue, optionDisabled, multiple, allowEmpty = true, value, onChange, disabled, invalid, fluid, size, itemTemplate, ariaLabelledBy, className, itemClassName, style, id,
}: SelectButtonProps<T>) {
  const label = (o: T) => get(o, optionLabel, (x) => (x && typeof x === "object" ? (x as any).label : x));
  const val = (o: T) => get(o, optionValue, (x) => x);
  const dis = (o: T) => !!get(o, optionDisabled, () => false);
  const isSelected = (o: T) => (multiple ? Array.isArray(value) && value.some((v) => eq(v, val(o))) : eq(value, val(o)));
  const select = (o: T, checked: boolean) => {
    const v = val(o);
    if (multiple) {
      const cur = Array.isArray(value) ? value : [];
      const next = checked ? [...cur, v] : cur.filter((x) => !eq(x, v));
      if (!allowEmpty && next.length === 0) return;
      onChange?.(next);
    } else {
      if (!checked && !allowEmpty) return;
      onChange?.(checked ? v : null);
    }
  };
  return host(
    "p-selectbutton",
    { id, className: classNames("p-selectbutton p-component", invalid && "p-invalid", fluid && "p-selectbutton-fluid", className), style, role: "group", "aria-labelledby": ariaLabelledBy, "data-pc-name": "selectbutton" },
    ...options.map((o, i) => (
      <ToggleButton
        key={String(label(o)) + i}
        value={isSelected(o)}
        onLabel={label(o)}
        offLabel={label(o)}
        disabled={disabled || dis(o)}
        allowEmpty={multiple ? true : allowEmpty}
        size={size}
        fluid={fluid}
        className={itemClassName}
        onChange={(checked) => select(o, checked)}
        contentTemplate={itemTemplate ? () => itemTemplate(o, i) : undefined}
      />
    )),
  );
}
