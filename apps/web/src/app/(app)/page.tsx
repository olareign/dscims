import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Lock, Package, Plus, Storefront, Tag, UsersThree, Warning, SignIn } from "@phosphor-icons/react/dist/ssr";
import { AUDIT_CATEGORY_LABELS, formatDateTime } from "@dscims/shared";
import type { OverviewDto } from "@dscims/shared";
import { api } from "@/lib/api";
import { dayLabel, firstName, greeting, longDate } from "@/lib/greeting";
import { requireMe } from "@/lib/session";

export const metadata = { title: "Overview" };

const CATEGORY_TONE = { sign_in: "ok", security: "warn", user: "", settings: "gray" } as const;

export default async function OverviewPage() {
  const me = await requireMe();
  const name = firstName(me.user.name);

  if (me.user.role !== "owner") return <RoleHome name={name} role={me.user.role} />;
  if (!me.settings.onboarded) redirect("/setup");

  const o = await api<OverviewDto>("/dashboard/overview");
  const max = Math.max(1, ...o.signInsByDay.map((d) => d.count));
  const teamTotal = Math.max(1, o.roles.owner + o.roles.manager + o.roles.staff);
  const today = o.signInsByDay.at(-1)?.date;
  return (
    <>
      <div className="pghead">
        <div>
          <div className="sm faint">{longDate()} · All times are Lagos time (WAT)</div>
          <h1>{greeting()}, {name}</h1>
          <p className="mut" style={{ margin: "6px 0 0" }}>Here is what is happening at {me.tenant.name}.</p>
        </div>
        <div className="row wrapf">
          <Link href="/shops/new" className="btn g"><Storefront className="i s" aria-hidden /> Add shop</Link>
          <Link href="/users/new" className="btn p"><Plus className="i s" aria-hidden /> Add user</Link>
        </div>
      </div>

      <div className="kpis">
        <Link href="/users" className="crd kpi"><div className="row"><div className="ico"><UsersThree className="i" aria-hidden /></div><span className="up">Users</span></div><div className="num">{o.users.total}</div><div className="sm faint">{o.users.addedThisMonth} added this month</div></Link>
        <Link href="/users?lastSignIn=today" className="crd kpi"><div className="row"><div className="ico t"><SignIn className="i" aria-hidden /></div><span className="up">Signed in today</span></div><div className="num">{o.signedInToday}</div><div className="sm faint">of {o.users.active} active users</div></Link>
        <Link href="/shops" className="crd kpi"><div className="row"><div className="ico"><Storefront className="i" aria-hidden /></div><span className="up">Shops</span></div><div className="num">{o.shops.length}</div><div className="sm faint">{o.shops.map((s) => s.name).join(", ")}</div></Link>
        <Link href="/audit?category=security" className="crd kpi"><div className="row"><div className="ico w"><Warning className="i" aria-hidden /></div><span className="up">Failed sign-ins</span></div><div className="num">{o.failedSignIns24h}</div><div className="sm b">Last 24 hours</div></Link>
      </div>

      <div className="fx">
        <section className="crd a" aria-labelledby="chart-h">
          <div className="ch"><div><h2 id="chart-h">Sign-ins, last 7 days</h2><div className="sm faint">{dayLabel(o.signInsByDay[0].date)} to {dayLabel(o.signInsByDay.at(-1)!.date)}</div></div></div>
          <div className="bars" role="img" aria-label={`Sign-ins per day: ${o.signInsByDay.map((d) => d.count).join(", ")}`}>
            {o.signInsByDay.map((d) => (
              <div key={d.date}><span>{d.count}</span><i className={d.date === today ? "" : "l"} style={{ height: `${Math.round((d.count / max) * 112)}px` }} /><span>{dayLabel(d.date)}</span></div>
            ))}
          </div>
          <div className="sm faint" style={{ padding: "6px 20px 18px" }}>Today is shown in dark blue.</div>
        </section>
        <section className="crd c">
          <div className="ch"><h2>Team by role</h2><Link href="/users" className="b" style={{ color: "var(--navy)", fontSize: 14, textDecoration: "none" }}>Manage</Link></div>
          <div style={{ padding: "18px 20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="num">{o.users.total} <span className="sm faint" style={{ fontWeight: 500 }}>users</span></div>
            <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", gap: 3 }} aria-hidden>
              <i style={{ width: `${(o.roles.owner / teamTotal) * 100}%`, background: "#0D1B4C" }} /><i style={{ width: `${(o.roles.manager / teamTotal) * 100}%`, background: "#4F6FD8" }} /><i style={{ width: `${(o.roles.staff / teamTotal) * 100}%`, background: "#B9C6F0" }} />
            </div>
            {[["Owner", o.roles.owner, "#0D1B4C"], ["Manager", o.roles.manager, "#4F6FD8"], ["Sales staff", o.roles.staff, "#B9C6F0"]].map(([label, n, color]) => (
              <div key={label as string} className="row"><i style={{ width: 10, height: 10, borderRadius: 3, background: color as string }} aria-hidden /><span className="grow">{label}</span><b>{n}</b></div>
            ))}
          </div>
        </section>
      </div>

      <div className="fx">
        <section className="crd a">
          <div className="ch" style={{ paddingBottom: 6 }}><h2>Recent activity</h2><Link href="/audit" className="b" style={{ color: "var(--navy)", fontSize: 14, textDecoration: "none" }}>View audit log</Link></div>
          <div style={{ padding: "6px 20px 10px" }}>
            {o.recent.map((a) => (
              <div key={a.id} className="row wrapf" style={{ padding: "13px 0", borderTop: "1px solid var(--line)" }}>
                <span className={`badge ${CATEGORY_TONE[a.category]}`} style={{ minWidth: 74, justifyContent: "center" }}>{AUDIT_CATEGORY_LABELS[a.category]}</span>
                <div className="grow" style={{ minWidth: 180 }}><b>{a.actorName}</b> {a.message}</div>
                <span className="sm faint">{formatDateTime(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="crd c">
          <div className="ch"><h2>Shops</h2><Link href="/shops/new" className="b" style={{ color: "var(--navy)", fontSize: 14, textDecoration: "none" }}>Add shop</Link></div>
          <div style={{ padding: "14px 20px 6px" }}>
            {o.shops.map((s, i) => (
              <div key={s.id} className="row" style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                <span className="tile" style={{ width: 40, height: 40 }}><Storefront className="i s" aria-hidden /></span>
                <div className="grow"><div className="b">{s.name}</div><div className="sm faint" style={{ overflowWrap: "anywhere" }}>{s.address || "Address not set"}</div></div>
                <span className="badge">{s.userCount} users</span>
              </div>
            ))}
          </div>
          <div className="sep" style={{ margin: "10px 20px 0" }} />
          <div style={{ padding: "14px 20px 20px" }}><div className="up" style={{ marginBottom: 10 }}>Arriving next</div><div className="chips"><span className="badge gray">Stock</span><span className="badge gray">Sell</span><span className="badge gray">Owing</span><span className="badge gray">Reports</span></div></div>
        </section>
      </div>
    </>
  );
}

function RoleHome({ name, role }: { name: string; role: "manager" | "staff" | "owner" }) {
  const can = [
    { ok: true, text: "Look up devices" },
    { ok: true, text: "Record cash, transfer and POS sales" },
    { ok: true, text: "Flag a device or seller" },
    { ok: false, text: "Credit sales and new devices need a manager's OK" },
  ];
  return (
    <>
      <div><div className="sm faint">{longDate()}</div><h1 className="h1">{greeting()}, {name}</h1></div>
      <div className="card" style={{ maxWidth: 640 }}>
        <p className="b" style={{ margin: "0 0 4px", fontSize: 17 }}>What you can do</p>
        {(role === "staff" ? can : can.slice(0, 3)).map((c) => (
          <div key={c.text} className="item" style={{ minHeight: 48 }}>{c.ok ? <Check className="i" style={{ color: "var(--ok)" }} aria-hidden /> : <Lock className="i" style={{ color: "var(--warn)" }} aria-hidden />}<span className="grow">{c.text}</span></div>
        ))}
      </div>
      <p className="sm mut" style={{ margin: 0 }}>Cost prices, profit, users and the audit log are only for the owner.</p>
      <div className="soon" style={{ maxWidth: 640 }}><Tag className="i" aria-hidden /><div className="grow"><div className="b">Sell a device</div><div className="sm">Arrives with the next update</div></div><span className="badge gray">Soon</span></div>
      <div className="soon" style={{ maxWidth: 640 }}><Package className="i" aria-hidden /><div className="grow"><div className="b">Stock</div><div className="sm">Arrives with the next update</div></div><span className="badge gray">Soon</span></div>
    </>
  );
}
