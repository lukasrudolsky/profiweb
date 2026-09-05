# docs

Materiály pro [README.md](../README.md) v kořeni repozitáře. Nic z této složky
se nenačítá na živém webu.

| Soubor | Co to je |
| :-- | :-- |
| [logo-3d.svg](logo-3d.svg) | Animované 3D logo v hlavičce README, klidné kolébání |
| [logo-3d-spin.svg](logo-3d-spin.svg) | Živější otáčení, v README se pouští klikem |
| [logo-3d.js](logo-3d.js) | Generátor obou SVG, spouští se ručně |
| [screenshots/](screenshots/) | Snímky obrazovky webu, viz [README](screenshots/README.md) uvnitř |

## Animované logo

Animace je psaná v CSS uvnitř SVG, takže se přehrává i v README na GitHubu:
obrázky se tam vkládají jako `<img>`, kde se JavaScript nespustí, ale CSS
animace ano.

Trojrozměrnost není nakreslená ručně. Tvar loga je vytlačený do hloubky jako
stoh dvaceti kopií na různých `z` a každá se promítá ortograficky. Bod
`(x, y, z)` otočený kolem svislé osy o θ a pak kolem vodorovné o φ padne na
obrazovku takto:

```
X = x·cos θ                 + z·sin θ
Y = x·sin θ·sin φ + y·cos φ - z·cos θ·sin φ
```

Což je afinní zobrazení `(x, y)` plus posun závislý jen na `z`, tedy přesně
jedna `matrix()` na vrstvu. Hloubka vrstvy po otočení je úměrná
`z·cos θ·cos φ`, takže dokud oba úhly drží pod 90°, roste s pořadím vrstev a
stačí kreslit odzadu dopředu. Přes 90° by se pořadí obrátilo a značka by se
navíc ukazovala zrcadlově, proto se rozkmit v obou režimech drží pod.

### Na pohyb myši logo reagovat neumí

V README to nejde ani trikem: `<img>` k sobě pointer události nepustí, takže
dovnitř SVG se nedostane ani JavaScript, ani CSS `:hover`. Jediná interakce,
kterou GitHub v README nabízí, je rozbalení `<details>`, a přesně na tom stojí
tlačítko "Roztočit logo": kliknutí odkryje `logo-3d-spin.svg` s výraznějším
otáčením.

Logo reagující na kurzor by šlo udělat na samotném webu, kde běží JavaScript.

### Přegenerování

SVG jsou vygenerovaná, needitujte je ručně. Změny patří do
[logo-3d.js](logo-3d.js), kde jsou dole konstanty obou režimů (základní
náklon, rozkmit, frekvence naklánění, délka cyklu, pohupování):

```bash
node docs/logo-3d.js
```

Klidná verze respektuje `prefers-reduced-motion` a se zastavenými animacemi
zůstane stát v nakloněné pozici, takže dojem hloubky přetrvá i bez pohybu.
Klikací verze se nezastavuje záměrně: animaci si tam uživatel pustil sám, a to
je právě případ, kdy je pohyb v pořádku.

Statické logo webu zůstává beze změny v
[assets/images/profiweb-logo.svg](../assets/images/profiweb-logo.svg), tohle
jsou jen varianty pro README.
