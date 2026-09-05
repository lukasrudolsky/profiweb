# assets/js

Skripty živého webu, vanilla JS bez závislostí (`'use strict'` IIFE moduly):

- `site.js`: navigace, mega menu, hero animace (laptopy, blobs), obecné UI chování.
- `booking.js`: rezervační modal napojený na veřejné cal.com API. Nastavení
  účtu/event typu viz komentář v hlavičce souboru.
- `audit.js`: sekce "Audit webu zdarma" napojená na Google PageSpeed Insights
  API. Vyžaduje API klíč v `<meta name="psi-api-key">` v `index.html`, viz
  hlavička souboru pro návod na jeho získání.
- `country-codes.js`: statická data předvoleb zemí pro telefonní pole v
  rezervačním formuláři.
