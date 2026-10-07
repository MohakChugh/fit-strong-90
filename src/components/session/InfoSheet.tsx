import { FormDemo } from '@/components/motion/FormDemo';
import type { Coaching } from '@/types/catalog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ExternalLinkIcon, AlertTriangleIcon, ShieldCheckIcon, WindIcon, TargetIcon } from 'lucide-react';

const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

/** Full coaching for one exercise: setup, steps, breathing, feel, mistakes, safety, videos. */
export function CoachingDetails({ c }: { c: Coaching }) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      <p className="text-base">{c.summary}</p>
      <section>
        <h3 className="font-semibold mb-1">Set up</h3>
        <p className="text-muted-foreground mb-1">{c.equipment}</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">{c.setup.map(s => <li key={s}>{s}</li>)}</ul>
      </section>
      <section>
        <h3 className="font-semibold mb-1">How to do it</h3>
        <ol className="list-decimal pl-5 flex flex-col gap-1">{c.steps.map(s => <li key={s}>{s}</li>)}</ol>
      </section>
      <section className="rounded-xl bg-muted/60 p-3 flex gap-2">
        <WindIcon className="size-4 mt-0.5 shrink-0" />
        <p><span className="font-semibold">Breathing.</span> {c.breathing}</p>
      </section>
      <section className="flex flex-col gap-2">
        <p className="flex gap-2"><TargetIcon className="size-4 mt-0.5 shrink-0 text-[var(--muscle-work)]" /><span><span className="font-semibold">Feel it:</span> {c.feel}</span></p>
        <p className="flex gap-2"><AlertTriangleIcon className="size-4 mt-0.5 shrink-0 text-[var(--safety)]" /><span><span className="font-semibold">Stop if:</span> {c.shouldNotFeel}</span></p>
        <p className="text-muted-foreground">{c.why}</p>
      </section>
      <section>
        <h3 className="font-semibold mb-2">Common mistakes</h3>
        <ul className="flex flex-col gap-2">
          {c.mistakes.map(m => (
            <li key={m.clip} className="rounded-xl border p-3">
              <p className="font-medium">{m.mistake}</p>
              <p className="text-muted-foreground">{m.risk}</p>
              <p className="mt-1"><span className="font-semibold">Fix:</span> {m.fix}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-[var(--block-mobility)]/40 bg-[var(--block-mobility)]/10 p-3 flex gap-2">
        <ShieldCheckIcon className="size-4 mt-0.5 shrink-0" />
        <p><span className="font-semibold">Back and sciatica.</span> {c.backSafety.note}</p>
      </section>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <a href={yt(c.youtube.tutorial)} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline' }), 'h-12 text-sm')}>
          <ExternalLinkIcon /> Watch a tutorial
        </a>
        <a href={yt(c.youtube.mistakes)} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline' }), 'h-12 text-sm')}>
          <ExternalLinkIcon /> Common mistakes
        </a>
      </div>
      {c.sources.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer min-h-11 flex items-center">Sources</summary>
          <ul className="flex flex-col gap-1 break-all">
            {c.sources.map(s => <li key={s}><a className="underline" href={s} target="_blank" rel="noopener noreferrer">{s}</a></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

export function InfoSheet({ open, onOpenChange, coaching, title }: { open: boolean; onOpenChange: (o: boolean) => void; coaching?: Coaching; title: string }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-2xl pb-safe">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl">{coaching?.name ?? title}</SheetTitle>
          <SheetDescription>{coaching ? coaching.muscles.primary.join(', ') : ''}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-6">
          {coaching && open && <FormDemo exerciseId={coaching.id} className="h-56 [@media(max-height:640px)]:h-40" />}
          {coaching ? <CoachingDetails c={coaching} /> : <p className="text-sm">{title}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
