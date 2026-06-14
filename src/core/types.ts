// Domain types for Borç Takip 0A.
// Money is ALWAYS stored as a numeric value (TRY), never a formatted string.

export type DebtType = "credit_card" | "kmh" | "loan";

export type Strategy = "avalanche" | "snowball";

export interface Debt {
  id: string;
  type: DebtType;
  bank: string;
  /** Dönem borcu (statement balance) in TRY. */
  balance: number;
  /** Kart limiti — only meaningful for credit cards. Drives BDDK minimum tier. */
  cardLimit?: number;
  /** Son ödeme günü (1–31). */
  dueDay: number;
  /**
   * User-supplied monthly contractual rate (e.g. 0.039). When set it OVERRIDES
   * the TCMB fallback cap. Optional — the whole flow works without it.
   */
  userMonthlyRate?: number;
  /**
   * Loan installment (taksit) — the mandatory monthly payment for a loan.
   * Optional; if absent we cannot show a mandatory amount for the loan.
   */
  installment?: number;
  /** User-defined minimum for non-card debts (optional). */
  userMinimum?: number;
}

export interface Profile {
  /** Aylık gelir — optional, recommended. */
  monthlyIncome?: number;
  /** Bu ay ekstra ayırabileceğin tutar — optional. */
  extraBudget?: number;
}

export interface AppState {
  debts: Debt[];
  profile: Profile;
  strategy: Strategy;
  /** "real" = kullanıcının kendi verisi, "sample" = vitrin örneği. */
  mode: "real" | "sample";
  reminders: Reminder[];
  payments: PaymentLog[];
}

export interface Reminder {
  debtId: string;
  dueDay: number;
  createdAt: string;
}

export interface PaymentLog {
  debtId: string;
  amount: number;
  loggedAt: string;
}

/** Where a rate came from — surfaced in the UI for the trust triad (§8). */
export type RateSource = "user" | "tcmb_cap";

export interface ResolvedRate {
  monthlyRate: number;
  source: RateSource;
}
