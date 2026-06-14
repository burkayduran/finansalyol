import { useEffect, useState } from "react";
import { track } from "./analytics/events";
import { useStore } from "./state/store";
import { Screen1Landing } from "./screens/Screen1Landing";
import { Screen2DebtEntry } from "./screens/Screen2DebtEntry";
import { Screen3Insight } from "./screens/Screen3Insight";
import { Screen4SecondDebt } from "./screens/Screen4SecondDebt";
import { Screen5Plan } from "./screens/Screen5Plan";

export type View = "landing" | "debt" | "insight" | "second" | "plan";

export function App() {
  const { state } = useStore();
  const [view, setView] = useState<View>("landing");
  // Hangi borç içgörü/akış odağında — son eklenen borç.
  const [focusDebtId, setFocusDebtId] = useState<string | null>(null);

  useEffect(() => {
    track("screen1_viewed");
  }, []);

  const go = (next: View, debtId?: string) => {
    if (debtId !== undefined) setFocusDebtId(debtId);
    setView(next);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => go("landing")}>
          Borç Takip
        </button>
        {state.mode === "sample" && view !== "landing" && (
          <span className="badge badge-sample">Örnek veri</span>
        )}
      </header>

      <main className="content">
        {view === "landing" && <Screen1Landing onNavigate={go} />}
        {view === "debt" && <Screen2DebtEntry onNavigate={go} />}
        {view === "insight" && <Screen3Insight focusDebtId={focusDebtId} onNavigate={go} />}
        {view === "second" && <Screen4SecondDebt onNavigate={go} />}
        {view === "plan" && <Screen5Plan onNavigate={go} />}
      </main>

      <footer className="footer">
        <span>Local-first · Auth yok · Verin cihazında kalır</span>
      </footer>
    </div>
  );
}
