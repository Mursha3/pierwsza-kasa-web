/* Ogarniam Kasę – „Wyzwanie 30 dni”: codziennie jedno małe zadanie z prawdziwymi pieniędzmi gracza.
   Nowe zadanie odblokowuje się następnego dnia kalendarzowego po odhaczeniu poprzedniego.
   Gracz niczego nie wpisuje: tylko odhacza. Postęp zapisuje się wyłącznie w tej przeglądarce. */
'use strict';

const CH_KEY = 'ogarniamKase.challenge.v1', CH_DAYS = 30;

// [tytuł, po co, jak, opcjonalny link do części strony: [widok, napis]]
const CH_TASKS = [
  ['Sprawdź, ile masz pieniędzy', 'Trudno planować, jeśli nie wiesz, od czego zaczynasz.', 'Zajrzyj do aplikacji banku, portfela i skarbonki. Zsumuj wszystko i zapamiętaj tę kwotę: wrócisz do niej ostatniego dnia wyzwania.'],
  ['Zapisz wszystkie dzisiejsze wydatki', 'Drobne wydatki najłatwiej przeoczyć, a to one zjadają kieszonkowe.', 'Wieczorem zapisz w notatkach w telefonie każdy wydatek z dziś, nawet bułkę za 3 zł. Zachowaj tę notatkę na koniec wyzwania.'],
  ['Znajdź swoje subskrypcje', 'Stałe opłaty działają po cichu: pieniądze znikają co miesiąc, choć nic nie kupujesz.', 'Przejrzyj subskrypcje w Google Play albo App Store, w muzyce, filmach i grach. Policz, ile kosztują razem miesięcznie i ile rocznie.'],
  ['Pozbądź się jednej zbędnej opłaty', 'Najłatwiej zaoszczędzić na czymś, czego i tak nie używasz.', 'Jeśli wczoraj znalazłeś subskrypcję, z której prawie nie korzystasz, anuluj ją. Jeśli wszystkie są potrzebne, sprawdź, czy jest tańszy plan albo plan rodzinny.'],
  ['Policz jeden nawyk w skali roku', 'Mały codzienny wydatek w skali roku robi się zaskakująco duży.', 'Wybierz coś, co kupujesz regularnie: napój, przekąskę, doładowanie w grze. Pomnóż cenę przez to, ile razy kupujesz w tygodniu, a potem przez 52.'],
  ['Ustal cel oszczędnościowy', 'Łatwiej odkładać, gdy wiesz, na co.', 'Zapisz, na co odkładasz, ile to kosztuje i do kiedy chcesz to mieć. Podziel kwotę przez liczbę tygodni: tyle trzeba odkładać co tydzień.'],
  ['Odłóż pierwsze pieniądze na cel', 'Liczy się nawyk, a nie kwota.', 'Odłóż dziś cokolwiek, nawet 5 zł: na osobne konto albo cel w aplikacji banku, a jeśli nie masz konta, do osobnej koperty.'],
  ['Dzień bez wydawania', 'Jeden dzień przerwy pokazuje, ile zakupów robisz z przyzwyczajenia.', 'Dziś nie wydawaj nic poza tym, co naprawdę konieczne, np. biletem. Wieczorem pomyśl, co chciałeś kupić i czy rzeczywiście tego brakuje.'],
  ['Włącz powiadomienia o płatnościach', 'Szybko zauważysz każdy wydatek, także taki, którego nie robiłeś.', 'W aplikacji banku włącz powiadomienia o płatnościach kartą, BLIK i przelewach. Jeśli nie masz jeszcze konta, sprawdź na stronie wybranego banku, czy jego aplikacja to umożliwia.'],
  ['Ustaw niższe limity płatności', 'Gdy ktoś przejmie kartę albo telefon, niski limit ogranicza stratę.', 'W aplikacji banku sprawdź dzienne limity kartą, w internecie i BLIK. Ustaw je na kwoty, których naprawdę potrzebujesz. W razie większego zakupu podniesiesz je na chwilę.'],
  ['Zabezpiecz maila', 'Kto ma dostęp do Twojego maila, może zresetować hasła do innych kont.', 'Zmień hasło do maila na długie, np. trzy przypadkowe słowa i cyfra, i włącz w ustawieniach konta weryfikację dwuetapową.'],
  ['Naucz się rozpoznawać oszustów', 'Oszuści celują w młodych, bo ci częściej klikają w linki.', 'Zrób quiz „Scam czy nie scam?” na tej stronie. Przy każdej pomyłce przeczytaj, po czym można było poznać oszusta.', ['quiz', 'Otwórz quiz']],
  ['Porównaj cenę w trzech miejscach', 'Ta sama rzecz potrafi kosztować w różnych sklepach zupełnie inaczej.', 'Wybierz rzecz, którą chcesz kupić. Sprawdź jej cenę w trzech sklepach razem z kosztem dostawy i policz różnicę między najtańszą a najdroższą ofertą.'],
  ['Przelicz cenę na godziny pracy', 'Łatwiej ocenić zakup, gdy wiesz, ile czasu na niego pracujesz.', 'Podziel cenę rzeczy, którą chcesz kupić, przez to, ile zarabiasz na godzinę albo ile masz kieszonkowego na dzień. Czy nadal jest tego warta?'],
  ['Zasada 24 godzin', 'Wiele zakupów to impuls, który mija po jednym dniu.', 'Jeśli dziś zechcesz kupić coś, czego nie planowałeś, odłóż decyzję do jutra. Jutro sprawdź, czy nadal tego chcesz.'],
  ['Znajdź rzeczy do sprzedania', 'Nieużywane rzeczy to zamrożone pieniądze.', 'Zrób listę rzeczy, których nie używasz: ubrań, gier, sprzętu. Sprawdź na portalu z ogłoszeniami, za ile sprzedają się podobne, i policz, ile mógłbyś odzyskać.'],
  ['Sprawdź koszt telefonu', 'Abonament i doładowania to wydatek co miesiąc przez lata.', 'Sprawdź, ile płacisz miesięcznie za telefon i ile danych naprawdę zużywasz. Porównaj to z ofertami dwóch innych sieci.'],
  ['Poznaj RRSO', 'Raty „0%” i szybkie pożyczki potrafią kosztować dużo więcej, niż widać w reklamie.', 'Przeczytaj w lekcjach na tej stronie, czym jest RRSO i dlaczego „0%” nie zawsze znaczy za darmo.', ['lessons', 'Otwórz lekcje']],
  ['Zobacz procent składany w akcji', 'Czas robi z małych kwot duże, ale tylko gdy zaczniesz wcześnie.', 'W kalkulatorze procentu składanego w lekcjach sprawdź, ile urośnie 50 zł odkładane co miesiąc przez 10 lat.', ['lessons', 'Otwórz kalkulator']],
  ['Znajdź najdroższy mały wydatek', 'Drobne, powtarzające się wydatki sumują się w duże kwoty.', 'Przejrzyj historię konta z ostatniego miesiąca albo swoje notatki. Który drobny wydatek powtarzał się najczęściej i ile kosztował razem?'],
  ['Rozpisz budżet na tydzień', 'Plan na tydzień jest łatwiejszy do utrzymania niż plan na miesiąc.', 'Podziel pieniądze na najbliższy tydzień: około połowy na rzeczy potrzebne, do jednej trzeciej na przyjemności i co najmniej jedną piątą na oszczędności (zasada 50/30/20).'],
  ['Najpierw odłóż, potem wydawaj', 'Jeśli odkładasz to, co zostanie, zwykle nie zostaje nic.', 'Ustaw w telefonie przypomnienie na dzień wypłaty albo kieszonkowego: najpierw przelew na oszczędności, dopiero potem wydatki.'],
  ['Sprawdź, jak zastrzec PESEL', 'Zastrzeżony PESEL utrudnia oszustom wzięcie kredytu na Twoje dane.', 'Sprawdź w aplikacji mObywatel albo na gov.pl, jak działa zastrzeżenie numeru PESEL. Osoby pełnoletnie mogą to zrobić w aplikacji, bezpłatnie.'],
  ['Zapisz numer do swojego banku', 'Po kradzieży karty liczy się każda minuta.', 'Znajdź na oficjalnej stronie swojego banku numer infolinii i zapisz go w kontaktach. Nie bierz numeru z wyszukiwarki ani z reklam, bo oszuści podstawiają fałszywe.'],
  ['Sprawdź, ile dostaniesz na rękę', 'Kwota w ogłoszeniu o pracę to zwykle brutto, a nie to, co trafi na konto.', 'W lekcji „Brutto i netto” sprawdź, ile zostaje z pensji na różnych umowach i czy obejmuje Cię ulga dla młodych.', ['lessons', 'Otwórz lekcje']],
  ['Lista rzeczy niewartych pieniędzy', 'Na własnych błędach uczysz się najszybciej, jeśli je nazwiesz.', 'Wypisz trzy rzeczy z ostatnich miesięcy, na które wydałeś pieniądze i dziś tego żałujesz. Co je łączy: pośpiech, promocja, presja?'],
  ['Sprawdź, jak chronione są oszczędności', 'Dobrze wiedzieć, co się stanie z pieniędzmi, gdy bank upadnie.', 'Przeczytaj w słowniczku na stronie lekcji, czym jest BFG i do jakiej kwoty chroni pieniądze w banku.', ['lessons', 'Otwórz słowniczek']],
  ['Przeżyj całe życie w symulatorze', 'Najlepiej widać skutki decyzji w perspektywie 45 lat.', 'Zagraj w tryb od 20 do 65 lat i sprawdź, jak odkładanie od młodości zmienia majątek i emeryturę.', ['game', 'Otwórz symulator']],
  ['Plan na najbliższy rok', 'Cel z datą i krokami spełnia się dużo częściej niż samo „chcę oszczędzać”.', 'Zapisz, ile chcesz mieć odłożone za rok, i trzy konkretne kroki, które Ci w tym pomogą.'],
  ['Podsumowanie wyzwania', 'Zobacz, co zmieniło się przez te dni.', 'Sprawdź jeszcze raz, ile masz pieniędzy, i porównaj z kwotą z dnia 1. Policz też dzisiejsze wydatki i porównaj z notatką z dnia 2. Co zmieniło się najbardziej?']
];

/* ---------- zapis (z walidacją) ---------- */

function chToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const CH_DATE = /^\d{4}-\d{2}-\d{2}$/;
const chDayNum = s => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };

function chLoad() {
  try {
    const d = JSON.parse(localStorage.getItem(CH_KEY) || 'null');
    const done = {};
    // Przyjmujemy tylko ciągłą serię dni od 1 z poprawnymi datami; reszta zapisu jest odrzucana.
    for (let i = 1; i <= CH_DAYS; i++) {
      const v = d && d.done && typeof d.done === 'object' ? d.done[i] : null;
      if (typeof v !== 'string' || !CH_DATE.test(v)) break;
      done[i] = v;
    }
    return { done };
  } catch (err) { return { done: {} }; }
}
function chSave() { try { localStorage.setItem(CH_KEY, JSON.stringify(CH)); } catch (err) { /* tryb prywatny */ } }

let CH = chLoad(), chSel = 0, chMsg = '';

const chCount = () => Object.keys(CH.done).length;
function chState() {
  const n = chCount(), doneToday = n > 0 && CH.done[n] === chToday();
  return { n, doneToday, finished: n >= CH_DAYS, available: n < CH_DAYS && !doneToday, next: Math.min(n + 1, CH_DAYS) };
}
// Dni z rzędu z odhaczonym zadaniem, licząc od dziś (albo od wczoraj, jeśli dziś jeszcze nic).
function chStreak() {
  const days = new Set(Object.values(CH.done).map(chDayNum));
  let d = chDayNum(chToday()), k = 0;
  if (!days.has(d)) d--;
  while (days.has(d)) { k++; d--; }
  return k;
}

/* ---------- akcje ---------- */

ACT.chDone = () => {
  const st = chState();
  if (!st.available) return;
  CH.done[st.next] = chToday();
  chSave();
  const streak = chStreak(), earned = [];
  if (streak >= 7) earned.push('seria');
  if (st.next === CH_DAYS) earned.push('wyzwanie');
  const fresh = earned.filter(id => !STORE.badges.includes(id));
  if (fresh.length) {
    STORE = Object.assign({}, STORE, { badges: BADGES.map(b => b.id).filter(id => STORE.badges.includes(id) || fresh.includes(id)) });
    saveStore(STORE);
  }
  chSel = 0;
  chMsg = fresh.length ? `Nowa odznaka: ${fresh.map(id => BADGES.find(b => b.id === id).name).join(', ')}!` : '';
  render();
};

ACT.chShow = n => {
  const st = chState();
  if (!Number.isInteger(n) || n < 1 || n > CH_DAYS || (!CH.done[n] && !(st.available && n === st.next))) return;
  chSel = n; chMsg = '';
  render();
  const card = document.getElementById('chTask');
  if (card) card.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
};

ACT.chReset = (a, b, el) => {
  if (el.dataset.sure !== '1') {
    el.dataset.sure = '1'; el.textContent = 'Na pewno? Postęp zniknie';
    setTimeout(() => { if (el.isConnected) { el.dataset.sure = ''; el.textContent = 'Zacznij od nowa'; } }, 3000);
    return;
  }
  CH = { done: {} }; chSave(); chSel = 0; chMsg = '';
  render();
};

/* ---------- widok ---------- */

function chTaskCard(n, st) {
  const [title, why, how, link] = CH_TASKS[n - 1];
  const done = CH.done[n];
  const date = done ? new Date(chDayNum(done) * 864e5).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : '';
  const tag = done ? `<span class="tag lime">${ic('check')} Dzień ${n} · zrobione ${date}</span>` : `<span class="tag violet">Dzień ${n} z ${CH_DAYS} · zadanie na dziś</span>`;
  const action = done
    ? (st.doneToday && n === st.n && !st.finished ? `<p class="small muted" style="margin:12px 0 0">${ic('clock')} Kolejne zadanie odblokuje się jutro.</p>` : '')
    : `<button class="btn primary block" style="margin-top:14px" data-act="chDone">${ic('check')} Zrobione</button>`;
  return `<div class="card ch-task" id="chTask">${tag}
    <h2 style="margin-top:12px">${title}</h2>
    <p class="muted">${why}</p>
    <p style="margin-bottom:0">${how}</p>
    ${link ? `<button class="btn sm" style="margin-top:12px" data-act="go" data-arg="${link[0]}">${link[1]} →</button>` : ''}
    ${action}
  </div>`;
}

function viewChallenge() {
  const st = chState(), streak = chStreak();
  const shown = chSel || (st.available ? st.next : Math.max(1, st.n));
  const cells = CH_TASKS.map((t, i) => {
    const n = i + 1, done = !!CH.done[n], today = st.available && n === st.next;
    const cls = done ? 'done' : today ? 'today' : 'locked';
    const label = done ? `Dzień ${n}: ${t[0]}, zrobione` : today ? `Dzień ${n}: zadanie na dziś` : `Dzień ${n}: jeszcze zablokowane`;
    return `<button class="ch-cell ${cls}${n === shown ? ' sel' : ''}" data-act="chShow" data-arg="${n}" ${done || today ? '' : 'disabled'} aria-label="${label}">${done ? ic('check') : n}</button>`;
  }).join('');
  const intro = st.finished
    ? `<div class="card lime"><h3>${ic('trophy')} Wyzwanie ukończone!</h3><p style="margin:0">Przez ${CH_DAYS} dni zrobiłeś coś dla swoich pieniędzy. Najważniejsze nawyki zostają: najpierw odkładaj, sprawdzaj wydatki i nie daj się oszustom.</p></div>`
    : '';
  return `
  <h2>${ic('calendar')} Wyzwanie ${CH_DAYS} dni</h2>
  <p class="muted">Codziennie jedno małe zadanie z Twoimi prawdziwymi pieniędzmi, na 5–10 minut. Nowe zadanie odblokowuje się następnego dnia. Niczego nie wpisujesz, tylko odhaczasz, a postęp zapisuje się wyłącznie w tej przeglądarce.</p>
  <div class="card flat ch-top">
    <div class="row between"><span><b class="ch-big">${st.n}</b> / ${CH_DAYS} dni</span><span>${ic('bolt')} Seria: <b class="ch-big">${streak}</b> ${streak === 1 ? 'dzień' : 'dni'} z rzędu</span></div>
    <div class="progress"><i style="width:${st.n / CH_DAYS * 100}%"></i></div>
  </div>
  ${chMsg ? `<p class="flash small">${ic('trophy')} ${chMsg}</p>` : ''}
  ${intro}
  ${chTaskCard(shown, st)}
  <h3 style="margin-top:22px">Wszystkie dni</h3>
  <div class="ch-grid">${cells}</div>
  ${st.n ? '<button class="btn sm" style="margin-top:16px" data-act="chReset">Zacznij od nowa</button>' : ''}`;
}
