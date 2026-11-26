export const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const baht = n => '฿' + Number(n || 0).toLocaleString('en-US');

const locales = { en: 'en-GB', th: 'th-TH' };

export function eventDate(iso, lang) {
  return new Intl.DateTimeFormat(locales[lang] || 'en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok',
  }).format(new Date(iso));
}

export function shortDate(iso, lang) {
  return new Intl.DateTimeFormat(locales[lang] || 'en-GB', {
    day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok',
  }).format(new Date(iso));
}

export function dateTime(iso, lang) {
  return new Intl.DateTimeFormat(locales[lang] || 'en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
  }).format(new Date(iso));
}

// "1:05:09", "4:09" or "0:09"
export function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export const uid = prefix => `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

export function readFile(file, maxInline = 600 * 1024) {
  // Keeps a small data URL for previews in the sample demo. Large files keep only their name.
  return new Promise(resolve => {
    const meta = { name: file.name, type: file.type, size: file.size, dataUrl: null };
    if (file.size > maxInline || typeof FileReader === 'undefined') return resolve(meta);
    const reader = new FileReader();
    reader.onload = () => resolve({ ...meta, dataUrl: reader.result });
    reader.onerror = () => resolve(meta);
    reader.readAsDataURL(file);
  });
}
