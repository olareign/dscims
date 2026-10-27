import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { LocationField } from "@/components/location-field";
import { requireOwner } from "@/lib/session";
import { createShop } from "../actions";

export const metadata = { title: "Add shop" };

export default async function NewShopPage() {
  await requireOwner();
  return (
    <>
      <div className="pghead"><div><h1>Add a shop</h1></div></div>
      <div className="panel" style={{ maxWidth: 520 }}>
        <ActionForm action={createShop}>
          <input type="hidden" name="key" value={randomUUID()} />
          <Field name="name" label="Shop name" />
          <LocationField />
          <Field name="phone" label="Shop contact number" type="tel" inputMode="tel" hint="Shown on receipts. It is not used to sign in." />
          <SubmitButton pendingText="Adding...">Add shop</SubmitButton>
          <Link href="/shops" className="btn" style={{ borderColor: "transparent" }}>Cancel</Link>
        </ActionForm>
      </div>
    </>
  );
}
