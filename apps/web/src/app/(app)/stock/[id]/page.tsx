import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle, DeviceMobile, Flag, Lock, PencilSimple, Tag } from "@phosphor-icons/react/dist/ssr";
import { DEVICE_CONDITION_LABELS, DEVICE_STATUS_LABELS, FLAG_OUTCOMES, FLAG_OUTCOME_LABELS, FLAG_TYPES, FLAG_TYPE_LABELS, MAX_DEVICE_PHOTOS, PROOF_LABELS, formatDateTimeZone } from "@dscims/shared";
import type { DeviceDto } from "@dscims/shared";
import { ActionForm, Field, SelectField, SubmitButton } from "@/components/form";
import { FileThumb } from "@/components/upload";
import { PhotoAdder } from "@/components/photo-adder";
import { ApiError, api } from "@/lib/api";
import { naira } from "@/lib/format";
import { one } from "@/lib/href";
import type { SearchParams } from "@/lib/href";
import { requireMe } from "@/lib/session";
import { STATUS_TONE } from "@/lib/stock";
import { approveProof, flagDevice, resolveFlag } from "../actions";

export const metadata = { title: "Phone" };

const EVENT_ICON: Record<string, { tone: string; Icon: typeof Tag }> = {
  received: { tone: "ok", Icon: DeviceMobile }, proof: { tone: "", Icon: CheckCircle }, under_review: { tone: "warn", Icon: Lock }, proof_approved: { tone: "ok", Icon: CheckCircle },
  edited: { tone: "", Icon: PencilSimple }, price_set: { tone: "", Icon: Tag }, photo_added: { tone: "", Icon: DeviceMobile }, flagged: { tone: "bad", Icon: Flag }, flag_resolved: { tone: "ok", Icon: CheckCircle },
};

export default async function DevicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const me = await requireMe();
  const { id } = await params;
  const sp = await searchParams;
  let d: DeviceDto;
  try {
    d = await api<DeviceDto>(`/devices/${id}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  const role = me.user.role;
  const canCost = role !== "staff";
  const owner = role === "owner";
  const canEdit = canCost;
  const open = d.openFlag;
  const waiting = d.status === "under_review" && d.proofApproved === false;

  return (
    <>
      <div className="pghead">
        <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
          <Link href="/stock" className="ib o" aria-label="Back to stock"><ArrowLeft className="i" aria-hidden /></Link>
          <div>
            <h1>{d.brand} {d.model}{d.storage ? ` ${d.storage}` : ""}</h1>
            <div className="imei" style={{ marginTop: 4 }}>IMEI {d.imei}</div>
          </div>
          <span className={`badge ${STATUS_TONE[d.status] === "off" ? "gray" : STATUS_TONE[d.status]}`}>{DEVICE_STATUS_LABELS[d.status]}</span>
        </div>
        <div className="row wrapf">
          {canEdit && d.status !== "written_off" && <Link href={`/stock/${d.id}/edit`} className="btn g"><PencilSimple className="i s" aria-hidden /> Edit</Link>}
          <span className="btn p" aria-disabled="true" title="Selling arrives in the next phase"><Tag className="i s" aria-hidden /> Sell (next phase)</span>
        </div>
      </div>

      {one(sp.saved) && <div className="ban ok" role="status">Changes saved.</div>}
      {open && (
        <div className="ban warn" role="status" style={{ borderRadius: 12, background: "var(--badbg)", color: "var(--bad)" }}>
          <Flag className="i" aria-hidden />
          <span><b>Flagged: {FLAG_TYPE_LABELS[open.type]}.</b> {open.reference ? `Ref ${open.reference}. ` : ""}{open.note} Raised by {open.raisedByName}, {formatDateTimeZone(open.raisedAt)}. This phone cannot be sold until the owner clears it.</span>
        </div>
      )}
      {waiting && (
        <div className="ban warn" role="status" style={{ borderRadius: 12 }}>
          <Lock className="i" aria-hidden />
          <span>Held under review: the proof is a {d.proofType ? PROOF_LABELS[d.proofType].toLowerCase() : "document"}, which the owner approves before this phone can be sold.</span>
          {owner && <form action={approveProof} style={{ marginLeft: "auto" }}><input type="hidden" name="id" value={d.id} /><button type="submit" className="btn sm p">Approve proof</button></form>}
        </div>
      )}

      <div className="fx">
        <section className="panel a" style={{ gap: 18 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Details</h2>
          <dl className="kv">
            <dt>Colour</dt><dd>{d.colour ?? "Not set"}</dd>
            <dt>Condition</dt><dd>{DEVICE_CONDITION_LABELS[d.condition]}</dd>
            <dt>Shop</dt><dd>{d.shopName}</dd>
            <dt>Selling price</dt><dd>{naira(d.sellingKobo)}</dd>
            {canCost && d.costKobo !== undefined && <><dt>Cost price</dt><dd>{naira(d.costKobo)} <span className="lock" style={{ marginLeft: 6 }}><Lock className="i s" aria-hidden />Owner and managers</span></dd></>}
            {canCost && d.costKobo !== undefined && <><dt>Margin if sold</dt><dd>{naira(d.sellingKobo - d.costKobo)}</dd></>}
            <dt>In stock since</dt><dd>{formatDateTimeZone(d.receivedAt)}</dd>
          </dl>
          <div>
            <div className="up" style={{ marginBottom: 8 }}>Photos</div>
            <div className="row wrapf" style={{ gap: 10 }}>
              {d.photos.map((p) => <a key={p.id} href={`/api/files/${p.id}`} target="_blank" rel="noreferrer" aria-label={`Open ${p.filename}`}><FileThumb file={p} size={88} /></a>)}
              {d.photos.length === 0 && <span className="mut sm">No photos yet.</span>}
              {canEdit && d.photos.length < MAX_DEVICE_PHOTOS && <PhotoAdder deviceId={d.id} />}
            </div>
          </div>
        </section>

        {canCost && (
          <section className="panel c" style={{ gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Seller and proof</h2>
            {d.sellerId ? (
              <>
                <div className="row"><div className="av">{(d.sellerName ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("")}</div><div className="grow"><Link href={`/sellers/${d.sellerId}`} className="b" style={{ color: "var(--navy)" }}>{d.sellerName}</Link><div className="sm mut">Purchase {d.purchaseNumber}</div></div></div>
                <div className="sep" />
                <div className="two"><b>{d.proofType ? PROOF_LABELS[d.proofType] : "No proof recorded"}</b>{d.proofReference && <small>Ref {d.proofReference}{d.proofAuthority ? `, ${d.proofAuthority}` : ""}</small>}{d.proofNote && <small>{d.proofNote}</small>}</div>
                {d.proofFileId && <a className="btn sm g" href={`/api/files/${d.proofFileId}`} target="_blank" rel="noreferrer">View the proof document</a>}
                <span className={`badge ${d.proofApproved ? "ok" : "warn"}`} style={{ alignSelf: "flex-start" }}>{d.proofApproved ? "Proof accepted" : "Waiting for the owner"}</span>
              </>
            ) : <p className="mut" style={{ margin: 0 }}>This phone was not bought from a seller.</p>}
          </section>
        )}
      </div>

      {d.status !== "written_off" && (
        <section className="panel" style={{ gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Flag or clear</h2>
          {d.status !== "flagged" ? (
            <details className="fold">
              <summary><Flag className="i s" aria-hidden /> Flag this phone</summary>
              <div className="body">
                <p className="mut sm" style={{ margin: 0 }}>A flagged phone cannot be sold until the owner clears it. It is saved in the phone&apos;s history and the audit log.</p>
                <ActionForm action={flagDevice}>
                  <input type="hidden" name="id" value={d.id} />
                  <SelectField name="type" label="Why are you flagging it?" options={FLAG_TYPES.map((t) => ({ value: t, label: FLAG_TYPE_LABELS[t] }))} />
                  <Field name="reference" label="Reference number (optional)" hint="For example a police report number." />
                  <Field name="note" label="Note for the record" rows={2} hint="What did you see or hear?" />
                  <SubmitButton className="btn d" pendingText="Flagging...">Flag phone</SubmitButton>
                </ActionForm>
              </div>
            </details>
          ) : owner ? (
            <details className="fold" open>
              <summary><CheckCircle className="i s" aria-hidden /> Resolve the flag</summary>
              <div className="body">
                <ActionForm action={resolveFlag}>
                  <input type="hidden" name="id" value={d.id} />
                  <SelectField name="outcome" label="Outcome" options={FLAG_OUTCOMES.map((o) => ({ value: o, label: FLAG_OUTCOME_LABELS[o] }))} />
                  <Field name="note" label="Resolution note" rows={2} hint="Required. It stays in the phone's history permanently." />
                  <SubmitButton className="btn p" pendingText="Saving...">Resolve flag</SubmitButton>
                </ActionForm>
              </div>
            </details>
          ) : <p className="mut" style={{ margin: 0 }}>Only the owner can clear a flag.</p>}
        </section>
      )}

      <section className="panel" style={{ gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>History</h2>
        <div className="tl">
          {d.events.map((e) => {
            const { tone, Icon } = EVENT_ICON[e.type] ?? { tone: "", Icon: Tag };
            return (
              <div key={e.id} className="ev">
                <span className={`dx ${tone}`}><Icon className="i" aria-hidden /></span>
                <div className="grow"><div className="b">{e.title}</div>{e.detail && <div className="sm mut">{e.detail}</div>}<div className="sm faint">{e.actorName} · {formatDateTimeZone(e.createdAt)}</div></div>
              </div>
            );
          })}
        </div>
        <p className="sm mut" style={{ margin: 0 }}>History cannot be edited or deleted.</p>
      </section>
    </>
  );
}
