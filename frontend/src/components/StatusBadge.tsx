import { statusLabels } from '../lib/messages';
import type { HoldStatus } from '../types/api';

export function StatusBadge({ status }: { status: HoldStatus }) {
  return (
    <span className={`badge badge--${status.toLowerCase()}`}>
      <span className="badge__code">{status}</span>
      <span>{statusLabels[status]}</span>
    </span>
  );
}
