import Link from "next/link";
import { CaretRight, DeviceMobile, Flag, Package, Plus, Timer, Wallet } from "@phosphor-icons/react/dist/ssr";
import { DEVICE_CONDITIONS, DEVICE_CONDITION_LABELS, DEVICE_STATUS_LABELS } from "@dscims/shared";
import type { DeviceListItemDto, DeviceStatus, Paginated, StockCountsDto } from "@dscims/shared";
import { FilterForm } from "@/components/filter-form";
import { Pagination } from "@/components/pagination";
import { api } from "@/lib/api";
import { naira } from "@/lib/format";
import { href, num, one } from "@/lib/href";
import { STATUS_TONE } from "@/lib/stock";
import type { SearchParams } from "@/lib/href";
import { currentShopId, requireMe } from "@/lib/session";

export const metadata = { title: "Stock" };

const AGE = [["over60", "Over 60 days"]] as const;
const SORT = [["newest", "Newest first"], ["oldest", "Oldest first"], ["price_high", "Price, high to low"], ["price_low", "Price, low to high"]] as const;

export default async function StockPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const me = await requireMe();
  const sp = await searchParams;
  const canCost = me.user.role !== "staff";
  const status = one(sp.status) as DeviceStatus | undefined;
  const shopParam = one(sp.shop);
  const shopId = shopParam === "all" ? undefined : (shopParam ?? (await currentShopId(me)) ?? undefined);
  const query = { search: one(sp.q), status, condition: one(sp.condition), age: one(sp.age), sort: one(sp.sort) ?? "newest", shopId, page: num(sp.page, 1), pageSize: num(sp.pageSize, 10) };
  const data = await api<Paginated<DeviceListItemDto>>("/devices", { query });
  const counts = await api<StockCountsDto>("/devices/counts", { query: { shopId } });
  const params: SearchParams = { ...sp, shop: shopParam ?? shopId };
  const showShop = me.user.role === "owner" && me.shops.length > 1;
  const applied = [
    query.condition && ["Condition", DEVICE_CONDITION_LABELS[query.condition as keyof typeof DEVICE_CONDITION_LABELS], "condition"],
    query.age && ["Age", AGE.find((a) => a[0] === query.age)?.[1], "age"],
    showShop && shopId && ["Shop", me.shops.find((s) => s.id === shopId)?.name, "shop"],
  ].filter(Boolean) as [string, string | undefined, string][];
  const tabs: [DeviceStatus | undefined, string, number][] = [[undefined, "All", counts.all], ["in_stock", "In stock", counts.in_stock], ["under_review", "Under review", counts.under_review], ["flagged", "Flagged", counts.flagged], ["sold", "Sold", counts.sold], ["returned", "Returned", counts.returned]];
  const cols = canCost
    ? "minmax(220px,2.2fr) minmax(140px,1.2fr) minmax(110px,1fr) minmax(80px,.7fr) minmax(100px,.9fr) minmax(100px,.9fr) minmax(110px,.9fr) 44px"
    : "minmax(220px,2.2fr) minmax(140px,1.2fr) minmax(110px,1fr) minmax(80px,.7fr) minmax(100px,.9fr) minmax(110px,.9fr) 44px";
  const colsMd = canCost ? "minmax(0,2fr) minmax(0,1.2fr) minmax(0,1.1fr) 44px" : "minmax(0,2fr) minmax(0,1.2fr) minmax(0,1.1fr) 44px";
  const bought = one(sp.bought);

  return (
    <>
      <div className="pghead">
        <div><h1>Stock</h1><p className="mut" style={{ margin: "6px 0 0" }}>Every phone in {me.tenant.name}, by IMEI.{canCost ? " Cost prices show for the owner and managers only." : " Cost prices and sellers are for the owner and managers."}</p></div>
        {canCost && <Link href="/stock/buy" className="btn p"><Plus className="i s" aria-hidden /> Buy phones</Link>}
      </div>
      {bought && <div className="ban ok" role="status">Purchase {bought} was recorded and the phones are in stock.</div>}
      <div className="kpis">
        <div className="crd kpi"><div className="row"><span className="ico"><Package className="i" aria-hidden /></span><span className="mut">In stock</span></div><div className="num">{counts.in_stock}</div></div>
        {canCost && counts.stockAtCostKobo !== undefined && <div className="crd kpi"><div className="row"><span className="ico t"><Wallet className="i" aria-hidden /></span><span className="mut">Stock at cost</span></div><div className="num">{naira(counts.stockAtCostKobo)}</div></div>}
        <div className="crd kpi"><div className="row"><span className="ico w"><Timer className="i" aria-hidden /></span><span className="mut">Over 60 days</span></div><div className="num">{counts.over60Days}</div></div>
        <div className="crd kpi"><div className="row"><span className="ico r"><Flag className="i" aria-hidden /></span><span className="mut">Flagged</span></div><div className="num">{counts.flagged}</div></div>
      </div>
      <section className="crd" style={{ overflow: "hidden" }}>
        <div className="stt" role="navigation" aria-label="Filter by status">
          {tabs.map(([key, label, n]) => (
            <Link key={label} href={href("/stock", params, { status: key ?? null, page: 1 })} className={status === key ? "on" : ""} aria-current={status === key ? "true" : undefined}>{label} <span className="n">{n}</span></Link>
          ))}
        </div>
        <FilterForm search={query.search} searchPlaceholder={canCost ? "IMEI, model, seller or purchase number" : "IMEI or model"} activeCount={applied.length} hidden={{ ...(status ? { status } : {}), ...(shopParam ? { shop: shopParam } : {}), pageSize: String(query.pageSize) }}>
          <div><label className="lbl sm" htmlFor="f-condition">Condition</label><select id="f-condition" name="condition" className="inp" defaultValue={query.condition ?? ""}><option value="">All conditions</option>{DEVICE_CONDITIONS.map((c) => <option key={c} value={c}>{DEVICE_CONDITION_LABELS[c]}</option>)}</select></div>
          <div><label className="lbl sm" htmlFor="f-age">Age</label><select id="f-age" name="age" className="inp" defaultValue={query.age ?? ""}><option value="">Any age</option>{AGE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          {showShop && <div><label className="lbl sm" htmlFor="f-shop">Shop</label><select id="f-shop" name="shop" className="inp" defaultValue={shopId ?? "all"}><option value="all">All shops</option>{me.shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
          <div><label className="lbl sm" htmlFor="f-sort">Sort by</label><select id="f-sort" name="sort" className="inp" defaultValue={query.sort}>{SORT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        </FilterForm>
        {applied.length > 0 && (
          <div className="applied">
            {applied.map(([label, value, key]) => <Link key={key} className="ac" href={href("/stock", params, { [key]: key === "shop" ? "all" : null, page: 1 })} aria-label={`Remove ${label} filter`}>{label}: {value} ×</Link>)}
            <Link className="ac" href="/stock?shop=all" style={{ background: "none", textDecoration: "underline" }}>Clear all</Link>
          </div>
        )}
        <div className="rt" style={{ ["--cols" as string]: cols, ["--cols-md" as string]: colsMd }}>
          <div className="tr th"><span>Phone</span><span className="c-hide c-hide-md">IMEI</span><span className="c-hide c-hide-md">Condition</span><span className="c-hide">Age</span><span className="c-hide c-hide-md">Selling</span>{canCost && <span className="c-hide">Cost</span>}<span className="c-hide">Status</span><span /></div>
          {data.items.length === 0 && <p className="mut" style={{ padding: 24, margin: 0 }}>{counts.all === 0 ? (canCost ? "No phones yet. Buy phones from a seller to add them here." : "No phones in stock yet.") : "No phones match. Clear a filter to see more."}</p>}
          {data.items.map((d) => (
            <div key={d.id} className="tr">
              <div className="c-main"><span className={`pic ${d.status === "flagged" ? "bad" : d.status === "sold" || d.status === "written_off" ? "gray" : ""}`}><DeviceMobile className="i" aria-hidden /></span><div className="two"><b>{d.brand} {d.model}{d.storage ? ` ${d.storage}` : ""}</b><small>{d.colour ? `${d.colour}${canCost && d.sellerName ? " · " : ""}` : ""}{canCost && d.sellerName ? `From ${d.sellerName}` : ""}{!d.colour && !(canCost && d.sellerName) ? d.shopName : ""}</small></div></div>
              <span className="imei c-hide c-hide-md">{d.imei}</span>
              <span className="c-hide c-hide-md">{DEVICE_CONDITION_LABELS[d.condition]}</span>
              <span className="c-hide">{d.ageDays === 0 ? "Today" : `${d.ageDays} d`}</span>
              <b className="c-hide c-hide-md">{naira(d.sellingKobo)}</b>
              {canCost && <span className="c-hide">{d.costKobo !== undefined ? naira(d.costKobo) : ""}</span>}
              <span className={`st ${STATUS_TONE[d.status]} c-hide`}>{DEVICE_STATUS_LABELS[d.status]}</span>
              <Link className="ib c-act" href={`/stock/${d.id}`} aria-label={`Open ${d.brand} ${d.model}`}><CaretRight className="i s" aria-hidden /></Link>
              <div className="c-line"><span className="imei">{d.imei}</span><br />{DEVICE_CONDITION_LABELS[d.condition]} · {naira(d.sellingKobo)}{canCost && d.costKobo !== undefined ? ` · Cost ${naira(d.costKobo)}` : ""}<br />{DEVICE_STATUS_LABELS[d.status]} · {d.ageDays === 0 ? "received today" : `${d.ageDays} days in stock`}</div>
            </div>
          ))}
        </div>
        <Pagination data={data} path="/stock" params={params} noun="phones" />
      </section>
    </>
  );
}
