'use strict';
/**
 * The spot engine: paper, pens, money, stamp, end card, playback.
 *
 * Everything here is shared. What differs between the portrait cut
 * (index.html) and the landscape one (landscape.html) is a config object —
 * the canvas size, where things sit, the prompt, and the drawing itself —
 * handed to startSpot() at the bottom of each page.
 *
 * The clock is the only input: frame(t) draws exactly what the ad looks like
 * t seconds in and nothing else. That is what lets render-mp4.sh screenshot
 * the thing frame by frame at whatever speed it likes and still come out
 * frame-exact, and why ?t=4.7 shows you precisely the frame the video does.
 */

// The game's palette (theme.dart) and paper (drawing_canvas.dart).
const C = {
  bg: '#0B0920', surface: '#181341', border: '#322B66',
  primary: '#FFC53D', primaryDeep: '#E9A213', onPrimary: '#231700',
  pink: '#FF5C8A', cyan: '#3DDCFF', lime: '#9BE564', purple: '#B388FF',
  text: '#F6F4FF', muted: '#9E97CE',
  paper: '#FAF3E3', ink: '#1A1A1A', funded: '#1EA84A', note: '#2FA84F', notePaper: '#EFF7EA',
};

// --- tiny helpers -----------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
// Overshoots then settles — the "pop" every UI element here lands with.
const back = t => { t = clamp(t, 0, 1); const s = 1.70158; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
// Progress of a window [a, b] at time t: 0 before, 1 after.
const win = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

// Deterministic RNG (mulberry32, same as the server's doodle engine) so every
// take of the ad is identical — the hand wobble never changes between runs.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// --- drawing primitives -----------------------------------------------------
// Coordinates are 0..1 on the paper, like the game's own strokes. Each shape
// is clean geometry given the same three imperfections the server's pen gives
// bot drawings — a slow bow, a fine tremor, endpoints landing a hair off — so
// it reads as drawn by a steady person rather than printed.
let rand = rng(7);

function wobble(pts, amt = 1) {
  const bowAmp = (rand() * 2 - 1) * 0.006 * amt, phase = rand() * Math.PI;
  const n = pts.length - 1;
  return pts.map((p, i) => {
    const t = n ? i / n : 0;
    const bow = Math.sin(t * Math.PI + phase * .15) * bowAmp;
    const tremor = (rand() * 2 - 1) * 0.0014 * amt;
    return { x: p.x + bow + tremor, y: p.y + bow * .6 + tremor };
  });
}
function line(a, b, amt = 1) {
  const n = Math.max(6, Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 60));
  const pts = []; for (let i = 0; i <= n; i++) pts.push({ x: lerp(a.x, b.x, i / n), y: lerp(a.y, b.y, i / n) });
  return wobble(pts, amt);
}
function arc(cx, cy, rx, ry, from, to, amt = 1) {
  const n = Math.max(10, Math.round(Math.abs(to - from) * (rx + ry) * 60));
  const pts = []; for (let i = 0; i <= n; i++) { const a = lerp(from, to, i / n); pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }); }
  return wobble(pts, amt);
}
// Ellipse that starts at a random angle and doesn't quite close — the single
// most recognisable "drawn by a person" tell.
function ellipse(cx, cy, rx, ry, amt = 1) {
  const start = rand() * Math.PI * 2, sweep = Math.PI * 2 + (rand() * .3 - .1);
  return arc(cx, cy, rx, ry, start, start + sweep, amt);
}
function poly(pts, amt = 1) {
  let out = []; for (let i = 0; i < pts.length - 1; i++) { const seg = line(pts[i], pts[i + 1], amt); out = out.concat(i ? seg.slice(1) : seg); } return out;
}
function curve(pts, amt = 1) {  // Catmull-Rom through the points
  const out = []; for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < 12; s++) { const t = s / 12, t2 = t * t, t3 = t2 * t;
      out.push({ x: .5 * ((2*p1.x) + (-p0.x + p2.x)*t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x)*t3),
                 y: .5 * ((2*p1.y) + (-p0.y + p2.y)*t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y)*t3) }); } }
  out.push(pts[pts.length - 1]); return wobble(out, amt);
}
/** A coil along a straight run — springs, cords, smoke. */
function coilBetween(a, b, loops, radius, thickness = 0.012) {
  const steps = loops * 18, out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, ang = t * loops * Math.PI * 2;
    out.push({ x: lerp(a.x, b.x, t) + Math.cos(ang) * thickness, y: lerp(a.y, b.y, t) + Math.sin(ang) * radius });
  }
  return wobble(out, 0.5);
}
const S = (pts, color = C.ink, width = 6, style = 'pen') => ({ pts, color, width, style });

// --- timing -----------------------------------------------------------------
const DRAW_T0 = 0.5, DRAW_T1 = 3.5;   // the drawing draws itself between these
const STAMP_T = 5.05;                 // FUNDED
const END_T = 5.3;                    // the card
const END = 6.5;

/** Gives every stroke a slice of the drawing window, proportional to its
 *  length so long lines take longer, with a floor so dots still register. */
function scheduleStrokes(strokes) {
  const len = s => s.pts.reduce((a, p, i) => i ? a + Math.hypot(p.x - s.pts[i-1].x, p.y - s.pts[i-1].y) : 0, 0);
  const weights = strokes.map(s => Math.max(.06, len(s) * 2.2) + .04);   // +.04 = the pen lifting between strokes
  const total = weights.reduce((a, b) => a + b, 0);
  let t = DRAW_T0;
  strokes.forEach((s, i) => { const d = (weights[i] / total) * (DRAW_T1 - DRAW_T0); s.t0 = t; s.t1 = t + d * .82; t += d; });
  return strokes;
}

// Nine backers, $200 each, landing one after another the way the reveal screen
// throws them. Start points are off the paper's edges so they fly in.
const NOTES = (() => { const r = rng(42); const out = [];
  for (let i = 0; i < 9; i++) { const side = i % 4; const from = side === 0 ? { x: -.2, y: r() } : side === 1 ? { x: 1.2, y: r() } : side === 2 ? { x: r(), y: -.2 } : { x: r(), y: 1.2 };
    out.push({ from, to: { x: .12 + r() * .76, y: .12 + r() * .76 }, rot: (r() * 2 - 1) * .5, t: 4.1 + i * .072 }); } return out; })();
/** When the first coin should be heard: the first note touching down. */
const FIRST_LANDING = NOTES[0].t + 0.30;

const CONF = (() => { const r = rng(9); const cols = [C.pink, C.cyan, C.lime, C.primary, C.purple];
  return Array.from({ length: 90 }, () => ({ a: r() * Math.PI * 2, v: 900 + r() * 1400, c: cols[Math.floor(r() * 5)], s: 10 + r() * 16, spin: r() * 12, up: r() })); })();

// ---------------------------------------------------------------------------
// Everything below needs the page's config, set by startSpot().
// ---------------------------------------------------------------------------
let SPOT, L, W, H, g, cv, wg, icon, A, strokes;

function paintPaper(x, y, w, h) {
  g.fillStyle = C.paper; g.fillRect(x, y, w, h);
  const r = rng(3);
  g.fillStyle = 'rgba(216,199,158,.4)';
  for (let i = 0; i < 160; i++) { const px = x + r() * w, py = y + r() * h; g.beginPath(); g.arc(px, py, (r() * .7 + .3) * (w / 380), 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(194,175,131,.22)'; g.lineWidth = w / 700;
  for (let i = 0; i < 22; i++) { const py = y + r() * h, px = x + r() * w; g.beginPath(); g.moveTo(px, py); g.lineTo(px + (r() * 36 - 18) * (w / 380), py + (r() * 5 - 2.5) * (w / 380)); g.stroke(); }
}

function strokePath(pts, upto, color, width, style, ox, oy, scale) {
  const n = Math.max(2, Math.min(pts.length, Math.ceil(pts.length * upto)));
  if (n < 2) return;
  const path = (dx = 0, dy = 0) => { g.beginPath(); for (let i = 0; i < n; i++) { const p = pts[i]; const X = ox + p.x * scale + dx, Y = oy + p.y * scale + dy; i ? g.lineTo(X, Y) : g.moveTo(X, Y); } };
  const base = (ws = 1, alpha = 1, cap = 'round') => { g.strokeStyle = color; g.globalAlpha = alpha; g.lineWidth = width * ws; g.lineCap = cap; g.lineJoin = 'round'; };
  if (style === 'marker') { base(1.5, .72, 'butt'); path(); g.stroke(); }
  else if (style === 'crayon') { for (let k = 0; k < 4; k++) { const a = (k * 1.7) % (Math.PI * 2); base(.78, .34); path(Math.cos(a) * width * .16, Math.sin(a) * width * .16); g.stroke(); } }
  else { base(); path(); g.stroke(); }
  g.globalAlpha = 1;
  return pts[n - 1];
}

/** The same pencil the title screen's idle canvas uses, sitting on the tip of
 *  the line as it is drawn. */
function pencil(x, y, s, angle = -0.9) {
  g.save(); g.translate(x, y); g.rotate(angle); g.lineCap = 'round';
  g.strokeStyle = C.primary; g.lineWidth = s * .07; g.beginPath(); g.moveTo(0, -s * .04); g.lineTo(0, -s * .34); g.stroke();
  g.strokeStyle = C.primaryDeep; g.lineWidth = s * .07; g.beginPath(); g.moveTo(0, -s * .34); g.lineTo(0, -s * .40); g.stroke();
  g.strokeStyle = '#E8D9B8'; g.lineWidth = s * .06; g.beginPath(); g.moveTo(0, -s * .04); g.lineTo(0, -s * .012); g.stroke();
  g.fillStyle = C.ink; g.beginPath(); g.arc(0, 0, s * .014, 0, 7); g.fill();
  g.restore();
}

function text(str, x, y, size, color, { weight = 900, align = 'center', spacing = 0, glow = 0, alpha = 1, rot = 0, scale = 1 } = {}) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(scale, scale);
  g.globalAlpha = alpha; g.font = `${weight} ${size}px Roboto, "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = align; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
  if (glow) { g.shadowColor = color; g.shadowBlur = glow; }
  g.fillStyle = color; g.fillText(str, 0, 0);
  g.restore();
}
function roundRect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/** The prompt, word-wrapped, with the filled-in blank highlighted the way the
 *  game highlights it, typed in over [typed] characters. */
function promptText(x, y, maxW, size, typed) {
  const { before, blank, after } = SPOT.prompt;
  const full = before + blank + after;
  const shown = full.slice(0, Math.floor(typed));
  g.font = `700 ${size}px Roboto, "Helvetica Neue", Arial, sans-serif`; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  const words = full.split(' '); const lines = []; let cur = '';
  for (const w of words) { const test = cur ? cur + ' ' + w : w; if (g.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test; }
  lines.push(cur);
  let idx = 0; const lh = size * 1.3; const y0 = y - ((lines.length - 1) * lh) / 2;
  lines.forEach((ln, li) => {
    const lw = g.measureText(ln).width; let cx = x - lw / 2; const cy = y0 + li * lh;
    for (const ch of ln + (li < lines.length - 1 ? ' ' : '')) {
      const isBlank = idx >= before.length && idx < before.length + blank.length;
      const cw = g.measureText(ch).width;
      if (idx < shown.length) {
        if (isBlank) { g.fillStyle = C.primary; g.fillRect(cx - 2, cy - size * .62, cw + 4, size * 1.24); g.fillStyle = C.onPrimary; }
        else g.fillStyle = C.text;
        g.font = `${isBlank ? 900 : 700} ${size}px Roboto, "Helvetica Neue", Arial, sans-serif`;
        g.fillText(ch, cx, cy);
      }
      cx += cw; idx++;
    }
  });
}

function note(x, y, rot, s, alpha = 1) {
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = alpha;
  g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = s * .12; g.shadowOffsetY = s * .04;
  g.fillStyle = C.notePaper; roundRect(-s * .5, -s * .27, s, s * .54, s * .05); g.fill();
  g.shadowColor = 'transparent'; g.shadowOffsetY = 0;
  g.strokeStyle = C.note; g.lineWidth = s * .035; roundRect(-s * .44, -s * .21, s * .88, s * .42, s * .04); g.stroke();
  g.fillStyle = C.note; g.beginPath(); g.arc(0, 0, s * .15, 0, 7); g.fill();
  text('$', 0, s * .005, s * .2, C.notePaper);
  text('200', -s * .32, s * .12, s * .11, C.note); text('200', s * .32, -s * .12, s * .11, C.note);
  g.restore();
}

// ---------------------------------------------------------------------------
// The frame. A pure function of t, so a still at ?t=4.6 is exactly the frame a
// recording shows at 4.6s.
// ---------------------------------------------------------------------------
function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);

  // Screen shake for the stamp.
  let sx = 0, sy = 0;
  if (t > STAMP_T && t < STAMP_T + .22) { const k = (1 - win(t, STAMP_T, STAMP_T + .22)) * 14; sx = Math.sin(t * 190) * k; sy = Math.cos(t * 230) * k; }
  g.translate(sx, sy);

  g.fillStyle = C.bg; g.fillRect(-40, -40, W + 80, H + 80);
  const glow = g.createRadialGradient(W / 2, H * .5, 0, W / 2, H * .5, L.bgGlowR);
  glow.addColorStop(0, 'rgba(255,197,61,.16)'); glow.addColorStop(1, 'rgba(255,197,61,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);

  if (t < END_T + .25) round(t);
  if (t >= END_T) logo(t);

  // The studio mark lives in the DOM (it's an animated GIF, which a canvas
  // would only ever draw the first frame of), so it fades with the end card.
  wg.style.opacity = t >= END_T ? easeOut(win(t, END_T + .25, END_T + .65)) : 0;
}

function round(t) {
  const fade = 1 - win(t, END_T, END_T + .25);
  g.globalAlpha = fade;

  // -- HUD: round chip and clock, so it reads as a game and not a doodle app.
  const hud = easeOut(win(t, .05, .45)), drop = (1 - hud) * 40;
  g.globalAlpha = fade * hud;
  g.fillStyle = C.surface; roundRect(L.chipX, L.hudY - drop, L.chipW, L.hudH, L.hudH / 2); g.fill();
  g.strokeStyle = C.border; g.lineWidth = 3; g.stroke();
  text('ROUND 2 · DRAW', L.chipX + L.chipW / 2, L.hudY + L.hudH / 2 - drop, L.hudText, C.muted, { spacing: 3 });
  // The clock ticks down from 0:59 a little faster than real time, so the
  // pressure reads in three seconds.
  const secs = Math.max(0, 59 - Math.floor(win(t, DRAW_T0, 5.0) * 34));
  g.fillStyle = C.surface; roundRect(L.clockX, L.hudY - drop, L.clockW, L.hudH, L.hudH / 2); g.fill(); g.stroke();
  g.fillStyle = C.primary; g.beginPath(); g.arc(L.clockX + L.hudH * .61, L.hudY + L.hudH / 2 - drop, L.hudH * .19, 0, 7); g.fill();
  text('0:' + String(secs).padStart(2, '0'), L.clockX + L.clockW * .59, L.hudY + L.hudH / 2 - drop, L.clockText, C.text, { spacing: 2 });
  g.globalAlpha = fade;

  // -- prompt, typed in over one second
  promptText(L.promptX, L.promptY, L.promptW, L.promptSize, win(t, .15, 1.15) * (SPOT.prompt.before + SPOT.prompt.blank + SPOT.prompt.after).length * 1.05);

  // -- paper: pops in from slightly small, with a real drop shadow
  const pop = back(win(t, 0, .5));
  const PW = L.paperSize, px = L.paperX, py = L.paperY;
  g.save(); g.translate(px + PW / 2, py + PW / 2); g.scale(pop, pop); g.translate(-(px + PW / 2), -(py + PW / 2));
  g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 60; g.shadowOffsetY = 24;
  g.fillStyle = C.paper; g.fillRect(px, py, PW, PW); g.shadowColor = 'transparent'; g.shadowOffsetY = 0;
  paintPaper(px, py, PW, PW);
  g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 2; g.strokeRect(px + 1, py + 1, PW - 2, PW - 2);

  // -- the drawing
  let tip = null;
  for (const s of strokes) {
    if (t < s.t0) break;
    const u = win(t, s.t0, s.t1);
    const end = strokePath(s.pts, u, s.color, s.width * (PW / 380) * .55, s.style, px, py, PW);
    if (u < 1 || t < s.t1 + .01) tip = end;
  }
  if (t >= DRAW_T0 - .1 && t < DRAW_T1 + .05) {
    // The pencil hovers in before the first stroke and lifts off after the last.
    const X = tip ? px + tip.x * PW : px + strokes[0].pts[0].x * PW;
    const Y = tip ? py + tip.y * PW : py + strokes[0].pts[0].y * PW;
    const lift = t < DRAW_T0 ? (1 - win(t, DRAW_T0 - .1, DRAW_T0)) * 40 : t > DRAW_T1 ? win(t, DRAW_T1, DRAW_T1 + .05) * 40 : 0;
    pencil(X, Y - lift, PW * .5, -0.9);
  }

  // -- the money, landing on the paper
  for (const n of NOTES) {
    if (t < n.t) continue;
    const u = win(t, n.t, n.t + .32), e = easeOut(u), arcUp = Math.sin(u * Math.PI) * 90;
    const X = px + lerp(n.from.x, n.to.x, e) * PW, Y = py + lerp(n.from.y, n.to.y, e) * PW - arcUp;
    const land = u >= 1 ? 1 + (1 - easeOut(win(t, n.t + .32, n.t + .5))) * .18 : 1.25 - .25 * e;
    note(X, Y, lerp(n.rot * 3, n.rot, e), L.noteSize * land);
  }
  g.restore();

  // -- the invention's name, stamped under (or beside) the paper
  if (t >= 3.55) {
    const u = back(win(t, 3.55, 3.95));
    text(SPOT.title, L.titleX, L.titleY, L.titleSize, C.primary, { spacing: 4, glow: 40 * fade, scale: u, rot: -0.03, alpha: fade * clamp(u, 0, 1) });
    text(SPOT.subtitle, L.titleX, L.subY, L.subSize, C.muted, { weight: 700, alpha: fade * win(t, 3.8, 4.1) });
  }

  // -- the counter and the goal bar
  if (t >= 4.1) {
    const landed = NOTES.filter(n => t >= n.t + .3).length, amt = landed * 200;
    const bump = NOTES.some(n => t >= n.t + .3 && t < n.t + .42) ? 1.12 : 1;
    const a = easeOut(win(t, 4.1, 4.35)) * fade;
    g.fillStyle = C.surface; g.globalAlpha = a;
    roundRect(L.barX, L.pillY, L.barW, L.pillH, L.pillH / 2); g.fill();
    g.strokeStyle = C.border; g.lineWidth = 3; g.stroke(); g.globalAlpha = 1;
    text('RAISED', L.barX + L.barW * .244, L.pillY + L.pillH / 2, L.raisedSize, C.muted, { spacing: 4, alpha: a });
    text('$' + amt.toLocaleString(), L.barX + L.barW * .624, L.pillY + L.pillH / 2, L.amountSize, amt >= 1000 ? C.lime : C.text, { alpha: a, scale: bump, glow: amt >= 1000 ? 24 : 0 });

    const gu = win(t, 4.2, 4.5), goalX = L.barX + L.barW * (1000 / 1800);
    g.fillStyle = C.border; g.globalAlpha = a; roundRect(L.barX, L.goalY, L.barW, 12, 6); g.fill();
    g.fillStyle = amt >= 1000 ? C.lime : C.primary; roundRect(L.barX, L.goalY, L.barW * clamp(amt / 1800, 0, 1) * gu, 12, 6); g.fill();
    g.fillStyle = C.text; g.fillRect(goalX - 2, L.goalY - 10, 4, 32);
    text('GOAL $1,000', goalX, L.goalY + 46, L.goalSize, C.muted, { weight: 700, spacing: 2, alpha: a });
    g.globalAlpha = 1;
  }

  // -- FUNDED, with the confetti burst
  if (t >= STAMP_T) {
    const u = win(t, STAMP_T, STAMP_T + .28), s = lerp(3.2, 1, easeOut(u)), al = clamp(u * 3, 0, 1) * fade;
    const bw = L.stampW, bh = L.stampH;
    g.save(); g.translate(L.stampX, L.stampY); g.rotate(-0.2); g.scale(s, s); g.globalAlpha = al;
    g.strokeStyle = C.funded; g.lineWidth = 14; roundRect(-bw / 2, -bh / 2, bw, bh, 26); g.stroke();
    g.strokeStyle = C.funded; g.lineWidth = 5; roundRect(-bw / 2 + 20, -bh / 2 + 20, bw - 40, bh - 40, 20); g.stroke();
    g.restore();
    text('FUNDED!', L.stampX, L.stampY, L.stampText, C.funded, { spacing: 6, rot: -0.2, scale: s, alpha: al, glow: 30 * fade });
    // The burst comes off the middle of the paper, not the stamp -- the stamp
    // sits a little low so it doesn't cover the drawing's face.
    const cox = L.paperX + L.paperSize / 2, coy = L.paperY + L.paperSize / 2;
    for (const c of CONF) {
      const ct = t - STAMP_T; if (ct < 0) continue;
      const drag = 1 - Math.exp(-ct * 3);
      const X = cox + Math.cos(c.a) * c.v * drag / 3, Y = coy + Math.sin(c.a) * c.v * drag / 3 + ct * ct * 1400 - c.up * 400 * ct;
      g.save(); g.translate(X, Y); g.rotate(c.spin * ct); g.globalAlpha = fade * (1 - win(ct, .9, 1.3));
      g.fillStyle = c.c; g.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2); g.restore();
    }
  }
  g.globalAlpha = 1;
}

function logo(t) {
  const E = L.end, u = win(t, END_T, END_T + .6);
  const glow = g.createRadialGradient(E.glowX, E.glowY, 0, E.glowX, E.glowY, E.glowR);
  glow.addColorStop(0, `rgba(255,197,61,${.34 * easeOut(u)})`); glow.addColorStop(1, 'rgba(255,197,61,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);

  // The launcher mark, rounded the way Play shows it, popping in.
  const s = back(win(t, END_T + .05, END_T + .55)), size = E.iconSize * s;
  if (icon.complete && icon.naturalWidth) {
    g.save(); g.translate(E.iconX, E.iconY); g.rotate((1 - s) * .3);
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 70; g.shadowOffsetY = 30;
    roundRect(-size / 2, -size / 2, size, size, size * .22); g.clip(); g.shadowColor = 'transparent';
    g.drawImage(icon, -size / 2, -size / 2, size, size); g.restore();
  }
  const wu = easeOut(win(t, END_T + .3, END_T + .7));
  text('GRAND CANVAS', E.textX, E.wordY + (1 - wu) * 40, E.wordSize, C.primary, { spacing: E.wordSpacing, glow: 44, alpha: wu, align: E.align });
  const tu = easeOut(win(t, END_T + .5, END_T + .85));
  text('Draw it. Pitch it. Get funded.', E.textX, E.tagY + (1 - tu) * 30, E.tagSize, C.text, { weight: 700, alpha: tu, align: E.align });
  // The one line of hype, and it is true.
  const cu = back(win(t, END_T + .65, END_T + 1.1));
  if (cu > 0) {
    g.save(); g.translate(E.ctaCX, E.ctaCY); g.scale(cu, cu); g.globalAlpha = clamp(cu, 0, 1);
    g.shadowColor = 'rgba(255,197,61,.55)'; g.shadowBlur = 50;
    g.fillStyle = C.primary; roundRect(-E.ctaW / 2, -E.ctaH / 2, E.ctaW, E.ctaH, E.ctaH / 2); g.fill(); g.shadowColor = 'transparent';
    text('FREE ON GOOGLE PLAY', 0, 2, E.ctaText, C.onPrimary, { spacing: 4 });
    g.restore();
  }
  text('a  W H O S E G A M E S  game', E.studioX, E.studioY, E.studioSize, C.muted, { weight: 700, alpha: easeOut(win(t, END_T + .4, END_T + .75)) });
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------
const SOUNDS = [
  ['bed',     'assets/drawing.ogg',      0,             .50],
  ['coins',   'assets/sfx_coins.mp3',    FIRST_LANDING, .85],
  ['kaching', 'assets/sfx_kaching.mp3',  STAMP_T - .03, .85],
  ['win',     'assets/sting_win.ogg',    STAMP_T,       .70],
  ['launch',  'assets/sting_launch.ogg', END_T + .05,   .80],
];

function startSpot(spot) {
  SPOT = spot; L = spot.layout; W = spot.W; H = spot.H;

  const stage = document.getElementById('stage');
  stage.style.width = W + 'px'; stage.style.height = H + 'px';
  cv = document.getElementById('c'); cv.width = W; cv.height = H;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  g = cv.getContext('2d');

  wg = document.getElementById('wg');
  const E = L.end;
  wg.style.left = E.wgX + 'px'; wg.style.top = E.wgY + 'px';
  wg.style.width = E.wgSize + 'px'; wg.style.height = E.wgSize + 'px';
  wg.style.marginLeft = '0';

  icon = new Image(); icon.src = 'assets/icon.png';

  A = {};
  for (const [name, src] of SOUNDS) { const el = new Audio(src); el.preload = 'auto'; A[name] = el; }

  rand = rng(spot.seed ?? 7);
  strokes = scheduleStrokes(spot.build({ S, C, line, arc, ellipse, curve, poly, coilBetween, wobble }));

  // --- sizing: pin the stage to the middle of the viewport and scale from
  // there. Centring it as a grid item instead looks identical at full size and
  // is black at every other one — the row grows to the stage's full height, so
  // scaling about the stage's own centre leaves it below the fold.
  const fit = () => {
    const k = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(-50%, -50%) scale(${k})`;
  };
  addEventListener('resize', fit); fit();

  // --- run it
  const params = new URLSearchParams(location.search);
  const overlay = document.getElementById('start');
  let muted = params.has('mute'), loop = params.has('loop');
  let start = null, raf = 0, fired = new Set();

  function play() {
    overlay.classList.add('hidden');
    cancelAnimationFrame(raf);
    start = performance.now(); fired = new Set();
    tick();
  }
  function tick() {
    const t = (performance.now() - start) / 1000;
    frame(Math.min(t, END + 4));
    if (!muted) {
      for (const [name, , at, vol] of SOUNDS) {
        if (t >= at && !fired.has(name)) {
          fired.add(name); A[name].currentTime = 0; A[name].volume = vol; A[name].play().catch(() => {});
        }
      }
      // Duck the drawing loop out under the stamp.
      if (t > 4.9) A.bed.volume = .50 * (1 - win(t, 4.9, 5.4));
    }
    if (t >= END + 1.2 && loop) return play();
    raf = requestAnimationFrame(tick);
  }

  if (params.has('t')) {
    overlay.classList.add('hidden');
    const draw = () => frame(parseFloat(params.get('t')) || 0);
    icon.complete && icon.naturalWidth ? draw() : (icon.onload = draw, icon.onerror = draw);
  } else {
    overlay.addEventListener('click', play);
    addEventListener('keydown', e => {
      if (e.code === 'Space' || e.key === 'r' || e.key === 'R') { e.preventDefault(); play(); }
      if (e.key === 'm' || e.key === 'M') { muted = !muted; if (muted) for (const a of Object.values(A)) a.pause(); }
      if (e.key === 'l' || e.key === 'L') loop = !loop;
    });
    frame(0);
  }
}
