/* Ogarniam Kasę – ranking wyników: kto uzbierał najwięcej pieniędzy.
   Wynik zawsze zapisuje się w tej przeglądarce. Gdy w ranking-config.js jest adres bazy Supabase,
   ranking jest wspólny dla wszystkich graczy, a lista z przeglądarki służy za zapas, gdy baza nie odpowiada.
   Do bazy trafiają tylko: losowy identyfikator urządzenia, nick, tryb gry, majątek i wynik punktowy. */
'use strict';

const RANK_KEY = 'ogarniamKase.ranking.v1', NICK_KEY = 'ogarniamKase.nick', PLAYER_KEY = 'ogarniamKase.player', RANK_KEEP = 50;
const RANK_MODES = [['life', 'Od 20 do 65 lat'], ['12', '1 rok'], ['24', '2 lata'], ['36', '3 lata']];
const CFG = typeof RANKING_CONFIG === 'object' && RANKING_CONFIG ? RANKING_CONFIG : { url: '', key: '' };
const ONLINE = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(CFG.url) && typeof CFG.key === 'string' && CFG.key.length > 20;

/* ---------- nick ---------- */

// Tylko litery, cyfry, spacja i kilka znaków. Ten sam zestaw sprawdza baza (supabase.sql).
const cleanNick = v => String(v || '').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
const NICK_BAN = ['kurw', 'chuj', 'huj', 'pizd', 'jeb', 'pierdol', 'fiut', 'kutas', 'dziwk', 'szmat', 'pedal', 'cwel', 'spierd', 'fuck', 'shit', 'bitch', 'nigg', 'hitler', 'nazi'];
function nickError(v) {
  const n = cleanNick(v);
  if (n.length < 2) return 'Nick musi mieć co najmniej 2 znaki: litery albo cyfry.';
  const flat = n.toLowerCase().replace(/[01345@$7]/g, c => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', '@': 'a', $: 's', 7: 't' })[c])
    .replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  if (NICK_BAN.some(w => flat.includes(w))) return 'Wybierz inny nick, ten nie przejdzie w rankingu.';
  return '';
}
function lastNick() { try { return cleanNick(localStorage.getItem(NICK_KEY)); } catch (err) { return ''; } }
function saveNick(n) { try { localStorage.setItem(NICK_KEY, n); } catch (err) { /* tryb prywatny */ } }
// Losowy identyfikator tego urządzenia: dzięki niemu w rankingu liczy się najlepszy wynik gracza, a nie każda gra.
function myPlayer() {
  const ok = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v || '');
  try {
    let id = localStorage.getItem(PLAYER_KEY);
    if (!ok(id)) { id = newId(); localStorage.setItem(PLAYER_KEY, id); }
    return id;
  } catch (err) { return newId(); }
}
function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
// Zamienia znaki specjalne na bezpieczne. Używane przy każdym tekście od graczy, także z bazy.
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* ---------- ranking w tej przeglądarce ---------- */

const byMoney = (a, b) => b.net - a.net || b.score - a.score || a.at - b.at;
// Jeden wpis na gracza: jego najlepszy wynik.
function bestOnly(list, key) {
  const seen = new Set();
  return list.slice().sort(byMoney).filter(e => { const k = key(e); if (seen.has(k)) return false; seen.add(k); return true; });
}

const RANK = {
  all() {
    try {
      const d = JSON.parse(localStorage.getItem(RANK_KEY) || '[]');
      if (!Array.isArray(d)) return [];
      return d.map(e => {
        if (!e || typeof e !== 'object') return null;
        const nick = cleanNick(e.nick), mode = String(e.mode);
        if (!nick || !RANK_MODES.some(m => m[0] === mode)) return null;
        if (!Number.isFinite(e.score) || !Number.isFinite(e.net) || !Number.isFinite(e.at)) return null;
        return { id: String(e.id).slice(0, 40), nick, mode, score: clamp(Math.round(e.score), 0, 100), net: Math.round(e.net), at: e.at };
      }).filter(Boolean);
    } catch (err) { return []; }
  },
  save(list) { try { localStorage.setItem(RANK_KEY, JSON.stringify(list)); } catch (err) { /* tryb prywatny */ } },
  list(mode) { return bestOnly(this.all().filter(e => e.mode === mode), e => e.nick.toLowerCase()); },
  // Dodaje wynik i zwraca miejsce gracza w rankingu danego trybu.
  add(nick, mode, score, net) {
    const entry = { id: Date.now() + '-' + Math.floor(Math.random() * 1e6), nick: cleanNick(nick), mode: String(mode), score, net: Math.round(net), at: Date.now() };
    const others = this.all().filter(e => e.mode !== entry.mode);
    const mine = this.all().filter(e => e.mode === entry.mode).concat(entry).sort(byMoney).slice(0, 200);
    this.save(others.concat(mine));
    const place = this.list(entry.mode).findIndex(e => e.nick.toLowerCase() === entry.nick.toLowerCase()) + 1;
    return { id: entry.id, place };
  },
  clear(mode) { this.save(this.all().filter(e => e.mode !== mode)); }
};

/* ---------- wspólny ranking w bazie Supabase ---------- */

const RANK_NET = {
  head(extra) {
    // Nowe klucze Supabase (sb_publishable_…) idą tylko w nagłówku apikey, starsze klucze anon także jako Bearer.
    const h = { apikey: CFG.key, 'Content-Type': 'application/json' };
    if (/^eyJ/.test(CFG.key)) h.Authorization = 'Bearer ' + CFG.key;
    return Object.assign(h, extra);
  },
  async list(mode) {
    const url = `${CFG.url}/rest/v1/ranking_top?mode=eq.${encodeURIComponent(mode)}&select=player,nick,net,score,created_at&order=net.desc&limit=${RANK_KEEP}`;
    const r = await fetch(url, { headers: this.head(), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (!Array.isArray(d)) throw new Error('zła odpowiedź');
    // Dane z bazy też są sprawdzane: wpis z dziwnym nickiem albo kwotą po prostu się nie pokaże.
    return d.map(e => {
      const nick = cleanNick(e && e.nick);
      if (!nick || nickError(nick) || !Number.isFinite(e.net) || !Number.isFinite(e.score)) return null;
      return { player: String(e.player), nick, net: Math.round(e.net), score: clamp(Math.round(e.score), 0, 100), at: Date.parse(e.created_at) || 0 };
    }).filter(Boolean).sort(byMoney);
  },
  async add(e) {
    const r = await fetch(`${CFG.url}/rest/v1/ranking`, {
      method: 'POST', headers: this.head({ Prefer: 'return=minimal' }), credentials: 'omit', referrerPolicy: 'no-referrer',
      body: JSON.stringify(e)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  }
};

let rankMode = 'life', rankNew = '', rankData = { mode: '', rows: [], status: ONLINE ? 'loading' : 'local' };

function refreshRank() {
  if (!ONLINE) return;
  const mode = rankMode;
  rankData = { mode, rows: rankData.mode === mode ? rankData.rows : [], status: 'loading' };
  RANK_NET.list(mode)
    .then(rows => { rankData = { mode, rows, status: 'online' }; })
    .catch(() => { rankData = { mode, rows: [], status: 'error' }; })
    .finally(() => { if (view === 'rank' && rankMode === mode) render(); });
}

// Lista do pokazania: wspólna z bazy, a gdy jej nie ma, ta z przeglądarki.
function rankRows() {
  if (ONLINE && rankData.mode === rankMode && rankData.status === 'online') return { rows: rankData.rows, online: true };
  return { rows: RANK.list(rankMode), online: false };
}
function isMe(e, online) {
  const me = lastNick().toLowerCase();
  return online ? e.player === myPlayer() && e.nick.toLowerCase() === me : e.nick.toLowerCase() === me;
}

/* ---------- formularz na ekranie wyniku ---------- */

function rankForm(s, mode) {
  const label = (RANK_MODES.find(m => m[0] === String(mode)) || ['', ''])[1];
  if (s.ranked) {
    const where = s.ranked.where === 'online' ? 'we wspólnym rankingu' : 'w rankingu na tym urządzeniu';
    return `<div class="card"><h3>${ic('trophy')} Ranking</h3>
      <p>${s.ranked.place ? `Twój najlepszy wynik jest na <strong>${s.ranked.place}. miejscu</strong> ${where} („${label}”).` : `Wynik zapisany ${where}.`}</p>
      ${s.ranked.failed ? '<p class="small neg">Nie udało się połączyć ze wspólnym rankingiem, więc wynik zapisał się tylko na tym urządzeniu.</p>' : ''}
      <button class="btn" data-act="go" data-arg="rank">Zobacz ranking →</button></div>`;
  }
  return `<div class="card"><h3>${ic('trophy')} Dodaj wynik do rankingu</h3>
    <p class="small muted">${ONLINE ? 'Ranking jest wspólny dla wszystkich graczy. Trafią do niego tylko Twój nick i wynik, dopiero po kliknięciu przycisku.' : 'Ranking działa na razie tylko na tym urządzeniu, więc możesz się mierzyć z osobami, które grają na tym samym telefonie lub komputerze.'}</p>
    <label class="amt">Twój nick <input type="text" id="rankNick" maxlength="16" autocomplete="nickname" spellcheck="false" value="${esc(lastNick())}" placeholder="np. KasaMistrz"></label>
    <p class="small neg" id="nickMsg" style="margin:6px 0 0" role="alert"></p>
    <button class="btn dark" style="margin-top:10px" data-act="rankSave" data-arg="${mode}" ${s.ranking ? 'disabled' : ''}>${s.ranking ? 'Wysyłam…' : 'Zapisz wynik'}</button></div>`;
}

ACT.rankSave = mode => {
  const s = S, input = document.getElementById('rankNick');
  if (!s || s.phase !== 'end' || s.ranked || s.ranking || !input) return;
  const err = nickError(input.value);
  if (err) { document.getElementById('nickMsg').textContent = err; return; }
  const nick = cleanNick(input.value), m = String(mode);
  const life = s.mode === 'life', score = life ? lifeScore(s) : scoreOf(s), net = life ? score.net : netWorth(s);
  saveNick(nick);
  const local = RANK.add(nick, m, score.total, net);
  rankMode = m; rankNew = local.id;
  if (!ONLINE) { s.ranked = { place: local.place, where: 'local' }; render(); return; }
  s.ranking = true;
  render();
  RANK_NET.add({ player: myPlayer(), nick, mode: m, net: Math.round(net), score: score.total })
    .then(() => RANK_NET.list(m))
    .then(rows => {
      rankData = { mode: m, rows, status: 'online' };
      s.ranked = { place: rows.findIndex(r => isMe(r, true)) + 1, where: 'online' };
    })
    .catch(() => { s.ranked = { place: local.place, where: 'local', failed: true }; })
    .finally(() => { s.ranking = false; if (view === 'game' && S === s) render(); });
};

ACT.rankMode = m => { if (RANK_MODES.some(x => x[0] === String(m))) { rankMode = String(m); refreshRank(); render(); } };

ACT.rankClear = (a, b, el) => {
  if (el.dataset.sure !== '1') {
    el.dataset.sure = '1'; el.textContent = 'Na pewno usunąć?';
    setTimeout(() => { if (el.isConnected) { el.dataset.sure = ''; el.textContent = 'Wyczyść ten ranking'; } }, 3000);
    return;
  }
  RANK.clear(rankMode); rankNew = ''; render();
};

/* ---------- widok rankingu: podium 3D i lista ---------- */

function podium(rows, online) {
  const slot = (e, place) => `
    <div class="pod p${place}${e && isMe(e, online) ? ' me' : ''}">
      <div class="pod-block"><i class="pf f1"><b>${place}</b><span class="pod-who">${e
        ? `${place === 1 ? ic('trophy') : ''}<span class="pod-nick">${esc(e.nick)}</span><span class="pod-net">${zl(e.net)}</span>`
        : '<span class="pod-nick muted">wolne miejsce</span>'}</span></i><i class="pf f2"></i><i class="pf f3"></i><i class="pf f4"></i><i class="pf top"></i></div>
    </div>`;
  const sr = [0, 1, 2].filter(i => rows[i]).map(i => `<li>${i + 1}. miejsce: ${esc(rows[i].nick)}, ${zl(rows[i].net)}</li>`).join('');
  return `<ol class="sr-only">${sr}</ol>
    <div class="podium-scene" id="podium" aria-hidden="true"><div class="podium"><div class="pod-floor"></div>${slot(rows[1], 2)}${slot(rows[0], 1)}${slot(rows[2], 3)}</div></div>`;
}

function initPodium() {
  const scene = document.getElementById('podium');
  if (!scene) return;
  const stage = scene.querySelector('.podium');
  spinner(scene, st => { stage.style.transform = `rotateX(${st.rx}deg) rotateY(${st.ry}deg)`; },
    { rx: -12, ry: -14, idle: 0, minX: -38, maxX: -2, minY: -32, maxY: 32 });
}

function viewRank() {
  const { rows, online } = rankRows();
  const loading = ONLINE && rankData.status === 'loading' && !online;
  const failed = ONLINE && rankData.status === 'error';
  const rest = rows.slice(3).map((e, i) => `
    <li class="${isMe(e, online) ? 'me' : ''}"><span class="rk">${i + 4}.</span><span class="rn">${esc(e.nick)}</span><span class="rs small muted">${e.score}/100 pkt</span><b>${zl(e.net)}</b></li>`).join('');
  return `
  <h2>${ic('trophy')} Ranking</h2>
  <p class="muted">Kto uzbierał najwięcej pieniędzy? Liczy się majątek na koniec gry, a każdy gracz jest na liście raz, ze swoim najlepszym wynikiem. ${online ? 'Ranking jest wspólny dla wszystkich graczy.' : 'Na razie widać tu gry z tego urządzenia.'}</p>
  <div class="chips" style="margin-bottom:10px">${RANK_MODES.map(([m, l]) => `<button class="chip big ${rankMode === m ? 'on' : ''}" data-act="rankMode" data-arg="${m}">${l}</button>`).join('')}</div>
  ${failed ? '<p class="flash small">Nie udało się połączyć ze wspólnym rankingiem. Pokazuję wyniki z tego urządzenia.</p>' : ''}
  ${loading ? '<div class="card"><p style="margin:0">Wczytuję ranking…</p></div>' : rows.length ? `
    <div class="card podium-card">${podium(rows, online)}<p class="small muted center" style="margin:0">Przeciągnij, żeby obrócić podium.</p></div>
    ${rest ? `<div class="card rank-card"><ol class="rank-list">${rest}</ol></div>` : ''}
    ${online ? '' : '<button class="btn sm" data-act="rankClear">Wyczyść ten ranking</button>'}`
    : `<div class="card"><p style="margin:0 0 12px">W tym trybie nikt jeszcze nie zapisał wyniku. Zagraj i dodaj swój na ekranie końcowym.</p>
      <button class="btn primary" data-act="go" data-arg="game">Zagraj teraz →</button></div>`}`;
}
