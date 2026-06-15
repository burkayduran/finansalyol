// Hane verisini çeken ve pano için türetilmiş değerleri hesaplayan hook.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import type { Asset, Debt, Person } from "@/lib/database.types";
import { mandatoryMinimum } from "@/core/minimum";
import { daysUntilDue } from "@/core/dates";

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
      days: daysUntilDue(debt.due_day),
      minimum: mandatoryMinimum({
        kind: debt.kind,
        balance: Number(debt.balance),
        cardLimit: debt.card_limit,
        installment: debt.installment,
        userMinimum: debt.user_minimum,
      }),
    }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

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
