import { describe, expect, it } from "vitest";
import { parseTRYInput, formatTRY, formatPercent } from "../format";
import { mandatoryMinimum, bddkMinimumRate } from "../minimum";
import { resolveMonthlyRate, tcmbCapRate } from "../rateConfig";
import { minimumTrap, avoidedInterestFromExtra } from "../interest";
import { daysUntilDue } from "../dates";
import { depositYield } from "../deposit";
import { projectMonths } from "../projection";

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
  it("treats kmh_installment like a loan (mandatory = installment)", () => {
    expect(mandatoryMinimum({ kind: "kmh_installment", balance: 30000, installment: 5000 })).toBe(5000);
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
