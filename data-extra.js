/* Ogarniam Kasę – rozbudowa: aktywa, inflacja, dodatkowe zdarzenia. Ładowane po data.js. */

const pct = x => (x * 100).toFixed(1).replace('.', ',') + '%';
const BELKA = 0.19;
const LENGTHS = [[12, '1 rok'], [24, '2 lata'], [36, '3 lata']];
const RISK = ['niskie ryzyko', 'średnie ryzyko', 'wysokie ryzyko', 'bardzo wysokie ryzyko'];

// Miejsca na pieniądze. ret(s) zwraca miesięczną stopę zwrotu, fee to opłata przy wypłacie.
const ASSETS = [
  { id: 'save', icon: 'bank', name: 'Konto oszczędnościowe', risk: 0,
    hint: s => `ok. ${pct(s.saveRate)} rocznie na rękę, pewne i dostępne od ręki`, ret: s => s.saveRate / 12 },
  { id: 'bonds', icon: 'bond', name: 'Obligacje indeksowane inflacją', risk: 0, fee: 0.02,
    hint: s => `inflacja + 1,5% (teraz ok. ${pct((s.infl + 0.015) * (1 - BELKA))} na rękę), wypłata kosztuje 2%`, ret: s => (s.infl + 0.015) * (1 - BELKA) / 12 },
  { id: 'etf', icon: 'chartup', name: 'ETF na cały świat', risk: 1, taxed: true,
    hint: () => 'średnio ok. 6–7% rocznie, ale po drodze skacze', ret: () => clamp(0.006 + randn() * 0.035, -0.1, 0.1) },
  { id: 'stock', icon: 'stock', name: 'Akcje jednej spółki', risk: 2, taxed: true,
    hint: () => 'może mocno zyskać albo mocno stracić', ret: () => clamp(0.007 + randn() * 0.1, -0.35, 0.4) },
  { id: 'crypto', icon: 'crypto', name: 'Kryptowaluta', risk: 3, taxed: true,
    hint: () => 'ogromne wahania, możliwy nagły krach o 60%', ret: () => (Math.random() < 0.03 ? -0.6 : clamp(randn() * 0.22, -0.5, 0.9)) }
];

// Dodatkowa zmiana w miesiącu i koszty rozwoju.
const SHIFT = { uczen: 400, osiemnastka: 300, absolwent: 600 };
const COURSE_COST = 1500, BIZ_COST = 600, INS_COST = 35;

// Kwota do zapłaty przy stracie: polisa pokrywa 80%.
const insured = (s, amount) => { if (s.ins) { s.insUsed = true; return Math.round(amount * 0.2); } return amount; };

// Krach dotyka też akcji.
{
  const k = EVENTS.find(e => e.id === 'krach');
  k.cond = s => s.etf + s.stock >= 200;
  k.pre = s => { s.etf *= 0.85; s.stock *= 0.8; };
  k.text = 'Nagłówki krzyczą o panice. Twój ETF stracił w tym miesiącu 15%, a akcje 20%.';
  k.choices[0].run = s => { s.cash += s.etf + s.stock; s.etf = 0; s.stock = 0; return ['Sprzedałeś ze stratą. Pieniądze wróciły na konto.', 'Sprzedaż w panice zamienia chwilowy spadek w trwałą stratę. Historycznie szerokie rynki odrabiały spadki, ale trwało to czasem lata.', 'bad']; };
}

EVENTS.push(
  {
    id: 'stopy', icon: 'bank', title: 'Zmiana stóp procentowych',
    pre: s => { s.tmp = Math.random() < 0.5 ? 0.01 : -0.01; if (s.saveRate + s.tmp < 0.01) s.tmp = 0.01; },
    text: s => `Rada Polityki Pieniężnej ${s.tmp > 0 ? 'podnosi' : 'obniża'} stopy procentowe o 1 punkt procentowy.`,
    choices: [
      { label: 'Sprawdzam, co to dla mnie znaczy', run: s => {
          s.saveRate += s.tmp * 0.8; s.debtRate = clamp(s.debtRate + s.tmp * 0.2, 0.02, 0.06);
          return s.tmp > 0
            ? [`Konto oszczędnościowe płaci teraz ok. ${pct(s.saveRate)}, ale długi drożeją.`, 'Wyższe stopy to lepsze lokaty i droższe kredyty. Dobry moment, żeby porównać oferty banków.', 'neutral']
            : [`Konto oszczędnościowe płaci teraz tylko ok. ${pct(s.saveRate)}, za to długi są trochę tańsze.`, 'Niższe stopy to słabsze lokaty. Gdy oprocentowanie spada poniżej inflacji, oszczędności realnie tracą.', 'neutral'];
        } }
    ]
  },
  {
    id: 'utrata', icon: 'briefcase', title: 'Koniec zleceń',
    text: 'Twoje główne źródło dochodu się urywa. Zanim znajdziesz coś nowego, miną około dwa miesiące.',
    choices: [
      { label: 'Spokojnie szukam czegoś dobrego', run: s => { s.jobless = 2; s.mood -= 6; return ['Przez 2 miesiące nie masz dochodu. Żyjesz z tego, co odłożyłeś.', 'Właśnie na taką sytuację jest poduszka finansowa. Bez niej zostaje dług.', 'bad']; } },
      { label: 'Biorę pierwszą lepszą robotę', run: s => { s.jobless = 1; s.mood -= 10; return ['Bez dochodu jesteś tylko miesiąc, ale nowe zajęcie nie jest wymarzone.', 'Krótsza przerwa mniej kosztuje, ale decyzje pod presją rzadko są najlepsze. Poduszka daje czas na wybór.', 'neutral']; } }
    ]
  },
  {
    id: 'oplaty', icon: 'receipt', title: 'Podwyżka stałych opłat',
    text: 'Operator telefonu i dostawca internetu podnoszą ceny „w związku z inflacją”. Razem o 60 zł miesięcznie.',
    choices: [
      { label: 'Akceptuję nowe ceny', run: s => { s.recurring.push({ name: 'Droższy abonament', amount: 60, left: 999 }); return ['Od teraz co miesiąc płacisz o 60 zł więcej.', 'Przy podwyżce masz zwykle prawo rozwiązać umowę bez kary. Warto wtedy porównać oferty.', 'neutral']; } },
      { label: 'Dzwonię i negocjuję albo zmieniam ofertę', run: s => {
          if (Math.random() < 0.6) { s.mood -= 1; return ['Po 20 minutach na infolinii zostajesz przy starej cenie.', 'Firmom taniej jest utrzymać klienta, niż szukać nowego. Jedno pytanie o lepszą ofertę często wystarcza.', 'good']; }
          s.recurring.push({ name: 'Droższy abonament', amount: 30, left: 999 }); s.mood -= 1;
          return ['Udało się zbić podwyżkę o połowę: płacisz 30 zł więcej.', 'Nawet częściowy sukces to 360 zł rocznie. Negocjować zawsze warto.', 'good'];
        } }
    ]
  },
  {
    id: 'kradziez', icon: 'phone', title: 'Kradzież telefonu',
    text: s => `W autobusie ktoś wyciągnął Ci telefon z kieszeni. Używany zamiennik kosztuje 900 zł${s.ins ? ', ale masz polisę, która pokrywa 80%' : ''}.`,
    choices: [
      { label: s => `Kupuję używany (${zl(s.ins ? 180 : 900)})`, run: s => { const had = s.ins, c = insured(s, 900); s.cash -= c; return [had ? `Polisa pokryła większość. Dopłacasz ${zl(c)}.` : 'Płacisz 900 zł z własnej kieszeni.', had ? 'Ubezpieczenie kosztuje niewiele co miesiąc, a chroni przed dużym jednorazowym wydatkiem.' : 'Mała miesięczna składka za polisę zamieniłaby ten wydatek w 180 zł.', had ? 'good' : 'bad']; } }
    ]
  },
  {
    id: 'awaria', icon: 'wheel', title: 'Awaria',
    text: s => `Rower albo skuter, którym dojeżdżasz, odmówił posłuszeństwa. Naprawa: 500 zł${s.ins ? ' (polisa pokryje 80%)' : ''}.`,
    choices: [
      { label: s => `Naprawiam (${zl(s.ins ? 100 : 500)})`, run: s => { const c = insured(s, 500); s.cash -= c; return [`Naprawa kosztowała Cię ${zl(c)}.`, 'Sprzęt, od którego zależy Twój dochód, zawsze w końcu się psuje. To wydatek, na który warto mieć zapas.', 'neutral']; } },
      { label: 'Przesiadam się na komunikację', run: s => { s.recurring.push({ name: 'Bilet miesięczny', amount: 90, left: 12 }); s.mood -= 3; return ['Kupujesz bilet miesięczny: 90 zł przez najbliższy rok.', 'Czasem tańsza na dziś opcja wychodzi drożej w skali roku. Policz obie.', 'neutral']; } }
    ]
  },
  {
    id: 'mandat', icon: 'receipt', title: 'Mandat',
    text: 'Przejazd bez ważnego biletu. Kara: 300 zł, płatna w ciągu 7 dni.',
    choices: [
      { label: 'Płacę od razu (300 zł)', run: s => { s.cash -= 300; return ['Zapłacone. Boli, ale sprawa zamknięta.', 'Kary rosną, gdy się je ignoruje. Najtaniej jest zapłacić od razu.', 'neutral']; } },
      { label: 'Odkładam to na później', run: s => { s.debt += 450; return ['Po wezwaniach i kosztach windykacji z 300 zł zrobiło się 450 zł długu.', 'Niezapłacona kara nie znika, tylko rośnie o odsetki i koszty upomnień.', 'bad']; } }
    ]
  },
  {
    id: 'sklep', icon: 'cart', title: 'Okazja w nieznanym sklepie',
    text: 'Reklama: słuchawki za 700 zł zamiast 2300 zł. Sklep działa od tygodnia, płatność tylko zwykłym przelewem.',
    choices: [
      { label: 'Biorę, taka cena się nie powtórzy', cost: 700, run: s => { scam(s, 700); return ['Paczka nigdy nie przyszła, a strona zniknęła. 700 zł przepadło.', 'Fałszywe sklepy kuszą ceną i przyjmują tylko przelew, bo przelewu nie da się cofnąć. Płatność kartą daje prawo do reklamacji (chargeback).', 'bad']; } },
      { label: 'Sprawdzam opinie, regulamin i dane firmy', run: s => ['Brak danych firmy, opinie sprzed tygodnia, wszystkie pięciogwiazdkowe. Odpuszczasz.', 'Trzy szybkie testy: dane firmy w rejestrze, wiek domeny i sposób płatności. Cena dużo niższa niż wszędzie to sygnał ostrzegawczy.', 'good'] }
    ]
  },
  {
    id: 'bukmacher', icon: 'dice', title: '„Pewny kupon” od znajomych',
    text: 'Ekipa składa się na kupon z kursem 8. „Tym razem wejdzie na sto procent”. Stawka: 200 zł.',
    choices: [
      { label: 'Dokładam 200 zł', cost: 200, run: s => {
          s.cash -= 200;
          if (Math.random() < 0.1) { s.cash += 1600; s.mood += 6; return ['Kupon wszedł: 1600 zł. Statystycznie zdarza się to raz na kilkanaście prób.', 'Wygrana w hazardzie to najgroźniejszy scenariusz, bo zachęca do kolejnych prób. W długim terminie zarabia tylko bukmacher.', 'neutral']; }
          s.mood -= 4; return ['Jeden mecz nie wszedł. 200 zł przepadło.', 'Kursy są ustawione tak, żeby bukmacher zarabiał zawsze. Hazard jest legalny od 18 lat i potrafi uzależnić.', 'bad'];
        } },
      { label: 'Nie gram', run: s => ['Kupon nie wszedł. Zostałeś jedyną osobą, która nic nie straciła.', 'Hazard to rozrywka z ujemną oczekiwaną wartością. Jeśli już, to tylko kwotą przeznaczoną na rozrywkę.', 'good'] }
    ]
  },
  {
    id: 'pozyczka', icon: 'cash', title: 'Kolega prosi o pożyczkę',
    text: '„Pożycz 400 zł do wypłaty, oddam za dwa miesiące, słowo”.',
    choices: [
      { label: 'Pożyczam 400 zł', cost: 400, run: s => { s.cash -= 400; s.later.push({ left: 2, amount: 400, ok: Math.random() < 0.55 }); s.mood += 2; return ['Przelew poszedł. Zobaczymy za dwa miesiące.', 'Pożyczaj znajomym tylko tyle, ile możesz stracić bez żalu, i umów się na konkretny termin.', 'neutral']; } },
      { label: 'Pożyczam 100 zł', cost: 100, run: s => { s.cash -= 100; s.later.push({ left: 2, amount: 100, ok: Math.random() < 0.7 }); s.mood += 1; return ['Pomogłeś tyle, ile mogłeś bez ryzyka.', 'Mniejsza kwota to mniejsze ryzyko dla portfela i dla przyjaźni.', 'good']; } },
      { label: 'Odmawiam', run: s => { s.mood -= 3; return ['Trochę niezręcznie, ale pieniądze zostają.', 'Odmowa pożyczki jest w porządku. Można pomóc inaczej niż gotówką.', 'neutral']; } }
    ]
  },
  {
    id: 'odroczone', icon: 'clock', title: 'Płatności odroczone',
    text: 'W tym miesiącu cztery razy kliknąłeś „kup teraz, zapłać za 30 dni”. Razem 640 zł i wszystkie terminy wypadają teraz.',
    choices: [
      { label: 'Spłacam wszystko', cost: 640, run: s => { s.cash -= 640; return ['Spłacone w terminie, bez kosztów.', 'Płatność odroczona jest darmowa tylko w terminie. Kilka naraz łatwo traci się z oczu.', 'neutral']; } },
      { label: 'Rozkładam na raty', run: s => { s.debt += 700; return ['Z 640 zł zrobiło się 700 zł długu z prowizją, który dalej rośnie.', 'Odroczone płatności to kredyt w przebraniu. Rozłożenie na raty uruchamia prowizje i odsetki.', 'bad']; } }
    ]
  },
  {
    id: 'zalanie', icon: 'drop', title: 'Zalany pokój',
    text: s => `Pękła rura u sąsiada z góry. Laptop i część rzeczy do wymiany: 800 zł${s.ins ? ' (polisa pokryje 80%)' : ''}.`,
    choices: [
      { label: s => `Wymieniam, co trzeba (${zl(s.ins ? 160 : 800)})`, run: s => { const had = s.ins, c = insured(s, 800); s.cash -= c; return [had ? `Ubezpieczyciel wypłacił odszkodowanie. Dokładasz ${zl(c)}.` : 'Całość pokrywasz sam: 800 zł.', 'Ubezpieczenie rzeczy w wynajmowanym pokoju kosztuje kilkadziesiąt złotych miesięcznie.', had ? 'good' : 'bad']; } }
    ]
  },
  {
    id: 'sprzedaz', icon: 'box', title: 'Porządki w szafie',
    text: 'Stara konsola, buty w złym rozmiarze, podręczniki. Na portalu ogłoszeniowym poszłoby to za ok. 350 zł.',
    choices: [
      { label: 'Wystawiam wszystko', run: s => { s.cash += 350; s.mood -= 1; return ['Kilka wieczorów pisania z kupującymi i 350 zł jest Twoje.', 'Rzeczy, których nie używasz, to zamrożone pieniądze. Pamiętaj tylko o bezpiecznej sprzedaży: nigdy nie podawaj danych karty „do odbioru płatności”.', 'good']; } },
      { label: 'Nie chce mi się', run: s => ['Rzeczy dalej leżą w szafie.', 'Nic się nie stało, ale to była najłatwiejsza dodatkowa kasa w tym miesiącu.', 'neutral'] }
    ]
  },
  {
    id: 'premia', icon: 'gift', title: 'Niespodziewana premia',
    text: 'Za dobrą robotę (albo świadectwo z paskiem) wpada Ci dodatkowe 600 zł.',
    pre: s => { s.cash += 600; },
    choices: [
      { label: 'Wydaję na coś, o czym marzyłem', cost: 600, run: s => { s.cash -= 600; s.mood += 9; return ['Nagroda wydana w całości na przyjemność.', 'Nagradzanie się jest w porządku. Jeśli robisz tak z każdą premią, majątek stoi w miejscu.', 'neutral']; } },
      { label: 'Połowa na przyjemność, połowa zostaje', cost: 300, run: s => { s.cash -= 300; s.mood += 5; return ['300 zł radości i 300 zł do odłożenia.', 'Zasada „połowa dla mnie dziś, połowa dla mnie w przyszłości” działa przy każdej premii i podwyżce.', 'good']; } },
      { label: 'Całość zostaje do zainwestowania', run: s => ['600 zł czeka na koncie. Zdecyduj w budżecie, gdzie je ulokować.', 'Jednorazowe zastrzyki gotówki najmocniej przyspieszają oszczędzanie.', 'good'] }
    ]
  },
  {
    id: 'oferta', icon: 'briefcase', title: 'Lepiej płatna oferta',
    text: 'Dostajesz propozycję: 12% więcej pieniędzy, ale dłuższy dojazd i mniej elastyczne godziny.',
    choices: [
      { label: 'Biorę', run: s => { s.wage *= 1.12; s.mood -= 5; return ['Dochód rośnie o 12%. Wolnego czasu jest mniej.', 'Zmiana pracy to zwykle najszybsza droga do podwyżki. Policz jednak też czas i koszty dojazdu.', 'good']; } },
      { label: 'Zostaję, gdzie jestem', run: s => { s.mood += 2; return ['Zostajesz przy obecnym zajęciu.', 'Pieniądze to nie wszystko, ale warto wiedzieć, ile jest się wartym na rynku.', 'neutral']; } }
    ]
  },
  {
    id: 'energia', icon: 'bolt', title: 'Skok cen energii',
    pre: s => { s.infl += 0.03; },
    text: 'Prąd i ogrzewanie mocno drożeją, a za nimi reszta cen. Inflacja w tym roku będzie o 3 punkty procentowe wyższa.',
    choices: [
      { label: 'Przeglądam budżet i tnę zbędne wydatki', run: s => { s.mood -= 2; return ['Znajdujesz kilka rzeczy, z których możesz zrezygnować.', 'Przy wysokiej inflacji gotówka na koncie traci najszybciej. Obligacje indeksowane inflacją są po to, żeby za nią nadążyć.', 'good']; } },
      { label: 'Nic nie zmieniam', run: s => ['Żyjesz jak dotąd, tylko wszystko kosztuje więcej.', 'Inflacja działa po cichu: nie widać jej na koncie, widać ją przy kasie.', 'neutral'] }
    ]
  },
  {
    id: 'fomo', icon: 'stock', title: 'Wszyscy kupują te akcje',
    text: 'Spółka, o której mówi cały internet, urosła o 200% w miesiąc. Znajomi wrzucają zrzuty z zyskami.',
    choices: [
      { label: 'Kupuję za 500 zł, zanim odjedzie', cost: 500, run: s => { s.cash -= 500; s.stock += 350; s.basis.stock += 500; s.depNet += 500; return ['Kupiłeś na samej górce. Tydzień później kurs spadł o 30% i Twoje akcje są warte 350 zł.', 'Gdy o inwestycji mówią już wszyscy, największy wzrost zwykle jest za nią. Kupowanie ze strachu, że coś Cię ominie, to FOMO.', 'bad']; } },
      { label: 'Nie gonię pociągu, który już odjechał', run: s => ['Tydzień później kurs spadł o 30%.', 'Regularne wpłaty w szeroki fundusz wygrywają z gonieniem modnych spółek.', 'good'] }
    ]
  }
);
