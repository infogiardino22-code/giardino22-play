// @ts-check
import { defineConfig } from 'astro/config';

// Indirizzo pubblico del sito. Consigliato un sottodominio dedicato
// (play.giardino22.it): separa Play da WordPress anche lato sicurezza.
// Per pubblicarlo invece sotto giardino22.it/play/ imposta BASE_PATH=/play
const SITE_URL = process.env.SITE_URL || 'https://play.giardino22.it';
const BASE_PATH = process.env.BASE_PATH || '/';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'always',
  output: 'static',
  build: {
    format: 'directory',
    // Niente CSS inline: permette una Content-Security-Policy rigida (vedi public/_headers)
    inlineStylesheets: 'never',
  },
  compressHTML: true,
  prefetch: false,
  devToolbar: { enabled: false },
});
