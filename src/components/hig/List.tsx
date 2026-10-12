import { ChevronRightIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The grouped inset list. iOS leans on this one component for almost every
 * screen that is not a single task, which is how it carries many features
 * without clutter: a short header, rows with a noun and a value, and the
 * detail one tap away.
 */
export function Group({ header, footer, children, className }: {
  /** Short, sentence case. Omit it when the rows speak for themselves. */
  header?: string;
  /** Explanation or a caution. This is where "not medical advice" belongs. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    // A container, so its header and footer move in with the rows when they stack (see `Row`).
    <section className={cn('@container flex flex-col', className)}>
      {header && (
        <h2 className="px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground [overflow-wrap:break-word] @max-[16rem]:px-2">
          {header}
        </h2>
      )}
      {/* Separators inset from the left so they start under the text, as iOS does. */}
      <div className="overflow-hidden rounded-xl bg-grouped-card [&>*+*]:border-t [&>*+*]:border-separator">
        {children}
      </div>
      {footer && <p className="px-4 pt-2 text-[length:var(--text-footnote)] leading-snug text-muted-foreground [overflow-wrap:break-word] @max-[16rem]:px-2">{footer}</p>}
    </section>
  );
}

type RowOwnProps = {
  /** The row's noun. Keep it short; the second line carries detail. */
  label: ReactNode;
  /** Secondary line under the label. */
  detail?: ReactNode;
  /** Right-aligned value, e.g. a reading. Monospaced figures when numeric. */
  value?: ReactNode;
  icon?: ReactNode;
  /** Shows the chevron. Set it when the row opens a screen. */
  chevron?: boolean;
  /** Replaces the chevron, e.g. with a switch. */
  accessory?: ReactNode;
  numeric?: boolean;
};

/**
 * One row. A real `<button>` when given `onClick` (and `type="button"`, so it
 * never submits a surrounding form), a link when given `as={Link}` and `to`,
 * and a plain div otherwise — so a read-only row is not announced as
 * interactive.
 *
 * The row is a container, so it lays itself out by its own width at the
 * person's text size. Narrower than 16 rem — a 320-point screen at about 150%
 * text, a large phone at 200% — it stacks, as HIG asks of inline items at
 * large sizes: the icon above the text, the value and any wide accessory
 * under it, half the padding. The label then keeps whole words; it breaks one
 * only when it is wider than the row itself.
 */
export function Row<T extends ElementType = 'div'>({
  as, label, detail, value, icon, chevron, accessory, numeric, className, ...rest
}: { as?: T } & RowOwnProps & Omit<ComponentPropsWithoutRef<T>, keyof RowOwnProps | 'as'>) {
  const props = rest as Record<string, unknown>;
  const Tag = (as ?? (props.onClick ? 'button' : 'div')) as ElementType;
  const interactive = Tag !== 'div';
  return (
    <Tag
      className={cn(
        '@container block w-full text-left',
        interactive && 'press-feedback transition-colors active:bg-muted/60',
        className,
      )}
      {...(Tag === 'button' && props.type === undefined ? { type: 'button' } : {})}
      {...rest}
    >
      <span className="flex min-h-[3.25rem] items-center gap-3 px-4 py-2.5 @max-[16rem]:flex-wrap @max-[16rem]:gap-x-1.5 @max-[16rem]:gap-y-1 @max-[16rem]:px-2">
        {icon && <span className="flex size-7 shrink-0 items-center justify-center text-tint [&_svg]:size-5 @max-[16rem]:basis-full @max-[16rem]:justify-start">{icon}</span>}
        {/* Labels wrap rather than truncate, and a value may take at most half
            the row, so neither is squeezed to nothing at large text sizes. */}
        {/* Stacked, the label keeps at least 60% of its line, so an accessory
            too wide to sit beside it (a text button, a switch) goes under it,
            as iOS moves them at accessibility sizes; a chevron stays. */}
        <span className="min-w-0 flex-1 @max-[16rem]:min-w-[60%]">
          <span className="block text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word]">{label}</span>
          {detail && <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground [overflow-wrap:break-word]">{detail}</span>}
        </span>
        {value !== undefined && (
          <span className={cn(
            'min-w-0 max-w-[50%] text-right text-[length:var(--text-body)] text-muted-foreground [overflow-wrap:break-word]',
            '@max-[16rem]:order-last @max-[16rem]:max-w-none @max-[16rem]:basis-full @max-[16rem]:text-left',
            numeric && 'numeric',
          )}>{value}</span>
        )}
        {accessory ?? (chevron && <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />)}
      </span>
    </Tag>
  );
}
