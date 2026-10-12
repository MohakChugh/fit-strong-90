import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { markBack } from '@/components/hig/navigation';
import { dayOf, nowAt } from '@/health/observation';
import { timeOf } from '@/lib/time';
import { cn } from '@/lib/utils';
import { measurementsFrom } from '@/setup/assemble';
import { finishSetup } from '@/setup/draft';
import { CHAPTER_TITLE, firstPageOf, hrefOf, prevPage } from '@/setup/graph';
import { ACKNOWLEDGEMENT, clearanceNotes, reviewRecord, reviewThings, whyOtherDiabetes } from '@/setup/review';
import { HANDOFF, deviceNoun, installContext, readInstallEnv } from '@/screens/welcome/install';
import { BackupSheet } from '@/screens/you/DataSheets';
import { Notice, PrimaryButton } from '@/screens/you/controls';
import { chapterSections } from '@/screens/you/summaries';
import { useStore } from '@/store/useStore';
import { Missing } from './controls';
import { SetupShell } from './SetupShell';
import { useCtx, useSetupAnswers } from './useSetup';

const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return timeOf(new Date(2026, 0, 1, h, m));
};

/**
 * Review (journey §6.2): what the answers will do, each chapter with Edit,
 * the move to the Home Screen app in Safari (A-27), v1's acknowledgement, and
 * "Start using FitStrong": the profile, the settings, completion and Home's
 * first tiles as one write, then straight to Home (M22). Drawn at once.
 */
export function ReviewPage() {
  const navigate = useNavigate();
  const state = useStore();
  const { answers } = useSetupAnswers();
  const ctx = useCtx();
  const [now] = useState(nowAt);
  // The record Review shows, as it's drawn now: finishing it, once another copy has replaced it, is refused (H5R-09).
  // A backup restored here redraws Review, so it finishes the restored record (V-J37).
  const generation = state.epoch;
  const today = dayOf(now);
  const [{ context, device }] = useState(() => {
    const env = readInstallEnv();
    return { context: installContext(env), device: deviceNoun(env) };
  });
  const [ack, setAck] = useState(false);
  const [askAck, setAskAck] = useState(false);
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();

  // What finishing would store, shown before it is.
  const { profile, settings } = reviewRecord(answers, state, today, ctx);
  const things = reviewThings(profile, settings, clock);
  const notes = clearanceNotes(profile);
  // Each body measure with when it was taken, the readings finishing would add as from now (H5-24).
  const readings = [...state.observations, ...measurementsFrom(answers, state.profile, now).map(o => ({ ...o, at: now }))];

  const back = () => {
    const prev = prevPage(answers, 'review');
    markBack();
    navigate(prev && prev !== 'welcome.start' ? hrefOf(prev) : '/setup', { replace: true, state: { back: true } });
  };

  const start = async () => {
    if (!ack) {
      setAskAck(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    setProblem(undefined);
    const finished = await finishSetup(answers, ctx, nowAt(), generation);
    setBusy(false);
    if (finished.kind === 'home') navigate('/home', { replace: true });
    else setProblem(finished.message);
  };

  return (
    <SetupShell title="Here’s what we’ll do for you" capsule={{ label: 'Review', fraction: 1 }} onBack={back}>
      <Group header="What we’ll do">
        {things.map(t => <Row key={t} icon={<CheckIcon />} label={t} />)}
      </Group>
      {notes.length > 0 && (
        <Group header="Before vigorous exercise" footer="You can add your clearance in Me → Profile & health once you have it.">
          {notes.map(n => <Row key={n} label={n} />)}
        </Group>
      )}
      {chapterSections(profile, settings, today, readings).map(s => (
        <Group key={s.chapter} header={CHAPTER_TITLE[s.chapter]} footer={s.chapter === 'health' ? whyOtherDiabetes(answers) : undefined}>
          {s.rows.map(r => <Row key={r.label} label={r.label} detail={r.value} />)}
          <Row onClick={() => navigate(hrefOf(firstPageOf(s.chapter, answers)), { state: { fromReview: true } })}
            aria-label={`Edit ${CHAPTER_TITLE[s.chapter]}`} label={<span className="text-tint">Edit</span>} />
        </Group>
      ))}
      {context === 'iosBrowser' && (
        <Group header={HANDOFF.title} footer={HANDOFF.text}>
          <Row onClick={() => setBackup(true)} label={<span className="text-tint">Make a backup</span>} chevron />
        </Group>
      )}
      <button type="button" role="checkbox" aria-checked={ack} onClick={() => { setAck(!ack); setAskAck(false); }}
        className="press-feedback flex min-h-12 w-full items-start gap-3 rounded-xl bg-grouped-card p-4 text-left">
        <span aria-hidden className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2', ack ? 'border-tint bg-tint text-on-tint' : 'border-muted-foreground')}>
          {ack && <CheckIcon className="size-4" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1 text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word] hyphens-auto">{ACKNOWLEDGEMENT}</span>
      </button>
      <Missing show={askAck && !ack}>Tick the box above to carry on.</Missing>
      {problem && <Notice tone="error">{problem}</Notice>}
      <PrimaryButton className="min-h-[3.75rem]" disabled={busy} onClick={() => void start()}>{busy ? 'Saving…' : 'Start using FitStrong'}</PrimaryButton>
      <BackupSheet open={backup} onOpenChange={setBackup} device={device} />
    </SetupShell>
  );
}
