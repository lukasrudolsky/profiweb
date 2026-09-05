# design-previews

Samostatné HTML náhledy jednotlivých komponent exportované z Figma návrhu
(ikony, animace, tlačítka, rámečky, style guide). Slouží pro izolované
prohlížení a ladění komponent při vývoji, nejsou nikde odkazované z
`index.html` a nejsou potřeba pro provoz živého webu.

Otevírají se přímo v prohlížeči, bez serveru; odkazují na sdílené
`../assets/css/styles.css` a `../assets/js/site.js`, takže zůstávají vizuálně
konzistentní s živým webem.
