/**
 * Me → Food → "Your own foods" (board D111, K7-11): the foods the person
 * added while logging. Edit makes a new version of a food's definition, for
 * the meals logged from then on; Delete removes it at once, with Undo, kept
 * in Recently deleted for 7 days. Each meal keeps the food as it was when it
 * was logged, so neither changes a meal already logged. Words only in the
 * list: a food's portion, never a figure (B-11).
 */
import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { Sheet } from '@/components/hig/Sheet';
import { useSaveHold } from '@/components/hig/useSaveHold';
import { allergiesOf, allergyAnswer } from '@/food/allergens';
import { numbersView } from '@/food/level';
import { customFoodsIn } from '@/food/records';
import { editOwnFood } from '@/food/store';
import type { CustomFood } from '@/food/types';
import { OwnFoodPage } from '@/screens/food/parts';
import { deleteOwnFoodWithUndo } from '@/screens/food/undo';
import { useSetupSession } from '@/setup/draft';
import { useStore } from '@/store/useStore';

const HERE = '/me/food/own';

export function OwnFoodsScreen() {
  const { records, profile, settings } = useStore();
  const foods = customFoodsIn(records);
  const numbers = numbersView(profile);
  // The person's allergies, as the meal sheet reads them, so the page names each one a food leaves unticked.
  const allergies = allergiesOf(allergyAnswer(profile?.food, settings.setup, useSetupSession()));
  const [editing, setEditing] = useState<CustomFood>();
  const [problem, setProblem] = useState<string>();
  // An edit being written: the sheet, and a Back, wait for it, so a refusal finds the draft still there (B-03, §4.5;
  // codex F-food-04).
  const [saving, setSaving] = useState(false);
  const settle = useSaveHold(saving);

  const remove = async (f: CustomFood) => {
    setProblem(undefined);
    const why = await deleteOwnFoodWithUndo(f, HERE);
    if (why) setProblem(`${f.name} was not deleted: ${why}`);
  };
  const save = async (edited: CustomFood) => {
    if (saving) return;
    setSaving(true);
    const result = await editOwnFood(edited);
    setSaving(false);
    settle(result.ok);
    if (!result.ok) return setProblem(`${edited.name} was not changed: ${result.failure.message}`);
    setEditing(undefined);
  };

  return (
    <Screen title="Your own foods" back={{ to: '/me/food', label: 'Food' }}>
      <Group footer="Foods you added while logging a meal. Each meal keeps a food as it was when you logged it, so changing or deleting one here changes no meal you’ve logged.">
        {foods.length === 0 && <Row label="No foods of your own yet" />}
        {foods.map(f => (
          <Row
            key={f.id}
            label={f.name}
            detail={`One portion: ${f.per.qty.toLocaleString('en-IN')} ${f.per.unit}`}
            accessory={(
              <div className="flex min-w-0 flex-wrap justify-end gap-3">
                <button type="button" aria-label={`Edit ${f.name}`} onClick={() => { setProblem(undefined); setEditing(f); }}
                  className="press-feedback min-h-12 rounded-full px-4 text-[length:var(--text-body)] font-semibold text-tint">
                  Edit
                </button>
                <button type="button" aria-label={`Delete ${f.name}`} onClick={() => void remove(f)}
                  className="press-feedback min-h-12 rounded-full px-4 text-[length:var(--text-body)] font-semibold text-stop">
                  Delete
                </button>
              </div>
            )}
          />
        ))}
      </Group>
      {problem && <p role="alert" className="px-4 text-[length:var(--text-subhead)] text-stop">{problem}</p>}
      <Sheet open={editing !== undefined} onOpenChange={open => { if (!open && !saving) setEditing(undefined); }} dismissible={!saving} title="Edit your food" detent="large">
        {editing && <OwnFoodPage name={editing.name} food={editing} numbers={numbers} allergies={allergies} action="Save changes" onAdd={edited => void save(edited)} />}
      </Sheet>
    </Screen>
  );
}
