import { produzioni, video, url, generato } from '../lib/catalogo.js';

export function GET({ site }) {
  const abs = (p) => new URL(p, site).href;
  const esc = (s) => String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  const voci = [
    { loc: abs(url('')), lastmod: generato },
    ...produzioni.map(p => ({ loc: abs(url(p.slug + '/')), lastmod: generato })),
    ...video.map(v => ({ loc: abs(url(`${v.produzione}/${v.id}/`)), lastmod: v.pubblicato })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${voci.map(x => `<url><loc>${esc(x.loc)}</loc><lastmod>${x.lastmod.slice(0, 10)}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
