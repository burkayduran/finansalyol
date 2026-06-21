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
