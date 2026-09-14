// Renders the ad to a numbered PNG sequence by driving one headless Chrome
// over the DevTools protocol: set the clock, take the picture, repeat. The
// page's own ?t= "still" mode already makes frame(t) a pure function of time,
// so nothing here depends on real-time playback -- the capture can take as
// long as it likes and the result is frame-exact.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const [wsUrl, pageUrl, outDir, wgDir, fpsArg, endArg] = process.argv.slice(2);
const FPS = Number(fpsArg), END = Number(endArg);
const wgTiming = JSON.parse(readFileSync(`${wgDir}/timing.json`, 'utf8'));
mkdirSync(outDir, { recursive: true });

const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params })); });

ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  } else if (m.method === 'Runtime.exceptionThrown') {
    console.error('PAGE EXCEPTION:', m.params.exceptionDetails.text, m.params.exceptionDetails.exception?.description);
  }
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

ws.addEventListener('open', async () => {
  await send('Runtime.enable');
  await send('Page.enable');
  await sleep(900);   // the page was opened by the launcher; let it parse
  // Exact output pixels, independent of the window the browser opened with.
  // The page knows its own size, so portrait and landscape need no flag here.
  const dims = await send('Runtime.evaluate', { expression: '[W, H].join("x")', returnByValue: true });
  const [vw, vh] = String(dims.result.value).split('x').map(Number);
  await send('Emulation.setDeviceMetricsOverride', { width: vw, height: vh, deviceScaleFactor: 1, mobile: false });
  console.log(`stage: ${vw}x${vh}`);

  // Let fonts and the icon settle before the first capture.
  await sleep(1200);
  const probe = await send('Runtime.evaluate', { expression: 'typeof frame + "," + (typeof wg) + "," + (icon.complete && icon.naturalWidth > 0)' });
  console.log('page ready:', probe.result.value);
  if (!String(probe.result.value).startsWith('function')) { console.error('frame() not found -- wrong target?'); process.exit(1); }

  // The studio mark is an animated GIF, which would advance at wall-clock
  // speed while a frame-by-frame capture crawls past it -- so it is driven
  // by hand instead, one extracted still per video frame.
  await send('Runtime.evaluate', { expression: `wg.removeAttribute('src'); window.__wgDir = ${JSON.stringify(wgDir)};` });

  const total = Math.round(END * FPS);
  let lastPct = -1;
  for (let i = 0; i <= total; i++) {
    const t = i / FPS;
    // Which GIF frame is showing at this moment of the ad. The mark only
    // appears on the end card, so the loop is anchored there.
    const wgMs = Math.max(0, (t - 5.3) * 1000) % wgTiming.total;
    let wgIdx = 0;
    for (let k = 0; k < wgTiming.times.length; k++) if (wgTiming.times[k] <= wgMs) wgIdx = k;

    await send('Runtime.evaluate', {
      expression: `wg.src = 'file://' + window.__wgDir + '/' + String(${wgIdx}).padStart(3,'0') + '.png'; frame(${t});`,
      awaitPromise: false,
    });
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(`${outDir}/f${String(i).padStart(5, '0')}.png`, Buffer.from(shot.data, 'base64'));

    const pct = Math.floor((i / total) * 100);
    if (pct !== lastPct && pct % 10 === 0) { console.log(`  ${pct}%  (frame ${i}/${total}, t=${t.toFixed(3)}s)`); lastPct = pct; }
  }
  console.log(`done: ${total + 1} frames at ${FPS}fps`);
  process.exit(0);
});
ws.addEventListener('error', (e) => { console.error('WS ERROR', e.message); process.exit(1); });
