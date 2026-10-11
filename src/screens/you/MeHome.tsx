import { createContext, useContext, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BellIcon, ChevronRightIcon, HardDriveIcon, HeartPulseIcon, MicIcon, SaladIcon, SunMoonIcon, TargetIcon } from 'lucide-react';
import { categoryById, newlyRelevant, type CategoryId } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { backupMark, backupNudge, recordSpan } from '@/reminders/backup';
import { NOT_ADVICE } from '@/reminders/copy';
import { EditButton } from '@/screens/home/EditButton';
import { answerOffer, useHomeLayout } from '@/screens/home/homeLayout';
import { addButton } from '@/screens/home/layout';
import { TileIcon } from '@/screens/home/Tile';
import { useLocalDay } from '@/screens/today/clock';
import { useSetupAnswers } from '@/screens/setup/useSetup';
import { deviceNoun, readInstallEnv } from '@/screens/welcome/install';
import { finishFooter, finishTitle, notNow, setupProgress, type OpenChapter } from '@/setup/progress';
import { useStore } from '@/store/useStore';
import type { HomeLayout } from '@/types';
import { packName } from '@/voice/packs';
import { buildId } from './about';
import { backupLine, backupState } from './dataStatus';
import { displayLine } from './display';
import { goalsLine } from './goals';
import { REVIEW_LABEL, conditionsLine, foodLine, habitsLine, privacyLine, reviewNeeded } from './summaries';

/** Focus goes to the screen's title when the row it was on has gone (B-03). */
const focusTitle = () => requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }));

/**
 * A row's answer on its way, or refused. Held by Me, above its lists, so it
 * outlives the row: the store shows an answer before it is stored, which takes
 * the row out of its list, and a refused one puts it back as a new row (codex
 * H4-04, journey §4.5). `at` is where the row stood, to keep its place.
 */
interface RowAnswer {
  saving: boolean;
  problem?: string;
  at: number;
  chapter?: OpenChapter;
  offer?: CategoryId;
}

/** How a row answers through Me, and what Me holds for it. */
interface Answers {
  of: (key: string) => RowAnswer | undefined;
  notNow: (chapter: OpenChapter) => void;
  offer: (id: CategoryId, add: boolean) => void;
}
const AnswersContext = createContext<Answers>({ of: () => undefined, notNow: () => {}, offer: () => {} });

/** A list with the rows Me still holds an answer for put back where they stood, until the answer is stored. */
function withHeld<T>(list: readonly T[], held: readonly { row: T; at: number }[], same: (a: T, b: T) => boolean): T[] {
  const out = [...list];
  for (const h of [...held].sort((a, b) => a.at - b.at)) if (!out.some(r => same(r, h.row))) out.splice(Math.min(h.at, out.length), 0, h.row);
  return out;
}

/**
 * Me (journey §16): what is left to answer, a category the answers now make
 * useful, then the person's own settings by section, then About. Everything
 * here is about them and stays on this device. Me is a tab, so it has no
 * Done (D63).
 */
export function MeHome() {
  const state = useStore();
  const { settings, profile } = state;
  // Read once per visit: neither changes while the list is open.
  const [{ device, build }] = useState(() => ({
    device: deviceNoun(readInstallEnv()),
    build: buildId([...document.scripts].map(s => s.src)),
  }));
  // Today from the shared clock: a list left open overnight, or opened after midnight, reads the new day's goals (codex H4-06).
  const { now, day } = useLocalDay();
  const { stored, fallback, relevant } = useHomeLayout();
  // Each row's answer, held here until the device has stored it, or with why it didn't (codex H4-04).
  const [answers, setAnswers] = useState<ReadonlyMap<string, RowAnswer>>(() => new Map());
  const writing = useRef(new Set<string>());
  const hold = (key: string, answer: RowAnswer | undefined) => setAnswers(held => {
    const next = new Map(held);
    if (answer) next.set(key, answer);
    else next.delete(key);
    return next;
  });
  const held = [...answers.values()];
  // Setup's answers as this session holds them, so an unfinished setup names the chapter it still asks (K5-07).
  const { answers: setupAnswers } = useSetupAnswers();
  const finish = withHeld(setupProgress({ profile, settings, answers: setupAnswers }), held.flatMap(a => (a.chapter ? [{ row: a.chapter, at: a.at }] : [])), (a, b) => a.chapter === b.chapter);
  // Only once Home has laid its tiles out: until then its defaults include every relevant one.
  const offers = stored
    ? withHeld(newlyRelevant({ relevant, layout: stored, offered: settings.homeOffered ?? [] }), held.flatMap(a => (a.offer ? [{ row: a.offer, at: a.at }] : [])), (a, b) => a === b)
    : [];
  const rows: Answers = {
    of: key => answers.get(key),
    notNow: chapter => {
      const key = `chapter:${chapter.chapter}`;
      if (writing.current.has(key)) return;
      const at = Math.max(0, finish.findIndex(c => c.chapter === chapter.chapter));
      writing.current.add(key);
      hold(key, { saving: true, at, chapter });
      void notNow(chapter.chapter).then(saved => {
        writing.current.delete(key);
        // Gone only once stored; refused, or kept in memory only, it stays with why and Not now to try again (§4.5).
        if (saved.ok) {
          hold(key, undefined);
          focusTitle();
        } else hold(key, { saving: false, at, chapter, problem: `That did not save. ${saved.failure.message} Tap Not now to try again.` });
      });
    },
    offer: (id, add) => {
      const key = `offer:${id}`;
      if (writing.current.has(key)) return;
      const at = Math.max(0, offers.indexOf(id));
      const title = categoryById(id).title;
      const full = `${title} couldn’t go on Home: its group is full. Hide a tile in Edit Home, or choose Not now.`;
      const saved = answerOffer(fallback, id, add);
      if (!saved) {
        hold(key, { saving: false, at, offer: id, problem: full });
        return;
      }
      writing.current.add(key);
      hold(key, { saving: true, at, offer: id });
      void saved.then(result => {
        writing.current.delete(key);
        if (!result.ok) hold(key, { saving: false, at, offer: id, problem: `That did not save. ${result.failure.message} Try again.` });
        // Another copy of the app filled the group first: nothing was written, and the offer stays (codex H4-03).
        else if (!result.value) hold(key, { saving: false, at, offer: id, problem: full });
        else {
          hold(key, undefined);
          if (add) toast(`${title} added to Home`);
          focusTitle();
        }
      });
    },
  };
  const review = reviewNeeded(profile);
  const nudge = backupNudge(now, backupMark(settings.habits), recordSpan(state), state.revision);
  const backup = backupState(settings.habits);
  const voice = profile?.voice;

  return (
    <Screen title="Me">
      <AnswersContext value={rows}>
      {finish.length > 0 && (
        <Group header={finishTitle(finish.length)} footer={finishFooter(finish)}>
          {finish.map(c => <FinishRow key={c.chapter} chapter={c} />)}
        </Group>
      )}
      {stored && offers.length > 0 && (
        <Group header="New for Home" footer="Your answers make these useful now. Each is offered once.">
          {offers.map(id => <OfferRow key={id} id={id} layout={stored} />)}
        </Group>
      )}
      </AnswersContext>

      <Group>
        <Row
          as={Link}
          to="/me/profile"
          viewTransition
          icon={<HeartPulseIcon />}
          label="Profile & health"
          detail={review ? <span className="text-caution">{REVIEW_LABEL[review]}</span> : conditionsLine(profile)}
          chevron
        />
        <Row as={Link} to="/me/goals" viewTransition icon={<TargetIcon />} label="Goals" detail={goalsLine(settings, day)} chevron />
        <Row as={Link} to="/me/food" viewTransition icon={<SaladIcon />} label="Food" detail={foodLine(profile?.food)} chevron />
      </Group>

      <Group>
        <Row as={Link} to="/me/reminders" viewTransition icon={<BellIcon />} label="Reminders" detail={habitsLine(settings.habits, profile)} chevron />
        <Row
          as={Link}
          to="/me/voice"
          viewTransition
          icon={<MicIcon />}
          label="Voice & demos"
          detail={`${packName(voice?.pack ?? 'af_heart').split(' · ')[0]} · ${profile?.figure === 'female' ? 'female' : 'male'} figure`}
          chevron
        />
        <Row as={Link} to="/me/display" viewTransition icon={<SunMoonIcon />} label="Display" detail={displayLine(settings)} chevron />
      </Group>

      <Group footer={privacyLine(device)}>
        <Row
          as={Link}
          to="/me/data"
          viewTransition
          icon={<HardDriveIcon />}
          label="Data"
          detail={nudge.due ? <span className="text-caution">{`${backupLine(backup)}. Time for a new one.`}</span> : backupLine(backup)}
          chevron
        />
      </Group>

      <Group header="About" footer={`${NOT_ADVICE} The sources behind each health claim are in Learn.`}>
        <Row label="Version" value={build ? `Build ${build}` : 'Development'} numeric />
        <Row as={Link} to="/hub/learn/sources" viewTransition label="Sources and licences" chevron />
      </Group>
    </Screen>
  );
}

/**
 * One chapter to finish: it opens where its answers are kept, with "Not now"
 * beside it unless movement waits for it (journey §6.6, D65; KH-08). Narrower than 16 rem (its group is the
 * container, as for `Row`), "Not now" goes under the words.
 */
function FinishRow({ chapter }: { chapter: OpenChapter }) {
  const answers = useContext(AnswersContext);
  const answer = answers.of(`chapter:${chapter.chapter}`);
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 pr-3 @max-[16rem]:flex-wrap @max-[16rem]:gap-y-1 @max-[16rem]:px-2 @max-[16rem]:pb-2">
        <Link to={chapter.href} viewTransition className="press-feedback flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left transition-colors active:bg-muted/60 @max-[16rem]:basis-full @max-[16rem]:pl-0">
          <span className="min-w-0 flex-1">
            <span className="block text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word]">{chapter.label}</span>
            <span className={`block text-[length:var(--text-subhead)] leading-snug [overflow-wrap:break-word] ${chapter.why === 'gap' ? 'text-caution' : 'text-muted-foreground'}`}>{chapter.detail}</span>
          </span>
          <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        </Link>
        {/* Movement waits for a safety gap, so it has no "Not now" (KH-08, board D80). */}
        {chapter.why !== 'gap' && (
          <EditButton
            control="later"
            label="Not now"
            name={chapter.label}
            disabled={answer?.saving === true}
            onClick={() => answers.notNow(chapter)}
          />
        )}
      </div>
      {answer?.problem && <p role="alert" className="px-4 pb-2 text-[length:var(--text-subhead)] leading-snug text-stop">{answer.problem}</p>}
    </div>
  );
}

/**
 * "Add Glucose to Home?", once (journey §5.1). A full group says so on Add,
 * and Not now still answers it. Narrower than 16 rem, the question goes
 * under the icon, as a `Row` stacks.
 */
function OfferRow({ id, layout }: { id: CategoryId; layout: HomeLayout }) {
  const category = categoryById(id);
  const button = addButton(layout, id);
  const answers = useContext(AnswersContext);
  const answer = answers.of(`offer:${id}`);
  const saving = answer?.saving === true;
  return (
    <div className="flex flex-col gap-2 px-4 py-3 @max-[16rem]:px-2">
      <div className="flex items-center gap-3 @max-[16rem]:flex-wrap @max-[16rem]:gap-y-1">
        <TileIcon category={category} />
        <p className="min-w-0 flex-1 text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word] @max-[16rem]:basis-full">Add {category.title} to Home?</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <EditButton control="pick" disabled={button.disabled || saving} label={button.disabled ? button.label : 'Add'} name={category.title} onClick={() => answers.offer(id, true)} />
        <EditButton control="later" disabled={saving} label="Not now" name={category.title} onClick={() => answers.offer(id, false)} />
      </div>
      {answer?.problem && <p role="alert" className="text-[length:var(--text-subhead)] leading-snug text-stop">{answer.problem}</p>}
    </div>
  );
}
