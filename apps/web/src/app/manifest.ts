import type { MetadataRoute } from "next";

// PRD 5.10 PWA-1: installable, standalone display, phone-first.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "d-scims",
    short_name: "d-scims",
    description: "Phone dealer inventory, sales, credit and device provenance.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0D1B4C",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
