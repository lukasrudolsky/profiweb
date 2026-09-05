/* =====================================================================
   Style guide: renders swatches and specimens straight from the live
   token values, so this page can never drift from styles.css. Read the
   computed :root rather than hard-coding a copy of the palette.
   ===================================================================== */
(function () {
  'use strict';

  var css = getComputedStyle(document.documentElement);
  var val = function (t) { return css.getPropertyValue(t).trim(); };

  /* Colours ---------------------------------------------------------- */
  [].forEach.call(document.querySelectorAll('[data-swatches]'), function (host) {
    host.getAttribute('data-swatches').split(',').forEach(function (token) {
      var v = val(token);
      var cell = document.createElement('figure');
      cell.className = 'sg__swatch';

      var chip = document.createElement('span');
      chip.className = 'sg__chip';
      chip.style.background = v;

      var cap = document.createElement('figcaption');
      cap.innerHTML = '<code>' + token + '</code><em>' + v + '</em>';

      cell.appendChild(chip);
      cell.appendChild(cap);
      host.appendChild(cell);
    });
  });

  /* Radii ------------------------------------------------------------ */
  [].forEach.call(document.querySelectorAll('[data-radii]'), function (host) {
    host.getAttribute('data-radii').split(',').forEach(function (token) {
      var v = val(token);
      var cell = document.createElement('figure');
      cell.className = 'sg__radius';
      cell.innerHTML = '<span style="border-radius:' + v + '"></span>' +
                       '<figcaption><code>' + token + '</code><em>' + v + '</em></figcaption>';
      host.appendChild(cell);
    });
  });

  /* Icons - pulled from the sprite the site already ships ------------ */
  var iconHost = document.querySelector('[data-icons]');
  if (iconHost) {
    fetch('index.html')
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var sprite = doc.querySelector('.icon-sprite');
        if (!sprite) return;
        document.body.appendChild(document.importNode(sprite, true));

        [].forEach.call(sprite.querySelectorAll('symbol'), function (sym) {
          var id = sym.getAttribute('id');
          var cell = document.createElement('figure');
          cell.className = 'sg__icon';
          cell.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#' + id + '"></use></svg>' +
            '<figcaption><code>' + id.replace(/^i-/, '') + '</code></figcaption>';
          iconHost.appendChild(cell);
        });
      })
      .catch(function () {
        iconHost.textContent = 'Sprite se nepodařilo načíst, otevřete přes http, ne file://.';
      });
  }
})();
