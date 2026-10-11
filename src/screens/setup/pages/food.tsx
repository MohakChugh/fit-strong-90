import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { PATTERN_DETAIL, PATTERN_LABEL, type Pattern } from '@/content';
import { parseAvoid } from '@/screens/guide/format';
import { CheckRows } from '@/screens/you/controls';
import { ALLERGY_CHIPS } from '@/setup/allergies';
import { ownAllergiesProblem } from '@/setup/limits';
import type { AllergenId } from '@/types/profile';
import { Ask, Missing, TextInput, type PageProps } from '../controls';

const PATTERNS: Pattern[] = ['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan', 'jain'];

/**
 * How the person eats, and their allergies (journey §6.2 ch. 7; board D82):
 * the chips store canonical ids in `allergies`, "Something else" the
 * person's own words in `customAllergies`, and "No food allergies" an empty
 * list. The two are one answer: given either way, `allergies` is set.
 */
export function FoodHowYouEat({ a, set, tried }: PageProps) {
  const chips = a.allergies ?? [];
  const [other, setOther] = useState(() => (a.customAllergies ?? []).join(', '));
  const write = (ids: AllergenId[], typed: string) => {
    const words = parseAvoid(typed);
    // Nothing ticked and nothing typed is no answer yet, never "No food allergies".
    set({ allergies: ids.length > 0 || words.length > 0 ? ids : undefined, customAllergies: words.length > 0 ? words : undefined });
  };
  const none = a.allergies !== undefined && a.allergies.length === 0 && !(a.customAllergies?.length);
  return (
    <>
      <Ask label="How do you eat?" tried={tried} value={a.pattern} onChange={pattern => set({ pattern })}
        options={PATTERNS.map(p => ({ value: p, label: PATTERN_LABEL[p], detail: PATTERN_DETAIL[p] }))} />
      <Group header="Allergies" footer="Meal ideas leave out anything with these. A food you’ve already eaten can still be logged.">
        <CheckRows label="Allergies" options={ALLERGY_CHIPS} value={chips} onChange={ids => write(ids, other)} />
        <TextInput label="Something else you’re allergic to (optional)" text={other} placeholder="For example: brinjal, kiwi"
          onText={t => { setOther(t); write(chips, t); }} />
      </Group>
      <Group>
        <CheckRows label="No food allergies" options={[{ value: 'none', label: 'No food allergies' }]} value={none ? ['none'] : []}
          onChange={v => { setOther(''); set({ allergies: v.length > 0 ? [] : undefined, customAllergies: undefined }); }} />
      </Group>
      <Missing show={tried && ownAllergiesProblem(a.customAllergies) !== null}>{ownAllergiesProblem(a.customAllergies) ?? ''}</Missing>
      <Missing show={tried && a.allergies === undefined}>Tick your allergies, or “No food allergies”.</Missing>
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
    </>
  );
}
