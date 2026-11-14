/* Ogarniam Kasę – logika. Dane są w data.js, lekcje w lessons.js.
   Strona nie ma backendu i nie wysyła nigdzie żadnych danych. */
'use strict';

/* ---------- akcje (bez kodu w atrybutach HTML, żeby działała ścisła polityka CSP) ---------- */

const ACT = {};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = Object.prototype.hasOwnProperty.call(ACT, el.dataset.act) ? ACT[el.dataset.act] : null;
  if (!fn) return;
  const num = v => (v !== undefined && v !== '' && !isNaN(v) ? +v : v);
  fn(num(el.dataset.arg), num(el.dataset.arg2), el);
});
document.addEventListener('input', e => {
  if (e.target.closest('#app')) { calcPay(); calcCompound(); calcInfl(); }
});

/* ---------- pamięć lokalna (tylko w przeglądarce gracza, z walidacją) ---------- */

/* Klucze zapisu zostają pod starą nazwą projektu, żeby gracze nie stracili wyników i odznak. */
const STORE_KEY = 'pierwszaKasa.v2', OLD_STORE_KEY = 'pierwszaKasa.v1';
const BADGES = [
  { id: 'czysto', icon: 'shield', name: 'Niezatapialny', desc: 'Rok bez żadnego scamu' },
  { id: 'bezdlugu', icon: 'receipt', name: 'Na czysto', desc: 'Koniec roku bez długów i rat' },
  { id: 'poduszka', icon: 'buoy', name: 'Poduszka', desc: 'Zapas na 3 miesiące życia' },
  { id: 'nerwy', icon: 'chartup', name: 'Stalowe nerwy', desc: 'Krach przetrwany bez sprzedaży' },
  { id: 'cel', icon: 'target', name: 'Cel osiągnięty', desc: 'Uzbierana kwota na swój cel' },
  { id: 'balans', icon: 'scale', name: 'Złoty środek', desc: 'Odłożone 30% i wysokie zadowolenie' },
  { id: 'ninja', icon: 'ninja', name: 'Ninja', desc: 'Wynik co najmniej 80 punktów' },
  { id: 'inflacja', icon: 'price', name: 'Pogromca inflacji', desc: 'Zyski z oszczędności większe niż inflacja' },
  { id: 'maraton', icon: 'calendar', name: 'Maratończyk', desc: 'Ukończona gra na 3 lata' },
  { id: 'kurs', icon: 'book', name: 'Inwestycja w siebie', desc: 'Ukończony kurs z certyfikatem' },
  { id: 'polisa', icon: 'umbrella', name: 'Ubezpieczony', desc: 'Strata pokryta z polisy' },
  { id: 'emeryt', icon: 'sun', name: 'Spokojna emerytura', desc: 'Gra od 20 do 65 lat: emerytura to co najmniej 70% pensji' },
  { id: 'milioner', icon: 'coin', name: 'Milioner', desc: 'Gra od 20 do 65 lat: majątek od miliona złotych' },
  { id: 'dom', icon: 'key', name: 'Na swoim', desc: 'Gra od 20 do 65 lat: spłacone własne mieszkanie' }
];
function loadStore() {
  const empty = () => ({ best: { 12: 0, 24: 0, 36: 0 }, games: 0, badges: [] });
  const score = v => (Number.isFinite(v) ? clamp(Math.round(v), 0, 100) : 0);
  const parse = key => { const d = JSON.parse(localStorage.getItem(key) || 'null'); return d && typeof d === 'object' ? d : null; };
  try {
    const out = empty();
    let d = parse(STORE_KEY);
    if (!d) {
      // Przeniesienie wyniku ze starszej wersji zapisu (jedna długość gry).
      const old = parse(OLD_STORE_KEY);
      if (!old) return out;
      d = { best: { 12: old.best }, games: old.games, badges: old.badges };
    }
    if (d.best && typeof d.best === 'object') [12, 24, 36].forEach(m => { out.best[m] = score(d.best[m]); });
    out.games = Number.isInteger(d.games) && d.games >= 0 ? Math.min(d.games, 99999) : 0;
    out.badges = Array.isArray(d.badges) ? BADGES.map(b => b.id).filter(id => d.badges.includes(id)) : [];
    return out;
  } catch (err) { return empty(); }
}
function saveStore(st) { try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch (err) { /* tryb prywatny */ } }
let STORE = loadStore();

/* ---------- cele ---------- */

const GOALS = [
  { id: 'wakacje', icon: 'sun', name: 'Wakacje z ekipą', amount: 2500 },
  { id: 'prawko', icon: 'car', name: 'Prawo jazdy', amount: 3500 },
  { id: 'laptop', icon: 'laptop', name: 'Porządny laptop', amount: 4500 },
  { id: 'start', icon: 'key', name: 'Kaucja na własny pokój', amount: 8000 }
];

/* ---------- stan i nawigacja ---------- */

let view = 'home';
let S = null;   // stan gry
let Q = null;   // stan quizu

function go(v) {
  if (!['home', 'game', 'quiz', 'lessons', 'rank'].includes(v)) v = 'home';
  view = v;
  // Gra w trakcie wraca po odświeżeniu strony. Bez zapisanej gry: najpierw nick, potem wybór postaci.
  if (v === 'game' && !S) S = loadGame() || { phase: lastNick() ? 'pick' : 'name' };
  if (v === 'quiz' && !Q) Q = { i: 0, score: 0, answered: null };
  if (v === 'rank') refreshRank();
  render();
  window.scrollTo(0, 0);
}
ACT.go = go;

function render() {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.arg === view));
  const html = { home: viewHome, game: viewGame, quiz: viewQuiz, lessons: () => viewLessons() + viewGlossary(), rank: viewRank }[view]();
  app.innerHTML = '<div class="fade">' + html + '</div>';
  if (view === 'lessons') { calcCompound(); calcPay(); calcInfl(); }
  if (view === 'home') { initCoin(); initTilt(); }
  if (view === 'game') saveGame();
  if (view === 'rank') initPodium();
  initStacks();
}

/* ---------- start ---------- */

const MYTHS = [
  { q: '„Oszczędzanie ma sens dopiero przy dużych zarobkach”', v: 'Mit', a: '100 zł miesięcznie przez 10 lat przy 5% rocznie daje ok. 15 500 zł. Liczy się nawyk i czas, a nie kwota.' },
  { q: '„Raty 0% nic nie kosztują”', v: 'Mit', a: 'Często dochodzi ubezpieczenie albo prowizja, a spóźniona rata oznacza odsetki. To nadal dług.' },
  { q: '„Pieniądze w banku są chronione”', v: 'Fakt', a: 'Bankowy Fundusz Gwarancyjny chroni depozyty do równowartości 100 tys. euro na osobę w jednym banku.' },
  { q: '„Bank może zadzwonić i poprosić o kod BLIK”', v: 'Mit', a: 'Bank nigdy nie prosi o kody, hasła ani instalowanie aplikacji. Rozłącz się i sam zadzwoń na infolinię.' },
  { q: '„Do 26. roku życia nie płacisz PIT od pensji”', v: 'Fakt', a: 'Ulga dla młodych obejmuje umowę o pracę i zlecenie do 85 528 zł przychodu rocznie. Nie dotyczy umowy o dzieło.' },
  { q: '„Akcje to hazard”', v: 'Mit', a: 'Pojedyncza spółka bywa loterią. Szeroki fundusz ETF trzymany wiele lat to udział w tysiącach firm naraz, choć bez gwarancji zysku.' }
];
const FACTS = [
  'Podatek Belki zabiera 19% zysku z lokat i inwestycji.',
  '4% miesięcznie to nie 48%, tylko ok. 60% rocznie. Tak działa procent składany w długu.',
  'Przy 6% rocznie pieniądze podwajają się mniej więcej co 12 lat.',
  'Podejrzany SMS możesz bezpłatnie przekazać na numer 8080.',
  'Poduszka finansowa to zapas na 3–6 miesięcy wydatków.',
  'RRSO pokazuje cały roczny koszt pożyczki razem z opłatami.',
  'Inflacja 4% oznacza, że 1000 zł w skarpecie za rok kupi tyle, co dziś ok. 960 zł.'
];

function viewHome() {
  const got = STORE.badges.length;
  return `
  <section class="hero">
    <div class="hero-text">
      <span class="tag violet">Symulator finansowego życia</span>
      <h1 style="margin-top:14px">Twoja pierwsza kasa.<br><mark>Zero ściemy.</mark></h1>
      <p class="lead">Przeżyj 12 miesięcy dorosłego życia w 10 minut. Dostajesz wypłatę, płacisz rachunki, odkładasz albo wydajesz i omijasz pułapki. Na końcu widzisz, dokąd prowadzą Twoje decyzje.</p>
      <button class="btn primary" data-act="go" data-arg="game">Zagraj teraz →</button>
    </div>
    <div class="coin-wrap">
      <div class="coin-scene" id="coinScene" role="button" tabindex="0" aria-label="Moneta 3D. Kliknij, żeby wylosować ciekawostkę"><div class="coin3d" id="coin3d"></div></div>
      <p class="coin-fact small" id="coinFact">Zakręć monetą albo kliknij ją po ciekawostkę.</p>
    </div>
  </section>

  ${STORE.games ? `<div class="card flat stats"><span><b>${Math.max(STORE.best[12], STORE.best[24], STORE.best[36])}</b>/100 najlepszy wynik</span><span><b>${STORE.games}</b> ${STORE.games === 1 ? 'rozgrywka' : 'rozgrywek'}</span><span><b>${got}</b>/${BADGES.length} odznak</span></div>` : ''}

  <div class="tiles">
    <button class="card tilt" data-act="go" data-arg="game"><div class="emoji">${ic('gamepad')}</div><h3>Symulator</h3><p class="muted small">Szybka gra na 1–3 lata albo gra od 20 do 65 lat: od studenta do emerytury, ze zmianą pracy i kupnem mieszkania.</p></button>
    <button class="card tilt" data-act="go" data-arg="quiz"><div class="emoji">${ic('magnifier')}</div><h3>Scam czy nie scam?</h3><p class="muted small">Osiem wiadomości. Rozpoznasz, które wysłał oszust?</p></button>
    <button class="card tilt" data-act="go" data-arg="lessons"><div class="emoji">${ic('bolt')}</div><h3>Lekcje w 2 minuty</h3><p class="muted small">Brutto i netto, budżet, procent składany, długi i słowniczek.</p></button>
    <button class="card tilt" data-act="go" data-arg="rank"><div class="emoji">${ic('target')}</div><h3>Ranking</h3><p class="muted small">Najlepsze wyniki. Zapisz swój pod nickiem i sprawdź, kto ogarnia kasę najlepiej.</p></button>
  </div>

  <h2 style="margin-top:34px">Mit czy fakt?</h2>
  <p class="muted">Zgadnij, a potem kliknij kartę, żeby ją odwrócić.</p>
  <div class="flips">${MYTHS.map(m => `
    <button class="flip" data-act="flip" aria-label="${m.q}. Kliknij, żeby zobaczyć odpowiedź">
      <span class="flip-in">
        <span class="flip-face flip-front"><span class="tag">Mit czy fakt?</span><strong>${m.q}</strong></span>
        <span class="flip-face flip-back ${m.v === 'Fakt' ? 'fact' : 'myth'}"><span class="tag">${m.v}</span><span class="small">${m.a}</span></span>
      </span>
    </button>`).join('')}</div>

  <h2 style="margin-top:34px">Odznaki</h2>
  <p class="muted">Zdobywasz je w symulatorze. Zapisują się tylko w Twojej przeglądarce.</p>
  ${badgeGrid(STORE.badges)}`;
}

function badgeGrid(owned, fresh = []) {
  return `<div class="badges">${BADGES.map(b => `
    <div class="badge ${owned.includes(b.id) ? 'on' : ''} ${fresh.includes(b.id) ? 'new' : ''}">
      <span class="b-icon">${ic(owned.includes(b.id) ? b.icon : 'lock')}</span><b>${b.name}</b><span class="small muted">${b.desc}</span>
    </div>`).join('')}</div>`;
}

ACT.flip = (a, b, el) => el.classList.toggle('on');

/* ---------- quiz ---------- */

ACT.answer = v => {
  if (Q.answered !== null || !QUIZ[Q.i]) return;
  Q.answered = (v === 1) === QUIZ[Q.i].scam;
  if (Q.answered) Q.score++;
  render();
};
ACT.nextQ = () => { Q.i++; Q.answered = null; render(); window.scrollTo(0, 0); };
ACT.quizReset = () => { Q = { i: 0, score: 0, answered: null }; render(); };

function viewQuiz() {
  if (Q.i >= QUIZ.length) {
    const s = Q.score, n = QUIZ.length;
    return `<div class="card lime"><span class="tag">Wynik</span><div class="score" style="margin-top:10px">${s}<span style="font-size:1.5rem">/${n}</span></div>
      <h2 style="margin-top:6px">${s === n ? 'Oszust nie ma z Tobą szans' : s >= n - 2 ? 'Czujne oko' : 'Uważaj na siebie w sieci'} ${ic(s === n ? 'shield' : s >= n - 2 ? 'magnifier' : 'warn')}</h2>
      <div class="row"><button class="btn dark" data-act="quizReset">Jeszcze raz</button><button class="btn" data-act="go" data-arg="game">Zagraj w symulator</button></div></div>
    <div class="card"><h3>Trzy zasady na zawsze</h3><ul class="flags">
      <li><strong>Zwolnij.</strong> Pośpiech to narzędzie oszusta. Prawdziwa sprawa poczeka 10 minut.</li>
      <li><strong>Sprawdź innym kanałem.</strong> Zadzwoń do znajomego, otwórz aplikację banku, wpisz adres ręcznie.</li>
      <li><strong>Nie podawaj kodów i danych karty</strong> przez link, telefon ani czat.</li></ul>
      <p class="small" style="margin:10px 0 0">Podejrzany SMS przekaż bezpłatnie na numer <strong>8080</strong>, a stronę zgłoś na <a href="https://incydent.cert.pl" target="_blank" rel="noopener noreferrer">incydent.cert.pl</a>. Jeśli straciłeś pieniądze, od razu zadzwoń do banku i zgłoś sprawę na policję.</p></div>`;
  }
  const q = QUIZ[Q.i], done = Q.answered !== null;
  return `
  <div class="row between" style="margin-bottom:10px"><h2 style="margin:0">Scam czy nie scam?</h2><span class="tag">${Q.i + 1} / ${QUIZ.length}</span></div>
  <div class="phone"><div class="from">${q.from}</div><div class="bubble">${q.text}</div>${q.ctx ? `<div class="ctx">${ic('info')} ${q.ctx}</div>` : ''}</div>
  ${done ? `
    <div class="card ${Q.answered ? 'good' : 'bad'}">
      <h3>${ic(Q.answered ? 'check' : 'cross')} ${Q.answered ? 'Dobrze!' : 'Pudło.'} ${q.scam ? 'To oszustwo.' : 'Ta wiadomość jest w porządku.'}</h3>
      <p>${q.why}</p><ul class="flags">${q.flags.map(f => `<li>${f}</li>`).join('')}</ul>
      <button class="btn dark block" style="margin-top:14px" data-act="nextQ">${Q.i + 1 < QUIZ.length ? 'Następna wiadomość →' : 'Zobacz wynik →'}</button>
    </div>` : `
    <div class="two"><button class="btn danger" data-act="answer" data-arg="1">${ic('warn')} Scam</button><button class="btn primary" data-act="answer" data-arg="0">${ic('check')} Wygląda OK</button></div>`}`;
}

/* ---------- słowniczek ---------- */

const GLOSSARY = [
  ['Brutto / netto', 'Brutto to kwota przed składkami i podatkiem, netto to pieniądze, które realnie trafiają na konto.'],
  ['Poduszka finansowa', 'Zapas pieniędzy na nagłe sytuacje, zwykle na 3–6 miesięcy wydatków.'],
  ['Procent składany', 'Odsetki naliczane także od wcześniej dopisanych odsetek.'],
  ['Inflacja', 'Wzrost cen. Przez inflację te same pieniądze z czasem kupują mniej.'],
  ['Lokata', 'Pieniądze oddane bankowi na określony czas w zamian za z góry ustalone odsetki.'],
  ['ETF', 'Fundusz notowany na giełdzie, który jednym zakupem daje udział w setkach lub tysiącach spółek.'],
  ['Podatek Belki', '19% podatku od zysków z lokat, kont oszczędnościowych i inwestycji.'],
  ['RRSO', 'Rzeczywista roczna stopa oprocentowania, czyli całkowity roczny koszt kredytu z opłatami.'],
  ['BFG', 'Bankowy Fundusz Gwarancyjny. Chroni pieniądze w bankach do równowartości 100 tys. euro.'],
  ['Phishing', 'Podszywanie się pod bank, kuriera lub znajomego, żeby wyłudzić dane albo pieniądze.']
];
function viewGlossary() {
  return `<h2 style="margin-top:34px">Słowniczek</h2>
  <dl class="card glossary">${GLOSSARY.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>`;
}

/* ---------- 3D: obracanie przeciąganiem ---------- */

const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Wspólna obsługa: przeciąganie obraca scenę, puszczenie daje bezwładność, bezczynność powolny obrót.
function spinner(scene, apply, opts) {
  const st = { rx: opts.rx || 0, ry: opts.ry || 0, vx: 0, vy: 0, drag: false, moved: 0, px: 0, py: 0 };
  // Opcjonalny zakres obrotu w poziomie (podium w rankingu nie obraca się tyłem do gracza).
  const clampY = y => (opts.minY === undefined ? y : clamp(y, opts.minY, opts.maxY));
  scene.addEventListener('pointerdown', e => {
    st.drag = true; st.moved = 0; st.px = e.clientX; st.py = e.clientY; st.vx = st.vy = 0;
    scene.setPointerCapture(e.pointerId);
  });
  scene.addEventListener('pointermove', e => {
    if (!st.drag) return;
    const dx = e.clientX - st.px, dy = e.clientY - st.py;
    st.px = e.clientX; st.py = e.clientY; st.moved += Math.abs(dx) + Math.abs(dy);
    st.vy = dx * 0.6; st.vx = opts.lockX ? 0 : -dy * 0.6;
    st.ry = clampY(st.ry + st.vy); st.rx = clamp(st.rx + st.vx, opts.minX ?? -80, opts.maxX ?? 80);
  });
  const up = () => { if (st.drag) { st.drag = false; if (st.moved < 6 && opts.tap) opts.tap(st); } };
  scene.addEventListener('pointerup', up);
  scene.addEventListener('pointercancel', () => { st.drag = false; });
  scene.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && opts.tap) { e.preventDefault(); opts.tap(st); } });
  (function loop() {
    if (!scene.isConnected) return;
    if (!st.drag) {
      st.ry = clampY(st.ry + st.vy); st.rx = clamp(st.rx + st.vx, opts.minX ?? -80, opts.maxX ?? 80);
      st.vy *= 0.95; st.vx *= 0.9;
      if (!calm && Math.abs(st.vy) < (opts.idle || 0)) st.vy = opts.idle;
    }
    apply(st);
    requestAnimationFrame(loop);
  })();
  return st;
}

function initCoin() {
  const scene = document.getElementById('coinScene'), coin = document.getElementById('coin3d');
  if (!scene || !coin) return;
  const layers = 9;
  let html = '';
  for (let i = 0; i < layers; i++) html += `<i class="rim" style="transform:translateZ(${i - (layers - 1) / 2}px)"></i>`;
  html += `<span class="side front" style="transform:translateZ(${layers / 2}px)">zł</span><span class="side back" style="transform:rotateY(180deg) translateZ(${layers / 2}px)">%</span>`;
  coin.innerHTML = html;
  let last = -1;
  spinner(scene, st => { coin.style.transform = `rotateX(${st.rx}deg) rotateY(${st.ry}deg)`; }, {
    rx: -12, ry: 25, idle: 0.5, minX: -50, maxX: 50,
    tap: st => {
      st.vy = 24;
      let i; do { i = Math.floor(Math.random() * FACTS.length); } while (i === last);
      last = i;
      document.getElementById('coinFact').innerHTML = ic('bulb') + ' ' + FACTS[i];
    }
  });
}

function initStacks() {
  const scene = document.getElementById('stacks');
  if (!scene) return;
  const stage = scene.querySelector('.stage');
  spinner(scene, st => { stage.style.transform = `rotateX(${st.rx}deg) rotateY(${st.ry}deg)`; }, { rx: -24, ry: -32, idle: 0.12, minX: -60, maxX: -8 });
}

function initTilt() {
  if (calm) return;
  document.querySelectorAll('.tilt').forEach(el => {
    el.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(600px) rotateX(${-y * 10}deg) rotateY(${x * 12}deg) translateY(-2px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

// Pierwsze wyświetlenie strony uruchamia game.js, gdy wszystkie pliki są już wczytane.
