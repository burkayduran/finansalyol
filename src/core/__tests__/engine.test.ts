import { describe, expect, it } from "vitest";
import { parseTRYInput, formatTRY, formatPercent } from "../format";
import { mandatoryMinimum, bddkMinimumRate } from "../minimum";
import { resolveMonthlyRate, tcmbCapRate } from "../rateConfig";
import { minimumTrap, avoidedInterestFromExtra } from "../interest";
import { daysUntilDue } from "../dates";
import { depositYield } from "../deposit";
import { projectMonths } from "../projection";
import { installmentsPaid, outstandingInstallment, outstandingBalance, installmentsCoveredByPayment } from "../installment";
import { assetValueTRY, assetPnlTRY, assetNativeValue } from "../assets";
import { projectCashflow } from "../cashflow";

describe("format", () => {
  it("parses tr-TR money strings", () => {
    expect(parseTRYInput("18.400")).toBe(18400);
    expect(parseTRYInput("1.234.567,89")).toBeCloseTo(1234567.89);
    expect(parseTRYInput("₺2.000")).toBe(2000);
    expect(parseTRYInput("abc")).toBeNull();
  });
  it("formats currency and percent in tr-TR", () => {
    expect(formatTRY(18400)).toContain("18.400");
    expect(formatPercent(0.0425)).toBe("%4,25");
  });
});

describe("BDDK minimum (limit tier)", () => {
  it("uses %20 at/under 50.000 limit and %40 above", () => {
    expect(bddkMinimumRate(40000)).toBe(0.2);
    expect(bddkMinimumRate(50000)).toBe(0.2);
    expect(bddkMinimumRate(90000)).toBe(0.4);
  });
  it("computes card minimum from limit-based rate", () => {
    expect(mandatoryMinimum({ kind: "credit_card", balance: 71000, cardLimit: 90000 })).toBeCloseTo(28400);
    expect(mandatoryMinimum({ kind: "credit_card", balance: 10000, cardLimit: 40000 })).toBeCloseTo(2000);
  });
  it("treats KMH as having no mandatory minimum", () => {
    expect(mandatoryMinimum({ kind: "kmh", balance: 22000 })).toBe(0);
  });
  it("uses loan installment as mandatory", () => {
    expect(mandatoryMinimum({ kind: "loan", balance: 64000, installment: 8750 })).toBe(8750);
  });
  it("treats installment_kmh like a loan (mandatory = installment)", () => {
    expect(mandatoryMinimum({ kind: "installment_kmh", balance: 30000, installment: 5000 })).toBe(5000);
  });
});

describe("deposit yield (gün + faiz + stopaj)", () => {
  it("computes gross, tax, net and maturity (hand-verified)", () => {
    // 100.000 anapara, %45 yıllık, 365 gün, %0 stopaj -> brüt 45.000, net 45.000
    const y = depositYield({ principal: 100000, annualRate: 45, termDays: 365, stopaj: 0 });
    expect(y.grossInterest).toBeCloseTo(45000);
    expect(y.tax).toBe(0);
    expect(y.netInterest).toBeCloseTo(45000);
    expect(y.maturityValue).toBeCloseTo(145000);
  });
  it("applies stopaj and term days", () => {
    // 100.000, %50 yıllık, 73 gün (=0.2 yıl) -> brüt 10.000; %10 stopaj -> net 9.000
    const y = depositYield({ principal: 100000, annualRate: 50, termDays: 73, stopaj: 10 });
    expect(y.grossInterest).toBeCloseTo(10000);
    expect(y.tax).toBeCloseTo(1000);
    expect(y.netInterest).toBeCloseTo(9000);
    expect(y.maturityValue).toBeCloseTo(109000);
  });
  it("computes maturity date from start + termDays", () => {
    const y = depositYield({
      principal: 1000,
      annualRate: 10,
      termDays: 30,
      stopaj: 0,
      startDate: new Date(2026, 5, 1),
    });
    expect(y.maturityDate.getTime()).toBe(new Date(2026, 6, 1).getTime());
  });
});

describe("installment projection", () => {
  it("projects monthly dues and remaining balance (hand-verified)", () => {
    const rows = projectMonths(
      [
        {
          id: "kredi",
          label: "İhtiyaç",
          installment: 8750,
          termCount: 8,
          firstInstallmentDate: new Date(2026, 5, 25), // 25 Haz 2026
          balance: 64000,
        },
      ],
      3,
      new Date(2026, 5, 1) // 1 Haz 2026
    );
    expect(rows.map((r) => r.totalDue)).toEqual([8750, 8750, 8750]);
    expect(rows.map((r) => r.remainingTotal)).toEqual([55250, 46500, 37750]);
  });
  it("contributes nothing before first installment and after term ends", () => {
    const rows = projectMonths(
      [
        {
          id: "x",
          label: "X",
          installment: 1000,
          termCount: 2,
          firstInstallmentDate: new Date(2026, 7, 1), // Ağu
          balance: 2000,
        },
      ],
      4,
      new Date(2026, 5, 1) // Haz
    );
    // Haz, Tem: 0 ; Ağu, Eyl: 1000 ; sonrası yok
    expect(rows.map((r) => r.totalDue)).toEqual([0, 0, 1000, 1000]);
    expect(rows[0].remainingTotal).toBe(2000); // ilk taksitten önce tam bakiye
    expect(rows[3].remainingTotal).toBe(0); // iki taksit sonunda kapanır
  });
});

describe("TCMB cap rate (statement-debt tier)", () => {
  it("selects card tier by statement balance", () => {
    expect(tcmbCapRate("credit_card", 20000)).toBe(0.0325);
    expect(tcmbCapRate("credit_card", 100000)).toBe(0.0375);
    expect(tcmbCapRate("credit_card", 200000)).toBe(0.0425);
  });
  it("uses KMH cash-advance rate", () => {
    expect(tcmbCapRate("kmh", 22000)).toBe(0.0425);
  });
  it("user override beats the cap", () => {
    const r = resolveMonthlyRate("credit_card", 71000, 0.029);
    expect(r.monthlyRate).toBe(0.029);
    expect(r.source).toBe("user");
  });
});

describe("minimum trap & extra", () => {
  it("returns a verdict and positive estimated interest", () => {
    const t = minimumTrap({ kind: "credit_card", balance: 71000, cardLimit: 90000 });
    expect(t.nextMonthInterest).toBeGreaterThan(0);
    expect(["shrinks", "barely_shrinks", "not_shrinking", "growing"]).toContain(t.verdict);
    expect(t.rateIsEstimate).toBe(true);
  });
  it("computes avoided interest from extra payment", () => {
    const avoided = avoidedInterestFromExtra({ kind: "kmh", balance: 22000 }, 2000);
    expect(avoided).toBeCloseTo(2000 * 0.0425);
  });
});

describe("daysUntilDue", () => {
  it("counts days to next occurrence of the due day", () => {
    const today = new Date(2026, 5, 14); // 14 Haz 2026
    expect(daysUntilDue(19, today)).toBe(5);
    expect(daysUntilDue(14, today)).toBe(0);
    expect(daysUntilDue(1, today)).toBeGreaterThan(0);
  });
});

describe("installment derivation (§1)", () => {
  it("counts installments paid (first installment inclusive)", () => {
    const first = new Date(2026, 0, 15); // 15 Oca 2026
    expect(installmentsPaid(first, 12, new Date(2026, 0, 14))).toBe(0); // gününden önce
    expect(installmentsPaid(first, 12, new Date(2026, 0, 15))).toBe(1); // ilk taksit günü
    expect(installmentsPaid(first, 12, new Date(2026, 3, 20))).toBe(4); // Nisan
    expect(installmentsPaid(first, 12, new Date(2030, 0, 1))).toBe(12); // termCount ile sınırlı
  });
  it("derives outstanding from remaining installments", () => {
    const d = { installment: 5000, termCount: 10, firstInstallmentDate: new Date(2026, 0, 15) };
    // Mart 2026'da 3 taksit ödenmiş -> 7 kaldı -> 35.000
    expect(outstandingInstallment(d, new Date(2026, 2, 15))).toBe(35000);
  });
  it("multi-installment payment covers floor(amount/installment) taksit", () => {
    expect(installmentsCoveredByPayment(8750, 8750)).toBe(1);
    expect(installmentsCoveredByPayment(26250, 8750)).toBe(3); // 3 taksit birden
    expect(installmentsCoveredByPayment(5000, 8750)).toBe(0); // taksitten az -> 0
    expect(installmentsCoveredByPayment(1000, 0)).toBe(0);
  });
  it("outstandingBalance uses raw balance for card/kmh, derived for installment", () => {
    expect(outstandingBalance({ kind: "credit_card", balance: 71000 })).toBe(71000);
    expect(
      outstandingBalance(
        {
          kind: "loan",
          balance: 0,
          installment: 5000,
          termCount: 10,
          firstInstallmentDate: new Date(2026, 0, 15),
        },
        new Date(2026, 2, 15)
      )
    ).toBe(35000);
  });
});

describe("asset valuation & P/L (§2)", () => {
  it("values priced assets by quantity × (last ?? buy) × fx", () => {
    expect(assetNativeValue({ kind: "stock", balance: 0, quantity: 10, buyPrice: 100, lastPrice: 130 })).toBe(1300);
    // fx: USD hissesi, 1 USD = 33 TRY
    expect(assetValueTRY({ kind: "stock", balance: 0, quantity: 10, buyPrice: 100, lastPrice: 130 }, 33)).toBe(42900);
  });
  it("falls back to buy price when last price missing", () => {
    expect(assetNativeValue({ kind: "crypto", balance: 0, quantity: 2, buyPrice: 50000, lastPrice: null })).toBe(100000);
  });
  it("computes P/L only when last price exists", () => {
    expect(assetPnlTRY({ kind: "commodity", balance: 0, quantity: 100, buyPrice: 40, lastPrice: 52 })).toBe(1200);
    expect(assetPnlTRY({ kind: "commodity", balance: 0, quantity: 100, buyPrice: 40, lastPrice: null })).toBeNull();
    expect(assetPnlTRY({ kind: "cash", balance: 1000 })).toBeNull();
  });
});

describe("cashflow projection (§5)", () => {
  it("nets income minus recurring expense minus debt due per month", () => {
    const rows = projectCashflow(
      [
        { amount: 50000, direction: "income", recurrence: "monthly" }, // maaş
        { amount: 12000, direction: "expense", recurrence: "monthly" }, // kira gideri
      ],
      [
        { kind: "credit_card", monthlyMinimum: 8000 },
        { kind: "loan", installment: 7000, termCount: 2, firstInstallmentDate: new Date(2026, 5, 10) },
      ],
      3,
      new Date(2026, 5, 1) // Haz
    );
    // Haz & Tem: taksit aktif -> debtDue = 8000 + 7000 = 15000 ; net = 50000-12000-15000 = 23000
    expect(rows[0].debtDue).toBe(15000);
    expect(rows[0].net).toBe(23000);
    // Ağu: taksit bitti -> debtDue = 8000 ; net = 30000
    expect(rows[2].debtDue).toBe(8000);
    expect(rows[2].net).toBe(30000);
  });

  it("counts one-time entries only in their month", () => {
    const rows = projectCashflow(
      [
        { amount: 40000, direction: "income", recurrence: "monthly" },
        { amount: 10000, direction: "income", recurrence: "one_time", occurredOn: new Date(2026, 6, 5) }, // Tem temettü
      ],
      [],
      3,
      new Date(2026, 5, 1) // Haz
    );
    expect(rows[0].income).toBe(40000); // Haz: yalnız maaş
    expect(rows[1].income).toBe(50000); // Tem: maaş + tek seferlik
    expect(rows[2].income).toBe(40000); // Ağu: yalnız maaş
  });
});
