// Ekran 2 — Tek borç girişi. §2  (Sadece BİR borç. "Tümünü gir" yok.)
// Faiz oranı SORULMAZ — TCMB tavan oranıyla tahmin edilir.
import { useEffect, useState } from "react";
import type { View } from "../App";
import { track } from "../analytics/events";
import { useStore } from "../state/store";
import { parseTRYInput } from "../core/format";
import { BANKS } from "../data/banks";
import type { DebtType } from "../core/types";

const TYPE_LABELS: Record<DebtType, string> = {
  credit_card: "Kredi kartı",
  kmh: "KMH",
  loan: "Kredi",
};

export function Screen2DebtEntry({ onNavigate }: { onNavigate: (v: View, id?: string) => void }) {
  const { state, dispatch } = useStore();

  const [type, setType] = useState<DebtType>("credit_card");
  const [bank, setBank] = useState("");
  const [balance, setBalance] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [installment, setInstallment] = useState("");
  const [income, setIncome] = useState(state.profile.monthlyIncome?.toString() ?? "");
  const [extra, setExtra] = useState(state.profile.extraBudget?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track("real_debt_started");
  }, []);

  const isCard = type === "credit_card";
  const isLoan = type === "loan";

  const submit = () => {
    const balanceVal = parseTRYInput(balance);
    const dueVal = Number(dueDay);
    const limitVal = parseTRYInput(cardLimit);

    if (!bank) return setError("Banka seç.");
    if (balanceVal == null || balanceVal <= 0) return setError("Borç tutarını gir.");
    if (isCard && (limitVal == null || limitVal <= 0)) return setError("Kart limitini gir.");
    if (!Number.isInteger(dueVal) || dueVal < 1 || dueVal > 31)
      return setError("Son ödeme gününü 1–31 arası gir.");

    const installmentVal = parseTRYInput(installment);

    dispatch({
      type: "ADD_DEBT",
      debt: {
        type,
        bank,
        balance: balanceVal,
        cardLimit: isCard ? limitVal! : undefined,
        dueDay: dueVal,
        installment: isLoan && installmentVal ? installmentVal : undefined,
      },
    });

    const incomeVal = parseTRYInput(income);
    const extraVal = parseTRYInput(extra);
    dispatch({
      type: "SET_PROFILE",
      patch: {
        monthlyIncome: incomeVal ?? undefined,
        extraBudget: extraVal ?? undefined,
      },
    });

    // Kart/limit/son gün dolu -> tamamlandı sayılır.
    if (!isCard || (limitVal != null && limitVal > 0)) {
      track("real_debt_completed", { type, hasExtra: extraVal != null });
    }

    // En son eklenen borca odaklan.
    const lastId = state.debts.length; // index proxy; gerçek id store'da üretilir
    onNavigate("insight", String(lastId));
  };

  return (
    <section className="screen form">
      <h2>Bir borcunu ekle</h2>
      <p className="subhead">Şimdilik sadece bir tane. Gerisini sonra ekleriz.</p>

      <label className="field">
        <span>Borç türü</span>
        <div className="segmented">
          {(Object.keys(TYPE_LABELS) as DebtType[]).map((t) => (
            <button
              key={t}
              className={type === t ? "seg active" : "seg"}
              onClick={() => setType(t)}
              type="button"
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </label>

      <label className="field">
        <span>Banka</span>
        <select value={bank} onChange={(e) => setBank(e.target.value)}>
          <option value="">Seç…</option>
          {BANKS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Borç tutarı (dönem borcu)</span>
        <input
          inputMode="decimal"
          placeholder="örn. 71.000"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
        />
      </label>

      {isCard && (
        <label className="field">
          <span>Kart limiti</span>
          <input
            inputMode="decimal"
            placeholder="örn. 90.000"
            value={cardLimit}
            onChange={(e) => setCardLimit(e.target.value)}
          />
          <small className="hint">Asgari oranını belirler (BDDK: limit ≤ 50.000 → %20, üzeri → %40).</small>
        </label>
      )}

      {isLoan && (
        <label className="field">
          <span>Aylık taksit (varsa)</span>
          <input
            inputMode="decimal"
            placeholder="örn. 8.750"
            value={installment}
            onChange={(e) => setInstallment(e.target.value)}
          />
        </label>
      )}

      <label className="field">
        <span>Son ödeme günü</span>
        <input
          inputMode="numeric"
          placeholder="1–31"
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
        />
      </label>

      <p className="microcopy info">
        Faiz oranını bilmiyorsan sorun değil — TCMB tavan oranıyla tahmini hesaplarız. Bankandaki
        oran daha düşükse sonradan düzeltebilirsin.
      </p>

      <details className="optional">
        <summary>Opsiyonel — planı keskinleştirir</summary>
        <label className="field">
          <span>Aylık gelir</span>
          <input
            inputMode="decimal"
            placeholder="opsiyonel"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Bu ay ekstra ayırabileceğin tutar</span>
          <input
            inputMode="decimal"
            placeholder="opsiyonel"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        </label>
      </details>

      {error && <p className="error">{error}</p>}

      <div className="cta-stack">
        <button className="btn btn-primary" onClick={submit}>
          İçgörüyü gör
        </button>
        <button className="btn btn-link" onClick={() => onNavigate("landing")}>
          Vazgeç
        </button>
      </div>
    </section>
  );
}
