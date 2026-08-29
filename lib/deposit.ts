import { formatCurrency, formatPhoneDisplay, normalizePhone } from "@/lib/utils";

export const DEPOSIT_HOLD_MINUTES = 45;

export type DepositSettings = {
  enabled: boolean;
  amount: number | null;
  mbWay: string | null;
  iban: string | null;
};

export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function formatIbanDisplay(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();
}

export function businessAcceptsDeposit(settings: DepositSettings): boolean {
  return (
    settings.enabled &&
    typeof settings.amount === "number" &&
    settings.amount > 0 &&
    Boolean(settings.mbWay || settings.iban)
  );
}

export function depositFromUser(user: {
  depositEnabled: boolean;
  depositAmount: { toString(): string } | number | null;
  depositMbWay: string | null;
  depositIban: string | null;
}): DepositSettings {
  const raw = user.depositAmount;
  const amount = raw == null ? null : Number(typeof raw === "number" ? raw : raw.toString());
  return {
    enabled: user.depositEnabled,
    amount: amount != null && Number.isFinite(amount) ? amount : null,
    mbWay: user.depositMbWay,
    iban: user.depositIban,
  };
}

export function formatDepositPayLines(settings: DepositSettings): string[] {
  const lines: string[] = [];
  if (settings.mbWay) {
    lines.push(`MB Way: ${formatPhoneDisplay(normalizePhone(settings.mbWay))}`);
  }
  if (settings.iban) {
    lines.push(`IBAN: ${formatIbanDisplay(settings.iban)}`);
  }
  return lines;
}

export function formatDepositSummary(settings: DepositSettings): string {
  const amount = formatCurrency(settings.amount ?? 0);
  const pay = formatDepositPayLines(settings);
  return [amount, ...pay].join(" · ");
}
