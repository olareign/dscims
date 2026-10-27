import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { PAGE_SIZES, pageWindow } from "@dscims/shared";
import type { Paginated } from "@dscims/shared";
import { href } from "@/lib/href";
import type { SearchParams } from "@/lib/href";

/** Same on every list: summary, rows per page, previous/next and page numbers. Numbers hide on phones. */
export function Pagination({ data, path, params, noun }: { data: Paginated<unknown>; path: string; params: SearchParams; noun: string }) {
  const { page, pageSize, total, totalPages, items } = data;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + items.length;
  const go = (p: number) => href(path, params, { page: Math.min(Math.max(1, p), totalPages) });
  return (
    <nav className="pgn" aria-label={`${noun} pages`}>
      <span>Showing <b style={{ color: "var(--ink)" }}>{from} to {to}</b> of <b style={{ color: "var(--ink)" }}>{total}</b> {noun}</span>
      <div className="row" style={{ gap: 6 }}>
        <span className="sm">Rows</span>
        {PAGE_SIZES.map((s) => (
          <Link key={s} className={`pgb${s === pageSize ? " on" : ""}`} href={href(path, params, { pageSize: s, page: 1 })} aria-current={s === pageSize ? "true" : undefined}>{s}</Link>
        ))}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <Link className={`pgb${page <= 1 ? " dis" : ""}`} href={go(page - 1)} aria-label="Previous page" aria-disabled={page <= 1}><CaretLeft className="i s" /></Link>
        <span className="sm" style={{ padding: "0 6px" }}>Page {page} of {totalPages}</span>
        <span className="nums">
          {pageWindow(page, totalPages).map((n, i) => n === null
            ? <span key={`gap${i}`} className="pgb dis">...</span>
            : <Link key={n} className={`pgb${n === page ? " on" : ""}`} href={go(n)} aria-current={n === page ? "page" : undefined}>{n}</Link>)}
        </span>
        <Link className={`pgb${page >= totalPages ? " dis" : ""}`} href={go(page + 1)} aria-label="Next page" aria-disabled={page >= totalPages}><CaretRight className="i s" /></Link>
      </div>
    </nav>
  );
}
