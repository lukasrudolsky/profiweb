/* =====================================================================
   Site chrome - the header nav drawer used below 900px.
   The drawer is CSS-driven; this only flips the state and keeps the
   trigger's ARIA in sync.
   ===================================================================== */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  var toggle = document.getElementById('nav-toggle');
  var nav    = document.getElementById('site-nav');
  if (!header || !toggle || !nav) return;

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    header.classList.toggle('is-nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Zavřít menu' : 'Otevřít menu');
  }
  function isOpen() { return toggle.getAttribute('aria-expanded') === 'true'; }

  toggle.addEventListener('click', function () { setOpen(!isOpen()); });

  /* Any destination inside the drawer closes it. */
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('click', function (e) {
    if (!isOpen()) return;
    if (!e.target.closest('.site-header')) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) { setOpen(false); toggle.focus(); }
  });

  /* Leaving the drawer breakpoint must not strand the open state. */
  var wide = window.matchMedia('(min-width: 901px)');
  var onChange = function (e) { if (e.matches) setOpen(false); };
  if (wide.addEventListener) wide.addEventListener('change', onChange);
  else wide.addListener(onChange);
})();

/* =====================================================================
   Mega menu - the panels that drop out of Služby / Řešení / Proč my.
   Above 900px s myší se panel vytáhne přejetím po té které položce, klik ho
   sklapne; jinde (dotyk, klávesnice, úzké okno) toggluje klik sám. Vždycky
   je venku nejvýš jeden. Nad 900px je panel overlay pod lištou, pod tím se
   sype inline jako accordion v šuplíku - stavový automat je stejný.
   ===================================================================== */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  if (!header) return;

  var triggers = [].slice.call(header.querySelectorAll('.nav-item__trigger'));
  if (!triggers.length) return;

  function panelFor(trigger) {
    return document.getElementById(trigger.getAttribute('aria-controls'));
  }

  function setOpen(trigger, open) {
    var panel = panelFor(trigger);
    if (!panel) return;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.classList.toggle('is-open', open);
    header.classList.toggle('has-mega-open', open);
  }

  function currentOpen() {
    return triggers.filter(function (t) {
      return t.getAttribute('aria-expanded') === 'true';
    })[0] || null;
  }

  function closeAll(except) {
    var anyOpen = false;
    triggers.forEach(function (t) {
      if (t === except) return;
      if (t.getAttribute('aria-expanded') === 'true') setOpen(t, false);
    });
    if (except && except.getAttribute('aria-expanded') === 'true') anyOpen = true;
    header.classList.toggle('has-mega-open', anyOpen);
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      var willOpen = trigger.getAttribute('aria-expanded') !== 'true';
      closeAll(trigger);
      setOpen(trigger, willOpen);
    });

    /* Any destination inside a panel dismisses it. */
    var panel = panelFor(trigger);
    if (panel) {
      panel.addEventListener('click', function (e) {
        if (e.target.closest('a')) setOpen(trigger, false);
      });
    }
  });

  /* Na širokém displeji stačí najet: panel vytáhne ta položka, pod kterou
     je myš, a nic jiného. Klik zůstává - je to pořád jediná cesta pro dotyk
     a pro klávesnici, a otevřený panel jím jde zase sklapnout.

     Panel je v DOM potomek svého .nav-item, takže cesta z tlačítka dolů do
     panelu žádné mouseleave nevyvolá a menu pod myší nezmizí. Otevírá se s
     malým zpožděním, aby přejezd lištou k tlačítku "Začít projekt" cestou
     nevytahoval panely, které nikdo nechtěl; zavírá s delším, aby drobné
     vyjetí mimo hned nesklaplo, co si člověk zrovna prohlíží. Když už je
     nějaký panel venku, přepíná se mezi položkami rovnou - čekat podruhé
     by jen blikalo. */
  var hoverable = window.matchMedia(
    '(hover: hover) and (pointer: fine) and (min-width: 901px)');
  var openTimer = null, closeTimer = null;

  function clearTimers() {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    openTimer = closeTimer = null;
  }
  function openOnly(trigger) {
    closeAll(trigger);
    setOpen(trigger, true);
  }

  triggers.forEach(function (trigger) {
    var item = trigger.closest('.nav-item');
    if (!item) return;

    item.addEventListener('mouseenter', function () {
      if (!hoverable.matches) return;
      clearTimers();
      if (trigger.getAttribute('aria-expanded') === 'true') return;
      if (currentOpen()) { openOnly(trigger); return; }
      openTimer = setTimeout(function () { openOnly(trigger); }, 110);
    });

    item.addEventListener('mouseleave', function () {
      if (!hoverable.matches) return;
      clearTimers();
      closeTimer = setTimeout(function () { closeAll(null); }, 160);
    });
  });

  /* Zúžení okna do šuplíku nesmí nechat viset rozjeté odpočítávání. */
  var onHoverChange = function () { clearTimers(); };
  if (hoverable.addEventListener) hoverable.addEventListener('change', onHoverChange);
  else hoverable.addListener(onHoverChange);

  /* Clicking anywhere outside the header closes whatever is open. */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.site-header')) closeAll(null);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = currentOpen();
    if (open) { setOpen(open, false); open.focus(); }
  });

  /* Tabbing out of the header should not leave a panel hanging open. */
  document.addEventListener('focusin', function (e) {
    if (!e.target.closest('.site-header')) closeAll(null);
  });

  /* Collapsing the drawer must not leave a panel expanded inside it. */
  var drawerToggle = document.getElementById('nav-toggle');
  if (drawerToggle) {
    drawerToggle.addEventListener('click', function () { closeAll(null); });
  }

  /* Crossing the drawer breakpoint resets everything to a known state. */
  var wide = window.matchMedia('(min-width: 901px)');
  var onChange = function () { closeAll(null); };
  if (wide.addEventListener) wide.addEventListener('change', onChange);
  else wide.addListener(onChange);
})();

/* =====================================================================
   Mega menu - podklad, který přejíždí mezi položkami.

   Bez skriptu se pod kurzorem podbarvuje každá položka zvlášť, takže při
   přejetí jedna zhasne a druhá se rozsvítí. Tady místo toho vznikne jeden
   podklad na sloupec, který se mezi položkami posouvá, takže přejezd je
   plynulý. Sloupci se přidá třída has-hl a ta zároveň vypne podbarvování
   jednotlivých položek, aby se nekreslily dva podklady přes sebe. Když
   skript neproběhne, zůstane původní chování.
   ===================================================================== */
(function () {
  'use strict';

  var cols = [].slice.call(document.querySelectorAll('.mega__col'));
  if (!cols.length) return;

  cols.forEach(function (col) {
    var links = [].slice.call(col.querySelectorAll('.mega__link'));
    if (links.length < 2) return;   /* sloupec s ukázkou nemá co přejíždět */

    var hl = document.createElement('span');
    hl.className = 'mega__hl';
    hl.setAttribute('aria-hidden', 'true');
    col.insertBefore(hl, col.firstChild);
    col.classList.add('has-hl');

    function place(link, animate) {
      /* Při prvním najetí se podklad jen objeví na místě. Bez toho by
         přiletěl od horního okraje sloupce, kde stojí ve výchozí pozici. */
      if (!animate) hl.style.transition = 'none';
      hl.style.transform = 'translateY(' + link.offsetTop + 'px)';
      hl.style.height = link.offsetHeight + 'px';
      if (!animate) {
        void hl.offsetWidth;        /* reflow, další přejezd se má animovat */
        hl.style.transition = '';
      }
    }

    links.forEach(function (link) {
      link.addEventListener('mouseenter', function () {
        place(link, hl.classList.contains('is-on'));
        hl.classList.add('is-on');
      });
    });

    /* Opuštění sloupce podklad zhasne; jinak by zůstal viset pod poslední
       položkou, na které kurzor byl. */
    col.addEventListener('mouseleave', function () { hl.classList.remove('is-on'); });
  });
}());

/* =====================================================================
   Button label swap - on hover each character rolls up while a duplicate
   rolls in from below, staggered across the word. Progressive enhancement:
   the markup ships as a plain text node and is only rebuilt here, so a
   failure or reduced-motion preference leaves an ordinary button.
   ===================================================================== */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var NBSP = ' ';

  function build(btn) {
    /* A button with a badge keeps its label in .btn__label, so rebuild that
       instead of the button, otherwise the icon would count as extra content
       and the swap would quietly skip the button altogether. Everything else
       still has to be a single plain text node; anything richer is left alone. */
    var host = btn.querySelector('.btn__label') || btn;
    if (host.childNodes.length !== 1 || host.firstChild.nodeType !== 3) return;

    var label = host.textContent.trim();
    if (!label) return;

    var swap = document.createElement('span');
    swap.className = 'btn__swap';
    swap.setAttribute('aria-hidden', 'true');

    /* Stagger runs over visible glyphs so a space does not eat a beat. */
    var step = 0;
    for (var i = 0; i < label.length; i++) {
      var ch = label[i];
      var isSpace = ch === ' ';

      var cell = document.createElement('span');
      cell.className = 'btn__char';
      cell.style.setProperty('--i', isSpace ? step : step++);

      var a = document.createElement('span');
      var b = document.createElement('span');
      a.textContent = b.textContent = isSpace ? NBSP : ch;
      cell.appendChild(a);
      cell.appendChild(b);
      swap.appendChild(cell);
    }

    var name = document.createElement('span');
    name.className = 'sr-only';
    name.textContent = label;

    host.textContent = '';
    host.appendChild(swap);
    host.appendChild(name);
  }

  [].forEach.call(document.querySelectorAll('.btn'), build);
})();

/* =====================================================================
   Mockup cursor - hovering a laptop screen in the hero swaps the native
   cursor for a "Zobrazit projekt" pill that tracks the pointer. Fine
   pointers only; on touch there is no hover state to speak of and the pill
   would stick after a tap.
   ===================================================================== */
(function () {
  'use strict';

  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine.matches) return;

  var screens = document.querySelectorAll('.laptop__bezel');
  if (!screens.length) return;

  var cursor = document.createElement('div');
  cursor.className = 'mock-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  /* Očko v pilulce. Kreslí se plochami, ne linkou: při mrknutí se celá
     <g> zmáčkne po ose Y a tah by se u obrysu deformoval, zatímco výplň
     se poctivě scvrkne na proužek. Duhovka je podříznutá tvarem oka
     (clipPath), takže může uhýbat do stran a nikdy nevyleze přes okraj. */
  cursor.innerHTML =
    '<span class="mock-cursor__pill">' +
      '<svg class="mock-cursor__eye" viewBox="0 0 24 16">' +
        '<defs>' +
          '<clipPath id="mockEyeClip">' +
            '<path d="M0.9 8S5.1 1.1 12 1.1 23.1 8 23.1 8 19 14.9 12 14.9 0.9 8 0.9 8Z"/>' +
          '</clipPath>' +
        '</defs>' +
        '<g class="mock-cursor__lid">' +
          '<path class="mock-cursor__white"' +
            ' d="M0.9 8S5.1 1.1 12 1.1 23.1 8 23.1 8 19 14.9 12 14.9 0.9 8 0.9 8Z"/>' +
          '<g clip-path="url(#mockEyeClip)">' +
            '<g class="mock-cursor__iris">' +
              '<circle class="mock-cursor__ring" cx="12" cy="8" r="3.9"/>' +
              '<circle class="mock-cursor__pupil-dot" cx="12" cy="8" r="1.85"/>' +
              '<circle class="mock-cursor__spark" cx="10.7" cy="6.6" r="0.95"/>' +
            '</g>' +
          '</g>' +
        '</g>' +
      '</svg>' +
      '<span>Zobrazit projekt</span>' +
    '</span>';
  document.body.appendChild(cursor);

  var x = 0, y = 0, queued = false, shown = false, pressed = false;

  /* Pohled zorničky. Cíl (tx, ty) drží směr posledního pohybu myši,
     (px, py) je vyhlazená poloha, která jde do transformu - jednotky jsou
     souřadnice viewBoxu, ne pixely. Doleva a doprava se kouká dál než
     nahoru a dolů: očko je na výšku placaté a zornička by jinak vylezla
     přes víčko. */
  var pupil = cursor.querySelector('.mock-cursor__iris');
  var GAZE_X = 3.1, GAZE_Y = 1.9, GAZE_REACH = 14;
  var tx = 0, ty = 0, px = 0, py = 0;
  var lastX = 0, lastY = 0, lastMove = 0, gazing = false;

  function aim(e) {
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) return;
    /* Cuknutí myší kouká míň než pořádný přejezd. */
    var force = Math.min(len / GAZE_REACH, 1);
    tx = (dx / len) * GAZE_X * force;
    ty = (dy / len) * GAZE_Y * force;
    lastMove = Date.now();
  }

  function gaze() {
    if (!shown) { gazing = false; return; }
    /* Když myš chvíli stojí, oko se vrátí doprostřed. */
    if (Date.now() - lastMove > 140) { tx *= 0.88; ty *= 0.88; }
    px += (tx - px) * 0.18;
    py += (ty - py) * 0.18;
    pupil.style.transform =
      'translate(' + px.toFixed(2) + 'px, ' + py.toFixed(2) + 'px)';
    requestAnimationFrame(gaze);
  }

  /* One write per frame, mousemove fires far more often than that. */
  function flush() {
    queued = false;
    cursor.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
  }
  function move(e) {
    x = e.clientX;
    y = e.clientY;
    aim(e);
    if (!queued) { queued = true; requestAnimationFrame(flush); }
  }
  function show(e) {
    /* Bez tohohle by první delta byla proti poloze z minulého hoveru
       a oko by se hned na začátku prudce zvrhlo na stranu. */
    lastX = e.clientX;
    lastY = e.clientY;
    move(e);
    if (shown) return;
    shown = true;
    /* Land the pill at the pointer before it scales in, so it grows in
       place instead of flying across from the last hover. */
    flush();
    cursor.classList.add('is-visible');
    if (!gazing) { gazing = true; requestAnimationFrame(gaze); }
  }
  function hide() {
    if (!shown) return;
    shown = false;
    cursor.classList.remove('is-visible');
    release();
    /* Pilulka se příště nafoukne s pohledem rovně, ne s okem zapíchnutým
       tam, kam se koukalo naposledy. */
    tx = ty = px = py = 0;
    pupil.style.transform = '';
  }

  /* Stisk: pilulka se posadí, oko na tu chvíli zavře a po puštění se
     odsud rozjede vlnka. Puštění chytáme na okně, ne na bezelu - myš se
     dá pustit i mimo obrazovku a pilulka by jinak zůstala zmáčknutá. */
  function press() {
    if (!shown) return;
    pressed = true;
    cursor.classList.add('is-pressed');
  }
  function release() {
    if (!pressed) return;
    pressed = false;
    cursor.classList.remove('is-pressed');
    if (!shown) return;
    /* Restart jednorázové animace: bez sáhnutí na layout mezi remove
       a add by prohlížeč obě změny slil a vlnka by se podruhé nespustila. */
    cursor.classList.remove('is-clicked');
    void cursor.offsetWidth;
    cursor.classList.add('is-clicked');
  }

  [].forEach.call(screens, function (screen) {
    screen.addEventListener('mouseenter', show);
    screen.addEventListener('mousemove', move);
    screen.addEventListener('mouseleave', hide);
    screen.addEventListener('mousedown', press);
  });
  window.addEventListener('mouseup', release);

  /* The band moves under a still pointer, and scrolling or leaving the
     window can strand the pill with no mouseleave ever firing. */
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('blur', hide);
  document.addEventListener('mouseleave', hide);

})();

/* =====================================================================
   Hero mockups - vždycky jeden hlavní projekt uprostřed.

   Pás stojí a posouvá se po celých krocích: uprostřed hero sekce je pořád
   jeden mockup v barvě a v plné velikosti, ostatní jsou ztmavené (CSS
   .is-active na .laptop). Po chvíli se hlavní stane ten následující a pás
   se o jeden krok posune, takže nový hlavní dosedne přesně na střed.

   Geometrie: pás začíná na 50% - 3.37879 pitche a bezel je široký 0.75758
   pitche, takže střed bezelu k vychází na 50% + (k - 3) * pitch. Vycentrovat
   index i tedy znamená posunout pás o (3 - i) pitchů. Posun se píše přes
   calc() s tokenem --laptop-pitch, aby přežil změnu šířky okna bez
   přepočítávání v JS.

   Návrat na začátek: všechny jednotky nesou stejný snímek, takže po dojetí
   kroku stačí pás bez animace vrátit o jeden pitch zpět a přeznačit hlavní
   jednotku. Render je pixel po pixelu totožný, smyčka tedy nemá švy. Až bude
   mít každý mockup vlastní projekt, tenhle skok se nahradí procházením
   celého pásu (proměnná pos přestane být jen 0/1).
   ===================================================================== */
(function () {
  'use strict';

  var band = document.querySelector('.laptop-band');
  if (!band) return;

  var units = [].slice.call(band.querySelectorAll('.laptop'));
  if (units.length < 5) return;   /* potřebujeme sousedy na obě strany */

  var HOME = 4;                   /* jednotka, která v klidu stojí na vrcholu oblouku */
  var pos = 0;                    /* posun pásu v pitchích */
  var active = HOME;
  var timer = null;
  var guard = null;
  var sliding = false;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function setTransform() {
    band.style.transform = 'rotate(calc(' + (-pos) + ' * var(--wheel-step)))';
  }

  function paint(animate) {
    /* Skok musí vypnout přechod, jinak by se oblouk viditelně vracel.
       To zařídí .is-snapping ve stylu. */
    if (!animate) band.classList.add('is-snapping');
    setTransform();
    units.forEach(function (unit, i) {
      unit.classList.toggle('is-active', i === active);
    });
    if (!animate) {
      void band.offsetWidth;      /* reflow: další krok se má zase animovat */
      band.classList.remove('is-snapping');
    }
  }

  /* Hold sedí v --laptop-hold, aby časování bylo na jednom místě se
     stylem. Token je v sekundách, getComputedStyle vrací "3.4s". */
  function hold() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue('--laptop-hold');
    var ms = parseFloat(raw) * (raw.indexOf('ms') > -1 ? 1 : 1000);
    return isFinite(ms) && ms > 400 ? ms : 3400;
  }

  function queue() {
    clearTimeout(timer);
    timer = setTimeout(step, hold());
  }

  function step() {
    if (sliding || dragging) return;
    sliding = true;
    pos = 1;
    active = HOME + 1;            /* nový hlavní se rozsvěcí už během jízdy */
    paint(true);
    /* Pojistka: transitionend neproběhne, když je přejezd nulově dlouhý
       nebo ho prohlížeč zahodí. Bez ní by se pás po prvním kroku zasekl. */
    clearTimeout(guard);
    guard = setTimeout(finish, 1400);
  }

  /* Konec jízdy: pás se neviditelně vrátí a čeká na další krok. */
  function finish() {
    if (!sliding) return;
    clearTimeout(guard);
    sliding = false;
    pos = 0;
    active = HOME;
    paint(false);
    if (!paused()) queue();
  }

  band.addEventListener('transitionend', function (e) {
    if (e.target !== band || e.propertyName !== 'transform') return;
    finish();
  });

  var over = false;
  function paused() { return over || dragging || document.hidden; }

  /* Najetí myší na displej zastaví přepínání, aby si člověk mohl projekt
     prohlédnout. Posloucháme na displejích, ne na pásu: ten je jen bezrozměrný
     bod ve středu kruhu, takže na něj myš nikdy nedosáhne. Stejně se chová
     i skrytá záložka, jinak by se kroky nastřádaly a proběhly naráz. */
  units.forEach(function (unit) {
    var screen = unit.querySelector('.laptop__bezel');
    if (!screen) return;
    screen.addEventListener('mouseenter', function () { over = true; clearTimeout(timer); });
    screen.addEventListener('mouseleave', function () { over = false; if (!sliding) queue(); });
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { clearTimeout(timer); }
    else if (!sliding && !over) { queue(); }
  });

  /* =====================================================================
     Tažení: chycením mockupu se dá obloukem otáčet.

     Protože jsou všechny jednotky totožné a rozmístěné po stejném úhlu, je
     render po posunu o celý krok k nerozeznání od výchozího. Během tažení
     proto posun průběžně normalizujeme do (-0.5, 0.5] a celé kroky
     zahazujeme: točit jde donekonečna, aniž by došly jednotky. Po puštění
     oblouk dosedne na nejbližší zarážku, což je po normalizaci vždycky ta
     pod rukou, a přepínání se zase rozjede.
     ===================================================================== */
  var dragging = false, startX = 0, startPos = 0, pxPerStep = 0;

  /* Kolik pixelů vodorovně odpovídá jednomu kroku: vzdálenost středů displejů
     dvou sousedních jednotek. Čte se z rozvržení při každém chycení, takže
     sedí na jakékoli šířce okna bez přepočítávání při resize. */
  function stepWidth() {
    var a = units[HOME].querySelector('.laptop__bezel');
    var b = units[HOME + 1] && units[HOME + 1].querySelector('.laptop__bezel');
    if (!a || !b) return 0;
    var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return Math.abs((rb.left + rb.width / 2) - (ra.left + ra.width / 2));
  }

  function normalize(p) {
    while (p > 0.5) p -= 1;
    while (p <= -0.5) p += 1;
    return p;
  }

  function onDown(e) {
    if (e.button != null && e.button !== 0) return;
    pxPerStep = stepWidth();
    if (!pxPerStep) return;

    dragging = true;
    startX = e.clientX;
    startPos = pos;
    clearTimeout(timer);
    clearTimeout(guard);
    sliding = false;
    band.classList.add('is-dragging');
    /* Bez tohohle začne prohlížeč vláčet obrázek laptopu jako soubor. */
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging) return;
    /* Tažení doprava má mockupy posunout doprava, tedy otočit opačně. */
    pos = normalize(startPos - (e.clientX - startX) / pxPerStep);
    startX = e.clientX;
    startPos = pos;
    setTransform();
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    band.classList.remove('is-dragging');
    pos = 0;
    active = HOME;
    paint(true);              /* dosednutí na nejbližší zarážku */
    if (!paused()) queue();
  }

  var hasPointer = 'PointerEvent' in window;
  units.forEach(function (unit) {
    unit.addEventListener(hasPointer ? 'pointerdown' : 'mousedown', onDown);
  });
  window.addEventListener(hasPointer ? 'pointermove' : 'mousemove', onMove);
  window.addEventListener(hasPointer ? 'pointerup' : 'mouseup', onUp);
  if (hasPointer) window.addEventListener('pointercancel', onUp);
  window.addEventListener('blur', onUp);

  paint(false);
  if (!reduceMotion.matches) queue();
  /* Zapnutí "omezit pohyb" za běhu přepínání zastaví, vypnutí ho vrátí. */
  var onMotionChange = function (e) {
    if (e.matches) clearTimeout(timer);
    else if (!sliding) queue();
  };
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onMotionChange);
  else reduceMotion.addListener(onMotionChange);
})();

/* =====================================================================
   Perk icons draw themselves in when the hero row reaches the viewport.
   Arming from JS rather than from the stylesheet is deliberate: the CSS
   that hides the strokes only lands once we know we can put them back,
   so no-JS and reduced-motion visitors get the finished row instead of
   three invisible icons.
   ===================================================================== */
(function () {
  'use strict';

  var perks = document.querySelector('.perks');
  if (!perks || !window.IntersectionObserver) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced && reduced.matches) return;

  perks.classList.add('is-armed');

  var io = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting) return;
    perks.classList.add('is-drawn');
    io.disconnect();          /* an entrance, not something to replay on every pass */
  }, { threshold: 0.35 });

  io.observe(perks);
})();

