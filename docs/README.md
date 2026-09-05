# docs

Materiály pro [README.md](../README.md) v kořeni repozitáře. Nic z této složky
se nenačítá na živém webu.

| Soubor | Co to je |
| :-- | :-- |
| [logo-3d.svg](logo-3d.svg) | Animované 3D logo v hlavičce README |
| [logo-3d.js](logo-3d.js) | Generátor toho SVG, spouští se ručně |
| [screenshots/](screenshots/) | Snímky obrazovky webu, viz [README](screenshots/README.md) uvnitř |

## Animované logo

`logo-3d.svg` se přehrává i v README na GitHubu, protože animace je psaná
v CSS uvnitř SVG. GitHub obrázky vkládá jako `<img>`, kde se JavaScript
nespustí, ale CSS animace ano.

Trojrozměrnost není nakreslená ručně: tvar loga je vytlačený do hloubky jako
stoh třiceti kopií na různých `z` a každá se promítá ortograficky, takže
otáčení kolem svislé osy je `translateX(z·sin θ)` plus `scaleX(cos θ)` kolem
středu. Náklon se drží v rozsahu 12° až 36°, aby logo nikdy neprošlo přes
90°: tam by se obrátilo pořadí vrstev a značka by se navíc půlku času
ukazovala zrcadlově.

Soubor je vygenerovaný, needitujte ho ručně. Změny patří do `logo-3d.js`
(nahoře jsou konstanty pro náklon, hloubku, počet vrstev a délku cyklu):

```bash
node docs/logo-3d.js
```

Při zapnutém `prefers-reduced-motion` se animace vypne a logo zůstane stát
v nakloněné pozici, takže dojem hloubky zůstane i bez pohybu.

Statické logo webu zůstává beze změny v
[assets/images/profiweb-logo.svg](../assets/images/profiweb-logo.svg), tohle
je jen varianta pro README.
