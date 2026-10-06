/* Sân Cầu — quản lý thu chi team cầu lông.
 * Web tĩnh (GitHub Pages). Dữ liệu là một file JSON (data.json) trong repo:
 * mọi người đọc từ đó; admin/thủ quỹ lưu thay đổi vào trình duyệt rồi đồng bộ lên GitHub bằng token. */
'use strict';

/* ================= Tiện ích ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
const money = (n) => `${Math.round(n || 0).toLocaleString('vi-VN')} đ`;
const moneyShort = (n) => {
  const a = Math.abs(n || 0);
  if (a >= 1e6) return `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tr`;
  if (a >= 1e3) return `${Math.round(n / 1e3).toLocaleString('vi-VN')}k`;
  return String(Math.round(n || 0));
};
const signed = (n) => (n > 0.5 ? `+${money(n)}` : n < -0.5 ? `−${money(-n)}` : money(0));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* bộ nhớ bị chặn */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* bỏ qua */ } },
};
const DOW_FULL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => ymd(new Date());
const dm = (s) => { const [, m, d] = s.split('-'); return `${d}/${m}`; };
const dmy = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const monthLabel = (k) => { const [y, m] = k.split('-'); return `Tháng ${+m}/${y}`; };
const monthOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const ROLE_LABEL = { admin: 'Quản trị', editor: 'Thủ quỹ', viewer: 'Thành viên' };

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const hashPassword = (salt, pw) => sha256(`${salt}:${pw}`);
function b64utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/* ================= Trạng thái ================= */
let DB = null;
let me = null;
const ui = { route: 'overview', month: null, drawer: null, charts: [] };

const ICON = {
  overview: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  sessions: '<circle cx="12" cy="7" r="3"/><path d="M8 21l4-11 4 11M12 10v4"/>',
  ledger: '<path d="M4 4h16v16H4zM4 9h16M9 9v11"/>',
  settle: '<path d="M12 3v18M17 7H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  members: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.4.6 4 2.8 4 6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  chevL: '<path d="M15 18l-6-6 6-6"/>',
  chevR: '<path d="M9 18l6-6-6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  sync: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const SHUTTLE = `<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="31" r="6" fill="#f2c46d" stroke="currentColor" stroke-width="2"/><path d="M14.5 28 9 6l7 3 4-5 4 5 7-3-5.5 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M16 9l2 18M24 9l-2 18" stroke="currentColor" stroke-width="1.5"/></svg>`;

const NAV = [
  ['overview', 'Tổng quan'],
  ['sessions', 'Buổi đánh'],
  ['ledger', 'Thu chi'],
  ['settle', 'Quyết toán'],
  ['stats', 'Thống kê'],
  ['members', 'Thành viên'],
  ['settings', 'Cài đặt'],
];

/* ================= Quyền ================= */
const can = (what) => {
  if (!me) return false;
  if (what === 'admin') return me.role === 'admin';
  if (what === 'edit') return me.role === 'admin' || me.role === 'editor';
  return true;
};
function need(what) {
  if (can(what)) return true;
  toast(what === 'admin' ? 'Chỉ quản trị viên được làm việc này' : 'Tài khoản của bạn chỉ có quyền xem', true);
  return false;
}
const dis = (what = 'edit') => (can(what) ? '' : 'disabled');

/* ================= Dữ liệu & đồng bộ ================= */
function ghConfig() {
  const cfg = (DB && DB.settings && DB.settings.github) || {};
  if (cfg.repo) return { repo: cfg.repo, branch: cfg.branch || 'main', path: cfg.path || 'data.json' };
  const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
  if (!m) return null;
  const seg = location.pathname.split('/').filter(Boolean)[0];
  return { repo: seg ? `${m[1]}/${seg}` : `${m[1]}/${location.hostname}`, branch: 'main', path: 'data.json' };
}
const ghToken = () => store.get('bm.ghToken') || '';
const isDirty = () => store.get('bm.dirty') === '1';

async function fetchRemote() {
  const g = ghConfig();
  if (g) {
    try {
      const headers = { Accept: 'application/vnd.github.raw+json' };
      if (ghToken()) headers.Authorization = `Bearer ${ghToken()}`;
      const r = await fetch(`https://api.github.com/repos/${g.repo}/contents/${g.path}?ref=${encodeURIComponent(g.branch)}&t=${Date.now()}`, { headers, cache: 'no-store' });
      if (r.ok) return await r.json();
    } catch { /* thử file tĩnh bên dưới */ }
  }
  const r = await fetch(`data.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Không tải được data.json');
  return r.json();
}

async function loadData() {
  const local = store.get('bm.data');
  if (local && isDirty()) {
    try { DB = JSON.parse(local); return; } catch { /* hỏng thì tải lại */ }
  }
  try {
    DB = await fetchRemote();
    store.set('bm.data', JSON.stringify(DB));
    store.set('bm.dirty', '0');
    return;
  } catch { /* không có mạng */ }
  if (local) { try { DB = JSON.parse(local); return; } catch { /* rơi xuống mặc định */ } }
  DB = await defaultData();
}

async function defaultData() {
  const salt = uid();
  return {
    version: 1,
    settings: {
      teamName: 'Team Cầu Lông', defaultDues: 700000, shuttlesPerTube: 12, maxPerSession: 8, scheduleDays: [2, 4, 6],
      prices: { regularMale: 45000, regularFemale: 40000, guestMale: 50000, guestFemale: 45000 }, github: {},
    },
    members: [],
    users: [{ id: uid(), username: 'admin', name: 'Quản trị', role: 'admin', memberId: '', salt, hash: await hashPassword(salt, 'admin123') }],
    months: {},
  };
}

let syncTimer = null;
function save(msg, opts = {}) {
  DB.updatedAt = new Date().toISOString();
  DB.updatedBy = me ? me.username : '';
  store.set('bm.data', JSON.stringify(DB));
  store.set('bm.dirty', '1');
  if (msg) toast(msg);
  if (ghToken() && ghConfig()) { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(true), 2500); }
  if (!opts.quiet) scheduleRender();
  else renderSyncBadge();
}

let syncing = false;
async function syncNow(silent) {
  const g = ghConfig();
  const token = ghToken();
  if (!g || !token) { if (!silent) toast('Chưa cấu hình repo GitHub và token (Cài đặt → Đồng bộ)', true); return false; }
  if (syncing) return false;
  syncing = true; renderSyncBadge();
  try {
    const api = `https://api.github.com/repos/${g.repo}/contents/${g.path}`;
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
    let sha;
    const head = await fetch(`${api}?ref=${encodeURIComponent(g.branch)}&t=${Date.now()}`, { headers, cache: 'no-store' });
    if (head.ok) sha = (await head.json()).sha;
    else if (head.status !== 404) throw new Error(`GitHub trả lỗi ${head.status} khi đọc file`);
    const put = await fetch(api, {
      method: 'PUT', headers,
      body: JSON.stringify({ message: `Cập nhật dữ liệu (${me ? me.username : 'web'})`, content: b64utf8(JSON.stringify(DB, null, 2)), sha, branch: g.branch }),
    });
    if (!put.ok) throw new Error(put.status === 401 || put.status === 403 ? 'Token không có quyền ghi vào repo' : `GitHub từ chối (mã ${put.status})`);
    store.set('bm.dirty', '0');
    if (!silent) toast('Đã đồng bộ lên GitHub');
    return true;
  } catch (e) {
    toast(`Đồng bộ thất bại: ${e.message}`, true);
    return false;
  } finally {
    syncing = false; renderSyncBadge();
  }
}

/* ================= Tháng & tính toán ================= */
const memberMap = () => Object.fromEntries(DB.members.map((m) => [m.id, m]));
const monthKeys = () => Object.keys(DB.months).sort();
const fixedMembers = () => DB.members.filter((m) => m.type === 'fixed' && m.active !== false);
const regulars = () => DB.members.filter((m) => m.type === 'regular' && m.active !== false);
const priceRegular = (mem) => (mem && mem.gender === 'F' ? DB.settings.prices.regularFemale : DB.settings.prices.regularMale);
const priceGuest = (g) => (g === 'F' ? DB.settings.prices.guestFemale : DB.settings.prices.guestMale);

function scheduledDates(key) {
  const [y, m] = key.split('-').map(Number);
  const out = [];
  const days = new Date(y, m, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const dt = new Date(y, m - 1, d);
    if ((DB.settings.scheduleDays || []).includes(dt.getDay())) out.push(ymd(dt));
  }
  return out;
}
const newSession = (date) => ({ id: uid(), date, status: 'play', shuttles: 0, fixed: [], regulars: [], guests: [], passAmount: 0, note: '' });

function createMonth(key) {
  if (DB.months[key]) return;
  const prev = monthKeys().filter((k) => k < key).pop();
  const prevM = prev ? DB.months[prev] : null;
  const dues = {};
  fixedMembers().forEach((f) => { dues[f.id] = { expected: DB.settings.defaultDues, paid: 0, paidAt: '', note: '' }; });
  DB.months[key] = {
    courtFee: prevM ? prevM.courtFee : 0,
    openingShuttles: null, // null = tự lấy số tồn cuối tháng trước
    dues, purchases: [], expenses: [], settled: {},
    sessions: scheduledDates(key).map(newSession),
  };
}

function openingShuttles(key, depth = 0) {
  const M = DB.months[key];
  if (M.openingShuttles !== null && M.openingShuttles !== undefined && M.openingShuttles !== '') return num(M.openingShuttles);
  const prev = monthKeys().filter((k) => k < key).pop();
  if (!prev || depth > 36) return 0;
  return shuttleStock(prev, depth + 1).closing;
}
function shuttleStock(key, depth = 0) {
  const M = DB.months[key];
  const per = DB.settings.shuttlesPerTube || 12;
  const opening = openingShuttles(key, depth);
  const tubes = M.purchases.reduce((s, p) => s + num(p.tubes), 0);
  const bought = M.purchases.reduce((s, p) => s + num(p.tubes) * (num(p.perTube) || per), 0);
  const used = M.sessions.filter((s) => s.status === 'play').reduce((s, x) => s + num(x.shuttles), 0);
  return { opening, tubes, bought, used, available: opening + bought, closing: opening + bought - used };
}

function sessionCalc(s, byId) {
  let regular = 0; let guest = 0; let unpaid = 0; let collected = 0;
  const unpaidList = [];
  if (s.status === 'play') {
    s.regulars.forEach((r) => {
      const amt = num(r.amount);
      regular += amt;
      if (r.paid) collected += amt; else { unpaid += amt; unpaidList.push({ name: byId[r.memberId] ? byId[r.memberId].name : 'Đã xoá', amount: amt, kind: 'Vãng lai cố định' }); }
    });
    s.guests.forEach((g, i) => {
      const amt = num(g.amount);
      guest += amt;
      if (g.paid) collected += amt; else { unpaid += amt; unpaidList.push({ name: g.name || `Khách ${g.gender === 'F' ? 'nữ' : 'nam'} #${i + 1}`, amount: amt, kind: 'Vãng lai' }); }
    });
  }
  const pass = s.status === 'pass' ? num(s.passAmount) : 0;
  collected += pass;
  const head = s.status === 'play' ? s.fixed.length + s.regulars.length + s.guests.length : 0;
  return { regular, guest, pass, total: regular + guest + pass, unpaid, collected, unpaidList, head };
}

function calc(key) {
  const M = DB.months[key];
  const byId = memberMap();
  const sessions = M.sessions.slice().sort((a, b) => a.date.localeCompare(b.date));
  const att = {};
  const per = sessions.map((s) => {
    const c = sessionCalc(s, byId);
    if (s.status === 'play') [...s.fixed, ...s.regulars.map((r) => r.memberId)].forEach((id) => { att[id] = (att[id] || 0) + 1; });
    return { s, ...c };
  });
  const sum = (f) => per.reduce((a, x) => a + f(x), 0);
  const incRegular = sum((x) => x.regular);
  const incGuest = sum((x) => x.guest);
  const incPass = sum((x) => x.pass);
  const outside = incRegular + incGuest + incPass;
  const unpaid = sum((x) => x.unpaid);
  const court = num(M.courtFee);
  const shuttleCost = M.purchases.reduce((a, p) => a + num(p.amount), 0);
  const other = M.expenses.reduce((a, p) => a + num(p.amount), 0);
  const cost = court + shuttleCost + other;
  const burden = cost - outside;
  const ids = Object.keys(M.dues);
  const share = ids.length ? burden / ids.length : 0;
  const rows = ids.map((id) => {
    const d = M.dues[id];
    const paid = num(d.paid);
    const bought = M.purchases.filter((p) => p.buyer === id).reduce((a, p) => a + num(p.amount), 0);
    const spent = M.expenses.filter((p) => p.payer === id).reduce((a, p) => a + num(p.amount), 0);
    const contributed = paid + bought + spent;
    return { id, name: byId[id] ? byId[id].name : 'Đã xoá', expected: num(d.expected), paid, bought, spent, contributed, share, balance: contributed - share, attended: att[id] || 0, settled: !!(M.settled || {})[id] };
  });
  const duesPaid = rows.reduce((a, r) => a + r.paid, 0);
  const fundCost = court + M.purchases.filter((p) => !p.buyer || p.buyer === 'fund').reduce((a, p) => a + num(p.amount), 0)
    + M.expenses.filter((p) => !p.payer || p.payer === 'fund').reduce((a, p) => a + num(p.amount), 0);
  const collected = sum((x) => x.collected);
  return {
    key, M, sessions: per, att, incRegular, incGuest, incPass, outside, unpaid, court, shuttleCost, other, cost, burden, share, rows,
    duesPaid, duesExpected: rows.reduce((a, r) => a + r.expected, 0), fundCash: duesPaid + collected - fundCost, collected, fundCost,
    played: per.filter((x) => x.s.status === 'play' && x.head > 0).length,
    passed: per.filter((x) => x.s.status === 'pass').length,
    shuttle: shuttleStock(key),
    unpaidList: per.flatMap((x) => x.unpaidList.map((u) => ({ ...u, date: x.s.date }))),
  };
}

/* ================= Khung giao diện ================= */
let renderTimer = null;
function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 120); }

function toast(msg, err) {
  const el = document.createElement('div');
  el.className = `toast${err ? ' err' : ''}`;
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), err ? 4200 : 2200);
}

function confirmBox(title, text, okLabel = 'Xoá', danger = true) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>
      <div class="modal-actions"><button class="btn" data-r="0">Huỷ</button><button class="btn ${danger ? 'danger solid' : 'primary'}" data-r="1">${esc(okLabel)}</button></div></div>`;
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (b || e.target === wrap) { wrap.remove(); resolve(!!(b && b.dataset.r === '1')); }
    });
    document.body.appendChild(wrap);
    $('[data-r="1"]', wrap).focus();
  });
}
function promptBox(title, label, type = 'text') {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<form class="modal"><h2>${esc(title)}</h2><label class="field">${esc(label)}<input id="prompt-input" type="${type}" required></label>
      <div class="modal-actions"><button type="button" class="btn" data-r="0">Huỷ</button><button class="btn primary">Lưu</button></div></form>`;
    const form = $('form', wrap);
    form.addEventListener('submit', (e) => { e.preventDefault(); const v = $('#prompt-input', wrap).value; wrap.remove(); resolve(v); });
    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-r]') || e.target === wrap) { wrap.remove(); resolve(null); } });
    document.body.appendChild(wrap);
    $('#prompt-input', wrap).focus();
  });
}

function applyTheme() {
  const t = store.get('bm.theme');
  if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
}
function toggleTheme() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
    || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
  store.set('bm.theme', dark ? 'light' : 'dark');
  applyTheme(); render();
}

function renderLogin(err) {
  const root = $('#root');
  root.innerHTML = `<div class="login-wrap"><form class="login-card" id="login-form">
    <div class="brand" style="color:var(--court)">${SHUTTLE}<div><div class="brand-name">${esc(DB.settings.teamName)}</div><div class="brand-sub muted">Sổ thu chi sân cầu lông</div></div></div>
    <h1>Đăng nhập</h1>
    <label class="field">Tên đăng nhập<input id="login-user" autocomplete="username" required autofocus></label>
    <label class="field">Mật khẩu<input id="login-pass" type="password" autocomplete="current-password" required></label>
    ${err ? `<p class="neg small">${esc(err)}</p>` : ''}
    <button class="btn primary">Đăng nhập</button>
    ${DB.settings.showDemoHint ? '<p class="hint">Tài khoản mẫu: <b>admin / admin123</b> (quản trị), <b>tung / 123456</b> (thủ quỹ), <b>dat / 123456</b> (chỉ xem). Đổi mật khẩu trong Cài đặt sau khi đăng nhập.</p>' : ''}
  </form></div>`;
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = $('#login-user').value.trim().toLowerCase();
    const p = $('#login-pass').value;
    const user = DB.users.find((x) => x.username.toLowerCase() === u);
    if (!user || (await hashPassword(user.salt, p)) !== user.hash) { renderLogin('Sai tên đăng nhập hoặc mật khẩu'); $('#login-user').value = u; return; }
    me = user;
    store.set('bm.session', user.id);
    render();
  });
}

function renderSyncBadge() {
  const el = $('#sync-badge');
  if (!el) return;
  let txt; let cls;
  if (syncing) { txt = 'Đang đồng bộ…'; cls = 'cork'; }
  else if (!isDirty()) { txt = 'Đã đồng bộ'; cls = 'good'; }
  else if (ghToken() && ghConfig()) { txt = 'Chờ đồng bộ'; cls = 'cork'; }
  else { txt = 'Chỉ lưu trên máy này'; cls = 'bad'; }
  el.innerHTML = `<span class="pill ${cls}">${txt}</span>`;
}

function shell() {
  const keys = monthKeys();
  return `<div class="app">
    <aside class="side">
      <div class="brand">${SHUTTLE}<div><div class="brand-name">${esc(DB.settings.teamName)}</div><div class="brand-sub">Sổ thu chi sân cầu</div></div></div>
      <nav class="nav" aria-label="Điều hướng">${NAV.map(([k, l]) => `<a href="#${k}" class="${ui.route === k ? 'active' : ''}">${icon(k)}${l}</a>`).join('')}</nav>
      <div class="side-foot"><span>Lịch cố định: ${(DB.settings.scheduleDays || []).map((d) => DOW_FULL[d]).join(', ')}</span><span>Tối đa ${DB.settings.maxPerSession || 8} người/buổi</span></div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="month-picker">
          <button class="btn icon ghost" data-click="month-prev" aria-label="Tháng trước">${icon('chevL')}</button>
          <select id="month-select" data-change="month-select" aria-label="Chọn tháng">${keys.map((k) => `<option value="${k}" ${k === ui.month ? 'selected' : ''}>${monthLabel(k)}</option>`).join('')}</select>
          <button class="btn icon ghost" data-click="month-next" aria-label="Tháng sau">${icon('chevR')}</button>
        </div>
        ${can('edit') ? `<button class="btn sm" data-click="month-new">${icon('plus')}Tạo tháng</button>` : ''}
        <div class="spacer"></div>
        <a href="#settings" class="sync" id="sync-badge" title="Trạng thái lưu dữ liệu"></a>
        <button class="btn icon ghost" data-click="theme" aria-label="Đổi giao diện sáng/tối">${icon('moon')}</button>
        <div class="user-box"><div class="avatar">${esc((me.name || me.username).trim().split(/\s+/).pop()[0] || '?')}</div>
          <div class="who"><b>${esc(me.name || me.username)}</b><small>${ROLE_LABEL[me.role]}</small></div>
          <button class="btn icon ghost" data-click="logout" aria-label="Đăng xuất">${icon('logout')}</button></div>
      </header>
      <main class="content" id="view"></main>
    </div>
  </div>`;
}

function render() {
  clearTimeout(renderTimer);
  if (!me) { renderLogin(); return; }
  const active = document.activeElement;
  const focusId = active && active.id ? active.id : null;
  const caret = focusId && 'selectionStart' in active ? active.selectionStart : null;
  const scrollY = window.scrollY;
  const drawerScroll = $('.drawer') ? $('.drawer').scrollTop : 0;
  ui.charts.forEach((c) => c.destroy());
  ui.charts = [];
  const keys = monthKeys();
  if (!ui.month || !DB.months[ui.month]) ui.month = keys.includes(monthOf(new Date())) ? monthOf(new Date()) : keys[keys.length - 1] || null;
  $('#root').innerHTML = shell();
  renderSyncBadge();
  const view = $('#view');
  if (!ui.month && ui.route !== 'members' && ui.route !== 'settings') {
    view.innerHTML = `<div class="card empty"><h2>Chưa có tháng nào</h2><p>Bấm “Tạo tháng” để bắt đầu theo dõi.</p></div>`;
  } else {
    const fn = VIEWS[ui.route] || VIEWS.overview;
    view.innerHTML = fn();
    if (AFTER[ui.route]) AFTER[ui.route]();
  }
  if (ui.drawer) renderDrawer();
  window.scrollTo(0, scrollY);
  if ($('.drawer')) $('.drawer').scrollTop = drawerScroll;
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus({ preventScroll: true }); try { if (caret !== null && el.setSelectionRange) el.setSelectionRange(caret, caret); } catch { /* input số */ } }
  }
}

/* ================= Các trang ================= */
const kpi = (label, value, sub = '') => `<div class="kpi"><span class="kpi-label">${label}</span><span class="kpi-value">${value}</span>${sub ? `<span class="kpi-sub">${sub}</span>` : ''}</div>`;

function sessionCard(x, maxP) {
  const s = x.s;
  const d = parseDate(s.date);
  const future = s.date > todayStr() && x.head === 0 && s.status === 'play';
  const status = s.status === 'off' ? '<span class="pill">Nghỉ</span>' : s.status === 'pass' ? '<span class="pill cork">Pass sân</span>'
    : future ? '<span class="pill plain">Sắp tới</span>' : x.unpaid > 0 ? `<span class="pill bad">Còn nợ ${moneyShort(x.unpaid)}</span>` : x.head ? '<span class="pill good">Đã thu đủ</span>' : '<span class="pill plain">Chưa nhập</span>';
  const slots = Math.max(maxP, x.head);
  const bar = s.status === 'play' ? `<div class="court-bar" aria-label="${x.head}/${maxP} người">${Array.from({ length: slots }, (_, i) => {
    const cls = i >= maxP ? 'over' : i < s.fixed.length ? 'on' : i < x.head ? 'guest' : '';
    return `<span class="${cls}"></span>`;
  }).join('')}</div>` : '';
  return `<button class="session ${s.status === 'off' ? 'off' : ''} ${future ? 'future' : ''}" data-click="open-session" data-id="${s.id}">
    <div class="session-top"><div><div class="session-date">${dm(s.date)}</div><div class="session-dow">${DOW_FULL[d.getDay()]}</div></div>${status}</div>
    ${bar}
    <div class="session-stats">${s.status === 'pass' ? `<span>Thu pass <b>${money(x.pass)}</b></span>` : `<span><b>${x.head}</b> người</span><span><b>${num(s.shuttles)}</b> quả</span><span>Thu <b>${moneyShort(x.total)}</b></span>`}</div>
    ${s.note ? `<div class="session-note">${esc(s.note)}</div>` : ''}
  </button>`;
}

const VIEWS = {
  overview() {
    const C = calc(ui.month);
    const notPaid = C.rows.filter((r) => r.paid < r.expected);
    const recent = C.sessions.filter((x) => x.s.date <= todayStr() && x.s.status !== 'off').slice(-4).reverse();
    const n = C.rows.length;
    return `
    <div class="page-head"><div><h1>${monthLabel(ui.month)}</h1><p>Tổng hợp thu chi, quỹ và kho cầu của tháng.</p></div></div>
    <section class="hero">
      <div style="position:relative;z-index:1">
        <div class="eyebrow">Mỗi thành viên cố định gánh</div>
        <div class="big">${money(C.share)}</div>
        <div class="formula">(Chi ${money(C.cost)} − Thu ngoài ${money(C.outside)}) ÷ ${n} người</div>
      </div>
      <div class="hero-side"><span>Quỹ đang giữ</span><b>${money(C.fundCash)}</b>
        <span class="small">Đóng quỹ ${moneyShort(C.duesPaid)} + Đã thu ${moneyShort(C.collected)} − Đã chi ${moneyShort(C.fundCost)}</span>
        <span class="small">${C.played} buổi đã đánh · ${C.passed} buổi pass</span></div>
    </section>
    <div class="kpis">
      ${kpi('Tổng chi', money(C.cost), `Sân ${moneyShort(C.court)} · Cầu ${moneyShort(C.shuttleCost)} · Khác ${moneyShort(C.other)}`)}
      ${kpi('Thu ngoài', money(C.outside), `VL cố định ${moneyShort(C.incRegular)} · VL ${moneyShort(C.incGuest)} · Pass ${moneyShort(C.incPass)}`)}
      ${kpi('Quỹ đầu tháng', `${money(C.duesPaid)}`, `${C.rows.length - notPaid.length}/${C.rows.length} người đã đóng`)}
      ${kpi('Vãng lai chưa trả', money(C.unpaid), `${C.unpaidList.length} lượt`)}
      ${kpi('Cầu tồn', `${C.shuttle.closing} quả`, `Đầu tháng ${C.shuttle.opening} · mua ${C.shuttle.bought} · dùng ${C.shuttle.used}`)}
    </div>
    <div class="grid grid-3">
      <div class="card"><div class="card-head"><h2>Đóng quỹ đầu tháng</h2><a href="#ledger" class="small">Sửa</a></div>
        <div class="list">${C.rows.map((r) => `<div class="list-row"><span>${esc(r.name)}</span>${r.paid >= r.expected && r.expected > 0 ? `<span class="pill good">${money(r.paid)}</span>` : r.paid > 0 ? `<span class="pill cork">${money(r.paid)} / ${moneyShort(r.expected)}</span>` : '<span class="pill bad">Chưa đóng</span>'}</div>`).join('') || '<div class="empty">Chưa có thành viên cố định</div>'}</div></div>
      <div class="card"><div class="card-head"><h2>Vãng lai chưa trả</h2><a href="#sessions" class="small">Xem buổi</a></div>
        <div class="list">${C.unpaidList.map((u) => `<div class="list-row"><span>${esc(u.name)}<br><span class="muted small">${dmy(u.date)} · ${u.kind}</span></span><span class="neg">${money(u.amount)}</span></div>`).join('') || '<div class="empty">Không ai nợ. Tốt!</div>'}</div></div>
      <div class="card"><div class="card-head"><h2>Hoàn / thu thêm</h2><a href="#settle" class="small">Quyết toán</a></div>
        <div class="list">${C.rows.map((r) => `<div class="list-row"><span>${esc(r.name)}</span><span class="${r.balance >= 0 ? 'pos' : 'neg'}">${signed(r.balance)}</span></div>`).join('') || '<div class="empty">—</div>'}</div>
        <p class="muted small" style="margin-top:8px">Dương là được hoàn lại, âm là cần đóng thêm.</p></div>
    </div>
    <div class="card"><div class="card-head"><h2>Buổi gần đây</h2><a href="#sessions" class="small">Tất cả buổi</a></div>
      <div class="sessions">${recent.map((x) => sessionCard(x, DB.settings.maxPerSession || 8)).join('') || '<div class="empty">Chưa có buổi nào</div>'}</div></div>`;
  },

  sessions() {
    const C = calc(ui.month);
    const totalUsed = C.shuttle.used;
    return `
    <div class="page-head"><div><h1>Buổi đánh</h1><p>Bấm vào một buổi để điểm danh, nhập số cầu và đánh dấu ai đã chuyển khoản.</p></div>
      ${can('edit') ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><input type="date" id="new-session-date" value="${todayStr().startsWith(ui.month) ? todayStr() : `${ui.month}-01`}" style="width:auto"><button class="btn primary" data-click="add-session">${icon('plus')}Thêm buổi</button></div>` : ''}</div>
    <div class="kpis">
      ${kpi('Buổi đã đánh', C.played, `${C.sessions.length} buổi trong lịch`)}
      ${kpi('Cầu đã dùng', `${totalUsed} quả`, `Còn ${C.shuttle.closing} quả`)}
      ${kpi('Thu từ các buổi', money(C.outside))}
      ${kpi('Chưa thu', money(C.unpaid), C.unpaid ? 'Xem buổi có nhãn đỏ' : 'Đã thu đủ')}
    </div>
    <div class="legend"><span><i style="background:var(--court)"></i>Thành viên cố định</span><span><i style="background:var(--cork)"></i>Vãng lai</span><span><i style="background:var(--bad)"></i>Quá ${DB.settings.maxPerSession || 8} người</span></div>
    <div class="sessions">${C.sessions.map((x) => sessionCard(x, DB.settings.maxPerSession || 8)).join('') || '<div class="empty">Tháng này chưa có buổi nào</div>'}</div>`;
  },

  ledger() {
    const C = calc(ui.month);
    const M = C.M;
    const byId = memberMap();
    const payerOpts = (sel) => `<option value="fund" ${!sel || sel === 'fund' ? 'selected' : ''}>Quỹ team</option>${DB.members.filter((m) => m.type === 'fixed').map((m) => `<option value="${m.id}" ${sel === m.id ? 'selected' : ''}>${esc(m.name)} (tự chi)</option>`).join('')}`;
    const missing = fixedMembers().filter((f) => !M.dues[f.id]);
    const st = C.shuttle;
    const paidCount = C.rows.filter((r) => r.paid >= r.expected && r.expected > 0).length;
    return `
    <div class="page-head"><div><h1>Thu chi ${monthLabel(ui.month).toLowerCase()}</h1><p>Nhập tiền sân đầu tháng, ai đã đóng quỹ, các lần mua cầu và chi phí khác.</p></div></div>
    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><h2>Tiền sân tháng</h2><p>Mỗi tháng một giá, nhập vào đầu tháng.</p></div></div>
        <div class="form-row"><label class="field">Tổng tiền sân (đ)<input id="court-fee" type="number" step="1000" min="0" value="${num(M.courtFee)}" data-change="court-fee" ${dis()}></label>
        <div class="muted small">${C.sessions.filter((x) => x.s.status !== 'off').length} buổi có lịch · ≈ ${money(C.sessions.length ? num(M.courtFee) / Math.max(1, C.sessions.filter((x) => x.s.status !== 'off').length) : 0)}/buổi</div></div>
      </div>
      <div class="card">
        <div class="card-head"><div><h2>Kho cầu</h2><p>Tồn đầu tháng tự lấy từ cuối tháng trước, có thể sửa tay.</p></div></div>
        <div class="form-row">
          <label class="field">Tồn đầu tháng (quả)<input id="opening-shuttles" type="number" min="0" placeholder="Tự động: ${st.opening}" value="${M.openingShuttles ?? ''}" data-change="opening" ${dis()}></label>
          <div class="small"><div>Mua thêm: <b>${st.tubes} ống · ${st.bought} quả</b></div><div>Đã dùng: <b>${st.used} quả</b></div><div>Tồn cuối tháng: <b class="${st.closing < 0 ? 'neg' : ''}">${st.closing} quả</b>${st.closing < 0 ? ' (thiếu, cần nhập lần mua cầu)' : ''}</div></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Đóng quỹ đầu tháng</h2><p>${paidCount}/${C.rows.length} người đã đóng đủ · Đã thu ${money(C.duesPaid)} / ${money(C.duesExpected)}</p></div>
        ${can('edit') && missing.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${missing.map((m) => `<button class="btn sm" data-click="dues-add" data-id="${m.id}">${icon('plus')}${esc(m.name)}</button>`).join('')}</div>` : ''}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Thành viên</th><th class="r">Phải đóng</th><th class="r">Đã đóng</th><th>Đủ</th><th>Ngày đóng</th><th>Ghi chú</th>${can('edit') ? '<th></th>' : ''}</tr></thead>
        <tbody>${C.rows.map((r) => {
          const d = M.dues[r.id];
          return `<tr><td><b>${esc(r.name)}</b></td>
            <td class="r"><input id="due-exp-${r.id}" type="number" step="1000" min="0" value="${r.expected}" data-change="due-expected" data-id="${r.id}" style="width:120px;text-align:right" ${dis()}></td>
            <td class="r"><input id="due-paid-${r.id}" type="number" step="1000" min="0" value="${r.paid}" data-change="due-paid" data-id="${r.id}" style="width:120px;text-align:right" ${dis()}></td>
            <td><input id="due-ok-${r.id}" type="checkbox" ${r.paid >= r.expected && r.expected > 0 ? 'checked' : ''} data-change="due-tick" data-id="${r.id}" aria-label="Đã đóng đủ" ${dis()}></td>
            <td><input id="due-date-${r.id}" type="date" value="${d.paidAt || ''}" data-change="due-date" data-id="${r.id}" style="width:150px" ${dis()}></td>
            <td><input id="due-note-${r.id}" value="${esc(d.note)}" data-change="due-note" data-id="${r.id}" placeholder="VD: đóng 1tr vì mua cầu" ${dis()}></td>
            ${can('edit') ? `<td><button class="btn icon ghost danger" data-click="dues-remove" data-id="${r.id}" aria-label="Bỏ khỏi tháng">${icon('x')}</button></td>` : ''}</tr>`;
        }).join('') || `<tr><td colspan="7" class="empty">Chưa có thành viên cố định trong tháng</td></tr>`}</tbody>
      </table></div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Mua cầu</h2><p>Tính chi phí theo tiền thực trả. Nếu thành viên tự bỏ tiền mua, chọn tên họ để được tính vào phần đã góp.</p></div><span class="pill court plain">${money(C.shuttleCost)}</span></div>
      ${can('edit') ? `<form class="form-row" data-submit="add-purchase" style="margin-bottom:14px">
        <label class="field">Ngày<input id="pur-date" name="date" type="date" value="${todayStr().startsWith(ui.month) ? todayStr() : `${ui.month}-01`}" required></label>
        <label class="field">Số ống<input id="pur-tubes" name="tubes" type="number" min="1" value="1" required></label>
        <label class="field">Quả / ống<input id="pur-per" name="perTube" type="number" min="1" value="${DB.settings.shuttlesPerTube || 12}"></label>
        <label class="field">Tiền thực trả (đ)<input id="pur-amount" name="amount" type="number" step="1000" min="0" required></label>
        <label class="field">Ai trả<select id="pur-buyer" name="buyer">${payerOpts()}</select></label>
        <label class="field">Ghi chú<input id="pur-note" name="note" placeholder="Loại cầu, nơi mua…"></label>
        <button class="btn primary">${icon('plus')}Thêm</button></form>` : ''}
      <div class="table-wrap"><table><thead><tr><th>Ngày</th><th class="r">Số ống</th><th class="r">Số quả</th><th class="r">Tiền</th><th>Ai trả</th><th>Ghi chú</th>${can('edit') ? '<th></th>' : ''}</tr></thead>
        <tbody>${M.purchases.slice().sort((a, b) => a.date.localeCompare(b.date)).map((p) => `<tr><td>${dmy(p.date)}</td><td class="r">${num(p.tubes)}</td><td class="r">${num(p.tubes) * (num(p.perTube) || DB.settings.shuttlesPerTube || 12)}</td><td class="r">${money(p.amount)}</td>
          <td>${!p.buyer || p.buyer === 'fund' ? '<span class="pill plain">Quỹ team</span>' : `<span class="pill cork plain">${esc(byId[p.buyer] ? byId[p.buyer].name : 'Đã xoá')}</span>`}</td><td>${esc(p.note)}</td>
          ${can('edit') ? `<td><button class="btn icon ghost danger" data-click="del-purchase" data-id="${p.id}" aria-label="Xoá">${icon('trash')}</button></td>` : ''}</tr>`).join('') || '<tr><td colspan="7" class="empty">Chưa mua cầu trong tháng</td></tr>'}</tbody></table></div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Chi phí khác</h2><p>Nước, thuê thêm giờ, phạt hỏng vợt… (nếu có).</p></div><span class="pill court plain">${money(C.other)}</span></div>
      ${can('edit') ? `<form class="form-row" data-submit="add-expense" style="margin-bottom:14px">
        <label class="field">Ngày<input id="exp-date" name="date" type="date" value="${todayStr().startsWith(ui.month) ? todayStr() : `${ui.month}-01`}" required></label>
        <label class="field">Nội dung<input id="exp-desc" name="desc" required placeholder="VD: Nước uống"></label>
        <label class="field">Số tiền (đ)<input id="exp-amount" name="amount" type="number" step="1000" min="0" required></label>
        <label class="field">Ai trả<select id="exp-payer" name="payer">${payerOpts()}</select></label>
        <button class="btn primary">${icon('plus')}Thêm</button></form>` : ''}
      <div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Nội dung</th><th class="r">Tiền</th><th>Ai trả</th>${can('edit') ? '<th></th>' : ''}</tr></thead>
        <tbody>${M.expenses.slice().sort((a, b) => a.date.localeCompare(b.date)).map((p) => `<tr><td>${dmy(p.date)}</td><td>${esc(p.desc)}</td><td class="r">${money(p.amount)}</td>
          <td>${!p.payer || p.payer === 'fund' ? '<span class="pill plain">Quỹ team</span>' : `<span class="pill cork plain">${esc(byId[p.payer] ? byId[p.payer].name : 'Đã xoá')}</span>`}</td>
          ${can('edit') ? `<td><button class="btn icon ghost danger" data-click="del-expense" data-id="${p.id}" aria-label="Xoá">${icon('trash')}</button></td>` : ''}</tr>`).join('') || '<tr><td colspan="5" class="empty">Không có chi phí khác</td></tr>'}</tbody></table></div>
    </div>`;
  },

  settle() {
    const C = calc(ui.month);
    const total = C.rows.reduce((a, r) => a + r.balance, 0);
    return `
    <div class="page-head"><div><h1>Quyết toán ${monthLabel(ui.month).toLowerCase()}</h1><p>Chi phí trừ phần thu từ vãng lai và pass sân, còn lại chia đều cho thành viên cố định. Ai góp nhiều hơn phần của mình được hoàn lại phần dư.</p></div></div>
    <div class="grid grid-2">
      <div class="formula-box">
        <div class="eq"><span>Tiền sân</span><b>${money(C.court)}</b></div>
        <div class="eq"><span>+ Tiền mua cầu</span><b>${money(C.shuttleCost)}</b></div>
        <div class="eq"><span>+ Chi phí khác</span><b>${money(C.other)}</b></div>
        <div class="eq"><span>− Thu vãng lai cố định</span><b>${money(C.incRegular)}</b></div>
        <div class="eq"><span>− Thu vãng lai</span><b>${money(C.incGuest)}</b></div>
        <div class="eq"><span>− Thu pass sân</span><b>${money(C.incPass)}</b></div>
        <div class="eq total"><span>Phần thành viên cố định gánh chung</span><b>${money(C.burden)}</b></div>
        <div class="eq total"><span>Mỗi người (÷ ${C.rows.length})</span><b>${money(C.share)}</b></div>
      </div>
      <div class="formula-box">
        <div class="eq"><span>Tổng thành viên đã góp</span><b>${money(C.rows.reduce((a, r) => a + r.contributed, 0))}</b></div>
        <div class="eq"><span>Tổng cần hoàn (+) / thu thêm (−)</span><b class="${total >= 0 ? 'pos' : 'neg'}">${signed(total)}</b></div>
        <div class="eq"><span>Thành viên đã đóng quỹ</span><b>${money(C.duesPaid)}</b></div>
        <div class="eq"><span>+ Đã thu thực tế từ các buổi (chưa tính người còn nợ)</span><b>${money(C.collected)}</b></div>
        <div class="eq"><span>− Đã chi từ quỹ (tiền sân cả tháng, cầu và chi khác do quỹ trả)</span><b>${money(C.fundCost)}</b></div>
        <div class="eq total"><span>Quỹ đang giữ (tiền mặt)</span><b>${money(C.fundCash)}</b></div>
        <div class="eq"><span>Vãng lai chưa trả</span><b class="${C.unpaid ? 'neg' : ''}">${money(C.unpaid)}</b></div>
        <p class="muted small">Quỹ đang giữ + tiền vãng lai còn nợ = tổng cần hoàn. ${C.unpaid ? 'Nên thu đủ tiền vãng lai trước khi hoàn.' : 'Đã thu đủ, có thể hoàn.'}</p>
      </div>
    </div>
    <div class="card"><div class="card-head"><h2>Từng thành viên cố định</h2><p>Đánh dấu khi đã chuyển hoàn hoặc đã thu thêm.</p></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Thành viên</th><th class="r">Số buổi</th><th class="r">Đóng quỹ</th><th class="r">Tự chi hộ</th><th class="r">Tổng góp</th><th class="r">Phải gánh</th><th class="r">Hoàn (+) / Thu thêm (−)</th><th>Xong</th></tr></thead>
        <tbody>${C.rows.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td class="r">${r.attended}</td><td class="r">${money(r.paid)}</td><td class="r">${money(r.bought + r.spent)}</td><td class="r">${money(r.contributed)}</td><td class="r">${money(r.share)}</td>
          <td class="r ${r.balance >= 0 ? 'pos' : 'neg'}">${signed(r.balance)}</td>
          <td><input id="settle-${r.id}" type="checkbox" ${r.settled ? 'checked' : ''} data-change="settle-tick" data-id="${r.id}" aria-label="Đã xong" ${dis()}></td></tr>`).join('')}</tbody>
      </table></div></div>`;
  },

  stats() {
    const keys = monthKeys();
    const all = keys.map((k) => calc(k));
    const cum = {};
    all.forEach((c) => c.rows.forEach((r) => {
      const o = cum[r.id] || (cum[r.id] = { name: r.name, contributed: 0, share: 0, balance: 0, attended: 0, months: 0 });
      o.contributed += r.contributed; o.share += r.share; o.balance += r.balance; o.attended += r.attended; o.months += 1;
    }));
    return `
    <div class="page-head"><div><h1>Thống kê</h1><p>Tiền góp, phần gánh và tiền hoàn của từng thành viên cố định; thu chi qua các tháng.</p></div></div>
    <div class="grid grid-2">
      <div class="card"><div class="card-head"><div><h2>Góp và gánh · ${monthLabel(ui.month)}</h2><p>Cột góp cao hơn cột gánh là được hoàn.</p></div>
        <div class="legend"><span><i style="background:var(--chart-1)"></i>Tổng góp</span><span><i style="background:var(--chart-2)"></i>Phải gánh</span></div></div>
        <div class="chart-box"><canvas id="ch-member" aria-label="Biểu đồ góp và gánh theo thành viên"></canvas></div></div>
      <div class="card"><div class="card-head"><div><h2>Hoàn / thu thêm · ${monthLabel(ui.month)}</h2><p>Trên 0 là được hoàn, dưới 0 là cần đóng thêm.</p></div>
        <div class="legend"><span><i style="background:var(--good)"></i>Được hoàn</span><span><i style="background:var(--bad)"></i>Đóng thêm</span></div></div>
        <div class="chart-box"><canvas id="ch-balance" aria-label="Biểu đồ hoàn tiền"></canvas></div></div>
      <div class="card"><div class="card-head"><div><h2>Thu chi qua các tháng</h2><p>Chi gồm sân, cầu và chi khác; thu ngoài gồm vãng lai và pass sân.</p></div>
        <div class="legend"><span><i style="background:var(--chart-2)"></i>Tổng chi</span><span><i style="background:var(--chart-1)"></i>Thu ngoài</span></div></div>
        <div class="chart-box"><canvas id="ch-months" aria-label="Biểu đồ thu chi theo tháng"></canvas></div></div>
      <div class="card"><div class="card-head"><div><h2>Số quả cầu mỗi buổi · ${monthLabel(ui.month)}</h2><p>Chỉ tính các buổi có đánh.</p></div></div>
        <div class="chart-box"><canvas id="ch-shuttle" aria-label="Biểu đồ số cầu mỗi buổi"></canvas></div></div>
      <div class="card"><div class="card-head"><div><h2>Số buổi tham gia · ${monthLabel(ui.month)}</h2></div>
        <div class="legend"><span><i style="background:var(--chart-1)"></i>Cố định</span><span><i style="background:var(--chart-2)"></i>Vãng lai cố định</span></div></div>
        <div class="chart-box"><canvas id="ch-att" aria-label="Biểu đồ số buổi tham gia"></canvas></div></div>
      <div class="card"><div class="card-head"><div><h2>Luỹ kế tất cả các tháng</h2><p>${keys.length} tháng có dữ liệu.</p></div></div>
        <div class="table-wrap"><table><thead><tr><th>Thành viên</th><th class="r">Buổi</th><th class="r">Tổng góp</th><th class="r">Tổng gánh</th><th class="r">Hoàn / thu</th></tr></thead>
        <tbody>${Object.values(cum).map((o) => `<tr><td><b>${esc(o.name)}</b><br><span class="muted small">${o.months} tháng</span></td><td class="r">${o.attended}</td><td class="r">${money(o.contributed)}</td><td class="r">${money(o.share)}</td><td class="r ${o.balance >= 0 ? 'pos' : 'neg'}">${signed(o.balance)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Chưa có dữ liệu</td></tr>'}</tbody></table></div></div>
    </div>`;
  },

  members() {
    const row = (m) => `<tr>
      <td><input id="mem-name-${m.id}" value="${esc(m.name)}" data-change="mem-name" data-id="${m.id}" ${dis()}></td>
      <td><select id="mem-gender-${m.id}" data-change="mem-gender" data-id="${m.id}" ${dis()}><option value="M" ${m.gender !== 'F' ? 'selected' : ''}>Nam</option><option value="F" ${m.gender === 'F' ? 'selected' : ''}>Nữ</option></select></td>
      <td><input id="mem-phone-${m.id}" value="${esc(m.phone)}" data-change="mem-phone" data-id="${m.id}" placeholder="SĐT / STK" ${dis()}></td>
      <td>${m.type === 'regular' ? `<span class="small muted">${money(priceRegular(m))}/buổi</span>` : ''}</td>
      <td>${m.active === false ? '<span class="pill">Ngừng</span>' : '<span class="pill good">Đang chơi</span>'}</td>
      ${can('edit') ? `<td style="white-space:nowrap"><button class="btn sm" data-click="mem-active" data-id="${m.id}">${m.active === false ? 'Kích hoạt' : 'Ngừng'}</button>
      <button class="btn icon ghost danger" data-click="mem-del" data-id="${m.id}" aria-label="Xoá">${icon('trash')}</button></td>` : ''}</tr>`;
    const table = (type, title, desc) => {
      const list = DB.members.filter((m) => m.type === type);
      return `<div class="card"><div class="card-head"><div><h2>${title}</h2><p>${desc}</p></div><span class="pill court plain">${list.filter((m) => m.active !== false).length} người</span></div>
      ${can('edit') ? `<form class="form-row" data-submit="add-member" data-type="${type}" style="margin-bottom:14px">
        <label class="field">Tên<input id="new-${type}-name" name="name" required></label>
        <label class="field">Giới tính<select id="new-${type}-gender" name="gender"><option value="M">Nam</option><option value="F">Nữ</option></select></label>
        <label class="field">SĐT / STK<input id="new-${type}-phone" name="phone"></label>
        <button class="btn primary">${icon('plus')}Thêm</button></form>` : ''}
      <div class="table-wrap"><table><thead><tr><th>Tên</th><th>Giới tính</th><th>Liên hệ</th><th>${type === 'regular' ? 'Đơn giá' : ''}</th><th>Trạng thái</th>${can('edit') ? '<th></th>' : ''}</tr></thead>
      <tbody>${list.map(row).join('') || '<tr><td colspan="6" class="empty">Chưa có ai</td></tr>'}</tbody></table></div></div>`;
    };
    return `<div class="page-head"><div><h1>Thành viên</h1><p>Thành viên cố định chia tiền cuối tháng; vãng lai cố định trả theo buổi với giá riêng.</p></div></div>
      ${table('fixed', 'Thành viên cố định', `Đóng quỹ đầu tháng (mặc định ${money(DB.settings.defaultDues)}), cuối tháng được hoàn hoặc đóng thêm.`)}
      ${table('regular', 'Vãng lai cố định', `Nam ${money(DB.settings.prices.regularMale)}, nữ ${money(DB.settings.prices.regularFemale)} mỗi buổi.`)}`;
  },

  settings() {
    const s = DB.settings;
    const g = ghConfig();
    return `<div class="page-head"><div><h1>Cài đặt</h1><p>Đơn giá, lịch đánh, tài khoản và nơi lưu dữ liệu.</p></div></div>
    <div class="grid grid-2">
      <div class="card"><div class="card-head"><h2>Đơn giá & lịch</h2>${can('admin') ? '' : '<span class="pill plain">Chỉ quản trị sửa</span>'}</div>
        <div class="grid" style="gap:12px">
          <label class="field">Tên team<input id="set-team" value="${esc(s.teamName)}" data-change="set" data-key="teamName" ${dis('admin')}></label>
          <div class="form-row">
            <label class="field">VL cố định · Nam<input id="set-rm" type="number" step="1000" value="${s.prices.regularMale}" data-change="set-price" data-key="regularMale" ${dis('admin')}></label>
            <label class="field">VL cố định · Nữ<input id="set-rf" type="number" step="1000" value="${s.prices.regularFemale}" data-change="set-price" data-key="regularFemale" ${dis('admin')}></label>
            <label class="field">Vãng lai · Nam<input id="set-gm" type="number" step="1000" value="${s.prices.guestMale}" data-change="set-price" data-key="guestMale" ${dis('admin')}></label>
            <label class="field">Vãng lai · Nữ<input id="set-gf" type="number" step="1000" value="${s.prices.guestFemale}" data-change="set-price" data-key="guestFemale" ${dis('admin')}></label>
          </div>
          <div class="form-row">
            <label class="field">Quỹ đầu tháng mặc định<input id="set-dues" type="number" step="10000" value="${s.defaultDues}" data-change="set-num" data-key="defaultDues" ${dis('admin')}></label>
            <label class="field">Số quả / ống<input id="set-per" type="number" value="${s.shuttlesPerTube}" data-change="set-num" data-key="shuttlesPerTube" ${dis('admin')}></label>
            <label class="field">Tối đa người / buổi<input id="set-max" type="number" value="${s.maxPerSession}" data-change="set-num" data-key="maxPerSession" ${dis('admin')}></label>
          </div>
          <div class="field">Ngày đánh cố định (dùng khi tạo tháng mới)
            <div class="chips">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="chip ${(s.scheduleDays || []).includes(d) ? 'on' : ''}" data-click="set-day" data-day="${d}" ${dis('admin')}>${DOW_FULL[d]}</button>`).join('')}</div></div>
          <p class="muted small">Mỗi lượt điểm danh lưu số tiền tại lúc nhập, nên đổi giá không làm thay đổi các buổi cũ. Muốn tính lại cả tháng theo giá mới thì bấm nút dưới.</p>
          ${can('admin') && ui.month ? `<div><button class="btn sm" data-click="reprice">Áp giá hiện tại cho mọi buổi ${monthLabel(ui.month).toLowerCase()}</button></div>` : ''}
        </div></div>

      <div class="card" id="sync"><div class="card-head"><div><h2>Lưu & đồng bộ dữ liệu</h2><p>Dữ liệu chung nằm ở file <code>data.json</code> trong repo GitHub. Người sửa cần token GitHub để lưu lên; người xem không cần.</p></div></div>
        <div class="grid" style="gap:12px">
          <div class="form-row">
            <label class="field">Repo (chủ/tên)<input id="gh-repo" value="${esc((s.github && s.github.repo) || '')}" placeholder="${esc(g ? g.repo : 'thienle98/badminton')}" data-change="gh-repo" ${dis('admin')}></label>
            <label class="field">Nhánh<input id="gh-branch" value="${esc((s.github && s.github.branch) || '')}" placeholder="main" data-change="gh-branch" ${dis('admin')}></label>
          </div>
          ${can('edit') ? `<label class="field">Token GitHub (chỉ lưu trên trình duyệt này)<input id="gh-token" type="password" value="${esc(ghToken())}" placeholder="github_pat_…" data-change="gh-token" autocomplete="off"></label>
          <p class="muted small">Tạo token loại “Fine-grained”, chỉ chọn repo này, quyền <b>Contents: Read and write</b>.</p>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${can('edit') ? `<button class="btn primary" data-click="sync">${icon('sync')}Đồng bộ lên GitHub</button>` : ''}
            <button class="btn" data-click="reload-remote">Tải lại dữ liệu mới nhất</button>
            <button class="btn" data-click="export">Tải file sao lưu</button>
            ${can('admin') ? `<label class="btn" for="import-file">Nhập file sao lưu</label><input id="import-file" type="file" accept=".json,application/json" data-change="import" hidden>` : ''}
          </div>
          <p class="muted small">Lần cập nhật cuối: ${DB.updatedAt ? new Date(DB.updatedAt).toLocaleString('vi-VN') : '—'}${DB.updatedBy ? ` bởi ${esc(DB.updatedBy)}` : ''}.</p>
        </div></div>

      <div class="card"><div class="card-head"><h2>Đổi mật khẩu của tôi</h2></div>
        <form class="form-row" data-submit="change-pass">
          <label class="field">Mật khẩu hiện tại<input id="pw-old" name="old" type="password" required autocomplete="current-password"></label>
          <label class="field">Mật khẩu mới<input id="pw-new" name="new" type="password" required minlength="6" autocomplete="new-password"></label>
          <button class="btn primary">Đổi mật khẩu</button></form></div>

      ${can('admin') ? `<div class="card"><div class="card-head"><div><h2>Tài khoản & phân quyền</h2><p>Quản trị: toàn quyền. Thủ quỹ: nhập buổi đánh và thu chi. Thành viên: chỉ xem.</p></div></div>
        <form class="form-row" data-submit="add-user" style="margin-bottom:14px">
          <label class="field">Tên đăng nhập<input id="nu-username" name="username" required pattern="[a-zA-Z0-9_.]+"></label>
          <label class="field">Tên hiển thị<input id="nu-name" name="name" required></label>
          <label class="field">Quyền<select id="nu-role" name="role"><option value="viewer">Thành viên</option><option value="editor">Thủ quỹ</option><option value="admin">Quản trị</option></select></label>
          <label class="field">Mật khẩu<input id="nu-pass" name="password" type="password" required minlength="6" autocomplete="new-password"></label>
          <button class="btn primary">${icon('plus')}Thêm</button></form>
        <div class="table-wrap"><table><thead><tr><th>Tài khoản</th><th>Quyền</th><th>Gắn với</th><th></th></tr></thead><tbody>
        ${DB.users.map((u) => `<tr><td><b>${esc(u.username)}</b><br><span class="muted small">${esc(u.name)}</span></td>
          <td><select id="u-role-${u.id}" data-change="user-role" data-id="${u.id}" ${u.id === me.id ? 'disabled' : ''}>${Object.entries(ROLE_LABEL).map(([k, l]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
          <td><select id="u-mem-${u.id}" data-change="user-member" data-id="${u.id}"><option value="">—</option>${DB.members.map((m) => `<option value="${m.id}" ${u.memberId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></td>
          <td style="white-space:nowrap"><button class="btn sm" data-click="user-reset" data-id="${u.id}">Đặt lại mật khẩu</button>
          ${u.id !== me.id ? `<button class="btn icon ghost danger" data-click="user-del" data-id="${u.id}" aria-label="Xoá tài khoản">${icon('trash')}</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="muted small" style="margin-top:10px">Đăng nhập kiểm tra trên trình duyệt, mật khẩu được băm SHA-256. Đủ để phân vai trong team, nhưng không phải bảo mật thật vì dữ liệu nằm công khai trong repo.</p></div>` : ''}
    </div>`;
  },
};

/* ================= Biểu đồ ================= */
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function makeChart(id, config) {
  const el = document.getElementById(id);
  if (!el || !window.Chart) return;
  const fg = cssVar('--muted');
  const grid = cssVar('--line');
  Chart.defaults.font.family = cssVar('--font-body');
  Chart.defaults.color = fg;
  const base = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: cssVar('--fg'), titleColor: cssVar('--bg'), bodyColor: cssVar('--bg'), padding: 10, cornerRadius: 8,
      callbacks: { label: (c) => ` ${c.dataset.label ? `${c.dataset.label}: ` : ''}${config.unit === 'qua' ? `${c.parsed.y ?? c.parsed.x} quả` : config.unit === 'buoi' ? `${c.parsed.x} buổi` : money(c.parsed.y)}` } } },
    scales: {
      x: { grid: { display: false }, border: { color: grid }, ticks: { color: fg } },
      y: { grid: { color: grid }, border: { display: false }, ticks: { color: fg, callback: (v) => (config.unit ? v : moneyShort(v)) } },
    },
  };
  if (config.horizontal) {
    base.indexAxis = 'y';
    base.scales = { x: { grid: { color: grid }, border: { display: false }, ticks: { color: fg, precision: 0 } }, y: { grid: { display: false }, ticks: { color: fg } } };
  }
  ui.charts.push(new Chart(el, { type: 'bar', data: config.data, options: base }));
}
const barDefaults = { borderRadius: 4, borderSkipped: 'start', maxBarThickness: 34, categoryPercentage: 0.7, barPercentage: 0.9 };

const AFTER = {
  stats() {
    const C = calc(ui.month);
    makeChart('ch-member', { data: { labels: C.rows.map((r) => r.name), datasets: [
      { label: 'Tổng góp', data: C.rows.map((r) => r.contributed), backgroundColor: cssVar('--chart-1'), ...barDefaults },
      { label: 'Phải gánh', data: C.rows.map((r) => Math.round(r.share)), backgroundColor: cssVar('--chart-2'), ...barDefaults },
    ] } });
    makeChart('ch-balance', { data: { labels: C.rows.map((r) => r.name), datasets: [
      { label: 'Hoàn / thu', data: C.rows.map((r) => Math.round(r.balance)), backgroundColor: C.rows.map((r) => (r.balance >= 0 ? cssVar('--good') : cssVar('--bad'))), ...barDefaults, borderSkipped: false },
    ] } });
    const all = monthKeys().map((k) => calc(k));
    makeChart('ch-months', { data: { labels: all.map((c) => monthLabel(c.key).replace('Tháng ', 'T')), datasets: [
      { label: 'Tổng chi', data: all.map((c) => c.cost), backgroundColor: cssVar('--chart-2'), ...barDefaults },
      { label: 'Thu ngoài', data: all.map((c) => c.outside), backgroundColor: cssVar('--chart-1'), ...barDefaults },
    ] } });
    const played = C.sessions.filter((x) => x.s.status === 'play' && num(x.s.shuttles) > 0);
    makeChart('ch-shuttle', { unit: 'qua', data: { labels: played.map((x) => dm(x.s.date)), datasets: [
      { label: 'Số quả', data: played.map((x) => num(x.s.shuttles)), backgroundColor: cssVar('--chart-1'), ...barDefaults },
    ] } });
    const people = DB.members.filter((m) => C.att[m.id]).sort((a, b) => (a.type === b.type ? C.att[b.id] - C.att[a.id] : a.type === 'fixed' ? -1 : 1));
    makeChart('ch-att', { unit: 'buoi', horizontal: true, data: { labels: people.map((m) => m.name), datasets: [
      { label: 'Số buổi', data: people.map((m) => C.att[m.id]), backgroundColor: people.map((m) => (m.type === 'fixed' ? cssVar('--chart-1') : cssVar('--chart-2'))), ...barDefaults },
    ] } });
  },
};

/* ================= Ngăn kéo buổi đánh ================= */
function findSession(id) { return DB.months[ui.month] ? DB.months[ui.month].sessions.find((s) => s.id === id) : null; }

function renderDrawer() {
  const s = findSession(ui.drawer);
  let host = $('#drawer-host');
  if (!s) { ui.drawer = null; if (host) host.remove(); return; }
  if (!host) { host = document.createElement('div'); host.id = 'drawer-host'; document.body.appendChild(host); }
  const byId = memberMap();
  const c = sessionCalc(s, byId);
  const d = parseDate(s.date);
  const ed = dis();
  const maxP = DB.settings.maxPerSession || 8;
  const regs = [...regulars(), ...s.regulars.map((r) => byId[r.memberId]).filter((m) => m && m.active === false)];
  const fixedList = [...fixedMembers(), ...s.fixed.map((id) => byId[id]).filter((m) => m && m.active === false)];
  host.innerHTML = `<div class="overlay" data-click="close-drawer"><div class="drawer" role="dialog" aria-modal="true" aria-label="Buổi ${dmy(s.date)}">
    <div class="drawer-head"><div><h2>${DOW_FULL[d.getDay()]}, ${dmy(s.date)}</h2><p class="muted small">${c.head}/${maxP} người${c.head > maxP ? ' · vượt số người tối đa' : ''}</p></div>
      <button class="btn icon" data-click="close-drawer" aria-label="Đóng">${icon('x')}</button></div>

    <section><h3>Trạng thái</h3><div class="seg">${[['play', 'Đánh'], ['off', 'Nghỉ'], ['pass', 'Pass sân']].map(([k, l]) => `<button class="${s.status === k ? 'on' : ''}" data-click="s-status" data-v="${k}" ${ed}>${l}</button>`).join('')}</div>
      ${s.status === 'pass' ? `<label class="field">Tiền pass sân thu về (đ)<input id="s-pass" type="number" step="1000" min="0" value="${num(s.passAmount)}" data-change="s-pass" ${ed}></label>` : ''}</section>

    ${s.status === 'play' ? `
    <section><h3>Số quả cầu dùng</h3><div class="stepper"><button data-click="s-shuttle" data-v="-1" ${ed} aria-label="Bớt một quả">−</button><input id="s-shuttles" type="number" min="0" value="${num(s.shuttles)}" data-change="s-shuttles" ${ed} aria-label="Số quả cầu"><button data-click="s-shuttle" data-v="1" ${ed} aria-label="Thêm một quả">+</button></div></section>

    <section><h3>Thành viên cố định có mặt</h3><div class="chips">${fixedList.map((m) => `<button class="chip ${s.fixed.includes(m.id) ? 'on' : ''}" data-click="s-fixed" data-id="${m.id}" ${ed}>${esc(m.name)}</button>`).join('') || '<span class="muted small">Chưa có thành viên cố định</span>'}</div></section>

    <section><h3>Vãng lai cố định</h3>
      <div class="list">${regs.map((m) => {
        const r = s.regulars.find((x) => x.memberId === m.id);
        return `<div class="list-row"><button class="chip ${r ? 'on' : ''}" data-click="s-reg" data-id="${m.id}" ${ed}>${esc(m.name)} · ${m.gender === 'F' ? 'Nữ' : 'Nam'}</button>
          ${r ? `<span style="display:flex;gap:8px;align-items:center"><input id="r-amount-${m.id}" class="amount" type="number" step="1000" min="0" value="${num(r.amount)}" data-change="r-amount" data-id="${m.id}" aria-label="Số tiền thực thu của ${esc(m.name)}" ${ed}><button class="paid-toggle ${r.paid ? 'on' : ''}" data-click="s-reg-paid" data-id="${m.id}" ${ed}>${r.paid ? 'Đã chuyển' : 'Chưa trả'}</button></span>` : `<span class="muted small">${money(priceRegular(m))}</span>`}</div>`;
      }).join('') || '<span class="muted small">Chưa có vãng lai cố định</span>'}</div></section>

    <section><h3>Vãng lai ngoài</h3><p class="muted small">Ô số tiền là tiền thực nhận. Ai trả khác giá (giảm giá, chuyển dư) thì sửa trực tiếp.</p>
      ${s.guests.map((g, i) => `<div class="guest-row">
        <input id="g-name-${g.id}" value="${esc(g.name)}" placeholder="Khách ${i + 1} (tên, không bắt buộc)" data-change="g-name" data-id="${g.id}" ${ed}>
        <select id="g-gender-${g.id}" data-change="g-gender" data-id="${g.id}" ${ed}><option value="M" ${g.gender !== 'F' ? 'selected' : ''}>Nam</option><option value="F" ${g.gender === 'F' ? 'selected' : ''}>Nữ</option></select>
        <input id="g-amount-${g.id}" class="amount" type="number" step="1000" min="0" value="${num(g.amount)}" data-change="g-amount" data-id="${g.id}" aria-label="Số tiền thực thu" ${ed}>
        <button class="paid-toggle ${g.paid ? 'on' : ''}" data-click="g-paid" data-id="${g.id}" ${ed}>${g.paid ? 'Đã chuyển' : 'Chưa trả'}</button>
        ${can('edit') ? `<button class="btn icon ghost danger" data-click="g-del" data-id="${g.id}" aria-label="Xoá khách">${icon('trash')}</button>` : ''}</div>`).join('')}
      ${can('edit') ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-click="g-add" data-v="M">${icon('plus')}Khách nam · ${moneyShort(priceGuest('M'))}</button><button class="btn sm" data-click="g-add" data-v="F">${icon('plus')}Khách nữ · ${moneyShort(priceGuest('F'))}</button>
        ${s.guests.some((g) => !g.paid) ? '<button class="btn sm" data-click="g-all-paid">Tất cả đã chuyển</button>' : ''}</div>` : ''}
    </section>` : ''}

    <section><h3>Ghi chú</h3><textarea id="s-note" data-change="s-note" placeholder="VD: Quý còn nợ, Bảo hẹn chuyển sau…" ${ed}>${esc(s.note)}</textarea></section>

    <div class="formula-box" id="drawer-summary">
      <div class="eq"><span>Thu vãng lai cố định</span><b>${money(c.regular)}</b></div>
      <div class="eq"><span>Thu vãng lai ngoài</span><b>${money(c.guest)}</b></div>
      ${s.status === 'pass' ? `<div class="eq"><span>Thu pass sân</span><b>${money(c.pass)}</b></div>` : ''}
      <div class="eq total"><span>Tổng thu buổi</span><b>${money(c.total)}</b></div>
      <div class="eq"><span>Chưa trả</span><b class="${c.unpaid ? 'neg' : 'pos'}">${money(c.unpaid)}</b></div>
    </div>
    ${can('edit') ? `<button class="btn danger" data-click="s-delete">${icon('trash')}Xoá buổi này</button>` : ''}
  </div></div>`;
}

/* ================= Xử lý sự kiện ================= */
const CLICK = {
  'month-prev'() { const k = monthKeys(); const i = k.indexOf(ui.month); if (i > 0) { ui.month = k[i - 1]; render(); } },
  'month-next'() { const k = monthKeys(); const i = k.indexOf(ui.month); if (i < k.length - 1) { ui.month = k[i + 1]; render(); } },
  async 'month-new'() {
    if (!need('edit')) return;
    const keys = monthKeys();
    const last = keys[keys.length - 1];
    let def = monthOf(new Date());
    if (last && DB.months[def]) { const [y, m] = last.split('-').map(Number); def = monthOf(new Date(y, m, 1)); }
    const v = await promptBox('Tạo tháng mới', `Chọn tháng (gợi ý ${monthLabel(def)})`, 'month');
    const key = v || null;
    if (!key) return;
    if (DB.months[key]) { ui.month = key; render(); toast('Tháng này đã có'); return; }
    createMonth(key); ui.month = key; save(`Đã tạo ${monthLabel(key)}`);
  },
  theme: toggleTheme,
  logout() { me = null; store.del('bm.session'); ui.drawer = null; const h = $('#drawer-host'); if (h) h.remove(); render(); },
  'open-session'(el) { ui.drawer = el.dataset.id; renderDrawer(); },
  'close-drawer'(el, e) { if (el.classList.contains('overlay') && e.target !== el) return; ui.drawer = null; renderDrawer(); },
  async 'add-session'() {
    if (!need('edit')) return;
    const date = $('#new-session-date').value;
    if (!date) return;
    const key = date.slice(0, 7);
    if (!DB.months[key]) createMonth(key);
    const s = newSession(date);
    DB.months[key].sessions.push(s);
    ui.month = key; ui.drawer = s.id;
    save('Đã thêm buổi');
  },
  's-status'(el) { mutateSession((s) => { s.status = el.dataset.v; }); },
  's-shuttle'(el) { mutateSession((s) => { s.shuttles = Math.max(0, num(s.shuttles) + num(el.dataset.v)); }); },
  's-fixed'(el) { mutateSession((s) => { const i = s.fixed.indexOf(el.dataset.id); if (i >= 0) s.fixed.splice(i, 1); else s.fixed.push(el.dataset.id); }); },
  's-reg'(el) {
    mutateSession((s) => {
      const i = s.regulars.findIndex((r) => r.memberId === el.dataset.id);
      if (i >= 0) s.regulars.splice(i, 1);
      else s.regulars.push({ memberId: el.dataset.id, amount: priceRegular(memberMap()[el.dataset.id]), paid: false });
    });
  },
  's-reg-paid'(el) { mutateSession((s) => { const r = s.regulars.find((x) => x.memberId === el.dataset.id); if (r) r.paid = !r.paid; }); },
  'g-add'(el) { mutateSession((s) => { s.guests.push({ id: uid(), name: '', gender: el.dataset.v, amount: priceGuest(el.dataset.v), paid: false }); }); },
  'g-paid'(el) { mutateSession((s) => { const g = s.guests.find((x) => x.id === el.dataset.id); if (g) g.paid = !g.paid; }); },
  'g-all-paid'() { mutateSession((s) => { s.guests.forEach((g) => { g.paid = true; }); }); },
  'g-del'(el) { mutateSession((s) => { s.guests = s.guests.filter((x) => x.id !== el.dataset.id); }); },
  async 's-delete'() {
    if (!need('edit')) return;
    const s = findSession(ui.drawer);
    if (!s || !(await confirmBox('Xoá buổi này?', `Buổi ${dmy(s.date)} và toàn bộ điểm danh của buổi sẽ bị xoá.`))) return;
    const M = DB.months[ui.month];
    M.sessions = M.sessions.filter((x) => x.id !== s.id);
    ui.drawer = null; renderDrawer(); save('Đã xoá buổi');
  },
  'dues-add'(el) { if (!need('edit')) return; DB.months[ui.month].dues[el.dataset.id] = { expected: DB.settings.defaultDues, paid: 0, paidAt: '', note: '' }; save('Đã thêm vào tháng'); },
  async 'dues-remove'(el) {
    if (!need('edit')) return;
    const m = memberMap()[el.dataset.id];
    if (!(await confirmBox('Bỏ khỏi tháng này?', `${m ? m.name : 'Thành viên'} sẽ không tham gia chia tiền ${monthLabel(ui.month).toLowerCase()}.`, 'Bỏ ra'))) return;
    delete DB.months[ui.month].dues[el.dataset.id]; save('Đã bỏ khỏi tháng');
  },
  async 'del-purchase'(el) { if (!need('edit') || !(await confirmBox('Xoá lần mua cầu?', 'Số cầu và tiền của lần mua này sẽ bị trừ khỏi tháng.'))) return; const M = DB.months[ui.month]; M.purchases = M.purchases.filter((p) => p.id !== el.dataset.id); save('Đã xoá'); },
  async 'del-expense'(el) { if (!need('edit') || !(await confirmBox('Xoá khoản chi?', 'Khoản chi này sẽ bị xoá khỏi tháng.'))) return; const M = DB.months[ui.month]; M.expenses = M.expenses.filter((p) => p.id !== el.dataset.id); save('Đã xoá'); },
  'mem-active'(el) { if (!need('edit')) return; const m = memberMap()[el.dataset.id]; m.active = m.active === false; save(m.active ? 'Đã kích hoạt' : 'Đã ngừng'); },
  async 'mem-del'(el) {
    if (!need('edit')) return;
    const m = memberMap()[el.dataset.id];
    const used = Object.values(DB.months).some((M) => M.dues[m.id] || M.purchases.some((p) => p.buyer === m.id) || M.expenses.some((p) => p.payer === m.id)
      || M.sessions.some((s) => s.fixed.includes(m.id) || s.regulars.some((r) => r.memberId === m.id)));
    if (used) {
      if (!(await confirmBox(`${m.name} đã có dữ liệu`, 'Người này đã có trong các buổi hoặc khoản thu chi, nên sẽ được chuyển sang “Ngừng” thay vì xoá để giữ đúng sổ sách.', 'Chuyển sang Ngừng', false))) return;
      m.active = false; save('Đã chuyển sang Ngừng'); return;
    }
    if (!(await confirmBox(`Xoá ${m.name}?`, 'Không thể hoàn tác.'))) return;
    DB.members = DB.members.filter((x) => x.id !== m.id); save('Đã xoá');
  },
  'set-day'(el) {
    if (!need('admin')) return;
    const d = num(el.dataset.day);
    const arr = DB.settings.scheduleDays || (DB.settings.scheduleDays = []);
    const i = arr.indexOf(d);
    if (i >= 0) arr.splice(i, 1); else arr.push(d);
    arr.sort(); save('Đã lưu lịch');
  },
  async reprice() {
    if (!need('admin') || !ui.month) return;
    if (!(await confirmBox(`Tính lại giá ${monthLabel(ui.month).toLowerCase()}?`, 'Mọi lượt vãng lai cố định và vãng lai trong tháng sẽ được đặt lại theo đơn giá hiện tại, kể cả số tiền đã sửa tay. Trạng thái đã trả giữ nguyên.', 'Tính lại', false))) return;
    const byId = memberMap();
    DB.months[ui.month].sessions.forEach((s) => {
      s.regulars.forEach((r) => { r.amount = priceRegular(byId[r.memberId]); });
      s.guests.forEach((g) => { g.amount = priceGuest(g.gender); });
    });
    save('Đã tính lại theo giá hiện tại');
  },
  sync() { if (need('edit')) syncNow(false); },
  async 'reload-remote'() {
    if (isDirty() && !(await confirmBox('Bỏ thay đổi chưa đồng bộ?', 'Máy này có thay đổi chưa đưa lên GitHub. Tải lại sẽ thay bằng dữ liệu chung mới nhất.', 'Tải lại'))) return;
    try { DB = await fetchRemote(); store.set('bm.data', JSON.stringify(DB)); store.set('bm.dirty', '0'); me = DB.users.find((u) => u.id === me.id) || null; render(); toast('Đã tải dữ liệu mới nhất'); }
    catch { toast('Không tải được dữ liệu, kiểm tra mạng', true); }
  },
  export() {
    const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `data-${todayStr()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  async 'user-reset'(el) {
    if (!need('admin')) return;
    const u = DB.users.find((x) => x.id === el.dataset.id);
    const pw = await promptBox(`Mật khẩu mới cho ${u.username}`, 'Ít nhất 6 ký tự', 'password');
    if (!pw) return;
    if (pw.length < 6) { toast('Mật khẩu cần ít nhất 6 ký tự', true); return; }
    u.salt = uid(); u.hash = await hashPassword(u.salt, pw); save('Đã đặt lại mật khẩu');
  },
  async 'user-del'(el) {
    if (!need('admin')) return;
    const u = DB.users.find((x) => x.id === el.dataset.id);
    if (!(await confirmBox(`Xoá tài khoản ${u.username}?`, 'Người này sẽ không đăng nhập được nữa.'))) return;
    DB.users = DB.users.filter((x) => x.id !== u.id); save('Đã xoá tài khoản');
  },
};

function mutateSession(fn) {
  if (!need('edit')) return;
  const s = findSession(ui.drawer);
  if (!s) return;
  fn(s);
  save(null, { quiet: true });
  renderDrawer();
  scheduleRender();
}

const CHANGE = {
  'month-select'(el) { ui.month = el.value; render(); },
  'court-fee'(el) { if (need('edit')) { DB.months[ui.month].courtFee = num(el.value); save('Đã lưu tiền sân'); } },
  opening(el) { if (need('edit')) { DB.months[ui.month].openingShuttles = el.value === '' ? null : num(el.value); save('Đã lưu tồn đầu tháng'); } },
  'due-expected'(el) { if (need('edit')) { DB.months[ui.month].dues[el.dataset.id].expected = num(el.value); save(); } },
  'due-paid'(el) {
    if (!need('edit')) return;
    const d = DB.months[ui.month].dues[el.dataset.id];
    d.paid = num(el.value); if (d.paid && !d.paidAt) d.paidAt = todayStr(); save('Đã lưu');
  },
  'due-tick'(el) {
    if (!need('edit')) return;
    const d = DB.months[ui.month].dues[el.dataset.id];
    if (el.checked) { d.paid = Math.max(num(d.paid), num(d.expected)); d.paidAt = d.paidAt || todayStr(); } else { d.paid = 0; d.paidAt = ''; }
    save(el.checked ? 'Đã đánh dấu đã đóng' : 'Đã bỏ đánh dấu');
  },
  'due-date'(el) { if (need('edit')) { DB.months[ui.month].dues[el.dataset.id].paidAt = el.value; save(); } },
  'due-note'(el) { if (need('edit')) { DB.months[ui.month].dues[el.dataset.id].note = el.value; save(null, { quiet: true }); } },
  'settle-tick'(el) { if (need('edit')) { const M = DB.months[ui.month]; M.settled = M.settled || {}; M.settled[el.dataset.id] = el.checked; save(); } },
  's-pass'(el) { mutateSession((s) => { s.passAmount = num(el.value); }); },
  's-shuttles'(el) { mutateSession((s) => { s.shuttles = Math.max(0, num(el.value)); }); },
  's-note'(el) { if (!need('edit')) return; const s = findSession(ui.drawer); if (s) { s.note = el.value; save(null, { quiet: true }); scheduleRender(); } },
  'g-name'(el) { if (!need('edit')) return; const s = findSession(ui.drawer); const g = s && s.guests.find((x) => x.id === el.dataset.id); if (g) { g.name = el.value; save(null, { quiet: true }); } },
  'g-amount'(el) { mutateSession((s) => { const g = s.guests.find((x) => x.id === el.dataset.id); if (g) g.amount = Math.max(0, num(el.value)); }); },
  'r-amount'(el) { mutateSession((s) => { const r = s.regulars.find((x) => x.memberId === el.dataset.id); if (r) r.amount = Math.max(0, num(el.value)); }); },
  'g-gender'(el) { mutateSession((s) => { const g = s.guests.find((x) => x.id === el.dataset.id); if (g) { g.gender = el.value; g.amount = priceGuest(el.value); } }); },
  'mem-name'(el) { if (need('edit')) { memberMap()[el.dataset.id].name = el.value.trim() || 'Không tên'; save('Đã lưu'); } },
  'mem-gender'(el) { if (need('edit')) { memberMap()[el.dataset.id].gender = el.value; save('Đã lưu'); } },
  'mem-phone'(el) { if (need('edit')) { memberMap()[el.dataset.id].phone = el.value.trim(); save('Đã lưu'); } },
  set(el) { if (need('admin')) { DB.settings[el.dataset.key] = el.value.trim(); save('Đã lưu'); } },
  'set-num'(el) { if (need('admin')) { DB.settings[el.dataset.key] = num(el.value); save('Đã lưu'); } },
  'set-price'(el) { if (need('admin')) { DB.settings.prices[el.dataset.key] = num(el.value); save('Đã lưu giá'); } },
  'gh-repo'(el) { if (need('admin')) { DB.settings.github = { ...(DB.settings.github || {}), repo: el.value.trim() }; save('Đã lưu repo'); } },
  'gh-branch'(el) { if (need('admin')) { DB.settings.github = { ...(DB.settings.github || {}), branch: el.value.trim() }; save('Đã lưu nhánh'); } },
  'gh-token'(el) { if (el.value.trim()) store.set('bm.ghToken', el.value.trim()); else store.del('bm.ghToken'); renderSyncBadge(); toast('Đã lưu token trên trình duyệt này'); },
  'user-role'(el) { if (need('admin')) { DB.users.find((u) => u.id === el.dataset.id).role = el.value; save('Đã đổi quyền'); } },
  'user-member'(el) { if (need('admin')) { DB.users.find((u) => u.id === el.dataset.id).memberId = el.value; save('Đã lưu'); } },
  import(el) {
    if (!need('admin')) return;
    const f = el.files && el.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const data = JSON.parse(r.result);
        if (!data.settings || !data.members || !data.months || !data.users) throw new Error('thiếu dữ liệu');
        if (!(await confirmBox('Thay toàn bộ dữ liệu?', `File ${f.name} sẽ thay thế dữ liệu hiện tại.`, 'Thay thế'))) return;
        DB = data; me = DB.users.find((u) => u.id === me.id) || DB.users.find((u) => u.role === 'admin');
        save('Đã nhập dữ liệu');
      } catch { toast('File không đúng định dạng sao lưu', true); }
    };
    r.readAsText(f);
  },
};

const SUBMIT = {
  'add-purchase'(f) {
    if (!need('edit')) return;
    const v = Object.fromEntries(new FormData(f));
    DB.months[ui.month].purchases.push({ id: uid(), date: v.date, tubes: num(v.tubes), perTube: num(v.perTube) || DB.settings.shuttlesPerTube, amount: num(v.amount), buyer: v.buyer, note: v.note.trim() });
    save('Đã thêm lần mua cầu');
  },
  'add-expense'(f) {
    if (!need('edit')) return;
    const v = Object.fromEntries(new FormData(f));
    DB.months[ui.month].expenses.push({ id: uid(), date: v.date, desc: v.desc.trim(), amount: num(v.amount), payer: v.payer });
    save('Đã thêm khoản chi');
  },
  'add-member'(f) {
    if (!need('edit')) return;
    const v = Object.fromEntries(new FormData(f));
    const m = { id: uid(), name: v.name.trim(), type: f.dataset.type, gender: v.gender, phone: v.phone.trim(), active: true };
    DB.members.push(m);
    if (m.type === 'fixed' && ui.month && DB.months[ui.month]) DB.months[ui.month].dues[m.id] = { expected: DB.settings.defaultDues, paid: 0, paidAt: '', note: '' };
    save(`Đã thêm ${m.name}`);
  },
  async 'add-user'(f) {
    if (!need('admin')) return;
    const v = Object.fromEntries(new FormData(f));
    const username = v.username.trim().toLowerCase();
    if (DB.users.some((u) => u.username.toLowerCase() === username)) { toast('Tên đăng nhập đã tồn tại', true); return; }
    const salt = uid();
    DB.users.push({ id: uid(), username, name: v.name.trim(), role: v.role, memberId: '', salt, hash: await hashPassword(salt, v.password) });
    save(`Đã tạo tài khoản ${username}`);
  },
  async 'change-pass'(f) {
    const v = Object.fromEntries(new FormData(f));
    if ((await hashPassword(me.salt, v.old)) !== me.hash) { toast('Mật khẩu hiện tại không đúng', true); return; }
    me.salt = uid(); me.hash = await hashPassword(me.salt, v.new);
    if (me.role === 'admin') DB.settings.showDemoHint = false;
    f.reset();
    save(ghToken() ? 'Đã đổi mật khẩu' : 'Đã đổi mật khẩu trên máy này. Người có token cần đồng bộ để áp dụng chung.');
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-click]');
  if (!el || el.disabled) return;
  const fn = CLICK[el.dataset.click];
  if (fn) { if (el.tagName === 'A') e.preventDefault(); fn(el, e); }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = CHANGE[el.dataset.change];
  if (fn) fn(el, e);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-submit]');
  if (!f) return;
  e.preventDefault();
  const fn = SUBMIT[f.dataset.submit];
  if (fn) fn(f);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.drawer && !$('.modal-wrap')) { ui.drawer = null; renderDrawer(); } });
window.addEventListener('hashchange', () => { ui.route = routeFromHash(); ui.drawer = null; const h = $('#drawer-host'); if (h) h.remove(); render(); window.scrollTo(0, 0); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (ui.route === 'stats') render(); });
const routeFromHash = () => { const r = location.hash.replace(/^#\/?/, ''); return NAV.some(([k]) => k === r) ? r : 'overview'; };

/* ================= Khởi động ================= */
(async function boot() {
  applyTheme();
  ui.route = routeFromHash();
  $('#root').innerHTML = '<div class="login-wrap"><p class="muted">Đang tải dữ liệu…</p></div>';
  await loadData();
  const sid = store.get('bm.session');
  me = sid ? DB.users.find((u) => u.id === sid) || null : null;
  render();
}());
