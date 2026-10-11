/**
 * Your usual meals (journey §11.2's Options): each one opens "Log a meal"
 * filled in, and Remove goes at once, with Undo (B-04, B-05).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { FOOD_COPY } from '@/food/copy';
import { itemsLine } from '@/food/format';
import { logHref } from '@/food/links';
import { savedMealsIn } from '@/food/records';
import { deleteUsual, restoreUsual } from '@/food/store';
import type { SavedMeal } from '@/food/types';
import { Notice } from '@/screens/you/controls';
import { useStore } from '@/store/useStore';
import { RoughCarbs } from './RoughCarbs';
import { offerFoodUndo, useFoodUndoScope } from './undo';

export default function UsualMealsScreen() {
  const { records } = useStore();
  const [error, setError] = useState<string>();
  useFoodUndoScope('/hub/food/usual');
  const saved = [...savedMealsIn(records)].sort((a, b) => a.name.localeCompare(b.name));

  const remove = async (u: SavedMeal) => {
    const result = await deleteUsual(u.id);
    if (!result.ok) {
      setError(`${FOOD_COPY.didNotSave} ${result.failure.message}`);
      return;
    }
    setError(undefined);
    offerFoodUndo({
      text: FOOD_COPY.removed(u.name),
      restored: FOOD_COPY.restored(u.name),
      scope: '/hub/food/usual',
      undo: async () => {
        const back = await restoreUsual(u);
        return back.ok ? undefined : back.failure.message;
      },
    });
  };

  return (
    <Screen title={FOOD_COPY.usualTitle} back={{ to: '/hub/food', label: 'Food' }}>
      <RoughCarbs />
      <Group {...(saved.length === 0 ? { footer: FOOD_COPY.noUsual } : {})}>
        {saved.map(u => (
          // "Remove" in words, 48 px and 12 px from the row; below it in a narrow container (§20.4 rules 1, 2; board D141).
          <div key={u.id} className="@container">
            <div className="flex items-center gap-3 pr-3 @max-[22rem]:flex-col @max-[22rem]:items-stretch @max-[22rem]:gap-3 @max-[22rem]:pb-2 @max-[22rem]:pl-4">
              <Row as={Link} to={logHref({ usual: `saved:${u.id}` })} label={u.name} detail={itemsLine(u.items)} chevron className="min-w-0 flex-1 @max-[22rem]:-ml-4" />
              <button
                type="button"
                aria-label={FOOD_COPY.usualRemove(u.name)}
                onClick={() => void remove(u)}
                className="press-feedback flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full px-3 text-[length:var(--text-body)] font-medium text-stop @max-[22rem]:self-start"
              >
                {FOOD_COPY.remove}
              </button>
            </div>
          </div>
        ))}
      </Group>
      {error && <Notice tone="error">{error}</Notice>}
    </Screen>
  );
}
