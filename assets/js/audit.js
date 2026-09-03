/* =====================================================================
   Website audit — runs a real Lighthouse pass through the Google
   PageSpeed Insights API and renders the report inside the modal.

   The measurement happens on Google's servers: lab data comes from a
   Lighthouse run on a throttled mobile connection, field data (when the
   site has enough traffic) from the Chrome UX Report, i.e. real visits.

   API KEY — REQUIRED
   ------------------
   Keyless requests share a single Google project quota that is exhausted
   nearly all the time, so without a key every audit fails with HTTP 429.
   Get a free key (25 000 calls/day), it takes about two minutes:
     console.cloud.google.com → APIs & Services → Library →
     "PageSpeed Insights API" → Enable → Credentials → Create API key
   Then paste it into index.html:
     <meta name="psi-api-key" content="AIza…">
   Restrict the key by HTTP referrer to your domain — it is public in the
   page, the referrer restriction is what keeps it from being reused.
   ===================================================================== */
(function () {
  'use strict';

  var meta = document.querySelector('meta[name="psi-api-key"]');
  var PSI_KEY  = (meta && meta.content.trim()) || '';
  var PSI_URL  = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
  var TIMEOUT  = 90000;

  /* localhost / file:// — the operator is looking, so say what is wrong */
  var IS_DEV = /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname);

  if (!PSI_KEY && window.console) {
    console.warn('audit.js: no PageSpeed Insights API key configured. Add ' +
                 '<meta name="psi-api-key" content="…"> to index.html — without it ' +
                 'Google refuses the audit with HTTP 429. See the audit.js header.');
  }

  var root = document.getElementById('audit');
  if (!root) return;

  var dialog   = root.querySelector('.audit__dialog');
  var steps    = root.querySelectorAll('.audit__step');
  var form     = root.querySelector('[data-audit-form]');
  var input    = document.getElementById('au-url');
  var runUrl   = root.querySelector('[data-run-url]');
  var runStat  = root.querySelector('[data-run-status]');
  var runBar   = root.querySelector('[data-run-bar]');
  var errMsg   = root.querySelector('[data-err-msg]');

  var strategy  = 'mobile';
  var lastUrl   = '';
  var controller = null;
  var timers    = [];
  var lastFocus = null;

  /* ------------------------------------------------------------ helpers */
  function $(sel) { return root.querySelector(sel); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  /* "vasefirma.cz/kontakt" → "https://vasefirma.cz/kontakt" */
  function normalize(value) {
    var v = String(value || '').trim().replace(/\s+/g, '');
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v.replace(/^\/+/, '');
    var u;
    try { u = new URL(v); } catch (e) { return null; }
    if (!/^https?:$/.test(u.protocol)) return null;
    /* a hostname needs a dot and a sane TLD — "localhost" or a typo shouldn't
       be sent off to Google just to come back as a failed run */
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(u.hostname)) return null;
    return u.toString();
  }

  function cz(n, digits) {
    return n.toLocaleString('cs-CZ', {
      minimumFractionDigits: digits == null ? 0 : digits,
      maximumFractionDigits: digits == null ? 0 : digits
    });
  }
  function ms(v) {
    if (v == null) return '—';
    return v >= 1000 ? cz(v / 1000, v >= 10000 ? 0 : 1) + ' s' : cz(v) + ' ms';
  }

  /* Core Web Vitals thresholds, in Google's own good / needs-work / poor bands. */
  var BANDS = {
    LCP: [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25],
    FCP: [1800, 3000], TBT: [200, 600],  SI: [3400, 5800]
  };
  function band(key, value) {
    var b = BANDS[key];
    if (!b || value == null) return 'na';
    return value <= b[0] ? 'good' : value <= b[1] ? 'ok' : 'bad';
  }
  var BAND_LABEL = { good: 'dobré', ok: 'na hraně', bad: 'špatné', na: 'neměřeno' };

  /* ---------------------------------------------------------- rendering */
  function showStep(name) {
    Array.prototype.forEach.call(steps, function (s) {
      s.classList.toggle('is-active', s.dataset.astep === name);
    });
    dialog.scrollTop = 0;
  }

  function ring(score, label) {
    var pct = score == null ? 0 : Math.round(score * 100);
    var state = score == null ? 'na' : pct >= 90 ? 'good' : pct >= 50 ? 'ok' : 'bad';
    var C = 2 * Math.PI * 26;

    var li = el('li', 'score score--' + state);
    li.innerHTML =
      '<svg viewBox="0 0 60 60" aria-hidden="true">' +
        '<circle class="score__track" cx="30" cy="30" r="26"></circle>' +
        '<circle class="score__value" cx="30" cy="30" r="26" ' +
          'stroke-dasharray="' + (C * pct / 100).toFixed(2) + ' ' + C.toFixed(2) + '"></circle>' +
      '</svg>' +
      '<span class="score__num">' + (score == null ? '—' : pct) + '</span>';
    li.appendChild(el('span', 'score__label', label));
    li.setAttribute('aria-label', label + ': ' + (score == null ? 'neměřeno' : pct + ' ze 100'));
    return li;
  }

  function vital(name, note, value, key, isField) {
    var b = band(key, value);
    var li = el('li', 'vital vital--' + b);
    li.appendChild(el('p', 'vital__name', name));
    li.appendChild(el('p', 'vital__value', key === 'CLS'
      ? (value == null ? '—' : cz(value, 2))
      : ms(value)));
    li.appendChild(el('p', 'vital__note', note));
    var chip = el('span', 'vital__chip', BAND_LABEL[b] + (isField ? ' · reálná data' : ''));
    li.appendChild(chip);
    return li;
  }

  function renderReport(data) {
    var lh = data.lighthouseResult || {};
    var audits = lh.audits || {};
    var cats = lh.categories || {};
    var field = data.loadingExperience || {};
    var fm = field.metrics || {};
    var finalUrl = lh.finalUrl || data.id || lastUrl;
    var host;
    try { host = new URL(finalUrl).hostname.replace(/^www\./, ''); } catch (e) { host = finalUrl; }

    $('[data-r-host]').textContent = host;
    $('[data-r-meta]').textContent =
      (strategy === 'mobile' ? 'Mobil' : 'Počítač') + ' · ' +
      new Date(lh.fetchTime || Date.now()).toLocaleString('cs-CZ', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    $('[data-r-full]').href = 'https://pagespeed.web.dev/report?url=' + encodeURIComponent(finalUrl);

    var shot = $('[data-r-shot]');
    var shotData = audits['final-screenshot'] && audits['final-screenshot'].details;
    if (shotData && shotData.data) { shot.src = shotData.data; shot.hidden = false; }
    else { shot.hidden = true; shot.removeAttribute('src'); }

    /* -- category scores -- */
    var scores = $('[data-r-scores]');
    scores.innerHTML = '';
    [['performance', 'Výkon'], ['accessibility', 'Přístupnost'],
     ['best-practices', 'Doporučené postupy'], ['seo', 'SEO']].forEach(function (c) {
      scores.appendChild(ring(cats[c[0]] ? cats[c[0]].score : null, c[1]));
    });

    /* -- Core Web Vitals: real visitor data when Google has it, lab otherwise.
          Three headline tiles, the supporting lab metrics on a compact row. -- */
    var vitals = $('[data-r-vitals]');
    var extras = $('[data-r-metrics]');
    vitals.innerHTML = '';
    extras.innerHTML = '';
    var hasField = !!(fm.LARGEST_CONTENTFUL_PAINT_MS || fm.CUMULATIVE_LAYOUT_SHIFT_SCORE);
    var num = function (id) {
      var a = audits[id];
      return a && typeof a.numericValue === 'number' ? a.numericValue : null;
    };

    if (hasField) {
      vitals.appendChild(vital('LCP', 'Načtení hlavního obsahu',
        fm.LARGEST_CONTENTFUL_PAINT_MS ? fm.LARGEST_CONTENTFUL_PAINT_MS.percentile : null, 'LCP', true));
      vitals.appendChild(vital('INP', 'Odezva na kliknutí',
        fm.INTERACTION_TO_NEXT_PAINT ? fm.INTERACTION_TO_NEXT_PAINT.percentile : null, 'INP', true));
      vitals.appendChild(vital('CLS', 'Poskakování layoutu',
        fm.CUMULATIVE_LAYOUT_SHIFT_SCORE ? fm.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null, 'CLS', true));
    } else {
      vitals.appendChild(vital('LCP', 'Načtení hlavního obsahu', num('largest-contentful-paint'), 'LCP'));
      vitals.appendChild(vital('TBT', 'Blokování hlavního vlákna', num('total-blocking-time'), 'TBT'));
      vitals.appendChild(vital('CLS', 'Poskakování layoutu', num('cumulative-layout-shift'), 'CLS'));
    }

    var supporting = [['První vykreslení (FCP)', num('first-contentful-paint'), 'FCP'],
                      ['Naplnění obrazovky (Speed Index)', num('speed-index'), 'SI']];
    if (hasField) supporting.push(['Blokování vlákna (TBT)', num('total-blocking-time'), 'TBT']);
    supporting.forEach(function (m) {
      if (m[1] == null) return;
      var li = el('li', 'metric metric--' + band(m[2], m[1]));
      li.appendChild(el('span', 'metric__name', m[0]));
      li.appendChild(el('b', 'metric__value', ms(m[1])));
      extras.appendChild(li);
    });

    $('[data-r-cwv-note]').textContent = hasField
      ? 'Naměřeno na skutečných návštěvnících za posledních 28 dní (Chrome UX Report), doplněno laboratorním testem.'
      : 'Web zatím nemá dost návštěv pro data od reálných uživatelů, hodnoty jsou z laboratorního testu.';

    /* -- what costs the most time -- */
    var opps = Object.keys(audits).map(function (k) { return audits[k]; }).filter(function (a) {
      return a && a.details && a.details.type === 'opportunity' &&
             typeof a.numericValue === 'number' && a.numericValue >= 100;
    }).sort(function (a, b) { return b.numericValue - a.numericValue; }).slice(0, 5);

    var oppList = $('[data-r-opps]');
    oppList.innerHTML = '';
    $('[data-r-opps-block]').hidden = opps.length === 0;
    opps.forEach(function (a) {
      var li = el('li', 'finding');
      li.appendChild(el('p', 'finding__title', a.title));
      if (a.description) {
        li.appendChild(el('p', 'finding__text', a.description.replace(/\s*\[.*?\]\(.*?\)\s*/g, ' ').trim()));
      }
      li.appendChild(el('span', 'finding__save', 'ušetří ' + ms(a.numericValue)));
      oppList.appendChild(li);
    });

    /* -- failed checks across the non-performance categories -- */
    var issues = [];
    [['seo', 'SEO'], ['accessibility', 'Přístupnost'], ['best-practices', 'Doporučené postupy']].forEach(function (c) {
      var cat = cats[c[0]];
      if (!cat || !cat.auditRefs) return;
      cat.auditRefs.forEach(function (ref) {
        var a = audits[ref.id];
        if (!a || a.score === null || a.score >= 1) return;
        if (a.scoreDisplayMode === 'informative' || a.scoreDisplayMode === 'notApplicable' ||
            a.scoreDisplayMode === 'manual') return;
        if (issues.some(function (i) { return i.id === ref.id; })) return;
        issues.push({ id: ref.id, title: a.title, group: c[1], weight: ref.weight || 0 });
      });
    });
    issues.sort(function (a, b) { return b.weight - a.weight; });

    var issueList = $('[data-r-issues]');
    issueList.innerHTML = '';
    $('[data-r-issues-block]').hidden = issues.length === 0;
    issues.slice(0, 8).forEach(function (i) {
      var li = el('li', 'finding');
      li.appendChild(el('span', 'finding__tag', i.group));
      li.appendChild(el('p', 'finding__title', i.title));
      issueList.appendChild(li);
    });

    showStep('result');
    dialog.focus();
  }

  /* ------------------------------------------------------------ running */
  var STAGES = [
    [0,     'Připojujeme se k webu…',              8],
    [2500,  'Načítáme stránku na pomalém 4G…',    26],
    [9000,  'Měříme rychlost vykreslování…',      48],
    [17000, 'Kontrolujeme SEO a přístupnost…',    68],
    [26000, 'Procházíme, co web zpomaluje…',      84],
    [36000, 'Sestavujeme report…',                93]
  ];

  function startProgress() {
    clearTimers();
    STAGES.forEach(function (s) {
      timers.push(setTimeout(function () {
        runStat.textContent = s[1];
        runBar.style.width = s[2] + '%';
      }, s[0]));
    });
  }

  function fail(message) {
    clearTimers();
    errMsg.textContent = message;
    showStep('error');
  }

  function run(url) {
    lastUrl = url;
    runUrl.textContent = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    runBar.style.width = '8%';
    runStat.textContent = STAGES[0][1];
    showStep('run');
    startProgress();

    var params = ['url=' + encodeURIComponent(url), 'strategy=' + strategy, 'locale=cs'];
    ['performance', 'accessibility', 'best-practices', 'seo'].forEach(function (c) {
      params.push('category=' + c);
    });
    if (PSI_KEY) params.push('key=' + encodeURIComponent(PSI_KEY));

    controller = window.AbortController ? new AbortController() : null;
    var timeout = setTimeout(function () { if (controller) controller.abort(); }, TIMEOUT);

    fetch(PSI_URL + '?' + params.join('&'), controller ? { signal: controller.signal } : undefined)
      .then(function (res) {
        return res.json().then(function (body) { return { status: res.status, body: body }; });
      })
      .then(function (r) {
        clearTimeout(timeout);
        clearTimers();

        if (r.status !== 200 || (r.body && r.body.error)) {
          var e = (r.body && r.body.error) || {};
          if (r.status === 429) {
            if (!PSI_KEY) {
              return fail(IS_DEV
                ? 'Chybí API klíč k PageSpeed Insights. Doplňte ho do index.html jako ' +
                  '<meta name="psi-api-key" content="…"> — návod je v hlavičce souboru audit.js.'
                : 'Měření je právě přetížené. Zkuste to prosím za chvíli — nebo si rovnou ' +
                  'domluvte hovor a projdeme web spolu.');
            }
            return fail('Denní limit měření je vyčerpaný. Zkuste to prosím zítra — nebo si ' +
                        'domluvte hovor a projdeme web spolu.');
          }
        /* Google reports a bad key as 400 too, so tell the two apart by reason
           before blaming the visitor's address. */
          var keyProblem = r.status === 403 ||
            (e.details || []).some(function (d) { return d.reason === 'API_KEY_INVALID'; }) ||
            /api key/i.test(e.message || '');

          if (keyProblem) {
            if (window.console) console.error('audit.js: PageSpeed Insights rejected the API key —', e.message || r.status);
            return fail(IS_DEV
              ? 'Google odmítl API klíč: ' + (e.message || 'neplatný klíč') +
                ' Zkontrolujte <meta name="psi-api-key"> v index.html a omezení klíče na doménu.'
              : 'Měření je dočasně nedostupné. Zkuste to prosím později — nebo si domluvte hovor a projdeme web spolu.');
          }
          if (r.status === 400) {
            return fail('Adresu se nepodařilo načíst. Zkontrolujte, že web běží a je veřejně dostupný.');
          }
          if (window.console) console.error('audit.js: PSI error', r.status, e.message || '');
          return fail('Google vrátil při měření chybu. Zkuste to prosím znovu za chvíli.');
        }

        var lh = r.body.lighthouseResult;
        if (!lh) return fail('Z měření se nevrátila žádná data. Zkuste to prosím znovu.');
        if (lh.runtimeError && lh.runtimeError.code !== 'NO_ERROR') {
          return fail(lh.runtimeError.message ||
            'Stránku se nepodařilo načíst — může být offline, chráněná heslem nebo blokuje roboty.');
        }

        runBar.style.width = '100%';
        try {
          renderReport(r.body);
        } catch (e) {
          /* keep a rendering bug from masquerading as a connection problem */
          if (window.console) console.error('audit: render failed', e);
          fail('Report se nepodařilo zobrazit. Otevřete prosím plný report na PageSpeed Insights.');
        }
      })
      .catch(function (err) {
        clearTimeout(timeout);
        clearTimers();
        if (err && err.name === 'AbortError') return;   /* cancelled or timed out */
        fail('Nepodařilo se spojit s Google PageSpeed Insights. Zkontrolujte připojení a zkuste to znovu.');
      });
  }

  /* ------------------------------------------------------- open / close */
  function open() {
    lastFocus = document.activeElement;
    showStep('start');
    root.hidden = false;
    document.body.classList.add('audit-open');
    requestAnimationFrame(function () { root.classList.add('is-open'); });
    input.focus();
  }

  function close() {
    if (controller) { controller.abort(); controller = null; }
    clearTimers();
    root.classList.remove('is-open');
    document.body.classList.remove('audit-open');
    window.setTimeout(function () { root.hidden = true; }, 260);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function trap(e) {
    if (e.key !== 'Tab') return;
    var list = Array.prototype.filter.call(
      dialog.querySelectorAll('button, [href], input, textarea, select'),
      function (n) { return !n.disabled && n.offsetParent !== null; }
    );
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* --------------------------------------------------------- listeners */
  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-audit-open]');
    if (opener) { e.preventDefault(); open(); return; }

    if (root.hidden) return;

    if (e.target.closest('[data-audit-close]')) { close(); return; }

    var seg = e.target.closest('.seg__opt');
    if (seg && root.contains(seg)) {
      strategy = seg.dataset.strategy;
      root.querySelectorAll('.seg__opt').forEach(function (b) {
        var on = b === seg;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      return;
    }

    if (e.target.closest('[data-audit-cancel]')) {
      if (controller) { controller.abort(); controller = null; }
      clearTimers();
      showStep('start');
      input.focus();
      return;
    }
    if (e.target.closest('[data-audit-again]')) { showStep('start'); input.focus(); return; }
    if (e.target.closest('[data-audit-retry]') && lastUrl) { run(lastUrl); }
  });

  document.addEventListener('keydown', function (e) {
    if (root.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    trap(e);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var url = normalize(input.value);
    var field = input.closest('.field');
    if (!url) {
      field.classList.add('has-error');
      input.focus();
      return;
    }
    field.classList.remove('has-error');
    run(url);
  });

  input.addEventListener('input', function () {
    input.closest('.field').classList.remove('has-error');
  });
})();
