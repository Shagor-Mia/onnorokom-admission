import { Link } from 'react-router-dom';
import { Alert, Loading } from '../components/Alert';
import { StatusBadge } from '../components/StatusBadge';
import { useStudent } from '../context/StudentContext';
import { usePolling } from '../hooks/usePolling';
import { useNow } from '../hooks/useNow';
import { api } from '../lib/api';
import { formatDateTime, formatDuration, formatNumber, remainingMs } from '../lib/format';
import { describeError } from '../lib/messages';
import { maskStudentId } from '../lib/studentId';
import type { HoldStatus, StudentHold } from '../types/api';
import { effectiveStatus } from './ApplicationPage';

export const MY_HOLDS_POLL_MS = 5000;

/** "আমার আবেদন": every application of this student and its current status. */
export function MyApplicationsPage() {
  const { studentId } = useStudent();
  const now = useNow();
  const holds = usePolling(
    (signal) => (studentId ? api.myHolds(studentId, signal) : Promise.resolve<StudentHold[]>([])),
    MY_HOLDS_POLL_MS,
    studentId !== null,
    [studentId],
  );

  if (!studentId) {
    return (
      <section aria-labelledby="mine-heading">
        <h1 id="mine-heading">আমার আবেদন</h1>
        <Alert tone="info">
          উপরের ঘরে শিক্ষার্থীর ১৭ অঙ্কের জন্ম নিবন্ধন নম্বর দিন — তারপর এই শিক্ষার্থীর সব আবেদন এখানে দেখা যাবে।
        </Alert>
      </section>
    );
  }

  const items = holds.data ?? [];
  const counts = items.reduce<Record<HoldStatus, number>>(
    (acc, hold) => {
      acc[effectiveStatus(hold, now)] += 1;
      return acc;
    },
    { HELD: 0, CONFIRMED: 0, EXPIRED: 0, CANCELLED: 0 },
  );

  return (
    <section aria-labelledby="mine-heading" className="stack">
      <div className="page-head">
        <div>
          <h1 id="mine-heading">আমার আবেদন</h1>
          <p className="muted">
            জন্ম নিবন্ধন নম্বর <span className="mono">{maskStudentId(studentId)}</span> — এই শিক্ষার্থীর সব আবেদন ও অবস্থা।
          </p>
        </div>
        <Link to="/" className="btn btn--ghost btn--sm">
          নতুন আবেদন করুন
        </Link>
      </div>

      {holds.loading && !holds.data && <Loading label="আবেদনগুলো লোড হচ্ছে…" />}
      {holds.error !== undefined && (
        <Alert tone={holds.data ? 'warning' : 'error'}>
          {describeError(holds.error)}
          {holds.data ? ' সর্বশেষ পাওয়া তথ্য দেখানো হচ্ছে।' : ''}
        </Alert>
      )}

      {holds.data && (
        <dl className="summary">
          <div>
            <dt>মোট আবেদন</dt>
            <dd>{formatNumber(items.length)}</dd>
          </div>
          <div>
            <dt>Hold-এ (HELD)</dt>
            <dd>{formatNumber(counts.HELD)}</dd>
          </div>
          <div>
            <dt>নিশ্চিত (CONFIRMED)</dt>
            <dd>{formatNumber(counts.CONFIRMED)}</dd>
          </div>
          <div>
            <dt>মেয়াদ শেষ / বাতিল</dt>
            <dd>{formatNumber(counts.EXPIRED + counts.CANCELLED)}</dd>
          </div>
        </dl>
      )}

      {holds.data && items.length === 0 && (
        <div className="empty">
          <p>এই শিক্ষার্থীর এখনো কোনো আবেদন নেই।</p>
          <Link to="/" className="btn btn--primary btn--sm">
            Class তালিকা দেখুন
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <ul className="list">
          {items.map((hold) => {
            const status = effectiveStatus(hold, now);
            return (
              <li key={hold.holdId} className={`card application-row application-row--${status.toLowerCase()}`}>
                <div className="application-row__main">
                  <h2 className="application-row__title">{hold.className}</h2>
                  <StatusBadge status={status} />
                </div>
                <p className="muted">
                  {status === 'HELD'
                    ? `মেয়াদ শেষ হতে বাকি ${formatDuration(remainingMs(hold.expiresAt, now))}`
                    : status === 'CONFIRMED'
                      ? `নিশ্চিত: ${formatDateTime(hold.confirmedAt ?? null)}`
                      : status === 'CANCELLED'
                        ? `বাতিল: ${formatDateTime(hold.cancelledAt ?? null)}`
                        : `মেয়াদ শেষ: ${formatDateTime(hold.expiresAt)}`}
                </p>
                <Link to={`/applications/${hold.holdId}`} className="btn btn--ghost btn--sm">
                  {status === 'HELD' ? 'ভর্তি ফি দিন / বিস্তারিত' : 'বিস্তারিত দেখুন'}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
