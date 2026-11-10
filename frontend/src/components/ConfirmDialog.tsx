import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Accessible modal confirmation (native <dialog>), DESIGN.md "Cancellation Modals". */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'ফিরে যান',
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  const danger = tone === 'danger';
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="flex flex-col gap-space-md p-space-lg">
        <div className="flex items-start gap-space-md">
          <span
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
              danger ? 'bg-error-container text-error' : 'bg-secondary-container text-on-secondary-container'
            }`}
          >
            <Icon name={danger ? 'gpp_maybe' : 'payments'} />
          </span>
          <h2 id={titleId} className="pt-1 text-headline-sm text-on-surface">
            {title}
          </h2>
        </div>
        <div className="text-body-md text-on-surface-variant">{children}</div>
        <div className="flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end">
          <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-confirm'}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? 'অপেক্ষা করুন…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
