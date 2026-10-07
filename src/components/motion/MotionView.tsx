import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PauseIcon, PlayIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Runtime = typeof import('@/motion/runtime');
type Viewer = InstanceType<Runtime['MotionViewer']>;

/** The movement stage the coach is counting, so the demo moves in step with the voice. */
export interface RepSync {
  /** Changes for every new segment. */
  key: string;
  /** 0 first movement, 1 pause, 2 return, 3 pause at the start. */
  stage: 0 | 1 | 2 | 3;
  seconds: number;
  elapsed: number;
}

export interface MotionViewProps {
  exerciseId: string;
  /** Exercise name for screen readers. */
  name?: string;
  side?: 'left' | 'right';
  /** Mistake clip id (`${exerciseId}.${slug}`) to replay in red, or null for correct form. */
  mistake?: string | null;
  playing?: boolean;
  sync?: RepSync | null;
  figure?: 'male' | 'female';
  /** Shown until the 3D demo is ready, and instead of it when there's no clip or no WebGL. */
  fallback?: ReactNode;
  className?: string;
  /** Show a pause/play button. It is always shown when the user prefers reduced motion. */
  controls?: boolean;
}

let runtime: Promise<Runtime> | null = null;
const loadRuntime = () => (runtime ??= import('@/motion/runtime'));

let webgl: boolean | null = null;
function hasWebGL2(): boolean {
  if (webgl === null) {
    try { webgl = !!document.createElement('canvas').getContext('webgl2'); } catch { webgl = false; }
  }
  return webgl;
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Lazy-loaded 3D form demo of one exercise: a realistic figure doing the
 * movement, with working muscles tinted and faults replayed in red. Drag
 * sideways to look around it.
 */
export function MotionView({ exerciseId, name, side = 'left', mistake = null, playing = true, sync = null, figure = 'male', fallback, className, controls }: MotionViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<{ mod: Runtime; v: Viewer } | null>(null);
  const [failed, setFailed] = useState(() => !hasWebGL2());
  // The movement is the lesson, so it plays even when the device asks for
  // reduced motion; those users always get the pause button instead.
  const [paused, setPaused] = useState(false);
  const elapsed = useRef(0);

  // One viewer per figure; clip changes reuse it.
  useEffect(() => {
    if (!hasWebGL2() || !host.current) return;
    let cancelled = false;
    let v: Viewer | null = null;
    loadRuntime().then(async mod => {
      if (cancelled || !host.current) return;
      v = new mod.MotionViewer(host.current, { modelUrl: `${import.meta.env.BASE_URL}models/coach-${figure}.bin` });
      await v.load();
      if (!cancelled) setApi({ mod, v });
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; v?.dispose(); setApi(null); };
  }, [figure]);

  const clip = api?.mod.getClip(exerciseId) ?? null;
  const label = clip?.mistakes?.find(m => m.id === mistake)?.label ?? null;
  const ready = !!api && !!clip;

  useEffect(() => {
    if (api && clip) api.v.setClip(clip, { side, mistake, highlight: api.mod.highlightFor(clip.id) });
  }, [api, clip, side, mistake]);

  useEffect(() => { elapsed.current = sync?.elapsed ?? 0; });
  const stage = sync?.stage, seconds = sync?.seconds, syncKey = sync?.key;
  useEffect(() => {
    if (!api || !clip) return;
    if (!playing || paused) {
      api.v.setPlaying(false);
      // A still shows the most telling moment: the hardest point of the movement.
      if (paused) api.v.setPhase(api.mod.repTimeline(clip)?.a ?? 0.4);
      return;
    }
    const tl = stage !== undefined ? api.mod.repTimeline(clip) : null;
    if (tl && stage !== undefined && seconds) {
      const [from, to] = [[0, tl.a], [tl.a, tl.b], [tl.b, tl.c], [tl.c, 1]][stage];
      api.v.playSpan(from, to, seconds, elapsed.current);
    } else {
      api.v.setPlaying(true);
    }
  }, [api, clip, playing, paused, stage, seconds, syncKey]);

  const showControls = controls || reducedMotion();
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border', className)}
      style={{ background: 'linear-gradient(170deg, color-mix(in oklab, var(--muted) 55%, transparent), transparent 75%)' }}>
      <div ref={host} className="absolute inset-0" role="img"
        aria-label={`3D demonstration${name ? ` of ${name}` : ''}${label ? `, showing what not to do: ${label}` : ''}${side === 'right' ? ', right side' : ''}. Drag sideways to look around.`} />
      {(!ready || failed) && <div className="absolute inset-0 bg-background">{fallback}</div>}
      {ready && label && (
        <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-[var(--safety)] px-2.5 py-1 text-xs font-semibold text-white shadow">
          <XIcon className="size-3.5" aria-hidden /> {label}
        </span>
      )}
      {ready && showControls && (
        <button type="button" onClick={() => setPaused(p => !p)} aria-label={paused ? 'Play demonstration' : 'Pause demonstration'}
          className="absolute bottom-2 right-2 flex size-11 items-center justify-center rounded-full bg-background/80 shadow backdrop-blur">
          {paused ? <PlayIcon className="size-5" /> : <PauseIcon className="size-5" />}
        </button>
      )}
    </div>
  );
}
