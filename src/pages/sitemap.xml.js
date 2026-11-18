// Sitemap con le estensioni video e immagini di Google: ogni puntata è segnalata come video
// (titolo, descrizione, miniatura, durata, data, player), così entra nei risultati "Video".
import { produzioni, video, url, media, linkVideo, primaRiga, generato } from '../lib/catalogo.js';

export function GET({ site }) {
  const abs = (p) => new URL(p, site).href;
  const esc = (s) => String(s ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  const voce = (loc, lastmod, extra = '') => `<url><loc>${esc(loc)}</loc><lastmod>${String(lastmod).slice(0, 10)}</lastmod>${extra}</url>`;

  const righe = [
    voce(abs(url('')), generato),
    voce(abs(url('cookie/')), generato),
    ...produzioni.map(p => voce(abs(url(p.slug + '/')), generato,
      p.img?.hero ? `<image:image><image:loc>${esc(abs(media(p.img.hero)))}</image:loc></image:image>` : '')),
    ...video.map(v => voce(abs(linkVideo(v)), v.pubblicato, `
  <video:video>
    <video:thumbnail_loc>${esc(abs(media(v.img.og)))}</video:thumbnail_loc>
    <video:title>${esc(v.titoloOriginale || v.titolo)}</video:title>
    <video:description>${esc(primaRiga(v.descrizione, 2000) || v.titolo)}</video:description>
    <video:player_loc>${esc(`https://www.youtube-nocookie.com/embed/${v.id}`)}</video:player_loc>
    <video:duration>${Math.max(1, Math.min(28800, v.secondi | 0))}</video:duration>
    <video:publication_date>${esc(v.pubblicato)}</video:publication_date>
    <video:family_friendly>yes</video:family_friendly>${(v.tag || []).slice(0, 12).map(t => `
    <video:tag>${esc(t)}</video:tag>`).join('')}
  </video:video>`)),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${righe.join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
