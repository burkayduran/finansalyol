// Sıcak, sakin palet — "Gece laciverti + bakır".
// Marka rengi (primary) YALNIZCA aksiyona saklanır: birincil buton, aktif sekme,
// link, aktif segment kenarı. Büyük alanlar marka rengiyle boyanmaz.
// Borç=kırmızı / birikim=yeşil semantiği fonksiyoneldir.
export const colors = {
  bg: "#F3F4F6",
  surface: "#FFFFFF",
  ink: "#16203A",
  inkSoft: "#586079",
  muted: "#9AA1B0",
  line: "#E6E8EC",
  primary: "#233056",
  primaryInk: "#FFFFFF",
  accent: "#C2772E", // bakır — vurgu, az kullan
  primarySoft: "#E7EAF1", // aktif segment/zemin tint
  danger: "#C0392B",
  ok: "#1E7F5C",
  debt: "#C0392B",
  asset: "#1E7F5C",
};

// Rozet renkleri tek yerde (ileride koyu mod tek dosyadan).
export const badge = {
  neutralBg: "#E6E8EC", neutralInk: "#586079",
  warnBg: "#FDE68A", warnInk: "#92400E",
  okBg: "#DCFCE7", okInk: "#166534",
  dangerBg: "#FEE2E2", dangerInk: "#991B1B",
};

// Pano donut paleti — aile kimliğine hizalı (mor çıktı; gri son sırada "Ortak/Diğer").
export const SLICE_COLORS = ["#233056", "#C2772E", "#3E5A8C", "#1E7F5C", "#8C2F39", "#586079"];

export const radius = 16;
export const spacing = (n: number) => n * 8;

// Merkezi tipografi — tüm ekranlar bunu kullanır (tutarlılık).
export const typography = {
  screenTitle: { fontSize: 20, fontWeight: "800" as const },
  cardTitle: { fontSize: 16, fontWeight: "800" as const },
  heroAmount: { fontSize: 34, fontWeight: "800" as const },
  statAmount: { fontSize: 20, fontWeight: "800" as const },
  rowAmount: { fontSize: 15, fontWeight: "700" as const },
  label: { fontSize: 12, fontWeight: "600" as const },
  body: { fontSize: 14, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
};
