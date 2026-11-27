// The JingTix logo mark: a notched ticket inside a circle, with a dot in orbit.
// Pick a style with brand.logo in src/config/brand.js ('orbit', 'ring' or 'swap').
// Colors come from CSS: lines use currentColor, the ticket face uses --logo-face and the
// orbiting dot uses --logo-accent (black for now; set it to the brand orange later).

const ACCENT = 'fill:var(--logo-accent,currentColor)';

// Ticket shape centred on 0,0: rounded corners and a half-circle notch in the middle of each
// short end. Returns the outline path plus where the tear line sits.
function ticketShape(w) {
  const h = w * .55, x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  const s = w * .19, n = h * .2, r = w * .07;
  const f = v => +v.toFixed(2);
  const d = [
    `M${f(x0 + r)} ${f(y0)}`, `L${f(x1 - r)} ${f(y0)}`, `A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y0 + r)}`,
    `L${f(x1)} ${f(-n)}`, `A${f(n)} ${f(n)} 0 0 0 ${f(x1)} ${f(n)}`,
    `L${f(x1)} ${f(y1 - r)}`, `A${f(r)} ${f(r)} 0 0 1 ${f(x1 - r)} ${f(y1)}`,
    `L${f(x0 + r)} ${f(y1)}`, `A${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(y1 - r)}`,
    `L${f(x0)} ${f(n)}`, `A${f(n)} ${f(n)} 0 0 0 ${f(x0)} ${f(-n)}`,
    `L${f(x0)} ${f(y0 + r)}`, `A${f(r)} ${f(r)} 0 0 1 ${f(x0 + r)} ${f(y0)}`, 'Z',
  ].join(' ');
  return { d, s: f(s), y0: f(y0), y1: f(y1) };
}

// Outlined ticket with a dashed tear line running straight across near one end.
const ticket = (w, sw) => {
  const { d, s, y0, y1 } = ticketShape(w);
  return `<path d="${d}" style="fill:var(--logo-face,#fff)" stroke="currentColor" stroke-width="${sw}" stroke-linejoin="round"/>
    <line x1="${s}" y1="${+(y0 + .9).toFixed(2)}" x2="${s}" y2="${+(y1 - .9).toFixed(2)}" stroke="currentColor" stroke-width="${+(sw * .75).toFixed(2)}" stroke-dasharray="1.2 1.1"/>`;
};

// A dot that travels one full turn round a circle of radius r. For an elliptical orbit, wrap it
// in scale(1 k) and pass the same k: the dot counter-rotates and is pre-stretched so it stays round.
const orbitDot = (r, size, dur, start = 0, k = 1) => `<g transform="rotate(${start})">
    <g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${dur}s" repeatCount="indefinite"/>
      <g transform="translate(${r} 0)"><g>
        <animateTransform attributeName="transform" type="rotate" from="${-start}" to="${-start - 360}" dur="${dur}s" repeatCount="indefinite"/>
        <ellipse rx="${size}" ry="${(size / k).toFixed(2)}" style="${ACCENT}"/></g></g></g></g>`;

// Two arrowheads riding the ring together, half a turn apart: the swap. A thin halo in the
// background colour opens a clean gap in the dashed ring under each arrow.
const swapArrows = (r, len, wid, dur, start = -60) => `<g transform="rotate(${start})">
    <g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${dur}s" repeatCount="indefinite"/>
      ${[0, 180].map(a => `<g transform="rotate(${a}) translate(${r} 0) rotate(90)"><path d="M${+(len * .6).toFixed(2)} 0 L${+(-len * .4).toFixed(2)} ${+(-wid / 2).toFixed(2)} L${+(-len * .4).toFixed(2)} ${+(wid / 2).toFixed(2)} Z" style="${ACCENT};stroke:var(--logo-face,#fff);stroke-width:1;paint-order:stroke;stroke-linejoin:round"/></g>`).join('')}
    </g></g>`;

const STYLES = {
  // Version 1: outlined circle, tilted orbit ring, ticket in the middle.
  orbit: () => `
    <circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <g transform="translate(16 16) rotate(-24)">
      <ellipse rx="11.8" ry="8" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1"/>
      <g transform="scale(1 .678)">${orbitDot(11.8, 2.3, 6, 200, .678)}</g>
      ${ticket(15, 1.4)}
    </g>`,

  // Version 3: the circle itself is the orbit, a dashed ring with the dot travelling round it.
  ring: () => `
    <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2.4"/>
    <g transform="translate(16 16)">${orbitDot(14, 2.3, 7, -60)}</g>
    <g transform="translate(16 16) rotate(-24)">${ticket(18, 1.6)}</g>`,

  // Version 4: the ring with two swap arrows travelling round it instead of the dot.
  swap: () => `
    <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2.4"/>
    <g transform="translate(16 16)">${swapArrows(14, 5.2, 5, 8)}</g>
    <g transform="translate(16 16) rotate(-24)">${ticket(18, 1.6)}</g>`,
};

export const LOGO_STYLES = Object.keys(STYLES);

export function logoSvg(style = 'orbit', { title = '' } = {}) {
  const body = (STYLES[style] || STYLES.orbit)();
  return `<svg class="logo-mark" viewBox="0 0 32 32" width="32" height="32" xmlns="http://www.w3.org/2000/svg" ${title ? `role="img" aria-label="${title}"` : 'aria-hidden="true"'}>${body}</svg>`;
}

// Browser-tab icon. Thin lines vanish at 16 px, so this is a bolder static version of the mark:
// a solid black circle with a white notched ticket and a black tear line. The thin white edge keeps
// the circle visible on dark browser tabs.
export function faviconSvg() {
  const { d, s, y0, y1 } = ticketShape(24);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <circle cx="16" cy="16" r="15.5" fill="#000" stroke="#fff" stroke-width="1"/>
  <g transform="translate(16 16) rotate(-24)"><path d="${d}" fill="#fff"/>
    <line x1="${s}" y1="${y0 + 1.6}" x2="${s}" y2="${y1 - 1.6}" stroke="#000" stroke-width="1.8" stroke-dasharray="2.2 1.8"/></g></svg>`;
}

export const faviconHref = () => 'data:image/svg+xml,' + encodeURIComponent(faviconSvg());
