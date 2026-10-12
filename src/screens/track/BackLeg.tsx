/**
 * Back & leg — the signature screen (board D21). Pain and how far leg
 * symptoms reached, against the spinal loading each session used, so the
 * owner can see whether loading went up while symptoms stayed calm, or
 * whether a flare followed a change. Everything on it is a recorded fact.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { CheckCircle2Icon, PlusIcon } from 'lucide-react';
import { Screen } from '@/components/hig/Screen';
import { Group, Row } from '@/components/hig/List';
import { useStore } from '@/store/useStore';
import { PAIN_DAYS_NEEDED, assembleBackLeg } from './backLegSeries';
import { BackLegChart } from './BackLegChart';
import { formatDayLong } from './format';
import { displayPrefs } from './logKinds';
import { LIST_PREVIEW, metricRows } from './metrics';
import type { Origin } from './MyDay';
import { PERIODS, isPeriod, periodRange, type Period } from './periods';
import { QuickLog, type SavedResult } from './QuickLog';
import { recordPath } from './timeline';
import { EmergencySigns, PrimaryButton, Segmented } from './ui';
import { useOrigin } from './useOrigin';
import { useToday } from './useToday';

/** A week is too short to show loading against symptoms; the ladder moves by the fortnight. */
const CHOICES = PERIODS.filter(p => p.id !== 'week');

export function BackLeg() {
  const { observations, sessions, checkIns, profile, settings } = useStore();
  const current = useToday();
  const location = useLocation();
  const { back } = useOrigin();
  const [params, setParams] = useSearchParams();
  const asked = params.get('period');
  // A month: about twelve sessions, readable even at 320 px.
  const period: Period = isPeriod(asked) && asked !== 'week' ? asked : 'month';
  const [logOpen, setLogOpen] = useState(false);
  const [fresh, setFresh] = useState<readonly string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState<string>();
  const list = useRef<HTMLDivElement>(null);
  const prefs = useMemo(() => displayPrefs(settings, profile, observations), [settings, profile, observations]);

  const data = useMemo(
    () => assembleBackLeg(periodRange(period, current), observations, sessions, checkIns, profile),
    [period, current, observations, sessions, checkIns, profile],
  );
  const readings = useMemo(
    () => metricRows('backLeg', observations, periodRange(period, current), prefs, current),
    [observations, period, current, prefs],
  );
  const here: Origin = { path: location.pathname, label: 'Back & leg', ...(location.search ? { search: location.search } : {}) };
  const onSaved = (result: SavedResult) => {
    setFresh(result.ids);
    setNotice(`Saved on this device: ${result.summary}.`);
  };

  // A brief confirmation, as on My Day. The reading itself stays in the list.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // The first newly shown row takes the focus, so the button's disappearing does not drop it.
  const expand = () => {
    flushSync(() => setShowAll(true));
    list.current?.querySelectorAll<HTMLElement>('a[href]')[LIST_PREVIEW]?.focus();
  };

  return (
    <Screen
      title="Back & leg"
      back={back}
      trailing={(
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          aria-label="Add back and leg pain"
          className="press-feedback flex size-[44px] items-center justify-center rounded-full text-tint"
        >
          <PlusIcon className="size-[28px]" strokeWidth={2} aria-hidden />
        </button>
      )}
    >
      <p className="px-1 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
        Back and leg pain, how far leg symptoms reached, and your sessions’ spinal loading, on the same dates: see whether loading rose while symptoms stayed calm, or a flare followed a change.
      </p>

      <Segmented
        label="Period"
        options={CHOICES}
        value={period}
        onChange={p => setParams(prev => {
          const next = new URLSearchParams(prev);
          next.set('period', p);
          return next;
        }, { replace: true })}
      />

      <div role="status" aria-live="polite" className="empty:hidden">
        {notice && (
          <p className="flex items-start gap-2 rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)] animate-in fade-in slide-in-from-top-1 duration-300">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-tint" aria-hidden />
            <span>{notice}</span>
          </p>
        )}
      </div>

      {data.enough ? (
        <BackLegChart data={data} current={current} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl bg-grouped-card px-4 py-4">
          <p className="text-[length:var(--text-body)] leading-snug">
            This chart needs back or leg pain recorded on at least {PAIN_DAYS_NEEDED} different days.{' '}
            {data.painDays === 0 ? 'There are none in this period yet.' : `There ${data.painDays === 1 ? 'is 1 day' : `are ${data.painDays} days`} in this period so far.`}
          </p>
          <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
            The loading ladder moves only after four sessions, so fewer days than that cannot show symptoms against a change in loading. Your check-ins add a reading each day; so does Add.
          </p>
          <PrimaryButton onClick={() => setLogOpen(true)}>
            <PlusIcon className="size-5" aria-hidden />
            Add back and leg pain
          </PrimaryButton>
        </div>
      )}

      {data.ladderNow && (
        <Group
          header="Loading ladder now"
          footer="Higher levels load the lower back more. The ladder steps down after a session where symptoms got worse, and up after four calm sessions spread over two weeks."
        >
          <Row label="Hinge" value={`Level ${data.ladderNow.hinge}`} />
          <Row label="Squat" value={`Level ${data.ladderNow.squat}`} />
          {data.ladderNow.changedOn && <Row label="Last changed" value={formatDayLong(data.ladderNow.changedOn, current)} />}
        </Group>
      )}

      {readings.length > 0 && (
        <div ref={list}>
        <Group header="Readings">
          {(showAll ? readings : readings.slice(0, LIST_PREVIEW)).map(r => (
            <Row
              key={r.key}
              as={Link}
              to={recordPath(r.ref)}
              state={here}
              viewTransition
              label={<span className={r.ids.some(id => fresh.includes(id)) ? 'inline-block animate-in fade-in zoom-in-110 duration-500' : undefined}>{r.label}</span>}
              detail={r.detail}
              chevron
            />
          ))}
          {!showAll && readings.length > LIST_PREVIEW && (
            <Row label={<span className="text-tint">Show all {readings.length}</span>} onClick={expand} />
          )}
        </Group>
        </div>
      )}

      <div className="px-1 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
        <p>A pain number never rules out an emergency. Get emergency care now for any of these:</p>
        <EmergencySigns className="mt-1" />
        <p className="mt-1">General information, not medical advice.</p>
      </div>

      <QuickLog open={logOpen} onOpenChange={setLogOpen} initial={{ kind: 'backLeg' }} onSaved={onSaved} prefs={prefs} />
    </Screen>
  );
}
