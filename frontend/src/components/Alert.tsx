import type { ReactNode } from 'react';
import { Icon } from './Icon';

type Tone = 'error' | 'success' | 'info' | 'warning';

const tones: Record<Tone, { box: string; icon: string }> = {
  error: { box: 'border-error/40 bg-error-container text-on-error-container', icon: 'error' },
  success: { box: 'border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46]', icon: 'check_circle' },
  info: { box: 'border-surface-container-highest bg-surface-container-low text-on-surface', icon: 'info' },
  warning: { box: 'border-[#fde68a] bg-[#fffbeb] text-[#78350f]', icon: 'warning' },
};

export function Alert({ tone, children, title }: { tone: Tone; title?: string; children: ReactNode }) {
  const style = tones[tone];
  return (
    <div className={`flex gap-space-sm rounded-xl border p-space-md ${style.box}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={style.icon} className="mt-0.5 text-[20px]" />
      <div className="flex-1 text-body-sm">
        {title && <p className="mb-0.5 text-label-lg">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Loading({ label = 'লোড হচ্ছে…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-space-sm py-space-lg text-on-surface-variant" role="status" aria-live="polite">
      <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-surface-container border-t-secondary" aria-hidden="true" />
      {label}
    </div>
  );
}

/** Skeleton placeholder cards shown while the first response is loading. */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card flex animate-pulse flex-col gap-space-md p-space-lg">
          <div className="h-4 w-1/3 rounded bg-surface-container" />
          <div className="h-6 w-2/3 rounded bg-surface-container" />
          <div className="h-16 rounded bg-surface-container-low" />
          <div className="h-10 rounded bg-surface-container" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-space-sm rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-space-md py-space-xl text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant">
        <Icon name={icon} className="text-[28px]" />
      </span>
      <p className="text-headline-sm text-on-surface">{title}</p>
      {children}
    </div>
  );
}
