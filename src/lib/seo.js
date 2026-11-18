// Dati strutturati (schema.org) condivisi: chi pubblica Play, dove trovarlo, come si chiama il sito.
// Servono a Google (risultati video, pannello informativo) e ai motori AI (ChatGPT, Perplexity, Gemini…)
// per capire con certezza chi siamo e collegare le pagine fra loro.

export const SITO = 'https://www.giardino22.it';
export const PLAY_SOCIAL = {
  youtube: 'https://www.youtube.com/@giardino22play',
  instagram: 'https://www.instagram.com/giardino22play/',
  tiktok: 'https://www.tiktok.com/@giardino22play',
};

/** Indirizzo assoluto a partire da un percorso del sito. */
export const assoluto = (percorso, site) => new URL(percorso, site).href;

export function organizzazione(site) {
  return {
    '@type': 'Organization',
    '@id': `${SITO}/#organizzazione`,
    name: 'Giardino22',
    legalName: 'Giardino22 Art Lab S.r.l.',
    url: SITO,
    logo: assoluto('/brand/giardino22.png', site),
    vatID: 'IT02824270181',
    email: 'hello@giardino22.it',
    telephone: '+39 02 2219 8530',
    address: {
      '@type': 'PostalAddress', streetAddress: 'Viale Giovanni da Cermenate 82',
      postalCode: '20141', addressLocality: 'Milano', addressRegion: 'MI', addressCountry: 'IT',
    },
    description: 'Studio di produzione video a Milano: produzioni video, live streaming, podcast, eventi e format originali.',
    sameAs: [
      'https://www.instagram.com/giardino22artlab/',
      'https://it.linkedin.com/company/giardino22',
      PLAY_SOCIAL.youtube, PLAY_SOCIAL.instagram, PLAY_SOCIAL.tiktok,
    ],
  };
}

export function sitoPlay(site) {
  return {
    '@type': 'WebSite',
    '@id': assoluto('/#sito', site),
    name: 'Giardino22 Play',
    alternateName: ['G22 Play', 'Play Giardino22'],
    url: assoluto('/', site),
    inLanguage: 'it-IT',
    description: 'La piattaforma video di Giardino22: podcast, serie, interviste e format originali prodotti a Milano.',
    publisher: { '@id': `${SITO}/#organizzazione` },
  };
}

/** Percorso di navigazione (Play › Format › Video) mostrato da Google sotto il titolo. */
export function briciole(voci, site) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: voci.map(([nome, percorso], i) => ({
      '@type': 'ListItem', position: i + 1, name: nome, item: assoluto(percorso, site),
    })),
  };
}
