// Every brand value lives here. Rename the product by editing this file only.
// Copy anywhere else refers to {brand}, {tagline} etc. through the i18n helper.
export const brand = {
  name: 'JingTix',
  shortName: 'JingTix',
  // Header logo: 'orbit' or 'ring' (see src/lib/logo.js).
  logo: 'ring',
  logoMark: '↘', // text fallback, no longer shown in the header
  tagline: { en: 'The nightlife ticket swap', th: 'แลกตั๋วสายไนท์ไลฟ์' },
  headline: { en: 'Find your way in.', th: 'หาทางเข้างานของคุณ' },
  secondaryLine: { en: 'Fan to fan, fair prices, fully protected.', th: 'แฟนถึงแฟน ราคาแฟร์ ปลอดภัยทุกใบ' },
  hashtag: '#keepitjing',
  lineHandle: '@jingtix',
  supportEmail: 'hello@example.com',
  // Used for browser storage keys and file names. Lowercase, no spaces.
  slug: 'jingtix',
};
