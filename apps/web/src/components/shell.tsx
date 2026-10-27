import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, CaretUpDown, SignOut, Storefront } from "@phosphor-icons/react/dist/ssr";
import { ROLE_LABELS } from "@dscims/shared";
import type { MeDto } from "@dscims/shared";
import { signOut } from "@/app/(app)/actions";
import { InstallApp } from "./install-app";
import { Crumb, SideNav, TabBar } from "./nav";
import type { NavItem } from "./nav";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

export function Shell({ me, shopLabel, children }: { me: MeDto; shopLabel: string; children: ReactNode }) {
  const owner = me.user.role === "owner";
  const workspace: NavItem[] = [
    { icon: "overview", label: "Overview", href: "/" },
    { icon: "stock", label: "Stock", href: "/stock", soon: true },
    { icon: "sell", label: "Sell", href: "/sell", soon: true },
    { icon: "owing", label: "Owing", href: "/owing", soon: true },
    ...(owner ? [{ icon: "reports", label: "Reports", href: "/reports", soon: true } as NavItem] : []),
  ];
  const admin: NavItem[] = owner
    ? [
        { icon: "users", label: "Users", href: "/users" },
        { icon: "shops", label: "Shops", href: "/shops" },
        { icon: "audit", label: "Audit log", href: "/audit" },
        { icon: "rules", label: "Sales rules", href: "/settings" },
      ]
    : [];
  const tabs: NavItem[] = [
    { icon: "home", label: "Home", href: "/" },
    { icon: "stock", label: "Stock", href: "/stock", soon: true },
    { icon: "sell", label: "Sell", href: "/sell", soon: true },
    { icon: "owing", label: "Owing", href: "/owing", soon: true },
    { icon: "more", label: "More", href: "/more" },
  ];
  const canSwitch = owner && me.shops.length > 1;
  const pill = (
    <>
      <span className="tile"><Storefront className="i s" aria-hidden /></span>
      <span className="t"><small>{me.tenant.name}</small>{shopLabel}</span>
      {canSwitch && <CaretUpDown className="i s" style={{ color: "var(--faint)" }} aria-hidden />}
    </>
  );

  return (
    <div className="shell">
      <aside className="sb" aria-label="Sidebar">
        <Link href="/" className="logo" aria-label="d-scims home"><b>d</b><span>d-scims</span></Link>
        <div className="org">
          <div className="av sm" style={{ background: "#fff" }} aria-hidden>{initials(me.tenant.name)}</div>
          <div className="grow"><div className="b" style={{ lineHeight: 1.2 }}>{me.tenant.name}</div><div className="sm" style={{ color: "#98A8DE" }}>{ROLE_LABELS[me.user.role]}</div></div>
        </div>
        <div className="grp">Workspace</div>
        <SideNav items={workspace} />
        {admin.length > 0 && <><div className="grp">Admin</div><SideNav items={admin} /></>}
        <div className="foot">
          <div className="b" style={{ color: "#fff", marginBottom: 4 }}>Works on weak connections</div>
          Install d-scims on this device to open it like an app.
          <div style={{ marginTop: 10 }}><InstallApp className="btn sm full" label="Install app" /></div>
        </div>
      </aside>
      <div className="wrap">
        <header className="tb">
          <Crumb />
          <div className="grow" />
          {canSwitch ? <Link href="/shops/switch" className="pill2" aria-label={`Switch shop, now ${shopLabel}`}>{pill}</Link> : <div className="pill2">{pill}</div>}
          {owner && <Link href="/audit?category=security" className="ib o" aria-label="Security activity"><Bell className="i" aria-hidden /></Link>}
          <details className="menu">
            <summary className="av" aria-label="Your account">{initials(me.user.name)}</summary>
            <div className="pop">
              <div style={{ padding: "8px 12px 10px" }}><div className="b">{me.user.name}</div><div className="sm mut" style={{ overflowWrap: "anywhere" }}>{me.user.email}</div><span className="badge" style={{ marginTop: 6 }}>{ROLE_LABELS[me.user.role]}</span></div>
              <div className="sep" style={{ margin: "4px 0" }} />
              <form action={signOut}><button type="submit"><SignOut className="i s" aria-hidden /> Sign out</button></form>
            </div>
          </details>
        </header>
        <main className="ct" id="main">{children}</main>
        <div style={{ flex: 1 }} />
        <TabBar items={tabs} />
      </div>
    </div>
  );
}
