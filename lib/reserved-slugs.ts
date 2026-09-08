const RESERVED = [
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "dashboard",
  "appointments",
  "services",
  "settings",
  "agendar",
  "book",
  "cancel",
  "termos",
  "privacidade",
  "api",
  "admin",
  "app",
  "static",
  "assets",
  "favicon.ico",
  "robots.txt",
  "sitemap",
  "sitemap.xml",
  "manifest",
  "icon",
  "apple-icon",
] as const;

const RESERVED_SET = new Set<string>(RESERVED);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SET.has(slug.trim().toLowerCase());
}
