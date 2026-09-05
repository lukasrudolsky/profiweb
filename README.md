<div align="center">

<img src="assets/images/profiweb-logo.svg" alt="Profiweb logo" width="72">

# Profiweb.cz

**Statický marketingový web pro Profiweb, službu tvorby webů na míru.**
Čisté HTML/CSS/JS, žádný framework, žádný build krok.

<img alt="HTML5" src="https://img.shields.io/badge/HTML5-000?style=flat-square&logo=html5&logoColor=E34F26">
<img alt="CSS3" src="https://img.shields.io/badge/CSS3-000?style=flat-square&logo=css3&logoColor=1572B6">
<img alt="JavaScript" src="https://img.shields.io/badge/Vanilla%20JS-000?style=flat-square&logo=javascript&logoColor=F7DF1E">
<img alt="Bez buildu" src="https://img.shields.io/badge/build-žádný-3793d1?style=flat-square">
<img alt="Závislosti" src="https://img.shields.io/badge/závislosti-0-3793d1?style=flat-square">

<br>
<br>

<img src="docs/screenshots/hero.webp" alt="Hero sekce webu Profiweb" width="900">

</div>

---

## Obsah

- [Přehled](#přehled)
- [Náhledy](#náhledy)
- [Jak spustit lokálně](#jak-spustit-lokálně)
- [Struktura projektu](#struktura-projektu)
- [Technologie](#technologie)
- [Konfigurace integrací](#konfigurace-integrací)
- [Design systém](#design-systém)
- [Nasazení](#nasazení)
- [Poznámky k vývoji](#poznámky-k-vývoji)

---

## Přehled

Jednostránkový web (`index.html`) postavený podle Figma návrhu. Cílem stránky
je získávat poptávky: návštěvník si rovnou v modálu rezervuje úvodní hovor
nebo si nechá zdarma změřit svůj web.

| | |
| --- | --- |
| **Účel** | Marketingová landing page s rezervací hovoru a auditem webu |
| **Stack** | Vanilla HTML + CSS + JS, BEM konvence, bez preprocesoru |
| **Build** | Žádný. Soubory se nasazují přesně tak, jak leží v repozitáři |
| **Návrh** | Figma (frame 1440 px), fluidní `clamp()` škálování bez skoků |
| **Integrace** | cal.com (rezervace) a Google PageSpeed Insights (audit) |
| **Jazyk** | Čeština (`lang="cs"`) |

---

## Náhledy

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/screenshots/mega-menu.webp" alt="Rozbalené mega menu v hlavičce" width="100%">
      <p align="center"><b>Mega menu</b><br><sub>Rozbalovací panely v hlavičce. Pod 900 px se mění na accordion v drawer navigaci.</sub></p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/screenshots/booking.webp" alt="Rezervační modal s kalendářem" width="100%">
      <p align="center"><b>Rezervace hovoru</b><br><sub>Dvoukrokový formulář, výběr termínu a času z cal.com, potvrzení do e-mailu.</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/screenshots/audit.webp" alt="Modal auditu webu" width="100%">
      <p align="center"><b>Audit webu zdarma</b><br><sub>Reálné měření přes Google Lighthouse: rychlost, Core Web Vitals, SEO, přístupnost.</sub></p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/screenshots/mobile.webp" alt="Web na mobilní šířce" width="100%">
      <p align="center"><b>Mobilní zobrazení</b><br><sub>Hero přeskládaný pod sebe, navigace schovaná v drawer menu.</sub></p>
    </td>
  </tr>
</table>

---

## Jak spustit lokálně

Web nepotřebuje build krok ani závislosti, stačí ho servírovat jako statické
soubory:

```bash
# libovolný statický server, například:
npx serve .
```

Pak otevřete `http://localhost:<port>/index.html`.

> [!TIP]
> Ve VS Code funguje i rozšíření **Live Server** spuštěné nad `index.html`.
> Otevření přes `file://` většinu stránky vykreslí, ale volání externích API
> (cal.com, PageSpeed) prohlížeč z `file://` původu zablokuje.

---

## Struktura projektu

```
.
├── index.html                  Živá stránka webu (jediná stránka)
├── assets/
│   ├── css/
│   │   └── styles.css          Všechny styly, tokeny v :root
│   ├── js/
│   │   ├── site.js             Navigace, mega menu, hero animace
│   │   ├── booking.js          Rezervační modal (cal.com API)
│   │   ├── audit.js            Audit webu (PageSpeed Insights API)
│   │   └── country-codes.js    Data telefonních předvoleb
│   ├── images/                 Optimalizované obrázky a ikony
│   │   └── source/             Zdrojové verze před optimalizací
│   └── fonts/                  Prázdné, fonty se zatím berou z Google Fonts
├── design-previews/            Náhledy komponent z Figmy (mimo živý web)
└── docs/screenshots/           Obrázky použité v tomto README
```

Každá složka má vlastní `README.md` s podrobnostmi o svém obsahu.

---

## Technologie

| Technologie | K čemu slouží |
| --- | --- |
| **Vanilla HTML/CSS/JS** | Celý web. Žádný framework, bundler ani preprocesor. |
| **BEM** | Konvence pro CSS třídy (`block__element--modifier`). |
| **[cal.com](https://cal.com)** | Veřejné API pro výběr termínu a odeslání rezervace, napojené na Google Calendar. |
| **Google PageSpeed Insights** | Lighthouse měření pro sekci "Audit webu zdarma". |
| **Google Fonts (Inter)** | Písmo webu, načítané z CDN. |

JS je psaný jako samostatné IIFE moduly ve `strict` režimu, bez sdíleného
globálního stavu. Každý soubor má v hlavičce komentář vysvětlující, co dělá
a proč je řešený tak, jak je.

---

## Konfigurace integrací

<details>
<summary><b>cal.com: rezervace úvodního hovoru</b></summary>

<br>

Nastavení je na začátku [assets/js/booking.js](assets/js/booking.js):

```js
var CAL = {
  username:      'lukas.rudolsky',   // cal.com/<username>/<slug>
  eventTypeSlug: '15min',
  timeZone:      'Europe/Prague'
};
```

Postup nastavení:

1. Na cal.com propojit **Apps → Google Calendar** (odtud se čtou obsazené
   termíny a zapisují nové události).
2. Vytvořit event type pro úvodní hovor a poznamenat si jeho slug.
3. Username a slug doplnit do `CAL` výše.

Použité endpointy nepotřebují žádný klíč, což je pro statický web podstatné:
cokoli v tomto souboru je čitelné pro každého návštěvníka. Když je `CAL`
prázdné, kalendář se přepne na lokální demo generátor, aby stránka fungovala
i bez napojení.

</details>

<details>
<summary><b>Google PageSpeed Insights: audit webu</b></summary>

<br>

Audit ([assets/js/audit.js](assets/js/audit.js)) vyžaduje API klíč vložený do
`index.html`:

```html
<meta name="psi-api-key" content="AIza…">
```

Klíč je zdarma (25 000 volání denně) na `console.cloud.google.com`:
**APIs & Services → Library → PageSpeed Insights API → Enable → Credentials →
Create API key**.

> [!IMPORTANT]
> Klíč omezte přes **HTTP referrer** na svoji doménu. Je veřejně viditelný
> ve zdroji stránky a právě referrer restrikce je to, co brání jeho zneužití.
> Bez klíče sdílejí požadavky společnou kvótu Google projektu, která bývá
> prakticky pořád vyčerpaná, a audit skončí chybou HTTP 429.

</details>

<details>
<summary><b>Stav: audit zatím nemá spouštěč na stránce</b></summary>

<br>

Modal auditu je v `index.html` hotový a `audit.js` ho umí otevřít kliknutím na
prvek s atributem `data-audit-open`, ale takový prvek na stránce zatím není.
Až bude sekce "Audit webu zdarma" na webu odkazovaná, stačí ho přidat:

```html
<button type="button" data-audit-open>Audit webu zdarma</button>
```

</details>

---

## Design systém

Všechny barvy, poloměry, stíny a délky přechodů jsou tokeny v `:root` na
začátku [assets/css/styles.css](assets/css/styles.css). Pravidla pod nimi
tokeny jen spotřebovávají, natvrdo psaný hex do nich nepatří. Názvy jsou
sémantické (k čemu barva slouží), ne popisné, takže rebranding je změna
jediného bloku.

<div align="center">

<img src="docs/screenshots/styleguide.webp" alt="Style guide s barevnými tokeny" width="820">

<sub>Živý přehled tokenů: <a href="design-previews/styleguide.html"><code>design-previews/styleguide.html</code></a></sub>

</div>

Vybrané tokeny značky:

| Token | Hodnota | Použití |
| --- | --- | --- |
| `--blue` | `#3793d1` | Primární barva značky, tlačítka, odkazy |
| `--blue-hover` | `#2f83bd` | Primární tlačítko při hoveru |
| `--blue-tint` | `#e8f2fa` | Vybraný den v kalendáři, odrážky |
| `--green` | `#00ce28` | Indikátor dostupnosti |
| `--ink` | `#000000` | Nadpisy |
| `--text-body` | `#66676c` | Běžný text |

**Responzivní model:** typografie, mezery i marquee s laptopy škálují přes
`clamp()` tak, aby na šířce 1200 px seděly přesně na hodnoty z Figmy.
Nad 1200 px je render pixelově shodný s návrhem, pod ním se plynule zmenšuje.
Breakpointy jsou vyhrazené jen pro skutečné změny layoutu (navigace do
draweru, hero art pod text, přeskládání karet).

---

## Nasazení

Repozitář je připravený na jakýkoli statický hosting, nasazuje se obsah
kořenové složky tak, jak je:

| Hosting | Postup |
| --- | --- |
| **GitHub Pages** | Settings → Pages → Deploy from branch → `main` / `/ (root)` |
| **Netlify** | Nový web z repozitáře, build command prázdný, publish directory `.` |
| **Vercel** | Import repozitáře, framework preset *Other*, bez build kroku |
| **Vlastní server** | Nahrát obsah repozitáře do webrootu (FTP, rsync, cokoli) |

Po nasazení nezapomeňte na doménu omezit PageSpeed API klíč (viz výše).

---

## Poznámky k vývoji

- **`design-previews/`** obsahuje samostatné HTML náhledy komponent z Figma
  návrhu (`animace.html`, `ikony.html`, `tlacitko.html`, `styleguide.html`
  a další). Nejsou odkazované z `index.html` a nejsou potřeba pro provoz
  webu, slouží k izolovanému ladění komponent. Sdílejí `styles.css`
  a `site.js`, takže zůstávají vizuálně konzistentní s webem.
- **`assets/images/source/`** drží needitované zdroje obrázků před kompresí.
  Na webu se nenačítají, jsou tam pro budoucí re-export.
- **`assets/fonts/`** je záměrně prázdná, připravená pro lokální hostování
  fontů (například kvůli GDPR nebo výkonu) místo Google Fonts CDN.
- Sekce **"Poznáváte se v tom?"** má zatím zástupný obsah (tři shodné karty),
  čeká na finální texty.
