import { statusLabels } from '../lib/messages';
import type { HoldStatus } from '../types/api';
import { Icon } from './Icon';

const icons: Record<HoldStatus, string> = {
  HELD: 'hourglass_top',
  CONFIRMED: 'verified',
  EXPIRED: 'timer_off',
  CANCELLED: 'cancel',
};

/** Pill badge: amber HELD, emerald CONFIRMED, slate EXPIRED, crimson CANCELLED (DESIGN.md). */
export function StatusBadge({ status }: { status: HoldStatus }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>
      <Icon name={icons[status]} className="text-[14px]" />
      <span>{status}</span>
      <span className="normal-case tracking-normal">• {statusLabels[status]}</span>
    </span>
  );
}
