import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { SellerIdField } from "@/components/seller-id-field";
import { one } from "@/lib/href";
import type { SearchParams } from "@/lib/href";
import { requireBuyer } from "@/lib/session";
import { createSeller } from "../actions";

export const metadata = { title: "Register a seller" };

export default async function NewSellerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireBuyer();
  const next = one((await searchParams).next);
  const back = next && next.startsWith("/") && !next.startsWith("//") ? next : "/sellers";
  return (
    <>
      <div className="pghead"><div><h1>Register a seller</h1><p className="mut" style={{ margin: "6px 0 0" }}>Sellers do not sign in. This is your record of who sold you a phone.</p></div></div>
      <div className="panel" style={{ maxWidth: 560 }}>
        <ActionForm action={createSeller}>
          <input type="hidden" name="next" value={back === "/sellers" ? "" : back} />
          <Field name="name" label="Full name" autoComplete="off" />
          <Field name="phone" label="Phone number" type="tel" inputMode="tel" autoComplete="off" hint="For your records. 0803 456 7812 and +234 803 456 7812 are the same number." />
          <Field name="address" label="Address" autoComplete="off" />
          <SellerIdField />
          <div className="card s" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><div className="b">NIN and BVN (optional)</div><div className="sm mut">Encrypted when saved. Only the last 4 digits ever show on screen.</div></div>
            <Field name="nin" label="NIN" inputMode="numeric" placeholder="11 digits" autoComplete="off" />
            <Field name="bvn" label="BVN" inputMode="numeric" placeholder="11 digits" autoComplete="off" />
          </div>
          <SubmitButton pendingText="Saving...">Save seller</SubmitButton>
          <Link href={back} className="btn" style={{ borderColor: "transparent" }}>Cancel</Link>
        </ActionForm>
      </div>
    </>
  );
}
