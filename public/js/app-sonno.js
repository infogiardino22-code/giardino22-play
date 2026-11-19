// Riquadro "SONNO è anche un'app" (19/11/2026). Scende dall'alto dopo 2 secondi; chiuso con la X non ricompare per 7 giorni.
(function () {
  var el = document.getElementById('sapp'); if (!el) return;
  var k = 'sapp-chiuso2';
  try { if (Date.now() - (+localStorage.getItem(k) || 0) < 7 * 864e5) return; } catch (e) {}
  var top = document.getElementById('top');
  if (top) { var h = top.getBoundingClientRect().height; el.style.setProperty('--sapp-top', (h + 14) + 'px'); el.style.setProperty('--sapp-top-m', (h + 8) + 'px'); }
  el.hidden = false;
  setTimeout(function () { el.classList.add('on'); }, 2000);
  setTimeout(function () { el.classList.add('nudge'); }, 3200);
  el.querySelector('.sapp-x').addEventListener('click', function () {
    el.classList.remove('on'); setTimeout(function () { el.hidden = true; }, 500);
    try { localStorage.setItem(k, String(Date.now())); } catch (e) {}
  });
})();
