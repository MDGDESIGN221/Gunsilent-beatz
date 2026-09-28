/* ══════════════════════════════════════════════════════════════════════════
   GUNSILENT — moteur audio
   ──────────────────────────────────────────────────────────────────────────
   Deux sources possibles pour une instrumentale :
   1. `audio` : un vrai fichier (mp3, wav…). Il est décodé, puis découpé en cinq
      bandes de fréquence pour dessiner sa partition.
   2. `pistes` : une maquette décrite piste par piste, synthétisée hors ligne.
      Chaque piste est rendue sur son propre canal : on peut donc la couper en
      direct, et la partition affiche chaque instrument séparément.
   Dans les deux cas, la forme d'onde et la partition viennent du signal réel.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var AC = window.AudioContext || window.webkitAudioContext;
var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
var SR = 44100;
var TAIL = 2.2;          // queue rendue après la boucle, repliée sur son début
var SUPPORTED = !!(AC && OAC);

/* ── Outils ─────────────────────────────────────────────────────────────── */
function hash(str){ var h = 2166136261; for(var i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed){ var s = (seed >>> 0) || 1; return function(){ s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 1000003) / 1000003; }; }
var NOTE = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
function midi(n){ var m = /^([A-G])([#b]?)(-?\d)$/.exec(n); if(!m) return null; return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); }
function mtof(m){ return 440 * Math.pow(2, (m - 69) / 12); }

function makeOffline(ch, len, sr){
  try{ return new OAC({ numberOfChannels:ch, length:len, sampleRate:sr }); }
  catch(e){ return new OAC(ch, len, sr); }
}

/* Bruit blanc et réponses impulsionnelles, mis en cache par contexte */
var ctxCache = new WeakMap();
function cacheFor(ctx){ var c = ctxCache.get(ctx); if(!c){ c = { ks:{}, ir:{} }; ctxCache.set(ctx, c); } return c; }
function noise(ctx){
  var c = cacheFor(ctx);
  if(!c.noise){
    var len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0), r = rng(7);
    for(var i = 0; i < len; i++) d[i] = r() * 2 - 1;
    c.noise = b;
  }
  return c.noise;
}
function impulse(ctx, sec){
  var c = cacheFor(ctx), k = sec.toFixed(2);
  if(!c.ir[k]){
    var sr = ctx.sampleRate, len = Math.floor(sec * sr), pre = Math.floor(.012 * sr);
    /* Mono : les pistes sont mono, une réponse stéréo doublerait le calcul pour rien */
    var b = ctx.createBuffer(1, len, sr), r = rng(99);
    for(var ch = 0; ch < 1; ch++){
      var d = b.getChannelData(ch), y = 0;
      for(var i = 0; i < len; i++){
        var x = i < pre ? 0 : (r() * 2 - 1) * Math.pow(1 - i / len, 3.4);
        y += .42 * (x - y);            // passe-bas doux : une pièce, pas un hall métallique
        d[i] = y;
      }
    }
    c.ir[k] = b;
  }
  return c.ir[k];
}
var curves = {};
function driveCurve(k){
  var key = k.toFixed(2);
  if(!curves[key]){
    var n = 2048, c = new Float32Array(n), t = Math.tanh(k);
    for(var i = 0; i < n; i++){ var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / t; }
    curves[key] = c;
  }
  return curves[key];
}

/* Corde pincée (Karplus-Strong), calculée en JS : le timbre proche de la kora */
function ksBuffer(ctx, m, bright){
  var c = cacheFor(ctx), key = m + ':' + bright;
  if(c.ks[key]) return c.ks[key];
  var sr = ctx.sampleRate, f = mtof(m), N = Math.max(2, Math.round(sr / f));
  var dur = Math.min(2.6, 1.2 + 220 / f), len = Math.floor(dur * sr);
  var b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0), line = new Float32Array(N), r = rng(m * 31 + 3);
  var prev = 0;
  for(var i = 0; i < N; i++){ prev += bright * ((r() * 2 - 1) - prev); line[i] = prev; }
  var decay = .9965 - Math.min(.006, f / 180000), idx = 0;
  for(var j = 0; j < len; j++){
    var cur = line[idx], nx = line[(idx + 1) % N];
    line[idx] = decay * .5 * (cur + nx);
    d[j] = cur;
    idx = (idx + 1) % N;
  }
  var fade = Math.floor(.03 * sr);
  for(var k = 0; k < fade; k++) d[len - 1 - k] *= k / fade;
  b._rate = f / (sr / N);   // correction de justesse du délai entier
  c.ks[key] = b;
  return b;
}

/* ── Instruments ────────────────────────────────────────────────────────────
   Chaque fonction reçoit (ctx, sortie, évènement, paramètres, aléa).
   Un évènement porte : t (secondes), vel, sd (durée d'un pas), et selon le cas
   f / fs (fréquences), dur (durée), glide (fréquence de départ), n (roulement). */
function osc(ctx, type, f){ var o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
function gain(ctx, v){ var g = ctx.createGain(); g.gain.value = v; return g; }
function filt(ctx, type, f, q){ var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if(q != null) b.Q.value = q; return b; }
function noiseSrc(ctx, r){ var s = ctx.createBufferSource(); s.buffer = noise(ctx); s._off = r() * 1.6; return s; }
function play(src, t, dur){ src.start(t, src._off || 0); src.stop(t + dur); }

var Inst = {
  kick: function(ctx, out, e, p, r){
    var t = e.t, v = e.vel, dec = p.decay || .42;
    var o = osc(ctx, 'sine', p.f0 || 150), g = gain(ctx, 0);
    o.frequency.setValueAtTime(p.f0 || 150, t);
    o.frequency.exponentialRampToValueAtTime(p.f1 || 48, t + (p.sweep || .06));
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + .002);
    g.gain.exponentialRampToValueAtTime(v * .55, t + dec * .3);
    g.gain.exponentialRampToValueAtTime(.0001, t + dec);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + .02);
    if(p.click){
      var n = noiseSrc(ctx, r), hp = filt(ctx, 'highpass', 2400), ng = gain(ctx, 0);
      ng.gain.setValueAtTime(v * p.click, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .014);
      n.connect(hp); hp.connect(ng); ng.connect(out); play(n, t, .02);
    }
  },

  snare: function(ctx, out, e, p, r){
    var t = e.t, v = e.vel, dec = p.decay || .2;
    var n = noiseSrc(ctx, r), bp = filt(ctx, 'bandpass', p.tone || 1900, .7), hp = filt(ctx, 'highpass', 700), g = gain(ctx, 0);
    g.gain.setValueAtTime(v * .9, t); g.gain.exponentialRampToValueAtTime(.0001, t + dec);
    n.connect(bp); bp.connect(hp); hp.connect(g); g.connect(out); play(n, t, dec + .02);
    var o = osc(ctx, 'triangle', p.body || 190), og = gain(ctx, 0);
    o.frequency.setValueAtTime(p.body || 190, t); o.frequency.exponentialRampToValueAtTime((p.body || 190) * .78, t + .06);
    og.gain.setValueAtTime(v * .6, t); og.gain.exponentialRampToValueAtTime(.0001, t + .11);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + .13);
    if(p.ring){ // anneau métallique : une caisse claire froide
      var m = osc(ctx, 'square', p.ring), mg = gain(ctx, 0), mb = filt(ctx, 'bandpass', p.ring * 2, 6);
      mg.gain.setValueAtTime(v * .18, t); mg.gain.exponentialRampToValueAtTime(.0001, t + .16);
      m.connect(mb); mb.connect(mg); mg.connect(out); m.start(t); m.stop(t + .18);
    }
  },

  clap: function(ctx, out, e, p, r){
    var t = e.t, v = e.vel, dec = p.decay || .22;
    var n = noiseSrc(ctx, r), bp = filt(ctx, 'bandpass', p.tone || 1150, p.snap ? 1.6 : 1.1), hp = filt(ctx, 'highpass', p.snap ? 1400 : 500), g = gain(ctx, 0);
    g.gain.setValueAtTime(0, t);
    var bursts = p.snap ? 1 : 3;
    for(var k = 0; k < bursts; k++){
      var tt = t + k * .011;
      g.gain.setValueAtTime(v, tt);
      g.gain.exponentialRampToValueAtTime(v * .2, tt + .009);
    }
    var tl = t + bursts * .011;
    g.gain.setValueAtTime(v * .85, tl);
    g.gain.exponentialRampToValueAtTime(.0001, tl + dec);
    n.connect(bp); bp.connect(hp); hp.connect(g); g.connect(out); play(n, t, dec + .06);
  },

  hat: function(ctx, out, e, p, r){
    var hits = e.n || 1, dec = p.decay || .045;
    for(var k = 0; k < hits; k++){
      var t = e.t + k * (e.sd / hits), v = e.vel * (hits > 1 ? .55 + .45 * (k + 1) / hits : 1);
      var g = gain(ctx, 0), hp = filt(ctx, 'highpass', p.hp || 7200), bp = filt(ctx, 'bandpass', p.center || 10500, .6);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + dec);
      if(p.metal){
        var mix = gain(ctx, .16), ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
        for(var i = 0; i < ratios.length; i++){ var o = osc(ctx, 'square', 40 * ratios[i] * (p.metal || 1)); o.connect(mix); o.start(t); o.stop(t + dec + .01); }
        mix.connect(bp);
      } else {
        var n = noiseSrc(ctx, r); n.connect(bp); play(n, t, dec + .01);
      }
      bp.connect(hp); hp.connect(g); g.connect(out);
    }
  },

  shaker: function(ctx, out, e, p, r){
    var t = e.t, v = e.vel, n = noiseSrc(ctx, r), bp = filt(ctx, 'bandpass', p.tone || 5600, 1.4), g = gain(ctx, 0);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .014); g.gain.exponentialRampToValueAtTime(.0001, t + (p.decay || .075));
    n.connect(bp); bp.connect(g); g.connect(out); play(n, t, .1);
  },

  rim: function(ctx, out, e, p, r){
    var t = e.t, v = e.vel;
    [p.f || 1650, (p.f || 1650) * .5].forEach(function(f, i){
      var o = osc(ctx, 'triangle', f), g = gain(ctx, 0);
      g.gain.setValueAtTime(v * (i ? .5 : .7), t); g.gain.exponentialRampToValueAtTime(.0001, t + (p.decay || .035));
      o.connect(g); g.connect(out); o.start(t); o.stop(t + .06);
    });
    var n = noiseSrc(ctx, r), bp = filt(ctx, 'bandpass', 3200, 1.5), ng = gain(ctx, 0);
    ng.gain.setValueAtTime(v * .5, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .012);
    n.connect(bp); bp.connect(ng); ng.connect(out); play(n, t, .02);
  },

  /* Membrane accordée : sabar, conga, tom */
  tom: function(ctx, out, e, p, r){
    var t = e.t, v = e.vel, f = e.f || 200, dec = p.decay || .28;
    var o = osc(ctx, 'sine', f), g = gain(ctx, 0);
    o.frequency.setValueAtTime(f * 1.55, t); o.frequency.exponentialRampToValueAtTime(f, t + .035);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + dec);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + .02);
    var n = noiseSrc(ctx, r), bp = filt(ctx, 'bandpass', p.slap || 2400, 1.2), ng = gain(ctx, 0);
    ng.gain.setValueAtTime(v * .45, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .03);
    n.connect(bp); bp.connect(ng); ng.connect(out); play(n, t, .04);
  },

  /* Log drum : la basse percussive boisée de l'amapiano */
  log: function(ctx, out, e, p, r){
    var t = e.t, v = e.vel, f = e.f, dec = p.decay || .5;
    var o = osc(ctx, 'sine', f), g = gain(ctx, 0);
    o.frequency.setValueAtTime(f * 1.9, t); o.frequency.exponentialRampToValueAtTime(f, t + .025);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .004);
    g.gain.exponentialRampToValueAtTime(v * .45, t + .14); g.gain.exponentialRampToValueAtTime(.0001, t + dec);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + .02);
    var o2 = osc(ctx, 'triangle', f * 2.01), g2 = gain(ctx, 0), lp = filt(ctx, 'lowpass', 1600);
    g2.gain.setValueAtTime(v * .3, t); g2.gain.exponentialRampToValueAtTime(.0001, t + .16);
    o2.connect(lp); lp.connect(g2); g2.connect(out); o2.start(t); o2.stop(t + .2);
  },

  /* 808 monophonique : chaque note coupe la précédente, les glissés partent d'elle */
  b808: function(ctx, out, e, p, r){
    var t = e.t, v = e.vel, f = e.f, end = t + e.dur;
    var o = osc(ctx, 'sine', f), g = gain(ctx, 0);
    if(e.glide){
      o.frequency.setValueAtTime(e.glide, t);
      o.frequency.exponentialRampToValueAtTime(f, t + (p.glide || .085));
      g.gain.setValueAtTime(v * .85, t);
    } else {
      o.frequency.setValueAtTime(f * 2.1, t);
      o.frequency.exponentialRampToValueAtTime(f, t + .032);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + .004);
    }
    g.gain.setTargetAtTime(0, t + .15, (p.decay || 1.2) / 3);
    g.gain.setTargetAtTime(0, end, .014);
    o.connect(g); g.connect(out); o.start(t); o.stop(end + .12);
  },

  sub: function(ctx, out, e, p){
    var t = e.t, v = e.vel, end = t + e.dur;
    var o = osc(ctx, 'sine', e.f), g = gain(ctx, 0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .012);
    g.gain.setTargetAtTime(v * (p.sus || .75), t + .05, .2);
    g.gain.setTargetAtTime(0, end, .03);
    o.connect(g); g.connect(out); o.start(t); o.stop(end + .2);
  },

  /* Cloche FM, rapport inharmonique */
  bell: function(ctx, out, e, p){
    var fs = e.fs, v = e.vel / Math.sqrt(fs.length), dec = p.decay || 1.7;
    fs.forEach(function(f){
      var t = e.t, c = osc(ctx, 'sine', f), m = osc(ctx, 'sine', f * (p.ratio || 3.5)), mg = gain(ctx, 0), g = gain(ctx, 0);
      mg.gain.setValueAtTime(f * (p.index || 5), t); mg.gain.exponentialRampToValueAtTime(f * .25, t + .7);
      m.connect(mg); mg.connect(c.frequency);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v * .5, t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + dec);
      c.connect(g); g.connect(out);
      c.start(t); m.start(t); c.stop(t + dec + .02); m.stop(t + dec + .02);
    });
  },

  /* Piano électrique FM : la touche, puis la tenue */
  keys: function(ctx, out, e, p){
    var fs = e.fs, v = e.vel / Math.sqrt(fs.length), end = e.t + e.dur;
    fs.forEach(function(f){
      var t = e.t, c = osc(ctx, 'sine', f), m = osc(ctx, 'sine', f), mg = gain(ctx, 0), g = gain(ctx, 0);
      mg.gain.setValueAtTime(f * (p.index || 2.2), t); mg.gain.setTargetAtTime(f * .35, t + .01, .18);
      m.connect(mg); mg.connect(c.frequency);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .38, t + .004);
      g.gain.setTargetAtTime(v * .16, t + .02, p.hold || .6);
      g.gain.setTargetAtTime(0, end, .12);
      c.connect(g); g.connect(out);
      var ti = osc(ctx, 'sine', f * 4.02), tg = gain(ctx, 0);
      tg.gain.setValueAtTime(v * .07, t); tg.gain.exponentialRampToValueAtTime(.0001, t + .09);
      ti.connect(tg); tg.connect(out);
      c.start(t); m.start(t); ti.start(t);
      c.stop(end + .8); m.stop(end + .8); ti.stop(t + .12);
    });
  },

  pad: function(ctx, out, e, p){
    var fs = e.fs, v = e.vel / Math.sqrt(fs.length), end = e.t + e.dur, a = p.attack || .35, rl = p.release || .9;
    fs.forEach(function(f){
      [-1, 1].forEach(function(s){
        var o = osc(ctx, p.wave || 'sawtooth', f), g = gain(ctx, 0);
        o.detune.value = s * (p.detune || 8);
        g.gain.setValueAtTime(0, e.t); g.gain.linearRampToValueAtTime(v * .11, e.t + a);
        g.gain.setTargetAtTime(0, end, rl / 3);
        o.connect(g); g.connect(out); o.start(e.t); o.stop(end + rl + .1);
      });
    });
  },

  /* Chœur : une dent de scie passée dans trois formants de voyelle « o » */
  choir: function(ctx, out, e, p){
    var fs = e.fs, v = e.vel / Math.sqrt(fs.length), end = e.t + e.dur, forms = p.formants || [[450, 7], [800, 9], [2830, 12]];
    fs.forEach(function(f, i){
      var o = osc(ctx, 'sawtooth', f), sum = gain(ctx, 0), lfo = osc(ctx, 'sine', 4.6 + i * .3), lg = gain(ctx, 5);
      lfo.connect(lg); lg.connect(o.detune);
      forms.forEach(function(fm, k){ var b = filt(ctx, 'bandpass', fm[0], fm[1]), bg = gain(ctx, k ? .5 : 1); o.connect(b); b.connect(bg); bg.connect(sum); });
      sum.gain.setValueAtTime(0, e.t); sum.gain.linearRampToValueAtTime(v * .55, e.t + (p.attack || .7));
      sum.gain.setTargetAtTime(0, end, (p.release || 1.2) / 3);
      sum.connect(out);
      o.start(e.t); lfo.start(e.t); o.stop(end + 1.6); lfo.stop(end + 1.6);
    });
  },

  pluck: function(ctx, out, e, p){
    var v = e.vel / Math.sqrt(e.ms.length);
    e.ms.forEach(function(m){
      var b = ksBuffer(ctx, m, p.bright || .55), s = ctx.createBufferSource(), g = gain(ctx, v * .9);
      s.buffer = b; s.playbackRate.value = b._rate || 1;
      s.connect(g); g.connect(out); s.start(e.t); s.stop(e.t + b.duration);
    });
  },

  /* Stab FM métallique, rapport √2 : froid, sans fondamentale claire */
  stab: function(ctx, out, e, p){
    var fs = e.fs, v = e.vel / Math.sqrt(fs.length), dec = p.decay || .28;
    fs.forEach(function(f){
      var t = e.t, c = osc(ctx, 'sine', f), m = osc(ctx, 'sine', f * 1.414), mg = gain(ctx, 0), g = gain(ctx, 0);
      mg.gain.setValueAtTime(f * (p.index || 7), t); mg.gain.exponentialRampToValueAtTime(f * .4, t + dec * .6);
      m.connect(mg); mg.connect(c.frequency);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v * .5, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + dec);
      c.connect(g); g.connect(out); c.start(t); m.start(t); c.stop(t + dec + .02); m.stop(t + dec + .02);
    });
  },

  tick: function(ctx, out, e){
    var t = e.t, o = osc(ctx, 'sine', 3400), g = gain(ctx, 0);
    g.gain.setValueAtTime(e.vel * .5, t); g.gain.exponentialRampToValueAtTime(.0001, t + .014);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + .02);
  },

  /* Souffle : du bruit filtré qui respire, pour l'air entre les notes */
  air: function(ctx, out, e, p, r){
    var t = e.t, end = t + e.dur, n = ctx.createBufferSource(), bp = filt(ctx, 'bandpass', p.tone || 1400, .9), g = gain(ctx, 0);
    n.buffer = noise(ctx); n.loop = true;
    bp.frequency.setValueAtTime(p.tone || 1400, t); bp.frequency.linearRampToValueAtTime((p.tone || 1400) * 2.2, end);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(e.vel * .05, t + e.dur * .5); g.gain.linearRampToValueAtTime(0, end);
    n.connect(bp); bp.connect(g); g.connect(out); n.start(t, r() * 1.5); n.stop(end + .05);
  },

  riser: function(ctx, out, e, p, r){
    var t = e.t, end = t + e.dur, n = ctx.createBufferSource(), bp = filt(ctx, 'bandpass', 300, 3.5), g = gain(ctx, 0);
    n.buffer = noise(ctx); n.loop = true;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(p.top || 7000, end);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(e.vel * .35, end - .02); g.gain.linearRampToValueAtTime(0, end);
    n.connect(bp); bp.connect(g); g.connect(out); n.start(t, r() * 1.5); n.stop(end + .02);
  },

  /* Vinyle : un fond de surface et des craquements semés au hasard */
  vinyl: function(ctx, out, e, p, r){
    var t = e.t, end = t + e.dur, n = ctx.createBufferSource(), lp = filt(ctx, 'lowpass', 3200), hp = filt(ctx, 'highpass', 600), g = gain(ctx, e.vel * .035);
    n.buffer = noise(ctx); n.loop = true;
    n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out); n.start(t, r() * 1.5); n.stop(end);
    var count = Math.floor(e.dur * (p.density || 9));
    for(var k = 0; k < count; k++){
      var tt = t + r() * e.dur, c = noiseSrc(ctx, r), ch = filt(ctx, 'highpass', 1500), cg = gain(ctx, 0), a = e.vel * (.1 + r() * .35);
      cg.gain.setValueAtTime(a, tt); cg.gain.exponentialRampToValueAtTime(.0001, tt + .002 + r() * .004);
      c.connect(ch); ch.connect(cg); cg.connect(out); play(c, tt, .008);
    }
  }
};

/* Rôle de chaque instrument : il pilote la typographie et les visuels */
var ROLE = { kick:'kick', snare:'snare', clap:'snare', rim:'snare', hat:'hat', shaker:'hat', tick:'hat', tom:'perc',
  log:'bass', b808:'bass', sub:'bass', bell:'keys', keys:'keys', pad:'keys', choir:'keys', pluck:'keys', stab:'keys',
  air:'fx', riser:'fx', vinyl:'fx' };
var MONO = { b808:1, sub:1 };

/* ── Lecture des motifs ─────────────────────────────────────────────────────
   Batterie : une chaîne de pas par mesure.
     x plein · o moyen · y fantôme · . silence · 2 3 4 roulement dans le pas
   Notes : des jetons séparés par des espaces, un par pas.
     F1 note · F3+Ab3+C4 accord · - tenue · . silence · ~C2 glissé · C5:0.6 vélocité */
function parseDrum(str){
  var s = str.replace(/\s+/g, ''), out = [];
  for(var i = 0; i < s.length; i++){
    var c = s[i];
    if(c === '.') continue;
    out.push({ step:i, vel:c === 'x' ? 1 : c === 'o' ? .62 : c === 'y' ? .32 : .85, n:(c >= '2' && c <= '4') ? +c : 1 });
  }
  return out;
}
function parseNotes(str){
  var tok = str.trim().split(/\s+/), out = [], cur = null;
  for(var i = 0; i < tok.length; i++){
    var t = tok[i];
    if(t === '-'){ if(cur) cur.len++; continue; }
    if(t === '.'){ cur = null; continue; }
    var vel = 1, glide = false, parts = t.split(':');
    if(parts[1]) vel = +parts[1];
    t = parts[0];
    if(t[0] === '~'){ glide = true; t = t.slice(1); }
    var ms = t === '*' ? [60] : t.split('+').map(midi).filter(function(m){ return m != null; });
    cur = { step:i, len:1, ms:ms, vel:vel, glide:glide };
    out.push(cur);
  }
  return out;
}

function timing(beat){
  var grid = beat.grille || 16, bars = beat.mesures || 8;
  var sd = 60 / beat.bpm / (grid / 4);
  return { grid:grid, bars:bars, sd:sd, steps:grid * bars, dur:grid * bars * sd };
}

/* Tous les évènements d'une piste sur toute la boucle */
function trackEvents(beat, tr, tm, r){
  var ev = [], isTonal = !!tr.notes, src = tr.notes || tr.seq || [];
  for(var b = 0; b < tm.bars; b++){
    if(tr.off && tr.off.indexOf(b) !== -1) continue;
    var pat = (tr.alt && tr.alt[b] != null) ? tr.alt[b] : src[b % src.length];
    if(!pat) continue;
    var list = isTonal ? parseNotes(pat) : parseDrum(pat);
    list.forEach(function(x){
      var abs = b * tm.grid + x.step;
      var t = abs * tm.sd;
      if(beat.swing && x.step % 2 === 1) t += beat.swing * tm.sd;
      if(beat.human){ t += (r() - .5) * beat.human * .012; }
      var vel = x.vel * (beat.human ? 1 - r() * beat.human * .25 : 1);
      var e = { t:Math.max(0, t), vel:vel, sd:tm.sd, n:x.n || 1, abs:abs };
      if(isTonal){
        e.ms = x.ms; e.fs = x.ms.map(mtof); e.f = e.fs[0]; e.dur = x.len * tm.sd; e.glideFlag = x.glide;
      }
      ev.push(e);
    });
  }
  ev.sort(function(a, b){ return a.t - b.t; });
  if(MONO[tr.inst]){
    for(var i = 0; i < ev.length; i++){
      if(i < ev.length - 1) ev[i].dur = Math.min(ev[i].dur, ev[i + 1].t - ev[i].t);
      if(ev[i].glideFlag && i > 0) ev[i].glide = ev[i - 1].f;
    }
  }
  return ev;
}

/* Chaîne de piste : filtres, saturation, réverbération, écho */
function makeBus(ctx, b, tm){
  b = b || {};
  var input = gain(ctx, 1), node = input;
  if(b.hp){ var hp = filt(ctx, 'highpass', b.hp, .6); node.connect(hp); node = hp; }
  if(b.lp){ var lp = filt(ctx, 'lowpass', b.lp, .5); node.connect(lp); node = lp; }
  if(b.drive){
    var pre = gain(ctx, b.drive), ws = ctx.createWaveShaper(), post = gain(ctx, 1 / Math.sqrt(b.drive));
    ws.curve = driveCurve(b.drive); ws.oversample = '2x';
    node.connect(pre); pre.connect(ws); ws.connect(post); node = post;
  }
  var out = gain(ctx, b.gain == null ? 1 : b.gain);
  node.connect(out);
  if(b.rev){
    var s = gain(ctx, b.rev), cv = ctx.createConvolver();
    cv.normalize = true; cv.buffer = impulse(ctx, b.revLen || 1.6);
    node.connect(s); s.connect(cv); cv.connect(out);
  }
  if(b.dly){
    var d = ctx.createDelay(2), fb = gain(ctx, b.fb || .34), dl = filt(ctx, 'lowpass', 2600), s2 = gain(ctx, b.dly);
    d.delayTime.value = (b.dlySteps || 3) * tm.sd;
    node.connect(s2); s2.connect(d); d.connect(dl); dl.connect(fb); fb.connect(d); dl.connect(out);
  }
  return { in:input, out:out, level:b.gain == null ? 1 : b.gain };
}

/* ── Rendu hors ligne d'une maquette ─────────────────────────────────────── */
function renderSynth(beat){
  var tm = timing(beat), tracks = beat.pistes, N = tracks.length;
  var loopLen = Math.round(tm.dur * SR), len = loopLen + Math.round(TAIL * SR);
  var ctx = makeOffline(N, len, SR);
  try{ ctx.destination.channelCountMode = 'explicit'; ctx.destination.channelInterpretation = 'discrete'; }catch(e){}
  var merger = ctx.createChannelMerger(N);
  merger.connect(ctx.destination);
  var r = rng(hash(beat.id));
  var kicks = [];
  var all = tracks.map(function(tr){ return trackEvents(beat, tr, tm, r); });
  tracks.forEach(function(tr, i){ if(tr.inst === 'kick') all[i].forEach(function(e){ kicks.push(e.t); }); });
  kicks.sort(function(a, b){ return a - b; });

  var buses = tracks.map(function(tr, i){
    var bus = makeBus(ctx, tr.bus, tm);
    bus.out.connect(merger, 0, i);
    if(tr.bus && tr.bus.duck){
      var g = bus.out.gain, lv = bus.level, depth = tr.bus.duck;
      kicks.forEach(function(kt){
        g.setTargetAtTime(lv * (1 - depth), kt, .004);
        g.setTargetAtTime(lv, kt + .03, .07);
      });
    }
    return bus;
  });

  /* Planification juste à temps : chaque note crée ses propres nœuds, et un
     nœud présent dans le graphe coûte du calcul même avant de sonner. Le rendu
     se suspend donc toutes les demi-secondes pour ne créer que les notes de la
     fenêtre suivante : le graphe reste petit, le rendu est plusieurs fois plus rapide. */
  var jobs = [];
  all.forEach(function(list, i){ list.forEach(function(e){ jobs.push({ t:e.t, i:i, e:e }); }); });
  jobs.sort(function(a, b){ return a.t - b.t; });
  var ji = 0;
  function scheduleUntil(tEnd){
    while(ji < jobs.length && jobs[ji].t < tEnd){
      var j = jobs[ji++], tr = tracks[j.i], fn = Inst[tr.inst];
      if(fn) fn(ctx, buses[j.i].in, j.e, tr.p || {}, r);
    }
  }
  var W = .5;
  if(typeof ctx.suspend === 'function'){
    scheduleUntil(W + .05);
    for(var ws = W; ws < tm.dur; ws += W){
      (function(at){
        ctx.suspend(at).then(function(){ scheduleUntil(at + W + .05); ctx.resume(); });
      })(ws);
    }
  } else {
    scheduleUntil(Infinity);
  }

  return ctx.startRendering().then(function(buf){
    /* La queue qui dépasse la boucle est repliée sur son début :
       la boucle se raccorde sans clic, réverbérations comprises. */
    var out = ctx.createBuffer(N, loopLen, SR), tail = len - loopLen;
    for(var c = 0; c < N; c++){
      var d = buf.getChannelData(c), o = out.getChannelData(c);
      o.set(d.subarray(0, loopLen));
      for(var j = 0; j < tail && j < loopLen; j++) o[j] += d[loopLen + j];
    }
    return {
      buffer:out, stems:true,
      names:tracks.map(function(t){ return t.nom; }),
      roles:tracks.map(function(t){ return t.role || ROLE[t.inst] || 'fx'; }),
      pans:tracks.map(function(t){ return (t.bus && t.bus.pan) || 0; }),
      segs:tm.steps, grid:tm.grid, bars:tm.bars
    };
  });
}

/* ── Fichier réel : décodage puis découpage en bandes ────────────────────── */
function decodeFile(url){
  return fetch(url, { mode:'cors' }).then(function(res){
    if(!res.ok) throw new Error('Fichier introuvable : ' + url);
    return res.arrayBuffer();
  }).then(function(data){
    var dc = makeOffline(1, 1, SR);
    return new Promise(function(ok, ko){
      var p = dc.decodeAudioData(data, ok, ko);
      if(p && p.then) p.then(ok, ko);
    });
  });
}
var BANDS = [
  { nom:'Sub', role:'kick', f:[['lowpass', 90, .7]] },
  { nom:'Grave', role:'bass', f:[['highpass', 90, .7], ['lowpass', 260, .7]] },
  { nom:'Médium', role:'snare', f:[['highpass', 260, .7], ['lowpass', 2200, .7]] },
  { nom:'Aigu', role:'keys', f:[['highpass', 2200, .7], ['lowpass', 7500, .7]] },
  { nom:'Air', role:'hat', f:[['highpass', 7500, .7]] }
];
function bandSplit(buffer){
  var sr = 22050, len = Math.ceil(buffer.duration * sr), ctx = makeOffline(BANDS.length, len, sr);
  try{ ctx.destination.channelCountMode = 'explicit'; ctx.destination.channelInterpretation = 'discrete'; }catch(e){}
  var src = ctx.createBufferSource(), m = ctx.createChannelMerger(BANDS.length);
  src.buffer = buffer; m.connect(ctx.destination);
  BANDS.forEach(function(b, i){
    var node = src;
    b.f.forEach(function(f){ var x = filt(ctx, f[0], f[1], f[2]); node.connect(x); node = x; });
    node.connect(m, 0, i);
  });
  src.start(0);
  return ctx.startRendering();
}
function renderFile(beat){
  return decodeFile(beat.audio).then(function(buffer){
    return bandSplit(buffer).then(function(bands){
      var an = analyse(bands, 128, buffer);
      return {
        buffer:buffer, stems:false, bands:bands,
        names:BANDS.map(function(b){ return b.nom; }),
        roles:BANDS.map(function(b){ return b.role; }),
        pans:BANDS.map(function(){ return 0; }),
        segs:128, grid:16, bars:Math.max(1, Math.round(buffer.duration / (240 / beat.bpm))),
        _an:an
      };
    });
  });
}

/* ── Analyse : partition (énergie par pas et par piste) + forme d'onde ───── */
function analyse(buf, segs, mixSource){
  var N = buf.numberOfChannels, L = buf.length, per = L / segs, matrix = [];
  for(var c = 0; c < N; c++){
    var d = buf.getChannelData(c), row = new Float32Array(segs), max = 0;
    for(var s = 0; s < segs; s++){
      var a = Math.floor(s * per), z = Math.floor((s + 1) * per), acc = 0, n = 0;
      for(var i = a; i < z; i += 3){ acc += d[i] * d[i]; n++; }
      row[s] = n ? Math.sqrt(acc / n) : 0;
      if(row[s] > max) max = row[s];
    }
    if(max > 0) for(var k = 0; k < segs; k++) row[k] /= max;
    matrix.push(row);
  }
  /* Forme d'onde du mélange : minimum et maximum par colonne */
  var src = mixSource || buf, SN = src.numberOfChannels, SL = src.length, B = 1400, peaks = new Float32Array(B * 2), gmax = 0;
  var chans = []; for(var q = 0; q < SN; q++) chans.push(src.getChannelData(q));
  var bw = SL / B;
  for(var bI = 0; bI < B; bI++){
    var lo = 0, hi = 0, a2 = Math.floor(bI * bw), z2 = Math.floor((bI + 1) * bw);
    for(var j = a2; j < z2; j += 2){
      var sum = 0; for(var q2 = 0; q2 < SN; q2++) sum += chans[q2][j];
      if(!mixSource) sum = sum; else sum /= SN;
      if(sum < lo) lo = sum; if(sum > hi) hi = sum;
    }
    peaks[bI * 2] = lo; peaks[bI * 2 + 1] = hi;
    var m = Math.max(-lo, hi); if(m > gmax) gmax = m;
  }
  if(gmax > 0) for(var p = 0; p < peaks.length; p++) peaks[p] /= gmax;
  return { matrix:matrix, peaks:peaks, norm:gmax > 0 ? Math.min(2.5, .92 / gmax) : 1 };
}

/* ══════════════════════════════════════════════════════════════════════════
   LECTURE EN TEMPS RÉEL
   ══════════════════════════════════════════════════════════════════════════ */
var E = {
  supported:SUPPORTED, ctx:null, playing:false, cur:null, pausedAt:0,
  store:{}, lru:[], listeners:{}
};

E.on = function(name, fn){ (E.listeners[name] = E.listeners[name] || []).push(fn); };
function emit(name, a){ (E.listeners[name] || []).forEach(function(fn){ fn(a); }); }

E.ensure = function(){
  if(!SUPPORTED) return null;
  if(!E.ctx){
    var ctx = E.ctx = new AC({ latencyHint:'interactive' });
    E.bus = gain(ctx, 1);
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3.2; comp.attack.value = .006; comp.release.value = .18;
    var make = gain(ctx, 1.35);
    var lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .09;
    E.master = gain(ctx, .92);
    E.analyser = ctx.createAnalyser(); E.analyser.fftSize = 2048; E.analyser.smoothingTimeConstant = .72;
    E.bus.connect(comp); comp.connect(make); make.connect(lim); lim.connect(E.master); E.master.connect(E.analyser); E.analyser.connect(ctx.destination);
    E.fx = gain(ctx, 1); E.fx.connect(E.master);
    E.td = new Float32Array(E.analyser.fftSize);
    E.fd = new Uint8Array(E.analyser.frequencyBinCount);
  }
  if(E.ctx.state === 'suspended') E.ctx.resume();
  return E.ctx;
};

/* Préparation (rendu + analyse), avec un cache de trois tampons audio au plus :
   l'analyse de chaque instrumentale est gardée, le son se recalcule au besoin. */
E.prepare = function(beat){
  var st = E.store[beat.id] || (E.store[beat.id] = {});
  if(st.buffer) { touch(beat.id); return Promise.resolve(st); }
  if(st.pending) return st.pending;
  if(!SUPPORTED) return Promise.reject(new Error('Web Audio indisponible'));
  var job = beat.audio ? renderFile(beat) : renderSynth(beat);
  st.pending = job.then(function(res){
    st.buffer = res.buffer; st.names = res.names; st.roles = res.roles; st.pans = res.pans;
    st.stems = res.stems; st.segs = res.segs; st.grid = res.grid; st.bars = res.bars;
    st.duration = res.buffer.duration;
    if(!st.an){ st.an = res._an || analyse(res.buffer, res.segs); }
    st.muted = st.muted || res.names.map(function(){ return false; });
    st.pending = null;
    touch(beat.id);
    return st;
  }, function(err){ st.pending = null; st.error = err; throw err; });
  return st.pending;
};
/* Les tampons protégés (l'instrumentale affichée et ses voisines) ne sont
   jamais libérés ; les autres ne gardent que leur analyse. */
E.protect = [];
function touch(id){
  var i = E.lru.indexOf(id); if(i !== -1) E.lru.splice(i, 1);
  E.lru.push(id);
  var guard = 0;
  while(E.lru.length > 4 && guard++ < 12){
    var old = E.lru.shift();
    if((E.cur && E.cur.id === old) || E.protect.indexOf(old) !== -1){ E.lru.push(old); continue; }
    if(E.store[old]) E.store[old].buffer = null;
  }
}
E.info = function(id){ return E.store[id]; };

function buildChain(st, offset){
  var ctx = E.ctx, src = ctx.createBufferSource(), out = gain(ctx, 0), gains = [];
  src.buffer = st.buffer; src.loop = true;
  if(st.stems){
    var split = ctx.createChannelSplitter(st.buffer.numberOfChannels);
    src.connect(split);
    for(var i = 0; i < st.buffer.numberOfChannels; i++){
      var g = gain(ctx, st.muted[i] ? 0 : 1);
      split.connect(g, i);
      var node = g;
      if(ctx.createStereoPanner && st.pans[i]){ var pn = ctx.createStereoPanner(); pn.pan.value = st.pans[i]; g.connect(pn); node = pn; }
      node.connect(out);
      gains.push(g);
    }
  } else {
    src.connect(out);
  }
  out.connect(E.bus);
  var when = ctx.currentTime + .025;
  src.start(when, offset % st.duration);
  return { src:src, out:out, gains:gains, t0:when - offset };
}
function fadeOut(chain, tc){
  var ctx = E.ctx, now = ctx.currentTime;
  chain.out.gain.cancelScheduledValues(now);
  chain.out.gain.setValueAtTime(chain.out.gain.value, now);
  chain.out.gain.setTargetAtTime(0, now, tc);
  try{ chain.src.stop(now + tc * 8); }catch(e){}
}

E.play = function(beat, offset, opts){
  opts = opts || {};
  var ctx = E.ensure();
  if(!ctx) return Promise.reject(new Error('Web Audio indisponible'));
  return E.prepare(beat).then(function(st){
    var prev = E.cur && E.cur.chain;
    var off = offset != null ? offset : (E.cur && E.cur.id === beat.id && !E.playing ? E.pausedAt : 0);
    var chain = buildChain(st, off || 0), now = ctx.currentTime;
    var level = (st.an ? st.an.norm : 1) * .9;
    chain.out.gain.setValueAtTime(0, now);
    chain.out.gain.setTargetAtTime(level, now + .02, opts.fast ? .01 : (prev ? .09 : .03));
    if(prev) fadeOut(prev, opts.fast ? .012 : .1);
    E.cur = { id:beat.id, beat:beat, st:st, chain:chain };
    E.playing = true;
    emit('state');
    return st;
  });
};
E.pause = function(){
  if(!E.playing || !E.cur) return;
  E.pausedAt = E.position();
  fadeOut(E.cur.chain, .025);
  E.playing = false;
  emit('state');
};
E.toggle = function(beat){
  if(E.playing && E.cur && E.cur.id === beat.id){ E.pause(); return Promise.resolve(); }
  return E.play(beat);
};
E.seek = function(sec){
  if(!E.cur) return;
  var d = E.cur.st.duration; sec = ((sec % d) + d) % d;
  if(E.playing) E.play(E.cur.beat, sec, { fast:true });
  else { E.pausedAt = sec; emit('state'); }
};
E.position = function(){
  if(!E.cur) return 0;
  var d = E.cur.st.duration;
  if(!E.playing) return E.pausedAt;
  var p = (E.ctx.currentTime - E.cur.chain.t0) % d;
  return p < 0 ? p + d : p;
};
E.setMute = function(i, muted){
  var st = E.cur && E.cur.st;
  if(!st) return;
  st.muted[i] = muted;
  var g = E.cur.chain.gains[i];
  if(g) g.gain.setTargetAtTime(muted ? 0 : 1, E.ctx.currentTime, .015);
  emit('mute');
};
E.muteFor = function(id, i, muted){
  var st = E.store[id]; if(!st || !st.muted) return;
  if(E.cur && E.cur.id === id) return E.setMute(i, muted);
  st.muted[i] = muted; emit('mute');
};

/* Sur mobile, un appui long n'ouvre pas le son : seul un geste « terminé »
   (toucher relâché, clic, touche) y autorise le navigateur. On profite donc du
   premier de ces gestes, n'importe où, pour déverrouiller le contexte. */
E.unlock = function(){
  if(!SUPPORTED) return;
  var ctx = E.ensure();
  if(ctx && !E._primed){
    var b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
    E._primed = true;
  }
};
E.ready = function(){ return !!(E.ctx && E.ctx.state === 'running'); };

/* Niveau instantané du mélange, en dB */
E.level = function(){
  if(!E.analyser || !E.playing) return { rms:0, peak:0, db:-Infinity };
  E.analyser.getFloatTimeDomainData(E.td);
  var pk = 0, acc = 0;
  for(var i = 0; i < E.td.length; i++){ var v = E.td[i]; acc += v * v; if(v > pk) pk = v; else if(-v > pk) pk = -v; }
  return { rms:Math.sqrt(acc / E.td.length), peak:pk, db:pk > 0 ? 20 * Math.log10(pk) : -Infinity };
};
E.wave = function(){ if(E.analyser) E.analyser.getFloatTimeDomainData(E.td); return E.td; };
E.spectrum = function(){ if(E.analyser) E.analyser.getByteFrequencyData(E.fd); return E.fd; };

/* Pads de la signature : un son par lettre, joué en direct */
var PADS = [
  ['kick', { f0:165, f1:46, decay:.5, click:.4 }, null, .95],
  ['b808', { decay:.9 }, 'F1', .9],
  ['snare', { decay:.18 }, null, .75],
  ['hat', { decay:.05 }, null, .45],
  ['hat', { decay:.3 }, null, .38],
  ['clap', {}, null, .6],
  ['rim', {}, null, .55],
  ['tom', { decay:.3 }, 'D3', .7],
  ['b808', { decay:.9 }, 'C2', .9]
];
E.pad = function(i){
  var ctx = E.ensure(); if(!ctx) return;
  var pd = PADS[i % PADS.length], t = ctx.currentTime + .005, out = gain(ctx, .55);
  out.connect(E.bus);
  if(pd[0] === 'b808'){ var ws = ctx.createWaveShaper(); ws.curve = driveCurve(2.4); out.disconnect(); out.connect(ws); ws.connect(E.bus); }
  var e = { t:t, vel:pd[3], sd:.1, n:1 };
  if(pd[2]){ var m = midi(pd[2]); e.f = mtof(m); e.fs = [e.f]; e.ms = [m]; e.dur = .7; }
  Inst[pd[0]](ctx, out, e, pd[1], Math.random);
  emit('pad', i);
};

/* Démonstration d'opposition de phase : deux sinusoïdes identiques, l'une
   retardée d'une fraction de période. À 180°, elles s'annulent vraiment. */
var phaseRig = null;
E.phase = function(on, deg){
  var ctx = on ? E.ensure() : E.ctx;
  if(!ctx) return;
  var F = 220;
  if(on && !phaseRig){
    var a = osc(ctx, 'sine', F), b = osc(ctx, 'sine', F), d = ctx.createDelay(.05), g = gain(ctx, 0), ga = gain(ctx, .16), gb = gain(ctx, .16);
    a.connect(ga); b.connect(d); d.connect(gb); ga.connect(g); gb.connect(g); g.connect(E.fx);
    a.start(); b.start();
    g.gain.setTargetAtTime(1, ctx.currentTime, .05);
    phaseRig = { a:a, b:b, d:d, g:g };
  }
  if(!on && phaseRig){
    var r = phaseRig; phaseRig = null;
    r.g.gain.setTargetAtTime(0, ctx.currentTime, .04);
    setTimeout(function(){ try{ r.a.stop(); r.b.stop(); }catch(e){} }, 300);
  }
  if(phaseRig && deg != null){
    phaseRig.d.delayTime.setTargetAtTime((deg / 360) / F, ctx.currentTime, .03);
  }
};
E.phaseOn = function(){ return !!phaseRig; };

window.GSAudio = E;
})();
