import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { VoiceSettingsCard } from '@/components/profile/VoiceSettingsCard';
import { createDefaultProfile } from '@/profile/defaults';
import { MEAL_LABEL } from '@/reminders/copy';
import { factsOf } from '@/setup/facts';
import { CheckRows, ChoiceRows, TimeField, Toggle } from '@/screens/you/controls';
import {
  DEFAULT_FINISH, DEFAULT_QUIET, DEFAULT_SITTING, DEFAULT_WATER, GLASS_SIZES, SITTING_EVERY, WATER_EVERY, mealProblem, windowProblem,
} from '@/screens/you/habitOptions';
import { everyLabel } from '@/screens/you/summaries';
import type { Meal } from '@/types/habits';
import type { VoiceSettings } from '@/types/profile';
import { TRI } from '../choices';
import { Ask, Missing, type PageProps } from '../controls';

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner'];
/** Usual finish times for the meals chosen, labelled defaults until the person changes them (§6.1). */
const finishFor = (meals: readonly Meal[], kept: Partial<Record<Meal, string>> | undefined) =>
  Object.fromEntries(meals.map(m => [m, kept?.[m] ?? DEFAULT_FINISH[m]])) as Partial<Record<Meal, string>>;

/** Reminders (journey §6.2 ch. 8): water, sitting breaks, after-meal walks, quiet hours, and how reminders come. */
export function DayReminders({ a, set, tried }: PageProps) {
  const water = a.water ?? { on: false, ...DEFAULT_WATER };
  const sitting = a.sitting ?? { on: false, ...DEFAULT_SITTING };
  const walk = a.mealWalk ?? { on: false, meals: [] };
  const quiet = a.quiet;
  const footHeld = factsOf(a).footHeld;
  const waterIssue = water.on ? windowProblem(water.from, water.to, water.everyMinutes) : undefined;
  const sittingIssue = sitting.on ? windowProblem(sitting.from, sitting.to, sitting.everyMinutes) : undefined;

  return (
    <>
      <Group header="Water" footer={water.on ? 'Usual choices are filled in. Change them to yours.' : undefined}>
        <Row label="Water reminders" accessory={<Toggle label="Water reminders" checked={water.on} onChange={on => set({ water: { ...water, on } })} />} />
        {water.on && (
          <>
            <ChoiceRows label="Glass size" value={String(water.glassMl)} onChange={v => set({ water: { ...water, glassMl: Number(v) } })}
              options={GLASS_SIZES.map(ml => ({ value: String(ml), label: ml === DEFAULT_WATER.glassMl ? `Usual: ${ml} ml glass` : `${ml} ml glass` }))} />
            <ChoiceRows label="How often" value={String(water.everyMinutes)} onChange={v => set({ water: { ...water, everyMinutes: Number(v) } })}
              options={WATER_EVERY.map(m => ({ value: String(m), label: everyLabel(m) }))} />
            <TimeField id="setup-water-from" label="From" value={water.from} onChange={from => set({ water: { ...water, from } })} />
            <TimeField id="setup-water-to" label="Until" value={water.to} onChange={to => set({ water: { ...water, to } })} />
          </>
        )}
      </Group>
      <Missing show={tried && waterIssue !== undefined}>{waterIssue ?? ''}</Missing>
      {water.on && a.fluidLimit !== 'no' && (
        <Ask label="Has a doctor given you a fluid limit?" header="Has a doctor given you a fluid limit?" options={TRI} tried={tried}
          value={a.fluidLimit} onChange={fluidLimit => set({ fluidLimit })} footer="Water reminders are only for someone without a fluid limit." />
      )}
      {water.on && (a.fluidLimit === 'yes' || a.fluidLimit === 'unsure') && (
        <p role="status" className="px-4 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
          Water reminders stay off with a fluid limit, or while you’re not sure. Your care team’s plan comes first.
        </p>
      )}

      <Group header="Sitting breaks">
        <Row label="Sitting-break reminders" accessory={<Toggle label="Sitting-break reminders" checked={sitting.on} onChange={on => set({ sitting: { ...sitting, on } })} />} />
        {sitting.on && (
          <>
            <ChoiceRows label="How often" value={String(sitting.everyMinutes)} onChange={v => set({ sitting: { ...sitting, everyMinutes: Number(v) } })}
              options={SITTING_EVERY.map(m => ({ value: String(m), label: everyLabel(m) }))} />
            <TimeField id="setup-sitting-from" label="From" value={sitting.from} onChange={from => set({ sitting: { ...sitting, from } })} />
            <TimeField id="setup-sitting-to" label="Until" value={sitting.to} onChange={to => set({ sitting: { ...sitting, to } })} />
          </>
        )}
      </Group>
      <Missing show={tried && sittingIssue !== undefined}>{sittingIssue ?? ''}</Missing>

      {footHeld
        ? <Group><Row label="After-meal walks" detail="Not offered while a foot needs weight kept off it." /></Group>
        : (
          <Group header="After-meal walks">
            <Row label="After-meal walks" accessory={<Toggle label="After-meal walks" checked={walk.on}
              onChange={on => set({ mealWalk: { ...walk, on }, mealFinish: finishFor(walk.meals, a.mealFinish) })} />} />
            {walk.on && (
              <CheckRows label="After which meals?" value={walk.meals} options={MEALS.map(m => ({ value: m, label: MEAL_LABEL[m] }))}
                onChange={meals => set({ mealWalk: { ...walk, meals }, mealFinish: finishFor(meals, a.mealFinish) })} />
            )}
          </Group>
        )}
      <Missing show={tried && walk.on && !footHeld && walk.meals.length === 0}>Choose at least one meal.</Missing>

      <Group header="Quiet hours" footer="No reminders between these times.">
        <Row label="Quiet hours" accessory={<Toggle label="Quiet hours" checked={quiet !== undefined && quiet !== 'none'}
          onChange={on => set({ quiet: on ? { ...DEFAULT_QUIET } : 'none' })} />} />
        {quiet !== undefined && quiet !== 'none' && (
          <>
            <TimeField id="setup-quiet-from" label="From" value={quiet.from} onChange={from => set({ quiet: { ...quiet, from } })} />
            <TimeField id="setup-quiet-to" label="Until" value={quiet.to} onChange={to => set({ quiet: { ...quiet, to } })} />
          </>
        )}
      </Group>

      <Ask label="How reminders come" header="How reminders come" tried={false} value={a.delivery ?? 'app'} onChange={delivery => set({ delivery })}
        options={[{ value: 'app', label: 'In the app' }, { value: 'calendar', label: 'As a calendar file' }]}
        footer="In the app, while FitStrong is open. A calendar file goes into your phone’s own calendar." />
    </>
  );
}

/** Usual meal times, only with after-meal walks on (L-11): the walk's own times (`habits.mealWalk.finish`, board D82). */
export function DayMeals({ a, set, tried }: PageProps) {
  const meals = a.mealWalk?.meals ?? [];
  const finish = finishFor(meals, a.mealFinish);
  const problem = mealProblem(meals, a.mealFinish ?? {});
  return (
    <>
      <Group footer="Usual times are filled in. Change them to yours: a short walk is suggested soon after.">
        {meals.map(m => (
          <TimeField key={m} id={`setup-finish-${m}`} label={MEAL_LABEL[m]} value={finish[m] ?? ''} onChange={t => set({ mealFinish: { ...finish, [m]: t } })} />
        ))}
      </Group>
      <Missing show={tried && problem !== undefined}>{problem ?? ''}</Missing>
    </>
  );
}

/** The voice coach, on or off, with "Hear the voices" to choose one (optional). */
export function DayVoice({ a, set }: PageProps) {
  const [open, setOpen] = useState(false);
  const voice: VoiceSettings = { ...createDefaultProfile().voice, ...a.voice };
  return (
    <>
      <Ask label="Voice coach" header="Voice coach" tried={false} value={voice.muted ? 'off' : 'on'} onChange={v => set({ voice: { ...a.voice, muted: v === 'off' } })}
        options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} footer="It talks you through each exercise. You can turn it off any time." />
      <Group>
        <Row onClick={() => setOpen(true)} label="Hear the voices" detail="Optional: choose the one you like" chevron />
      </Group>
      <Sheet open={open} onOpenChange={setOpen} title="Voices" detent="large">
        <VoiceSettingsCard voice={voice} onChange={patch => set({ voice: { ...a.voice, ...patch } })} />
      </Sheet>
    </>
  );
}
