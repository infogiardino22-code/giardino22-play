// llms-full.txt: tutte le puntate di Play con descrizione, per i modelli AI.
import { produzioni, url, linkFormat, linkVideo, videoDi } from '../lib/catalogo.js';

export function GET({ site }) {
  const abs = (p) => new URL(p, site).href;
  const out = ['# Giardino22 Play: tutte le puntate', '',
    'Giardino22 Play è la piattaforma video di Giardino22, studio di produzione video a Milano (https://www.giardino22.it).', ''];
  for (const p of produzioni) {
    out.push(`## ${p.nome}`, '', `${p.categoria ? p.categoria + ' · ' : ''}${abs(linkFormat(p.slug))}`, '', p.descrizione, '');
    for (const v of videoDi(p.slug)) {
      out.push(`### ${v.titolo}`, '',
        `${v.short ? 'Short' : 'Episodio'}${v.episodio ? ' ' + v.episodio : ''} · ${v.durata} · ${v.pubblicato.slice(0, 10)} · ${abs(linkVideo(v))}`, '');
      if (v.descrizione) out.push(v.descrizione.trim(), '');
    }
  }
  return new Response(out.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
