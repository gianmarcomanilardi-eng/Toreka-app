# Come mettere Toreka sul tuo iPhone

Questi sono i passaggi, spiegati semplici. In totale ci vogliono 10-15 minuti,
ed è tutto gratis.

## 1. Metti i file su GitHub (serve a Vercel per leggerli)

1. Vai su [github.com](https://github.com) e crea un account gratuito (se non ce l'hai già).
2. In alto a destra premi il "+" → "New repository".
3. Dagli un nome, es. `toreka-app`, lascialo "Public", premi "Create repository".
4. Nella pagina che si apre, premi "uploading an existing file" e trascina
   dentro TUTTI i file e le cartelle che trovi qui (index.html, package.json,
   le cartelle src/ e public/, ecc.) — tutte insieme.
5. Premi "Commit changes" in fondo alla pagina.

## 2. Collega Vercel (fa il lavoro di pubblicarla online)

1. Vai su [vercel.com](https://vercel.com) e registrati gratis — il modo più
   semplice è premere "Continue with GitHub" e usare l'account appena creato.
2. Premi "Add New..." → "Project".
3. Trova il repository `toreka-app` che hai appena creato e premi "Import".
4. Vercel riconosce automaticamente che è un progetto Vite/React — non devi
   cambiare nessuna impostazione. Premi "Deploy".
5. Aspetta 1-2 minuti. Quando finisce, ti dà un indirizzo tipo
   `toreka-app.vercel.app` — è la tua app, online, vera.

## 3. Mettila sulla schermata Home dell'iPhone

1. Apri quell'indirizzo (`toreka-app.vercel.app`) in **Safari** sul tuo iPhone
   (deve essere Safari, non Chrome — è l'unico browser iOS che lo permette).
2. Premi il pulsante di condivisione (il quadrato con la freccia verso l'alto,
   in basso al centro).
3. Scorri e premi "Aggiungi alla schermata Home".
4. Premi "Aggiungi" in alto a destra.

Ora hai un'icona vera sulla schermata Home. Aprendola, l'app parte a schermo
intero, senza le barre di Safari — si comporta come un'app scaricata
dall'App Store, anche se tecnicamente è un sito web "travestito" da app.

## Cosa aggiornare quando cambiamo qualcosa insieme in chat

Ogni volta che ti do una nuova versione di `App.jsx`, ripeti solo questi due
passaggi (non serve rifare tutto da capo):
1. Su GitHub, apri il file `src/App.jsx` nel tuo repository, premi la matita
   (Modifica), cancella tutto e incolla il contenuto nuovo, poi "Commit changes".
2. Vercel se ne accorge da solo e ripubblica l'app in automatico — aspetta
   1-2 minuti e ricarica la pagina sull'iPhone (o riapri l'app dalla Home).

## Un limite onesto da sapere

Questa beta salva la tua collezione e le ricerche recenti *nel tuo iPhone*,
non su un server — se cambi telefono o cancelli i dati di Safari, si
azzerano. Va benissimo per testare l'app adesso; quando colleghiamo un
database vero (di cui abbiamo già parlato), diventerà permanente e uguale
su tutti i tuoi dispositivi.
