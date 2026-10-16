/* Living marks engine. One canvas per employee.
   Body = personality dials. Inner pattern = job kind. Light = live state.
   API: LivingMarks.mount(canvas) reads data-who / data-state; LivingMarks.setState(canvas, st); LivingMarks.resizeAll(). */
(function () {
  var DIALS = { tally: [62, 55, 35, 75, 40], elliot: [55, 50, 40, 85, 30], henry: [60, 35, 50, 80, 35], asa: [55, 80, 30, 80, 25], lex: [70, 40, 65, 30, 40] };
  var KIND = { tally: "hub", elliot: "blueprint", henry: "maze", asa: "maze", lex: "reader" };
  var SEED = { tally: 311, elliot: 7, henry: 1931, asa: 4417, lex: 23 };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var WHITE = [255, 255, 255], BLACK = [0, 0, 0];

  var probe = document.createElement("span"); probe.style.display = "none"; document.body.appendChild(probe);
  var cache = {};
  function rgb(n) { if (cache[n]) return cache[n]; probe.style.color = "var(--" + n + ")"; var m = getComputedStyle(probe).color.match(/[\d.]+/g) || [128, 128, 128]; return (cache[n] = [+m[0], +m[1], +m[2]]); }
  function isDark() { var b = rgb("bg"); return (b[0] + b[1] + b[2]) / 3 < 128; }
  function A(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")"; }
  function mix(c, t, k) { return [Math.round(c[0] + (t[0] - c[0]) * k), Math.round(c[1] + (t[1] - c[1]) * k), Math.round(c[2] + (t[2] - c[2]) * k)]; }
  function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function measure(p) { var L = [0]; for (var i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return L; }
  function at(p, L, s) {
    var tot = L[L.length - 1]; s = Math.max(0, Math.min(tot, s));
    for (var i = 1; i < p.length; i++) if (L[i] >= s) { var f = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * f, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * f, Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0])]; }
    var n = p.length - 1; return [p[n][0], p[n][1], 0];
  }
  function strokeTo(c, p, L, s) { c.beginPath(); c.moveTo(p[0][0], p[0][1]); for (var i = 1; i < p.length; i++) { if (L[i] <= s) c.lineTo(p[i][0], p[i][1]); else { var q = at(p, L, s); c.lineTo(q[0], q[1]); break; } } c.stroke(); }
  function soften(p) {
    var out = [p[0]];
    for (var i = 1; i < p.length - 1; i++) {
      var a = [(p[i - 1][0] + p[i][0]) / 2, (p[i - 1][1] + p[i][1]) / 2], b = [(p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2];
      for (var k = 0; k <= 8; k++) { var t = k / 8, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * p[i][0] + t * t * b[0], u * u * a[1] + 2 * u * t * p[i][1] + t * t * b[1]]); }
    }
    out.push(p[p.length - 1]); return out;
  }

  var STATE = {
    idle:    { amp: 0.02,  glow: 0.35, tight: 1.0, halo: 0, life: 0.45 },
    working: { amp: 0.065, glow: 1.0,  tight: 1.0, halo: 0, life: 1.0 },
    need:    { amp: 0.03,  glow: 0.7,  tight: 0.9, halo: 1, life: 0.75 }
  };

  function buildMaze(seed, N) {
    var r = rng(seed * 31 + N), open = [], i;
    for (i = 0; i < N * N; i++) open.push({ n: 0, e: 0, s: 0, w: 0 });
    var seen = new Array(N * N).fill(false), st = [0]; seen[0] = true;
    while (st.length) {
      var c = st[st.length - 1], x = c % N, y = c / N | 0, nb = [];
      if (y > 0 && !seen[c - N]) nb.push(["n", c - N, "s"]); if (x < N - 1 && !seen[c + 1]) nb.push(["e", c + 1, "w"]);
      if (y < N - 1 && !seen[c + N]) nb.push(["s", c + N, "n"]); if (x > 0 && !seen[c - 1]) nb.push(["w", c - 1, "e"]);
      if (!nb.length) { st.pop(); continue; }
      var p = nb[Math.floor(r() * nb.length)]; open[c][p[0]] = 1; open[p[1]][p[2]] = 1; seen[p[1]] = true; st.push(p[1]);
    }
    var prev = new Array(N * N).fill(-1), q = [0], vis = new Array(N * N).fill(false); vis[0] = true;
    while (q.length) { var cc = q.shift(); if (cc === N * N - 1) break; var o = open[cc];
      [[o.n, cc - N], [o.e, cc + 1], [o.s, cc + N], [o.w, cc - 1]].forEach(function (d) { if (d[0] && !vis[d[1]]) { vis[d[1]] = true; prev[d[1]] = cc; q.push(d[1]); } }); }
    var path = [], k = N * N - 1; while (k !== -1) { path.unshift(k); k = prev[k]; }
    var cs = 1 / N, walls = [];
    for (var yy = 0; yy < N; yy++) for (var xx = 0; xx < N; xx++) {
      var oo = open[yy * N + xx], X = xx * cs, Y = yy * cs;
      if (!oo.n) walls.push([[X, Y], [X + cs, Y]]);
      if (!oo.w && !(xx === 0 && yy === 0)) walls.push([[X, Y], [X, Y + cs]]);
      if (yy === N - 1) walls.push([[X, Y + cs], [X + cs, Y + cs]]);
      if (xx === N - 1 && yy !== N - 1) walls.push([[X + cs, Y], [X + cs, Y + cs]]);
    }
    var route = [[-cs * 0.6, cs / 2]]; path.forEach(function (id) { route.push([(id % N + 0.5) * cs, ((id / N | 0) + 0.5) * cs]); }); route.push([1 + cs * 0.6, 1 - cs / 2]);
    return { N: N, walls: walls, route: soften(route), cs: cs };
  }
  var PLAN = (function () {
    var p = [], arc = [];
    for (var a = 205; a <= 335; a += 6) arc.push([0.5 + 0.36 * Math.cos(a * Math.PI / 180), 0.5 + 0.36 * Math.sin(a * Math.PI / 180)]);
    p.push({ pts: [[0.02, 0.38], [0.26, 0.38], [0.26, 0.62], [0.02, 0.62], [0.02, 0.38]] });
    p.push({ pts: [[0.26, 0.5], [0.38, 0.5]] });
    p.push({ pts: [[0.38, 0.5], [0.5, 0.38], [0.62, 0.5], [0.5, 0.62], [0.38, 0.5]], decision: 1 });
    p.push({ pts: [[0.62, 0.5], [0.74, 0.5]] });
    p.push({ pts: [[0.74, 0.38], [0.98, 0.38], [0.98, 0.62], [0.74, 0.62], [0.74, 0.38]] });
    p.push({ pts: [[0.5, 0.62], [0.5, 0.8]] });
    p.push({ pts: [[0.38, 0.8], [0.62, 0.8], [0.62, 0.97], [0.38, 0.97], [0.38, 0.8]] });
    p.push({ pts: arc, soft: 1 });
    var r = rng(77), tot = 0;
    p.forEach(function (e) {
      var d = [];
      for (var i = 0; i < e.pts.length - 1; i++) { var a0 = e.pts[i], a1 = e.pts[i + 1], n = Math.max(2, Math.ceil(Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) / 0.035));
        for (var k = 0; k < n; k++) { var t = k / n; d.push([a0[0] + (a1[0] - a0[0]) * t + (r() - 0.5) * 0.012, a0[1] + (a1[1] - a0[1]) * t + (r() - 0.5) * 0.012]); } }
      d.push(e.pts[e.pts.length - 1].slice()); e.d = d; e.L = measure(d); e.len = e.L[e.L.length - 1]; e.at = tot; tot += e.len;
    });
    p.total = tot; return p;
  })();

  var marks = [];
  function Mark(cv) {
    this.cv = cv; this.ctx = cv.getContext("2d"); this.who = cv.getAttribute("data-who"); this.kind = KIND[this.who];
    this.state = cv.getAttribute("data-state") || "working"; this.seed = SEED[this.who] % 97; this.visible = true;
    this.cur = Object.assign({}, STATE[this.state]); this.size();
  }
  Mark.prototype.size = function () { var r = this.cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2); this.w = Math.max(1, r.width); this.cv.width = Math.round(this.w * d); this.cv.height = Math.round(this.w * d); this.ctx.setTransform(d, 0, 0, d, 0, 0); this.maze = null; this.reader = null; };
  Mark.prototype.tempo = function () { return 0.35 + 1.3 * DIALS[this.who][1] / 100; };
  Mark.prototype.radius = function (th, t) {
    var d = DIALS[this.who], a = ((th + Math.PI / 2) / (2 * Math.PI / 5)) % 5; if (a < 0) a += 5;
    var i = Math.floor(a), f = a - i, k = (1 - Math.cos(f * Math.PI)) / 2;
    var r0 = 0.5 + 0.5 * d[i] / 100, r1 = 0.5 + 0.5 * d[(i + 1) % 5] / 100, base = r0 + (r1 - r0) * k;
    var s = this.seed, n = this.cur.amp * (Math.sin(3 * th + t * 1.3 + s) * 0.5 + Math.sin(5 * th - t * 0.9 + s * 2) * 0.3 + Math.sin(2 * th + t * 0.6 + s * 3) * 0.35);
    return (base + n) * this.cur.tight;
  };
  Mark.prototype.bodyPath = function (c, cx, cy, R, t, rot) {
    c.beginPath();
    for (var j = 0; j <= 120; j++) { var th = j / 120 * Math.PI * 2, r = this.radius(th, t) * R; var x = cx + r * Math.cos(th + rot), y = cy + r * Math.sin(th + rot); j ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.closePath();
  };
  Mark.prototype.draw = function (now) {
    var tg = STATE[this.state], k = reduce ? 1 : 0.07;
    for (var p in tg) this.cur[p] += (tg[p] - this.cur[p]) * k;
    var c = this.ctx, w = this.w; if (w < 2) return;
    var cx = w / 2, cy = w / 2, R = w * 0.4, col = rgb(this.who), need = rgb("need"), dk = isDark();
    var tp = this.tempo(), t = reduce ? 1 : now / 1000 * tp, rot = reduce ? 0 : Math.sin(now / 1000 * 0.07 * tp) * 0.12;
    var small = w < 50, cur = this.cur;
    c.clearRect(0, 0, w, w);
    if (cur.halo > 0.01) {
      var ph = reduce ? 0.6 : (Math.sin(now / 1000 * 2.6) + 1) / 2;
      c.save(); this.bodyPath(c, cx, cy, R * (1.1 + 0.06 * ph), t, rot);
      c.strokeStyle = A(need, (0.45 + 0.45 * ph) * cur.halo); c.lineWidth = Math.max(1.4, w * 0.016);
      c.shadowColor = A(need, 0.9); c.shadowBlur = w * 0.1 * ph; c.stroke(); c.restore();
    }
    var amb = c.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.25);
    amb.addColorStop(0, A(col, (dk ? 0.26 : 0.14) * cur.glow)); amb.addColorStop(1, A(col, 0));
    c.fillStyle = amb; c.fillRect(0, 0, w, w);
    c.save();
    this.bodyPath(c, cx, cy, R, t, rot);
    var bf = c.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.05, cx, cy, R * 1.1);
    bf.addColorStop(0, A(dk ? mix(col, WHITE, 0.15) : mix(col, WHITE, 0.55), dk ? 0.42 * cur.life + 0.1 : 0.55));
    bf.addColorStop(1, A(dk ? mix(col, BLACK, 0.55) : mix(col, WHITE, 0.82), 0.92));
    c.fillStyle = bf; c.fill(); c.clip();
    var head = null;
    if (!small) {
      var S = R * 1.22, ox = cx - S / 2, oy = cy - S / 2, A0 = (reduce ? 0 : 1) * S * 0.012 * (0.4 + cur.life), sd = this.seed;
      var W = function (u, v) { var x = ox + u * S, y = oy + v * S; return [x + A0 * Math.sin(v * 7 + t * 1.3 + sd), y + A0 * Math.sin(u * 6 + t * 1.1 + sd * 2)]; };
      var ink = dk ? mix(col, WHITE, 0.6) : mix(col, BLACK, 0.15), lw = Math.max(1, w * 0.011);
      c.lineCap = "round"; c.lineJoin = "round";
      if (this.kind === "maze") head = drawMaze(this, c, w, S, W, t, now, col, ink, lw, need, dk);
      else if (this.kind === "reader") head = drawReader(this, c, w, S, W, t, now, col, ink, need, dk);
      else if (this.kind === "hub") head = drawHub(this, c, w, S, W, t, now, col, ink, lw, need, dk);
      else head = drawBlueprint(this, c, w, S, W, t, now, col, ink, lw, need, dk);
    } else if (this.state === "working") {
      var orb = reduce ? 0 : now / 1000 * tp * 1.2; head = [cx + Math.cos(orb) * R * 0.35, cy + Math.sin(orb * 1.3) * R * 0.3];
    }
    if (head) {
      c.globalCompositeOperation = dk ? "lighter" : "source-over";
      var lg = c.createRadialGradient(head[0], head[1], 0, head[0], head[1], R * (small ? 0.9 : 0.75)), hc = this.state === "need" ? need : col;
      lg.addColorStop(0, A(mix(hc, WHITE, 0.3), (dk ? 0.55 : 0.3) * cur.glow)); lg.addColorStop(1, A(hc, 0));
      c.fillStyle = lg; c.fillRect(0, 0, w, w); c.globalCompositeOperation = "source-over";
    }
    c.restore();
    this.bodyPath(c, cx, cy, R, t, rot);
    c.strokeStyle = A(dk ? mix(col, WHITE, 0.25) : col, dk ? 0.55 + 0.3 * cur.life : 0.75);
    c.lineWidth = Math.max(1, w * (small ? 0.03 : 0.009)); c.stroke();
  };

  function drawMaze(m, c, w, S, W, t, now, col, ink, lw, need, dk) {
    var N = w < 120 ? 4 : 5;
    if (!m.maze || m.maze.N !== N) m.maze = buildMaze(SEED[m.who], N);
    var mz = m.maze, life = m.cur.life;
    c.strokeStyle = A(ink, (dk ? 0.28 : 0.4) * (0.6 + 0.4 * life)); c.lineWidth = lw; c.beginPath();
    mz.walls.forEach(function (sg) { for (var k = 0; k <= 4; k++) { var u = sg[0][0] + (sg[1][0] - sg[0][0]) * k / 4, v = sg[0][1] + (sg[1][1] - sg[0][1]) * k / 4, p = W(u, v); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } });
    c.stroke();
    var pts = mz.route.map(function (q) { return W(q[0], q[1]); }), L = measure(pts), tot = L[L.length - 1];
    var pxs = S * 0.55 * m.tempo(), s, fadeHead = 1;
    if (m.state === "working") { var cyc = tot * 1.2; s = reduce ? tot * 0.6 : (now / 1000 * pxs) % cyc; if (s > tot) { fadeHead = 1 - (s - tot) / (cyc - tot); s = tot; } }
    else if (m.state === "need") s = tot * 0.52; else s = tot * 0.08;
    c.strokeStyle = A(col, (dk ? 0.5 : 0.6) * life); c.lineWidth = lw * 1.4; strokeTo(c, pts, L, s);
    if (m.state === "need") {
      var g = at(pts, L, s + mz.cs * S * 0.45), ph = reduce ? 1 : (Math.sin(now / 1000 * 3) + 1) / 2;
      c.save(); c.translate(g[0], g[1]); c.rotate(g[2] + Math.PI / 2); c.strokeStyle = A(need, 0.6 + 0.4 * ph); c.lineWidth = lw * 2.4;
      c.shadowColor = A(need, 0.9); c.shadowBlur = w * 0.06 * ph; c.beginPath(); c.moveTo(-mz.cs * S * 0.3, 0); c.lineTo(mz.cs * S * 0.3, 0); c.stroke(); c.restore();
    }
    c.save(); if (dk) c.globalCompositeOperation = "lighter";
    if (m.state === "working") for (var i = 20; i >= 1; i--) { var ss = s - mz.cs * S * 1.6 * i / 20; if (ss < 0) continue; var q = at(pts, L, ss);
      c.fillStyle = A(col, (1 - i / 20) * 0.55 * fadeHead); c.beginPath(); c.arc(q[0], q[1], Math.max(0.8, lw * 1.2 * (1 - i / 30)), 0, 6.283); c.fill(); }
    var hp = at(pts, L, s), hs = Math.max(2.4, mz.cs * S * 0.26), a = m.state === "idle" ? (reduce ? 0.5 : 0.35 + 0.2 * Math.sin(now / 1000 * 1.5)) : fadeHead;
    c.translate(hp[0], hp[1]); c.rotate(hp[2]); c.shadowColor = A(m.state === "need" ? need : col, 1); c.shadowBlur = w * 0.07 * a;
    c.fillStyle = A(mix(col, WHITE, dk ? 0.6 : 0.1), a); c.beginPath(); c.moveTo(hs, 0); c.quadraticCurveTo(-hs * 0.2, hs * 0.2, -hs * 0.7, hs * 0.7); c.lineTo(-hs * 0.3, 0); c.lineTo(-hs * 0.7, -hs * 0.7); c.quadraticCurveTo(-hs * 0.2, -hs * 0.2, hs, 0); c.fill();
    c.restore();
    return [hp[0], hp[1]];
  }

  // Reader: fewer, bigger, brighter dots than draft 3 so Lex reads from across a room.
  function drawReader(m, c, w, S, W, t, now, col, ink, need, dk) {
    var nL = w < 120 ? 3 : 4, ds = 1 / (w < 120 ? 7 : 9);
    if (!m.reader || m.reader.n !== nL) {
      var R = rng(SEED[m.who] + nL), lines = [], idx = 0;
      for (var i = 0; i < nL; i++) { var frac = i === nL - 1 ? 0.5 + R() * 0.2 : 0.72 + R() * 0.28; var cnt = Math.max(3, Math.round(frac / ds)); lines.push({ start: idx, cnt: cnt }); idx += cnt; }
      var al = Math.min(1, nL - 1); m.reader = { n: nL, list: lines, total: idx, ans: { line: al, from: Math.max(1, lines[al].cnt - 4), len: 3 } };
    }
    var Rd = m.reader, rate = 3.6 * m.tempo(), head, life = m.cur.life;
    if (m.state === "working") head = reduce ? Rd.total * 0.7 : (now / 1000 * rate) % (Rd.total + 8);
    else if (m.state === "need") head = Rd.list[Rd.ans.line].start + Rd.ans.from - 0.5; else head = 0;
    var r = Math.max(1.2, S * ds * 0.22), hpos = null;
    c.save(); if (dk) c.globalCompositeOperation = "lighter";
    Rd.list.forEach(function (ln, li) {
      var v = 0.14 + 0.72 * li / (nL - 1);
      for (var k = 0; k < ln.cnt; k++) {
        var gi = ln.start + k, u = k * ds + ds / 2, isAns = li === Rd.ans.line && k >= Rd.ans.from && k < Rd.ans.from + Rd.ans.len;
        if (m.state === "need" && isAns) continue;
        var ripple = reduce ? 0 : Math.sin(u * 9 - t * 2 + li) * 0.012 * (0.4 + life), p = W(u, v + ripple);
        var a = dk ? 0.34 : 0.42, rad = r;
        if (gi < head && m.state !== "idle") a = (dk ? 0.42 : 0.5) + 0.58 * Math.exp(-(head - gi) / 5);
        if (isAns && gi < head && m.state === "working") { a = 1; rad = r * 1.45; c.shadowColor = A(col, 1); c.shadowBlur = w * 0.05; } else c.shadowBlur = 0;
        c.fillStyle = A(isAns && gi < head ? mix(col, WHITE, dk ? 0.55 : 0) : ink, a); c.beginPath(); c.arc(p[0], p[1], rad, 0, 6.283); c.fill();
        if (Math.floor(head) === gi) hpos = p;
      }
      if (m.state === "need" && li === Rd.ans.line) {
        var ph = reduce ? 1 : (Math.sin(now / 1000 * 3) + 1) / 2, a0 = W(Rd.ans.from * ds, v), a1 = W((Rd.ans.from + Rd.ans.len) * ds, v), h = S * ds * 0.55;
        c.save(); c.globalCompositeOperation = "source-over"; c.strokeStyle = A(need, 0.6 + 0.4 * ph); c.lineWidth = Math.max(1.2, w * 0.014); c.shadowColor = A(need, 0.9); c.shadowBlur = w * 0.05 * ph;
        c.beginPath(); c.moveTo(a0[0] + h * 0.45, a0[1] - h); c.quadraticCurveTo(a0[0], a0[1] - h, a0[0], a0[1]); c.quadraticCurveTo(a0[0], a0[1] + h, a0[0] + h * 0.45, a0[1] + h);
        c.moveTo(a1[0] - h * 0.45, a1[1] - h); c.quadraticCurveTo(a1[0], a1[1] - h, a1[0], a1[1]); c.quadraticCurveTo(a1[0], a1[1] + h, a1[0] - h * 0.45, a1[1] + h); c.stroke(); c.restore();
        hpos = a0;
      }
    });
    if (!hpos) hpos = W(ds / 2, 0.14);
    var blink = m.state === "idle" ? (reduce ? 0.6 : (Math.sin(now / 1000 * 3) > 0 ? 0.85 : 0.2)) : 1;
    c.shadowColor = A(col, 1); c.shadowBlur = w * 0.08 * blink; c.fillStyle = A(mix(col, WHITE, dk ? 0.7 : 0.1), blink);
    c.beginPath(); c.arc(hpos[0], hpos[1], r * 1.9, 0, 6.283); c.fill(); c.restore();
    return hpos;
  }

  // Hub (manager): the team orbits her. Each teammate is a node in its own color.
  // Working teammates get pulses sent out from the hub; a teammate who needs you pulses amber back in.
  // Team comes from data-team="henry:need,lex:working,elliot:idle".
  function drawHub(m, c, w, S, W, t, now, col, ink, lw, need, dk) {
    var team = (m.cv.getAttribute("data-team") || "").split(",").filter(Boolean).map(function (x) { var p = x.split(":"); return { id: p[0], st: p[1] || "working" }; });
    var life = m.cur.life, secs = reduce ? 1.3 : now / 1000, n = team.length, hub = W(0.5, 0.5), head = hub, ring = 0.34;
    var spin = reduce ? 0 : secs * 0.08 * m.tempo();
    // Faint orbit
    c.strokeStyle = A(ink, dk ? 0.16 : 0.22); c.lineWidth = Math.max(0.8, lw * 0.7); c.setLineDash([lw * 1.5, lw * 2.5]);
    c.beginPath(); for (var j = 0; j <= 64; j++) { var aa = j / 64 * Math.PI * 2, q = W(0.5 + ring * Math.cos(aa), 0.5 + ring * Math.sin(aa)); j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.stroke(); c.setLineDash([]);
    team.forEach(function (tm, i) {
      var ang = -Math.PI / 2 + i / Math.max(1, n) * Math.PI * 2 + spin, u = 0.5 + ring * Math.cos(ang), v = 0.5 + ring * Math.sin(ang), p = W(u, v), tc = rgb(tm.id);
      c.strokeStyle = A(ink, (dk ? 0.26 : 0.32) * (0.6 + 0.4 * life)); c.lineWidth = lw; c.beginPath(); c.moveTo(hub[0], hub[1]); c.lineTo(p[0], p[1]); c.stroke();
      c.save(); if (dk) c.globalCompositeOperation = "lighter";
      if (tm.st !== "idle" && m.state !== "idle") {
        var period = tm.st === "need" ? 1.6 : 2.4 / m.tempo(), f = ((secs + i * 0.7) % period) / period, k = tm.st === "need" ? 1 - f : f;
        var px = hub[0] + (p[0] - hub[0]) * k, py = hub[1] + (p[1] - hub[1]) * k, pc = tm.st === "need" ? need : tc;
        c.shadowColor = A(pc, 1); c.shadowBlur = w * 0.04; c.fillStyle = A(mix(pc, WHITE, dk ? 0.4 : 0), Math.sin(f * Math.PI));
        c.beginPath(); c.arc(px, py, Math.max(1.2, S * 0.022), 0, 6.283); c.fill();
      }
      var nr = S * 0.065, glowA = tm.st === "idle" ? 0.45 : 0.95;
      c.shadowColor = A(tc, 1); c.shadowBlur = w * (tm.st === "idle" ? 0.01 : 0.04);
      c.fillStyle = A(dk ? mix(tc, WHITE, 0.25) : tc, glowA); c.beginPath(); c.arc(p[0], p[1], nr, 0, 6.283); c.fill();
      c.restore();
      if (tm.st === "need") {
        var ph = reduce ? 1 : (Math.sin(secs * 3) + 1) / 2;
        c.save(); c.strokeStyle = A(need, 0.55 + 0.45 * ph); c.lineWidth = Math.max(1.2, lw * 1.4); c.shadowColor = A(need, 0.9); c.shadowBlur = w * 0.05 * ph;
        c.beginPath(); c.arc(p[0], p[1], nr * (1.6 + 0.3 * ph), 0, 6.283); c.stroke(); c.restore();
        head = p;
      }
    });
    // Hub: Tally herself
    var hb = reduce ? 1 : 0.85 + 0.15 * Math.sin(secs * 1.8 * m.tempo());
    c.save(); if (dk) c.globalCompositeOperation = "lighter";
    c.shadowColor = A(col, 1); c.shadowBlur = w * 0.08 * life; c.fillStyle = A(mix(col, WHITE, dk ? 0.6 : 0.1), 0.6 + 0.4 * life);
    c.beginPath(); c.arc(hub[0], hub[1], S * 0.1 * hb, 0, 6.283); c.fill(); c.restore();
    return head;
  }

  function drawBlueprint(m, c, w, S, W, t, now, col, ink, lw, need, dk) {
    var life = m.cur.life, g;
    c.strokeStyle = A(ink, dk ? 0.08 : 0.12); c.lineWidth = 1; c.beginPath();
    for (g = 0; g <= 8; g++) { var a = W(g / 8, -0.1), b = W(g / 8, 1.1), d = W(-0.1, g / 8), e = W(1.1, g / 8); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.moveTo(d[0], d[1]); c.lineTo(e[0], e[1]); }
    c.stroke();
    var drawT = 5.5 / m.tempo(), hold = 1.6, fade = 0.8, prog, alpha = 1, pen = true, decision = PLAN.filter(function (e) { return e.decision; })[0];
    if (m.state === "working") { var ph = reduce ? drawT * 0.7 : (now / 1000) % (drawT + hold + fade); prog = Math.min(1, ph / drawT) * PLAN.total; pen = ph < drawT; if (ph > drawT + hold) alpha = 1 - (ph - drawT - hold) / fade; }
    else if (m.state === "need") prog = decision.at; else { prog = PLAN.total; alpha = 0.55; pen = false; }
    var tip = null;
    PLAN.forEach(function (e) {
      var local = prog - e.at; if (local <= 0) return;
      var pts = e.d.map(function (q) { return W(q[0], q[1]); }), L = measure(pts), scale = L[L.length - 1] / (e.len || 1);
      c.strokeStyle = A(ink, (e.soft ? 0.4 : 0.9) * alpha * (0.6 + 0.4 * life)); c.lineWidth = e.soft ? Math.max(0.8, lw * 0.6) : lw;
      if (e.soft) c.setLineDash([lw * 2, lw * 2.4]); strokeTo(c, pts, L, Math.min(local * scale, L[L.length - 1])); c.setLineDash([]);
      if (local < e.len) tip = at(pts, L, local * scale);
    });
    if (m.state === "need") {
      var pts2 = decision.d.map(function (q) { return W(q[0], q[1]); }), ph2 = reduce ? 1 : (Math.sin(now / 1000 * 3) + 1) / 2;
      c.save(); c.strokeStyle = A(need, 0.55 + 0.45 * ph2); c.lineWidth = lw * 1.3; c.setLineDash([lw * 1.8, lw * 1.8]); c.shadowColor = A(need, 0.9); c.shadowBlur = w * 0.05 * ph2;
      c.beginPath(); pts2.forEach(function (p, i) { i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.stroke(); c.restore();
      tip = pts2[0]; pen = true;
    }
    if (!tip) { var last = PLAN[PLAN.length - 2]; tip = W(last.d[0][0], last.d[0][1]); }
    if (pen) { c.save(); if (dk) c.globalCompositeOperation = "lighter"; c.shadowColor = A(m.state === "need" ? need : col, 1); c.shadowBlur = w * 0.07;
      c.fillStyle = A(mix(col, WHITE, dk ? 0.7 : 0.15), 1); c.beginPath(); c.arc(tip[0], tip[1], Math.max(1.5, lw * 1.7), 0, 6.283); c.fill(); c.restore(); }
    return [tip[0], tip[1]];
  }

  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.target._m) e.target._m.visible = e.isIntersecting; }); }) : null;
  function paint(now) { marks = marks.filter(function (m) { return m.cv.isConnected; }); marks.forEach(function (m) { if (m.visible) m.draw(now); }); }
  function frame(now) { paint(now); requestAnimationFrame(frame); }
  function bust() { cache = {}; if (reduce) paint(1000); }
  window.addEventListener("resize", function () { api.resizeAll(); });
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", bust);
  new MutationObserver(bust).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  if (!reduce) requestAnimationFrame(frame);

  var api = {
    mount: function (cv) { if (cv._m) return cv._m; var m = new Mark(cv); cv._m = m; marks.push(m); if (io) io.observe(cv); if (reduce) m.draw(1000); return m; },
    mountAll: function (root) { (root || document).querySelectorAll("canvas[data-who]").forEach(api.mount); },
    setState: function (cv, st) { if (cv._m) { cv._m.state = st; if (reduce) cv._m.draw(1000); } },
    resizeAll: function () { marks.forEach(function (m) { m.size(); }); if (reduce) paint(1000); },
    refresh: function () { cache = {}; api.resizeAll(); }
  };
  window.LivingMarks = api;
})();
