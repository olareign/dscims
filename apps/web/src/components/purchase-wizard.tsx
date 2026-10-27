"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, DeviceMobile, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { DEVICE_CONDITIONS, DEVICE_CONDITION_LABELS, MAX_DEVICE_PHOTOS, MAX_PRICE_KOBO, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PROOF_LABELS, PROOF_OF_OWNERSHIP_TYPES, isValidImei, proofNeedsApproval } from "@dscims/shared";
import type { DeviceCondition, FileDto, ImeiCheckDto, Paginated, PaymentMethod, ProofOfOwnershipType, SellerDto } from "@dscims/shared";
import { submitPurchase } from "@/app/(app)/stock/buy/actions";
import type { PurchasePayload } from "@/app/(app)/stock/buy/actions";
import { naira, parseNaira } from "@/lib/format";
import { FileThumb, UploadButton } from "./upload";

interface DraftDevice {
  key: string;
  imei: string; brand: string; model: string; storage: string; colour: string; condition: DeviceCondition | "";
  cost: string; selling: string;
  proofType: ProofOfOwnershipType; proofNote: string; proofReference: string; proofAuthority: string; proof: FileDto | null;
  photos: FileDto[];
  check: ImeiCheckDto | null;
}

const blank = (key: string): DraftDevice => ({
  key, imei: "", brand: "", model: "", storage: "", colour: "", condition: "", cost: "", selling: "",
  proofType: "receipt", proofNote: "", proofReference: "", proofAuthority: "", proof: null, photos: [], check: null,
});

const STEPS = ["Seller", "Phones", "Proof", "Confirm"] as const;
type Errors = Record<string, string>;

export function PurchaseWizard({ shops, defaultShopId, chooseShop, initialSeller, role }: {
  shops: { id: string; name: string }[]; defaultShopId: string; chooseShop: boolean; initialSeller: SellerDto | null; role: "owner" | "manager";
}) {
  const [step, setStep] = useState(initialSeller ? 2 : 1);
  const [seller, setSeller] = useState<SellerDto | null>(initialSeller);
  const [shopId, setShopId] = useState(defaultShopId);
  // Keys count up (not random) so the server and the browser draw the same markup.
  const [devices, setDevices] = useState<DraftDevice[]>([blank("d0")]);
  const [nextKey, setNextKey] = useState(1);
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [paid, setPaid] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState(initialSeller?.name ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // One key for this purchase: a double tap or a retry on a weak connection records it once.
  const [idempotencyKey] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));

  const patch = (key: string, change: Partial<DraftDevice>) => setDevices((all) => all.map((d) => (d.key === key ? { ...d, ...change } : d)));
  const total = useMemo(() => devices.reduce((sum, d) => sum + (parseNaira(d.cost) ?? 0), 0), [devices]);

  function validate(which: number): Errors {
    const e: Errors = {};
    if (which === 1 && !seller) e.seller = "Choose who is selling, or register a new seller";
    if (which === 2) {
      const seen = new Set<string>();
      devices.forEach((d, i) => {
        const p = `devices.${i}`;
        if (!isValidImei(d.imei)) e[`${p}.imei`] = "Enter all 15 digits of the IMEI (dial *#06#)";
        else if (d.check?.exists) e[`${p}.imei`] = d.check.message ?? "This IMEI is already in stock";
        else if (seen.has(d.imei)) e[`${p}.imei`] = "The same IMEI is listed twice";
        seen.add(d.imei);
        if (d.brand.trim().length < 2) e[`${p}.brand`] = "Enter the brand";
        if (!d.model.trim()) e[`${p}.model`] = "Enter the model";
        if (!d.condition) e[`${p}.condition`] = "Choose the condition";
        const cost = parseNaira(d.cost);
        const selling = parseNaira(d.selling);
        if (!cost) e[`${p}.cost`] = "Enter the buying price in naira";
        else if (cost > MAX_PRICE_KOBO) e[`${p}.cost`] = "That amount is too large. Check the zeros";
        if (!selling) e[`${p}.selling`] = "Enter the selling price in naira";
        else if (selling > MAX_PRICE_KOBO) e[`${p}.selling`] = "That amount is too large. Check the zeros";
      });
    }
    if (which === 3) {
      devices.forEach((d, i) => {
        if (!proofNeedsApproval(d.proofType)) return;
        const p = `devices.${i}`;
        if (!d.proof) e[`${p}.proof`] = "Add a photo or scan of the document";
        if (!d.proofReference.trim()) e[`${p}.proofReference`] = "Enter the document or reference number";
        if (!d.proofAuthority.trim()) e[`${p}.proofAuthority`] = "Enter who issued it";
      });
    }
    if (which === 4) {
      if (!agreed) e.declaration = "The seller must confirm the declaration";
      if (signature.trim().length < 2) e.signature = "Type the seller's name as their signature";
      if (payment === "part") {
        const amount = parseNaira(paid);
        if (!amount || amount >= total) e.paid = "For a part payment, enter an amount less than the total";
      }
    }
    return e;
  }

  function go(next: number) {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length === 0) { setStep(next); window.scrollTo({ top: 0 }); }
  }

  function confirm() {
    // On desktop every section is on screen at once, so check all of them and point at the first problem.
    const all: Errors = { ...validate(1), ...validate(2), ...validate(3), ...validate(4) };
    setErrors(all);
    if (Object.keys(all).length) {
      const first = [1, 2, 3, 4].find((s) => Object.keys(validate(s)).length > 0)!;
      setStep(first);
      setFormError("Some details need another look. They are marked below.");
      return;
    }
    setFormError(null);
    const payload: PurchasePayload = {
      sellerId: seller!.id, shopId, paymentMethod: payment, paidKobo: payment === "part" ? (parseNaira(paid) ?? undefined) : undefined,
      declaration: true, declaredBy: signature.trim(),
      devices: devices.map((d) => ({
        imei: d.imei, brand: d.brand.trim(), model: d.model.trim(), storage: d.storage.trim(), colour: d.colour.trim(), condition: d.condition as DeviceCondition,
        costKobo: parseNaira(d.cost)!, sellingKobo: parseNaira(d.selling)!, proofType: d.proofType, proofNote: d.proofNote.trim(), proofReference: d.proofReference.trim(), proofAuthority: d.proofAuthority.trim(),
        proofFileId: d.proof?.id ?? null, photoFileIds: d.photos.map((p) => p.id),
      })),
    };
    startTransition(async () => {
      const result = await submitPurchase(payload, idempotencyKey);
      // On success the action redirects, so reaching here means something needs fixing.
      if (result?.fieldErrors) {
        setErrors(result.fieldErrors);
        const paths = Object.keys(result.fieldErrors);
        setStep(paths.some((p) => p === "sellerId") ? 1 : paths.some((p) => /proof/i.test(p)) ? 3 : paths.some((p) => p.startsWith("devices")) ? 2 : 4);
      }
      setFormError(result?.error ?? (result?.fieldErrors ? "Some details need another look. They are marked below." : null));
    });
  }

  const last = step === 4;
  const e = (path: string) => errors[path];

  return (
    <div className="wz">
      <div className="wz-main">
        <div className="wz-steps" aria-label={`Step ${step} of 4: ${STEPS[step - 1]}`}>
          <div className="steps">{STEPS.map((s, i) => <i key={s} className={i < step ? "on" : ""} />)}</div>
          <p className="sm mut" style={{ margin: "6px 0 0" }}>Step {step} of 4: {STEPS[step - 1]}</p>
        </div>
        {formError && <div role="alert" className="ban bad" style={{ borderRadius: 12 }}><WarningCircle className="i" aria-hidden /> <span>{formError}</span></div>}

        <section className={`wz-sec${step === 1 ? " cur" : ""}`} aria-label="Seller">
          <div><h2 className="h1" style={{ fontSize: 22 }}>Who is selling?</h2><p className="mut" style={{ margin: "4px 0 0" }}>Pick a seller you already know, or register a new one.</p></div>
          {chooseShop && (
            <div><label className="lbl" htmlFor="wz-shop">Buying for</label><select id="wz-shop" className="inp" value={shopId} onChange={(ev) => setShopId(ev.target.value)}>{shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          )}
          <SellerPicker seller={seller} onPick={setSeller} error={e("seller") ?? e("sellerId")} />
        </section>

        <section className={`wz-sec${step === 2 ? " cur" : ""}`} aria-label="Phones">
          {seller && <div className="mini"><span className="av sm">{seller.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("")}</span><div className="grow"><b>{seller.name}</b><div className="sm mut">{seller.phone}</div></div><button type="button" className="sm" style={{ color: "var(--navy)", fontWeight: 600, background: "none", border: 0, cursor: "pointer" }} onClick={() => setStep(1)}>Change</button></div>}
          <div><h2 className="h1" style={{ fontSize: 22 }}>What are you buying?</h2><p className="mut" style={{ margin: "4px 0 0" }}>Add each phone. The IMEI is checked as you type.</p></div>
          {devices.map((d, i) => (
            <DeviceCard key={d.key} d={d} index={i} canRemove={devices.length > 1} errors={errors} onChange={(c) => patch(d.key, c)} onRemove={() => setDevices((all) => all.filter((x) => x.key !== d.key))} />
          ))}
          <button type="button" className="btn g" onClick={() => { setDevices((all) => [...all, blank(`d${nextKey}`)]); setNextKey((n) => n + 1); }} disabled={devices.length >= 20}><Plus className="i s" aria-hidden /> Add another phone</button>
        </section>

        <section className={`wz-sec${step === 3 ? " cur" : ""}`} aria-label="Proof of ownership">
          <div><h2 className="h1" style={{ fontSize: 22 }}>Proof the seller owns it</h2><p className="mut" style={{ margin: "4px 0 0" }}>Pick what the seller showed you for each phone.</p></div>
          {devices.map((d, i) => <ProofCard key={d.key} d={d} index={i} errors={errors} role={role} onChange={(c) => patch(d.key, c)} />)}
          <div className="ban info" style={{ borderRadius: 12 }}><span>A certificate or police or government credentials are held for the owner to approve before the phone can be sold.</span></div>
        </section>

        <section className={`wz-sec${step === 4 ? " cur" : ""}`} aria-label="Declaration and payment">
          <div><h2 className="h1" style={{ fontSize: 22 }}>Check and confirm</h2></div>
          <div className="card">
            <div className="b" style={{ marginBottom: 8 }}>Seller&apos;s declaration</div>
            <label className="sw2"><input type="checkbox" checked={agreed} onChange={(ev) => setAgreed(ev.target.checked)} aria-invalid={!!e("declaration")} /><span>The seller declares they own {devices.length === 1 ? "this phone" : "these phones"}, {devices.length === 1 ? "it was" : "they were"} not stolen, and they are allowed to sell {devices.length === 1 ? "it" : "them"}.</span></label>
            {e("declaration") && <p className="err">{e("declaration")}</p>}
            <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="wz-sign">Seller&apos;s name as signature</label><input id="wz-sign" className="inp" value={signature} onChange={(ev) => setSignature(ev.target.value)} autoComplete="off" aria-invalid={!!e("signature")} />{e("signature") && <p className="err">{e("signature")}</p>}</div>
            <p className="sm faint" style={{ margin: "8px 0 0" }}>Saved with the date and time when you confirm.</p>
          </div>
          <div className="card">
            <div className="b" style={{ marginBottom: 8 }}>How are you paying?</div>
            <div className="seg">{PAYMENT_METHODS.map((m) => <label key={m}><input type="radio" name="payment" value={m} checked={payment === m} onChange={() => setPayment(m)} /><span>{PAYMENT_METHOD_LABELS[m]}</span></label>)}</div>
            {payment === "part" && <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="wz-paid">Paid now (₦)</label><input id="wz-paid" className="inp" inputMode="numeric" value={paid} onChange={(ev) => setPaid(ev.target.value)} aria-invalid={!!e("paid")} />{e("paid") && <p className="err">{e("paid")}</p>}</div>}
            <div className="tot big" style={{ marginTop: 12 }}><span>Total</span><span>{naira(total)}</span></div>
            <p className="sm mut" style={{ margin: "8px 0 0" }}>Buying prices are hidden from sales staff on every screen.</p>
          </div>
          <Review seller={seller} devices={devices} className="wz-review" />
        </section>
      </div>

      <aside className="wz-aside" aria-label="Summary">
        <h2 style={{ margin: 0, fontSize: 16 }}>Summary</h2>
        <Review seller={seller} devices={devices} />
        <div className="tot big"><span>Total to pay</span><span>{naira(total)}</span></div>
        <button type="button" className="btn p" onClick={confirm} disabled={pending}>{pending ? "Recording..." : "Confirm purchase"}</button>
        <Link href="/stock" className="btn g">Cancel</Link>
      </aside>

      <div className="wz-bar">
        {step === 1 ? <Link href="/stock" className="btn g">Cancel</Link> : <button type="button" className="btn g" onClick={() => { setErrors({}); setStep(step - 1); }}>Back</button>}
        {last
          ? <button type="button" className="btn p" onClick={confirm} disabled={pending}>{pending ? "Recording..." : "Confirm purchase"}</button>
          : <button type="button" className="btn p" onClick={() => go(step + 1)}>Continue</button>}
      </div>
    </div>
  );
}

function Review({ seller, devices, className }: { seller: SellerDto | null; devices: DraftDevice[]; className?: string }) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="row"><span className="av sm">{seller ? seller.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("") : "?"}</span><div className="grow"><b>{seller?.name ?? "No seller chosen"}</b><div className="sm mut">{devices.length} phone{devices.length === 1 ? "" : "s"}</div></div></div>
      {devices.map((d) => (
        <div key={d.key} className="tot" style={{ gap: 8 }}><span className="mut" style={{ minWidth: 0 }}>{d.brand || d.model ? `${d.brand} ${d.model}`.trim() : "New phone"}{d.imei ? <span className="imei" style={{ display: "block" }}>{d.imei}</span> : null}</span><b>{parseNaira(d.cost) ? naira(parseNaira(d.cost)!) : ""}</b></div>
      ))}
    </div>
  );
}

function SellerPicker({ seller, onPick, error }: { seller: SellerDto | null; onPick: (s: SellerDto) => void; error?: string }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SellerDto[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sellers?search=${encodeURIComponent(term)}`);
        if (!res.ok) throw new Error();
        setResults(((await res.json()) as Paginated<SellerDto>).items);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    }, term ? 300 : 0);
    return () => clearTimeout(t);
  }, [term]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div><label className="lbl" htmlFor="wz-seller-search">Find a seller</label><input id="wz-seller-search" type="search" className="inp" placeholder="Name or phone number" value={term} onChange={(ev) => setTerm(ev.target.value)} autoComplete="off" /></div>
      <div role="radiogroup" aria-label="Sellers" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {results.map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={seller?.id === s.id} className={`rad${seller?.id === s.id ? " on" : ""}`} onClick={() => onPick(s)}>
            <span className="av">{s.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("")}</span>
            <span className="grow"><span className="b" style={{ display: "block" }}>{s.name}</span><span className="sm mut">{s.phone} · {s.hasId ? "ID on file" : "No ID yet"}</span></span>
            {seller?.id === s.id && <Check className="i s" style={{ color: "var(--navy)" }} aria-hidden />}
          </button>
        ))}
        {seller && !results.some((s) => s.id === seller.id) && <div className="rad on"><span className="av">{seller.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("")}</span><span className="grow"><span className="b" style={{ display: "block" }}>{seller.name}</span><span className="sm mut">{seller.phone}</span></span><Check className="i s" aria-hidden /></div>}
        {results.length === 0 && !failed && term && <p className="mut" style={{ margin: 0 }}>No seller matches. Register them below.</p>}
        {failed && <p className="err">We could not load sellers. Check your connection.</p>}
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <Link href="/sellers/new?next=/stock/buy" className="btn g"><Plus className="i s" aria-hidden /> Register a new seller</Link>
    </div>
  );
}

function Input({ id, label, value, onChange, error, hint, inputMode, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; inputMode?: "numeric" | "text"; placeholder?: string }) {
  return (
    <div>
      <label className="lbl" htmlFor={id}>{label}</label>
      <input id={id} className="inp" value={value} inputMode={inputMode} placeholder={placeholder} onChange={(ev) => onChange(ev.target.value)} aria-invalid={error ? true : undefined} autoComplete="off" />
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p className="err">{error}</p>}
    </div>
  );
}

function DeviceCard({ d, index, canRemove, errors, onChange, onRemove }: { d: DraftDevice; index: number; canRemove: boolean; errors: Errors; onChange: (c: Partial<DraftDevice>) => void; onRemove: () => void }) {
  const p = `devices.${index}`;
  const id = (n: string) => `${p}-${n}`;
  // Check the IMEI against stock as soon as all 15 digits are in.
  useEffect(() => {
    if (d.imei.length !== 15 || !isValidImei(d.imei)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/imei-check?imei=${d.imei}`);
        if (res.ok && !cancelled) onChange({ check: (await res.json()) as ImeiCheckDto });
      } catch {
        // The server checks again when the purchase is confirmed.
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed IMEI should restart the check
  }, [d.imei]);
  const status = d.imei.length === 15 && !isValidImei(d.imei) ? { tone: "bad", text: "IMEI not valid" } : d.check?.exists ? { tone: "bad", text: "Already in stock" } : d.check?.valid && d.imei.length === 15 ? { tone: "ok", text: "IMEI valid and new to you" } : null;
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="row"><span className="up grow">Phone {index + 1}</span>{status && <span className={`badge ${status.tone}`}>{status.text}</span>}{canRemove && <button type="button" className="ib" onClick={onRemove} aria-label={`Remove phone ${index + 1}`}><Trash className="i s" aria-hidden /></button>}</div>
      <Input id={id("imei")} label="IMEI (dial *#06#)" value={d.imei} inputMode="numeric" onChange={(v) => onChange({ imei: v.replace(/\D/g, "").slice(0, 15), check: null })} error={errors[`${p}.imei`]} hint={d.check?.exists ? d.check.message ?? undefined : undefined} />
      <div className="fgrid two">
        <Input id={id("brand")} label="Brand" value={d.brand} onChange={(v) => onChange({ brand: v })} error={errors[`${p}.brand`]} placeholder="Apple" />
        <Input id={id("model")} label="Model" value={d.model} onChange={(v) => onChange({ model: v })} error={errors[`${p}.model`]} placeholder="iPhone 13" />
        <Input id={id("storage")} label="Storage" value={d.storage} onChange={(v) => onChange({ storage: v })} placeholder="128 GB" />
        <Input id={id("colour")} label="Colour" value={d.colour} onChange={(v) => onChange({ colour: v })} />
      </div>
      <div>
        <label className="lbl" htmlFor={id("condition")}>Condition</label>
        <select id={id("condition")} className="inp" value={d.condition} onChange={(ev) => onChange({ condition: ev.target.value as DeviceCondition })} aria-invalid={errors[`${p}.condition`] ? true : undefined}>
          <option value="">Choose</option>{DEVICE_CONDITIONS.map((c) => <option key={c} value={c}>{DEVICE_CONDITION_LABELS[c]}</option>)}
        </select>
        {errors[`${p}.condition`] && <p className="err">{errors[`${p}.condition`]}</p>}
      </div>
      <div className="fgrid two">
        <Input id={id("cost")} label="Buying price (₦)" value={d.cost} inputMode="numeric" onChange={(v) => onChange({ cost: v })} error={errors[`${p}.cost`] ?? errors[`${p}.costKobo`]} />
        <Input id={id("selling")} label="Selling price (₦)" value={d.selling} inputMode="numeric" onChange={(v) => onChange({ selling: v })} error={errors[`${p}.selling`] ?? errors[`${p}.sellingKobo`]} />
      </div>
      <div>
        <div className="lbl">Photos (optional, up to {MAX_DEVICE_PHOTOS})</div>
        <div className="row wrapf" style={{ gap: 10 }}>
          {d.photos.map((f) => <FileThumb key={f.id} file={f} size={56} onRemove={() => onChange({ photos: d.photos.filter((x) => x.id !== f.id) })} />)}
          {d.photos.length < MAX_DEVICE_PHOTOS && <div style={{ width: 150 }}><UploadButton id={id("photo")} kind="device_photo" label="Add photo" capture onUploaded={(f) => onChange({ photos: [...d.photos, f] })} /></div>}
        </div>
      </div>
    </div>
  );
}

function ProofCard({ d, index, errors, role, onChange }: { d: DraftDevice; index: number; errors: Errors; role: "owner" | "manager"; onChange: (c: Partial<DraftDevice>) => void }) {
  const p = `devices.${index}`;
  const id = (n: string) => `${p}-${n}`;
  const needsDoc = proofNeedsApproval(d.proofType);
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="row"><span className="pic" style={{ width: 40, height: 40 }}><DeviceMobile className="i s" aria-hidden /></span><div className="grow"><div className="b">{d.brand} {d.model}</div><div className="imei">{d.imei || "No IMEI yet"}</div></div></div>
      <div role="radiogroup" aria-label={`Proof for phone ${index + 1}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {PROOF_OF_OWNERSHIP_TYPES.map((t) => (
          <label key={t} className={`rad${d.proofType === t ? " on" : ""}`}>
            <input type="radio" name={`proof-${d.key}`} checked={d.proofType === t} onChange={() => onChange({ proofType: t })} />
            <span className="grow"><span className="b" style={{ display: "block" }}>{PROOF_LABELS[t]}</span><span className="sm mut">{t === "receipt" ? "Original receipt from a shop or website" : t === "certificate_of_ownership" ? "Needs the document, its number and who issued it" : "Used when there is no receipt. Needs the document, its number and who issued it"}</span></span>
            {proofNeedsApproval(t) && <span className="badge warn">{role === "owner" ? "Approved by you" : "Owner approves"}</span>}
          </label>
        ))}
      </div>
      <div>
        <div className="lbl">Photo or scan of the proof{needsDoc ? "" : " (optional)"}</div>
        <div className="row" style={{ gap: 10 }}>
          {d.proof && <FileThumb file={d.proof} onRemove={() => onChange({ proof: null })} />}
          <UploadButton id={id("proof")} kind="proof" label={d.proof ? "Replace" : "Add photo or PDF"} accept="image/jpeg,image/png,application/pdf" capture onUploaded={(f) => onChange({ proof: f })} />
        </div>
        {(errors[`${p}.proof`] ?? errors[`${p}.proofFileId`]) && <p className="err">{errors[`${p}.proof`] ?? errors[`${p}.proofFileId`]}</p>}
      </div>
      {needsDoc && (
        <div className="fgrid two">
          <Input id={id("ref")} label="Document or reference number" value={d.proofReference} onChange={(v) => onChange({ proofReference: v })} error={errors[`${p}.proofReference`]} />
          <Input id={id("auth")} label="Issued by" value={d.proofAuthority} onChange={(v) => onChange({ proofAuthority: v })} error={errors[`${p}.proofAuthority`]} placeholder="For example Nigeria Police Force" />
        </div>
      )}
      <Input id={id("note")} label="Note (optional)" value={d.proofNote} onChange={(v) => onChange({ proofNote: v })} placeholder="Receipt number, shop name, date" />
    </div>
  );
}
