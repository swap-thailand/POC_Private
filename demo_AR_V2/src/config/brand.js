// Every brand value lives here. Rename the product by editing this file only.
// Copy anywhere else refers to {brand}, {tagline} etc. through the i18n helper.
export const brand = {
  name: 'JingTix',
  shortName: 'JingTix',
  // Header logo: 'orbit', 'ring' or 'swap' (see src/lib/logo.js).
  logo: 'swap',
  logoMark: '↘', // text fallback, no longer shown in the header
  tagline: { en: 'The nightlife ticket swap', th: 'แลกตั๋วสายไนท์ไลฟ์' },
  headline: { en: 'Find your way in.', th: 'หาทางเข้างานของคุณ' },
  secondaryLine: { en: 'Fan to fan, fair prices, fully protected.', th: 'แฟนถึงแฟน ราคาแฟร์ ปลอดภัยทุกใบ' },
  hashtag: '#keepitjing',
  lineHandle: '@jingtix',
  // Official accounts (from the Socials tab of the team doc). Shown in the footer and on About us.
  socials: [
    { id: 'instagram', label: 'Instagram', emoji: '📸', handle: '@jingtix', url: 'https://www.instagram.com/jingtix/' },
    { id: 'x', label: 'X', emoji: '𝕏', handle: '@jingtix', url: 'https://x.com/jingtix' },
    { id: 'facebook', label: 'Facebook', emoji: '📘', handle: 'JingTix', url: 'https://www.facebook.com/profile.php?id=61596768340479' },
  ],
  supportEmail: 'hello@example.com',
  // Used for browser storage keys and file names. Lowercase, no spaces.
  slug: 'jingtix',
};
