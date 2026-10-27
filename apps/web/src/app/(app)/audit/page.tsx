import Link from "next/link";
import { AUDIT_CATEGORY_LABELS, ROLE_LABELS, formatDate, formatDateTimeZone, formatTime } from "@dscims/shared";
import type { AuditEntryDto, Paginated, ShopDto, UserDto } from "@dscims/shared";
import { FilterForm } from "@/components/filter-form";
import { Pagination } from "@/components/pagination";
import { api } from "@/lib/api";
import { href, num, one } from "@/lib/href";
import type { SearchParams } from "@/lib/href";
import { currentShopId, requireOwner } from "@/lib/session";

export const metadata = { title: "Audit log" };

const TONE = { sign_in: "ok", security: "warn", user: "", settings: "gray" } as const;
const TABS = [[undefined, "All"], ["sign_in", "Sign-ins"], ["security", "Security"], ["user", "Users"], ["settings", "Settings"]] as const;
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const pretty = (v: Record<string, unknown> | null) => (v ? Object.entries(v).map(([k, x]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${String(x)}`).join(", ") : "None");

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const me = await requireOwner();
  const sp = await searchParams;
  const category = one(sp.category) as AuditEntryDto["category"] | undefined;
  const shopParam = one(sp.shop);
  const shopId = shopParam === "all" ? undefined : (shopParam ?? (await currentShopId(me)) ?? undefined);
  const query = { search: one(sp.q), category, actorId: one(sp.person), shopId, from: one(sp.from), to: one(sp.to), page: num(sp.page, 1), pageSize: num(sp.pageSize, 10) };
  const [data, counts, people, shops] = await Promise.all([
    api<Paginated<AuditEntryDto>>("/audit", { query }),
    api<Record<string, number>>("/audit/counts"),
    api<Paginated<UserDto>>("/users", { query: { pageSize: 50 } }),
    api<Paginated<ShopDto>>("/shops", { query: { pageSize: 50 } }),
  ]);
  const entryId = one(sp.entry);
  const selected = entryId ? (data.items.find((e) => e.id === entryId) ?? (await api<AuditEntryDto>(`/audit/${entryId}`).catch(() => null))) : null;
  const params: SearchParams = { ...sp, shop: shopParam ?? shopId };
  const applied = [query.actorId && ["Person", people.items.find((p) => p.id === query.actorId)?.name, "person"], shopId && ["Shop", shops.items.find((s) => s.id === shopId)?.name, "shop"], query.from && ["From", query.from, "from"], query.to && ["To", query.to, "to"]].filter(Boolean) as [string, string | undefined, string][];

  return (
    <>
      <div className="pghead"><div><h1>Audit log</h1><p className="mut" style={{ margin: "6px 0 0" }}>Every sign-in, change and approval. Entries cannot be edited or deleted. Times are Lagos time (WAT).</p></div></div>
      <div className="fx" style={{ alignItems: "flex-start" }}>
        <section className="crd a" style={{ overflow: "hidden", flex: "2 1 560px" }}>
          <div className="stt" role="navigation" aria-label="Filter by type">
            {TABS.map(([key, label]) => {
              const n = key ? counts[key] : counts.all;
              return <Link key={label} href={href("/audit", params, { category: key ?? null, page: 1, entry: null })} className={category === key ? "on" : ""} aria-current={category === key ? "true" : undefined}>{label} <span className="n">{n}</span></Link>;
            })}
          </div>
          <FilterForm search={query.search} searchPlaceholder="Search person or action" activeCount={applied.length} hidden={{ ...(category ? { category } : {}), pageSize: String(query.pageSize) }}>
            <div><label className="lbl sm" htmlFor="f-from">From</label><input id="f-from" type="date" name="from" className="inp" defaultValue={query.from} /></div>
            <div><label className="lbl sm" htmlFor="f-to">To</label><input id="f-to" type="date" name="to" className="inp" defaultValue={query.to} /></div>
            <div><label className="lbl sm" htmlFor="f-person">Person</label><select id="f-person" name="person" className="inp" defaultValue={query.actorId ?? ""}><option value="">Anyone</option>{people.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className="lbl sm" htmlFor="f-shop">Shop</label><select id="f-shop" name="shop" className="inp" defaultValue={shopId ?? "all"}><option value="all">All shops</option>{shops.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          </FilterForm>
          {applied.length > 0 && (
            <div className="applied">
              {applied.map(([label, value, key]) => <Link key={key} className="ac" href={href("/audit", params, { [key]: key === "shop" ? "all" : null, page: 1 })} aria-label={`Remove ${label} filter`}>{label}: {value} ×</Link>)}
              <Link className="ac" href="/audit?shop=all" style={{ background: "none", textDecoration: "underline" }}>Clear all</Link>
            </div>
          )}
          <div className="rt" style={{ ["--cols" as string]: "minmax(140px,1.1fr) minmax(170px,1.4fr) minmax(240px,2.6fr) 104px minmax(100px,1fr)", ["--cols-md" as string]: "minmax(0,1.3fr) minmax(0,2.4fr) 100px minmax(0,1fr)" }}>
            <div className="tr th"><span>Date and time</span><span className="c-hide c-hide-md">Person</span><span>What happened</span><span className="c-hide">Type</span><span className="c-hide">Shop</span></div>
            {data.items.length === 0 && <p className="mut" style={{ padding: 24, margin: 0 }}>Nothing matches these filters.</p>}
            {data.items.map((e) => (
              <Link key={e.id} href={href("/audit", params, { entry: e.id })} className={`tr${e.id === entryId ? " hl" : ""}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="two"><span>{formatDate(e.createdAt)}</span><small>{formatTime(e.createdAt)} WAT</small></div>
                <div className="row c-hide c-hide-md"><div className="av sm">{initials(e.actorName)}</div><div className="two"><b>{e.actorName}</b><small>{e.actorRole === "platform" ? "Pacifylabs" : e.actorRole ? ROLE_LABELS[e.actorRole] : ""}</small></div></div>
                <span><b className="show-sm">{e.actorName} </b>{e.message}</span>
                <span className="c-hide"><span className={`badge ${TONE[e.category]}`}>{AUDIT_CATEGORY_LABELS[e.category]}</span></span>
                <span className="c-hide">{e.shopName ?? "All shops"}</span>
              </Link>
            ))}
          </div>
          <Pagination data={data} path="/audit" params={params} noun="entries" />
        </section>
        {selected && (
          <aside className="panel c" style={{ flex: "1 1 320px" }} aria-label="Entry details">
            <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0, fontSize: 18 }}>Entry details</h2><Link className="ib" href={href("/audit", params, { entry: null })} aria-label="Close details">×</Link></div>
            <span className={`badge ${TONE[selected.category]}`} style={{ alignSelf: "flex-start" }}>{AUDIT_CATEGORY_LABELS[selected.category]}</span>
            <div><div className="b" style={{ fontSize: 17 }}>{selected.actorName} {selected.message}</div><div className="sm faint" style={{ marginTop: 2 }}>{formatDateTimeZone(selected.createdAt)}</div></div>
            {(selected.before || selected.after) && (
              <div className="card s sm">
                <div className="up" style={{ marginBottom: 10 }}>What changed</div>
                <div className="row" style={{ alignItems: "flex-start" }}><span className="mut" style={{ width: 56 }}>Before</span><span>{pretty(selected.before)}</span></div>
                <div className="row" style={{ marginTop: 8, alignItems: "flex-start" }}><span className="mut" style={{ width: 56 }}>After</span><span>{pretty(selected.after)}</span></div>
              </div>
            )}
            {selected.entityLabel && <div><div className="up" style={{ marginBottom: 4 }}>Record</div><div className="sm" style={{ overflowWrap: "anywhere" }}>{selected.entityLabel}{selected.shopName ? ` · ${selected.shopName}` : ""}</div></div>}
            {selected.userAgent && <div><div className="up" style={{ marginBottom: 4 }}>Device</div><div className="sm" style={{ overflowWrap: "anywhere" }}>{selected.userAgent}</div></div>}
            <p className="sm faint" style={{ margin: 0 }}>This entry is locked and cannot be changed.</p>
          </aside>
        )}
      </div>
    </>
  );
}
