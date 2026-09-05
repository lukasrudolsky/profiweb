# Profiweb.cz

Statický marketingový web pro Profiweb, nabídku tvorby webů. Postaven čistě
na HTML/CSS/JS bez buildovacího procesu, připraven k nasazení na jakýkoli
statický hosting (GitHub Pages, Netlify, Vercel, vlastní server).

## Jak spustit lokálně

Web nepotřebuje žádný build krok ani závislosti, stačí ho servírovat jako
statické soubory:

```bash
# libovolný statický server, např.:
npx serve .
# nebo VS Code rozšíření "Live Server" na index.html
```

Otevři `http://localhost:<port>/index.html` v prohlížeči.

## Struktura složek

```
.
├── index.html              Živá stránka webu
├── assets/
│   ├── css/                Stylopisy (styles.css)
│   ├── js/                 Skripty webu (site.js, booking.js, audit.js, country-codes.js)
│   ├── images/             Optimalizované obrázky a ikony použité na webu
│   │   └── source/         Zdrojové/needitované verze obrázků před optimalizací
│   └── fonts/              Vyhrazeno pro lokální fonty (aktuálně se fonty načítají z Google Fonts)
└── design-previews/        Samostatné náhledové stránky komponent z Figmy,
                             nejsou součástí živého webu, slouží jen k prohlížení
```

## Technologie

- **Vanilla HTML/CSS/JS**: žádný framework, žádný build krok.
- **BEM** konvence pro CSS třídy (`block__element--modifier`).
- **[cal.com](https://cal.com)**: veřejné API pro rezervační modal (výběr termínu
  a odeslání rezervace), napojené na Google Calendar. Nastavení viz hlavička
  [assets/js/booking.js](assets/js/booking.js).
- **Google PageSpeed Insights API**: pohání sekci "Audit webu zdarma"
  ([assets/js/audit.js](assets/js/audit.js)). Vyžaduje API klíč vložený do
  `<meta name="psi-api-key">` v `index.html`, omezený na doménu webu (HTTP
  referrer), jde o veřejný, doménově uzamčený klíč, ne tajemství.
- **Google Fonts** (Inter) načtené z CDN.

## Poznámka k `design-previews/`

Soubory v této složce (`animace.html`, `ikony.html`, `styleguide.html`, …)
jsou exporty jednotlivých komponent z Figma návrhu, používané při vývoji pro
izolované prohlížení a ladění. Nejsou nikde odkazované z `index.html` a
nejsou potřeba pro provoz webu, ponechány pro referenci.
