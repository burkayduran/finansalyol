// Supabase tablo tipleri (el yazımı; üretimde `supabase gen types` ile yenilenebilir).
// schema.sql ile birebir tutulur.

export type DebtKind = "credit_card" | "kmh" | "installment_kmh" | "loan";
export type AssetKind =
  | "cash"
  | "deposit"
  | "fund"
  | "stock"
  | "gold"
  | "fx"
  | "commodity" // geriye uyum
  | "crypto" // geriye uyum (MVP'de geri planda)
  | "other";

export type CashFlowDirection = "income" | "expense";

export type OwnerType = "person" | "household";

export type PaymentOccurrenceStatus =
  | "pending"
  | "partial"
  | "paid"
  | "overdue"
  | "skipped";

export type PaymentOccurrenceKind =
  | "credit_card_minimum"
  | "loan_installment"
  | "installment_kmh"
  | "kmh_manual"
  | "custom";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

export type Household = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export type Person = {
  id: string;
  household_id: string;
  display_name: string;
  linked_member_id: string | null;
  created_at: string;
}

export type Debt = {
  id: string;
  household_id: string;
  owner_type: OwnerType;
  person_id: string | null;
  kind: DebtKind;
  bank: string; // geriye uyum
  bank_code: string | null;
  bank_name: string | null;
  label: string | null;
  note: string | null;
  // bakiye / tutar
  balance: number; // geriye uyum
  current_balance: number | null;
  original_amount: number | null;
  total_amount: number | null; // geriye uyum
  card_limit: number | null;
  statement_day: number | null;
  // taksit programı
  installment: number | null; // geriye uyum
  monthly_installment: number | null;
  term_count: number | null; // geriye uyum
  total_installment_count: number | null;
  remaining_installment_count: number | null;
  first_installment_date: string | null; // geriye uyum
  next_due_date: string | null;
  due_day: number;
  user_monthly_rate: number | null;
  user_minimum: number | null; // geriye uyum
  user_minimum_payment: number | null;
  reminder_enabled: boolean;
  is_active: boolean;
  currency: string;
  created_at: string;
  updated_at: string;
}

export type Asset = {
  id: string;
  household_id: string;
  owner_type: OwnerType;
  person_id: string | null;
  label: string;
  kind: AssetKind;
  balance: number;
  annual_rate: number | null;
  term_days: number | null;
  stopaj: number | null;
  start_date: string | null;
  symbol: string | null;
  commodity_type: string | null;
  quantity: number | null;
  buy_price: number | null;
  last_price: number | null;
  last_price_at: string | null;
  price_source: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export type CashFlow = {
  id: string;
  household_id: string;
  owner_type: OwnerType;
  person_id: string | null;
  direction: CashFlowDirection;
  category: string;
  label: string | null;
  amount: number;
  currency: string;
  recurrence: "monthly" | "one_time";
  occurred_on: string | null;
  active: boolean;
  created_at: string;
}

export type FxRate = {
  currency: string;
  forex_buying: number | null;
  forex_selling: number | null;
  banknote_buying: number | null;
  banknote_selling: number | null;
  rate_date: string;
  updated_at: string;
}

export type Payment = {
  id: string;
  household_id: string;
  debt_id: string;
  occurrence_id: string | null;
  owner_type: OwnerType;
  person_id: string | null;
  amount: number;
  paid_at: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export type PaymentOccurrence = {
  id: string;
  household_id: string;
  debt_id: string | null;
  owner_type: OwnerType;
  person_id: string | null;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: PaymentOccurrenceStatus;
  kind: PaymentOccurrenceKind;
  installment_no: number | null;
  total_installments: number | null;
  bank_code: string | null;
  bank_name: string | null;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationPrefs = {
  member_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  remind_7d: boolean;
  remind_3d: boolean;
  remind_1d: boolean;
  remind_due_day: boolean;
  remind_overdue: boolean;
  scope: "own" | "household" | "all";
  days_before: number;
  weekly_digest: boolean;
  digest_weekday: number;
}

export type HouseholdSummary = {
  total_debt: number;
  total_asset: number;
  net: number;
}

// Minimal Database tipi — supabase-js generic'i için yeterli yüzey.
type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      profiles: Row<Profile>;
      households: Row<Household>;
      household_members: Row<{
        id: string;
        household_id: string;
        member_id: string;
        role: "owner" | "member";
        created_at: string;
      }>;
      household_invites: Row<{
        id: string;
        household_id: string;
        email: string;
        code: string;
        invited_by: string;
        status: "pending" | "accepted" | "revoked";
        created_at: string;
        expires_at: string;
      }>;
      persons: Row<Person>;
      debts: Row<Debt>;
      assets: Row<Asset>;
      payments: Row<Payment>;
      payment_occurrences: Row<PaymentOccurrence>;
      cash_flows: Row<CashFlow>;
      fx_rates: Row<FxRate>;
      push_tokens: Row<{
        id: string;
        member_id: string;
        expo_token: string;
        platform: string | null;
        created_at: string;
      }>;
      notification_prefs: Row<NotificationPrefs>;
      reminders_log: Row<{
        id: string;
        debt_id: string | null;
        member_id: string;
        channel: "push" | "email";
        kind: "advance" | "due_day" | "weekly";
        due_date: string | null;
        sent_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      create_household: { Args: { p_name: string }; Returns: string };
      accept_invite: { Args: { p_code: string }; Returns: string };
      household_summary: { Args: { hh: string }; Returns: HouseholdSummary[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
