/* ══════════════════════════════════════════════════════════════════════════
   GUNSILENT — interface
   Règle du site : rien ne joue tout seul. Le son n'existe que sous le doigt
   (maintenir une partition, frapper une lettre), et la couleur n'apparaît
   que quand il y a du son.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var D = window.GS_DATA, A = window.GSAudio;
if(!D || !A) return;

var doc = document, root = doc.documentElement, body = doc.body;
var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
var FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
var SMALL = matchMedia('(max-width: 899px)');
var DPR = Math.min(2, window.devicePixelRatio || 1);
var SIG = '#EB4A1E';
function paper(a){ return 'rgba(231,227,220,' + a + ')'; }
function ink(a){ return 'rgba(14,13,12,' + a + ')'; }

/* ── Outils ─────────────────────────────────────────────────────────────── */
function $(s, c){ return (c || doc).querySelector(s); }
function $$(s, c){ return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
function lerp(a, b, t){ return a + (b - a) * t; }
function smooth(a, b, v){ var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function easeOut(t){ return 1 - Math.pow(1 - t, 4); }
function easeIO(t){ return t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; }
function pad2(n){ return (n < 10 ? '0' : '') + n; }
function fmt(sec){ sec = Math.max(0, sec || 0); return Math.floor(sec / 60) + ':' + pad2(Math.floor(sec % 60)); }
function nbsp(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function fitCanvas(c){
  var r = c.getBoundingClientRect(), w = Math.max(1, Math.round(r.width * DPR)), h = Math.max(1, Math.round(r.height * DPR));
  if(c.width !== w || c.height !== h){ c.width = w; c.height = h; c._dirty = true; }
  return { w:w, h:h };
}
function typing(){ var a = doc.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); }
function watch(el, cb, margin, threshold){
  if(!el) return;
  if(!('IntersectionObserver' in window)){ cb(true); return; }
  var io = new IntersectionObserver(function(es){ es.forEach(function(e){ cb(e.isIntersecting, e); }); }, { rootMargin:margin || '0px', threshold:threshold || 0 });
  io.observe(el);
}
function toast(msg){
  var t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(function(){ t.classList.remove('on'); }, 2200);
}

/* ── Boucle d'animation unique ──────────────────────────────────────────── */
var ticks = [], lastT = performance.now();
function onTick(fn){ ticks.push(fn); }
function frame(t){
  var dt = Math.min(.064, (t - lastT) / 1000); lastT = t;
  for(var i = 0; i < ticks.length; i++) ticks[i](t / 1000, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

var V = { w:innerWidth, h:innerHeight, y:scrollY, vy:0, sv:0 };
var resizers = [];
function onResize(fn){ resizers.push(fn); }
var rsT;
addEventListener('resize', function(){
  clearTimeout(rsT);
  rsT = setTimeout(function(){ V.w = innerWidth; V.h = innerHeight; resizers.forEach(function(fn){ fn(); }); }, 120);
});
onTick(function(t, dt){
  var y = scrollY;
  V.vy = dt > 0 ? (y - V.y) / dt : 0;
  V.y = y;
  V.sv = lerp(V.sv, V.vy, .1);
});

/* Pointeur global et étiquette contextuelle */
var PTR = { x:-999, y:-999 };
var tag = $('#cursorTag'), tagTxt = '';
addEventListener('pointermove', function(e){ PTR.x = e.clientX; PTR.y = e.clientY; }, { passive:true });
function setTag(txt){
  if(!FINE) return;
  if(txt === tagTxt) return;
  tagTxt = txt;
  if(txt){ tag.textContent = txt; tag.classList.add('on'); } else tag.classList.remove('on');
}
onTick(function(){
  if(tagTxt) tag.style.transform = 'translate3d(' + (PTR.x + 16) + 'px,' + (PTR.y + 18) + 'px,0)';
});

/* ══════════════════════════════════════════════════════════════════════════
   SON → IMAGE
   Les frappes sont lues dans la partition de l'instrumentale en cours :
   le visuel tombe exactement sur le temps, sans analyse approximative.
   ══════════════════════════════════════════════════════════════════════════ */
var HIT = { kick:0, snare:0, hat:0, bass:0, keys:0, perc:0, fx:0 };
var hitSubs = [], lastSeg = -1, padAt = -9;
function onHit(fn){ hitSubs.push(fn); }
function curSeg(){
  if(!A.cur) return -1;
  var st = A.cur.st; return Math.floor(A.position() / st.duration * st.segs) % st.segs;
}
onTick(function(t, dt){
  for(var k in HIT) HIT[k] *= Math.exp(-dt * 7);
  if(!A.playing || !A.cur || !A.cur.st.an){ lastSeg = -1; }
  else {
    var st = A.cur.st, an = st.an, segs = st.segs, seg = curSeg();
    if(seg !== lastSeg){
      var prev = (seg - 1 + segs) % segs, roles = {};
      for(var i = 0; i < an.matrix.length; i++){
        if(st.muted[i]) continue;
        var v = an.matrix[i][seg], pv = an.matrix[i][prev];
        var on = (v > .42 && v > pv * 1.3) ? v : 0, r = st.roles[i];
        if(on > (roles[r] || 0)) roles[r] = on;
      }
      for(var rr in roles){ if(roles[rr] > HIT[rr]) HIT[rr] = roles[rr]; for(var j = 0; j < hitSubs.length; j++) hitSubs[j](rr, roles[rr], seg); }
      lastSeg = seg;
    }
  }
  var sounding = A.playing || A.phaseOn() || (t - padAt < .35);
  if(sounding !== body.classList.contains('sounding')) body.classList.toggle('sounding', sounding);
});
A.on('pad', function(){ padAt = performance.now() / 1000; });

/* Déverrouillage du son au premier geste terminé, où que ce soit */
['pointerup', 'keydown', 'touchend', 'click'].forEach(function(ev){
  addEventListener(ev, function(){ A.unlock(); }, { passive:true, capture:true });
});
/* Tout relâcher si la page perd le focus */
function releaseAll(){ Room && Room.release(); Phase && Phase.release(); }
addEventListener('blur', releaseAll);
doc.addEventListener('visibilitychange', function(){ if(doc.hidden) releaseAll(); });

/* ══════════════════════════════════════════════════════════════════════════
   TYPOGRAPHIE : découpe en mots pour les apparitions
   ══════════════════════════════════════════════════════════════════════════ */
function splitWords(el){
  var n = 0;
  (function walk(node){
    Array.prototype.slice.call(node.childNodes).forEach(function(ch){
      if(ch.nodeType === 3){
        var parts = ch.textContent.split(/(\s+)/), frag = doc.createDocumentFragment();
        parts.forEach(function(p){
          if(!p) return;
          if(/^\s+$/.test(p)){ frag.appendChild(doc.createTextNode(' ')); return; }
          var w = doc.createElement('span'), i = doc.createElement('span');
          w.className = 'wd'; i.textContent = p; i.style.setProperty('--i', n++);
          w.appendChild(i); frag.appendChild(w);
        });
        ch.parentNode.replaceChild(frag, ch);
      } else if(ch.nodeType === 1 && ch.tagName !== 'BR'){ walk(ch); }
    });
  })(el);
  el.classList.add('split');
}
$$('.room-h, .voices-head h2, .rights-head h2, .studio-head h2, .brief-head h2, .terr-head h3, .outro-line, .artist-name, .faq-h, .release-title').forEach(splitWords);

function revealAll(){
  var els = $$('.reveal, .split');
  if(RM || !('IntersectionObserver' in window)){ els.forEach(function(e){ e.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold:.18, rootMargin:'0px 0px -6% 0px' });
  els.forEach(function(e){ io.observe(e); });
}

/* Citation : chaque mot s'allume au rythme du défilement */
(function(){
  $$('[data-words]').forEach(function(q){
    var p = $('p', q), words = p.textContent.trim().split(/\s+/);
    p.innerHTML = words.map(function(w){ return '<span class="w">' + w + '</span>'; }).join(' ');
    var ws = $$('.w', p), vis = false, lit = -1;
    watch(q, function(v){ vis = v; }, '20% 0px');
    onTick(function(){
      if(!vis && lit !== -1) return;
      var r = q.getBoundingClientRect(), pr = RM ? 1 : clamp((V.h * .82 - r.top) / (V.h * .5), 0, 1);
      var n = Math.round(pr * ws.length);
      if(n !== lit){ ws.forEach(function(w, i){ w.classList.toggle('on', i < n); }); lit = n; }
    });
  });
})();

/* Mots-monuments : la vitesse de défilement les étire, comme un pitch-bend */
(function(){
  var mons = $$('.monument').map(function(el){ var o = { el:el, vis:false, cur:62 }; watch(el, function(v){ o.vis = v; }); return o; });
  onTick(function(){
    var target = 62 + clamp(Math.abs(V.sv) / 2200, 0, 1) * 58;
    mons.forEach(function(m){
      if(!m.vis) return;
      m.cur = lerp(m.cur, target, target > m.cur ? .18 : .06);
      if(Math.abs(m.cur - (m.last || 0)) > .15){ m.el.style.setProperty('--mw', m.cur.toFixed(1)); m.last = m.cur; }
    });
  });
})();

/* Heure de Dakar (GMT toute l'année) */
(function(){
  var els = [$('#dakarClock')].concat($$('[data-clock]'));
  function tick(){
    var d = new Date(), s = pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds());
    els.forEach(function(e){ if(e) e.textContent = e.hasAttribute('data-clock') ? s.slice(0, 5) : s; });
  }
  tick(); setInterval(tick, 1000);
})();

/* ══════════════════════════════════════════════════════════════════════════
   00 — SIGNATURE : l'enveloppe d'un son, lettre par lettre
   GUN frappe (graisse maximale, chasse étroite), SILENT s'éteint
   (graisse minimale, chasse large). Chaque lettre est un pad.
   ══════════════════════════════════════════════════════════════════════════ */
var Wordmark = (function(){
  var wm = $('.wm'), heroEl = $('#intro');
  var BASE = [[900, 62], [860, 64], [780, 70], [620, 80], [470, 92], [340, 104], [240, 114], [160, 121], [110, 125]];
  var NAMES = ['Kick', '808 · Fa', 'Caisse claire', 'Charleston', 'Charleston ouvert', 'Clap', 'Rim', 'Sabar', '808 · Do'];
  var text = wm.getAttribute('data-text'), chars = [], hit = new Float32Array(9), applied = new Float32Array(9).fill(-1);
  wm.textContent = '';
  var rows = [doc.createElement('span'), doc.createElement('span')];
  rows.forEach(function(r){ r.className = 'wm-row'; wm.appendChild(r); });
  text.split('').forEach(function(c, i){
    var s = doc.createElement('span');
    s.className = 'ch'; s.textContent = c;
    s.style.setProperty('--i', i); s.style.setProperty('--w', BASE[i][0]); s.style.setProperty('--x', BASE[i][1]);
    rows[i < 3 ? 0 : 1].appendChild(s);
    chars.push(s);
  });
  var vis = true;
  watch(heroEl, function(v){ vis = v; });

  function fit(){
    chars.forEach(function(c){ c.style.width = ''; });
    wm.style.fontSize = '100px';
    rows.forEach(function(r){ r.style.fontSize = ''; });
    var W = wm.parentNode.clientWidth;
    if(SMALL.matches){
      rows.forEach(function(r){
        var w = r.getBoundingClientRect().width;
        r.style.fontSize = Math.min(W / w * 100 * .995, V.h * .42) + 'px';
      });
    } else {
      var total = rows[0].getBoundingClientRect().width + rows[1].getBoundingClientRect().width;
      wm.style.fontSize = (W / total * 100 * .995) + 'px';
    }
    /* Largeurs figées : une frappe change la graisse sans décaler les voisines */
    chars.forEach(function(c){ c.style.width = c.getBoundingClientRect().width + 'px'; });
  }

  function strike(i, v){ if(v > hit[i]) hit[i] = v; }
  onTick(function(t, dt){
    if(!vis) return;
    for(var i = 0; i < 9; i++){
      hit[i] *= Math.exp(-dt * 5.5);
      if(Math.abs(hit[i] - applied[i]) < .004) continue;
      applied[i] = hit[i];
      var h = hit[i], c = chars[i];
      c.style.setProperty('--w', Math.round(lerp(BASE[i][0], 900, h)));
      c.style.setProperty('--x', lerp(BASE[i][1], 62, h).toFixed(1));
      c.style.transform = h > .01 ? 'scaleY(' + (1 + h * .07).toFixed(3) + ')' : '';
    }
  });
  onHit(function(role, v){
    if(!vis) return;
    if(role === 'kick' || role === 'bass'){ strike(0, v); strike(1, v * .8); strike(2, v * .6); }
    else if(role === 'snare'){ strike(3, v); strike(4, v * .8); strike(5, v * .6); }
    else if(role === 'hat'){ strike(6, v * .5); strike(7, v * .4); strike(8, v * .3); }
  });

  var over = -1;
  function charAt(x, y){
    for(var i = 0; i < 9; i++){ var r = chars[i].getBoundingClientRect(); if(x >= r.left && x <= r.right && y >= r.top - 10 && y <= r.bottom + 10) return i; }
    return -1;
  }
  wm.addEventListener('pointermove', function(e){
    var i = charAt(e.clientX, e.clientY);
    if(i !== over){
      over = i;
      if(i >= 0){ strike(i, .7); HeroLine.pluck(e.clientX, .5); setTag(pad2(i + 1) + ' — ' + NAMES[i]); }
      else setTag('');
    }
  });
  wm.addEventListener('pointerleave', function(){ over = -1; setTag(''); });
  wm.addEventListener('pointerdown', function(e){
    var i = charAt(e.clientX, e.clientY);
    if(i < 0) return;
    strike(i, 1); HeroLine.pluck(e.clientX, 1.6);
    A.pad(i);
  });

  return { fit:fit, live:function(){ wm.classList.add('live'); } };
})();

/* ── La ligne de signal : une corde tendue sous le nom ──────────────────── */
var HeroLine = (function(){
  var wrap = $('#heroLine'), cv = $('canvas', wrap), cx = cv.getContext('2d');
  var N = 200, y = new Float32Array(N), v = new Float32Array(N), vis = true, energy = 1, lastPy = null;
  watch($('#intro'), function(x){ vis = x; });
  function idx(clientX){ var r = cv.getBoundingClientRect(); return clamp(Math.round((clientX - r.left) / r.width * (N - 1)), 1, N - 2); }
  function pluck(clientX, amt){
    var i = idx(clientX), H = cv.height / DPR;
    for(var k = -6; k <= 6; k++){ var j = i + k; if(j > 0 && j < N - 1) v[j] -= amt * H * .9 * Math.exp(-k * k / 10); }
    energy = 1;
  }
  $('#intro').addEventListener('pointermove', function(e){
    var r = cv.getBoundingClientRect(), cy = r.top + r.height / 2, dy = lastPy == null ? 0 : e.clientY - lastPy;
    lastPy = e.clientY;
    if(Math.abs(e.clientY - cy) < r.height * .55 && Math.abs(dy) > 0){
      var i = idx(e.clientX);
      for(var k = -4; k <= 4; k++){ var j = i + k; if(j > 0 && j < N - 1) v[j] += dy * 3.2 * Math.exp(-k * k / 6); }
      energy = 1;
    }
  }, { passive:true });

  onTick(function(t, dt){
    if(!vis) return;
    var sounding = A.playing;
    if(energy < .002 && !sounding && !cv._dirty) return;
    var s = fitCanvas(cv), W = s.w, H = s.h, mid = H / 2;
    var steps = 2, h = Math.min(dt, .032) / steps, K = 2600, damp = 3.2, e = 0;
    for(var n = 0; n < steps; n++){
      for(var i = 1; i < N - 1; i++){
        var a = K * (y[i - 1] + y[i + 1] - 2 * y[i]) - damp * v[i] - 30 * y[i];
        v[i] += a * h;
      }
      for(var i2 = 1; i2 < N - 1; i2++){ y[i2] += v[i2] * h; e += Math.abs(v[i2]); }
    }
    energy = e / N / 60;
    cx.clearRect(0, 0, W, H);
    cx.lineWidth = 1.25 * DPR;
    cx.strokeStyle = sounding ? SIG : ink(1);
    var wave = sounding ? A.wave() : null, wl = wave ? wave.length : 0;
    cx.beginPath();
    for(var p = 0; p < N; p++){
      var x = p / (N - 1) * W, off = y[p] * DPR;
      if(wave){ var win = Math.sin(Math.PI * p / (N - 1)); off += wave[Math.floor(p / N * wl)] * H * .42 * win; }
      var yy = clamp(mid + off, 1, H - 1);
      p ? cx.lineTo(x, yy) : cx.moveTo(x, yy);
    }
    cx.stroke();
    cv._dirty = false;
  });
  return { pluck:pluck };
})();

/* ══════════════════════════════════════════════════════════════════════════
   DÉCOMPTE D'OUVERTURE
   1 · 2 · 3 sur la ligne, le coup part sur le 4, la page s'ouvre sur la ligne.
   ══════════════════════════════════════════════════════════════════════════ */
function countIn(done){
  var el = $('#countin');
  if(!el || root.classList.contains('no-intro')){ if(el) el.classList.add('gone'); done(); return; }
  try{ sessionStorage.setItem('gs-intro', '1'); }catch(e){}
  body.style.overflow = 'hidden';
  var hl = $('#heroLine').getBoundingClientRect(), ly = hl.top + hl.height / 2;
  el.style.setProperty('--ly', ly + 'px');
  var cv = $('#countinLine'), cx = cv.getContext('2d'), num = $('#countinNum');
  var BEAT = .5, SHOT = 3 * BEAT, SPLIT = SHOT + .7, END = SPLIT + .95, t0 = performance.now() / 1000, finished = false, shown = 0;
  function finish(){
    if(finished) return; finished = true;
    el.classList.add('split');
    body.style.overflow = '';
    done();
    setTimeout(function(){ el.classList.add('gone'); }, 950);
  }
  function skip(){ if(!finished){ t0 = performance.now() / 1000 - SPLIT; } }
  $('#countinSkip').addEventListener('click', skip);
  el.addEventListener('pointerdown', skip);
  addEventListener('keydown', function k(){ skip(); removeEventListener('keydown', k); });

  (function draw(){
    var t = performance.now() / 1000 - t0;
    var s = fitCanvas(cv), W = s.w, H = s.h, mid = H / 2;
    cx.clearRect(0, 0, W, H);
    var n = Math.min(3, Math.floor(t / BEAT) + 1);
    if(t < SHOT && n !== shown){ shown = n; num.textContent = ['1', '1 · 2', '1 · 2 · 3'][n - 1]; }
    if(t >= SHOT && shown !== 4){ shown = 4; num.textContent = '1 · 2 · 3 · —'; }
    cx.lineWidth = 1.25 * DPR; cx.strokeStyle = t >= SHOT ? SIG : ink(1);
    cx.beginPath();
    var cxm = W / 2;
    for(var x = 0; x <= W; x += 2){
      var dx = Math.abs(x - cxm) / DPR, off = 0;
      for(var b = 0; b < 3; b++){
        var tb = t - b * BEAT;
        if(tb > 0 && tb < 1.2) off += 10 * Math.exp(-tb * 5) * Math.exp(-Math.pow(dx / 30, 2)) * Math.sin(tb * 40);
      }
      var ts = t - SHOT;
      if(ts > 0){
        /* la détonation : un pic au centre, puis des ondes qui s'éloignent en mourant */
        var env = Math.exp(-ts * 4.2), L = 50 + ts * 700, front = smooth(ts * 2200, ts * 2200 - 80, dx);
        off -= H / DPR * .34 * env * Math.exp(-dx / L) * Math.cos(dx * .07 - ts * 52) * front;
      }
      var yy = mid + off * DPR;
      x ? cx.lineTo(x, yy) : cx.moveTo(x, yy);
    }
    cx.stroke();
    if(t >= SPLIT) finish();
    if(t < END) requestAnimationFrame(draw);
  })();
}

/* ══════════════════════════════════════════════════════════════════════════
   01 — PORTRAIT : l'image n'apparaît qu'à travers le signal
   Le portrait est vu à travers une forme d'onde. Le défilement monte le gain ;
   quand toutes les colonnes saturent, l'image est entière.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  var fig = $('#portrait'), cv = $('canvas', fig), cx = cv.getContext('2d'), sec = $('#artiste');
  var img = new Image(), ready = false, vis = false, env = null, envReal = false, hover = -1, lastP = -1;
  img.decoding = 'async';
  img.src = 'https://res.cloudinary.com/o781tzyj/image/upload/e_grayscale,f_auto,q_auto,w_1000/v1785450188/DSCF2367_i13njw.jpg';
  img.onload = function(){ ready = true; lastP = -1; };
  var gainEl = $('#portraitGain'), satEl = $('#portraitSat');
  watch(sec, function(v){ vis = v; }, '10% 0px');

  function bars(){ return SMALL.matches ? 56 : 96; }
  function buildEnv(){
    var B = bars(), e = new Float32Array(B), st = A.info(D.beats[0].id);
    if(st && st.an){
      var pk = st.an.peaks, per = pk.length / 2 / B;
      for(var i = 0; i < B; i++){ var m = 0; for(var j = Math.floor(i * per); j < (i + 1) * per; j++) m = Math.max(m, -pk[j * 2], pk[j * 2 + 1]); e[i] = .12 + m * .88; }
      envReal = true;
    } else {
      var r = 1; for(var k = 0; k < B; k++){ r = (r * 9301 + 49297) % 233280; e[k] = .15 + .85 * Math.abs(Math.sin(k * .37) * .6 + (r / 233280) * .4); }
    }
    env = e; lastP = -1;
  }
  buildEnv();
  onResize(function(){ buildEnv(); });

  fig.addEventListener('pointermove', function(e){ var r = cv.getBoundingClientRect(); hover = (e.clientX - r.left) / r.width; lastP = -1; });
  fig.addEventListener('pointerleave', function(){ hover = -1; lastP = -1; });
  var boost = 0;

  onTick(function(t, dt){
    if(!vis || !ready) return;
    /* la fenêtre du portrait est la vraie forme d'onde de la première instrumentale */
    if(!envReal && (A.info(D.beats[0].id) || {}).an) buildEnv();
    var r = sec.getBoundingClientRect();
    var p = RM ? 1 : clamp((V.h * .95 - r.top) / (V.h * 1.7), 0, 1);
    boost = lerp(boost, hover >= 0 ? 1 : 0, .12);
    if(Math.abs(p - lastP) < .0008 && boost < .01 && !cv._dirty) return;
    lastP = p;
    var s = fitCanvas(cv), W = s.w, H = s.h, B = env.length;
    var G = .03 + 16 * Math.pow(p, 2.4), gap = lerp(.42, 0, smooth(.72, .98, p));
    /* cadrage « cover » de l'image dans le canevas */
    var ir = img.naturalWidth / img.naturalHeight, cr = W / H, sw, sh, sx, sy;
    if(ir > cr){ sh = img.naturalHeight; sw = sh * cr; sx = (img.naturalWidth - sw) / 2; sy = 0; }
    else { sw = img.naturalWidth; sh = sw / cr; sx = 0; sy = (img.naturalHeight - sh) * .3; }
    cx.clearRect(0, 0, W, H);
    var clipped = 0, bw = W / B;
    for(var i = 0; i < B; i++){
      var bx = i * bw, hv = env[i] * G;
      if(hover >= 0){ var d = (i / B - hover) * B; hv += boost * 1.4 * Math.exp(-d * d / 18); }
      hv = Math.min(1, hv);
      if(hv >= .999) clipped++;
      var bh = hv * H, by = (H - bh) / 2, w = bw * (1 - gap);
      if(bh < 1) continue;
      var srcX = sx + (bx / W) * sw, srcY = sy + (by / H) * sh;
      cx.drawImage(img, srcX, srcY, (w / W) * sw, (bh / H) * sh, bx, by, w + .5, bh);
    }
    /* fil du signal au repos, visible tant que l'image n'est pas pleine */
    if(p < .98){
      cx.fillStyle = ink(.9 * (1 - smooth(.7, .98, p)));
      cx.fillRect(0, H / 2 - DPR * .6, W, DPR * 1.2);
    }
    var db = 20 * Math.log10(G);
    gainEl.textContent = p < .004 ? '−∞ dB' : (db >= 0 ? '+' : '−') + Math.abs(db).toFixed(1) + ' dB';
    satEl.textContent = Math.round(clipped / B * 100) + ' %';
    cv._dirty = false;
  });
})();

/* Territoires : chaque énergie dessinée par sa forme d'onde */
(function(){
  var SHAPES = {
    sombre:function(x, t){ return (Math.sin(x * 9 + t) * .7 + Math.sin(x * 23 + t * 1.7) * .3) * (.75 + .25 * Math.sin(x * 2)); },
    aerienne:function(x, t){ var e = Math.exp(-Math.pow(((x * 3 + t * .15) % 1) - .5, 2) * 40); return Math.sin(x * 140 + t * 4) * .45 * e; },
    percutante:function(x, t){ var ph = ((x * 6 + t * .4) % 1); return Math.sin(ph * 90) * Math.exp(-ph * 9); },
    chaleureuse:function(x, t){ return Math.sin(x * 14 + t) * .55 + Math.sin(x * 28 + t * 1.3) * .15; },
    froide:function(x, t){ return (Math.sin(x * 22 + t * 2) > 0 ? .6 : -.6) * (Math.sin(x * 3.1) > -.2 ? 1 : .15); }
  };
  var counts = {};
  D.beats.forEach(function(b){ counts[b.energie] = (counts[b.energie] || 0) + 1; });
  $$('[data-count]').forEach(function(el){ var n = counts[el.getAttribute('data-count')] || 0; el.textContent = n ? n + (n > 1 ? ' instrumentales →' : ' instrumentale →') : 'sur demande →'; });
  var items = $$('.terr').map(function(btn){
    var cv = $('canvas', btn), o = { btn:btn, cv:cv, cx:cv.getContext('2d'), f:SHAPES[cv.getAttribute('data-shape')], t:0, on:false, dirty:true };
    btn.addEventListener('pointerenter', function(){ o.on = true; });
    btn.addEventListener('pointerleave', function(){ o.on = false; });
    btn.addEventListener('focus', function(){ o.on = true; });
    btn.addEventListener('blur', function(){ o.on = false; });
    btn.addEventListener('click', function(){ Room.filter(btn.getAttribute('data-energy')); Nav.go('#productions'); });
    return o;
  });
  var vis = false;
  watch($('#territoires'), function(v){ vis = v; items.forEach(function(o){ o.dirty = true; }); });
  onResize(function(){ items.forEach(function(o){ o.dirty = true; }); });
  onTick(function(t, dt){
    if(!vis) return;
    items.forEach(function(o){
      if(!o.on && !o.dirty) return;
      if(o.on) o.t += dt * 3;
      var s = fitCanvas(o.cv), W = s.w, H = s.h, cx = o.cx;
      cx.clearRect(0, 0, W, H);
      cx.strokeStyle = o.on ? paper(1) : ink(.85); cx.lineWidth = 1.2 * DPR;
      cx.beginPath();
      for(var x = 0; x <= W; x += 2){ var yy = H / 2 - o.f(x / W, o.t) * H * .42; x ? cx.lineTo(x, yy) : cx.moveTo(x, yy); }
      cx.stroke();
      o.dirty = o.on;
    });
  });
})();

/* ══════════════════════════════════════════════════════════════════════════
   02 — LA CHAMBRE D'ÉCOUTE
   ══════════════════════════════════════════════════════════════════════════ */
var Room = (function(){
  var beats = D.beats, idx = 0, room = $('#productions'), stage = $('#stage'), rail = $('#rail');
  var plate = $('#plate'), pcx = plate.getContext('2d'), plateHit = $('#plateHit'), status = $('#plateStatus');
  var holdBtn = $('#holdBtn'), stemsBox = $('#stems'), bStems = $('#bStems');
  var nameEl = $('#bName'), numEl = $('#bNum'), lineEl = $('#bLine');
  var scrub = $('#scrubWave'), scv = $('canvas', scrub), scx = scv.getContext('2d');
  var LAYOUTS = ['a', 'b', 'c'];
  var vis = false, visRatio = 0, cue = {}, holding = false, holdSrc = null;
  var P = { an:null, st:null, wind:1, windFrom:0, windT:-1, windDir:1, hoverRing:-1, glow:null, lastSeg:-1, dirty:true };
  var filterKey = null;

  watch(room, function(v, e){ vis = v; P.dirty = true; scv._dirty = true; }, '0px');
  watch(stage, function(v, e){ visRatio = e ? e.intersectionRatio : 1; }, '0px', [0, .25, .5, .75, 1]);

  /* Rail */
  var items = beats.map(function(b, i){
    var li = doc.createElement('li'), btn = doc.createElement('button');
    btn.type = 'button'; btn.className = 'rail-item'; btn.setAttribute('aria-current', 'false');
    btn.innerHTML = '<span class="ri-n mono">' + pad2(i + 1) + '</span><span class="ri-t">' + b.titre + '</span><canvas aria-hidden="true"></canvas>';
    btn.setAttribute('aria-label', b.titre + ', ' + b.bpm + ' BPM, ' + b.tonalite);
    btn.addEventListener('click', function(){ select(i, { user:true }); });
    btn.addEventListener('pointerenter', function(){ warm(i); });
    li.appendChild(btn); rail.appendChild(li);
    return { btn:btn, cv:$('canvas', btn), drawn:false };
  });
  function drawThumb(i){
    var it = items[i], st = A.info(beats[i].id);
    if(!st || !st.an) return;
    var s = fitCanvas(it.cv), W = s.w, H = s.h, cx = it.cv.getContext('2d'), pk = st.an.peaks, B = pk.length / 2;
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = paper(1);
    for(var x = 0; x < W; x += 2 * DPR){
      var j = Math.floor(x / W * B), m = Math.max(-pk[j * 2], pk[j * 2 + 1]);
      var h = Math.max(DPR, m * H * .9);
      cx.fillRect(x, (H - h) / 2, DPR, h);
    }
    it.drawn = true;
  }

  /* Préparation en arrière-plan : l'analyse de chaque instrumentale est calculée
     dès que la page est calme, pour que la partition soit prête avant le geste. */
  var queue = [], busy = false;
  function warm(i){ if(A.supported && !(A.info(beats[i].id) || {}).buffer){ queue.unshift(i); pump(); } }
  function pump(){
    if(busy || !queue.length) return;
    var i = queue.shift(), b = beats[i], st = A.info(b.id);
    if(st && st.buffer){ pump(); return; }
    busy = true;
    A.prepare(b).then(function(){ drawThumb(i); if(i === idx) adopt(); busy = false; setTimeout(pump, 60); },
      function(){ busy = false; if(i === idx) showStatus('Instrumentale indisponible'); setTimeout(pump, 60); });
  }
  function protect(){ A.protect = [beats[idx].id, beats[(idx + 1) % beats.length].id, beats[(idx - 1 + beats.length) % beats.length].id]; }
  function startPrep(){
    if(!A.supported){ showStatus('Le son n’est pas pris en charge par ce navigateur'); return; }
    var order = [idx, (idx + 1) % beats.length];
    beats.forEach(function(b, i){ if(order.indexOf(i) === -1) order.push(i); });
    order.push((idx + 1) % beats.length, idx);
    queue = order; protect(); pump();
  }

  /* ── Partition circulaire ──────────────────────────────────────────── */
  function drawPlate(t){
    var s = fitCanvas(plate), W = s.w, H = s.h, cx = pcx, c0 = W / 2, c1 = H / 2, R = Math.min(W, H) / 2 * .965;
    cx.clearRect(0, 0, W, H);
    var an = P.an, st = P.st, nS = an ? an.matrix.length : 6, segs = an ? an.matrix[0].length : 128;
    var grid = (st && st.grid) || 16, r0 = R * .3, r1 = R * .86, ring = (r1 - r0) / nS;
    var wind = P.wind, playing = A.playing && A.cur && A.cur.id === beats[idx].id;
    var pos = playing ? A.position() : (cue[beats[idx].id] || 0), dur = st ? st.duration : 1;
    var TAU = Math.PI * 2, start = -Math.PI / 2;

    /* graduations : pas, temps, mesures */
    cx.strokeStyle = paper(.34); cx.lineWidth = DPR;
    cx.beginPath();
    for(var k = 0; k < segs; k++){
      if(k / segs > wind) break;
      var a = start + k / segs * TAU, L = k % grid === 0 ? R * .07 : k % 4 === 0 ? R * .035 : R * .014;
      cx.moveTo(c0 + Math.cos(a) * R, c1 + Math.sin(a) * R);
      cx.lineTo(c0 + Math.cos(a) * (R - L), c1 + Math.sin(a) * (R - L));
    }
    cx.stroke();
    cx.fillStyle = paper(.55); cx.font = (9.5 * DPR) + 'px "IBM Plex Mono", monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    for(var bI = 0; bI < segs / grid; bI++){
      if(bI * grid / segs > wind) break;
      var ab = start + (bI * grid + grid * .5) / segs * TAU;
      cx.fillText(String(bI + 1), c0 + Math.cos(ab) * R * .93, c1 + Math.sin(ab) * R * .93);
    }

    /* anneaux : une piste par anneau, un secteur par pas */
    if(an){
      var gapA = Math.min(.012, TAU / segs * .16);
      for(var i = 0; i < nS; i++){
        var row = an.matrix[i], rin = r0 + i * ring + ring * .14, rout = r0 + (i + 1) * ring - ring * .14, rm = (rin + rout) / 2, half = (rout - rin) / 2;
        var muted = st && st.muted && st.muted[i], hl = P.hoverRing;
        var alpha = muted ? .16 : (hl >= 0 && hl !== i ? .3 : .92);
        cx.fillStyle = paper(alpha);
        cx.beginPath();
        for(var sI = 0; sI < segs; sI++){
          var fr = sI / segs;
          if(fr > wind) break;
          var v = row[sI];
          if(v < .045) continue;
          var edge = clamp((wind - fr) * 14, 0, 1), th = half * (.16 + .84 * Math.pow(v, .7)) * edge;
          var a0 = start + fr * TAU + gapA, a1 = start + (sI + 1) / segs * TAU - gapA;
          cx.moveTo(c0 + Math.cos(a0) * (rm + th), c1 + Math.sin(a0) * (rm + th));
          cx.arc(c0, c1, rm + th, a0, a1);
          cx.arc(c0, c1, rm - th, a1, a0, true);
          cx.closePath();
        }
        cx.fill();
        /* rémanence : les pas qui viennent de sonner restent rouges un instant */
        if(P.glow && !muted){
          var g = P.glow[i];
          for(var s2 = 0; s2 < segs; s2++){
            var gv = g[s2]; if(gv < .03) continue;
            var th2 = half * (.16 + .84 * Math.pow(row[s2], .7)), b0 = start + s2 / segs * TAU + gapA, b1 = start + (s2 + 1) / segs * TAU - gapA;
            cx.fillStyle = 'rgba(235,74,30,' + gv.toFixed(3) + ')';
            cx.beginPath();
            cx.arc(c0, c1, rm + th2, b0, b1); cx.arc(c0, c1, rm - th2, b1, b0, true); cx.closePath();
            cx.fill();
          }
        }
        if(hl === i){
          cx.strokeStyle = paper(.5); cx.lineWidth = DPR; cx.setLineDash([2 * DPR, 4 * DPR]);
          cx.beginPath(); cx.arc(c0, c1, rm, 0, TAU); cx.stroke(); cx.setLineDash([]);
        }
      }
    } else {
      cx.strokeStyle = paper(.18); cx.lineWidth = DPR;
      for(var q = 0; q < 6; q++){ cx.beginPath(); cx.arc(c0, c1, r0 + (q + .5) * (r1 - r0) / 6, 0, TAU); cx.stroke(); }
    }

    /* tête de lecture */
    if(st && wind > .99){
      var ap = start + (pos / dur) * TAU;
      cx.strokeStyle = playing ? SIG : paper(.7); cx.lineWidth = (playing ? 2 : 1) * DPR;
      cx.beginPath();
      cx.moveTo(c0 + Math.cos(ap) * r0 * .82, c1 + Math.sin(ap) * r0 * .82);
      cx.lineTo(c0 + Math.cos(ap) * R, c1 + Math.sin(ap) * R);
      cx.stroke();
    }

    /* cœur : le signal réel quand on maintient, l'invitation sinon */
    var rc = r0 * .74;
    if(playing){
      var wv = A.wave(), n = 180;
      cx.strokeStyle = SIG; cx.lineWidth = 1.4 * DPR;
      cx.beginPath();
      for(var w = 0; w <= n; w++){
        var aw = start + w / n * TAU, amp = wv[Math.floor(w / n * (wv.length - 1))] * rc * .55, rr = rc * .72 + amp;
        var px = c0 + Math.cos(aw) * rr, py = c1 + Math.sin(aw) * rr;
        w ? cx.lineTo(px, py) : cx.moveTo(px, py);
      }
      cx.closePath(); cx.stroke();
    } else {
      cx.strokeStyle = paper(.5); cx.lineWidth = DPR;
      cx.beginPath(); cx.arc(c0, c1, rc * .72, 0, TAU); cx.stroke();
      cx.fillStyle = paper(.92); cx.font = (10.5 * DPR) + 'px "IBM Plex Mono", monospace';
      cx.fillText(holding ? '…' : 'MAINTENIR', c0, c1 - 7 * DPR);
      cx.fillStyle = paper(.55); cx.font = (9.5 * DPR) + 'px "IBM Plex Mono", monospace';
      cx.fillText('POUR ÉCOUTER', c0, c1 + 8 * DPR);
    }
  }

  function tickPlate(t, dt){
    if(!vis) return;
    var playing = A.playing && A.cur && A.cur.id === beats[idx].id;
    if(P.windT >= 0){
      var k = clamp((t - P.windT) / (P.windDir > 0 ? .9 : .28), 0, 1), e = P.windDir > 0 ? easeOut(k) : k * k;
      P.wind = P.windDir > 0 ? e : 1 - e;
      if(k >= 1) P.windT = -1;
      P.dirty = true;
    }
    if(P.glow){
      var any = false;
      if(playing && P.st){
        var seg = curSeg();
        if(seg !== P.lastSeg){
          for(var i = 0; i < P.glow.length; i++){ if(!P.st.muted[i]) P.glow[i][seg] = Math.max(P.glow[i][seg], P.an.matrix[i][seg] > .08 ? .95 : 0); }
          P.lastSeg = seg;
        }
      }
      var dk = Math.exp(-dt * 2.6);
      for(var g = 0; g < P.glow.length; g++){ var row = P.glow[g]; for(var s = 0; s < row.length; s++){ if(row[s] > .002){ row[s] *= dk; any = true; } else row[s] = 0; } }
      if(any) P.dirty = true;
    }
    if(playing || P.dirty || plate._dirty){ drawPlate(t); P.dirty = false; plate._dirty = false; }
  }
  onTick(tickPlate);

  /* ── Forme d'onde : presser = écouter à partir d'ici ─────────────────── */
  var scrubHover = -1;
  function drawScrub(){
    var s = fitCanvas(scv), W = s.w, H = s.h, cx = scx, st = P.st, b = beats[idx];
    cx.clearRect(0, 0, W, H);
    if(!P.an || !st){ cx.fillStyle = paper(.25); cx.fillRect(0, H / 2, W, DPR); return; }
    var pk = P.an.peaks, B = pk.length / 2, playing = A.playing && A.cur && A.cur.id === b.id;
    var pos = playing ? A.position() : (cue[b.id] || 0), frac = pos / st.duration, step = 3 * DPR;
    for(var x = 0; x < W; x += step){
      var j0 = Math.floor(x / W * B), j1 = Math.max(j0 + 1, Math.floor((x + step) / W * B)), lo = 0, hi = 0;
      for(var j = j0; j < j1 && j < B; j++){ if(pk[j * 2] < lo) lo = pk[j * 2]; if(pk[j * 2 + 1] > hi) hi = pk[j * 2 + 1]; }
      var top = H / 2 - hi * H * .46, bot = H / 2 - lo * H * .46;
      cx.fillStyle = x / W <= frac ? (playing ? paper(1) : paper(.8)) : paper(.26);
      cx.fillRect(x, top, Math.max(DPR, step - DPR), Math.max(DPR, bot - top));
    }
    /* repères de mesure */
    var bars = st.bars || 8;
    cx.fillStyle = paper(.4);
    for(var m = 0; m <= bars; m++){ var mx = Math.min(W - DPR, m / bars * W); cx.fillRect(mx, 0, DPR, 5 * DPR); }
    cx.fillStyle = playing ? SIG : paper(1);
    cx.fillRect(Math.min(W - 2 * DPR, frac * W), 0, 2 * DPR, H);
    if(scrubHover >= 0){ cx.fillStyle = paper(.5); cx.fillRect(scrubHover * W, 0, DPR, H); }
    $('#scrubCur').textContent = fmt(pos);
    scrub.setAttribute('aria-valuenow', Math.round(frac * 100));
    scrub.setAttribute('aria-valuetext', fmt(pos) + ' sur ' + fmt(st.duration));
  }
  onTick(function(){
    if(!vis) return;
    var playing = A.playing && A.cur && A.cur.id === beats[idx].id;
    if(playing || scv._dirty){ drawScrub(); scv._dirty = false; }
  });
  function scrubFrac(e){ var r = scv.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, .999); }
  var scrubbing = false, lastSeekX = 0;
  scrub.addEventListener('pointerdown', function(e){
    if(e.button !== 0 || !P.st) return;
    e.preventDefault(); scrub.setPointerCapture(e.pointerId);
    scrubbing = true; lastSeekX = e.clientX;
    cue[beats[idx].id] = scrubFrac(e) * P.st.duration;
    hold('scrub');
  });
  scrub.addEventListener('pointermove', function(e){
    scrubHover = scrubFrac(e); scv._dirty = true;
    if(P.st) setTag(fmt(scrubHover * P.st.duration) + ' — mesure ' + (Math.floor(scrubHover * (P.st.bars || 8)) + 1));
    if(scrubbing && Math.abs(e.clientX - lastSeekX) > 5 && P.st){
      lastSeekX = e.clientX;
      var sec = scrubFrac(e) * P.st.duration; cue[beats[idx].id] = sec;
      if(A.playing) A.seek(sec);
    }
  });
  function endScrub(){ if(scrubbing){ scrubbing = false; release(); } }
  scrub.addEventListener('pointerup', endScrub);
  scrub.addEventListener('pointercancel', endScrub);
  scrub.addEventListener('pointerleave', function(){ scrubHover = -1; scv._dirty = true; setTag(''); });
  scrub.addEventListener('keydown', function(e){
    if(!P.st) return;
    var b = beats[idx], bar = P.st.duration / (P.st.bars || 8), c = cue[b.id] || 0;
    if(e.key === 'ArrowRight' || e.key === 'ArrowUp'){ c = Math.min(P.st.duration - .01, c + bar); }
    else if(e.key === 'ArrowLeft' || e.key === 'ArrowDown'){ c = Math.max(0, c - bar); }
    else if(e.key === 'Home'){ c = 0; }
    else return;
    e.preventDefault(); e.stopPropagation(); cue[b.id] = c; if(A.playing) A.seek(c); scv._dirty = true;
  });

  /* ── Maintenir pour écouter ──────────────────────────────────────────── */
  function showStatus(msg){ status.textContent = msg || ''; }
  function setHoldUI(on){
    holdBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    plateHit.classList.toggle('down', on);
    room.classList.toggle('playing', on);
    items[idx].btn.classList.toggle('is-playing', on);
    P.dirty = true;
  }
  function hold(src){
    if(holding) return;
    holding = true; holdSrc = src;
    A.ensure();
    setHoldUI(true);
    var b = beats[idx], st = A.info(b.id);
    if(!(st && st.buffer)) showStatus('Calcul du signal…');
    A.play(b, cue[b.id] || 0).then(function(){
      showStatus('');
      if(!holding || beats[idx].id !== b.id) A.pause();
    }, function(){ showStatus('Le son n’est pas disponible sur ce navigateur'); setHoldUI(false); holding = false; });
    setTimeout(function(){
      if(holding && A.ctx && A.ctx.state !== 'running') showStatus('Touchez une fois l’écran, puis maintenez');
    }, 260);
  }
  function release(){
    if(!holding) return;
    holding = false; holdSrc = null;
    var b = beats[idx];
    if(A.cur && A.cur.id === b.id && A.playing) cue[b.id] = A.position();
    A.pause();
    setHoldUI(false);
    scv._dirty = true;
  }
  function bindHold(el, name){
    el.addEventListener('pointerdown', function(e){
      if(e.button !== 0) return;
      try{ el.setPointerCapture(e.pointerId); }catch(x){}
      hold(name);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function(ev){ el.addEventListener(ev, function(){ if(holdSrc === name) release(); }); });
    el.addEventListener('contextmenu', function(e){ e.preventDefault(); });
    el.addEventListener('keydown', function(e){
      if((e.key === ' ' || e.key === 'Enter') && !e.repeat){ e.preventDefault(); e.stopPropagation(); hold(name + '-key'); }
    });
    el.addEventListener('keyup', function(e){
      if(e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); e.stopPropagation(); if(holdSrc === name + '-key') release(); }
    });
    el.addEventListener('click', function(e){ e.preventDefault(); });
  }
  bindHold(plateHit, 'plate');
  bindHold(holdBtn, 'btn');

  /* survol de la partition : quel instrument, quel pas */
  plateHit.addEventListener('pointermove', function(e){
    if(!P.an){ setTag('Maintenir pour écouter'); return; }
    var r = plate.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    var R = r.width / 2 * .965, d = Math.sqrt(dx * dx + dy * dy), r0 = R * .3, r1 = R * .86, nS = P.an.matrix.length;
    var ring = d >= r0 && d <= r1 ? Math.floor((d - r0) / (r1 - r0) * nS) : -1;
    if(ring !== P.hoverRing){ P.hoverRing = ring; P.dirty = true; $$('.stem', stemsBox).forEach(function(s, i){ s.classList.toggle('hl', i === ring); }); }
    if(ring >= 0 && P.st){
      var a = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2), segs = P.an.matrix[0].length, sI = Math.floor(a / (Math.PI * 2) * segs);
      var g = P.st.grid || 16, bar = Math.floor(sI / g) + 1, beat = Math.floor((sI % g) / 4) + 1, six = sI % 4 + 1;
      setTag(P.st.names[ring] + ' — ' + bar + '.' + beat + '.' + six);
    } else setTag(holding ? '' : 'Maintenir pour écouter');
  });
  plateHit.addEventListener('pointerleave', function(){ P.hoverRing = -1; P.dirty = true; setTag(''); $$('.stem', stemsBox).forEach(function(s){ s.classList.remove('hl'); }); });

  /* Clavier : maintenir Espace, flèches, chiffres */
  function roomActive(){ return vis && visRatio > .35; }
  addEventListener('keydown', function(e){
    if(typing() || e.metaKey || e.ctrlKey || e.altKey || !roomActive()) return;
    var a = doc.activeElement, onCtl = a && a !== body && a !== plateHit && a !== holdBtn && /^(BUTTON|A|SUMMARY)$/.test(a.tagName);
    if(e.key === ' ' && !onCtl){ e.preventDefault(); if(!e.repeat) hold('space'); }
    else if(e.key === 'ArrowRight' && a !== scrub){ e.preventDefault(); step(1); }
    else if(e.key === 'ArrowLeft' && a !== scrub){ e.preventDefault(); step(-1); }
    else if(/^[1-9]$/.test(e.key) && +e.key <= beats.length){ select(+e.key - 1, { user:true }); }
  });
  addEventListener('keyup', function(e){ if(e.key === ' ' && holdSrc === 'space'){ e.preventDefault(); release(); } });
  function step(d){
    var n = beats.length, i = idx;
    for(var k = 0; k < n; k++){ i = (i + d + n) % n; if(!filterKey || beats[i].energie === filterKey) break; }
    select(i, { user:true });
  }

  /* ── Pistes : déconstruire ─────────────────────────────────────────── */
  function buildStems(){
    var st = P.st;
    stemsBox.innerHTML = '';
    if(!st){ bStems.hidden = true; return; }
    bStems.hidden = !st.stems;
    if(!st.stems) return;
    st.names.forEach(function(n, i){
      var b = doc.createElement('button');
      b.type = 'button'; b.className = 'stem';
      b.setAttribute('aria-pressed', st.muted[i] ? 'false' : 'true');
      b.setAttribute('aria-label', n + (st.muted[i] ? ', coupée' : ', active'));
      b.innerHTML = '<span class="lvl" aria-hidden="true"></span>' + n;
      b.addEventListener('click', function(){
        var m = !st.muted[i];
        A.muteFor(beats[idx].id, i, m);
        b.setAttribute('aria-pressed', m ? 'false' : 'true');
        b.setAttribute('aria-label', n + (m ? ', coupée' : ', active'));
        P.dirty = true;
      });
      b.addEventListener('pointerenter', function(){ P.hoverRing = i; P.dirty = true; });
      b.addEventListener('pointerleave', function(){ P.hoverRing = -1; P.dirty = true; });
      stemsBox.appendChild(b);
    });
  }
  onTick(function(){
    if(!vis || !P.st || !P.st.stems) return;
    var playing = A.playing && A.cur && A.cur.id === beats[idx].id, seg = playing ? curSeg() : -1, btns = stemsBox.children;
    for(var i = 0; i < btns.length; i++){
      var lv = playing && !P.st.muted[i] ? P.an.matrix[i][seg] : 0, prev = btns[i]._lv || 0, nv = lv > prev ? lv : prev * .86;
      if(Math.abs(nv - prev) > .01 || (nv === 0 && prev !== 0)){ btns[i].style.setProperty('--lv', nv.toFixed(2)); btns[i]._lv = nv < .02 ? 0 : nv; }
    }
  });

  /* ── Relevés techniques ─────────────────────────────────────────────── */
  var sBpm = $('#sBpm'), metro = $('#sMetro'), sPos = $('#sPos'), sPeak = $('#sPeak');
  function odo(el, value){
    var str = String(value).padStart(3, '0');
    if(!el._cols){
      el.innerHTML = ''; el._cols = [];
      for(var c = 0; c < 3; c++){
        var d = doc.createElement('span'); d.className = 'd';
        for(var n = 0; n < 10; n++){ var s = doc.createElement('span'); s.textContent = n; d.appendChild(s); }
        el.appendChild(d); el._cols.push(d);
      }
    }
    el._cols.forEach(function(d, i){
      d.style.transform = 'translateY(' + (-1.45 * +str[i]) + 'em)';
      d.style.opacity = (i === 0 && str[0] === '0') ? '.3' : '1';
      d.style.transitionDelay = (i * 60) + 'ms';
    });
    el.setAttribute('aria-label', value);
  }
  var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#♭0123456789';
  function scramble(el, text){
    if(RM){ el.textContent = text; return; }
    var t0 = performance.now(), dur = 520;
    (function f(){
      var k = clamp((performance.now() - t0) / dur, 0, 1), n = Math.floor(k * text.length), out = text.slice(0, n);
      for(var i = n; i < text.length; i++) out += text[i] === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      el.textContent = out;
      if(k < 1) requestAnimationFrame(f); else el.textContent = text;
    })();
  }
  var lastBeatTick = -1;
  onTick(function(t){
    if(!vis) return;
    var b = beats[idx], playing = A.playing && A.cur && A.cur.id === b.id, bi;
    if(playing){
      var pos = A.position(), st = P.st, g = st.grid || 16, sd = st.duration / st.segs, sI = Math.floor(pos / sd);
      bi = Math.floor(sI / 4);
      sPos.textContent = (Math.floor(sI / g) + 1) + '.' + (Math.floor((sI % g) / 4) + 1) + '.' + (sI % 4 + 1);
      var lv = A.level(); sPeak.textContent = isFinite(lv.db) ? (lv.db <= 0 ? '−' : '+') + Math.abs(lv.db).toFixed(1) + ' dB' : '−∞ dB';
    } else {
      bi = Math.floor(t * b.bpm / 60);
    }
    if(bi !== lastBeatTick){
      lastBeatTick = bi; metro.classList.add('tick');
      setTimeout(function(){ metro.classList.remove('tick'); }, 90);
    }
  });
  function fillStatic(b, st){
    var c = cue[b.id] || 0, sd = st ? st.duration / st.segs : 1, g = (st && st.grid) || 16, sI = Math.floor(c / sd);
    sPos.textContent = st ? (Math.floor(sI / g) + 1) + '.' + (Math.floor((sI % g) / 4) + 1) + '.' + (sI % 4 + 1) : '1.1.1';
    sPeak.textContent = '−∞ dB';
    $('#sLen').textContent = st ? (st.bars || b.mesures) + ' mesures · ' + fmt(st.duration) : (b.mesures || 8) + ' mesures';
    $('#scrubDur').textContent = st ? fmt(st.duration) : '0:00';
  }

  /* ── Titre ──────────────────────────────────────────────────────────── */
  var measure = doc.createElement('span');
  measure.className = 'b-name'; measure.setAttribute('aria-hidden', 'true');
  measure.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:100px;left:-9999px;top:0;';
  stage.appendChild(measure);
  function fitTitle(){
    var words = beats[idx].titre.toUpperCase().split(' '), area = $('#bTitle'), aw = area.clientWidth;
    if(!aw) return;
    var ws = words.map(function(w){ measure.textContent = w; return measure.getBoundingClientRect().width; });
    measure.textContent = 'A A'; var space = measure.getBoundingClientRect().width; measure.textContent = 'AA'; space -= measure.getBoundingClientRect().width;
    var lay = stage.getAttribute('data-layout'), small = SMALL.matches;
    var maxS = small ? V.w * .24 : (lay === 'c' ? V.w * .16 : V.w * .105);
    var maxH = small ? V.h * .4 : stage.clientHeight * (lay === 'c' ? .24 : .42);
    var s = Math.min(maxS, aw / Math.max.apply(null, ws) * 100 * .98);
    function lines(size){ var n = 1, cur = 0; ws.forEach(function(w, i){ var ww = w * size / 100; if(cur && cur + space * size / 100 + ww > aw){ n++; cur = ww; } else cur += (cur ? space * size / 100 : 0) + ww; }); return n; }
    var L = lines(s);
    if(L * s * .82 > maxH){ s = maxH / (L * .82); }
    nameEl.style.setProperty('--tsz', s.toFixed(1) + 'px');
  }
  function setTitle(b, animate){
    nameEl.innerHTML = b.titre.toUpperCase().split(' ').map(function(w){
      return '<span class="l">' + w.split('').map(function(c, i){ return '<span style="--d:' + i + '">' + c + '</span>'; }).join('') + '</span>';
    }).join(' ');
    nameEl.setAttribute('aria-label', b.titre);
    fitTitle();
    if(animate && !RM){
      $$('.l > span', nameEl).forEach(function(s, i){
        s.animate([{ transform:'translateY(105%)' }, { transform:'translateY(0)' }], { duration:900, delay:i * 28, easing:'cubic-bezier(.16,1,.3,1)', fill:'backwards' });
      });
    }
  }
  function outTitle(){
    if(RM) return;
    $$('.l > span', nameEl).forEach(function(s, i){
      s.animate([{ transform:'translateY(0)' }, { transform:'translateY(-105%)' }], { duration:300, delay:i * 14, easing:'cubic-bezier(.7,0,.84,0)', fill:'forwards' });
    });
  }
  /* Le titre respire sur le kick : la chasse s'ouvre, puis se referme */
  var tw = 0;
  onHit(function(role, v){ if(role === 'kick' || role === 'bass') tw = Math.max(tw, v); });
  onTick(function(t, dt){
    if(!vis) return;
    tw *= Math.exp(-dt * 6);
    var x = 62 + tw * 10, w = 820 + tw * 80;
    if(Math.abs(x - (nameEl._x || 0)) > .05){ nameEl.style.setProperty('--tx', x.toFixed(2)); nameEl.style.setProperty('--tw', Math.round(w)); nameEl._x = x; }
  });

  /* ── Changement d'instrumentale ────────────────────────────────────── */
  var switching = false, pendingSel = null;
  function flip(els, change){
    var small = SMALL.matches || RM;
    var before = small ? null : els.map(function(e){ return e.getBoundingClientRect(); });
    change();
    if(small) return;
    els.forEach(function(e, i){
      var a = before[i], b = e.getBoundingClientRect();
      if(!b.width || !a.width) return;
      /* écart mesuré de centre à centre : l'échelle s'applique autour du centre */
      var dx = (a.left + a.width / 2) - (b.left + b.width / 2), dy = (a.top + a.height / 2) - (b.top + b.height / 2), sc = a.width / b.width;
      if(Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sc - 1) < .01) return;
      var isPlate = e === plate;
      e.animate(isPlate
        ? [{ translate:dx + 'px ' + dy + 'px', scale:String(sc) }, { translate:'0 0', scale:'1' }]
        : [{ translate:dx + 'px ' + dy + 'px', opacity:.2 }, { translate:'0 0', opacity:1 }],
        { duration:950, easing:'cubic-bezier(.16,1,.3,1)' });
    });
  }
  function adopt(){
    var b = beats[idx], st = A.info(b.id);
    if(!st || !st.an){ return; }
    if(P.st === st) return;
    P.st = st; P.an = st.an;
    P.glow = st.an.matrix.map(function(r){ return new Float32Array(r.length); });
    P.lastSeg = -1; P.dirty = true; scv._dirty = true;
    buildStems(); fillStatic(b, st);
    if(P.wind < 1 && P.windT < 0){ P.windDir = 1; P.windT = performance.now() / 1000; }
    showStatus('');
  }
  function apply(i, opts){
    var b = beats[i], prevIdx = idx;
    idx = i;
    items.forEach(function(it, k){ it.btn.setAttribute('aria-current', k === i ? 'true' : 'false'); it.btn.classList.remove('is-playing'); });
    var layout = SMALL.matches ? 'a' : LAYOUTS[i % LAYOUTS.length];
    flip([plate, $('#bTitle'), $('#bSpec'), $('#bActions'), bStems], function(){
      stage.setAttribute('data-layout', layout);
      setTitle(b, opts.animate);
    });
    plate._dirty = true;
    numEl.textContent = pad2(i + 1) + ' / ' + pad2(beats.length) + ' — ' + b.genre;
    lineEl.textContent = b.ligne || '';
    odo(sBpm, b.bpm);
    scramble($('#sKey'), b.tonalite);
    $('#sSig').textContent = b.mesure || '4/4';
    $('#sEnergy').textContent = D.energies[b.energie] || '—';
    $('#sGenre').textContent = b.genre || '—';
    holdBtn.querySelector('.hold-txt').textContent = 'Maintenir pour écouter';
    plateHit.setAttribute('aria-label', 'Maintenir pour écouter ' + b.titre);
    P.st = null; P.an = null; P.glow = null; P.hoverRing = -1;
    fillStatic(b, null);
    buildStems();
    P.wind = 0; P.windDir = 1; P.windT = -1;
    var st = A.info(b.id);
    if(st && st.an){ adopt(); P.windT = performance.now() / 1000; }
    else { showStatus(A.supported ? 'Calcul du signal…' : ''); warm(i); }
    protect();
    warm((i + 1) % beats.length);
    /* si l'on maintient pendant le changement, le son suit en fondu */
    if(holding){ A.play(b, cue[b.id] || 0).then(function(){ if(!holding) A.pause(); }); }
    else if(A.cur && A.playing) A.pause();
    if(opts.user){
      try{ var u = new URL(location.href); u.searchParams.set('beat', b.id); history.replaceState(null, '', u.pathname + u.search + location.hash); }catch(e){}
    }
    scv._dirty = true;
    if(opts.user && SMALL.matches){ var rl = rail.getBoundingClientRect(), br = items[i].btn.getBoundingClientRect(); rail.scrollBy({ left:br.left - rl.left - (rl.width - br.width) / 2, behavior:RM ? 'auto' : 'smooth' }); }
  }
  function select(i, opts){
    opts = opts || {};
    if(i === idx && P.st && !opts.force) return;
    if(switching){ pendingSel = [i, opts]; return; }
    if(!opts.user || RM || !vis){ apply(i, { animate:!RM && vis, user:opts.user }); return; }
    switching = true;
    outTitle();
    P.windDir = -1; P.windT = performance.now() / 1000;
    $$('#bSpec dd, #bLine').forEach(function(el){ el.animate([{ opacity:1 }, { opacity:0 }], { duration:220, fill:'forwards' }); });
    setTimeout(function(){
      apply(i, { animate:true, user:true });
      $$('#bSpec dd, #bLine').forEach(function(el){ el.getAnimations().forEach(function(a){ a.cancel(); }); el.animate([{ opacity:0 }, { opacity:1 }], { duration:500, delay:250 }); });
      switching = false;
      if(pendingSel){ var p = pendingSel; pendingSel = null; select(p[0], p[1]); }
    }, 300);
  }

  /* Filtre par territoire */
  function filter(key){
    filterKey = key || null;
    var f = $('#roomFilter');
    items.forEach(function(it, i){ it.btn.classList.toggle('dim', !!key && beats[i].energie !== key); });
    f.hidden = !key;
    if(key){
      $('#roomFilterName').textContent = D.energies[key];
      var first = -1; beats.forEach(function(b, i){ if(first < 0 && b.energie === key) first = i; });
      if(first >= 0) select(first, { user:true, force:true });
    }
  }
  $('#roomFilterClear').addEventListener('click', function(){ filter(null); });

  /* Partage */
  $('#shareBtn').addEventListener('click', function(){
    var u = new URL(location.href); u.hash = 'productions'; u.searchParams.set('beat', beats[idx].id);
    var s = u.toString();
    (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(function(){ toast('Lien copié : ' + beats[idx].titre); }, function(){ prompt('Lien de l’instrumentale :', s); });
  });

  onResize(function(){ plate._dirty = true; scv._dirty = true; P.dirty = true; fitTitle(); items.forEach(function(it, i){ drawThumb(i); }); });

  /* Instrumentale demandée dans l'adresse */
  var want = 0;
  try{ var q = new URLSearchParams(location.search).get('beat'); beats.forEach(function(b, i){ if(b.id === q) want = i; }); }catch(e){}
  apply(want, { animate:false });

  return { select:select, filter:filter, release:release, startPrep:startPrep, fitTitle:fitTitle, wanted:want > 0 || /[?&]beat=/.test(location.search) };
})();

/* ══════════════════════════════════════════════════════════════════════════
   03 — LES VOIX : une bande qui défile sous une tête de lecture
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  var list = $('#reelList'), lis = $$('li', list), frame = $('#reelFrame'), cap = $('#reelCap'), head = $('.reel-head'), photo = $('#reelPhoto');
  var BASE = 'https://res.cloudinary.com/o781tzyj/image/upload/f_auto,q_auto,w_720,h_900,c_fill,g_face/';
  var vis = false, lit = -1, cache = {};
  watch($('#reel'), function(v){ vis = v; }, '10% 0px');
  function url(i){ return BASE + lis[i].getAttribute('data-photo'); }
  function preload(i){ if(i < 0 || i >= lis.length || cache[i]) return; var im = new Image(); im.src = url(i); cache[i] = im; }
  function show(i){
    var li = lis[i], name = $('.r-name', li).textContent, ep = li.getAttribute('data-ep');
    lis.forEach(function(l, k){ l.classList.toggle('lit', k === i); l.classList.toggle('near', Math.abs(k - i) === 1); });
    cap.innerHTML = '<span>Voix ' + pad2(i + 1) + ' / ' + lis.length + '</span><span>' + name + (ep ? ' — ' + ep : '') + '</span>';
    var img = doc.createElement('img');
    img.alt = name + ', artiste enregistré au studio'; img.src = url(i); img.decoding = 'async';
    img.className = RM ? '' : 'enter';
    frame.appendChild(img);
    var olds = $$('img', frame);
    if(olds.length > 2) olds.slice(0, olds.length - 2).forEach(function(o){ o.remove(); });
    setTimeout(function(){ $$('img', frame).slice(0, -1).forEach(function(o){ o.remove(); }); }, 1000);
    preload(i + 1); preload(i - 1);
  }
  onTick(function(){
    if(!vis) return;
    var hy = head.getBoundingClientRect().top, best = -1, bd = 1e9;
    for(var i = 0; i < lis.length; i++){
      var r = lis[i].getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - hy);
      if(d < bd){ bd = d; best = i; }
    }
    if(best !== lit && best >= 0){ lit = best; show(best); }
  });
  /* profondeur : le cadre suit le pointeur */
  if(FINE && !RM){
    photo.style.perspective = '900px';
    photo.addEventListener('pointermove', function(e){
      var r = photo.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      frame.style.transform = 'rotateY(' + (x * 9).toFixed(2) + 'deg) rotateX(' + (-y * 9).toFixed(2) + 'deg)';
    });
    photo.addEventListener('pointerleave', function(){ frame.style.transform = ''; });
    frame.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)';
  }
})();

/* ══════════════════════════════════════════════════════════════════════════
   04 — IN PHASE : deux signaux, un déphasage, et le silence qui en naît
   ══════════════════════════════════════════════════════════════════════════ */
var Phase = (function(){
  var scene = $('#phaseScene'), cv = $('#phaseField'), cx = cv.getContext('2d'), cover = $('#phaseCover');
  var ta = $('.pt-a'), tb = $('.pt-b'), deg = $('#phDeg'), dbEl = $('#phDb'), cap = $('#phaseCaption'), btn = $('#phaseListen');
  var vis = false, phi = 180, nudge = 0, nudgeT = 0, capState = 0, holding = false;
  var CAP = [cap.textContent, 'En phase. Sept titres, un seul son : le premier EP signé GUNSILENT BEATZ.'];
  watch(scene, function(v){ vis = v; if(!v) release(); });
  scene.addEventListener('pointermove', function(e){ nudgeT = (e.clientX / V.w - .5) * 70; }, { passive:true });
  scene.addEventListener('pointerleave', function(){ nudgeT = 0; });

  function press(e){ if(e && e.button) return; holding = true; btn.setAttribute('aria-pressed', 'true'); A.phase(true, phi); }
  function release(){ if(!holding) return; holding = false; btn.setAttribute('aria-pressed', 'false'); A.phase(false); }
  btn.addEventListener('pointerdown', function(e){ try{ btn.setPointerCapture(e.pointerId); }catch(x){} press(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function(ev){ btn.addEventListener(ev, release); });
  btn.addEventListener('keydown', function(e){ if((e.key === ' ' || e.key === 'Enter') && !e.repeat){ e.preventDefault(); press(); } });
  btn.addEventListener('keyup', function(e){ if(e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); release(); } });
  btn.addEventListener('click', function(e){ e.preventDefault(); });
  btn.addEventListener('contextmenu', function(e){ e.preventDefault(); });

  onTick(function(t, dt){
    if(!vis) return;
    var r = scene.getBoundingClientRect(), p = RM ? 1 : clamp(-r.top / Math.max(1, r.height - V.h), 0, 1);
    nudge = lerp(nudge, nudgeT, .08);
    var target = 180 * (1 - smooth(.06, .6, p));
    phi = clamp(target + nudge * (1 - smooth(.5, .62, p)) * (target > 5 ? 1 : .2), 0, 180);
    var rad = phi * Math.PI / 180, sumAmp = Math.abs(Math.cos(rad / 2)) * 2;
    deg.textContent = Math.round(phi) + '°';
    dbEl.textContent = sumAmp < .005 ? '−∞ dB' : (20 * Math.log10(sumAmp) >= 0 ? '+' : '−') + Math.abs(20 * Math.log10(sumAmp)).toFixed(1) + ' dB';
    if(holding) A.phase(true, phi);

    /* le titre dédoublé se referme quand les signaux se rejoignent */
    var off = Math.sin(rad / 2) * Math.min(90, V.h * .09), op = lerp(1, .5, Math.sin(rad / 2));
    ta.style.transform = 'translate3d(0,' + (-off).toFixed(1) + 'px,0)'; tb.style.transform = 'translate3d(0,' + off.toFixed(1) + 'px,0)';
    ta.style.opacity = tb.style.opacity = op.toFixed(3);

    var c = smooth(.52, .82, p), ins = ((1 - c) * 50).toFixed(2);
    cover.style.clipPath = 'inset(' + ins + '% 0 ' + ins + '% 0)';
    cover.style.transform = 'translate(-50%,-50%) scale(' + lerp(.94, 1, c).toFixed(3) + ')';
    var cs = p > .62 ? 1 : 0;
    if(cs !== capState){
      capState = cs;
      cap.animate([{ opacity:1 }, { opacity:0 }], { duration:200 }).onfinish = function(){ cap.textContent = CAP[cs]; cap.animate([{ opacity:0 }, { opacity:1 }], { duration:400 }); };
    }

    var s = fitCanvas(cv), W = s.w, H = s.h, mid = H / 2, amp = H * .17, k = Math.PI * 2 * 2.5 / W, w = t * 1.3;
    cx.clearRect(0, 0, W, H);
    var fade = 1 - c * .75;
    cx.lineWidth = DPR; cx.strokeStyle = 'rgba(244,233,225,' + (.42 * fade).toFixed(3) + ')';
    cx.beginPath(); for(var x = 0; x <= W; x += 3){ var y = mid - Math.sin(x * k - w) * amp; x ? cx.lineTo(x, y) : cx.moveTo(x, y); } cx.stroke();
    cx.setLineDash([4 * DPR, 5 * DPR]);
    cx.beginPath(); for(var x2 = 0; x2 <= W; x2 += 3){ var y2 = mid - Math.sin(x2 * k - w + rad) * amp; x2 ? cx.lineTo(x2, y2) : cx.moveTo(x2, y2); } cx.stroke();
    cx.setLineDash([]);
    cx.lineWidth = 2.4 * DPR; cx.strokeStyle = holding ? SIG : 'rgba(244,233,225,' + (.95 * fade + .05).toFixed(3) + ')';
    cx.beginPath(); for(var x3 = 0; x3 <= W; x3 += 3){ var y3 = mid - (Math.sin(x3 * k - w) + Math.sin(x3 * k - w + rad)) * amp; x3 ? cx.lineTo(x3, y3) : cx.moveTo(x3, y3); } cx.stroke();
  });

  /* Pochette : recto, verso */
  var sleeve = $('#sleeve'), flipBtn = $('#sleeveFlip');
  function flipSleeve(){
    var on = !sleeve.classList.contains('flipped');
    sleeve.classList.toggle('flipped', on);
    flipBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    flipBtn.textContent = on ? 'Revenir au recto' : 'Retourner la pochette';
  }
  flipBtn.addEventListener('click', flipSleeve);
  sleeve.addEventListener('click', flipSleeve);
  if(FINE) sleeve.style.cursor = 'pointer';

  return { release:release };
})();

/* Dépliants animés : crédits de l'EP et questions */
$$('.tracklist details, .qa').forEach(function(d){
  var sum = $('summary', d), content = $('.tk-cr, .q-a', d), anim = null;
  content.style.overflow = 'hidden';
  sum.addEventListener('click', function(e){
    if(RM || !content.animate) return;
    e.preventDefault();
    if(anim) anim.cancel();
    if(!d.open){
      d.open = true;
      var h = content.scrollHeight;
      anim = content.animate([{ height:'0px', opacity:0 }, { height:h + 'px', opacity:1 }], { duration:560, easing:'cubic-bezier(.16,1,.3,1)' });
      anim.onfinish = function(){ anim = null; };
    } else {
      var h2 = content.offsetHeight;
      anim = content.animate([{ height:h2 + 'px', opacity:1 }, { height:'0px', opacity:0 }], { duration:360, easing:'cubic-bezier(.7,0,.84,0)' });
      anim.onfinish = function(){ d.open = false; anim = null; };
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   05 — DROITS : un seul fader, quatre degrés de propriété
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  var fader = $('#fader'), cap = $('#faderCap'), marks = $$('#faderMarks button'), tiers = $$('.tier'), meter = $('#meter');
  var NAMES = ['Starter', 'Studio', 'Signature', 'Exclusive'], PRICES = [30000, 85000, 180000, null];
  var SEG = 24, cur = -1, dragging = false;
  for(var i = 0; i < SEG; i++){ var s = doc.createElement('i'); if(i >= SEG - 3) s.className = 'clip'; meter.appendChild(s); }
  var segs = $$('i', meter);
  function lightMeter(level){
    var n = Math.round(level * SEG);
    segs.forEach(function(s, i){
      var on = i < n;
      if(s.classList.contains('on') === on) return;
      var dl = RM ? 0 : Math.abs(i - (on ? 0 : SEG)) * 14;
      clearTimeout(s._t);
      s._t = setTimeout(function(){ s.classList.toggle('on', on); }, on ? i * 16 : (SEG - i) * 10);
    });
  }
  function tweenPrice(el, from, to){
    if(RM || from == null){ el.textContent = nbsp(to); return; }
    var t0 = performance.now(), dur = 750;
    (function f(){
      var k = easeOut(clamp((performance.now() - t0) / dur, 0, 1)), v = Math.round(lerp(from, to, k) / 1000) * 1000;
      el.textContent = nbsp(v);
      if(k < 1) requestAnimationFrame(f);
    })();
  }
  function setPos(p){ fader.style.setProperty('--pos', p.toFixed(4)); }
  function set(i, from){
    i = clamp(i, 0, 3);
    if(!dragging) setPos(i / 3);
    if(i === cur) return;
    var prev = cur; cur = i;
    tiers.forEach(function(t){ t.classList.toggle('on', +t.getAttribute('data-tier') === i); });
    marks.forEach(function(m){ m.classList.toggle('on', +m.getAttribute('data-tier') === i); });
    fader.classList.toggle('sat', i === 3);
    cap.setAttribute('aria-valuenow', i + 1);
    cap.setAttribute('aria-valuetext', 'Niveau ' + pad2(i + 1) + ', ' + NAMES[i]);
    lightMeter(i === 3 ? 1 : (i + 1) / 4 * .86);
    var num = $('.tier[data-tier="' + i + '"] .num:not(.num-text)');
    if(num && PRICES[i] != null) tweenPrice(num, prev >= 0 ? PRICES[prev] : null, PRICES[i]);
  }
  marks.forEach(function(m){ m.addEventListener('click', function(){ set(+m.getAttribute('data-tier')); }); });
  cap.addEventListener('keydown', function(e){
    var k = e.key;
    if(k === 'ArrowUp' || k === 'ArrowRight' || k === 'PageUp'){ e.preventDefault(); set(cur + 1); }
    else if(k === 'ArrowDown' || k === 'ArrowLeft' || k === 'PageDown'){ e.preventDefault(); set(cur - 1); }
    else if(k === 'Home'){ e.preventDefault(); set(0); }
    else if(k === 'End'){ e.preventDefault(); set(3); }
  });
  function fromY(e){
    var tr = $('.fader-track', fader).getBoundingClientRect();
    return clamp((tr.bottom - e.clientY) / tr.height, 0, 1);
  }
  function down(e){
    if(e.button) return;
    if(e.target.closest && e.target.closest('.fader-marks')) return;
    dragging = true; fader.classList.add('dragging'); e.preventDefault();
    try{ fader.setPointerCapture(e.pointerId); }catch(x){}
    cap.focus({ preventScroll:true });
    move(e);
  }
  function move(e){ if(!dragging) return; var p = fromY(e); setPos(p); set(Math.round(p * 3)); }
  function up(){ if(!dragging) return; dragging = false; fader.classList.remove('dragging'); setPos(cur / 3); }
  fader.addEventListener('pointerdown', down);
  fader.addEventListener('pointermove', move);
  fader.addEventListener('pointerup', up);
  fader.addEventListener('pointercancel', up);
  set(1);

  /* « Choisir » : le brief est pré-rempli avec le niveau */
  $$('[data-choose]').forEach(function(a){
    a.addEventListener('click', function(){
      var sel = $('#budget'); sel.value = a.getAttribute('data-choose');
      sel.dispatchEvent(new Event('change'));
    });
  });
})();

/* ══════════════════════════════════════════════════════════════════════════
   06 — SESSIONS : l'agenda affiché comme un arrangement
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  var S = D.studio, tracks = $('#arrTracks'), ruler = $('#arrRuler'), nowEl = $('#arrNow'), insp = $('#inspector');
  var DAY = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'], DAYF = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  var MON = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function mins(s){ var m = s.match(/(\d{1,2})\s*[:h]\s*(\d{2})/g); return (m || []).map(function(x){ var q = x.match(/(\d{1,2})\s*[:h]\s*(\d{2})/); return +q[1] * 60 + +q[2]; }); }
  function key(d){ return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
  function label(d){ return DAYF[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }

  /* Amplitude horaire : du premier début à la dernière fin, arrondie à l'heure */
  var lo = 24 * 60, hi = 0;
  Object.keys(S.horaires).forEach(function(k){ S.horaires[k].forEach(function(s){ var m = mins(s); if(m[0] < lo) lo = m[0]; if(m[1] > hi) hi = m[1]; }); });
  lo = Math.floor(lo / 60) * 60; hi = Math.ceil(hi / 60) * 60;
  var span = Math.max(60, hi - lo), hours = span / 60;
  for(var h = 0; h <= hours; h++){
    if(SMALL.matches && h % 2 && h !== hours) continue;
    var sp = doc.createElement('span'); sp.style.left = (h / hours * 100) + '%'; sp.textContent = pad2(lo / 60 + h) + 'h'; ruler.appendChild(sp);
  }

  /* Le studio vit à l'heure de Dakar : GMT, sans heure d'été */
  var now = new Date(), today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  var nowMin = now.getUTCHours() * 60 + now.getUTCMinutes(), months = [];
  for(var i = 0; i < (S.fenetre || 14); i++){
    var d = new Date(today.getTime() + i * 864e5), k = key(d), li = doc.createElement('li');
    li.className = 'track' + (i === 0 ? ' today' : '');
    li.style.setProperty('--hours', hours);
    var mo = MON[d.getUTCMonth()]; if(months.indexOf(mo) === -1) months.push(mo);
    li.innerHTML = '<span class="track-lbl">' + DAY[d.getUTCDay()] + ' <b>' + d.getUTCDate() + '</b></span><div class="track-lane"></div>';
    var lane = $('.track-lane', li), closed = (S.fermetures || []).indexOf(k) !== -1, base = S.horaires[d.getUTCDay()] || [];
    if(closed || !base.length){
      lane.innerHTML = '<span class="quiet"></span><span class="quiet-lbl">' + (closed ? 'studio fermé' : 'silence') + '</span>';
      li.setAttribute('aria-label', label(d) + ' : ' + (closed ? 'studio fermé' : 'pas de session'));
    } else {
      var taken = (S.reserves || {})[k] || [];
      base.forEach(function(s){
        var m = mins(s), left = (m[0] - lo) / span * 100, width = (m[1] - m[0]) / span * 100, el;
        var state = taken.indexOf(s) !== -1 ? 'taken' : (i === 0 && m[0] <= nowMin ? 'past' : 'open');
        var start = s.split(/[–-]/)[0].trim();
        if(state === 'open'){
          el = doc.createElement('button'); el.type = 'button'; el.className = 'clip';
          el.innerHTML = '<span>' + start + '</span><span class="go" aria-hidden="true">Armer →</span>';
          el.setAttribute('aria-label', 'Armer le créneau ' + s + ', ' + label(d));
          (function(dd, ss, btn){ btn.addEventListener('click', function(){ arm(dd, ss, btn); }); })(d, s, el);
        } else {
          el = doc.createElement('span'); el.className = 'clip ' + state;
          el.textContent = state === 'taken' ? 'Réservé' : 'Passé';
          el.setAttribute('aria-label', s + ', ' + (state === 'taken' ? 'réservé' : 'passé'));
        }
        el.style.left = left + '%'; el.style.width = 'calc(' + width + '% - 4px)';
        lane.appendChild(el);
      });
    }
    tracks.appendChild(li);
  }
  $('#arrMonth').textContent = months.join(' — ') + ' ' + today.getUTCFullYear();

  function placeNow(){
    var n = new Date(), m = n.getUTCHours() * 60 + n.getUTCMinutes() + n.getUTCSeconds() / 60;
    if(m < lo || m > hi){ nowEl.hidden = true; return; }
    nowEl.hidden = false;
    var lane = $('.track-lane', tracks), body2 = $('#arrBody');
    if(!lane) return;
    var lr = lane.getBoundingClientRect(), br = body2.getBoundingClientRect();
    nowEl.style.left = (lr.left - br.left + (m - lo) / span * lr.width) + 'px';
  }
  placeNow(); setInterval(placeNow, 30000); onResize(placeNow);

  var armed = null, form = $('#bookForm');
  function arm(d, s, btn){
    if(armed) armed.btn.classList.remove('armed');
    armed = { d:d, s:s, btn:btn };
    btn.classList.add('armed');
    insp.classList.add('armed');
    $('#inspStateTxt').textContent = 'Créneau armé';
    $('#inspTitle').textContent = label(d);
    $('#inspSub').textContent = s + ' · heure de Dakar. Le studio confirme sur WhatsApp, le créneau n’est bloqué qu’après sa réponse.';
    form.hidden = false;
    if(SMALL.matches) insp.scrollIntoView({ behavior:RM ? 'auto' : 'smooth', block:'start' });
    setTimeout(function(){ $('#bookName').focus({ preventScroll:true }); }, 120);
  }
  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(!armed) return;
    var nom = $('#bookName').value.trim(), contact = $('#bookContact').value.trim(), note = $('#bookNote').value.trim();
    if(!nom || !contact){ (nom ? $('#bookContact') : $('#bookName')).focus(); return; }
    var msg = 'Bonjour GUNSILENT BEATZ, je souhaite réserver une session studio.\n\n' +
      'Date : ' + label(armed.d) + '\nCréneau : ' + armed.s + ' (heure de Dakar)\nNom : ' + nom + '\nContact : ' + contact + (note ? '\n\n' + note : '');
    window.open('https://wa.me/' + S.whatsapp + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });
})();

/* ══════════════════════════════════════════════════════════════════════════
   07 — BRIEF : une phrase à compléter
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  var form = $('#briefForm');
  var mirror = doc.createElement('span');
  mirror.setAttribute('aria-hidden', 'true');
  mirror.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;';
  form.appendChild(mirror);
  function sizeTo(el, text){
    var cs = getComputedStyle(el);
    mirror.style.font = cs.font; mirror.style.letterSpacing = cs.letterSpacing; mirror.style.fontStyle = cs.fontStyle;
    mirror.textContent = text || ' ';
    var extra = el.tagName === 'SELECT' ? parseFloat(cs.fontSize) * .85 : parseFloat(cs.fontSize) * .2;
    el.style.width = Math.ceil(mirror.getBoundingClientRect().width + extra) + 'px';
  }
  function sizeAll(){
    $$('select', form).forEach(function(s){ sizeTo(s, s.options[s.selectedIndex].text); });
    $$('input.ml-input', form).forEach(function(i){ sizeTo(i, i.value || i.placeholder); });
    $$('textarea', form).forEach(grow);
  }
  function grow(t){ t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
  $$('select', form).forEach(function(s){ s.addEventListener('change', function(){ sizeTo(s, s.options[s.selectedIndex].text); }); });
  $$('input.ml-input', form).forEach(function(i){ i.addEventListener('input', function(){ sizeTo(i, i.value || i.placeholder); if(i.id === 'contact' && i.value.trim()){ i.removeAttribute('aria-invalid'); $('#contactErr').textContent = ''; } }); });
  $$('textarea', form).forEach(function(t){ t.addEventListener('input', function(){ grow(t); }); });
  (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(sizeAll);
  onResize(sizeAll);

  form.addEventListener('submit', function(e){
    e.preventDefault();
    function val(id){ return ($('#' + id).value || '').trim(); }
    var c = $('#contact');
    if(!val('contact')){
      c.setAttribute('aria-invalid', 'true');
      $('#contactErr').textContent = 'Indiquez un email ou un numéro WhatsApp pour recevoir la réponse.';
      c.focus(); return;
    }
    var lignes = [
      'Bonjour GUNSILENT BEATZ, voici mon brief.', '',
      'Type d\'artiste : ' + val('artistType'),
      'Énergie recherchée : ' + val('energy'),
      'Délai souhaité : ' + val('deadline'),
      'Niveau envisagé : ' + val('budget'),
      'Contact : ' + val('contact')
    ];
    if(val('refs')) lignes.push('Références : ' + val('refs'));
    if(val('emotion')) lignes.push('', 'Émotion à transmettre :', val('emotion'));
    window.open('https://wa.me/' + D.studio.whatsapp + '?text=' + encodeURIComponent(lignes.join('\n')), '_blank', 'noopener');
  });
})();

/* Signature finale : GUN·SIL·ENT se relit à l'envers, comme l'adresse du studio */
(function(){
  var mark = $('#outroMark'), row = $('.om-row', mark), segs = $$('.om-s', mark);
  function fit(){
    row.style.fontSize = '100px';
    var w = segs.reduce(function(a, s){ return a + s.getBoundingClientRect().width; }, 0), W = mark.clientWidth;
    row.style.fontSize = (W / w * 100 * .99) + 'px';
    var ws = segs.map(function(s){ return s.getBoundingClientRect().width; });
    segs[0].style.setProperty('--dx', (ws[1] + ws[2]) + 'px');
    segs[1].style.setProperty('--dx', (ws[2] - ws[0]) + 'px');
    segs[2].style.setProperty('--dx', -(ws[0] + ws[1]) + 'px');
  }
  (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(fit);
  onResize(fit);
})();

/* ══════════════════════════════════════════════════════════════════════════
   NAVIGATION : transport, menu, rideau
   ══════════════════════════════════════════════════════════════════════════ */
var Nav = (function(){
  var LABELS = { intro:'Gunsilent', artiste:'Portrait', productions:'Productions', voix:'Voix', 'in-phase':'In Phase', licences:'Licences', studio:'Studio', brief:'Brief' };
  var secs = $$('main > [data-num]').map(function(el){ return { el:el, id:el.id, num:el.getAttribute('data-num'), part:el.getAttribute('data-part'), label:LABELS[el.id] || el.id }; });
  var tp = $('#transport'), map = $('#tpMap'), menu = $('#menu'), menuBtn = $('#tpMenu'), mlist = $('#menuList');
  var tpNum = $('#tpNum'), tpPart = $('#tpPart'), tpTime = $('#tpTime'), head = doc.createElement('span');
  head.className = 'tp-head';
  secs.forEach(function(s, i){
    var li = doc.createElement('li'), a = doc.createElement('a');
    a.href = '#' + s.id; a.innerHTML = '<span class="n">' + s.num + '</span><span class="l">' + s.label + '</span>'; a.setAttribute('aria-label', s.num + ', ' + s.label);
    li.innerHTML = '<span class="fill"></span>'; li.appendChild(a); map.appendChild(li); s.seg = li;
    var mi = doc.createElement('li');
    mi.innerHTML = '<a href="#' + s.id + '" style="--i:' + i + '"><span class="mono">' + s.num + '</span><span class="m-word">' + s.label + '</span><span class="m-sub">' + s.part + '</span></a>';
    mlist.appendChild(mi); s.mi = mi;
  });
  map.appendChild(head);
  var tops = [], total = 1;
  function measure(){
    tops = secs.map(function(s){ return s.el.offsetTop; });
    total = doc.documentElement.scrollHeight - V.h;
    secs.forEach(function(s, i){ var h = (i < secs.length - 1 ? tops[i + 1] : doc.documentElement.scrollHeight) - tops[i]; s.h = h; s.seg.style.setProperty('--f', Math.max(1, h / V.h).toFixed(2)); });
    /* un libellé qui ne tient pas cède la place à son seul numéro */
    requestAnimationFrame(function(){ secs.forEach(function(s){ var a = $('a', s.seg); a.classList.remove('tight'); if(a.scrollWidth > a.clientWidth + 1) a.classList.add('tight'); }); });
  }
  measure(); onResize(measure);
  addEventListener('load', measure);
  var cur = -1, lastBar = '';
  onTick(function(){
    var y = V.y, probe = y + V.h * .42, c = 0;
    for(var i = 0; i < secs.length; i++) if(probe >= tops[i]) c = i;
    if(c !== cur){
      cur = c;
      tpNum.textContent = secs[c].num;
      tpPart.textContent = secs[c].part;
      if(!RM){ tpPart.classList.remove('roll'); void tpPart.offsetWidth; tpPart.classList.add('roll'); }
      secs.forEach(function(s, k){ s.seg.classList.toggle('on', k === c); s.mi.classList.toggle('on', k === c); });
    }
    secs.forEach(function(s, k){ var p = k < c ? 1 : k > c ? 0 : clamp((y + V.h * .42 - tops[k]) / s.h, 0, 1); if(s._p !== p){ s.seg.style.setProperty('--p', p.toFixed(3)); s._p = p; } });
    var gp = clamp(y / Math.max(1, total), 0, 1);
    head.style.left = (gp * 100).toFixed(2) + '%';
    /* la page est un morceau de 64 mesures */
    var beats = gp * 64 * 4, bar = Math.floor(beats / 4) + 1, bt = Math.floor(beats % 4) + 1;
    var s2 = String(Math.min(64, bar)).padStart(3, '0') + '.' + (bar > 64 ? 4 : bt);
    if(s2 !== lastBar){ tpTime.textContent = s2; lastBar = s2; }
  });

  /* Oscilloscope du transport : plat tant que rien ne sonne */
  var scope = $('#tpScope'), scx = scope.getContext('2d');
  onTick(function(){
    var sounding = body.classList.contains('sounding');
    if(!sounding && !scope._dirty && scope._flat) return;
    var s = fitCanvas(scope), W = s.w, H = s.h, wv = A.playing || A.phaseOn() || sounding ? A.wave() : null;
    scx.clearRect(0, 0, W, H);
    scx.strokeStyle = sounding ? SIG : paper(.6); scx.lineWidth = 1.2 * DPR;
    scx.beginPath();
    for(var x = 0; x <= W; x += DPR){
      var v = wv ? wv[Math.floor(x / W * (wv.length - 1))] || 0 : 0, yy = H / 2 - v * H * .9;
      x ? scx.lineTo(x, yy) : scx.moveTo(x, yy);
    }
    scx.stroke();
    scope._flat = !sounding; scope._dirty = false;
  });

  /* Menu */
  var lastFocus = null;
  function openMenu(){
    lastFocus = doc.activeElement;
    menu.hidden = false;
    requestAnimationFrame(function(){ menu.classList.add('open'); });
    menuBtn.setAttribute('aria-expanded', 'true'); menuBtn.textContent = 'Fermer';
    setTimeout(function(){ var a = $('a', mlist); a && a.focus({ preventScroll:true }); }, 200);
  }
  function closeMenu(focusBack){
    if(menu.hidden) return;
    menu.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.textContent = 'Menu';
    setTimeout(function(){ if(!menu.classList.contains('open')) menu.hidden = true; }, RM ? 0 : 760);
    if(focusBack && lastFocus) lastFocus.focus({ preventScroll:true });
  }
  menuBtn.addEventListener('click', function(){ menu.hidden ? openMenu() : closeMenu(true); });
  addEventListener('keydown', function(e){
    if(e.key === 'Escape' && !menu.hidden){ closeMenu(true); }
    if(e.key === 'Tab' && !menu.hidden){
      var f = $$('a, button', menu).concat([menuBtn]), i = f.indexOf(doc.activeElement);
      if(e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1].focus(); }
      else if(!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); }
    }
  });

  /* Rideau : la coupe entre deux parties du morceau */
  var curtain = $('#curtain'), cWord = $('#curtainWord'), cNum = $('#curtainNum'), busy = false;
  function jump(target){
    var y = target.getBoundingClientRect().top + scrollY;
    scrollTo({ top:y, behavior:'instant' in doc.documentElement.style ? 'instant' : 'auto' });
    window.scrollTo(0, y);
    if(!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll:true });
  }
  function go(hash){
    var target = $(hash);
    if(!target) return;
    var wasOpen = !menu.hidden;
    try{ history.pushState(null, '', hash); }catch(e){}
    if(RM || busy){ closeMenu(); jump(target); return; }
    busy = true;
    var sec = target.closest('[data-num]') || target, s = null;
    secs.forEach(function(x){ if(x.el === sec) s = x; });
    cNum.textContent = s ? s.num : '—';
    cWord.textContent = s ? s.label : (target.id === 'contact' ? 'Contact' : '');
    curtain.classList.remove('out'); curtain.classList.add('on');
    void curtain.offsetWidth;
    curtain.classList.add('in');
    setTimeout(function(){
      if(wasOpen){ menu.classList.remove('open'); menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.textContent = 'Menu'; }
      jump(target);
      setTimeout(function(){
        curtain.classList.remove('in'); curtain.classList.add('out');
        setTimeout(function(){ curtain.classList.remove('on', 'out'); busy = false; }, 650);
      }, 180);
    }, 560);
  }
  doc.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if(!a || a.classList.contains('skip') || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var h = a.getAttribute('href');
    if(h === '#' || !$(h)) return;
    e.preventDefault();
    if(a.id === 'rewind'){ rewind(); return; }
    go(h);
  });

  /* Rembobiner : la bande repart au début, à reculons */
  function rewind(){
    if(RM){ scrollTo(0, 0); return; }
    var y0 = scrollY, t0 = performance.now(), dur = clamp(y0 / 6, 900, 2200);
    (function f(){
      var k = clamp((performance.now() - t0) / dur, 0, 1);
      scrollTo(0, y0 * (1 - easeIO(k)));
      if(k < 1) requestAnimationFrame(f);
      else { try{ history.pushState(null, '', '#intro'); }catch(e){} }
    })();
  }

  return { go:go, measure:measure, ready:function(){ tp.classList.add('ready'); } };
})();

/* ══════════════════════════════════════════════════════════════════════════
   DÉMARRAGE
   ══════════════════════════════════════════════════════════════════════════ */
function boot(){
  Wordmark.fit();
  Room.fitTitle();
  countIn(function(){
    Wordmark.live();
    Nav.ready();
    revealAll();
    var idle = window.requestIdleCallback || function(f){ setTimeout(f, 400); };
    idle(function(){ Room.startPrep(); }, { timeout:1500 });
    if(Room.wanted && !location.hash) setTimeout(function(){ Nav.go('#productions'); }, 300);
  });
  Nav.measure();
}
(doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(boot);
onResize(function(){ Wordmark.fit(); Nav.measure(); });

})();
