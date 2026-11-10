import type { ReactNode } from 'react';

type Tone = 'error' | 'success' | 'info' | 'warning';

export function Alert({ tone, children, title }: { tone: Tone; title?: string; children: ReactNode }) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {title && <p className="alert__title">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

export function Loading({ label = 'লোড হচ্ছে…' }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}
