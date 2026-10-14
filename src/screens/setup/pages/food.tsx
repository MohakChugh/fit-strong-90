import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { PATTERN_DETAIL, PATTERN_LABEL, type Pattern } from '@/content';

import { CheckRows } from '@/screens/you/controls';
import { ALLERGY_CHIPS } from '@/setup/allergies';
import { ownTextProblem, parseAvoid, typedMax } from '@/setup/limits';
import type { AllergenId } from '@/types/profile';
import { Ask, Missing, TextInput, type PageProps } from '../controls';

const PATTERNS: Pattern[] = ['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan', 'jain'];

/** How the person eats (journey §6.2 ch. 7; board D82): a preference, so it may be skipped. */
export function FoodHowYouEat({ a, set, tried }: PageProps) {
  return (
    <Ask label="How do you eat?" tried={tried} value={a.pattern} onChange={pattern => set({ pattern })}
      options={PATTERNS.map(p => ({ value: p, label: PATTERN_LABEL[p], detail: PATTERN_DETAIL[p] }))} />
  );
}

/**
 * Their allergies, a page of its own that is never skipped: meal ideas leave
 * these out (§11.5; K5-08, board D150). The chips store canonical ids in
 * `allergies`, "Something else" the person's own words in
 * `customAllergies`, and "No food allergies" an empty list. The two are one
 * answer: given either way, `allergies` is set.
 */
export function FoodAllergies({ a, raw, set, tried }: PageProps) {
  const chips = a.allergies ?? [];
  // As typed, the commas included; kept in the draft only while it isn't an answer (H5-18). Changed elsewhere, in
  // another window or by a restore, the field shows it as it is now (H5R-03).
  const shown = raw.customAllergies ?? (a.customAllergies ?? []).join(', ');
  const [other, setOther] = useState(shown);
  // What this field last wrote, as the answers show it: anything else came from elsewhere.
  const [mine, setMine] = useState(shown);
  if (shown !== mine) {
    setMine(shown);
    setOther(shown);
  }
  // Nothing ticked and nothing typed is no answer yet, never "No food allergies".
  const answered = (ids: AllergenId[], words: number) => (ids.length > 0 || words > 0 ? ids : undefined);
  const type = (typed: string) => {
    setOther(typed);
    const words = parseAvoid(typed);
    // More, or longer, than a backup holds: the text waits as typed, the page says why, and the answers stay as they
    // were, every exclusion in them, while the whole answer reads as not known (H5-18, H5F-08; board D222).
    if (ownTextProblem(typed) !== null) {
      setMine(typed);
      set({}, { customAllergies: typed });
      return;
    }
    setMine(words.join(', '));
    set({ allergies: answered(chips, words.length), customAllergies: words.length > 0 ? words : undefined }, { customAllergies: '' });
  };
  const problem = ownTextProblem(other);
  const none = a.allergies !== undefined && a.allergies.length === 0 && !(a.customAllergies?.length);
  return (
    <>
      <Group header="Allergies" footer="Meal ideas leave out anything with these. A food you’ve already eaten can still be logged.">
        {/* A chip is the chips' answer alone: the own words stay as they are (H5R-03). */}
        <CheckRows label="Allergies" options={ALLERGY_CHIPS} value={chips} onChange={ids => set({ allergies: answered(ids, a.customAllergies?.length ?? 0) })} />
        <TextInput label="Something else you’re allergic to (optional)" text={other} placeholder="For example: brinjal, kiwi" maxLength={typedMax('customAllergies')}
          onText={type} />
      </Group>
      <Group>
        <CheckRows label="No food allergies" options={[{ value: 'none', label: 'No food allergies' }]} value={none ? ['none'] : []}
          onChange={v => {
            setOther('');
            setMine('');
            set({ allergies: v.length > 0 ? [] : undefined, customAllergies: undefined }, { customAllergies: '' });
          }} />
      </Group>
      <Missing show={tried && problem !== null}>{problem ?? ''}</Missing>
      <Missing show={tried && problem === null && a.allergies === undefined}>Tick your allergies, or “No food allergies”.</Missing>
    </>
  );
}

type Level = 'ideas' | 'meals' | 'estimates';
type Screen = 'yes' | 'no' | 'preferNot';

/**
 * The logging level (journey §6.2 ch. 7, §11.1). Before estimates are
 * stored, "Has food or weight ever been hard for you?" is asked (K-22),
 * unless it was answered before: the answer is kept, on this device, as
 * `food.hardBefore` (board D82, Plan 7's D102). "Yes" or "Prefer not to say"
 * recommends meals only each time estimates are chosen, and estimates stay
 * one tap away.
 */
export function FoodLogging({ a, set, tried }: PageProps) {
  const [opened] = useState(a.foodLevel);
  const [picked, setPicked] = useState<Level | undefined>(a.foodLevel);
  const [askedHere, setAskedHere] = useState(false);
  // Choosing estimates afresh, or estimates kept from a build that never asked.
  const choosingEstimates = picked === 'estimates' && (opened !== 'estimates' || a.hardBefore === undefined);
  const suggest = a.hardBefore === 'yes' || a.hardBefore === 'preferNot';

  const pick = (v: Level) => {
    setPicked(v);
    const asks = v === 'estimates' && (opened !== 'estimates' || a.hardBefore === undefined);
    // Estimates are stored once the answer is "No", or "Keep estimates" is chosen after a suggestion.
    set({ foodLevel: asks && a.hardBefore !== 'no' ? undefined : v });
  };
  const answer = (s: Screen) => {
    setAskedHere(true);
    set({ hardBefore: s, foodLevel: s === 'no' ? 'estimates' : undefined });
  };

  return (
    <>
      <Ask label="Would you like to log what you eat?" tried={tried && picked === undefined} value={picked} onChange={pick}
        footer="You can change this any time in Me → Food."
        options={[
          { value: 'ideas', label: 'No, meal ideas only' },
          { value: 'meals', label: 'Yes, meals only, no numbers', ...(choosingEstimates && suggest ? { detail: 'Recommended' } : {}) },
          { value: 'estimates', label: 'Yes, with calorie and carb estimates' },
        ]} />
      {choosingEstimates && (a.hardBefore === undefined || askedHere) && (
        <Ask label="Has food or weight ever been hard for you?" header="Has food or weight ever been hard for you?" tried={tried}
          value={a.hardBefore} onChange={answer} footer="Your answer is kept on this phone only. It decides what we suggest when you choose estimates."
          options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'preferNot', label: 'Prefer not to say' }]} />
      )}
      {choosingEstimates && suggest && a.foodLevel === undefined && (
        <Group footer="Meals only shows no calorie or carb numbers anywhere. Estimates stay available.">
          <Row label="We suggest “Yes, meals only, no numbers”" />
          <Row onClick={() => { setPicked('meals'); set({ foodLevel: 'meals' }); }} label={<span className="text-tint">Use meals only</span>} />
          <Row onClick={() => set({ foodLevel: 'estimates' })} label={<span className="text-tint">Keep estimates</span>} />
        </Group>
      )}
      <Missing show={tried && choosingEstimates && suggest && a.foodLevel === undefined}>Choose “Use meals only” or “Keep estimates”.</Missing>
    </>
  );
}
