import Link from "next/link";
import { CaretRight, ShieldCheck, SignOut, SlidersHorizontal, Storefront, UserCircle, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { ROLE_LABELS } from "@dscims/shared";
import { InstallApp } from "@/components/install-app";
import { requireMe } from "@/lib/session";
import { signOut } from "../actions";

export const metadata = { title: "More" };

export default async function MorePage() {
  const me = await requireMe();
  const owner = me.user.role === "owner";
  const rows = [
    { href: "/users", label: "Users", Icon: UsersThree },
    { href: "/shops", label: "Shops", Icon: Storefront },
    { href: "/audit", label: "Audit log", Icon: ShieldCheck },
    { href: "/settings", label: "Sales rules and receipt", Icon: SlidersHorizontal },
  ];
  return (
    <>
      <h1 className="h1">More</h1>
      <div className="card s row">
        <div className="av">{me.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
        <div className="grow"><div className="b">{me.user.name}</div><div className="sm mut" style={{ overflowWrap: "anywhere" }}>{me.user.email}</div></div>
        <span className="badge">{ROLE_LABELS[me.user.role]}</span>
      </div>
      {owner && (
        <>
          <p className="up" style={{ margin: "6px 0 0" }}>Run your business</p>
          <div>
            {rows.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className="item"><Icon className="i" aria-hidden /><span className="grow b">{label}</span><CaretRight className="i s" aria-hidden /></Link>
            ))}
          </div>
        </>
      )}
      <p className="up" style={{ margin: "6px 0 0" }}>This device</p>
      <div className="row wrapf" style={{ gap: 10 }}>
        <Link href="/account" className="btn g"><UserCircle className="i s" aria-hidden /> Your account</Link>
        <InstallApp className="btn g" />
        <form action={signOut}><button type="submit" className="btn d"><SignOut className="i s" aria-hidden /> Sign out</button></form>
      </div>
      {!owner && <p className="sm mut">Users, shops, the audit log and cost prices are only for the owner.</p>}
    </>
  );
}
