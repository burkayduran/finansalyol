// TR banka listesi (F1 seed) — kod + ad. Kod, banka bazlı gruplama/filtre/logo için.
export interface Bank {
  code: string;
  name: string;
}

export const BANKS: Bank[] = [
  { code: "ziraat", name: "Ziraat Bankası" },
  { code: "isbank", name: "Türkiye İş Bankası" },
  { code: "garanti", name: "Garanti BBVA" },
  { code: "yapikredi", name: "Yapı Kredi" },
  { code: "akbank", name: "Akbank" },
  { code: "halkbank", name: "Halkbank" },
  { code: "vakifbank", name: "VakıfBank" },
  { code: "qnb", name: "QNB" },
  { code: "denizbank", name: "DenizBank" },
  { code: "teb", name: "TEB" },
  { code: "sekerbank", name: "Şekerbank" },
  { code: "ing", name: "ING" },
  { code: "hsbc", name: "HSBC" },
  { code: "fibabanka", name: "Fibabanka" },
  { code: "alternatifbank", name: "Alternatif Bank" },
  { code: "odeabank", name: "Odeabank" },
  { code: "burganbank", name: "Burgan Bank" },
  { code: "anadolubank", name: "Anadolubank" },
  { code: "icbc", name: "ICBC Turkey" },
  { code: "kuveytturk", name: "Kuveyt Türk" },
  { code: "albaraka", name: "Albaraka Türk" },
  { code: "turkiyefinans", name: "Türkiye Finans" },
  { code: "ziraatkatilim", name: "Ziraat Katılım" },
  { code: "vakifkatilim", name: "Vakıf Katılım" },
  { code: "emlakkatilim", name: "Emlak Katılım" },
  { code: "enpara", name: "Enpara" },
  { code: "cepteteb", name: "CEPTETEB" },
  { code: "papara", name: "Papara" },
  { code: "tosla", name: "Tosla" },
];

export const OTHER_BANK_CODE = "other";
export const OTHER_BANK = "Diğer";
