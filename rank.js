/* Ogarniam Kasę – ranking wyników.
   Na razie ranking jest lokalny: wyniki zapisują się tylko w przeglądarce tego urządzenia.
   Cały zapis i odczyt przechodzi przez obiekt RANK (list, add, clear). Gdy pojawi się serwer
   z kontami graczy, wystarczy podmienić te trzy metody, a widoki zostają bez zmian. */
'use strict';

const RANK_KEY = 'ogarniamKase.ranking.v1', NICK_KEY = 'ogarniamKase.nick', RANK_KEEP = 20;
const RANK_MODES = [['life', 'Całe życie'], ['12', '1 rok'], ['24', '2 lata'], ['36', '3 lata']];

// Nick: tylko litery, cyfry, spacja i kilka znaków. Dzięki temu można go bezpiecznie wstawić do strony.
const cleanNick = v => String(v || '').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);

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
  list(mode) {
    return this.all().filter(e => e.mode === mode).sort((a, b) => b.score - a.score || b.net - a.net || a.at - b.at);
  },
  // Dodaje wynik i zwraca miejsce w rankingu danego trybu (0, gdy wynik nie zmieścił się na liście).
  add(nick, mode, score, net) {
    const entry = { id: Date.now() + '-' + Math.floor(Math.random() * 1e6), nick: cleanNick(nick), mode: String(mode), score, net, at: Date.now() };
    const others = this.all().filter(e => e.mode !== entry.mode);
    const mine = this.list(entry.mode).concat(entry).sort((a, b) => b.score - a.score || b.net - a.net || a.at - b.at).slice(0, RANK_KEEP);
    this.save(others.concat(mine));
    return { id: entry.id, place: mine.findIndex(e => e.id === entry.id) + 1 };
  },
  clear(mode) { this.save(this.all().filter(e => e.mode !== mode)); }
};

function lastNick() { try { return cleanNick(localStorage.getItem(NICK_KEY)); } catch (err) { return ''; } }

/* ---------- formularz na ekranie wyniku ---------- */

function rankForm(s, mode) {
  const label = (RANK_MODES.find(m => m[0] === String(mode)) || ['', ''])[1];
  if (s.ranked) {
    return `<div class="card"><h3>${ic('target')} Ranking</h3>
      <p>${s.ranked.place ? `Jesteś na <strong>${s.ranked.place}. miejscu</strong> w trybie „${label}”.` : 'Wynik zapisany, ale nie zmieścił się w pierwszej dwudziestce.'}</p>
      <button class="btn" data-act="go" data-arg="rank">Zobacz ranking →</button></div>`;
  }
  return `<div class="card"><h3>${ic('target')} Dodaj wynik do rankingu</h3>
    <p class="small muted">Ranking działa na razie tylko na tym urządzeniu, więc możesz się mierzyć z osobami, które grają na tym samym telefonie lub komputerze.</p>
    <label class="amt">Twój nick <input type="text" id="nickIn" maxlength="16" autocomplete="off" value="${lastNick()}" placeholder="np. Kasia"></label>
    <p class="small neg" id="nickMsg" style="margin:6px 0 0"></p>
    <button class="btn dark" style="margin-top:10px" data-act="rankSave" data-arg="${mode}">Zapisz wynik</button></div>`;
}

let rankMode = 'life', rankNew = '';

ACT.rankSave = mode => {
  const s = S, input = document.getElementById('nickIn');
  if (!s || s.phase !== 'end' || s.ranked || !input) return;
  const nick = cleanNick(input.value);
  if (!nick) { document.getElementById('nickMsg').textContent = 'Wpisz nick: litery lub cyfry, najwyżej 16 znaków.'; return; }
  const life = s.mode === 'life';
  const score = life ? lifeScore(s) : scoreOf(s);
  try { localStorage.setItem(NICK_KEY, nick); } catch (err) { /* tryb prywatny */ }
  s.ranked = RANK.add(nick, mode, score.total, life ? score.net : netWorth(s));
  rankMode = String(mode); rankNew = s.ranked.id;
  render();
};

ACT.rankMode = m => { if (RANK_MODES.some(x => x[0] === String(m))) { rankMode = String(m); render(); } };

ACT.rankClear = (a, b, el) => {
  if (el.dataset.sure !== '1') {
    el.dataset.sure = '1'; el.textContent = 'Na pewno usunąć?';
    setTimeout(() => { if (el.isConnected) { el.dataset.sure = ''; el.textContent = 'Wyczyść ten ranking'; } }, 3000);
    return;
  }
  RANK.clear(rankMode); render();
};

/* ---------- widok rankingu ---------- */

function viewRank() {
  const list = RANK.list(rankMode);
  const rows = list.map((e, i) => `<tr class="${e.id === rankNew ? 'me' : ''}">
    <td>${i + 1}</td><td>${e.nick}</td><td><b>${e.score}</b>/100</td><td>${zl(e.net)}</td><td class="muted">${new Date(e.at).toLocaleDateString('pl-PL')}</td></tr>`).join('');
  return `
  <h2>Ranking</h2>
  <p class="muted">Najlepsze wyniki z symulatora. Na razie ranking jest lokalny: widać w nim tylko gry z tego urządzenia. Wspólny ranking wszystkich graczy pojawi się razem z kontami.</p>
  <div class="chips" style="margin-bottom:14px">${RANK_MODES.map(([m, l]) => `<button class="chip big ${rankMode === m ? 'on' : ''}" data-act="rankMode" data-arg="${m}">${l}</button>`).join('')}</div>
  ${list.length ? `<div class="card rank-card"><table class="rank">
      <thead><tr><th>#</th><th>Gracz</th><th>Wynik</th><th>Majątek</th><th>Data</th></tr></thead><tbody>${rows}</tbody></table></div>
    <button class="btn sm" data-act="rankClear">Wyczyść ten ranking</button>`
    : `<div class="card"><p style="margin:0 0 12px">W tym trybie nikt jeszcze nie zapisał wyniku. Zagraj i dodaj swój na ekranie końcowym.</p>
      <button class="btn primary" data-act="go" data-arg="game">Zagraj teraz →</button></div>`}`;
}
