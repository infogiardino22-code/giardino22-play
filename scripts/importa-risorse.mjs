#!/usr/bin/env node
/**
 * Scarica UNA VOLTA SOLA loghi, font e immagini elencati in contenuti/risorse.yml
 * e li salva nel progetto. I file già presenti non vengono toccati.
 * Gira nel robot di pubblicazione (GitHub Actions), che poi li salva nel repository.
 *
 *   node scripts/importa-risorse.mjs
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'contenuti', 'risorse.yml');
const HOST_AMMESSI = new Set(['www.giardino22.it', 'giardino22.it']);
const MAX_BYTE = 20_000_000;

// Cartelle in cui lo script può scrivere, ed estensioni ammesse
const DESTINAZIONI = [
  { re: /^public\/brand\/[a-z0-9-]+\.(png|webp|svg)$/ },
  { re: /^public\/fonts\/[A-Za-z0-9-]+\.(otf|woff2|woff|ttf)$/ },
  { re: /^contenuti\/produzioni\/[a-z0-9-]+\/(hero|logo)\.(jpe?g|png|webp)$/ },
  { re: /^contenuti\/produzioni\/[a-z0-9-]+\/copertine\/[A-Za-z0-9_-]{11}\.(jpe?g|png|webp)$/ },
];

// Firma dei primi byte: il file deve essere davvero quello che dice di essere
function tipoReale(buf) {
  const h = buf.subarray(0, 12);
  if (h[0] === 0x89 && h.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) return 'jpg';
  if (h.toString('latin1', 0, 4) === 'RIFF' && h.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (h.toString('latin1', 0, 4) === 'OTTO') return 'otf';
  if (h.readUInt32BE(0) === 0x00010000 || h.toString('latin1', 0, 4) === 'true') return 'ttf';
  if (h.toString('latin1', 0, 4) === 'wOF2') return 'woff2';
  if (h.toString('latin1', 0, 4) === 'wOFF') return 'woff';
  if (/^\s*<(\?xml|svg)/i.test(buf.subarray(0, 200).toString('utf8'))) return 'svg';
  return null;
}
const compatibile = (ext, reale) => ext === reale || (ext === 'jpeg' && reale === 'jpg') || (['otf', 'ttf'].includes(ext) && ['otf', 'ttf'].includes(reale));

async function scarica(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'error' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length === 0) throw new Error('file vuoto');
    if (buf.length > MAX_BYTE) throw new Error('file troppo grande');
    return buf;
  } finally { clearTimeout(t); }
}

async function main() {
  if (!existsSync(FILE)) { console.log('Nessun contenuti/risorse.yml: niente da importare.'); return; }
  const elenco = YAML.parse(await fs.readFile(FILE, 'utf8'), { schema: 'core', maxAliasCount: 0 }) ?? {};
  let nuovi = 0, errori = 0;
  for (const [dest, url] of Object.entries(elenco)) {
    const rel = path.posix.normalize(dest);
    if (rel !== dest || !DESTINAZIONI.some(d => d.re.test(rel))) { console.error(`✖ ${dest}: cartella o nome non ammessi`); errori++; continue; }
    const assoluto = path.join(ROOT, rel);
    if (existsSync(assoluto)) continue;                       // già presente: non si tocca
    let u;
    try { u = new URL(String(url)); } catch { console.error(`✖ ${dest}: link non valido`); errori++; continue; }
    if (u.protocol !== 'https:' || !HOST_AMMESSI.has(u.hostname)) { console.error(`✖ ${dest}: si accettano solo link https://www.giardino22.it/`); errori++; continue; }
    try {
      const buf = await scarica(u.href);
      const ext = rel.split('.').pop().toLowerCase();
      const reale = tipoReale(buf);
      if (!reale || !compatibile(ext, reale)) throw new Error(`il contenuto non è un ${ext} (sembra ${reale ?? 'sconosciuto'})`);
      await fs.mkdir(path.dirname(assoluto), { recursive: true });
      await fs.writeFile(assoluto, buf);
      console.log(`✔ ${dest} (${Math.round(buf.length / 1024)} KB)`);
      nuovi++;
    } catch (e) {
      console.error(`✖ ${dest}: ${e.message}`); errori++;
    }
  }
  console.log(`Risorse: ${nuovi} scaricate${errori ? `, ${errori} con problemi` : ''}.`);
  // Un'immagine mancante non deve bloccare la pubblicazione: il sito usa un'alternativa.
}

main().catch(e => { console.error('✖ Errore imprevisto:', e.message); process.exitCode = 1; });
