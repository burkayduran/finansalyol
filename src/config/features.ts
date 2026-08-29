// Özellik bayrakları. Çalışmayan özellik açık toggle olarak durmaz (launch checklist P0.6).
// E-posta hatırlatma: Resend domain DNS doğrulaması + secrets hazır olunca açılır.
// EXPO_PUBLIC_EMAIL_ENABLED="true" ile açılır; aksi hâlde UI'da "Yakında".
export const FEATURES = {
  emailReminders: process.env.EXPO_PUBLIC_EMAIL_ENABLED === "true",
};
