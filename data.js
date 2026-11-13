/* Ogarniam Kasę – symulator, quiz o scamach i lekcje. Bez backendu, bez danych osobowych. */

const app = document.getElementById('app');
const zl = n => Math.round(n).toLocaleString('pl-PL') + ' zł';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* ---------- finanse ---------- */

// Uproszczone wyliczenie pensji z umowy o pracę (stawki przybliżone).
/* Liczone w skali roku i dzielone na 12, żeby uwzględnić limity roczne:
   ulgę dla młodych (85 528 zł przychodu), drugi próg podatkowy (120 000 zł dochodu)
   i limit podstawy składek emerytalnej i rentowej (30-krotność, 282 600 zł w 2026 r.).
   Założenia: złożony PIT-2, podstawowe koszty uzyskania 250 zł miesięcznie, bez PPK. */
const ZUS_LIMIT = 282600, YOUNG_LIMIT = 85528, TAX_STEP = 120000;
function payroll(brutto, under26) {
  const R = brutto * 12;
  const spolY = Math.min(R, ZUS_LIMIT) * 0.1126 + R * 0.0245;   // emerytalna 9,76% + rentowa 1,5%, chorobowa 2,45%
  const zdrowY = (R - spolY) * 0.09;
  const taxed = R - (under26 ? Math.min(R, YOUNG_LIMIT) : 0);  // przychód poza ulgą dla młodych
  const income = taxed > 0 ? Math.max(0, Math.round(taxed - spolY * taxed / R - 3000)) : 0;
  const pitY = Math.max(0, income <= TAX_STEP ? income * 0.12 - 3600 : 10800 + (income - TAX_STEP) * 0.32);
  const spoleczne = spolY / 12, zdrowotna = zdrowY / 12, pit = Math.round(pitY / 12);
  return { brutto, spoleczne, zdrowotna, pit, netto: brutto - spoleczne - zdrowotna - pit,
    overYoung: under26 && R > YOUNG_LIMIT && pit > 0, secondStep: income > TAX_STEP, overZus: R > ZUS_LIMIT };
}

// Wartość przyszła: kapitał A, wpłata m co miesiąc, stopa roczna r.
function fv(A, m, r, years) {
  const n = years * 12, i = r / 12;
  if (!i) return A + m * n;
  const g = Math.pow(1 + i, n);
  return A * g + m * (g - 1) / i;
}

function randn() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const SAVE_RATE = 0.0324;   // konto oszczędnościowe 4% minus podatek Belki
const ETF_RATE = 0.06;      // założenie do prognozy, bez gwarancji
const DEBT_MONTHLY = 0.04;  // odsetki i opłaty drogiego długu w grze

/* ---------- postacie ---------- */

const pay5500 = payroll(5500, true);
const CHARS = [
  {
    id: 'uczen', face: 'backpack', name: 'Uczeń z pracą dorywczą',
    desc: 'Weekendy w gastro, 50 godzin w miesiącu na umowie zlecenie. Mieszkasz z rodzicami.',
    start: 200, life: [250, 500, 900],
    slip: [['Zlecenie: 50 h × 32 zł brutto', 1600], ['ZUS (uczeń do 26 lat)', 0], ['PIT (ulga dla młodych)', 0]],
    net: 1600, fixed: [],
    tip: 'Jako uczeń lub student do 26. roku życia na zleceniu nie płacisz składek ZUS ani PIT. Brutto = netto.'
  },
  {
    id: 'osiemnastka', face: 'cake', name: 'Świeżo po osiemnastce',
    desc: 'Z urodzin zostało Ci 5000 zł. Do tego kieszonkowe 600 zł miesięcznie.',
    start: 5000, life: [150, 300, 600],
    slip: [['Kieszonkowe', 600]],
    net: 600, fixed: [],
    tip: 'Duża kwota na start kusi. Zobacz, co się z nią stanie przez rok.'
  },
  {
    id: 'absolwent', face: 'briefcase', name: 'Absolwent na pierwszym etacie',
    desc: 'Umowa o pracę, 5500 zł brutto. Wynajmujesz pokój i sam się utrzymujesz.',
    start: 1000, life: [300, 600, 1100],
    slip: [['Pensja brutto', 5500], ['Składki społeczne (13,71%)', -pay5500.spoleczne], ['Składka zdrowotna (9%)', -pay5500.zdrowotna], ['PIT (ulga dla młodych do 26 lat)', 0]],
    net: pay5500.netto,
    fixed: [['Pokój z opłatami', 1700], ['Jedzenie', 800], ['Bilet miesięczny', 120]],
    tip: 'Z 5500 zł brutto na konto wpływa ok. ' + zl(pay5500.netto) + '. Po 26. urodzinach doszedłby jeszcze PIT: ok. ' + zl(payroll(5500, false).pit) + ' miesięcznie.'
  }
];
const LIFE = [
  { name: 'Oszczędnie', mood: -4 },
  { name: 'Normalnie', mood: 0 },
  { name: 'Na bogato', mood: 4 }
];

/* ---------- zdarzenia ---------- */

const scam = (s, lost) => { s.cash -= lost; s.scams++; s.mood -= 8; };
const EVENTS = [
  {
    id: 'telefon', icon: 'phone', title: 'Telefon wylądował na chodniku',
    text: 'Ekran w drobny mak. Bez telefonu ani rusz.',
    choices: [
      { label: 'Naprawa w serwisie', cost: 400, run: s => { s.cash -= 400; return ['Wymiana ekranu i działa jak wcześniej.', 'Naprawa prawie zawsze wychodzi taniej niż nowy sprzęt.', 'good']; } },
      { label: 'Nowy flagowiec na raty 0%: 12 × 250 zł', run: s => { s.recurring.push({ name: 'Rata za telefon', amount: 250, left: 12, loan: true }); s.mood += 6; return ['Masz nowy telefon i ratę 250 zł na rok.', 'Raty 0% to nadal dług: przez 12 miesięcy masz o 250 zł mniej, a spóźnienie z ratą kosztuje.', 'neutral']; } },
      { label: 'Nowy flagowiec za gotówkę', cost: 3000, run: s => { s.cash -= 3000; s.mood += 6; return ['Kupione. Konto mocno schudło.', 'Zanim wydasz dużą kwotę, sprawdź, ile zostanie Ci poduszki na nagłe sytuacje.', 'neutral']; } }
    ]
  },
  {
    id: 'chwilowka', icon: 'bolt', title: '„Pierwsza pożyczka za 0 zł!”',
    text: 'Reklama w apce: 2000 zł w 15 minut, bez zaświadczeń, pierwsza pożyczka za darmo, jeśli oddasz w 30 dni.',
    choices: [
      { label: 'Biorę 2000 zł', run: s => { s.cash += 2000; s.debt += 2000; return ['Masz 2000 zł na koncie i 2000 zł długu.', 'Darmowa jest tylko, gdy oddasz w terminie. Potem dług w grze rośnie o 4% miesięcznie. Spłać go jak najszybciej w panelu budżetu.', 'bad']; } },
      { label: 'Nie potrzebuję, zamykam', run: s => ['Reklama zniknęła, pieniądze zostały.', 'Chwilówka ma sens tylko w prawdziwej awarii. Na zachcianki to najdroższe pieniądze na rynku.', 'good'] }
    ]
  },
  {
    id: 'inwestor', icon: 'rocket', title: '„Inwestor” z Instagrama',
    text: 'Konto ze zdjęciami z Dubaju pisze: „Mój system daje gwarantowane 30% zysku miesięcznie. Wpłać, a ja pomnożę”.',
    choices: [
      { label: 'Wpłacam 1000 zł', cost: 1000, run: s => { scam(s, 1000); return ['Po wpłacie konto Cię zablokowało. 1000 zł przepadło.', 'Gwarantowany wysoki zysk nie istnieje. Im większa obietnica, tym większa szansa, że to oszustwo.', 'bad']; } },
      { label: 'Wpłacam na próbę 300 zł', cost: 300, run: s => { scam(s, 300); return ['„Zysk” widać w fałszywym panelu, ale wypłacić się go nie da. 300 zł stracone.', 'Mała wpłata „na próbę” to typowy haczyk. Oszuści często pokazują fikcyjne zyski, żebyś dopłacił więcej.', 'bad']; } },
      { label: 'Ignoruję i zgłaszam konto', run: s => ['Zgłoszone. Ktoś inny może dzięki temu nie stracić.', 'Sprawdzaj firmy na liście ostrzeżeń publicznych KNF. Prawdziwy inwestor nie zaczepia ludzi w wiadomościach.', 'good'] }
    ]
  },
  {
    id: 'blik', icon: 'chat', title: 'Wiadomość od kumpla',
    text: '„Siema, mam zablokowaną kartę, a stoję przy kasie. Podaj szybko kod BLIK na 600 zł, oddam wieczorem!”',
    choices: [
      { label: 'Wysyłam kod i zatwierdzam', cost: 600, run: s => { scam(s, 600); return ['To nie był kumpel. Ktoś przejął jego konto i wypłacił 600 zł z bankomatu.', 'Zanim podasz kod BLIK, zadzwoń do tej osoby. Pośpiech i prośba o kod to znak ostrzegawczy.', 'bad']; } },
      { label: 'Dzwonię do niego', run: s => ['Kumpel o niczym nie wie. Jego konto zostało przejęte, a Ty go ostrzegłeś.', 'Jeden telefon wystarczy, żeby rozbroić to oszustwo.', 'good'] }
    ]
  },
  {
    id: 'wyprzedaz', icon: 'tag', title: 'Wyprzedaż: −50% tylko dziś',
    text: 'Buty, o których myślałeś od dawna, kosztują dziś 600 zł zamiast 1200. Licznik odlicza godziny.',
    choices: [
      { label: 'Kupuję', cost: 600, run: s => { s.cash -= 600; s.mood += 7; return ['Buty są Twoje.', 'Zaplanowany zakup w promocji to dobry ruch. Kupiony pod presją licznika już niekoniecznie.', 'neutral']; } },
      { label: 'Czekam 24 godziny i sprawdzam ceny', run: s => { s.mood += 1; return ['Następnego dnia „promocja” trwa dalej, a w innym sklepie jest taniej. Odpuszczasz.', 'Zasada 24 godzin: jeśli po dobie nadal chcesz, kup. Liczniki mają Cię pospieszyć.', 'good']; } }
    ]
  },
  {
    id: 'koncert', icon: 'mic', title: 'Ekipa jedzie na koncert',
    text: 'Bilet, dojazd i jedzenie: razem ok. 450 zł. Wszyscy jadą.',
    choices: [
      { label: 'Jadę', cost: 450, run: s => { s.cash -= 450; s.mood += 12; return ['Świetny wieczór, wspomnienia zostaną.', 'Pieniądze są też po to, żeby żyć. Ważne, żeby takie wydatki mieściły się w budżecie.', 'good']; } },
      { label: 'Zostaję w domu', run: s => { s.mood -= 6; return ['Oglądasz relacje znajomych z kanapy.', 'Oszczędzanie kosztem wszystkiego też ma swoją cenę. Zaplanuj w budżecie kwotę na przyjemności.', 'neutral']; } }
    ]
  },
  {
    id: 'fucha', icon: 'hammer', title: 'Dodatkowa fucha',
    text: 'Sąsiad szuka kogoś do pomocy przy przeprowadzce w sobotę. Płaci 500 zł.',
    choices: [
      { label: 'Biorę', run: s => { s.cash += 500; s.mood -= 4; return ['Sobota przepadła, ale 500 zł wpadło.', 'Dodatkowy dochód przyspiesza oszczędzanie szybciej niż cięcie drobnych wydatków.', 'good']; } },
      { label: 'Wolę wolny weekend', run: s => { s.mood += 3; return ['Odpocząłeś.', 'Czas też jest zasobem. Nie każdą fuchę trzeba brać.', 'neutral']; } }
    ]
  },
  {
    id: 'urodziny', icon: 'gift', title: 'Urodziny przyjaciela',
    text: 'Impreza w sobotę. Trzeba coś ogarnąć.',
    choices: [
      { label: 'Porządny prezent', cost: 150, run: s => { s.cash -= 150; s.mood += 3; return ['Prezent trafiony.', 'Urodziny są co roku. Takie wydatki da się przewidzieć i wpisać w budżet.', 'good']; } },
      { label: 'Składka z ekipą po 50 zł', cost: 50, run: s => { s.cash -= 50; s.mood += 2; return ['Wspólny prezent wyszedł lepiej niż pięć osobnych.', 'Składka to prosty sposób na lepszy prezent za mniejsze pieniądze.', 'good']; } },
      { label: 'Przychodzę z pustymi rękami', run: s => { s.mood -= 5; return ['Trochę niezręcznie.', 'Relacje też wymagają inwestycji, choć niekoniecznie dużych.', 'neutral']; } }
    ]
  },
  {
    id: 'subskrypcje', icon: 'screen', title: 'Przegląd subskrypcji',
    text: 'Na wyciągu widzisz trzy subskrypcje, razem 95 zł miesięcznie. Korzystasz tak naprawdę z jednej.',
    choices: [
      { label: 'Anuluję dwie nieużywane', run: s => ['Zostaje jedna. Oszczędzasz 65 zł co miesiąc.', '65 zł miesięcznie to 780 zł rocznie. Raz na kwartał przejrzyj stałe opłaty.', 'good'] },
      { label: 'Niech zostaną, może się przydadzą', run: s => { s.recurring.push({ name: 'Nieużywane subskrypcje', amount: 65, left: 99 }); return ['Co miesiąc z konta znika 65 zł za coś, czego nie używasz.', 'Małe stałe opłaty są groźne, bo ich nie widać. W skali roku robią się z nich setki złotych.', 'bad']; } }
    ]
  },
  {
    id: 'paczka', icon: 'box', title: 'SMS o paczce',
    text: '„Twoja paczka została wstrzymana. Dopłać 1,49 zł: kurier-doplata.cc/pl”. Akurat na coś czekasz.',
    choices: [
      { label: 'Klikam i podaję dane karty', cost: 0, run: s => { scam(s, 800); return ['Strona była fałszywa. Z karty zeszło 800 zł, zanim ją zablokowałeś.', 'Kurierzy nie proszą o dopłaty przez link w SMS-ie. Status paczki sprawdzaj w oficjalnej aplikacji.', 'bad']; } },
      { label: 'Sprawdzam w aplikacji przewoźnika', run: s => ['W aplikacji paczka jest w drodze, bez żadnej dopłaty. SMS przekazujesz na numer 8080.', 'Podejrzane SMS-y możesz bezpłatnie przekazać na numer 8080 (CERT Polska).', 'good'] }
    ]
  },
  {
    id: 'krach', icon: 'chartdown', title: 'Giełda mocno spada',
    cond: s => s.etf >= 200,
    text: 'Nagłówki krzyczą o panice. Twój ETF stracił w tym miesiącu 15%.',
    pre: s => { s.etf *= 0.85; },
    choices: [
      { label: 'Sprzedaję wszystko, zanim spadnie bardziej', run: s => { s.cash += s.etf; s.etf = 0; return ['Sprzedałeś ze stratą. Pieniądze wróciły na konto.', 'Sprzedaż w panice zamienia chwilowy spadek w trwałą stratę. Historycznie szerokie rynki odrabiały spadki, ale trwało to czasem lata.', 'bad']; } },
      { label: 'Nic nie robię', run: s => ['Zaciskasz zęby i czekasz.', 'Spadki są normalną częścią inwestowania. Dlatego w ETF wkłada się pieniądze, których nie potrzebujesz przez wiele lat.', 'good'] }
    ]
  },
  {
    id: 'konsola', icon: 'gamepad', title: 'Konsola na raty 0%',
    text: 'Sklep kusi: nowa konsola za 2400 zł, 10 rat po 240 zł, „zero kosztów”.',
    choices: [
      { label: 'Biorę na raty', run: s => { s.recurring.push({ name: 'Rata za konsolę', amount: 240, left: 10, loan: true }); s.mood += 10; return ['Konsola stoi na biurku, a rata będzie schodzić przez 10 miesięcy.', 'Sprawdź w umowie obowiązkowe ubezpieczenie i prowizję. „0%” często dotyczy tylko odsetek.', 'neutral']; } },
      { label: 'Kupuję za gotówkę', cost: 2400, run: s => { s.cash -= 2400; s.mood += 10; return ['Kupione bez zobowiązań.', 'Jeśli po zakupie nadal masz poduszkę, to uczciwie zarobiona przyjemność.', 'neutral']; } },
      { label: 'Odpuszczam', run: s => { s.mood -= 2; return ['Może kiedy indziej.', 'Dobrym sposobem jest odkładać „ratę” samemu sobie i kupić po kilku miesiącach.', 'good']; } }
    ]
  },
  {
    id: 'dentysta', icon: 'tooth', title: 'Nagły wydatek',
    text: 'Ból zęba nie przechodzi. Prywatna wizyta z leczeniem: 350 zł. Tego nie da się odłożyć.',
    choices: [
      { label: 'Płacę', run: s => { s.cash -= 350; return [s.cash >= 0 ? 'Zapłacone z konta. Po to jest poduszka.' : 'Na koncie zabrakło. Jeśli nie uzupełnisz go z oszczędności, brak zamieni się w drogi dług.', 'Poduszka finansowa (3–6 miesięcy wydatków) sprawia, że nagły wydatek jest kłopotem, a nie katastrofą.', s.cash >= 0 ? 'good' : 'bad']; } }
    ]
  },
  {
    id: 'krypto', icon: 'coin', title: '„Pewna” kryptowaluta',
    text: 'Kolega wrzuca na grupę: „Ten memecoin zrobi ×10 do piątku, wchodźcie, póki tanio!”',
    choices: [
      { label: 'Wchodzę za 500 zł', cost: 500, run: s => {
          s.cash -= 500;
          if (Math.random() < 0.2) { s.cash += 1500; s.mood += 5; return ['Tym razem się udało: 500 zł zamieniło się w 1500 zł.', 'Miałeś szczęście. To była spekulacja, a nie inwestycja: większość takich zakładów kończy się stratą.', 'neutral']; }
          s.cash += 50; s.mood -= 5; return ['Kurs runął o 90% w dwa dni. Z 500 zł zostało 50 zł.', 'Spekulacja pod wpływem grupy to hazard. Jeśli chcesz ryzykować, to tylko kwotą, którą możesz stracić w całości.', 'bad'];
        } },
      { label: 'Odpuszczam', run: s => ['W piątek moneta jest warta 10% ceny. Grupa zamilkła.', 'Jeśli ktoś mówi „pewniak”, zwykle sam potrzebuje kupujących, żeby sprzedać drożej.', 'good'] }
    ]
  },
  {
    id: 'babcia', icon: 'envelope', title: 'Koperta od babci',
    text: 'Babcia wręcza Ci 300 zł „na coś dla siebie”.',
    pre: s => { s.cash += 300; },
    choices: [
      { label: 'Wydaję na przyjemność', cost: 300, run: s => { s.cash -= 300; s.mood += 6; return ['Zgodnie z życzeniem babci.', 'Niespodziewane pieniądze to dobra okazja na przyjemność bez wyrzutów sumienia.', 'neutral']; } },
      { label: 'Połowa na przyjemność, połowa zostaje', cost: 150, run: s => { s.cash -= 150; s.mood += 4; return ['150 zł wydane, 150 zł zostaje do odłożenia.', 'Dzielenie dodatkowych pieniędzy na pół to prosty nawyk, który szybko buduje oszczędności.', 'good']; } },
      { label: 'Całość zostaje na koncie', run: s => ['300 zł czeka na koncie. Możesz je przelać na oszczędności w budżecie.', 'Każdy dodatkowy zastrzyk gotówki przyspiesza budowę poduszki.', 'good'] }
    ]
  }
];

const QUIZ = [
  { from: 'Messenger · Kuba', scam: true,
    text: 'Siema, masz chwilę? Pożyczysz 300 zł blikiem? Mam zablokowane konto, oddam jutro 🙏 wyślij sam kod',
    why: 'Przejęte konto znajomego to jedna z najczęstszych metod wyłudzeń.',
    flags: ['Pośpiech i presja', 'Prośba o kod BLIK zamiast przelewu', 'Wystarczy zadzwonić, żeby to sprawdzić'] },
  { from: 'SMS · Kurier', scam: true,
    text: 'Twoja paczka zostala wstrzymana z powodu niedoplaty 1,49 zl. Ureguluj naleznosc: kurier-doplata.cc/pl',
    why: 'Mała kwota ma uśpić czujność. Chodzi o dane Twojej karty.',
    flags: ['Link do dziwnej domeny', 'Firmy kurierskie nie pobierają dopłat przez SMS', 'Brak polskich znaków i numeru przesyłki'] },
  { from: 'Powiadomienie z aplikacji banku', scam: false, ctx: 'Przed chwilą kliknąłeś „Zapłać” w sklepie internetowym.',
    text: 'Potwierdź płatność kartą: 59,99 zł, sklep Butik24. Otwórz aplikację, aby zatwierdzić.',
    why: 'Sam zacząłeś tę płatność, kwota i sklep się zgadzają, a zatwierdzasz w aplikacji, a nie przez link.',
    flags: ['Zawsze czytaj kwotę i odbiorcę przed zatwierdzeniem', 'Jeśli niczego nie kupowałeś, odrzuć i zadzwoń do banku'] },
  { from: 'Instagram · anna.invest_', scam: true,
    text: 'Hej! Zarobiłam 4 800 zł w tydzień na platformie tradingowej 🚀 Mój mentor gwarantuje 30% zysku miesięcznie. Wystarczy wpłata 500 zł, napisz po link!',
    why: 'Nikt uczciwy nie gwarantuje zysku, a już na pewno nie 30% miesięcznie.',
    flags: ['„Gwarantowany” wysoki zysk', 'Obca osoba zaczepia w wiadomości', 'Sprawdź listę ostrzeżeń publicznych KNF'] },
  { from: 'Połączenie · „Dział bezpieczeństwa banku”', scam: true,
    text: '„Na Pana koncie wykryliśmy próbę zaciągnięcia kredytu. Proszę zainstalować aplikację do zdalnej pomocy i przelać środki na rachunek techniczny, żeby je zabezpieczyć.”',
    why: 'Bank nigdy nie prosi o instalowanie programów ani o przelew na „bezpieczne konto”.',
    flags: ['Straszenie i pośpiech', 'Prośba o zdalny dostęp do telefonu', 'Rozłącz się i sam zadzwoń na numer z karty'] },
  { from: 'Portal ogłoszeniowy · kupujący', scam: true, ctx: 'Sprzedajesz stare słuchawki.',
    text: 'Dzień dobry, kupuję! Już zapłaciłem przez serwis. Żeby odebrać pieniądze, proszę kliknąć i podać dane karty: bezpieczna-wyplata.xyz/odbior',
    why: 'Żeby dostać pieniądze, nigdy nie trzeba podawać numeru karty, daty ważności i kodu CVV.',
    flags: ['Link poza oficjalnym serwisem', 'Dane karty „do odbioru” pieniędzy', 'Rozmowę prowadź tylko w czacie serwisu'] },
  { from: 'SMS · Automat paczkowy', scam: false, ctx: 'Czekasz na zamówioną paczkę.',
    text: 'Twoja paczka czeka w automacie przy ul. Lipowej 4. Kod odbioru: 482913. Masz 48 godzin na odbiór.',
    why: 'Wiadomość niczego od Ciebie nie chce: nie ma linku, prośby o dane ani o pieniądze.',
    flags: ['Brak linku i żądania płatności', 'Zgadza się z tym, na co czekasz', 'W razie wątpliwości sprawdź w aplikacji przewoźnika'] },
  { from: 'WhatsApp · nieznany numer', scam: true,
    text: 'Praca zdalna dla każdego! 800 zł dziennie za lajkowanie filmów. Na start wystarczy wpłacić 200 zł kaucji aktywacyjnej.',
    why: 'W prawdziwej pracy to pracodawca płaci Tobie, a nie odwrotnie.',
    flags: ['Zarobki zbyt dobre, żeby były prawdziwe', 'Opłata „na start”', 'Kontakt z nieznanego numeru'] }
];
