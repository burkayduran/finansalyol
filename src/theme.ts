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
