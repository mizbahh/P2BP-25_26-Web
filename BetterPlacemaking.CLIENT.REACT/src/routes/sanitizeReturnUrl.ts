/** Only accept an in-app absolute path; rejects protocol-relative URLs (open-redirect guard). */
export function sanitizeReturnUrl(url: string | null | undefined): string | null {
  if (!url || url === "/") return null;
  if (!url.startsWith("/") || url.startsWith("//")) return null;
  return url;
}
