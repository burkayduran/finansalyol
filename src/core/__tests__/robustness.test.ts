import { describe, expect, it } from "vitest";
import { daysUntilDue, nextDueDate, toISODateLocal, parseISODateLocal } from "../dates";
import { fxRate, toTRY } from "../fx";
import { generateNextOccurrencesForDebt, type DebtForOcc } from "../paymentOccurrences";

describe("tarih dayanıklılığı — ay sonu / artık yıl", () => {
  it("ayın 31'i, 28/30 günlük aylarda son güne kırpılır", () => {
    // Şubat 2026 (28 gün): 31 → 28
    expect(toISODateLocal(nextDueDate(31, new Date(2026, 1, 10)))).toBe("2026-02-28");
    // Nisan (30 gün): 31 → 30
    expect(toISODateLocal(nextDueDate(31, new Date(2026, 3, 10)))).toBe("2026-04-30");
  });
  it("vade günü bugünse 0 gün kaldı", () => {
    expect(daysUntilDue(28, new Date(2026, 1, 28))).toBe(0);
  });
  it("artık yıl 29 Şubat doğru hesaplanır", () => {
    // 2028 artık yıl: ayın 29'u → 29 Şubat
    expect(toISODateLocal(nextDueDate(29, new Date(2028, 1, 10)))).toBe("2028-02-29");
    // 2027 artık değil: 29 → 28 Şubat
    expect(toISODateLocal(nextDueDate(29, new Date(2027, 1, 10)))).toBe("2027-02-28");
  });
  it("date-only round-trip TZ'den bağımsız (UTC kayması yok)", () => {
    expect(toISODateLocal(parseISODateLocal("2026-03-31"))).toBe("2026-03-31");
    expect(toISODateLocal(parseISODateLocal("2028-02-29"))).toBe("2028-02-29");
  });
});

describe("occurrence üretimi — ay sonu ilerleme", () => {
  it("kredi taksitleri ay-sonu kırpmasıyla ilerler", () => {
    const debt: DebtForOcc = {
      id: "d1",
      kind: "loan",
      monthly_installment: 1000,
      remaining_installment_count: 3,
      next_due_date: "2026-01-31",
    };
    const occ = generateNextOccurrencesForDebt(debt, 12, new Date(2026, 0, 1));
    expect(occ.map((o) => o.due_date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(occ.every((o) => o.amount_due === 1000)).toBe(true);
  });
  it("kalan taksit 0 ise occurrence üretilmez", () => {
    const debt: DebtForOcc = { id: "d2", kind: "loan", monthly_installment: 1000, remaining_installment_count: 0, next_due_date: "2026-01-31" };
    expect(generateNextOccurrencesForDebt(debt, 12, new Date(2026, 0, 1))).toHaveLength(0);
  });
});

describe("FX — eksik kur güvenli fallback", () => {
  it("TRY her zaman 1", () => {
    expect(fxRate("TRY", {})).toBe(1);
    expect(toTRY(50, "TRY", {})).toBe(50);
  });
  it("kur varsa çevirir", () => {
    const rates = { USD: { forex_buying: 34 } };
    expect(fxRate("USD", rates)).toBe(34);
    expect(toTRY(100, "USD", rates)).toBe(3400);
  });
  it("kur yoksa null (önizleme gösterilmez)", () => {
    expect(fxRate("USD", {})).toBeNull();
    expect(toTRY(100, "USD", {})).toBeNull();
    expect(fxRate("USD", { USD: { forex_buying: null } })).toBeNull();
  });
});
