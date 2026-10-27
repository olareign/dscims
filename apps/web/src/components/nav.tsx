"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChartBar, House, List, Package, ShieldCheck, SlidersHorizontal, SquaresFour, Storefront, Tag, UsersThree, Wallet } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

const ICONS: Record<string, Icon> = { overview: SquaresFour, home: House, stock: Package, sell: Tag, owing: Wallet, reports: ChartBar, users: UsersThree, shops: Storefront, audit: ShieldCheck, rules: SlidersHorizontal, more: List, bell: Bell };

export interface NavItem {
  icon: keyof typeof ICONS;
  label: string;
  href: string;
  /** Arrives in a later phase: shown, not clickable. */
  soon?: boolean;
}

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const Glyph = ICONS[item.icon];
        const active = !item.soon && isActive(pathname, item.href);
        return (
          <Link key={item.label} href={item.soon ? "#" : item.href} className={active ? "on" : item.soon ? "off" : ""} aria-current={active ? "page" : undefined} aria-disabled={item.soon || undefined} tabIndex={item.soon ? -1 : undefined} title={item.soon ? `${item.label} arrives soon` : item.label}>
            <Glyph className="i" aria-hidden />
            <span className="lb">{item.label}</span>
            {item.soon && <span className="pill">Soon</span>}
          </Link>
        );
      })}
    </>
  );
}

export function TabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const moreRoutes = ["/more", "/users", "/shops", "/audit", "/settings"];
  return (
    <nav className="tabs" aria-label="Main">
      {items.map((item) => {
        const Glyph = ICONS[item.icon];
        const active = !item.soon && (item.icon === "more" ? moreRoutes.some((r) => isActive(pathname, r)) : isActive(pathname, item.href));
        return (
          <Link key={item.label} href={item.soon ? "#" : item.href} className={`tab${active ? " on" : ""}${item.soon ? " off" : ""}`} aria-current={active ? "page" : undefined} aria-disabled={item.soon || undefined} tabIndex={item.soon ? -1 : undefined}>
            <Glyph className="i" weight={active ? "fill" : "regular"} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

const CRUMBS: [string, string, string][] = [
  ["/users", "Admin", "Users"], ["/shops", "Admin", "Shops"], ["/audit", "Admin", "Audit log"], ["/settings", "Admin", "Sales rules"], ["/more", "Account", "More"],
];

export function Crumb() {
  const pathname = usePathname();
  const found = CRUMBS.find(([p]) => isActive(pathname, p));
  return (
    <div className="crumb">
      {found ? <>{found[1]} <span aria-hidden>/</span> <b>{found[2]}</b></> : <>Workspace <span aria-hidden>/</span> <b>Overview</b></>}
    </div>
  );
}
