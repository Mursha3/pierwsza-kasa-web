/* Ogarniam Kasę – ustawienia wspólnego rankingu.
   Puste pola = ranking działa tylko w przeglądarce gracza.
   Po założeniu bazy Supabase wpisz tu Project URL (np. https://abcdefgh.supabase.co)
   i klucz publiczny (Settings → API Keys: „publishable” albo „anon public”). Ten klucz jest jawny z założenia:
   bezpieczeństwo zapewniają reguły z supabase.sql, a nie ukrycie klucza.
   Ten sam adres trzeba dopisać w index.html do connect-src w polityce CSP. Nigdy nie wpisuj tu klucza „secret” ani „service_role”. */
'use strict';

const RANKING_CONFIG = {
  url: 'https://bvxfunfdbkthfjqxnskw.supabase.co',
  key: 'sb_publishable_-bYXycu35FN3B4fzsL6Tdg_reFdWj20'
};
