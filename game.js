/* Ogarniam Kasę – symulator (szybka gra na 1–3 lata; tryb „Całe życie” jest w life.js): przebieg gry, inflacja, aktywa, podsumowania. Ładowane po app.js. */
'use strict';

const val = (x, s) => (typeof x === 'function' ? x(s) : x);
const signed = n => (n >= 0 ? '+' : '−') + zl(Math.abs(n));
const assetsSum = s => ASSETS.reduce((a, x) => a + s[x.id], 0);
const drawInflation = () => clamp(0.045 + randn() * 0.018, 0.015, 0.09);
const lenLabel = m => (LENGTHS.find(l => l[0] === m) || LENGTHS[0])[1];
const goalAmount = (goal, months) => goal.amount * months / 12;
const shuffled = arr => arr.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);

/* ---------- start gry ---------- */

ACT.pickChar = id => { if (CHARS.some(c => c.id === id)) { S = { phase: 'goal', charId: id, len: 12 }; render(); window.scrollTo(0, 0); } };
ACT.setLen = n => { if (LENGTHS.some(l => l[0] === n)) { S.len = n; render(); } };
ACT.startGame = goalId => startGame(S.charId, goalId, S.len);

function startGame(charId, goalId, months) {
  const c = CHARS.find(x => x.id === charId), goal = GOALS.find(x => x.id === goalId);
  if (!c || !goal || !LENGTHS.some(l => l[0] === months)) return;
  S = {
    phase: 'event', c, goal, months, month: 1,
    cash: c.start, save: 0, bonds: 0, etf: 0, stock: 0, crypto: 0,
    basis: { save: 0, bonds: 0, etf: 0, stock: 0, crypto: 0 }, depNet: 0,
    debt: 0, mood: 60, life: 1, step: 200, recurring: [], later: [], scams: 0,
    totalIn: 0, totalInReal: 0, pool: [], lastEvent: null, event: null, result: null,
    notes: [], lessons: [], heldCrash: false, saved: false, fresh: [], earned: [],
    price: 1, infl: drawInflation(), saveRate: SAVE_RATE, debtRate: DEBT_MONTHLY,
    wage: 1, bonus: 0, jobless: 0, extra: false, course: 0, courseDone: false, biz: false, ins: false, insUsed: false,
    gains: 0, inflLoss: 0, taxPaid: 0, hist: [{ n: c.start, r: c.start }],
    yearStartNet: c.start, yearStartPrice: 1, year: null, flash: '', lastFree: 0
  };
  payday();
  nextEvent();
  render();
  window.scrollTo(0, 0);
}

/* ---------- pieniądze ---------- */

function income(s) { return s.c.net * s.wage + s.bonus; }
function fixedSum(s) { return s.c.fixed.reduce((a, f) => a + f[1], 0) * s.price; }
function recurringSum(s) { return s.recurring.reduce((a, r) => a + r.amount, 0); }
function lifeCost(s) { return s.c.life[s.life] * s.price; }
function shiftPay(s) { return SHIFT[s.c.id] * s.wage; }
function available(s) { return s.cash + (s.extra ? shiftPay(s) : 0) - lifeCost(s); }
function liabilities(s) { return s.debt + s.recurring.filter(r => r.loan).reduce((a, r) => a + r.amount * r.left, 0); }
function netWorth(s) { return s.cash + assetsSum(s) - liabilities(s); }
function goalProgress(s) { return clamp((netWorth(s) - s.c.start) / (goalAmount(s.goal, s.months) * s.price), 0, 1); }

function payday() {
  const s = S;
  let pay = income(s);
  if (s.jobless > 0) {
    pay = 0; s.jobless--;
    s.notes.push(`${ic('warn')} Brak dochodu w tym miesiącu${s.jobless ? '' : '. Od przyszłego miesiąca znowu zarabiasz'}.`);
  }
  let biz = 0;
  if (s.biz) {
    biz = Math.max(0, Math.round(320 + randn() * 220));
    s.mood = clamp(s.mood - 1, 0, 100);
    s.notes.push(`${ic('shop')} Biznes po godzinach: <span class="pos">+${zl(biz)}</span>`);
  }
  if (s.course > 0) {
    s.course--;
    if (s.course === 0) {
      const up = Math.max(150, s.c.net * 0.08);
      s.bonus += up; s.courseDone = true;
      s.notes.push(`${ic('book')} Kurs ukończony. Zarabiasz o <span class="pos">${zl(up)}</span> więcej co miesiąc.`);
    }
  }
  const ins = s.ins ? INS_COST * s.price : 0;
  const free = pay + biz - fixedSum(s) - ins;
  s.cash += free;
  s.totalIn += free;
  s.totalInReal += free / s.price;
  s.lastFree = free - recurringSum(s);
  s.recurring.forEach(r => { s.cash -= r.amount; r.left--; });
  s.recurring = s.recurring.filter(r => r.left > 0);
  s.later = s.later.filter(l => {
    if (--l.left > 0) return true;
    if (l.ok) { s.cash += l.amount; s.notes.push(`${ic('check')} Kolega oddał pożyczone ${zl(l.amount)}.`); }
    else { s.notes.push(`${ic('cross')} Kolega nie oddał ${zl(l.amount)} i przestał odpisywać.`); s.lessons.push('Pożyczka dla znajomego bez terminu i bez planu często kończy się stratą pieniędzy i znajomości.'); }
    return false;
  });
}

function nextEvent() {
  const s = S;
  let ev = null, guard = 0;
  while (!ev && guard++ < 100) {
    if (!s.pool.length) s.pool = shuffled(EVENTS.map(e => e.id).filter(id => id !== s.lastEvent));
    const id = s.pool.shift();
    const cand = EVENTS.find(e => e.id === id);
    if (cand && (!cand.cond || cand.cond(s))) ev = cand;
  }
  s.event = ev || EVENTS.find(e => e.id === 'fucha');
  s.lastEvent = s.event.id;
  if (s.event.pre) s.event.pre(s);
  s.result = null;
  s.phase = 'event';
}

ACT.pick = i => {
  const s = S, ch = s.event && s.event.choices[i];
  if (!ch || s.result || s.phase !== 'event') return;
  const cost = val(ch.cost, s);
  if (cost && s.cash < cost) return;
  const [text, lesson, tone] = ch.run(s);
  if (s.event.id === 'krach' && i === 1) s.heldCrash = true;
  ASSETS.forEach(a => { if (s[a.id] <= 0) { s[a.id] = 0; s.basis[a.id] = 0; } });
  s.mood = clamp(s.mood, 0, 100);
  s.result = { text, lesson, tone };
  if (tone === 'bad') s.lessons.push(lesson);
  render();
};

ACT.toBudget = () => { S.phase = 'budget'; S.flash = ''; render(); window.scrollTo(0, 0); };

/* ---------- budżet ---------- */

ACT.setLife = i => { if (LIFE[i]) { S.life = i; render(); } };
/* Kwota wpłaty i wypłaty wpisywana przez gracza. Bez render(), żeby pole nie traciło fokusu. */
const STEP_MAX = 10000000;
document.addEventListener('input', e => {
  if (e.target.id !== 'stepIn' || !S) return;
  const v = Math.floor(+e.target.value);
  S.step = Number.isFinite(v) && v > 0 ? Math.min(v, STEP_MAX) : 0;
});
ACT.toggleExtra = () => { if (S.jobless === 0) { S.extra = !S.extra; render(); } };
ACT.toggleIns = () => { S.ins = !S.ins; render(); };
ACT.buyCourse = () => {
  const s = S;
  if (s.course > 0 || s.courseDone || available(s) < COURSE_COST) return;
  s.cash -= COURSE_COST; s.course = 3;
  s.flash = 'Zapisałeś się na kurs. Efekt zobaczysz za 3 miesiące.';
  render();
};
ACT.startBiz = () => {
  const s = S;
  if (s.biz || available(s) < BIZ_COST) return;
  s.cash -= BIZ_COST; s.biz = true;
  s.flash = 'Biznes ruszył. Pierwsze pieniądze wpadną w przyszłym miesiącu.';
  render();
};

ACT.move = (id, dir) => {
  const s = S, a = ASSETS.find(x => x.id === id);
  if (!a || s.phase !== 'budget') return;
  s.flash = '';
  if (dir > 0) {
    const amt = Math.min(s.step, Math.max(0, available(s)));
    if (amt <= 0) { if (!s.step) { s.flash = 'Najpierw wpisz kwotę.'; render(); } return; }
    s.cash -= amt; s[id] += amt; s.basis[id] += amt; s.depNet += amt;
  } else {
    const amt = Math.min(s.step, s[id]);
    if (amt <= 0) { if (!s.step) { s.flash = 'Najpierw wpisz kwotę.'; render(); } return; }
    const frac = amt / s[id];
    const gain = amt - s.basis[id] * frac;
    const tax = a.taxed && gain > 0 ? gain * BELKA : 0;
    const fee = amt * (a.fee || 0);
    s.basis[id] *= 1 - frac;
    s[id] -= amt; s.depNet -= amt;
    s.cash += amt - tax - fee;
    s.taxPaid += tax;
    if (s[id] < 0.5) { s[id] = 0; s.basis[id] = 0; }
    if (tax > 0) s.flash = `Sprzedaż z zyskiem ${zl(gain)}: podatek Belki zabrał ${zl(tax)}.`;
    else if (fee > 0) s.flash = `Wcześniejsza wypłata z obligacji kosztowała ${zl(fee)}.`;
    else if (a.taxed && gain < 0) s.flash = `Sprzedaż ze stratą ${zl(-gain)}. Podatku nie ma, ale strata jest już prawdziwa.`;
  }
  render();
};

ACT.repay = () => {
  const s = S;
  const amt = Math.min(s.step, Math.max(0, available(s)), s.debt);
  s.cash -= amt; s.debt -= amt;
  if (s.debt < 1) s.debt = 0;
  render();
};

ACT.endMonth = () => {
  const s = S;
  if (s.phase !== 'budget') return;
  s.notes = [];
  s.flash = '';
  if (s.extra) {
    const p = shiftPay(s);
    s.cash += p; s.totalIn += p; s.totalInReal += p / s.price;
    s.mood -= 5; s.extra = false;
  }
  s.cash -= lifeCost(s);
  s.mood = clamp(s.mood + LIFE[s.life].mood, 0, 100);

  const mInfl = Math.pow(1 + s.infl, 1 / 12) - 1;
  ASSETS.forEach(a => {
    if (s[a.id] <= 0) return;
    const r = a.ret(s), gain = s[a.id] * r;
    s.inflLoss += s[a.id] * mInfl;
    s[a.id] = Math.max(0, s[a.id] + gain);
    s.gains += gain;
    if (Math.abs(gain) >= 1) s.notes.push(`${ic(a.icon)} ${a.name}: <span class="${gain >= 0 ? 'pos' : 'neg'}">${signed(gain)}</span>${a.risk ? ` (${(r * 100).toFixed(1).replace('.', ',')}%)` : ''}`);
  });
  if (s.debt > 0) {
    const cost = s.debt * s.debtRate;
    s.debt += cost;
    s.notes.push(`${ic('warn')} Dług urósł o <span class="neg">${zl(cost)}</span>`);
  }
  if (s.cash < 0) {
    const hole = -s.cash;
    s.debt += hole * 1.1;
    s.cash = 0;
    s.notes.push(`${ic('warn')} Zabrakło ${zl(hole)}. Brak pokryła chwilówka z prowizją 10%.`);
    s.lessons.push('Gdy wydajesz więcej, niż masz, różnicę pokrywa najdroższy możliwy dług.');
  }
  s.price *= 1 + mInfl;
  s.hist.push({ n: netWorth(s), r: netWorth(s) / s.price });

  if (s.month >= s.months) { s.phase = 'end'; finishGame(s); }
  else if (s.month % 12 === 0) {
    const yInfl = s.price / s.yearStartPrice - 1, net = netWorth(s);
    s.year = { n: s.month / 12, infl: yInfl, netStart: s.yearStartNet, netEnd: net, real: net / (1 + yInfl) - s.yearStartNet, result: null };
    s.phase = 'year';
  } else { s.month++; payday(); nextEvent(); }
  render();
  window.scrollTo(0, 0);
};

/* ---------- podsumowanie roku i rozmowa o podwyżce ---------- */

ACT.yearPick = i => {
  const s = S, y = s.year;
  if (s.phase !== 'year' || !y || y.result) return;
  if (i === 0) {
    if (Math.random() < 0.6) {
      const up = y.infl + 0.03; s.wage *= 1 + up;
      y.result = [`Udało się: podwyżka o ${pct(up)}. To więcej niż inflacja, więc realnie zarabiasz więcej.`, 'Podwyżka poniżej inflacji to w praktyce obniżka. Na rozmowę warto przyjść z liczbami.', 'good'];
    } else {
      s.mood -= 4;
      y.result = ['Tym razem odmowa. Dochód zostaje bez zmian, a ceny już nie.', 'Odmowa nic nie kosztuje, a brak pytania kosztuje na pewno. Spróbuj znowu za kilka miesięcy albo rozejrzyj się na rynku.', 'neutral'];
    }
  } else if (i === 1) {
    s.mood -= 3;
    if (Math.random() < 0.5) { s.wage *= 1.15; y.result = ['Nowe zajęcie od ręki i 15% więcej pieniędzy.', 'Zmiana pracy zwykle daje większy skok dochodu niż podwyżka w tym samym miejscu.', 'good']; }
    else { s.wage *= 1.05; s.jobless = 1; y.result = ['Szukanie zajęło miesiąc bez dochodu. Nowe zajęcie daje 5% więcej.', 'Zmiana pracy ma swój koszt przejścia. Z poduszką finansową taki miesiąc nie boli.', 'neutral']; }
  } else {
    s.wage *= 1.01; s.mood += 1;
    y.result = [`Dochód rośnie symbolicznie o 1%, a ceny wzrosły o ${pct(y.infl)}. Realnie zarabiasz mniej niż rok temu.`, 'Jeśli dochód stoi, a ceny rosną, co roku stać Cię na mniej. To cichy koszt inflacji.', 'bad'];
    s.lessons.push(y.result[1]);
  }
  s.mood = clamp(s.mood, 0, 100);
  render();
};

ACT.yearNext = () => {
  const s = S;
  if (s.phase !== 'year' || !s.year || !s.year.result) return;
  s.infl = drawInflation();
  s.yearStartNet = netWorth(s);
  s.yearStartPrice = s.price;
  s.year = null;
  s.month++;
  payday();
  nextEvent();
  render();
  window.scrollTo(0, 0);
};

ACT.restart = (ask, _, el) => {
  // Potwierdzenie drugim kliknięciem zamiast okna confirm(), które część przeglądarek blokuje.
  if (ask && el && el.dataset.sure !== '1') {
    el.dataset.sure = '1';
    el.textContent = 'Na pewno?';
    el.classList.add('on');
    setTimeout(() => { if (el.isConnected) { el.dataset.sure = ''; el.textContent = 'Od nowa'; el.classList.remove('on'); } }, 3000);
    return;
  }
  S = { phase: 'pick' };
  render();
  window.scrollTo(0, 0);
};

/* ---------- wynik ---------- */

function scoreOf(s) {
  const realNet = netWorth(s) / s.price;
  const rate = s.totalInReal > 0 ? (realNet - s.c.start) / s.totalInReal : 0;
  const wealth = clamp(rate / 0.5, 0, 1) * 50;
  const mood = s.mood / 100 * 30;
  const safety = Math.max(0, 20 - 7 * s.scams - (liabilities(s) > 0 ? 6 : 0));
  const total = Math.round(wealth + mood + safety);
  const title = total >= 80 ? 'Finansowy ninja' : total >= 60 ? 'Ogarniacz' : total >= 40 ? 'Na styk' : 'Bankrut z klasą';
  const ticon = total >= 80 ? 'ninja' : total >= 60 ? 'smile' : total >= 40 ? 'meh' : 'sad';
  return { total, title, ticon, wealth: Math.round(wealth), mood: Math.round(mood), safety, rate, realNet };
}

function earnedBadges(s) {
  const sc = scoreOf(s), monthlyCost = fixedSum(s) + s.c.life[1] * s.price;
  const out = [];
  if (s.scams === 0) out.push('czysto');
  if (liabilities(s) <= 0) out.push('bezdlugu');
  if (s.cash + s.save + s.bonds >= 3 * monthlyCost) out.push('poduszka');
  if (s.heldCrash) out.push('nerwy');
  if (goalProgress(s) >= 1) out.push('cel');
  if (sc.rate >= 0.3 && s.mood >= 65) out.push('balans');
  if (sc.total >= 80) out.push('ninja');
  if (s.gains > 0 && s.gains > s.inflLoss) out.push('inflacja');
  if (s.months >= 36) out.push('maraton');
  if (s.courseDone) out.push('kurs');
  if (s.insUsed) out.push('polisa');
  return out;
}

function finishGame(s) {
  if (s.saved) return;
  s.saved = true;
  s.earned = earnedBadges(s);
  s.fresh = s.earned.filter(id => !STORE.badges.includes(id));
  const total = scoreOf(s).total, prev = STORE.best[s.months] || 0;
  s.record = total > prev && prev > 0;
  STORE = {
    best: Object.assign({}, STORE.best, { [s.months]: Math.max(prev, total) }),
    games: STORE.games + 1,
    badges: BADGES.map(b => b.id).filter(id => STORE.badges.includes(id) || s.earned.includes(id))
  };
  saveStore(STORE);
}

/* ---------- widoki ---------- */

function hud(s) {
  const gp = goalProgress(s), safe = s.save + s.bonds, risky = s.etf + s.stock + s.crypto;
  const done = s.phase === 'end' || s.phase === 'year' ? s.month : s.month - 1;
  return `
  <div class="hud static">
    <div class="row between small" style="font-weight:700;margin-bottom:6px">
      <span>${ic(s.c.face)} Miesiąc ${s.month} z ${s.months}</span>
      <button class="chip" data-act="restart" data-arg="1">Od nowa</button>
    </div>
    <div class="progress"><i style="width:${done / s.months * 100}%"></i></div>
  </div>
  <div class="hud hud-money${s.phase === 'end' ? ' static' : ''}">
    <div class="money">
      <div><span>Konto</span><b>${zl(s.cash)}</b></div>
      <div><span>Bezpieczne</span><b>${zl(safe)}</b></div>
      <div><span>Inwestycje</span><b>${zl(risky)}</b></div>
      ${liabilities(s) > 0 ? `<div class="debt"><span>Długi i raty</span><b>${zl(liabilities(s))}</b></div>` : ''}
    </div>
  </div>
  <div class="hud static hud-bars">
    <div class="mood"><span>${ic('smile')} Zadowolenie</span><div class="progress"><i style="width:${s.mood}%"></i></div><span>${Math.round(s.mood)}</span></div>
    <div class="mood goal"><span>${ic(s.goal.icon)} ${s.goal.name}</span><div class="progress"><i style="width:${gp * 100}%"></i></div><span>${Math.round(gp * 100)}%</span></div>
    <div class="infl small">${ic('price')} Ceny <b>+${pct(s.price - 1)}</b> od startu · inflacja w tym roku ok. <b>${pct(s.infl)}</b></div>
  </div>`;
}

function payslip(s) {
  const rows = s.c.slip.map(([l, a]) => `<tr><td>${l}</td><td class="${a < 0 ? 'neg' : ''}">${a < 0 ? '−' + zl(-a) : zl(a)}</td></tr>`).join('');
  const fixed = s.c.fixed.map(([l, a]) => `<tr><td>${l}</td><td class="neg">−${zl(a)}</td></tr>`).join('');
  return `<table class="payslip">${rows}${fixed}
    <tr class="total"><td>Zostaje do dyspozycji</td><td>${zl(s.lastFree)}</td></tr></table>`;
}

function resultCard(r, act, label) {
  const [text, lesson, tone] = Array.isArray(r) ? r : [r.text, r.lesson, r.tone];
  return `<div class="card ${tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : ''}">
    <p><strong>${text}</strong></p><p class="small">${ic('bulb')} ${lesson}</p>
    <button class="btn dark block" data-act="${act}">${label}</button></div>`;
}

function viewGame() {
  const s = S;
  if (s.mode === 'life') return viewLife(s);
  if (s.phase === 'pick') {
    return `<h2>Całe życie</h2><p class="muted">Od studenta do emerytury. Jedna tura to jeden rok, a decyzji jest więcej: kariera, mieszkanie, rodzina i odkładanie na starość.</p>
    <div class="chars" style="margin-bottom:26px">
      <button class="card char lime" data-act="startLife">
        <span class="face">${ic('calendar')}</span>
        <span><h3>Od 20. do 65. roku życia</h3><span class="muted small">45 tur. Zmieniasz pracę i branżę, kupujesz mieszkanie, inwestujesz przez dekady i sprawdzasz, jaką będziesz mieć emeryturę. Ok. 20 minut.</span></span>
      </button></div>
    <h2>Szybka gra: kim grasz?</h2><p class="muted">Od roku do trzech lat, miesiąc po miesiącu. Każda postać ma inne dochody i inne problemy.
    <div class="chars">${CHARS.map(c => `
      <button class="card char" data-act="pickChar" data-arg="${c.id}">
        <span class="face">${ic(c.face)}</span>
        <span><h3>${c.name}</h3><span class="muted small">${c.desc}</span></span>
      </button>`).join('')}</div>`;
  }
  if (s.phase === 'goal') {
    return `<h2>Jak długo grasz?</h2>
    <p class="muted">W dłuższej grze mocniej widać inflację, podwyżki i procent składany.</p>
    <div class="chips" style="margin-bottom:22px">${LENGTHS.map(([m, l]) => `<button class="chip big ${s.len === m ? 'on' : ''}" data-act="setLen" data-arg="${m}">${l}</button>`).join('')}</div>
    <h2>Na co odkładasz?</h2><p class="muted">Liczy się to, co odłożysz ponad kwotę ze startu. Cel drożeje razem z inflacją.</p>
    <div class="chars">${GOALS.map(g => `
      <button class="card char" data-act="startGame" data-arg="${g.id}">
        <span class="face">${ic(g.icon)}</span>
        <span><h3>${g.name}</h3><span class="muted small">Do uzbierania: ${zl(goalAmount(g, s.len))}</span></span>
      </button>`).join('')}</div>
    <button class="btn sm" data-act="restart">← Zmień postać</button>`;
  }
  if (s.phase === 'end') return viewEnd(s);
  if (s.phase === 'year') return viewYear(s);

  if (s.phase === 'event') {
    const e = s.event;
    const intro = s.month === 1
      ? `<div class="card violet flat"><span class="tag">Dzień wypłaty</span>${payslip(s)}<p class="small" style="margin:10px 0 0">${ic('bulb')} ${s.c.tip}</p></div>`
      : `<div class="card flat"><span class="tag">Nowy miesiąc</span>
          <ul class="notes" style="margin-top:8px"><li>${ic('cash')} Wpływ po stałych kosztach: <span class="${s.lastFree >= 0 ? 'pos' : 'neg'}">${signed(s.lastFree)}</span></li>${s.notes.map(n => `<li>${n}</li>`).join('')}</ul></div>`;
    const body = s.result
      ? resultCard(s.result, 'toBudget', 'Dalej: budżet miesiąca →')
      : `<div class="stack">${e.choices.map((c, i) => {
          const cost = val(c.cost, s), off = cost && s.cash < cost;
          return `<button class="btn block" ${off ? 'disabled' : ''} data-act="pick" data-arg="${i}">${val(c.label, s)}${cost ? ` <span class="muted small">(${zl(cost)})</span>` : ''}${off ? ' <span class="small">– nie stać Cię</span>' : ''}</button>`;
        }).join('')}</div>`;
    return hud(s) + intro + `
      <div class="card event"><div class="icon">${ic(e.icon)}</div><h2 style="margin-top:8px">${val(e.title, s)}</h2><p>${val(e.text, s)}</p>${body}</div>`;
  }
  return hud(s) + viewBudget(s);
}

/* Na telefonie sekcja „Dochód i ochrona” jest zwijana (mobile.css), żeby budżet był krótszy.
   Na komputerze przycisk i podsumowanie mają atrybut hidden, a sekcja jest zawsze widoczna. */
let foldOpen = false;
ACT.fold = () => { foldOpen = !foldOpen; render(); };
function foldSummary(s) {
  const mark = (label, on) => (on ? `<b>${label} ✓</b>` : label);
  return [
    mark('dodatkowa zmiana', s.extra),
    mark('kurs', s.courseDone || s.course > 0),
    mark('biznes po godzinach', s.biz),
    mark('ubezpieczenie', s.ins)
  ].join(', ');
}

function viewBudget(s) {
  const av = available(s);
  const extras = `
    <div class="acct"><div><b>${ic('clock')} Dodatkowa zmiana</b><br><span class="small muted">+${zl(shiftPay(s))} w tym miesiącu, zadowolenie −5</span></div>
      <button class="btn sm ${s.extra ? 'primary' : ''}" data-act="toggleExtra" ${s.jobless > 0 ? 'disabled' : ''}>${s.extra ? 'Wzięta ✓' : 'Biorę'}</button></div>
    <div class="acct"><div><b>${ic('book')} Kurs z certyfikatem</b><br><span class="small muted">${s.courseDone ? 'ukończony, dochód wyższy na stałe' : s.course > 0 ? `w trakcie, zostało: ${s.course} mies.` : `${zl(COURSE_COST)} teraz, po 3 miesiącach trwale wyższy dochód`}</span></div>
      ${s.courseDone || s.course > 0 ? '' : `<button class="btn sm" data-act="buyCourse" ${av < COURSE_COST ? 'disabled' : ''}>Zapisuję się</button>`}</div>
    <div class="acct"><div><b>${ic('shop')} Mały biznes po godzinach</b><br><span class="small muted">${s.biz ? 'działa: co miesiąc ok. 100–550 zł, zadowolenie −1' : `${zl(BIZ_COST)} na start, potem zmienny dochód co miesiąc`}</span></div>
      ${s.biz ? '' : `<button class="btn sm" data-act="startBiz" ${av < BIZ_COST ? 'disabled' : ''}>Zaczynam</button>`}</div>
    <div class="acct"><div><b>${ic('umbrella')} Ubezpieczenie rzeczy</b><br><span class="small muted">${zl(INS_COST * s.price)} miesięcznie, pokrywa 80% strat przy kradzieży, awarii i zalaniu</span></div>
      <button class="btn sm ${s.ins ? 'primary' : ''}" data-act="toggleIns">${s.ins ? 'Mam ✓' : 'Kupuję'}</button></div>`;
  const assets = ASSETS.map(a => `
    <div class="acct"><div><b>${ic(a.icon)} ${a.name}</b> <span class="tag risk r${a.risk}">${RISK[a.risk]}</span><br>
      <span class="small muted">${a.hint(s)} · masz <b>${zl(s[a.id])}</b></span></div>
      <div class="row"><button class="btn sm" data-act="move" data-arg="${a.id}" data-arg2="-1" ${s[a.id] <= 0 ? 'disabled' : ''}>Wypłać</button><button class="btn sm primary" data-act="move" data-arg="${a.id}" data-arg2="1" ${av <= 0 ? 'disabled' : ''}>Wpłać</button></div></div>`).join('');
  const last = s.month >= s.months, yearEnd = !last && s.month % 12 === 0;
  return `
  <div class="card">
    <span class="tag lime">Budżet miesiąca</span>
    <h3 style="margin-top:10px">Jak żyjesz w tym miesiącu?</h3>
    <div class="life">${LIFE.map((l, i) => `
      <button class="btn ${s.life === i ? 'on' : ''}" data-act="setLife" data-arg="${i}">${l.name}<small>${zl(s.c.life[i] * s.price)}</small><small>${ic(l.mood > 0 ? 'smile' : l.mood < 0 ? 'sad' : 'meh')} ${l.mood > 0 ? '+' + l.mood : l.mood}</small></button>`).join('')}</div>
    <p style="margin-top:14px">Po wydatkach na życie zostaje: <strong class="${av < 0 ? 'neg' : ''}">${zl(av)}</strong></p>
    ${av < 0 ? `<p class="small neg"><strong>Brakuje ${zl(-av)}.</strong> Wybierz tańszy styl życia, weź dodatkową zmianę albo wypłać z oszczędności, inaczej brak pokryje droga chwilówka.</p>` : ''}
    ${s.flash ? `<p class="flash small">${ic('info')} ${s.flash}</p>` : ''}

    <div class="fold${foldOpen ? ' open' : ''}">
      <div class="fold-head"><h3 style="margin-top:16px">Dochód i ochrona</h3><button class="chip m-only" hidden data-act="fold" aria-expanded="${foldOpen}">${foldOpen ? 'Zwiń' : 'Pokaż'}</button></div>
      <p class="fold-sum small muted m-only" hidden>${foldSummary(s)}</p>
      <div class="fold-body">${extras}</div>
    </div>

    <h3 style="margin-top:20px">Gdzie trzymasz pieniądze?</h3>
    <label class="amt">Kwota wpłaty lub wypłaty (zł)
      <input type="number" id="stepIn" inputmode="numeric" min="1" step="1" value="${s.step || ''}" placeholder="np. 300"></label>
    <p class="small muted" style="margin:4px 0 6px">Wpisz dowolną kwotę. Jeśli będzie większa niż to, co masz, przeniesie się wszystko.</p>
    ${assets}
    ${s.debt > 0 ? `<div class="acct"><div><b>${ic('warn')} Dług: ${zl(s.debt)}</b><br><span class="small neg">rośnie o ${pct(s.debtRate)} miesięcznie</span></div>
      <button class="btn sm danger" data-act="repay" ${av <= 0 ? 'disabled' : ''}>Spłać</button></div>` : ''}
    <button class="btn dark block" style="margin-top:16px" data-act="endMonth">${last ? 'Zakończ grę i zobacz wynik →' : yearEnd ? 'Zakończ miesiąc i podsumuj rok →' : 'Zakończ miesiąc →'}</button>
  </div>`;
}

function viewYear(s) {
  const y = s.year, basket = 1000 * (1 + y.infl);
  return hud(s) + `
  <div class="card violet">
    <span class="tag violet">${ic('calendar')} Rok ${y.n} za Tobą</span>
    <h2 style="margin-top:10px">Podsumowanie roku</h2>
    <table class="payslip">
      <tr><td>Inflacja w tym roku</td><td>${pct(y.infl)}</td></tr>
      <tr><td>Zakupy, które rok temu kosztowały 1000 zł</td><td>${zl(basket)}</td></tr>
      <tr><td>Majątek na początku roku</td><td>${zl(y.netStart)}</td></tr>
      <tr><td>Majątek teraz</td><td>${zl(y.netEnd)}</td></tr>
      <tr class="total"><td>Zmiana po odjęciu inflacji</td><td class="${y.real >= 0 ? 'pos' : 'neg'}">${signed(y.real)}</td></tr>
    </table>
    <p class="small" style="margin:10px 0 0">${ic('bulb')} Twój miesięczny dochód to teraz ${zl(income(s))}. Jeśli nie rośnie co najmniej o inflację, realnie maleje.</p>
  </div>
  <div class="card event"><div class="icon">${ic('briefcase')}</div><h2 style="margin-top:8px">Co robisz z dochodem?</h2>
    <p>Nowy rok to dobry moment, żeby zawalczyć o więcej.</p>
    ${y.result ? resultCard(y.result, 'yearNext', `Zaczynam rok ${y.n + 1} →`) : `<div class="stack">
      <button class="btn block" data-act="yearPick" data-arg="0">Proszę o podwyżkę</button>
      <button class="btn block" data-act="yearPick" data-arg="1">Szukam lepiej płatnego zajęcia</button>
      <button class="btn block" data-act="yearPick" data-arg="2">Zostawiam, jak jest</button></div>`}
  </div>`;
}

function histChart(s, step = 12) {
  const W = 300, H = 110, pad = 6, h = s.hist;
  const all = h.flatMap(p => [p.n, p.r]), lo = Math.min(...all), hi = Math.max(...all, lo + 1);
  const x = i => pad + i / Math.max(1, h.length - 1) * (W - 2 * pad);
  const y = v => H - pad - (v - lo) / (hi - lo) * (H - 2 * pad);
  const line = key => h.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  let grid = '';
  for (let m = step; m < h.length - 1; m += step) grid += `<line class="grid" x1="${x(m)}" y1="${pad}" x2="${x(m)}" y2="${H - pad}"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${grid}
    <polyline class="nom" points="${line('n')}"/><polyline class="real" points="${line('r')}"/></svg>`;
}

function viewEnd(s) {
  const sc = scoreOf(s), net = netWorth(s);
  const assets = Math.max(0, s.cash + assetsSum(s));
  const monthly = Math.max(0, (net - s.c.start) / s.months);
  const sock = fv(assets, monthly, 0, 5), bank = fv(assets, monthly, SAVE_RATE, 5), etf = fv(assets, monthly, ETF_RATE, 5);
  const max = Math.max(etf, 1);
  const stack = (cls, v) => `<div class="stk ${cls}" style="--h:${Math.max(10, Math.round(v / max * 150))}px"><i class="f1"></i><i class="f2"></i><i class="f3"></i><i class="f4"></i><i class="top"></i></div>`;
  const leg = (cls, label, v) => `<li><i class="dot ${cls}"></i><span>${label}</span><b>${zl(v)}</b></li>`;
  const lessons = [...new Set(s.lessons)].slice(0, 5);
  const debt = liabilities(s), gp = goalProgress(s);
  return hud(s) + `
  <div class="card lime">
    <span class="tag">Twój wynik · ${lenLabel(s.months)}</span>${s.record ? ' <span class="tag violet">Nowy rekord</span>' : ''}
    <div class="score" style="margin-top:10px">${sc.total}<span style="font-size:1.5rem">/100</span></div>
    <h2 style="margin-top:6px">${sc.title} ${ic(sc.ticon)}</h2>
    <p>Majątek netto: <strong>${zl(net)}</strong> (na starcie: ${zl(s.c.start)})</p>
    <p>${ic(s.goal.icon)} ${s.goal.name}: <strong>${gp >= 1 ? 'cel osiągnięty!' : 'uzbierane ' + Math.round(gp * 100) + '% z ' + zl(goalAmount(s.goal, s.months) * s.price)}</strong></p>
    <div class="row">
      <button class="btn dark" data-act="share">Udostępnij wynik</button>
      <button class="btn" data-act="restart">Zagraj jeszcze raz</button>
    </div>
    <p class="small" id="shareMsg" style="margin:10px 0 0"></p>
  </div>

  ${rankForm(s, s.months)}

  <div class="card">
    <h3>${ic('price')} Co zrobiła inflacja?</h3>
    <p class="small muted">Przez ${s.months} miesięcy ceny wzrosły o ${pct(s.price - 1)}. Fioletowa linia to majątek w złotówkach, zielona to jego siła nabywcza w cenach ze startu.</p>
    ${histChart(s)}
    <ul class="legend">
      <li><i class="dot s2"></i><span>Majątek nominalny</span><b>${zl(net)}</b></li>
      <li><i class="dot s1"></i><span>Majątek realny (po inflacji)</span><b>${zl(sc.realNet)}</b></li>
    </ul>
    <table class="payslip" style="margin-top:10px">
      <tr><td>Zyski i odsetki z oszczędności i inwestycji</td><td class="${s.gains >= 0 ? 'pos' : 'neg'}">${signed(s.gains)}</td></tr>
      <tr><td>Tyle „zjadła” z nich inflacja</td><td class="neg">−${zl(s.inflLoss)}</td></tr>
      <tr><td>Zapłacony podatek Belki</td><td>${zl(s.taxPaid)}</td></tr>
    </table>
  </div>

  <div class="card">
    <h3>Odznaki z tej rozgrywki</h3>
    ${s.fresh.length ? `<p class="small pos"><strong>Nowe odznaki: ${s.fresh.length}</strong></p>` : ''}
    ${badgeGrid(s.earned || [], s.fresh)}
  </div>

  <div class="card">
    <h3>Skąd ten wynik?</h3>
    <table class="payslip">
      <tr><td>${ic('cash')} Realnie odłożone pieniądze (${Math.round(clamp(sc.rate, -9, 9) * 100)}% dochodu do dyspozycji)</td><td>${sc.wealth}/50</td></tr>
      <tr><td>${ic('smile')} Zadowolenie z życia</td><td>${sc.mood}/30</td></tr>
      <tr><td>${ic('shield')} Bezpieczeństwo (scamy: ${s.scams}, długi: ${debt > 0 ? 'tak' : 'nie'})</td><td>${sc.safety}/20</td></tr>
    </table>
  </div>

  <div class="card">
    <h3>A gdybyś robił tak dalej przez 5 lat?</h3>
    <p class="small muted">Masz ${zl(assets)} i odkładasz średnio ${zl(monthly)} miesięcznie. Te same pieniądze w trzech miejscach. Przeciągnij, żeby obrócić.</p>
    <div class="scene3d" id="stacks" aria-hidden="true"><div class="stage"><div class="floor"></div>${stack('s0', sock)}${stack('s1', bank)}${stack('s2', etf)}</div></div>
    <ul class="legend">
      ${leg('s0', 'W skarpecie (0%)', sock)}
      ${leg('s1', 'Konto oszczędnościowe (ok. 3,2% na rękę)', bank)}
      ${leg('s2', 'ETF (założenie: średnio 6% rocznie, bez gwarancji)', etf)}
    </ul>
    <p class="small" style="margin-top:12px">Różnica między skarpetą a ETF: <strong>${zl(etf - sock)}</strong>. To pieniądze, które zarabia procent składany, czyli odsetki od odsetek.</p>
    ${s.debt > 0 ? `<p class="small neg"><strong>Uwaga na dług:</strong> ${zl(s.debt)} niespłacane przez rok urosłoby do ${zl(s.debt * Math.pow(1 + s.debtRate, 12))}. Procent składany działa też przeciwko Tobie.</p>` : ''}
  </div>

  ${lessons.length ? `<div class="card bad"><h3>Czego nauczyła Cię ta gra</h3><ul class="flags">${lessons.map(l => `<li>${l}</li>`).join('')}</ul></div>` : `<div class="card good"><h3>Czysta gra</h3><p style="margin:0">Żadnej wpadki. Sprawdź się jeszcze w rozpoznawaniu oszustw.</p></div>`}

  <div class="row">
    <button class="btn primary" data-act="go" data-arg="quiz">Scam czy nie scam? →</button>
    <button class="btn" data-act="go" data-arg="lessons">Lekcje w 2 minuty</button>
  </div>`;
}

ACT.share = () => {
  const life = S.mode === 'life', sc = life ? lifeScore(S) : scoreOf(S);
  const text = life
    ? `Ogarniam Kasę (całe życie): w wieku 65 lat mam ${zl(sc.net)} i wynik ${sc.total}/100 (${sc.title}). Dasz radę lepiej?`
    : `Ogarniam Kasę (${lenLabel(S.months)}): mam ${zl(netWorth(S))} i wynik ${sc.total}/100 (${sc.title}). Dasz radę lepiej?`;
  const url = location.protocol === 'https:' ? location.origin + location.pathname : '';
  const msg = document.getElementById('shareMsg');
  if (navigator.share) { navigator.share({ text, url: url || undefined }).catch(() => {}); return; }
  const full = url ? text + ' ' + url : text;
  (navigator.clipboard ? navigator.clipboard.writeText(full) : Promise.reject())
    .then(() => { msg.textContent = 'Skopiowano do schowka. Wklej w wiadomości albo w relacji.'; })
    .catch(() => { msg.textContent = full; });
};

/* ---------- start strony ---------- */

render();
