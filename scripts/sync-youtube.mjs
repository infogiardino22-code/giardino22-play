#!/usr/bin/env node
/**
 * Giardino22 Play — sincronizzazione con YouTube
 *
 * Legge contenuti/ (schede dei format + vetrina), interroga la YouTube Data API v3
 * e scrive src/data/catalogo.json + le immagini ottimizzate in public/media/.
 * Il sito statico viene poi generato da Astro a partire da questi file.
 *
 *   npm run sync               → dati reali (serve YOUTUBE_API_KEY nell'ambiente)
 *   npm run sync:demo          → dati di esempio, senza rete (per provare il sito)
 *   npm run check:contenuti    → controlla solo le schede, non scarica nulla
 *
 * Se qualcosa non va (scheda scritta male, API irraggiungibile) lo script esce
 * con errore e NON produce un catalogo a metà: la build si ferma e online resta
 * la versione precedente del sito.
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import sharp from 'sharp';

const ROOT = process.cwd();
const DIR_CONTENUTI = path.join(ROOT, 'contenuti');
const DIR_PRODUZIONI = path.join(DIR_CONTENUTI, 'produzioni');
const FILE_CATALOGO = path.join(ROOT, 'src', 'data', 'catalogo.json');
const DIR_MEDIA = path.join(ROOT, 'public', 'media');

const ARGS = new Set(process.argv.slice(2));
const DEMO = ARGS.has('--demo');
const SOLO_VERIFICA = ARGS.has('--solo-verifica');
const API_KEY = process.env.YOUTUBE_API_KEY || '';

const MAX_HERO = 3;
const MAX_DNP = 12;
const SHORT_MAX_SECONDI = 180;

/* ─────────────────────────── utilità ─────────────────────────── */

const errori = [];
const avvisi = [];
const errore = (dove, msg) => errori.push(`✖ ${dove}: ${msg}`);
const avviso = (dove, msg) => avvisi.push(`! ${dove}: ${msg}`);

const RE_ID_VIDEO = /^[A-Za-z0-9_-]{11}$/;
const RE_ID_PLAYLIST = /^[A-Za-z0-9_-]{10,64}$/;
const RE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RISERVATI = new Set(['media', 'css', 'js', 'fonts', 'brand', '404', 'admin', 'api']);

/** Accetta un ID o un qualunque link YouTube e restituisce l'ID del video. */
export function idVideo(valore) {
  const s = String(valore ?? '').trim();
  if (RE_ID_VIDEO.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return RE_ID_VIDEO.test(u.pathname.slice(1)) ? u.pathname.slice(1) : null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v');
      if (v && RE_ID_VIDEO.test(v)) return v;
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch { /* non è un link */ }
  return null;
}

/** Accetta un ID o un link di playlist e restituisce l'ID della playlist. */
export function idPlaylist(valore) {
  const s = String(valore ?? '').trim();
  if (RE_ID_PLAYLIST.test(s) && !s.includes('/')) return s;
  try {
    const u = new URL(s);
    const l = u.searchParams.get('list');
    if (l && RE_ID_PLAYLIST.test(l)) return l;
  } catch { /* non è un link */ }
  return null;
}

/**
 * Accetta il link di un canale YouTube (youtube.com/@nome oppure /channel/UC…)
 * e restituisce "canale:@nome" o "canale:UC…". Il sito userà la playlist automatica
 * "tutti i caricamenti" del canale, che YouTube aggiorna da solo a ogni nuovo video.
 */
export function idCanale(valore) {
  try {
    const u = new URL(String(valore ?? '').trim());
    if (!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
    const h = u.pathname.match(/^\/(@[A-Za-z0-9._-]{3,100})\/?/);
    if (h) return 'canale:' + h[1];
    const c = u.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})\/?/);
    if (c) return 'canale:' + c[1];
  } catch { /* non è un link */ }
  return null;
}

/**
 * Social ammessi e domini consentiti per ciascuno. Un link che non rispetta
 * il dominio viene rifiutato: così nessuno può infilare link a siti estranei
 * o pseudo-link tipo "javascript:" nelle schede.
 */
export const SOCIAL = {
  youtube:        { label: 'YouTube',        domini: ['youtube.com', 'youtu.be'] },
  spotify:        { label: 'Spotify',        domini: ['open.spotify.com', 'spotify.com'] },
  amazon_music:   { label: 'Amazon Music',   domini: ['music.amazon.it', 'music.amazon.com', 'music.amazon.de', 'music.amazon.co.uk'] },
  apple_podcasts: { label: 'Apple Podcasts', domini: ['podcasts.apple.com'] },
  instagram:      { label: 'Instagram',      domini: ['instagram.com'] },
  tiktok:         { label: 'TikTok',         domini: ['tiktok.com'] },
  linkedin:       { label: 'LinkedIn',       domini: ['linkedin.com'] },
  facebook:       { label: 'Facebook',       domini: ['facebook.com', 'fb.com'] },
  sito:           { label: 'Sito web',       domini: null },
};

function linkSicuro(valore, chiave, dove) {
  if (valore == null || valore === '') return null;
  let u;
  try { u = new URL(String(valore).trim()); } catch {
    errore(dove, `"${chiave}" non è un link valido (${valore})`);
    return null;
  }
  if (u.protocol !== 'https:') {
    errore(dove, `"${chiave}" deve iniziare con https://`);
    return null;
  }
  if (u.username || u.password) {
    errore(dove, `"${chiave}" contiene credenziali nel link`);
    return null;
  }
  const domini = SOCIAL[chiave]?.domini;
  if (domini) {
    const host = u.hostname.toLowerCase();
    const ok = domini.some(d => host === d || host.endsWith('.' + d));
    if (!ok) {
      errore(dove, `"${chiave}" deve puntare a ${domini.join(' o ')} (trovato ${host})`);
      return null;
    }
  }
  return u.toString();
}

const testo = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function sha(s) { return crypto.createHash('sha1').update(s).digest('hex').slice(0, 10); }

async function trova(dir, base, estensioni) {
  for (const e of estensioni) {
    const p = path.join(dir, `${base}.${e}`);
    if (existsSync(p)) return p;
  }
  return null;
}

/* ─────────────────────────── 1. schede ─────────────────────────── */

async function leggiYaml(file) {
  const grezzo = await fs.readFile(file, 'utf8');
  if (grezzo.length > 200_000) throw new Error('file troppo grande');
  // YAML "core": niente tag personalizzati, niente alias, niente sorprese.
  return YAML.parse(grezzo, { schema: 'core', maxAliasCount: 0, uniqueKeys: true });
}

async function leggiProduzioni() {
  const voci = await fs.readdir(DIR_PRODUZIONI, { withFileTypes: true });
  const produzioni = [];
  for (const v of voci) {
    if (!v.isDirectory() || v.name.startsWith('_') || v.name.startsWith('.')) continue;
    const slug = v.name;
    const dir = path.join(DIR_PRODUZIONI, slug);
    const dove = `produzioni/${slug}`;
    if (!RE_SLUG.test(slug)) { errore(dove, 'il nome della cartella deve essere minuscolo, con i trattini (es. "vite-in-corso")'); continue; }
    if (RISERVATI.has(slug)) { errore(dove, `"${slug}" è un nome riservato dal sito, scegline un altro`); continue; }
    const file = path.join(dir, 'produzione.yml');
    if (!existsSync(file)) { errore(dove, 'manca il file produzione.yml'); continue; }

    let d;
    try { d = await leggiYaml(file); } catch (e) { errore(`${dove}/produzione.yml`, `non riesco a leggerlo (${e.message.split('\n')[0]})`); continue; }
    if (!d || typeof d !== 'object') { errore(`${dove}/produzione.yml`, 'il file è vuoto'); continue; }
    const doveF = `${dove}/produzione.yml`;

    if (d.attivo === false) continue;
    if (!d.nome) errore(doveF, 'manca "nome"');
    if (!Array.isArray(d.playlist) || d.playlist.length === 0) errore(doveF, '"playlist" deve contenere almeno una playlist');

    const playlist = [];
    for (const p of d.playlist ?? []) {
      const id = idPlaylist(p) ?? idCanale(p);
      if (!id) errore(doveF, `playlist o canale non riconosciuto: ${p}`);
      else playlist.push(id);
    }
    const RITAGLI = { sinistra: 'left', centro: 'centre', destra: 'right', auto: 'attention' };
    const ritaglio = String(d.ritaglio_verticale ?? 'sinistra').toLowerCase();
    if (!RITAGLI[ritaglio]) errore(doveF, 'ritaglio_verticale deve essere "sinistra", "centro", "destra" o "auto"');
    const escludi = (Array.isArray(d.escludi_titoli) ? d.escludi_titoli : [])
      .map(x => String(x).trim().toLowerCase()).filter(Boolean);

    const ev = d.in_evidenza ?? {};
    const hero = String(ev.hero ?? 'no').toLowerCase();
    if (!['no', 'ultimo', 'false'].includes(hero)) errore(doveF, 'in_evidenza.hero deve essere "no" oppure "ultimo"');
    const dnpRaw = String(ev.da_non_perdere ?? 'no').toLowerCase();
    let dnp = 0;
    if (dnpRaw === 'ultimo') dnp = 1;
    else if (/^ultimi-\d+$/.test(dnpRaw)) dnp = Math.min(6, +dnpRaw.split('-')[1]);
    else if (!['no', 'false'].includes(dnpRaw)) errore(doveF, 'in_evidenza.da_non_perdere deve essere "no", "ultimo" o "ultimi-N"');

    const social = {};
    for (const [k, val] of Object.entries(d.social ?? {})) {
      if (!SOCIAL[k]) { avviso(doveF, `social "${k}" sconosciuto, ignorato (ammessi: ${Object.keys(SOCIAL).join(', ')})`); continue; }
      const l = linkSicuro(val, k, doveF);
      if (l) social[k] = l;
    }

    const linkEpisodi = {};
    for (const [chiave, links] of Object.entries(d.link_episodi ?? {})) {
      const id = idVideo(chiave);
      if (!id) { errore(doveF, `link_episodi: "${chiave}" non è un video YouTube`); continue; }
      linkEpisodi[id] = {};
      for (const [k, val] of Object.entries(links ?? {})) {
        if (!SOCIAL[k]) { avviso(doveF, `link_episodi.${chiave}: "${k}" sconosciuto, ignorato`); continue; }
        const l = linkSicuro(val, k, doveF);
        if (l) linkEpisodi[id][k] = l;
      }
    }

    const fileHero = await trova(dir, 'hero', ['jpg', 'jpeg', 'png', 'webp']);
    const fileLogo = await trova(dir, 'logo', ['svg', 'png', 'webp']);
    if (!fileHero) avviso(dove, 'manca hero.jpg: userò la miniatura del video più recente');

    const copertine = {};
    const dirCop = path.join(dir, 'copertine');
    if (existsSync(dirCop)) {
      for (const f of await fs.readdir(dirCop)) {
        const m = f.match(/^([A-Za-z0-9_-]{11})\.(jpe?g|png|webp)$/i);
        if (m) copertine[m[1]] = path.join(dirCop, f);
        else if (!f.startsWith('.')) avviso(`${dove}/copertine`, `"${f}" ignorato: il nome deve essere l'ID del video (es. uUvRxN1bOKE.jpg)`);
      }
    }

    produzioni.push({
      slug,
      nome: testo(d.nome, 60),
      categoria: testo(d.categoria, 40),
      descrizione: testo(d.descrizione, 600),
      ordine: Number.isFinite(+d.ordine) ? +d.ordine : 99,
      original: d.original !== false,
      playlist,
      evidenza: { hero: hero === 'ultimo', dnp },
      social,
      linkEpisodi,
      escludi,
      ritaglio: RITAGLI[ritaglio] ?? 'left',
      fileHero, fileLogo, copertine,
    });
  }
  if (produzioni.length === 0) errore('produzioni', 'nessun format attivo trovato');
  const doppi = produzioni.flatMap(p => p.playlist).filter((x, i, a) => a.indexOf(x) !== i);
  for (const d of new Set(doppi)) avviso('produzioni', `la playlist ${d} è usata in più format: il video andrà al primo`);
  return produzioni.sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome));
}

async function leggiVetrina() {
  const file = path.join(DIR_CONTENUTI, 'vetrina.yml');
  if (!existsSync(file)) return { hero: [], dnp: [], nascondi: new Set() };
  let d;
  try { d = (await leggiYaml(file)) ?? {}; } catch (e) { errore('vetrina.yml', `non riesco a leggerlo (${e.message.split('\n')[0]})`); return { hero: [], dnp: [], nascondi: new Set() }; }
  const lista = (chiave) => (d[chiave] ?? []).map(x => {
    const id = idVideo(x);
    if (!id) errore('vetrina.yml', `${chiave}: "${x}" non è un video YouTube`);
    return id;
  }).filter(Boolean);
  const hero = lista('hero');
  if (hero.length > MAX_HERO) avviso('vetrina.yml', `hero: ne uso solo i primi ${MAX_HERO}`);
  return { hero: hero.slice(0, MAX_HERO), dnp: lista('da_non_perdere').slice(0, MAX_DNP), nascondi: new Set(lista('nascondi')) };
}

/* ─────────────────────────── 2. YouTube ─────────────────────────── */

async function getJSON(url, tentativi = 3) {
  for (let i = 1; ; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
      if (r.ok) return await r.json();
      const corpo = await r.text();
      // 4xx (chiave sbagliata, quota finita, playlist privata) non si risolvono riprovando
      if (r.status < 500 || i >= tentativi) throw new Error(`HTTP ${r.status}: ${corpo.slice(0, 200).replaceAll(API_KEY, '***')}`);
    } catch (e) {
      if (i >= tentativi || e.message.startsWith('HTTP 4')) throw e;
    } finally { clearTimeout(t); }
    await new Promise(r => setTimeout(r, 800 * i));
  }
}

const API = 'https://www.googleapis.com/youtube/v3';

async function videoDellaPlaylist(playlistId) {
  const ids = [];
  let pageToken = '';
  for (let pagina = 0; pagina < 20; pagina++) {            // max 1000 video per playlist
    const q = new URLSearchParams({ part: 'contentDetails,status', maxResults: '50', playlistId, key: API_KEY });
    if (pageToken) q.set('pageToken', pageToken);
    const j = await getJSON(`${API}/playlistItems?${q}`);
    for (const it of j.items ?? []) {
      if (it.status?.privacyStatus === 'public' && it.contentDetails?.videoId) ids.push(it.contentDetails.videoId);
    }
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  return ids;
}

/** "canale:@nome" o "canale:UC…" → ID della playlist automatica con tutti i caricamenti */
async function playlistCaricamenti(rif) {
  const chiave = rif.slice('canale:'.length);
  const q = new URLSearchParams({ part: 'contentDetails', key: API_KEY });
  if (chiave.startsWith('@')) q.set('forHandle', chiave); else q.set('id', chiave);
  const j = await getJSON(`${API}/channels?${q}`);
  const up = j.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!up) throw new Error('canale non trovato');
  return up;
}

async function dettagliVideo(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const q = new URLSearchParams({ part: 'snippet,contentDetails,status', id: ids.slice(i, i + 50).join(','), key: API_KEY });
    const j = await getJSON(`${API}/videos?${q}`);
    out.push(...(j.items ?? []));
  }
  return out;
}

function secondiISO(iso) {
  const m = String(iso).match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

/**
 * È uno Short? Prova principale: YouTube genera la miniatura verticale nativa (oar2.jpg,
 * 1080×1920) solo per i video verticali; per gli orizzontali restituisce un segnaposto 120×90.
 * Prova di riserva: la pagina /shorts/ID risponde 200 solo per gli Short.
 */
async function eShort(id, secondi) {
  if (secondi > SHORT_MAX_SECONDI) return false;
  const b = await scarica(`https://i.ytimg.com/vi/${id}/oar2.jpg`);
  if (b) {
    const m = await sharp(b).metadata().catch(() => null);
    if (m && m.width > 200) return m.height > m.width;
  }
  try {
    const r = await fetch(`https://www.youtube.com/shorts/${id}`, { method: 'HEAD', redirect: 'manual' });
    if (r.status === 200) return true;
  } catch { /* rete: decide la durata */ }
  return secondi <= 60;
}

async function scaricaCatalogoYouTube(produzioni, nascondi) {
  const visti = new Map();          // id video → slug produzione
  for (const p of produzioni) {
    for (const pl of p.playlist) {
      let ids;
      try { ids = await videoDellaPlaylist(pl.startsWith('canale:') ? await playlistCaricamenti(pl) : pl); }
      catch (e) { errore(`produzioni/${p.slug}`, `playlist ${pl} non leggibile (${e.message})`); continue; }
      if (ids.length === 0) avviso(`produzioni/${p.slug}`, `la playlist ${pl} è vuota o privata`);
      for (const id of ids) if (!visti.has(id) && !nascondi.has(id)) visti.set(id, p.slug);
    }
  }
  const dettagli = await dettagliVideo([...visti.keys()]);
  const adesso = Date.now();
  const grezzi = [];
  for (const v of dettagli) {
    if (v.status?.privacyStatus !== 'public' || v.status?.uploadStatus !== 'processed') continue;
    if (v.snippet?.liveBroadcastContent && v.snippet.liveBroadcastContent !== 'none') continue;
    const pubblicato = v.contentDetails?.videoPublishedAt ?? v.snippet?.publishedAt;
    if (!pubblicato || Date.parse(pubblicato) > adesso) continue;   // programmati: non ancora
    const prod = produzioni.find(x => x.slug === visti.get(v.id));
    const titoloMin = String(v.snippet?.title ?? '').toLowerCase();
    if (prod?.escludi?.some(parola => titoloMin.includes(parola))) continue;
    const secondi = secondiISO(v.contentDetails?.duration);
    grezzi.push({
      id: v.id,
      produzione: visti.get(v.id),
      titolo: v.snippet.title,
      descrizione: v.snippet.description,
      pubblicato,
      secondi,
      canale: v.snippet.channelTitle,
    });
  }
  // rilevamento Short, 6 richieste alla volta
  for (let i = 0; i < grezzi.length; i += 6) {
    await Promise.all(grezzi.slice(i, i + 6).map(async g => { g.short = await eShort(g.id, g.secondi); }));
  }
  return grezzi;
}

/* ─────────────────────────── 3. normalizzazione ─────────────────────────── */

const pad = n => String(n).padStart(2, '0');
export function durataTesto(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
}

export function pulisciTitolo(t) {
  return testo(t, 140)
    .replace(/(\s+#[\p{L}\p{N}_]+)+\s*$/u, '')     // hashtag in coda
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Titolo "da vetrina": toglie dal titolo YouTube i pezzi che il sito mostra già
 * altrove (nome del format, "ep. 5"). Divide sui separatori | – - e scarta solo
 * i pezzi che contengono il nome del format o sono solo il numero di puntata.
 * "I disturbi del sonno | ep. 5 SONNO, il Podcast" → "I disturbi del sonno"
 * "Ep. 07 Vite in Corso | Quando le storie si incontrano" → "Quando le storie si incontrano"
 */
export function titoloVetrina(t, nomeFormat) {
  const base = pulisciTitolo(t);
  const pezzi = base.split(/\s+[|–—]\s+|\s+-\s+|\s*\|\s*/).map(x => x.trim()).filter(Boolean);
  if (pezzi.length < 2) return base.replace(new RegExp('^' + escRe(nomeFormat) + '\\s+(?:ep(?:isodio)?\\.?\\s*\\d+\\s*)?[:–-]?\\s*', 'i'), '').trim() || base;
  // nome del format come parola intera, rispettando le maiuscole ("SONNO" sì, "del sonno" no)
  const reNome = new RegExp('(^|[^\\p{L}])' + escRe(nomeFormat) + '($|[^\\p{L}])', 'u');
  const reEp = /\b(?:ep(?:isodio)?|puntata)\.?\s*\d+/i;
  const soloEp = /^(?:ep(?:isodio)?|puntata)\.?\s*\d+$/i;
  // un pezzo che è solo il nome del format (anche in MAIUSCOLO: "VITE IN CORSO") va tolto
  const soloNome = (p) => p.replace(/[^\p{L}\p{N} ]/gu, '').trim().toLowerCase() === nomeFormat.toLowerCase();
  let tenuti = pezzi.filter(p => !reNome.test(p) && !soloEp.test(p) && !soloNome(p));
  if (tenuti.length === 0) tenuti = pezzi.filter(p => !reEp.test(p));
  if (tenuti.length === 0) return base;
  return tenuti.join(' · ');
}
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function numeroEpisodio(t) {
  const m = String(t).match(/\b(?:ep(?:isodio)?|puntata|pt)\.?\s*0*(\d{1,3})\b/i);
  return m ? +m[1] : null;
}
export function numeroStagione(t) {
  const m = String(t).match(/\b(?:S|stagione\s*)0*(\d{1,2})\b(?!\d)/);
  return m ? +m[1] : 1;
}

function normalizza(g, nomeFormat) {
  return {
    id: g.id,
    produzione: g.produzione,
    titolo: titoloVetrina(g.titolo, nomeFormat),
    titoloOriginale: pulisciTitolo(g.titolo),
    descrizione: String(g.descrizione ?? '').replace(/\r/g, '').slice(0, 2000).trim(),
    pubblicato: new Date(g.pubblicato).toISOString(),
    secondi: g.secondi,
    durata: durataTesto(g.secondi),
    short: !!g.short,
    stagione: numeroStagione(g.titolo),
    episodio: g.short ? null : numeroEpisodio(g.titolo),
  };
}

/* ─────────────────────────── 4. immagini ─────────────────────────── */

async function scarica(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    const tipo = r.headers.get('content-type') ?? '';
    if (!tipo.startsWith('image/')) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 15_000_000) return null;
    return buf;
  } catch { return null; } finally { clearTimeout(t); }
}

/** Miniatura YouTube più grande disponibile (i "segnaposto" 120×90 vengono scartati). */
async function miniatura(id, formati) {
  for (const f of formati) {
    const b = await scarica(`https://i.ytimg.com/vi/${id}/${f}`);
    if (!b) continue;
    const meta = await sharp(b).metadata().catch(() => null);
    if (meta && meta.width > 200) return b;
  }
  return null;
}

async function segnaposto(w, h, etichetta) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1D1F1E"/><stop offset="1" stop-color="#0B0B0B"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 9}" fill="#69DFA4" opacity=".9"/>
    <text x="50%" y="${h - 24}" font-family="sans-serif" font-size="${Math.round(w / 22)}" fill="#ffffff" fill-opacity=".35" text-anchor="middle">${etichetta.replace(/[<&>"]/g, '')}</text></svg>`;
  return Buffer.from(svg);
}

const WEBP = { quality: 78, effort: 5 };

async function generaImmaginiVideo(v, prod) {
  const dir = path.join(DIR_MEDIA, 'v');
  await fs.mkdir(dir, { recursive: true });
  const fileH = path.join(dir, `${v.id}-h.webp`);
  const fileV = path.join(dir, `${v.id}-v.webp`);
  const fileOG = path.join(dir, `${v.id}-og.jpg`);   // anteprima per WhatsApp/LinkedIn/Facebook
  const copertina = prod.copertine[v.id];
  // la copertina personalizzata cambia → rigenera la verticale
  const firma = (copertina ? sha((await fs.readFile(copertina)).toString('base64')) : (DEMO ? 'demo' : 'yt')) + '-' + prod.ritaglio;
  const fileFirma = path.join(dir, `${v.id}.firma`);
  const firmaVecchia = existsSync(fileFirma) ? await fs.readFile(fileFirma, 'utf8') : '';
  if (existsSync(fileH) && existsSync(fileV) && existsSync(fileOG) && firmaVecchia === firma) return;

  let orizz, vert;
  if (DEMO) {
    orizz = await segnaposto(1280, 720, v.titolo.slice(0, 40));
    vert = await segnaposto(720, 1280, v.titolo.slice(0, 22));
  } else {
    orizz = await miniatura(v.id, ['maxresdefault.jpg', 'sddefault.jpg', 'hqdefault.jpg']);
    vert = v.short ? await miniatura(v.id, ['oar2.jpg']) : null;
  }
  if (!orizz) { avviso(`video ${v.id}`, 'miniatura non scaricabile, uso un segnaposto'); orizz = await segnaposto(1280, 720, v.titolo.slice(0, 40)); }

  // Orizzontale 16:9 (righe "Da non perdere", hero picker, anteprime social)
  if (v.short && vert) {
    // Short in una card orizzontale: fondo sfocato + immagine verticale intera al centro
    const fondo = await sharp(vert).resize(960, 540, { fit: 'cover' }).blur(28).modulate({ brightness: .55 }).toBuffer();
    const centro = await sharp(vert).resize({ height: 540 }).toBuffer();
    await sharp(fondo).composite([{ input: centro, gravity: 'center' }]).webp(WEBP).toFile(fileH);
  } else {
    await sharp(orizz).resize(960, 540, { fit: 'cover' }).webp(WEBP).toFile(fileH);
  }
  await sharp(fileH).resize(1200, 675, { fit: 'cover' }).jpeg({ quality: 82, mozjpeg: true }).toFile(fileOG);

  // Verticale 9:16: copertina personalizzata > verticale nativa dello Short > ritaglio "intelligente"
  const sorgenteV = copertina ? await fs.readFile(copertina) : vert;
  if (sorgenteV) {
    await sharp(sorgenteV).rotate().resize(540, 960, { fit: 'cover', position: 'attention' }).webp(WEBP).toFile(fileV);
  } else {
    // Puntata orizzontale senza copertina verticale: ritaglio 9:16 allineato a sinistra
    // (di solito il titolo nella miniatura parte da sinistra). Si cambia per format
    // con "ritaglio_verticale" nella scheda.
    const pos = prod.ritaglio === 'attention' ? sharp.strategy.attention : prod.ritaglio;
    await sharp(orizz).resize(540, 960, { fit: 'cover', position: pos }).webp(WEBP).toFile(fileV);
  }
  await fs.writeFile(fileFirma, firma);
}

async function generaImmaginiProduzione(p, videoPiuRecente) {
  const dir = path.join(DIR_MEDIA, 'p');
  await fs.mkdir(dir, { recursive: true });
  const out = { hero: null, heroPiccola: null, logo: null };

  let sorgente = p.fileHero ? await fs.readFile(p.fileHero) : null;
  if (!sorgente && videoPiuRecente) sorgente = await fs.readFile(path.join(DIR_MEDIA, 'v', `${videoPiuRecente.id}-h.webp`)).catch(() => null);
  if (!sorgente) sorgente = await segnaposto(1920, 1080, p.nome);
  const firma = sha(sorgente.subarray(0, 4096).toString('base64') + sorgente.length);
  out.hero = `p/${p.slug}-hero-${firma}.webp`;
  out.heroPiccola = `p/${p.slug}-hero-${firma}-960.webp`;
  if (!existsSync(path.join(DIR_MEDIA, out.hero))) {
    const img = sharp(sorgente).rotate();
    await img.clone().resize(1920, 1080, { fit: 'cover', withoutEnlargement: false }).webp({ quality: 74 }).toFile(path.join(DIR_MEDIA, out.hero));
    await img.clone().resize(960, 540, { fit: 'cover' }).webp({ quality: 72 }).toFile(path.join(DIR_MEDIA, out.heroPiccola));
  }

  if (p.fileLogo) {
    const buf = await fs.readFile(p.fileLogo);
    if (p.fileLogo.endsWith('.svg')) {
      // Gli SVG possono contenere script: li accettiamo solo "puliti".
      const s = buf.toString('utf8');
      if (/<script|on\w+\s*=|javascript:|<foreignObject|xlink:href\s*=\s*["']https?:/i.test(s)) {
        errore(`produzioni/${p.slug}/logo.svg`, 'il file SVG contiene script o riferimenti esterni: esportalo di nuovo come PNG');
      } else {
        out.logo = `p/${p.slug}-logo-${sha(s)}.svg`;
        const vb = s.match(/viewBox\s*=\s*["'][\d.\-]+[\s,]+[\d.\-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
        if (vb && +vb[2] > 0) out.logoRapporto = +(+vb[1] / +vb[2]).toFixed(2);
        await fs.writeFile(path.join(DIR_MEDIA, out.logo), buf);
      }
    } else {
      // v2: margini trasparenti tagliati, così tutti i loghi si misurano sul disegno vero
      out.logo = `p/${p.slug}-logo-${sha('v2' + buf.subarray(0, 4096).toString('base64') + buf.length)}.webp`;
      const dest = path.join(DIR_MEDIA, out.logo);
      if (!existsSync(dest)) {
        const tagliato = await sharp(buf).trim({ threshold: 1 }).toBuffer().catch(() => buf);
        await sharp(tagliato).resize({ width: 900, height: 360, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 90, alphaQuality: 100 }).toFile(dest);
      }
      const m = await sharp(dest).metadata();
      out.logoRapporto = +(m.width / m.height).toFixed(2);
    }
  }
  return out;
}

/* ─────────────────────────── 5. vetrina ─────────────────────────── */

function componiVetrina(video, produzioni, scelte) {
  const per = new Map(video.map(v => [v.id, v]));
  const lunghi = video.filter(v => !v.short);           // già ordinati dal più recente
  const esiste = (id, lista) => {
    if (per.has(id)) return true;
    avviso('vetrina.yml', `${lista}: il video ${id} non è in nessuna playlist dei format, lo salto`);
    return false;
  };
  const unici = a => [...new Set(a)];

  let hero = scelte.hero.filter(id => esiste(id, 'hero'));
  for (const p of produzioni) if (p.evidenza.hero) {
    const ultimo = lunghi.find(v => v.produzione === p.slug);
    if (ultimo) hero.push(ultimo.id);
  }
  hero = unici(hero);
  for (const v of lunghi) { if (hero.length >= MAX_HERO) break; if (!hero.includes(v.id)) hero.push(v.id); }

  let dnp = scelte.dnp.filter(id => esiste(id, 'da_non_perdere'));
  for (const p of produzioni) if (p.evidenza.dnp) {
    dnp.push(...lunghi.filter(v => v.produzione === p.slug).slice(0, p.evidenza.dnp).map(v => v.id));
  }
  dnp = unici(dnp);
  for (const v of lunghi) { if (dnp.length >= 6) break; if (!dnp.includes(v.id)) dnp.push(v.id); }

  return { hero: hero.slice(0, MAX_HERO), daNonPerdere: dnp.slice(0, MAX_DNP) };
}

/* ─────────────────────────── main ─────────────────────────── */

async function main() {
  const t0 = Date.now();
  const produzioni = await leggiProduzioni();
  const scelte = await leggiVetrina();

  if (SOLO_VERIFICA) return chiudi(t0, null);
  if (!DEMO && !API_KEY) {
    errore('configurazione', 'manca YOUTUBE_API_KEY (vedi README, "Prima configurazione"). Per provare senza chiave: npm run sync:demo');
  }
  if (errori.length) return chiudi(t0, null);

  let grezzi;
  if (DEMO) {
    const demo = JSON.parse(await fs.readFile(path.join(ROOT, 'scripts', 'demo-video.json'), 'utf8'));
    const attivi = new Set(produzioni.map(p => p.slug));
    grezzi = demo.filter(g => attivi.has(g.produzione) && !scelte.nascondi.has(g.id));
  } else {
    grezzi = await scaricaCatalogoYouTube(produzioni, scelte.nascondi);
  }
  if (errori.length) return chiudi(t0, null);
  if (grezzi.length === 0) { errore('catalogo', 'nessun video pubblico trovato: non pubblico un sito vuoto'); return chiudi(t0, null); }

  const perProd = Object.fromEntries(produzioni.map(p => [p.slug, p]));
  const video = grezzi.map(g => normalizza(g, perProd[g.produzione].nome)).sort((a, b) => b.pubblicato.localeCompare(a.pubblicato));

  for (const v of video) {
    const p = perProd[v.produzione];
    v.link = { youtube: `https://www.youtube.com/watch?v=${v.id}`, ...(p.linkEpisodi[v.id] ?? {}) };
    await generaImmaginiVideo(v, p);
    v.img = { h: `v/${v.id}-h.webp`, v: `v/${v.id}-v.webp`, og: `v/${v.id}-og.jpg` };
  }

  const prodOut = [];
  for (const p of produzioni) {
    const suoi = video.filter(v => v.produzione === p.slug);
    if (suoi.length === 0) avviso(`produzioni/${p.slug}`, 'nessun video pubblico: il format non comparirà');
    const img = await generaImmaginiProduzione(p, suoi[0]);
    prodOut.push({
      slug: p.slug, nome: p.nome, categoria: p.categoria, descrizione: p.descrizione,
      ordine: p.ordine, original: p.original, social: p.social, img,
      conteggio: { episodi: suoi.filter(v => !v.short).length, short: suoi.filter(v => v.short).length },
    });
  }
  if (errori.length) return chiudi(t0, null);

  const catalogo = {
    versione: 1,
    generato: new Date().toISOString(),
    produzioni: prodOut.filter(p => p.conteggio.episodi + p.conteggio.short > 0),
    video,
    ...componiVetrina(video, produzioni, scelte),
  };
  // scrittura atomica: o tutto o niente
  await fs.mkdir(path.dirname(FILE_CATALOGO), { recursive: true });
  const tmp = FILE_CATALOGO + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(catalogo, null, 1));
  await fs.rename(tmp, FILE_CATALOGO);
  // impronta dei contenuti (senza data di generazione) per decidere se ripubblicare
  const { generato, ...stabile } = catalogo;
  await fs.writeFile(path.join(ROOT, 'src', 'data', 'impronta.txt'), sha(JSON.stringify(stabile)) + '\n');
  return chiudi(t0, catalogo);
}

function chiudi(t0, catalogo) {
  for (const a of avvisi) console.warn(a);
  if (errori.length) {
    console.error(`\nCi sono ${errori.length} problemi da sistemare prima di pubblicare:\n`);
    for (const e of errori) console.error(e);
    console.error('\nIl sito online NON è stato modificato.');
    process.exitCode = 1;
    return;
  }
  if (catalogo) {
    console.log(`✔ ${catalogo.produzioni.length} format · ${catalogo.video.length} video · hero: ${catalogo.hero.join(', ')} · ${((Date.now() - t0) / 1000).toFixed(1)}s${DEMO ? ' · MODALITÀ DEMO' : ''}`);
  } else {
    console.log('✔ Schede corrette.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    console.error('✖ Errore imprevisto:', (e?.message ?? String(e)).replaceAll(API_KEY || '\u0000', '***'));
    console.error('Il sito online NON è stato modificato.');
    process.exitCode = 1;
  });
}
