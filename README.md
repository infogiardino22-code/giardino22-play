# Giardino22 Play

La piattaforma video di Giardino22, rifatta da zero: veloce, sicura e **autonoma**.
I video arrivano da soli dalle playlist YouTube; la redazione decide solo *cosa* mettere in vetrina.

---

## Come funziona, in una riga

```
contenuti/ (schede dei format)  →  YouTube API  →  sito statico  →  GitHub Pages
          scritte da voi           ogni ora           HTML puro       online in tutto il mondo
```

Ogni ora un robot (GitHub Actions) legge le playlist dei format, scarica titoli, durate, descrizioni e miniature,
ottimizza le immagini e rigenera il sito su GitHub Pages. Se non è uscito niente di nuovo non fa nulla.
Il sito pubblicato è fatto **solo di file statici**: niente database, niente PHP, niente pannello di login
esposto su internet. È il motivo per cui è sia velocissimo sia molto difficile da attaccare (vedi *Sicurezza*).

---

## Lavoro quotidiano (redazione)

### Pubblicare un nuovo video
Caricatelo su YouTube **e aggiungetelo alla playlist del format**. Fine. Entro un'ora è sul sito,
nelle *Ultime uscite* e nel carosello del suo format. Funziona anche con playlist su canali diversi
(es. Nowtilus sul vostro canale e su quello di Nowtilus): basta elencarle tutte nella scheda del format.

### Aggiungere un nuovo format
1. In `contenuti/produzioni/` copiate la cartella `_modello` e rinominatela, es. `storie-di-quartiere`
   (minuscolo, con i trattini: diventa l'indirizzo `/storie-di-quartiere/`).
2. Compilate `produzione.yml`: nome, categoria, descrizione, playlist, social.
3. Mettete nella cartella:
   | File | Cosa | Formato |
   |---|---|---|
   | `hero.jpg` | immagine grande del format | orizzontale, almeno 1920×1080 |
   | `logo.png` | logo su fondo trasparente | PNG, WebP o SVG |
   | `copertine/ID.jpg` | *(facoltativo)* copertina verticale 9:16 di un video lungo | es. `copertine/uUvRxN1bOKE.jpg` |
4. Salvate (commit). Il sito si aggiorna in un paio di minuti.

Il nuovo carosello compare in home nella posizione indicata da `ordine`.
Le icone social compaiono **solo** per i campi compilati.

### Scegliere cosa va in vetrina
Due livelli, dal più automatico al più preciso:

- **Nella scheda del format** (`in_evidenza`): `hero: ultimo` mette in automatico l'ultimo episodio
  nelle slide in alto; `da_non_perdere: ultimi-2` mette gli ultimi due nella riga *Da non perdere*.
  Ideale per i format sempre attivi: non dovete ricordarvi di aggiornare niente.
- **In `contenuti/vetrina.yml`**: incollate i link dei video esatti per le 3 slide hero e per
  *Da non perdere*. Quello che scrivete qui vince sulle schede. C'è anche `nascondi:` per togliere
  dal sito un video senza toccare YouTube.

Se lasciate tutto vuoto, il sito riempie la vetrina da solo con le ultime uscite.

### Miniature e formato verticale
Come sul sito attuale, titolo, format, stagione, episodio e durata stanno sopra l'immagine, nella parte
bassa, su una sfumatura scura con una leggera sfocatura: il testo già impresso nella miniatura, in quella
zona, si perde e non si mescola con il titolo della card. In alto a sinistra le etichette
"G22 Original" (si toglie con `original: false` nella scheda del format) e "Nuovo" (uscito da meno di
7 giorni). Per l'immagine verticale il sito sceglie, in ordine:
1. la vostra copertina in `copertine/ID.jpg`, se c'è;
2. per gli Short, la miniatura verticale nativa di YouTube (1080×1920);
3. altrimenti ritaglia la miniatura orizzontale con un ritaglio "intelligente", che cerca volti e
   dettagli invece di tagliare a caso al centro.

Per i video lunghi importanti conviene caricare la copertina verticale (le avete già, sono le
`*_VERTICALE*` del vecchio sito).

### Titoli
Sul sito il titolo YouTube viene ripulito dai pezzi già mostrati altrove: *"I disturbi del sonno da
conoscere | ep. 5 SONNO, il Podcast"* diventa *"I disturbi del sonno da conoscere"*, con "Ep. 05" nella
riga informazioni. Il numero di episodio viene letto da "ep. 5", "Ep. 05", "puntata 5". Gli hashtag in
coda al titolo vengono tolti. Il titolo originale resta nei dati per Google.

### Come modificare i file senza programmi
Il modo più semplice: aprite il repository su **github.com**, entrate nella cartella, premete la matita
per modificare un file o *Add file → Upload files* per caricare immagini, poi *Commit changes*.
Se una scheda contiene un errore, la pubblicazione si ferma, il sito online **resta com'era** e GitHub
vi manda una mail con l'elenco dei problemi in italiano (es. *"produzioni/sonno/produzione.yml:
"spotify" deve puntare a open.spotify.com"*).

> Più avanti si può aggiungere un'interfaccia a moduli sopra questi stessi file (es. Pages CMS o
> Decap CMS) senza cambiare nulla del sito. Ve la consiglio quando i format diventano tanti o le
> persone che li gestiscono non sono tecniche.

### Aggiornare subito, senza aspettare l'ora
Su GitHub: **Actions → Aggiorna e pubblica Play → Run workflow**.

---

## Scelte di design e UX

- **Clic su un video → pagina dedicata**, non un popup. Ogni puntata ha un suo indirizzo
  condivisibile, entra in Google (con i dati strutturati `VideoObject`, che abilitano i risultati
  video), ha anteprima corretta su WhatsApp/LinkedIn, e tiene lo spettatore sul sito:
  sotto il player ci sono descrizione, link alle altre piattaforme (Spotify, Amazon Music…),
  *Prossimo episodio*, *Altri episodi* e *Guarda anche* dagli altri format.
- **Il player YouTube si carica solo al clic.** Prima si vede la vostra immagine con il tasto play.
  La pagina si apre subito, senza scaricare in anticipo il mezzo megabyte e oltre di script del player, e nessun dato va a Google finché l'utente non preme play
  (si usa il dominio `youtube-nocookie.com`). Il sito non usa cookie propri.
  L'informativa privacy va comunque aggiornata dal vostro consulente.
- **Episodi e clip sono sempre separati.** Gli episodi sono in formato orizzontale: nella pagina del
  format si vedono 6 caselle per pagina su computer (se gli episodi sono di più, la sesta casella
  diventa la freccia per la pagina successiva) e un carosello sul telefono. Gli Short stanno nella
  riga "Clip e Short", in verticale.
- **Gli Short** si aprono con un player verticale accanto alle informazioni; nelle righe orizzontali
  appaiono interi su fondo sfocato, mai tagliati.
- **Stessa griglia del sito Giardino22**: contenuti larghi al massimo 1296 px con i margini del sito,
  5 card per riga (3 in *Da non perdere*), scorrimento con frecce, trascinamento col mouse o swipe.
- **Animazioni**: titoli dell'hero che entrano parola per parola, sfondo con zoom lento e parallasse,
  barre di avanzamento, righe e card che compaiono in sequenza scorrendo, card che si inclinano e si
  illuminano seguendo il mouse, nastro di testo in movimento, header che si compatta e si nasconde
  scendendo. Si fermano da sole per chi ha attivato "riduci movimento" nel sistema operativo.
- **Accessibilità**: navigabile da tastiera, etichette per lettori di schermo, contrasti adeguati,
  l'hero si mette in pausa quando ci si passa sopra o lo si raggiunge col tasto Tab.

---

## Sicurezza

| Rischio | Come è gestito |
|---|---|
| Attacchi al CMS (il problema n.1 di WordPress) | Non c'è un CMS online: il sito è HTML statico. Non esiste una pagina di login da forzare. |
| Plugin vulnerabili | Zero plugin. Tre sole dipendenze in fase di generazione (`astro`, `sharp`, `yaml`), nessuna nel browser. |
| Furto della chiave YouTube | La chiave vive solo nei *Secrets* di GitHub e viene usata durante la generazione; non arriva mai nel browser. Va limitata nella Google Cloud Console alla sola *YouTube Data API v3*. |
| XSS / codice iniettato | Content-Security-Policy rigida (in ogni pagina): il browser esegue solo il nostro unico file JS e carica iframe solo da `youtube-nocookie.com`. Tutti i testi da YouTube sono resi come testo, mai come HTML. |
| Link malevoli nelle schede | Ogni link social viene controllato: deve essere `https://` e puntare al dominio giusto (Spotify → open.spotify.com, ecc.). Altrimenti la pubblicazione si ferma. |
| Loghi SVG con script nascosti | Gli SVG con script o riferimenti esterni vengono rifiutati. |
| Clickjacking | `X-Frame-Options: DENY` e `frame-ancestors 'none'`. |
| Dati YouTube rotti o API giù | Lo script si ferma e non pubblica un sito a metà: online resta l'ultima versione buona. |
| Account | Attivate l'**autenticazione a due fattori** su GitHub, Google e Aruba per tutti gli utenti. È la protezione più importante che resta in mano a voi. |
| DDoS / picchi di traffico | Il sito è servito dalla rete di distribuzione di GitHub Pages. |

Cose da fare una volta: attivare la verifica in due passaggi su GitHub e limitare a poche persone chi
può modificare il repository.

---

## Prima configurazione (una volta sola)

1. **GitHub**: repository pubblico `giardino22-play` con questa cartella.
   In *Settings → Pages* la sorgente è **GitHub Actions** e il dominio personalizzato è `play.giardino22.it`
   (con *Enforce HTTPS* attivo).
2. **Chiave YouTube**: Google Cloud Console → progetto → abilita *YouTube Data API v3* →
   *Credenziali* → *Crea chiave API* → *Limita chiave* → solo *YouTube Data API v3*.
   La chiave va incollata in GitHub, *Settings → Secrets and variables → Actions → New repository secret*,
   con nome `YOUTUBE_API_KEY`. È l'unico segreto. La quota gratuita (10.000 unità al giorno) basta e avanza:
   ogni aggiornamento ne usa circa 10.
3. **Aruba, DNS di giardino22.it**: un record **CNAME** con nome `play` che punta a `<utente-github>.github.io`.
4. **Primo avvio**: *Actions → Aggiorna e pubblica Play → Run workflow*. Al primo giro il robot scarica
   dal vecchio sito loghi, font e immagini elencati in `contenuti/risorse.yml` e li salva nel repository:
   da lì in poi il sito non dipende più da WordPress.
5. **Playlist mancanti**: in `vite-in-corso` va aggiunta la playlist con gli episodi lunghi.
6. **WordPress**: incollate `migrazione/redirect-wordpress.htaccess` nel `.htaccess` di giardino22.it
   (prima di `# BEGIN WordPress`), cambiate la voce di menu "Play" in `https://play.giardino22.it/`
   e mettete in bozza le vecchie pagine di Play. Fate prima un backup.

### Costi
Tutto gratis: GitHub Pages e GitHub Actions sono gratuiti per i repository pubblici, la YouTube API
rientra ampiamente nella quota gratuita. Il repository pubblico non contiene password né chiavi:
la chiave YouTube sta nei *Secrets*, che non sono visibili a nessuno.

---

## Sviluppo in locale

```bash
npm install
npm run sync:demo     # dati di esempio, senza chiave né rete
npm run dev           # http://localhost:4321

# con i dati veri
cp .env.example .env  # inserite la chiave
export $(cat .env | xargs) && npm run sync && npm run build
```

`npm run check:contenuti` controlla solo che le schede siano scritte bene.

### Struttura

```
contenuti/
  vetrina.yml                    scelte editoriali della home
  produzioni/<format>/           una cartella per format
    produzione.yml  hero.jpg  logo.png  copertine/
scripts/sync-youtube.mjs         legge YouTube, valida, ottimizza le immagini
src/
  pages/index.astro              home
  pages/[produzione]/index.astro pagina del format
  pages/[produzione]/[video].astro pagina del video
  components/  layouts/  lib/
public/
  css/play.css  js/play.js       tutto lo stile e tutto il JavaScript
  _headers                       header di sicurezza e cache
.github/workflows/pubblica.yml   aggiornamento automatico
migrazione/                      redirect dal vecchio sito
```
