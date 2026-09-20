import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { classNames, host } from "./internal/basic";

export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  value?: number;
  showValue?: boolean;
  unit?: string;
  mode?: "determinate" | "indeterminate";
  /** Background color of the value bar. */
  color?: string;
  valueStyleClass?: string;
  /** `#content` template: `(value) => node`. */
  contentTemplate?: (value: number | undefined) => ReactNode;
  style?: CSSProperties;
}

/** `<p-progressbar>`: `p-progressbar` host (className = class/styleClass) > `.p-progressbar-value` > `.p-progressbar-label`. */
export const ProgressBar = forwardRef<HTMLElement, ProgressBarProps>(function ProgressBar(
  { value, showValue = true, unit = "%", mode = "determinate", color, valueStyleClass, contentTemplate, className, ...rest },
  ref,
) {
  const cls = classNames("p-progressbar p-component", mode === "determinate" && "p-progressbar-determinate", mode === "indeterminate" && "p-progressbar-indeterminate", className);
  return host(
    "p-progressbar",
    { ref, className: cls, role: "progressbar", "aria-valuemin": 0, "aria-valuenow": value, "aria-valuemax": 100, "aria-level": `${value}${unit}`, ...rest },
    mode === "determinate" ? (
      <div className={classNames("p-progressbar-value", valueStyleClass)} style={{ width: `${value}%`, display: "flex", background: color }}>
        <div className="p-progressbar-label">
          {showValue && !contentTemplate && (
            <div style={{ display: value != null && value !== 0 ? "flex" : "none" }}>
              {value}
              {unit}
            </div>
          )}
          {contentTemplate?.(value)}
        </div>
      </div>
    ) : (
      <div className={classNames("p-progressbar-value", valueStyleClass)} style={{ background: color }} />
    ),
  );
});
