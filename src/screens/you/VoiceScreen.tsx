import { useState } from 'react';
import { Group } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { VoiceSettingsCard } from '@/components/profile/VoiceSettingsCard';
import { createDefaultProfile } from '@/profile/defaults';
import { useStore } from '@/store/useStore';
import { packName } from '@/voice/packs';
import { ChoiceRows, Notice } from './controls';
import { changeProfile } from './write';

/** The coach's voice and the body the 3D demonstrations use. */
export function VoiceScreen() {
  const { profile } = useStore();
  const voice = (profile ?? createDefaultProfile()).voice;
  const [outcome, setOutcome] = useState<{ tone: 'status' | 'error'; text: string }>();

  const write = async (edit: Parameters<typeof changeProfile>[0], done?: string) => {
    const saved = await changeProfile(edit);
    setOutcome(saved.ok
      ? done ? { tone: 'status', text: done } : undefined
      : { tone: 'error', text: `That did not save. ${saved.failure.message}` });
  };

  return (
    <Screen title="Voice & demos" back={{ to: '/you', label: 'You' }}>
      <VoiceSettingsCard
        voice={voice}
        onChange={patch => void write(
          current => ({ ...current, voice: { ...current.voice, ...patch } }),
          patch.pack ? `Coach voice: ${packName(patch.pack)}.` : undefined,
        )}
      />
      <Group header="3D demonstrations" footer="The body the form demonstrations show. It changes nothing else.">
        <ChoiceRows
          label="Demonstration figure"
          options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]}
          value={profile?.figure ?? 'male'}
          onChange={figure => void write(current => ({ ...current, figure }))}
        />
      </Group>
      {outcome && <Notice tone={outcome.tone}>{outcome.text}</Notice>}
    </Screen>
  );
}
