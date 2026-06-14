// "Örnek veriyle dene" vitrin verisi (§9). Sample ayrı analiz edilir.
// Tüm sayısal değerler İLLÜSTRATİFTİR.
import type { AppState } from "../core/types";

export function sampleState(): AppState {
  return {
    mode: "sample",
    strategy: "avalanche",
    profile: { monthlyIncome: 45000, extraBudget: 3000 },
    reminders: [],
    payments: [],
    debts: [
      {
        id: "sample-1",
        type: "credit_card",
        bank: "Garanti BBVA",
        balance: 71000,
        cardLimit: 90000,
        dueDay: 19,
      },
      {
        id: "sample-2",
        type: "loan",
        bank: "İş Bankası",
        balance: 64000,
        installment: 8750,
        dueDay: 25,
      },
      {
        id: "sample-3",
        type: "kmh",
        bank: "Enpara",
        balance: 22000,
        dueDay: 1,
      },
      {
        id: "sample-4",
        type: "credit_card",
        bank: "Akbank",
        balance: 28000,
        cardLimit: 40000,
        dueDay: 28,
      },
    ],
  };
}
