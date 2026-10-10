import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { categoryById } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import {
  lastStretch, offeredSpec, readStretchSpec, specFromPlanId, STRETCH_FOCI, STRETCH_FOCUS_LABEL, STRETCH_MINUTES, stretchHref, stretchOffered,
  stretchPlanFor,
} from '@/engine/stretch';
import { resumeHref, savedRun } from '@/health/recommend';
import { shiftDay } from '@/health/status';
import { carriedOn } from '@/session/carryOn';
import { loadProgress, type SavedProgress } from '@/session/persistence';
import { ChoiceRows, Segmented, Wrap } from '@/screens/move/controls';
import { clock, kitLine, previewRows, talkSeconds, todayLine } from '@/screens/move/preview';
import { weekMovement } from '@/screens/today/model';
import { StatusSheet } from '@/screens/today/StatusSheet';
import { displayPrefs } from '@/screens/track/logKinds';
import { weeklyGoalOn } from '@/screens/track/weeklyGoal';
import type { StretchFocus, StretchMinutes, StretchSpec } from '@/types/plan';
import { HistoryList } from './HistoryList';
import { HubFrame, HubSection, SeeTrends } from './HubFrame';
import { useHubGate, useHubOrigin } from './hooks';
import { MovementCard } from './MovementCard';
import { actionTarget, movementCard, offersRoutines, resumeAllowed, runAction, stretchReason, type HubActionKind } from './movement';
import { goalLine, modeWeek, movementHistory } from './week';
import { WeekStrip } from './WeekStrip';

const REFUSED = new Set(['held', 'stopped', 'gap']);
/** The area choices, which "Choose another routine" brings into view. */
const AREA_ID = 'stretch-area';
const routineTitle = (s: StretchSpec) => `${STRETCH_FOCUS_LABEL[s.focus]} · ${s.minutes} min`;

/**
 * The Stretch hub (journey §8.3, D36).
 * - Right now is the recommended routine, with its area, its length and a
 *   reason from real inputs only, or the gate's words while it refuses.
 * - "In this routine" is what the player will run, built by the same
 *   builder from the same records.
 * - Options are v1's approved routines, through its builder: Back & hips,
 *   Neck & shoulders, Hips & legs or Whole body, at 10 or 15 minutes. The
 *   choice lives in the address (`?focus=&minutes=`), so a reload keeps it.
 * - A run saved today is offered first, as the routine it was. During a
 *   flare it is re-dosed by the player to the gentler routine (A-34, B-30).
 */
export default function StretchHub() {
  const category = categoryById('stretch');
  const g = useHubGate('stretch');
  const { guided, state, now, today, status } = g;
  const navigate = useNavigate();
  const origin = useHubOrigin(category.title);
  const [params, setParams] = useSearchParams();
  const [statusOpen, setStatusOpen] = useState(false);
  const chosen = params.has('focus') || params.has('minutes');
  // Read at the hub's clock, which the shared gate's boundaries keep current (render stays pure).
  const runs = [loadProgress(now.getTime(), 'stretch')].filter((p): p is SavedProgress => p !== null);
  const savedToday = savedRun(runs, today, 'today');
  const saved = savedToday && resumeAllowed(status, 'stretch') ? savedToday : undefined;
  // A saved run, read once, before the routine is built from it: its routine, where it picks up, and what is
  // left as the player will run it, held to today from where it stopped (codex H2-02, B-30).
  const resume = saved ? resumeOf(saved, guided, now) : undefined;
  const { focus, minutes } = resume?.spec ?? readStretchSpec(params, lastStretch(state.sessions));
  const spec: StretchSpec = { focus, minutes };
  // The effective check-ins, as the player builds from, so "In this routine" never lists what won't run.
  // ponytail: built on each render (about 1 ms); the routine's spec is read and reused in the same render, which
  // a manual useMemo can't keep (react-hooks/preserve-manual-memoization). Upgrade: memo on a primitive routine key.
  const plan = stretchPlanFor({ ...guided.data, checkIns: guided.checkIns }, guided.profile, guided.date, { focus, minutes });
  const back = guided.profile.pain.areas.includes('lowerBack') || guided.profile.pain.areas.includes('sciatica');
  const yesterday = guided.checkIns.find(c => c.date === shiftDay(today, -1))?.back;
  const fromLast = state.sessions.some(s => s.planKind === 'stretch' && specFromPlanId(s.planId) !== null);
  const reason = stretchReason({
    chosen, flare: status === 'flare' && back, focus, fromLast,
    ...(yesterday ? { yesterday } : {}), ...(state.settings.focus ? { focusSetting: state.settings.focus } : {}),
  });
  const line = todayLine(plan, g.permission);
  const card = movementCard({
    mode: 'stretch', permission: g.permission, gate: g.gate, status, line: g.line, title: routineTitle(spec),
    ...(line && plan.kind !== 'none' ? { detail: line } : {}),
    ...(reason ? { reason } : {}),
    // The gate allows it, but the builder can't make this routine today: say so, and offer the other routines.
    // A saved run is held to its own steps then, as the player holds it (`todayDose`), so it is still carried on.
    ...(plan.kind === 'none' && g.permission.allowed && !resume ? { blocked: line ?? 'This routine cannot be put together safely today. Try another area or length.' } : {}),
    gaps: g.gaps, stretchOpen: g.stretchOpen,
    ...(resume ? { saved: { minutesLeft: resume.minutesLeft, label: resume.label } } : {}),
  });
  const ctx = { mode: 'stretch' as const, href: stretchHref(spec), startLabel: 'Start stretch', ...(resume ? { resumeHref: resume.href } : {}) };
  // "Choose another routine": the area choices, in view and focused on the one chosen.
  const chooseAnother = () => {
    const radio = document.getElementById(AREA_ID)?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
    radio?.scrollIntoView({ block: 'center' });
    radio?.focus();
  };
  const act = (kind: HubActionKind) => runAction(actionTarget(kind, ctx), {
    start: g.start,
    go: to => navigate(to, { viewTransition: true, state: origin }),
    status: () => setStatusOpen(true),
    local: chooseAnother,
  });
  // Replace, not push: changing a choice is not a place to go Back to. The page stays where it is.
  const choose = (next: StretchSpec) => setParams({ focus: next.focus, minutes: String(next.minutes) }, { replace: true, preventScrollReset: true });
  // On arrival only, a routine in the address the builder can't make today is let go, so a reload or a link
  // doesn't keep it; one chosen here stays on screen beside its words, with the choices (kiro KH-01).
  // Once: the address's own setter changes with the address, and a later choice must stay.
  const letGo = useRef(chosen && card.state === 'unbuildable');
  useEffect(() => {
    if (!letGo.current) return;
    letGo.current = false;
    setParams(new URLSearchParams(), { replace: true, preventScrollReset: true });
  }, [setParams]);
  const offering = offersRoutines(card.state);
  // "In this routine" is what will run: while carrying on, what is left of it.
  const listed = resume ? { ...plan, steps: resume.left } : plan;
  const rows = previewRows(listed);
  const kit = kitLine(listed);
  const talk = Math.round(talkSeconds(listed) / 60);
  const prefs = displayPrefs(state.settings, state.profile, state.observations);

  return (
    <HubFrame category={category} held={REFUSED.has(card.state)}>
      <MovementCard card={card} onAction={act} />

      {offering && rows.length > 0 && (
        <Group
          header="In this routine"
          footer={[resume ? 'What’s left of it, as it runs today.' : null, kit, talk > 0 ? `Plus about ${talk} ${talk === 1 ? 'minute' : 'minutes'} of welcome and wrap-up.` : null].filter(Boolean).join(' ')}
        >
          {/* Names wrap: a movement's name is the one thing in the row that must not be cut short. */}
          {rows.map(r => <Row key={r.id} label={<Wrap>{r.name}</Wrap>} detail={r.dose} value={clock(r.seconds)} numeric />)}
        </Group>
      )}

      {offering && !resume && (
        <HubSection title="Options">
          <div className="flex flex-col gap-4">
            <Group header="Area">
              <div id={AREA_ID} className="contents">
              <ChoiceRows<StretchFocus>
                label="Area"
                options={STRETCH_FOCI.map(f => ({ value: f, label: STRETCH_FOCUS_LABEL[f] }))}
                value={focus}
                onChange={f => choose(offeredSpec({ focus: f, minutes }))}
              />
              </div>
            </Group>
            <section aria-labelledby="stretch-length" className="flex flex-col">
              <h3 id="stretch-length" className="px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground">Length</h3>
              <Segmented<StretchMinutes>
                label="Length"
                options={STRETCH_MINUTES.map(m => ({ value: m, label: `${m} min`, disabled: !stretchOffered({ focus, minutes: m }) }))}
                value={minutes}
                onChange={m => choose({ focus, minutes: m })}
              />
              {!stretchOffered({ focus, minutes: 10 }) && (
                <p className="px-4 pt-2 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
                  Ten minutes is Back &amp; hips only: every routine starts with the same spine and core basics, and they fill most of it.
                </p>
              )}
            </section>
          </div>
        </HubSection>
      )}

      <WeekStrip
        days={modeWeek({ mode: 'stretch', today, sessions: state.sessions, observations: state.observations, ...(state.settings.statusPeriods ? { statusPeriods: state.settings.statusPeriods } : {}) })}
        goal={goalLine(weekMovement(today, state.observations, state.sessions).minutes, weeklyGoalOn(state.settings, today))}
      />
      <HistoryList rows={movementHistory('stretch', state.sessions, state.observations, prefs, today)} origin={origin} empty="No stretches yet. Each one shows here." />
      <SeeTrends category={category} origin={origin} />
      <p className="px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
        Stop if pain spreads down your leg, or you feel dizzy, short of breath or unwell. General information, not medical advice.
      </p>

      {g.sheet}
      <StatusSheet open={statusOpen} onOpenChange={setStatusOpen} today={today} periods={state.settings.statusPeriods} startDate={state.settings.startDate} />
    </HubFrame>
  );
}

/** A saved stretch as carrying it on would run it now: the player's own reconciliation (`carriedOn`). */
function resumeOf(saved: SavedProgress, guided: ReturnType<typeof useHubGate>['guided'], now: Date) {
  const spec = saved.plan.stretch ?? specFromPlanId(saved.plan.id);
  const { data, checkIns, checkIn, profile, date, plan: todayPlan } = guided;
  const run = carriedOn(saved, { data, checkIns, checkIn, profile, date, todayPlan, spec }, { profile, ...(checkIn ? { checkIn } : {}), now, recent: checkIns });
  return { spec, minutesLeft: run.minutesLeft, label: saved.plan.label, href: resumeHref(saved), left: run.left };
}
