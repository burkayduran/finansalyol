// Mevduat getiri hesabı (gün + faiz + stopaj). Faiz tahmini olduğu için UI'da
// küçük "≈ tahmini" kalır; stopaj kullanıcıdan alınır (oranlar değişir, gömme).

export interface DepositInput {
  principal: number;
  annualRate: number; // yıllık faiz %, örn 45
  termDays: number; // vade (gün), örn 92
  stopaj: number; // stopaj %, örn 7.5
  startDate?: Date;
}

export interface DepositYield {
  grossInterest: number;
  tax: number;
  netInterest: number;
  maturityValue: number;
  maturityDate: Date;
}

export function depositYield(i: DepositInput): DepositYield {
  const gross = i.principal * (i.annualRate / 100) * (i.termDays / 365);
  const tax = gross * (i.stopaj / 100);
  const net = gross - tax;
  const start = i.startDate ?? new Date();
  const maturityDate = new Date(start);
  maturityDate.setDate(maturityDate.getDate() + i.termDays);
  return {
    grossInterest: gross,
    tax,
    netInterest: net,
    maturityValue: i.principal + net,
    maturityDate,
  };
}
