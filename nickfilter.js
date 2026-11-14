/* Ogarniam Kasę – wykrywacz wulgarnych i rasistowskich nicków, po polsku i po angielsku.
   Nick jest najpierw sprowadzany do prostych małych liter: bez polskich znaków, bez liter udających łacińskie
   (np. cyrylickie „а”), z cyframi i znakami zamienionymi na litery (k0rwa, sh1t, n!gga), bez kropek i spacji
   między literami (k.u.r.w.a). Każda litera słowa z listy może się w nicku powtarzać (kuuurwa, niiigga), ale nie
   może zniknąć: „faggot” wymaga podwójnego g, więc „fagot” (instrument) przechodzi. Potem szuka:
   - rdzeni, które nie występują w zwykłych słowach (np. „kurw” łapie też „skurwiel”),
   - całych słów, które jako fragment trafiają się w niewinnych słowach (np. „cipa” jest w „anticipate”,
     „ass” w „class”, „niga” w „Shinigami”), więc liczą się tylko jako osobny wyraz.
   Ta sama lista jest w supabase.sql (funkcja nick_bad), żeby baza odrzucała takie nicki także wtedy, gdy ktoś
   wyśle wynik z pominięciem strony. Po zmianie listy tutaj popraw ją też tam. */
'use strict';

const NICK_FILTER = (() => {
  // Rdzenie: szukane w nicku jako fragment.
  const STEMS = [
    'kurw', 'kurv', 'qurw', 'huj', 'pizd', 'jeb', 'pierd', 'kutas', 'fiut', 'dziwk', 'szmat', 'cwel', 'sukinsyn',
    'gowno', 'zesra', 'sracz', 'ruchac', 'ruchan', 'wyrucha', 'rucham', 'obciag', 'dupek', 'dupsk', 'dupcia', 'cycki',
    'czarnuch', 'pedofil', 'chwdp',
    'fuck', 'fvck', 'fcuk', 'phuck', 'shit', 'bitch', 'biatch', 'cunt', 'whore', 'slut', 'retard', 'porn', 'penis',
    'vagina', 'wagina', 'bastard', 'wank', 'twat', 'dildo', 'blowjob', 'handjob', 'cumshot', 'dickhead', 'bigdick',
    'cocksuck', 'milf', 'killyourself', 'faggot', 'asshole', 'jizz', 'pussy', 'dumbass', 'jackass', 'titties',
    // rasizm i nazizm
    'nigg', 'niqq', 'nygg', 'kneegrow', 'neeger', 'wetback', 'hitler', 'siegheil', 'whitepower'
  ];
  // Całe słowa: liczą się tylko jako osobny wyraz nicku (oddzielony spacją, kropką, cyfrą albo wielką literą).
  const WORDS = [
    'cipa', 'cipy', 'cipe', 'cipka', 'dupa', 'dupy', 'dupe', 'ciota', 'cioty', 'pedal', 'pedaly', 'pedzio', 'suka', 'suki',
    'srac', 'sram', 'sraj', 'sraka', 'debil', 'debile', 'kretyn', 'seks',
    'ass', 'asses', 'arse', 'dick', 'dicks', 'dik', 'cock', 'cocks', 'fag', 'fags', 'cum', 'sex', 'anal', 'anus', 'rape',
    'rapist', 'kys', 'stfu', 'tits', 'boob', 'boobs', 'horny', 'fck', 'fuk', 'btch', 'porno', 'hoe', 'hoes', 'piss',
    // rasizm i nazizm
    'niga', 'nigas', 'nigaz', 'nigar', 'nyga', 'nygas', 'nibba', 'nibbas', 'nibber', 'negro', 'negros', 'negroes', 'neger',
    'negr', 'negry', 'ngga', 'nggas', 'ngger', 'nggers', 'nggr', 'murzyn', 'murzyni', 'murzynka', 'kike', 'kikes', 'chink',
    'chinks', 'spic', 'spics', 'paki', 'pakis', 'gook', 'gooks', 'nazi', 'nazis', 'kkk', 'heil'
  ];

  // Słowo z listy → wzór, w którym każda litera może się powtarzać: „nigg” → n+i+g{2,}
  const pattern = w => w.replace(/(.)\1*/g, run => (run.length > 1 ? `${run[0]}{${run.length},}` : `${run[0]}+`));
  const STEM_RE = new RegExp(STEMS.map(pattern).join('|'));
  const WORD_RE = new RegExp('^(?:' + WORDS.map(pattern).join('|') + ')$');

  // Litery, które wyglądają jak łacińskie (cyrylica, greka), i kilka znaków bez rozkładu na literę i akcent.
  const LOOK = {
    'ł': 'l', 'ø': 'o', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'đ': 'd', 'ı': 'i',
    'а': 'a', 'е': 'e', 'ё': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'к': 'k', 'м': 'm', 'т': 't',
    'в': 'b', 'н': 'h', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'α': 'a', 'ο': 'o', 'ρ': 'p', 'ν': 'v', 'τ': 't', 'ι': 'i',
    'κ': 'k', 'μ': 'm', 'υ': 'u'
  };
  // Cyfry i znaki udające litery. „1” i „|” mogą być literą i albo l, więc sprawdzane są obie wersje.
  const LEET = { 0: 'o', 2: 'z', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g', '!': 'i', '¡': 'i', '@': 'a', $: 's', '€': 'e', '+': 't' };

  // Kilka wersji tego samego nicku: 1 jako „i” albo „l”, cyfry jako przerwy, „v” jako „u” (fvck), „l” jako „i” (nlgger).
  function variants(nick) {
    let s = String(nick || '').replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2').toLowerCase();
    s = s.replace(/[^\x00-\x7f]/g, c => LOOK[c] || c).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const base = ['i', 'l'].map(one => s.replace(/[\d!¡@$€+|]/g, c => (c === '1' || c === '|' ? one : LEET[c])));
    base.push(s.replace(/\d/g, ' '));
    return base.flatMap(v => [v, v.replace(/v/g, 'u'), v.replace(/l/g, 'i')]);
  }

  function bad(nick) {
    if (/14\s*88/.test(String(nick || ''))) return true;      // nazistowski kod
    for (const v of variants(nick)) {
      const compact = v.replace(/[^a-z]/g, '');                // k.u.r.w.a → kurwa
      if (STEM_RE.test(compact)) return true;
      if (v.split(/[^a-z]+/).concat(compact).some(t => t && WORD_RE.test(t))) return true;
    }
    return false;
  }

  return { bad, STEMS, WORDS, pattern };
})();
