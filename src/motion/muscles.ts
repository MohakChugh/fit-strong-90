/** Maps the coaching text's muscle names onto the character's muscle regions. */

import type { MuscleName } from './types';

/** First match wins, so specific phrases come before general ones. */
const RULES: [RegExp, MuscleName[]][] = [
  [/sciatic nerve/, ['glutes', 'hamstrings', 'calves']],
  [/gluteus medius|side hip|outer hip/, ['gluteMed']],
  [/piriformis|deep hip rotators|gluteus maximus|glute/, ['glutes']],
  [/hip flexor/, ['hipFlexors']],
  [/inner thigh|adductor|gracilis/, ['adductors']],
  [/hamstring/, ['hamstrings']],
  [/front thigh|quadricep/, ['quads']],
  [/^thighs?$/, ['quads', 'hamstrings']],
  [/calf|calves|achilles|ankle stabilis/, ['calves']],
  [/shin/, ['shins']],
  [/quadratus lumborum|deep side muscles of the lower back/, ['lowerBack', 'obliques']],
  [/lower back|muscles along the spine|back muscles$/, ['lowerBack']],
  [/lat|behind the armpit/, ['lats']],
  [/rhomboid|between the shoulder blades|middle trapezius|middle and lower trapezius|lower trapezius|mid back|upper and mid back|shoulder-blade/, ['upperBack']],
  [/upper trapezius|levator|side neck/, ['traps', 'neck']],
  [/neck|base of the skull/, ['neck']],
  [/upper back/, ['upperBack', 'traps']],
  [/rear shoulder|back of the shoulder/, ['deltsRear']],
  [/side shoulder/, ['deltsSide']],
  [/front shoulder|front of the shoulder/, ['deltsFront']],
  [/rotator cuff|shoulder stabilis/, ['deltsRear', 'upperBack']],
  [/^shoulders$/, ['deltsFront', 'deltsSide', 'deltsRear']],
  [/upper chest|chest|serratus|chest wall|between the ribs/, ['chest']],
  [/oblique/, ['obliques']],
  [/diaphragm|deep core|deep abdominal|pelvic floor|core/, ['abs', 'obliques']],
  [/abs|abdominal/, ['abs']],
  [/biceps|brachialis/, ['biceps']],
  [/triceps/, ['triceps']],
  [/forearm|grip|wrist|finger/, ['forearms']],
  [/^arms$/, ['biceps', 'triceps']],
];

export function musclesFor(names: string[]): MuscleName[] {
  const out = new Set<MuscleName>();
  for (const raw of names) {
    const n = raw.toLowerCase().trim();
    const rule = RULES.find(([re]) => re.test(n));
    rule?.[1].forEach(m => out.add(m));
  }
  return [...out];
}
