"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Funnel, MagnifyingGlass } from "@phosphor-icons/react";

/**
 * Filter bar for list pages. It is a plain GET form, so filters live in the URL (shareable, back button works).
 * Selects and dates apply as soon as they change; typing in search applies after a short pause.
 */
export function FilterForm({ children, search, searchPlaceholder, activeCount, hidden = {} }: { children: ReactNode; search?: string; searchPlaceholder: string; activeCount: number; hidden?: Record<string, string> }) {
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(activeCount > 0);
  return (
    <form
      ref={ref}
      method="get"
      className="toolbar"
      onChange={(e) => {
        const el = e.target as unknown as HTMLInputElement;
        if (el.name === "q") {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => ref.current?.requestSubmit(), 450);
        } else ref.current?.requestSubmit();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="srx">
        <MagnifyingGlass className="i s" aria-hidden />
        <input type="search" name="q" defaultValue={search} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
      </label>
      <button type="button" className="fbtn tog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Funnel className="i s" aria-hidden /> Filters {activeCount > 0 && <em>{activeCount}</em>}
      </button>
      <div className={`fpanel${open ? " open" : ""}`}>
        {children}
        <button type="submit" className="btn sm g">Apply</button>
      </div>
    </form>
  );
}
