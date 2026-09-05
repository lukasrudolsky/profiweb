/* =====================================================================
   Country dial-code picker for the booking form.

   Names are not shipped, Intl.DisplayNames gives them in Czech (and in
   the visitor's language for anyone else), so only the dial codes need to
   travel. Flags are the regional-indicator pairs; no font on Windows draws
   those, so Noto Color Emoji is fetched from Google Fonts, subset with
   &text= to exactly the 240 flags in the list and pulled in only once the
   booking modal opens. It is 774 kB, which no visitor of the home page
   should pay for on the off chance they open a phone field.

   The value lives in a hidden input carrying [data-tel-code], the same
   contract the previous <select> had, so phoneValue() and form.reset()
   keep working untouched.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-cc]');
  if (!root) return;

  var btn = root.querySelector('[data-cc-btn]');
  var panel = root.querySelector('[data-cc-panel]');
  var list = root.querySelector('[data-cc-list]');
  var search = root.querySelector('[data-cc-search]');
  var empty = root.querySelector('[data-cc-empty]');
  var hidden = root.querySelector('[data-tel-code]');
  var flagEl = root.querySelector('[data-cc-flag]');
  var codeEl = root.querySelector('[data-cc-code]');
  if (!btn || !panel || !list || !search || !hidden) return;

  /* ISO 3166-1 alpha-2 : dial code */
  var DIAL = ('AD:376 AE:971 AF:93 AG:1268 AI:1264 AL:355 AM:374 AO:244 AR:54 AS:1684 AT:43 AU:61 AW:297 AX:358 AZ:994 '
    + 'BA:387 BB:1246 BD:880 BE:32 BF:226 BG:359 BH:973 BI:257 BJ:229 BL:590 BM:1441 BN:673 BO:591 BQ:599 BR:55 BS:1242 '
    + 'BT:975 BW:267 BY:375 BZ:501 CA:1 CD:243 CF:236 CG:242 CH:41 CI:225 CK:682 CL:56 CM:237 CN:86 CO:57 CR:506 CU:53 '
    + 'CV:238 CW:599 CY:357 CZ:420 DE:49 DJ:253 DK:45 DM:1767 DO:1809 DZ:213 EC:593 EE:372 EG:20 EH:212 ER:291 ES:34 '
    + 'ET:251 FI:358 FJ:679 FK:500 FM:691 FO:298 FR:33 GA:241 GB:44 GD:1473 GE:995 GF:594 GG:44 GH:233 GI:350 GL:299 '
    + 'GM:220 GN:224 GP:590 GQ:240 GR:30 GT:502 GU:1671 GW:245 GY:592 HK:852 HN:504 HR:385 HT:509 HU:36 ID:62 IE:353 '
    + 'IL:972 IM:44 IN:91 IO:246 IQ:964 IR:98 IS:354 IT:39 JE:44 JM:1876 JO:962 JP:81 KE:254 KG:996 KH:855 KI:686 '
    + 'KM:269 KN:1869 KP:850 KR:82 KW:965 KY:1345 KZ:7 LA:856 LB:961 LC:1758 LI:423 LK:94 LR:231 LS:266 LT:370 LU:352 '
    + 'LV:371 LY:218 MA:212 MC:377 MD:373 ME:382 MF:590 MG:261 MH:692 MK:389 ML:223 MM:95 MN:976 MO:853 MP:1670 MQ:596 '
    + 'MR:222 MS:1664 MT:356 MU:230 MV:960 MW:265 MX:52 MY:60 MZ:258 NA:264 NC:687 NE:227 NF:672 NG:234 NI:505 NL:31 '
    + 'NO:47 NP:977 NR:674 NU:683 NZ:64 OM:968 PA:507 PE:51 PF:689 PG:675 PH:63 PK:92 PL:48 PM:508 PR:1787 PS:970 '
    + 'PT:351 PW:680 PY:595 QA:974 RE:262 RO:40 RS:381 RU:7 RW:250 SA:966 SB:677 SC:248 SD:249 SE:46 SG:65 SH:290 '
    + 'SI:386 SJ:47 SK:421 SL:232 SM:378 SN:221 SO:252 SR:597 SS:211 ST:239 SV:503 SX:1721 SY:963 SZ:268 TC:1649 '
    + 'TD:235 TG:228 TH:66 TJ:992 TK:690 TL:670 TM:993 TN:216 TO:676 TR:90 TT:1868 TV:688 TW:886 TZ:255 UA:380 UG:256 '
    + 'US:1 UY:598 UZ:998 VA:39 VC:1784 VE:58 VG:1284 VI:1340 VN:84 VU:678 WF:681 WS:685 YE:967 YT:262 ZA:27 ZM:260 '
    + 'ZW:263').split(' ');

  function flagOf(iso) {
    return String.fromCodePoint(
      0x1F1E6 + iso.charCodeAt(0) - 65,
      0x1F1E6 + iso.charCodeAt(1) - 65
    );
  }

  var names = null;
  try { names = new Intl.DisplayNames(['cs'], { type: 'region' }); } catch (e) {}

  /* Diacritics are stripped on both sides so "cesko" finds "Česko". */
  function fold(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  var COUNTRIES = DIAL.map(function (pair) {
    var parts = pair.split(':');
    var iso = parts[0];
    var name = iso;
    if (names) { try { name = names.of(iso) || iso; } catch (e) {} }
    return { iso: iso, dial: '+' + parts[1], name: name, flag: flagOf(iso), key: fold(name) + ' ' + fold(iso) };
  }).sort(function (a, b) { return a.name.localeCompare(b.name, 'cs'); });

  /* ------------------------------------------------------- flag font */
  var fontAsked = false;
  function loadFlagFont() {
    if (fontAsked) return;
    fontAsked = true;
    var text = COUNTRIES.map(function (c) { return c.flag; }).join('');
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&text='
              + encodeURIComponent(text);
    document.head.appendChild(link);
  }

  /* Nothing to draw until the font is here, and the raw pair renders as two
     letters, which is exactly what the ISO code says anyway. */
  var booking = document.getElementById('booking');
  if (booking && window.MutationObserver) {
    new MutationObserver(function () {
      if (booking.classList.contains('is-open')) loadFlagFont();
    }).observe(booking, { attributes: true, attributeFilter: ['class'] });
  }

  /* ------------------------------------------------------------ render */
  var shown = COUNTRIES;
  var active = -1;

  function rowHtml(c, i) {
    return '<li class="cc__opt" role="option" id="cc-o' + i + '" data-dial="' + c.dial
      + '" data-iso="' + c.iso + '" aria-selected="' + (c.dial === hidden.value ? 'true' : 'false') + '">'
      + '<span class="cc__flag" aria-hidden="true">' + c.flag + '</span>'
      + '<span class="cc__name">' + c.name + '</span>'
      + '<span class="cc__dial">' + c.dial + '</span></li>';
  }

  function render(q) {
    var f = fold(q || '').trim();
    shown = !f ? COUNTRIES : COUNTRIES.filter(function (c) {
      return c.key.indexOf(f) > -1 || c.dial.indexOf(f.replace(/^\+/, '')) > -1;
    });
    list.innerHTML = shown.map(rowHtml).join('');
    empty.hidden = shown.length > 0;
    setActive(shown.length ? 0 : -1, false);
  }

  /* Offsets are read from rects rather than offsetTop, which would be measured
     against the panel and silently include the search box. */
  function scrollTo(row, center) {
    var lr = list.getBoundingClientRect();
    var rr = row.getBoundingClientRect();
    var delta = rr.top - lr.top;
    if (center) {
      list.scrollTop += delta - (list.clientHeight - rr.height) / 2;
    } else if (delta < 0) {
      list.scrollTop += delta;
    } else if (delta + rr.height > list.clientHeight) {
      list.scrollTop += delta + rr.height - list.clientHeight;
    }
  }

  function setActive(i, scroll) {
    var rows = list.children;
    if (active > -1 && rows[active]) rows[active].classList.remove('is-active');
    active = i;
    if (i < 0 || !rows[i]) { list.removeAttribute('aria-activedescendant'); return; }
    rows[i].classList.add('is-active');
    search.setAttribute('aria-activedescendant', rows[i].id);
    if (scroll !== false) scrollTo(rows[i], scroll === 'center');
  }

  function pick(dial, iso) {
    hidden.value = dial;
    codeEl.textContent = dial;
    flagEl.textContent = flagOf(iso);
    close();
    btn.focus();
  }

  /* -------------------------------------------------------- open/close */
  function open() {
    loadFlagFont();
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    search.value = '';
    render('');
    /* Centre the current choice: at the edge of the window it reads as if the
       list had opened somewhere random, and the row above it is a mis-click
       waiting to happen. */
    var at = -1;
    for (var i = 0; i < shown.length; i++) {
      if (shown[i].dial === hidden.value) { at = i; break; }
    }
    if (at > -1) setActive(at, 'center');
    /* preventScroll: focusing must not undo the scroll we just did. */
    try { search.focus({ preventScroll: true }); } catch (e) { search.focus(); }
  }

  function close() {
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', function () {
    if (panel.hidden) open(); else close();
  });

  search.addEventListener('input', function () { render(search.value); });

  search.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(shown.length - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (shown[active]) pick(shown[active].dial, shown[active].iso);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();          /* Esc closes the list, not the modal */
      close();
      btn.focus();
    }
  });

  list.addEventListener('click', function (e) {
    var row = e.target.closest('.cc__opt');
    if (row) pick(row.getAttribute('data-dial'), row.getAttribute('data-iso'));
  });

  /* A pointerdown anywhere else closes it, but not one that lands inside. */
  document.addEventListener('pointerdown', function (e) {
    if (!panel.hidden && !root.contains(e.target)) close();
  });

  /* form.reset() restores the hidden input's value but not what is drawn. */
  var form = document.querySelector('.booking__form');
  if (form) {
    form.addEventListener('reset', function () {
      setTimeout(function () {
        var iso = 'CZ';
        for (var i = 0; i < COUNTRIES.length; i++) {
          if (COUNTRIES[i].dial === hidden.value) { iso = COUNTRIES[i].iso; break; }
        }
        codeEl.textContent = hidden.value;
        flagEl.textContent = flagOf(iso);
        close();
      }, 0);
    });
  }

  flagEl.textContent = flagOf('CZ');
})();
