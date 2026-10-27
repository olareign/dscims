import type { ReactNode } from "react";
import { platformSignOut } from "../actions";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "var(--navy)", color: "#fff", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "10px 24px", minHeight: 68 }}>
        <div className="logo" style={{ color: "#fff" }}><b style={{ background: "#fff", color: "var(--navy)" }}>d</b>d-scims <span style={{ fontWeight: 500, opacity: 0.8 }}>Platform</span></div>
        <div style={{ flex: 1 }} />
        <span className="sm" style={{ color: "#CBD5F5" }}>Pacifylabs team</span>
        <form action={platformSignOut}><button type="submit" className="btn sm" style={{ background: "#fff" }}>Sign out</button></form>
      </header>
      <main className="ct" style={{ margin: "0 auto" }}>{children}</main>
    </div>
  );
}
