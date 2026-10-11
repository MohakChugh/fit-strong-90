import { useState } from 'react';
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
import { today as todayOf } from '@/screens/track/periods';
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
 * Me (journey §16): what is left to answer, a category the answers now make
 * useful, then the person's own settings by section, then About. Everything
 * here is about them and stays on this device. Me is a tab, so it has no
 * Done (D63).
 */
export function MeHome() {
  const state = useStore();
  const { settings, profile } = state;
  // Read once per visit: none of these change while the list is open.
  const [{ now, device, build }] = useState(() => ({
    now: new Date(),
    device: deviceNoun(readInstallEnv()),
    build: buildId([...document.scripts].map(s => s.src)),
  }));
  const day = todayOf(now);
  const { stored, fallback, relevant } = useHomeLayout();
  // Setup's answers as this session holds them, so an unfinished setup names the chapter it still asks (K5-07).
  const { answers } = useSetupAnswers();
  const finish = setupProgress({ profile, settings, answers });
  // Only once Home has laid its tiles out: until then its defaults include every relevant one.
  const offers = stored ? newlyRelevant({ relevant, layout: stored, offered: settings.homeOffered ?? [] }) : [];
  const review = reviewNeeded(profile);
  const nudge = backupNudge(now, backupMark(settings.habits), recordSpan(state), state.revision);
  const backup = backupState(settings.habits);
  const voice = profile?.voice;

  return (
    <Screen title="Me">
      {finish.length > 0 && (
        <Group header={finishTitle(finish.length)} footer={finishFooter(finish)}>
          {finish.map(c => <FinishRow key={c.chapter} chapter={c} />)}
        </Group>
      )}
      {stored && offers.length > 0 && (
        <Group header="New for Home" footer="Your answers make these useful now. Each is offered once.">
          {offers.map(id => <OfferRow key={id} id={id} layout={stored} fallback={fallback} />)}
        </Group>
      )}

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
  const [problem, setProblem] = useState<string>();
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
            onClick={() => void notNow(chapter.chapter).then(saved => {
              if (!saved.ok) setProblem(`That did not save. ${saved.failure.message}`);
              else focusTitle();
            })}
          />
        )}
      </div>
      {problem && <p role="alert" className="px-4 pb-2 text-[length:var(--text-subhead)] leading-snug text-stop">{problem}</p>}
    </div>
  );
}

/**
 * "Add Glucose to Home?", once (journey §5.1). A full group says so on Add,
 * and Not now still answers it. Narrower than 16 rem, the question goes
 * under the icon, as a `Row` stacks.
 */
function OfferRow({ id, layout, fallback }: { id: CategoryId; layout: HomeLayout; fallback: HomeLayout }) {
  const category = categoryById(id);
  const button = addButton(layout, id);
  const [problem, setProblem] = useState<string>();
  const answer = async (add: boolean) => {
    const saved = answerOffer(fallback, id, add);
    if (!saved) {
      setProblem(`${category.title} couldn’t go on Home: its group is full. Hide a tile in Edit Home, or choose Not now.`);
      return;
    }
    const result = await saved;
    if (!result.ok) {
      setProblem(`That did not save. ${result.failure.message}`);
      return;
    }
    if (add) toast(`${category.title} added to Home`);
    focusTitle();
  };
  return (
    <div className="flex flex-col gap-2 px-4 py-3 @max-[16rem]:px-2">
      <div className="flex items-center gap-3 @max-[16rem]:flex-wrap @max-[16rem]:gap-y-1">
        <TileIcon category={category} />
        <p className="min-w-0 flex-1 text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word] @max-[16rem]:basis-full">Add {category.title} to Home?</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <EditButton control="pick" disabled={button.disabled} label={button.disabled ? button.label : 'Add'} name={category.title} onClick={() => void answer(true)} />
        <EditButton control="later" label="Not now" name={category.title} onClick={() => void answer(false)} />
      </div>
      {problem && <p role="alert" className="text-[length:var(--text-subhead)] leading-snug text-stop">{problem}</p>}
    </div>
  );
}
