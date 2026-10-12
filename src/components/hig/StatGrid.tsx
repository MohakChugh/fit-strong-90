import { cn } from '@/lib/utils';

/**
 * Statistics as label and value, the value carrying its unit and the label
 * naming the statistic: two columns, or one when the space is narrow or the
 * text is large. A definition list, so VoiceOver reads each label with its
 * value.
 */
export function StatGrid({ items, className }: { items: readonly { label: string; value: string }[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <div className={cn('@container', className)}>
      <dl className="grid grid-cols-2 gap-2 @max-[22rem]:grid-cols-1">
        {items.map(item => (
          <div key={item.label} className="flex flex-col gap-0.5 rounded-xl bg-grouped-card px-4 py-3">
            <dt className="text-[length:var(--text-footnote)] leading-snug text-muted-foreground [overflow-wrap:break-word]">{item.label}</dt>
            <dd className="numeric text-[length:var(--text-body)] font-semibold leading-snug [overflow-wrap:break-word]">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
