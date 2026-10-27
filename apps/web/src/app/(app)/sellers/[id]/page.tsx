import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "@phosphor-icons/react/dist/ssr";
import { DEVICE_STATUS_LABELS, formatDateTimeZone } from "@dscims/shared";
import type { SellerDetailDto } from "@dscims/shared";
import { ApiError, api } from "@/lib/api";
import { naira } from "@/lib/format";
import { one } from "@/lib/href";
import type { SearchParams } from "@/lib/href";
import { requireBuyer } from "@/lib/session";
import { STATUS_TONE } from "@/lib/stock";

export const metadata = { title: "Seller" };

export default async function SellerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireBuyer();
  const { id } = await params;
  const sp = await searchParams;
  let s: SellerDetailDto;
  try {
    s = await api<SellerDetailDto>(`/sellers/${id}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  return (
    <>
      <div className="pghead">
        <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
          <Link href="/sellers" className="ib o" aria-label="Back to sellers"><ArrowLeft className="i" aria-hidden /></Link>
          <div><h1>{s.name}</h1><p className="mut" style={{ margin: "6px 0 0" }}>{s.phone} · {s.address}</p></div>
        </div>
        <Link href={`/stock/buy?seller=${s.id}`} className="btn p">Buy phones from {s.name.split(" ")[0]}</Link>
      </div>
      {one(sp.added) && <div className="ban ok" role="status">The seller was registered.</div>}
      <div className="fx">
        <section className="panel a">
          <h2 style={{ margin: 0, fontSize: 16 }}>Phones bought from this seller</h2>
          <div className="row wrapf" style={{ gap: 24 }}>
            <div><div className="sm mut">Phones</div><div className="b" style={{ fontSize: 20 }}>{s.deviceCount}</div></div>
            <div><div className="sm mut">Total paid</div><div className="b" style={{ fontSize: 20 }}>{naira(s.totalKobo)}</div></div>
            <div><div className="sm mut">Flagged</div><div className="b" style={{ fontSize: 20, color: s.flaggedCount ? "var(--bad)" : undefined }}>{s.flaggedCount}</div></div>
          </div>
          {s.devices.length === 0 && <p className="mut" style={{ margin: 0 }}>No purchases yet.</p>}
          {s.devices.map((d) => (
            <Link key={d.id} href={`/stock/${d.id}`} className="dev-row">
              <div className="grow"><div className="b">{d.brand} {d.model}</div><div className="imei">{d.imei}</div><div className="sm mut">{d.purchaseNumber} · {formatDateTimeZone(d.receivedAt)}</div></div>
              <div style={{ textAlign: "right" }}><div className="b">{naira(d.costKobo)}</div><span className={`st ${STATUS_TONE[d.status]}`}>{DEVICE_STATUS_LABELS[d.status]}</span></div>
            </Link>
          ))}
        </section>
        <section className="panel c">
          <h2 style={{ margin: 0, fontSize: 16 }}>Identity</h2>
          <dl className="kv" style={{ gridTemplateColumns: "90px 1fr" }}>
            <dt>NIN</dt><dd>{s.ninLast4 ? `•••••••${s.ninLast4}` : "Not given"}</dd>
            <dt>BVN</dt><dd>{s.bvnLast4 ? `•••••••${s.bvnLast4}` : "Not given"}</dd>
          </dl>
          {s.idFileId ? <a className="btn sm g" href={`/api/files/${s.idFileId}`} target="_blank" rel="noreferrer">View ID photo</a> : <span className="badge warn" style={{ alignSelf: "flex-start" }}>No ID photo yet</span>}
          <span className="lock"><Lock className="i s" aria-hidden />NIN and BVN are encrypted. They are not verified with a provider yet.</span>
        </section>
      </div>
    </>
  );
}
