/* =====================================================================
   Site chrome — the header nav drawer used below 900px.
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
   Sticky header shadow. A 1px sentinel above the bar tells us when the page
   has scrolled past the top — cheaper and smoother than a scroll listener,
   which fires on every frame and would have to read layout each time.
   ===================================================================== */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  if (!header || !window.IntersectionObserver) return;

  var sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none';
  document.body.insertBefore(sentinel, document.body.firstChild);

  new IntersectionObserver(function (entries) {
    header.classList.toggle('is-stuck', !entries[0].isIntersecting);
  }, { threshold: 0 }).observe(sentinel);
})();

/* =====================================================================
   Mega menu — the panels that drop out of Služby / Řešení / Proč my.
   Click to toggle; only one open at a time. Above 900px each panel is an
   overlay under the header, below it flows inline as an accordion, but the
   state machine is identical either way.
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

  /* Clicking anywhere outside the header closes whatever is open. */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.site-header')) closeAll(null);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = triggers.filter(function (t) { return t.getAttribute('aria-expanded') === 'true'; })[0];
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
   Button label swap — on hover each character rolls up while a duplicate
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
       instead of the button — otherwise the icon would count as extra content
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
   Mockup cursor — hovering a laptop screen in the hero swaps the native
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
  cursor.innerHTML = '<span class="mock-cursor__pill">Zobrazit projekt</span>';
  document.body.appendChild(cursor);

  var x = 0, y = 0, queued = false, shown = false;

  /* One write per frame — mousemove fires far more often than that. */
  function flush() {
    queued = false;
    cursor.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
  }
  function move(e) {
    x = e.clientX;
    y = e.clientY;
    if (!queued) { queued = true; requestAnimationFrame(flush); }
  }
  function show(e) {
    move(e);
    if (shown) return;
    shown = true;
    /* Land the pill at the pointer before it scales in, so it grows in
       place instead of flying across from the last hover. */
    flush();
    cursor.classList.add('is-visible');
  }
  function hide() {
    if (!shown) return;
    shown = false;
    cursor.classList.remove('is-visible');
  }

  [].forEach.call(screens, function (screen) {
    screen.addEventListener('mouseenter', show);
    screen.addEventListener('mousemove', move);
    screen.addEventListener('mouseleave', hide);
  });

  /* The band drifts under a still pointer, and scrolling or leaving the
     window can strand the pill with no mouseleave ever firing. */
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('blur', hide);
  document.addEventListener('mouseleave', hide);
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
