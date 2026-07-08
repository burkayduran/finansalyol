// Hane verisini çeken ve pano için türetilmiş (aksiyon odaklı) değerleri hesaplayan hook.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import type {
  Asset,
  CashFlow,
  Debt,
  FxRate,
  PaymentOccurrence,
  Person,
} from "@/lib/database.types";
import { mandatoryMinimum } from "@/core/minimum";
import { outstandingBalance } from "@/core/installment";
import { effectiveStatus } from "@/core/paymentOccurrences";
import { parseISODateLocal } from "@/core/dates";
import { assetValueTRY, assetPnlTRY } from "@/core/assets";
import {
  projectCashflow,
  type CashflowDebt,
  type CashflowEntry,
  type MonthlyFlow,
} from "@/core/cashflow";
import { ensureOccurrences } from "@/lib/occurrences";

const toDebtOutstanding = (debt: Debt): number =>
  outstandingBalance({
    kind: debt.kind,
    balance: Number(debt.current_balance ?? debt.balance),
    installment: debt.monthly_installment ?? debt.installment,
    termCount: debt.remaining_installment_count ?? debt.term_count,
    firstInstallmentDate: debt.next_due_date
      ? parseISODateLocal(debt.next_due_date)
      : debt.first_installment_date
        ? parseISODateLocal(debt.first_installment_date)
        : null,
  });

const ownerKey = (r: { owner_type: string; person_id: string | null }) =>
  r.owner_type === "household" ? "household" : r.person_id ?? "household";

const remainingDue = (o: PaymentOccurrence) => Math.max(0, Number(o.amount_due) - Number(o.amount_paid));
const isOpen = (o: PaymentOccurrence) => o.status === "pending" || o.status === "partial" || o.status === "overdue";

export interface AssetView {
  asset: Asset;
  valueTRY: number;
  pnlTRY: number | null;
}
export interface KindTotal { kind: string; value: number }

export interface PersonCard {
  key: string;
  name: string;
  isHousehold: boolean;
  person: Person | null;
  totalDebt: number;
  totalAsset: number;
  thisMonthPayment: number;
  upcomingCount: number;
}

export interface MonthDue { month: Date; total: number }

export interface HouseholdData {
  loading: boolean;
  debts: Debt[];
  assets: Asset[];
  persons: Person[];
  cashFlows: CashFlow[];
  occurrences: PaymentOccurrence[];
  fxRates: Record<string, FxRate>;
  totalDebt: number;
  totalAsset: number;
  net: number;
  monthlyNet: number;
  /** Bu ay ödenecek toplam (occurrence kalanları). */
  thisMonthDue: number;
  thisMonthTotal: number;
  thisMonthPaid: number;
  thisMonthOpenCount: number;
  thisWeekCount: number;
  /** En acil açık ödemeler (tarih sırası). */
  urgentOccurrences: PaymentOccurrence[];
  /** Gelecek 3 ay ödeme toplamları. */
  next3Months: MonthDue[];
  personCards: PersonCard[];
  assetViews: AssetView[];
  assetByKind: KindTotal[];
  projection: MonthlyFlow[];
  fxRateFor: (currency: string) => number;
  debtOutstanding: (debt: Debt) => number;
  reload: () => Promise<void>;
}

export function useHousehold(): HouseholdData {
  const { householdId } = useSession();
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [cashFlows, setCashFlows] = useState<CashFlow[]>([]);
  const [occurrences, setOccurrences] = useState<PaymentOccurrence[]>([]);
  const [fxRates, setFxRates] = useState<Record<string, FxRate>>({});

  const reload = useCallback(async () => {
    if (!householdId) {
      setDebts([]); setAssets([]); setPersons([]); setCashFlows([]); setOccurrences([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const debtRes = await supabase.from("debts").select("*").eq("household_id", householdId);
    const debtList = debtRes.data ?? [];
    // Beklenen ödeme olaylarını garanti et (idempotent), sonra oku.
    try {
      await ensureOccurrences(householdId, debtList);
    } catch {
      /* occurrence üretimi best-effort */
    }
    const [a, p, c, fx, occ] = await Promise.all([
      supabase.from("assets").select("*").eq("household_id", householdId),
      supabase.from("persons").select("*").eq("household_id", householdId).eq("is_archived", false),
      supabase.from("cash_flows").select("*").eq("household_id", householdId).eq("active", true),
      supabase.from("fx_rates").select("*"),
      supabase.from("payment_occurrences").select("*").eq("household_id", householdId).order("due_date"),
    ]);
    setDebts(debtList);
    setAssets(a.data ?? []);
    setPersons(p.data ?? []);
    setCashFlows(c.data ?? []);
    const fxMap: Record<string, FxRate> = {};
    for (const r of fx.data ?? []) fxMap[r.currency] = r;
    setFxRates(fxMap);
    setOccurrences(occ.data ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { reload(); }, [reload]);

  const fxRateFor = (currency: string): number =>
    !currency || currency === "TRY" ? 1 : Number(fxRates[currency]?.forex_buying ?? 1);

  const totalDebt = debts.reduce((s, x) => s + toDebtOutstanding(x), 0);

  const assetViews: AssetView[] = assets.map((asset) => {
    const fx = fxRateFor(asset.currency);
    const input = {
      kind: asset.kind, balance: Number(asset.balance),
      quantity: asset.quantity, buyPrice: asset.buy_price, lastPrice: asset.last_price,
    };
    return { asset, valueTRY: assetValueTRY(input, fx), pnlTRY: assetPnlTRY(input, fx) };
  });
  const totalAsset = assetViews.reduce((s, v) => s + v.valueTRY, 0);

  const kindMap = new Map<string, number>();
  for (const v of assetViews) kindMap.set(v.asset.kind, (kindMap.get(v.asset.kind) ?? 0) + v.valueTRY);
  const assetByKind: KindTotal[] = [...kindMap.entries()].map(([kind, value]) => ({ kind, value })).filter((k) => k.value > 0);

  // Gelir-gider projeksiyonu (grafik + bu ay net).
  const cashflowEntries: CashflowEntry[] = cashFlows.map((c) => ({
    amount: Number(c.amount) * fxRateFor(c.currency),
    direction: c.direction, recurrence: c.recurrence,
    occurredOn: c.occurred_on ? parseISODateLocal(c.occurred_on) : undefined,
  }));
  const cashflowDebts: CashflowDebt[] = debts.map((d) => ({
    kind: d.kind,
    monthlyMinimum: mandatoryMinimum({
      kind: d.kind, balance: toDebtOutstanding(d), cardLimit: d.card_limit,
      installment: d.monthly_installment ?? d.installment, userMinimum: d.user_minimum_payment ?? d.user_minimum,
    }),
    installment: (d.monthly_installment ?? d.installment) ?? undefined,
    termCount: (d.remaining_installment_count ?? d.term_count) ?? undefined,
    firstInstallmentDate: d.next_due_date ? parseISODateLocal(d.next_due_date) : d.first_installment_date ? parseISODateLocal(d.first_installment_date) : undefined,
  }));
  const projection = projectCashflow(cashflowEntries, cashflowDebts, 12);
  const monthlyNet = projection[0]?.net ?? 0;

  // --- Occurrence türetmeleri (aksiyon odaklı pano) ---
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const inThisMonth = (o: PaymentOccurrence) => {
    const d = parseISODateLocal(o.due_date);
    return d >= monthStart && d <= monthEnd;
  };

  const openOcc = occurrences.filter(isOpen);
  const monthOcc = occurrences.filter(inThisMonth).filter((o) => o.status !== "skipped");
  const thisMonthTotal = monthOcc.reduce((s, o) => s + Number(o.amount_due), 0);
  const thisMonthPaid = monthOcc.reduce((s, o) => s + Number(o.amount_paid), 0);
  const thisMonthDue = openOcc.filter(inThisMonth).reduce((s, o) => s + remainingDue(o), 0);
  const thisMonthOpenCount = openOcc.filter(inThisMonth).length;
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const thisWeekCount = openOcc.filter((o) => {
    const d = parseISODateLocal(o.due_date);
    return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && d <= weekEnd;
  }).length;

  // Sıralama: gecikenler > bugün > en yakın due > kısmi > diğer bekleyenler.
  const rank = (o: PaymentOccurrence): number => {
    const days = Math.round((parseISODateLocal(o.due_date).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
    if (effectiveStatus(o, now) === "overdue") return 0;
    if (days === 0) return 1;
    if (o.status === "partial") return 3;
    return 2;
  };
  const urgentOccurrences = [...openOcc]
    .sort((a, b) => rank(a) - rank(b) || a.due_date.localeCompare(b.due_date))
    .slice(0, 5);

  const next3Months: MonthDue[] = [0, 1, 2].map((k) => {
    const m = new Date(now.getFullYear(), now.getMonth() + k, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() + k + 1, 0);
    const total = openOcc
      .filter((o) => { const d = parseISODateLocal(o.due_date); return d >= m && d <= mEnd; })
      .reduce((s, o) => s + remainingDue(o), 0);
    return { month: m, total };
  });

  // Kişi/Ortak kartları.
  const buildCard = (key: string, name: string, isHousehold: boolean, person: Person | null): PersonCard => {
    const debtMatch = (r: Debt) => ownerKey(r) === key;
    const assetMatch = (v: AssetView) => ownerKey(v.asset) === key;
    const occMatch = (o: PaymentOccurrence) => ownerKey(o) === key;
    return {
      key, name, isHousehold, person,
      totalDebt: debts.filter(debtMatch).reduce((s, x) => s + toDebtOutstanding(x), 0),
      totalAsset: assetViews.filter(assetMatch).reduce((s, v) => s + v.valueTRY, 0),
      thisMonthPayment: openOcc.filter(occMatch).filter(inThisMonth).reduce((s, o) => s + remainingDue(o), 0),
      upcomingCount: openOcc.filter(occMatch).length,
    };
  };
  const personCards: PersonCard[] = persons.map((p) => buildCard(p.id, p.display_name, false, p));
  const householdCard = buildCard("household", "Ortak / Hane", true, null);
  if (householdCard.totalDebt > 0 || householdCard.totalAsset > 0 || householdCard.upcomingCount > 0) {
    personCards.push(householdCard);
  }

  return {
    loading, debts, assets, persons, cashFlows, occurrences, fxRates,
    totalDebt, totalAsset, net: totalAsset - totalDebt, monthlyNet,
    thisMonthDue, thisMonthTotal, thisMonthPaid, thisMonthOpenCount, thisWeekCount,
    urgentOccurrences, next3Months, personCards,
    assetViews, assetByKind, projection,
    fxRateFor, debtOutstanding: toDebtOutstanding, reload,
  };
}
