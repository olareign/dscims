import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { currentShopId, requireMe } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await requireMe();
  const shopId = await currentShopId(me);
  const label = me.user.role === "owner" ? (me.shops.find((s) => s.id === shopId)?.name ?? (me.shops.length === 1 ? me.shops[0].name : "All shops")) : (me.user.shopName ?? "Your shop");
  return <Shell me={me} shopLabel={label}>{children}</Shell>;
}
