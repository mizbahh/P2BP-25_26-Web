/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement, forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { alignOverlay } from "./_inputs/ConnectedOverlay";
import { DAY_NAMES_MIN, MONTH_NAMES, MONTH_NAMES_SHORT, formatDate, formatTime, parseDate } from "./_inputs/dateUtils";
import { PrimeIcon } from "./_inputs/PrimeIcon";
import { cn, useFluid } from "./_inputs/utils";

/**
 * React port of PrimeNG `<p-datepicker>`: `p-datepicker > input.p-datepicker-input + button.p-datepicker-dropdown + div.p-datepicker-panel`.
 * `value` is Date (single) | Date[] (range/multiple) | null; `onChange(value)` replaces ngModelChange.
 *   <DatePicker value={d} onChange={setD} showIcon showTime hourFormat="12" appendTo="body" className="w-full" />
 *   <DatePicker value={t} onChange={setT} timeOnly hourFormat="24" inline className="fusion-schedule-clock" />
 */
export interface DateMeta {
  day: number;
  month: number;
  year: number;
  otherMonth?: boolean;
  today?: boolean;
  selectable: boolean;
}
export interface DatePickerProps {
  value?: Date | Date[] | null;
  onChange?: (value: any) => void;
  selectionMode?: "single" | "multiple" | "range";
  inline?: boolean;
  showIcon?: boolean;
  iconDisplay?: "button" | "input";
  icon?: string;
  showClear?: boolean;
  showTime?: boolean;
  timeOnly?: boolean;
  hourFormat?: "12" | "24";
  showSeconds?: boolean;
  stepHour?: number;
  stepMinute?: number;
  stepSecond?: number;
  timeSeparator?: string;
  dateFormat?: string;
  minDate?: Date | null;
  maxDate?: Date | null;
  disabledDates?: Date[];
  disabledDays?: number[];
  showButtonBar?: boolean;
  showOtherMonths?: boolean;
  selectOtherMonths?: boolean;
  view?: "date" | "month" | "year";
  firstDayOfWeek?: number;
  defaultDate?: Date | null;
  showOnFocus?: boolean;
  hideOnDateTimeSelect?: boolean;
  keepInvalid?: boolean;
  placeholder?: string;
  inputId?: string;
  name?: string;
  inputStyle?: CSSProperties;
  inputStyleClass?: string;
  /** PrimeNG styleClass -> root element */
  className?: string;
  style?: CSSProperties;
  panelStyle?: CSSProperties;
  panelStyleClass?: string;
  appendTo?: "body" | "self" | string | HTMLElement | null;
  disabled?: boolean;
  readonlyInput?: boolean;
  invalid?: boolean;
  variant?: "outlined" | "filled";
  size?: "small" | "large";
  fluid?: boolean;
  tabIndex?: number;
  autoFocus?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  iconAriaLabel?: string;
  headerTemplate?: ReactNode;
  footerTemplate?: ReactNode;
  dateTemplate?: (d: DateMeta) => ReactNode;
  onSelect?: (v: any) => void;
  onClear?: () => void;
  onShow?: () => void;
  onClose?: () => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onMonthChange?: (e: { month: number; year: number }) => void;
  onYearChange?: (e: { month: number; year: number }) => void;
  [dataAttr: `data-${string}`]: unknown;
}

const dim = (m: number, y: number) => 32 - new Date(y, m, 32).getDate();
const same = (a: Date, b: { year: number; month: number; day: number }) => a.getFullYear() === b.year && a.getMonth() === b.month && a.getDate() === b.day;
const isDate = (v: unknown): v is Date => v instanceof Date && !isNaN(v.getTime());
const pad = (n: number) => (n < 10 ? "0" + n : "" + n);

function TimeBtn({ up, label, cls, name, onDown, onUp, onClick }: { up: boolean; label: string; cls: string; name: string; onDown?: () => void; onUp?: () => void; onClick?: () => void }) {
  return createElement(
    "p-button",
    { "aria-label": label, "data-pc-group-section": "timepickerbutton", "data-pc-section": "host" },
    <button
      className={"p-ripple p-button p-button-icon-only p-button-rounded p-button-secondary p-button-text p-component " + cls}
      type="button"
      data-pc-name={name}
      data-pc-extend="button"
      data-pc-section="root"
      onMouseDown={(e) => {
        onDown?.();
        e.preventDefault();
      }}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onDown?.();
          e.preventDefault();
        }
      }}
      onKeyUp={(e) => (e.key === "Enter" || e.key === " ") && onUp?.()}
      onClick={onClick}
    >
      <PrimeIcon name={up ? "chevron-up" : "chevron-down"} />
    </button>,
  );
}

export const DatePicker = forwardRef<HTMLElement, DatePickerProps>(function DatePicker(props, ref) {
  const {
    value, onChange, selectionMode = "single", inline = false, showIcon = false, iconDisplay = "button", icon, showClear = false, showTime = false, timeOnly = false,
    hourFormat = "24", showSeconds = false, stepHour = 1, stepMinute = 1, stepSecond = 1, timeSeparator = ":", dateFormat = "mm/dd/yy", minDate, maxDate, disabledDates,
    disabledDays, showButtonBar = false, showOtherMonths = true, selectOtherMonths = false, view = "date", firstDayOfWeek = 0, defaultDate, showOnFocus = true,
    hideOnDateTimeSelect = true, keepInvalid = false, placeholder, inputId, name, inputStyle, inputStyleClass, className, style, panelStyle, panelStyleClass, appendTo,
    disabled = false, readonlyInput = false, invalid = false, variant, size, fluid, tabIndex, autoFocus, ariaLabel, ariaLabelledBy, iconAriaLabel, headerTemplate,
    footerTemplate, dateTemplate, onSelect, onClear, onShow, onClose, onFocus, onBlur, onMonthChange, onYearChange, ...rest
  } = props;

  const uid = useId().replace(/:/g, "");
  const panelId = `pn_id_${uid}_panel`;
  const rootRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLElement);
  const hasFluid = useFluid(rootRef, fluid);
  const hf = hourFormat;
  const isSingle = selectionMode === "single";
  const isMultiple = selectionMode === "multiple";
  const isRange = selectionMode === "range";

  const [open, setOpenState] = useState(false);
  const openRef = useRef(false);
  const setOpen = (v: boolean) => {
    openRef.current = v;
    setOpenState(v);
  };
  const [mounted, setMounted] = useState(false);
  const [focus, setFocus] = useState(false);
  const [curView, setCurView] = useState<"date" | "month" | "year">(view);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const [second, setSecond] = useState(0);
  const [pm, setPm] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  const typing = useRef(false);
  const timer = useRef<number | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const ts = useRef({ hour, minute, second, pm });
  ts.current = { hour, minute, second, pm };
  const valRef = useRef(value);
  valRef.current = value;

  const lastDate = (v: any): Date | null => (Array.isArray(v) ? ((v.length === 2 ? (v[1] ?? v[0]) : v[0]) ?? null) : (v ?? null));

  const setHourFrom = (h: number) => {
    if (hf === "12") {
      setPm(h > 11);
      setHour(h >= 12 ? (h === 12 ? 12 : h - 12) : h === 0 ? 12 : h);
    } else setHour(h);
  };
  const updateUI = () => {
    const pv = lastDate(value);
    const val = defaultDate && isDate(defaultDate) && !value ? defaultDate : pv && isDate(pv) ? pv : new Date();
    setMonth(val.getMonth());
    setYear(val.getFullYear());
    if (showTime || timeOnly) {
      setHourFrom(val.getHours());
      setMinute(val.getMinutes());
      setSecond(showSeconds ? val.getSeconds() : 0);
    }
  };
  const valueKey = Array.isArray(value) ? value.map((d) => d?.getTime()).join(",") : value instanceof Date ? value.getTime() : String(value ?? "");
  useLayoutEffect(() => {
    updateUI();
    if (!typing.current) setTyped(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey, showTime, timeOnly, hf]);

  const selectable = (d: number, m: number, y: number, other: boolean) => {
    if (other && !selectOtherMonths) return false;
    const t = new Date(y, m, d).getTime();
    if (minDate && t < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()).getTime()) return false;
    if (maxDate && t > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()).getTime()) return false;
    if (disabledDates?.some((x) => x.getFullYear() === y && x.getMonth() === m && x.getDate() === d)) return false;
    if (disabledDays?.includes(new Date(y, m, d).getDay())) return false;
    return true;
  };
  const isSelected = (dm: { year: number; month: number; day: number }) => {
    if (!value) return false;
    if (value instanceof Date) return same(value, dm);
    if (isMultiple) return value.some((v) => v && same(v, dm));
    const [s, e] = value;
    if (s && same(s, dm)) return true;
    if (e && same(e, dm)) return true;
    if (s && e) {
      const t = new Date(dm.year, dm.month, dm.day).getTime();
      return t > new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime() && t < new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
    }
    return false;
  };

  const weeks = useMemo(() => {
    const today = new Date();
    let first = new Date(year, month, 1).getDay() - firstDayOfWeek;
    first = first < 0 ? first + 7 : first;
    const len = dim(month, year);
    const pm_ = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    const plen = dim(pm_, py);
    const rows = Math.ceil((len + first) / 7);
    const res: DateMeta[][] = [];
    let n = 1;
    const isT = (d: number, m: number, y: number) => today.getDate() === d && today.getMonth() === m && today.getFullYear() === y;
    for (let r = 0; r < rows; r++) {
      const w: DateMeta[] = [];
      if (r === 0) {
        for (let j = plen - first + 1; j <= plen; j++) w.push({ day: j, month: pm_, year: py, otherMonth: true, today: isT(j, pm_, py), selectable: selectable(j, pm_, py, true) });
        const rem = 7 - w.length;
        for (let j = 0; j < rem; j++) w.push({ day: n, month, year, today: isT(n, month, year), selectable: selectable(n++, month, year, false) });
      } else {
        for (let j = 0; j < 7; j++) {
          if (n > len) {
            const d = n - len;
            w.push({ day: d, month: nm, year: ny, otherMonth: true, today: isT(d, nm, ny), selectable: selectable(d, nm, ny, true) });
          } else w.push({ day: n, month, year, today: isT(n, month, year), selectable: selectable(n, month, year, false) });
          n++;
        }
      }
      res.push(w);
    }
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, firstDayOfWeek, minDate, maxDate, disabledDates, disabledDays, selectOtherMonths]);
  const weekDays = Array.from({ length: 7 }, (_, i) => DAY_NAMES_MIN[(firstDayOfWeek + i) % 7]);

  const emit = (v: any) => onChange?.(v);
  const clearTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => () => clearTimer(), []);

  const applyTime = (d: Date) => {
    if (hf === "12") d.setHours(hour === 12 ? (pm ? 12 : 0) : pm ? hour + 12 : hour);
    else d.setHours(hour);
    d.setMinutes(minute);
    d.setSeconds(second);
  };
  const hideOverlay = () => {
    inputRef.current?.focus();
    setOpen(false);
    clearTimer();
  };
  const showOverlay = () => {
    if (!openRef.current) {
      updateUI();
      setOpen(true);
    }
  };

  const selectDate = (dm: { year: number; month: number; day: number }) => {
    let date = new Date(dm.year, dm.month, dm.day);
    if (showTime) applyTime(date);
    if (minDate && minDate > date) {
      date = minDate;
      setHourFrom(date.getHours());
      setMinute(date.getMinutes());
      setSecond(date.getSeconds());
    }
    if (maxDate && maxDate < date) {
      date = maxDate;
      setHourFrom(date.getHours());
      setMinute(date.getMinutes());
      setSecond(date.getSeconds());
    }
    if (isSingle) emit(date);
    else if (isMultiple) emit(Array.isArray(value) ? [...value, date] : [date]);
    else if (Array.isArray(value) && value.length) {
      let [s, e] = value as [Date, Date | null];
      if (!e && date.getTime() >= s.getTime()) e = date;
      else {
        s = date;
        e = null;
      }
      emit([s, e]);
      if (e && hideOnDateTimeSelect) setTimeout(hideOverlay, 150);
    } else emit([date, null]);
    onSelect?.(date);
  };
  const onDateSelect = (e: React.SyntheticEvent, dm: DateMeta) => {
    e.preventDefault();
    if (disabled || !dm.selectable) return;
    if (isMultiple && isSelected(dm)) {
      const nv = (value as Date[]).filter((d) => !same(d, dm));
      emit(nv.length ? nv : null);
    } else selectDate(dm);
    if (hideOnDateTimeSelect && isSingle) setTimeout(hideOverlay, 150);
    setTyped(null);
  };
  const onMonthSelect = (e: React.SyntheticEvent, i: number) => {
    if (view === "month") onDateSelect(e, { year, month: i, day: 1, selectable: true });
    else {
      setMonth(i);
      setCurView("date");
      onMonthChange?.({ month: i + 1, year });
    }
  };
  const onYearSelect = (e: React.SyntheticEvent, y: number) => {
    if (view === "year") onDateSelect(e, { year: y, month: 0, day: 1, selectable: true });
    else {
      setYear(y);
      setCurView("month");
      onYearChange?.({ month: month + 1, year: y });
    }
  };
  const nav = (dir: 1 | -1) => {
    if (disabled) return;
    if (curView === "month") setYear(year + dir);
    else if (curView === "year") setYear(year + 10 * dir);
    else {
      let m = month + dir;
      let y = year;
      if (m < 0) {
        m = 11;
        y--;
      } else if (m > 11) {
        m = 0;
        y++;
      }
      setMonth(m);
      setYear(y);
      onMonthChange?.({ month: m + 1, year: y });
    }
  };

  // ---- time ----
  const writeTime = () => {
    const t = ts.current;
    const cur = valRef.current;
    let v: any = isRange ? (cur as Date[] | null)?.[1] || (cur as Date[] | null)?.[0] : isMultiple ? (cur as Date[] | null)?.[(cur as Date[]).length - 1] : cur;
    v = v && isDate(v) ? new Date(v.getTime()) : new Date();
    if (hf === "12") v.setHours(t.hour === 12 ? (t.pm ? 12 : 0) : t.pm ? t.hour + 12 : t.hour);
    else v.setHours(t.hour);
    v.setMinutes(t.minute);
    v.setSeconds(t.second);
    let out: any = v;
    if (isRange) out = (cur as Date[] | null)?.[1] ? [(cur as Date[])[0], v] : [v, null];
    if (isMultiple) out = [...((cur as Date[] | null)?.slice(0, -1) ?? []), v];
    emit(out);
    onSelect?.(out);
    setTyped(null);
  };
  const step = (type: 0 | 1 | 2, dir: 1 | -1) => {
    let { hour: h, minute: m, second: s, pm: p } = ts.current;
    if (type === 0) {
      let nh = h + dir * stepHour;
      if (hf === "24") nh = dir === 1 ? (nh >= 24 ? nh - 24 : nh) : nh < 0 ? 24 + nh : nh;
      else if (dir === 1) {
        if (h < 12 && nh > 11) p = !p;
        nh = nh >= 13 ? nh - 12 : nh;
      } else {
        if (h === 12) p = !p;
        nh = nh <= 0 ? 12 + nh : nh;
      }
      h = nh;
    } else if (type === 1) {
      m += dir * stepMinute;
      m = m > 59 ? m - 60 : m < 0 ? 60 + m : m;
    } else {
      s += dir * stepSecond;
      s = s > 59 ? s - 60 : s < 0 ? 60 + s : s;
    }
    ts.current = { hour: h, minute: m, second: s, pm: p };
    setPm(p);
    setHour(h);
    setMinute(m);
    setSecond(s);
  };
  const repeat = (type: 0 | 1 | 2, dir: 1 | -1, iv?: number) => {
    clearTimer();
    timer.current = window.setTimeout(() => repeat(type, dir, 100), iv || 500);
    step(type, dir);
  };
  const down = (t: 0 | 1 | 2, d: 1 | -1) => !disabled && repeat(t, d);
  const up = () => {
    if (!disabled && timer.current) {
      clearTimer();
      writeTime();
    }
  };
  const toggleAMPM = () => {
    ts.current = { ...ts.current, pm: !pm };
    setPm(!pm);
    writeTime();
  };

  // ---- input text ----
  const fmt = (d: Date | null | undefined) => {
    if (!d || !isDate(d)) return "";
    if (timeOnly) return formatTime(d, hf, showSeconds);
    return formatDate(d, dateFormat) + (showTime ? " " + formatTime(d, hf, showSeconds) : "");
  };
  const inputValue = useMemo(() => {
    if (!value) return "";
    if (value instanceof Date) return fmt(value);
    if (isMultiple) return value.map(fmt).join(", ");
    return value.length ? fmt(value[0]) + (value[1] ? " - " + fmt(value[1]) : "") : "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey, dateFormat, showTime, timeOnly, hf, showSeconds]);
  const displayed = typed ?? inputValue;

  const parseOne = (text: string): Date => {
    const parts = text.split(" ");
    const pop = (d: Date, ts_: string, ampm?: string | null) => {
      if (hf === "12" && !ampm) throw "bad";
      const tk = ts_.split(":");
      if (tk.length !== (showSeconds ? 3 : 2)) throw "bad";
      let h = parseInt(tk[0]);
      const mi = parseInt(tk[1]);
      const se = showSeconds ? parseInt(tk[2]) : 0;
      if (isNaN(h) || isNaN(mi) || h > 23 || mi > 59 || (hf === "12" && h > 12) || isNaN(se) || se > 59) throw "bad";
      const isPm = ampm === "PM" || ampm === "pm";
      if (hf === "12") h = h !== 12 && isPm ? h + 12 : !isPm && h === 12 ? 0 : h;
      d.setHours(h, mi, se);
    };
    if (timeOnly) {
      const d = new Date();
      pop(d, parts[0], parts[1]);
      return d;
    }
    if (showTime) {
      const ampm = hf === "12" ? parts.pop() : null;
      const t = parts.pop() as string;
      const d = parseDate(parts.join(" "), dateFormat);
      pop(d, t, ampm);
      return d;
    }
    return parseDate(text, dateFormat);
  };
  const onUserInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    typing.current = true;
    setTyped(val);
    try {
      let v: any = null;
      if (val.trim()) v = isSingle ? parseOne(val) : isMultiple ? val.split(",").map((t) => parseOne(t.trim())) : val.split(" - ").map((t) => parseOne(t.trim()));
      const arr: Date[] = v === null ? [] : Array.isArray(v) ? v : [v];
      if (arr.every((x) => selectable(x.getDate(), x.getMonth(), x.getFullYear(), false)) && (!isRange || arr.length < 2 || arr[1] >= arr[0])) emit(v);
      else if (keepInvalid) emit(v);
    } catch {
      emit(keepInvalid ? val : null);
    }
  };

  // ---- overlay ----
  const mode: "self" | "body" = appendTo === "body" ? "body" : !appendTo || appendTo === "self" ? "self" : "body";
  const container: HTMLElement | null = mode === "body" ? (appendTo === "body" || !appendTo ? document.body : typeof appendTo === "string" ? (document.querySelector(appendTo) as HTMLElement | null) : (appendTo as HTMLElement)) : null;
  if (!inline && open && !mounted) setMounted(true);

  const align = useCallback(() => {
    const p = panelRef.current;
    const i = inputRef.current;
    if (!p || !i) return;
    if (curView === "date") {
      if (!p.style.width) p.style.width = p.offsetWidth + "px";
      if (!p.style.minWidth) p.style.minWidth = i.offsetWidth + "px";
    } else if (!p.style.width) p.style.width = i.offsetWidth + "px";
    alignOverlay(p, i, mode, false);
  }, [curView, mode]);

  useLayoutEffect(() => {
    if (inline || !mounted || !open) return;
    const p = panelRef.current;
    if (!p) return;
    p.style.zIndex = "1002";
    align();
    if (typeof p.animate === "function") p.animate([{ opacity: 0, transform: "scaleY(0.8)" }, { opacity: 1, transform: "none" }], { duration: 120, easing: "cubic-bezier(0, 0, 0.2, 1)" });
    onShow?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, open, inline]);
  useLayoutEffect(() => {
    if (!inline && open && mounted) align();
  }, [curView, month, year, open, mounted, inline, align, weeks.length]);
  useEffect(() => {
    if (inline || open || !mounted) return;
    const p = panelRef.current;
    let done = false;
    const fin = () => {
      if (done) return;
      done = true;
      setMounted(false);
      setCurView(view);
      onClose?.();
    };
    if (p && typeof p.animate === "function") {
      const a = p.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, easing: "linear", fill: "forwards" });
      a.onfinish = fin;
      a.oncancel = fin;
      return () => {
        done = true;
      };
    }
    fin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted, inline]);
  useEffect(() => {
    if (!open || inline) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!(rootRef.current?.contains(t) || panelRef.current?.contains(t))) {
        setOpen(false);
        clearTimer();
      }
    };
    const hide = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", hide);
    const ps: HTMLElement[] = [];
    let p = rootRef.current?.parentElement ?? null;
    while (p) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflow + cs.overflowX + cs.overflowY)) ps.push(p);
      p = p.parentElement;
    }
    ps.forEach((x) => x.addEventListener("scroll", hide));
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", hide);
      ps.forEach((x) => x.removeEventListener("scroll", hide));
    };
  }, [open, inline]);
  useLayoutEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);
  useEffect(() => {
    if (pendingFocus.current) {
      const el = panelRef.current?.querySelector<HTMLElement>(`[data-date="${pendingFocus.current}"]`);
      if (el) {
        el.focus();
        pendingFocus.current = null;
      }
    }
  });

  const focusKey = useMemo(() => {
    const sel = lastDate(value);
    const inM = (d: Date) => d.getMonth() === month && d.getFullYear() === year;
    if (sel && isDate(sel) && inM(sel)) return `${sel.getFullYear()}-${sel.getMonth()}-${sel.getDate()}`;
    const t = new Date();
    return inM(t) ? `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}` : `${year}-${month}-1`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, valueKey]);

  const onDayKey = (e: React.KeyboardEvent, dm: DateMeta) => {
    const move = (delta: number) => {
      const t = new Date(dm.year, dm.month, dm.day + delta);
      const key = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
      const el = panelRef.current?.querySelector<HTMLElement>(`[data-date="${key}"]`);
      if (el && !el.classList.contains("p-disabled")) el.focus();
      else {
        pendingFocus.current = key;
        setMonth(t.getMonth());
        setYear(t.getFullYear());
      }
      e.preventDefault();
    };
    if (e.code === "ArrowDown") move(7);
    else if (e.code === "ArrowUp") move(-7);
    else if (e.code === "ArrowLeft") move(-1);
    else if (e.code === "ArrowRight") move(1);
    else if (e.code === "Enter" || e.code === "Space") onDateSelect(e, dm);
    else if (e.code === "Escape" && !inline) {
      setOpen(false);
      inputRef.current?.focus();
      e.preventDefault();
    } else if (e.code === "PageUp") {
      nav(-1);
      e.preventDefault();
    } else if (e.code === "PageDown") {
      nav(1);
      e.preventDefault();
    }
  };
  const btnKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !inline) {
      inputRef.current?.focus();
      setOpen(false);
      e.preventDefault();
    }
  };

  const rootClass = cn(
    "p-datepicker p-component p-inputwrapper",
    { "p-invalid": invalid, "p-datepicker-fluid": hasFluid, "p-inputwrapper-filled": !!displayed, "p-variant-filled": variant === "filled", "p-inputwrapper-focus": focus || open, "p-focus": focus || open },
    className,
  );
  const ys = year - (year % 10);
  const years = Array.from({ length: 10 }, (_, i) => ys + i);
  const selDate = lastDate(value);
  const monthDisabled = (i: number) => {
    for (let d = 1; d <= dim(i, year); d++) if (selectable(d, i, year, false)) return false;
    return true;
  };
  const yearDisabled = (y: number) => (!!minDate && minDate.getFullYear() > y) || (!!maxDate && maxDate.getFullYear() < y);

  const navBtn = (which: "prev" | "next") =>
    createElement(
      "p-button",
      { "data-pc-group-section": "navigator", "data-pc-section": "host", style: { visibility: "visible" } },
      <button
        className={"p-ripple p-button p-button-icon-only p-button-rounded p-button-secondary p-button-text p-component p-datepicker-" + which + "-button"}
        type="button"
        aria-label={(which === "prev" ? "Previous " : "Next ") + (curView === "year" ? "Decade" : curView === "month" ? "Year" : "Month")}
        data-pc-name={which === "prev" ? "pcprevbutton" : "pcnextbutton"}
        data-pc-extend="button"
        data-pc-section="root"
        onKeyDown={btnKey}
        onClick={() => nav(which === "prev" ? -1 : 1)}
      >
        <PrimeIcon name={which === "prev" ? "chevron-left" : "chevron-right"} />
      </button>,
    );
  const barBtn = (label: string, cls: string, name: string, onClick: () => void) =>
    createElement(
      "p-button",
      { "data-pc-group-section": "button", "data-pc-section": "host" },
      <button className={"p-ripple p-button p-component p-button-sm " + cls} type="button" data-pc-name={name} data-pc-extend="button" data-pc-section="root" onClick={onClick}>
        <span className="p-button-label" data-pc-section="label">
          {label}
        </span>
      </button>,
    );

  const panel =
    inline || mounted ? (
      <div
        ref={panelRef}
        id={inline ? undefined : panelId}
        className={cn("p-datepicker-panel p-component", { "p-datepicker-panel-inline": inline, "p-disabled": disabled, "p-datepicker-timeonly": timeOnly }, panelStyleClass)}
        style={{ ...(inline ? {} : { position: "absolute", top: 0 }), ...panelStyle }}
        aria-label="Choose Date"
        role={inline ? undefined : "dialog"}
        aria-modal={inline ? undefined : "true"}
        data-pc-section="panel"
      >
        {headerTemplate}
        {!timeOnly && (
          <>
            <div className="p-datepicker-calendar-container" data-pc-section="calendarcontainer">
              <div className="p-datepicker-calendar" data-pc-section="calendar">
                <div className="p-datepicker-header" data-pc-section="header">
                  {navBtn("prev")}
                  <div className="p-datepicker-title" data-pc-section="title">
                    {curView === "date" && (
                      <button type="button" className="p-ripple p-datepicker-select-month" aria-label="Choose Month" disabled={disabled || undefined} data-pc-group-section="navigator" data-pc-section="selectmonth" onKeyDown={btnKey} onClick={() => setCurView("month")}>
                        {" "}
                        {MONTH_NAMES[month]}{" "}
                      </button>
                    )}
                    {curView !== "year" && (
                      <button type="button" className="p-ripple p-datepicker-select-year" aria-label="Choose Year" disabled={disabled || undefined} data-pc-group-section="navigator" data-pc-section="selectyear" onKeyDown={btnKey} onClick={() => setCurView("year")}>
                        {" "}
                        {year}{" "}
                      </button>
                    )}
                    {curView === "year" && (
                      <span className="p-datepicker-decade" data-pc-section="decade">
                        {years[0]} - {years[9]}
                      </span>
                    )}
                  </div>
                  {navBtn("next")}
                </div>
                {curView === "date" && (
                  <table className="p-datepicker-day-view" role="grid" data-pc-section="table">
                    <thead data-pc-section="tableheader">
                      <tr data-pc-section="tableheaderrow">
                        {weekDays.map((wd) => (
                          <th className="p-datepicker-weekday-cell" scope="col" data-pc-section="weekdaycell" key={wd}>
                            <span className="p-datepicker-weekday" data-pc-section="weekday">
                              {wd}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody data-pc-section="tablebody">
                      {weeks.map((week, j) => (
                        <tr data-pc-section="tablebodyrow" key={j}>
                          {week.map((d) => {
                            const key = `${d.year}-${d.month}-${d.day}`;
                            const sel = isSelected(d);
                            let selCls = "";
                            if (isRange && sel && d.selectable && Array.isArray(value)) selCls = (value[0] && same(value[0], d)) || (value[1] && same(value[1], d)) ? "p-datepicker-day-selected" : "p-datepicker-day-selected-range";
                            return (
                              <td className={cn("p-datepicker-day-cell", { "p-datepicker-other-month": d.otherMonth, "p-datepicker-today": d.today })} aria-label={String(d.day)} data-pc-section="daycell" key={key}>
                                {(d.otherMonth ? showOtherMonths : true) && (
                                  <>
                                    <span
                                      className={cn("p-ripple p-datepicker-day", { "p-datepicker-day-selected": !isRange && sel && d.selectable, "p-disabled": disabled || !d.selectable, [selCls]: !!selCls })}
                                      draggable={false}
                                      data-date={key}
                                      data-pc-section="day"
                                      tabIndex={key === focusKey ? 0 : undefined}
                                      onClick={(e) => onDateSelect(e, d)}
                                      onKeyDown={(e) => onDayKey(e, d)}
                                    >
                                      {dateTemplate ? dateTemplate(d) : d.day}
                                    </span>
                                    {sel && (
                                      <div className="p-hidden-accessible" aria-live="polite">
                                        {d.day}
                                      </div>
                                    )}
                                  </>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            {curView === "month" && (
              <div className="p-datepicker-month-view" data-pc-section="monthview">
                {MONTH_NAMES_SHORT.map((m, i) => {
                  const s = !!selDate && isDate(selDate) && selDate.getMonth() === i && selDate.getFullYear() === year;
                  return (
                    <span key={m} className={cn("p-ripple p-datepicker-month", { "p-datepicker-month-selected": s, "p-disabled": monthDisabled(i) })} data-pc-section="month" tabIndex={0} onClick={(e) => !monthDisabled(i) && onMonthSelect(e, i)}>
                      {" "}
                      {m}{" "}
                      {s && (
                        <div className="p-hidden-accessible" aria-live="polite">
                          {m}
                        </div>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
            {curView === "year" && (
              <div className="p-datepicker-year-view" data-pc-section="yearview">
                {years.map((y) => {
                  const s = !!selDate && isDate(selDate) && selDate.getFullYear() === y;
                  return (
                    <span key={y} className={cn("p-ripple p-datepicker-year", { "p-datepicker-year-selected": s, "p-disabled": yearDisabled(y) })} data-pc-section="year" tabIndex={0} onClick={(e) => !yearDisabled(y) && onYearSelect(e, y)}>
                      {" "}
                      {y}{" "}
                      {s && (
                        <div className="p-hidden-accessible" aria-live="polite">
                          {y}
                        </div>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </>
        )}
        {(showTime || timeOnly) && curView === "date" && (
          <div className="p-datepicker-time-picker" data-pc-section="timepicker">
            <div className="p-datepicker-hour-picker" data-pc-section="hourpicker">
              <TimeBtn up label="Next Hour" cls="p-datepicker-increment-button" name="pcincrementbutton" onDown={() => down(0, 1)} onUp={up} />
              <span data-pc-section="hour">{hour < 10 ? "0" : ""}{hour}</span>
              <TimeBtn up={false} label="Previous Hour" cls="p-datepicker-decrement-button" name="pcdecrementbutton" onDown={() => down(0, -1)} onUp={up} />
            </div>
            <div className="p-datepicker-separator" data-pc-section="separatorcontainer">
              <span data-pc-section="separator">{timeSeparator}</span>
            </div>
            <div className="p-datepicker-minute-picker" data-pc-section="minutepicker">
              <TimeBtn up label="Next Minute" cls="p-datepicker-increment-button" name="pcincrementbutton" onDown={() => down(1, 1)} onUp={up} />
              <span data-pc-section="minute">{pad(minute)}</span>
              <TimeBtn up={false} label="Previous Minute" cls="p-datepicker-decrement-button" name="pcdecrementbutton" onDown={() => down(1, -1)} onUp={up} />
            </div>
            {showSeconds && (
              <>
                <div className="p-datepicker-separator" data-pc-section="separatorcontainer">
                  <span data-pc-section="separator">{timeSeparator}</span>
                </div>
                <div className="p-datepicker-second-picker" data-pc-section="secondpicker">
                  <TimeBtn up label="Next Second" cls="p-datepicker-increment-button" name="pcincrementbutton" onDown={() => down(2, 1)} onUp={up} />
                  <span data-pc-section="second">{pad(second)}</span>
                  <TimeBtn up={false} label="Previous Second" cls="p-datepicker-decrement-button" name="pcdecrementbutton" onDown={() => down(2, -1)} onUp={up} />
                </div>
              </>
            )}
            {hf === "12" && (
              <>
                <div className="p-datepicker-separator" data-pc-section="separatorcontainer">
                  <span data-pc-section="separator">{timeSeparator}</span>
                </div>
                <div className="p-datepicker-ampm-picker" data-pc-section="ampmpicker">
                  <TimeBtn up label="am" cls="p-datepicker-increment-button" name="pcincrementbutton" onClick={toggleAMPM} />
                  <span data-pc-section="ampm">{pm ? "PM" : "AM"}</span>
                  <TimeBtn up={false} label="pm" cls="p-datepicker-decrement-button" name="pcdecrementbutton" onClick={toggleAMPM} />
                </div>
              </>
            )}
          </div>
        )}
        {showButtonBar && (
          <div className="p-datepicker-buttonbar" data-pc-section="buttonbar">
            {barBtn("Today", "p-datepicker-today-button", "pctodaybutton", () => {
              const t = new Date();
              if (selectable(t.getDate(), t.getMonth(), t.getFullYear(), false)) selectDate({ year: t.getFullYear(), month: t.getMonth(), day: t.getDate() });
              setMonth(t.getMonth());
              setYear(t.getFullYear());
              if (!inline) hideOverlay();
            })}
            {barBtn("Clear", "p-datepicker-clear-button", "pcclearbutton", () => {
              emit(null);
              if (!inline) hideOverlay();
            })}
          </div>
        )}
        {footerTemplate}
      </div>
    ) : null;

  const toggle = () => {
    if (disabled) return;
    if (!openRef.current) {
      inputRef.current?.focus();
      showOverlay();
    } else hideOverlay();
  };
  const inputEl = !inline && (
    <>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        id={inputId}
        name={name}
        aria-autocomplete="none"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabel}
        value={displayed}
        readOnly={readonlyInput || undefined}
        disabled={disabled || undefined}
        autoComplete="off"
        style={inputStyle}
        className={cn("p-datepicker-input p-component p-inputtext", inputStyleClass, { "p-filled": !!displayed, "p-invalid": invalid, "p-variant-filled": variant === "filled", "p-inputtext-fluid": hasFluid, "p-inputtext-sm": size === "small", "p-inputtext-lg": size === "large" })}
        placeholder={placeholder}
        tabIndex={tabIndex}
        data-pc-name="pcinputtext"
        data-pc-extend="inputtext"
        data-pc-section="root"
        onFocus={(e) => {
          setFocus(true);
          if (showOnFocus) showOverlay();
          onFocus?.(e);
        }}
        onClick={() => showOnFocus && showOverlay()}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
          if (!keepInvalid) {
            typing.current = false;
            setTyped(null);
          }
        }}
        onChange={onUserInput}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && panelRef.current) {
            panelRef.current.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
            e.preventDefault();
          } else if ((e.key === "Escape" || e.key === "Enter") && openRef.current) {
            inputRef.current?.focus();
            setOpen(false);
            e.preventDefault();
          } else if (e.key === "Tab" && openRef.current) setOpen(false);
        }}
      />
      {showClear && !disabled && !!displayed && (
        <PrimeIcon
          name="times"
          className="p-datepicker-clear-icon"
          section="inputicon"
          onClick={() => {
            typing.current = false;
            setTyped(null);
            emit(null);
            onClear?.();
          }}
        />
      )}
      {showIcon && iconDisplay === "button" && (
        <button type="button" aria-label={iconAriaLabel || "Choose Date"} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} className="p-datepicker-dropdown" disabled={disabled} tabIndex={0} data-pc-section="dropdown" onClick={toggle}>
          {icon ? <span className={icon} data-pc-section="dropdownicon" /> : <PrimeIcon name="calendar" section="dropdownicon" />}
        </button>
      )}
      {showIcon && iconDisplay === "input" && (
        <span className="p-datepicker-input-icon-container" data-pc-section="inputiconcontainer">
          <PrimeIcon name="calendar" className="p-datepicker-input-icon" section="inputicon" onClick={toggle} />
        </span>
      )}
    </>
  );

  return createElement(
    "p-datepicker",
    { ref: rootRef, className: rootClass, style: { position: "relative", ...style }, "data-pc-section": "root", "data-pc-name": "datepicker", ...rest },
    inputEl,
    mode === "self" || inline || !container ? panel : panel ? createPortal(panel, container) : null,
  );
});
