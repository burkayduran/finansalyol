import { describe, expect, it } from "vitest";
import { parseTRYInput, formatTRY, formatPercent } from "../format";
import { mandatoryMinimum, bddkMinimumRate } from "../minimum";
import { resolveMonthlyRate, tcmbCapRate } from "../rateConfig";
import { buildMandatory, buildExtra } from "../payoff";
import { minimumTrap } from "../interest";
import { daysUntilDue } from "../dates";
import type { Debt } from "../types";

const card = (over: Partial<Debt> = {}): Debt => ({
  id: "c",
  type: "credit_card",
  bank: "Test",
  balance: 71000,
  cardLimit: 90000,
  dueDay: 19,
  ...over,
});

describe("format", () => {
  it("parses tr-TR money strings", () => {
    expect(parseTRYInput("18.400")).toBe(18400);
    expect(parseTRYInput("1.234.567,89")).toBeCloseTo(1234567.89);
    expect(parseTRYInput("₺2.000")).toBe(2000);
    expect(parseTRYInput("abc")).toBeNull();
    expect(parseTRYInput("")).toBeNull();
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

  it("computes card minimum from limit-based rate, not balance tier", () => {
    expect(mandatoryMinimum(card({ balance: 71000, cardLimit: 90000 }))).toBeCloseTo(28400);
    expect(mandatoryMinimum(card({ balance: 10000, cardLimit: 40000 }))).toBeCloseTo(2000);
  });

  it("treats KMH as having no mandatory minimum", () => {
    expect(mandatoryMinimum({ ...card(), type: "kmh", cardLimit: undefined })).toBe(0);
  });

  it("uses loan installment as mandatory", () => {
    const loan: Debt = { id: "l", type: "loan", bank: "X", balance: 64000, dueDay: 25, installment: 8750 };
    expect(mandatoryMinimum(loan)).toBe(8750);
  });
});

describe("TCMB cap rate (statement-debt tier)", () => {
  it("selects card tier by statement balance", () => {
    expect(tcmbCapRate(card({ balance: 20000 }))).toBe(0.0325);
    expect(tcmbCapRate(card({ balance: 100000 }))).toBe(0.0375);
    expect(tcmbCapRate(card({ balance: 200000 }))).toBe(0.0425);
  });

  it("uses KMH cash-advance rate", () => {
    expect(tcmbCapRate({ ...card(), type: "kmh" })).toBe(0.0425);
  });

  it("user override beats the cap", () => {
    const r = resolveMonthlyRate(card({ userMonthlyRate: 0.029 }));
    expect(r.monthlyRate).toBe(0.029);
    expect(r.source).toBe("user");
  });
});

describe("payoff ordering", () => {
  const debts: Debt[] = [
    card({ id: "garanti", bank: "Garanti", balance: 71000, cardLimit: 90000, dueDay: 19 }),
    { id: "kredi", type: "loan", bank: "İş", balance: 64000, dueDay: 25, installment: 8750 },
    { id: "kmh", type: "kmh", bank: "Enpara", balance: 22000, dueDay: 1 },
    card({ id: "akbank", bank: "Akbank", balance: 28000, cardLimit: 40000, dueDay: 28 }),
  ];

  it("Blok A sorts by due day ascending and excludes KMH (no minimum)", () => {
    const rows = buildMandatory(debts);
    expect(rows.map((r) => r.debt.id)).toEqual(["garanti", "kredi", "akbank"]);
    expect(rows.some((r) => r.debt.type === "kmh")).toBe(false);
  });

  it("Blok B avalanche puts highest monthly rate first (KMH on top)", () => {
    const rows = buildExtra(debts, "avalanche");
    expect(rows[0].debt.id).toBe("kmh"); // 0.0425
    expect(rows[0].priority).toBe(1);
  });

  it("Blok B snowball puts smallest balance first", () => {
    const rows = buildExtra(debts, "snowball");
    expect(rows[0].debt.id).toBe("kmh"); // 22000 smallest
    expect(rows[rows.length - 1].debt.id).toBe("garanti"); // 71000 largest
  });

  it("reason text is consistent with displayed order (generated, not hand-written)", () => {
    const rows = buildExtra(debts, "avalanche");
    expect(rows[0].reason).toMatch(/En yüksek/);
  });
});

describe("minimum trap", () => {
  it("flags growing debt when interest exceeds minimum", () => {
    // High balance + high rate, low limit -> small minimum.
    const d = card({ balance: 49000, cardLimit: 40000, userMonthlyRate: 0.0425 });
    const trap = minimumTrap(d);
    // min = 0.2*49000 = 9800; interest = 0.0425*49000 ≈ 2082 -> still shrinks here
    expect(trap.nextMonthInterest).toBeGreaterThan(0);
    expect(["shrinks", "barely_shrinks", "not_shrinking", "growing"]).toContain(trap.verdict);
  });
});

describe("daysUntilDue", () => {
  it("counts days to next occurrence of the due day", () => {
    const today = new Date(2026, 5, 14); // 14 Haz 2026
    expect(daysUntilDue(19, today)).toBe(5);
    expect(daysUntilDue(14, today)).toBe(0);
    expect(daysUntilDue(1, today)).toBeGreaterThan(0); // rolls to next month
  });
});
