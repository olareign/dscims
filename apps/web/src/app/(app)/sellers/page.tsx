import Link from "next/link";
import { CaretRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { formatDate, formatTime } from "@dscims/shared";
import type { Paginated, SellerDto } from "@dscims/shared";
import { FilterForm } from "@/components/filter-form";
import { Pagination } from "@/components/pagination";
import { api } from "@/lib/api";
import { href, num, one } from "@/lib/href";
import type { SearchParams } from "@/lib/href";
import { requireBuyer } from "@/lib/session";

export const metadata = { title: "Sellers" };

const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const SORT = [["name", "Name, A to Z"], ["recent", "Latest purchase first"]] as const;

export default async function SellersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireBuyer();
  const sp = await searchParams;
  const tag = one(sp.tag) as "flagged" | "no_id" | undefined;
  const query = { search: one(sp.q), tag, sort: one(sp.sort) ?? "name", page: num(sp.page, 1), pageSize: num(sp.pageSize, 10) };
  const data = await api<Paginated<SellerDto>>("/sellers", { query });
  const added = one(sp.added);
  const tabs = [[undefined, "All sellers"], ["flagged", "With a flagged phone"], ["no_id", "No ID yet"]] as const;
  const applied = [query.sort !== "name" && ["Sort", SORT.find((s) => s[0] === query.sort)?.[1], "sort"]].filter(Boolean) as [string, string | undefined, string][];

  return (
    <>
      <div className="pghead">
        <div><h1>Sellers</h1><p className="mut" style={{ margin: "6px 0 0" }}>People you buy phones from. IDs and NIN/BVN are private to the owner and managers.</p></div>
        <Link href="/sellers/new" className="btn p"><Plus className="i s" aria-hidden /> Register a seller</Link>
      </div>
      {added && <div className="ban ok" role="status">The seller was registered.</div>}
      <section className="crd" style={{ overflow: "hidden" }}>
        <div className="stt" role="navigation" aria-label="Filter sellers">
          {tabs.map(([key, label]) => (
            <Link key={label} href={href("/sellers", sp, { tag: key ?? null, page: 1 })} className={tag === key ? "on" : ""} aria-current={tag === key ? "true" : undefined}>{label}</Link>
          ))}
        </div>
        <FilterForm search={query.search} searchPlaceholder="Name or phone number" activeCount={applied.length} hidden={{ ...(tag ? { tag } : {}), pageSize: String(query.pageSize) }}>
          <div><label className="lbl sm" htmlFor="f-sort">Sort by</label><select id="f-sort" name="sort" className="inp" defaultValue={query.sort}>{SORT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        </FilterForm>
        <div className="rt" style={{ ["--cols" as string]: "minmax(220px,2fr) minmax(130px,1fr) minmax(90px,.7fr) minmax(150px,1.2fr) minmax(130px,1fr) 44px", ["--cols-md" as string]: "minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) 44px" }}>
          <div className="tr th"><span>Seller</span><span className="c-hide c-hide-md">Phone</span><span className="c-hide">Phones</span><span className="c-hide c-hide-md">Latest purchase</span><span className="c-hide">Record</span><span /></div>
          {data.items.length === 0 && <p className="mut" style={{ padding: 24, margin: 0 }}>{query.search || tag ? "No sellers match. Clear a filter to see more." : "No sellers yet. Register one, or add one while buying phones."}</p>}
          {data.items.map((s) => (
            <div key={s.id} className="tr">
              <div className="c-main"><div className="av">{initials(s.name)}</div><div className="two"><b>{s.name}</b><small>{s.address}</small></div></div>
              <span className="c-hide c-hide-md">{s.phone}</span>
              <span className="c-hide">{s.deviceCount}</span>
              <div className="two c-hide c-hide-md">{s.lastPurchaseAt ? <><span>{formatDate(s.lastPurchaseAt)}</span><small>{formatTime(s.lastPurchaseAt)} WAT</small></> : <span className="faint">None yet</span>}</div>
              <span className="c-hide">{s.flaggedCount > 0 ? <span className="badge bad">Flagged phone</span> : s.hasId ? <span className="badge ok">ID on file</span> : <span className="badge warn">No ID yet</span>}</span>
              <Link className="ib c-act" href={`/sellers/${s.id}`} aria-label={`Open ${s.name}`}><CaretRight className="i s" aria-hidden /></Link>
              <div className="c-line">{s.phone} · {s.deviceCount} phone{s.deviceCount === 1 ? "" : "s"} sold to you<br />{s.flaggedCount > 0 ? "Has a flagged phone" : s.hasId ? "ID on file" : "No ID yet"}{s.lastPurchaseAt ? ` · Last sale ${formatDate(s.lastPurchaseAt)}` : ""}</div>
            </div>
          ))}
        </div>
        <Pagination data={data} path="/sellers" params={sp} noun="sellers" />
      </section>
    </>
  );
}
