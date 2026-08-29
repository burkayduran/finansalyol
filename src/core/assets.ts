// Varlık değerleme + kâr/zarar. Manuel-önce: kullanıcı fiyatı (buy_price/last_price)
// elle girilir; oto-fiyat bunun üstüne eklenen bir katmandır (last_price güncellenir).

export type AssetKind =
  | "cash"
  | "deposit"
  | "fund"
  | "stock"
  | "gold"
  | "fx"
  | "commodity"
  | "crypto"
  | "other";

/** Maliyet/fiyat bazlı (adet × birim fiyat) değerlenen türler. */
export const PRICED_KINDS: AssetKind[] = ["fund", "stock", "gold", "commodity", "crypto"];

export interface AssetValueInput {
  kind: AssetKind;
  balance: number;
  quantity?: number | null;
  buyPrice?: number | null;
  lastPrice?: number | null;
}

/** Birim fiyat: güncel (last) varsa onu, yoksa alış (buy) fiyatını kullan. */
export function unitPrice(a: AssetValueInput): number | null {
  if (a.lastPrice != null) return a.lastPrice;
  if (a.buyPrice != null) return a.buyPrice;
  return null;
}

/**
 * Varlığın o para birimi cinsinden (native) değeri.
 *  - priced türler: quantity × (lastPrice ?? buyPrice)
 *  - diğerleri: balance
 */
export function assetNativeValue(a: AssetValueInput): number {
  if (PRICED_KINDS.includes(a.kind)) {
    const price = unitPrice(a);
    if (price == null || a.quantity == null) return 0;
    return a.quantity * price;
  }
  return a.balance;
}

/** TRY cinsinden değer. fxRate = 1 birim para birimi kaç TRY (TRY için 1). */
export function assetValueTRY(a: AssetValueInput, fxRate = 1): number {
  return assetNativeValue(a) * fxRate;
}

/**
 * Kâr/zarar (TRY). Yalnız maliyet bazlı türlerde ve last_price varken hesaplanır;
 * last_price yoksa null ("fiyat bekleniyor").
 */
export function assetPnlTRY(a: AssetValueInput, fxRate = 1): number | null {
  if (!PRICED_KINDS.includes(a.kind)) return null;
  if (a.lastPrice == null || a.buyPrice == null || a.quantity == null) return null;
  return (a.lastPrice - a.buyPrice) * a.quantity * fxRate;
}
