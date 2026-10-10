import { useState } from 'react';
import { Group } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { setSettings, useStore, type Theme } from '@/store/useStore';
import { ChoiceRows, Notice, type Choice } from './controls';

const THEMES: Choice<Theme>[] = [
  { value: 'system', label: 'Automatic', detail: 'Light or dark, following this device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Light, dark, or whatever the device is set to. */
export function AppearanceScreen() {
  const { settings } = useStore();
  const [problem, setProblem] = useState<string>();

  return (
    <Screen title="Appearance" back={{ to: '/you', label: 'You' }}>
      <Group header="Appearance">
        <ChoiceRows
          label="Appearance"
          options={THEMES}
          value={settings.theme}
          onChange={theme => void setSettings({ theme }).then(saved => setProblem(saved.ok ? undefined : `That did not save. ${saved.failure.message}`))}
        />
      </Group>
      {problem && <Notice tone="error">{problem}</Notice>}
    </Screen>
  );
}
