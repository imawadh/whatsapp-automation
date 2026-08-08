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
    // Kept short so the row still fits WhatsApp's 24-char cap with its icon.
    banking: 'ব্যাংক সহায়তা',
    medical: 'মেডিকেল বুকিং',
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

// The languages offered in the picker, labelled in their own script — a user
// who can't read English still has to be able to find their own row.
export const LANGS: { id: string; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' },
  { id: 'ur', label: 'اردو' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'bn', label: 'বাংলা' },
];

export const DEFAULT_LANG = 'en';

export function isSupportedLang(lang: string): boolean {
  return LANGS.some((l) => l.id === lang);
}

// One icon per service, shown on every menu row. Many people using this can't
// read the row text quickly (or at all), so the icon is the fastest way to find
// the right service — keep them concrete and unambiguous.
export const SERVICE_EMOJI: Record<string, string> = {
  cargo: '📦',
  flight: '✈️',
  visa: '🛂',
  jawazat: '🪪',
  typing: '⌨️',
  banking: '🏦',
  medical: '🏥',
  license: '🚗',
  attest: '📜',
  company: '🏢',
  home: '🔧',
  remit: '💸',
};

export function serviceLabel(lang: string, serviceId: string): string {
  const emoji = SERVICE_EMOJI[serviceId];
  return emoji ? `${emoji} ${t(lang, serviceId)}` : t(lang, serviceId);
}

// Copy for the deterministic (non-model) messages. The router writes its own
// replies; everything the code sends itself is translated from here.
const UI_STRINGS: Record<string, Record<string, string>> = {
  en: {
    welcome: '👋 Welcome to Rafeeq!\n🌐 Please choose your language.',
    langSet: '✅ Language set to English.',
    menuPrompt: '👇 What do you need today?',
    menuButton: 'Choose service',
    servicesSection: 'Services',
    more: '➕ More services',
    moreDesc: 'See the rest of the list',
    back: '◀️ Back',
    backDesc: 'Return to the first page',
    serviceSelected:
      '{service}\n\n✍️ Tell me in a few words what you need, and I will take it from there.',
  },
  ar: {
    welcome: '👋 أهلاً بك في رفيق!\n🌐 من فضلك اختر لغتك.',
    langSet: '✅ تم تعيين اللغة إلى العربية.',
    menuPrompt: '👇 ما الذي تحتاجه اليوم؟',
    menuButton: 'اختر الخدمة',
    servicesSection: 'الخدمات',
    more: '➕ خدمات أخرى',
    moreDesc: 'عرض بقية القائمة',
    back: '◀️ رجوع',
    backDesc: 'العودة إلى الصفحة الأولى',
    serviceSelected:
      '{service}\n\n✍️ أخبرني باختصار بما تحتاجه وسأتولى الباقي.',
  },
  ur: {
    welcome: '👋 رفیق میں خوش آمدید!\n🌐 براہ کرم اپنی زبان منتخب کریں۔',
    langSet: '✅ زبان اردو مقرر کر دی گئی۔',
    menuPrompt: '👇 آج آپ کو کس چیز کی ضرورت ہے؟',
    menuButton: 'خدمت منتخب کریں',
    servicesSection: 'خدمات',
    more: '➕ مزید خدمات',
    moreDesc: 'باقی فہرست دیکھیں',
    back: '◀️ واپس',
    backDesc: 'پہلے صفحے پر واپس جائیں',
    serviceSelected:
      '{service}\n\n✍️ مجھے مختصر بتائیں آپ کو کیا چاہیے، باقی میں سنبھال لوں گا۔',
  },
  hi: {
    welcome: '👋 रफ़ीक़ में आपका स्वागत है!\n🌐 कृपया अपनी भाषा चुनें।',
    langSet: '✅ भाषा हिन्दी सेट कर दी गई।',
    menuPrompt: '👇 आज आपको क्या चाहिए?',
    menuButton: 'सेवा चुनें',
    servicesSection: 'सेवाएँ',
    more: '➕ और सेवाएँ',
    moreDesc: 'बाकी सूची देखें',
    back: '◀️ वापस',
    backDesc: 'पहले पेज पर लौटें',
    serviceSelected:
      '{service}\n\n✍️ कुछ शब्दों में बताइए आपको क्या चाहिए, आगे मैं संभाल लूँगा।',
  },
  bn: {
    welcome: '👋 রফিক-এ স্বাগতম!\n🌐 অনুগ্রহ করে আপনার ভাষা বাছুন।',
    langSet: '✅ ভাষা বাংলা নির্ধারণ করা হয়েছে।',
    menuPrompt: '👇 আজ আপনার কী প্রয়োজন?',
    menuButton: 'সেবা বাছুন',
    servicesSection: 'সেবা',
    more: '➕ আরও সেবা',
    moreDesc: 'বাকি তালিকা দেখুন',
    back: '◀️ পিছনে',
    backDesc: 'প্রথম পাতায় ফিরুন',
    serviceSelected:
      '{service}\n\n✍️ কয়েকটি কথায় বলুন আপনার কী দরকার, বাকিটা আমি দেখছি।',
  },
};

export function ui(
  lang: string,
  key: string,
  vars: Record<string, string> = {},
): string {
  const template =
    UI_STRINGS[lang]?.[key] ?? UI_STRINGS[DEFAULT_LANG][key] ?? key;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value),
    template,
  );
}
