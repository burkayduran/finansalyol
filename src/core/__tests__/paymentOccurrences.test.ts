import { describe, expect, it } from "vitest";
import {
  effectiveStatus,
  generateNextOccurrencesForDebt,
  getMandatoryAmountForDebt,
  recalculateOccurrenceStatus,
} from "../paymentOccurrences";

describe("getMandatoryAmountForDebt", () => {
  it("credit card uses BDDK minimum from limit/balance", () => {
    expect(
      getMandatoryAmountForDebt({ id: "c", kind: "credit_card", current_balance: 10000, card_limit: 40000 })
    ).toBeCloseTo(2000); // %20
  });
  it("credit card prefers user minimum when set", () => {
    expect(
      getMandatoryAmountForDebt({
        id: "c",
        kind: "credit_card",
        current_balance: 10000,
        card_limit: 40000,
        user_minimum_payment: 3500,
      })
    ).toBe(3500);
  });
  it("loan / installment_kmh use the installment", () => {
    expect(getMandatoryAmountForDebt({ id: "l", kind: "loan", monthly_installment: 8750 })).toBe(8750);
    expect(getMandatoryAmountForDebt({ id: "k", kind: "installment_kmh", monthly_installment: 5000 })).toBe(5000);
  });
  it("normal KMH is 0 unless user minimum set", () => {
    expect(getMandatoryAmountForDebt({ id: "k", kind: "kmh", current_balance: 22000 })).toBe(0);
    expect(getMandatoryAmountForDebt({ id: "k", kind: "kmh", current_balance: 22000, user_minimum_payment: 1500 })).toBe(1500);
  });
});

describe("generateNextOccurrencesForDebt", () => {
  const today = new Date(2026, 5, 1); // 1 Haz 2026

  it("credit card: monthly minimum occurrences on due_day", () => {
    const occ = generateNextOccurrencesForDebt(
      { id: "c", kind: "credit_card", current_balance: 10000, card_limit: 40000, due_day: 15 },
      3,
      today
    );
    expect(occ).toHaveLength(3);
    expect(occ[0].due_date).toBe("2026-06-15");
    expect(occ[0].amount_due).toBeCloseTo(2000);
    expect(occ[0].kind).toBe("credit_card_minimum");
  });

  it("loan: one occurrence per remaining installment from next due date", () => {
    const occ = generateNextOccurrencesForDebt(
      {
        id: "l",
        kind: "loan",
        monthly_installment: 8750,
        remaining_installment_count: 2,
        total_installment_count: 12,
        next_due_date: "2026-06-25",
      },
      6,
      today
    );
    expect(occ).toHaveLength(2); // kalan 2, monthsAhead 6 olsa da
    expect(occ.map((o) => o.due_date)).toEqual(["2026-06-25", "2026-07-25"]);
    expect(occ[0].installment_no).toBe(11); // 12 - 2 + 1
    expect(occ[1].installment_no).toBe(12);
    expect(occ[0].kind).toBe("loan_installment");
  });

  it("installment_kmh behaves like loan", () => {
    const occ = generateNextOccurrencesForDebt(
      { id: "k", kind: "installment_kmh", monthly_installment: 5000, remaining_installment_count: 3, next_due_date: "2026-06-10" },
      12,
      today
    );
    expect(occ).toHaveLength(3);
    expect(occ[0].kind).toBe("installment_kmh");
  });

  it("normal KMH without user minimum produces no mandatory occurrence", () => {
    expect(
      generateNextOccurrencesForDebt({ id: "k", kind: "kmh", current_balance: 22000, due_day: 5 }, 3, today)
    ).toHaveLength(0);
  });
  it("normal KMH with user minimum produces occurrences", () => {
    const occ = generateNextOccurrencesForDebt(
      { id: "k", kind: "kmh", current_balance: 22000, due_day: 5, user_minimum_payment: 1500 },
      2,
      today
    );
    expect(occ).toHaveLength(2);
    expect(occ[0].kind).toBe("kmh_manual");
    expect(occ[0].amount_due).toBe(1500);
  });

  it("inactive debt produces nothing", () => {
    expect(
      generateNextOccurrencesForDebt({ id: "l", kind: "loan", monthly_installment: 1, remaining_installment_count: 5, next_due_date: "2026-06-25", is_active: false }, 3, today)
    ).toHaveLength(0);
  });
});

describe("recalculateOccurrenceStatus", () => {
  const today = new Date(2026, 5, 15);
  it("paid when amount_paid >= amount_due", () => {
    expect(recalculateOccurrenceStatus({ due_date: "2026-06-20", amount_due: 1000, amount_paid: 1000 }, today)).toBe("paid");
  });
  it("partial when 0 < paid < due and not past due", () => {
    expect(recalculateOccurrenceStatus({ due_date: "2026-06-20", amount_due: 1000, amount_paid: 400 }, today)).toBe("partial");
  });
  it("pending when nothing paid and not past due", () => {
    expect(recalculateOccurrenceStatus({ due_date: "2026-06-20", amount_due: 1000, amount_paid: 0 }, today)).toBe("pending");
  });
  it("overdue when past due and underpaid", () => {
    expect(recalculateOccurrenceStatus({ due_date: "2026-06-10", amount_due: 1000, amount_paid: 400 }, today)).toBe("overdue");
  });
  it("skipped stays skipped", () => {
    expect(recalculateOccurrenceStatus({ due_date: "2026-06-10", amount_due: 1000, amount_paid: 0, status: "skipped" }, today)).toBe("skipped");
  });
});

describe("effectiveStatus", () => {
  const today = new Date(2026, 5, 15); // 15 Haz 2026
  it("pending + dün vadeli → overdue", () => {
    expect(effectiveStatus({ status: "pending", due_date: "2026-06-14" }, today)).toBe("overdue");
  });
  it("partial + dün vadeli → overdue", () => {
    expect(effectiveStatus({ status: "partial", due_date: "2026-06-14" }, today)).toBe("overdue");
  });
  it("pending + bugün vadeli → pending (vade günü gecikme değil)", () => {
    expect(effectiveStatus({ status: "pending", due_date: "2026-06-15" }, today)).toBe("pending");
  });
  it("partial + gelecek vadeli → partial", () => {
    expect(effectiveStatus({ status: "partial", due_date: "2026-06-20" }, today)).toBe("partial");
  });
  it("paid + geçmiş → paid", () => {
    expect(effectiveStatus({ status: "paid", due_date: "2026-06-01" }, today)).toBe("paid");
  });
  it("overdue → overdue", () => {
    expect(effectiveStatus({ status: "overdue", due_date: "2026-06-01" }, today)).toBe("overdue");
  });
  it("skipped → skipped (geçmiş olsa da)", () => {
    expect(effectiveStatus({ status: "skipped", due_date: "2026-06-01" }, today)).toBe("skipped");
  });
});
