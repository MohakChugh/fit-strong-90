import { useEffect, useState } from 'react';
import type { VoiceSettings } from '@/types/profile';
import { loadPackIndex, VOICE_PACKS } from '@/voice/packs';
import { ChipGroup, type ChipOption } from '@/components/profile/ChipGroup';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Toggle } from '@/screens/you/controls';
import { cn } from '@/lib/utils';
import { CheckIcon, MicIcon, PlayIcon, SquareIcon } from 'lucide-react';

const VERBOSITY: ChipOption<VoiceSettings['verbosity']>[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'standard', label: 'Standard' },
  { value: 'minimal', label: 'Minimal' },
];

const MODES: ChipOption<VoiceSettings['mode']>[] = [
  { value: 'coach', label: 'Pause my music' },
  { value: 'overMusic', label: 'Play over my music' },
];

// One element for previews, created on the first tap (iOS allows play() inside the gesture).
let sample: HTMLAudioElement | null = null;

/** Coach voice: recorded voice pack with previews, device-voice speed, detail level and mute. */
export function VoiceSettingsCard({ voice, onChange }: { voice: VoiceSettings; onChange: (patch: Partial<VoiceSettings>) => void }) {
  const base = import.meta.env.BASE_URL;
  // undefined = still checking; false = not recorded yet, so sessions use the device voice.
  const [recorded, setRecorded] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    void loadPackIndex(base, ctrl.signal).then(ids => {
      if (!ctrl.signal.aborted) setRecorded(Object.fromEntries(VOICE_PACKS.map(p => [p.id, ids.has(p.id)])));
    });
    return () => ctrl.abort();
  }, [base]);
  useEffect(() => () => sample?.pause(), []);

  const preview = (id: string) => {
    sample ??= new Audio();
    if (playing === id) { sample.pause(); setPlaying(null); return; }
    sample.src = `${base}voice/samples/${id}.m4a`;
    sample.onended = () => setPlaying(null);
    sample.onerror = () => setPlaying(null);
    setPlaying(id);
    void sample.play().catch(() => setPlaying(null));
  };

  const current = voice.pack ?? 'af_heart';
  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <MicIcon className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Coach voice</h2>
      </div>
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Voice</legend>
          <div role="radiogroup" aria-label="Voice" className="flex flex-col gap-2">
            {VOICE_PACKS.map(p => {
              const on = p.id === current;
              const status = recorded[p.id];
              return (
                // At large text the Preview button moves under the name rather than off the screen (D-10).
                <div key={p.id} className={cn('flex flex-wrap items-center gap-2 rounded-xl border p-1 pl-3', on && 'border-primary bg-primary/5')}>
                  <button type="button" role="radio" aria-checked={on} onClick={() => onChange({ pack: p.id })}
                    className="flex min-h-11 min-w-0 flex-1 basis-40 items-center gap-2 text-left [overflow-wrap:anywhere]">
                    <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border', on && 'border-primary bg-primary text-primary-foreground')}>
                      {on && <CheckIcon className="size-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {status === undefined ? 'Checking…' : status ? 'Recorded, natural voice' : 'Device voice fallback (not recorded yet)'}
                      </span>
                    </span>
                  </button>
                  <button type="button" onClick={() => preview(p.id)} aria-label={`${playing === p.id ? 'Stop' : 'Preview'} ${p.name}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted press-feedback">
                    {playing === p.id ? <SquareIcon className="size-4" /> : <PlayIcon className="size-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="voice-rate">Device voice speed: {voice.rate.toFixed(2)}×</Label>
          <Slider id="voice-rate" min={0.8} max={1.1} step={0.05} value={[voice.rate]}
            onValueChange={v => { const r = Array.isArray(v) ? v[0] : v; if (typeof r === 'number') onChange({ rate: r }); }} />
          <span className="text-sm text-muted-foreground">Only used when a recorded line isn’t available.</span>
        </div>

        <ChipGroup label="How much the coach explains" options={VERBOSITY} value={[voice.verbosity]}
          onChange={([v]) => onChange({ verbosity: v })}
          hint="Auto explains each exercise in full the first two times, then keeps to short cues." />

        <ChipGroup label="With your own music" options={MODES} value={[voice.mode]}
          onChange={([m]) => onChange({ mode: m })}
          hint="Over my music keeps your music playing under the coach. On iPhone and iPad the coach then follows the silent switch, so keep silent mode off to hear it." />

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium leading-none">Start sessions muted</span>
            <span className="text-sm text-muted-foreground">Captions only; unmute any time during a session.</span>
          </div>
          {/* The 44-point iOS switch the rest of You uses, named by its row. */}
          <Toggle checked={voice.muted} onChange={muted => onChange({ muted })} label="Start sessions muted" />
        </div>
      </div>
    </Card>
  );
}
