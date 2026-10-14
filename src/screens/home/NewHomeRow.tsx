import { useState } from 'react';
import { Sheet } from '@/components/hig/Sheet';
import { withNewHomeSeen } from '@/setup/state';
import { PrimaryButton } from '@/screens/you/controls';
import { update } from '@/store/useStore';

const CARDS = [
  { title: 'Your tiles are here', text: 'Home has a tile for each thing you keep track of, worked out from your answers. Edit Home changes them.' },
  { title: 'Trends is new', text: 'Trends shows how each one is going, week by week.' },
  { title: 'Browse is new', text: 'Browse lists everything FitStrong has, with a search.' },
] as const;

/**
 * The one-time "FitStrong has a new Home" row (journey §6.6, K-56): inline,
 * directly under the Right now card, never floating. "Show me" walks three
 * short cards; "Got it", or Done on the last card, stores the answer, and the
 * row goes for good.
 */
export function NewHomeRow() {
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState(0);
  const [problem, setProblem] = useState<string>();
  const seen = async () => {
    const saved = await update(withNewHomeSeen);
    if (!saved.ok) setProblem(`That did not save. ${saved.failure.message}`);
  };
  const last = card === CARDS.length - 1;

  return (
    <section aria-label="FitStrong has a new Home" className="flex flex-col gap-2 rounded-xl bg-grouped-card p-4">
      <p className="text-[length:var(--text-body)] leading-snug">FitStrong has a new Home. Your tiles are here; Trends and Browse are new.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setCard(0); setOpen(true); }}
          className="press-feedback min-h-12 rounded-xl bg-tint/10 px-4 text-[length:var(--text-body)] font-semibold text-tint">Show me</button>
        <button type="button" onClick={() => void seen()} className="press-feedback min-h-12 rounded-xl px-4 text-[length:var(--text-body)] text-tint">Got it</button>
      </div>
      {problem && <p role="alert" className="text-[length:var(--text-subhead)] text-stop">{problem}</p>}
      <Sheet open={open} onOpenChange={setOpen} title={CARDS[card].title}>
        <p className="px-1 text-[length:var(--text-body)] leading-snug">{CARDS[card].text}</p>
        <p className="px-1 text-[length:var(--text-subhead)] text-muted-foreground">{card + 1} of {CARDS.length}</p>
        <PrimaryButton onClick={() => {
          if (!last) {
            setCard(card + 1);
            return;
          }
          setOpen(false);
          void seen();
        }}>{last ? 'Done' : 'Next'}</PrimaryButton>
      </Sheet>
    </section>
  );
}
