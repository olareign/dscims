import { PurchaseWizard } from "@/components/purchase-wizard";
import { api } from "@/lib/api";
import { one } from "@/lib/href";
import type { SearchParams } from "@/lib/href";
import { currentShopId, requireBuyer } from "@/lib/session";
import type { SellerDto } from "@dscims/shared";

export const metadata = { title: "Buy phones" };

export default async function BuyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const me = await requireBuyer();
  const sp = await searchParams;
  const sellerId = one(sp.seller);
  // A seller who was just registered, or chosen from their profile, is already picked.
  const initialSeller = sellerId ? await api<SellerDto>(`/sellers/${sellerId}`).catch(() => null) : null;
  const owner = me.user.role === "owner";
  const defaultShopId = (await currentShopId(me)) ?? me.shops[0]!.id;
  return (
    <>
      <div className="pghead"><div><h1>Buy phones</h1><p className="mut" style={{ margin: "6px 0 0" }}>Record what you bought, from whom, and the proof the seller showed you.</p></div></div>
      <PurchaseWizard shops={me.shops} defaultShopId={defaultShopId} chooseShop={owner && me.shops.length > 1} initialSeller={initialSeller} role={owner ? "owner" : "manager"} />
    </>
  );
}
