import Link from "next/link";
import { CheckCircle, SquaresFour, Storefront } from "@phosphor-icons/react/dist/ssr";
import { currentShopId, requireOwner } from "@/lib/session";
import { switchShop } from "../../actions";

export const metadata = { title: "Switch shop" };

export default async function SwitchShopPage() {
  const me = await requireOwner();
  const current = await currentShopId(me);
  const options = [{ id: "all", name: "All shops", sub: `Combined view · ${me.shops.length} shops` }, ...me.shops.map((s) => ({ id: s.id, name: s.name, sub: "" }))];
  return (
    <>
      <div className="pghead"><div><h1>Switch shop</h1><p className="mut" style={{ margin: "6px 0 0" }}>Lists such as Users start with the shop you pick. You can still change the filter.</p></div></div>
      <div className="panel" style={{ maxWidth: 520 }}>
        {options.map((o) => {
          const on = (current ?? "all") === o.id;
          return (
            <form key={o.id} action={switchShop}>
              <input type="hidden" name="shopId" value={o.id} /><input type="hidden" name="next" value="/" />
              <button type="submit" className="row" style={{ width: "100%", textAlign: "left", padding: 12, border: `1.5px solid ${on ? "var(--navy)" : "var(--line)"}`, background: on ? "var(--soft)" : "#fff", borderRadius: 14, cursor: "pointer", font: "inherit" }} aria-pressed={on}>
                <span className="tile">{o.id === "all" ? <SquaresFour className="i" aria-hidden /> : <Storefront className="i" aria-hidden />}</span>
                <span className="grow"><b>{o.name}</b>{o.sub && <span className="sm mut" style={{ display: "block" }}>{o.sub}</span>}</span>
                {on && <CheckCircle className="i" weight="fill" style={{ color: "var(--navy)" }} aria-label="Selected" />}
              </button>
            </form>
          );
        })}
        <Link href="/shops/new" className="btn">Add a shop</Link>
      </div>
    </>
  );
}
