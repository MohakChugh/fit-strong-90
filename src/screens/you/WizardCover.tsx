import { useRef, type ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';

/**
 * The profile wizard, over everything.
 *
 * The wizard is a full page with its own fixed footer of Back and Continue.
 * Inside the tab shell that footer would sit under the tab bar, out of reach,
 * so it is presented the way iOS presents a multi-step edit: a full-screen
 * cover with its own way out. A dialog gives it a focus trap and keeps the
 * screen behind it inert and unscrollable. Its popup is never transformed —
 * a transform would make the wizard's fixed footer scroll with the page.
 */
export function WizardCover({ open, onClose, label, children }: {
  open: boolean;
  onClose: () => void;
  /** The cover's accessible name. */
  label: string;
  children: ReactNode;
}) {
  // Focus lands on the cover, not the first field: the keyboard should not
  // spring up before the person has seen what the screen asks.
  const start = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Popup
          aria-label={label}
          initialFocus={start}
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background outline-none transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
        >
          <div ref={start} tabIndex={-1} className="outline-none">
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
