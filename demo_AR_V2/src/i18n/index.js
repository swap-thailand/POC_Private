import en from './en.js';
import th from './th.js';
import { brand } from '../config/brand.js';

const dict = { en, th };
const LANG_KEY = `${brand.slug}-lang`;

let lang = 'en';
try { lang = localStorage.getItem(LANG_KEY) === 'th' ? 'th' : 'en'; } catch { /* storage unavailable */ }

export const getLang = () => lang;
export function setLang(next) {
  lang = next === 'th' ? 'th' : 'en';
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
}

function brandVars() {
  return {
    brand: brand.name, tagline: brand.tagline[lang], headline: brand.headline[lang],
    secondary: brand.secondaryLine[lang], hashtag: brand.hashtag, line: brand.lineHandle,
  };
}

// t('key', { n: 3 }) → translated string with {placeholders} filled.
export function t(key, vars = {}) {
  const raw = dict[lang][key] ?? dict.en[key] ?? key;
  const all = { ...brandVars(), ...vars };
  return String(raw).replace(/\{(\w+)\}/g, (m, name) => (name in all ? all[name] : m));
}

// Picks the right language from a { en, th } object, or returns a plain string.
export const tx = value => (value && typeof value === 'object' ? value[lang] ?? value.en : value ?? '');
