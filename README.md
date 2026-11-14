# Ogarniam Kasę

Symulator finansowego życia i lekcje o pieniądzach dla młodych. Projekt społeczny w ramach olimpiady Zwolnieni z Teorii.

## Co jest na stronie

- **Symulator, szybka gra:** 3 postacie, własny cel oszczędnościowy, 1–3 lata miesiąc po miesiącu, losowe zdarzenia, wynik 0–100, odznaki i prognoza na 5 lat jako obracany wykres 3D.
- **Symulator, od 20 do 65 lat:** od studenta (20 lat) do emerytury (65 lat), jedna tura to rok. Zmiana pracy i branży, studia i kursy, wynajem albo własne mieszkanie na kredyt, rodzina, PPK i IKE, a na końcu wyliczenie emerytury. Wszystkie kwoty w dzisiejszych cenach.
- **Ranking:** kto uzbierał najwięcej pieniędzy, osobno dla każdego trybu. Podium 3D dla trzech pierwszych i lista reszty. Każdy gracz jest na liście raz, ze swoim najlepszym wynikiem. Nick wpisuje się przed grą. Bez bazy ranking jest lokalny (tylko to urządzenie), po podpięciu Supabase wspólny.
- **Zapis gry:** gra w trakcie, nick, wyniki i odznaki zostają w przeglądarce po odświeżeniu strony (bez ciasteczek, przez `localStorage`).
- **Scam czy nie scam?:** quiz z 8 wiadomościami.
- **Lekcje w 2 minuty:** 5 tematów z kalkulatorami i słowniczek.
- **Strona główna:** moneta 3D z ciekawostkami i karty „Mit czy fakt?”.

## Uruchomienie

Strona jest statyczna, bez instalacji i bez budowania. W folderze projektu:

```bash
python -m http.server 5173
```

Potem otwórz `http://localhost:5173`.

## Pliki

| Plik | Zawartość |
|---|---|
| `index.html` | Szkielet strony i polityka bezpieczeństwa |
| `styles.css` | Wygląd |
| `icons.js` | Własny zestaw ikon SVG |
| `data.js` | Stawki, postacie, zdarzenia i pytania quizu |
| `lessons.js` | Treść lekcji i kalkulatory |
| `app.js` | Nawigacja, strona główna, quiz, odznaki, elementy 3D |
| `data-extra.js` | Aktywa, inflacja i dodatkowe zdarzenia szybkiej gry |
| `game.js` | Szybka gra na 1–3 lata |
| `life.js` | Tryb „od 20 do 65 lat”: branże, zdarzenia, mieszkanie, emerytura |
| `rank.js` | Ranking: nick, podium 3D, lista, zapis lokalny i w Supabase |
| `ranking-config.js` | Adres i klucz publiczny bazy Supabase (puste = ranking lokalny) |
| `supabase.sql` | Tabela, reguły dostępu i widok rankingu do wklejenia w Supabase |
| `mobile.css` | Poprawki wyglądu na telefon |

Nowe zdarzenie dodaje się jako kolejny obiekt w tablicy `EVENTS` w `data.js`, a pytanie quizu w tablicy `QUIZ`.

## Wspólny ranking (Supabase)

GitHub Pages serwuje tylko pliki, więc wspólny ranking potrzebuje darmowej bazy Supabase. Bez niej ranking działa lokalnie.

1. Załóż darmowy projekt na supabase.com.
2. W SQL Editor wklej całą zawartość `supabase.sql` i kliknij Run.
3. Z Settings → API Keys skopiuj Project URL i klucz publiczny („publishable” albo „anon public”), nigdy „secret” ani „service_role”.
4. Wpisz je w `ranking-config.js`, a adres projektu dopisz w `index.html` do `connect-src` w polityce CSP (zamiast `'none'`).

Do bazy trafiają tylko losowy identyfikator urządzenia, nick, tryb, majątek i wynik punktowy, i to dopiero po kliknięciu „Zapisz wynik”. Gracze mogą tylko dodawać i czytać wpisy; baza odrzuca nicki z niedozwolonymi znakami i absurdalne kwoty oraz przyjmuje najwyżej 5 wyników na minutę z jednego urządzenia. Strona bez serwera nie zablokuje kogoś, kto ręcznie wyśle zmyśloną kwotę, dlatego podejrzane wpisy usuwa się w panelu Supabase (przykład na końcu `supabase.sql`).

## Zabezpieczenia i prywatność

- Polityka Content Security Policy: strona uruchamia wyłącznie własne skrypty, łączy się tylko z bazą rankingu w Supabase i nie wysyła formularzy.
- Brak kodu w atrybutach HTML i brak `eval`; wszystkie akcje przechodzą przez listę dozwolonych funkcji.
- Brak logowania i ciasteczek. Wyniki, odznaki i gra w trakcie zapisują się w przeglądarce gracza i są sprawdzane przy odczycie. Do bazy rankingu trafiają tylko nick, wynik i losowy identyfikator urządzenia, po kliknięciu „Zapisz wynik”.
- Linki zewnętrzne otwierają się bez przekazywania adresu strony (`noopener noreferrer`).

## Do zrobienia przed publikacją

- Sprawdzić stawki w `data.js` z podatki.gov.pl i zus.pl.
- Dodać nagłówki bezpieczeństwa po stronie hostingu, jeśli hosting na to pozwala.

To materiał edukacyjny, a nie porada inwestycyjna.
