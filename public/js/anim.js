/* Caricato in <head> senza defer: abilita le animazioni di comparsa prima del primo disegno */
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) document.documentElement.classList.add('anim');
