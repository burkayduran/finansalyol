// Hane verisini çeken ve pano için türetilmiş değerleri hesaplayan hook.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import type { Asset, Debt, Person } from "@/lib/database.types";
import { mandatoryMinimum } from "@/core/minimum";
import { daysUntilDue } from "@/core/dates";

const DAY_MS = 86400000;

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

    // Bugünden sonraki ilk taksit tarihini bul (ay-ay ilerleyerek).
    let next = new Date(first.getFullYear(), first.getMonth(), first.getDate());
    while (next < t0) {
      if (next > last) return null; // program bitti
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

export interface HouseholdData {
  loading: boolean;
  debts: Debt[];
  assets: Asset[];
  persons: Person[];
  totalDebt: number;
  totalAsset: number;
  net: number;
  upcoming: UpcomingPayment[];
  byPerson: PersonBreakdown[];
  reload: () => Promise<void>;
}

export function useHousehold(): HouseholdData {
  const { householdId } = useSession();
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);

  const reload = useCallback(async () => {
    if (!householdId) {
      setDebts([]);
      setAssets([]);
      setPersons([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [d, a, p] = await Promise.all([
      supabase.from("debts").select("*").eq("household_id", householdId),
      supabase.from("assets").select("*").eq("household_id", householdId),
      supabase.from("persons").select("*").eq("household_id", householdId),
    ]);
    setDebts(d.data ?? []);
    setAssets(a.data ?? []);
    setPersons(p.data ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const totalDebt = debts.reduce((s, x) => s + Number(x.balance), 0);
  const totalAsset = assets.reduce((s, x) => s + Number(x.balance), 0);

  const upcoming: UpcomingPayment[] = debts
    .map((debt) => ({
      debt,
      days: nextDueDays(debt),
      minimum: mandatoryMinimum({
        kind: debt.kind,
        balance: Number(debt.balance),
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
      .reduce((s, x) => s + Number(x.balance), 0),
  }));
  const orphan = debts
    .filter((d) => !d.person_id)
    .reduce((s, x) => s + Number(x.balance), 0);
  if (orphan > 0) byPerson.push({ person: null, totalDebt: orphan });

  return {
    loading,
    debts,
    assets,
    persons,
    totalDebt,
    totalAsset,
    net: totalAsset - totalDebt,
    upcoming,
    byPerson,
    reload,
  };
}
