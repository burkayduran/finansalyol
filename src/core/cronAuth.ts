// Cron endpoint secret doğrulaması (saf). Edge Function'lar bu kuralı uygular.
// Secret yoksa/eşleşmezse erişim reddedilir (fail-closed).

/** Sabit-zamanlı string karşılaştırma (kısa devre yok). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Authorization: Bearer <secret> veya x-cron-secret başlığından secret'ı çıkar. */
export function extractCronSecret(get: (name: string) => string | null | undefined): string | null {
  const auth = get("authorization") ?? get("Authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  const x = get("x-cron-secret") ?? get("X-Cron-Secret");
  return x ?? null;
}

/** Sağlanan secret beklenenle eşleşiyor mu? (beklenen yoksa reddet) */
export function checkCronSecret(provided: string | null | undefined, expected: string | undefined | null): boolean {
  if (!expected) return false;
  if (!provided) return false;
  return timingSafeEqual(provided, expected);
}
