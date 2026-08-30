/*!
 * hero-gradient.js
 * Animovaná holografická plocha z Figma uzlu 920:39 (Profiweb.cz).
 * Textura se nepřekresluje, fragment shader jen ohýbá vzorkovací
 * souřadnice pomalým domain warpem. Bez závislostí.
 *
 * Použití:
 *   <div class="collage__wash" data-hero-gradient
 *        data-src="assets/img/hero-gradient.webp"></div>
 *
 * Simplex noise: Ian McEwan, Ashima Arts (MIT).
 */
(function () {
  "use strict";

  /* Zapečené hodnoty. Pohyb dělají dvě různé věci: WARP ohýbá souřadnice
     (vlnění), nad zhruba 0.03 začne krabatit tenkou obloukovou linku vlevo
     dole. DRIFT je tuhý posun celého pole po pomalé elipse s periodou kolem
     31 s, nic nezkresluje — dodatečnou viditelnost pohybu ber odsud. */
  var SPEED = 1.0;   // násobič času
  var WARP  = 0.018; // amplituda ohybu v uv jednotkách
  var DRIFT = 0.050; // tuhé unášení celého pole
  var ANISO = 0.55;  // potlačení svislé složky posunu
  var MAX_DPR = 1.75;

  var VERT =
    "attribute vec2 aPos;" +
    "varying vec2 vUv;" +
    "void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }";

  var FRAG = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform sampler2D uTex;",
    "uniform float uTime;",
    "uniform float uAspect;",
    "uniform float uTexAspect;",

    "vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}",
    "vec2 mod289(vec2 x){return x - floor(x*(1.0/289.0))*289.0;}",
    "vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}",

    /* zrcadlové opakování bez nutnosti mocnin dvou v rozměrech textury */
    "vec2 mirror(vec2 v){ return abs(fract((v + 1.0) * 0.5) * 2.0 - 1.0); }",

    "float snoise(vec2 v){",
    "  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);",
    "  vec2 i  = floor(v + dot(v, C.yy));",
    "  vec2 x0 = v - i + dot(i, C.xx);",
    "  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);",
    "  vec4 x12 = x0.xyxy + C.xxzz;",
    "  x12.xy -= i1;",
    "  i = mod289(i);",
    "  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));",
    "  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);",
    "  m = m*m; m = m*m;",
    "  vec3 x = 2.0 * fract(p * C.www) - 1.0;",
    "  vec3 h = abs(x) - 0.5;",
    "  vec3 ox = floor(x + 0.5);",
    "  vec3 a0 = x - ox;",
    "  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);",
    "  vec3 g;",
    "  g.x  = a0.x  * x0.x  + h.x  * x0.y;",
    "  g.yz = a0.yz * x12.xz + h.yz * x12.yw;",
    "  return 130.0 * dot(m, g);",
    "}",

    "void main(){",
    /* výřez typu cover, aby textura seděla v libovolném poměru stran */
    "  vec2 uv = vUv;",
    "  if (uAspect > uTexAspect) {",
    "    uv.y = (uv.y - 0.5) * (uTexAspect / uAspect) + 0.5;",
    "  } else {",
    "    uv.x = (uv.x - 0.5) * (uAspect / uTexAspect) + 0.5;",
    "  }",
    "  float t = uTime;",
    "  vec2 p = uv * vec2(uTexAspect, 1.0) * 0.95;",

    "  vec2 q = vec2( 0.5 * snoise(p + vec2(0.00, 0.00) + t * 0.055),",
    "                 0.5 * snoise(p + vec2(5.20, 1.30) - t * 0.047) );",
    "  vec2 r = vec2( 0.5 * snoise(p + 1.6 * q + vec2(1.70, 9.20) + t * 0.041),",
    "                 0.5 * snoise(p + 1.6 * q + vec2(8.30, 2.80) - t * 0.034) );",

    "  vec2 off = (q * 0.40 + r * 0.60) * " + WARP.toFixed(5) + ";",
    "  off += vec2(sin(t * 0.20), cos(t * 0.155)) * " + DRIFT.toFixed(5) + ";",
    "  off.y *= " + ANISO.toFixed(3) + ";",

    "  gl_FragColor = vec4(texture2D(uTex, mirror(uv + off)).rgb, 1.0);",
    "}"
  ].join("\n");

  function init(host) {
    var src = host.getAttribute("data-src");
    if (!src) return;

    var img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.setAttribute("aria-hidden", "true");
    img.src = src;
    host.appendChild(img);

    var canvas = document.createElement("canvas");
    var gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false })
          || canvas.getContext("experimental-webgl");
    if (!gl) return; /* fallback: zůstává vidět statický <img> */
    host.appendChild(canvas);

    function compile(type, source) {
      var s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { host.removeChild(canvas); return; }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { host.removeChild(canvas); return; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var uTime      = gl.getUniformLocation(prog, "uTime");
    var uAspect    = gl.getUniformLocation(prog, "uAspect");
    var uTexAspect = gl.getUniformLocation(prog, "uTexAspect");
    gl.uniform1i(gl.getUniformLocation(prog, "uTex"), 0);

    var tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    var ready = false, clock = 0, last = 0, running = false, raf = 0;
    var visible = true, dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

    function resize() {
      var rect = host.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width * dpr));
      var h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform1f(uAspect, w / h);
      if (ready && !running) draw();
    }

    function draw() {
      gl.uniform1f(uTime, clock);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(now) {
      if (!running) return;
      clock += (last ? Math.min((now - last) / 1000, 0.05) : 0) * SPEED;
      last = now;
      draw();
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || !ready || !visible) return;
      if (reduce && reduce.matches) { draw(); return; }
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function upload() {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      } catch (e) {
        /* tainted canvas, například při otevření přes file://
           nebo obrázek z jiné domény bez CORS hlaviček */
        host.removeChild(canvas);
        return;
      }
      gl.uniform1f(uTexAspect, img.naturalWidth / img.naturalHeight);
      ready = true;
      resize();
      draw();
      host.setAttribute("data-gl", "on"); /* až teď schovej statický obrázek */
      start();
    }

    if (img.complete && img.naturalWidth) upload();
    else img.addEventListener("load", upload);

    if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
    window.addEventListener("resize", resize);

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }, { threshold: 0 }).observe(host);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });

    if (reduce && reduce.addEventListener) {
      reduce.addEventListener("change", function () {
        if (reduce.matches) stop(); else start();
      });
    }
  }

  function boot() {
    var nodes = document.querySelectorAll("[data-hero-gradient]");
    for (var i = 0; i < nodes.length; i++) init(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
