import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InfoIcon, TriangleAlertIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Screen } from '@/components/hig/Screen';
import { Group, Row } from '@/components/hig/List';
import { useStartMovement } from '@/components/checkin/useStartMovement';
import { useGuided } from '@/hooks/useGuided';
import {
  lastStretch, offeredSpec, readStretchSpec, STRETCH_FOCI, STRETCH_FOCUS_LABEL, STRETCH_MINUTES, stretchHref, stretchOffered,
  stretchPlanFor,
} from '@/engine/stretch';
import type { StretchFocus, StretchMinutes, StretchSpec } from '@/types/plan';
import { ChoiceRows, PrimaryButton, Segmented, Wrap } from './controls';
import { clock, kitLine, previewRows, talkSeconds, todayLine } from './preview';

/**
 * Stretch setup (codex-vision §4, Movement Setup): the area, the length, what
 * the routine holds and the one thing about today that changes it, then
 * Start. The choice lives in the address, so a reload keeps it.
 */
export function StretchScreen() {
  const { data, checkIns, profile, date } = useGuided();
  const [params, setParams] = useSearchParams();
  const { focus, minutes } = readStretchSpec(params, lastStretch(data.sessions));
  const spec: StretchSpec = { focus, minutes };
  // The effective check-ins, as the player builds from (an answer the device
  // refused to save still counts), so the preview never lists what won't run.
  const plan = useMemo(
    () => stretchPlanFor({ ...data, checkIns }, profile, date, { focus, minutes }),
    [data, checkIns, profile, date, focus, minutes],
  );
  const { start, sheet, permissionFor } = useStartMovement();
  const permit = permissionFor('stretch');
  const line = todayLine(plan, permit);
  const rows = previewRows(plan);
  const kit = kitLine(plan);
  const talk = Math.round(talkSeconds(plan) / 60);

  // Replace, not push: changing a choice is not a place to go Back to. The
  // page stays where it is rather than jumping to the top.
  const choose = (next: StretchSpec) => setParams(
    { focus: next.focus, minutes: String(next.minutes) },
    { replace: true, preventScrollReset: true },
  );
  const shortOnly = !stretchOffered({ focus, minutes: 10 });
  // Without a routine there is nothing the player could run; a refusal the
  // check-in explains still opens the check-in.
  const cannotStart = plan.kind === 'none' && permit.allowed && !permit.needsCheckIn;
  // A stop or a hold reads as one; the words carry it, the icon and its colour only echo them.
  const refused = plan.kind === 'none' || (!permit.allowed && !permit.needsCheckIn);
  const urgent = plan.readiness.outcome === 'urgent' || permit.disposition === 'emergency';
  // The engine refuses today, whatever the routine: no Start to invite it
  // (codex-vision §4, as Today's card does). The check-in stays one tap away.
  const stopped = !permit.allowed && !permit.needsCheckIn;

  return (
    <Screen title="Stretch" back={{ to: '/move', label: 'Move' }}>
      <Group header="Area">
        <ChoiceRows<StretchFocus>
          label="Area"
          options={STRETCH_FOCI.map(f => ({ value: f, label: STRETCH_FOCUS_LABEL[f] }))}
          value={focus}
          onChange={f => choose(offeredSpec({ focus: f, minutes }))}
        />
      </Group>

      <section aria-labelledby="stretch-length" className="flex flex-col">
        <h2 id="stretch-length" className="px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground">
          Length
        </h2>
        <Segmented<StretchMinutes>
          label="Length"
          options={STRETCH_MINUTES.map(m => ({ value: m, label: `${m} min`, disabled: !stretchOffered({ focus, minutes: m }) }))}
          value={minutes}
          onChange={m => choose({ focus, minutes: m })}
        />
        {shortOnly && (
          <p className="px-4 pt-2 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
            Ten minutes is Back &amp; hips only: every routine starts with the same spine and core basics, and they fill most of it.
          </p>
        )}
      </section>

      {line && (
        <p role="status" className="flex gap-3 rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)] leading-snug">
          {refused
            ? <TriangleAlertIcon className={cn('mt-0.5 size-5 shrink-0', urgent ? 'text-stop' : 'text-caution')} aria-hidden />
            : <InfoIcon className="mt-0.5 size-5 shrink-0 text-tint" aria-hidden />}
          <span className={cn('min-w-0', urgent && 'font-semibold text-stop')}>{line}</span>
        </p>
      )}

      {rows.length > 0 && (
        <Group
          header="In this routine"
          footer={[kit, talk > 0 ? `Plus about ${talk} ${talk === 1 ? 'minute' : 'minutes'} of welcome and wrap-up.` : null].filter(Boolean).join(' ')}
        >
          {/* Names wrap: a movement's name is the one thing in the row that must not be cut short. */}
          {rows.map(r => <Row key={r.id} label={<Wrap>{r.name}</Wrap>} detail={r.dose} value={clock(r.seconds)} numeric />)}
        </Group>
      )}

      {/* Start stays in reach above the tab bar while the routine scrolls past. */}
      {/* Full width by undoing the screen's own gutter, which stops growing at 20px:
          a plain -mx-4 doubles at 200% text and pushed the bar past the edge. */}
      <div className="sticky bottom-[calc(3.0625rem+env(safe-area-inset-bottom))] z-20 -mx-[min(1rem,20px)] flex flex-col gap-2 bg-grouped-bg/85 px-[min(1rem,20px)] pb-3 pt-2 backdrop-blur-xl supports-backdrop-filter:bg-grouped-bg/70 lg:bottom-0">
        {stopped ? (
          <button
            type="button"
            onClick={() => start('stretch', stretchHref(spec), 'Start stretch')}
            className="press-feedback min-h-12 rounded-xl text-[length:var(--text-body)] font-semibold text-tint"
          >
            Review today’s check-in
          </button>
        ) : (
          <PrimaryButton disabled={cannotStart} onClick={() => start('stretch', stretchHref(spec), 'Start stretch')}>
            Start stretch
          </PrimaryButton>
        )}
        {permit.needsCheckIn && plan.kind !== 'none' && (
          <p className="text-center text-[length:var(--text-footnote)] text-muted-foreground">A short check-in comes first.</p>
        )}
      </div>

      <p className="-mt-3 px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
        Stop if pain spreads down your leg, or you feel dizzy, short of breath or unwell. General information, not medical advice.
      </p>
      {sheet}
    </Screen>
  );
}
