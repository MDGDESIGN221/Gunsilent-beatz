/* ══════════════════════════════════════════════════════════════════════════
   GUNSILENT — contenu modifiable
   Ce fichier est le seul à toucher pour mettre à jour les instrumentales et
   le calendrier du studio. Le reste du site s'adapte tout seul.
   ══════════════════════════════════════════════════════════════════════════ */
window.GS_DATA = {

  /* ────────────────────────────────────────────────────────────────────────
     ÉNERGIES — les cinq territoires (ne pas renommer les clés)
     ──────────────────────────────────────────────────────────────────────── */
  energies: {
    sombre:      'Sombre et pesante',
    aerienne:    'Aérienne et suspendue',
    percutante:  'Percutante et directe',
    chaleureuse: 'Chaleureuse et organique',
    froide:      'Froide et mécanique'
  },

  /* ────────────────────────────────────────────────────────────────────────
     INSTRUMENTALES

     ⚠ Les sept instrumentales ci-dessous sont des MAQUETTES DE DÉMONSTRATION,
     synthétisées dans le navigateur à partir des motifs écrits plus bas.
     Elles servent à montrer la chambre d'écoute en fonctionnement.

     Pour mettre un vrai extrait à la place :
       1. Déposer le fichier en ligne (Cloudinary, par exemple : l'onglet
          « Video » accepte l'audio). L'hébergeur doit autoriser le CORS,
          ce que fait Cloudinary.
       2. Ajouter `audio: 'https://…/extrait.mp3'` à l'instrumentale.
       3. Supprimer son bloc `pistes`.
     La partition est alors calculée depuis le vrai signal, découpée en cinq
     bandes de fréquence (Sub, Grave, Médium, Aigu, Air). Seul le bouton
     « Déconstruire » disparaît : un mp3 mixé ne se sépare pas en pistes.

     Écriture des motifs (une chaîne par mesure, 16 pas) :
       batterie  x plein · o moyen · y fantôme · . silence · 2 3 4 roulement
       notes     F1 note · F3+Ab3+C4 accord · - tenue · . silence
                 ~C2 glissé depuis la note précédente · C5:0.6 vélocité
     `alt: { 7:'…' }` remplace la mesure 8 (on compte à partir de 0).
     `off: [0,1]` coupe la piste sur les mesures 1 et 2.
     ──────────────────────────────────────────────────────────────────────── */
  beats: [

    {
      id: 'plomb', titre: 'Plomb', bpm: 140, tonalite: 'Fa mineur', mesure: '4/4', mesures: 8,
      energie: 'sombre', genre: 'Trap',
      ligne: 'Un 808 qui tombe comme du métal fondu, une cloche qui ne se résout jamais.',
      pistes: [
        { nom:'Kick', inst:'kick', p:{ f0:125, f1:46, decay:.3, click:.35 }, bus:{ gain:.8 },
          seq:['x.........x.....', 'x......x..x.....', 'x.........x.....', 'x......x..x...x.'] },
        { nom:'808', inst:'b808', p:{ decay:1.6, glide:.09 }, bus:{ gain:.95, drive:2.6, lp:2600 },
          notes:[
            'F1 - - - - - - - - - Ab1 - - - - -',
            'F1 - - - - - - ~C2 - - F1 - - - - -',
            'Db2 - - - - - - - - - Db2 - - - - -',
            'Eb2 - - - - - - ~Bb1 - - Eb2 - - C2 - -'
          ] },
        { nom:'Clap', inst:'clap', p:{ decay:.24 }, bus:{ gain:.62, rev:.18 },
          seq:['........x.......', '........x.......', '........x.......', '........x......o'],
          alt:{ 7:'........x...o.x.' } },
        { nom:'Hats', inst:'hat', p:{ decay:.035 }, bus:{ gain:.32, pan:.18 },
          seq:['x.o.x.o.x.o.x.o.', 'x.o.x.o.x.o.3.o.', 'x.o.x.o.x.o.x.o.', 'x.o.x.o2x.o.4.o2'] },
        { nom:'Open', inst:'hat', p:{ decay:.28, hp:6500 }, bus:{ gain:.16, pan:-.2 },
          seq:['................', '................', '................', '..............x.'],
          alt:{ 7:'......x.......x.' } },
        { nom:'Cloche', inst:'bell', p:{ ratio:3.5, index:4.5, decay:1.8 }, bus:{ gain:.34, hp:300, rev:.35, dly:.22, dlySteps:3, pan:-.1 },
          notes:[
            'C5 . . Ab4 . . F4 . C5 . . Db5 . . C5 .',
            'Ab4 . . F4 . . Eb4 . . . F4 . . . . .',
            'Db5 . . C5 . . Ab4 . F4 . . Ab4 . . C5 .',
            'Bb4 . . Ab4 . . G4 . . . Eb4 . . . . .',
            'F5 . . Eb5 . . C5 . Db5 . . C5 . . Ab4 .',
            'C5 . . Ab4 . . G4 . . . F4 . . . . .',
            'Db5 . . C5 . . Ab4 . F4 . . Ab4 . . C5 .',
            'Bb4 . . C5 . . Db5 . . . Eb5 . . C5 . .'
          ] },
        { nom:'Nappe', inst:'pad', p:{ attack:.5, release:1.2, detune:9 }, bus:{ gain:.3, lp:900, rev:.45, duck:.55 },
          off:[0, 1, 2, 3],
          notes:[
            'F3+Ab3+C4 - - - - - - - - - - - - - - -',
            'F3+Ab3+C4 - - - - - - - - - - - - - - -',
            'Db3+F3+Ab3+C4 - - - - - - - - - - - - - - -',
            'Eb3+G3+Bb3 - - - - - - - - - - - - - - -'
          ] }
      ]
    },

    {
      id: 'laterite', titre: 'Latérite', bpm: 112, tonalite: 'La mineur', mesure: '4/4', mesures: 8,
      energie: 'chaleureuse', genre: 'Afro · Amapiano',
      ligne: 'La terre rouge de Dakar à 112 BPM : log drum, cordes pincées, et un kick qui ne s’arrête jamais.',
      pistes: [
        { nom:'Kick', inst:'kick', p:{ f0:110, f1:50, decay:.34, click:.2 }, bus:{ gain:.72 },
          seq:['x...x...x...x...'] },
        { nom:'Log drum', inst:'log', p:{ decay:.46 }, bus:{ gain:.62, drive:1.8 },
          notes:[
            'A1 . . A1 . . C2 . . . A1 . . E2 . .',
            'D2 . . D2 . . F2 . . . D2 . . A1 . .',
            'G1 . . G1 . . B1 . . . D2 . . G1 . .',
            'C2 . . C2 . . E2 . . . G2 . . E2 . .'
          ] },
        { nom:'Shaker', inst:'shaker', p:{ decay:.07 }, bus:{ gain:.3, pan:.3 },
          seq:['oxoxoxoxoxoxoxox'] },
        { nom:'Clap', inst:'clap', p:{ decay:.2 }, bus:{ gain:.5, rev:.25 },
          seq:['....x.......x...', '....x.......x...', '....x.......x...', '....x.......x.o.'] },
        { nom:'Sabar', inst:'tom', p:{ decay:.26 }, bus:{ gain:.42, pan:-.3, rev:.12 },
          notes:[
            '. . D4 . . G3 . . . . D4 . G3 . . .',
            '. . D4 . . G3 . . D4 . . . G3 . A3 .'
          ] },
        { nom:'Kora', inst:'pluck', p:{ bright:.6 }, bus:{ gain:.5, rev:.3, dly:.2, dlySteps:3, pan:.15 },
          notes:[
            'A4 . . C5 . . E5 . G5 . . E5 . . C5 .',
            'A4 . . D5 . . F5 . A5 . . F5 . . D5 .',
            'G4 . . B4 . . D5 . G5 . . D5 . . B4 .',
            'G4 . . C5 . . E5 . B5 . . G5 . . E5 .',
            'A4 . . C5 . . E5 . G5 . . E5 . . C5 .',
            'A4 . . D5 . . F5 . A5 . . F5 . . D5 .',
            'G4 . . B4 . . D5 . G5 . . D5 . . B4 .',
            'G4 . . C5 . . E5 . G5 . E5 . C5 . B4 .'
          ] },
        { nom:'Nappe', inst:'pad', p:{ attack:.4, release:1, detune:7, wave:'triangle' }, bus:{ gain:.5, lp:1800, rev:.4, duck:.6 },
          notes:[
            'A3+C4+E4+G4 - - - - - - - - - - - - - - -',
            'D3+F3+A3+C4 - - - - - - - - - - - - - - -',
            'G3+B3+D4 - - - - - - - - - - - - - - -',
            'C3+E3+G3+B3 - - - - - - - - - - - - - - -'
          ] }
      ]
    },

    {
      id: 'calibre', titre: 'Calibre', bpm: 142, tonalite: 'Do dièse mineur', mesure: '4/4', mesures: 8,
      energie: 'percutante', genre: 'Drill',
      ligne: 'Des glissés de 808 serrés, un charleston en 3-3-2, rien qui dépasse.',
      pistes: [
        { nom:'Kick', inst:'kick', p:{ f0:140, f1:45, decay:.26, click:.45 }, bus:{ gain:.78 },
          seq:['x.........x.....', '..x.....x.......', 'x.........x.....', '..x.....x.....x.'] },
        { nom:'808', inst:'b808', p:{ decay:1.4, glide:.07 }, bus:{ gain:.95, drive:3, lp:3000 },
          notes:[
            'C#2 - - - - - - - - - ~E2 - - ~C#2 - -',
            '. . G#1 - - - - - ~B1 - - - - - - -',
            'C#2 - - - - - - - - - ~F#2 - - ~E2 - -',
            '. . A1 - - - - - ~G#1 - - - - - ~C#2 -'
          ] },
        { nom:'Snare', inst:'snare', p:{ tone:2200, decay:.17, body:210 }, bus:{ gain:.6, rev:.14 },
          seq:['........x.......', '........x....x..', '........x.......', '........x..x..x.'] },
        { nom:'Hats', inst:'hat', p:{ decay:.032 }, bus:{ gain:.3, pan:.2 },
          seq:['x..o..x.x..o..x.', 'x..o..x.x..o..x.', 'x..o..x.x..o..x.', 'x..o..x.x..o3.x3'] },
        { nom:'Rim', inst:'rim', p:{ f:1800 }, bus:{ gain:.3, pan:-.35, dly:.18, dlySteps:3 },
          seq:['......x.......x.', '...x.......x....'] },
        { nom:'Cordes', inst:'pad', p:{ attack:.28, release:.8, detune:14 }, bus:{ gain:.38, lp:1500, rev:.55 },
          notes:[
            'C#3+E3+G#3 - - - - - - - - - - - - - - -',
            'C#3+E3+G#3 - - - - - - - - - - - - - - -',
            'A2+C#3+E3 - - - - - - - - - - - - - - -',
            'G#2+C3+D#3 - - - - - - - - - - - - - - -'
          ] },
        { nom:'Piano', inst:'keys', p:{ index:2.6, hold:.5 }, bus:{ gain:.42, hp:250, rev:.4, pan:.1 },
          notes:[
            'G#4 - - - - - A4 - G#4 - - - E4 - - -',
            'C#5 - - - - - B4 - G#4 - - - - - - -',
            'A4 - - - - - G#4 - E4 - - - C#4 - - -',
            'D#4 - - - - - E4 - D#4 - - - C4 - - -'
          ] }
      ]
    },

    {
      id: 'apesanteur', titre: 'Apesanteur', bpm: 72, tonalite: 'Mi majeur', mesure: '4/4', mesures: 4,
      energie: 'aerienne', genre: 'R&B',
      ligne: 'Tout flotte au-dessus d’un kick qui ose à peine toucher le sol.',
      pistes: [
        { nom:'Kick', inst:'kick', p:{ f0:100, f1:48, decay:.4, click:.1 }, bus:{ gain:.7 },
          seq:['x.........x.....', 'x......x........', 'x.........x..x..', 'x......x...x....'] },
        { nom:'Snap', inst:'clap', p:{ snap:true, tone:2400, decay:.09 }, bus:{ gain:.5, rev:.4 },
          seq:['....x.......x...'] },
        { nom:'Hats', inst:'hat', p:{ decay:.03 }, bus:{ gain:.22, pan:.25 },
          seq:['x.o.x.o.x.o.x.o.', 'x.o.x.o.x.o.x3o.', 'x.o.x.o.x.o.x.o.', 'x.o.x.o.x.o.4.o.'] },
        { nom:'808', inst:'b808', p:{ decay:2.2, glide:.14 }, bus:{ gain:.8, drive:1.6, lp:1400 },
          notes:[
            'E2 - - - - - - - - - - - - - - -',
            'C#2 - - - - - - ~B1 - - - - - - - -',
            'A1 - - - - - - - - - - - - - - -',
            'B1 - - - - - - - ~E2 - - - - - - -'
          ] },
        { nom:'Chœur', inst:'choir', p:{ attack:.9, release:1.6 }, bus:{ gain:.55, rev:.6, lp:3200 },
          notes:[
            'E3+G#3+B3+D#4 - - - - - - - - - - - - - - -',
            'C#3+E3+G#3+B3 - - - - - - - - - - - - - - -',
            'A2+C#3+E3+G#3 - - - - - - - - - - - - - - -',
            'B2+D#3+F#3+C#4 - - - - - - - - - - - - - - -'
          ] },
        { nom:'Pluck', inst:'pluck', p:{ bright:.42 }, bus:{ gain:.5, rev:.5, dly:.35, dlySteps:3, fb:.45, pan:-.2 },
          notes:[
            '. . . . B4 . . . G#5 . . . . . D#5 .',
            '. . E5 . . . . . C#5 . . . B4 . . .',
            '. . . . C#5 . . . E5 . . . . . G#4 .',
            '. . F#5 . . . D#5 . . . B4 . . . . .'
          ] },
        { nom:'Souffle', inst:'air', p:{ tone:1200 }, bus:{ gain:.7, rev:.3 },
          notes:['* - - - - - - - - - - - - - - -'] }
      ]
    },

    {
      id: 'poussiere', titre: 'Poussière', bpm: 88, tonalite: 'Ré mineur', mesure: '4/4', mesures: 4,
      energie: 'chaleureuse', genre: 'Boom bap', swing: .16, human: .5,
      ligne: 'Un Rhodes fatigué, un swing de MPC, le craquement d’un vinyle qu’on a trop aimé.',
      pistes: [
        { nom:'Kick', inst:'kick', p:{ f0:115, f1:52, decay:.36, click:.3 }, bus:{ gain:.8, drive:1.4, lp:5000 },
          seq:['x.......x.x.....', 'x.x.......x.....', 'x.......x.x.....', 'x.x.......x..x..'] },
        { nom:'Snare', inst:'snare', p:{ tone:1700, decay:.22, body:180 }, bus:{ gain:.62, lp:7000, rev:.16 },
          seq:['....x..y....x...', '....x.......x.y.', '....x..y....x...', '....x.......x.xy'] },
        { nom:'Hats', inst:'hat', p:{ decay:.05, hp:6000, center:8500 }, bus:{ gain:.26, lp:9000, pan:.2 },
          seq:['x.o.x.o.x.o.x.o.', 'x.o.x.o.x.o.x.o.', 'x.o.x.o.x.o.x.o.', 'x.o.x.o.x.o.x.x.'] },
        { nom:'Basse', inst:'sub', p:{ sus:.7 }, bus:{ gain:.72, drive:1.5, lp:900 },
          notes:[
            'D2 - - - - - . . D2 - F2 - - - - .',
            'G1 - G1 - - - - - - - G1 - - - - .',
            'C2 - - - - - . . C2 - E2 - - - - .',
            'A1 - A1 - - - - - - - A1 - - C#2 - .'
          ] },
        { nom:'Rhodes', inst:'keys', p:{ index:1.9, hold:.7 }, bus:{ gain:.62, lp:3800, rev:.25, pan:-.12 },
          notes:[
            'D3+F3+A3+C4+E4 - - - - - - - . . D3+F3+A3+C4+E4 - - . . .',
            'G2+F3+B3+E4 - - - - - - - . . G2+F3+B3+E4 - - . . .',
            'C3+E3+G3+B3+D4 - - - - - - - . . C3+E3+G3+B3+D4 - - . . .',
            'A2+G3+C#4+F4 - - - - - - - . . A2+G3+C#4+F4 - - . . .'
          ] },
        { nom:'Vibra', inst:'bell', p:{ ratio:4, index:1.6, decay:1.3 }, bus:{ gain:.3, rev:.35, pan:.25 },
          notes:[
            '. . . . . . . . . . . . . . . .',
            '. . . . . . . . A4 . C5 . . E5 . .',
            '. . . . . . . . . . . . . . . .',
            '. . . . . . . . G4 . A4 . . C#5 . .'
          ] },
        { nom:'Vinyle', inst:'vinyl', p:{ density:10 }, bus:{ gain:.9 },
          notes:['* - - - - - - - - - - - - - - -'] }
      ]
    },

    {
      id: 'acier', titre: 'Acier', bpm: 96, tonalite: 'Mi phrygien', mesure: '4/4', mesures: 4,
      energie: 'froide', genre: 'Industriel',
      ligne: 'Une machine qui respire en phrygien, des accords froids comme une lame.',
      pistes: [
        { nom:'Kick', inst:'kick', p:{ f0:180, f1:42, decay:.34, click:.6 }, bus:{ gain:.72, drive:3 },
          seq:['x..x......x.....', 'x.........x..x..', 'x..x......x.....', 'x.....x...x.x...'] },
        { nom:'Snare', inst:'snare', p:{ tone:2600, decay:.16, body:230, ring:540 }, bus:{ gain:.55, rev:.22, hp:180 },
          seq:['....x.......x...', '....x.......x...', '....x.......x...', '....x.......x.xx'] },
        { nom:'Métal', inst:'hat', p:{ decay:.04, metal:1 }, bus:{ gain:.3, pan:.22 },
          seq:['xyoyxyoyxyoyxyoy'] },
        { nom:'Stab', inst:'stab', p:{ index:7, decay:.3 }, bus:{ gain:.44, hp:220, rev:.3, dly:.25, dlySteps:3, pan:-.18 },
          notes:[
            '. . E3+B3+F4 . . . . . E3+B3+F4 . . E3+B3+F4 . . . .',
            '. . F3+C4+G4 . . . . . F3+C4+G4 . . . . . . .',
            '. . E3+B3+F4 . . . . . E3+B3+F4 . . E3+B3+F4 . . . .',
            '. . G3+D4+A4 . . . . . F3+C4+G4 . . . . E3+B3+F4 . .'
          ] },
        { nom:'Sub', inst:'sub', p:{ sus:.6 }, bus:{ gain:.62, drive:2 },
          notes:[
            'E2 . E2 . . . E2 . E2 . . . E2 . . .',
            'F2 . F2 . . . F2 . E2 . . . E2 . . .',
            'E2 . E2 . . . E2 . E2 . . . E2 . . .',
            'G2 . G2 . . . F2 . F2 . . . E2 . . .'
          ] },
        { nom:'Horloge', inst:'tick', bus:{ gain:.2, pan:-.4 },
          seq:['yyyyyyyyyyyyyyyy'] },
        { nom:'Montée', inst:'riser', p:{ top:8000 }, bus:{ gain:.5 },
          off:[0, 1, 2],
          notes:['* - - - - - - - - - - - - - - -'] }
      ]
    },

    {
      id: 'entre-deux-temps', titre: 'Entre deux temps', bpm: 76, tonalite: 'Si bémol mineur', mesure: '4/4', mesures: 4,
      energie: 'aerienne', genre: 'Minimal',
      ligne: 'Presque rien. Le silence fait la moitié du morceau.',
      pistes: [
        { nom:'Kick', inst:'kick', p:{ f0:95, f1:44, decay:.55, click:.08 }, bus:{ gain:.78 },
          seq:['x...............', '..........x.....', 'x...............', '......x.....x...'] },
        { nom:'Rim', inst:'rim', p:{ f:1500, decay:.04 }, bus:{ gain:.34, rev:.5 },
          seq:['........x.......', '................', '........x.......', '........x.....y.'] },
        { nom:'Piano', inst:'keys', p:{ index:1.6, hold:1.1 }, bus:{ gain:.6, rev:.55, dly:.2, dlySteps:6, fb:.3 },
          notes:[
            'F4 - - - Db5 - - - - - - - . . . .',
            '. . . . . . . . C5 - - - Ab4 - - -',
            'F4 - - - Db5 - - - Eb5 - - - - - - -',
            '. . . . . . . . . . . . . . . .'
          ] },
        { nom:'Sub', inst:'sub', p:{ sus:.8 }, bus:{ gain:.62, drive:1.3 },
          notes:[
            'Bb1 - - - - - - - - - - - - - - -',
            '. . . . . . . . . . Gb1 - - - - -',
            'Bb1 - - - - - - - - - - - - - - -',
            '. . . . . . Ab1 - - - - - - - - -'
          ] },
        { nom:'Chœur', inst:'choir', p:{ attack:1.2, release:2 }, bus:{ gain:.34, rev:.7, lp:2600 },
          notes:[
            'Bb3+Db4+F4+Ab4 - - - - - - - - - - - - - - -',
            'Bb3+Db4+F4+Ab4 - - - - - - - - - - - - - - -',
            'Gb3+Bb3+Db4+F4 - - - - - - - - - - - - - - -',
            'Gb3+Bb3+Db4+F4 - - - - - - - - - - - - - - -'
          ] },
        { nom:'Souffle', inst:'air', p:{ tone:900 }, bus:{ gain:.6, rev:.4 },
          notes:['* - - - - - - - - - - - - - - -'] }
      ]
    }
  ],

  /* ────────────────────────────────────────────────────────────────────────
     DISPONIBILITÉS DU STUDIO (heures de Dakar, GMT)
     ──────────────────────────────────────────────────────────────────────── */
  studio: {
    /* Horaires récurrents par jour : 0 = dimanche, 1 = lundi … 6 = samedi.
       Tableau vide = studio fermé ce jour-là. */
    horaires: {
      0: [],
      1: ['10:00 – 12:00', '14:00 – 16:00', '16:30 – 18:30'],
      2: ['10:00 – 12:00', '14:00 – 16:00', '16:30 – 18:30'],
      3: ['10:00 – 12:00', '14:00 – 16:00', '16:30 – 18:30'],
      4: ['10:00 – 12:00', '14:00 – 16:00', '16:30 – 18:30'],
      5: ['10:00 – 12:00', '14:00 – 16:00', '16:30 – 18:30'],
      6: ['11:00 – 13:00', '15:00 – 17:00']
    },

    /* Créneaux déjà pris. Clé = date 'AAAA-MM-JJ', libellé recopié tel quel. */
    reserves: {
      // '2026-10-06': ['10:00 – 12:00', '14:00 – 16:00']
    },

    /* Journées entièrement fermées : congés, déplacements, jours fériés. */
    fermetures: [
      // '2026-10-15'
    ],

    /* Nombre de jours affichés. */
    fenetre: 14,

    /* Numéro WhatsApp qui reçoit les demandes (international, sans le +). */
    whatsapp: '221777492631'
  }
};
