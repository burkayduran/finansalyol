// Supabase tablo tipleri (el yazımı; üretimde `supabase gen types` ile yenilenebilir).
// schema.sql ile birebir tutulur.

export type DebtKind = "credit_card" | "kmh" | "loan";
export type AssetKind = "cash" | "deposit" | "fund" | "other";

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
  person_id: string | null;
  kind: DebtKind;
  bank: string;
  label: string | null;
  balance: number;
  card_limit: number | null;
  installment: number | null;
  due_day: number;
  user_monthly_rate: number | null;
  user_minimum: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export type Asset = {
  id: string;
  household_id: string;
  person_id: string | null;
  label: string;
  kind: AssetKind;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export type Payment = {
  id: string;
  household_id: string;
  debt_id: string;
  amount: number;
  paid_at: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export type NotificationPrefs = {
  member_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
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
