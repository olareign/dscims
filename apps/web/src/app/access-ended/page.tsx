import Link from "next/link";
import { Lock } from "@phosphor-icons/react/dist/ssr";

export const metadata = { title: "Access ended" };

export default function AccessEndedPage() {
  return (
    <div className="auth"><div className="box" style={{ textAlign: "center", alignItems: "center" }}>
      <div style={{ width: 84, height: 84, borderRadius: "50%", background: "var(--badbg)", color: "var(--bad)", display: "flex", alignItems: "center", justifyContent: "center" }}><Lock size={38} aria-hidden /></div>
      <h1 className="h1">Your access has ended</h1>
      <p className="mut" style={{ margin: 0 }}>The owner turned off your account. If this looks wrong, ask the owner of your business.</p>
      <Link href="/login" className="btn p" style={{ alignSelf: "stretch" }}>Back to sign in</Link>
    </div></div>
  );
}
