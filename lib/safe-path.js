const BASE = "http://featurevote.invalid";

// Only same-site paths may be used after sign-in, so a crafted ?next= link
// can't send someone to another site.
export function safeNextPath(value, fallback = "/workspaces") {
  if (typeof value !== "string" || !value.startsWith("/") || value.includes("\\")) {
    return fallback;
  }
  try {
    const url = new URL(value, BASE);
    return url.origin === BASE ? `${url.pathname}${url.search}` : fallback;
  } catch {
    return fallback;
  }
}
