"use client";

import { useState } from "react";
import { Crosshair, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useFormState } from "./form";

type Status = { kind: "idle" } | { kind: "asking" } | { kind: "found"; accuracy: number } | { kind: "error"; message: string };

/**
 * Shop address with an optional "Use my location" button. The browser asks for permission only when the button
 * is tapped. The coordinates are turned into an address by our API; nothing is stored unless the form is saved.
 */
export function LocationField({ defaultAddress = "", defaultLat, defaultLng }: { defaultAddress?: string; defaultLat?: number | null; defaultLng?: number | null }) {
  const state = useFormState();
  const [address, setAddress] = useState(state.values?.address ?? defaultAddress);
  const [coords, setCoords] = useState<{ lat: string; lng: string }>({ lat: state.values?.latitude ?? (defaultLat?.toString() ?? ""), lng: state.values?.longitude ?? (defaultLng?.toString() ?? "") });
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const error = state.fieldErrors?.address;

  function locate() {
    if (!("geolocation" in navigator)) return setStatus({ kind: "error", message: "This device cannot share its location. Type the address instead." });
    setStatus({ kind: "asking" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        try {
          const res = await fetch(`/api/address-lookup?lat=${latitude}&lng=${longitude}`);
          const body = (await res.json()) as { address?: string; message?: string };
          if (!res.ok || !body.address) throw new Error(body.message ?? "No address found");
          setAddress(body.address);
          setCoords({ lat: latitude.toFixed(6), lng: longitude.toFixed(6) });
          setStatus({ kind: "found", accuracy: Math.round(accuracy) });
        } catch (err) {
          setStatus({ kind: "error", message: (err as Error).message || "We could not find an address. Type it instead." });
        }
      },
      (err) => setStatus({ kind: "error", message: err.code === err.PERMISSION_DENIED ? "Location is blocked for this site. Type the address instead, or allow location in your browser settings." : "We could not get your location. Type the address instead." }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  return (
    <div>
      <div className="row wrapf" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <label className="lbl" htmlFor="address" style={{ margin: 0 }}>Shop location</label>
        <button type="button" onClick={locate} disabled={status.kind === "asking"} className="row" style={{ gap: 6, color: "var(--navy)", fontWeight: 600, fontSize: 14, minHeight: 44, background: "none", border: 0, cursor: "pointer" }}>
          <Crosshair className="i s" aria-hidden /> {status.kind === "asking" ? "Finding you..." : "Use my location"}
        </button>
      </div>
      <input id="address" name="address" className="inp" value={address} onChange={(e) => { setAddress(e.target.value); setStatus({ kind: "idle" }); }} autoComplete="street-address" aria-invalid={error ? true : undefined} />
      <input type="hidden" name="latitude" value={coords.lat} />
      <input type="hidden" name="longitude" value={coords.lng} />
      {status.kind === "found" && (
        <p className="hint row" style={{ gap: 6, color: "var(--ok)" }} role="status"><CheckCircle className="i s" aria-hidden /> Filled from your location, about {status.accuracy} m. Check it and edit if it is wrong.</p>
      )}
      {status.kind === "error" && <p className="hint row" style={{ gap: 6, color: "var(--warn)" }} role="alert"><WarningCircle className="i s" aria-hidden /> {status.message}</p>}
      {status.kind === "idle" && !error && <p className="hint">We only ask for your location when you tap the button.</p>}
      {error && <p className="err">{error}</p>}
    </div>
  );
}
