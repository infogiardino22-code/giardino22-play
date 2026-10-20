// Accesso al catalogo generato da scripts/sync-youtube.mjs
import catalogo from '../data/catalogo.json';

export const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const url = (p = '') => BASE + String(p).replace(/^\//, '');
export const media = (p) => url('media/' + p);

export const produzioni = catalogo.produzioni;
export const video = catalogo.video;                        // dal più recente
export const perId = new Map(video.map(v => [v.id, v]));
export const perSlug = new Map(produzioni.map(p => [p.slug, p]));
export const heroIds = catalogo.hero;
export const dnpIds = catalogo.daNonPerdere;
export const generato = catalogo.generato;

export const linkVideo = (v) => url(`${v.produzione}/${v.id}/`);
export const linkFormat = (slug) => url(`${slug}/`);

export const videoDi = (slug) => video.filter(v => v.produzione === slug);
/** Episodi lunghi in ordine di uscita (Ep. 1, 2, 3…). */
export const episodiDi = (slug) => videoDi(slug).filter(v => !v.short)
  .sort((a, b) => (a.stagione - b.stagione) || ((a.episodio ?? 999) - (b.episodio ?? 999)) || a.pubblicato.localeCompare(b.pubblicato));

const SETTE_GIORNI = 7 * 864e5;
export const eNuovo = (v) => Date.now() - Date.parse(v.pubblicato) < SETTE_GIORNI;

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const dataEstesa = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${MESI[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

/** Pezzi della riga info: S1 · Ep. 05 · 36:02 */
export function infoVideo(v, { compatta = false, data = false } = {}) {
  const p = [];
  if (!compatta || !v.short) p.push('S' + v.stagione);
  if (v.episodio) p.push('Ep. ' + String(v.episodio).padStart(2, '0'));
  if (v.short) p.push('Short');
  p.push(v.durata);
  if (data) p.push(dataEstesa(v.pubblicato));
  return p;
}

export const primaRiga = (t, max = 180) => {
  const r = String(t ?? '').split('\n').map(s => s.trim()).find(s => s && !/^https?:\/\//.test(s) && !/^#/.test(s)) ?? '';
  return r.length > max ? r.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : r;
};

/** Divide una descrizione in paragrafi e pezzi testo/link, senza mai usare HTML grezzo. */
export function paragrafi(testo) {
  const RE = /(https:\/\/[^\s<>"')]+)/g;
  return String(testo ?? '').split(/\n{2,}/).map(par => par.split(RE).filter(Boolean).map(pezzo =>
    /^https:\/\//.test(pezzo) ? { link: pezzo.replace(/[.,;:!?]+$/, '') } : { testo: pezzo }
  )).filter(p => p.length);
}

export const ETICHETTE = {
  youtube: 'YouTube', spotify: 'Spotify', amazon_music: 'Amazon Music', apple_podcasts: 'Apple Podcasts',
  instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', facebook: 'Facebook', sito: 'Sito web',
};
