// Hane verisini çeken ve pano için türetilmiş değerleri hesaplayan hook.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import type { Asset, CashFlow, Debt, FxRate, Person } from "@/lib/database.types";
import { mandatoryMinimum } from "@/core/minimum";
import { daysUntilDue } from "@/core/dates";
import { outstandingBalance } from "@/core/installment";
import { assetValueTRY, assetPnlTRY } from "@/core/assets";
import { projectCashflow, type CashflowDebt, type CashflowEntry } from "@/core/cashflow";

const DAY_MS = 86400000;

const toDebtOutstanding = (debt: Debt): number =>
  outstandingBalance({
    kind: debt.kind,
    balance: Number(debt.balance),
    installment: debt.installment,
    termCount: debt.term_count,
    firstInstallmentDate: debt.first_installment_date
      ? new Date(debt.first_installment_date)
      : null,
  });

/**
 * Borcun bir sonraki ödeme gününe kalan gün. Taksit programı varsa GERÇEK taksit
 * tarihini kullanır (sadece due_day değil). Program bittiyse null döner.
 */
function nextDueDays(debt: Debt): number | null {
  if (
    (debt.kind === "loan" || debt.kind === "kmh_installment") &&
    debt.first_installment_date &&
    debt.term_count != null
  ) {
    const first = new Date(debt.first_installment_date);
    const last = new Date(first);
    last.setMonth(last.getMonth() + Number(debt.term_count) - 1);
    const today = new Date();
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    let next = new Date(first.getFullYear(), first.getMonth(), first.getDate());
    while (next < t0) {
      if (next > last) return null;
      next.setMonth(next.getMonth() + 1);
    }
    if (next > last && first < t0) return null;
    return Math.round((next.getTime() - t0.getTime()) / DAY_MS);
  }
  return daysUntilDue(debt.due_day);
}

export interface UpcomingPayment {
  debt: Debt;
  days: number;
  minimum: number;
}

export interface PersonBreakdown {
  person: Person | null;
  totalDebt: number;
}

export interface AssetView {
  asset: Asset;
  valueTRY: number;
  pnlTRY: number | null;
}

export interface HouseholdData {
  loading: boolean;
  debts: Debt[];
  assets: Asset[];
  persons: Person[];
  cashFlows: CashFlow[];
  fxRates: Record<string, FxRate>;
  totalDebt: number;
  totalAsset: number;
  net: number;
  /** Bu ayın gelir − (düzenli gider + borç yükümlülüğü) neti. */
  monthlyNet: number;
  assetViews: AssetView[];
  upcoming: UpcomingPayment[];
  byPerson: PersonBreakdown[];
  /** 1 birim para birimi kaç TRY (TCMB alış). TRY → 1. */
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
  const [fxRates, setFxRates] = useState<Record<string, FxRate>>({});

  const reload = useCallback(async () => {
    if (!householdId) {
      setDebts([]);
      setAssets([]);
      setPersons([]);
      setCashFlows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [d, a, p, c, fx] = await Promise.all([
      supabase.from("debts").select("*").eq("household_id", householdId),
      supabase.from("assets").select("*").eq("household_id", householdId),
      supabase.from("persons").select("*").eq("household_id", householdId),
      supabase.from("cash_flows").select("*").eq("household_id", householdId).eq("active", true),
      supabase.from("fx_rates").select("*"),
    ]);
    setDebts(d.data ?? []);
    setAssets(a.data ?? []);
    setPersons(p.data ?? []);
    setCashFlows(c.data ?? []);
    const fxMap: Record<string, FxRate> = {};
    for (const r of fx.data ?? []) fxMap[r.currency] = r;
    setFxRates(fxMap);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const fxRateFor = (currency: string): number => {
    if (!currency || currency === "TRY") return 1;
    return Number(fxRates[currency]?.forex_buying ?? 1); // kur yoksa 1 (dönüştürme yok)
  };

  // Borçlar: gerçek kalan bakiye (taksitli türetilir).
  const totalDebt = debts.reduce((s, x) => s + toDebtOutstanding(x), 0);

  // Varlıklar: TRY değer + kâr/zarar.
  const assetViews: AssetView[] = assets.map((asset) => {
    const fx = fxRateFor(asset.currency);
    const input = {
      kind: asset.kind,
      balance: Number(asset.balance),
      quantity: asset.quantity,
      buyPrice: asset.buy_price,
      lastPrice: asset.last_price,
    };
    return { asset, valueTRY: assetValueTRY(input, fx), pnlTRY: assetPnlTRY(input, fx) };
  });
  const totalAsset = assetViews.reduce((s, v) => s + v.valueTRY, 0);

  // Bu ayın net'i (gelir-gider projeksiyonu ilk ayı).
  const cashflowEntries: CashflowEntry[] = cashFlows.map((c) => ({
    amount: Number(c.amount) * fxRateFor(c.currency),
    direction: c.direction,
    recurrence: c.recurrence,
    occurredOn: c.occurred_on ? new Date(c.occurred_on) : undefined,
  }));
  const cashflowDebts: CashflowDebt[] = debts.map((d) => ({
    kind: d.kind,
    monthlyMinimum: mandatoryMinimum({
      kind: d.kind,
      balance: toDebtOutstanding(d),
      cardLimit: d.card_limit,
      installment: d.installment,
      userMinimum: d.user_minimum,
    }),
    installment: d.installment ?? undefined,
    termCount: d.term_count ?? undefined,
    firstInstallmentDate: d.first_installment_date
      ? new Date(d.first_installment_date)
      : undefined,
  }));
  const monthlyNet = projectCashflow(cashflowEntries, cashflowDebts, 1)[0]?.net ?? 0;

  const upcoming: UpcomingPayment[] = debts
    .map((debt) => ({
      debt,
      days: nextDueDays(debt),
      minimum: mandatoryMinimum({
        kind: debt.kind,
        balance: toDebtOutstanding(debt),
        cardLimit: debt.card_limit,
        installment: debt.installment,
        userMinimum: debt.user_minimum,
      }),
    }))
    .filter((x) => x.days != null)
    .sort((a, b) => (a.days as number) - (b.days as number))
    .slice(0, 5) as UpcomingPayment[];

  const byPerson: PersonBreakdown[] = persons.map((person) => ({
    person,
    totalDebt: debts
      .filter((d) => d.person_id === person.id)
      .reduce((s, x) => s + toDebtOutstanding(x), 0),
  }));
  const orphan = debts
    .filter((d) => !d.person_id)
    .reduce((s, x) => s + toDebtOutstanding(x), 0);
  if (orphan > 0) byPerson.push({ person: null, totalDebt: orphan });

  return {
    loading,
    debts,
    assets,
    persons,
    cashFlows,
    fxRates,
    totalDebt,
    totalAsset,
    net: totalAsset - totalDebt,
    monthlyNet,
    assetViews,
    upcoming,
    byPerson,
    fxRateFor,
    debtOutstanding: toDebtOutstanding,
    reload,
  };
}
