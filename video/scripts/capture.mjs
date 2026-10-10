// Records the real, live Elitr dashboard (https://elitr.xyz) for the demo film. Live data only.
//   node scripts/capture.mjs                    all clips
//   ONLY=trades,gaps node scripts/capture.mjs   re-records just those clips (marks/meta are merged)
// No operator token is used and nothing is ever sent: every action below is a read (page loads,
// filter chips, hovering, scrolling) of the public, read-only dashboard.
// Output: .cache/frames/<clip>/ (JPEG screencast + frames.json), .cache/marks.json (event times),
// .cache/meta.json (per clip: url, element rects in CSS px, notes, live readings) and stills in
// public/stills/. scripts/encode.mjs turns the frames into public/footage/<clip>.mp4 (30 fps).
//
// The window is 1600x900 CSS px at device scale 2, so frames are 3200x1800 and a rect {x,y,w,h}
// in CSS px maps to video pixels by multiplying by 2.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch, sleep } from "./cdp.mjs";

const BASE = process.env.BASE || "https://elitr.xyz";
const ROOT = resolve(new URL("..", import.meta.url).pathname);
const FRAMES = join(ROOT, ".cache/frames");
const STILLS = join(ROOT, "public/stills");
const SCALE = 2;
const VIEW = { w: 1600, h: 900 };
const ONLY = process.env.ONLY?.split(",");
const want = (clip) => !ONLY || ONLY.includes(clip);
mkdirSync(FRAMES, { recursive: true });
mkdirSync(STILLS, { recursive: true });

const t0 = Date.now();
const log = (...a) => console.log(`+${((Date.now() - t0) / 1000).toFixed(0)}s`, ...a);
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {});
const marks = readJson(join(ROOT, ".cache/marks.json"));
const meta = readJson(join(ROOT, ".cache/meta.json"));
const mark = (k) => { marks[k] = Date.now() / 1000; log("mark", k); };

// A visible pointer for the film (headless Chrome draws none), a click ring and an eased scroll helper.
const OVERLAY = `(() => {
  window.__ease = (el, prop, to, ms) => new Promise((done) => {
    const from = el[prop]; const start = performance.now();
    const f = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => { const p = Math.min(1, (now - start) / ms); el[prop] = from + (to - from) * f(p); if (p < 1) requestAnimationFrame(step); else done(el[prop]); };
    requestAnimationFrame(step);
  });
  const add = () => {
    if (document.getElementById('__cur')) return;
    const s = document.createElement('style'); s.id = '__curcss';
    s.textContent = 'html{scroll-behavior:auto!important}#__cur{position:fixed;left:-40px;top:-40px;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50% !important;background:rgba(11,14,17,.92);box-shadow:0 0 0 2px rgba(255,255,255,.95),0 4px 14px rgba(0,0,0,.45);z-index:2147483647;pointer-events:none;opacity:0;transition:opacity .3s ease,transform .12s ease-out,left .8s cubic-bezier(.22,1,.36,1),top .8s cubic-bezier(.22,1,.36,1)}#__cur.down{transform:scale(.7)}.__ring{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50% !important;border:2px solid rgba(240,185,11,.95);z-index:2147483646;pointer-events:none;animation:__r .6s ease-out forwards}@keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.5);opacity:0}}';
    document.head.appendChild(s);
    const c = document.createElement('div'); c.id = '__cur'; document.body.appendChild(c);
  };
  window.__overlay = add;
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
})()`;

const b = await launch({ width: VIEW.w, height: VIEW.h + 87, extraArgs: [`--force-device-scale-factor=${SCALE}`] });
const hardStop = setTimeout(() => { log("HARD TIMEOUT"); b.close(); process.exit(2); }, 1_500_000);
const js = (e) => b.js(e);

// --- helpers ------------------------------------------------------------------------
const rectOf = async (finder) => {
  const r = await b.rectOf(finder);
  return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
};
const centerOf = (finder) => js(`(() => { const e = ${finder}; if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
/** The first element matching `sel` whose trimmed text starts with `text`. */
const byText = (sel, text, root = "document") => `[...${root}.querySelectorAll(${JSON.stringify(sel)})].find((e) => e.textContent.trim().startsWith(${JSON.stringify(text)}))`;
/** A card (section or div.card) by its h2 heading text. */
const card = (h2) => `[...document.querySelectorAll('.card')].find((c) => c.querySelector('.card-head h2')?.textContent.trim().toLowerCase().startsWith(${JSON.stringify(h2.toLowerCase())}))`;
const text = () => js(`document.body.innerText`);

async function overlay() { await js(`window.__overlay && window.__overlay()`); }
async function cursorAt(x, y) {
  await js(`(() => { const k = document.getElementById('__cur'); if (!k) return; const t = k.style.transition; k.style.transition = 'opacity .3s ease'; k.style.left = '${x}px'; k.style.top = '${y}px'; k.offsetWidth; k.style.transition = t; k.style.opacity = '1'; })()`);
}
async function cursorHide() { await js(`(() => { const k = document.getElementById('__cur'); if (k) k.style.opacity = '0'; })()`); }
async function glide(x, y, settle = 900) {
  await js(`(() => { const k = document.getElementById('__cur'); if (k) { k.style.opacity = '1'; k.style.left = '${x}px'; k.style.top = '${y}px'; } })()`);
  await sleep(820);
  await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await sleep(Math.max(0, settle - 820));
}
async function clickAt(x, y) {
  await js(`(() => { const k = document.getElementById('__cur'); k?.classList.add('down'); const r = document.createElement('div'); r.className = '__ring'; r.style.left = '${x}px'; r.style.top = '${y}px'; document.body.appendChild(r); setTimeout(() => { k?.classList.remove('down'); r.remove(); }, 650); })()`);
  await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await sleep(90);
  await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
}
/** Glide to an element and click it with the real mouse. Returns the point. */
async function press(finder, { settle = 950, dx = 0, dy = 0 } = {}) {
  const at = await centerOf(finder);
  if (!at) throw new Error("press: not found: " + finder.slice(0, 120));
  if (at.y < 0 || at.y > VIEW.h) throw new Error("press: off screen: " + JSON.stringify(at) + " " + finder.slice(0, 80));
  await glide(at.x + dx, at.y + dy, settle);
  await clickAt(at.x + dx, at.y + dy);
  return at;
}
const parkMouse = () => b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: VIEW.w - 6, y: VIEW.h - 4 });
const ease = (finder, to, ms, prop = "scrollTop") => js(`window.__ease(${finder ?? "document.scrollingElement"}, '${prop}', ${to}, ${ms})`);
/** Document y (CSS px) of an element's top. */
const docY = (finder) => js(`(() => { const e = ${finder}; return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; })()`);
async function waitFor(desc, expr, ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await js(`!!(${expr})`)) return; } catch {}
    await sleep(500);
  }
  throw new Error(`timed out waiting for ${desc}`);
}
async function open(path, ready, desc) {
  await b.goto(BASE + path, 2500);
  await overlay();
  await parkMouse();
  if (ready) await waitFor(desc ?? path, ready, 90_000);
  await overlay();
}
/** Same-document hash navigation (keeps the app's loaded state, like a real tab click). */
async function hashTo(hash, ready, desc) {
  await js(`location.hash = ${JSON.stringify(hash)}`);
  await sleep(600);
  if (ready) await waitFor(desc ?? hash, ready, 90_000);
  await js(`scrollTo(0, 0)`);
}

// --- recording ----------------------------------------------------------------------
let stopRec = null;
async function rec(name) {
  const dir = join(FRAMES, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  stopRec = await b.screencast(dir);
  mark(`${name}:start`);
}
async function endRec(name) {
  if (!stopRec) return;
  mark(`${name}:end`);
  const frames = await stopRec();
  stopRec = null;
  const span = frames.length > 1 ? frames[frames.length - 1].t - frames[0].t : 0;
  log(`${name}: ${frames.length} frames over ${span.toFixed(1)}s (${(frames.length / Math.max(span, 0.001)).toFixed(1)} fps)`);
}
function setMeta(clip, data) {
  meta[clip] = { url: BASE + data.url, build: BUILD, capturedAt: new Date().toISOString(), deviceScale: SCALE, viewport: VIEW, ...data, url: data.url };
}
const save = () => {
  writeFileSync(join(ROOT, ".cache/marks.json"), JSON.stringify(marks, null, 1));
  writeFileSync(join(ROOT, ".cache/meta.json"), JSON.stringify(meta, null, 1));
};
const shot = (name, finder) => b.shot(join(STILLS, `${name}.png`), finder);

// --- stepped recording (deterministic 60 fps) ---------------------------------------
// Chrome's screencast only sends frames when it can, so long scrolls arrive at ~40 fps with gaps.
// For scroll and pointer moves we instead pose the page for every 1/60 s step (scrollTop, pointer
// position, both eased) and take a screenshot, so motion is perfectly even. Static holds reuse the
// last screenshot. Timestamps are synthetic (i / 60) and marks are placed on the same clock.
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
async function stepped(name, build) {
  const dir = join(FRAMES, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const base = Date.now() / 1000;
  const frames = [];
  let n = 0, lastFile = null, shots = 0;
  const snap = async () => {
    const r = await b.send("Page.captureScreenshot", { format: "jpeg", quality: 100 });
    lastFile = join(dir, `s${String(shots++).padStart(5, "0")}.jpg`);
    writeFileSync(lastFile, Buffer.from(r.result.data, "base64"));
  };
  const push = () => frames.push({ file: lastFile, t: base + n++ / 60 });
  await js(`(() => { const k = document.getElementById('__cur'); if (k) k.style.transition = 'opacity .3s ease'; })()`);
  await snap();
  const api = {
    /** Hold the current picture for `sec` seconds. */
    hold: (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) push(); },
    /** Animate over `sec` seconds: pose(p) is called with p in (0, 1], then a screenshot per step. */
    anim: async (sec, pose) => {
      const steps = Math.round(sec * 60);
      for (let i = 1; i <= steps; i++) { await pose(i / steps); await js(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`); await snap(); push(); }
    },
    /** Something that changes the page (a click): run it, let it settle, take a fresh shot. */
    act: async (fn, settleMs = 400) => { await fn(); await sleep(settleMs); await snap(); push(); },
    mark: (k) => { marks[k] = base + n / 60; log("mark", k, `(frame ${n})`); },
  };
  marks[`${name}:start`] = base;
  await build(api);
  marks[`${name}:end`] = base + n / 60;
  writeFileSync(join(dir, "frames.json"), JSON.stringify(frames));
  log(`${name}: stepped ${frames.length} frames (${shots} screenshots) = ${(frames.length / 60).toFixed(1)}s`);
}
const setScroll = (y) => js(`document.scrollingElement.scrollTop = ${y}`);
const setCursor = (x, y, show = true) => js(`(() => { const k = document.getElementById('__cur'); if (!k) return; k.style.left = '${x}px'; k.style.top = '${y}px'; k.style.opacity = '${show ? 1 : 0}'; })()`);
/** Pointer glide pose (eased like the screencast pointer): from a to b. */
const glidePose = (a, bb) => async (p) => { const e = easeOut(p); await setCursor(Math.round(a.x + (bb.x - a.x) * e), Math.round(a.y + (bb.y - a.y) * e)); };
/** A real click at (x, y) with the press ring, between steps. */
async function stepClick(x, y) {
  await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await js(`(() => { const k = document.getElementById('__cur'); k?.classList.add('down'); setTimeout(() => k?.classList.remove('down'), 160); })()`);
  await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
}

let BUILD = process.env.BUILD || "live elitr.xyz";

/** The dashboard panel (section) whose own text starts with `title` (case-insensitive). */
const panel = (title) => `[...document.querySelectorAll('section')].filter((s) => s.innerText.trim().toLowerCase().startsWith(${JSON.stringify(title.toLowerCase())})).sort((a, b) => a.innerText.length - b.innerText.length)[0]`;
/** The smallest element whose text contains `t`. */
const leaf = (t, sel = "*") => `[...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.innerText && e.innerText.includes(${JSON.stringify(t)})).sort((a, b) => a.innerText.length - b.innerText.length)[0]`;
const scrollOf = () => js(`document.scrollingElement.scrollTop`);
const scrollPose = (from, to) => async (p) => setScroll(Math.round(from + (to - from) * easeIO(p)));

try {
  await b.send("Emulation.clearDeviceMetricsOverride");
  await b.send("Page.addScriptToEvaluateOnNewDocument", { source: OVERLAY });
  await b.goto("about:blank", 300);
  const vp = await js(`({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio })`);
  if (vp.w !== VIEW.w || vp.h !== VIEW.h || vp.dpr !== SCALE) throw new Error("unexpected viewport " + JSON.stringify(vp));

  // ===== analysts: the analyst market, trust bars, the latest pick, scored calls, ERC-8004 ratings ====
  if (want("analysts")) {
    await open("/dashboard/analysts", `/over \\d+ signals/.test(document.body.innerText) && /agent #365555/.test(document.body.innerText) && /picked analyst/i.test(document.body.innerText)`, "analyst cards");
    await sleep(2500);
    const rects = {
      market: await rectOf(panel("analyst market")),
      news: await rectOf(`${leaf("Elitr News Analyst", "div")}?.closest('div.rounded-md, div[class*=border]')`),
      flow: await rectOf(`${leaf("Elitr Flow Analyst", "div")}?.closest('div.rounded-md, div[class*=border]')`),
      pick: await rectOf(`${leaf("LATEST PICK PER ASSET")}?.parentElement`),
    };
    const live = await js(`(() => { const t = document.body.innerText; return { rates: [...t.matchAll(/(\\d+)%\\s*\\n?\\s*over (\\d+) signals/g)].map((m) => m[0].replace(/\\s+/g, ' ')), trust: [...t.matchAll(/(0\\.\\d+) · pause/g)].map((m) => m[1]), pick: t.match(/picked [^\\n]+/)?.[0] }; })()`);
    await shot("analysts");
    await stepped("analysts", async (s) => {
      s.hold(3.2);
      s.mark("cards");
      await s.anim(1.0, glidePose({ x: 1500, y: 860 }, { x: 1250, y: 405 }));
      s.mark("flowTrust");
      s.hold(2.4);
      await s.anim(0.6, async (p) => setCursor(1250, 405, p < 0.9));
      const callsY = await docY(leaf("RECENT CALLS"));
      const from = await scrollOf();
      const to = Math.max(0, (callsY ?? 700) - 140);
      s.mark("scroll");
      await s.anim(2.6, scrollPose(from, to));
      s.mark("calls");
      s.hold(2.6);
      const fbY = await docY(`${leaf("ERC-8004 feedback")} ?? ${leaf("reputation registry")}`);
      const to2 = Math.max(to, (fbY ?? to + 300) - 360);
      await s.anim(2.0, scrollPose(to, to2));
      s.mark("ratings");
      s.hold(3.4);
    });
    const after = { calls: await rectOf(`${leaf("RECENT CALLS")}?.parentElement`), ratings: await rectOf(`${leaf("ERC-8004 feedback")}?.parentElement ?? ${leaf("reputation registry")}?.parentElement`) };
    await shot("analysts-ratings");
    setMeta("analysts", { url: "/dashboard/analysts", live, rects, rectsAt: { ratings: after }, notes: "Live Analysts view. Holds on the two analyst cards (mark cards), the pointer rests on the flow analyst's trust bar (mark flowTrust), an eased scroll to Recent calls (mark calls) and on to the ERC-8004 ratings the trader posted (mark ratings). Nothing clicked." });
    save();
  }

  // ===== activity: every event, then the Payments filter (b402 settlements) ==========================
  if (want("activity")) {
    await open("/dashboard/activity", `/payment\\.sent/.test(document.body.innerText) && /Payments\\s*\\d+/.test(document.body.innerText)`, "activity list");
    await sleep(2500);
    await stepped("activity", async (s) => {
      s.hold(2.4);
      const chip = await centerOf(byText("button", "Payments"));
      await s.anim(1.0, glidePose({ x: 1500, y: 860 }, chip));
      await s.act(() => stepClick(chip.x, chip.y), 700);
      s.mark("payments");
      s.hold(1.2);
      await s.anim(0.5, async (p) => setCursor(chip.x, chip.y, p < 0.9));
      s.hold(3.4);
      const from = await scrollOf();
      await s.anim(3.2, scrollPose(from, from + 420));
      s.mark("scrolled");
      s.hold(2.4);
    });
    const live = await js(`(() => { const t = document.body.innerText; return { header: t.match(/Payments\\s*\\d+/)?.[0], first: t.match(/Paid \\$[^\\n]+/)?.[0] }; })()`);
    const rects = { list: await rectOf(panel("event timeline")) };
    await shot("activity-payments");
    setMeta("activity", { url: "/dashboard/activity", live, rects, notes: "Live Activity view; a real click on the Payments filter chip (mark payments) lists the b402 payments (payment.sent / payment.verified), then an eased scroll down the list (mark scrolled)." });
    save();
  }

  // ===== markets: the signal card and the 14 buy-side risk checks ======================================
  if (want("markets")) {
    await open("/dashboard/markets", `/14 rules/.test(document.body.innerText) && /RISK CHECKS/i.test(document.body.innerText)`, "risk checks");
    await sleep(2500);
    await stepped("markets", async (s) => {
      s.hold(2.0);
      const riskY = await docY(panel("risk checks"));
      const from = await scrollOf();
      const to = Math.max(0, (riskY ?? 400) - 90);
      await s.anim(1.8, scrollPose(from, to));
      s.mark("risk");
      s.hold(2.2);
      await s.anim(4.4, scrollPose(to, to + 520));
      s.mark("rules");
      s.hold(2.6);
    });
    const live = await js(`(() => { const t = document.body.innerText; return { rules: t.match(/\\d+ rules/)?.[0], failing: t.match(/\\d+ failing/)?.[0], symbol: t.match(/NVDAB|TSLAB|BABAB|CRCLB|SNDKB|METAB/)?.[0] }; })()`);
    const rects = { risk: await rectOf(panel("risk checks")) };
    await shot("markets-risk");
    setMeta("markets", { url: "/dashboard/markets", live, rects, notes: "Live Markets view: eased scroll to the Risk checks panel (mark risk), then slowly down through the 14 buy-side rules with observed vs limit values (mark rules). Nothing clicked." });
    save();
  }

  // ===== trades: the live buy and the autonomous stop-loss sell, with their tx links ==================
  if (want("trades")) {
    await open("/dashboard/trades", `/\\d+ filled/.test(document.body.innerText) && /STOP LOSS/i.test(document.body.innerText)`, "execution log");
    await sleep(2500);
    const rects = {
      log: await rectOf(panel("execution log")),
      sell: await rectOf(`${leaf("STOP LOSS")}?.closest('li, article, div.border-b, div[class*=border-b]') ?? ${leaf("STOP LOSS")}?.parentElement?.parentElement?.parentElement`),
      buy: await rectOf(`${leaf("0x0ce911")}?.closest('li, article, div.border-b, div[class*=border-b]')`),
    };
    const sellTx = await centerOf(leaf("0x37ff1c", "a"));
    const buyTx = await centerOf(leaf("0x0ce911", "a"));
    await shot("trades");
    await stepped("trades", async (s) => {
      s.hold(2.6);
      s.mark("sell");
      if (sellTx) await s.anim(1.0, glidePose({ x: 1500, y: 860 }, sellTx));
      s.hold(3.0);
      s.mark("buy");
      if (buyTx && sellTx) await s.anim(1.0, glidePose(sellTx, buyTx));
      s.hold(3.0);
      await s.anim(0.5, async (p) => setCursor(buyTx?.x ?? 0, buyTx?.y ?? 0, p < 0.9));
      s.hold(1.5);
    });
    const live = await js(`(() => { const t = document.body.innerText; return { header: t.match(/\\d+ · \\d+ filled/)?.[0], sell: t.match(/SELL[\\s\\S]{0,240}/)?.[0]?.replace(/\\s+/g, ' ') }; })()`);
    setMeta("trades", { url: "/dashboard/trades", live, rects, notes: "Live Trades view: the autonomous stop-loss SELL of NVDAB (8 Oct, tx 0x37ff1c71…3b11) and the live BUY (7 Oct, tx 0x0ce91120…3807), each simulated, broadcast and filled. The pointer rests on each tx link (marks sell, buy); nothing clicked." });
    save();
  }

  // ===== gaps: the weekend gap board (RWA Data API), filtered to bStocks ==============================
  if (want("gaps")) {
    await open("/dashboard/gaps", `document.querySelectorAll('table tbody tr').length > 10 && /CRCLB/.test(document.body.innerText)`, "gap board rows");
    await sleep(3000);
    await stepped("gaps", async (s) => {
      s.hold(2.4);
      s.mark("board");
      const boardY = await docY(panel("spread board"));
      const from = await scrollOf();
      const to = Math.max(0, (boardY ?? 300) - 110);
      await s.anim(2.0, scrollPose(from, to));
      s.mark("table");
      s.hold(1.4);
      const chip = await centerOf(`${byText("button", "bStocks")} ?? ${byText("button", "bStock")}`);
      if (chip) {
        await s.anim(1.0, glidePose({ x: 1500, y: 860 }, chip));
        await s.act(() => stepClick(chip.x, chip.y), 900);
        s.mark("bstocks");
        await s.anim(0.5, async (p) => setCursor(chip.x, chip.y, p < 0.9));
      }
      s.hold(3.6);
    });
    const crcl = await rectOf(`[...document.querySelectorAll('table tbody tr')].find((r) => /\\bCRCLB\\b/.test(r.innerText))`);
    const live = await js(`(() => { const t = document.body.innerText; const r = [...document.querySelectorAll('table tbody tr')].find((r) => /\\bCRCLB\\b/.test(r.innerText)); return { status: t.match(/US market:[^\\n]+/)?.[0], crclb: r?.innerText.replace(/\\s+/g, ' '), rows: document.querySelectorAll('table tbody tr').length }; })()`);
    const rects = { board: await rectOf(panel("spread board")), crclb: crcl };
    await shot("gaps");
    setMeta("gaps", { url: "/dashboard/gaps", live, rects, notes: "Live Gap board (RWA Data API + Yahoo): eased scroll to the spread board (mark table), real click on the bStocks issuer chip (mark bstocks). Weekend: US market closed." });
    save();
  }

  // ===== overview: the desk at a glance =============================================================
  if (want("overview")) {
    await open("/dashboard", `/Today \\(\\d+ \\w+, UTC\\)/.test(document.body.innerText) && /net p&l/i.test(document.body.innerText)`, "today card");
    await sleep(2500);
    await stepped("overview", async (s) => {
      s.hold(3.0);
      const from = await scrollOf();
      const tilesY = await docY(`document.querySelector('[aria-label="Key figures"]')`);
      const to = Math.max(0, (tilesY ?? 700) - 220);
      await s.anim(3.0, scrollPose(from, to));
      s.mark("tiles");
      s.hold(3.6);
    });
    const rects = { tiles: await rectOf(`document.querySelector('[aria-label="Key figures"]')`) };
    const live = await js(`(() => document.querySelector('[aria-label="Key figures"]')?.innerText.replace(/\\s+/g, ' '))()`);
    await shot("overview");
    setMeta("overview", { url: "/dashboard", live, rects, notes: "Live Overview: hero and Today on the desk, then an eased scroll to the key figures (mark tiles)." });
    save();
  }
} catch (e) {
  log("FAILED:", e.stack || e.message);
  if (stopRec) { try { await stopRec(); } catch {} }
  process.exitCode = 1;
} finally {
  save();
  log("console:", b.consoleLines.slice(0, 12));
  clearTimeout(hardStop);
  b.close();
}
