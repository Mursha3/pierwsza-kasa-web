/* Ogarniam Kasę – wykrywacz wulgarnych nicków, po polsku i po angielsku.
   Nick jest najpierw sprowadzany do prostych małych liter: bez polskich znaków, bez liter udających łacińskie
   (np. cyrylickie „а”), z cyframi zamienionymi na litery (k0rwa, sh1t), bez kropek i spacji między literami
   (k.u.r.w.a) i bez powtórzeń (kuuurwa). Potem szuka:
   - rdzeni, które nie występują w zwykłych słowach (np. „kurw” łapie też „skurwiel”),
   - całych słów, które jako fragment trafiają się w niewinnych słowach (np. „cipa” jest w „anticipate”,
     „ass” w „class”), więc liczą się tylko jako osobne słowo.
   Ta sama lista jest w supabase.sql (funkcja nick_bad), żeby baza odrzucała takie nicki także wtedy, gdy ktoś
   wyśle wynik z pominięciem strony. Po zmianie listy tutaj popraw ją też tam. */
'use strict';

const NICK_FILTER = (() => {
  // Rdzenie: szukane w nicku jako fragment. Rdzeń bez podwójnych liter jest szukany po ściśnięciu powtórzeń
  // (kuuurwa → kurwa), rdzeń z podwójną literą bez ściskania, bo „faggot” po ściśnięciu to „fagot” (instrument).
  const STEMS = [
    'kurw', 'kurv', 'qurw', 'huj', 'pizd', 'jeb', 'pierd', 'kutas', 'fiut', 'dziwk', 'szmat', 'cwel', 'sukinsyn',
    'gowno', 'zesra', 'sracz', 'ruchac', 'ruchan', 'wyrucha', 'rucham', 'obciag', 'dupek', 'dupsk', 'dupcia', 'cycki',
    'czarnuch', 'pedofil', 'chwdp',
    'fuck', 'fvck', 'fcuk', 'phuck', 'shit', 'bitch', 'biatch', 'cunt', 'whore', 'slut', 'retard', 'porn', 'penis',
    'vagina', 'wagina', 'bastard', 'wank', 'twat', 'dildo', 'blowjob', 'handjob', 'cumshot', 'dickhead', 'bigdick',
    'cocksuck', 'milf', 'hitler', 'killyourself', 'nigg', 'faggot', 'asshole', 'jizz', 'pussy', 'dumbass', 'jackass', 'titties'
  ];
  // Całe słowa: liczą się tylko jako osobny wyraz nicku (oddzielony spacją, kropką, cyfrą albo wielką literą).
  const WORDS = [
    'cipa', 'cipy', 'cipe', 'cipka', 'dupa', 'dupy', 'dupe', 'ciota', 'cioty', 'pedal', 'pedaly', 'pedzio', 'suka', 'suki',
    'srac', 'sram', 'sraj', 'sraka', 'debil', 'debile', 'kretyn', 'seks',
    'ass', 'asses', 'arse', 'dick', 'dicks', 'dik', 'cock', 'cocks', 'fag', 'fags', 'cum', 'sex', 'anal', 'anus', 'rape',
    'rapist', 'nazi', 'nazis', 'kkk', 'kys', 'stfu', 'tits', 'boob', 'boobs', 'horny', 'fck', 'fuk', 'btch', 'porno',
    'hoe', 'hoes', 'piss'
  ];
  const squeeze = s => s.replace(/(.)\1+/g, '$1');
  const plain = w => squeeze(w) === w;
  const STEMS1 = STEMS.filter(plain), STEMS2 = STEMS.filter(w => !plain(w));
  const WORDS1 = WORDS.filter(plain);   // te można porównać także po ściśnięciu (duuupa)

  // Litery, które wyglądają jak łacińskie (cyrylica, greka), i kilka znaków bez rozkładu na literę i akcent.
  const LOOK = {
    'ł': 'l', 'ø': 'o', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'đ': 'd', 'ı': 'i',
    'а': 'a', 'е': 'e', 'ё': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'к': 'k', 'м': 'm', 'т': 't',
    'в': 'b', 'н': 'h', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'α': 'a', 'ο': 'o', 'ρ': 'p', 'ν': 'v', 'τ': 't', 'ι': 'i',
    'κ': 'k', 'μ': 'm', 'υ': 'u'
  };
  const LEET = { 0: 'o', 2: 'z', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g' };

  // Kilka wersji tego samego nicku: cyfra 1 jako „i” albo „l”, cyfry jako przerwy, „v” jako „u” (fvck).
  function variants(nick) {
    let s = String(nick || '').replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2').toLowerCase();
    s = s.replace(/[^\x00-\x7f]/g, c => LOOK[c] || c).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const out = [];
    for (const one of ['i', 'l']) out.push(s.replace(/\d/g, d => (d === '1' ? one : LEET[d])));
    out.push(s.replace(/\d/g, ' '));
    return out.flatMap(v => [v, v.replace(/v/g, 'u')]);
  }

  function bad(nick) {
    for (const v of variants(nick)) {
      const short = v.replace(/(.)\1\1+/g, '$1$1');                 // fagggot → faggot
      const compact = short.replace(/[^a-z]/g, '');                 // k.u.r.w.a → kurwa
      const sq = squeeze(compact);
      if (STEMS1.some(w => sq.includes(w)) || STEMS2.some(w => compact.includes(w))) return true;
      const tokens = (v + ' ' + short).split(/[^a-z]+/).filter(Boolean).concat(compact, v.replace(/[^a-z]/g, ''));
      if (tokens.some(t => WORDS.includes(t) || WORDS1.includes(squeeze(t)))) return true;
    }
    return false;
  }

  return { bad, STEMS, WORDS };
})();
