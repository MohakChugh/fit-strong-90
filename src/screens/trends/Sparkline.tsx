/**
 * A category's last days or readings, drawn small beside its row on the
 * Trends tab. The row's words carry the figure, so this is hidden from
 * VoiceOver, and from narrow rows at large text.
 */
export function Sparkline({ values, colour, kind }: { values: readonly (number | null)[]; colour: string; kind: 'bars' | 'line' }) {
  const W = 56;
  const H = 24;
  const shown = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (shown.length === 0) return null;
  let low = kind === 'bars' ? 0 : Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const v of shown) {
    if (v < low) low = v;
    if (v > high) high = v;
  }
  const span = high - low || 1;
  const y = (v: number) => H - 2 - ((v - low) / span) * (H - 4);
  const step = W / values.length;
  const points = values.flatMap((v, i) => (v === null ? [] : [{ x: (i + 0.5) * step, y: y(v) }]));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="shrink-0 @max-[16rem]:hidden">
      {kind === 'bars'
        ? values.map((v, i) => (v === null ? null : (
          <rect key={i} x={i * step + step * 0.2} y={y(v)} width={step * 0.6} height={Math.max(1, H - 2 - y(v))} rx={1} style={{ fill: colour }} />
        )))
        : points.length === 1
          ? <circle cx={points[0].x} cy={points[0].y} r={2.5} style={{ fill: colour }} />
          : <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" style={{ stroke: colour }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
    </svg>
  );
}
