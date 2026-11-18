// llms.txt: un riassunto in testo semplice pensato per i modelli AI (convenzione llmstxt.org).
// Dice chi siamo, quali format ci sono e dove trovare tutte le puntate.
import { produzioni, video, url, linkFormat, linkVideo, primaRiga, videoDi } from '../lib/catalogo.js';

export function GET({ site }) {
  const abs = (p) => new URL(p, site).href;
  const righe = [
    '# Giardino22 Play', '',
    '> Giardino22 Play è la piattaforma video di Giardino22 (Giardino22 Art Lab S.r.l.), studio di produzione video a Milano. ' +
    'Pubblica podcast, serie e format originali prodotti negli studi di Giardino22: puntate complete, interviste, clip e short, gratis e senza registrazione.', '',
    `- Sito: ${abs(url(''))}`,
    '- Studio di produzione: https://www.giardino22.it (produzione video, live streaming, podcast, eventi, noleggio studi a Milano)',
    '- Canale YouTube: https://www.youtube.com/@giardino22play',
    '- Contatti: hello@giardino22.it · Viale Giovanni da Cermenate 82, 20141 Milano', '',
    '## Format', '',
    ...produzioni.map(p => {
      const n = p.conteggio;
      return `- [${p.nome}](${abs(linkFormat(p.slug))}): ${p.categoria ? p.categoria + '. ' : ''}${primaRiga(p.descrizione, 260)} (${[n.episodi && n.episodi + ' episodi', n.short && n.short + ' clip'].filter(Boolean).join(', ')})`;
    }), '',
    '## Ultime uscite', '',
    ...video.slice(0, 20).map(v => `- [${v.titolo}](${abs(linkVideo(v))}): ${v.durata}, ${v.pubblicato.slice(0, 10)}`), '',
    '## Optional', '',
    `- [Tutte le puntate con descrizione completa](${abs(url('llms-full.txt'))})`,
    `- [Sitemap](${abs(url('sitemap.xml'))})`, '',
  ];
  return new Response(righe.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
