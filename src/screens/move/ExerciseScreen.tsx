import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ExternalLinkIcon } from 'lucide-react';
import { Screen } from '@/components/hig/Screen';
import { Group, Row } from '@/components/hig/List';
import { FormDemo } from '@/components/motion/FormDemo';
import { getExerciseById } from '@/data/exercises';
import { getMeta, nameOf } from '@/data/catalog';
import { getCoaching } from '@/data/coaching';
import { Wrap } from './controls';
import { backNote, doseLine, libraryReturn, relatedExercises } from './library';

const youtube = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

/** A web address as its site, which is what a person recognises. */
function siteOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function Prose({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-body)] leading-relaxed">{children}</div>;
}

/**
 * Lines of text inside a group's card that wrap rather than truncate: a cue
 * or a mistake cut short by an ellipsis is advice lost.
 */
function Lines({ items }: { items: { key: string; title?: string; text: string }[] }) {
  return (
    <ul className="[&>*+*]:border-t [&>*+*]:border-separator">
      {items.map(i => (
        <li key={i.key} className="px-4 py-3 leading-snug">
          {i.title && <p className="text-[length:var(--text-body)] font-medium">{i.title}</p>}
          <p className={i.title ? 'text-[length:var(--text-subhead)] text-muted-foreground' : 'text-[length:var(--text-body)]'}>{i.text}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * One exercise (codex-vision §4, Exercise Detail): the 3D demo, which plays by
 * itself as soon as it is on screen, then how to do it, the cues, the common
 * mistakes, how to make it suit the back, and where the advice comes from.
 */
export function ExerciseScreen() {
  const { id = '' } = useParams();
  const location = useLocation();
  // Back to the list this was opened from, search and filters included; the
  // whole library for a direct link. A related exercise is handed the same
  // list, and names this exercise as its opener, so its Back returns here
  // rather than skipping to the list (scan S-11).
  const origin = libraryReturn(location.state);
  const back = { to: origin, label: 'Exercises' };
  const ex = getExerciseById(id);
  const meta = getMeta(id);
  const c = getCoaching(id);

  if (!ex || !meta) {
    return (
      <Screen title="Not found" back={back}>
        <Prose>That exercise is not in the library. It may have been renamed.</Prose>
        <Group>
          <Row as={Link} to={origin} label={<Wrap>Find an exercise</Wrap>} chevron />
        </Group>
      </Screen>
    );
  }

  const related = relatedExercises(id);
  const note = backNote(id);

  return (
    <Screen title={ex.name} back={back}>
      <div className="flex flex-col gap-3">
        <FormDemo exerciseId={id} className="h-64 [@media(max-height:640px)]:h-48" />
        <p className="px-4 text-[length:var(--text-subhead)] text-muted-foreground">
          {doseLine(meta)}{ex.equipment ? ` · ${ex.equipment}` : ''}
        </p>
      </div>

      {!c ? (
        <Prose>This one is no longer used in plans. It stays here so your history keeps its name.</Prose>
      ) : (
        <>
          <Prose>{c.summary}</Prose>

          <Group header="How to do it">
            <ol className="list-decimal space-y-2 py-3 pl-9 pr-4 text-[length:var(--text-body)] leading-snug marker:text-muted-foreground">
              {c.steps.map(s => <li key={s}>{s}</li>)}
            </ol>
          </Group>

          {c.cues.length > 0 && (
            <Group header="Cues">
              <Lines items={c.cues.map(cue => ({ key: cue, text: cue }))} />
            </Group>
          )}

          <Group header="As you do it">
            <Row label={<Wrap>Breathing</Wrap>} detail={c.breathing} />
            <Row label={<Wrap>Where you feel it</Wrap>} detail={c.feel} />
            <Row label={<span className="whitespace-normal text-stop">Stop if</span>} detail={c.shouldNotFeel} />
          </Group>

          {c.mistakes.length > 0 && (
            <Group header="Common mistakes" footer="The demo above can show each one, in red.">
              <Lines items={c.mistakes.map(m => ({ key: m.clip, title: m.mistake, text: `${m.risk} ${m.fix}` }))} />
            </Group>
          )}

          <Group header="Modifications" footer="General information, not medical advice.">
            <Row label={<Wrap>{note ?? 'Suits most backs'}</Wrap>} detail={c.backSafety.note} />
            {related.map(r => (
              <Row key={r.label} as={Link} to={`/move/exercises/${r.id}`} state={{ from: origin, path: location.pathname, label: ex.name }} viewTransition label={<Wrap>{r.label}</Wrap>} detail={nameOf(r.id)} chevron />
            ))}
          </Group>

          <Group header="Why it is in the plan">
            <Lines items={[{ key: 'why', text: c.why }]} />
          </Group>

          <Group header="Videos" footer="Opens a YouTube search in your browser.">
            <Row as="a" href={youtube(c.youtube.tutorial)} target="_blank" rel="noopener noreferrer"
              label={<Wrap>Watch a tutorial</Wrap>} accessory={<ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />} />
            <Row as="a" href={youtube(c.youtube.mistakes)} target="_blank" rel="noopener noreferrer"
              label={<Wrap>Common mistakes on video</Wrap>} accessory={<ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />} />
          </Group>

          {c.sources.length > 0 && (
            <Group header="Sources">
              {c.sources.map(s => (
                <Row key={s} as="a" href={s} target="_blank" rel="noopener noreferrer" label={<Wrap>{siteOf(s)}</Wrap>}
                  detail={<span className="[overflow-wrap:anywhere]">{s}</span>}
                  accessory={<ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />} />
              ))}
            </Group>
          )}
        </>
      )}
    </Screen>
  );
}
