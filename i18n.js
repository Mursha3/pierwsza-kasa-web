/* Ogarniam Kasę – wersja angielska (flaga w nagłówku).
   Cała strona jest pisana po polsku. W trybie angielskim każdy tekst, który pojawia się na stronie, jest od razu
   podmieniany na tłumaczenie z en.js. Kluczem jest polski tekst, w którym liczby zamieniono na #, a wstawiane
   wartości (kwoty, imiona) na *. Gdy tłumaczenia brakuje, zostaje polski tekst, więc nowa treść niczego nie psuje.
   Brakujące teksty pokaże w konsoli przeglądarki: I18N.missing()

   Wybór języka: najpierw to, co gracz kliknął na fladze (zapisane w przeglądarce), potem kraj połączenia
   (raz na 30 dni pyta Cloudflare: Polska = polski, inny kraj = angielski), a bez internetu strefa czasowa
   i język przeglądarki. Przy zmianie adresu Cloudflare popraw connect-src w index.html. */
'use strict';

const I18N = (() => {
  const KEY = 'ogarniamKase.lang', AUTO_KEY = 'ogarniamKase.langAuto';
  const GEO_URL = 'https://www.cloudflare.com/cdn-cgi/trace';
  const AUTO_DAYS = 30;
  const NUM = /\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;
  const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
  const ORIG_TITLE = document.title;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (err) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (err) { /* tryb prywatny */ } }
  };

  /* ---------- słownik ---------- */

  const dict = new Map(), wild = [];
  const src = typeof I18N_EN === 'object' && I18N_EN ? I18N_EN : {};
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (typeof v !== 'string' || !v) continue;
    if (!k.includes('*')) { dict.set(k, v); continue; }
    const parts = k.split('*');
    const need = parts.reduce((a, b) => (b.length > a.length ? b : a), '');
    const re = new RegExp('^' + parts.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.*?)') + '$');
    wild.push({ re, v, need, size: k.length - parts.length + 1 });
  }
  wild.sort((a, b) => b.size - a.size);   // dłuższy (dokładniejszy) wzór wygrywa

  const words = s => /\p{L}{2,}/u.test(s.replace(/zł/g, ''));
  const missed = new Set();

  // Szuka tłumaczenia klucza (tekst z liczbami zamienionymi na #). Zwraca null, gdy brak.
  function find(key, depth) {
    const hit = dict.get(key);
    if (hit !== undefined) return hit;
    if (!words(key)) return key;
    if (depth > 2) return null;
    for (const w of wild) {
      if (!key.includes(w.need)) continue;
      const m = key.match(w.re);
      if (!m) continue;
      let i = 1;
      return w.v.replace(/\*/g, () => {
        const c = m[i++] || '', core = c.trim();
        const t = core ? find(core, depth + 1) : '';
        return t === null ? c : c.slice(0, c.indexOf(core)) + t + c.slice(c.indexOf(core) + core.length);
      });
    }
    // Etykieta z dwukropkiem, znaczkiem ✓ albo strzałką → na końcu.
    const end = /^(.*\p{L}.*?)(:| ✓| →)$/u.exec(key);
    if (end) { const t = find(end[1], depth + 1); if (t !== null) return t + end[2]; }
    // Kilka zdań w jednym kawałku tekstu: każde osobno.
    const parts = key.split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ„])/);
    if (parts.length > 1) {
      const out = parts.map(p => find(p, depth + 1));
      if (out.every(t => t !== null)) return out.join(' ');
    }
    // Dopisek w nawiasie na końcu: tekst i nawias osobno.
    const par = /^(.*\p{L}.*?) (\([^()]*\))$/u.exec(key);
    if (par) {
      const a = find(par[1], depth + 1), b = find(par[2], depth + 1);
      if (a !== null && b !== null) return a + ' ' + b;
    }
    // Lista po przecinku albo kropce (np. „dodatkowa zmiana, kurs, ubezpieczenie”): każdy element osobno.
    if (/[,·]/.test(key)) {
      const bits = key.split(/(\s*[,·]\s*)/);
      const out = bits.map((b, i) => (i % 2 || !b ? b : find(b, depth + 1)));
      if (out.every(t => t !== null)) return out.join('');
    }
    return null;
  }

  // Liczby po angielsku: 12 345,6 → 12,345.6
  const enNum = n => { const [a, b] = n.split(','); return a.replace(/[ \u00a0\u202f]/g, ',') + (b === undefined ? '' : '.' + b); };

  // Tłumaczy dowolny polski tekst. Zwraca null, gdy nie ma czego zmieniać.
  function tr(text) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
    const core = m[2].replace(/\s+/g, ' ');
    if (!core) return null;
    const nums = [];
    const key = core.replace(NUM, x => { nums.push(x); return '#'; });
    const v = find(key, 0);
    if (v === null) { if (/\p{L}{3,}/u.test(key) && !/^[\w.-]+\.[a-z]{2,}$/.test(key)) missed.add(key); return null; }
    let i = 0;
    const out = v.replace(/#/g, () => (i < nums.length ? enNum(nums[i++]) : '#'));
    return out === core ? null : m[1] + out + m[3];
  }

  /* ---------- podmiana tekstów na stronie ---------- */

  let LANG = 'pl';
  const orig = new WeakMap();   // węzeł tekstu → polski oryginał, element → { atrybut: oryginał }

  const skipped = el => !el || SKIP.has(el.nodeName) || !!el.closest('[translate="no"]');

  // Po polsku: przywraca oryginał i zapomina go (strona mogła go potem zmienić). Po angielsku: tłumaczy.
  // Element z atrybutem data-en dostaje po angielsku dokładnie ten tekst (np. krótsza nazwa zakładki na telefonie).
  function doText(n, fresh) {
    const p = n.parentElement;
    if (skipped(p)) return;
    if (LANG !== 'en') { if (orig.has(n)) { n.data = orig.get(n); orig.delete(n); } return; }
    if (fresh || !orig.has(n)) orig.set(n, n.data);
    const pl = orig.get(n), want = p.hasAttribute('data-en') ? p.getAttribute('data-en') : tr(pl) ?? pl;
    if (n.data !== want) n.data = want;
  }
  function doAttrs(el, fresh) {
    if (skipped(el)) return;
    let o = orig.get(el);
    if (LANG !== 'en') {
      if (o) { for (const a in o) el.setAttribute(a, o[a]); orig.delete(el); }
      return;
    }
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      if (!o) { o = {}; orig.set(el, o); }
      if (fresh === a || !(a in o)) o[a] = el.getAttribute(a);
      const want = tr(o[a]) ?? o[a];
      if (el.getAttribute(a) !== want) el.setAttribute(a, want);
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root, false); return; }
    if (root.nodeType !== 1 || skipped(root)) return;
    doAttrs(root, false);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = it.nextNode(); n; n = it.nextNode()) {
      if (n.nodeType === 3) doText(n, false); else doAttrs(n, false);
    }
  }

  const OBS = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS };
  const obs = new MutationObserver(recs => {
    obs.disconnect();
    for (const r of recs) {
      if (r.type === 'childList') r.addedNodes.forEach(walk);
      else if (r.type === 'characterData') doText(r.target, true);
      else doAttrs(r.target, r.attributeName);
    }
    obs.observe(document.body, OBS);
  });

  /* ---------- flaga i wybór języka ---------- */

  const FLAG = {
    pl: '<svg viewBox="0 0 16 10" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><path fill="#fff" d="M0 0h16v5H0z"/><path fill="#dc143c" d="M0 5h16v5H0z"/></svg>',
    en: '<svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><clipPath id="ukS"><path d="M0 0v30h60V0z"/></clipPath><clipPath id="ukT"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath><g clip-path="url(#ukS)"><path d="M0 0v30h60V0z" fill="#012169"/><path d="M0 0l60 30m0-30L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30m0-30L0 30" clip-path="url(#ukT)" stroke="#c8102e" stroke-width="4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/></g></svg>'
  };
  function drawButton() {
    const b = document.getElementById('langBtn');
    if (!b) return;
    b.innerHTML = `<span class="flag">${FLAG[LANG]}</span><span class="code">${LANG === 'en' ? 'EN' : 'PL'}</span>`;
    b.setAttribute('aria-label', LANG === 'en' ? 'Language: English. Switch to Polish' : 'Język: polski. Zmień na angielski');
    b.title = LANG === 'en' ? 'Zmień na polski' : 'Switch to English';
  }

  function apply() {
    obs.disconnect();
    document.documentElement.lang = LANG;
    document.title = LANG === 'en' ? (tr(ORIG_TITLE) ?? ORIG_TITLE) : ORIG_TITLE;
    drawButton();
    walk(document.body);
    if (LANG === 'en') obs.observe(document.body, OBS);
  }

  function set(lang, manual) {
    if (lang !== 'pl' && lang !== 'en') return;
    if (manual) store.set(KEY, lang);
    if (lang === LANG) return;
    LANG = lang;
    apply();
  }

  // Bez internetu: polska strefa czasowa albo polski w ustawieniach przeglądarki = polski.
  function guess() {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (err) { /* stara przeglądarka */ }
    const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    return tz === 'Europe/Warsaw' || langs.some(l => /^pl\b/i.test(l)) ? 'pl' : 'en';
  }

  function start() {
    const chosen = store.get(KEY);
    let auto = null;
    try { auto = JSON.parse(store.get(AUTO_KEY) || 'null'); } catch (err) { auto = null; }
    const fresh = auto && (auto.lang === 'pl' || auto.lang === 'en') && Date.now() - auto.t < AUTO_DAYS * 864e5;
    LANG = chosen === 'pl' || chosen === 'en' ? chosen : fresh ? auto.lang : guess();
    apply();
    const btn = document.getElementById('langBtn');
    if (btn) btn.addEventListener('click', () => set(LANG === 'en' ? 'pl' : 'en', true));
    if (chosen === 'pl' || chosen === 'en' || fresh || !window.fetch) return;
    // Kraj połączenia: Cloudflare odsyła m.in. linijkę loc=PL. Nic więcej nie jest wysyłane ani zapisywane.
    const ctrl = window.AbortController ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 5000);
    fetch(GEO_URL, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctrl ? ctrl.signal : undefined })
      .then(r => (r.ok ? r.text() : Promise.reject(new Error('geo'))))
      .then(t => {
        const loc = (/^loc=([A-Z]{2})$/m.exec(t) || [])[1];
        if (!loc) return;
        const lang = loc === 'PL' ? 'pl' : 'en';
        store.set(AUTO_KEY, JSON.stringify({ lang, t: Date.now() }));
        if (!store.get(KEY)) set(lang, false);
      })
      .catch(() => { /* bez internetu albo z blokadą zostaje zgadnięty język */ })
      .finally(() => clearTimeout(timer));
  }

  start();

  return {
    get lang() { return LANG; },
    set,
    t: text => (LANG === 'en' ? (tr(text) ?? text) : text),
    missing: () => [...missed].sort()
  };
})();
