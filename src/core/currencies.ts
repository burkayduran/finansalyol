// Para birimi listesi (top-10 + TRY). Hepsi TCMB today.xml'de bulunur.
export const CURRENCIES = [
  "TRY",
  "USD",
  "EUR",
  "GBP",
  "CHF",
  "CAD",
  "AUD",
  "JPY",
  "SAR",
  "RUB",
  "CNY",
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "TRY";
