// fx_rates tablosunu okuyup currency->rate haritası döndürür (ekleme ekranları için).
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FxRate } from "@/lib/database.types";

export function useFxRates(): Record<string, FxRate> {
  const [rates, setRates] = useState<Record<string, FxRate>>({});
  useEffect(() => {
    supabase
      .from("fx_rates")
      .select("*")
      .then(({ data }) => {
        const map: Record<string, FxRate> = {};
        for (const r of data ?? []) map[r.currency] = r;
        setRates(map);
      });
  }, []);
  return rates;
}
