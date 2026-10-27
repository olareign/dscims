import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle, FilePdf, Lock } from "@phosphor-icons/react/dist/ssr";
import { DEVICE_STATUS_LABELS, PAYMENT_METHOD_LABELS, formatDateTimeZone } from "@dscims/shared";
import type { PurchaseDto } from "@dscims/shared";
import { ApiError, api } from "@/lib/api";
import { naira } from "@/lib/format";
import { requireBuyer } from "@/lib/session";

export const metadata = { title: "Purchase recorded" };

export default async function PurchaseDonePage({ params }: { params: Promise<{ id: string }> }) {
  await requireBuyer();
  const { id } = await params;
  let p: PurchaseDto;
  try {
    p = await api<PurchaseDto>(`/purchases/${id}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  const held = p.devices.filter((d) => d.status === "under_review");
  return (
    <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center", paddingTop: 16 }}>
        <span className="pic ok" style={{ width: 72, height: 72, borderRadius: "50%" }}><CheckCircle className="i" style={{ width: 36, height: 36 }} weight="bold" aria-hidden /></span>
        <h1 className="h1">Purchase recorded</h1>
        <p className="mut" style={{ margin: 0 }}>{p.devices.length} phone{p.devices.length === 1 ? " is" : "s are"} now in {p.shopName}{held.length ? `, ${held.length} held for the owner to approve the proof` : ""}.</p>
      </div>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="row"><span className="up grow">Purchase receipt</span><span className="badge">{p.number}</span></div>
        <div className="sep" style={{ margin: "8px 0" }} />
        <div className="tot"><span className="mut">Seller</span><b>{p.sellerName}</b></div>
        <div className="tot"><span className="mut">Payment</span><b>{PAYMENT_METHOD_LABELS[p.paymentMethod]}, {naira(p.paidKobo)} paid</b></div>
        <div className="tot"><span className="mut">Recorded by</span><b>{p.recordedByName}</b></div>
        <div className="tot"><span className="mut">When</span><b>{formatDateTimeZone(p.createdAt)}</b></div>
        <div className="sep" style={{ margin: "8px 0" }} />
        {p.devices.map((d) => (
          <Link key={d.id} href={`/stock/${d.id}`} className="dev-row" style={{ borderTop: 0, padding: "6px 0" }}>
            <div className="grow"><div className="b">{d.brand} {d.model}{d.storage ? ` ${d.storage}` : ""}</div><div className="imei">{d.imei}</div></div>
            <div style={{ textAlign: "right" }}><b>{naira(d.costKobo)}</b><div className="sm mut">{DEVICE_STATUS_LABELS[d.status]}</div></div>
          </Link>
        ))}
        <div className="tot big"><span>Total</span><span>{naira(p.totalKobo)}</span></div>
      </section>
      <span className="lock"><Lock className="i s" aria-hidden />Seller&apos;s declaration saved: {p.declaredBy}, {formatDateTimeZone(p.declaredAt)}.</span>
      <a className="btn g" href={`/api/purchases/${p.id}/receipt`} target="_blank" rel="noreferrer"><FilePdf className="i s" aria-hidden /> Save the receipt as PDF</a>
      <Link href={`/stock/${p.devices[0]!.id}`} className="btn p">{p.devices.length === 1 ? "View the phone" : "View the first phone"}</Link>
      <Link href="/stock/buy" className="btn g">Buy another</Link>
      <Link href="/stock" className="btn" style={{ borderColor: "transparent" }}>Back to stock</Link>
    </div>
  );
}
