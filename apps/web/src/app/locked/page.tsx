import { Lock } from "@phosphor-icons/react/dist/ssr";
import { signOut } from "@/app/(app)/actions";

export const metadata = { title: "Account locked" };

export default function LockedPage() {
  return (
    <div className="auth"><div className="box" style={{ textAlign: "center", alignItems: "center" }}>
      <div style={{ width: 84, height: 84, borderRadius: "50%", background: "var(--warnbg)", color: "var(--warn)", display: "flex", alignItems: "center", justifyContent: "center" }}><Lock size={38} aria-hidden /></div>
      <h1 className="h1">This account is locked</h1>
      <p className="mut" style={{ margin: 0 }}>Pacifylabs suspended this account and the grace period has ended. Contact Pacifylabs to get it turned back on. Your records are safe.</p>
      <form action={signOut} style={{ alignSelf: "stretch" }}><button className="btn p full" type="submit">Sign out</button></form>
    </div></div>
  );
}
