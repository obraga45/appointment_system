export const BRAND = {
  name: "TemVagas",
  email: "info@temvagas.pt",
  domain: "temvagas.pt",
  monthlyPrice: "15€",
  yearlyPrice: "149€",
} as const;

export function bookingPath(slug: string) {
  return `/agendar/${slug}`;
}

export function cancelPath(token: string) {
  return `/agendar/cancel/${token}`;
}
