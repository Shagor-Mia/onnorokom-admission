import { formatNumber, formatPercent } from '../lib/format';

interface SeatStatsProps {
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

/** 4-cell seat summary (মোট / সংরক্ষিত / নিশ্চিত / খালি) plus the capacity bar, as in screen A. */
export function SeatStats({ totalSeats, heldSeats, confirmedSeats, availableSeats }: SeatStatsProps) {
  const occupied = heldSeats + confirmedSeats;
  const confirmedPct = totalSeats > 0 ? (confirmedSeats / totalSeats) * 100 : 0;
  const heldPct = totalSeats > 0 ? (heldSeats / totalSeats) * 100 : 0;
  const full = availableSeats <= 0;

  return (
    <div className="flex flex-col gap-space-sm">
      <dl className="grid grid-cols-4 overflow-hidden rounded-xl border border-surface-container bg-surface-container-low">
        <div className="px-space-sm py-space-sm text-center">
          <dt className="text-label-md text-on-surface-variant">মোট</dt>
          <dd className="metric text-headline-sm md:text-mono-metric">{formatNumber(totalSeats)}</dd>
        </div>
        <div className="px-space-sm py-space-sm text-center">
          <dt className="text-label-md text-on-tertiary-container">সংরক্ষিত</dt>
          <dd className="metric text-headline-sm md:text-mono-metric">{formatNumber(heldSeats)}</dd>
        </div>
        <div className="px-space-sm py-space-sm text-center">
          <dt className="text-label-md text-secondary">নিশ্চিত</dt>
          <dd className="metric text-headline-sm md:text-mono-metric">{formatNumber(confirmedSeats)}</dd>
        </div>
        <div className={`m-1 rounded-lg px-space-sm py-space-sm text-center shadow-card ${full ? 'bg-error-container' : 'bg-surface-container-lowest'}`}>
          <dt className={`text-label-md ${full ? 'text-error' : 'text-secondary'}`}>খালি</dt>
          <dd className={`metric text-headline-sm md:text-mono-metric ${full ? 'text-error' : 'text-secondary'}`}>
            {formatNumber(availableSeats)}
          </dd>
        </div>
      </dl>
      <div>
        <div className="mb-1 flex justify-between text-label-md text-on-surface-variant">
          <span>
            আসন ধারণক্ষমতা ({formatNumber(occupied)}/{formatNumber(totalSeats)} পূর্ণ)
          </span>
          <span className={full ? 'text-error' : ''}>{formatPercent(totalSeats > 0 ? occupied / totalSeats : 0)}</span>
        </div>
        <div
          className="flex h-2 overflow-hidden rounded-full bg-surface-container"
          role="img"
          aria-label={`${formatNumber(totalSeats)} seat-এর মধ্যে ${formatNumber(confirmedSeats)} নিশ্চিত, ${formatNumber(heldSeats)} সংরক্ষিত`}
        >
          <span className={full ? 'bg-error' : 'bg-primary'} style={{ width: `${confirmedPct}%` }} />
          <span className={full ? 'bg-error/70' : 'bg-tertiary-fixed-dim'} style={{ width: `${heldPct}%` }} />
        </div>
      </div>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: number;
  icon: string;
  accent: 'navy' | 'amber' | 'teal' | 'slate';
  /** 0..1 fill of the bottom micro-bar. */
  ratio?: number;
  note?: string;
}

const accents = {
  navy: { border: 'border-t-[#0f172a]', bar: 'bg-[#0f172a]', label: 'text-on-surface-variant', icon: 'bg-surface-container text-on-surface' },
  amber: { border: 'border-t-[#d97706]', bar: 'bg-[#d97706]', label: 'text-on-tertiary-container', icon: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' },
  teal: { border: 'border-t-[#0d9488]', bar: 'bg-[#0d9488]', label: 'text-secondary', icon: 'bg-secondary-container text-on-secondary-container' },
  slate: { border: 'border-t-[#64748b]', bar: 'bg-[#64748b]', label: 'text-on-surface-variant', icon: 'bg-surface-container text-on-surface-variant' },
};

/** Metric card from DESIGN.md: 4px top border, label, tabular number, micro progress bar. */
export function KpiCard({ label, value, icon, accent, ratio, note }: KpiCardProps) {
  const style = accents[accent];
  return (
    <div className={`card flex flex-col gap-space-sm border-t-4 p-space-md ${style.border}`}>
      <div className="flex items-start justify-between gap-space-sm">
        <span className={`text-label-md ${style.label}`}>{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${style.icon}`}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            {icon}
          </span>
        </span>
      </div>
      <div className="flex items-end justify-between gap-space-sm">
        <span className="metric">{formatNumber(value)}</span>
        {note && <span className="text-label-md text-on-surface-variant">{note}</span>}
      </div>
      {ratio !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
          <div className={`h-full ${style.bar}`} style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }} />
        </div>
      )}
    </div>
  );
}
