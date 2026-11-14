# Ogarniam Kasę

Symulator finansowego życia i lekcje o pieniądzach dla młodych. Projekt społeczny w ramach olimpiady Zwolnieni z Teorii.

## Co jest na stronie

- **Symulator, szybka gra:** 3 postacie, własny cel oszczędnościowy, 1–3 lata miesiąc po miesiącu, losowe zdarzenia, wynik 0–100, odznaki i prognoza na 5 lat jako obracany wykres 3D.
- **Symulator, całe życie:** od studenta (20 lat) do emerytury (65 lat), jedna tura to rok. Zmiana pracy i branży, studia i kursy, wynajem albo własne mieszkanie na kredyt, rodzina, PPK i IKE, a na końcu wyliczenie emerytury. Wszystkie kwoty w dzisiejszych cenach.
- **Ranking:** najlepsze wyniki pod nickiem, osobno dla każdego trybu. Na razie lokalny (tylko to urządzenie).
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
| `life.js` | Tryb „Całe życie”: branże, zdarzenia, mieszkanie, emerytura |
| `rank.js` | Ranking wyników |
| `mobile.css` | Poprawki wyglądu na telefon |

Nowe zdarzenie dodaje się jako kolejny obiekt w tablicy `EVENTS` w `data.js`, a pytanie quizu w tablicy `QUIZ`.

## Ranking i przyszły backend

Ranking zapisuje się w `localStorage` przeglądarki, więc widać w nim tylko gry z jednego urządzenia. Cały zapis i odczyt przechodzi przez obiekt `RANK` w `rank.js` (`list`, `add`, `clear`). Gdy powstanie serwer z bazą użytkowników, wystarczy podmienić te metody na zapytania do API i poluzować `connect-src` w polityce CSP w `index.html`. Wynik trzeba będzie wtedy liczyć albo sprawdzać po stronie serwera, bo wynik wysłany z przeglądarki da się podrobić.

## Zabezpieczenia i prywatność

- Polityka Content Security Policy: strona uruchamia wyłącznie własne skrypty, nie łączy się z żadnym serwerem i nie wysyła formularzy.
- Brak kodu w atrybutach HTML i brak `eval`; wszystkie akcje przechodzą przez listę dozwolonych funkcji.
- Brak logowania, ciasteczek i zbierania danych. Wynik i odznaki zapisują się tylko w przeglądarce gracza i są sprawdzane przy odczycie.
- Linki zewnętrzne otwierają się bez przekazywania adresu strony (`noopener noreferrer`).

## Do zrobienia przed publikacją

- Sprawdzić stawki w `data.js` z podatki.gov.pl i zus.pl.
- Dodać nagłówki bezpieczeństwa po stronie hostingu, jeśli hosting na to pozwala.

To materiał edukacyjny, a nie porada inwestycyjna.
