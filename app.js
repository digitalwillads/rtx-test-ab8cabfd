// RTX PRO 6000 test report: the moving pictures. Every number comes from the test's saved results (see each page's notes).
// Each picture plays once when it scrolls into view; "Play again" replays it; reduced motion shows the end state at once.
'use strict';
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

function whenSeen(el, play) {
  const btn = el.querySelector('.replay');
  if (btn) btn.addEventListener('click', () => play(el));
  if (still || !('IntersectionObserver' in window)) { play(el); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); play(el); }
  }, { threshold: 0.35 });
  io.observe(el);
}

// One tooltip per chart: any mark with data-tip shows it on hover or focus.
function tips(container) {
  const tip = document.createElement('div');
  tip.className = 'tip';
  container.appendChild(tip);
  const show = (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.classList.remove('on'); return; }
    const box = container.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    tip.textContent = t.getAttribute('data-tip');
    tip.style.left = `${r.left + r.width / 2 - box.left}px`;
    tip.style.top = `${r.top - box.top}px`;
    tip.classList.add('on');
  };
  container.addEventListener('mouseover', show);
  container.addEventListener('focusin', show);
  container.addEventListener('mouseleave', () => tip.classList.remove('on'));
}

// Summary page: one full round of the ten tasks, each bar filling at its real pace (1 minute of the test = 1 second here).
function playRace(el) {
  el.querySelectorAll('.lane').forEach((lane) => {
    const minutes = parseFloat(lane.dataset.minutes);
    const fill = lane.querySelector('.fill');
    const label = lane.querySelector('.time');
    if (still) { fill.style.width = '100%'; label.textContent = `${minutes.toFixed(1)} min`; return; }
    const t0 = performance.now();
    const ms = minutes * 1000;
    const step = (now) => {
      const f = Math.min(1, (now - t0) / ms);
      fill.style.width = `${f * 100}%`;
      label.textContent = `${(f * minutes).toFixed(1)} min`;
      if (f < 1) requestAnimationFrame(step);
    };
    fill.style.width = '0';
    requestAnimationFrame(step);
  });
}

// Speed page: words a second that each person sees, at 1, 4 and 8 people at once, against Opus's measured band.
function drawSpeed(el) {
  const holder = el.querySelector('.chart');
  if (!holder.querySelector('svg')) {
    const data = JSON.parse(holder.dataset.bars);
    const band = JSON.parse(holder.dataset.band);
    const W = 640, H = 300, L = 44, B = 36, T = 16, max = 200;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': holder.getAttribute('aria-label') }, holder);
    const y = (v) => H - B - (v / max) * (H - B - T);
    for (let v = 0; v <= max; v += 50) {
      svgEl('line', { x1: L, x2: W - 8, y1: y(v), y2: y(v), class: v ? 'gridline' : 'baseline' }, svg);
      svgEl('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'axis' }, svg).textContent = v;
    }
    const bandRect = svgEl('rect', { x: L, width: W - 8 - L, y: y(band.hi), height: y(band.lo) - y(band.hi), fill: 'var(--opus)', opacity: 0.16 }, svg);
    bandRect.setAttribute('data-tip', `Opus streams ${band.lo} to ${band.hi} words (tokens) a second in Will's sessions`);
    svgEl('text', { x: W - 12, y: y(band.hi) - 6, 'text-anchor': 'end' }, svg).textContent = `Opus, ${band.lo} to ${band.hi}`;
    const slot = (W - 8 - L) / data.length, bw = Math.min(84, slot * 0.46);
    data.forEach((d, i) => {
      const cx = L + slot * (i + 0.5);
      const bar = svgEl('rect', { x: cx - bw / 2, width: bw, y: y(0), height: 0, rx: 4, fill: 'var(--deepseek)', class: 'bar', tabindex: 0,
        'data-v': d.v, 'data-tip': `${d.label}: ${d.v} tokens a second each, ${d.total} in total` }, svg);
      bar.dataset.y = y(d.v);
      svgEl('text', { x: cx, y: y(d.v) - 8, 'text-anchor': 'middle', class: 'value' }, svg).textContent = d.v;
      svgEl('text', { x: cx, y: H - B + 22, 'text-anchor': 'middle' }, svg).textContent = d.label;
    });
    tips(holder);
  }
  holder.querySelectorAll('rect.bar').forEach((bar, i) => {
    const top = parseFloat(bar.dataset.y), base = parseFloat(bar.getAttribute('y')) + parseFloat(bar.getAttribute('height') || 0);
    const y0 = base, h = y0 - top;
    if (still) { bar.setAttribute('y', top); bar.setAttribute('height', h); return; }
    const t0 = performance.now() + i * 140;
    const step = (now) => {
      const f = Math.max(0, Math.min(1, (now - t0) / 700));
      const e = 1 - Math.pow(1 - f, 3);
      bar.setAttribute('y', y0 - h * e);
      bar.setAttribute('height', h * e);
      if (f < 1) requestAnimationFrame(step);
    };
    bar.setAttribute('y', y0); bar.setAttribute('height', 0);
    requestAnimationFrame(step);
  });
}

// Quality page: every run of every task as a square, filled in the order the runs happened.
function playRuns(el) {
  el.querySelectorAll('.squares').forEach((row) => {
    if (!row.children.length) {
      JSON.parse(row.dataset.runs).forEach(([ok, tip]) => {
        const s = document.createElement('span');
        s.className = `sq ${ok ? 'pass' : 'miss'}`;
        s.textContent = ok ? '✓' : '✗';
        s.setAttribute('data-tip', tip);
        s.setAttribute('tabindex', '0');
        s.setAttribute('aria-label', `${ok ? 'passed' : 'missed'}: ${tip}`);
        row.appendChild(s);
      });
      tips(row.closest('.picture'));
    }
    [...row.children].forEach((s, i) => {
      s.classList.remove('shown');
      if (still) { s.classList.add('shown'); return; }
      setTimeout(() => s.classList.add('shown'), 30 * i);
    });
  });
}

// Quality page: how many times sooner DeepSeek finished each task (Opus's median time divided by DeepSeek's).
function drawFaster(el) {
  const holder = el.querySelector('.chart');
  if (!holder.querySelector('svg')) {
    const data = JSON.parse(holder.dataset.bars);
    const W = 640, row = 30, L = 170, R = 56, T = 4;
    const H = T + data.length * row + 26, max = 35;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': holder.getAttribute('aria-label') }, holder);
    const x = (v) => L + (v / max) * (W - L - R);
    for (let v = 0; v <= max; v += 5) {
      svgEl('line', { x1: x(v), x2: x(v), y1: T, y2: H - 22, class: v ? 'gridline' : 'baseline' }, svg);
      svgEl('text', { x: x(v), y: H - 6, 'text-anchor': 'middle', class: 'axis' }, svg).textContent = `${v}×`;
    }
    data.forEach((d, i) => {
      const yy = T + i * row + 6;
      svgEl('text', { x: L - 10, y: yy + 13, 'text-anchor': 'end' }, svg).textContent = d.task;
      const bar = svgEl('rect', { x: L, y: yy, height: row - 12, width: 0, rx: 4, fill: 'var(--deepseek)', class: 'bar', tabindex: 0,
        'data-tip': `${d.task}: Opus ${d.opus} s, DeepSeek ${d.ds} s` }, svg);
      bar.dataset.w = x(d.ratio) - L;
      svgEl('text', { x: x(d.ratio) + 6, y: yy + 13, class: 'value' }, svg).textContent = `${d.ratio}×`;
    });
    tips(holder);
  }
  holder.querySelectorAll('rect.bar').forEach((bar, i) => {
    const w = parseFloat(bar.dataset.w);
    if (still) { bar.setAttribute('width', w); return; }
    const t0 = performance.now() + i * 70;
    const step = (now) => {
      const f = Math.max(0, Math.min(1, (now - t0) / 650));
      bar.setAttribute('width', w * (1 - Math.pow(1 - f, 3)));
      if (f < 1) requestAnimationFrame(step);
    };
    bar.setAttribute('width', 0);
    requestAnimationFrame(step);
  });
}

// What broke page: the whole rental as one bar, drawn in time order.
function playTimeline(el) {
  const bar = el.querySelector('.timeline');
  const start = bar.dataset.start, end = bar.dataset.end;
  const toMin = (hhmmss) => { const [h, m, s] = hhmmss.split(':').map(Number); return h * 60 + m + (s || 0) / 60; };
  const span = toMin(end) - toMin(start);
  const pos = (t) => ((toMin(t) - toMin(start)) / span) * 100;
  if (!bar.children.length) {
    JSON.parse(bar.dataset.segs).forEach(([from, to, kind, tip]) => {
      const s = document.createElement('div');
      s.className = `seg ${kind}`;
      s.style.left = `${pos(from)}%`;
      s.style.width = `${pos(to) - pos(from)}%`;
      s.setAttribute('data-tip', tip);
      bar.appendChild(s);
    });
    el.querySelectorAll('.ticks span, .marks .mark').forEach((m) => { m.style.left = `${pos(m.dataset.at)}%`; });
    tips(el);
  }
  [...bar.children].forEach((s, i) => {
    s.classList.remove('shown');
    if (still) { s.classList.add('shown'); return; }
    setTimeout(() => s.classList.add('shown'), 420 * i);
  });
}

document.querySelectorAll('[data-picture="race"]').forEach((el) => whenSeen(el, playRace));
document.querySelectorAll('[data-picture="speed"]').forEach((el) => whenSeen(el, drawSpeed));
document.querySelectorAll('[data-picture="runs"]').forEach((el) => whenSeen(el, playRuns));
document.querySelectorAll('[data-picture="faster"]').forEach((el) => whenSeen(el, drawFaster));
document.querySelectorAll('[data-picture="timeline"]').forEach((el) => whenSeen(el, playTimeline));
document.querySelectorAll('[data-picture="flow"] svg').forEach((svg) => { if (still && svg.pauseAnimations) svg.pauseAnimations(); });
