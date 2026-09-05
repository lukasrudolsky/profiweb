/* =====================================================================
   Smooth scrolling - Lenis eases the window towards the wheel instead of
   jumping a notch at a time.

   It drives the real scroll position (no transform on a wrapper), so
   position:sticky on the header, the IntersectionObserver reveals and
   every scroll listener already on the page keep working untouched.
   ===================================================================== */
(function () {
  'use strict';

  /* The library is a plain <script> before this one; if it failed to load
     the page just scrolls natively, which is the correct fallback. */
  if (!window.Lenis) return;

  var lenis = new Lenis({
    /* How far the page lags the wheel: lower is a longer, heavier glide,
       higher is closer to native. 0.1 is Lenis's own default. */
    lerp: 0.085,
    wheelMultiplier: 1,
    /* Touch stays native. Phones already scroll with momentum, and syncing
       it fights the address bar sliding in and out mid-gesture. */
    syncTouch: false,
    /* Lenis runs its own requestAnimationFrame loop. */
    autoRaf: true
    /* respectReducedMotion defaults to true: with "prefers-reduced-motion:
       reduce" the easing turns itself off and scrolling goes back to 1:1. */
  });

  /* Same-page anchors: the browser's instant jump would skip the glide and
     land the target under the sticky header. This listener is registered
     last (the file loads after booking.js), so a click something else has
     already claimed - "#booking" opening the modal - arrives with
     defaultPrevented set and is left alone. */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var link = e.target.closest('a[href^="#"]');
    if (!link || link.getAttribute('href').length < 2) return;

    var target = document.getElementById(link.getAttribute('href').slice(1));
    /* offsetParent is null for a display:none or position:fixed target: the
       modal overlays match "#booking" but are not somewhere to scroll to. */
    if (!target || target.offsetParent === null) return;

    var header = document.querySelector('.site-header');
    e.preventDefault();
    lenis.scrollTo(target, {
      /* Clear the floating bar plus the gap it sits in, so the heading
         underneath does not arrive hidden behind it. */
      offset: header ? -(header.offsetHeight + 40) : 0
    });
  });
}());
