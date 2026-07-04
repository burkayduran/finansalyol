// Oturum + aktif hane bağlamı. Tüm uygulama bunun altında çalışır.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface SessionValue {
  session: Session | null;
  loading: boolean;
  /** Aktif hane id'si (üye birden fazla haneye ait olabilir; F1'de ilki seçilir). */
  householdId: string | null;
  setHouseholdId: (id: string | null) => void;
  refreshHouseholds: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Şifre sıfırlama akışı aktif mi (deep link ile geldi). */
  recovery: boolean;
  clearRecovery: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);

  const refreshHouseholds = async () => {
    const { data } = await supabase
      .from("household_members")
      .select("household_id")
      .order("created_at", { ascending: true })
      .limit(1);
    setHouseholdId(data?.[0]?.household_id ?? null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) refreshHouseholds();
    else setHouseholdId(null);
  }, [session?.user.id]);

  const value = useMemo<SessionValue>(
    () => ({
      session,
      loading,
      householdId,
      setHouseholdId,
      refreshHouseholds,
      signOut: async () => {
        await supabase.auth.signOut();
      },
      recovery,
      clearRecovery: () => setRecovery(false),
    }),
    [session, loading, householdId, recovery]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
