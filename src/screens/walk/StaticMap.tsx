import { useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { TILE_PX, type View } from '@/walk/route';
import { viewTiles } from '@/walk/tiles';

const pct = (px: number, of: number) => `${(px / of) * 100}%`;

/**
 * The map pictures under a finished walk's route (journey §9.5, M14, B-23):
 * the current view's tiles as plain <img>s, behind our own drawing. Each
 * fades in once it has loaded, at once under Reduce Motion. The frame shows
 * the attribution from the first tile. The browser's own cache and the page's
 * Referer apply; nothing here is fetched ahead.
 */
export function StaticMap({ view, onFail }: { view: View; onFail: () => void }) {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState<ReadonlySet<string>>(() => new Set());
  return (
    <div aria-hidden className="absolute inset-0">
      {viewTiles(view).map(t => (
        <img
          key={t.url}
          src={t.url}
          alt=""
          width={TILE_PX}
          height={TILE_PX}
          decoding="async"
          draggable={false}
          onLoad={() => setReady(prev => new Set(prev).add(t.url))}
          onError={onFail}
          className={cn('absolute max-w-none select-none', !reduce && 'transition-opacity duration-300', ready.has(t.url) ? 'opacity-100' : 'opacity-0')}
          style={{ left: pct(t.left, view.w), top: pct(t.top, view.h), width: pct(TILE_PX, view.w), height: pct(TILE_PX, view.h) }}
        />
      ))}
    </div>
  );
}
