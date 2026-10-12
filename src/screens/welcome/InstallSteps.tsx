import type { ReactNode } from 'react';
import { EllipsisIcon, HouseIcon, ShareIcon, SquarePlusIcon } from 'lucide-react';

/** A picture of the control Safari shows, so the step can be matched by eye. */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-separator bg-grouped-bg text-tint [&_svg]:size-6">
      {children}
    </span>
  );
}

function Step({ n, glyph, title, children }: { n: number; glyph: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span aria-hidden className="numeric mt-2.5 w-4 shrink-0 text-center text-[length:var(--text-subhead)] font-semibold text-muted-foreground">{n}</span>
      {glyph}
      <span className="min-w-0 flex-1">
        <span className="block text-[length:var(--text-body)] font-medium leading-snug">{title}</span>
        <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{children}</span>
      </span>
    </li>
  );
}

/**
 * Adding the app to the Home Screen, as three steps in Safari's own symbols.
 * Safari moves its Share button between versions, so the first step says
 * where else to look rather than pretending there is one place.
 */
export function InstallSteps({ device }: { device: string }) {
  return (
    <ol aria-label="How to add the app to your Home Screen" className="overflow-hidden rounded-xl bg-grouped-card [&>*+*]:border-t [&>*+*]:border-separator">
      <Step n={1} glyph={<Glyph><ShareIcon /></Glyph>} title="Tap Share">
        The square with an arrow, at the bottom or top of Safari. In newer Safari, first tap More{' '}
        <EllipsisIcon className="inline size-4 align-[-0.15em] text-foreground" aria-hidden />.
      </Step>
      <Step n={2} glyph={<Glyph><SquarePlusIcon /></Glyph>} title="Choose Add to Home Screen">
        You may need to scroll the list or tap More to find it. Then tap Add.
      </Step>
      <Step n={3} glyph={<Glyph><HouseIcon /></Glyph>} title="Open it from your Home Screen">
        {`It sits with your other apps on this ${device}. Start there, so your record is kept there.`}
      </Step>
    </ol>
  );
}
