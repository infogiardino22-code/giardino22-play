// Avviso "SONNO è anche un'app" (19/11/2026). Chiuso con la X: non ricompare per 14 giorni.
(function () {
  var el = document.getElementById('sapp'); if (!el) return;
  var k = 'sapp-chiuso';
  try { if (Date.now() - (+localStorage.getItem(k) || 0) < 14 * 864e5) return; } catch (e) {}
  function mostra() {
    el.hidden = false;
    setTimeout(function () { el.classList.add('on'); }, 1200);
    setTimeout(function () { el.classList.add('nudge'); }, 2400);
  }
  // se c'è la finestra dei cookie aperta, aspetta che venga chiusa
  var c = document.getElementById('consenso');
  if (c && !c.hidden) {
    var mo = new MutationObserver(function () { if (c.hidden) { mo.disconnect(); mostra(); } });
    mo.observe(c, { attributes: true, attributeFilter: ['hidden'] });
    setTimeout(function () { if (c.hidden) { mo.disconnect(); if (el.hidden) mostra(); } }, 1500);
  } else mostra();
  el.querySelector('.sapp-x').addEventListener('click', function () {
    el.classList.remove('on'); setTimeout(function () { el.hidden = true; }, 500);
    try { localStorage.setItem(k, String(Date.now())); } catch (e) {}
  });
})();
