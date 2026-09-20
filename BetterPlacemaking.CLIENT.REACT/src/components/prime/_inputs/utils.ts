import { useLayoutEffect, useState, type RefObject } from "react";

export type ClassValue = string | false | null | undefined | Record<string, unknown>;

/** classnames-style joiner used to build PrimeNG's `cx()` class maps. */
export function cn(...args: ClassValue[]): string {
  const out: string[] = [];
  for (const a of args) {
    if (!a) continue;
    if (typeof a === "string") out.push(a);
    else for (const [k, v] of Object.entries(a)) if (v) out.push(k);
  }
  return out.join(" ");
}

/** ObjectUtils.equals */
export function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a && b && typeof a === "object" && typeof b === "object") {
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEquals((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return a !== a && b !== b;
}

export function resolveField(obj: unknown, field?: string | ((o: unknown) => unknown)): unknown {
  if (obj === null || obj === undefined) return obj;
  if (!field) return obj;
  if (typeof field === "function") return field(obj);
  if (typeof obj !== "object") return obj;
  if (!field.includes(".")) return (obj as Record<string, unknown>)[field];
  return field.split(".").reduce<unknown>((o, k) => (o == null ? o : (o as Record<string, unknown>)[k]), obj);
}

/** PrimeNG `hasFluid`: explicit `fluid` prop, else true when inside a `.p-fluid` ancestor. */
export function useFluid(ref: RefObject<HTMLElement | null>, fluid?: boolean): boolean {
  const [inFluid, setInFluid] = useState(false);
  useLayoutEffect(() => {
    setInFluid(!!ref.current?.parentElement?.closest(".p-fluid"));
  }, [ref]);
  return fluid ?? inFluid;
}

export function focusEl(el: HTMLElement | null | undefined, opts?: FocusOptions) {
  el?.focus(opts);
}

let idCounter = 0;
export function nextId(prefix = "pn_id_") {
  return prefix + ++idCounter;
}
