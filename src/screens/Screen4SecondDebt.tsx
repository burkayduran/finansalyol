// Ekran 4 — İkinci borç daveti (küçük lokma). §4
// "Tüm borçlarını gir" demiyoruz; "bir tane daha var mı?" diyoruz.
import type { View } from "../App";
import { track } from "../analytics/events";
import { useStore } from "../state/store";

export function Screen4SecondDebt({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { state } = useStore();

  const addAnother = () => {
    track("second_debt_added");
    onNavigate("debt");
  };

  const toPlan = () => {
    track("proceed_to_plan");
    onNavigate("plan");
  };

  return (
    <section className="screen prompt">
      <h2>Başka borcun var mı?</h2>
      <p className="subhead">
        Şu an {state.debts.length} borç eklendi. Bir tane daha eklemek planını daha doğru yapar — ama
        zorunlu değil.
      </p>

      <div className="cta-stack">
        <button className="btn btn-primary" onClick={addAnother}>
          Evet, bir borç daha ekle
        </button>
        <button className="btn btn-ghost" onClick={toPlan}>
          Hayır, bu ayki planımı göster
        </button>
      </div>
    </section>
  );
}
