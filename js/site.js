/* zeindergham.me · language switch, flow diagrams, reveal, counters, video loops, sector tabs */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------- Language ---------- */
  var META = {
    en: { title: 'Zein Dergham · AI systems for real organizations · Leipzig' },
    de: { title: 'Zein Dergham · KI-Systeme für echte Organisationen · Leipzig' }
  };
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function setLang(l, persist) {
    l = l === 'de' ? 'de' : 'en';
    root.lang = l;
    document.title = META[l].title;
    document.querySelectorAll('[data-count]').forEach(function (c) { if (c._fmt) c._fmt(); });
    if (persist) {
      store('lang', l);
      var u = new URL(location.href);
      if (l === 'de') u.searchParams.set('lang', 'de'); else u.searchParams.delete('lang');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
  }
  var q = new URLSearchParams(location.search).get('lang');
  setLang(q || store('lang') || ((navigator.language || '').toLowerCase().indexOf('de') === 0 ? 'de' : 'en'), false);
  document.querySelectorAll('[data-set]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-set'), true); });
  });

  /* ---------- Flow diagrams ---------- */
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function biText(parent, attrs, en, de) {
    var g = el('g', {}, parent);
    var a = el('text', attrs, g); a.textContent = en; a.setAttribute('data-l', 'en');
    var b = el('text', attrs, g); b.textContent = de; b.setAttribute('data-l', 'de');
    return g;
  }

  // spec: {inputs:[[en,de]...], outputs:[[en,de]...], core:[en,de], labels:[[en,de],[en,de]]}
  function buildFlow(svg, spec) {
    var vertical = window.innerWidth < 640;
    var nIn = spec.inputs.length, nOut = spec.outputs.length, boxH = 40;
    var W, H, cx, cy, boxW, inPos = [], outPos = [];
    if (!vertical) {
      // Left-to-right: inputs | core | outputs
      var rowH = 64, n = Math.max(nIn, nOut);
      W = 600; H = 40 + n * rowH; cx = W / 2; cy = 40 + (n * rowH) / 2; boxW = 182;
      var rowY = function (i, count) { return 40 + (n * rowH - count * rowH) / 2 + i * rowH + rowH / 2; };
      for (var i = 0; i < nIn; i++) { var y = rowY(i, nIn); inPos.push({ x: 0, y: y - boxH / 2, d: 'M' + boxW + ' ' + y + ' C ' + (boxW + 70) + ' ' + y + ', ' + (cx - 90) + ' ' + cy + ', ' + (cx - 40) + ' ' + cy }); }
      for (var j = 0; j < nOut; j++) { var y2 = rowY(j, nOut); outPos.push({ x: W - boxW, y: y2 - boxH / 2, d: 'M' + (cx + 40) + ' ' + cy + ' C ' + (cx + 90) + ' ' + cy + ', ' + (W - boxW - 70) + ' ' + y2 + ', ' + (W - boxW) + ' ' + y2 }); }
    } else {
      // Phone: inputs on top in two columns, core in the middle, outputs below
      W = 360; boxW = 172; var gap = 16, rowGap = 12, top = 26;
      var inRows = Math.ceil(nIn / 2), outRows = Math.ceil(nOut / 2);
      var inBottom = top + inRows * boxH + (inRows - 1) * rowGap;
      cx = W / 2; cy = inBottom + 90;
      var outTop = cy + 90;
      H = outTop + outRows * boxH + (outRows - 1) * rowGap + 30;
      var place = function (k, count, y0) {
        var row = Math.floor(k / 2), col = k % 2;
        var lastSingle = count % 2 === 1 && k === count - 1;
        var x = lastSingle ? (W - boxW) / 2 : col * (boxW + gap);
        return { x: x, y: y0 + row * (boxH + rowGap) };
      };
      for (var a = 0; a < nIn; a++) { var q1 = place(a, nIn, top), bx = q1.x + boxW / 2, by = q1.y + boxH;
        q1.d = 'M' + bx + ' ' + by + ' C ' + bx + ' ' + (by + 40) + ', ' + cx + ' ' + (cy - 90) + ', ' + cx + ' ' + (cy - 40); inPos.push(q1); }
      for (var b2 = 0; b2 < nOut; b2++) { var q2 = place(b2, nOut, outTop), ox = q2.x + boxW / 2;
        q2.d = 'M' + cx + ' ' + (cy + 40) + ' C ' + cx + ' ' + (cy + 90) + ', ' + ox + ' ' + (q2.y - 40) + ', ' + ox + ' ' + q2.y; outPos.push(q2); }
    }
    svg.setAttribute('viewBox', '-2 -2 ' + (W + 4) + ' ' + (H + 4));
    svg.classList.add('flow');
    var wires = el('g', {}, svg), dots = el('g', {}, svg);
    if (spec.labels) {
      var ly2 = vertical ? H - 6 : 14;
      biText(svg, { x: 0, y: 14, 'class': 'col-label' }, spec.labels[0][0], spec.labels[0][1]);
      biText(svg, { x: vertical ? 0 : W, y: ly2, 'class': 'col-label', 'text-anchor': vertical ? 'start' : 'end' }, spec.labels[1][0], spec.labels[1][1]);
    }
    var fs = vertical ? 13 : 14;
    var inPaths = [], outPaths = [], outNodes = [];
    spec.inputs.forEach(function (t, i) {
      var P = inPos[i];
      inPaths.push(el('path', { d: P.d, 'class': 'wire' }, wires));
      var g = el('g', { 'class': 'node in' }, svg);
      el('rect', { x: P.x, y: P.y, width: boxW, height: boxH, rx: 2 }, g);
      biText(g, { x: P.x + 12, y: P.y + boxH / 2 + 5, 'font-size': fs }, t[0], t[1]);
    });
    spec.outputs.forEach(function (t, i) {
      var P = outPos[i];
      outPaths.push(el('path', { d: P.d, 'class': 'wire live' }, wires));
      var g = el('g', { 'class': 'node out' }, svg);
      el('rect', { x: P.x, y: P.y, width: boxW, height: boxH, rx: 2 }, g);
      el('rect', { x: P.x, y: P.y, width: 5, height: boxH, 'class': 'lit' }, g);
      biText(g, { x: P.x + 16, y: P.y + boxH / 2 + 5, 'font-size': fs }, t[0], t[1]);
      outNodes.push(g);
    });
    el('circle', { cx: cx, cy: cy, r: 58, 'class': 'core-ring' }, svg);
    el('circle', { cx: cx, cy: cy, r: 50, 'class': 'core-ring r2' }, svg);
    var core = el('circle', { cx: cx, cy: cy, r: 40, 'class': 'core' }, svg);
    var coreWords = [spec.core[0].split('\n'), spec.core[1].split('\n')];
    ['en', 'de'].forEach(function (l, li) {
      var words = coreWords[li];
      words.forEach(function (w, wi) {
        var t = el('text', { x: cx, y: cy + 4 + (wi - (words.length - 1) / 2) * 14, 'class': 'core-label' }, svg);
        t.textContent = w; t.setAttribute('data-l', l);
      });
    });
    if (reduce) { outNodes.forEach(function (g) { g.classList.add('on'); }); return; }

    var colors = ['#0088b0', '#d6006c', '#edbb00'];
    var particles = [], last = 0, spawnT = 0, visible = false;
    var io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) requestAnimationFrame(tick); }, { threshold: 0.05 });
    io.observe(svg);
    function spawn() {
      var i = Math.floor(Math.random() * inPaths.length);
      particles.push({ path: inPaths[i], len: inPaths[i].getTotalLength(), t: 0, stage: 0, c: colors[Math.floor(Math.random() * 3)],
        node: null });
      var p = particles[particles.length - 1]; p.node = el('circle', { r: 4.5, fill: p.c }, dots);
    }
    function tick(now) {
      if (!visible) { last = 0; return; }
      var dt = last ? Math.min(now - last, 50) : 16; last = now;
      spawnT += dt;
      if (spawnT > 420) { spawnT = 0; spawn(); }
      for (var k = particles.length - 1; k >= 0; k--) {
        var p = particles[k];
        p.t += dt / 1300;
        if (p.t >= 1) {
          if (p.stage === 0) {
            core.classList.remove('pulse'); void core.getBBox(); core.classList.add('pulse');
            var j = Math.floor(Math.random() * outPaths.length);
            p.path = outPaths[j]; p.len = outPaths[j].getTotalLength(); p.t = 0; p.stage = 1; p.out = j;
          } else {
            var g = outNodes[p.out]; g.classList.add('on');
            clearTimeout(g._t); g._t = setTimeout(function (gg) { gg.classList.remove('on'); }.bind(null, g), 900);
            p.node.remove(); particles.splice(k, 1); continue;
          }
        }
        var e = p.t < .5 ? 2 * p.t * p.t : 1 - Math.pow(-2 * p.t + 2, 2) / 2;
        var pt = p.path.getPointAtLength(e * p.len);
        p.node.setAttribute('cx', pt.x); p.node.setAttribute('cy', pt.y);
      }
      requestAnimationFrame(tick);
    }
  }
  window.__FLOWS = window.__FLOWS || {};
  document.querySelectorAll('svg[data-flow]').forEach(function (svg) {
    var spec = window.__FLOWS[svg.getAttribute('data-flow')];
    if (spec) buildFlow(svg, spec);
  });

  /* ---------- Reveal + counters + method bars ---------- */
  function count(elm) {
    var to = parseFloat(elm.getAttribute('data-count')), dec = +(elm.getAttribute('data-dec') || 0);
    function fmt(v) { var t = v.toFixed(dec); return root.lang === 'de' ? t.replace('.', ',') : t; }
    elm._fmt = function () { elm.textContent = fmt(to); };
    if (reduce) { elm._fmt(); return; }
    var t0 = null;
    function step(t) {
      if (!t0) t0 = t;
      var k = Math.min((t - t0) / 1400, 1), e = 1 - Math.pow(1 - k, 3);
      elm.textContent = fmt(to * e);
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var ro = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      e.target.querySelectorAll('[data-count]').forEach(count);
      ro.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('[data-reveal], .band, .method').forEach(function (n) { ro.observe(n); });

  /* ---------- Video loops: load and play only on screen ---------- */
  var vo = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        if (!v.src && v.dataset.src) v.src = v.dataset.src;
        if (!reduce) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
      } else if (!v.paused) v.pause();
    });
  }, { threshold: 0.25 });
  document.querySelectorAll('video[data-src]').forEach(function (v) { vo.observe(v); });

  /* ---------- Sector tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(t); });
    t.addEventListener('keydown', function (e) {
      var d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });
  var hash = location.hash.replace('#', '');
  var fromHash = tabs.filter(function (t) { return t.getAttribute('aria-controls') === hash; })[0];
  if (fromHash) select(fromHash);
})();
