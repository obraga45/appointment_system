import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const PT_COUNTRY_CODE = "351";
const PT_MOBILE = /^3519\d{8}$/;

function phoneDigits(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  return digits;
}

/** 9 dígitos nacionais, mesmo que a pessoa cole +351 ou o indicativo duas vezes. */
export function ptMobileLocalDigits(phone: string): string {
  let digits = phoneDigits(phone);
  while (digits.startsWith(PT_COUNTRY_CODE)) {
    digits = digits.slice(PT_COUNTRY_CODE.length);
  }
  return digits.slice(0, 9);
}

/** Normaliza telemóveis PT para E.164 sem o prefixo +. */
export function normalizePhone(phone: string): string {
  let digits = phoneDigits(phone);
  while (digits.startsWith(`${PT_COUNTRY_CODE}${PT_COUNTRY_CODE}`)) {
    digits = digits.slice(PT_COUNTRY_CODE.length);
  }

  if (digits.startsWith(PT_COUNTRY_CODE) && digits.length >= 12) {
    return digits.slice(0, 12);
  }

  if (digits.length === 9 && digits.startsWith("9")) {
    return `${PT_COUNTRY_CODE}${digits}`;
  }

  return digits;
}

export function isPortugueseMobile(phone: string): boolean {
  return PT_MOBILE.test(normalizePhone(phone));
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.startsWith(PT_COUNTRY_CODE) && normalized.length === 12) {
    const local = normalized.slice(3);
    return `+351 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return normalized ? `+${normalized}` : "";
}

export function formatCurrency(value: number | string): string {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}
