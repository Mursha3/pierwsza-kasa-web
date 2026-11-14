/* Ogarniam Kasę – tryb „Całe życie”: od studenta (20 lat) do emerytury (65 lat).
   Jedna tura to jeden rok. Wszystkie kwoty są w dzisiejszych cenach, czyli po odjęciu inflacji,
   dlatego gotówka z roku na rok traci, a stopy zwrotu to zysk ponad inflację.
   Ładowane po app.js i rank.js, przed game.js. */
'use strict';

const L_START = 20, L_END = 65;
const GIG = 2600;               // dorywcza praca studenta na zleceniu, miesięcznie
const KID_COST = 1500;          // miesięczny koszt dziecka po uwzględnieniu 800+
const L_INS = 200;              // pakiet ubezpieczeń (życie, zdrowie, mieszkanie), miesięcznie
const IKE_LIMIT = 28260;        // roczny limit wpłat na IKE w 2026 r.
const FLAT_PRICE = 520000, FLAT_DOWN = 0.2, FLAT_FEES = 0.03, MORT_YEARS = 25, MORT_RATE = 0.035;
const L_DEBT = 0.12;            // roczny koszt drogiego długu ponad inflację
const ZUS_RATE = 0.1952;        // składka emerytalna od pensji brutto (pracownik + pracodawca)
const ZUS_GROWTH = 0;           // założenie: waloryzacja konta w ZUS tylko wyrównuje inflację
const PENSION_MONTHS = 220;
const MIN_WAGE = 4806;          // płaca minimalna w 2026 r., poniżej niej pensja na etacie nie spada     // średnie dalsze trwanie życia dla 65 lat, w miesiącach

const EDU = ['', 'szkoła średnia', 'licencjat lub inżynier', 'magister'];
const L_LIFE = [['Oszczędnie', 1700, -4], ['Normalnie', 2600, 0], ['Na bogato', 4800, 4]];
const HOMES = {
  dorm: ['Akademik albo pokój ze znajomymi', 800],
  room: ['Wynajęty pokój', 1600],
  flat: ['Wynajęte mieszkanie', 3300],
  own: ['Własne mieszkanie (czynsz i media)', 1000]
};

// Branże. entry(s) zwraca koszt wejścia albo null, gdy brakuje wykształcenia.
// cap to sufit pensji brutto na etacie dla najlepiej opłacanych stanowisk w branży (każdy kurs podnosi go o 4%).
// Źródła, stan na 2026 r.: Sedlak & Sedlak (wynagrodzenia.pl), raport płacowy Antal dla IT, dane AOTMiT o lekarzach.
//   handel  – kierownik sklepu: mediana 6 920 zł; kierownik regionalny: górna ćwiartka od 18 100 zł
//   biuro   – kierownicy i dyrektorzy administracyjni
//   fach    – doświadczony elektryk 13–18 tys. zł, kierownik budowy 16–20 tys. zł
//   it      – senior 20–32 tys. zł, architekt 25–40 tys. zł
//   finanse – dyrektor finansowy: mediana 24 630 zł, górna ćwiartka od 33 300 zł
//   med     – lekarz specjalista na etacie: mediana ok. 23,7–26 tys. zł
const FIELDS = [
  { id: 'handel', icon: 'cart', name: 'Handel i usługi', start: 4806, cap: 12000, mood: -1,
    desc: 'Praca od ręki, ale niskie zarobki. Lepsze pieniądze dopiero na stanowisku kierownika sklepu lub regionu.', need: 'bez wymagań', entry: () => 0 },
  { id: 'biuro', icon: 'briefcase', name: 'Administracja i biuro', start: 5600, cap: 14000, mood: 0,
    desc: 'Stabilnie i spokojnie, średnie zarobki.', need: 'bez wymagań', entry: () => 0 },
  { id: 'fach', icon: 'hammer', name: 'Fachowiec z uprawnieniami', start: 6500, cap: 17000, mood: 0,
    desc: 'Elektryk, mechanik, spawacz. Fachowców brakuje, więc o pracę łatwo.', need: 'kurs zawodowy i uprawnienia',
    entry: s => (s.known.includes('fach') ? 0 : 8000) },
  { id: 'it', icon: 'laptop', name: 'IT i technologia', start: 8500, cap: 32000, mood: -1,
    desc: 'Wysokie zarobki i szybki wzrost, ale trzeba się ciągle uczyć.', need: 'licencjat lub inżynier albo płatny intensywny kurs',
    entry: s => (s.edu >= 2 || s.known.includes('it') ? 0 : 18000) },
  { id: 'finanse', icon: 'chartup', name: 'Finanse i prawo', start: 7500, cap: 30000, mood: -2,
    desc: 'Dobre pieniądze, dużo stresu i nadgodzin.', need: 'studia magisterskie', entry: s => (s.edu >= 3 ? 0 : null) },
  { id: 'med', icon: 'shield', name: 'Ochrona zdrowia', start: 7800, cap: 26000, mood: -1,
    desc: 'Praca potrzebna zawsze i wszędzie, odpowiedzialna.', need: 'studia magisterskie', entry: s => (s.edu >= 3 ? 0 : null) }
];

const L_ASSETS = [
  { id: 'save', icon: 'bank', name: 'Konto oszczędnościowe i lokaty', risk: 0,
    hint: () => 'mniej więcej nadąża za inflacją, pieniądze dostępne od ręki' },
  { id: 'bonds', icon: 'bond', name: 'Obligacje indeksowane inflacją', risk: 0, fee: 0.02,
    hint: () => 'inflacja + ok. 1,5%, wcześniejsza wypłata kosztuje 2%' },
  { id: 'etf', icon: 'chartup', name: 'ETF na cały świat', risk: 1, taxed: true,
    hint: () => 'średnio ok. 4% rocznie ponad inflację, w złym roku nawet −30%' },
  { id: 'ike', icon: 'umbrella', name: 'IKE: ETF na emeryturę', risk: 1, taxed: true,
    hint: s => `ten sam ETF, ale po 60. roku życia bez podatku Belki. Limit wpłat w tym roku: jeszcze ${zl(IKE_LIMIT - s.ikeIn)}` },
  { id: 'stock', icon: 'stock', name: 'Akcje jednej spółki', risk: 2, taxed: true,
    hint: () => 'może się podwoić albo stracić większość wartości' },
  { id: 'crypto', icon: 'crypto', name: 'Kryptowaluta', risk: 3, taxed: true,
    hint: () => 'ogromne wahania, co kilka lat krach o 70%' }
];

const lata = n => n + (n === 1 ? ' rok' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? ' lata' : ' lat');
const lField = s => FIELDS.find(f => f.id === s.field) || null;
const lCap = (s, f) => f.cap * (1 + 0.04 * s.skills);
const lGross = s => s.pay * (s.abroad > 0 ? 1.6 : 1) * (s.extra ? 1.15 : 1);
const lNetPay = s => (s.student ? GIG * (s.extra ? 1.4 : 1) : payroll(lGross(s), s.age < 26).netto);
const lHousing = s => HOMES[s.home][1] * (s.home === 'own' ? 1 : s.rentMul) * (s.partner ? 0.6 : 1);
// Student żyje taniej. Rok, w którym kończy się studia (trans), liczy się jeszcze po studencku.
const lCheap = s => (s.student || s.trans ? 0.6 : 1);
const lLifeCost = s => L_LIFE[s.life][1] * 12 * lCheap(s);
const lAvail = s => s.cash - lLifeCost(s);
const lFin = s => L_ASSETS.reduce((a, x) => a + s[x.id], 0) + s.ppk;
const lEquity = s => (s.home === 'own' ? s.homeVal - s.mort : 0);
const lDebts = s => s.debt + s.recurring.filter(r => r.loan).reduce((a, r) => a + r.amount * r.left, 0);
const lNet = s => s.cash + lFin(s) + lEquity(s) - lDebts(s);
const lIns = (s, amount) => { if (s.ins) { s.insUsed = true; return Math.round(amount * 0.2); } return amount; };
const lScam = (s, lost) => { s.cash -= lost; s.scams++; s.mood -= 8; };
function mortPay(s) {
  if (s.mort <= 0 || s.mortLeft <= 0) return 0;
  return s.mort * s.mrate / (1 - Math.pow(1 + s.mrate, -s.mortLeft));
}
function lFieldPay(s, f) { return Math.round(f.start * (1 + 0.04 * s.skills + (s.known.includes(f.id) ? 0.1 : 0)) / 50) * 50; }

// Rynek w danym roku: inflacja i nominalne stopy zwrotu.
// Po krachu rynki przez dwa lata odrabiają straty szybciej niż zwykle.
function drawMarket(s) {
  const up = s.rebound > 0 ? 0.13 : 0;
  return {
    infl: clamp(0.035 + randn() * 0.015, 0.01, 0.1),
    etf: clamp(0.075 + up + randn() * 0.16, -0.4, 0.5),
    stock: clamp(0.08 + up + randn() * 0.33, -0.75, 1.3),
    crypto: Math.random() < 0.1 ? -0.7 : clamp(0.1 + randn() * 0.6, -0.8, 2.5)
  };
}
// Stopa zwrotu ponad inflację.
function lRet(id, m) {
  const real = nominal => (1 + nominal) / (1 + m.infl) - 1;
  if (id === 'save') return real((m.infl + 0.005) * (1 - BELKA));
  if (id === 'bonds') return real((m.infl + 0.015) * (1 - BELKA));
  if (id === 'etf' || id === 'ike') return real(m.etf);
  return real(m[id]);
}

/* ---------- start ---------- */

ACT.startLife = () => {
  const zero = () => ({ save: 0, bonds: 0, etf: 0, ike: 0, stock: 0, crypto: 0 });
  S = Object.assign({
    mode: 'life', phase: 'event', age: L_START, cash: 3000, ppk: 0, basis: zero(), ikeIn: 0,
    debt: 0, mood: 65, moodSum: 0, years: 0, life: 1, step: 5000,
    student: true, trans: false, studyLeft: 3, edu: 1, study: null, field: null, pay: 0, topPay: 0, known: [], skills: 0,
    act: null, actRes: null, picker: false, extra: false, ppkOn: true, ins: false, insUsed: false, gap: 0, abroad: 0,
    home: 'dorm', rentMul: 1, homeVal: 0, mort: 0, mortLeft: 0, mrate: MORT_RATE, paidHome: false,
    partner: false, married: false, kids: [], recurring: [], later: [], scams: 0,
    bankrupt: 0, bankAge: -99, totalIn: 0, zus: 0, taxPaid: 0, gains: 0, inflLoss: 0, infl: 0.035,
    seen: {}, lastEvent: null, event: null, result: null, notes: [], lessons: [], slip: [],
    heldCrash: false, rebound: 0, dyplom: false, saved: false, fresh: [], earned: [], hist: [{ n: 3000, r: 3000 }], flash: ''
  }, zero());
  lifePayday();
  lifeNextEvent();
  render();
  window.scrollTo(0, 0);
};

/* ---------- początek roku: dochód i stałe koszty ---------- */

function lifePayday() {
  const s = S, months = 12 - s.gap;
  let net;
  s.slip = [];
  if (s.student) {
    net = lNetPay(s) * 12;
    s.slip.push([`Praca dorywcza na zleceniu (${zl(net / 12)} miesięcznie, bez ZUS i PIT)`, net]);
  } else {
    s.pay = Math.max(s.pay, MIN_WAGE);
    const gross = lGross(s), p = payroll(gross, s.age < 26);
    net = p.netto * months + 1500 * s.gap;
    s.zus += ZUS_RATE * gross * months;
    s.topPay = Math.max(s.topPay, s.pay);
    s.slip.push([`Pensja na rękę (${zl(p.netto)} miesięcznie${s.gap ? `, ${s.gap} mies. bez pracy na zasiłku` : ''})`, net]);
    if (s.ppkOn) {
      const own = 0.02 * gross * months, boss = 0.015 * gross * months + 240;
      net -= own; s.ppk += own + boss;
      s.slip.push(['Twoja wpłata do PPK (2% pensji)', -own]);
      s.notes.push(`${ic('gift')} PPK: Ty wpłacasz ${zl(own)}, a pracodawca i państwo dokładają <span class="pos">+${zl(boss)}</span>.`);
    }
    if (s.abroad > 0) s.abroad--;
  }
  s.gap = 0;
  // Zaległy drogi dług: komornik zajmuje część dochodu.
  if (s.debt > net * 0.5) {
    const take = Math.min(s.debt, net * 0.25);
    net -= take; s.debt -= take; s.mood -= 6;
    s.slip.push(['Zajęcie komornicze na spłatę długu', -take]);
    s.lessons.push('Niespłacany dług nie znika. W końcu wierzyciel idzie do sądu, a komornik zabiera część pensji razem z kosztami.');
  }
  const cost = (label, v) => { if (v > 0) s.slip.push([label, -v]); return v; };
  let costs = cost(HOMES[s.home][0] + (s.partner ? ' (koszt dzielony z partnerem)' : ''), lHousing(s) * 12);
  if (s.mort > 0) {
    const pay = mortPay(s), interest = s.mort * s.mrate;
    costs += cost(`Rata kredytu hipotecznego (w tym odsetki: ${zl(interest)})`, pay);
    s.mort -= pay - interest; s.mortLeft--;
    if (s.mortLeft <= 0 || s.mort < 1) {
      s.mort = 0; s.mortLeft = 0; s.paidHome = true;
      s.notes.push(`${ic('key')} Ostatnia rata zapłacona. Mieszkanie jest w całości Twoje.`);
    }
  }
  costs += cost(`Dzieci: ${s.kids.length}`, s.kids.length * KID_COST * 12);
  if (s.ins) costs += cost('Pakiet ubezpieczeń', L_INS * 12);
  s.recurring.forEach(r => { costs += cost(r.name, r.amount); r.left--; });
  s.recurring = s.recurring.filter(r => r.left > 0);
  const before = s.kids.length;
  s.kids = s.kids.map(k => k - 1).filter(k => k > 0);
  if (s.kids.length < before) s.notes.push(`${ic('smile')} Dziecko się usamodzielniło. Stałe koszty spadają.`);
  s.later = s.later.filter(l => {
    if (--l.left > 0) return true;
    if (l.ok) { s.cash += l.amount; s.notes.push(`${ic('check')} ${l.good}`); }
    else { s.notes.push(`${ic('cross')} ${l.bad}`); s.lessons.push(l.lesson); }
    return false;
  });
  s.cash += net - costs;
  s.totalIn += net;
  s.free = net - costs;
}

/* ---------- zdarzenia roku ---------- */

function lifeNextEvent() {
  const s = S;
  let ev = null;
  if (s.dyplom) { ev = L_EVENTS.find(e => e.id === 'dyplom'); s.dyplom = false; }
  else {
    const ok = e => !e.forced && e.id !== s.lastEvent && (!e.cond || e.cond(s))
      && (s.seen[e.id] === undefined || (!e.once && s.age - s.seen[e.id] >= (e.every || 8)));
    const c = L_EVENTS.filter(ok);
    if (c.length && Math.random() < 0.9) ev = c[Math.floor(Math.random() * c.length)];
  }
  s.event = ev || L_EVENTS.find(e => e.id === 'spokoj');
  s.lastEvent = s.event.id;
  s.seen[s.event.id] = s.age;
  if (s.event.pre) s.event.pre(s);
  s.result = null;
  s.phase = 'event';
}

ACT.lPick = i => {
  const s = S, ch = s.event && s.event.choices[i];
  if (!ch || s.result || s.phase !== 'event' || (ch.show && !ch.show(s))) return;
  const cost = val(ch.cost, s);
  if (cost && s.cash < cost) return;
  const [text, lesson, tone] = ch.run(s);
  s.mood = clamp(s.mood, 0, 100);
  s.result = { text, lesson, tone };
  if (tone === 'bad') s.lessons.push(lesson);
  render();
};
ACT.lToPlan = () => { if (S.phase === 'event' && S.result) { S.phase = 'plan'; S.flash = ''; render(); window.scrollTo(0, 0); } };

const L_EVENTS = [
  {
    id: 'spokoj', forced: true, icon: 'sun', title: 'Spokojny rok',
    text: 'Nic wielkiego się nie wydarzyło. Takie lata są najlepsze dla oszczędności.',
    choices: [{ label: 'Planuję kolejny rok', run: () => ['Rok bez niespodzianek.', 'Nudne, regularne odkładanie robi w długim terminie więcej niż pojedyncze „okazje”.', 'neutral'] }]
  },
  {
    id: 'dyplom', forced: true, icon: 'book', title: s => (s.edu >= 3 ? 'Dyplom magistra' : 'Dyplom licencjata lub inżyniera'),
    text: s => (s.edu >= 3 ? 'Studia skończone. Czas na pierwszą pracę na pełen etat.' : 'Pierwszy stopień studiów za Tobą. Możesz iść do pracy albo zostać jeszcze dwa lata na magisterce.'),
    choices: [
      { label: 'Idę do pracy na pełen etat', run: s => { s.student = false; s.trans = true; s.studyLeft = 0; s.picker = true; if (s.home === 'dorm') s.home = 'room'; return ['Koniec studenckiego życia. Wybierz branżę w planie roku.', 'Do 26. roku życia nie płacisz PIT od pensji (ulga dla młodych), ale składki ZUS już tak.', 'good']; } },
      { label: 'Zostaję na magisterce (2 lata)', show: s => s.edu < 3, run: s => { s.studyLeft = 2; return ['Jeszcze dwa lata nauki i dorywczej pracy.', 'Magister otwiera branże z najwyższymi zarobkami, ale to dwa lata niższych dochodów. To inwestycja, która ma swój koszt.', 'neutral']; } }
    ]
  },
  {
    id: 'erasmus', once: true, icon: 'rocket', title: 'Wymiana studencka',
    cond: s => s.student,
    text: 'Możesz wyjechać na semestr za granicę. Stypendium nie pokryje wszystkiego: dołożysz ok. 6 000 zł.',
    choices: [
      { label: 'Jadę', cost: 6000, run: s => { s.cash -= 6000; s.skills++; s.mood += 10; return ['Język, kontakty i wpis w CV, który robi wrażenie.', 'Wydatki, które podnoszą Twoją wartość na rynku pracy, zwracają się przez całą karierę.', 'good']; } },
      { label: 'Zostaję', run: () => ['Zostajesz i oszczędzasz.', 'Nie każda okazja musi być Twoja. Ważne, żeby odmawiać świadomie, a nie ze strachu.', 'neutral'] }
    ]
  },
  {
    id: 'staz', once: true, icon: 'briefcase', title: 'Staż zamiast pracy w barze',
    cond: s => s.student,
    text: 'Firma z Twojej branży proponuje płatny staż na wakacje. Zarobisz o 3 000 zł mniej niż w gastro.',
    choices: [
      { label: 'Biorę staż', run: s => { s.cash -= 3000; s.skills++; return ['Mniej pieniędzy teraz, za to pierwsze prawdziwe doświadczenie.', 'Na starcie kariery doświadczenie jest warte więcej niż kilka tysięcy złotych.', 'good']; } },
      { label: 'Wolę zarobić więcej', run: () => ['Wakacje za barem i pełniejsze konto.', 'To też w porządku. Pamiętaj tylko, że pierwsza praca w zawodzie będzie wtedy trudniejsza do zdobycia.', 'neutral'] }
    ]
  },
  {
    id: 'partner', every: 4, icon: 'smile', title: 'Wspólne mieszkanie',
    cond: s => !s.partner && s.age >= 22 && s.age <= 45,
    text: 'Jesteście razem od dłuższego czasu. Pada pytanie: zamieszkamy razem?',
    choices: [
      { label: 'Tak, zamieszkujemy razem', run: s => { s.partner = true; s.mood += 8; return ['Od przyszłego roku koszty mieszkania dzielicie między siebie.', 'Wspólne życie obniża koszty. Warto od początku ustalić, kto za co płaci i ile razem odkładacie.', 'good']; } },
      { label: 'To jeszcze nie ten moment', run: s => { s.mood -= 2; return ['Zostajesz na swoim.', 'Decyzje życiowe mają skutki finansowe, ale pieniądze nie powinny być jedynym powodem.', 'neutral']; } }
    ]
  },
  {
    id: 'slub', once: true, icon: 'gift', title: 'Ślub i wesele',
    cond: s => s.partner && !s.married,
    text: 'Planujecie ślub. Duże wesele to po odliczeniu kopert ok. 45 000 zł z Waszej kieszeni, kameralne przyjęcie ok. 10 000 zł.',
    choices: [
      { label: 'Duże wesele z oszczędności', cost: 45000, run: s => { s.cash -= 45000; s.married = true; s.mood += 10; return ['Piękny dzień, opłacony w całości z odłożonych pieniędzy.', 'Duży wydatek zaplanowany i opłacony gotówką nie ciągnie się potem latami.', 'neutral']; } },
      { label: 'Duże wesele na kredyt', run: s => { s.debt += 47000; s.married = true; s.mood += 10; return ['Piękny dzień i 47 000 zł długu na start wspólnego życia.', 'Kredyt na jednodniową imprezę spłaca się latami. Odsetki zaczynają rosnąć od razu.', 'bad']; } },
      { label: 'Kameralne przyjęcie', cost: 10000, run: s => { s.cash -= 10000; s.married = true; s.mood += 7; return ['Najbliżsi, dobra kolacja i brak długów.', 'Różnica 35 000 zł zainwestowana na 30 lat przy 4% ponad inflację urosłaby do ponad 110 000 zł.', 'good']; } },
      { label: 'Na razie bez ślubu', run: () => ['Zostaje, jak jest.', 'To Wasza decyzja. Warto tylko znać skutki prawne: bez ślubu nie ma wspólności majątkowej ani dziedziczenia z ustawy.', 'neutral'] }
    ]
  },
  {
    id: 'dziecko', every: 3, icon: 'cake', title: 'Powiększenie rodziny',
    cond: s => s.partner && s.age >= 25 && s.age <= 41 && s.kids.length < 3,
    text: `Rozmawiacie o dziecku. Realny koszt to ok. ${zl(KID_COST)} miesięcznie po uwzględnieniu 800+, przez mniej więcej 20 lat.`,
    choices: [
      { label: 'Decydujemy się', run: s => { s.kids.push(20); s.mood += 10; return ['Rodzina się powiększa. Od przyszłego roku rosną stałe koszty.', 'Dziecko to największy „wydatek” w życiu i jednocześnie coś, czego nie mierzy się pieniędzmi. Poduszka finansowa robi się wtedy jeszcze ważniejsza.', 'neutral']; } },
      { label: 'Jeszcze nie teraz', run: () => ['Wracacie do tematu za jakiś czas.', 'Na takie decyzje nie ma idealnego momentu finansowego. Można się do nich za to przygotować.', 'neutral'] }
    ]
  },
  {
    id: 'auto', every: 12, icon: 'car', title: 'Samochód',
    cond: s => !s.student,
    text: 'Dojazdy komunikacją zabierają coraz więcej czasu. Myślisz o własnym aucie.',
    choices: [
      { label: 'Nowe z salonu na kredyt: 5 lat po 1 450 zł miesięcznie', run: s => { s.recurring.push({ name: 'Rata za samochód', amount: 17400, left: 5, loan: true }); s.mood += 8; return ['Pachnie nowością. Przez pięć lat płacisz 17 400 zł rocznie.', 'Nowe auto najszybciej traci na wartości w pierwszych latach, a rata zmniejsza to, co możesz odłożyć.', 'neutral']; } },
      { label: 'Kilkuletnie za gotówkę', cost: 35000, run: s => { s.cash -= 35000; s.mood += 6; return ['Sprawdzone auto z drugiej ręki, bez rat.', 'Największy spadek wartości wziął na siebie pierwszy właściciel.', 'good']; } },
      { label: 'Zostaję przy komunikacji i rowerze', run: s => { s.mood -= 2; return ['Trochę mniej wygody, za to zero kosztów auta.', 'Samochód to nie tylko cena zakupu: paliwo, ubezpieczenie i naprawy to zwykle kilkanaście tysięcy złotych rocznie.', 'good']; } }
    ]
  },
  {
    id: 'krach', every: 10, icon: 'chartdown', title: 'Krach na giełdzie',
    cond: s => s.etf + s.ike + s.stock >= 5000,
    pre: s => {
      const loss = 0.3 * (s.etf + s.ike) + 0.35 * s.stock + 0.18 * s.ppk;
      s.crashLoss = loss; s.gains -= loss;
      s.etf *= 0.7; s.ike *= 0.7; s.stock *= 0.65; s.ppk *= 0.82; s.rebound = 2;
    },
    // Zyski w podsumowaniu wyżej dotyczą zeszłego roku, a krach dzieje się teraz, więc tekst podaje stratę wprost.
    text: s => `Na początku tego roku światowe giełdy spadły o 30%. Zyski z zeszłego roku widzisz w podsumowaniu wyżej, ale teraz Twoje ETF, akcje i PPK są warte o <strong>${zl(s.crashLoss || 0)}</strong> mniej. W wiadomościach mówi się o końcu świata.`,
    choices: [
      { label: 'Sprzedaję ETF i akcje, zanim spadnie bardziej', run: s => { s.cash += s.etf + s.stock; s.etf = 0; s.stock = 0; s.basis.etf = 0; s.basis.stock = 0; return ['Sprzedałeś ze stratą. Pieniądze leżą na koncie.', 'Sprzedaż w panice zamienia chwilowy spadek w trwałą stratę. Szerokie rynki dotąd zawsze odrabiały spadki, choć czasem trwało to lata.', 'bad']; } },
      { label: 'Nic nie robię, mam czas', run: s => { s.heldCrash = true; return ['Zostawiasz inwestycje w spokoju.', 'Przy horyzoncie 20–30 lat krach jest tylko gorszym rokiem na wykresie.', 'good']; } },
      { label: 'Dokupuję ETF za 10 000 zł', cost: 10000, run: s => { s.cash -= 10000; s.etf += 10000; s.basis.etf += 10000; s.heldCrash = true; return ['Kupujesz te same udziały o 30% taniej.', 'Regularne kupowanie także w czasie spadków obniża średnią cenę zakupu.', 'good']; } }
    ]
  },
  {
    id: 'choroba', every: 12, icon: 'warn', title: 'Poważna choroba',
    cond: s => !s.student && s.age >= 30,
    text: s => `Pół roku leczenia i rehabilitacji. Na zwolnieniu dostajesz 80% pensji, a prywatne wizyty i dojazdy kosztują 18 000 zł${s.ins ? '. Masz pakiet ubezpieczeń, który pokrywa 80% kosztów' : ''}.`,
    choices: [
      { label: s => `Leczę się (${zl(s.ins ? 3600 : 18000)} i niższa pensja przez pół roku)`, run: s => {
          const had = s.ins, c = lIns(s, 18000), lost = 0.2 * 6 * lNetPay(s);
          s.cash -= c + lost; s.mood -= 8;
          return [`Leczenie kosztowało ${zl(c)}, a niższa pensja zabrała kolejne ${zl(lost)}.`, had ? 'Ubezpieczenie zamieniło wydatek, który mógł zachwiać budżetem, w kwotę do udźwignięcia.' : 'Choroba uderza podwójnie: rosną wydatki i spada dochód. Na to są poduszka finansowa i ubezpieczenie.', had ? 'neutral' : 'bad'];
        } }
    ]
  },
  {
    id: 'zwolnienie', every: 9, icon: 'briefcase', title: 'Redukcja etatów',
    cond: s => !!s.field,
    text: 'Firma tnie koszty i Twoje stanowisko znika. Dostajesz wypowiedzenie.',
    choices: [
      { label: 'Szukam spokojnie pracy na swoim poziomie', run: s => { s.gap = 4; s.mood -= 5; return ['Przez cztery miesiące żyjesz z zasiłku i oszczędności, potem wracasz na podobną pensję.', 'Poduszka finansowa na 3–6 miesięcy daje czas, żeby nie brać pierwszej lepszej oferty.', 'neutral']; } },
      { label: 'Biorę pierwszą ofertę, byle mieć pensję', run: s => { s.gap = 1; s.pay *= 0.9; s.mood -= 6; return ['Przerwa trwa tylko miesiąc, ale nowa pensja jest o 10% niższa.', 'Decyzja pod presją kosztuje co miesiąc przez kolejne lata. Kto ma zapas pieniędzy, może negocjować.', 'bad']; } }
    ]
  },
  {
    id: 'spadek', once: true, icon: 'envelope', title: 'Spadek',
    cond: s => s.age >= 28,
    pre: s => { s.cash += 60000; },
    text: 'Po dalekiej krewnej dostajesz 60 000 zł. Pieniądze są już na koncie.',
    choices: [
      { label: 'Wydaję: podróż, sprzęt, remont marzeń', cost: 60000, run: s => { s.cash -= 60000; s.mood += 12; return ['Rok pełen przyjemności. Po spadku nie został ślad.', 'Jednorazowy zastrzyk gotówki to rzadka szansa, żeby przeskoczyć kilka lat oszczędzania.', 'neutral']; } },
      { label: 'Połowa na przyjemności, połowa zostaje', cost: 30000, run: s => { s.cash -= 30000; s.mood += 7; return ['30 000 zł radości i 30 000 zł do zainwestowania.', 'Podział „pół na dziś, pół na przyszłość” sprawdza się przy każdej premii i każdym spadku.', 'good']; } },
      { label: 'Całość zostaje do zainwestowania', run: () => ['60 000 zł czeka na koncie. Zdecyduj w planie roku, gdzie je ulokować.', 'Pieniądze zostawione na zwykłym koncie co roku tracą przez inflację. Decyzja „gdzie” jest tak samo ważna jak „czy”.', 'good'] }
    ]
  },
  {
    id: 'scaminw', every: 15, icon: 'rocket', title: 'Platforma inwestycyjna z reklamy',
    cond: s => !s.student,
    text: 'Reklama ze znaną twarzą obiecuje 15% zysku miesięcznie. Po zostawieniu numeru codziennie dzwoni „opiekun inwestycyjny”.',
    choices: [
      { label: 'Wpłacam 20 000 zł', cost: 20000, run: s => { lScam(s, 20000); return ['Panel pokazywał rosnące zyski, ale wypłaty nigdy nie było. 20 000 zł przepadło.', 'Gwarantowany wysoki zysk nie istnieje, a wizerunki znanych osób w takich reklamach są podrobione. Sprawdzaj firmy na liście ostrzeżeń KNF.', 'bad']; } },
      { label: 'Wpłacam 1 000 zł na próbę', cost: 1000, run: s => { lScam(s, 1000); return ['„Zysk” rósł tylko na ekranie. Potem konsultant namawiał na dopłatę i zniknął.', 'Mała wpłata na próbę to haczyk. Fikcyjne zyski mają skłonić do wpłacenia większej kwoty.', 'bad']; } },
      { label: 'Sprawdzam listę ostrzeżeń KNF i blokuję numer', run: () => ['Firma jest na liście ostrzeżeń. Numer zablokowany.', 'Minuta sprawdzania oszczędza lata odkładania.', 'good'] }
    ]
  },
  {
    id: 'scambank', every: 15, icon: 'phone', title: 'Telefon z „banku”',
    cond: s => !s.student && s.cash >= 8000,
    text: 'Dzwoni „dział bezpieczeństwa”: ktoś właśnie bierze kredyt na Twoje dane. Żeby chronić pieniądze, trzeba je natychmiast przelać na „konto techniczne”.',
    choices: [
      { label: s => `Przelewam ${zl(Math.min(s.cash, 40000))}, zanim będzie za późno`, run: s => { const lost = Math.min(s.cash, 40000); lScam(s, lost); return [`To byli oszuści. ${zl(lost)} zniknęło z konta.`, 'Bank nigdy nie prosi o przelanie pieniędzy na inne konto ani o kody. Rozłącz się i zadzwoń sam na numer z karty.', 'bad']; } },
      { label: 'Rozłączam się i dzwonię na infolinię z karty', run: () => ['Bank potwierdza: nikt do Ciebie nie dzwonił.', 'Pośpiech i strach to narzędzia oszusta. Prawdziwa sprawa poczeka dziesięć minut.', 'good'] }
    ]
  },
  {
    id: 'remont', every: 12, icon: 'hammer', title: 'Remont mieszkania',
    cond: s => s.home === 'own',
    text: 'Stara instalacja i łazienka nie wytrzymują. Porządny remont to 35 000 zł.',
    choices: [
      { label: 'Płacę z oszczędności', cost: 35000, run: s => { s.cash -= 35000; return ['Remont zrobiony i zapłacony.', 'Właściciel mieszkania powinien co roku odkładać ok. 1% jego wartości na naprawy.', 'good']; } },
      { label: 'Biorę kredyt gotówkowy', run: s => { s.debt += 35000; return ['Remont zrobiony, 35 000 zł długu zostaje.', 'Kredyt gotówkowy jest kilka razy droższy niż hipoteczny. Spłać go jak najszybciej.', 'bad']; } },
      { label: 'Odkładam remont', run: s => { s.homeVal *= 0.95; s.mood -= 4; return ['Mieszkanie niszczeje i traci na wartości.', 'Odkładane naprawy zwykle wracają jako droższe naprawy.', 'neutral']; } }
    ]
  },
  {
    id: 'czynsz', every: 6, icon: 'receipt', title: 'Podwyżka czynszu',
    cond: s => s.home === 'room' || s.home === 'flat',
    text: 'Właściciel podnosi czynsz o 15%. „Takie są teraz ceny”.',
    choices: [
      { label: 'Zgadzam się', run: s => { s.rentMul *= 1.15; return ['Od przyszłego roku płacisz o 15% więcej.', 'Najemca płaci czyjś kredyt i nie ma wpływu na podwyżki. To cena elastyczności.', 'neutral']; } },
      { label: 'Negocjuję', run: s => {
          if (Math.random() < 0.5) return ['Właściciel woli dobrego najemcę niż puste mieszkanie. Czynsz zostaje.', 'Wymiana najemcy kosztuje właściciela czas i pieniądze. Masz więcej argumentów, niż myślisz.', 'good'];
          s.rentMul *= 1.07; return ['Staje na podwyżce o 7%.', 'Połowa podwyżki to nadal kilkaset złotych rocznie w kieszeni.', 'good'];
        } },
      { label: 'Przeprowadzam się', cost: 3000, run: s => { s.cash -= 3000; s.mood -= 3; return ['Kaucja, transport i tydzień w kartonach. Czynsz zostaje na starym poziomie.', 'Przeprowadzka ma swój koszt. Policz, po ilu miesiącach się zwróci.', 'neutral']; } }
    ]
  },
  {
    id: 'wakacje', every: 6, icon: 'sun', title: 'Wakacje życia',
    cond: s => !s.student,
    text: 'Znajomi organizują trzytygodniowy wyjazd na drugi koniec świata. Koszt: 18 000 zł.',
    choices: [
      { label: 'Jadę, płacę z oszczędności', cost: 18000, run: s => { s.cash -= 18000; s.mood += 12; return ['Wspomnienia na całe życie, opłacone gotówką.', 'Pieniądze są też po to, żeby żyć. Ważne, żeby duży wydatek był zaplanowany.', 'neutral']; } },
      { label: 'Jadę, płacę kartą kredytową', run: s => { s.debt += 18000; s.mood += 12; return ['Świetny wyjazd i 18 000 zł długu na karcie.', 'Karta kredytowa to jeden z najdroższych długów. Wakacje spłacane przez dwa lata kosztują dużo więcej niż w cenniku.', 'bad']; } },
      { label: 'Wybieram tańszy wyjazd', cost: 5000, run: s => { s.cash -= 5000; s.mood += 6; return ['Dwa tygodnie bliżej, też było dobrze.', 'Większość radości z wyjazdu daje sam wyjazd, a nie jego cena.', 'good']; } },
      { label: 'Zostaję w domu', run: s => { s.mood -= 4; return ['Oglądasz zdjęcia znajomych.', 'Oszczędzanie kosztem wszystkiego też ma swoją cenę.', 'neutral']; } }
    ]
  },
  {
    id: 'wspolnik', once: true, icon: 'shop', title: 'Znajomy szuka wspólnika',
    cond: s => s.age >= 27 && s.cash >= 30000,
    text: 'Kolega otwiera firmę i proponuje udział za 30 000 zł. Biznesplan ma na dwóch stronach.',
    choices: [
      { label: 'Wchodzę za 30 000 zł', cost: 30000, run: s => {
          s.cash -= 30000;
          s.later.push({ left: 3, ok: Math.random() < 0.3, amount: 100000, good: 'Firma kolegi wypaliła. Twój udział został wykupiony za 100 000 zł.', bad: 'Firma kolegi upadła. 30 000 zł przepadło.', lesson: 'Większość nowych firm upada w pierwszych latach. W jeden biznes wkładaj tylko tyle, ile możesz stracić.' });
          return ['Pieniądze poszły. Wynik poznasz za trzy lata.', 'Inwestycja w jedną małą firmę to bardzo wysokie ryzyko: albo duży zysk, albo strata wszystkiego.', 'neutral'];
        } },
      { label: 'Odmawiam, ale życzę powodzenia', run: () => ['Zostajesz przy swoich planach.', 'Odmowa jest w porządku. Można wspierać znajomych inaczej niż gotówką.', 'neutral'] }
    ]
  },
  {
    id: 'polisa', once: true, icon: 'umbrella', title: '„Program inwestycyjny z ochroną”',
    cond: s => s.age >= 25,
    text: 'Doradca w banku proponuje produkt na 10 lat: wpłacasz 20 000 zł, „pieniądze pracują, a Ty masz ochronę”. Opłaty to ok. 4% rocznie.',
    choices: [
      { label: 'Podpisuję', cost: 20000, run: s => {
          s.cash -= 20000;
          s.later.push({ left: 10, ok: true, amount: 15000, good: 'Program inwestycyjny z banku się zakończył. Z 20 000 zł po opłatach wróciło 15 000 zł.', bad: '', lesson: '' });
          return ['Umowa podpisana. Pieniądze są zablokowane na 10 lat.', 'Opłata 4% rocznie zjada cały typowy zysk z inwestycji. Tani fundusz ETF kosztuje ok. 0,2% rocznie.', 'bad'];
        } },
      { label: 'Pytam o wszystkie opłaty i odmawiam', run: () => ['Po doliczeniu opłat produkt przestaje wyglądać atrakcyjnie.', 'Zawsze pytaj o łączny roczny koszt i o to, ile stracisz przy wcześniejszej wypłacie.', 'good'] }
    ]
  },
  {
    id: 'awans', every: 7, icon: 'chartup', title: 'Propozycja awansu',
    cond: s => !!s.field,
    text: 'Szef proponuje stanowisko kierownicze: 12% więcej pieniędzy, więcej odpowiedzialności i dłuższe dni.',
    choices: [
      { label: 'Przyjmuję', run: s => { s.pay *= 1.12; s.mood -= 8; return ['Pensja rośnie o 12%. Wolnych wieczorów jest mniej.', 'Skok pensji to dobry moment, żeby zwiększyć oszczędności, zanim urosną wydatki.', 'good']; } },
      { label: 'Odmawiam', run: s => { s.mood += 2; return ['Zostajesz na obecnym stanowisku.', 'Więcej pieniędzy nie zawsze znaczy lepiej. Warto jednak wiedzieć, z czego się rezygnuje.', 'neutral']; } }
    ]
  },
  {
    id: 'zagranica', once: true, icon: 'rocket', title: 'Kontrakt za granicą',
    cond: s => !!s.field && s.age >= 24 && s.age <= 45,
    text: 'Dwuletni kontrakt za granicą: pensja wyższa o 60%, ale daleko od bliskich.',
    choices: [
      { label: 'Wyjeżdżam na dwa lata', run: s => { s.abroad = 2; s.mood -= s.partner ? 14 : 9; return ['Przez dwa lata zarabiasz o 60% więcej.', 'Okres wyższych zarobków to szansa na zbudowanie kapitału. Działa tylko wtedy, gdy wydatki nie rosną razem z pensją.', 'good']; } },
      { label: 'Zostaję', run: () => ['Zostajesz w kraju.', 'Nie wszystko da się przeliczyć na pieniądze.', 'neutral'] }
    ]
  },
  {
    id: 'rodzice', once: true, icon: 'buoy', title: 'Rodzice potrzebują pomocy',
    cond: s => s.age >= 45,
    text: 'Rodzice coraz słabiej radzą sobie sami. Potrzebna jest stała opieka.',
    choices: [
      { label: 'Opłacam opiekunkę: 2 000 zł miesięcznie przez 4 lata', run: s => { s.recurring.push({ name: 'Opieka nad rodzicami', amount: 24000, left: 4 }); return ['Rodzice mają dobrą opiekę, a Ty stały wydatek.', 'Opieka nad rodzicami to koszt, którego mało kto się spodziewa. Dotyczy większości rodzin.', 'neutral']; } },
      { label: 'Dzielę koszty z rodzeństwem: 1 000 zł miesięcznie', run: s => { s.recurring.push({ name: 'Opieka nad rodzicami', amount: 12000, left: 4 }); s.mood -= 3; return ['Kilka trudnych rozmów i koszt rozkłada się na wszystkich.', 'O pieniądzach w rodzinie rozmawia się trudno, ale brak rozmowy zwykle kosztuje więcej.', 'good']; } },
      { label: 'Opiekuję się sam po pracy', run: s => { s.mood -= 14; s.extra = false; return ['Praca, potem opieka. Brakuje czasu na cokolwiek innego.', 'Własny czas też ma cenę, nawet jeśli nie widać jej na koncie.', 'neutral']; } }
    ]
  },
  {
    id: 'studiadziecka', once: true, icon: 'book', title: 'Dziecko idzie na studia',
    cond: s => s.kids.length > 0 && s.age >= 44,
    text: 'Studia w innym mieście to pokój, jedzenie i dojazdy.',
    choices: [
      { label: 'Dokładam 1 500 zł miesięcznie przez 5 lat', run: s => { s.recurring.push({ name: 'Studia dziecka', amount: 18000, left: 5 }); s.mood += 3; return ['Dziecko może skupić się na nauce.', 'Wykształcenie dziecka to jeden z wydatków, które warto zaplanować kilkanaście lat wcześniej.', 'neutral']; } },
      { label: 'Dokładam 500 zł, resztę dorabia samo', run: s => { s.recurring.push({ name: 'Studia dziecka', amount: 6000, left: 5 }); return ['Dziecko pracuje w weekendy, tak jak Ty kiedyś.', 'Własne pierwsze pieniądze to też lekcja. Ty za to nie zaniedbujesz odkładania na emeryturę.', 'good']; } }
    ]
  },
  {
    id: 'wypalenie', every: 6, icon: 'sad', title: 'Wypalenie',
    cond: s => !!s.field && s.mood < 45,
    text: 'Od miesięcy wstajesz zmęczony. Praca, która kiedyś cieszyła, tylko męczy.',
    choices: [
      { label: 'Biorę trzy miesiące przerwy bez pensji', run: s => { s.gap = 3; s.mood += 18; return ['Trzy miesiące odpoczynku. W przyszłym roku pensja wpłynie tylko za dziewięć.', 'Oszczędności dają nie tylko bezpieczeństwo, ale też wolność: możesz sobie pozwolić na przerwę.', 'neutral']; } },
      { label: 'Zaciskam zęby', run: s => { s.mood -= 6; return ['Ciągniesz dalej.', 'Jeśli praca odbiera zdrowie, zmiana pracodawcy albo branży bywa najlepszą decyzją finansową.', 'neutral']; } }
    ]
  },
  {
    id: 'stopy', every: 8, icon: 'bank', title: 'Zmiana stóp procentowych',
    cond: s => s.mort > 0,
    pre: s => { s.tmp = Math.random() < 0.6 ? 0.015 : -0.01; s.mrate = clamp(s.mrate + s.tmp, 0.015, 0.07); },
    text: s => `Stopy procentowe ${s.tmp > 0 ? 'rosną' : 'spadają'}. Twoja rata kredytu to teraz ok. ${zl(mortPay(s) / 12)} miesięcznie.`,
    choices: [
      { label: 'Nadpłacam kredyt o 20 000 zł', cost: 20000, run: s => { const a = Math.min(20000, s.mort); s.cash -= a; s.mort -= a; return [`Nadpłacone. Rata spada do ok. ${zl(mortPay(s) / 12)} miesięcznie.`, 'Każda nadpłata zmniejsza kwotę, od której bank liczy odsetki, więc działa przez wszystkie kolejne lata.', 'good']; } },
      { label: 'Zostawiam, jak jest', run: () => ['Płacisz ratę w nowej wysokości.', 'Kredyt ze zmienną stopą potrafi mocno zdrożeć. Bezpieczna rata to taka, którą udźwigniesz także po podwyżce.', 'neutral'] }
    ]
  },
  {
    id: 'zus50', once: true, icon: 'envelope', title: 'List z ZUS',
    cond: s => !!s.field && s.age >= 50,
    text: s => {
      const future = s.zus + (L_END - s.age) * ZUS_RATE * s.pay * 12, gross = future / PENSION_MONTHS;
      return `ZUS przysyła prognozę: jeśli do 65. roku życia będziesz zarabiać tyle, co teraz, emerytura wyniesie ok. ${zl(gross)} brutto. Dziś zarabiasz ${zl(s.pay)} brutto.`;
    },
    choices: [{ label: 'Czytam uważnie', run: () => ['Różnica między pensją a emeryturą to luka, którą wypełnią tylko własne oszczędności.', 'Emerytura z ZUS to zwykle wyraźnie mniej niż ostatnia pensja. PPK, IKE i własne inwestycje decydują o tym, jak będzie wyglądać życie po 65. roku życia.', 'neutral'] }]
  },
  {
    id: 'zalanie', every: 12, icon: 'drop', title: 'Zalane mieszkanie',
    cond: s => !s.student,
    text: s => `Pękła rura. Podłogi, meble i sprzęt do wymiany: 20 000 zł${s.ins ? '. Pakiet ubezpieczeń pokrywa 80%' : ''}.`,
    choices: [
      { label: s => `Naprawiam szkody (${zl(s.ins ? 4000 : 20000)})`, run: s => { const had = s.ins, c = lIns(s, 20000); s.cash -= c; return [had ? `Ubezpieczyciel wypłacił odszkodowanie. Dokładasz ${zl(c)}.` : 'Całość pokrywasz sam: 20 000 zł.', 'Ubezpieczenie mieszkania kosztuje kilkaset złotych rocznie i chroni przed wydatkiem na dziesiątki tysięcy.', had ? 'good' : 'bad']; } }
    ]
  },
  {
    id: 'premia', every: 5, icon: 'gift', title: 'Premia roczna',
    cond: s => !!s.field,
    pre: s => { s.tmp = Math.round(lNetPay(s) * 1.5 / 100) * 100; s.cash += s.tmp; },
    text: s => `Dobry rok w firmie. Na konto wpada premia: ${zl(s.tmp)}.`,
    choices: [
      { label: 'Wydaję na przyjemności', cost: s => s.tmp, run: s => { s.cash -= s.tmp; s.mood += 8; return ['Premia wydana w całości.', 'Jeśli każda premia idzie na wydatki, majątek rośnie tylko z pensji.', 'neutral']; } },
      { label: 'Połowa dla mnie, połowa zostaje', cost: s => s.tmp / 2, run: s => { s.cash -= s.tmp / 2; s.mood += 5; return ['Trochę radości dziś i trochę na przyszłość.', 'Zasada „połowa na dziś, połowa na przyszłość” działa przy każdej premii i podwyżce.', 'good']; } },
      { label: 'Całość zostaje do zainwestowania', run: () => ['Premia czeka na koncie.', 'Jednorazowe zastrzyki gotówki najmocniej przyspieszają budowanie majątku.', 'good'] }
    ]
  }
];

/* ---------- plan roku: kariera ---------- */

// Podnosi pensję najwyżej do sufitu. Zwraca faktyczny wzrost w procentach (0, gdy pensja jest już na suficie).
const lBump = (s, cap, mult) => { const old = s.pay; s.pay = Math.max(old, Math.min(cap, old * mult)); return Math.round((s.pay / old - 1) * 100); };
const L_TOP = 'Zarabiasz już tyle, ile ta branża płaci najlepszym. Więcej da tylko kurs, który podnosi sufit, albo zmiana branży.';
const setRes = (s, kind, text, lesson, tone) => { s.act = kind; s.actRes = [text, lesson, tone]; s.mood = clamp(s.mood, 0, 100); };

ACT.lAct = kind => {
  const s = S, f = lField(s);
  if (s.phase !== 'plan' || s.act || s.student || !f) return;
  const cap = lCap(s, f);
  if (kind === 'raise') {
    const chance = clamp(0.5 + 0.06 * s.skills - (s.pay / cap > 0.9 ? 0.25 : 0), 0.1, 0.85);
    if (Math.random() < chance) {
      const pct = lBump(s, cap, 1.03 + Math.random() * 0.04);
      if (pct > 0) setRes(s, kind, `Udało się. Pensja rośnie o ${pct}%, do ${zl(s.pay)} brutto.`, 'Podwyżka, która tylko wyrównuje inflację, nie jest podwyżką. Na rozmowę przychodź z liczbami i ofertami z rynku.', 'good');
      else setRes(s, kind, `Szef zgadza się tylko na wyrównanie inflacji. Pensja zostaje na ${zl(s.pay)} brutto.`, L_TOP, 'neutral');
    } else {
      s.mood -= 3;
      setRes(s, kind, 'Odmowa. Pensja realnie spada o wzrost cen.', s.pay / cap > 0.9 ? 'Zbliżasz się do sufitu zarobków w tej branży. Większy skok da już tylko nowa specjalizacja albo zmiana branży.' : 'Odmowa nic nie kosztuje. Brak pytania kosztuje na pewno.', 'neutral');
      s.pay *= 0.985;
    }
  } else if (kind === 'employer') {
    const r = Math.random() + (s.age >= 50 ? 0.2 : 0);
    s.mood -= 2;
    if (r < 0.5) { const pct = lBump(s, cap, 1.08 + Math.random() * 0.08); if (pct > 0) setRes(s, kind, `Nowa firma płaci o ${pct}% więcej: ${zl(s.pay)} brutto.`, 'Zmiana pracodawcy daje zwykle większy skok pensji niż podwyżka w tej samej firmie.', 'good'); else setRes(s, kind, `Nowa firma daje tyle samo: ${zl(s.pay)} brutto.`, L_TOP, 'neutral'); }
    else if (r < 0.8) { const pct = lBump(s, cap, 1.05); if (pct > 0) setRes(s, kind, `Nowa praca, pensja wyższa o ${pct}%: ${zl(s.pay)} brutto.`, 'Nie każda zmiana to duży skok, ale nowe miejsce to też nowe doświadczenie.', 'neutral'); else setRes(s, kind, `Nowa praca, pensja ta sama: ${zl(s.pay)} brutto.`, L_TOP, 'neutral'); }
    else { s.gap = 3; const pct = lBump(s, cap, 1.08); setRes(s, kind, pct > 0 ? `Szukanie trwało trzy miesiące bez pensji. Nowa praca płaci o ${pct}% więcej.` : 'Szukanie trwało trzy miesiące bez pensji, a nowa praca płaci tyle samo, bo jesteś już na suficie zarobków w branży.', s.age >= 50 ? 'Po pięćdziesiątce szukanie pracy trwa dłużej. Tym ważniejsza jest poduszka finansowa.' : 'Zmiana pracy ma koszt przejścia. Z poduszką finansową taki okres nie boli.', 'neutral'); }
  } else if (kind === 'course') {
    if (lAvail(s) < 4000 || s.skills >= 5) return;
    s.cash -= 4000; s.skills++;
    lBump(s, lCap(s, f), 1.04);
    setRes(s, kind, `Kurs ukończony. Pensja rośnie do ${zl(s.pay)} brutto, a sufit zarobków w branży idzie w górę.`, 'Inwestycja w umiejętności to jedyna, której nie zabierze krach ani inflacja.', 'good');
  } else if (kind === 'study') {
    if (s.edu >= 3 || s.study || lAvail(s) < 7000) return;
    const n = s.edu === 1 ? 3 : 2;
    s.cash -= 7000; s.study = { left: n };
    if (n > 1) s.recurring.push({ name: 'Czesne za studia zaoczne', amount: 7000, left: n - 1 });
    setRes(s, kind, `Zaczynasz studia zaoczne: ${lata(n)} po 7 000 zł rocznie i zajęte weekendy.`, 'Studia zaoczne łączą pensję z nauką. Kosztują pieniądze i czas, ale otwierają lepiej płatne branże.', 'neutral');
  } else if (kind === 'field') { s.picker = true; }
  render();
};
ACT.lPickerOff = () => { if (S.field) { S.picker = false; render(); } };
ACT.lQuit = () => {
  const s = S;
  if (!s.student || s.phase !== 'plan') return;
  s.student = false; s.trans = true; s.studyLeft = 0; s.picker = true;
  if (s.home === 'dorm') s.home = 'room';
  s.flash = 'Rzucasz studia. Wybierz branżę, w której zaczniesz od przyszłego roku.';
  render();
};
ACT.lField = id => {
  const s = S, f = FIELDS.find(x => x.id === id);
  if (!f || s.phase !== 'plan' || s.student || (s.act && s.field)) return;
  const cost = f.entry(s);
  if (cost === null || (cost > 0 && lAvail(s) < cost) || f.id === s.field) return;
  const first = !s.field;
  s.cash -= cost;
  s.pay = lFieldPay(s, f);
  s.field = f.id; s.picker = false;
  if (!s.known.includes(f.id)) s.known.push(f.id);
  s.mood += first ? 0 : 3;
  setRes(s, 'field', `${first ? 'Zaczynasz' : 'Przechodzisz do'} branży „${f.name}”. Pensja od przyszłego roku: ${zl(s.pay)} brutto.`, first ? 'Pierwsza pensja rzadko jest wysoka. Liczy się to, jak szybko rośnie i jak wysoko sięga sufit w branży.' : 'Zmiana branży często oznacza krok w tył na starcie, ale wyższy sufit zarobków na resztę kariery.', 'good');
  render();
};

function lifeCareer(s) {
  if (s.student) {
    return `<div class="card"><span class="tag violet">Studia</span>
      <h3 style="margin-top:10px">Studiujesz i dorabiasz</h3>
      <p class="small muted">Do dyplomu: ${lata(s.studyLeft)}. Wykształcenie teraz: ${EDU[s.edu]}. Jako student do 26 lat na zleceniu nie płacisz ZUS ani PIT.</p>
      <div class="acct"><div><b>${ic('clock')} Więcej godzin w pracy</b><br><span class="small muted">dochód wyższy o 40%, zadowolenie −5 rocznie</span></div>
        <button class="btn sm ${s.extra ? 'primary' : ''}" data-act="lToggle" data-arg="extra">${s.extra ? 'Pracuję więcej ✓' : 'Biorę'}</button></div>
      <div class="acct"><div><b>${ic('briefcase')} Rzucam studia</b><br><span class="small muted">pełna pensja od razu, ale część branż zostanie zamknięta</span></div>
        <button class="btn sm" data-act="lQuit">Idę do pracy</button></div></div>`;
  }
  if (s.picker || !s.field) {
    return `<div class="card"><span class="tag violet">Kariera</span>
      <h3 style="margin-top:10px">${s.field ? 'Do jakiej branży przechodzisz?' : 'W jakiej branży zaczynasz?'}</h3>
      <p class="small muted">Twoje wykształcenie: ${EDU[s.edu]}. Każda branża ma inną pensję na start i inny sufit zarobków.</p>
      ${FIELDS.filter(f => f.id !== s.field).map(f => {
        const cost = f.entry(s), pay = lFieldPay(s, f), off = cost === null || (cost > 0 && lAvail(s) < cost);
        return `<div class="acct"><div><b>${ic(f.icon)} ${f.name}</b><br>
          <span class="small muted">${f.desc} Na start ${zl(pay)} brutto (${zl(payroll(pay, s.age < 26).netto)} na rękę), sufit ok. ${zl(lCap(s, f))}.<br>
          Wymagania: ${f.need}${cost ? `. Koszt wejścia: <b>${zl(cost)}</b>` : ''}.</span></div>
          <button class="btn sm primary" data-act="lField" data-arg="${f.id}" ${off ? 'disabled' : ''}>${cost === null ? 'Brak dyplomu' : off ? 'Nie stać Cię' : 'Wybieram'}</button></div>`;
      }).join('')}
      ${s.field ? '<button class="btn sm" style="margin-top:12px" data-act="lPickerOff">← Jednak zostaję</button>' : ''}</div>`;
  }
  const f = lField(s), cap = lCap(s, f), net = payroll(lGross(s), s.age < 26).netto;
  const res = s.actRes ? `<div class="card flat ${s.actRes[2] === 'good' ? 'good' : s.actRes[2] === 'bad' ? 'bad' : ''}" style="margin:12px 0 0">
      <p><strong>${s.actRes[0]}</strong></p><p class="small" style="margin:0">${ic('bulb')} ${s.actRes[1]}</p></div>`
    : `<p class="small muted" style="margin:12px 0 8px">Jedna decyzja na rok. Jeśli nie zrobisz nic, pensja realnie spadnie o 1,5%, bo ceny rosną.</p>
      <div class="stack">
        <button class="btn block" data-act="lAct" data-arg="raise">Proszę o podwyżkę</button>
        <button class="btn block" data-act="lAct" data-arg="employer">Zmieniam pracodawcę w tej samej branży</button>
        <button class="btn block" data-act="lAct" data-arg="field">Zmieniam branżę</button>
        <button class="btn block" data-act="lAct" data-arg="course" ${lAvail(s) < 4000 || s.skills >= 5 ? 'disabled' : ''}>Kurs specjalistyczny <span class="muted small">(${s.skills >= 5 ? 'masz już komplet' : '4 000 zł'})</span></button>
        ${s.edu < 3 && !s.study ? `<button class="btn block" data-act="lAct" data-arg="study" ${lAvail(s) < 7000 ? 'disabled' : ''}>Studia zaoczne <span class="muted small">(7 000 zł rocznie przez ${lata(s.edu === 1 ? 3 : 2)})</span></button>` : ''}
      </div>`;
  return `<div class="card"><span class="tag violet">Kariera</span>
    <h3 style="margin-top:10px">${ic(f.icon)} ${f.name}</h3>
    <table class="payslip">
      <tr><td>Pensja brutto${s.abroad > 0 ? ' (kontrakt za granicą)' : ''}${s.extra ? ' z nadgodzinami' : ''}</td><td>${zl(lGross(s))}</td></tr>
      <tr><td>Na rękę${s.age < 26 ? ' (ulga dla młodych)' : ''}</td><td>${zl(net)}</td></tr>
      <tr><td>Sufit zarobków w branży</td><td>${zl(cap)}</td></tr>
      <tr><td>Wykształcenie${s.study ? ` (studia zaoczne, zostało: ${lata(s.study.left)})` : ''}</td><td>${EDU[s.edu]}</td></tr>
      <tr><td>Ukończone kursy i doświadczenia</td><td>${s.skills} z 5</td></tr>
    </table>${res}</div>`;
}

/* ---------- plan roku: życie i pieniądze ---------- */

ACT.lLife = i => { if (L_LIFE[i]) { S.life = i; render(); } };
ACT.lToggle = key => {
  const s = S;
  if (!['extra', 'ppkOn', 'ins'].includes(key) || s.phase !== 'plan') return;
  s[key] = !s[key];
  if (key === 'ppkOn' && !s.ppkOn) s.flash = 'Wypisujesz się z PPK. Tracisz dopłaty od pracodawcy i państwa, czyli darmowe pieniądze.';
  render();
};
const flatNeed = () => FLAT_PRICE * (FLAT_DOWN + FLAT_FEES);
function flatPay() { const P = FLAT_PRICE * (1 - FLAT_DOWN); return P * MORT_RATE / (1 - Math.pow(1 + MORT_RATE, -MORT_YEARS)); }
const creditOk = s => !s.student && s.field && lNetPay(s) * (s.partner ? 1.7 : 1) >= 2 * flatPay() / 12;
ACT.lHome = id => {
  const s = S;
  if (s.phase !== 'plan' || s.home === 'own' || s.home === id) return;
  if (id === 'room' || id === 'flat') { s.home = id; s.rentMul = 1; }
  else if (id === 'own') {
    if (lAvail(s) < flatNeed() || !creditOk(s)) return;
    s.cash -= flatNeed(); s.home = 'own'; s.homeVal = FLAT_PRICE; s.mort = FLAT_PRICE * (1 - FLAT_DOWN); s.mortLeft = MORT_YEARS; s.mood += 6;
    s.flash = `Kupione. Kredyt: ${zl(s.mort)} na ${MORT_YEARS} lat, rata ok. ${zl(mortPay(s) / 12)} miesięcznie od przyszłego roku.`;
  } else return;
  render();
};
ACT.lOverpay = () => {
  const s = S, amt = Math.min(s.step, Math.max(0, lAvail(s)), s.mort);
  if (s.phase !== 'plan' || amt <= 0) return;
  s.cash -= amt; s.mort -= amt;
  if (s.mort < 1) { s.mort = 0; s.mortLeft = 0; s.paidHome = true; s.flash = 'Kredyt spłacony przed czasem. Mieszkanie jest w całości Twoje.'; }
  else s.flash = `Nadpłacone ${zl(amt)}. Rata spada do ok. ${zl(mortPay(s) / 12)} miesięcznie.`;
  render();
};
ACT.lRepay = () => {
  const s = S, amt = Math.min(s.step, Math.max(0, lAvail(s)), s.debt);
  if (s.phase !== 'plan' || amt <= 0) return;
  s.cash -= amt; s.debt -= amt;
  if (s.debt < 1) s.debt = 0;
  render();
};
ACT.lMove = (id, dir) => {
  const s = S, a = L_ASSETS.find(x => x.id === id);
  if (!a || s.phase !== 'plan') return;
  s.flash = '';
  if (!s.step) { s.flash = 'Najpierw wpisz kwotę.'; render(); return; }
  if (dir > 0) {
    let amt = Math.min(s.step, Math.max(0, lAvail(s)));
    if (id === 'ike') {
      amt = Math.min(amt, IKE_LIMIT - s.ikeIn);
      if (amt <= 0) { s.flash = 'Roczny limit wpłat na IKE jest już wykorzystany.'; render(); return; }
      s.ikeIn += amt;
    }
    if (amt <= 0) return;
    s.cash -= amt; s[id] += amt; s.basis[id] += amt;
  } else {
    const amt = Math.min(s.step, s[id]);
    if (amt <= 0) return;
    const frac = amt / s[id], gain = amt - s.basis[id] * frac;
    const free = id === 'ike' && s.age >= 60;
    const tax = a.taxed && !free && gain > 0 ? gain * BELKA : 0, fee = amt * (a.fee || 0);
    s.basis[id] *= 1 - frac; s[id] -= amt;
    s.cash += amt - tax - fee; s.taxPaid += tax;
    if (s[id] < 0.5) { s[id] = 0; s.basis[id] = 0; }
    if (free && gain > 0) s.flash = `Wypłata z IKE po 60. roku życia: ${zl(gain * BELKA)} podatku Belki zostaje w Twojej kieszeni.`;
    else if (tax > 0) s.flash = `Sprzedaż z zyskiem ${zl(gain)}: podatek Belki zabrał ${zl(tax)}.${id === 'ike' ? ' Wypłata z IKE przed 60. rokiem życia traci ulgę.' : ''}`;
    else if (fee > 0) s.flash = `Wcześniejsza wypłata z obligacji kosztowała ${zl(fee)}.`;
    else if (a.taxed && gain < 0) s.flash = `Sprzedaż ze stratą ${zl(-gain)}.`;
  }
  render();
};

// Jedna linijka o mieszkaniu do zwiniętej na telefonie sekcji.
function homeSummary(s) {
  if (s.home === 'own') return `<b>Własne mieszkanie</b>, ${s.mort > 0 ? `do spłaty ${zl(s.mort)}` : 'spłacone'}`;
  return `<b>${HOMES[s.home][0]}</b>, ${zl(lHousing(s))} miesięcznie`;
}

function lifePlan(s) {
  const av = lAvail(s), stud = lCheap(s);
  const homeRow = (id, extra) => `<div class="acct"><div><b>${ic(id === 'own' ? 'key' : 'box')} ${id === 'own' ? 'Własne mieszkanie na kredyt' : HOMES[id][0]}</b><br><span class="small muted">${extra}</span></div>
    ${s.home === id ? '<span class="tag lime">Tu mieszkasz</span>' : `<button class="btn sm" data-act="lHome" data-arg="${id}" ${id === 'own' && (av < flatNeed() || !creditOk(s)) ? 'disabled' : ''}>${id === 'own' ? 'Kupuję' : 'Przeprowadzam się'}</button>`}</div>`;
  const share = s.partner ? 0.6 : 1;
  const housing = s.home === 'own'
    ? `<div class="acct"><div><b>${ic('key')} Własne mieszkanie</b><br><span class="small muted">warte ${zl(s.homeVal)}${s.mort > 0 ? `, do spłaty ${zl(s.mort)} (${lata(s.mortLeft)}, rata ok. ${zl(mortPay(s) / 12)} miesięcznie)` : ', bez kredytu'}</span></div>
        ${s.mort > 0 ? `<button class="btn sm primary" data-act="lOverpay" ${av <= 0 ? 'disabled' : ''}>Nadpłać kredyt</button>` : '<span class="tag lime">Spłacone</span>'}</div>`
    : (s.home === 'dorm' ? homeRow('dorm', `${zl(HOMES.dorm[1] * share)} miesięcznie`) : '')
      + homeRow('room', `${zl(HOMES.room[1] * share * (s.home === 'room' ? s.rentMul : 1))} miesięcznie${s.kids.length ? ', z dzieckiem jest tu ciasno (zadowolenie −4 rocznie)' : ''}`)
      + homeRow('flat', `${zl(HOMES.flat[1] * share * (s.home === 'flat' ? s.rentMul : 1))} miesięcznie`)
      + homeRow('own', `cena ${zl(FLAT_PRICE)}: potrzebujesz ${zl(flatNeed())} na wkład własny i opłaty, potem rata ok. ${zl(flatPay() / 12)} miesięcznie przez ${MORT_YEARS} lat${s.student ? '. Bank nie da kredytu studentowi bez etatu' : creditOk(s) ? '' : '. Bank odmawia: rata nie może przekraczać połowy dochodu'}`);
  const assets = L_ASSETS.map(a => `
    <div class="acct"><div><b>${ic(a.icon)} ${a.name}</b> <span class="tag risk r${a.risk}">${RISK[a.risk]}</span><br>
      <span class="small muted">${a.hint(s)} · masz <b>${zl(s[a.id])}</b></span></div>
      <div class="row"><button class="btn sm" data-act="lMove" data-arg="${a.id}" data-arg2="-1" ${s[a.id] <= 0 ? 'disabled' : ''}>Wypłać</button><button class="btn sm primary" data-act="lMove" data-arg="${a.id}" data-arg2="1" ${av <= 0 ? 'disabled' : ''}>Wpłać</button></div></div>`).join('');
  const noJob = !s.student && !s.field;
  return `${lifeCareer(s)}
  <div class="card">
    <span class="tag lime">Życie</span>
    <h3 style="margin-top:10px">Jak żyjesz w tym roku?</h3>
    <div class="life">${L_LIFE.map((l, i) => `
      <button class="btn ${s.life === i ? 'on' : ''}" data-act="lLife" data-arg="${i}">${l[0]}<small>${zl(l[1] * stud)} / mies.</small><small>${ic(l[2] > 0 ? 'smile' : l[2] < 0 ? 'sad' : 'meh')} ${l[2] > 0 ? '+' + l[2] : l[2]}</small></button>`).join('')}</div>
    <p style="margin-top:14px">Po wydatkach na życie zostanie Ci w tym roku: <strong class="${av < 0 ? 'neg' : ''}">${zl(av)}</strong></p>
    ${av < 0 ? `<p class="small neg"><strong>Brakuje ${zl(-av)}.</strong> Wybierz tańszy styl życia albo wypłać z oszczędności. Inaczej brak pokryje drogi kredyt.</p>` : ''}
    ${foldBlock('home', 'Mieszkanie', homeSummary(s), `<p class="small muted" style="margin:0">Zmiana liczy się od przyszłego roku.</p>${housing}`)}
    ${foldBlock('protect', 'Dochód i ochrona', [s.student ? '' : mark('nadgodziny', s.extra), s.student ? '' : mark('PPK', s.ppkOn), mark('ubezpieczenie', s.ins)].filter(Boolean).join(', '), `
    ${s.student ? '' : `<div class="acct"><div><b>${ic('clock')} Nadgodziny i dodatkowe zlecenia</b><br><span class="small muted">pensja wyższa o 15%, zadowolenie −5 rocznie</span></div>
      <button class="btn sm ${s.extra ? 'primary' : ''}" data-act="lToggle" data-arg="extra">${s.extra ? 'Biorę ✓' : 'Biorę'}</button></div>
    <div class="acct"><div><b>${ic('gift')} PPK</b><br><span class="small muted">oddajesz 2% pensji, a pracodawca dokłada 1,5% i państwo 240 zł rocznie · masz <b>${zl(s.ppk)}</b></span></div>
      <button class="btn sm ${s.ppkOn ? 'primary' : ''}" data-act="lToggle" data-arg="ppkOn">${s.ppkOn ? 'Jestem w PPK ✓' : 'Zapisuję się'}</button></div>`}
    <div class="acct"><div><b>${ic('umbrella')} Pakiet ubezpieczeń</b><br><span class="small muted">${zl(L_INS)} miesięcznie, pokrywa 80% kosztów choroby i szkód w mieszkaniu</span></div>
      <button class="btn sm ${s.ins ? 'primary' : ''}" data-act="lToggle" data-arg="ins">${s.ins ? 'Mam ✓' : 'Kupuję'}</button></div>`)}
  </div>
  <div class="card">
    <span class="tag">Pieniądze</span>
    <h3 style="margin-top:10px">Gdzie trzymasz pieniądze?</h3>
    <p class="small muted" style="margin:0 0 8px">To, co zostaje na zwykłym koncie, traci co roku tyle, ile wynosi inflacja.</p>
    ${s.flash ? `<p class="flash small" style="margin-bottom:10px">${ic('info')} ${s.flash}</p>` : ''}
    <label class="amt">Kwota wpłaty lub wypłaty (zł)
      <input type="number" id="stepIn" inputmode="numeric" min="1" step="1" value="${s.step || ''}" placeholder="np. 5000"></label>
    <p class="small muted" style="margin:4px 0 6px">Wpisz dowolną kwotę. Jeśli będzie większa niż to, co masz, przeniesie się wszystko.</p>
    ${assets}
    ${s.debt > 0 ? `<div class="acct"><div><b>${ic('warn')} Drogi dług: ${zl(s.debt)}</b><br><span class="small neg">rośnie o ${pct(L_DEBT)} rocznie ponad inflację</span></div>
      <button class="btn sm danger" data-act="lRepay" ${av <= 0 ? 'disabled' : ''}>Spłać</button></div>` : ''}
    <button class="btn dark block" style="margin-top:16px" data-act="lEnd" ${noJob ? 'disabled' : ''}>${noJob ? 'Najpierw wybierz branżę' : s.age >= L_END - 1 ? 'Przechodzę na emeryturę i sprawdzam wynik →' : `Zakończ rok. Za chwilę masz ${lata(s.age + 1)} →`}</button>
  </div>`;
}

/* ---------- koniec roku ---------- */

ACT.lEnd = () => {
  const s = S;
  if (s.phase !== 'plan' || (!s.student && !s.field)) return;
  s.notes = []; s.flash = '';
  const f = lField(s);
  if (f && !s.act) { s.pay = Math.max(MIN_WAGE, s.pay * 0.985); s.notes.push(`${ic('price')} Nie rozmawiałeś o pensji. Ceny wzrosły, więc realnie zarabiasz o 1,5% mniej.`); }
  s.cash -= lLifeCost(s);

  const m = drawMarket(s);
  if (s.rebound > 0) s.rebound--;
  s.infl = m.infl;
  if (s.cash > 0) {
    const loss = s.cash * (1 - 1 / (1 + m.infl));
    s.cash -= loss; s.inflLoss += loss;
    if (loss >= 100) s.notes.push(`${ic('price')} Inflacja ${pct(m.infl)}: pieniądze na zwykłym koncie straciły <span class="neg">${zl(loss)}</span> siły nabywczej.`);
  }
  L_ASSETS.forEach(a => {
    if (s[a.id] <= 0) return;
    const r = lRet(a.id, m), gain = s[a.id] * r;
    s[a.id] = Math.max(0, s[a.id] + gain); s.gains += gain;
    if (Math.abs(gain) >= 100) s.notes.push(`${ic(a.icon)} ${a.name}: <span class="${gain >= 0 ? 'pos' : 'neg'}">${signed(gain)}</span> (${(r * 100).toFixed(1).replace('.', ',')}% ponad inflację)`);
  });
  if (s.ppk > 0) { const g = s.ppk * (0.6 * lRet('etf', m) + 0.4 * lRet('bonds', m)); s.ppk += g; s.gains += g; }
  s.zus *= 1 + ZUS_GROWTH;
  if (s.home === 'own') s.homeVal *= 1.005;
  if (s.debt > 0) { const c = s.debt * L_DEBT; s.debt += c; s.notes.push(`${ic('warn')} Drogi dług urósł o <span class="neg">${zl(c)}</span>.`); }
  if (s.cash < 0) {
    const hole = -s.cash;
    s.debt += hole * 1.05; s.cash = 0;
    s.notes.push(`${ic('warn')} Zabrakło ${zl(hole)}. Brak pokrył kredyt gotówkowy z prowizją 5%.`);
    s.lessons.push('Gdy wydajesz więcej, niż zarabiasz, różnicę pokrywa najdroższy możliwy dług.');
  }
  if (s.debt > 3 * Math.max(30000, lNetPay(s) * 12) && s.age - s.bankAge >= 10) lifeBankrupt(s);

  s.mood += L_LIFE[s.life][2] + (f ? f.mood : 0) + (s.extra ? -5 : 0) + (s.study ? -4 : 0) + (s.partner ? 1 : 0) + (s.kids.length ? 1 : 0)
    + (s.kids.length && s.home === 'room' ? -4 : 0) + (lDebts(s) > 0 ? -2 : 0) + (60 - s.mood) * 0.25;
  s.mood = clamp(s.mood, 0, 100);
  s.moodSum += s.mood; s.years++;

  if (s.study && --s.study.left <= 0) {
    s.study = null; s.edu++; s.pay *= 1.06;
    s.notes.push(`${ic('book')} Studia zaoczne ukończone: ${EDU[s.edu]}. Pensja rośnie o 6%, a nowe branże stoją otworem.`);
  }
  if (s.student && --s.studyLeft <= 0) { s.edu++; s.dyplom = true; }
  s.act = null; s.actRes = null; s.picker = false; s.ikeIn = 0; s.trans = false;
  s.hist.push({ n: lNet(s), r: s.cash + lFin(s) - lDebts(s) });
  s.age++;
  if (s.age >= L_END) { s.phase = 'end'; lifeFinish(s); }
  else { lifePayday(); lifeNextEvent(); }
  render();
  window.scrollTo(0, 0);
};

// Upadłość konsumencka: majątek idzie na spłatę wierzycieli, reszta długu jest umarzana.
function lifeBankrupt(s) {
  let pot = s.cash + L_ASSETS.reduce((a, x) => a + s[x.id], 0);
  L_ASSETS.forEach(a => { s[a.id] = 0; s.basis[a.id] = 0; });
  if (s.home === 'own') { pot += Math.max(0, s.homeVal - s.mort); s.home = 'room'; s.rentMul = 1; s.homeVal = 0; s.mort = 0; s.mortLeft = 0; }
  s.cash = Math.max(0, pot - s.debt);
  s.debt = 0; s.bankrupt++; s.bankAge = s.age; s.mood -= 25; s.life = 0;
  s.notes.push(`${ic('warn')} <strong>Upadłość konsumencka.</strong> Długi przerosły Twoje możliwości. Sąd umorzył resztę, ale oszczędności${pot > 0 ? ' i majątek poszły' : ' poszłyby'} na spłatę wierzycieli.`);
  s.lessons.push('Dług rosnący szybciej, niż jesteś w stanie go spłacać, kończy się upadłością: tracisz majątek i na lata zdolność kredytową.');
}

/* ---------- wynik ---------- */

function lPension(s) {
  const gross = s.zus / PENSION_MONTHS;
  return { gross, net: gross - 0.09 * gross - Math.max(0, 0.12 * gross - 300) };
}
// Majątek finansowy po sprzedaży wszystkiego: zwykłe inwestycje po podatku Belki, IKE i PPK bez niego.
function lFinNet(s) {
  const inv = L_ASSETS.reduce((a, x) => a + s[x.id] - (x.taxed && x.id !== 'ike' ? Math.max(0, s[x.id] - s.basis[x.id]) * BELKA : 0), 0);
  return s.cash + inv + s.ppk - lDebts(s);
}
function lifeScore(s) {
  const fin = lFinNet(s), net = fin + lEquity(s);
  const rate = s.totalIn > 0 ? net / s.totalIn : 0;
  const wealth = clamp(rate / 0.7, 0, 1) * 40;
  const pen = lPension(s), lastNet = payroll(Math.max(s.topPay, 1), false).netto;
  const monthly = pen.net + Math.max(0, fin) * 0.04 / 12;
  const repl = monthly / Math.max(1, lastNet);
  const retire = clamp(repl / 0.9, 0, 1) * 20;
  const avgMood = s.years ? s.moodSum / s.years : s.mood;
  const mood = avgMood / 100 * 25;
  const safety = s.bankrupt ? 0 : Math.max(0, 15 - 5 * s.scams - (lDebts(s) > 0 ? 6 : 0));
  const total = Math.round(wealth + retire + mood + safety);
  const title = total >= 80 ? 'Finansowy ninja' : total >= 60 ? 'Ogarniacz' : total >= 40 ? 'Na styk' : 'Bankrut z klasą';
  const ticon = total >= 80 ? 'ninja' : total >= 60 ? 'smile' : total >= 40 ? 'meh' : 'sad';
  return { total, title, ticon, wealth: Math.round(wealth), retire: Math.round(retire), mood: Math.round(mood), safety, rate, fin, net, pen, monthly, repl, lastNet, avgMood };
}

function lifeFinish(s) {
  if (s.saved) return;
  s.saved = true;
  const sc = lifeScore(s), out = [];
  if (s.scams === 0) out.push('czysto');
  if (lDebts(s) <= 0 && !s.bankrupt) out.push('bezdlugu');
  if (s.heldCrash) out.push('nerwy');
  if (sc.total >= 80) out.push('ninja');
  if (s.insUsed) out.push('polisa');
  if (s.gains > s.inflLoss && s.gains > 0) out.push('inflacja');
  if (sc.repl >= 0.7) out.push('emeryt');
  if (sc.net >= 1000000) out.push('milioner');
  if (s.paidHome) out.push('dom');
  s.earned = out;
  s.fresh = out.filter(id => !STORE.badges.includes(id));
  STORE = { best: STORE.best, games: STORE.games + 1, badges: BADGES.map(b => b.id).filter(id => STORE.badges.includes(id) || out.includes(id)) };
  saveStore(STORE);
}

/* ---------- widoki ---------- */

function lifeHud(s) {
  const f = lField(s), debts = lDebts(s) + s.mort;
  return `
  <div class="hud static">
    <div class="row between small" style="font-weight:700;margin-bottom:6px">
      <span>${ic(s.student ? 'backpack' : f ? f.icon : 'briefcase')} ${lata(Math.min(s.age, L_END))} · ${s.student ? 'student' : f ? f.name : 'szukasz pracy'}</span>
      <button class="chip" data-act="restart" data-arg="1">Od nowa</button>
    </div>
    <div class="progress"><i style="width:${(s.age - L_START) / (L_END - L_START) * 100}%"></i></div>
  </div>
  <div class="hud hud-money${s.phase === 'end' ? ' static' : ''}">
    <div class="money">
      <div><span>Konto</span><b>${zl(s.cash)}</b></div>
      <div><span>Oszczędności</span><b>${zl(s.save + s.bonds)}</b></div>
      <div><span>Inwestycje i PPK</span><b>${zl(s.etf + s.ike + s.stock + s.crypto + s.ppk)}</b></div>
      ${s.home === 'own' ? `<div><span>Mieszkanie</span><b>${zl(s.homeVal)}</b></div>` : ''}
      ${debts > 0 ? `<div class="debt"><span>Kredyty i długi</span><b>${zl(debts)}</b></div>` : ''}
    </div>
  </div>
  <div class="hud static hud-bars">
    <div class="mood wide"><span>${ic('smile')} Zadowolenie</span><div class="progress"><i style="width:${s.mood}%"></i></div><span>${Math.round(s.mood)}</span></div>
    <div class="infl small">${ic('price')} Inflacja w ostatnim roku: <b>${pct(s.infl)}</b> · wszystkie kwoty w dzisiejszych cenach</div>
  </div>`;
}

function viewLife(s) {
  if (s.phase === 'end') return lifeEnd(s);
  if (s.phase === 'plan') return lifeHud(s) + lifePlan(s);
  const e = s.event;
  const slip = `<table class="payslip">${s.slip.map(([l, a]) => `<tr><td>${l}</td><td class="${a < 0 ? 'neg' : ''}">${a < 0 ? '−' + zl(-a) : zl(a)}</td></tr>`).join('')}
    <tr class="total"><td>Zostaje na życie i oszczędności</td><td class="${s.free < 0 ? 'neg' : ''}">${zl(s.free)}</td></tr></table>`;
  const intro = s.age === L_START
    ? `<div class="card violet flat"><span class="tag">Masz 20 lat</span>
        <p style="margin:10px 0">Studiujesz i dorabiasz. Przed Tobą 45 lat decyzji: praca, mieszkanie, rodzina, inwestycje i emerytura. Jedna tura to jeden rok.</p>${slip}</div>`
    : `<div class="card flat"><span class="tag">Nowy rok · ${lata(s.age)}</span>
        <div style="margin-top:8px">${slip}</div>
        ${s.notes.length ? `<p class="small" style="margin:12px 0 0"><strong>Jak poszło w zeszłym roku</strong></p><ul class="notes" style="margin-top:4px">${s.notes.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}</div>`;
  const body = s.result
    ? resultCard(s.result, 'lToPlan', 'Dalej: plan roku →')
    : `<div class="stack">${e.choices.map((c, i) => {
        if (c.show && !c.show(s)) return '';
        const cost = val(c.cost, s), off = cost && s.cash < cost;
        return `<button class="btn block" ${off ? 'disabled' : ''} data-act="lPick" data-arg="${i}">${val(c.label, s)}${cost ? ` <span class="muted small">(${zl(cost)})</span>` : ''}${off ? ' <span class="small">– nie stać Cię</span>' : ''}</button>`;
      }).join('')}</div>`;
  return lifeHud(s) + intro + `
    <div class="card event"><div class="icon">${ic(e.icon)}</div><h2 style="margin-top:8px">${val(e.title, s)}</h2><p>${val(e.text, s)}</p>${body}</div>`;
}

function lifeEnd(s) {
  const sc = lifeScore(s), lessons = [...new Set(s.lessons)].slice(0, 6);
  return lifeHud(s) + `
  <div class="card lime">
    <span class="tag">Twój wynik · od 20 do 65 lat</span>
    <div class="score" style="margin-top:10px">${sc.total}<span style="font-size:1.5rem">/100</span></div>
    <h2 style="margin-top:6px">${sc.title} ${ic(sc.ticon)}</h2>
    <p>Majątek w wieku 65 lat: <strong>${zl(sc.net)}</strong> w dzisiejszych cenach, po podatkach.</p>
    <div class="row">
      <button class="btn dark" data-act="share">Udostępnij wynik</button>
      <button class="btn" data-act="restart">Zagraj jeszcze raz</button>
    </div>
    <p class="small" id="shareMsg" style="margin:10px 0 0"></p>
  </div>

  ${rankForm(s, 'life')}

  <div class="card">
    <h3>${ic('sun')} Twoja emerytura</h3>
    <table class="payslip">
      <tr><td>Emerytura z ZUS na rękę (brutto ${zl(sc.pen.gross)})</td><td>${zl(sc.pen.net)}</td></tr>
      <tr><td>Z własnych oszczędności, inwestycji i PPK (4% rocznie z ${zl(Math.max(0, sc.fin))})</td><td>${zl(Math.max(0, sc.fin) * 0.04 / 12)}</td></tr>
      <tr class="total"><td>Razem miesięcznie</td><td>${zl(sc.monthly)}</td></tr>
    </table>
    <p class="small" style="margin:10px 0 0">${ic('bulb')} To <strong>${Math.round(sc.repl * 100)}%</strong> Twojej najwyższej pensji na rękę (${zl(sc.lastNet)}). Sama emerytura z ZUS dałaby ${Math.round(sc.pen.net / Math.max(1, sc.lastNet) * 100)}%. Resztę trzeba odłożyć samemu, a im wcześniej się zacznie, tym więcej zrobi procent składany.</p>
  </div>

  <div class="card">
    <h3>${ic('chartup')} 45 lat na jednym wykresie</h3>
    <p class="small muted">Fioletowa linia to cały majątek razem z mieszkaniem, zielona to same pieniądze i inwestycje. Pionowe linie oznaczają kolejne dziesięciolecia.</p>
    ${histChart(s, 10)}
    <table class="payslip">
      <tr><td>Zarobione na rękę przez całe życie</td><td>${zl(s.totalIn)}</td></tr>
      <tr><td>Zyski z oszczędności i inwestycji ponad inflację</td><td class="${s.gains >= 0 ? 'pos' : 'neg'}">${signed(s.gains)}</td></tr>
      <tr><td>Tyle straciła gotówka na zwykłym koncie przez inflację</td><td class="neg">−${zl(s.inflLoss)}</td></tr>
      <tr><td>Zapłacony podatek Belki</td><td>${zl(s.taxPaid)}</td></tr>
    </table>
  </div>

  <div class="card end-badges">
    <h3>Odznaki z tej rozgrywki</h3>
    ${s.fresh.length ? `<p class="small pos"><strong>Nowe odznaki: ${s.fresh.length}</strong></p>` : ''}
    ${(s.earned || []).length ? '' : '<p class="small muted m-only" hidden>W tej grze nie zdobyłeś żadnej odznaki. Zobacz wszystkie na stronie głównej.</p>'}
    ${badgeGrid(s.earned || [], s.fresh)}
  </div>

  <div class="card">
    <h3>Skąd ten wynik?</h3>
    <table class="payslip">
      <tr><td>${ic('cash')} Majątek (${Math.round(clamp(sc.rate, -9, 9) * 100)}% wszystkiego, co zarobiłeś)</td><td>${sc.wealth}/40</td></tr>
      <tr><td>${ic('sun')} Dochód na emeryturze (${Math.round(sc.repl * 100)}% najwyższej pensji)</td><td>${sc.retire}/20</td></tr>
      <tr><td>${ic('smile')} Zadowolenie z życia (średnio ${Math.round(sc.avgMood)})</td><td>${sc.mood}/25</td></tr>
      <tr><td>${ic('shield')} Bezpieczeństwo (scamy: ${s.scams}, długi: ${lDebts(s) > 0 ? 'tak' : 'nie'}${s.bankrupt ? ', upadłość' : ''})</td><td>${sc.safety}/15</td></tr>
    </table>
  </div>

  ${lessons.length ? `<div class="card bad"><h3>Czego nauczyło Cię to życie</h3><ul class="flags">${lessons.map(l => `<li>${l}</li>`).join('')}</ul></div>` : `<div class="card good"><h3>Czysta gra</h3><p style="margin:0">45 lat bez żadnej wpadki.</p></div>`}

  <div class="row">
    <button class="btn primary" data-act="go" data-arg="rank">Ranking →</button>
    <button class="btn" data-act="go" data-arg="challenge">Wyzwanie 30 dni</button>
    <button class="btn" data-act="go" data-arg="lessons">Lekcje w 2 minuty</button>
  </div>`;
}
