import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { LocationField } from "@/components/location-field";
import { RulesFields } from "@/components/rules-fields";
import { api } from "@/lib/api";
import { one } from "@/lib/href";
import type { SearchParams } from "@/lib/href";
import { requireOwner } from "@/lib/session";
import type { ShopDto } from "@dscims/shared";
import { saveRules, saveShopStep } from "./actions";

export const metadata = { title: "Set up your shop" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const me = await requireOwner();
  const step = one((await searchParams).step) === "2" ? 2 : 1;
  const shop = step === 1 ? await api<ShopDto>(`/shops/${me.shops[0].id}`) : null;
  return (
    <div style={{ maxWidth: 520, width: "100%", margin: "0 auto" }} className="panel">
      <div className="steps" aria-hidden><i className="on" /><i className={step === 2 ? "on" : ""} /></div>
      <div>
        <p className="sm mut b" style={{ margin: "0 0 4px" }}>Step {step} of 2</p>
        <h1 className="h1">{step === 1 ? "Set up your shop" : "Your sales rules"}</h1>
        {step === 1 && <p className="mut" style={{ margin: "6px 0 0" }}>This appears on your receipts. You can change it later.</p>}
      </div>
      {step === 1 && shop ? (
        <ActionForm action={saveShopStep}>
          <Field name="businessName" label="Business name" defaultValue={me.settings.businessName} />
          <Field name="name" label="Shop name" defaultValue={shop.name} />
          <LocationField defaultAddress={shop.address} defaultLat={shop.latitude} defaultLng={shop.longitude} />
          <Field name="phone" label="Shop contact number" type="tel" defaultValue={shop.phone} hint="Shown on receipts. It is not used to sign in." inputMode="tel" />
          <SubmitButton>Continue</SubmitButton>
        </ActionForm>
      ) : (
        <ActionForm action={saveRules}>
          <input type="hidden" name="finish" value="1" />
          <RulesFields settings={me.settings} />
          <SubmitButton pendingText="Finishing...">Finish setup</SubmitButton>
          <Link href="/setup" className="b" style={{ textAlign: "center", color: "var(--navy)", textDecoration: "none" }}>Back</Link>
        </ActionForm>
      )}
    </div>
  );
}
