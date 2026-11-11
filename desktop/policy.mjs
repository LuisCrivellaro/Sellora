export function navigationKind(value, origin) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return "deny";
    if (url.origin === origin && url.protocol === "http:") return "internal";
    if (url.protocol === "https:") return "external";
  } catch { /* invalid URL */ }
  return "deny";
}
