// Ekran 3 — İlk içgörü (değer anı). §3
import { useEffect } from "react";
import type { View } from "../App";
import { track } from "../analytics/events";
import { useStore } from "../state/store";
import { formatTRY } from "../core/format";
import { mandatoryMinimum } from "../core/minimum";
import { minimumTrap, avoidedInterestFromExtra } from "../core/interest";
import { daysUntilDue } from "../core/dates";
import type { TrapVerdict } from "../core/interest";
import { TcmbNote, CostTriad } from "../components/Disclaimers";
import type { Debt } from "../core/types";

const TRAP_TEXT: Record<TrapVerdict, string> = {
  shrinks:
    "Sadece asgari ödersen borç azalır ama kalan bakiyeye faiz işlemeye devam eder — daha hızlı kapatmak mümkün.",
  barely_shrinks:
    "Sadece asgari ödersen kalan borca faiz işlemeye devam eder; bu gidişle borç çok yavaş azalır.",
  not_shrinking:
    "Sadece asgari ödersen kalan borca işleyen faiz, ödediğini neredeyse götürüyor; bu gidişle borç azalmaz.",
  growing:
    "Sadece asgari ödersen tahmini faiz, asgari ödemenden büyük; bu gidişle borç azalmaz, artar.",
};

export function Screen3Insight({
  focusDebtId,
  onNavigate,
}: {
  focusDebtId: string | null;
  onNavigate: (v: View) => void;
}) {
  const { state, dispatch } = useStore();

  // focusDebtId güvenilmezse en son eklenen borca düş.
  const debt: Debt | undefined =
    state.debts.find((d) => d.id === focusDebtId) ?? state.debts[state.debts.length - 1];

  const isSample = state.mode === "sample";
  const extra = state.profile.extraBudget;
  const hasExtra = extra != null && extra > 0;

  useEffect(() => {
    track(isSample ? "sample_first_insight_viewed" : "real_first_insight_viewed");
    if (!hasExtra) track("extra_default_shown");
  }, [isSample, hasExtra]);

  if (!debt) {
    return (
      <section className="screen">
        <p>Önce bir borç ekle.</p>
        <button className="btn btn-primary" onClick={() => onNavigate("debt")}>
          Borç ekle
        </button>
      </section>
    );
  }

  const minimum = mandatoryMinimum(debt);
  const days = daysUntilDue(debt.dueDay);
  const trap = minimumTrap(debt);
  const avoided = hasExtra ? avoidedInterestFromExtra(debt, extra!) : 0;

  const setReminder = () => {
    dispatch({ type: "SET_REMINDER", debtId: debt.id, dueDay: debt.dueDay });
    track("reminder_set", { dueDay: debt.dueDay });
  };
  const hasReminder = state.reminders.some((r) => r.debtId === debt.id);

  return (
    <section className="screen insight">
      <p className="eyebrow">{debt.bank}</p>

      {debt.type === "credit_card" ? (
        <div className="hero">
          <span className="hero-label">Bu ay ödemen gereken asgari</span>
          <span className="hero-value">{formatTRY(minimum)}</span>
          <span className="hero-note">
            Asgari = BDDK kuralı (limit ≤ 50.000 ₺ → %20, üzeri → %40). Bu kısım tahmin değil, kural.
          </span>
        </div>
      ) : (
        <div className="hero">
          <span className="hero-label">{debt.bank} borcun</span>
          <span className="hero-value">{formatTRY(debt.balance)}</span>
          <span className="hero-note">
            {debt.type === "kmh"
              ? "KMH'nin regüle asgarisi yoktur; ekstra ödemeyle eritmek en mantıklısı."
              : "Kredi taksitini zamanında ödemek gecikme riskini önler."}
          </span>
        </div>
      )}

      <div className="cards">
        <article className="card">
          <h3>Son ödeme riski</h3>
          <p>
            Son ödeme gününe <strong>{days} gün</strong> var.
          </p>
          {hasReminder ? (
            <span className="badge badge-ok">Hatırlatma kuruldu</span>
          ) : (
            <button className="btn btn-small" onClick={setReminder}>
              Hatırlatma kur
            </button>
          )}
        </article>

        <article className="card">
          <h3>Asgari tuzağı</h3>
          <p>{TRAP_TEXT[trap.verdict]}</p>
          <small className="hint">Tahmini aylık faiz: {formatTRY(trap.nextMonthInterest)}</small>
        </article>

        <article className="card">
          <h3>Ekstra ödeme etkisi</h3>
          {hasExtra ? (
            <p>
              Bu ay ekstra <strong>{formatTRY(extra!)}</strong> ayırırsan, tavan orana göre yaklaşık{" "}
              <strong>{formatTRY(avoided)}</strong> faiz yükünden kaçınabilirsin.
            </p>
          ) : (
            <p>
              Örneğin ekstra <strong>{formatTRY(1000)}</strong> ayırabilirsen bunu en pahalı borca
              yönlendirmek daha hızlı rahatlatır. Kendi tutarını girerek planı netleştir.
            </p>
          )}
        </article>
      </div>

      <TcmbNote />
      <CostTriad />

      <div className="cta-stack">
        <button className="btn btn-primary" onClick={() => onNavigate("second")}>
          Devam
        </button>
      </div>
    </section>
  );
}
