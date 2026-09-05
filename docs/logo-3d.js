/* Generátor animovaného 3D loga pro README.
   Spuštění: node docs/logo-3d.js

   Vyrobí dva soubory:
     logo-3d.svg        klidné kolébání v hlavičce README
     logo-3d-spin.svg   živější otáčení, které se v README pouští klikem

   ----------------------------------------------------------------------
   Jak vzniká ta hloubka

   Tvar loga je vytlačený do hloubky jako stoh N kopií na různých z. Bod
   (x, y, z) otočený kolem svislé osy o θ a pak kolem vodorovné o φ padne
   na obrazovku takto:

     X = x·cos θ                 + z·sin θ
     Y = x·sin θ·sin φ + y·cos φ - z·cos θ·sin φ

   To je afinní zobrazení (x, y) plus posun závislý jen na z, tedy přesně
   jedna CSS matrix() na vrstvu:

     matrix(cos θ, sin θ·sin φ, 0, cos φ, z·sin θ, -z·cos θ·sin φ)

   Hloubka vrstvy po otočení je úměrná z·cos θ·cos φ. Dokud oba úhly drží
   pod 90°, roste s pořadím vrstev, takže stačí kreslit odzadu dopředu a
   malířův algoritmus sedí. Přes 90° by se pořadí obrátilo a značka by se
   navíc ukazovala zrcadlově, proto se úhly v obou režimech drží pod.

   ----------------------------------------------------------------------
   Proč to běží i na GitHubu

   Animace je v CSS uvnitř SVG. README obrázek vkládá jako <img>, kde se
   JavaScript nespustí, ale CSS animace ano. Ze stejného důvodu logo neumí
   reagovat na pohyb myši: pointer události se k obsahu <img> nedostanou.
*/
const fs = require('fs');
const path = require('path');

const W = 36.5441, H = 33;
const CX = W / 2, CY = H / 2;

const DEPTH  = 9;     // tloušťka vytlačení v jednotkách viewBoxu
const LAYERS = 20;    // počet kopií tvořících bok
const STOPS  = 33;    // vzorků na cyklus, víc = plynulejší mezisnímky

/* Barva boku tmavne do hloubky, přední stěna je plná modrá značky. */
const FACE = [0x37, 0x93, 0xd1];
const DEEP = [0x0f, 0x3f, 0x63];

const rad = d => d * Math.PI / 180;
const r3  = n => Number(n.toFixed(3));
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

/* Vrstvy odzadu dopředu. */
const zs = [];
for (let i = 0; i < LAYERS; i++) zs.push(-DEPTH / 2 + (DEPTH * i) / (LAYERS - 1));

const PATHS = `
      <path d="M0 14.5223C1.11818 14.4794 6.32592 14.4304 7.81246 14.5713C8.07856 14.5964 8.52747 15.2847 8.68315 15.5363C10.5188 18.5029 12.6392 21.4147 14.4206 24.4085C15.3537 22.9654 17.6972 18.9311 18.8746 18.0661C19.7788 17.4018 21.2512 17.5 22.3003 17.6495C22.872 18.2109 24.0444 20.0088 24.5382 20.7534C25.3125 21.9212 26.2691 23.2414 26.9902 24.4255C27.5647 23.5396 28.1346 22.6506 28.6999 21.7588C30.067 19.5872 30.1341 19.1207 32.9402 19.2526C33.698 19.2882 34.7354 19.2563 35.5092 19.2496C34.1278 21.2971 32.7633 23.5126 31.4126 25.5984C30.7285 26.6814 27.3584 32.2673 26.6308 32.6866C26.0793 33.0044 25.2096 33.0833 24.6018 32.9105C24.3832 32.8483 24.1898 32.7515 24.0359 32.5815C23.1678 31.6228 22.198 29.884 21.4527 28.7474C20.5132 27.3147 19.435 25.8802 18.6172 24.3809C18.4764 24.6423 18.2792 24.9179 18.1097 25.1664C16.5364 27.4752 15.0566 29.8533 13.476 32.1556C13.3071 32.4016 12.7927 32.9133 12.5085 32.9743C12.0038 33.0825 11.3808 32.6844 11.1274 32.2925C10.3833 31.1411 9.66248 29.9842 8.93363 28.8302L4.13035 21.1617L1.36113 16.7562C1.06009 16.2771 0.206372 14.9847 0 14.5223Z"/>
      <path d="M8.79802 0C9.24659 0.0781104 11.979 0.0419392 12.5814 0.0418035L21.0958 0.0384112C22.9631 0.0377325 25.513 -0.060602 27.2758 0.27756C28.6513 0.543176 29.9636 1.0681 31.1429 1.82423C33.7066 3.43387 35.5325 5.98919 36.2247 8.93608C36.8584 11.7434 36.5919 14.8919 35.0384 17.3596L28.7457 17.3579C27.7751 17.3468 26.8044 17.3531 25.8341 17.3767C27.2048 15.8862 29.0629 13.9305 29.0496 11.7922C29.0425 10.6467 28.5542 9.70883 27.7682 8.91232C26.432 7.55825 24.4258 7.77406 22.6842 7.77569L18.4372 7.78193L3.97329 7.78648C5.6358 5.44099 7.13971 2.31332 8.79802 0Z"/>`;

function build(cfg) {
  const yaw   = t => rad(cfg.yaw0   + cfg.yawAmp   * Math.sin(2 * Math.PI * (t + cfg.yawPhase)));
  const pitch = t => rad(cfg.pitch0 + cfg.pitchAmp * Math.sin(2 * Math.PI * cfg.pitchFreq * (t + cfg.pitchPhase)));

  /* Jedna vrstva v jednom okamžiku: promítnutí (x, y, z) na plochu. */
  const pose = (z, t) => {
    const th = yaw(t), ph = pitch(t);
    const a = Math.cos(th);
    const b = Math.sin(th) * Math.sin(ph);
    const d = Math.cos(ph);
    const e = z * Math.sin(th);
    const f = -z * Math.cos(th) * Math.sin(ph);
    return `matrix(${r3(a)},${r3(b)},0,${r3(d)},${r3(e)},${r3(f)})`;
  };

  let css = '', uses = '';

  zs.forEach((z, i) => {
    const k = 1 - i / (LAYERS - 1);                 // 1 vzadu, 0 vepředu
    const fill = i === LAYERS - 1 ? hex(FACE) : hex(mix(FACE, DEEP, 0.25 + 0.75 * k));
    uses += `<use class="l${i}" href="#mark" fill="${fill}"/>`;

    /* Základní póza je zapsaná i mimo animaci, aby logo se zastavenými
       animacemi zůstalo nakloněné, ne placaté. */
    css += `.l${i}{transform:${pose(z, 0)};animation:k${i} ${cfg.dur}s linear infinite}`;

    let frames = '';
    for (let s = 0; s <= STOPS; s++) {
      const t = s / STOPS;
      frames += `${r3(t * 100)}%{transform:${pose(z, t)}}`;
    }
    css += `@keyframes k${i}{${frames}}`;
  });

  /* Pohupování a stín jdou proti sobě: nahoře je stín menší a slabší. */
  let floatFrames = '', shadowFrames = '';
  for (let s = 0; s <= STOPS; s++) {
    const t = s / STOPS;
    const f = Math.sin(2 * Math.PI * t);
    floatFrames  += `${r3(t * 100)}%{transform:translateY(${r3(-cfg.float * f)}px)}`;
    shadowFrames += `${r3(t * 100)}%{transform:scale(${r3(1 - 0.09 * f)},${r3(1 - 0.16 * f)});opacity:${r3(0.5 - 0.1 * f)}}`;
  }

  /* Klidná varianta respektuje prefers-reduced-motion. Ta klikací ne:
     animaci si tam uživatel pustil sám, a to je přesně případ, kdy je
     pohyb v pořádku. */
  const reduce = cfg.respectReducedMotion
    ? `@media (prefers-reduced-motion:reduce){.float,.shade,.stage use{animation:none}}`
    : '';

  const style = `
    .stage use{transform-box:view-box;transform-origin:${r3(CX)}px ${r3(CY)}px}
    .float{animation:float ${cfg.dur}s linear infinite}
    .shade{transform-box:view-box;transform-origin:${r3(CX)}px 41px;opacity:.5;animation:shade ${cfg.dur}s linear infinite}
    @keyframes float{${floatFrames}}
    @keyframes shade{${shadowFrames}}
    ${css}
    ${reduce}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -12 66.5 59" width="266" height="236" role="img" aria-label="${cfg.label}">
  <title>${cfg.label}</title>
  <defs>
    <g id="mark">${PATHS}
    </g>
    <radialGradient id="shadow">
      <stop offset="0" stop-color="#1b4c6e" stop-opacity=".45"/>
      <stop offset="1" stop-color="#1b4c6e" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2=".75" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".38"/>
      <stop offset=".45" stop-color="#fff" stop-opacity=".06"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <style>${style}
  </style>
  <ellipse class="shade" cx="${r3(CX)}" cy="41" rx="17" ry="3.2" fill="url(#shadow)"/>
  <g class="float">
    <g class="stage">${uses}<use class="l${LAYERS - 1}" href="#mark" fill="url(#gloss)"/></g>
  </g>
</svg>
`;
}

/* Klidná verze do hlavičky: mírné kolébání kolem stálého náklonu, aby
   logo pořád vypadalo prostorově a nerušilo čtení. */
const calm = build({
  label: 'Profiweb',
  yaw0: 24, yawAmp: 12, yawPhase: 0,
  pitch0: 0, pitchAmp: 8, pitchFreq: 1, pitchPhase: 0.25,
  dur: 7, float: 0.9,
  respectReducedMotion: true
});

/* Klikací verze: širší rozkmit přes nulu, takže se bok přehoupne z jedné
   strany na druhou, a dvojnásobná frekvence naklánění dopředu a dozadu. */
const spin = build({
  label: 'Profiweb, roztočené logo',
  yaw0: 0, yawAmp: 42, yawPhase: 0,
  pitch0: 0, pitchAmp: 11, pitchFreq: 2, pitchPhase: 0.17,
  dur: 5, float: 1.2,
  respectReducedMotion: false
});

const dir = __dirname;
fs.writeFileSync(path.join(dir, 'logo-3d.svg'), calm);
fs.writeFileSync(path.join(dir, 'logo-3d-spin.svg'), spin);
console.log('napsáno: logo-3d.svg', (calm.length / 1024).toFixed(1) + ' KB,',
            'logo-3d-spin.svg', (spin.length / 1024).toFixed(1) + ' KB');
