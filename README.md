# Pierwsza Kasa

Symulator finansowego życia i lekcje o pieniądzach dla młodych. Projekt społeczny w ramach olimpiady Zwolnieni z Teorii.

## Co jest na stronie

- **Symulator:** 3 postacie, własny cel oszczędnościowy, 12 miesięcy, 15 losowych zdarzeń, wynik 0–100, odznaki i prognoza na 5 lat jako obracany wykres 3D.
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
| `app.js` | Logika gry, odznaki, elementy 3D |

Nowe zdarzenie dodaje się jako kolejny obiekt w tablicy `EVENTS` w `data.js`, a pytanie quizu w tablicy `QUIZ`.

## Zabezpieczenia i prywatność

- Polityka Content Security Policy: strona uruchamia wyłącznie własne skrypty, nie łączy się z żadnym serwerem i nie wysyła formularzy.
- Brak kodu w atrybutach HTML i brak `eval`; wszystkie akcje przechodzą przez listę dozwolonych funkcji.
- Brak logowania, ciasteczek i zbierania danych. Wynik i odznaki zapisują się tylko w przeglądarce gracza i są sprawdzane przy odczycie.
- Linki zewnętrzne otwierają się bez przekazywania adresu strony (`noopener noreferrer`).

## Do zrobienia przed publikacją

- Sprawdzić stawki w `data.js` z podatki.gov.pl i zus.pl.
- Dodać nagłówki bezpieczeństwa po stronie hostingu, jeśli hosting na to pozwala.

To materiał edukacyjny, a nie porada inwestycyjna.
