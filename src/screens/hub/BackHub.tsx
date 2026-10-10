/**
 * Back & leg — the signature screen (board D21), as its hub (journey §8.2).
 * Pain and how far leg symptoms reached, against the spinal loading each
 * session used, so the owner can see whether loading went up while symptoms
 * stayed calm, or whether a flare followed a change. Everything on it is a
 * recorded fact.
 * - Latest: the newest back and leg pain scores, with when, and "Add reading".
 * - How far it reaches, and the red flags, are today's check-in's questions,
 *   where the engine reads them (D53): "Update today’s check-in".
 * - Pain and loading: v1's period control, chart and loading ladder.
 * - History: every record, newest first, each opening where it is corrected.
 */

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2Icon, PlusIcon } from 'lucide-react';
import { categoryById } from '@/categories';
import { CheckInSheet } from '@/components/checkin/CheckInSheet';
import { Group, Row } from '@/components/hig/List';
import { compareObservations, type Observation } from '@/health/observation';
import { useGuided } from '@/hooks/useGuided';
import { useStore } from '@/store/useStore';
import { PAIN_DAYS_NEEDED, assembleBackLeg } from '@/screens/track/backLegSeries';
import { BackLegChart } from '@/screens/track/BackLegChart';
import { formatClock, formatDayLong, formatDayRelative, hasClockTime } from '@/screens/track/format';
import { displayPrefs } from '@/screens/track/logKinds';
import { metricRows } from '@/screens/track/metrics';
import { PERIODS, isPeriod, periodRange, type Period } from '@/screens/track/periods';
import { QuickLog, type SavedResult } from '@/screens/track/QuickLog';
import { EmergencySigns, PrimaryButton, Segmented } from '@/screens/track/ui';
import { useToday } from '@/screens/track/useToday';
import { HistoryList } from './HistoryList';
import { HubFrame, HubSection, SeeTrends } from './HubFrame';
import { useHubOrigin } from './hooks';
import { historyRange } from './reading';

/** A week is too short to show loading against symptoms; the ladder moves by the fortnight. */
const CHOICES = PERIODS.filter(p => p.id !== 'week');

export default function BackHub() {
  const category = categoryById('back');
  const { observations, sessions, checkIns, profile, settings } = useStore();
  const { profile: guidedProfile, date, checkIn, checkIns: recent, saveCheckIn } = useGuided();
  const current = useToday();
  const origin = useHubOrigin(category.title);
  const [params, setParams] = useSearchParams();
  const asked = params.get('period');
  // A month: about twelve sessions, readable even at 320 px.
  const period: Period = isPeriod(asked) && asked !== 'week' ? asked : 'month';
  const [logOpen, setLogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [fresh, setFresh] = useState<readonly string[]>([]);
  const [notice, setNotice] = useState<string>();
  const prefs = useMemo(() => displayPrefs(settings, profile, observations), [settings, profile, observations]);

  const data = useMemo(
    () => assembleBackLeg(periodRange(period, current), observations, sessions, checkIns, profile),
    [period, current, observations, sessions, checkIns, profile],
  );
  const history = useMemo(
    () => metricRows('backLeg', observations, historyRange({ metric: 'backLeg' }, observations, current), prefs, current),
    [observations, prefs, current],
  );
  // Today's check-in stamps its pain scores when it is answered, so they order with the ones added here.
  const latestOf = (kind: 'backPain' | 'legPain') => observations.filter(o => o.kind === kind && o.scope === 'pointInTime').sort(compareObservations).at(-1);
  const pain = latestOf('backPain');
  const leg = latestOf('legPain');
  const whenOf = (o: Observation) => `${formatDayRelative(o.day, current)}${hasClockTime(o) ? ` · ${formatClock(o.at, prefs.hour12)}` : ''}`;
  const onSaved = (result: SavedResult) => {
    setFresh(result.ids);
    setNotice(`Saved on this device: ${result.summary}.`);
  };
  // The confirmation stands until the next Add or until the screen is left: never on a timer (§20.4 rule 8; kiro KH-16).
  const add = () => {
    setNotice(undefined);
    setLogOpen(true);
  };

  return (
    <HubFrame category={category}>
      <p className="px-1 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
        Back and leg pain, how far leg symptoms reached, and your sessions’ spinal loading, on the same dates: see whether loading rose while symptoms stayed calm, or a flare followed a change.
      </p>

      <div role="status" aria-live="polite" className="empty:hidden">
        {notice && (
          <p className="flex items-start gap-2 rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)] animate-in fade-in slide-in-from-top-1 duration-300">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-tint" aria-hidden />
            <span>{notice}</span>
          </p>
        )}
      </div>

      <HubSection title="Latest">
        <div className="flex flex-col gap-3 rounded-2xl bg-grouped-card p-4">
          {pain || leg ? (
            <>
              {pain && <p className="text-[length:var(--text-body)] leading-snug"><span className="font-semibold">Back pain {pain.value} of 10</span> · {whenOf(pain)}</p>}
              {leg && <p className="text-[length:var(--text-body)] leading-snug"><span className="font-semibold">Leg pain {leg.value} of 10</span> · {whenOf(leg)}</p>}
            </>
          ) : (
            <>
              <p className="text-[length:var(--text-title-2)] font-semibold leading-tight">Add your first pain scores</p>
              <p className="text-[length:var(--text-body)] leading-snug text-muted-foreground">Back and leg pain, 0 to 10, from your check-ins and from here.</p>
            </>
          )}
          <button
            type="button"
            onClick={add}
            className="press-feedback flex min-h-[60px] w-full items-center justify-center gap-2 rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint"
          >
            <PlusIcon className="size-5" aria-hidden />
            Add reading
          </button>
        </div>
      </HubSection>
      {/* How far it reaches, and the red flags, are the check-in's questions, where the engine reads them (D53). */}
      <Group footer="Pain spreading further, new numbness or weakness: today’s check-in asks, and says what to do.">
        <Row label="How far it reaches, or new weakness" detail="Update today’s check-in" onClick={() => setUpdating(true)} chevron />
      </Group>

      <HubSection title="Pain and loading">
        <div className="flex flex-col gap-6">
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
              <PrimaryButton onClick={add}>
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
        </div>
      </HubSection>

      {/* The red flags in body text and normal ink, before History, where they are read (kiro KH-11). */}
      <div className="px-1 text-[length:var(--text-body)] leading-snug">
        <p>A pain number never rules out an emergency. Get emergency care now for any of these:</p>
        <EmergencySigns className="mt-1" />
        <p className="mt-2 text-[length:var(--text-footnote)] text-muted-foreground">General information, not medical advice.</p>
      </div>

      <HistoryList rows={history.map(r => ({ key: r.key, label: r.label, detail: r.detail, ref: r.ref, ids: r.ids }))} origin={origin} empty="No pain scores yet." fresh={fresh} />
      <SeeTrends category={category} origin={origin} />


      <QuickLog open={logOpen} onOpenChange={setLogOpen} initial={{ kind: 'backLeg' }} onSaved={onSaved} prefs={prefs} />
      <CheckInSheet open={updating} onOpenChange={setUpdating} profile={guidedProfile} date={date} {...(checkIn ? { initial: checkIn } : {})} recent={recent} onSave={saveCheckIn} />
    </HubFrame>
  );
}
