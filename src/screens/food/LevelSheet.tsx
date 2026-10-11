/**
 * "Log what you eat?" (journey §11.1, §11.5, K-22): meal ideas only, meals
 * with no numbers, or estimates. Before estimates are stored, "Has food or
 * weight ever been hard for you?" is asked once, and the answer is kept where
 * setup keeps it (board D102). "Yes" or "Prefer not to say" recommends meals
 * only, and estimates stay one tap away.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { FOOD_COPY } from '@/food/copy';
import { afterScreening, foodLevel, type FoodLevel, type ScreenAnswer } from '@/food/level';
import { ErrorText, Hint, PrimaryButton, SecondaryButton } from '@/screens/track/ui';
import { ChoiceRows, type Choice } from '@/screens/you/controls';
import { changeProfile } from '@/screens/you/write';
import { useStore } from '@/store/useStore';

const LEVELS: Choice<FoodLevel>[] = [
  { value: 'ideas', label: FOOD_COPY.levelIdeas, detail: FOOD_COPY.levelIdeasDetail },
  { value: 'meals', label: FOOD_COPY.levelMeals, detail: FOOD_COPY.levelMealsDetail },
  { value: 'estimates', label: FOOD_COPY.levelEstimates, detail: FOOD_COPY.levelEstimatesDetail },
];

export function LevelSheet({ open, onOpenChange, onDone }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After the level is stored. Without it, the sheet closes. */
  onDone?: (level: FoodLevel) => void;
}) {
  const { profile } = useStore();
  const food = profile?.food;
  const [page, setPage] = useState<'choose' | 'screen' | 'suggest'>('choose');
  const [answer, setAnswer] = useState<ScreenAnswer | undefined>(food?.hardBefore);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  // Each opening starts on the choice: reset while rendering, as Quick Log does.
  const [was, setWas] = useState(open);
  if (open !== was) {
    setWas(open);
    if (open) {
      setPage('choose');
      setError(undefined);
      setAnswer(food?.hardBefore);
    }
  }

  const store = async (level: FoodLevel, hardBefore?: ScreenAnswer) => {
    if (saving) return;
    setSaving(true);
    const result = await changeProfile(p => (p.food ? { ...p, food: { ...p.food, level, ...(hardBefore ? { hardBefore } : {}) } } : p));
    setSaving(false);
    if (!result.ok) {
      setError(`${FOOD_COPY.didNotSave} ${result.failure.message}`);
      return;
    }
    if (onDone) onDone(level);
    else onOpenChange(false);
  };
  const pick = (level: FoodLevel) => {
    if (level !== 'estimates') void store(level);
    else if (answer === undefined) setPage('screen');
    else if (afterScreening(answer).recommended === 'estimates') void store('estimates');
    else setPage('suggest');
  };
  const answerWith = (a: ScreenAnswer) => {
    setAnswer(a);
    if (afterScreening(a).recommended === 'estimates') void store('estimates', a);
    else setPage('suggest');
  };

  return (
    <Sheet open={open} onOpenChange={next => { if (!saving) onOpenChange(next); }} title={FOOD_COPY.levelTitle} detent="medium" dismissible={!saving}>
      {!food ? (
        <Group>
          <Row as={Link} to="/hub/food/ideas" label={FOOD_COPY.chooseFood} detail={FOOD_COPY.chooseFoodDetail} chevron />
        </Group>
      ) : page === 'choose' ? (
        <Group>
          <ChoiceRows label={FOOD_COPY.levelTitle} options={LEVELS} value={foodLevel(food)} onChange={pick} />
        </Group>
      ) : page === 'screen' ? (
        <div className="flex flex-col gap-3">
          <p className="px-1 text-[length:var(--text-body)] font-semibold">{FOOD_COPY.screenQuestion}</p>
          <SecondaryButton onClick={() => answerWith('yes')} disabled={saving}>{FOOD_COPY.screenYes}</SecondaryButton>
          <SecondaryButton onClick={() => answerWith('no')} disabled={saving}>{FOOD_COPY.screenNo}</SecondaryButton>
          <SecondaryButton onClick={() => answerWith('preferNot')} disabled={saving}>{FOOD_COPY.screenPreferNot}</SecondaryButton>
          <Hint>{FOOD_COPY.screenNote}</Hint>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="px-1 text-[length:var(--text-body)] font-semibold">{FOOD_COPY.suggestTitle}</p>
          <PrimaryButton onClick={() => void store('meals', answer)} disabled={saving}>{FOOD_COPY.suggestMeals}</PrimaryButton>
          <SecondaryButton onClick={() => void store('estimates', answer)} disabled={saving}>{FOOD_COPY.suggestEstimates}</SecondaryButton>
        </div>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </Sheet>
  );
}
