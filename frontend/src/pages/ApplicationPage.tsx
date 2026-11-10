import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Loading } from '../components/Alert';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';
import { useStudent } from '../context/StudentContext';
import { usePolling } from '../hooks/usePolling';
import { useNow } from '../hooks/useNow';
import { ApiError, api } from '../lib/api';
import { formatDateTime, formatDuration, remainingMs } from '../lib/format';
import { describeError } from '../lib/messages';
import type { HoldDetails, HoldStatus } from '../types/api';

export const HOLD_POLL_MS = 3000;

/**
 * The status the guardian should see right now. A HELD hold whose expiry time has
 * passed is shown as EXPIRED immediately (no reload needed); the next poll then
 * fetches the server's authoritative status.
 */
export function effectiveStatus(hold: Pick<HoldDetails, 'status' | 'expiresAt'>, nowMs: number): HoldStatus {
  if (hold.status === 'HELD' && remainingMs(hold.expiresAt, nowMs) <= 0) return 'EXPIRED';
  return hold.status;
}

type Dialog = 'confirm' | 'cancel' | null;

/** "আবেদন": status, time remaining, "ভর্তি ফি দিন" and "বাতিল". */
export function ApplicationPage() {
  const { holdId = '' } = useParams();
  const { studentId } = useStudent();
  const now = useNow();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [terminal, setTerminal] = useState(false);

  const hold = usePolling((signal) => api.getHold(holdId, signal), HOLD_POLL_MS, !terminal, [holdId]);
  const data = hold.data;
  const status = data ? effectiveStatus(data, now) : undefined;

  // Stop polling once the server reports a final state.
  useEffect(() => {
    if (data && data.status !== 'HELD') setTerminal(true);
  }, [data]);

  // When the countdown reaches zero, ask the server straight away.
  const refreshedExpiry = useRef(false);
  useEffect(() => {
    if (data?.status === 'HELD' && status === 'EXPIRED' && !refreshedExpiry.current) {
      refreshedExpiry.current = true;
      void hold.refresh();
      setDialog(null);
    }
  }, [data?.status, status, hold]);

  const notFound = hold.error instanceof ApiError && hold.error.status === 404;
  const canAct = status === 'HELD' && studentId !== null && !busy;

  const confirm = async () => {
    if (!studentId) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.confirmHold(holdId, studentId);
      setNotice('ভর্তি ফি জমা হয়েছে (simulated payment) — ভর্তি নিশ্চিত হয়েছে।');
    } catch (error) {
      setActionError(describeError(error));
    } finally {
      setBusy(false);
      setDialog(null);
      await hold.refresh();
    }
  };

  const cancel = async () => {
    if (!studentId) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.cancelHold(holdId, studentId);
      setNotice('আবেদন বাতিল করা হয়েছে, seat অন্যদের জন্য ছেড়ে দেওয়া হয়েছে।');
    } catch (error) {
      setActionError(describeError(error));
    } finally {
      setBusy(false);
      setDialog(null);
      await hold.refresh();
    }
  };

  if (hold.loading && !data) return <Loading label="আবেদনের তথ্য লোড হচ্ছে…" />;

  if (!data) {
    return (
      <Alert tone="error" title={notFound ? 'আবেদন পাওয়া যায়নি' : 'আবেদনের তথ্য আনা যায়নি'}>
        <p>{describeError(hold.error)}</p>
        <p>
          <Link to="/my-applications">আমার আবেদন</Link> পেজে আপনার সব আবেদন দেখুন।
        </p>
      </Alert>
    );
  }

  const remaining = remainingMs(data.expiresAt, now);

  return (
    <section aria-labelledby="application-heading" className="stack">
      <p>
        <Link to="/my-applications">← আমার আবেদন</Link>
      </p>
      <div className="card application">
        <div className="application__head">
          <div>
            <h1 id="application-heading">আবেদন</h1>
            <p className="application__class">{data.className ?? data.classId}</p>
            <p className="muted mono">আবেদন নম্বর: {data.holdId}</p>
          </div>
          {status && <StatusBadge status={status} />}
        </div>

        <div aria-live="polite">
          {status === 'HELD' && (
            <div className="countdown" role="timer" aria-label="মেয়াদ শেষ হতে বাকি সময়">
              <span className="countdown__label">মেয়াদ শেষ হতে বাকি</span>
              <span className={`countdown__value mono${remaining < 120_000 ? ' countdown__value--urgent' : ''}`}>
                {formatDuration(remaining)}
              </span>
              <span className="muted">মেয়াদ শেষ: {formatDateTime(data.expiresAt)}</span>
            </div>
          )}
          {status === 'EXPIRED' && (
            <Alert tone="warning" title="মেয়াদ শেষ (EXPIRED)">
              নির্ধারিত সময়ের মধ্যে ভর্তি ফি জমা হয়নি, তাই seat অন্যদের জন্য ছেড়ে দেওয়া হয়েছে। এই আবেদনে আর ভর্তি ফি
              দেওয়া যাবে না — চাইলে <Link to="/">Class তালিকা</Link> থেকে আবার আবেদন করুন।
            </Alert>
          )}
          {status === 'CONFIRMED' && (
            <Alert tone="success" title="ভর্তি নিশ্চিত (CONFIRMED)">
              অভিনন্দন! ভর্তি নিশ্চিত হয়েছে। {data.confirmedAt && `নিশ্চিত হওয়ার সময়: ${formatDateTime(data.confirmedAt)}`}
            </Alert>
          )}
          {status === 'CANCELLED' && (
            <Alert tone="info" title="বাতিল (CANCELLED)">
              এই আবেদনটি বাতিল করা হয়েছে। {data.cancelledAt && `বাতিলের সময়: ${formatDateTime(data.cancelledAt)}`}
            </Alert>
          )}
        </div>

        {notice && <Alert tone="success">{notice}</Alert>}
        {actionError && <Alert tone="error">{actionError}</Alert>}
        {hold.error !== undefined && <Alert tone="warning">{describeError(hold.error)}</Alert>}
        {!studentId && status === 'HELD' && (
          <Alert tone="info">ভর্তি ফি দিতে বা বাতিল করতে উপরের ঘরে শিক্ষার্থীর জন্ম নিবন্ধন নম্বর দিন।</Alert>
        )}

        <dl className="details">
          <div>
            <dt>আবেদনের সময়</dt>
            <dd>{formatDateTime(data.createdAt)}</dd>
          </div>
          <div>
            <dt>মেয়াদ শেষের সময়</dt>
            <dd>{formatDateTime(data.expiresAt)}</dd>
          </div>
        </dl>

        <div className="application__actions">
          <button type="button" className="btn btn--primary btn--lg" disabled={!canAct} onClick={() => setDialog('confirm')}>
            ভর্তি ফি দিন
          </button>
          <button type="button" className="btn btn--danger-outline" disabled={!canAct} onClick={() => setDialog('cancel')}>
            বাতিল
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'confirm'}
        title="ভর্তি ফি জমা নিশ্চিত করবেন?"
        confirmLabel="হ্যাঁ, ভর্তি ফি দিন"
        busy={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setDialog(null)}
      >
        <p>
          <strong>{data.className}</strong> — এটি একটি demo (simulated) payment। কোনো আসল টাকা কাটা হবে না; চাপলে ধরে
          নেওয়া হবে ফি জমা সফল হয়েছে এবং ভর্তি নিশ্চিত হবে।
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'cancel'}
        title="আবেদন বাতিল করবেন?"
        confirmLabel="হ্যাঁ, বাতিল করুন"
        tone="danger"
        busy={busy}
        onConfirm={() => void cancel()}
        onCancel={() => setDialog(null)}
      >
        <p>বাতিল করলে seat-টি সঙ্গে সঙ্গে অন্যদের জন্য খুলে যাবে। এই কাজ ফেরানো যাবে না।</p>
      </ConfirmDialog>
    </section>
  );
}
