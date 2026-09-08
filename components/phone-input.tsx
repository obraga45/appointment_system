"use client";

import { useId, useState } from "react";
import { cn, normalizePhone, ptMobileLocalDigits } from "@/lib/utils";

type PhoneInputProps = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  onValueChange?: (localDigits: string) => void;
};

export function PhoneInput({
  id,
  name,
  value,
  defaultValue,
  required,
  disabled,
  autoComplete = "tel-national",
  onValueChange,
}: PhoneInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const prefixId = `${inputId}-prefix`;
  const [uncontrolled, setUncontrolled] = useState(() => ptMobileLocalDigits(defaultValue ?? ""));
  const local = value !== undefined ? ptMobileLocalDigits(value) : uncontrolled;
  const submitted = local ? normalizePhone(local) : "";

  function setLocal(raw: string) {
    const next = ptMobileLocalDigits(raw);
    if (value === undefined) {
      setUncontrolled(next);
    }
    onValueChange?.(next);
  }

  return (
    <div
      className={cn(
        "flex h-11 w-full items-center rounded-lg border border-input bg-background shadow-xs transition-colors focus-within:ring-2 focus-within:ring-ring md:h-10",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span id={prefixId} className="shrink-0 select-none pl-3 text-sm text-muted-foreground">
        +351
      </span>
      <input
        id={inputId}
        type="tel"
        inputMode="numeric"
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        value={local}
        maxLength={9}
        minLength={required ? 9 : undefined}
        pattern="9[0-9]{8}"
        placeholder="912345678"
        aria-describedby={prefixId}
        onChange={(event) => setLocal(event.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
      />
      {name ? <input type="hidden" name={name} value={submitted} /> : null}
    </div>
  );
}
