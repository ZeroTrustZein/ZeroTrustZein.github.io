/* zeindergham.me · interactive lab: payment-graph detector, branch leak detector, AI roadmap builder.
   Everything here runs in the browser on sample data. It illustrates how the real systems work;
   it is not the production code. */
(function () {
  'use strict';
  var root = document.documentElement;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function L() { return root.lang === 'de' ? 'de' : 'en'; }
  function bi(en, de) { return '<span data-l="en">' + en + '</span><span data-l="de">' + de + '</span>'; }
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function onVisible(node, cb) {
    var io = new IntersectionObserver(function (es) { cb(es[0].isIntersecting); }, { threshold: 0.15 });
    io.observe(node);
  }
  // Small deterministic RNG so the demos look the same on every load.
  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

  /* =====================================================================
     1. Payment-graph detector (illustrates Hopwire)
     ===================================================================== */
  (function graphDemo() {
    var svg = document.getElementById('hw-graph');
    if (!svg) return;
    var log = document.getElementById('hw-log');
    var stats = { pay: document.getElementById('hw-pay'), alerts: document.getElementById('hw-alerts'), skipped: document.getElementById('hw-skip') };
    var W = 640, H = 400;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var R = rng(7);
    var names = ['A-104', 'A-221', 'A-317', 'A-402', 'A-519', 'A-633', 'A-708', 'A-812', 'A-946', 'A-150', 'A-273', 'PAYROLL'];
    var nodes = names.map(function (n, i) {
      var hub = n === 'PAYROLL';
      var ang = (i / (names.length - 1)) * Math.PI * 2 + 0.3;
      var rad = hub ? 0 : 150 + (R() - 0.5) * 50;
      return { id: i, name: n, hub: hub, x: W / 2 + Math.cos(ang) * rad * 1.45, y: H / 2 + Math.sin(ang) * rad * 0.95 };
    });
    var gEdges = el('g', {}, svg), gNodes = el('g', {}, svg), gPulse = el('g', {}, svg);
    nodes.forEach(function (n) {
      var g = el('g', { 'class': 'hw-node' + (n.hub ? ' hub' : '') }, gNodes);
      el('circle', { cx: n.x, cy: n.y, r: n.hub ? 22 : 13 }, g);
      var t = el('text', { x: n.x, y: n.y + (n.hub ? 38 : 28), 'text-anchor': 'middle' }, g);
      t.textContent = n.name;
      n.g = g;
    });
    var edges = [], WINDOW = 22, count = 0, alerts = 0, skipped = 0;
    function addEdge(a, b, forced) {
      var x1 = nodes[a].x, y1 = nodes[a].y, x2 = nodes[b].x, y2 = nodes[b].y;
      var mx = (x1 + x2) / 2 + (y2 - y1) * 0.12, my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
      var path = el('path', { d: 'M' + x1 + ' ' + y1 + ' Q ' + mx + ' ' + my + ' ' + x2 + ' ' + y2, 'class': 'hw-edge' + (nodes[a].hub || nodes[b].hub ? ' hubedge' : '') }, gEdges);
      var e = { a: a, b: b, path: path, born: count };
      edges.push(e);
      if (edges.length > WINDOW) { var old = edges.shift(); old.path.remove(); }
      // travelling packet
      if (!reduce) {
        var dot = el('circle', { r: 4, 'class': 'hw-packet' }, gPulse);
        var len = path.getTotalLength(), t0 = null;
        var step = function (t) {
          if (!t0) t0 = t;
          var k = Math.min((t - t0) / 600, 1), p = path.getPointAtLength(k * len);
          dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
          if (k < 1) requestAnimationFrame(step); else dot.remove();
        };
        requestAnimationFrame(step);
      }
      count++;
      stats.pay.textContent = count;
      detect(e, forced);
    }
    // Bounded search: from b, look for a path back to a in at most 3 more hops (a cycle of 2-4 hops).
    // Hubs such as payroll are not expanded, so they can't blow up the search.
    function detect(e) {
      var adj = {};
      edges.forEach(function (x) { (adj[x.a] = adj[x.a] || []).push(x); });
      var found = null, hubHit = false;
      (function dfs(node, path, depth) {
        if (found || depth > 3) return;
        (adj[node] || []).forEach(function (x) {
          if (found) return;
          if (x.b === e.a) { found = path.concat([x]); return; }
          if (nodes[x.b].hub) { hubHit = true; return; }
          if (path.some(function (p) { return p.a === x.b; })) return;
          dfs(x.b, path.concat([x]), depth + 1);
        });
      })(e.b, [e], 1);
      if (hubHit && !found) { skipped++; stats.skipped.textContent = skipped; }
      if (!found) return;
      alerts++;
      stats.alerts.textContent = alerts;
      found.forEach(function (x) { x.path.classList.add('cycle'); });
      var ids = found.map(function (x) { return x.a; });
      ids.forEach(function (i) { nodes[i].g.classList.add('flag'); });
      setTimeout(function () {
        found.forEach(function (x) { x.path.classList.remove('cycle'); });
        ids.forEach(function (i) { nodes[i].g.classList.remove('flag'); });
      }, 2600);
      var route = ids.map(function (i) { return nodes[i].name; }).concat([nodes[ids[0]].name]).join(' → ');
      var li = document.createElement('li');
      li.innerHTML = '<b>' + bi('Cycle', 'Kreislauf') + ' · ' + found.length + ' ' + bi('hops', 'Sprünge') + '</b> ' + route;
      log.insertBefore(li, log.firstChild);
      while (log.children.length > 5) log.removeChild(log.lastChild);
    }
    function randomPayment() {
      var a = Math.floor(R() * nodes.length), b = Math.floor(R() * nodes.length);
      if (a === b) return;
      // payroll pays many accounts, like a real hub
      if (R() < 0.25) a = nodes.length - 1;
      addEdge(a, b);
    }
    function injectLoop() {
      var pool = nodes.filter(function (n) { return !n.hub; }).map(function (n) { return n.id; });
      var hops = 2 + Math.floor(R() * 3), chain = [];
      while (chain.length < hops) { var c = pool[Math.floor(R() * pool.length)]; if (chain.indexOf(c) < 0) chain.push(c); }
      chain.forEach(function (c, i) { setTimeout(function () { addEdge(c, chain[(i + 1) % chain.length]); }, i * 450); });
    }
    var timer = null, running = false, visible = false;
    var playBtn = document.getElementById('hw-play');
    function setRun(on) {
      running = on;
      playBtn.innerHTML = on ? bi('Pause', 'Pause') : bi('Play', 'Start');
      clearInterval(timer);
      if (on && visible) timer = setInterval(randomPayment, 700);
    }
    playBtn.addEventListener('click', function () { setRun(!running); });
    document.getElementById('hw-inject').addEventListener('click', injectLoop);
    onVisible(svg, function (v) { visible = v; setRun(running); });
    for (var i = 0; i < 10; i++) randomPayment();
    setRun(!reduce);
  })();

  /* =====================================================================
     2. Branch leak detector (illustrates YomYom's rules)
     ===================================================================== */
  (function leakDemo() {
    var host = document.getElementById('yy-table');
    if (!host) return;
    var slider = document.getElementById('yy-th');
    var out = document.getElementById('yy-th-v');
    var explain = document.getElementById('yy-explain');
    var branches = ['Hamra', 'Achrafieh', 'Jounieh', 'Byblos'];
    var days = { en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], de: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] };
    // Sample void rates (% of sales) per branch per day. Made-up demo data.
    var data = [
      [2.1, 2.4, 1.9, 2.2, 7.4, 2.8, 2.0],
      [1.6, 1.8, 1.5, 1.7, 2.0, 2.3, 1.9],
      [3.0, 3.2, 5.6, 3.1, 3.4, 6.1, 2.9],
      [1.2, 1.1, 1.4, 1.3, 1.6, 1.8, 4.3]
    ];
    function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.floor(s.length / 2)]; }
    function render() {
      var th = parseFloat(slider.value), l = L();
      out.textContent = (l === 'de' ? th.toFixed(1).replace('.', ',') : th.toFixed(1)) + '×';
      var html = '<table><thead><tr><th></th>' + days[l].map(function (d) { return '<th>' + d + '</th>'; }).join('') + '</tr></thead><tbody>';
      var flags = [];
      data.forEach(function (row, bi_) {
        var m = median(row);
        html += '<tr><th>' + branches[bi_] + '</th>';
        row.forEach(function (v, di) {
          var ratio = v / m, flag = ratio >= th;
          if (flag) flags.push({ b: branches[bi_], d: di, v: v, r: ratio, m: m });
          var val = l === 'de' ? v.toFixed(1).replace('.', ',') : v.toFixed(1);
          html += '<td class="' + (flag ? 'flag' : '') + '" style="--h:' + Math.min(v / 8, 1) + '">' + val + '%</td>';
        });
        html += '</tr>';
      });
      host.innerHTML = html + '</tbody></table>';
      if (!flags.length) {
        explain.innerHTML = bi('No flags at this threshold. Lower it to see what the rules catch.', 'Keine Warnungen bei dieser Schwelle. Senken Sie sie, um zu sehen, was die Regeln finden.');
        return;
      }
      explain.innerHTML = flags.map(function (f) {
        var r = f.r.toFixed(1), rd = r.replace('.', ',');
        return '<li>' + bi('<b>' + f.b + ', ' + days.en[f.d] + ':</b> voids were ' + f.v.toFixed(1) + '% of sales, ' + r + '× this branch’s usual ' + f.m.toFixed(1) + '%. Check who voided and whether the receipts match.',
          '<b>' + f.b + ', ' + days.de[f.d] + ':</b> Stornos lagen bei ' + f.v.toFixed(1).replace('.', ',') + ' % des Umsatzes, ' + rd + '× über dem üblichen Wert von ' + f.m.toFixed(1).replace('.', ',') + ' %. Prüfen, wer storniert hat und ob die Belege passen.') + '</li>';
      }).join('');
    }
    slider.addEventListener('input', render);
    document.querySelectorAll('[data-set]').forEach(function (b) { b.addEventListener('click', function () { setTimeout(render, 0); }); });
    render();
  })();

  /* =====================================================================
     3. AI roadmap builder
     ===================================================================== */
  (function roadmap() {
    var form = document.getElementById('rm-form');
    if (!form) return;
    var S = {
      re: { name: ['Real estate & construction', 'Immobilien & Bau'], pains: [
        { t: ['Listings typed again for every platform', 'Exposés für jede Plattform neu getippt'], q: ['Listing pipeline: one entry publishes the post, video and CRM record', 'Exposé-Pipeline: eine Eingabe erzeugt Post, Video und CRM-Eintrag'], c: ['CRM and website connected over APIs', 'CRM und Website über APIs verbunden'] },
        { t: ['Renders are slow and expensive', 'Renderings sind langsam und teuer'], q: ['Render model trained on your own portfolio', 'Rendermodell, trainiert auf Ihrem Portfolio'], c: ['Render step built into the design workflow', 'Rendering fest im Planungsablauf'] },
        { t: ['Clients call to ask about permits', 'Kunden rufen wegen Genehmigungen an'], q: ['Client portal showing permit stages', 'Kundenportal mit Genehmigungsstand'], c: ['Automatic status messages by email or WhatsApp', 'Automatische Statusmeldungen per E-Mail oder WhatsApp'] },
        { t: ['Leads go cold without follow-up', 'Leads verlaufen ohne Nachfassen'], q: ['AI-written follow-up sequences', 'KI-formulierte Nachfass-Sequenzen'], c: ['Lead scoring from your past deals', 'Lead-Scoring aus vergangenen Abschlüssen'] }
      ] },
      hosp: { name: ['Restaurants & hotels', 'Gastronomie & Hotels'], pains: [
        { t: ['I can’t see all branches at once', 'Ich sehe nicht alle Filialen auf einen Blick'], q: ['Daily KPI brief per branch from POS exports', 'Täglicher KPI-Bericht je Filiale aus POS-Exporten'], c: ['Group dashboard with targets and trends', 'Gruppen-Dashboard mit Zielen und Trends'] },
        { t: ['Voids, comps and cash don’t add up', 'Stornos, Freigaben und Kasse stimmen nicht'], q: ['Leak and fraud rules on every shift', 'Verlust- und Betrugsregeln für jede Schicht'], c: ['Explained alerts sent to the owner’s phone', 'Erklärte Warnungen direkt aufs Handy'] },
        { t: ['Bookings and questions flood WhatsApp', 'Buchungen und Fragen fluten WhatsApp'], q: ['Guest assistant for bookings and FAQs', 'Gäste-Assistent für Buchungen und FAQs'], c: ['Assistant connected to the booking system', 'Assistent mit Buchungssystem verbunden'] },
        { t: ['Stock runs out or goes to waste', 'Ware fehlt oder verdirbt'], q: ['Reorder suggestions from sales history', 'Bestellvorschläge aus der Verkaufshistorie'], c: ['Demand forecast per branch and day', 'Nachfrageprognose je Filiale und Tag'] }
      ] },
      edu: { name: ['Schools & universities', 'Schulen & Hochschulen'], pains: [
        { t: ['Teachers drown in grading', 'Lehrkräfte ertrinken in Korrekturen'], q: ['Feedback drafts the teacher checks and signs off', 'Feedback-Entwürfe zur Prüfung durch die Lehrkraft'], c: ['Rubric-based feedback across subjects', 'Bewertungsraster für alle Fächer'] },
        { t: ['Parents message in three languages', 'Eltern schreiben in drei Sprachen'], q: ['Trilingual parent assistant for common questions', 'Dreisprachiger Eltern-Assistent für häufige Fragen'], c: ['Assistant connected to timetables and notices', 'Assistent mit Stundenplänen und Aushängen verbunden'] },
        { t: ['We notice struggling students too late', 'Wir bemerken Probleme zu spät'], q: ['Attendance and grades dashboard', 'Dashboard für Anwesenheit und Noten'], c: ['Early-warning model with counsellor follow-up', 'Frühwarnmodell mit Begleitung durch Beratung'] },
        { t: ['Staff don’t know how to use AI', 'Das Kollegium weiß nicht, wie man KI nutzt'], q: ['Hands-on AI workshop for staff', 'Praxis-Workshop zu KI für das Kollegium'], c: ['School AI policy and shared prompt library', 'KI-Richtlinie und gemeinsame Prompt-Bibliothek'] }
      ] },
      health: { name: ['Clinics & healthcare', 'Kliniken & Praxen'], pains: [
        { t: ['Patients miss appointments', 'Patienten verpassen Termine'], q: ['WhatsApp booking and reminder assistant', 'WhatsApp-Assistent für Termine und Erinnerungen'], c: ['Waitlist that refills cancelled slots', 'Warteliste, die abgesagte Termine neu vergibt'] },
        { t: ['Patient files are on paper', 'Patientenakten sind auf Papier'], q: ['Digital records with database-enforced access', 'Digitale Akten mit Zugriffsschutz in der Datenbank'], c: ['Scanning pipeline for the paper archive', 'Scan-Pipeline für das Papierarchiv'] },
        { t: ['Doctors spend hours on notes', 'Ärzte verbringen Stunden mit Notizen'], q: ['Visit-note summaries by a private model', 'Zusammenfassungen durch ein privates Modell'], c: ['Model hosted on the clinic’s own server', 'Modell auf dem eigenen Server der Klinik'] },
        { t: ['Power cuts stop our systems', 'Stromausfälle legen Systeme lahm'], q: ['Battery-backed storage and network', 'Batteriegepufferter Speicher und Netz'], c: ['Offline-first apps that sync later', 'Offline-fähige Apps mit späterem Sync'] }
      ] },
      fin: { name: ['Banks & finance', 'Banken & Finanzen'], pains: [
        { t: ['Rules miss layered transfers', 'Regeln übersehen verschachtelte Überweisungen'], q: ['Graph-based cycle detection on a data sample', 'Graphbasierte Kreislauf-Erkennung an einer Datenprobe'], c: ['Real-time engine on the payment stream', 'Echtzeit-Engine am Zahlungsstrom'] },
        { t: ['Too many false positives', 'Zu viele Fehlalarme'], q: ['Alert review on your historic cases', 'Prüfung der Alarme an historischen Fällen'], c: ['Scoring model tuned on your own data', 'Bewertungsmodell, abgestimmt auf Ihre Daten'] },
        { t: ['Reports for the regulator take days', 'Berichte für die Aufsicht dauern Tage'], q: ['Automated case report drafts', 'Automatische Entwürfe für Fallberichte'], c: ['Audit trail from alert to decision', 'Prüfpfad vom Alarm bis zur Entscheidung'] }
      ] },
      gov: { name: ['Government & municipalities', 'Verwaltung & Gemeinden'], pains: [
        { t: ['Citizens queue to ask about status', 'Bürger stehen für Statusfragen Schlange'], q: ['Online status tracker for applications', 'Online-Statusverfolgung für Anträge'], c: ['SMS or WhatsApp updates at each stage', 'SMS- oder WhatsApp-Updates je Schritt'] },
        { t: ['Forms are retyped by hand', 'Formulare werden von Hand abgetippt'], q: ['Data extraction from scanned forms', 'Datenextraktion aus gescannten Formularen'], c: ['Browser agents that fill legacy portals', 'Browser-Agenten für Altportale'] },
        { t: ['Data must stay in the country', 'Daten müssen im Land bleiben'], q: ['Private model on government hardware', 'Privates Modell auf eigener Hardware'], c: ['Private network with no public exposure', 'Privates Netz ohne öffentliche Erreichbarkeit'] }
      ] }
    };
    var sectorBox = document.getElementById('rm-sectors'), painBox = document.getElementById('rm-pains'), out = document.getElementById('rm-out');
    var current = 're';
    Object.keys(S).forEach(function (k, i) {
      var lab = document.createElement('label');
      lab.className = 'pill';
      lab.innerHTML = '<input type="radio" name="rm-sector" value="' + k + '"' + (i === 0 ? ' checked' : '') + '>' + bi(S[k].name[0], S[k].name[1]);
      sectorBox.appendChild(lab);
    });
    function renderPains() {
      painBox.innerHTML = '';
      S[current].pains.forEach(function (p, i) {
        var lab = document.createElement('label');
        lab.className = 'check';
        lab.innerHTML = '<input type="checkbox" value="' + i + '"' + (i < 2 ? ' checked' : '') + '><span>' + bi(p.t[0], p.t[1]) + '</span>';
        painBox.appendChild(lab);
      });
      build();
    }
    function build() {
      var picked = Array.prototype.slice.call(painBox.querySelectorAll('input:checked')).map(function (c) { return S[current].pains[+c.value]; });
      var size = form.querySelector('[name=rm-size]:checked').value;
      if (!picked.length) {
        out.innerHTML = '<p class="rm-empty">' + bi('Tick at least one problem to see a plan.', 'Wählen Sie mindestens ein Problem, um einen Plan zu sehen.') + '</p>';
        return;
      }
      var first = picked[0];
      var auditLen = size === 's' ? ['1 week', '1 Woche'] : size === 'm' ? ['1–2 weeks', '1–2 Wochen'] : ['2–3 weeks', '2–3 Wochen'];
      var cols = [
        { n: '01', h: ['Audit', 'Audit'], w: auditLen, items: [['Map how ' + picked.length + ' problem' + (picked.length > 1 ? 's' : '') + ' show up in your daily work', 'Erfassen, wie sich ' + picked.length + ' Problem' + (picked.length > 1 ? 'e' : '') + ' im Alltag zeigen'], ['Check what data you already have', 'Prüfen, welche Daten schon vorhanden sind'], ['Ranked list of fixes with effort and impact', 'Priorisierte Liste mit Aufwand und Nutzen']] },
        { n: '02', h: ['Quick win', 'Schneller Erfolg'], w: ['first 30 days', 'erste 30 Tage'], items: [first.q, ['Measure before and after', 'Vorher und nachher messen']] },
        { n: '03', h: ['Core systems', 'Kernsysteme'], w: ['months 2–6', 'Monate 2–6'], items: picked.slice(1).map(function (p) { return p.q; }).concat(picked.map(function (p) { return p.c; })).slice(0, 4) },
        { n: '04', h: ['Handover', 'Übergabe'], w: ['ongoing', 'laufend'], items: [['Staff training in your language', 'Schulung in Ihrer Sprache'], ['Documentation, code and data are yours', 'Dokumentation, Code und Daten gehören Ihnen']] }
      ];
      out.innerHTML = cols.map(function (c, i) {
        return '<div class="rm-col" style="--d:' + (i * 90) + 'ms"><span class="num">' + c.n + '</span><h4>' + bi(c.h[0], c.h[1]) + '</h4><div class="when">' + bi(c.w[0], c.w[1]) + '</div><ul>' +
          c.items.map(function (t) { return '<li>' + bi(t[0], t[1]) + '</li>'; }).join('') + '</ul></div>';
      }).join('');
      var l = L(), si = l === 'de' ? 1 : 0;
      var body = (l === 'de' ? 'Hallo Zein,\n\nich interessiere mich für ein KI-Audit.\n\nBranche: ' : 'Hi Zein,\n\nI’m interested in an AI audit.\n\nSector: ') + S[current].name[si] +
        (l === 'de' ? '\nProbleme:\n' : '\nProblems:\n') + picked.map(function (p) { return '- ' + p.t[si]; }).join('\n') +
        (l === 'de' ? '\n\nOrganisation:\nTelefon/WhatsApp:\n' : '\n\nOrganization:\nPhone/WhatsApp:\n');
      document.getElementById('rm-send').href = 'mailto:z.dergham@lancaster.ac.uk?subject=' + encodeURIComponent(l === 'de' ? 'KI-Audit Anfrage' : 'AI audit request') + '&body=' + encodeURIComponent(body);
    }
    form.addEventListener('change', function (e) {
      if (e.target.name === 'rm-sector') { current = e.target.value; renderPains(); } else build();
    });
    document.querySelectorAll('[data-set]').forEach(function (b) { b.addEventListener('click', function () { setTimeout(build, 0); }); });
    renderPains();
  })();

  /* =====================================================================
     4. Rotating word in the hero
     ===================================================================== */
  (function rotator() {
    var spots = document.querySelectorAll('[data-rotate]');
    if (!spots.length || reduce) return;
    spots.forEach(function (spot) {
      var words = spot.getAttribute('data-rotate').split('|'), i = 0;
      setInterval(function () {
        spot.classList.add('out');
        setTimeout(function () { i = (i + 1) % words.length; spot.textContent = words[i]; spot.classList.remove('out'); }, 350);
      }, 2200);
    });
  })();

  /* =====================================================================
     5. Scroll progress, journey line, card tilt
     ===================================================================== */
  (function scrollFx() {
    var bar = document.getElementById('progress');
    var line = document.querySelector('.journey-line i');
    var journey = document.querySelector('.journey');
    var ticking = false;
    function update() {
      ticking = false;
      var h = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.transform = 'scaleX(' + (h > 0 ? scrollY / h : 0) + ')';
      if (line && journey) {
        var r = journey.getBoundingClientRect();
        var k = Math.max(0, Math.min(1, (innerHeight * 0.7 - r.top) / r.height));
        line.style.transform = 'scaleY(' + k + ')';
        journey.querySelectorAll('.stop').forEach(function (s) {
          var sr = s.getBoundingClientRect();
          s.classList.toggle('lit', sr.top < innerHeight * 0.7);
        });
      }
    }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', update);
    update();
    if (reduce || !matchMedia('(hover: hover)').matches) return;
    document.querySelectorAll('.build').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(900px) rotateX(' + (-y * 3) + 'deg) rotateY(' + (x * 3) + 'deg) translateY(-4px)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });
  })();
})();
