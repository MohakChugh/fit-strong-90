import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { TextScale } from '@/lib/textSize';
import type { StoreResult } from '@/store/db';
import { setSettings, useStore, type Theme } from '@/store/useStore';
import { ChoiceRows, Notice, Toggle, type Choice } from './controls';
import { TEXT_SIZE_CHOICES, displayChoices, fadeTheme, readSystemDisplay } from './display';
import { changeDisplay } from './write';

const THEMES: Choice<Theme>[] = [
  { value: 'system', label: 'Automatic', detail: 'Light or dark, following this device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Display (journey §16), at `/me/display`. */
export function DisplayScreen() {
  return (
    <Screen title="Display" back={{ to: '/me', label: 'Me' }}>
      <DisplayControls />
    </Screen>
  );
}

/**
 * Display's controls: theme, text size, Reduce motion and Reduce
 * transparency. Text size and the two switches change the app at once; the
 * theme fades (M23). Where the device asks for less motion or transparency,
 * its switch is on and says so. Setup's first page shows the same controls
 * (Plan 5).
 */
export function DisplayControls() {
  const { settings } = useStore();
  const reduced = useReducedMotion();
  // Read once per visit: the device's own settings are changed outside the app.
  const [system] = useState(() => readSystemDisplay());
  const [problem, setProblem] = useState<string>();
  const choices = displayChoices(settings.display, system);
  const report = (saved: StoreResult) => setProblem(saved.ok ? undefined : `That did not save. ${saved.failure.message}`);
  // A refused write puts the stored theme back by itself: the store drops the change, and App's effect draws what is stored.
  const chooseTheme = (theme: Theme) => fadeTheme(() => void setSettings({ theme }).then(report), reduced);

  return (
    <>
      <Group header="Theme">
        <ChoiceRows label="Theme" options={THEMES} value={settings.theme} onChange={chooseTheme} />
      </Group>
      <Group header="Text size" footer="If this device’s own text size is larger, the app uses that.">
        <ChoiceRows
          label="Text size"
          options={TEXT_SIZE_CHOICES}
          value={`${settings.display?.textScale ?? 1}` as `${TextScale}`}
          onChange={value => void changeDisplay(d => ({ ...d, textScale: Number(value) })).then(report)}
        />
      </Group>
      <Group header="Motion and transparency">
        <Row
          label="Reduce motion"
          detail={choices.reduceMotion.bySystem ? 'On, because this device’s Reduce Motion is on.' : 'Slides and zooms become gentle fades.'}
          accessory={<Toggle checked={choices.reduceMotion.on} disabled={choices.reduceMotion.bySystem} label="Reduce motion"
            onChange={on => void changeDisplay(d => ({ ...d, reduceMotion: on })).then(report)} />}
        />
        <Row
          label="Reduce transparency"
          detail={choices.reduceTransparency.bySystem ? 'On, because this device asks for more contrast or less transparency.' : 'Makes the tab bar and headers solid.'}
          accessory={<Toggle checked={choices.reduceTransparency.on} disabled={choices.reduceTransparency.bySystem} label="Reduce transparency"
            onChange={on => void changeDisplay(d => ({ ...d, reduceTransparency: on })).then(report)} />}
        />
      </Group>
      {problem && <Notice tone="error">{problem}</Notice>}
    </>
  );
}
