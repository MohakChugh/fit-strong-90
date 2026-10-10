import { useState } from 'react';
import { Group } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { setSettings, useStore } from '@/store/useStore';
import { FOCUS_CHOICES } from '@/screens/welcome/focus';
import { ChoiceRows, Notice } from './controls';
import { ProgrammeGroup } from './ProgrammeGroup';

/**
 * The first-run answer, changeable. It only sets what Home leads with:
 * choosing Build strength does not join the 12-week programme, and choosing
 * anything else does not leave it (board D8).
 */
export function FocusScreen() {
  const { settings } = useStore();
  const [problem, setProblem] = useState<string>();
  return (
    <Screen title="What you’d like more of" back={{ to: '/me', label: 'Me' }}>
      <Group footer="Home suggests something to match. Choosing here does not join or leave the 12-week programme.">
        <ChoiceRows
          label="What you’d like more of"
          options={FOCUS_CHOICES.map(({ value, label, detail }) => ({ value, label, detail }))}
          value={settings.focus}
          onChange={focus => void setSettings({ focus }).then(saved => setProblem(saved.ok ? undefined : `That did not save. ${saved.failure.message}`))}
        />
      </Group>
      {problem && <Notice tone="error">{problem}</Notice>}
      <ProgrammeGroup />
    </Screen>
  );
}
