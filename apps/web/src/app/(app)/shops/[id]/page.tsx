import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import type { ShopDto } from "@dscims/shared";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { LocationField } from "@/components/location-field";
import { ApiError, api } from "@/lib/api";
import { requireOwner } from "@/lib/session";
import { updateShop } from "../actions";

export const metadata = { title: "Edit shop" };

export default async function EditShopPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  let shop: ShopDto;
  try {
    shop = await api<ShopDto>(`/shops/${id}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  return (
    <>
      <Link href="/shops" className="row b" style={{ gap: 4, color: "var(--navy)", textDecoration: "none", minHeight: 44 }}><CaretLeft className="i s" aria-hidden /> Shops</Link>
      <div className="pghead"><div><h1>{shop.name}</h1><p className="mut" style={{ margin: "6px 0 0" }}>{shop.userCount} users work here{shop.isMain ? " · Main shop" : ""}</p></div></div>
      <div className="panel" style={{ maxWidth: 520 }}>
        <ActionForm action={updateShop}>
          <input type="hidden" name="id" value={shop.id} />
          <Field name="name" label="Shop name" defaultValue={shop.name} />
          <LocationField defaultAddress={shop.address} defaultLat={shop.latitude} defaultLng={shop.longitude} />
          <Field name="phone" label="Shop contact number" type="tel" inputMode="tel" defaultValue={shop.phone} hint="Shown on receipts. It is not used to sign in." />
          <SubmitButton pendingText="Saving...">Save changes</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
