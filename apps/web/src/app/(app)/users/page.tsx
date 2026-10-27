import Link from "next/link";
import { CaretRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { ROLE_LABELS, formatDate, formatTime } from "@dscims/shared";
import type { Paginated, ShopDto, UserDto } from "@dscims/shared";
import { FilterForm } from "@/components/filter-form";
import { Pagination } from "@/components/pagination";
import { api } from "@/lib/api";
import { href, num, one } from "@/lib/href";
import type { SearchParams } from "@/lib/href";
import { currentShopId, requireOwner } from "@/lib/session";

export const metadata = { title: "Users" };

const STATUS_LABEL = { active: "Active", invited: "Invited", deactivated: "Deactivated" } as const;
const STATUS_TONE = { active: "ok", invited: "warn", deactivated: "off" } as const;
const ROLES = [["owner", "Owner"], ["manager", "Manager"], ["staff", "Sales staff"]] as const;
const LAST = [["today", "Today"], ["7d", "Last 7 days"], ["over30d", "Over 30 days ago"]] as const;
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const me = await requireOwner();
  const sp = await searchParams;
  const status = one(sp.status);
  const shopParam = one(sp.shop);
  const shopId = shopParam === "all" ? undefined : (shopParam ?? (await currentShopId(me)) ?? undefined);
  const query = { search: one(sp.q), role: one(sp.role), status, shopId, lastSignIn: one(sp.lastSignIn), sort: one(sp.sort) ?? "name", page: num(sp.page, 1), pageSize: num(sp.pageSize, 10) };
  const [data, counts, shops] = await Promise.all([
    api<Paginated<UserDto>>("/users", { query }),
    api<{ all: number; active: number; invited: number; deactivated: number }>("/users/counts"),
    api<Paginated<ShopDto>>("/shops", { query: { pageSize: 50 } }),
  ]);
  const params: SearchParams = { ...sp, shop: shopParam ?? (shopId ? shopId : undefined) };
  const applied = [query.role && ["Role", ROLES.find((r) => r[0] === query.role)?.[1], "role"], shopId && ["Shop", shops.items.find((s) => s.id === shopId)?.name, "shop"], query.lastSignIn && ["Last sign-in", LAST.find((l) => l[0] === query.lastSignIn)?.[1], "lastSignIn"]].filter(Boolean) as [string, string | undefined, string][];
  const tabs = [[undefined, "All users", counts.all], ["active", "Active", counts.active], ["invited", "Invited", counts.invited], ["deactivated", "Deactivated", counts.deactivated]] as const;
  const added = one(sp.added);

  return (
    <>
      <div className="pghead">
        <div><h1>Users</h1><p className="mut" style={{ margin: "6px 0 0" }}>Who can sign in to {me.tenant.name}, and what each person can do. Everyone signs in with their email.</p></div>
        <Link href="/users/new" className="btn p"><Plus className="i s" aria-hidden /> Add user</Link>
      </div>
      {added && <div className="ban ok" role="status">{added} was added. We emailed them a link to set a password.</div>}
      <section className="crd" style={{ overflow: "hidden" }}>
        <div className="stt" role="navigation" aria-label="Filter by status">
          {tabs.map(([key, label, n]) => (
            <Link key={label} href={href("/users", params, { status: key ?? null, page: 1 })} className={status === key ? "on" : ""} aria-current={status === key ? "true" : undefined}>{label} <span className="n">{n}</span></Link>
          ))}
        </div>
        <FilterForm search={query.search} searchPlaceholder="Search by name or email" activeCount={applied.length} hidden={{ ...(status ? { status } : {}), pageSize: String(query.pageSize) }}>
          <div><label className="lbl sm" htmlFor="f-role">Role</label><select id="f-role" name="role" className="inp" defaultValue={query.role ?? ""}><option value="">All roles</option>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="lbl sm" htmlFor="f-shop">Shop</label><select id="f-shop" name="shop" className="inp" defaultValue={shopId ?? "all"}><option value="all">All shops</option>{shops.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className="lbl sm" htmlFor="f-last">Last sign-in</label><select id="f-last" name="lastSignIn" className="inp" defaultValue={query.lastSignIn ?? ""}><option value="">Any time</option>{LAST.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="lbl sm" htmlFor="f-sort">Sort by</label><select id="f-sort" name="sort" className="inp" defaultValue={query.sort}><option value="name">Name, A to Z</option><option value="last_sign_in">Last sign-in, newest first</option></select></div>
        </FilterForm>
        {applied.length > 0 && (
          <div className="applied">
            {applied.map(([label, value, key]) => <Link key={key} className="ac" href={href("/users", params, { [key]: key === "shop" ? "all" : null, page: 1 })} aria-label={`Remove ${label} filter`}>{label}: {value} ×</Link>)}
            <Link className="ac" href="/users?shop=all" style={{ background: "none", textDecoration: "underline" }}>Clear all</Link>
          </div>
        )}
        <div className="rt" style={{ ["--cols" as string]: "minmax(230px,2.2fr) minmax(110px,1fr) minmax(110px,1fr) minmax(150px,1.3fr) minmax(120px,1fr) 44px", ["--cols-md" as string]: "minmax(0,2fr) minmax(0,1.2fr) minmax(0,1.2fr) 44px" }}>
          <div className="tr th"><span>User</span><span className="c-hide c-hide-md">Role</span><span className="c-hide">Shop</span><span className="c-hide c-hide-md">Last sign-in</span><span className="c-hide">Status</span><span /></div>
          {data.items.length === 0 && <p className="mut" style={{ padding: 24, margin: 0 }}>No users match. Clear a filter to see more.</p>}
          {data.items.map((u) => (
            <div key={u.id} className="tr">
              <div className="c-main"><div className="av">{initials(u.name)}<i className={`sd${u.status === "active" ? "" : " off"}`} /></div><div className="two"><b>{u.name}</b><small>{u.email}</small></div></div>
              <span className="c-hide c-hide-md"><span className={`badge ${u.role === "owner" ? "" : "gray"}`}>{ROLE_LABELS[u.role]}</span></span>
              <span className="c-hide">{u.role === "owner" ? "All shops" : (u.shopName ?? "None")}</span>
              <div className="two c-hide c-hide-md">{u.lastSignInAt ? <><span>{formatDate(u.lastSignInAt)}</span><small>{formatTime(u.lastSignInAt)} WAT</small></> : <span className="faint">Never</span>}</div>
              <span className={`st ${STATUS_TONE[u.status]} c-hide`}>{STATUS_LABEL[u.status]}</span>
              <Link className="ib c-act" href={`/users/${u.id}`} aria-label={`Manage ${u.name}`}><CaretRight className="i s" aria-hidden /></Link>
              <div className="c-line">{ROLE_LABELS[u.role]} · {u.role === "owner" ? "All shops" : (u.shopName ?? "No shop")}<br />{u.status !== "active" ? STATUS_LABEL[u.status] + " · " : ""}{u.lastSignInAt ? `Last sign-in ${formatDate(u.lastSignInAt)}, ${formatTime(u.lastSignInAt)}` : "Has not signed in yet"}</div>
            </div>
          ))}
        </div>
        <Pagination data={data} path="/users" params={params} noun="users" />
      </section>
      <p className="sm faint" style={{ margin: 0 }}>Turning off a user signs them out within 1 minute. Their past work stays in the records. Times are Lagos time (WAT).</p>
    </>
  );
}
