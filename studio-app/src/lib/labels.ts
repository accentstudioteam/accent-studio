import type { Locale, PayoutRail } from "@/lib/types";

export const LOCALES: { code: Locale; name: string; flag: string }[] = [
  { code: "pcm-NG", name: "Nigerian Pidgin", flag: "🇳🇬" },
  { code: "yo-NG", name: "Yoruba", flag: "🇳🇬" },
  { code: "ha-NG", name: "Hausa", flag: "🇳🇬" },
  { code: "ig-NG", name: "Igbo", flag: "🇳🇬" },
  { code: "sw-KE", name: "Swahili", flag: "🇰🇪" },
  { code: "zu-ZA", name: "Zulu", flag: "🇿🇦" },
];

export const LOCALE_NAME: Record<Locale, string> = Object.fromEntries(
  LOCALES.map((l) => [l.code, l.name])
) as Record<Locale, string>;

export const RAILS: { code: PayoutRail; name: string; min: string }[] = [
  { code: "mpesa", name: "M-Pesa", min: "$5 min" },
  { code: "paystack", name: "Paystack", min: "$5 min" },
  { code: "flutterwave", name: "Flutterwave", min: "$5 min" },
  { code: "stripe", name: "Stripe", min: "$10 min" },
  { code: "paypal", name: "PayPal", min: "$10 min" },
  { code: "usdc", name: "USDC", min: "$2 min" },
];
