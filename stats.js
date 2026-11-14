/* Ogarniam Kasę – licznik wejść przez Umami Cloud (https://umami.is).
   Bez ciasteczek i bez zapisu w przeglądarce. Przy wejściu na stronę i przy przejściu do innej zakładki idzie
   jedno zapytanie: która zakładka, strona, z której ktoś przyszedł, rozmiar ekranu i język przeglądarki.
   Własny krótki skrypt zamiast script.js z Umami, żeby strona dalej ładowała wyłącznie swoje pliki.
   Dane idą w tej samej postaci co z oficjalnego skryptu (POST /api/send).
   Członkowie zespołu mogą wyłączyć liczenie swoich wejść: w konsoli przeglądarki na stronie wpisz
   localStorage.setItem('umami.disabled', '1') */
'use strict';

// Identyfikator strony z panelu Umami (Settings → Websites → Edit → Website ID).
// Przy zmianie adresu wysyłki popraw też connect-src w index.html (Content-Security-Policy).
const STATS_ID = 'fff5f31b-3f86-47f0-ba46-daeba6bf015e';
const STATS_URL = 'https://gateway.umami.is/api/send';
// Najwyżej tyle zapytań z jednego otwarcia strony (zabezpieczenie, gdyby jakiś błąd wysyłał je w kółko).
const STATS_MAX = 200;
// Każda zakładka ma w statystykach własny adres, więc widać, co ludzie otwierają.
// Adresy nie zależą od domeny, więc po przejściu na własną domenę statystyki dalej są w jednym miejscu.
const STATS_PAGES = {
  home: ['/', 'Strona główna'], game: ['/symulator', 'Symulator'], quiz: ['/scam', 'Scam?'],
  lessons: ['/lekcje', 'Lekcje'], rank: ['/ranking', 'Ranking'], challenge: ['/wyzwanie', 'Wyzwanie 30 dni']
};

const statsView = (() => {
  const host = location.hostname;
  let disabled = false;
  try { disabled = !!localStorage.getItem('umami.disabled'); } catch (err) { /* tryb prywatny */ }
  // Lokalne testy, podgląd i przeglądarki sterowane programem nie są liczone.
  const off = disabled || navigator.webdriver
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(STATS_ID)
    || location.protocol !== 'https:' || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost') || host.endsWith('.test');
  let last = '', cache = '', sent = 0;
  let ref = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : '';
  return v => {
    const page = STATS_PAGES[v];
    if (off || !page || page[0] === last || sent >= STATS_MAX) return;
    sent++;
    const payload = {
      website: STATS_ID, hostname: host, url: location.origin + page[0], title: `${page[1]} – Ogarniam Kasę`,
      // Przy pierwszym wejściu strona, z której ktoś przyszedł, potem poprzednia zakładka.
      referrer: last || ref, screen: `${screen.width}x${screen.height}`, language: navigator.language || ''
    };
    last = page[0]; ref = '';
    const headers = { 'Content-Type': 'application/json', 'x-umami-website-id': STATS_ID, 'x-umami-hostname': host };
    if (cache) headers['x-umami-cache'] = cache;
    fetch(STATS_URL, { method: 'POST', keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer', headers, body: JSON.stringify({ type: 'event', payload }) })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.cache === 'string' && d.cache.length < 2000) cache = d.cache; })
      .catch(() => { /* bez internetu albo z blokadą reklam po prostu nic się nie liczy */ });
  };
})();

// Pierwsze wejście: zakładka, którą strona właśnie pokazała. Kolejne zgłasza go() w app.js.
statsView(typeof view === 'string' ? view : 'home');
