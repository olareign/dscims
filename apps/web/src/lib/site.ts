// Public name and URL are defined once here.
export const site = {
  name: "d-scims",
  description: "Phone dealer inventory, sales, credit and device provenance.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001",
  apiUrl: process.env.API_URL ?? "http://localhost:3006",
} as const;
