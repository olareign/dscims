import Link from "next/link";
import { MapPin, Plus, Storefront } from "@phosphor-icons/react/dist/ssr";
import type { Paginated, ShopDto } from "@dscims/shared";
import { FilterForm } from "@/components/filter-form";
import { Pagination } from "@/components/pagination";
import { api } from "@/lib/api";
import { num, one } from "@/lib/href";
import type { SearchParams } from "@/lib/href";
import { requireOwner } from "@/lib/session";

export const metadata = { title: "Shops" };

export default async function ShopsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireOwner();
  const sp = await searchParams;
  const sort = one(sp.sort) === "created" ? "created" : "name";
  const data = await api<Paginated<ShopDto>>("/shops", { query: { search: one(sp.q), sort, page: num(sp.page, 1), pageSize: num(sp.pageSize, 10) } });
  return (
    <>
      <div className="pghead">
        <div><h1>Shops</h1><p className="mut" style={{ margin: "6px 0 0" }}>Each manager and staff member works in one shop. You see all shops.</p></div>
        <Link href="/shops/new" className="btn p"><Plus className="i s" aria-hidden /> Add shop</Link>
      </div>
      {one(sp.added) && <div className="ban ok" role="status">Shop added.</div>}
      <section className="crd" style={{ overflow: "hidden" }}>
        <FilterForm search={one(sp.q)} searchPlaceholder="Search shops" activeCount={sort === "created" ? 1 : 0} hidden={{ pageSize: String(num(sp.pageSize, 10)) }}>
          <div><label className="lbl sm" htmlFor="f-sort">Sort by</label><select id="f-sort" name="sort" className="inp" defaultValue={sort}><option value="name">Main shop first, then A to Z</option><option value="created">Newest first</option></select></div>
        </FilterForm>
        <div style={{ padding: "0 16px 16px", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,340px),1fr))" }}>
          {data.items.length === 0 && <p className="mut" style={{ margin: 0 }}>No shops match your search.</p>}
          {data.items.map((s) => (
            <div key={s.id} className="card">
              <div className="row" style={{ alignItems: "flex-start" }}>
                <span className="tile"><Storefront className="i" aria-hidden /></span>
                <div className="grow"><div className="b" style={{ fontSize: 17 }}>{s.name}</div><div className="sm mut" style={{ overflowWrap: "anywhere" }}>{s.address || "Address not set yet"}</div><div className="sm faint">{s.phone ? `Contact ${s.phone} · ` : ""}{s.userCount} users</div></div>
                {s.isMain && <span className="badge">Main shop</span>}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <Link href={`/shops/${s.id}`} className="btn sm g grow">Edit</Link>
                {s.latitude !== null && s.longitude !== null && <a className="btn sm g grow" href={`https://www.openstreetmap.org/?mlat=${s.latitude}&mlon=${s.longitude}#map=17/${s.latitude}/${s.longitude}`} target="_blank" rel="noopener noreferrer"><MapPin className="i s" aria-hidden /> View map</a>}
              </div>
            </div>
          ))}
        </div>
        <Pagination data={data} path="/shops" params={sp} noun="shops" />
      </section>
    </>
  );
}
