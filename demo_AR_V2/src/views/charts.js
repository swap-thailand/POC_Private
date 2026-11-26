// Small, dependency-free charts in the Lineup style: black marks, grey for context, no colour.
// Every mark carries data-tip for the shared hover/focus tooltip (see main.js), and every chart
// ships a visually hidden table so screen readers get the numbers too.
import { esc } from '../lib/format.js';

const srTable = (caption, head, rows) => `<table class="sr-only"><caption>${esc(caption)}</caption>
  <tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>
  ${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;

// Column chart. data: [{ label, value, tip, strong }]. Bars with strong:true are black, the rest grey.
// ticks: indexes whose labels show under the axis. Bars are SVG stretched to the box; all text is
// HTML so it stays readable at phone widths.
export function columns({ title, data, height = 170, ticks = [], valueLabel = v => v }) {
  const W = 600, H = 100, gap = 2;
  const max = Math.max(...data.map(d => d.value), 1);
  const nice = Math.ceil(max / 2) * 2;
  const bw = (W - gap * (data.length - 1)) / data.length;
  const pct = v => 100 * (1 - v / nice);
  const bars = data.map((d, i) => {
    const x = i * (bw + gap), top = H * (1 - d.value / nice), r = Math.min(4, H - top);
    const path = d.value > 0 ? `M${x} ${H}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + bw - r}Q${x + bw} ${top} ${x + bw} ${top + r}V${H}Z` : '';
    return `<g class="ch-col" data-tip="${esc(d.tip || `${d.label}: ${valueLabel(d.value)}`)}">
      <rect x="${x - gap / 2}" y="0" width="${bw + gap}" height="${H}" class="ch-hit"/>
      ${path ? `<path d="${path}" class="${d.strong ? 'ch-ink' : 'ch-mute'}"/>` : ''}</g>`;
  }).join('');
  const grid = [0.5, 1].map(f => `<span class="ch-gl" style="top:${pct(nice * f)}%"><em>${esc(valueLabel(nice * f))}</em></span>`).join('');
  const labels = ticks.map(i => `<span style="left:${((i * (bw + gap) + bw / 2) / W * 100).toFixed(2)}%" class="${i === 0 ? 'first' : i === data.length - 1 ? 'last' : ''}">${esc(data[i].label)}</span>`).join('');
  return `<figure class="ch-cols" style="--h:${height}px">
    <div class="ch-plot">${grid}<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(title)}">${bars}</svg></div>
    <div class="ch-ticks">${labels}</div>
    ${srTable(title, ['', ''], data.map(d => [d.label, valueLabel(d.value)]))}</figure>`;
}

// Horizontal bars with the label on the left and the value on the right.
// rows: [{ label, value, display, strong, tip }]. max defaults to the largest value.
export function rowBars({ title, rows, max }) {
  const m = max || Math.max(...rows.map(r => r.value), 1);
  return `<div class="ch-rows" role="img" aria-label="${esc(title)}">${rows.map(r => `
    <div class="ch-row" data-tip="${esc(r.tip || `${r.label}: ${r.display}`)}" tabindex="0">
      <span class="ch-lab">${esc(r.label)}</span>
      <span class="ch-track"><i class="${r.strong ? 'ch-ink' : 'ch-mute'}" style="width:${(r.value / m * 100).toFixed(1)}%"></i></span>
      <b>${esc(r.display)}</b></div>`).join('')}</div>
    ${srTable(title, ['', ''], rows.map(r => [r.label, r.display]))}`;
}

// Stacked horizontal bars that all share one scale. rows: [{ label, total, segs: [{ value, cls, tip }] }].
// legend: [{ cls, label }].
export function stacked({ title, rows, legend }) {
  const m = Math.max(...rows.map(r => r.segs.reduce((a, s) => a + s.value, 0)), 1);
  return `<div class="ch-legend">${legend.map(l => `<span><i class="${l.cls}"></i>${esc(l.label)}</span>`).join('')}</div>
  <div class="ch-rows ch-stack" role="img" aria-label="${esc(title)}">${rows.map(r => `
    <div class="ch-row"><span class="ch-lab">${esc(r.label)}</span>
      <span class="ch-track">${r.segs.map(s => `<i class="${s.cls}" style="width:${(s.value / m * 100).toFixed(2)}%" data-tip="${esc(s.tip)}" tabindex="0"></i>`).join('')}</span>
      <b>${esc(r.total)}</b></div>`).join('')}</div>
  ${srTable(title, ['', ...legend.map(l => l.label), ''], rows.map(r => [r.label, ...r.segs.map(s => s.tip), r.total]))}`;
}
