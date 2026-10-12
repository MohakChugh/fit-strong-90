import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LibraryIcon, SearchIcon, UtensilsIcon, XIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { YouButton } from '@/components/hig/AppShell';
import { DISCLAIMER, search, topicsFor, type ResultKind, type SearchResult } from '@/content';
import { onlyPartial, partialDetail } from './format';
import { TOPIC_ICON } from './icons';
import { useGuide } from './useGuide';

const KIND_HEADER: Record<ResultKind, string> = { topic: 'Topics', card: 'Answers', meal: 'Meal ideas' };

/**
 * Guide: a search field and the topics, nothing else. Topics that matter to
 * this person lead under "For you", each with the answer that put it there.
 */
export default function GuideScreen() {
  const { ctx } = useGuide();
  const [params, setParams] = useSearchParams();
  // The field owns what is typed; the address keeps it, so Back from a result
  // and a reload both return to the same search.
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => (query.trim() ? search(query, ctx) : undefined), [query, ctx]);
  const { forYou, more } = useMemo(() => topicsFor(ctx), [ctx]);

  const change = (value: string) => {
    setQuery(value);
    setParams(value ? { q: value } : {}, { replace: true, preventScrollReset: true });
  };

  return (
    <Screen title="Guide" trailing={<YouButton />}>
      <form
        role="search"
        onSubmit={e => {
          e.preventDefault();
          input.current?.blur();
        }}
        className="relative -mt-2"
      >
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={input}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Search Guide"
          placeholder="Search foods and topics"
          value={query}
          onChange={e => change(e.target.value)}
          className="h-11 w-full rounded-xl bg-grouped-card pl-10 pr-11 text-[length:var(--text-body)] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tint/50 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              change('');
              input.current?.focus();
            }}
            className="absolute right-0 top-0 flex size-11 items-center justify-center text-muted-foreground"
          >
            <XIcon className="size-5" aria-hidden />
          </button>
        )}
      </form>

      {results ? (
        <Results query={query} results={results} />
      ) : (
        <>
          {forYou.length > 0 && (
            <Group header="For you">
              {forYou.map(({ topic, because }) => (
                <TopicRow key={topic.id} id={topic.id} title={topic.title} detail={because} />
              ))}
            </Group>
          )}
          <Group header={forYou.length > 0 ? 'More topics' : 'Topics'}>
            {more.map(topic => <TopicRow key={topic.id} id={topic.id} title={topic.title} detail={topic.summary} />)}
          </Group>
          <Group footer={DISCLAIMER}>
            <Row
              as={Link}
              to="/guide/meals"
              viewTransition
              icon={<UtensilsIcon aria-hidden />}
              label="Meal ideas"
              detail="A sample week of Indian meals to adapt"
              chevron
            />
            <Row
              as={Link}
              to="/guide/sources"
              viewTransition
              icon={<LibraryIcon aria-hidden />}
              label="Sources"
              detail="The guidelines behind every answer"
              chevron
            />
          </Group>
        </>
      )}
    </Screen>
  );
}

function TopicRow({ id, title, detail }: { id: keyof typeof TOPIC_ICON; title: string; detail: string }) {
  const Icon = TOPIC_ICON[id];
  return (
    <Row
      as={Link}
      to={`/guide/topic/${id}`}
      viewTransition
      icon={<Icon aria-hidden />}
      label={title}
      detail={detail}
      chevron
    />
  );
}

function Results({ query, results }: { query: string; results: SearchResult[] }) {
  const groups = (['topic', 'card', 'meal'] as const)
    .map(kind => ({ kind, items: results.filter(r => r.kind === kind) }))
    .filter(g => g.items.length > 0);
  // Nothing matches every word: say so, and say what each result does match,
  // rather than passing a partial match off as the answer (Codex content audit F22).
  const partial = onlyPartial(results);

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {results.length === 0 ? 'No results' : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}
      </p>
      {results.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-[length:var(--text-body)] font-semibold">No results for “{query.trim()}”</p>
          <p className="mt-1 text-[length:var(--text-subhead)] text-muted-foreground">
            Try a food such as dal or roti, or a topic such as sleep. Guide reads English letters and Hindi in Devanagari.
          </p>
        </div>
      ) : (
        <>
          {partial && (
            <p className="px-4 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
              No answer covers every word you typed. These match some of them.
            </p>
          )}
          {groups.map(({ kind, items }) => (
            <Group key={kind} header={KIND_HEADER[kind]}>
              {items.map(r => (
                <Row
                  key={`${r.kind}-${r.id}`}
                  as={Link}
                  to={r.to}
                  state={{ from: 'search' }}
                  viewTransition
                  label={r.title}
                  detail={partial ? partialDetail(r) : r.detail}
                  chevron
                />
              ))}
            </Group>
          ))}
        </>
      )}
    </>
  );
}
