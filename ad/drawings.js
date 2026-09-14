'use strict';
/**
 * Every invention the videos draw, in one place.
 *
 * Each is a prompt, somebody's answer to it, and a dozen-odd strokes in 0..1
 * paper coordinates. The strokes are clean geometry handed to the pen in
 * engine.js, which adds the same three imperfections the server gives bot
 * drawings -- a slow bow, a fine tremor, endpoints landing a hair off -- so
 * they read as drawn by a person rather than plotted.
 *
 * Every drawing carries its own seed, so the hand-wobble is identical on every
 * run and in every film it appears in. The pup-brella in the phone ad and the
 * pup-brella in the gallery are the same drawing, down to the pixel.
 *
 * Needs engine.js loaded first.
 */

const DRAWINGS = {

  // -------------------------------------------------------------- rain ----
  pupBrella: {
    artist: 'LAKSHAY', seed: 7,
    prompt: { before: 'Walking the dog always means dealing with ', blank: 'rain', after: '.' },
    title: 'THE PUP-BRELLA', subtitle: 'an umbrella hat for the dog',
    build({ S, C, line, arc, ellipse, curve }) {
      const s = [];
      const ux = .5, uy = .30, ur = .27;
      s.push(S(arc(ux, uy, ur, ur * .62, Math.PI, Math.PI * 2), C.ink, 7));
      { const pts = []; for (let i = 0; i <= 5; i++) { const a = Math.PI + (i / 5) * Math.PI; pts.push({ x: ux + Math.cos(a) * ur, y: uy }); }
        let edge = [];
        for (let i = 0; i < 5; i++) { const a = pts[i], b = pts[i + 1], m = { x: (a.x + b.x) / 2, y: uy + .035 };
          edge = edge.concat(curve([a, m, b]).slice(i ? 1 : 0)); }
        s.push(S(edge, C.ink, 7)); }
      s.push(S(line({ x: ux, y: uy - ur * .62 }, { x: ux, y: uy - ur * .62 - .035 }), C.ink, 6));
      for (const a of [Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75])
        s.push(S(line({ x: ux, y: uy }, { x: ux + Math.cos(a) * ur * .97, y: uy + Math.sin(a) * ur * .62 * .97 }), C.primary, 9, 'marker'));
      s.push(S(line({ x: ux, y: uy + .01 }, { x: ux, y: .43 }), C.ink, 6));
      s.push(S(ellipse(.50, .52, .11, .10), C.ink, 7));
      s.push(S(curve([{ x: .41, y: .47 }, { x: .34, y: .55 }, { x: .38, y: .63 }, { x: .42, y: .58 }]), C.ink, 7));
      s.push(S(curve([{ x: .59, y: .47 }, { x: .66, y: .55 }, { x: .62, y: .63 }, { x: .58, y: .58 }]), C.ink, 7));
      s.push(S(arc(.465, .50, .012, .012, 0, Math.PI * 2), C.ink, 7));
      s.push(S(arc(.535, .50, .012, .012, 0, Math.PI * 2), C.ink, 7));
      s.push(S(curve([{ x: .485, y: .545 }, { x: .50, y: .535 }, { x: .515, y: .545 }, { x: .50, y: .56 }, { x: .485, y: .545 }]), C.ink, 7));
      s.push(S(curve([{ x: .50, y: .56 }, { x: .50, y: .585 }]), C.ink, 6));
      s.push(S(curve([{ x: .47, y: .585 }, { x: .50, y: .605 }, { x: .53, y: .585 }]), C.ink, 6));
      s.push(S(curve([{ x: .505, y: .60 }, { x: .515, y: .635 }, { x: .535, y: .61 }]), C.pink, 9, 'marker'));
      s.push(S(curve([{ x: .42, y: .57 }, { x: .50, y: .64 }, { x: .58, y: .57 }]), C.ink, 5));
      s.push(S(curve([{ x: .43, y: .62 }, { x: .37, y: .74 }, { x: .40, y: .84 }, { x: .60, y: .84 }, { x: .63, y: .74 }, { x: .57, y: .62 }]), C.ink, 7));
      for (const x of [.42, .48, .53, .59]) s.push(S(line({ x, y: .84 }, { x, y: .91 }), C.ink, 7));
      for (const x of [.42, .48, .53, .59]) s.push(S(arc(x, .915, .02, .012, Math.PI, Math.PI * 2 + .3), C.ink, 6));
      s.push(S(curve([{ x: .62, y: .76 }, { x: .70, y: .70 }, { x: .73, y: .62 }, { x: .69, y: .60 }]), C.ink, 7));
      s.push(S(arc(.50, .655, .018, .018, 0, Math.PI * 2), C.primary, 7, 'marker'));
      for (const [x, y] of [[.14,.12],[.22,.30],[.10,.46],[.82,.10],[.88,.30],[.78,.48],[.30,.06],[.70,.06],[.18,.66],[.84,.66]])
        s.push(S(line({ x, y }, { x: x - .02, y: y + .05 }, .6), C.cyan, 8, 'marker'));
      s.push(S(curve([{ x: .25, y: .27 }, { x: .21, y: .22 }, { x: .19, y: .25 }]), C.cyan, 6, 'marker'));
      s.push(S(curve([{ x: .75, y: .27 }, { x: .79, y: .22 }, { x: .81, y: .25 }]), C.cyan, 6, 'marker'));
      return s;
    },
  },

  // -------------------------------------------------------- alarm clock ----
  snoozeMitt: {
    artist: 'RIYA', seed: 19,
    prompt: { before: 'Mornings would be so much easier without ', blank: 'the alarm clock', after: '.' },
    title: 'THE SNOOZE-MITT', subtitle: "it punches the alarm so you don't have to",
    build({ S, C, line, arc, ellipse, curve, poly, coilBetween }) {
      const s = [];
      const cx = .32, cy = .50, r = .185;
      s.push(S(ellipse(cx, cy, r, r), C.ink, 8));
      s.push(S(ellipse(cx, cy, r * .80, r * .80), C.ink, 5));
      s.push(S(arc(.185, .275, .072, .068, Math.PI * .82, Math.PI * 2.18), C.ink, 7));
      s.push(S(line({ x: .123, y: .300 }, { x: .247, y: .300 }), C.ink, 5));
      s.push(S(arc(.455, .275, .072, .068, Math.PI * .82, Math.PI * 2.18), C.ink, 7));
      s.push(S(line({ x: .393, y: .300 }, { x: .517, y: .300 }), C.ink, 5));
      s.push(S(line({ x: .228, y: .332 }, { x: .258, y: .368 }), C.ink, 6));
      s.push(S(line({ x: .412, y: .332 }, { x: .382, y: .368 }), C.ink, 6));
      s.push(S(line({ x: .320, y: .222 }, { x: .320, y: .296 }), C.ink, 6));
      s.push(S(ellipse(.320, .210, .021, .019), C.ink, 6));
      s.push(S(line({ x: .215, y: .665 }, { x: .175, y: .768 }), C.ink, 7));
      s.push(S(line({ x: .425, y: .665 }, { x: .465, y: .768 }), C.ink, 7));
      s.push(S(ellipse(.268, .455, .018, .021), C.ink, 6));
      s.push(S(ellipse(.372, .455, .018, .021), C.ink, 6));
      s.push(S(curve([{ x: .270, y: .585 }, { x: .320, y: .545 }, { x: .370, y: .585 }]), C.ink, 6));
      s.push(S(curve([{ x: .140, y: .300 }, { x: .161, y: .334 }, { x: .140, y: .358 },
                      { x: .121, y: .334 }, { x: .140, y: .300 }]), C.cyan, 7, 'marker'));
      s.push(S(line({ x: .075, y: .785 }, { x: .720, y: .785 }), C.ink, 7));
      s.push(S(poly([{ x: .975, y: .405 }, { x: .905, y: .405 }, { x: .905, y: .595 }, { x: .975, y: .595 }]), C.ink, 7));
      s.push(S(coilBetween({ x: .895, y: cy }, { x: .730, y: cy }, 4, .050), C.ink, 7));
      s.push(S(poly([{ x: .682, y: .448 }, { x: .730, y: .448 }, { x: .730, y: .552 },
                     { x: .682, y: .552 }, { x: .682, y: .448 }]), C.ink, 6));
      s.push(S(ellipse(.595, .500, .085, .095), C.ink, 7));
      s.push(S(curve([{ x: .548, y: .556 }, { x: .506, y: .578 }, { x: .504, y: .616 },
                      { x: .546, y: .612 }]), C.ink, 7));
      s.push(S(curve([{ x: .556, y: .444 }, { x: .595, y: .436 }, { x: .634, y: .447 }]), C.ink, 5));
      for (let i = 0; i < 11; i++) {
        const yy = .428 + i * .0144;
        const k = Math.sqrt(Math.max(0, 1 - Math.pow((yy - .500) / .095, 2))) * .88;
        s.push(S(line({ x: .595 - .085 * k, y: yy }, { x: .595 + .085 * k, y: yy }, .3), C.pink, 7, 'marker'));
      }
      s.push(S(line({ x: .518, y: .588 }, { x: .540, y: .588 }, .3), C.pink, 7, 'marker'));
      s.push(S(line({ x: .516, y: .602 }, { x: .540, y: .602 }, .3), C.pink, 7, 'marker'));
      for (const a of [.35, 1.05, 1.75, 2.45, 3.15, 3.85, 4.55, 5.25])
        s.push(S(line({ x: .512 + Math.cos(a) * .038, y: .50 + Math.sin(a) * .038 },
                      { x: .512 + Math.cos(a) * .082, y: .50 + Math.sin(a) * .082 }, .4), C.primary, 9, 'marker'));
      for (const y of [.44, .52, .60])
        s.push(S(line({ x: .135, y }, { x: .055, y }, .4), C.cyan, 8, 'marker'));
      return s;
    },
  },

  // ------------------------------------------------------------ printer ----
  paperPigeon: {
    artist: 'ARJUN', seed: 11,
    prompt: { before: 'Every office has an ongoing problem with ', blank: 'the printer', after: '.' },
    title: 'THE PAPER PIGEON', subtitle: 'it delivers the document itself',
    build({ S, C, line, ellipse, curve, poly }) {
      return [
        S(ellipse(.44, .55, .17, .125), C.ink, 7),
        S(ellipse(.67, .40, .088, .082), C.ink, 7),
        S(poly([{x:.745,y:.375},{x:.85,y:.405},{x:.745,y:.435}]), C.primary, 8, 'marker'),
        S(ellipse(.695, .378, .014, .014), C.ink, 6),
        S(curve([{x:.38,y:.50},{x:.47,y:.44},{x:.56,y:.53},{x:.45,y:.575}]), C.ink, 6),
        S(poly([{x:.28,y:.545},{x:.145,y:.485},{x:.175,y:.565},{x:.135,y:.62},{x:.275,y:.60}]), C.ink, 6),
        S(line({x:.40,y:.665},{x:.385,y:.745}), C.ink, 6),
        S(line({x:.52,y:.665},{x:.535,y:.745}), C.ink, 6),
        S(line({x:.345,y:.752},{x:.425,y:.752}), C.ink, 6),
        S(line({x:.495,y:.752},{x:.575,y:.752}), C.ink, 6),
        S(poly([{x:.56,y:.70},{x:.79,y:.70},{x:.79,y:.86},{x:.56,y:.86},{x:.56,y:.70}]), C.ink, 6),
        S(line({x:.60,y:.755},{x:.75,y:.755}, .5), C.ink, 4),
        S(line({x:.60,y:.805},{x:.75,y:.805}, .5), C.ink, 4),
      ];
    },
  },

  smashOMatic: {
    artist: 'MEERA', seed: 23,
    prompt: { before: 'Every office has an ongoing problem with ', blank: 'the printer', after: '.' },
    title: 'THE SMASH-O-MATIC', subtitle: 'it hits the printer so you don’t have to',
    build({ S, C, line, ellipse, poly, coilBetween }) {
      return [
        S(poly([{x:.20,y:.60},{x:.80,y:.60},{x:.80,y:.85},{x:.20,y:.85},{x:.20,y:.60}]), C.ink, 8),
        S(line({x:.28,y:.695},{x:.72,y:.695}), C.ink, 5),
        S(ellipse(.30, .77, .022, .022), C.cyan, 7, 'marker'),
        S(ellipse(.37, .77, .022, .022), C.ink, 6),
        S(poly([{x:.34,y:.60},{x:.66,y:.60},{x:.66,y:.52},{x:.34,y:.52},{x:.34,y:.60}]), C.ink, 5),
        S(coilBetween({x:.50,y:.08},{x:.50,y:.30}, 4, .052), C.ink, 7),
        S(poly([{x:.34,y:.30},{x:.66,y:.30},{x:.66,y:.44},{x:.34,y:.44},{x:.34,y:.30}]), C.ink, 8),
        ...[.34,.40,.46].map(y => S(line({x:.37,y:y+.02},{x:.63,y:y+.02}, .3), C.pink, 8, 'marker')),
        ...[.6,1.4,2.2,3.0,3.8,4.6,5.4].map(a =>
          S(line({x:.50+Math.cos(a)*.055,y:.475+Math.sin(a)*.045},
                 {x:.50+Math.cos(a)*.10, y:.475+Math.sin(a)*.085}, .4), C.primary, 8, 'marker')),
      ];
    },
  },

  inkGeyser: {
    artist: 'DEV', seed: 37,
    prompt: { before: 'Every office has an ongoing problem with ', blank: 'the printer', after: '.' },
    title: 'THE INK GEYSER', subtitle: 'it was always going to do this',
    build({ S, C, line, ellipse, curve, poly }) {
      return [
        S(poly([{x:.20,y:.58},{x:.80,y:.58},{x:.80,y:.86},{x:.20,y:.86},{x:.20,y:.58}]), C.ink, 8),
        S(line({x:.28,y:.685},{x:.72,y:.685}), C.ink, 5),
        S(ellipse(.31, .775, .022, .022), C.ink, 6),
        S(curve([{x:.40,y:.58},{x:.34,y:.40},{x:.46,y:.22},{x:.58,y:.34},{x:.62,y:.20},{x:.70,y:.36},{x:.60,y:.58}]), C.cyan, 9, 'marker'),
        ...[.44,.50,.56].map(y => S(line({x:.40,y},{x:.66,y}, .3), C.cyan, 9, 'marker')),
        S(curve([{x:.24,y:.30},{x:.20,y:.36},{x:.26,y:.40},{x:.29,y:.33},{x:.24,y:.30}]), C.cyan, 7, 'marker'),
        S(curve([{x:.80,y:.24},{x:.75,y:.30},{x:.81,y:.35},{x:.85,y:.28},{x:.80,y:.24}]), C.cyan, 7, 'marker'),
        S(ellipse(.87, .46, .024, .024), C.cyan, 7, 'marker'),
        S(ellipse(.15, .50, .020, .020), C.cyan, 7, 'marker'),
      ];
    },
  },

  shredderSmile: {
    artist: 'SANA', seed: 53,
    prompt: { before: 'Every office has an ongoing problem with ', blank: 'the printer', after: '.' },
    title: 'THE SHREDDER SMILE', subtitle: 'give it what it wants',
    build({ S, C, line, ellipse, curve, poly }) {
      return [
        S(poly([{x:.16,y:.42},{x:.84,y:.42},{x:.84,y:.86},{x:.16,y:.86},{x:.16,y:.42}]), C.ink, 8),
        S(ellipse(.34, .53, .034, .038), C.ink, 7),
        S(ellipse(.66, .53, .034, .038), C.ink, 7),
        S(ellipse(.345, .54, .012, .012), C.ink, 6),
        S(ellipse(.665, .54, .012, .012), C.ink, 6),
        S(curve([{x:.26,y:.66},{x:.50,y:.62},{x:.74,y:.66}]), C.ink, 7),
        S(curve([{x:.26,y:.66},{x:.50,y:.80},{x:.74,y:.66}]), C.ink, 7),
        S(poly([{x:.30,y:.665},{x:.345,y:.725},{x:.39,y:.665},{x:.44,y:.735},
                {x:.49,y:.665},{x:.545,y:.735},{x:.60,y:.665},{x:.65,y:.72},{x:.70,y:.665}]), C.ink, 5),
        S(poly([{x:.36,y:.06},{x:.64,y:.06},{x:.64,y:.30},{x:.36,y:.30},{x:.36,y:.06}]), C.ink, 6),
        S(line({x:.41,y:.14},{x:.59,y:.14}, .5), C.ink, 4),
        S(line({x:.41,y:.21},{x:.59,y:.21}, .5), C.ink, 4),
        ...[.34, .50, .66].map(x => S(line({x, y:.325},{x, y:.395}, .4), C.primary, 8, 'marker')),
      ];
    },
  },

  // ---------------------------------------------------------------- cat ----
  deskCat: {
    artist: 'KABIR', seed: 67,
    prompt: { before: 'Video calls always get interrupted by ', blank: 'the cat', after: '.' },
    title: 'THE CO-HOST CHAIR', subtitle: 'give the cat its own seat',
    build({ S, C, line, ellipse, curve, poly }) {
      return [
        S(poly([{x:.08,y:.30},{x:.52,y:.30},{x:.52,y:.63},{x:.08,y:.63},{x:.08,y:.30}]), C.ink, 8),   // laptop screen
        S(poly([{x:.05,y:.63},{x:.55,y:.63},{x:.60,y:.72},{x:.02,y:.72},{x:.05,y:.63}]), C.ink, 7),   // keyboard
        S(ellipse(.22, .43, .035, .035), C.ink, 5),                                                    // a face on the call
        S(curve([{x:.17,y:.53},{x:.22,y:.49},{x:.27,y:.53}]), C.ink, 5),
        S(line({x:.34,y:.40},{x:.46,y:.40}, .5), C.cyan, 7, 'marker'),
        S(line({x:.34,y:.47},{x:.46,y:.47}, .5), C.cyan, 7, 'marker'),
        S(poly([{x:.62,y:.72},{x:.92,y:.72},{x:.92,y:.90},{x:.62,y:.90},{x:.62,y:.72}]), C.ink, 7),    // the cat's stool
        S(ellipse(.77, .50, .115, .105), C.ink, 8),                                                    // cat head
        S(poly([{x:.685,y:.435},{x:.665,y:.335},{x:.755,y:.395}]), C.ink, 7),                          // ears
        S(poly([{x:.855,y:.435},{x:.875,y:.335},{x:.785,y:.395}]), C.ink, 7),
        S(ellipse(.735, .485, .014, .016), C.ink, 6),                                                  // eyes
        S(ellipse(.805, .485, .014, .016), C.ink, 6),
        S(poly([{x:.756,y:.545},{x:.784,y:.545},{x:.770,y:.566}]), C.pink, 8, 'marker'),               // nose
        ...[[.640,.520],[.640,.545],[.900,.520],[.900,.545]].map(([x,y]) =>
          S(line({x: x < .7 ? .705 : .835, y: y - .01},{x, y}, .4), C.ink, 4)),                         // whiskers
        S(curve([{x:.665,y:.595},{x:.660,y:.72},{x:.880,y:.72},{x:.875,y:.595}]), C.ink, 7),           // body
        S(curve([{x:.885,y:.70},{x:.955,y:.655},{x:.960,y:.565},{x:.915,y:.548}]), C.ink, 7),          // tail
      ];
    },
  },

  // ---------------------------------------------------------- headphones ----
  knotCutter: {
    artist: 'NEHA', seed: 71,
    prompt: { before: 'Tangled headphones always lead to ', blank: 'a worse morning', after: '.' },
    title: 'THE KNOT CUTTER', subtitle: 'one snip and you are free',
    build({ S, C, line, ellipse, curve, poly }) {
      return [
        // one continuous mess, which is the only honest way to draw a tangle
        S(curve([{x:.16,y:.30},{x:.40,y:.22},{x:.30,y:.45},{x:.55,y:.38},{x:.38,y:.58},
                 {x:.62,y:.55},{x:.44,y:.72},{x:.66,y:.70},{x:.52,y:.84}]), C.ink, 8),
        S(curve([{x:.22,y:.44},{x:.46,y:.33},{x:.34,y:.64},{x:.60,y:.62}]), C.ink, 6),
        S(ellipse(.14, .27, .045, .045), C.ink, 7),                        // earbuds
        S(ellipse(.55, .88, .045, .045), C.ink, 7),
        S(ellipse(.14, .27, .018, .018), C.cyan, 7, 'marker'),
        S(ellipse(.55, .88, .018, .018), C.cyan, 7, 'marker'),
        S(line({x:.66,y:.30},{x:.90,y:.52}), C.ink, 8),                    // the scissors
        S(line({x:.66,y:.52},{x:.90,y:.30}), C.ink, 8),
        S(ellipse(.925, .565, .050, .040), C.pink, 8, 'marker'),
        S(ellipse(.925, .255, .050, .040), C.pink, 8, 'marker'),
        S(ellipse(.755, .41, .016, .016), C.ink, 6),                       // the pivot
        ...[1.0, 1.9, 2.8].map(a =>
          S(line({x:.60+Math.cos(a)*.05,y:.41+Math.sin(a)*.05},
                 {x:.60+Math.cos(a)*.10,y:.41+Math.sin(a)*.10}, .4), C.primary, 8, 'marker')),
      ];
    },
  },

  // ------------------------------------------------------------ winter ----
  toastyMitt: {
    artist: 'OMAR', seed: 83,
    prompt: { before: 'Every winter comes with the exact same problem: ', blank: 'cold hands', after: '.' },
    title: 'THE TOASTY MITT', subtitle: 'a mitten with its own weather',
    build({ S, C, line, curve, poly }) {
      const s = [];
      s.push(S(curve([{x:.34,y:.86},{x:.30,y:.60},{x:.34,y:.40},{x:.48,y:.32},{x:.62,y:.40},
                      {x:.66,y:.60},{x:.64,y:.86},{x:.34,y:.86}]), C.ink, 8));            // the mitten
      s.push(S(curve([{x:.31,y:.58},{x:.22,y:.56},{x:.18,y:.66},{x:.26,y:.72},{x:.32,y:.68}]), C.ink, 7)); // thumb
      s.push(S(line({x:.325,y:.795},{x:.655,y:.795}), C.ink, 7));                          // cuff
      for (let i = 0; i < 7; i++) {                                                        // wool
        const yy = .40 + i * .054;
        const half = .165 * Math.sqrt(Math.max(0, 1 - Math.pow((yy - .60) / .30, 2))) * .95;
        s.push(S(line({x:.49 - half, y: yy},{x:.49 + half, y: yy}, .3), C.pink, 7, 'marker'));
      }
      for (const x of [.40, .49, .58])                                                     // heat coming off it
        s.push(S(curve([{x, y:.26},{x: x + .035, y:.20},{x: x - .025, y:.14},{x: x + .02, y:.08}]), C.primary, 8, 'marker'));
      s.push(S(poly([{x:.44,y:.66},{x:.50,y:.54},{x:.50,y:.62},{x:.56,y:.56},{x:.53,y:.70},{x:.44,y:.66}]), C.primary, 7, 'marker'));
      return s;
    },
  },

  // ------------------------------------------------------------ summer ----
  zapHat: {
    artist: 'PRIYA', seed: 97,
    prompt: { before: "Summer would be perfect if it weren't for ", blank: 'mosquitoes', after: '.' },
    title: 'THE ZAP HAT', subtitle: 'they only try it once',
    build({ S, C, line, arc, ellipse, curve, poly }) {
      return [
        S(ellipse(.50, .74, .34, .075), C.ink, 8),                                   // brim
        S(curve([{x:.255,y:.735},{x:.29,y:.46},{x:.40,y:.37},{x:.60,y:.37},{x:.71,y:.46},{x:.745,y:.735}]), C.ink, 8),
        S(line({x:.268,y:.645},{x:.732,y:.645}), C.pink, 9, 'marker'),               // hat band
        S(poly([{x:.49,y:.36},{x:.42,y:.20},{x:.50,y:.20},{x:.44,y:.05},
                {x:.60,y:.22},{x:.52,y:.22},{x:.57,y:.34}]), C.primary, 8, 'marker'),// the bolt
        S(ellipse(.845, .275, .050, .030), C.ink, 6),                                // the mosquito
        S(ellipse(.905, .265, .020, .016), C.ink, 6),
        S(curve([{x:.835,y:.245},{x:.800,y:.175},{x:.855,y:.205}]), C.ink, 5),
        S(curve([{x:.860,y:.245},{x:.885,y:.170},{x:.895,y:.215}]), C.ink, 5),
        S(line({x:.830,y:.300},{x:.810,y:.345}), C.ink, 4),
        S(line({x:.860,y:.302},{x:.870,y:.350}), C.ink, 4),
        S(line({x:.775,y:.205},{x:.920,y:.345}), C.pink, 9, 'marker'),               // nope
        S(line({x:.920,y:.205},{x:.775,y:.345}), C.pink, 9, 'marker'),
      ];
    },
  },
};

/** The order the gallery runs through them. */
const GALLERY_ORDER = [
  'pupBrella', 'smashOMatic', 'deskCat', 'inkGeyser', 'toastyMitt',
  'snoozeMitt', 'shredderSmile', 'zapHat', 'paperPigeon', 'knotCutter',
];

/** Strokes for one invention, with the pen seeded so it comes out the same
 *  every run and in every film it appears in. */
function buildDrawing(key) {
  const d = DRAWINGS[key];
  rand = rng(d.seed);
  return d.build({ S, C, line, arc, ellipse, curve, poly, coilBetween, wobble });
}
