export { flowFor } from './flows.ts';

// Static service catalog for the Rafeeq router. This drives the system prompt
// only — pricing/partner data lives in Postgres (see prisma/schema.prisma) and
// must never be surfaced by the model directly.
const SERVICE_NAMES: Record<string, Record<string, string>> = {
  en: {
    cargo: 'Cargo & Courier',
    flight: 'Flight Tickets',
    visa: 'Visa Services',
    jawazat: 'Jawazat / Iqama',
    typing: 'Typing Centre',
    banking: 'Bank Account Help',
    medical: 'Medical Appointments',
    license: 'Driving Licence',
    attest: 'Document Attestation',
    company: 'Business Setup',
    home: 'Home Maintenance',
    remit: 'Money Transfer',
  },
  ar: {
    cargo: 'الشحن والتوصيل',
    flight: 'تذاكر الطيران',
    visa: 'خدمات التأشيرات',
    jawazat: 'الجوازات / الإقامة',
    typing: 'مكتب الطباعة',
    banking: 'مساعدة الحساب البنكي',
    medical: 'المواعيد الطبية',
    license: 'رخصة القيادة',
    attest: 'تصديق الوثائق',
    company: 'تأسيس الأعمال',
    home: 'صيانة المنزل',
    remit: 'تحويل الأموال',
  },
  ur: {
    cargo: 'کارگو اور کورئیر',
    flight: 'ہوائی ٹکٹ',
    visa: 'ویزا خدمات',
    jawazat: 'جوازات / اقامہ',
    typing: 'ٹائپنگ سینٹر',
    banking: 'بینک اکاؤنٹ مدد',
    medical: 'طبی اپائنٹمنٹ',
    license: 'ڈرائیونگ لائسنس',
    attest: 'دستاویزات کی تصدیق',
    company: 'کاروبار کا آغاز',
    home: 'گھر کی مرمت',
    remit: 'رقم بھیجنا',
  },
  hi: {
    cargo: 'कार्गो और कूरियर',
    flight: 'फ्लाइट टिकट',
    visa: 'वीज़ा सेवाएँ',
    jawazat: 'जवाज़ात / इक़ामा',
    typing: 'टाइपिंग सेंटर',
    banking: 'बैंक खाता मदद',
    medical: 'मेडिकल अपॉइंटमेंट',
    license: 'ड्राइविंग लाइसेंस',
    attest: 'दस्तावेज़ सत्यापन',
    company: 'बिज़नेस सेटअप',
    home: 'घर की मरम्मत',
    remit: 'पैसे भेजना',
  },
  bn: {
    cargo: 'কার্গো ও কুরিয়ার',
    flight: 'ফ্লাইট টিকিট',
    visa: 'ভিসা সেবা',
    jawazat: 'জাওয়াজাত / ইকামা',
    typing: 'টাইপিং সেন্টার',
    banking: 'ব্যাংক অ্যাকাউন্ট সহায়তা',
    medical: 'মেডিকেল অ্যাপয়েন্টমেন্ট',
    license: 'ড্রাইভিং লাইসেন্স',
    attest: 'নথি সত্যায়ন',
    company: 'ব্যবসা সেটআপ',
    home: 'বাড়ি মেরামত',
    remit: 'টাকা পাঠানো',
  },
};

export const SERVICES: { id: string }[] = Object.keys(SERVICE_NAMES.en).map(
  (id) => ({ id }),
);

export function t(lang: string, key: string): string {
  return SERVICE_NAMES[lang]?.[key] ?? SERVICE_NAMES.en[key] ?? key;
}
