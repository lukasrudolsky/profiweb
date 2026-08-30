/* =====================================================================
   Booking modal — date picker, time slots, details form, confirmation.

   Availability and bookings come from cal.com, which is what talks to
   Google Calendar. Fill in CAL below and the calendar goes live; leave it
   empty and it falls back to the local demo generator so the page still
   presents.

   Why cal.com and not the Google Calendar API directly: reading your
   free/busy and writing events needs credentials, and this is a static
   site — anything in this file is readable by every visitor. cal.com's
   public endpoints need no key at all (verified: /v2/slots answers 404
   "user not found", not 401, and sends Access-Control-Allow-Origin: *),
   so the browser can call them safely with nothing secret on the page.

   Setup, once:
     1. cal.com -> Apps -> Google Calendar -> connect (this is the link to
        your calendar; cal.com then reads busy times and writes the event).
     2. Create the event type for the intro call, note its slug.
     3. Put your username and that slug in CAL.

   Careful: the two endpoints pin DIFFERENT api versions. Sending the
   wrong one makes the route 404 rather than fail loudly.
   ===================================================================== */
(function () {
  'use strict';

  var CAL = {
    username:      'lukas.rudolsky',   // cal.com/lukas.rudolsky/15min
    eventTypeSlug: '15min',            // "15 min schůzka", 15m, Google Meet
    timeZone:      'Europe/Prague'
  };

  var API        = 'https://api.cal.com/v2';
  var V_SLOTS    = '2024-09-04';
  var V_BOOKINGS = '2026-02-25';

  var live = !!(CAL.username && CAL.eventTypeSlug);

  /* Show and book in the visitor's own zone, not ours. Slots come back as
     absolute instants, so this only changes how they are bucketed into days
     and rendered — and it is what cal.com puts in their confirmation mail.
     CAL.timeZone stays the fallback for browsers without Intl data. */
  var TZ = (function () {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || CAL.timeZone; }
    catch (e) { return CAL.timeZone; }
  })();

  var root = document.getElementById('booking');
  if (!root) return;

  var MONTHS   = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
                  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
  var MONTHS_G = ['ledna', 'února', 'března', 'dubna', 'května', 'června',
                  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  var WEEKDAYS = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];

  var dialog    = root.querySelector('.booking__dialog');
  var steps     = root.querySelectorAll('.booking__step');
  var monthEl   = root.querySelector('[data-cal-month]');
  var gridEl    = root.querySelector('[data-cal-grid]');
  var prevBtn   = root.querySelector('[data-cal-prev]');
  var nextBtn   = root.querySelector('[data-cal-next]');
  var slotsDay  = root.querySelector('[data-slots-day]');
  var slotsList = root.querySelector('[data-slots-list]');
  var summaryLi = root.querySelector('[data-summary]');
  var form      = root.querySelector('[data-booking-form]');
  var doneEmail = root.querySelector('[data-done-email]');

  var today    = startOfDay(new Date());
  var view     = new Date(today.getFullYear(), today.getMonth(), 1);
  var selected = null;   // Date of the chosen day
  var slot     = null;   // "HH:MM"
  var lastFocus = null;
  var syncBudget    = function () {};   // both assigned once the form wiring runs
  var submitBooking = function () {};

  /* ------------------------------------------------------------ helpers */
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function sameDay(a, b) { return a && b && a.getTime() === b.getTime(); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /* Stable pseudo-random per day, so a date always shows the same offer. */
  function seed(d) {
    var h = 2166136261;
    var s = key(d);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }

  /* Demo fallback: working hours 9:00–17:30, minus a deterministic slice. */
  function mockSlotsFor(d) {
    var wd = d.getDay();
    if (wd === 0 || wd === 6) return [];

    var h = seed(d), out = [];
    for (var m = 9 * 60; m <= 17 * 60 + 30; m += 30) {
      h = (h * 1103515245 + 12345) >>> 0;
      if (((h >>> 16) % 10) > 3) {                          // ~60 % of the grid is free
        out.push({ hm: pad(Math.floor(m / 60)) + ':' + pad(m % 60), iso: null });
      }
    }
    if (isSameDay(d, today)) {                             // today: only future times
      var now = new Date();
      out = out.filter(function (t) {
        var p = t.hm.split(':');
        return (+p[0] * 60 + +p[1]) > (now.getHours() * 60 + now.getMinutes() + 60);
      });
    }
    return out;
  }
  function isSameDay(a, b) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }

  /* ------------------------------------------------- cal.com availability */
  var months = {};                 // 'YYYY-MM' -> { state, days, error }

  function monthKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }

  /* Slot instants are absolute; bucket them by wall-clock day in the
     business time zone rather than trusting the response's own keys. */
  var zoneFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  function zoned(dt) {
    var p = {};
    zoneFmt.formatToParts(dt).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
  }

  /* cal.com has shipped a few shapes for this payload; accept them all
     rather than break on a version bump. */
  function normalize(body) {
    var data = body && body.data ? body.data : body;
    if (data && data.slots) data = data.slots;
    var out = {};
    if (!data || typeof data !== 'object') return out;

    Object.keys(data).forEach(function (k) {
      var arr = data[k];
      if (!Array.isArray(arr)) return;
      arr.forEach(function (it) {
        var iso = typeof it === 'string' ? it : (it && (it.start || it.time || it.startTime));
        if (!iso) return;
        var dt = new Date(iso);
        if (isNaN(dt.getTime())) return;
        var z = zoned(dt);
        (out[z.date] = out[z.date] || []).push({ hm: z.time, iso: iso });
      });
    });
    Object.keys(out).forEach(function (k) {
      out[k].sort(function (a, b) { return a.hm < b.hm ? -1 : 1; });
    });
    return out;
  }

  function isoAt(d, endOfDay) {
    return key(d) + (endOfDay ? 'T23:59:59Z' : 'T00:00:00Z');
  }

  function loadMonth(d) {
    var mk = monthKey(d);
    if (months[mk]) return Promise.resolve(months[mk]);

    var entry = months[mk] = { state: 'loading', days: {}, error: '' };

    var from = new Date(d.getFullYear(), d.getMonth(), 1);
    if (from < today) from = today;                        // never ask for the past
    var to = new Date(d.getFullYear(), d.getMonth() + 1, 0);

    var url = API + '/slots?eventTypeSlug=' + encodeURIComponent(CAL.eventTypeSlug) +
              '&username=' + encodeURIComponent(CAL.username) +
              '&start=' + isoAt(from) + '&end=' + isoAt(to, true) +
              '&timeZone=' + encodeURIComponent(TZ);

    return fetch(url, { headers: { 'cal-api-version': V_SLOTS } })
      .then(function (r) {
        return r.json().catch(function () { return {}; })
          .then(function (body) {
            if (!r.ok) {
              var m = body && body.error && body.error.message;
              throw new Error(m || ('cal.com odpovědělo ' + r.status));
            }
            return body;
          });
      })
      .then(function (body) {
        entry.days = normalize(body);
        entry.state = 'ready';
        return entry;
      })
      .catch(function (err) {
        entry.state = 'error';
        entry.error = err.message || 'Nepodařilo se načíst volné termíny.';
        return entry;
      });
  }

  function monthState() {
    if (!live) return 'ready';
    var e = months[monthKey(view)];
    return e ? e.state : 'loading';
  }

  function slotsFor(d) {
    if (!live) return mockSlotsFor(d);
    var e = months[monthKey(d)];
    if (!e || e.state !== 'ready') return [];
    return e.days[key(d)] || [];
  }

  /* Re-render once the month in view resolves; ignore stale responses. */
  function ensureMonth() {
    if (!live) return;
    var mk = monthKey(view);
    if (months[mk]) return;
    loadMonth(view).then(function () {
      if (monthKey(view) !== mk) return;                   // user moved on
      renderMonth();
      renderSlots();
    });
  }

  function longDate(d) {
    return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + '. ' +
           MONTHS_G[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* ---------------------------------------------------------- rendering */
  function renderMonth() {
    monthEl.textContent = MONTHS[view.getMonth()] + ' ' + view.getFullYear();
    prevBtn.disabled = view.getFullYear() === today.getFullYear() &&
                       view.getMonth() === today.getMonth();

    ensureMonth();

    var state = monthState();
    gridEl.classList.toggle('is-loading', state === 'loading');
    gridEl.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');

    /* Both a failed lookup and an empty-but-successful month would otherwise
       render as a month where every day is simply disabled. Say which it is,
       instead of showing a dead calendar. */
    if (state === 'error') {
      calNote('Termíny se nepodařilo načíst: ' + months[monthKey(view)].error, true);
    } else if (state === 'loading') {
      calNote('Načítám volné termíny…', false);
    } else if (state === 'ready' && live && !hasAnySlots()) {
      calNote('V tomto měsíci nejsou volné termíny.', false, true);
    } else {
      calNote('', false);
    }

    gridEl.innerHTML = '';

    var first = new Date(view.getFullYear(), view.getMonth(), 1);
    var lead  = (first.getDay() + 6) % 7;                   // Monday-first
    var days  = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();

    /* While availability is in flight every day would render disabled and
       labelled "bez volných termínů" — which is simply untrue, and reads as a
       broken calendar you can click at forever. Show placeholders instead. */
    if (state === 'loading') {
      for (var s = 0; s < lead + days; s++) {
        var cell = document.createElement('span');
        cell.className = 'cal__day cal__day--skeleton';
        if (s < lead) cell.classList.add('cal__day--pad');
        gridEl.appendChild(cell);
      }
      return;
    }

    for (var i = 0; i < lead; i++) {
      var padCell = document.createElement('span');
      padCell.className = 'cal__day cal__day--pad';
      gridEl.appendChild(padCell);
    }

    for (var day = 1; day <= days; day++) {
      var date = new Date(view.getFullYear(), view.getMonth(), day);
      var btn  = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal__day';
      btn.textContent = day;
      btn.dataset.date = key(date);

      var free = date >= today && slotsFor(date).length > 0;
      if (!free) {
        btn.disabled = true;
        btn.setAttribute('aria-label', longDate(date) + ' — bez volných termínů');
      } else {
        btn.setAttribute('aria-label', longDate(date));
      }
      if (sameDay(date, today)) btn.classList.add('is-today');
      if (sameDay(date, selected)) {
        btn.classList.add('is-selected');
        btn.setAttribute('aria-pressed', 'true');
      }
      gridEl.appendChild(btn);
    }
  }

  function renderSlots() {
    slotsList.innerHTML = '';

    if (!selected) {
      slotsDay.textContent = 'Vyberte den';
      slotsList.innerHTML = '<p class="slots__empty">Vlevo vyberte den, ke kterému zobrazíme volné časy.</p>';
      return;
    }

    slotsDay.textContent = longDate(selected);

    var state = monthState();
    if (state === 'loading') {
      slotsList.innerHTML = '<p class="slots__empty">Načítám volné časy…</p>';
      return;
    }
    if (state === 'error') {
      slotsList.innerHTML = '<p class="slots__empty">' +
        escapeHtml(months[monthKey(view)].error) + '</p>';
      return;
    }

    var times = slotsFor(selected);

    if (!times.length) {
      slotsList.innerHTML = '<p class="slots__empty">V tento den už není volno. Zkuste prosím jiný termín.</p>';
      return;
    }

    times.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot' + (slot && t.hm === slot.hm ? ' is-selected' : '');
      b.textContent = t.hm;
      b.dataset.time = t.hm;
      b.dataset.iso = t.iso || '';
      slotsList.appendChild(b);
    });
  }

  function hasAnySlots() {
    var e = months[monthKey(view)];
    return !!(e && e.days && Object.keys(e.days).length);
  }

  function calNote(msg, isError, offerNext) {
    var box = root.querySelector('[data-cal-error]');
    if (!box) {
      if (!msg) return;
      box = document.createElement('p');
      box.setAttribute('data-cal-error', '');
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      gridEl.parentNode.insertBefore(box, gridEl);
    }
    box.className = 'booking__error' + (isError ? '' : ' is-muted');
    box.textContent = msg;
    box.hidden = !msg;

    /* An empty month otherwise dead-ends at a sentence telling people to go
       looking for the arrow. data-cal-next reuses the existing handler. */
    if (offerNext) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'booking__note-action';
      b.setAttribute('data-cal-next', '');
      b.textContent = 'Zobrazit další měsíc';
      box.appendChild(b);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function renderSummary() {
    var text = selected && slot ? longDate(selected) + ' · ' + slot.hm : '';
    Array.prototype.forEach.call(root.querySelectorAll('[data-summary-text]'), function (el) {
      el.textContent = text;
    });
    if (summaryLi) summaryLi.hidden = !text;
  }

  function showStep(name) {
    Array.prototype.forEach.call(steps, function (s) {
      s.classList.toggle('is-active', s.dataset.step === name);
    });
    dialog.scrollTop = 0;
  }

  /* ------------------------------------------------------ qualification --
     Availability is worth nothing to a project we would decline, so the
     calendar stays locked until the budget clears the minimum. Turning
     people away here — before they pick a slot and type their details —
     costs them ten seconds instead of a whole call. */
  var MIN_NOTE =
    'Weby stavíme od 20 000 Kč, menší projekty bohužel nebereme. ' +
    'Zkuste <a href="#audit" data-booking-close data-audit-open>bezplatný audit webu</a> — ' +
    'dostanete konkrétní tipy hned a zdarma.';

  function budgetInput() { return root.querySelector('[name="budget"]:checked'); }
  function budgetValue() { var b = budgetInput(); return b ? b.value : ''; }
  function isLowBudget() {
    var b = budgetInput();
    return !!(b && b.hasAttribute('data-budget-low'));
  }
  function qualified() { return !!budgetValue() && !isLowBudget(); }

  syncBudget = function () {
    var note = root.querySelector('[data-budget-note]');
    var low  = isLowBudget();
    if (note) {
      note.innerHTML = low ? MIN_NOTE : '';
      note.hidden = !low;
    }
    /* Below the minimum there is nothing to book, so the step never opens. */
    var next = root.querySelector('[data-step="form"] .booking__submit');
    if (next) {
      next.disabled = low;
      next.setAttribute('aria-disabled', low ? 'true' : 'false');
    }
  };

  /* ------------------------------------------------------- personalisation --
     Czech addresses people in the vocative; "Díky, Jan" reads as broken to a
     native speaker. These rules cover the common name shapes, and anything
     they cannot resolve confidently returns '' so we drop the name rather
     than print a mangled one. */
  var FEM_CONSONANT = ['karin', 'miriam', 'ester', 'dagmar', 'ingrid', 'nikol',
                       'rachel', 'sarah', 'rút', 'ruth', 'noemi'];

  function vocative(name) {
    var n = (name || '').trim();
    if (n.length < 2 || /[^a-zá-žA-ZÁ-Ž]/.test(n)) return '';

    var l = n.toLowerCase();
    var last = l.slice(-1);
    var last2 = l.slice(-2);

    if (FEM_CONSONANT.indexOf(l) >= 0) return n;          // Karin, Ester — unchanged
    if (last === 'a') return n.slice(0, -1) + 'o';        // Eva → Evo, Honza → Honzo
    if ('eéiíyý'.indexOf(last) >= 0) return n;            // Marie, Lucie, Jiří — unchanged
    if (last2 === 'ek') return n.slice(0, -2) + 'ku';     // Marek → Marku
    if (last2 === 'el') return n.slice(0, -2) + 'le';     // Pavel → Pavle
    if (last2 === 'ch') return n + 'u';                   // Vojtěch → Vojtěchu
    if ('šžčřjc'.indexOf(last) >= 0) return n + 'i';      // Tomáš → Tomáši, Ondřej → Ondřeji
    if ('kgh'.indexOf(last) >= 0) return n + 'u';         // Dominik → Dominiku
    if (last === 'r') {                                   // Petr → Petře, Otakar → Otakare
      return 'bcdfghjklmnpstvzž'.indexOf(l.slice(-2, -1)) >= 0 ? n.slice(0, -1) + 'ře' : n + 'e';
    }
    if ('bdflmnpstvz'.indexOf(last) >= 0) return n + 'e'; // Jan → Jane, Michal → Michale
    return '';
  }

  /* "Europe/Prague · GMT+2" — say which zone the times are in, because they
     are now the visitor's, not ours, and that is not self-evident. */
  function tzLabel() {
    var zone = TZ.replace(/_/g, ' ');
    try {
      var parts = new Intl.DateTimeFormat('cs-CZ', { timeZone: TZ, timeZoneName: 'short' })
        .formatToParts(new Date());
      var abbr = parts.filter(function (p) { return p.type === 'timeZoneName'; })[0];
      if (abbr && abbr.value) return zone + ' · ' + abbr.value;
    } catch (e) {}
    return zone;
  }
  Array.prototype.forEach.call(root.querySelectorAll('[data-tz]'), function (el) {
    el.textContent = tzLabel();
  });

  function firstName() {
    if (!form || !form.elements.name) return '';
    return form.elements.name.value.trim().split(/\s+/)[0] || '';
  }

  /* Remember the neutral copy once, so an empty or unparseable name restores
     it instead of leaving the previous visitor's greeting on screen. */
  function keepDefault(el) {
    if (el && el.dataset.copy === undefined) el.dataset.copy = el.textContent;
    return el;
  }
  var pickSub   = keepDefault(root.querySelector('[data-step="pick"] .booking__subtitle'));
  var doneTitle = keepDefault(root.querySelector('[data-step="done"] .booking__title'));

  function personalize() {
    var v = vocative(firstName());
    if (pickSub) {
      pickSub.textContent = v ? 'Díky, ' + v + '. Vyberte termín, který vám sedí.'
                              : pickSub.dataset.copy;
    }
    if (doneTitle) {
      doneTitle.textContent = v ? 'Hotovo, ' + v + '!' : doneTitle.dataset.copy;
    }
  }

  /* -------------------------------------------------------- form panes --
     Seven fields in one column read as a wall, so the form is halved:
     contact first, project second. Only the middle column swaps — the aside
     and the calendar tease stay mounted, so the dialog never changes height
     and nothing around them jumps. */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function validEmail(v) { return EMAIL_RE.test(String(v || '').trim()); }

  /* Nine digits is the Czech and Slovak length; the rest of the list runs
     from seven up. Spaces, dashes and brackets are stripped before counting
     so a pasted "+420 777 123 456" is not rejected for its formatting. */
  function validPhone(v) {
    var digits = String(v || '').replace(/[^0-9]/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }
  function validName(v) { return String(v || '').trim().length > 1; }

  function panes() { return root.querySelectorAll('[data-pane]'); }

  function showPane(name) {
    Array.prototype.forEach.call(panes(), function (p) {
      var on = p.getAttribute('data-pane') === name;
      p.classList.toggle('is-active', on);
      /* A hidden pane must leave the tab order too, not just the screen. */
      if (on) p.removeAttribute('inert'); else p.setAttribute('inert', '');
    });
    var now = root.querySelector('[data-progress-now]');
    if (now) now.textContent = name === 'projekt' ? '2' : '1';
    if (dialog) dialog.scrollTop = 0;
  }

  function confirmBtn() { return root.querySelector('[data-booking-confirm]'); }
  function syncConfirm() {
    var b = confirmBtn();
    if (!b) return;
    var ready = !!(selected && slot);
    b.disabled = !ready;
    b.setAttribute('aria-disabled', ready ? 'false' : 'true');
    /* Visibility rides on a class, not on [disabled] — the button is also
       disabled while the request is in flight, and it must stay on screen
       then to carry the "Rezervuji…" status. */
    var host = b.closest('.booking__slots');
    if (host) host.classList.toggle('has-choice', ready);
  }

  root.addEventListener('change', function (e) {
    if (e.target.name === 'budget') syncBudget();
  });

  function buildNotes() {
    if (!form) return '';
    var web  = form.elements.web ? form.elements.web.value.trim() : '';
    var note = form.elements.note ? form.elements.note.value.trim() : '';
    var out  = [];
    var b    = budgetValue();
    var tel  = phoneValue();
    /* cal.com's default event type has no phone field, so the number rides
       along in notes — otherwise it would be collected and then dropped. */
    if (tel)  out.push('Telefon: ' + tel);
    if (b)    out.push('Rozpočet: ' + b);
    if (web)  out.push('Web: ' + web);
    if (note) out.push('Co probrat: ' + note);
    return out.join('\n');
  }

  /* ------------------------------------------------------- open / close */
  function open() {
    lastFocus = document.activeElement;
    selected = null;
    slot = null;
    view = new Date(today.getFullYear(), today.getMonth(), 1);
    if (form) form.reset();
    Array.prototype.forEach.call(root.querySelectorAll('.field'), function (f) {
      f.classList.remove('has-error');
    });
    syncBudget();
    syncConfirm();
    showPane('kontakt');           // always start on the contact half
    personalize();                 // clears any greeting from a previous visit

    /* Details first, slots second — qualify before spending anyone's time. */
    showStep('form');
    renderMonth();               // warms the month so step 2 opens populated
    renderSlots();
    renderSummary();

    root.hidden = false;
    document.body.classList.add('booking-open');
    requestAnimationFrame(function () { root.classList.add('is-open'); });

    var firstField = root.querySelector('#bk-name');
    (firstField || root.querySelector('.booking__close')).focus();
  }

  function close() {
    root.classList.remove('is-open');
    document.body.classList.remove('booking-open');
    window.setTimeout(function () { root.hidden = true; }, 260);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* Keep tabbing inside the dialog while it is open. */
  function trap(e) {
    if (e.key !== 'Tab') return;
    var focusable = dialog.querySelectorAll('button, [href], input, textarea, select');
    var list = Array.prototype.filter.call(focusable, function (el) {
      return !el.disabled && el.offsetParent !== null;
    });
    if (!list.length) return;

    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* --------------------------------------------------------- listeners */
  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-booking-open]');
    if (opener) { e.preventDefault(); open(); return; }

    if (root.hidden) return;

    if (e.target.closest('[data-booking-close]')) { e.preventDefault(); close(); return; }
    if (e.target.closest('[data-booking-back]'))  { showStep('form'); return; }

    var prev = e.target.closest('[data-cal-prev]');
    var next = e.target.closest('[data-cal-next]');
    if (prev || next) {
      view = new Date(view.getFullYear(), view.getMonth() + (next ? 1 : -1), 1);
      renderMonth();
      return;
    }

    var day = e.target.closest('.cal__day');
    if (day && !day.disabled && root.contains(day)) {
      var p = day.dataset.date.split('-');
      selected = new Date(+p[0], +p[1] - 1, +p[2]);
      slot = null;                 // a new day invalidates the chosen time
      renderMonth();
      renderSlots();
      renderSummary();
      syncConfirm();
      return;
    }

    /* Details are already in hand, so a slot only arms the confirm button —
       it must not book on its own, or a stray click books a call. */
    var timeBtn = e.target.closest('.slot');
    if (timeBtn && root.contains(timeBtn)) {
      slot = { hm: timeBtn.dataset.time, iso: timeBtn.dataset.iso || null };
      renderSlots();
      renderSummary();
      syncConfirm();
      return;
    }

    if (e.target.closest('[data-booking-confirm]')) { submitBooking(); }
  });

  document.addEventListener('keydown', function (e) {
    if (root.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    trap(e);
  });

  if (form) {
    /* The first pane validates only what it shows; sending someone back to a
       field they have not been offered yet would be nonsense. */
    form.addEventListener('click', function (e) {
      if (e.target.closest('[data-pane-back]')) { showPane('kontakt'); return; }
      if (!e.target.closest('[data-pane-next]')) return;

      var ok = true;
      [['phone', validPhone], ['name', validName], ['email', validEmail]].forEach(function (p) {
        var el = form.elements[p[0]];
        var good = p[1](el.value);
        el.closest('.field').classList.toggle('has-error', !good);
        if (!good) ok = false;
      });
      if (!ok) {
        var bad = form.querySelector('.booking__pane.is-active .has-error input');
        if (bad) bad.focus();
        return;
      }
      showPane('projekt');
      var web = form.elements.web;
      if (web) web.focus();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var name  = form.elements.name;
      var email = form.elements.email;
      var phone = form.elements.phone;
      var ok    = true;

      function mark(input, valid) {
        input.closest('.field').classList.toggle('has-error', !valid);
        if (!valid) ok = false;
      }
      mark(phone, validPhone(phone.value));
      mark(name, validName(name.value));
      mark(email, validEmail(email.value));

      var budgetBox = form.querySelector('.field--budget');
      if (budgetBox) {
        budgetBox.classList.toggle('has-error', !budgetValue());
        if (!budgetValue()) ok = false;
      }

      if (!ok) {
        /* An error can sit on the pane that is not showing — jump back to it
           rather than blocking on a field nobody can see. */
        var bad = form.querySelector('.has-error');
        var pane = bad && bad.closest('[data-pane]');
        if (pane && !pane.classList.contains('is-active')) {
          showPane(pane.getAttribute('data-pane'));
        }
        var input = form.querySelector('.has-error input, .has-error select');
        if (input) input.focus();
        return;
      }
      if (!qualified()) { syncBudget(); return; }   // under the minimum

      /* Step 1 only collects and qualifies; the booking is created from the
         slot step, once there is a time to book. */
      personalize();
      showStep('pick');
      renderMonth();
      renderSlots();
      syncConfirm();
      var firstFree = gridEl.querySelector('.cal__day:not(:disabled)');
      (firstFree || root.querySelector('[data-booking-back]')).focus();
    });

    submitBooking = function () {
      if (!selected || !slot) return;

      var nameVal = form.elements.name.value.trim();
      var mailVal = form.elements.email.value.trim();

      function succeed() {
        if (doneEmail) doneEmail.textContent = mailVal;
        personalize();
        showStep('done');
        root.querySelector('[data-step="done"] .booking__submit').focus();
      }

      if (!live || !slot.iso) { succeed(); return; }

      var submitBtn = confirmBtn();
      setBusy(submitBtn, true);
      formError('');

      fetch(API + '/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cal-api-version': V_BOOKINGS
        },
        body: JSON.stringify({
          start: slot.iso,
          eventTypeSlug: CAL.eventTypeSlug,
          username: CAL.username,
          attendee: {
            name: nameVal,
            email: mailVal,
            timeZone: TZ,
            language: 'cs'
          },
          /* The event type only carries the default fields, so everything the
             form collects beyond name/email rides along in "notes" — otherwise
             budget, web and the message would be silently dropped. */
          bookingFieldsResponses: { notes: buildNotes() }
        })
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; })
            .then(function (body) {
              if (!r.ok) {
                var m = body && body.error && body.error.message;
                throw new Error(m || ('Rezervaci se nepodařilo vytvořit (' + r.status + ').'));
              }
              return body;
            });
        })
        .then(function () {
          /* The slot is gone now — drop the month so a reopen refetches. */
          delete months[monthKey(selected)];
          succeed();
        })
        .catch(function (err) {
          formError(err.message + ' Vyberte prosím jiný čas nebo napište na ahoj@profiweb.cz.');
          /* The most likely cause is someone booking that slot while this
             form was open, so the times on screen are stale — refetch rather
             than let them retry into the same wall. */
          delete months[monthKey(selected)];
          slot = null;
          renderMonth();
          renderSlots();
        })
        .then(function () { setBusy(submitBtn, false); syncConfirm(); });
    };

    /* The submit label is split into per-character spans by site.js, so it
       must never be relabelled — status goes to its own live region. */
    function setBusy(btn, busy) {
      if (!btn) return;
      btn.disabled = busy;
      btn.setAttribute('aria-busy', busy ? 'true' : 'false');
      formError(busy ? 'Rezervuji termín…' : '', busy);
    }

    /* Booking now happens on the slot step, so the status has to live beside
       the confirm button — inside the form it would be on a hidden step. */
    function formError(msg, pending) {
      var host = confirmBtn() ? confirmBtn().parentNode : form;
      var box  = root.querySelector('[data-booking-error]');
      if (!box) {
        box = document.createElement('p');
        box.setAttribute('data-booking-error', '');
        box.setAttribute('role', 'status');
        box.setAttribute('aria-live', 'polite');
        host.insertBefore(box, confirmBtn() ? confirmBtn().nextSibling : null);
      }
      box.className = 'booking__error';
      box.textContent = msg;
      box.hidden = !msg;
      box.classList.toggle('is-pending', !!pending);
    }

    /* Typing in a field clears its error; nothing else is gated on input
       any more, the panes decide when to move on. */
    form.addEventListener('input', function (e) {
      var field = e.target.closest('.field');
      if (field) field.classList.remove('has-error');
    });
  }
})();

/* =====================================================================
   Calendar tease. The month behind the form is decoration — aria-hidden,
   nothing clickable — but it should show the real current month rather
   than an invented one, or the blur stops hiding the lie. Deliberately
   plain: no cell is marked free, because at this point we have not asked
   cal.com anything.

   The grid is always padded out to six rows. A month needs five or six
   depending on the weekday it starts on, and the panel must not change
   height between them: the message is centred on this block, so a shorter
   month would leave it hanging over empty space.
   ===================================================================== */
(function () {
  'use strict';

  var grid = document.querySelector('[data-tease-grid]');
  if (!grid) return;

  var CELLS = 42;                     /* 6 rows x 7 days */
  var PAD = '<span class="cal__day cal__day--pad"></span>';

  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth();

  var label = document.querySelector('[data-tease-month]');
  if (label) {
    var name = '';
    /* toLocaleDateString throws on an unsupported locale in some engines */
    try {
      name = now.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
    } catch (e) {}
    if (name) label.textContent = name.charAt(0).toUpperCase() + name.slice(1);
  }

  /* getDay() counts from Sunday; the grid starts on Monday. */
  var lead = (new Date(year, month, 1).getDay() + 6) % 7;
  var days = new Date(year, month + 1, 0).getDate();

  var out = '';
  var i;
  for (i = 0; i < lead; i++) out += PAD;
  for (i = 1; i <= days; i++) out += '<span class="cal__day">' + i + '</span>';
  for (i = lead + days; i < CELLS; i++) out += PAD;

  grid.innerHTML = out;
})();
