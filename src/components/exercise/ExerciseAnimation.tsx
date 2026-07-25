import { useId, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getExerciseAnimation } from './animations';
import { resolvePose, round, type EmphasisRegion, type Prop, type ResolvedJoints } from './rig';

/**
 * Renders an exercise's form animation as an inline SVG.
 *
 * The animation is driven entirely by SVG SMIL `<animate>` elements rather than
 * CSS or JS. Three reasons:
 *   1. Attribute-level interpolation, so each joint tweens independently.
 *   2. The browser runs it off the main thread, so 45 of these do not compete
 *      with React renders.
 *   3. `begin`/`end` on the animation elements lets us hard-stop when the card
 *      collapses, which a CSS animation cannot do as cleanly per-element.
 *
 * When `playing` is false, the figure renders as a static start pose — useful
 * for list views where 45 simultaneous animations would drop frames.
 */

interface ExerciseAnimationProps {
  exerciseId: string;
  playing?: boolean;
  className?: string;
  /** Accessible description; falls back to a generic label. */
  label?: string;
}

const SKIN = 'var(--exercise-figure)';
const EQUIP = 'var(--exercise-equipment)';

export function ExerciseAnimation({
  exerciseId,
  playing: playingProp = true,
  className,
  label,
}: ExerciseAnimationProps) {
  const uid = useId().replace(/:/g, '');
  const reducedMotion = useReducedMotion();
  const anim = getExerciseAnimation(exerciseId);

  // SMIL ignores CSS animation overrides, so reduced motion must freeze it here.
  const playing = playingProp && !reducedMotion;

  const frames = useMemo(() => {
    if (!anim) return null;
    // Ping-pong the poses so the rep returns to its start rather than snapping.
    const cycle = [...anim.poses, ...anim.poses.slice(1, -1).reverse()];
    const loop = cycle.length > 1 ? [...cycle, cycle[0]] : cycle;
    return loop.map(resolvePose);
  }, [anim]);

  if (!anim || !frames) {
    return <ExerciseAnimationFallback className={className} />;
  }

  const dur = `${anim.duration}s`;
  const keyTimes = frames.map((_, i) => round(i / (frames.length - 1))).join(';');

  /** Emit an <animate> for one attribute across all frames. */
  const animate = (attr: string, values: (number | string)[]) =>
    playing ? (
      <animate
        attributeName={attr}
        values={values.join(';')}
        keyTimes={keyTimes}
        dur={dur}
        repeatCount="indefinite"
        calcMode="spline"
        keySplines={frames.slice(1).map(() => '0.42 0 0.58 1').join(';')}
      />
    ) : null;

  const limb = (
    key: string,
    from: keyof ResolvedJoints,
    to: keyof ResolvedJoints,
    width: number
  ) => (
    <line
      key={key}
      x1={round(frames[0][from].x)}
      y1={round(frames[0][from].y)}
      x2={round(frames[0][to].x)}
      y2={round(frames[0][to].y)}
      stroke={SKIN}
      strokeWidth={width}
      strokeLinecap="round"
    >
      {animate('x1', frames.map(f => round(f[from].x)))}
      {animate('y1', frames.map(f => round(f[from].y)))}
      {animate('x2', frames.map(f => round(f[to].x)))}
      {animate('y2', frames.map(f => round(f[to].y)))}
    </line>
  );

  const emphasisOn = anim.contractionIndex ?? 0;

  return (
    <svg
      viewBox={anim.viewBox ?? '0 0 100 100'}
      className={cn('exercise-anim h-full w-full', className)}
      role="img"
      aria-label={label ?? `Animated demonstration of correct form`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Soft glow used for the working-muscle highlight */}
        <radialGradient id={`glow-${uid}`}>
          <stop offset="0%" stopColor="var(--exercise-emphasis)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--exercise-emphasis)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Equipment sits behind the figure */}
      <g>
        {anim.props.map((prop, i) => (
          <EquipmentProp
            key={i}
            prop={prop}
            frames={frames}
            keyTimes={keyTimes}
            dur={dur}
            playing={playing}
          />
        ))}
      </g>

      {/* Working-muscle glow, pulsing in time with the contraction */}
      {anim.emphasis.length > 0 && (
        <MuscleGlow
          regions={anim.emphasis}
          frames={frames}
          frameCount={frames.length}
          contractionIndex={emphasisOn}
          gradientId={`glow-${uid}`}
          dur={dur}
          playing={playing}
        />
      )}

      {/* Far-side limbs, drawn dimmer to create depth */}
      <g opacity="0.45">
        {limb('far-thigh', 'hip', 'farKnee', 6.5)}
        {limb('far-shin', 'farKnee', 'farAnkle', 5)}
        {limb('far-upper', 'shoulder', 'farElbow', 5.5)}
        {limb('far-fore', 'farElbow', 'farWrist', 4.5)}
      </g>

      {/* Torso as a tapered filled shape */}
      <Torso frames={frames} animate={animate} />

      {/* Near-side limbs */}
      {limb('thigh', 'hip', 'knee', 7)}
      {limb('shin', 'knee', 'ankle', 5.5)}
      {limb('upper-arm', 'shoulder', 'elbow', 6)}
      {limb('forearm', 'elbow', 'wrist', 5)}

      {/* Head */}
      <circle
        cx={round(frames[0].head.x)}
        cy={round(frames[0].head.y)}
        r="5.6"
        fill={SKIN}
      >
        {animate('cx', frames.map(f => round(f.head.x)))}
        {animate('cy', frames.map(f => round(f.head.y)))}
      </circle>

      {/* Hands, drawn last so they read on top of equipment */}
      <circle cx={round(frames[0].wrist.x)} cy={round(frames[0].wrist.y)} r="2.6" fill={SKIN}>
        {animate('cx', frames.map(f => round(f.wrist.x)))}
        {animate('cy', frames.map(f => round(f.wrist.y)))}
      </circle>

      {/* Feet */}
      <circle cx={round(frames[0].ankle.x)} cy={round(frames[0].ankle.y)} r="2.8" fill={SKIN}>
        {animate('cx', frames.map(f => round(f.ankle.x)))}
        {animate('cy', frames.map(f => round(f.ankle.y)))}
      </circle>
    </svg>
  );
}

/** Torso rendered as a polygon from hip to shoulders, so it reads as a body. */
function Torso({
  frames,
  animate,
}: {
  frames: ResolvedJoints[];
  animate: (attr: string, values: (number | string)[]) => React.ReactNode;
}) {
  const points = (f: ResolvedJoints) => {
    // Widen at the shoulders, taper to the hip, for a silhouette read.
    const dx = f.shoulder.x - f.hip.x;
    const dy = f.shoulder.y - f.hip.y;
    const len = Math.hypot(dx, dy) || 1;
    // Perpendicular unit vector
    const px = -dy / len;
    const py = dx / len;
    const shoulderW = 7.5;
    const hipW = 5;
    return [
      `${round(f.shoulder.x + px * shoulderW)},${round(f.shoulder.y + py * shoulderW)}`,
      `${round(f.shoulder.x - px * shoulderW)},${round(f.shoulder.y - py * shoulderW)}`,
      `${round(f.hip.x - px * hipW)},${round(f.hip.y - py * hipW)}`,
      `${round(f.hip.x + px * hipW)},${round(f.hip.y + py * hipW)}`,
    ].join(' ');
  };

  return (
    <polygon points={points(frames[0])} fill={SKIN}>
      {animate('points', frames.map(points))}
    </polygon>
  );
}

/** Pulsing highlight over the muscle group being trained. */
function MuscleGlow({
  frames,
  frameCount,
  contractionIndex,
  gradientId,
  dur,
  playing,
}: {
  regions: EmphasisRegion[];
  frames: ResolvedJoints[];
  frameCount: number;
  contractionIndex: number;
  gradientId: string;
  dur: string;
  playing: boolean;
}) {
  // Anchor the glow to the chest joint, which sits mid-torso for every pose.
  const cx = frames.map(f => round(f.chest.x));
  const cy = frames.map(f => round(f.chest.y));

  // Peak opacity at the contraction frame, near-zero elsewhere.
  const opacities = frames.map((_, i) => {
    const distance = Math.min(
      Math.abs(i - contractionIndex),
      Math.abs(i - (frameCount - 1 - contractionIndex))
    );
    return distance === 0 ? 1 : distance === 1 ? 0.35 : 0.05;
  });
  const keyTimes = frames.map((_, i) => round(i / (frameCount - 1))).join(';');

  return (
    <circle cx={cx[0]} cy={cy[0]} r="15" fill={`url(#${gradientId})`} opacity={playing ? 0.05 : 0.25}>
      {playing && (
        <>
          <animate attributeName="cx" values={cx.join(';')} keyTimes={keyTimes} dur={dur} repeatCount="indefinite" />
          <animate attributeName="cy" values={cy.join(';')} keyTimes={keyTimes} dur={dur} repeatCount="indefinite" />
          <animate
            attributeName="opacity"
            values={opacities.join(';')}
            keyTimes={keyTimes}
            dur={dur}
            repeatCount="indefinite"
          />
        </>
      )}
    </circle>
  );
}

/** Equipment: benches, bars, cables, machine frames. */
function EquipmentProp({
  prop,
  frames,
  keyTimes,
  dur,
  playing,
}: {
  prop: Prop;
  frames: ResolvedJoints[];
  keyTimes: string;
  dur: string;
  playing: boolean;
}) {
  const track = (attr: string, values: number[]) =>
    playing ? (
      <animate
        attributeName={attr}
        values={values.map(round).join(';')}
        keyTimes={keyTimes}
        dur={dur}
        repeatCount="indefinite"
        calcMode="spline"
        keySplines={values.slice(1).map(() => '0.42 0 0.58 1').join(';')}
      />
    ) : null;

  switch (prop.kind) {
    case 'floor':
      return (
        <line
          x1="4" y1={prop.y} x2="96" y2={prop.y}
          stroke={EQUIP} strokeWidth="2" strokeLinecap="round" opacity="0.5"
        />
      );

    case 'mat':
      return (
        <rect
          x="10" y={prop.y - 2} width="80" height="4" rx="2"
          fill={EQUIP} opacity="0.35"
        />
      );

    case 'bench': {
      const x = prop.x ?? 28;
      const w = prop.width ?? 40;
      const incline = prop.incline ?? 0;
      return (
        <g opacity="0.55">
          <rect
            x={x} y={prop.y} width={w} height="4" rx="2"
            fill={EQUIP}
            transform={incline ? `rotate(${-incline} ${x + w / 2} ${prop.y + 2})` : undefined}
          />
          <line x1={x + 4} y1={prop.y + 4} x2={x + 4} y2="92" stroke={EQUIP} strokeWidth="2.5" />
          <line x1={x + w - 4} y1={prop.y + 4} x2={x + w - 4} y2="92" stroke={EQUIP} strokeWidth="2.5" />
        </g>
      );
    }

    case 'barbell': {
      const grip = prop.grip;
      const w = (prop.width ?? 32) / 2;
      const xs = frames.map(f => f[grip].x);
      const ys = frames.map(f => f[grip].y);
      return (
        <g>
          <line
            x1={round(xs[0] - w)} y1={round(ys[0])}
            x2={round(xs[0] + w)} y2={round(ys[0])}
            stroke={EQUIP} strokeWidth="2.5" strokeLinecap="round"
          >
            {track('x1', xs.map(v => v - w))}
            {track('y1', ys)}
            {track('x2', xs.map(v => v + w))}
            {track('y2', ys)}
          </line>
          {/* Plates at each end */}
          {[-w, w].map((off, i) => (
            <rect
              key={i}
              x={round(xs[0] + off - 1.6)} y={round(ys[0] - 5)}
              width="3.2" height="10" rx="1.2"
              fill={EQUIP}
            >
              {track('x', xs.map(v => v + off - 1.6))}
              {track('y', ys.map(v => v - 5))}
            </rect>
          ))}
        </g>
      );
    }

    case 'dumbbell': {
      const xs = frames.map(f => f[prop.grip].x);
      const ys = frames.map(f => f[prop.grip].y);
      return (
        <g>
          <rect x={round(xs[0] - 4.5)} y={round(ys[0] - 2)} width="9" height="4" rx="1.5" fill={EQUIP}>
            {track('x', xs.map(v => v - 4.5))}
            {track('y', ys.map(v => v - 2))}
          </rect>
          {[-4.5, 3].map((off, i) => (
            <rect key={i} x={round(xs[0] + off)} y={round(ys[0] - 3.6)} width="1.6" height="7.2" rx="0.8" fill={EQUIP}>
              {track('x', xs.map(v => v + off))}
              {track('y', ys.map(v => v - 3.6))}
            </rect>
          ))}
        </g>
      );
    }

    case 'ball': {
      const xs = frames.map(f => f[prop.grip].x);
      const ys = frames.map(f => f[prop.grip].y);
      return (
        <circle cx={round(xs[0])} cy={round(ys[0])} r={prop.r ?? 4.5} fill={EQUIP} opacity="0.8">
          {track('cx', xs)}
          {track('cy', ys)}
        </circle>
      );
    }

    case 'cableStack': {
      const xs = frames.map(f => f[prop.attachTo].x);
      const ys = frames.map(f => f[prop.attachTo].y);
      return (
        <g opacity="0.6">
          {/* Column */}
          <rect x={prop.x - 3} y={prop.topY} width="6" height={Math.max(4, 90 - prop.topY)} rx="2" fill={EQUIP} opacity="0.45" />
          {/* Cable running to the hand */}
          <line
            x1={prop.x} y1={prop.topY + 2}
            x2={round(xs[0])} y2={round(ys[0])}
            stroke={EQUIP} strokeWidth="1.4"
          >
            {track('x2', xs)}
            {track('y2', ys)}
          </line>
        </g>
      );
    }

    case 'machineFrame':
      return (
        <rect
          x={prop.x} y={prop.y} width={prop.w} height={prop.h} rx="2.5"
          fill="none" stroke={EQUIP} strokeWidth="2" opacity="0.4"
        />
      );

    case 'pullupBar':
      return (
        <g opacity="0.55">
          <line x1="18" y1={prop.y} x2="82" y2={prop.y} stroke={EQUIP} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="22" y1={prop.y} x2="22" y2={prop.y - 8} stroke={EQUIP} strokeWidth="2" />
          <line x1="78" y1={prop.y} x2="78" y2={prop.y - 8} stroke={EQUIP} strokeWidth="2" />
        </g>
      );

    case 'treadmill':
      return (
        <g opacity="0.5">
          <rect x="18" y={prop.y} width="64" height="5" rx="2.5" fill={EQUIP} />
          <line x1="78" y1={prop.y} x2="82" y2={prop.y - 26} stroke={EQUIP} strokeWidth="2" />
          <line x1="74" y1={prop.y - 26} x2="88" y2={prop.y - 26} stroke={EQUIP} strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    case 'bike':
      return (
        <g opacity="0.5">
          <circle cx="36" cy={prop.y} r="9" fill="none" stroke={EQUIP} strokeWidth="2" />
          <circle cx="70" cy={prop.y} r="9" fill="none" stroke={EQUIP} strokeWidth="2" />
          <line x1="36" y1={prop.y} x2="52" y2={prop.y - 20} stroke={EQUIP} strokeWidth="2" />
          <line x1="70" y1={prop.y} x2="58" y2={prop.y - 24} stroke={EQUIP} strokeWidth="2" />
          <line x1="50" y1={prop.y - 26} x2="62" y2={prop.y - 26} stroke={EQUIP} strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    case 'foamRoller':
      return <circle cx={prop.x} cy={prop.y} r="5" fill={EQUIP} opacity="0.5" />;

    default:
      return null;
  }
}

/** Shown when an exercise has no animation defined yet. */
function ExerciseAnimationFallback({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center rounded-lg bg-muted/40',
        className
      )}
      role="img"
      aria-label="No form animation available for this exercise"
    >
      <span className="text-xs text-muted-foreground">No demo available</span>
    </div>
  );
}
