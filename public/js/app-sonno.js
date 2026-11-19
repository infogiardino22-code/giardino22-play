// Barra "SONNO è anche un'app gratuita" (19/11/2026). Chiusa con la X: non ricompare per 7 giorni.
(function () {
  var el = document.getElementById('sbar'); if (!el) return;
  var k = 'sbar-chiusa';
  try { if (Date.now() - (+localStorage.getItem(k) || 0) < 7 * 864e5) return; } catch (e) {}
  el.hidden = false;
  el.querySelector('.sbar-x').addEventListener('click', function () {
    el.hidden = true;
    try { localStorage.setItem(k, String(Date.now())); } catch (e) {}
  });
})();
