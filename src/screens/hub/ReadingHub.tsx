import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2Icon, PlusIcon } from 'lucide-react';
import { categoryById } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { nextCheck } from '@/health/cadence';
import { useStore } from '@/store/useStore';
import { displayPrefs, LAB_OPTIONS } from '@/screens/track/logKinds';
import { METRICS, metricNotes, metricRows } from '@/screens/track/metrics';
import { QuickLog } from '@/screens/track/QuickLog';
import { useClock } from '@/screens/today/clock';
import { Interpretation, Segmented } from '@/screens/track/ui';
import { useToday } from '@/screens/track/useToday';
import { HistoryList } from './HistoryList';
import { HubFrame, HubSection, SeeTrends } from './HubFrame';
import { useHubOrigin } from './hooks';
import { historyRange, hubAdd, latestFor, readingSpec, weekValues, type ReadingSpec } from './reading';
import { WeekDay } from './WeekDay';

/**
 * A reading hub (journey §8.2), for Glucose, Blood pressure, Weight, Water,
 * Sleep, Waist and Labs:
 * - Latest: the value with when it was taken, its unit and context, v1's
 *   reading of it, and the notes the metric always carries;
 * - "When to check next", from the cadence model;
 * - "Add reading", straight into the metric's own form;
 * - this week's values;
 * - History, each record opening where it is corrected;
 * - the trend.
 * With nothing recorded yet it says "Add your first …", and why (§8.4).
 */
export default function ReadingHub() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const spec = readingSpec(id, params.get('metric'));
  if (!spec) return <Navigate to="/home?moved=1" replace />;
  return <ReadingScreen key={`${spec.id}:${spec.metric}`} spec={spec} />;
}

function ReadingScreen({ spec }: { spec: ReadingSpec }) {
  const category = categoryById(spec.id);
  const { observations, profile, settings } = useStore();
  const current = useToday();
  // The cadence's "evening" depends on the hour: read from the shared clock, so render stays pure.
  const { now } = useClock();
  const origin = useHubOrigin(category.title);
  const [params, setParams] = useSearchParams();
  const prefs = useMemo(() => displayPrefs(settings, profile, observations), [settings, profile, observations]);
  // A link's `?add=` opens this hub's own form on arrival, once, then leaves the address (D55).
  const [logOpen, setLogOpen] = useState(() => hubAdd(spec, params.get('add')) !== undefined);
  useEffect(() => {
    if (!params.has('add')) return;
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('add');
      return next;
    }, { replace: true });
  }, [params, setParams]);
  const [notice, setNotice] = useState<string>();
  const [fresh, setFresh] = useState<readonly string[]>([]);
  // A brief confirmation, as on Today's log; the reading itself stays in the list.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const own = useMemo(() => observations.filter(o => METRICS[spec.metric].kinds.includes(o.kind)), [observations, spec.metric]);
  const latest = useMemo(() => latestFor(spec, observations, { prefs, profile, current }), [spec, observations, prefs, profile, current]);
  const notes = metricNotes(spec.metric, own, { prefs, profile, habits: settings.habits, glucoseView: 'all', current });
  const scheduled = spec.id === 'bp' ? 'bloodPressure' : spec.metric === 'hba1c' || spec.metric === 'b12' ? spec.metric : undefined;
  const next = scheduled ? nextCheck({ now, ...(profile ? { profile } : {}), observations }, scheduled) : undefined;
  const week = spec.id === 'labs' ? [] : weekValues(spec, observations, prefs, current);
  const rows = useMemo(
    () => metricRows(spec.metric, observations, historyRange(spec, observations, current), prefs, current),
    [spec, observations, prefs, current],
  );
  const lab = spec.id === 'labs' ? spec.metric : undefined;

  return (
    <HubFrame category={category}>
      {lab && (
        <Segmented
          label="Which result"
          options={LAB_OPTIONS.map(o => ({ id: o.kind, label: o.title }))}
          value={lab}
          onChange={k => setParams({ metric: k }, { replace: true, preventScrollReset: true })}
        />
      )}

      <div role="status" aria-live="polite" className="empty:hidden">
        {notice && (
          <p className="flex items-start gap-2 rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)]">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-tint" aria-hidden />
            <span>{notice}</span>
          </p>
        )}
      </div>

      <HubSection title="Latest">
        <div className="flex flex-col gap-3 rounded-2xl bg-grouped-card p-4">
          {latest ? (
            <>
              <p className="numeric text-[length:var(--text-title-2)] font-bold leading-tight">
                {latest.value}
                {latest.flag && <span className="ml-2 text-[length:var(--text-body)] font-semibold text-stop">{latest.flag}</span>}
              </p>
              <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{[latest.when, latest.context, latest.source].filter(Boolean).join(' · ')}</p>
            </>
          ) : (
            <>
              <p className="text-[length:var(--text-title-2)] font-semibold leading-tight">{spec.first}</p>
              <p className="text-[length:var(--text-body)] leading-snug text-muted-foreground">{spec.why}</p>
            </>
          )}
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="press-feedback flex min-h-[60px] w-full items-center justify-center gap-2 rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint"
          >
            <PlusIcon className="size-5" aria-hidden />
            {spec.addLabel}
          </button>
        </div>
      </HubSection>

      {latest?.reading && <Interpretation text={latest.reading.text} tone={latest.reading.tone} framework={latest.reading.framework} />}
      {notes.map(n => (
        <Interpretation
          key={n.key}
          text={n.reading.text}
          tone={n.reading.tone}
          framework={n.reading.framework}
          extra={n.extra ? <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{n.extra}</p> : undefined}
        />
      ))}

      {spec.id === 'weight' && (
        // BMI is worked out, not entered: it changes with the weight here and the height in the profile (journey §5.1).
        <Group>
          <Row as={Link} to="/me/profile" state={origin} viewTransition label="Your height" detail={profile?.heightCm ? `${profile.heightCm} cm` : 'Not entered: BMI needs it'} chevron />
        </Group>
      )}

      {next && (
        <HubSection title="When to check next" footer={`${next.source} General information, not medical advice.`}>
          <div className="flex flex-col gap-1 rounded-2xl bg-grouped-card p-4">
            <p className={next.due ? 'text-[length:var(--text-body)] font-semibold leading-snug text-caution' : 'text-[length:var(--text-body)] font-semibold leading-snug'}>{next.title}</p>
            <p className="text-[length:var(--text-body)] leading-snug">{next.detail}</p>
          </div>
        </HubSection>
      )}

      {week.length > 0 && (
        <HubSection title="This week">
          <Group>{week.map(d => <WeekDay key={d.day} day={d} />)}</Group>
        </HubSection>
      )}

      <HistoryList
        title={lab ? 'Results' : 'History'}
        rows={rows.map(r => ({ key: r.key, label: r.label, detail: r.detail, ref: r.ref, ids: r.ids }))}
        origin={origin}
        empty="Nothing here yet. Each one shows here once it is added."
        fresh={fresh}
      />
      <SeeTrends category={category} {...(lab ? { search: `?metric=${lab}` } : {})} origin={origin} />

      <QuickLog open={logOpen} onOpenChange={setLogOpen} initial={spec.add} onSaved={r => { setFresh(r.ids); setNotice(`Saved on this device: ${r.summary}.`); }} prefs={prefs} />
    </HubFrame>
  );
}
