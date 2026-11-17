// Colori generati a ogni pubblicazione: uno per format (--c) e uno per ogni video (--tc),
// preso dalla sua miniatura. Stanno in un file CSS e non negli attributi style perché la
// Content-Security-Policy del sito non ammette stili inline.
import { produzioni, video } from '../../lib/catalogo.js';

const HEX = /^#[0-9A-F]{6}$/i;
const ID = /^[A-Za-z0-9_-]{11}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function GET() {
  const righe = ['/* generato da src/pages/css/colori.css.js */'];
  for (const p of produzioni) {
    if (SLUG.test(p.slug) && HEX.test(p.colore ?? '')) righe.push(`.f-${p.slug}{--c:${p.colore}}`);
  }
  for (const v of video) {
    if (ID.test(v.id) && HEX.test(v.tinta ?? '')) righe.push(`.t-${v.id}{--tc:${v.tinta}}`)   // "t-" davanti: il nome della classe è sempre valido;
  }
  return new Response(righe.join('\n') + '\n', { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
}

