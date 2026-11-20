// Only allow redirects to paths on our own site (stops "open redirect" tricks
// like ?next=https://evil.example).
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
