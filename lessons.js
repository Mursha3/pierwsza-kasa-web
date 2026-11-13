/* ---------- lekcje ---------- */

function viewLessons() {
  return `
  <h2>Lekcje w 2 minuty</h2><p class="muted">Pięć rzeczy, których warto się dowiedzieć przed pierwszą wypłatą.</p>

  <details class="card" open><summary>1. Brutto i netto: ile naprawdę dostaniesz</summary><div class="body">
    <p>Kwota w ogłoszeniu to zwykle <strong>brutto</strong>. Na konto trafia <strong>netto</strong>, czyli to, co zostaje po składkach i podatku.</p>
    <ul>
      <li><strong>Umowa o pracę:</strong> składki społeczne (13,71%), zdrowotna (9%) i PIT (12%, a od dochodu powyżej 120 tys. zł rocznie 32%).</li>
      <li><strong>Ulga dla młodych:</strong> do 26. roku życia nie płacisz PIT od pensji i zleceń do limitu 85 528 zł przychodu rocznie.</li>
      <li><strong>Uczeń lub student do 26 lat na zleceniu:</strong> bez składek ZUS, więc brutto = netto.</li>
    </ul>
    <label class="field">Pensja brutto na umowie o pracę (zł)<input type="number" id="payB" value="5500" min="0" step="100"></label>
    <label class="check"><input type="checkbox" id="payY" checked> Mam mniej niż 26 lat</label>
    <div id="payOut"></div>
  </div></details>

  <details class="card"><summary>2. Budżet: najpierw zapłać sobie</summary><div class="body">
    <ul>
      <li><strong>Zasada 50/30/20:</strong> ok. połowa na potrzeby, 30% na przyjemności, 20% na oszczędności. Traktuj to jako punkt wyjścia, a nie sztywną regułę.</li>
      <li><strong>Przelew w dniu wypłaty:</strong> odłóż od razu, a wydawaj to, co zostało. Odwrotnie rzadko coś zostaje.</li>
      <li><strong>Poduszka finansowa:</strong> zapas na 3–6 miesięcy wydatków na osobnym koncie. Dzięki niej zepsuty telefon nie kończy się pożyczką.</li>
      <li><strong>Stałe opłaty:</strong> raz na kwartał przejrzyj subskrypcje i abonamenty.</li>
    </ul>
  </div></details>

  <details class="card"><summary>3. Procent składany: odsetki od odsetek</summary><div class="body">
    <p>Odsetki dopisują się do kapitału i w kolejnym okresie same zarabiają. Im dłużej, tym mocniej to widać, dlatego czas jest ważniejszy niż kwota.</p>
    <label class="field">Odkładam co miesiąc: <span id="cM"></span><input type="range" id="cMi" min="50" max="2000" step="50" value="300"></label>
    <label class="field">Przez: <span id="cY"></span><input type="range" id="cYi" min="1" max="40" step="1" value="10"></label>
    <label class="field">Średni zysk roczny: <span id="cR"></span><input type="range" id="cRi" min="0" max="10" step="0.5" value="5"></label>
    <div id="cOut"></div>
  </div></details>

  <details class="card"><summary>4. Lokata, ETF i „pewny zysk”</summary><div class="body">
    <ul>
      <li><strong>Lokata i konto oszczędnościowe:</strong> niski, ale pewny zysk. Pieniądze w banku chroni Bankowy Fundusz Gwarancyjny do równowartości 100 tys. euro. Od odsetek płacisz 19% podatku Belki.</li>
      <li><strong>ETF:</strong> jeden fundusz, który kupuje setki lub tysiące spółek naraz. W długim terminie zwykle daje więcej niż lokata, ale po drodze potrafi spaść o kilkadziesiąt procent. To miejsce na pieniądze na wiele lat.</li>
      <li><strong>„Gwarantowane 30%”:</strong> oszustwo. Im wyższy obiecany zysk, tym wyższe ryzyko, a gwarancji zysku nie daje nikt uczciwy.</li>
      <li>Zanim komuś powierzysz pieniądze, sprawdź <a href="https://www.knf.gov.pl" target="_blank" rel="noopener noreferrer">listę ostrzeżeń publicznych KNF</a>.</li>
    </ul>
  </div></details>

  <details class="card"><summary>5. Długi: chwilówki, raty i „kup teraz, zapłać później”</summary><div class="body">
    <ul>
      <li><strong>RRSO</strong> pokazuje cały roczny koszt pożyczki razem z opłatami. Porównuj oferty po RRSO, a nie po samym oprocentowaniu.</li>
      <li><strong>Chwilówka:</strong> „pierwsza za darmo” działa tylko przy spłacie w terminie. Potem dochodzą prowizje i odsetki, a przedłużanie szybko podwaja koszt.</li>
      <li><strong>Raty 0%:</strong> sprawdź ubezpieczenie i prowizję. Każda rata zmniejsza to, czym dysponujesz w kolejnych miesiącach.</li>
      <li><strong>Płatności odroczone:</strong> to też dług. Kilka małych odroczeń naraz łatwo wymyka się spod kontroli.</li>
      <li><strong>Zasada:</strong> nie pożyczaj na zachcianki. Jeśli już masz dług, spłać najpierw ten najdroższy.</li>
    </ul>
  </div></details>

  <details class="card"><summary>6. Inflacja i realna wartość pieniędzy</summary><div class="body">
    <p>Inflacja to wzrost cen. Kwota na koncie się nie zmienia, ale z roku na rok da się za nią kupić mniej. Dlatego liczy się <strong>realna</strong> wartość pieniędzy, czyli po odjęciu inflacji.</p>
    <ul>
      <li><strong>Gotówka i zwykłe konto</strong> tracą dokładnie tyle, ile wynosi inflacja.</li>
      <li><strong>Lokata poniżej inflacji</strong> też traci, tylko wolniej. Pamiętaj, że od odsetek odchodzi jeszcze 19% podatku Belki.</li>
      <li><strong>Obligacje indeksowane inflacją</strong> mają oprocentowanie powiązane ze wzrostem cen, więc pomagają za nią nadążyć. Wcześniejsza wypłata kosztuje.</li>
      <li><strong>Pensja</strong> też podlega inflacji: podwyżka niższa niż wzrost cen to realnie obniżka.</li>
    </ul>
    <label class="field">Mam odłożone: <span id="iA"></span><input type="range" id="iAi" min="1000" max="50000" step="1000" value="10000"></label>
    <label class="field">Inflacja rocznie: <span id="iR"></span><input type="range" id="iRi" min="0" max="12" step="0.5" value="4"></label>
    <label class="field">Oprocentowanie na rękę: <span id="iS"></span><input type="range" id="iSi" min="0" max="8" step="0.5" value="0"></label>
    <label class="field">Po: <span id="iY"></span><input type="range" id="iYi" min="1" max="30" step="1" value="10"></label>
    <div id="iOut"></div>
  </div></details>

  <button class="btn primary" data-act="go" data-arg="game">Sprawdź to w symulatorze →</button>`;
}

function calcPay() {
  const el = document.getElementById('payOut');
  if (!el) return;
  const p = payroll(Math.max(0, +document.getElementById('payB').value || 0), document.getElementById('payY').checked);
  el.innerHTML = `<table class="payslip">
    <tr><td>Składki społeczne</td><td class="neg">−${zl(p.spoleczne)}</td></tr>
    <tr><td>Składka zdrowotna</td><td class="neg">−${zl(p.zdrowotna)}</td></tr>
    <tr><td>PIT${p.overYoung || p.secondStep ? ' (średnio na miesiąc)' : ''}</td><td class="${p.pit ? 'neg' : ''}">${p.pit ? '−' + zl(p.pit) : '0 zł'}</td></tr>
    <tr class="total"><td>Na rękę (w przybliżeniu)</td><td>${zl(p.netto)}</td></tr></table>
    <p class="small muted" style="margin:8px 0 0">${[
      p.overYoung ? 'Przy tej pensji w ciągu roku przekroczysz limit ulgi dla młodych (85 528 zł), więc od nadwyżki zapłacisz PIT.' : '',
      p.secondStep ? 'Część rocznego dochodu przekracza 120 000 zł i jest opodatkowana stawką 32%.' : '',
      p.overZus ? 'Powyżej 282 600 zł rocznie nie płaci się już składki emerytalnej i rentowej.' : '',
      'Wyliczenie dla stawek z 2026 r., ze złożonym PIT-2 i bez PPK.'
    ].filter(Boolean).join(' ')}</p>`;
}

function calcCompound() {
  const el = document.getElementById('cOut');
  if (!el) return;
  const m = +document.getElementById('cMi').value, y = +document.getElementById('cYi').value, r = +document.getElementById('cRi').value;
  document.getElementById('cM').textContent = zl(m);
  document.getElementById('cY').textContent = y + (y === 1 ? ' rok' : y < 5 ? ' lata' : ' lat');
  document.getElementById('cR').textContent = String(r).replace('.', ',') + '%';
  const total = fv(0, m, r / 100, y), paid = m * 12 * y;
  el.innerHTML = `<div class="out">${zl(total)}</div>
    <p class="small" style="margin:4px 0 0">Wpłacisz ${zl(paid)}, a <strong class="pos">${zl(total - paid)}</strong> dołoży procent składany. Wyliczenie przed podatkiem i bez inflacji.</p>`;
}


function calcInfl() {
  const el = document.getElementById('iOut');
  if (!el) return;
  const get = id => +document.getElementById(id).value;
  const A = get('iAi'), r = get('iRi') / 100, sv = get('iSi') / 100, y = get('iYi');
  const pc = v => String(v).replace('.', ',') + '%';
  document.getElementById('iA').textContent = zl(A);
  document.getElementById('iR').textContent = pc(get('iRi'));
  document.getElementById('iS').textContent = pc(get('iSi'));
  document.getElementById('iY').textContent = y + (y === 1 ? ' roku' : ' latach');
  const nominal = A * Math.pow(1 + sv, y), real = nominal / Math.pow(1 + r, y);
  el.innerHTML = `<div class="out">${zl(real)}</div>
    <p class="small" style="margin:4px 0 0">Na koncie będzie ${zl(nominal)}, ale kupisz za to tyle, co dziś za ${zl(real)}.
    ${real < A ? `Siła nabywcza spadnie o <strong class="neg">${zl(A - real)}</strong>.` : `Siła nabywcza wzrośnie o <strong class="pos">${zl(real - A)}</strong>.`}</p>`;
}
