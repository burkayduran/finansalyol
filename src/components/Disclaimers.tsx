// Kalıcı mikrocopy bileşenleri (§0, §3, §7, §8). "Tavan ≠ gerçek."
import { RATE_SOURCE } from "../core/rateConfig";

/** Her tahmin yanında: TCMB tavan oranı uyarısı. */
export function TcmbNote() {
  return (
    <p className="microcopy">
      TCMB {RATE_SOURCE.effectiveDate.slice(0, 7)} azami oranlarıyla tahmini hesaplandı.
      Bankandaki gerçek oran daha düşükse taşıma maliyetin ve tasarrufun da daha düşük olur.{" "}
      <span className="muted">(son kontrol: {RATE_SOURCE.lastCheckedAt})</span>
    </p>
  );
}

/** Üçlü maliyet ayrımı (§8) — güven için açık. */
export function CostTriad() {
  return (
    <details className="triad">
      <summary>Bu uygulama neyi nasıl hesaplıyor?</summary>
      <ul>
        <li>
          <strong>Asgari ödeme:</strong> BDDK kuralı (limit %20/%40) — <em>kesin / kural</em>.
        </li>
        <li>
          <strong>Faiz tahmini:</strong> TCMB azami/tavan oran — <em>yaklaşık / tavan orana göre</em>.
        </li>
        <li>
          <strong>Gerçek maliyet:</strong> Banka oranı + vergi/masraf (BSMV, KKDF…) —{" "}
          <em>değişebilir; gerçek faturanla farklılaşır</em>.
        </li>
      </ul>
    </details>
  );
}

/** Bir oranın kaynağını gösteren küçük rozet. */
export function RateBadge({ source }: { source: "user" | "tcmb_cap" }) {
  return source === "user" ? (
    <span className="badge badge-user">senin oranın</span>
  ) : (
    <span className="badge badge-cap">TCMB tavan</span>
  );
}
