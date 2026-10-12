import { useContext, useMemo, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ActionMenu, type MenuAction, type MenuAnchor } from '@/components/hig/ActionMenu';
import { gateFor, opensOnHold } from '@/components/checkin/start';
import { Screen } from '@/components/hig/Screen';
import { categoryById, type CategoryId } from '@/categories';
import { FOODS } from '@/food/data';
import { numbersView } from '@/food/level';
import { useGuided } from '@/hooks/useGuided';
import { useGuide } from '@/screens/guide/useGuide';
import { changeHome, useHomeLayout } from '@/screens/home/homeLayout';
import { addButton, addTile, groupFull, hideTile, placedMessage } from '@/screens/home/layout';
import { UrgentContext } from '@/screens/home/urgent';
import { useStore } from '@/store/useStore';
import type { HomeLayout } from '@/types';
import { BrowseRows, SearchField } from './BrowseList';
import { browse } from './browse';
import { foodRows, listsFoods, withFoods } from './foods';

interface MoreTarget extends MenuAnchor {
  id: CategoryId;
}

/**
 * Browse (journey §14): search at the top; every category, grouped, with its
 * More (Add to Home or Remove from Home); the shortcuts; the Guide's topics.
 * Edit Home's pick mode has its own address here and opens over Edit Home
 * (D56).
 */
export default function BrowseScreen() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  // The field owns what is typed; the address keeps it, so Back from a result returns to the same search.
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const { ctx } = useGuide();
  const { layout, fallback } = useHomeLayout();
  const guided = useGuided();
  const urgent = useContext(UrgentContext);
  const [more, setMore] = useState<MoreTarget | null>(null);
  // An urgent decision closes the menu at once, and it stays closed (M18).
  if (urgent !== undefined && more !== null) setMore(null);
  // Polite, and said again even when the words repeat.
  const [said, setSaid] = useState({ text: '', n: 0 });
  const [problem, setProblem] = useState<string>();
  const { profile } = useStore();
  // Foods to log only for someone who logs meals, once their allergies are known as meal ideas wait for; a figure only with estimates (B-11, D115).
  const lists = listsFoods(profile?.food, ctx.allergies);
  const numbers = numbersView(profile);
  const show = numbers.show;
  const ranges = numbers.show && numbers.ranges;
  const results = useMemo(() => {
    const found = browse(query, ctx);
    return lists ? withFoods(found, foodRows(query, FOODS, show ? { show: true, ranges } : { show: false })) : found;
  }, [query, ctx, lists, show, ranges]);

  if (params.get('pick') === '1') return <Navigate to="/home?edit=add" replace />;

  const origin = { path: location.pathname, label: 'Browse', ...(location.search ? { search: location.search } : {}) };
  const change = (value: string) => {
    setQuery(value);
    setParams(value ? { q: value } : {}, { replace: true, preventScrollReset: true });
  };
  // Said once the device has stored it, as Edit Home says its changes (codex V1-11).
  const edit = (op: (layout: HomeLayout) => HomeLayout, words: (next: HomeLayout) => string) => {
    const changed = changeHome(fallback, op);
    if (!changed) return;
    void changed.saved.then(r => {
      setProblem(r.ok ? undefined : `That did not save. ${r.failure.message}`);
      if (r.ok) setSaid(s => ({ text: words(changed.next), n: s.n + 1 }));
    });
  };
  // A movement screen that opens on its refusal shows it in the first frame, asked at the tap (codex V1-05).
  const held = (id: CategoryId) => {
    const { mode } = categoryById(id);
    return mode !== undefined && opensOnHold(gateFor(guided, mode));
  };
  const menuFor = (id: CategoryId): { title: string; note?: string; actions: MenuAction[] } => {
    const { title, group } = categoryById(id);
    if (layout.order[group].includes(id)) {
      return { title, actions: [{ label: 'Remove from Home', onSelect: () => edit(l => hideTile(l, id), () => `${title} removed from Home. It is under Hidden in Edit Home.`) }] };
    }
    const add = addButton(layout, id);
    return {
      title,
      ...(add.disabled ? { note: 'Hide a tile in Edit Home to make room.' } : {}),
      actions: [{
        label: add.disabled ? add.label : 'Add to Home',
        disabled: add.disabled,
        // Another copy of the app may have filled the group meanwhile: then nothing changes.
        onSelect: () => edit(l => (groupFull(l, group) || l.order[group].includes(id) ? l : addTile(l, id)), next => placedMessage(next, id, 'added')),
      }],
    };
  };

  return (
    <Screen title="Browse">
      <SearchField value={query} onChange={change} />
      {results.partial && (
        <p className="px-4 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">Nothing matches every word you typed. These match some of them.</p>
      )}
      <BrowseRows results={results} origin={origin} held={held} onMore={(id, button) => setMore({ id, anchor: button, opener: button })} />
      <p role="status" className="px-2 pt-4 text-center text-[length:var(--text-body)] text-muted-foreground empty:hidden">
        {results.groups.length === 0 ? `Nothing matches “${query.trim()}”. Try another word, such as roti or walk.` : ''}
      </p>
      {problem && <p role="alert" className="px-4 text-[length:var(--text-subhead)] leading-snug text-stop">{problem}</p>}
      <p role="status" className="sr-only">{said.text}{said.n % 2 ? '\u200b' : ''}</p>
      <ActionMenu target={more} describe={({ id }) => menuFor(id)} onClose={() => setMore(null)} />
    </Screen>
  );
}
