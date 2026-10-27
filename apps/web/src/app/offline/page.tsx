export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="auth"><div className="box" style={{ textAlign: "center" }}>
      <h1 className="h1">You are offline</h1>
      <p className="mut" style={{ margin: 0 }}>Reconnect to continue. Screens you opened before are still available. Adding or changing anything needs internet.</p>
    </div></div>
  );
}
