// Ekran 5 — "Bu ay ne yapayım?" (0A'nın kalbi). §5
// İki AYRI blok. Karıştırma.
import { useEffect, useMemo, useState } from "react";
import type { View } from "../App";
import { track } from "../analytics/events";
import { useStore } from "../state/store";
import { buildMonthPlan } from "../core/payoff";
import { formatTRY } from "../core/format";
import { daysUntilDue } from "../core/dates";
import { exportState, importState } from "../core/storage";
import { TcmbNote, CostTriad, RateBadge } from "../components/Disclaimers";
import type { Strategy } from "../core/types";

const DUE_LABEL = (day: number) => `${day}.`;

export function Screen5Plan({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { state, dispatch } = useStore();
  const isSample = state.mode === "sample";

  const plan = useMemo(
    () => buildMonthPlan(state.debts, state.strategy, state.profile.extraBudget ?? 0),
    [state.debts, state.strategy, state.profile.extraBudget]
  );

  useEffect(() => {
    track(isSample ? "sample_plan_viewed" : "real_plan_viewed");
  }, [isSample]);

  const setStrategy = (s: Strategy) => {
    dispatch({ type: "SET_STRATEGY", strategy: s });
    track("strategy_toggled", { strategy: s });
  };

  if (state.debts.length === 0) {
    return (
      <section className="screen">
        <p>Henüz borç yok.</p>
        <button className="btn btn-primary" onClick={() => onNavigate("debt")}>
          İlk borcunu ekle
        </button>
      </section>
    );
  }

  return (
    <section className="screen plan">
      <h2>Bu ay ne yapayım?</h2>

      {/* Blok A — Zorunlu ödemeler */}
      <div className="block block-a">
        <header className="block-head">
          <h3>Önce gecikmeye düşme</h3>
          <span className="block-sub">Zorunlu ödemeler · son ödeme gününe göre</span>
        </header>

        {plan.mandatory.length === 0 ? (
          <p className="empty">Bu ay zorunlu (asgari/taksit) ödemen görünmüyor.</p>
        ) : (
          <table className="plan-table">
            <thead>
              <tr>
                <th>Borç</th>
                <th>Ödenecek min.</th>
                <th>Son gün</th>
                <th>Neden</th>
              </tr>
            </thead>
            <tbody>
              {plan.mandatory.map((row) => (
                <tr key={row.debt.id}>
                  <td>{row.debt.bank}</td>
                  <td className="num">{formatTRY(row.amount)}</td>
                  <td>
                    {DUE_LABEL(row.debt.dueDay)}{" "}
                    <span className="muted">({daysUntilDue(row.debt.dueDay)} gün)</span>
                  </td>
                  <td className="reason">{row.reason}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Toplam zorunlu</td>
                <td className="num">{formatTRY(plan.totalMandatory)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Blok B — Ekstra ödeme önerisi */}
      <div className="block block-b">
        <header className="block-head">
          <h3>Ekstra paran varsa buraya koy</h3>
          <span className="block-sub">
            Ekstra ödeme önerisi · sıralama: {state.strategy === "avalanche" ? "çığ" : "kartopu"}
          </span>
        </header>

        <div className="strategy-toggle">
          <button
            className={state.strategy === "avalanche" ? "seg active" : "seg"}
            onClick={() => setStrategy("avalanche")}
          >
            Çığ (en yüksek faiz)
          </button>
          <button
            className={state.strategy === "snowball" ? "seg active" : "seg"}
            onClick={() => setStrategy("snowball")}
          >
            Kartopu (en küçük bakiye)
          </button>
        </div>

        {state.profile.extraBudget != null && state.profile.extraBudget > 0 && (
          <p className="extra-budget">
            Bu ay ekstra bütçen: <strong>{formatTRY(state.profile.extraBudget)}</strong> — sıradaki en
            üstteki borca yönlendir.
          </p>
        )}

        <ol className="extra-list">
          {plan.extra.map((row) => (
            <li key={row.debt.id}>
              <span className="prio">{row.priority}</span>
              <div className="extra-body">
                <div className="extra-title">
                  {row.debt.bank} <RateBadge source={row.rate.source} />
                </div>
                <div className="extra-reason">{row.reason}</div>
              </div>
              <span className="extra-balance">{formatTRY(row.debt.balance)}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="summary">
        Bu planla gecikme riskin azalır, yüksek faizli borcun yükü düşer, borç kapatma rotan başlar.
      </p>

      <TcmbNote />
      <CostTriad />

      <PaymentSection />

      <DataTools
        onExport={() => exportState(state)}
        onImport={(raw) => {
          const next = importState(raw);
          if (next) dispatch({ type: "LOAD", state: next });
          return next != null;
        }}
        onReset={() => {
          dispatch({ type: "RESET" });
          onNavigate("landing");
        }}
      />

      <div className="cta-stack">
        <button className="btn btn-ghost" onClick={() => onNavigate("second")}>
          Borç ekle / düzenle
        </button>
      </div>
    </section>
  );
}

function PaymentSection() {
  const { state, dispatch } = useStore();
  const [debtId, setDebtId] = useState("");
  const [amount, setAmount] = useState("");

  const log = () => {
    const value = Number(amount.replace(/\./g, "").replace(/,/g, "."));
    if (!debtId || !Number.isFinite(value) || value <= 0) return;
    dispatch({ type: "LOG_PAYMENT", debtId, amount: value });
    track("payment_logged", { amount: value });
    setAmount("");
  };

  return (
    <details className="payment-log">
      <summary>Ödeme yaptım, kaydet</summary>
      <div className="pay-row">
        <select value={debtId} onChange={(e) => setDebtId(e.target.value)}>
          <option value="">Borç seç…</option>
          {state.debts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.bank}
            </option>
          ))}
        </select>
        <input
          inputMode="decimal"
          placeholder="tutar"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button className="btn btn-small" onClick={log}>
          Kaydet
        </button>
      </div>
      {state.payments.length > 0 && (
        <p className="muted">{state.payments.length} ödeme kaydedildi.</p>
      )}
    </details>
  );
}

function DataTools({
  onExport,
  onImport,
  onReset,
}: {
  onExport: () => string;
  onImport: (raw: string) => boolean;
  onReset: () => void;
}) {
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const doExport = () => {
    const data = onExport();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "borc-takip-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <details className="data-tools">
      <summary>Verini dışa/içe aktar · sıfırla</summary>
      <div className="cta-stack">
        <button className="btn btn-small" onClick={doExport}>
          JSON olarak dışa aktar
        </button>
      </div>
      <textarea
        placeholder="İçe aktarmak için JSON yapıştır…"
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
      />
      <div className="cta-stack">
        <button
          className="btn btn-small"
          onClick={() => setMsg(onImport(importText) ? "İçe aktarıldı." : "Geçersiz JSON.")}
        >
          İçe aktar
        </button>
        <button className="btn btn-link danger" onClick={onReset}>
          Tüm verimi sıfırla
        </button>
      </div>
      {msg && <p className="muted">{msg}</p>}
    </details>
  );
}
