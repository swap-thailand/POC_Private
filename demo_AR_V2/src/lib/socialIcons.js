// Simple one-colour icons for our social accounts (they take the text colour).
const wrap = body => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">${body}</svg>`;

export const socialIcons = {
  instagram: wrap(`<rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" stroke-width="2.2"/>
    <circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="17.4" cy="6.6" r="1.4" fill="currentColor"/>`),
  x: wrap(`<path d="M3.5 3h5l12 18h-5z" fill="currentColor"/><path d="M19.6 3L4.4 21" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>`),
  facebook: wrap(`<path d="M13.6 22v-8.1h2.8l.45-3.3h-3.25V8.6c0-.95.3-1.6 1.65-1.6h1.75V4.1c-.3-.05-1.35-.13-2.55-.13-2.5 0-4.2 1.53-4.2 4.33v2.3H7.4v3.3h2.85V22z" fill="currentColor"/>`),
};
