import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { formatDate, formatTime } from "@dscims/shared";
import type { DealerDto, Paginated } from "@dscims/shared";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { FilterForm } from "@/components/filter-form";
import { Pagination } from "@/components/pagination";
import { api } from "@/lib/api";
import { longDate } from "@/lib/greeting";
import { href, num, one } from "@/lib/href";
import type { SearchParams } from "@/lib/href";
import { createDealer, reactivateDealer, suspendDealer } from "../actions";

export const metadata = { title: "Dealers" };

const TONE = { active: "ok", suspended: "warn", locked: "bad" } as const;
const LABEL = { active: "Active", suspended: "Suspended, read-only", locked: "Locked" } as const;

export default async function DealersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const status = one(sp.status);
  const query = { search: one(sp.q), status, sort: one(sp.sort) === "name" ? "name" : "newest", page: num(sp.page, 1), pageSize: num(sp.pageSize, 10) };
  const [data, counts] = await Promise.all([
    api<Paginated<DealerDto>>("/platform/dealers", { query, scope: "platform" }),
    api<{ all: number; active: number; suspended: number; locked: number }>("/platform/dealers/counts", { scope: "platform" }),
  ]);
  const tabs = [[undefined, "All dealers", counts.all], ["active", "Active", counts.active], ["suspended", "Suspended", counts.suspended], ["locked", "Locked", counts.locked]] as const;
  const creating = one(sp.create) === "1";
  return (
    <>
      <div className="pghead">
        <div><div className="sm faint">{longDate()} · Lagos time (WAT)</div><h1>Dealers</h1><p className="mut" style={{ margin: "6px 0 0" }}>Create and suspend dealer accounts. You cannot open a dealer&apos;s stock or sales.</p></div>
        <Link href={href("/platform", sp, { create: 1 })} className="btn p"><Plus className="i s" aria-hidden /> Create dealer</Link>
      </div>
      {one(sp.created) && <div className="ban ok" role="status">{one(sp.created)} was created. We emailed the owner a link to set a password.</div>}
      <div className="fx" style={{ alignItems: "flex-start" }}>
        <section className="crd a" style={{ overflow: "hidden", flex: "2 1 600px" }}>
          <div className="stt" role="navigation" aria-label="Filter by status">
            {tabs.map(([key, label, n]) => <Link key={label} href={href("/platform", sp, { status: key ?? null, page: 1 })} className={status === key ? "on" : ""} aria-current={status === key ? "true" : undefined}>{label} <span className="n">{n}</span></Link>)}
          </div>
          <FilterForm search={query.search} searchPlaceholder="Search dealer or owner email" activeCount={query.sort === "name" ? 1 : 0} hidden={{ ...(status ? { status } : {}), pageSize: String(query.pageSize) }}>
            <div><label className="lbl sm" htmlFor="f-sort">Sort by</label><select id="f-sort" name="sort" className="inp" defaultValue={query.sort}><option value="newest">Newest first</option><option value="name">Name, A to Z</option></select></div>
          </FilterForm>
          <div className="rt" style={{ ["--cols" as string]: "minmax(180px,2fr) minmax(190px,2fr) 60px 60px minmax(130px,1fr) minmax(130px,1.2fr) 110px", ["--cols-md" as string]: "minmax(0,2fr) minmax(0,1.2fr) minmax(0,1.2fr) 110px" }}>
            <div className="tr th"><span>Dealer</span><span className="c-hide c-hide-md">Owner</span><span className="c-hide c-hide-md">Shops</span><span className="c-hide c-hide-md">Users</span><span className="c-hide">Status</span><span className="c-hide">Created</span><span /></div>
            {data.items.length === 0 && <p className="mut" style={{ padding: 24, margin: 0 }}>No dealers match.</p>}
            {data.items.map((d) => (
              <div key={d.id} className="tr">
                <div className="c-main"><span className="tile" style={{ width: 38, height: 38, borderRadius: 10, fontWeight: 700 }} aria-hidden>{d.name.slice(0, 2).toUpperCase()}</span><div className="two"><b>{d.name}</b><small className="show-sm">{LABEL[d.status]}</small></div></div>
                <div className="two c-hide c-hide-md"><span>{d.ownerName ?? "No owner"}</span><small>{d.ownerEmail}</small></div>
                <span className="c-hide c-hide-md">{d.shops}</span><span className="c-hide c-hide-md">{d.users}</span>
                <span className={`st ${TONE[d.status]} c-hide`}>{LABEL[d.status]}</span>
                <div className="two c-hide"><span>{formatDate(d.createdAt)}</span><small>{formatTime(d.createdAt)} WAT</small></div>
                <div className="c-act" style={{ textAlign: "right" }}>
                  <ActionForm action={d.status === "active" ? suspendDealer : reactivateDealer}>
                    <input type="hidden" name="id" value={d.id} />
                    <SubmitButton className={`btn sm ${d.status === "active" ? "d" : ""}`}>{d.status === "active" ? "Suspend" : "Reactivate"}</SubmitButton>
                  </ActionForm>
                </div>
              </div>
            ))}
          </div>
          <Pagination data={data} path="/platform" params={sp} noun="dealers" />
        </section>
        {creating && (
          <aside className="panel c" style={{ flex: "1 1 340px" }} aria-label="Create dealer">
            <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0, fontSize: 18 }}>Create dealer</h2><Link className="ib" href={href("/platform", sp, { create: null })} aria-label="Close">×</Link></div>
            <ActionForm action={createDealer}>
              <Field name="businessName" label="Business name" />
              <Field name="ownerName" label="Owner's full name" />
              <Field name="ownerEmail" label="Owner's email" type="email" inputMode="email" hint="The owner signs in with this email." />
              <Field name="shopName" label="First shop name" defaultValue="Main shop" />
              <div className="ban info"><span>We email the owner a link to set a password. It works for 24 hours.</span></div>
              <SubmitButton pendingText="Creating...">Create and send invite</SubmitButton>
            </ActionForm>
          </aside>
        )}
      </div>
    </>
  );
}
