import { useState, type ReactNode } from 'react';
import { CandyIcon, HeartPulseIcon, PersonStandingIcon } from 'lucide-react';
import { Group } from '@/components/hig/List';
import { PERMISSION_TEXT } from '@/engine/permission';
import { CANNOT_SWALLOW } from '@/engine/readiness';
import type { GlucoseEntry, GlucoseReading, GlucoseUnit } from '@/types/checkin';
import { Segmented } from '@/components/checkin/parts';
import { typedReading } from '@/walk/low';
import { PrimaryButton } from './parts';

/** The player's unit buttons. */
const UNIT_CHOICE = 'min-h-11 rounded-lg bg-muted px-3 text-tint';

/**
 * The emergency instruction in the words every other screen uses. No number:
 * the app cannot know which country the person is in.
 */
function Emergency() {
  return (
    <p>
      <span className="font-semibold text-stop">{PERMISSION_TEXT.emergencyTitle}.</span> {PERMISSION_TEXT.emergencyCall}
    </p>
  );
}

function Item({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center text-tint [&_svg]:size-5">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-[length:var(--text-body)] font-semibold leading-snug">{title}</p>
        <div className="flex flex-col gap-2 text-[length:var(--text-body)] leading-snug">{children}</div>
      </div>
    </div>
  );
}

/**
 * After a walk ended for symptoms that need help now: the emergency
 * instruction, in the words every other screen uses.
 */
export function EmergencyGuidance() {
  return (
    <Group footer="General information, not medical advice.">
      <Item icon={<HeartPulseIcon />} title="Get help now">
        <Emergency />
      </Item>
    </Group>
  );
}

/**
 * After a walk ended for a low. What to do about the low itself depends on
 * where it stands — not treated yet, treated and waiting for the re-check, or
 * the re-check due — timed from the low and worded with the check-in's own
 * treatment sentence (`TREAT`, through `lowAdvice`), so a treated low is not
 * told to be treated "now" again (X2-13). Sources: clinical-tracking-protocols.md
 * H-HYPO (treat, re-check 15 minutes after, never resume just because a reading
 * crosses 70), E-HYPO (help when the person cannot safely treat it themselves),
 * and board D29(3).
 */
export function LowGuidance({ advice }: { advice?: { title: string; lines: string[] } }) {
  return (
    <Group header="After the low" footer="General information, not medical advice. Follow your care team’s plan if it says something different.">
      {advice && (
        <Item icon={<CandyIcon />} title={advice.title}>
          {advice.lines.map(line => <p key={line}>{line}</p>)}
          <p>Once your glucose is back up, eat a snack if your next meal is not soon.</p>
        </Item>
      )}
      <Item icon={<HeartPulseIcon />} title={CANNOT_SWALLOW.title}>
        <p>{CANNOT_SWALLOW.line}</p>
        <Emergency />
      </Item>
      <Item icon={<PersonStandingIcon />} title="This walk has ended">
        <p>Do not set off again just because a reading is back above 70. Wait until you feel well, and tell your care team if lows keep happening.</p>
      </Item>
    </Group>
  );
}

/**
 * While a walk is held after "I feel low" (re-audit N01): the reading that can
 * answer it, typed by the person and never filled in for them, with help
 * first for someone who cannot treat it safely. What the reading allows is
 * the engine's to say; this only saves it, timed when it is saved.
 */
export function LowFollowUp({ unit: initialUnit, source, onSave }: {
  unit: GlucoseUnit;
  source: GlucoseReading['source'];
  onSave: (reading: GlucoseEntry, symptomsGone: boolean, neededHelp: boolean) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  // A meter showing HI or LO has no number to type: asked as Quick Log and the check-in ask it.
  const [askDisplay, setAskDisplay] = useState(false);
  const [shows, setShows] = useState<'number' | 'HI' | 'LO'>('number');
  const display = shows === 'number' ? null : shows;
  const [unit, setUnit] = useState<GlucoseUnit>(initialUnit);
  /** The person said the number really is in the unit shown (the check-in's "really"). */
  const [unitConfirmed, setUnitConfirmed] = useState(false);
  const [gone, setGone] = useState(false);
  const [neededHelp, setNeededHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  // Judged as the check-in and the player judge it: a number that does not
  // fit the unit is asked about, and nothing is saved until it is answered (X2-18).
  const typed = value.trim();
  const { sanity, reading: typedNumber } = typedReading(value, unit, unitConfirmed, source);
  const reading: GlucoseEntry | undefined = display ? { display, ...(source ? { source } : {}) } : typedNumber;

  const save = async () => {
    if (!reading || busy) return;
    setBusy(true);
    try {
      await onSave(reading, gone, neededHelp);
      setValue('');
      setUnitConfirmed(false);
      setShows('number');
      setGone(false);
      setNeededHelp(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Group footer="General information, not medical advice. Follow your care team’s plan if it says something different.">
        <Item icon={<HeartPulseIcon />} title={CANNOT_SWALLOW.title}>
          <p>{CANNOT_SWALLOW.line}</p>
          <Emergency />
        </Item>
      </Group>
      <Group header="Your reading now">
        {!display && (
          <>
          <div className="flex items-center gap-2 px-4 py-2">
            <label htmlFor="walk-glucose" className="flex-1 text-[length:var(--text-body)]">Glucose now</label>
            <input
              id="walk-glucose"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={value}
              placeholder="Reading"
              onChange={e => { setValue(e.target.value.replace(',', '.')); setUnitConfirmed(false); }}
              className="h-11 w-24 rounded-lg bg-muted px-3 text-right text-base tabular-nums outline-none"
            />
            <button
              type="button"
              onClick={() => { setUnit(u => (u === 'mg/dL' ? 'mmol/L' : 'mg/dL')); setUnitConfirmed(false); }}
              aria-label={`Unit: ${unit}. Tap to change.`}
              className="min-h-11 min-w-[4.25rem] rounded-lg px-1 text-[length:var(--text-subhead)] text-tint"
            >
              {unit}
            </button>
          </div>
          {/* The player's and the check-in's unit questions, in their words. Over 34 mmol/L is past what a meter reads. */}
          {sanity === 'suspectUnit' && (
            <div role="alert" className="flex flex-col gap-2 px-4 py-3 text-[length:var(--text-subhead)] leading-snug">
              <p>That looks like mg/dL rather than mmol/L. Which does your meter show?</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setUnit('mg/dL')} className={UNIT_CHOICE}>{typed} mg/dL</button>
                <button type="button" onClick={() => setUnitConfirmed(true)} className={UNIT_CHOICE}>{typed} mmol/L, really</button>
              </div>
            </div>
          )}
          {/* Under 34 mg/dL is a severe low or a mmol/L number: asked plainly, without leaning either way. */}
          {sanity === 'ambiguousLow' && (
            <div role="alert" className="flex flex-col gap-2 px-4 py-3 text-[length:var(--text-subhead)] leading-snug">
              <p>Check the unit. Which does your meter show?</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setUnitConfirmed(true)} className={UNIT_CHOICE}>{typed} mg/dL</button>
                <button type="button" onClick={() => setUnit('mmol/L')} className={UNIT_CHOICE}>{typed} mmol/L</button>
              </div>
            </div>
          )}
          {sanity === 'implausible' && (
            <p role="alert" className="px-4 py-3 text-[length:var(--text-subhead)] text-stop">That reading can’t be used. Measure again and enter the number shown.</p>
          )}
          </>
        )}
        {/* Quick Log's and the check-in's question: a meter past what it can measure shows HI or LO, not a number. */}
        {askDisplay ? (
          <div className="flex flex-col gap-2 px-4 py-3">
            <span className="text-[length:var(--text-body)]">What the meter shows</span>
            <Segmented<'number' | 'HI' | 'LO'> label="What the meter shows" value={shows} onChange={setShows}
              options={[{ value: 'number', label: 'A number' }, { value: 'HI', label: 'HI' }, { value: 'LO', label: 'LO' }]} />
            {display && <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{`A meter shows ${display} when the glucose is past what it can measure.`}</p>}
          </div>
        ) : (
          <button type="button" onClick={() => setAskDisplay(true)} className="min-h-11 self-start px-4 text-[length:var(--text-body)] font-medium text-tint">
            Meter shows HI or LO?
          </button>
        )}
        <label className="flex min-h-11 items-start gap-3 px-4 py-3 text-[length:var(--text-subhead)] leading-snug">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={gone} onChange={e => setGone(e.target.checked)} />
          <span>My symptoms have gone, and my care plan lets me exercise after a treated low.</span>
        </label>
        {/* The player's question, in its words: a low someone else had to treat is a severe one (M-05). */}
        <label className="flex min-h-11 items-start gap-3 px-4 py-3 text-[length:var(--text-subhead)] leading-snug">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={neededHelp} onChange={e => setNeededHelp(e.target.checked)} />
          <span>Someone else had to help me treat this low.</span>
        </label>
        <div className="px-4 py-3">
          <PrimaryButton onClick={() => void save()} disabled={!reading || busy}>{busy ? 'Saving…' : 'Save this reading'}</PrimaryButton>
        </div>
      </Group>
    </>
  );
}
