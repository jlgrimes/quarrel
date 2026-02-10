// Parse Set-Cookie header into an object
export function parseCookie(setCookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = setCookieHeader.split(";").map((s) => s.trim());
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    result[key.toLowerCase()] = rest.join("=") || "true";
  }
  return result;
}
