// Ekran 1 — Sert konumlandırma (kapısız giriş). §1
import type { View } from "../App";
import { track } from "../analytics/events";
import { useStore } from "../state/store";
import { sampleState } from "../data/sample";

export function Screen1Landing({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { state, dispatch } = useStore();

  const startReal = () => {
    track("cta_real_clicked");
    if (state.mode === "sample") dispatch({ type: "RESET" });
    onNavigate("debt");
  };

  const startSample = () => {
    track("cta_sample_clicked");
    track("sample_session_started");
    dispatch({ type: "LOAD", state: sampleState() });
    onNavigate("plan");
  };

  const hasData = state.debts.length > 0 && state.mode === "real";

  return (
    <section className="screen landing">
      <h1 className="headline">
        Borcunu gör. Önceliğini bil. <span className="accent">Faiz tuzağından çık.</span>
      </h1>
      <p className="subhead">
        Kredi kartı, KMH ve kredi borçlarını gir. Bu ay neyi önce ödemen gerektiğini 2 dakikada gör.
      </p>

      <div className="cta-stack">
        <button className="btn btn-primary" onClick={startReal}>
          İlk borcumu ekle
        </button>
        <button className="btn btn-ghost" onClick={startSample}>
          Örnek veriyle dene
        </button>
        {hasData && (
          <button className="btn btn-link" onClick={() => onNavigate("plan")}>
            Kayıtlı planıma dön ({state.debts.length} borç)
          </button>
        )}
      </div>

      <ul className="trust-list">
        <li>Kayıt yok, auth yok, sync yok. Kapı dikmiyoruz.</li>
        <li>Faiz oranını bilmesen de olur — TCMB tavan oranıyla tahmin ederiz.</li>
        <li>Yargı yok, merdiven var: her uyarı bir sonraki somut adıma bağlanır.</li>
      </ul>
    </section>
  );
}
