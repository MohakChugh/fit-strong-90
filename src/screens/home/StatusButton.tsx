import { ChevronRightIcon } from 'lucide-react';
import { STATUS_LABEL, type Status } from '@/health/status';

/**
 * "How are you today? Normal ›" (journey §7.1, D25, K-13): a labelled row
 * under the greeting, at least 60 px tall, that opens the status sheet. The
 * status the person set is always in words here, with how long it has been
 * when it isn't Normal.
 */
export function StatusButton({ status, detail, onOpen }: { status: Status; detail?: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="press-feedback flex min-h-[60px] w-full items-center gap-3 rounded-xl bg-grouped-card px-4 py-2.5 text-left transition-colors active:bg-muted/60"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word]">
          How are you today? <span className="font-semibold">{STATUS_LABEL[status] ?? 'Normal'}</span>
        </span>
        {detail && <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{detail}</span>}
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
    </button>
  );
}
