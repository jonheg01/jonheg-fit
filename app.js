/* JonHeg Fit: local-first PWA. Data syncs to the fit-api edge function. */
(() => {
"use strict";
const D = window.FIT_DATA; const TUT = window.FIT_TUT || {}; const DRY = window.FIT_DRY;
const API = "https://pgldzfhatnpgucybobva.supabase.co/functions/v1/fit-api";
const HOST_USER = (() => {
  const q = new URLSearchParams(location.search).get("u"); if (q) return q.toLowerCase();
  const h = location.hostname; if (!h.endsWith("jonheg.fit")) return "";
  const sub = h.slice(0, -"jonheg.fit".length).replace(/\.$/, "");
  return sub && sub !== "www" ? sub : "jon";
})();
const $app = document.getElementById("app");

/* ---------- utils ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const r1 = n => n == null ? "" : (Math.round(n * 10) / 10).toString();
const r0 = n => n == null ? "" : Math.round(n).toLocaleString();
const ymd = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const today = () => ymd(new Date());
const fmtDate = d => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: new Date(d).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
const dayStart = s => new Date(s + "T12:00:00");
const kg = lb => lb / 2.20462;
const fmtSec = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
function toast(msg, ms = 2600) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function beep() {
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
  try { const a = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.25].forEach(off => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(0.2, a.currentTime + off); o.start(a.currentTime + off); o.stop(a.currentTime + off + 0.15); }); } catch (e) {}
}

/* ---------- session + store ---------- */
let S = JSON.parse(localStorage.getItem("fit:session") || "null"); // {token,user}
let R = new Map(); let dirty = new Set(); let lastSync = null; let syncing = false; let syncState = "";
const K = k => `fit:${S.user.id}:${k}`;
function loadStore() {
  R = new Map(Object.entries(JSON.parse(localStorage.getItem(K("recs")) || "{}")));
  dirty = new Set(JSON.parse(localStorage.getItem(K("dirty")) || "[]"));
  lastSync = localStorage.getItem(K("since"));
}
function saveStore() {
  localStorage.setItem(K("recs"), JSON.stringify(Object.fromEntries(R)));
  localStorage.setItem(K("dirty"), JSON.stringify([...dirty]));
  if (lastSync) localStorage.setItem(K("since"), lastSync);
}
function put(kind, data, id, ts) {
  id = id || `${kind}:${uid()}`;
  const prev = R.get(id);
  const rec = { id, kind, ts: ts || prev?.ts || new Date().toISOString(), data, deleted: false };
  R.set(id, rec); dirty.add(id); saveStore(); queueSync(); return rec;
}
function del(id) { const r = R.get(id); if (!r) return; r.deleted = true; dirty.add(id); saveStore(); queueSync(); }
const list = kind => [...R.values()].filter(r => r.kind === kind && !r.deleted).sort((a, b) => new Date(b.ts) - new Date(a.ts));
const profile = () => { const r = R.get("profile:" + S.user.id); return r && !r.deleted ? r.data : null; };
function setProfile(p) { put("profile", p, "profile:" + S.user.id); }

async function api(action, payload = {}) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", ...(S?.token ? { Authorization: "Bearer " + S.token } : {}) }, body: JSON.stringify({ action, ...payload }) });
  const j = await res.json().catch(() => ({ error: "Bad response" }));
  if (res.status === 401 && action !== "login") { signOut(true); throw new Error("Signed out"); }
  if (!res.ok || j.error && !j.path) throw new Error(j.error || "Request failed");
  return j;
}
let syncTimer = null;
function queueSync(ms = 1500) { clearTimeout(syncTimer); syncTimer = setTimeout(sync, ms); }
async function sync() {
  if (!S || syncing) return; syncing = true; setSync("Syncing");
  try {
    const ids = [...dirty].slice(0, 400);
    const upserts = ids.map(id => R.get(id)).filter(Boolean);
    const j = await api("sync", { upserts, since: lastSync });
    ids.forEach(id => dirty.delete(id));
    let changed = false;
    for (const r of j.records) { if (dirty.has(r.id)) continue; R.set(r.id, { id: r.id, kind: r.kind, ts: r.ts, data: r.data, deleted: r.deleted }); changed = true; }
    lastSync = j.server_time; saveStore(); setSync("Synced");
    if (dirty.size) queueSync(200);
    if (changed && !activeSession() && !document.querySelector(".modal") && !isTyping()) render();
  } catch (e) { setSync(navigator.onLine ? "Sync error" : "Offline"); }
  syncing = false;
}
const isTyping = () => ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
function setSync(s) { syncState = s; const el = document.getElementById("syncst"); if (el) el.textContent = s; }
function signOut(expired) { if (S) { localStorage.removeItem("fit:session"); } S = null; if (expired) toast("Please sign in again"); render(); }

/* ---------- derived data ---------- */
function age() { const p = profile(); return p?.age || null; }
function latestScan() { return list("scan")[0]?.data || null; }
function weights() {
  const pts = [];
  list("weight").forEach(r => pts.push({ x: new Date(r.ts), y: r.data.lb, src: r.data.source || "log" }));
  list("health").filter(r => /body_mass|weight/i.test(r.data.metric)).forEach(r => { let v = +r.data.value; if (/kg/i.test(r.data.units || "")) v *= 2.20462; pts.push({ x: new Date(r.ts), y: v, src: "apple" }); });
  const byDay = new Map(); pts.forEach(p => { const k = ymd(p.x); if (!byDay.has(k) || p.src === "log") byDay.set(k, p); });
  return [...byDay.values()].sort((a, b) => a.x - b.x);
}
function currentWeight() { const w = weights(); return w.length ? w[w.length - 1].y : (latestScan()?.weight_lb || null); }
function trendPerWeek(pts, days = 28) {
  const cut = Date.now() - days * 864e5; const p = pts.filter(q => q.x >= cut); if (p.length < 4) return null;
  const xs = p.map(q => (q.x - p[0].x) / 864e5), ys = p.map(q => q.y), n = p.length;
  const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let nu = 0, de = 0; xs.forEach((x, i) => { nu += (x - mx) * (ys[i] - my); de += (x - mx) ** 2; });
  return de ? nu / de * 7 : null;
}
function workouts() { return list("workout"); }
function bestSetHistory(exId) {
  const out = [];
  workouts().forEach(w => (w.data.items || []).forEach(it => { if (it.ex === exId) out.push({ ts: w.ts, sets: it.sets.filter(s => s.done) }); }));
  return out; // newest first
}
const e1rm = (w, r) => (w && r && r <= 12) ? w * (1 + r / 30) : null;

/* ---------- program generator ---------- */
function program(p = profile()) {
  if (!p) return [];
  const days = Math.min(5, Math.max(2, p.days || 3));
  const lvl = D.LEVELS[p.level] || D.LEVELS.intermediate;
  const g = D.GOALS[p.goal] || D.GOALS.maintain;
  const over50 = (p.age || 0) >= 45;
  const swap = id => { let x = lvl.swap[id] || id; if (over50 && D.OVER50_SWAP[x]) x = D.OVER50_SWAP[x]; if (p.swaps && p.swaps[x]) x = p.swaps[x]; return x; };
  return D.T[days].map((day, di) => {
    const blocks = day.blocks.map(b => {
      const ex = D.byId[swap(b.ex)];
      let sets = Math.max(1, b.sets + (["power", "cod", "cond", "mob"].includes(ex.cat) ? 0 : lvl.setsAdj) + (p.goal === "gain" && ["lower", "push", "pull", "single"].includes(ex.cat) ? 1 : 0));
      if (over50 && ["power", "cod"].includes(ex.cat)) sets = Math.max(2, sets - 1);
      let rep = ex.rep.slice();
      if (ex.unit === "wr" && ["lower", "push", "pull", "single"].includes(ex.cat)) rep = [Math.max(3, rep[0] + g.repShift), Math.max(5, rep[1] + g.repShift)];
      return { ex: ex.id, sets, rep, note: b.note || "", group: b.group || "" };
    });
    const fin = day.finisher && (p.goal === "lose" || p.goal === "recomp" || p.level !== "beginner") ? { ex: day.finisher.ex, sets: day.finisher.sets, rep: D.byId[day.finisher.ex].rep, note: day.finisher.note, group: "" } : null;
    if (fin) blocks.push(fin);
    return { idx: di, name: day.name, focus: day.focus, blocks, rir: lvl.rir };
  });
}
function nextDayIndex() {
  const prog = program(); if (!prog.length) return 0;
  const last = workouts().find(w => w.data.programDay != null);
  return last ? (last.data.programDay + 1) % prog.length : 0;
}
function restFor(ex, p) {
  const beg = p?.level === "beginner";
  return ({ power: 120, cod: 90, lower: beg ? 120 : 180, push: beg ? 90 : 150, pull: beg ? 90 : 120, single: 90, grip: 60, core: 45, cond: 60, mob: 0 })[ex.cat] ?? 90;
}
function suggest(exId, rep) {
  const ex = D.byId[exId]; const h = bestSetHistory(exId)[0];
  if (!h || !h.sets.length) return null;
  const top = h.sets.reduce((m, s) => (s.w || 0) > (m.w || 0) ? s : m, h.sets[0]);
  if (ex.unit !== "wr" && ex.unit !== "carry") return { w: top.w, r: top.r, t: top.t, why: "Beat last time" };
  const allTop = h.sets.every(s => (s.r || 0) >= rep[1] && (s.w || 0) >= (top.w || 0));
  const inc = ((profile()?.age || 0) >= 45 && ex.inc >= 10) ? ex.inc / 2 : (ex.inc || 5);
  if (allTop && top.w) return { w: top.w + inc, r: rep[0], why: `Hit ${rep[1]} reps on every set last time. Add ${inc} lb.` };
  return { w: top.w, r: Math.min(rep[1], (top.r || rep[0]) + 1), why: "Same weight, add a rep" };
}

/* ---------- nutrition ---------- */
function nutrition(p = profile()) {
  if (!p) return null;
  const scan = latestScan(); const wlb = currentWeight() || scan?.weight_lb; if (!wlb) return null;
  const w = kg(wlb), h = (p.heightIn || scan?.height_in || 70) * 2.54, a = p.age || scan?.age || 35, male = (p.sex || "male") === "male";
  let bmr, bmrHow;
  if (scan?.lean_body_mass_lb) { bmr = 370 + 21.6 * kg(scan.lean_body_mass_lb); bmrHow = "Katch-McArdle from your scan lean mass"; }
  else { bmr = 10 * w + 6.25 * h - 5 * a + (male ? 5 : -161); bmrHow = "Mifflin-St Jeor (add a scan for a sharper number)"; }
  const act = D.ACTIVITY[p.activity] || D.ACTIVITY.moderate;
  const tdee = bmr * act.f;
  const goal = D.GOALS[p.goal] || D.GOALS.maintain;
  let pct = goal.kcalPct;
  if (a < 18 && pct < -0.1) pct = -0.1;
  let kcal = tdee * (1 + pct);
  if (p.kcalAdjust) kcal += p.kcalAdjust;
  // protein g/kg by goal (ISSN 1.4 to 2.0, higher in a deficit), on adjusted weight if body fat is high
  const gkg = { lose: 2.2, recomp: 2.0, maintain: 1.6, gain: (scan?.body_fat_pct != null && scan.body_fat_pct < 15) ? 2.0 : 1.8, strength: 1.8 }[p.goal] + ((a >= 50) ? 0.2 : 0);
  let protW = w; const bf = scan?.body_fat_pct;
  if (bf && ((male && bf > 25) || (!male && bf > 32)) && scan.lean_body_mass_lb) protW = kg(scan.lean_body_mass_lb) / (male ? 0.82 : 0.75);
  const protein = gkg * protW;
  const fatPct = p.build === "carbsensitive" ? 0.32 : p.build === "hardgainer" ? 0.25 : 0.28;
  const fat = Math.max(0.6 * w, kcal * fatPct / 9);
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  const rate = { lose: [-1.0, -0.5], recomp: [-0.4, 0], maintain: [-0.25, 0.25], gain: [0.25, 0.5], strength: [0, 0.25] }[p.goal || "maintain"];
  return { bmr, bmrHow, tdee, act, kcal, protein, fat, carbs, gkg, protW, rateLb: rate.map(x => x / 100 * wlb), wlb, scan };
}
function todayFood() {
  const t = today(); const items = list("food").filter(r => ymd(r.ts) === t);
  return { items, kcal: items.reduce((s, r) => s + (r.data.kcal || 0), 0), protein: items.reduce((s, r) => s + (r.data.protein || 0), 0) };
}

/* ---------- charts ---------- */
function lineChart(pts, { h = 150, unit = "", color = "var(--acc)", target = null, invert = false } = {}) {
  if (!pts || pts.length < 2) return `<div class="dim" style="padding:12px 0">Log at least two entries to see a chart.</div>`;
  const W = 340, H = h, pl = 34, pr = 10, pt = 10, pb = 22;
  const xs = pts.map(p => +p.x), ys = pts.map(p => p.y).concat(target != null ? [target] : []);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) x1 = x0 + 864e5;
  let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = (y1 - y0) * 0.15 || 1; y0 -= pad; y1 += pad;
  const X = x => pl + (x - x0) / (x1 - x0) * (W - pl - pr), Y = y => pt + (1 - (y - y0) / (y1 - y0)) * (H - pt - pb);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(+p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join("");
  const area = d + `L${X(+pts[pts.length - 1].x).toFixed(1)},${H - pb}L${X(+pts[0].x).toFixed(1)},${H - pb}Z`;
  const ticks = [y0 + pad, (y0 + y1) / 2, y1 - pad];
  const gid = "g" + Math.random().toString(36).slice(2, 7);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="trend chart">
  <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
  ${ticks.map(t => `<line x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}" stroke="#2a3039" stroke-dasharray="3 4"/><text x="${pl - 6}" y="${Y(t) + 4}" fill="#6f7a88" font-size="10" text-anchor="end">${r1(t)}</text>`).join("")}
  ${target != null ? `<line x1="${pl}" x2="${W - pr}" y1="${Y(target)}" y2="${Y(target)}" stroke="var(--good)" stroke-dasharray="6 4"/><text x="${W - pr}" y="${Y(target) - 4}" fill="var(--good)" font-size="10" text-anchor="end">goal ${r1(target)}${unit}</text>` : ""}
  <path d="${area}" fill="url(#${gid})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  ${pts.map(p => `<circle cx="${X(+p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3" fill="${color}"/>`).join("")}
  <text x="${pl}" y="${H - 6}" fill="#6f7a88" font-size="10">${fmtDate(x0)}</text><text x="${W - pr}" y="${H - 6}" fill="#6f7a88" font-size="10" text-anchor="end">${fmtDate(x1)}</text>
  </svg>`;
}
function ring(val, max, label, sub, color = "var(--acc)") {
  const pct = Math.max(0, Math.min(1, max ? val / max : 0)), R0 = 34, C = 2 * Math.PI * R0;
  return `<div style="text-align:center"><svg class="ring" width="88" height="88" viewBox="0 0 88 88" style="margin:auto"><circle cx="44" cy="44" r="${R0}" stroke="#2a3039" stroke-width="9" fill="none"/><circle cx="44" cy="44" r="${R0}" stroke="${color}" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 44 44)"/><text x="44" y="49" text-anchor="middle" fill="#eef1f5" font-family="Barlow Condensed" font-weight="700" font-size="20">${r0(val)}</text></svg><div class="dim">${esc(label)}</div><div style="font-size:12px;color:var(--tx3)">${esc(sub)}</div></div>`;
}

/* ---------- icons ---------- */
const I = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  train: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/></svg>',
  shoot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>',
  body: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="4.5" r="2.5"/><path d="M5 9h14M12 9v6M8 22l4-7 4 7"/></svg>',
  fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3c4 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2-6 6-10z"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
};

/* ---------- routing ---------- */
const route = () => (location.hash.slice(1).split("?")[0] || "today").split("/");
window.addEventListener("hashchange", () => { window.scrollTo(0, 0); render(); });
function go(h) { location.hash = h; }

function shell(tab, inner, title) {
  const tabs = [["today", "Today"], ["train", "Train"], ["shoot", "Shoot"], ["progress", "Progress"], ["body", "Body"], ["fuel", "Fuel"]];
  return `<header class="top"><div class="wrap"><div class="brand">${esc(title || (S.user.name + "'s"))} <b>Fit</b></div><span class="sync" id="syncst">${esc(syncState)}</span><a class="iconbtn" href="#crew" aria-label="Crew competition">${I.trophy}</a><a class="iconbtn" href="#more" aria-label="Settings">${I.gear}</a></div></header>
  <main class="wrap">${inner}</main>
  <nav class="tabs"><div class="wrap">${tabs.map(([k, l]) => `<a href="#${k}" class="${tab === k ? "on" : ""}">${I[k]}<span>${l}</span></a>`).join("")}</div></nav>`;
}

/* ---------- login ---------- */
function viewLogin() {
  $app.innerHTML = `<div class="wrap login">
    <div class="mark">JonHeg<br><b>Fit</b></div>
    <p class="muted" style="margin:10px 0 22px">Gym strength and speed, match results and drill scores for USPSA and 3-Gun shooters.</p>
    <div class="card">
      <label class="f">Username</label><input class="i" id="lh" autocapitalize="none" autocomplete="username" value="${esc(HOST_USER)}" placeholder="e.g. jon">
      <label class="f">PIN (4 to 8 digits)</label><input class="i" id="lp" type="password" inputmode="numeric" autocomplete="current-password" maxlength="8">
      <div id="lnew" style="display:none"><label class="f">Your name</label><input class="i" id="ln"></div>
      <div style="height:14px"></div>
      <button class="btn pri full big" id="lgo">Sign in</button>
      <button class="btn ghost full" id="lcreate" style="margin-top:8px">New here? Create an account</button>
      <p class="dim" style="margin-top:12px">First time on a pre-made account (jon, brandon)? The PIN you type now becomes your PIN.</p>
      <div id="lerr" class="down" style="margin-top:8px"></div>
    </div></div>`;
  let create = false;
  document.getElementById("lcreate").onclick = () => { create = !create; document.getElementById("lnew").style.display = create ? "" : "none"; document.getElementById("lgo").textContent = create ? "Create account" : "Sign in"; };
  const go2 = async () => {
    const b = document.getElementById("lgo"); b.disabled = true;
    try {
      const j = await api("login", { handle: document.getElementById("lh").value.trim().toLowerCase(), pin: document.getElementById("lp").value, create, name: document.getElementById("ln").value.trim() });
      S = { token: j.token, user: j.user }; localStorage.setItem("fit:session", JSON.stringify(S));
      loadStore(); await sync(); if (j.user.must_change_pin) location.hash = "pin"; render();
    } catch (e) { document.getElementById("lerr").textContent = e.message; b.disabled = false; }
  };
  document.getElementById("lgo").onclick = go2;
  document.getElementById("lp").onkeydown = e => { if (e.key === "Enter") go2(); };
}

/* ---------- profile form ---------- */
function profileForm(p = {}, onDone) {
  const pills = (name, opts, cur) => `<div class="pill-sel" data-pill="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${esc(l)}</button>`).join("")}</div>`;
  return `<div class="card">
    <h2>Your profile</h2><p class="dim">This drives your program and your food targets.</p>
    <label class="f">Name</label><input class="i" name="name" value="${esc(p.name || S.user.name)}">
    <div class="grid2"><div><label class="f">Age</label><input class="i" name="age" inputmode="numeric" value="${esc(p.age || "")}"></div>
    <div><label class="f">Height (in)</label><input class="i" name="heightIn" inputmode="decimal" value="${esc(p.heightIn || "")}"></div></div>
    <label class="f">Sex (for the calorie formula)</label>${pills("sex", [["male", "Male"], ["female", "Female"]], p.sex || "male")}
    <label class="f">Main goal</label>${pills("goal", Object.entries(D.GOALS).map(([k, g]) => [k, g.label]), p.goal || "maintain")}
    <label class="f">Goal weight (lb, optional)</label><input class="i" name="targetWeightLb" inputmode="decimal" value="${esc(p.targetWeightLb || "")}">
    <label class="f">Lifting experience</label>${pills("level", [["beginner", "Under 1 year"], ["intermediate", "1 to 3 years"], ["advanced", "3+ years"]], p.level || "intermediate")}
    <label class="f">Gym days per week</label>${pills("days", [[2, "2"], [3, "3"], [4, "4"], [5, "5"]], p.days || 3)}
    <label class="f">Activity outside the gym</label>${pills("activity", Object.entries(D.ACTIVITY).map(([k, a]) => [k, a.l]), p.activity || "moderate")}
    <label class="f">How your body responds to food</label>${pills("build", [["hardgainer", "Hard to gain weight"], ["average", "Somewhere in the middle"], ["carbsensitive", "Gain fat easily"]], p.build || "average")}
    <p class="dim">The old ectomorph, mesomorph, endomorph body types have little science behind them, so the app uses this simple answer only to nudge your carb and fat split. Scans and weight trends drive the real numbers.</p>
    <label class="f">Shooting level</label>${pills("shootLevel", [["new", "New shooter"], ["local", "Local matches"], ["competitor", "Regular competitor"], ["elite", "Major matches, A/M/GM"]], p.shootLevel || "local")}
    <label class="f">Divisions and sports (comma separated)</label><input class="i" name="divisions" value="${esc((p.divisions || []).join(", "))}" placeholder="USPSA Carry Optics, 3-Gun Open">
    <label class="f">USPSA number / classification (optional)</label><input class="i" name="classification" value="${esc(p.classification || "")}">
    <label class="f">Gym</label><input class="i" name="gym" value="${esc(p.gym || "")}">
    <div style="height:14px"></div><button class="btn pri full big" data-act="saveprofile">Save profile</button></div>`;
}
function bindProfile(root, onDone) {
  root.querySelectorAll("[data-pill] button").forEach(b => b.onclick = () => { b.parentElement.querySelectorAll("button").forEach(x => x.classList.remove("on")); b.classList.add("on"); });
  root.querySelector('[data-act="saveprofile"]').onclick = () => {
    const p = { ...(profile() || {}) };
    root.querySelectorAll("input[name]").forEach(i => { p[i.name] = i.value.trim(); });
    root.querySelectorAll("[data-pill]").forEach(g => { const on = g.querySelector(".on"); if (on) p[g.dataset.pill] = on.dataset.v; });
    p.age = num(p.age); p.heightIn = num(p.heightIn); p.targetWeightLb = num(p.targetWeightLb); p.days = num(p.days) || 3;
    p.divisions = String(p.divisions || "").split(",").map(s => s.trim()).filter(Boolean);
    setProfile(p); toast("Profile saved"); onDone && onDone();
  };
}

/* ---------- TODAY ---------- */
function viewToday() {
  const p = profile();
  if (!p) { $app.innerHTML = shell("today", `<h1 style="margin:6px 0">Welcome</h1>${profileForm({})}`); bindProfile($app, () => render()); return; }
  const prog = program(p), nd = prog[nextDayIndex()];
  const n = nutrition(p), f = todayFood();
  const scan = latestScan(), w = weights(), cw = currentWeight(), tr = trendPerWeek(w);
  const wk = weekStrip();
  const hl = healthToday();
  const act = activeSession();
  const hour = new Date().getHours();
  const hi = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const drillPBs = D.DRILLS.map(dr => ({ dr, best: bestDrill(dr) })).filter(x => x.best);
  const lastMatch = list("match")[0];
  $app.innerHTML = shell("today", `
    <h1 style="margin:4px 0 2px">${hi}, ${esc(p.name || S.user.name)}</h1>
    <div class="dim">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
    ${act ? `<div class="card hero"><div class="spread"><div><div class="chip acc">In progress</div><h2 style="margin-top:6px">${esc(act.dayName)}</h2><div class="dim">Started ${new Date(act.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div></div><a class="btn pri" href="#session">Resume</a></div></div>` :
    workoutCarousel(prog, nd)}
    <div id="crewcard">${crewCard()}</div>
    <div class="card"><div class="spread"><h3>This week</h3><a class="dim" href="#train">History</a></div>${wk}</div>
    ${n ? `<div class="card"><div class="spread"><h3>Today's fuel</h3><a class="btn sm" href="#fuel">Log food</a></div>
      <div class="grid3" style="margin-top:10px">${ring(f.kcal, n.kcal, "Calories", `of ${r0(n.kcal)}`)}${ring(f.protein, n.protein, "Protein g", `of ${r0(n.protein)}`, "var(--good)")}${ring((n.kcal - f.kcal) > 0 ? n.kcal - f.kcal : 0, n.kcal, "Left", "kcal", "var(--info)")}</div></div>` : ""}
    <div class="grid2">
      <div class="stat"><div class="k">Weight</div><div class="v">${cw ? r1(cw) : "--"}</div><div class="s">${tr != null ? `<span class="${tr >= 0 ? "up" : "down"}">${tr >= 0 ? "+" : ""}${r1(tr)} lb/wk</span>` : "Log weight to see trend"}</div></div>
      <div class="stat"><div class="k">Body fat</div><div class="v">${scan?.body_fat_pct != null ? r1(scan.body_fat_pct) + "%" : "--"}</div><div class="s">${scan ? "Scan " + fmtDate(list("scan")[0].ts) : "No scan yet"}</div></div>
      <div class="stat"><div class="k">Muscle</div><div class="v">${scan?.skeletal_muscle_mass_lb != null ? r1(scan.skeletal_muscle_mass_lb) : "--"}</div><div class="s">Skeletal muscle, lb</div></div>
      <div class="stat"><div class="k">Workouts</div><div class="v">${workouts().filter(x => Date.now() - new Date(x.ts) < 30 * 864e5).length}</div><div class="s">Last 30 days</div></div>
    </div>
    ${hl ? `<div class="card"><div class="spread"><h3>Apple Health</h3><span class="dim">${esc(hl.when)}</span></div><div class="grid3" style="margin-top:8px">${hl.tiles.map(t => `<div class="stat"><div class="k">${esc(t.k)}</div><div class="v" style="font-size:24px">${esc(t.v)}</div></div>`).join("")}</div></div>` : ""}
    <div class="card"><h3>Quick log</h3><div class="grid2" style="margin-top:10px">
      <button class="btn" data-act="qweight">Weight</button><button class="btn" data-act="qcardio">Run or ride</button>
      <a class="btn" href="#shoot/dry">Dry fire</a><a class="btn" href="#shoot">Drill score</a><a class="btn" href="#match/new">Match result</a>
      <a class="btn" href="#tape/new">Tape measure</a><a class="btn" href="#scan/new">Photo a scan</a></div></div>
    ${drillPBs.length || lastMatch ? `<div class="card"><h3>Shooting</h3>${lastMatch ? `<div class="li" onclick="location.hash='match/${lastMatch.id}'"><div class="grow"><div class="t">${esc(lastMatch.data.name || "Match")}</div><div class="dim">${fmtDate(lastMatch.ts)} ${esc(lastMatch.data.division || "")}</div></div><div class="badge">${lastMatch.data.pct ? r1(lastMatch.data.pct) + "%" : ""}</div></div>` : ""}
      ${drillPBs.slice(0, 3).map(x => `<div class="li" onclick="location.hash='drill/${x.dr.id}'"><div class="grow"><div class="t">${esc(x.dr.name)}</div><div class="dim">Best ${esc(drillVal(x.dr, x.best))}</div></div>${x.best.rating ? `<span class="badge">${esc(x.best.rating)}</span>` : ""}</div>`).join("")}</div>` : ""}
  `);
  bindCommon(); bindCarousel(); loadLeague();
}
function weekStrip() {
  const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const days = [...Array(7)].map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return ymd(d); });
  const wd = new Set(workouts().map(w => ymd(w.ts))), cd = new Set(list("cardio").map(w => ymd(w.ts))), sd = new Set([...list("match"), ...list("drill"), ...list("dryfire")].map(w => ymd(w.ts)));
  return `<div class="week">${days.map((d, i) => `<div>${"MTWTFSS"[i]}<i class="${wd.has(d) ? "on" : sd.has(d) ? "shoot" : cd.has(d) ? "cardio" : ""}"></i></div>`).join("")}</div>
  <div class="dim" style="margin-top:8px"><span style="color:var(--acc)">Gym</span> &middot; <span style="color:var(--good)">Shooting</span> &middot; <span style="color:var(--info)">Run or ride</span></div>`;
}
function healthToday() {
  const hs = list("health"); if (!hs.length) return null;
  const latest = m => hs.find(r => m.test(r.data.metric));
  const tiles = [];
  const t = today();
  const steps = hs.filter(r => /step/i.test(r.data.metric) && ymd(r.ts) === t).reduce((s, r) => s + (+r.data.value || 0), 0);
  if (steps) tiles.push({ k: "Steps", v: r0(steps) });
  const rhr = latest(/resting_heart|restingheart/i); if (rhr) tiles.push({ k: "Rest HR", v: r0(rhr.data.value) });
  const hrv = latest(/heart_rate_variability|hrv/i); if (hrv) tiles.push({ k: "HRV ms", v: r0(hrv.data.value) });
  const sleep = latest(/sleep/i); if (sleep && tiles.length < 3) tiles.push({ k: "Sleep h", v: r1(+sleep.data.value) });
  const ae = hs.filter(r => /active_energy/i.test(r.data.metric) && ymd(r.ts) === t).reduce((s, r) => s + (+r.data.value || 0), 0);
  if (ae && tiles.length < 3) tiles.push({ k: "Active kcal", v: r0(ae) });
  if (!tiles.length) return null;
  return { tiles: tiles.slice(0, 3), when: "Updated " + fmtDate(hs[0].ts) };
}

function workoutCarousel(prog, nd) {
  if (!nd) return "";
  const order = [nd, ...prog.filter(d => d.idx !== nd.idx)];
  const mins = d => Math.round(d.blocks.reduce((s, b) => s + b.sets, 0) * 2.6 + 12);
  const done = new Map(); workouts().forEach(w => { if (w.data.programDay != null && !done.has(w.data.programDay)) done.set(w.data.programDay, w.ts); });
  const cards = order.map((d, i) => `<div class="wcard ${i === 0 ? "hero" : ""}">
    <div class="dim" style="text-transform:uppercase;letter-spacing:.08em">${i === 0 ? "Today's recommended workout" : "Or choose"}</div>
    <h2 style="margin:4px 0">${esc(d.name)}</h2><div class="muted">${esc(d.focus)}</div>
    <div class="dim" style="margin:6px 0 4px">${d.blocks.length} exercises, about ${mins(d)} min</div>
    <div class="dim" style="margin-bottom:12px">${done.has(d.idx) ? "Last done " + fmtDate(done.get(d.idx)) : "Not done yet"}</div>
    <button class="btn ${i === 0 ? "pri" : ""} full big" data-act="start" data-day="${d.idx}">Start</button></div>`).join("")
    + `<div class="wcard"><div class="dim" style="text-transform:uppercase;letter-spacing:.08em">Your own</div><h2 style="margin:4px 0">Custom workout</h2><div class="muted">Start empty and add any exercises.</div><div style="height:58px"></div><button class="btn full big" data-act="startblank">Start empty</button></div>`;
  return `<div class="carousel" id="wcar">${cards}</div><div class="dots" id="wdots">${order.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}<i></i></div>`;
}
function bindCarousel() {
  const c = document.getElementById("wcar"); if (!c) return;
  const dots = [...document.querySelectorAll("#wdots i")];
  c.addEventListener("scroll", () => { const i = Math.round(c.scrollLeft / (c.firstElementChild.offsetWidth + 12)); dots.forEach((d, k) => d.classList.toggle("on", k === i)); }, { passive: true });
}

/* ---------- CREW (competition) ---------- */
let LEAGUE = null; let leagueLoading = false;
function leagueCached() { if (!LEAGUE && S) { try { LEAGUE = JSON.parse(localStorage.getItem(K("league")) || "null"); } catch (e) {} } return LEAGUE; }
async function loadLeague(force) {
  if (!S || leagueLoading) return; leagueLoading = true;
  try { const j = await api("league", { tzOffsetMin: -new Date().getTimezoneOffset() }); LEAGUE = j; localStorage.setItem(K("league"), JSON.stringify(j)); } catch (e) {}
  leagueLoading = false;
  const cc = document.getElementById("crewcard"); if (cc) cc.innerHTML = crewCard();
  if (route()[0] === "crew" && !isTyping()) viewCrew();
}
const medal = i => ["&#129351;", "&#129352;", "&#129353;"][i] || `<span class="dim">${i + 1}</span>`;
function crewCard() {
  const L = leagueCached();
  if (!L) return `<div class="card"><div class="row"><span class="spin"></span><span class="dim">Loading the crew standings</span></div></div>`;
  if (!L.teams.length) return `<div class="card"><h3>Crew competition</h3><p class="dim">Join a crew with a code to compete on weekly points.</p><a class="btn full" href="#crew">Join a crew</a></div>`;
  const t = L.teams[0]; const ms = t.members.slice().sort((a, b) => b.week.pts - a.week.pts || b.month - a.month);
  const me = ms.find(m => m.me); const lead = ms[0]; const gap = me && lead && !lead.me ? lead.week.pts - me.week.pts : 0;
  const daysLeft = 7 - ((new Date().getDay() + 6) % 7);
  return `<div class="card crew"><div class="spread"><div><div class="dim" style="text-transform:uppercase;letter-spacing:.08em">${esc(t.name)} &middot; this week</div><h2 style="margin-top:2px">${me && lead?.me && ms.length > 1 && lead.week.pts > ms[1].week.pts ? "You're in the lead" : gap ? `${gap} pts behind ${esc(lead.name)}` : "Weekly showdown"}</h2></div><a class="btn sm" href="#crew">Full board</a></div>
   <div class="list" style="margin-top:6px">${ms.map((m, i) => `<div class="li ${m.me ? "meRow" : ""}" onclick="location.hash='crew/${m.handle}'"><div style="width:26px;text-align:center;font-size:20px">${medal(i)}</div><div class="grow"><div class="t">${esc(m.name)}${m.me ? " <span class='dim'>(you)</span>" : ""}</div><div class="dim">${m.week.workouts}/${m.planned} workouts${m.streak ? ` &middot; ${m.streak} wk streak` : ""}${m.week.pbs ? ` &middot; ${m.week.pbs} drill PB` : ""}</div></div><div class="pts">${m.week.pts}</div></div>`).join("")}</div>
   <div class="dim" style="margin-top:6px">${daysLeft} day${daysLeft === 1 ? "" : "s"} left. Points reset Monday.</div></div>`;
}
function viewCrew() {
  const L = leagueCached(); const sub = route()[1];
  if (!L) { $app.innerHTML = shell("", `<h1>Crew</h1><div class="empty"><span class="spin"></span></div>`); loadLeague(); return; }
  if (sub && sub !== "board") return viewCrewMember(sub);
  const t = L.teams[0];
  const seg = new URLSearchParams(location.hash.split("?")[1] || "").get("v") || "week";
  let inner = `<h1 style="margin:4px 0">Crew</h1>`;
  if (t) {
    const ms = t.members.slice();
    const sortKey = { week: m => m.week.pts, last: m => m.lastWeek, month: m => m.month, total: m => m.total, strength: m => m.rel || 0 }[seg] || (m => m.week.pts);
    ms.sort((a, b) => sortKey(b) - sortKey(a));
    inner += `<div class="dim">${esc(t.name)}</div><div class="seg">${[["week", "This week"], ["last", "Last week"], ["month", "Month"], ["total", "All time"], ["strength", "Strength"]].map(([k, l]) => `<button class="${seg === k ? "on" : ""}" onclick="location.hash='crew/board?v=${k}'">${l}</button>`).join("")}</div>
    <div class="card"><div class="list">${ms.map((m, i) => `<div class="li ${m.me ? "meRow" : ""}" onclick="location.hash='crew/${m.handle}'"><div style="width:26px;text-align:center;font-size:20px">${medal(i)}</div><div class="grow"><div class="t">${esc(m.name)}</div><div class="dim">${seg === "strength" ? "Best squat + bench + deadlift, times bodyweight" : esc(m.progress.label)}</div></div><div class="pts">${seg === "strength" ? (m.rel ? m.rel.toFixed(2) + "x" : "--") : sortKey(m)}</div></div>`).join("")}</div></div>`;
    // head to head drills
    const drillIds = [...new Set(t.members.flatMap(m => Object.keys(m.drillBest || {})))];
    const h2h = drillIds.map(id => { const dr = D.DRILLS.find(d => d.id === id); if (!dr) return null; const vals = t.members.filter(m => m.drillBest?.[id] != null).map(m => ({ m, v: m.drillBest[id] })); if (vals.length < 2) return null; vals.sort((a, b) => dr.scoring === "points" ? b.v - a.v : a.v - b.v); return { dr, vals }; }).filter(Boolean);
    inner += `<div class="card"><h3>Head to head: drills</h3>${h2h.length ? h2h.map(x => `<div style="margin-top:10px"><div class="t">${esc(x.dr.name)}</div>${x.vals.map((v, i) => `<div class="spread dim"><span>${medal(i)} ${esc(v.m.name)}</span><span>${x.dr.scoring === "points" ? v.v : v.v.toFixed(2) + " s"}</span></div>`).join("")}</div>`).join("") : `<p class="dim">When two or more of you log the same drill, the matchup shows here.</p>`}</div>`;
    inner += `<div class="card"><h3>How points work</h3><table class="t">${[["Gym workout", L.points.workout], ["Each lifting PR", L.points.pr], ["Hit your planned gym days for the week", L.points.planBonus], ["Run, ride or cardio", L.points.cardio], ["Drill run logged (max " + L.points.drillMax + " a week)", L.points.drill], ["Drill personal best", L.points.drillPb], ["Match", L.points.match], ["Dry fire session (once a day)", L.points.dry || 3], ["Weigh-in (once a day)", L.points.weighDay], ["Food logged (once a day)", L.points.foodDay], ["Body scan", L.points.scan], ["Tape measurements", L.points.tape]].map(([l, p]) => `<tr><td>${esc(l)}</td><td class="n">${p}</td></tr>`).join("")}</table><p class="dim">Everyone plays against their own plan, so a 3-day lifter and a 5-day lifter both earn the weekly bonus by hitting their own target. Strength ranks by lift total divided by bodyweight, so bigger lifters get no free edge.</p></div>`;
    inner += `<div class="card"><h3>Invite someone</h3><p class="dim">Share code <b style="color:var(--acc);font-size:18px;letter-spacing:.1em">${esc(t.code)}</b>. They sign up, then join from this page.${S.user.is_admin ? ` Or add them yourself in <a href="#more/admin">Settings, People</a> and they get an email with everything.` : ""}</p></div>`;
  }
  inner += `<div class="card"><h3>${t ? "Join another crew" : "Join a crew"}</h3><div class="row"><input class="i grow" id="jc" placeholder="Code" autocapitalize="characters" style="margin:0"><button class="btn pri" id="jbtn">Join</button></div>
    <div class="row" style="margin-top:10px"><input class="i grow" id="tn" placeholder="Or start a new crew: name" style="margin:0"><button class="btn" id="tbtn">Create</button></div></div>
    ${L.teams.length > 1 ? `<div class="card"><h3>Your crews</h3>${L.teams.map(x => `<div class="li"><div class="grow t">${esc(x.name)}</div><span class="dim">${esc(x.code)} &middot; ${x.members.length}</span></div>`).join("")}</div>` : ""}`;
  $app.innerHTML = shell("", inner); bindCommon();
  document.getElementById("jbtn").onclick = async () => { try { const j = await api("team_join", { code: document.getElementById("jc").value }); toast("Joined " + j.team.name); LEAGUE = null; localStorage.removeItem(K("league")); loadLeague(); } catch (e) { toast(e.message); } };
  document.getElementById("tbtn").onclick = async () => { try { const j = await api("team_create", { name: document.getElementById("tn").value }); toast(`Crew created. Code ${j.team.code}`, 5000); LEAGUE = null; localStorage.removeItem(K("league")); loadLeague(); } catch (e) { toast(e.message); } };
}
function viewCrewMember(handle) {
  const L = leagueCached(); const m = L?.teams.flatMap(t => t.members).find(x => x.handle === handle);
  if (!m) return go("crew");
  const parts = Object.entries(m.week.parts || {}).sort((a, b) => b[1] - a[1]);
  const pts = (m.weeks || []).map(w => ({ x: new Date(w.week + "T12:00:00"), y: w.pts }));
  $app.innerHTML = shell("", `<a class="dim" href="#crew">&lsaquo; Crew</a><h1 style="margin:6px 0">${esc(m.name)}</h1>
   <div class="grid3"><div class="stat"><div class="k">This week</div><div class="v">${m.week.pts}</div></div><div class="stat"><div class="k">Streak</div><div class="v">${m.streak}</div><div class="s">weeks on plan</div></div><div class="stat"><div class="k">All time</div><div class="v">${m.total}</div></div></div>
   <div class="card"><h3>This week's points</h3>${parts.length ? `<table class="t">${parts.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${v}</td></tr>`).join("")}</table>` : `<p class="dim">Nothing yet this week.</p>`}</div>
   <div class="card"><h3>Weekly points</h3>${lineChart(pts)}</div>
   <div class="card"><h3>Progress</h3><p>${esc(m.progress.label)}</p>${m.progress.pct != null ? `<div class="bar"><i style="width:${m.progress.pct}%"></i></div>` : ""}
   ${m.rel ? `<p class="dim">Strength: lifts total ${m.rel.toFixed(2)} times bodyweight.</p>` : ""}${m.lastMatch ? `<p class="dim">Last match: ${esc(m.lastMatch.name || "")} ${m.lastMatch.pct ? m.lastMatch.pct + "%" : ""}</p>` : ""}</div>`);
  bindCommon();
}

/* ---------- PIN change + admin ---------- */
function viewPin() {
  $app.innerHTML = `<div class="wrap login"><div class="mark">Pick your<br><b>PIN</b></div><p class="muted">Choose a 4 to 8 digit PIN you will remember. You will use it to sign in on any device.</p>
   <div class="card"><label class="f">New PIN</label><input class="i" id="p1" type="password" inputmode="numeric" maxlength="8"><label class="f">Type it again</label><input class="i" id="p2" type="password" inputmode="numeric" maxlength="8"><div style="height:12px"></div><button class="btn pri full big" id="psave">Save PIN</button><div id="perr" class="down" style="margin-top:8px"></div>${S.user.must_change_pin ? "" : `<a class="btn ghost full" href="#more" style="margin-top:8px">Cancel</a>`}</div></div>`;
  document.getElementById("psave").onclick = async () => {
    const a1 = document.getElementById("p1").value, a2 = document.getElementById("p2").value;
    if (!/^\d{4,8}$/.test(a1)) return document.getElementById("perr").textContent = "Use 4 to 8 digits";
    if (a1 !== a2) return document.getElementById("perr").textContent = "Those don't match";
    try { await api("set_pin", { pin: a1 }); S.user.must_change_pin = false; localStorage.setItem("fit:session", JSON.stringify(S)); toast("PIN saved"); go("today"); } catch (e) { document.getElementById("perr").textContent = e.message; }
  };
}
async function viewAdmin() {
  if (!S.user.is_admin) return go("more");
  $app.innerHTML = shell("", `<a class="dim" href="#more">&lsaquo; Settings</a><h1 style="margin:6px 0">People</h1>
   <div class="card" id="af"><h3>Add a person</h3><p class="dim">They get their own address (username.jonheg.fit), join your crew, and receive an email with a temporary PIN plus how to use the app.</p>
    <label class="f">Name</label><input class="i" name="name" placeholder="First and last name">
    <label class="f">Username (becomes their web address)</label><input class="i" name="handle" autocapitalize="none" placeholder="e.g. mike"><div class="dim" id="hprev"></div>
    <label class="f">Email</label><input class="i" name="email" type="email" autocapitalize="none" placeholder="name@example.com">
    <label class="f">Main goal (they can change it)</label><select class="i" name="goal">${Object.entries(D.GOALS).map(([k, g]) => `<option value="${k}" ${k === "maintain" ? "selected" : ""}>${esc(g.label)}</option>`).join("")}</select>
    <label class="f">Lifting experience</label><select class="i" name="level"><option value="beginner">Under 1 year</option><option value="intermediate" selected>1 to 3 years</option><option value="advanced">3+ years</option></select>
    <div style="height:12px"></div><button class="btn pri full big" id="aadd">Add and send email</button><div id="ares" style="margin-top:10px"></div></div>
   <div class="card"><h3>Everyone</h3><div id="alist"><span class="spin"></span></div></div>`);
  bindCommon();
  const hf = document.querySelector('#af [name=handle]');
  const nf = document.querySelector('#af [name=name]');
  nf.oninput = () => { if (!hf.dataset.touched) { hf.value = nf.value.trim().split(" ")[0].toLowerCase().replace(/[^a-z0-9-]/g, ""); hf.oninput(); } };
  hf.oninput = e => { if (e) hf.dataset.touched = "1"; document.getElementById("hprev").textContent = hf.value ? `${hf.value}.jonheg.fit` : ""; };
  const drawList = async () => {
    try { const j = await api("admin_list"); document.getElementById("alist").innerHTML = j.users.map(u => `<div class="li"><div class="grow"><div class="t">${esc(u.name)} <span class="dim">@${esc(u.handle)}</span></div><div class="dim">${esc(u.handle === "jon" ? "jonheg.fit" : u.url.replace("https://", ""))}${u.email ? " &middot; " + esc(u.email) : ""}${u.pending ? " &middot; <span style='color:var(--acc)'>hasn't signed in</span>" : ""}</div></div>${u.email && u.handle !== S.user.handle ? `<button class="btn sm" data-resend="${esc(u.handle)}">Resend</button>` : ""}</div>`).join("");
      document.querySelectorAll("[data-resend]").forEach(b => b.onclick = async () => { if (!confirm("Send a new temporary PIN and the welcome email again?")) return; b.disabled = true; try { const r = await api("admin_resend", { handle: b.dataset.resend }); toast(r.email.sent ? `Sent. New temporary PIN ${r.tempPin}` : `Email failed. Temporary PIN ${r.tempPin}`, 7000); } catch (e) { toast(e.message); } b.disabled = false; });
    } catch (e) { document.getElementById("alist").textContent = e.message; }
  };
  drawList();
  document.getElementById("aadd").onclick = async () => {
    const f = n => document.querySelector(`#af [name=${n}]`).value.trim();
    const b = document.getElementById("aadd"); b.disabled = true; const out = document.getElementById("ares"); out.innerHTML = `<div class="row"><span class="spin"></span><span>Setting up their account</span></div>`;
    try {
      const r = await api("admin_add", { name: f("name"), handle: f("handle").toLowerCase(), email: f("email"), profile: { goal: f("goal"), level: f("level"), days: 3, activity: "moderate", sex: "male", divisions: [] } });
      out.innerHTML = `<div class="note"><b>${esc(f("name"))} is in.</b><br>Address: ${esc(r.url.replace("https://", ""))}${r.email.live ? "" : " (goes live once the wildcard DNS record is in; the email points to jonheg.fit until then)"}<br>Temporary PIN: <b>${esc(r.tempPin)}</b><br>Email: ${r.email.sent ? "sent" : "NOT sent" + (r.email.error ? " (" + esc(r.email.error) + ")" : "")}<br>Joined your crew${r.teams.length > 1 ? "s" : ""}.</div>`;
      document.querySelectorAll("#af input").forEach(i => i.value = ""); delete hf.dataset.touched; LEAGUE = null; localStorage.removeItem(K("league")); drawList();
    } catch (e) { out.innerHTML = `<div class="down">${esc(e.message)}</div>`; }
    b.disabled = false;
  };
}

/* ---------- tutorials ---------- */
const vidUrl = ex => "https://www.youtube.com/results?search_query=" + encodeURIComponent(ex.name + " exercise proper form");
function tutorialInner(ex) {
  const t = TUT[ex.id]; if (!t) return `<p class="dim">${esc(ex.cue)}</p><a href="${vidUrl(ex)}" target="_blank" rel="noopener">Watch form videos</a>`;
  return `${t.setup ? `<p><b>Setup:</b> ${esc(t.setup)}</p>` : ""}<ol class="steps">${t.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
   ${t.mistakes?.length ? `<p><b>Avoid:</b></p><ul class="steps">${t.mistakes.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
   <div class="grid2" style="margin:8px 0">${t.easier ? `<div class="stat"><div class="k">Easier</div><div style="font-size:14px">${esc(t.easier)}</div></div>` : ""}${t.harder ? `<div class="stat"><div class="k">Harder</div><div style="font-size:14px">${esc(t.harder)}</div></div>` : ""}</div>
   <a class="btn sm" href="${vidUrl(ex)}" target="_blank" rel="noopener">&#9654; Watch form videos</a>`;
}
const tutorialHtml = ex => `<div class="card"><h3>How to do it</h3>${tutorialInner(ex)}</div>`;

/* ---------- DRY FIRE ---------- */
const GUNS = [["pistol", "Pistol"], ["rifle", "Rifle / PCC"], ["shotgun", "Shotgun"]];
const dryGun = () => localStorage.getItem(K("drygun")) || "pistol";
const dryDrill = id => { for (const g of Object.keys(DRY.guns)) { const d = DRY.guns[g].find(x => x.id === id); if (d) return { ...d, gun: g }; } return null; };
function dryStats(id) {
  const reps = list("dryfire").flatMap(s => (s.data.drills || []).filter(d => d.id === id).map(d => ({ ...d, ts: s.ts })));
  const made = reps.filter(r => r.par && r.reps && r.made / r.reps >= 0.8);
  const best = made.length ? Math.min(...made.map(r => r.par)) : null;
  const last = reps[0] || null;
  return { reps: reps.reduce((s, r) => s + (r.reps || 0), 0), best, lastPar: last?.par || null, sessions: reps.length, history: reps };
}
function viewDry() {
  const g = route()[2] && DRY.guns[route()[2]] ? route()[2] : dryGun(); localStorage.setItem(K("drygun"), g);
  const sessions = list("dryfire"); const first = !sessions.length;
  const week = sessions.filter(s => Date.now() - new Date(s.ts) < 7 * 864e5);
  const lv = { beginner: "Start here", intermediate: "Intermediate", advanced: "Advanced" };
  let inner = `<h1 style="margin:4px 0">Shoot</h1>${shootSeg("dry")}
   <div class="seg">${GUNS.map(([k, l]) => `<button class="${g === k ? "on" : ""}" onclick="location.hash='shoot/dry/${k}'">${l}</button>`).join("")}</div>
   <div class="card hero"><div class="dim" style="text-transform:uppercase;letter-spacing:.08em">Today's ${esc(GUNS.find(x => x[0] === g)[1].toLowerCase())} routine</div>
    <h2 style="margin:4px 0">${DRY.routines[g].reduce((s, r) => s + r[1], 0)} minutes, ${DRY.routines[g].length} drills</h2>
    <div class="dim">${DRY.routines[g].map(r => esc(dryDrill(r[0]).name)).join(" &middot; ")}</div>
    <div class="dim" style="margin-top:6px">This week: ${week.length} session${week.length === 1 ? "" : "s"}, ${week.reduce((s, x) => s + (x.data.minutes || 0), 0)} min</div>
    <a class="btn pri full big" style="margin-top:12px" href="#dryrun/${g}">Start routine</a></div>
   <details class="card" ${first ? "open" : ""}><summary><h3 style="display:inline">New to dry fire? Start here</h3></summary>${DRY.intro.map(p => `<p class="muted">${esc(p)}</p>`).join("")}<p class="muted"><b>Setup for ${esc(g)}:</b> ${esc(DRY.setup[g])}</p></details>
   <details class="card" ${first ? "open" : ""}><summary><h3 style="display:inline">Safety checklist, every session</h3></summary><ol class="steps">${DRY.safety.map(s => `<li>${esc(s)}</li>`).join("")}</ol></details>`;
  ["beginner", "intermediate", "advanced"].forEach(l => {
    const ds = DRY.guns[g].filter(d => d.level === l); if (!ds.length) return;
    inner += `<div class="card"><h3>${lv[l]}</h3><div class="list">${ds.map(d => { const st = dryStats(d.id); return `<div class="li" onclick="location.hash='drydrill/${d.id}'"><div class="grow"><div class="t">${esc(d.name)}</div><div class="dim">${st.reps ? `${st.reps} reps${st.best ? " &middot; best par " + st.best.toFixed(2) + " s" : ""}` : esc(d.focus)}</div></div><span class="chev">&rsaquo;</span></div>`; }).join("")}</div></div>`;
  });
  $app.innerHTML = shell("shoot", inner); bindCommon();
}
const shootSeg = cur => `<div class="seg">${[["drills", "Live drills"], ["dry", "Dry fire"], ["matches", "Matches"]].map(([k, l]) => `<button class="${cur === k ? "on" : ""}" onclick="location.hash='shoot/${k}'">${l}</button>`).join("")}</div>`;

// par timer: random delay, start beep, par beep
let parT = null;
function tone(freq, dur) { try { const ac = window.__ac || (window.__ac = new (window.AudioContext || window.webkitAudioContext)()); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = freq; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(0.35, ac.currentTime); o.start(); o.stop(ac.currentTime + dur); } catch (e) {} }
function parTimerHtml(d, par) {
  return `<div class="card partimer" id="pt"><div class="spread"><h3>Par timer</h3><span class="dim" id="ptstate">Ready</span></div>
   <div class="row" style="margin-top:8px"><button class="btn" data-pt="-0.1">-0.1</button><div class="grow" style="text-align:center"><div class="dim">Par</div><div id="ptpar" style="font-family:var(--disp);font-size:44px;font-weight:800">${par ? par.toFixed(2) : "--"}</div></div><button class="btn" data-pt="0.1">+0.1</button></div>
   <button class="btn pri full big" id="ptgo" style="margin-top:8px">Start rep</button>
   <div class="grid2" style="margin-top:8px"><button class="btn" id="ptmade">&#10003; Made par</button><button class="btn" id="ptmiss">&#10007; Missed</button></div>
   <div class="dim" style="margin-top:8px;text-align:center" id="ptcount">0 reps</div>
   <p class="dim" style="margin-bottom:0">Tap Start, get set. A random 1.5 to 4 second wait, a high beep to go, a low beep at par. Then tap Made or Missed.</p></div>`;
}
function bindParTimer(state, onChange) {
  const el = id => document.getElementById(id);
  const draw = () => { el("ptpar").textContent = state.par ? state.par.toFixed(2) : "--"; el("ptcount").textContent = `${state.reps} reps, ${state.made} made${state.reps >= 10 && state.made / state.reps >= 0.8 ? ". Making 8 of 10: cut the par 0.1 s." : ""}`; onChange && onChange(); };
  document.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => { state.par = Math.max(0.3, Math.round(((state.par || 2) + +b.dataset.pt) * 100) / 100); state.reps = 0; state.made = 0; draw(); });
  el("ptgo").onclick = () => {
    clearTimeout(parT); tone(1, 0.01); el("ptstate").textContent = "Wait for it";
    const delay = 1500 + Math.random() * 2500;
    const say = t => { const s = el("ptstate"); if (s) s.textContent = t; };
    parT = setTimeout(() => { if (!el("ptstate")) return; tone(2000, 0.18); say("GO"); if (state.par) parT = setTimeout(() => { if (!el("ptstate")) return; tone(700, 0.3); say("Par"); }, state.par * 1000); }, delay);
  };
  el("ptmade").onclick = () => { state.reps++; state.made++; draw(); };
  el("ptmiss").onclick = () => { state.reps++; draw(); };
  draw();
}
function dryDrillCard(d) {
  return `<div class="card"><div class="dim">${esc(d.level)} &middot; ${esc(d.gun || "")}</div><h2 style="margin:2px 0 8px">${esc(d.name)}</h2>
   <p><b>Set up:</b> ${esc(d.setup)}</p><p><b>Start:</b> ${esc(d.start)}</p><p><b>How:</b> ${esc(d.how)}</p><p><b>Focus:</b> ${esc(d.focus)}</p>
   <p class="dim">Par: ${d.par.start != null ? `start ${d.par.start} s` : "set your own"}${d.par.goal != null ? `, goal ${d.par.goal} s` : ""}. ${esc(d.par.note || "")}</p>
   <div class="dim">Source: ${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.source)}</a>` : esc(d.source)}</div></div>`;
}
function viewDryDrill(id) {
  const d = dryDrill(id); if (!d) return go("shoot/dry");
  const st = dryStats(id);
  const state = { par: st.lastPar || d.par.start || 2.0, reps: 0, made: 0 };
  const pts = st.history.filter(h => h.par).slice().reverse().map(h => ({ x: new Date(h.ts), y: h.par }));
  $app.innerHTML = shell("shoot", `<a class="dim" href="#shoot/dry/${d.gun}">&lsaquo; Dry fire</a>${dryDrillCard(d)}${parTimerHtml(d, state.par)}
   <button class="btn pri full" id="dsv">Save practice</button>
   <div class="card"><div class="spread"><h3>Your par over time</h3><span class="badge">${st.best ? st.best.toFixed(2) + " s best" : "--"}</span></div>${lineChart(pts, { target: d.par.goal, unit: "s", color: "var(--good)" })}<div class="dim">Best par counts when you made at least 8 of 10.</div></div>`);
  bindCommon(); bindParTimer(state);
  document.getElementById("dsv").onclick = () => { if (!state.reps) return toast("Do some reps first"); put("dryfire", { gun: d.gun, minutes: Math.max(1, Math.round(state.reps * 0.25)), drills: [{ id, par: state.par, reps: state.reps, made: state.made }] }); toast("Saved. Gun away, ammo stays out until you're done."); go("shoot/dry/" + d.gun); };
}
function viewDryRun(g) {
  if (!DRY.guns[g]) return go("shoot/dry");
  const steps = DRY.routines[g].map(([id, min]) => ({ d: dryDrill(id), min }));
  let i = +(sessionStorage.getItem("dryi") || 0); if (route()[2] === "new") i = 0;
  const log = JSON.parse(sessionStorage.getItem("drylog") || "[]");
  if (!sessionStorage.getItem("drysafe")) {
    $app.innerHTML = shell("shoot", `<h1 style="margin:6px 0">Before you start</h1><div class="card"><ol class="steps">${DRY.safety.map(s => `<li>${esc(s)}</li>`).join("")}</ol><button class="btn pri full big" id="ok">Gun is empty and ammo is out of the room</button></div><a class="btn ghost full" href="#shoot/dry">Cancel</a>`);
    bindCommon(); document.getElementById("ok").onclick = () => { sessionStorage.setItem("drysafe", "1"); sessionStorage.setItem("dryi", "0"); sessionStorage.setItem("drylog", "[]"); sessionStorage.setItem("drystart", Date.now()); viewDryRun(g); }; return;
  }
  if (i >= steps.length) {
    const mins = Math.round((Date.now() - +(sessionStorage.getItem("drystart") || Date.now())) / 60000) || steps.reduce((s, x) => s + x.min, 0);
    put("dryfire", { gun: g, minutes: mins, routine: true, drills: log });
    ["dryi", "drylog", "drysafe", "drystart"].forEach(k => sessionStorage.removeItem(k));
    $app.innerHTML = shell("shoot", `<h1 style="margin:6px 0">Routine done</h1><div class="card"><p>${log.reduce((s, x) => s + x.reps, 0)} reps logged across ${log.length} drills.</p><p class="note"><b>Say "Dry fire is over."</b> Put the gun away before any ammunition comes back into the room. No "one more rep."</p><a class="btn pri full" href="#shoot/dry">Done</a></div>`);
    bindCommon(); return;
  }
  const { d, min } = steps[i]; const st = dryStats(d.id);
  const state = { par: st.lastPar || d.par.start || 2.0, reps: 0, made: 0 };
  let left = min * 60;
  $app.innerHTML = shell("shoot", `<div class="spread" style="margin-top:4px"><span class="dim">Drill ${i + 1} of ${steps.length}</span><span class="badge" id="dtime">${fmtSec(left)}</span></div>${dryDrillCard({ ...d, gun: g })}${parTimerHtml(d, state.par)}
   <button class="btn pri full big" id="dnext">${i + 1 < steps.length ? "Next drill" : "Finish routine"}</button><button class="btn ghost full danger" id="dquit" style="margin-top:8px">End early</button>`);
  bindCommon(); bindParTimer(state);
  const iv = setInterval(() => { if (!document.getElementById("dtime")) return clearInterval(iv); left--; document.getElementById("dtime").textContent = left > 0 ? fmtSec(left) : "Time"; if (left === 0) beep(); }, 1000);
  const next = () => { clearInterval(iv); if (state.reps) log.push({ id: d.id, par: state.par, reps: state.reps, made: state.made }); sessionStorage.setItem("drylog", JSON.stringify(log)); sessionStorage.setItem("dryi", String(i + 1)); window.scrollTo(0, 0); viewDryRun(g); };
  document.getElementById("dnext").onclick = next;
  document.getElementById("dquit").onclick = () => { sessionStorage.setItem("dryi", String(steps.length)); next(); };
}

/* ---------- PROGRESS ---------- */
const RANGES = [["week", "Week", 7], ["month", "Month", 30], ["year", "Year", 365], ["all", "All time", 36500]];
function rangeInfo() {
  const q = new URLSearchParams(location.hash.split("?")[1] || "").get("r") || localStorage.getItem(K("range")) || "month";
  const r = RANGES.find(x => x[0] === q) || RANGES[1];
  const all = [...R.values()].filter(x => !x.deleted).map(x => +new Date(x.ts));
  const earliest = all.length ? Math.min(...all) : Date.now();
  const from = r[0] === "all" ? earliest : Date.now() - r[2] * 864e5;
  const bucket = r[0] === "week" ? "day" : r[0] === "month" ? "day" : r[0] === "year" ? "week" : ((Date.now() - earliest) > 400 * 864e5 ? "month" : "week");
  return { key: r[0], label: r[1], from, bucket };
}
function bkey(ts, b) { const d = new Date(ts); if (b === "day") return ymd(d); if (b === "week") { const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(m); } return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
function buckets(from, b) { const out = []; let d = new Date(from); d.setHours(12, 0, 0, 0); const seen = new Set(); while (d <= new Date()) { const k = bkey(d, b); if (!seen.has(k)) { seen.add(k); out.push(k); } d.setDate(d.getDate() + 1); } return out; }
function barChart(keys, vals, { color = "var(--acc)", h = 140, target = null, unit = "" } = {}) {
  if (!vals.some(v => v)) return `<div class="dim" style="padding:12px 0">Nothing logged in this range yet.</div>`;
  const W = 340, H = h, pl = 30, pb = 20, pt = 8, max = Math.max(...vals, target || 0) * 1.1 || 1, n = keys.length, bw = (W - pl - 6) / n;
  const Y = v => pt + (1 - v / max) * (H - pt - pb);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${[max / 1.1, max / 2.2].map(t => `<line x1="${pl}" x2="${W}" y1="${Y(t)}" y2="${Y(t)}" stroke="#2a3039" stroke-dasharray="3 4"/><text x="${pl - 4}" y="${Y(t) + 4}" fill="#6f7a88" font-size="10" text-anchor="end">${r0(t)}</text>`).join("")}
   ${target ? `<line x1="${pl}" x2="${W}" y1="${Y(target)}" y2="${Y(target)}" stroke="var(--good)" stroke-dasharray="6 4"/>` : ""}
   ${vals.map((v, i) => v ? `<rect x="${(pl + i * bw + bw * 0.15).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${Math.max(1, bw * 0.7).toFixed(1)}" height="${(H - pb - Y(v)).toFixed(1)}" rx="2" fill="${color}"/>` : "").join("")}
   <text x="${pl}" y="${H - 5}" fill="#6f7a88" font-size="10">${fmtDate(keys[0] + "T12:00:00")}</text><text x="${W}" y="${H - 5}" fill="#6f7a88" font-size="10" text-anchor="end">${fmtDate(keys[n - 1] + "T12:00:00")}</text></svg>`;
}
function progressCharts(rg) {
  const inR = r => +new Date(r.ts) >= rg.from;
  const ks = buckets(rg.from, rg.bucket); const per = rg.bucket === "day" ? "day" : rg.bucket;
  const sumBy = (recs, f) => { const m = {}; recs.filter(inR).forEach(r => { const k = bkey(r.ts, rg.bucket); m[k] = (m[k] || 0) + (f(r) || 0); }); return ks.map(k => m[k] || 0); };
  const line = (pts) => pts.filter(p => +p.x >= rg.from);
  const C = [];
  const add = (group, title, count, html, sub) => C.push({ group, title, count, html, sub });
  const ws = workouts(), p = profile() || {};
  // Training
  add("Training", `Workouts per ${per}`, ws.filter(inR).length, barChart(ks, sumBy(ws, () => 1)));
  add("Training", `Volume per ${per} (lb lifted)`, ws.filter(inR).length, barChart(ks, sumBy(ws, r => r.data.volume)));
  add("Training", `Gym minutes per ${per}`, ws.filter(inR).length, barChart(ks, sumBy(ws, r => (r.data.durationS || 0) / 60), { color: "var(--info)" }));
  add("Training", "Lifting PRs", ws.filter(inR).reduce((s, w) => s + (w.data.prs?.length || 0), 0), barChart(ks, sumBy(ws, r => r.data.prs?.length || 0), { color: "var(--good)" }));
  const cat = {}; ws.filter(inR).forEach(w => (w.data.items || []).forEach(it => { const c = D.byId[it.ex]?.cat; if (c) cat[c] = (cat[c] || 0) + it.sets.length; }));
  const catL = { lower: "Legs", single: "Single leg", push: "Push", pull: "Pull", power: "Power", cod: "Movement", grip: "Grip", core: "Core", cond: "Conditioning", mob: "Mobility" };
  add("Training", "Sets by body area", Object.keys(cat).length, Object.keys(cat).length ? `<table class="t">${Object.entries(cat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${catL[k] || k}</td><td style="width:55%"><div class="bar"><i style="width:${v / Math.max(...Object.values(cat)) * 100}%"></i></div></td><td class="n">${v}</td></tr>`).join("")}</table>` : "");
  const rpe = ws.filter(inR).map(w => { const v = (w.data.items || []).map(i => i.rpe).filter(Boolean); return v.length ? { x: new Date(w.ts), y: v.reduce((a, b) => a + b) / v.length } : null; }).filter(Boolean).reverse();
  add("Training", "Average effort (RPE)", rpe.length, lineChart(rpe, { color: "var(--bad)" }));
  const exUsed = {}; ws.forEach(w => (w.data.items || []).forEach(it => { if (D.byId[it.ex]?.unit === "wr") (exUsed[it.ex] ||= []).push({ ts: w.ts, sets: it.sets }); }));
  Object.entries(exUsed).forEach(([id, h]) => { const pts = h.map(x => ({ x: new Date(x.ts), y: Math.max(0, ...x.sets.map(s => e1rm(s.w, s.r) || 0)) })).filter(q => q.y).sort((a, b) => a.x - b.x); add("Strength", `${D.byId[id].name}: estimated 1-rep max`, line(pts).length, lineChart(line(pts), { unit: " lb" })); });
  const wt = weights();
  const relPts = ws.slice().reverse().map(w => { const lifts = (w.data.items || []).filter(it => ["back-squat", "safety-squat", "front-squat", "bench", "db-bench", "trap-dl", "rdl"].includes(it.ex)); if (!lifts.length) return null; const bw = wt.filter(q => q.x <= new Date(w.ts)).pop()?.y || currentWeight(); const best = Math.max(...lifts.flatMap(it => it.sets.map(s => e1rm(s.w, s.r) || 0))); return bw && best ? { x: new Date(w.ts), y: best / bw } : null; }).filter(Boolean);
  add("Strength", "Best main lift vs bodyweight", line(relPts).length, lineChart(line(relPts), { unit: "x" }));
  const cs = list("cardio");
  add("Training", `Cardio minutes per ${per}`, cs.filter(inR).length, barChart(ks, sumBy(cs, r => r.data.minutes), { color: "var(--info)" }));
  add("Training", `Run and ride miles per ${per}`, cs.filter(inR).filter(r => r.data.miles).length, barChart(ks, sumBy(cs, r => r.data.miles), { color: "var(--info)" }));
  // Body
  add("Body", "Body weight", line(wt).length, lineChart(line(wt), { target: p.targetWeightLb || null, unit: " lb" }));
  const sc = list("scan").slice().reverse();
  [["body_fat_pct", "Body fat %", "var(--bad)"], ["skeletal_muscle_mass_lb", "Skeletal muscle (lb)", "var(--good)"], ["lean_body_mass_lb", "Lean body mass (lb)", "var(--good)"], ["body_fat_mass_lb", "Body fat mass (lb)", "var(--bad)"], ["visceral_fat_level", "Visceral fat level", "var(--bad)"], ["bmr_kcal", "Resting metabolism (BMR)", "var(--acc)"], ["bwi_score", "eVolt BWI score", "var(--acc)"], ["abdominal_circumference_in", "Abdominal circumference (in)", "var(--bad)"], ["bio_age", "Bio age", "var(--acc)"]].forEach(([k, l, c]) => { const pts = line(sc.filter(r => r.data[k] != null).map(r => ({ x: new Date(r.ts), y: +r.data[k] }))); add("Body", l, pts.length, lineChart(pts, { color: c }), "From scans"); });
  [["arm", "Arms"], ["leg", "Legs"]].forEach(([k, l]) => { const L = sc.filter(r => r.data[`left_${k}_lean_lb`] != null); if (!L.length) { add("Body", `${l}: left vs right lean mass`, 0, ""); return; } const last = L[L.length - 1].data; add("Body", `${l}: left vs right lean mass`, L.filter(inR).length, `<table class="t"><tr><th>Scan</th><th class="n">Left</th><th class="n">Right</th><th class="n">Gap</th></tr>${L.filter(inR).map(r => `<tr><td>${fmtDate(r.ts)}</td><td class="n">${r1(r.data[`left_${k}_lean_lb`])}</td><td class="n">${r1(r.data[`right_${k}_lean_lb`])}</td><td class="n">${r1(Math.abs(r.data[`left_${k}_lean_lb`] - r.data[`right_${k}_lean_lb`]))}</td></tr>`).join("")}</table>`); });
  const tp = list("tape").slice().reverse();
  D.TAPE.forEach(t => { const pts = line(tp.filter(r => r.data[t.id] != null).map(r => ({ x: new Date(r.ts), y: r.data[t.id] }))); add("Tape", t.n, pts.length, lineChart(pts, { unit: '"' })); });
  // Shooting
  const ms = list("match").slice().reverse();
  const mp = line(ms.filter(m => m.data.pct).map(m => ({ x: new Date(m.ts), y: +m.data.pct })));
  add("Shooting", "Match percent", mp.length, lineChart(mp, { unit: "%" }));
  const acc = line(ms.map(m => { const d = m.data, t = (d.a || 0) + (d.c || 0) + (d.dd || 0) + (d.m || 0); return t ? { x: new Date(m.ts), y: (d.a || 0) / t * 100 } : null; }).filter(Boolean));
  add("Shooting", "Alpha hit rate %", acc.length, lineChart(acc, { color: "var(--good)" }));
  const pen = line(ms.map(m => ({ x: new Date(m.ts), y: (m.data.m || 0) + (m.data.ns || 0) + (m.data.proc || 0) })));
  add("Shooting", "Misses, no-shoots and procedurals per match", pen.filter(x => x.y).length, lineChart(pen, { color: "var(--bad)" }));
  const hf = line(ms.map(m => { const s = (m.data.stages || []).filter(x => x.hf); return s.length ? { x: new Date(m.ts), y: s.reduce((a, b) => a + b.hf, 0) / s.length } : null; }).filter(Boolean));
  add("Shooting", "Average stage hit factor", hf.length, lineChart(hf));
  const place = line(ms.filter(m => m.data.place && m.data.of).map(m => ({ x: new Date(m.ts), y: (1 - (m.data.place - 1) / m.data.of) * 100 })));
  add("Shooting", "Division finish (percentile)", place.length, lineChart(place, { unit: "%" }));
  const dr = list("drill");
  add("Shooting", `Live drill runs per ${per}`, dr.filter(inR).length, barChart(ks, sumBy(dr, () => 1), { color: "var(--good)" }));
  D.DRILLS.forEach(d => { const runs = drillRuns(d).slice().reverse().map(x => ({ x: new Date(x.r.ts), y: x.val })); const tgt = d.bm.length ? (d.scoring === "points" ? Math.max(...d.bm.map(b => b.s)) : Math.min(...d.bm.map(b => b.t))) : null; add("Shooting", `${d.name}`, line(runs).length, lineChart(line(runs), { target: tgt, color: "var(--good)" }), "Live drill"); });
  const df = list("dryfire");
  add("Dry fire", `Dry fire minutes per ${per}`, df.filter(inR).length, barChart(ks, sumBy(df, r => r.data.minutes), { color: "var(--good)" }));
  add("Dry fire", `Dry fire reps per ${per}`, df.filter(inR).length, barChart(ks, sumBy(df, r => (r.data.drills || []).reduce((s, d) => s + (d.reps || 0), 0)), { color: "var(--good)" }));
  const dIds = [...new Set(df.flatMap(s => (s.data.drills || []).map(d => d.id)))];
  dIds.forEach(id => { const d = dryDrill(id); if (!d) return; const pts = line(dryStats(id).history.filter(h => h.par).map(h => ({ x: new Date(h.ts), y: h.par })).reverse()); add("Dry fire", `${d.name}: par time`, pts.length, lineChart(pts, { target: d.par.goal, color: "var(--good)" }), "Dry fire"); });
  // Fuel
  const fd = list("food"); const n = nutrition();
  add("Fuel", `Calories per day`, fd.filter(inR).length, barChart(buckets(rg.from, "day"), (() => { const m = {}; fd.filter(inR).forEach(r => { const k = ymd(r.ts); m[k] = (m[k] || 0) + (r.data.kcal || 0); }); return buckets(rg.from, "day").map(k => m[k] || 0); })(), { target: n?.kcal }));
  add("Fuel", `Protein per day (g)`, fd.filter(inR).length, barChart(buckets(rg.from, "day"), (() => { const m = {}; fd.filter(inR).forEach(r => { const k = ymd(r.ts); m[k] = (m[k] || 0) + (r.data.protein || 0); }); return buckets(rg.from, "day").map(k => m[k] || 0); })(), { target: n?.protein, color: "var(--good)" }));
  // Apple Health
  const hs = list("health");
  [[/step/i, "Steps per day", true], [/resting_heart|restingheart/i, "Resting heart rate", false], [/heart_rate_variability|hrv/i, "Heart rate variability (ms)", false], [/sleep/i, "Sleep (hours)", false], [/active_energy/i, "Active calories per day", true]].forEach(([re, l, sum]) => {
    const rs = hs.filter(r => re.test(r.data.metric) && inR(r));
    if (sum) { const m = {}; rs.forEach(r => { const k = ymd(r.ts); m[k] = (m[k] || 0) + (+r.data.value || 0); }); const kk = buckets(rg.from, "day"); add("Apple Health", l, rs.length, barChart(kk, kk.map(k => m[k] || 0), { color: "var(--info)" })); }
    else add("Apple Health", l, rs.length, lineChart(rs.map(r => ({ x: new Date(r.ts), y: +r.data.value })).reverse(), { color: "var(--info)" }));
  });
  const hw = hs.length ? list("health_workout").filter(inR) : [];
  add("Apple Health", "Watch workouts: average heart rate", hw.length, lineChart(hw.map(w => ({ x: new Date(w.ts), y: +(typeof w.data.avg_hr === "object" ? w.data.avg_hr?.qty : w.data.avg_hr) })).filter(p => p.y).reverse(), { color: "var(--bad)" }));
  // Competition
  const me = leagueCached()?.teams?.[0]?.members?.find(m => m.me);
  const lw = (me?.weeks || []).map(w => ({ x: new Date(w.week + "T12:00:00"), y: w.pts }));
  add("Crew", "Your weekly crew points", line(lw).length, lineChart(line(lw)));
  // Consistency calendar
  const days = buckets(Math.max(rg.from, Date.now() - 370 * 864e5), "day");
  const act = new Map(); [...ws, ...cs, ...dr, ...df, ...ms].forEach(r => { const k = ymd(r.ts); act.set(k, (act.get(k) || 0) + 1); });
  const activeDays = days.filter(k => act.has(k)).length;
  add("Training", "Consistency: active days", activeDays, `<div class="heat">${days.map(k => `<i title="${k}" class="${act.has(k) ? (act.get(k) > 1 ? "h2" : "h1") : ""}"></i>`).join("")}</div><div class="dim" style="margin-top:6px">${activeDays} active days of ${days.length}</div>`);
  return C;
}
function viewProgress() {
  const rg = rangeInfo(); localStorage.setItem(K("range"), rg.key);
  const C = progressCharts(rg);
  const used = C.filter(c => c.count > 0).sort((a, b) => b.count - a.count);
  const unused = C.filter(c => c.count === 0);
  $app.innerHTML = shell("progress", `<h1 style="margin:4px 0">Progress</h1>
   <div class="seg">${RANGES.map(([k, l]) => `<button class="${rg.key === k ? "on" : ""}" onclick="location.hash='progress?r=${k}'">${l}</button>`).join("")}</div>
   <div class="dim">${used.length} chart${used.length === 1 ? "" : "s"} with data in this range, sorted by how much you use them.</div>
   ${used.map(c => `<div class="card"><div class="spread"><h3>${esc(c.title)}</h3><span class="chip">${esc(c.group)}</span></div>${c.html}</div>`).join("") || `<div class="empty">Nothing logged in this range yet.</div>`}
   ${unused.length ? `<details class="card"><summary><h3 style="display:inline">${unused.length} more charts waiting for data</h3></summary><div class="list">${unused.map(c => `<div class="li"><div class="grow"><div class="t">${esc(c.title)}</div><div class="dim">${esc(c.group)}</div></div></div>`).join("")}</div></details>` : ""}`);
  bindCommon(); if (!leagueCached()) loadLeague();
}

/* ---------- TRAIN ---------- */
function viewTrain() {
  const p = profile(); if (!p) return go("today");
  const prog = program(p); const nd = nextDayIndex();
  const seg = route()[1] || "plan";
  let inner = `<h1 style="margin:4px 0">Train</h1><div class="seg">${[["plan", "Program"], ["history", "History"], ["library", "Exercises"]].map(([k, l]) => `<button class="${seg === k ? "on" : ""}" onclick="location.hash='train/${k}'">${l}</button>`).join("")}</div>`;
  if (seg === "plan") {
    inner += `<div class="note">${esc(D.LEVELS[p.level]?.label || "")}, ${p.days} days a week, goal: ${esc(D.GOALS[p.goal]?.label || "")}. Stop each set with about ${prog[0]?.rir ?? 2} good reps left in the tank. ${(p.age || 0) >= 45 ? "Over-45 adjustments are on: joint-friendly swaps, smaller weight jumps, less jump volume. Prefer the original lift? Tap the dots on it during a workout and swap it back for good." : ""} Run and ride are optional extras, not the core of the plan.</div>`;
    prog.forEach(day => {
      inner += `<div class="card ${day.idx === nd ? "hero" : ""}"><div class="spread"><div><h2>${esc(day.name)}</h2><div class="dim">${esc(day.focus)}</div></div>${day.idx === nd ? `<span class="chip acc">Up next</span>` : ""}</div>
      <div class="list" style="margin-top:6px">${day.blocks.map(b => { const ex = D.byId[b.ex]; return `<div class="li" onclick="location.hash='ex/${ex.id}'">${b.group ? `<span class="chip" style="color:var(--info)">${b.group}</span>` : ""}<div class="grow"><div class="t">${esc(ex.name)}</div><div class="dim">${b.sets} x ${repLabel(ex, b.rep)}${b.note ? " &middot; " + esc(b.note) : ""}</div></div><span class="chev">&rsaquo;</span></div>`; }).join("")}</div>
      <button class="btn ${day.idx === nd ? "pri" : ""} full" style="margin-top:10px" data-act="start" data-day="${day.idx}">Start ${esc(day.name.split(" ").slice(0, 2).join(" "))}</button></div>`;
    });
    inner += `<div class="card"><h3>Why this program</h3><p class="muted">Built from what top practical shooters and their coaches actually do: Mike Seeklander's conditioning-first sessions with push/pull and squat/hinge strength, plyometrics and hard planks; Alexz Jones's (USPSA GM) focus on single-leg strength, acceleration, deceleration and footwork; and SSUSA's coverage of USPSA athletes in the gym. Each session starts with jumps or sprints while you are fresh, then strength, then grip and core. <a href="#more/research">See sources</a>.</p>
    <p class="dim">No firearms in the gym. Position entry work is done empty-handed there. Bring the gun into it during dry fire at home, where Seeklander mixes movement and transitions into his cardio intervals.</p></div>
    <button class="btn full" data-act="startblank">Start an empty workout</button>`;
  } else if (seg === "history") {
    const ws = workouts(), cs = list("cardio");
    const all = [...ws.map(w => ({ ...w, t: "w" })), ...cs.map(c => ({ ...c, t: "c" }))].sort((a, b) => new Date(b.ts) - new Date(a.ts));
    inner += `<button class="btn full" data-act="qcardio" style="margin-top:6px">Log a run, ride or cardio session</button>`;
    inner += all.length ? `<div class="card"><div class="list">${all.slice(0, 80).map(w => w.t === "w" ? `<div class="li" onclick="location.hash='workout/${w.id}'"><div class="grow"><div class="t">${esc(w.data.name)}</div><div class="dim">${fmtDate(w.ts)} &middot; ${fmtSec(w.data.durationS || 0)} &middot; ${r0(w.data.volume || 0)} lb moved${w.data.prs?.length ? ` &middot; <span class="up">${w.data.prs.length} PR</span>` : ""}</div></div><span class="chev">&rsaquo;</span></div>` : `<div class="li"><div class="grow"><div class="t">${esc(w.data.type)}</div><div class="dim">${fmtDate(w.ts)} &middot; ${w.data.minutes || "?"} min${w.data.miles ? ` &middot; ${w.data.miles} mi` : ""}</div></div><button class="btn sm danger" data-act="delrec" data-id="${w.id}">Delete</button></div>`).join("")}</div></div>` : `<div class="empty">No workouts yet. Your first one is waiting on the Program tab.</div>`;
    const vol = ws.slice().reverse().map(w => ({ x: new Date(w.ts), y: w.data.volume || 0 })).filter(x => x.y);
    if (vol.length > 1) inner += `<div class="card"><h3>Volume per workout (lb)</h3>${lineChart(vol)}</div>`;
  } else {
    const cats = { power: "Power", cod: "Movement and change of direction", lower: "Lower body", single: "Single leg", push: "Push", pull: "Pull", grip: "Grip and carries", core: "Core", cond: "Conditioning", mob: "Mobility and recovery" };
    Object.entries(cats).forEach(([c, l]) => { inner += `<div class="card"><h3>${l}</h3><div class="list">${D.EX.filter(e => e.cat === c).map(e => `<div class="li" onclick="location.hash='ex/${e.id}'"><div class="grow"><div class="t">${esc(e.name)}</div><div class="dim">${esc(e.why)}</div></div><span class="chev">&rsaquo;</span></div>`).join("")}</div></div>`; });
  }
  $app.innerHTML = shell("train", inner); bindCommon();
}
const repLabel = (ex, rep) => ex.unit === "t" ? `${rep[0]}${rep[1] !== rep[0] ? "-" + rep[1] : ""} s${ex.perSide ? "/side" : ""}` : ex.unit === "carry" ? `${rep[0]}-${rep[1]} yd` : ex.unit === "d" ? `${rep[0]}-${rep[1]} mi` : `${rep[0]}-${rep[1]} reps${ex.perSide ? "/side" : ""}`;

function viewExercise(id) {
  const ex = D.byId[id]; if (!ex) return go("train");
  const h = bestSetHistory(id);
  const pts = h.slice().reverse().map(x => { const b = Math.max(...x.sets.map(s => e1rm(s.w, s.r) || s.w || s.t || s.r || 0)); return { x: new Date(x.ts), y: b }; }).filter(p => p.y);
  const best = Math.max(0, ...pts.map(p => p.y));
  $app.innerHTML = shell("train", `<a class="dim" href="#train/library">&lsaquo; Exercises</a><h1 style="margin:6px 0">${esc(ex.name)}</h1>
   ${tutorialHtml(ex)}
   <div class="card"><h3>Key cue</h3><p>${esc(ex.cue)}</p><h3>Why it matters for shooting</h3><p class="muted">${esc(ex.why)}</p>
   ${ex.swaps.length ? `<div class="dim">Swap options: ${ex.swaps.map(s => `<a href="#ex/${s}">${esc(D.byId[s].name)}</a>`).join(", ")}</div>` : ""}</div>
   <div class="card"><div class="spread"><h3>${ex.unit === "wr" ? "Estimated 1-rep max" : "Best"}</h3><span class="badge">${best ? r0(best) : "--"}</span></div>${lineChart(pts)}</div>
   <div class="card"><h3>Recent</h3>${h.length ? `<table class="t"><tr><th>Date</th><th>Sets</th></tr>${h.slice(0, 12).map(x => `<tr><td>${fmtDate(x.ts)}</td><td>${x.sets.map(s => setText(ex, s)).join(", ")}</td></tr>`).join("")}</table>` : `<div class="dim">Not logged yet.</div>`}</div>`);
  bindCommon();
}
const setText = (ex, s) => ex.unit === "wr" ? `${s.w || 0}x${s.r || 0}` : ex.unit === "r" ? `${s.r || 0}${s.w ? "+" + s.w : ""}` : ex.unit === "t" ? `${s.t || 0}s` : ex.unit === "carry" ? `${s.w || 0}lb ${s.dist || ""}yd` : `${s.dist || ""}mi ${s.t || ""}min`;

/* ---------- workout session ---------- */
const activeSession = () => S && JSON.parse(localStorage.getItem(K("active")) || "null");
const saveActive = a => a ? localStorage.setItem(K("active"), JSON.stringify(a)) : localStorage.removeItem(K("active"));
function startSession(dayIdx, blank) {
  if (activeSession() && !confirm("You have a workout in progress. Discard it and start a new one?")) return go("session");
  const p = profile(); const day = blank ? null : program(p)[dayIdx];
  const items = blank ? [] : day.blocks.map(b => newItem(b.ex, b.sets, b.rep, b.note, b.group));
  saveActive({ id: "workout:" + uid(), start: Date.now(), dayName: blank ? "Custom workout" : day.name, programDay: blank ? null : dayIdx, items });
  go("session");
}
function newItem(exId, sets = 3, rep, note = "", group = "") {
  const ex = D.byId[exId]; rep = rep || ex.rep;
  const sug = suggest(exId, rep);
  const prev = bestSetHistory(exId)[0]?.sets || [];
  return { ex: exId, rep, note, group, sug, sets: [...Array(sets)].map((_, i) => ({ done: false, ghost: prev[i] || prev[prev.length - 1] || null })) };
}
let timer = null; // {end, total}
function timerHtml() { if (!timer) return ""; const left = Math.max(0, (timer.end - Date.now()) / 1000); return `<div class="timer" id="timer"><span>Rest</span><span class="tv" id="tv">${fmtSec(left)}</span><button data-act="tm" data-d="-15">-15</button><button data-act="tm" data-d="15">+15</button><button data-act="tskip">Skip</button></div>`; }
function startTimer(s) { if (!s) return; timer = { end: Date.now() + s * 1000 }; const el = document.getElementById("timer"); if (el) el.remove(); document.body.insertAdjacentHTML("beforeend", timerHtml()); bindTimer(); }
function bindTimer() { document.querySelectorAll('#timer [data-act]').forEach(b => b.onclick = () => { if (b.dataset.act === "tskip") { timer = null; document.getElementById("timer")?.remove(); } else { timer.end += (+b.dataset.d) * 1000; tick(); } }); }
function tick() { if (!timer) return; const left = (timer.end - Date.now()) / 1000; const tv = document.getElementById("tv"); if (tv) tv.textContent = fmtSec(left); if (left <= 0) { timer = null; document.getElementById("timer")?.remove(); beep(); toast("Rest done. Next set."); } }
setInterval(tick, 500);

function plateMath(total) {
  const bar = 45; if (!total || total <= bar) return "Empty bar";
  let side = (total - bar) / 2; const out = [];
  [45, 35, 25, 10, 5, 2.5].forEach(pl => { while (side >= pl - 0.001) { out.push(pl); side -= pl; } });
  return `Per side: ${out.join(" + ")}${side > 0.01 ? ` (+${r1(side)} short)` : ""}`;
}
const BARBELL = new Set(["back-squat", "front-squat", "bench", "ohp", "rdl", "safety-squat"]);

function viewSession() {
  const a = activeSession(); if (!a) return go("train");
  const p = profile();
  const el = Math.round((Date.now() - a.start) / 1000);
  let inner = `<div class="spread" style="margin-top:4px"><div><h1>${esc(a.dayName)}</h1><div class="dim">${fmtSec(el)} elapsed &middot; tap the box when a set is done</div></div></div>`;
  a.items.forEach((it, ii) => {
    const ex = D.byId[it.ex]; const u = ex.unit;
    const cols = u === "wr" ? ["lb", "reps"] : u === "r" ? ["+lb", "reps"] : u === "t" ? ["sec"] : u === "carry" ? ["lb", "yd"] : ["mi", "min"];
    const keys = u === "wr" ? ["w", "r"] : u === "r" ? ["w", "r"] : u === "t" ? ["t"] : u === "carry" ? ["w", "dist"] : ["dist", "t"];
    const gh = (s, k) => { const g = s.ghost; if (k === "w" && it.sug?.w && u !== "r") return it.sug.w; if (k === "r" && it.sug?.r) return it.sug.r; return g ? g[k] ?? "" : (k === "r" ? it.rep[0] : k === "t" && u === "t" ? it.rep[0] : ""); };
    inner += `<div class="exb ${it.group ? "sup" : ""}" data-ii="${ii}">
      <div class="exh"><div class="grow"><div class="n">${it.group ? `<span style="color:var(--info)">${it.group}</span> ` : ""}${esc(ex.name)}</div>
      <div class="dim">${repLabel(ex, it.rep)}${it.note ? " &middot; " + esc(it.note) : ""}</div>
      ${it.sug?.why ? `<div style="font-size:13px;color:var(--acc);margin-top:2px">${esc(it.sug.why)}</div>` : ""}</div>
      <button class="btn sm" data-act="exmenu" data-ii="${ii}">&middot;&middot;&middot;</button></div>
      <div class="why">${esc(ex.cue)} <details class="howto"><summary>How to do it</summary>${tutorialInner(ex)}</details></div>
      <table class="sets"><tr><th>Set</th><th>Last</th>${cols.map(c => `<th>${c}</th>`).join("")}<th></th></tr>
      ${it.sets.map((s, si) => `<tr class="${s.done ? "done" : ""}"><td>${si + 1}</td><td class="dim">${s.ghost ? esc(setText(ex, s.ghost)) : "-"}</td>
        ${keys.map(k => `<td><input inputmode="decimal" data-ii="${ii}" data-si="${si}" data-k="${k}" value="${esc(s[k] ?? "")}" placeholder="${esc(gh(s, k))}"></td>`).join("")}
        <td><button class="chk" data-act="setdone" data-ii="${ii}" data-si="${si}">${s.done ? "&#10003;" : ""}</button></td></tr>`).join("")}
      </table>
      <div class="exf"><button class="btn sm" data-act="addset" data-ii="${ii}">+ Set</button>${BARBELL.has(ex.id) ? `<button class="btn sm" data-act="plates" data-ii="${ii}">Plates</button>` : ""}<button class="btn sm" data-act="rpe" data-ii="${ii}">Effort ${it.rpe ? "RPE " + it.rpe : ""}</button></div></div>`;
  });
  inner += `<button class="btn full" data-act="addex">+ Add exercise</button>
    <div style="height:12px"></div><button class="btn pri full big" data-act="finish">Finish workout</button>
    <button class="btn ghost full danger" data-act="discard" style="margin-top:8px">Discard</button>
    <p class="dim" style="margin-top:12px">Wearing an Apple Watch? Start a Traditional Strength Training workout on the watch. When Apple Health sync is set up, your heart rate and calories attach to this session automatically.</p>`;
  $app.innerHTML = shell("train", inner, "Workout");
  bindCommon(); bindTimer();
  $app.querySelectorAll(".sets input").forEach(inp => inp.oninput = () => { const a2 = activeSession(); a2.items[+inp.dataset.ii].sets[+inp.dataset.si][inp.dataset.k] = num(inp.value); saveActive(a2); });
}
function sessionAct(act, el) {
  const a = activeSession(); const ii = +el.dataset.ii; const it = a?.items[ii];
  if (act === "setdone") {
    const si = +el.dataset.si; const s = it.sets[si]; const ex = D.byId[it.ex];
    if (!s.done) {
      // fill blanks from placeholders so a single tap logs the suggested set
      $app.querySelectorAll(`.sets input[data-ii="${ii}"][data-si="${si}"]`).forEach(inp => { if (inp.value === "" && inp.placeholder !== "") s[inp.dataset.k] = num(inp.placeholder); });
      s.done = true; saveActive(a);
      const nextInSuperset = it.group && a.items[ii + 1]?.group === it.group;
      if (!nextInSuperset) startTimer(restFor(ex, profile()));
    } else { s.done = false; saveActive(a); }
    const y = window.scrollY; viewSession(); window.scrollTo(0, y);
  } else if (act === "addset") { it.sets.push({ done: false, ghost: it.sets[it.sets.length - 1]?.ghost || null }); saveActive(a); const y = window.scrollY; viewSession(); window.scrollTo(0, y); }
  else if (act === "plates") { const s = it.sets.find(x => !x.done) || it.sets[0]; const w = s.w || it.sug?.w || s.ghost?.w; toast(w ? `${w} lb. ${plateMath(w)}` : "Enter a weight first", 4000); }
  else if (act === "rpe") { sheet(`<h3>How hard was ${esc(D.byId[it.ex].name)}?</h3><p class="dim">RPE 10 = nothing left. 8 = two reps left.</p><div class="pill-sel">${[6, 7, 8, 9, 10].map(v => `<button data-rpe="${v}">${v}</button>`).join("")}</div>`, m => m.querySelectorAll("[data-rpe]").forEach(b => b.onclick = () => { it.rpe = +b.dataset.rpe; saveActive(a); closeSheet(); viewSession(); })); }
  else if (act === "exmenu") {
    const ex = D.byId[it.ex];
    sheet(`<h3>${esc(ex.name)}</h3><div class="list">
      ${ex.swaps.map(s => `<div class="li" data-swap="${s}"><div class="grow"><div class="t">Swap to ${esc(D.byId[s].name)}</div><div class="dim">Equipment taken or a joint complaining</div></div></div>`).join("")}
      <div class="li" data-swapany="1"><div class="grow"><div class="t">Swap to any exercise</div></div></div>
      <div class="li" data-rm="1"><div class="grow"><div class="t down">Remove from today</div></div></div></div>`, m => {
      m.querySelectorAll("[data-swap]").forEach(b => b.onclick = () => doSwap(b.dataset.swap));
      m.querySelector("[data-swapany]").onclick = () => { closeSheet(); pickExercise(id => doSwap(id)); };
      m.querySelector("[data-rm]").onclick = () => { a.items.splice(ii, 1); saveActive(a); closeSheet(); viewSession(); };
    });
    const doSwap = id => { const n = newItem(id, it.sets.length, D.byId[id].rep, it.note, it.group); a.items[ii] = n; saveActive(a); closeSheet(); viewSession();
      if (confirm(`Always use ${D.byId[id].name} instead of ${ex.name} in your program?`)) { const p = profile(); p.swaps = { ...(p.swaps || {}), [ex.id]: id }; setProfile(p); } };
  }
  else if (act === "addex") pickExercise(id => { a.items.push(newItem(id, 3)); saveActive(a); viewSession(); window.scrollTo(0, document.body.scrollHeight); });
  else if (act === "discard") { if (confirm("Discard this workout?")) { saveActive(null); timer = null; document.getElementById("timer")?.remove(); go("train"); } }
  else if (act === "finish") finishSession();
}
function pickExercise(cb) {
  sheet(`<h3>Choose an exercise</h3><input class="i" id="exq" placeholder="Search"><div class="list" id="exl"></div>`, m => {
    const draw = q => { m.querySelector("#exl").innerHTML = D.EX.filter(e => e.name.toLowerCase().includes(q.toLowerCase())).map(e => `<div class="li" data-id="${e.id}"><div class="grow"><div class="t">${esc(e.name)}</div><div class="dim">${esc(e.why)}</div></div></div>`).join(""); m.querySelectorAll("#exl [data-id]").forEach(li => li.onclick = () => { closeSheet(); cb(li.dataset.id); }); };
    draw(""); m.querySelector("#exq").oninput = e => draw(e.target.value);
  });
}
function finishSession() {
  const a = activeSession(); const items = a.items.map(it => ({ ex: it.ex, rpe: it.rpe || null, sets: it.sets.filter(s => s.done).map(({ ghost, ...s }) => s) })).filter(it => it.sets.length);
  if (!items.length && !confirm("No sets checked off. Save anyway?")) return;
  let volume = 0; const prs = [];
  items.forEach(it => {
    const ex = D.byId[it.ex];
    it.sets.forEach(s => { if (s.w && s.r) volume += s.w * s.r * (ex.perSide ? 2 : 1); });
    if (ex.unit === "wr") {
      const prevBest = Math.max(0, ...bestSetHistory(it.ex).flatMap(h => h.sets.map(s => e1rm(s.w, s.r) || 0)));
      const now = Math.max(0, ...it.sets.map(s => e1rm(s.w, s.r) || 0));
      if (now > prevBest && prevBest > 0) prs.push({ ex: it.ex, e1rm: Math.round(now), prev: Math.round(prevBest) });
    }
  });
  const end = Date.now();
  const data = { name: a.dayName, programDay: a.programDay, items, volume: Math.round(volume), durationS: Math.round((end - a.start) / 1000), start: new Date(a.start).toISOString(), end: new Date(end).toISOString(), prs };
  put("workout", data, a.id, new Date(a.start).toISOString());
  saveActive(null); timer = null; document.getElementById("timer")?.remove();
  go("workout/" + a.id);
  if (prs.length) setTimeout(() => toast(`New PR: ${prs.map(p => D.byId[p.ex].name).join(", ")}`, 4000), 300);
}
function viewWorkout(id) {
  const w = R.get(id); if (!w || w.deleted) return go("train/history");
  const d = w.data;
  const hw = list("health_workout").find(h => Math.abs(new Date(h.data.start) - new Date(d.start)) < 45 * 60000);
  $app.innerHTML = shell("train", `<a class="dim" href="#train/history">&lsaquo; History</a><h1 style="margin:6px 0">${esc(d.name)}</h1><div class="dim">${new Date(w.ts).toLocaleString()}</div>
   <div class="grid3" style="margin-top:12px"><div class="stat"><div class="k">Time</div><div class="v">${fmtSec(d.durationS)}</div></div><div class="stat"><div class="k">Volume</div><div class="v">${r0(d.volume)}</div><div class="s">lb</div></div><div class="stat"><div class="k">PRs</div><div class="v">${d.prs?.length || 0}</div></div></div>
   ${hw ? `<div class="card"><h3>From Apple Watch</h3><div class="grid3">${hw.data.avg_hr ? `<div class="stat"><div class="k">Avg HR</div><div class="v">${r0(typeof hw.data.avg_hr === "object" ? hw.data.avg_hr.qty : hw.data.avg_hr)}</div></div>` : ""}${hw.data.energy ? `<div class="stat"><div class="k">Active kcal</div><div class="v">${r0(typeof hw.data.energy === "object" ? hw.data.energy.qty : hw.data.energy)}</div></div>` : ""}</div></div>` : ""}
   ${d.prs?.length ? `<div class="card"><h3>Personal records</h3>${d.prs.map(p => `<div class="li"><div class="grow t">${esc(D.byId[p.ex].name)}</div><span class="up">${p.prev} &rarr; ${p.e1rm} lb e1RM</span></div>`).join("")}</div>` : ""}
   <div class="card">${d.items.map(it => `<div class="li"><div class="grow"><div class="t">${esc(D.byId[it.ex]?.name || it.ex)}</div><div class="dim">${it.sets.map(s => setText(D.byId[it.ex], s)).join(", ")}${it.rpe ? " &middot; RPE " + it.rpe : ""}</div></div></div>`).join("")}</div>
   <button class="btn full danger" data-act="delrec" data-id="${w.id}" data-back="train/history">Delete workout</button>`);
  bindCommon();
}

/* ---------- SHOOT ---------- */
function drillScore(dr, d) {
  if (dr.scoring === "points") return d.points;
  if (dr.scoring === "time_plus_penalty") return (d.time || 0) + (d.pen || 0) * (dr.penPer || 0);
  return d.time;
}
function drillRating(dr, val) {
  if (val == null || !dr.bm.length) return null;
  if (dr.scoring === "points") { const b = dr.bm.filter(b => val >= b.s).sort((a, b) => b.s - a.s)[0]; return b ? b.l : null; }
  const b = dr.bm.filter(b => val <= b.t).sort((a, b) => a.t - b.t)[0]; return b ? b.l : null;
}
const drillVal = (dr, b) => dr.scoring === "points" ? `${b.val}${dr.max ? "/" + dr.max : ""}` : `${b.val.toFixed(2)} s`;
function drillRuns(dr) { return list("drill").filter(r => r.data.drill === dr.id).map(r => ({ r, val: drillScore(dr, r.data) })).filter(x => x.val != null); }
function bestDrill(dr) {
  const runs = drillRuns(dr); if (!runs.length) return null;
  const b = runs.reduce((m, x) => (dr.scoring === "points" ? x.val > m.val : x.val < m.val) ? x : m, runs[0]);
  return { val: b.val, rating: drillRating(dr, b.val), ts: b.r.ts };
}
function viewShoot() {
  const seg = route()[1] || "drills";
  if (seg === "dry") return viewDry();
  let inner = `<h1 style="margin:4px 0">Shoot</h1>${shootSeg(seg)}`;
  if (seg === "drills") {
    inner += `<div class="note">Run a drill, then log the time or score. Ratings come only from the standards each drill's author published. Drills with no published standard track your personal best.</div>`;
    [["pistol", "Pistol"], ["rifle", "Rifle"], ["shotgun", "Shotgun"], ["pcc", "PCC"]].forEach(([k, l]) => {
      const ds = D.DRILLS.filter(d => d.d === k); if (!ds.length) return;
      inner += `<div class="card"><h3>${l}</h3><div class="list">${ds.map(dr => { const b = bestDrill(dr); return `<div class="li" onclick="location.hash='drill/${dr.id}'"><div class="grow"><div class="t">${esc(dr.name)}</div><div class="dim">${esc(dr.dist)} &middot; ${dr.rounds || "?"} rds${b ? " &middot; best " + drillVal(dr, b) : ""}</div></div>${b?.rating ? `<span class="badge">${esc(b.rating)}</span>` : `<span class="chev">&rsaquo;</span>`}</div>`; }).join("")}</div></div>`;
    });
  } else {
    const ms = list("match");
    inner += `<a class="btn pri full big" href="#match/new" style="margin-top:6px">Add match result</a>`;
    const pts = ms.slice().reverse().filter(m => m.data.pct).map(m => ({ x: new Date(m.ts), y: +m.data.pct }));
    if (pts.length > 1) inner += `<div class="card"><h3>Match percent</h3>${lineChart(pts, { unit: "%" })}</div>`;
    const acc = ms.slice().reverse().map(m => { const d = m.data; const tot = (d.a || 0) + (d.c || 0) + (d.dd || 0) + (d.m || 0); return tot ? { x: new Date(m.ts), y: (d.a || 0) / tot * 100 } : null; }).filter(Boolean);
    if (acc.length > 1) inner += `<div class="card"><h3>Alpha hit rate %</h3>${lineChart(acc, { color: "var(--good)" })}</div>`;
    inner += ms.length ? `<div class="card"><div class="list">${ms.map(m => `<div class="li" onclick="location.hash='match/${m.id}'"><div class="grow"><div class="t">${esc(m.data.name || "Match")}</div><div class="dim">${fmtDate(m.ts)} &middot; ${esc(m.data.type || "")} ${esc(m.data.division || "")}${m.data.place ? ` &middot; ${m.data.place}${m.data.of ? "/" + m.data.of : ""}` : ""}</div></div>${m.data.pct ? `<span class="badge">${r1(+m.data.pct)}%</span>` : ""}</div>`).join("")}</div></div>` : `<div class="empty">No matches logged yet.</div>`;
  }
  $app.innerHTML = shell("shoot", inner); bindCommon();
}
function viewDrill(id) {
  const dr = D.DRILLS.find(d => d.id === id); if (!dr) return go("shoot");
  const runs = drillRuns(dr); const b = bestDrill(dr);
  const pts = runs.slice().reverse().map(x => ({ x: new Date(x.r.ts), y: x.val }));
  const tgt = dr.bm.length ? (dr.scoring === "points" ? Math.max(...dr.bm.map(b => b.s)) : Math.min(...dr.bm.map(b => b.t))) : null;
  $app.innerHTML = shell("shoot", `<a class="dim" href="#shoot/drills">&lsaquo; Drills</a><h1 style="margin:6px 0">${esc(dr.name)}</h1>
   <div class="card"><div class="grid2"><div><div class="dim">Distance</div>${esc(dr.dist)}</div><div><div class="dim">Rounds</div>${dr.rounds || "Varies"}</div><div><div class="dim">Target</div>${esc(dr.target)}</div><div><div class="dim">Start</div>${esc(dr.start)}</div></div>
   <p style="margin-bottom:0">${esc(dr.proc)}</p>${dr.pen ? `<p class="dim">${esc(dr.pen)}</p>` : ""}
   <div class="dim">Source: ${dr.src ? `<a href="${esc(dr.src)}" target="_blank" rel="noopener">${esc(dr.srcName)}</a>` : esc(dr.srcName)}</div></div>
   ${dr.bm.length ? `<div class="card"><h3>Published standards</h3><table class="t">${dr.bm.map(x => `<tr><td>${esc(x.l)}</td><td class="n">${x.t != null ? (/\.(99|49)$/.test(String(x.t)) ? "under " + (x.t + 0.01).toFixed(1) + " s" : x.t.toFixed(x.t < 1 ? 2 : 1) + " s or faster") + (dr.scoring === "split" ? " split" : "") : x.s + (dr.max ? "/" + dr.max : "") + " or better"}</td></tr>`).join("")}</table></div>` : ""}
   <div class="card"><h3>Log a run</h3>
    ${dr.scoring === "points" ? `<label class="f">Score${dr.max ? " out of " + dr.max : ""}</label><input class="i" id="dp" inputmode="decimal">` : `<label class="f">${dr.scoring === "split" ? "Split time (s)" : "Time (s)"}</label><input class="i" id="dt" inputmode="decimal" placeholder="e.g. 2.15">`}
    ${dr.scoring === "time_plus_penalty" ? `<label class="f">${esc(dr.penLabel || "Penalties")}</label><input class="i" id="dpen" inputmode="decimal" placeholder="0">` : ""}
    <label class="f">Gun / division (optional)</label><input class="i" id="dg" value="${esc(runs[0]?.r.data.gun || "")}">
    <label class="f">Notes</label><input class="i" id="dn" placeholder="Hits, what to fix">
    <div style="height:12px"></div><button class="btn pri full" id="dsave">Save run</button></div>
   ${b ? `<div class="card"><div class="spread"><h3>Your best</h3><div>${b.rating ? `<span class="badge">${esc(b.rating)}</span> ` : ""}<span class="badge" style="background:var(--card2);color:var(--tx)">${drillVal(dr, b)}</span></div></div>${lineChart(pts, { target: tgt, unit: dr.scoring === "points" ? "" : "s", color: "var(--good)" })}</div>` : ""}
   ${runs.length ? `<div class="card"><h3>History</h3>${runs.map(x => `<div class="li"><div class="grow"><div class="t">${drillVal(dr, x)} ${drillRating(dr, x.val) ? `<span class="chip acc">${esc(drillRating(dr, x.val))}</span>` : ""}</div><div class="dim">${fmtDate(x.r.ts)} ${esc(x.r.data.gun || "")} ${esc(x.r.data.notes || "")}</div></div><button class="btn sm danger" data-act="delrec" data-id="${x.r.id}">Delete</button></div>`).join("")}</div>` : ""}`);
  bindCommon();
  document.getElementById("dsave").onclick = () => {
    const d = { drill: dr.id, time: num(document.getElementById("dt")?.value), points: num(document.getElementById("dp")?.value), pen: num(document.getElementById("dpen")?.value) || 0, gun: document.getElementById("dg").value.trim(), notes: document.getElementById("dn").value.trim() };
    if (d.time == null && d.points == null) return toast("Enter a time or score");
    put("drill", d); const v = drillScore(dr, d); const rt = drillRating(dr, v);
    toast(rt ? `Saved. That run rates ${rt}.` : "Saved"); viewDrill(id);
  };
}
function viewMatch(id) {
  const m = id === "new" ? null : R.get(id); const d = m?.data || { date: today(), type: "USPSA" };
  const f = (k, l, t = "text", ph = "") => `<label class="f">${l}</label><input class="i" name="${k}" type="${t}" ${t === "number" ? 'inputmode="decimal" step="any"' : ""} value="${esc(d[k] ?? "")}" placeholder="${esc(ph)}">`;
  const stages = d.stages || [];
  $app.innerHTML = shell("shoot", `<a class="dim" href="#shoot/matches">&lsaquo; Matches</a><h1 style="margin:6px 0">${m ? "Match" : "New match"}</h1>
   <div class="card" id="mf">${f("date", "Date", "date")}${f("name", "Match name", "text", "e.g. Rio Salado Monthly")}${f("club", "Club / range")}
   <label class="f">Sport</label><select class="i" name="type">${["USPSA", "3-Gun", "PCSL", "Steel Challenge", "IDPA", "Other"].map(t => `<option ${d.type === t ? "selected" : ""}>${t}</option>`).join("")}</select>
   <div class="grid2"><div>${f("division", "Division", "text", "Open, CO, PCC")}</div><div>${f("klass", "Class", "text", "U, D to GM")}</div></div>
   <div class="grid2"><div>${f("pct", "Match %", "number")}</div><div>${f("points", "Match points", "number")}</div></div>
   <div class="grid2"><div>${f("place", "Division place", "number")}</div><div>${f("of", "Of how many", "number")}</div></div>
   <div class="grid2"><div>${f("overall", "Overall place", "number")}</div><div>${f("time", "Total time (s)", "number")}</div></div>
   <h3 style="margin-top:14px">Hits</h3><div class="grid3">${f("a", "A", "number")}${f("c", "C", "number")}${f("dd", "D", "number")}${f("m", "Miss", "number")}${f("ns", "No-shoot", "number")}${f("proc", "Procedurals", "number")}</div>
   <label class="f">Notes</label><textarea class="i" name="notes" rows="3" placeholder="What went well, what to train">${esc(d.notes || "")}</textarea>
   <h3 style="margin-top:14px">Stages (optional)</h3><div id="stg">${stages.map((s, i) => stageRow(s, i)).join("")}</div>
   <button class="btn sm" id="addstg">+ Stage</button>
   <div style="height:14px"></div><button class="btn pri full big" id="msave">Save match</button>
   ${m ? `<button class="btn full danger" style="margin-top:8px" data-act="delrec" data-id="${m.id}" data-back="shoot/matches">Delete</button>` : ""}</div>`);
  bindCommon();
  document.getElementById("addstg").onclick = () => { const c = document.getElementById("stg"); c.insertAdjacentHTML("beforeend", stageRow({}, c.children.length)); };
  document.getElementById("msave").onclick = () => {
    const o = {}; document.querySelectorAll("#mf input[name], #mf select[name], #mf textarea[name]").forEach(i => { o[i.name] = i.type === "number" ? num(i.value) : i.value.trim(); });
    o.stages = [...document.querySelectorAll("#stg .stgrow")].map(r => ({ n: r.querySelector('[data-s="n"]').value.trim(), t: num(r.querySelector('[data-s="t"]').value), p: num(r.querySelector('[data-s="p"]').value) })).filter(s => s.n || s.t);
    o.stages.forEach(s => { if (s.t && s.p != null) s.hf = Math.round(s.p / s.t * 10000) / 10000; });
    put("match", o, m?.id, o.date ? dayStart(o.date).toISOString() : undefined); toast("Match saved"); go("shoot/matches");
  };
}
const stageRow = (s, i) => `<div class="stgrow grid3" style="margin-bottom:6px"><input class="i" data-s="n" placeholder="Stage ${i + 1}" value="${esc(s.n || "")}"><input class="i" data-s="t" inputmode="decimal" placeholder="Time" value="${esc(s.t ?? "")}"><input class="i" data-s="p" inputmode="decimal" placeholder="Points" value="${esc(s.p ?? "")}"></div>`;

/* ---------- BODY ---------- */
function viewBody() {
  const seg = route()[1] || "scans";
  let inner = `<h1 style="margin:4px 0">Body</h1><div class="seg">${[["scans", "Scans"], ["tape", "Tape"], ["weight", "Weight"]].map(([k, l]) => `<button class="${seg === k ? "on" : ""}" onclick="location.hash='body/${k}'">${l}</button>`).join("")}</div>`;
  if (seg === "scans") {
    const sc = list("scan");
    inner += `<a class="btn pri full big" href="#scan/new" style="margin-top:6px">Photograph a scan</a><p class="dim">Snap the eVolt 360 printout. The app reads every number off the sheet, you check them, then save.</p>`;
    if (sc.length) {
      const s0 = sc[0].data, s1 = sc[1]?.data;
      inner += `<div class="card hero"><div class="spread"><h3>Latest scan</h3><span class="dim">${fmtDate(sc[0].ts)}</span></div><div class="grid2" style="margin-top:8px">${["weight_lb", "body_fat_pct", "skeletal_muscle_mass_lb", "visceral_fat_level"].map(k => scanStat(k, s0, s1)).join("")}</div><a class="btn full" style="margin-top:10px" href="#scan/${sc[0].id}">Full report</a></div>`;
      const series = (k) => sc.slice().reverse().filter(r => r.data[k] != null).map(r => ({ x: new Date(r.ts), y: +r.data[k] }));
      if (sc.length > 1) inner += `<div class="card"><h3>Body fat %</h3>${lineChart(series("body_fat_pct"), { color: "var(--bad)" })}</div><div class="card"><h3>Skeletal muscle (lb)</h3>${lineChart(series("skeletal_muscle_mass_lb"), { color: "var(--good)" })}</div>`;
      inner += `<div class="card"><h3>All scans</h3><div class="list">${sc.map(r => `<div class="li" onclick="location.hash='scan/${r.id}'"><div class="grow"><div class="t">${fmtDate(r.ts)}</div><div class="dim">${r1(r.data.weight_lb)} lb &middot; ${r1(r.data.body_fat_pct)}% fat &middot; ${r1(r.data.skeletal_muscle_mass_lb)} lb muscle</div></div><span class="chev">&rsaquo;</span></div>`).join("")}</div></div>`;
    } else inner += `<div class="empty">No scans yet.</div>`;
  } else if (seg === "tape") {
    const ts = list("tape");
    inner += `<a class="btn pri full big" href="#tape/new" style="margin-top:6px">Add measurements</a>`;
    if (ts.length) {
      const first = ts[ts.length - 1].data, last = ts[0].data;
      inner += `<div class="card"><h3>Progress since ${fmtDate(ts[ts.length - 1].ts)}</h3><table class="t"><tr><th>Site</th><th class="n">Now</th><th class="n">Change</th></tr>${D.TAPE.filter(t => last[t.id] != null).map(t => { const ch = first[t.id] != null ? last[t.id] - first[t.id] : null; return `<tr onclick="location.hash='tapechart/${t.id}'" style="cursor:pointer"><td>${esc(t.n)}</td><td class="n">${r1(last[t.id])}"</td><td class="n ${ch > 0 ? "up" : ch < 0 ? "down" : ""}">${ch == null ? "" : (ch > 0 ? "+" : "") + r1(ch)}"</td></tr>`; }).join("")}</table><div class="dim" style="margin-top:6px">Tap a row for its chart.</div></div>`;
      inner += `<div class="card"><h3>History</h3><div class="list">${ts.map(r => `<div class="li" onclick="location.hash='tape/${r.id}'"><div class="grow"><div class="t">${fmtDate(r.ts)}</div><div class="dim">${D.TAPE.filter(t => r.data[t.id] != null).length} sites measured</div></div><span class="chev">&rsaquo;</span></div>`).join("")}</div></div>`;
    } else inner += `<div class="empty">Measure every 2 to 4 weeks, same time of day, same tape.</div>`;
  } else {
    const w = weights(); const p = profile(); const tr = trendPerWeek(w);
    inner += `<button class="btn pri full big" data-act="qweight" style="margin-top:6px">Log weight</button>
      <div class="card"><div class="spread"><h3>Weight</h3>${tr != null ? `<span class="${tr >= 0 ? "up" : "down"}">${tr >= 0 ? "+" : ""}${r1(tr)} lb/week</span>` : ""}</div>${lineChart(w.slice(-90), { target: p?.targetWeightLb || null, unit: " lb" })}
      <p class="dim">Weigh in the morning after the bathroom, before food. The weekly trend matters, not any single day.</p></div>
      <div class="card"><div class="list">${list("weight").slice(0, 40).map(r => `<div class="li"><div class="grow"><div class="t">${r1(r.data.lb)} lb</div><div class="dim">${fmtDate(r.ts)} ${esc(r.data.source || "")}</div></div><button class="btn sm danger" data-act="delrec" data-id="${r.id}">Delete</button></div>`).join("")}</div></div>`;
  }
  $app.innerHTML = shell("body", inner); bindCommon();
}
function scanStat(k, s0, s1) {
  const v = s0[k], pv = s1?.[k]; const ch = v != null && pv != null ? v - pv : null; const good = ch == null ? null : (D.LOWER_BETTER.has(k) ? ch < 0 : ch > 0);
  return `<div class="stat"><div class="k">${esc(D.SCAN_LABELS[k] || k)}</div><div class="v">${v != null ? r1(v) : "--"}</div><div class="s">${ch != null && ch !== 0 ? `<span class="${good ? "up" : "down"}">${ch > 0 ? "+" : ""}${r1(ch)} vs last</span>` : "&nbsp;"}</div></div>`;
}
function viewScan(id) {
  if (id === "new") return viewScanNew();
  const r = R.get(id); if (!r || r.deleted) return go("body/scans");
  const sc = list("scan"); const i = sc.findIndex(x => x.id === id); const prev = sc[i + 1]?.data; const d = r.data;
  const seg = [["Left arm", "left_arm"], ["Right arm", "right_arm"], ["Torso", "torso"], ["Left leg", "left_leg"], ["Right leg", "right_leg"]];
  const armDiff = d.left_arm_lean_lb && d.right_arm_lean_lb ? Math.abs(d.left_arm_lean_lb - d.right_arm_lean_lb) / Math.max(d.left_arm_lean_lb, d.right_arm_lean_lb) * 100 : null;
  const legDiff = d.left_leg_lean_lb && d.right_leg_lean_lb ? Math.abs(d.left_leg_lean_lb - d.right_leg_lean_lb) / Math.max(d.left_leg_lean_lb, d.right_leg_lean_lb) * 100 : null;
  $app.innerHTML = shell("body", `<a class="dim" href="#body/scans">&lsaquo; Scans</a><h1 style="margin:6px 0">Scan ${fmtDate(r.ts)}</h1><div class="dim">${esc(d.source === "evolt360" ? "eVolt 360" : d.brand || "Body scan")}${prev ? " &middot; compared with " + fmtDate(sc[i + 1].ts) : ""}</div>
   <div class="grid2" style="margin-top:12px">${["weight_lb", "body_fat_pct", "skeletal_muscle_mass_lb", "lean_body_mass_lb", "body_fat_mass_lb", "visceral_fat_level", "bmr_kcal", "bwi_score"].map(k => scanStat(k, d, prev)).join("")}</div>
   <div class="card"><h3>Segmental lean mass (lb)</h3><table class="t"><tr><th></th><th class="n">Lean</th><th class="n">Fat</th></tr>${seg.map(([l, k]) => `<tr><td>${l}</td><td class="n">${r1(d[k + "_lean_lb"])}</td><td class="n">${r1(d[k + "_fat_lb"])}</td></tr>`).join("")}</table>
   ${armDiff != null ? `<p class="dim">Arm difference ${r1(armDiff)}%, leg difference ${r1(legDiff)}%. ${(armDiff > 5 || legDiff > 5) ? "Worth adding single-arm and single-leg work on the weaker side." : "Left and right are close."} A small strong-side edge is normal for shooters.</p>` : ""}</div>
   <div class="card"><h3>Everything on the sheet</h3><table class="t">${Object.entries(D.SCAN_LABELS).filter(([k]) => d[k] != null).map(([k, l]) => `<tr><td>${esc(l)}</td><td class="n">${r1(d[k])}</td><td class="n dim">${prev?.[k] != null ? ((d[k] - prev[k]) > 0 ? "+" : "") + r1(d[k] - prev[k]) : ""}</td></tr>`).join("")}</table>
   ${d.rec_calories_low ? `<p class="dim">The scanner's nutrition suggestion: ${d.rec_calories_low} to ${d.rec_calories_high} kcal, protein ${d.rec_protein_g_low} to ${d.rec_protein_g_high} g. The Fuel tab shows how the app's own targets compare.</p>` : ""}
   ${d.handwritten_notes ? `<p class="dim">Notes: ${esc(d.handwritten_notes)}</p>` : ""}</div>
   ${d.photo ? `<button class="btn full" id="viewphoto">View the original photo</button><div id="ph"></div>` : ""}
   <a class="btn full" style="margin-top:8px" href="#scanedit/${r.id}">Edit values</a>
   <button class="btn full danger" style="margin-top:8px" data-act="delrec" data-id="${r.id}" data-back="body/scans">Delete scan</button>`);
  bindCommon();
  const vp = document.getElementById("viewphoto");
  if (vp) vp.onclick = async () => { vp.disabled = true; try { const j = await api("photo_url", { path: d.photo }); document.getElementById("ph").innerHTML = `<img class="photo" style="margin-top:10px" src="${esc(j.url)}" alt="scan photo">`; } catch (e) { toast(e.message); } };
}
function viewScanNew() {
  $app.innerHTML = shell("body", `<a class="dim" href="#body/scans">&lsaquo; Scans</a><h1 style="margin:6px 0">Add a scan</h1>
   <div class="card"><p>Lay the printout flat in good light and fill the frame with the sheet.</p>
   <label class="btn pri full big" style="cursor:pointer">Take photo<input type="file" accept="image/*" capture="environment" id="scf" hidden></label>
   <label class="btn full" style="cursor:pointer;margin-top:8px">Choose from library<input type="file" accept="image/*" id="scf2" hidden></label>
   <button class="btn ghost full" style="margin-top:8px" id="manual">Type the numbers in instead</button>
   <div id="scs" style="margin-top:12px"></div></div>`);
  bindCommon();
  const handle = async file => {
    if (!file) return;
    const st = document.getElementById("scs"); st.innerHTML = `<div class="row"><span class="spin"></span><span>Reading your scan. About 10 seconds.</span></div>`;
    try {
      const b64 = await shrink(file, 1800);
      const id = uid();
      const j = await api("extract_scan", { image_b64: b64, mime: "image/jpeg", id });
      scanReview({ ...(j.extracted || {}), photo: j.path }, null, j.error);
    } catch (e) { st.innerHTML = `<div class="down">${esc(e.message)}</div>`; }
  };
  document.getElementById("scf").onchange = e => handle(e.target.files[0]);
  document.getElementById("scf2").onchange = e => handle(e.target.files[0]);
  document.getElementById("manual").onclick = () => scanReview({ date: today() });
}
function shrink(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.85).split(",")[1]); };
    img.onerror = () => rej(new Error("Could not open that image")); img.src = url;
  });
}
function scanReview(d, existingId, warn) {
  const keys = ["date", ...Object.keys(D.SCAN_LABELS)];
  $app.innerHTML = shell("body", `<h1 style="margin:6px 0">Check the numbers</h1>${warn ? `<div class="note down">${esc(warn)}</div>` : ""}
   <div class="note">Compare these with the sheet. Fix anything that is off, then save. ${d.confidence != null ? `Read confidence ${Math.round(d.confidence * 100)}%.` : ""}</div>
   <div class="card" id="sr">${keys.map(k => `<label class="f">${esc(k === "date" ? "Scan date" : D.SCAN_LABELS[k])}</label><input class="i" name="${k}" ${k === "date" ? 'type="date"' : 'inputmode="decimal"'} value="${esc(d[k] ?? "")}">`).join("")}
   <div style="height:14px"></div><button class="btn pri full big" id="srsave">Save scan</button></div>`);
  bindCommon();
  document.getElementById("srsave").onclick = () => {
    const o = { ...d }; document.querySelectorAll("#sr input").forEach(i => { o[i.name] = i.name === "date" ? i.value : num(i.value); });
    if (!o.source) o.source = /evolt/i.test(d.brand || "") || d.photo ? "evolt360" : "manual";
    const ts = o.date ? dayStart(o.date).toISOString() : new Date().toISOString();
    const rec = put("scan", o, existingId || undefined, ts);
    if (o.weight_lb && !existingId) put("weight", { lb: o.weight_lb, source: "scan" }, undefined, ts);
    toast("Scan saved"); go("scan/" + rec.id);
  };
}
function viewTape(id) {
  const r = id === "new" ? null : R.get(id); const d = r?.data || {};
  const prev = list("tape")[0]?.data || {};
  $app.innerHTML = shell("body", `<a class="dim" href="#body/tape">&lsaquo; Tape</a><h1 style="margin:6px 0">Measurements</h1>
   <div class="note">Inches. Same tape, same time of day, tape snug but not digging in. Leave anything blank you skip.</div>
   <div class="card" id="tf"><label class="f">Date</label><input class="i" type="date" name="date" value="${esc(d.date || today())}">
   ${D.TAPE.map(t => `<label class="f">${esc(t.n)}</label><input class="i" name="${t.id}" inputmode="decimal" value="${esc(d[t.id] ?? "")}" placeholder="${prev[t.id] != null ? "last " + prev[t.id] : ""}"><div class="dim">${esc(t.how)}</div>`).join("")}
   <div style="height:14px"></div><button class="btn pri full big" id="tsave">Save</button>
   ${r ? `<button class="btn full danger" style="margin-top:8px" data-act="delrec" data-id="${r.id}" data-back="body/tape">Delete</button>` : ""}</div>`);
  bindCommon();
  document.getElementById("tsave").onclick = () => {
    const o = {}; document.querySelectorAll("#tf input").forEach(i => o[i.name] = i.name === "date" ? i.value : num(i.value));
    put("tape", o, r?.id, dayStart(o.date || today()).toISOString()); toast("Saved"); go("body/tape");
  };
}
function viewTapeChart(site) {
  const t = D.TAPE.find(x => x.id === site); if (!t) return go("body/tape");
  const pts = list("tape").slice().reverse().filter(r => r.data[site] != null).map(r => ({ x: new Date(r.ts), y: r.data[site] }));
  $app.innerHTML = shell("body", `<a class="dim" href="#body/tape">&lsaquo; Tape</a><h1 style="margin:6px 0">${esc(t.n)}</h1><div class="card">${lineChart(pts, { unit: '"' })}<p class="dim">${esc(t.how)}</p></div>`); bindCommon();
}

/* ---------- FUEL ---------- */
function viewFuel() {
  const p = profile(); if (!p) return go("today");
  const n = nutrition(p);
  if (!n) { $app.innerHTML = shell("fuel", `<h1>Fuel</h1><div class="empty">Log your weight or a scan first, then your targets appear here.</div><button class="btn pri full" data-act="qweight">Log weight</button>`); bindCommon(); return; }
  const f = todayFood(); const tr = trendPerWeek(weights(), p.goal === "gain" ? 21 : 28);
  const g = D.GOALS[p.goal] || D.GOALS.maintain;
  const meals = Math.max(3, Math.min(5, Math.round(n.protein / 40)));
  let adapt = "";
  if (tr != null) {
    const [lo, hi] = n.rateLb;
    if (tr < lo - 0.1) adapt = `You are trending ${r1(tr)} lb/week, below the ${r1(lo)} to ${r1(hi)} lb/week target. ${p.goal === "lose" || p.goal === "recomp" ? "That is faster loss than planned, so eat about 150 kcal more to protect muscle." : "Add about 150 kcal a day."}`;
    else if (tr > hi + 0.1) adapt = `You are trending ${r1(tr)} lb/week, above the ${r1(lo)} to ${r1(hi)} lb/week target. Trim about 150 kcal a day.`;
    else adapt = `You are trending ${r1(tr)} lb/week, right inside the ${r1(lo)} to ${r1(hi)} lb/week target. Keep going.`;
  }
  const s = n.scan;
  const ideas = {
    gain: ["Add a 600 to 800 kcal shake: milk, whey, oats, peanut butter, banana.", "Eat 4 to 5 times a day. Do not skip breakfast.", "Carbs around training: rice, potatoes, bagels, fruit.", "Calorie-dense extras: olive oil on rice and vegetables, nuts, whole milk."],
    lose: ["Build each plate around a palm or two of lean protein, then vegetables.", "Keep most carbs around your workout.", "Swap liquid calories for water or zero-calorie drinks.", "Plan match-day food ahead: jerky, fruit, protein bars, a real lunch."],
    recomp: ["Protein at every meal, 30 to 50 g each.", "Carbs mostly before and after training.", "Mostly whole foods, one flexible meal a day."],
    maintain: ["Protein at every meal.", "Eat more on hard training days and match days, a bit less on rest days."],
    strength: ["Protein at every meal and carbs before lifting so the heavy sets stay heavy."],
  }[p.goal] || [];
  $app.innerHTML = shell("fuel", `<h1 style="margin:4px 0">Fuel</h1>
   <div class="card hero"><div class="dim" style="text-transform:uppercase;letter-spacing:.08em">Daily target, ${esc(g.label.toLowerCase())}</div>
   <div class="row" style="align-items:baseline;gap:8px"><div style="font-family:var(--disp);font-size:52px;font-weight:800;line-height:1">${r0(Math.round(n.kcal / 10) * 10)}</div><div class="muted">kcal</div></div>
   <div class="grid3" style="margin-top:10px"><div class="stat"><div class="k">Protein</div><div class="v">${r0(n.protein)}g</div></div><div class="stat"><div class="k">Carbs</div><div class="v">${r0(n.carbs)}g</div></div><div class="stat"><div class="k">Fat</div><div class="v">${r0(n.fat)}g</div></div></div>
   <div class="dim" style="margin-top:8px">${esc(g.note)}</div></div>
   <div class="card"><div class="spread"><h3>Today</h3><span class="dim">${r0(f.kcal)} kcal, ${r0(f.protein)} g protein</span></div>
    <div style="margin-top:8px" class="dim">Calories</div><div class="bar"><i style="width:${Math.min(100, f.kcal / n.kcal * 100)}%"></i></div>
    <div style="margin-top:8px" class="dim">Protein</div><div class="bar"><i style="width:${Math.min(100, f.protein / n.protein * 100)}%;background:var(--good)"></i></div>
    <div class="grid2" style="margin-top:12px"><input class="i" id="fk" inputmode="numeric" placeholder="kcal"><input class="i" id="fp" inputmode="numeric" placeholder="protein g"></div>
    <input class="i" id="fn" placeholder="What was it? (optional)" style="margin-top:8px">
    <div class="pill-sel" style="margin-top:8px">${[["Protein shake", 160, 30], ["Chicken breast 8 oz", 370, 70], ["4 eggs", 290, 25], ["Greek yogurt cup", 150, 20], ["Rice 1 cup", 205, 4], ["Big meal", 800, 45]].map(([l, k, pr]) => `<button data-q="${k}|${pr}|${esc(l)}">${esc(l)}</button>`).join("")}</div>
    <button class="btn pri full" id="fadd" style="margin-top:10px">Add</button>
    ${f.items.length ? `<div class="list" style="margin-top:8px">${f.items.map(r => `<div class="li"><div class="grow"><div class="t">${esc(r.data.name || "Food")}</div><div class="dim">${r0(r.data.kcal)} kcal, ${r0(r.data.protein)} g protein</div></div><button class="btn sm danger" data-act="delrec" data-id="${r.id}">x</button></div>`).join("")}</div>` : ""}</div>
   ${adapt ? `<div class="card"><h3>Your trend</h3><p class="muted">${esc(adapt)}</p><div class="row"><button class="btn sm" data-adj="-150">-150 kcal</button><button class="btn sm" data-adj="150">+150 kcal</button>${p.kcalAdjust ? `<button class="btn sm" data-adj="0">Reset (${p.kcalAdjust > 0 ? "+" : ""}${p.kcalAdjust})</button>` : ""}</div></div>` : `<div class="card"><h3>Your trend</h3><p class="muted">Log your weight 4 or more times over the next couple of weeks and the app checks whether you are moving at the right pace (${r1(n.rateLb[0])} to ${r1(n.rateLb[1])} lb/week for your goal) and tells you how to adjust.</p></div>`}
   <div class="card"><h3>How to eat for your goal</h3><ul class="muted" style="padding-left:18px;margin:6px 0">${ideas.map(x => `<li>${esc(x)}</li>`).join("")}<li>Split protein over about ${meals} meals of ${r0(n.protein / meals)} g.${(p.age || 0) >= 50 ? " Over 50, larger protein servings per meal matter more for keeping muscle." : ""}</li>
    <li>Phoenix heat: drink through the whole match day, not just when thirsty, and add electrolytes when you sweat through your shirt.</li></ul></div>
   <div class="card"><h3>How these numbers were built</h3><table class="t">
    <tr><td>Resting burn (BMR)</td><td class="n">${r0(n.bmr)} kcal</td></tr><tr><td class="dim" colspan="2">${esc(n.bmrHow)}</td></tr>
    <tr><td>Times activity (${n.act.f})</td><td class="n">${r0(n.tdee)} kcal</td></tr>
    <tr><td>Goal adjustment</td><td class="n">${r0(n.kcal - n.tdee)} kcal</td></tr>
    <tr><td>Protein</td><td class="n">${r1(n.gkg)} g/kg</td></tr></table>
    <p class="dim">Protein follows the ISSN position stand (1.4 to 2.0 g/kg for most training people, higher in a calorie deficit). Fat never drops under 0.6 g/kg. Carbs fill the rest for training energy.</p>
    ${s?.rec_calories_low ? `<p class="dim">Your eVolt sheet suggested ${s.rec_calories_low} to ${s.rec_calories_high} kcal and ${s.rec_protein_g_low} to ${s.rec_protein_g_high} g protein. Its protein number is about 1.5 g per pound, well above what the research supports, so the app uses the lower ISSN range. The supplement list on the sheet is the gym's own product line.</p>` : ""}
    <p class="dim">Supplements with real evidence for athletes: creatine monohydrate 3 to 5 g a day (ISSN position stand) and caffeine before training if it suits you. Everything else is optional.</p></div>
   <div class="dim" style="text-align:center;margin:10px 0">General guidance, not medical advice. Talk to a doctor before big diet changes.</div>`);
  bindCommon();
  document.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { const [k, pr, l] = b.dataset.q.split("|"); document.getElementById("fk").value = k; document.getElementById("fp").value = pr; document.getElementById("fn").value = l; });
  document.getElementById("fadd").onclick = () => { const k = num(document.getElementById("fk").value), pr = num(document.getElementById("fp").value); if (!k && !pr) return toast("Enter calories or protein"); put("food", { kcal: k || 0, protein: pr || 0, name: document.getElementById("fn").value.trim() }); viewFuel(); };
  document.querySelectorAll("[data-adj]").forEach(b => b.onclick = () => { const p2 = profile(); const v = +b.dataset.adj; p2.kcalAdjust = v === 0 ? 0 : (p2.kcalAdjust || 0) + v; setProfile(p2); viewFuel(); });
}

/* ---------- MORE ---------- */
function viewMore() {
  const sub = route()[1];
  if (sub === "profile") { $app.innerHTML = shell("", `<a class="dim" href="#more">&lsaquo; Settings</a>${profileForm(profile() || {})}`); bindProfile($app, () => go("today")); bindCommon(); return; }
  if (sub === "admin") return viewAdmin();
  if (sub === "research") {
    $app.innerHTML = shell("", `<a class="dim" href="#more">&lsaquo; Settings</a><h1 style="margin:6px 0">Research and sources</h1>
     <div class="card"><h3>What the research says about training for USPSA and 3-Gun</h3><ul class="muted" style="padding-left:18px">
      <li>Shooting skill comes from shooting and dry fire. Fitness makes you faster between positions, steadier when tired, and harder to injure. Mike Seeklander, a two-time IDPA national champion, says few exercises are truly shooting specific and builds a general athletic base instead.</li>
      <li>The physical qualities that show up on a stage: acceleration, deceleration (stopping balanced so you can shoot at once), lateral movement, getting in and out of low positions, grip, a quiet core during transitions, and enough conditioning to stay sharp for an eight-hour match day.</li>
      <li>Strength-to-bodyweight ratio matters: lighter and stronger moves faster.</li>
      <li>Short repeated efforts with rest, like intervals on a bike or rower, look the most like a stage. Long runs are optional.</li>
      <li>Put explosive work first while you are fresh. Grip and core go last so your hands are not fried for the big lifts.</li></ul></div>
     ${D.SOURCES.map(s => `<div class="card"><a href="${esc(s.u)}" target="_blank" rel="noopener"><b>${esc(s.t)}</b></a><p class="dim" style="margin:6px 0 0">${esc(s.n)}</p></div>`).join("")}
     <div class="card"><h3>Drill standards</h3><p class="dim">Each drill page links the source that published its procedure and standards: Ben Stoeger, Pistol-Training.com (Todd Green's F.A.S.T., Bill Wilson's 5x5, Dot Torture), Everyday Marksman, American Rifleman, RifleConfigurator (Kyle Lamb's 1-5), and Outdoor Life (Keith Garcia's Load 12).</p></div>`);
    bindCommon(); return;
  }
  if (sub === "health") {
    const url = `${API}?ingest=${S.user.ingest_key || ""}`;
    $app.innerHTML = shell("", `<a class="dim" href="#more">&lsaquo; Settings</a><h1 style="margin:6px 0">Apple Health and Apple Watch</h1>
     <div class="note">Websites cannot read Apple Health directly. Apple only allows native iPhone apps to do that. So a small helper app on your iPhone sends your Health data here on a schedule. Your Apple Watch workouts, heart rate, resting heart rate, HRV, steps, sleep and body weight then show up in this app.</div>
     <div class="card"><h3>Your private link</h3><p class="dim">Anyone with this link can add data to your account, so keep it private.</p><input class="i" readonly id="iu" value="${esc(url)}"><div class="row" style="margin-top:8px"><button class="btn sm" id="cp">Copy link</button><button class="btn sm danger" id="rot">Make a new link</button></div></div>
     <div class="card"><h3>Option 1: Health Auto Export (easiest)</h3><ol class="muted" style="padding-left:18px">
      <li>Install <b>Health Auto Export - JSON+CSV</b> from the App Store. Automations need its premium upgrade.</li>
      <li>Open it, tap Automations, add a new <b>REST API</b> automation.</li>
      <li>Paste your private link as the URL. Format: JSON. Export version 2.</li>
      <li>Data: pick Health Metrics (Step Count, Resting Heart Rate, Heart Rate Variability, Weight/Body Mass, Active Energy, Sleep Analysis) and turn on Workouts.</li>
      <li>Set it to sync every hour or every day. Run it once by hand to test.</li></ol>
      <p class="dim">Strength workouts you record on the watch match up with the workouts you log here by start time, and show your heart rate on the workout summary.</p></div>
     <div class="card"><h3>Option 2: a free Apple Shortcut</h3><ol class="muted" style="padding-left:18px">
      <li>Shortcuts app, Automation tab, New Automation, Time of Day (for example 9 pm daily), Run Immediately.</li>
      <li>Add <b>Find Health Samples</b>: type Resting Heart Rate, sort by Start Date latest first, limit 1.</li>
      <li>Add <b>Get Contents of URL</b>: paste your private link, Method POST, Request Body JSON with fields <code>type</code> = resting_heart_rate, <code>value</code> = the Health Sample value, <code>unit</code> = bpm, <code>date</code> = the sample Start Date.</li>
      <li>Duplicate those two steps for steps or body weight.</li></ol></div>`);
    bindCommon();
    document.getElementById("cp").onclick = () => { navigator.clipboard?.writeText(url).then(() => toast("Copied")); };
    document.getElementById("rot").onclick = async () => { if (!confirm("The old link stops working. Continue?")) return; const j = await api("rotate_ingest_key"); S.user.ingest_key = j.ingest_key; localStorage.setItem("fit:session", JSON.stringify(S)); viewMore(); };
    return;
  }
  const p = profile();
  $app.innerHTML = shell("", `<h1 style="margin:6px 0">Settings</h1>
   <div class="card"><div class="list">
    <div class="li" onclick="location.hash='more/profile'"><div class="grow"><div class="t">Profile and goals</div><div class="dim">${esc(p ? `${D.GOALS[p.goal]?.label || ""}, ${p.days} days/week` : "Not set")}</div></div><span class="chev">&rsaquo;</span></div>
    <div class="li" onclick="location.hash='more/health'"><div class="grow"><div class="t">Apple Health and Apple Watch</div><div class="dim">${list("health").length ? list("health").length + " data points synced" : "Not connected yet"}</div></div><span class="chev">&rsaquo;</span></div>
    ${S.user.is_admin ? `<div class="li" onclick="location.hash='more/admin'"><div class="grow"><div class="t">People</div><div class="dim">Add someone: account, web address, welcome email</div></div><span class="chev">&rsaquo;</span></div>` : ""}
    <div class="li" onclick="location.hash='crew'"><div class="grow"><div class="t">Crew competition</div><div class="dim">Standings, invite code, join a crew</div></div><span class="chev">&rsaquo;</span></div>
    <div class="li" onclick="location.hash='pin'"><div class="grow"><div class="t">Change PIN</div></div><span class="chev">&rsaquo;</span></div>
    <div class="li" onclick="location.hash='more/research'"><div class="grow"><div class="t">Research and sources</div><div class="dim">Why the program and targets look the way they do</div></div><span class="chev">&rsaquo;</span></div>
    <div class="li" data-act="install"><div class="grow"><div class="t">Add to Home Screen</div><div class="dim">Runs full screen like an app</div></div></div>
   </div></div>
   <div class="card"><div class="spread"><div><div class="t">Signed in as ${esc(S.user.handle)}</div><div class="dim">${esc(syncState || "")} &middot; ${R.size} records</div></div><button class="btn sm" data-act="syncnow">Sync now</button></div></div>
   <button class="btn full danger" data-act="signout">Sign out</button>`);
  bindCommon();
}

/* ---------- shared bindings ---------- */
let sheetEl = null;
function sheet(html, bind) { closeSheet(); sheetEl = document.createElement("div"); sheetEl.className = "modal"; sheetEl.innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`; sheetEl.onclick = e => { if (e.target === sheetEl) closeSheet(); }; document.body.appendChild(sheetEl); bind && bind(sheetEl); }
function closeSheet() { sheetEl?.remove(); sheetEl = null; }
function bindCommon() {
  $app.querySelectorAll("[data-act]").forEach(el => el.onclick = e => {
    const a = el.dataset.act;
    if (["setdone", "addset", "plates", "rpe", "exmenu", "addex", "discard", "finish"].includes(a)) return sessionAct(a, el);
    if (a === "start") return startSession(+el.dataset.day);
    if (a === "startblank") return startSession(0, true);
    if (a === "delrec") { if (confirm("Delete this entry?")) { del(el.dataset.id); el.dataset.back ? go(el.dataset.back) : render(); } return; }
    if (a === "qweight") return sheet(`<h3>Log weight</h3><input class="i" id="qw" inputmode="decimal" placeholder="lb" value="${esc(r1(currentWeight()) || "")}"><label class="f">Date</label><input class="i" id="qd" type="date" value="${today()}"><div style="height:10px"></div><button class="btn pri full" id="qws">Save</button>`, m => { const i = m.querySelector("#qw"); i.focus(); i.select(); m.querySelector("#qws").onclick = () => { const v = num(i.value); if (!v) return; const d = m.querySelector("#qd").value; put("weight", { lb: v, source: "log" }, `weight:${S.user.id}:${d}`, (d === today() ? new Date() : dayStart(d)).toISOString()); closeSheet(); toast("Weight saved"); render(); }; });
    if (a === "qcardio") return sheet(`<h3>Log cardio</h3><div class="pill-sel" id="ct">${["Run", "Bike ride", "Rower", "Incline walk", "Swim", "Other"].map((t, i) => `<button class="${i ? "" : "on"}">${t}</button>`).join("")}</div><div class="grid2"><div><label class="f">Minutes</label><input class="i" id="cm" inputmode="decimal"></div><div><label class="f">Miles</label><input class="i" id="cd" inputmode="decimal"></div></div><label class="f">Date</label><input class="i" id="cdt" type="date" value="${today()}"><div style="height:10px"></div><button class="btn pri full" id="cs">Save</button>`, m => { m.querySelectorAll("#ct button").forEach(b => b.onclick = () => { m.querySelectorAll("#ct button").forEach(x => x.classList.remove("on")); b.classList.add("on"); }); m.querySelector("#cs").onclick = () => { const d = m.querySelector("#cdt").value; put("cardio", { type: m.querySelector("#ct .on").textContent, minutes: num(m.querySelector("#cm").value), miles: num(m.querySelector("#cd").value) }, undefined, (d === today() ? new Date() : dayStart(d)).toISOString()); closeSheet(); toast("Saved"); render(); }; });
    if (a === "signout") { if (confirm("Sign out of this device?")) signOut(); return; }
    if (a === "syncnow") { sync().then(() => toast(syncState)); return; }
    if (a === "install") return toast("In Safari tap the Share button, then Add to Home Screen.", 5000);
  });
}

/* ---------- render ---------- */
function render() {
  if (!S) return viewLogin();
  if (S.user.must_change_pin && route()[0] !== "pin") return go("pin");
  const [r, a] = route();
  closeSheet();
  if (r === "today") viewToday();
  else if (r === "train") viewTrain();
  else if (r === "session") viewSession();
  else if (r === "workout") viewWorkout(a);
  else if (r === "ex") viewExercise(a);
  else if (r === "shoot") viewShoot();
  else if (r === "drill") viewDrill(a);
  else if (r === "match") viewMatch(a);
  else if (r === "body") viewBody();
  else if (r === "scan") viewScan(a);
  else if (r === "scanedit") { const rec = R.get(a); rec ? scanReview(rec.data, rec.id) : go("body"); }
  else if (r === "tape") viewTape(a);
  else if (r === "tapechart") viewTapeChart(a);
  else if (r === "fuel") viewFuel();
  else if (r === "more") viewMore();
  else if (r === "crew") viewCrew();
  else if (r === "progress") viewProgress();
  else if (r === "drydrill") viewDryDrill(a);
  else if (r === "dryrun") viewDryRun(a);
  else if (r === "pin") viewPin();
  else go("today");
}

if (S) { loadStore(); }
render();
if (S) { api("me").then(j => { S.user = { ...S.user, ...j.user }; localStorage.setItem("fit:session", JSON.stringify(S)); if (S.user.must_change_pin) go("pin"); }).catch(() => {}); }
if (S) { sync(); setInterval(() => { if (document.visibilityState === "visible") sync(); }, 60000); document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); }); window.addEventListener("online", () => sync()); }
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
