import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Loading } from '../components/Alert';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { useStudent } from '../context/StudentContext';
import { usePolling } from '../hooks/usePolling';
import { useNow } from '../hooks/useNow';
import { ApiError, api } from '../lib/api';
import { formatDateTime, formatDuration, formatNumber, formatTime, remainingMs, trackingNumber } from '../lib/format';
import { describeError } from '../lib/messages';
import { maskStudentId } from '../lib/studentId';
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

/** "আবেদন" (screens B, C, D): status, time left, "ভর্তি ফি দিন" and "বাতিল". */
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

  const run = async (action: () => Promise<unknown>, success: string) => {
    if (!studentId) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
      setNotice(success);
    } catch (error) {
      setActionError(describeError(error));
    } finally {
      setBusy(false);
      setDialog(null);
      await hold.refresh();
    }
  };

  const confirm = () =>
    run(() => api.confirmHold(holdId, studentId!), 'ভর্তি ফি জমা হয়েছে (simulated payment) — ভর্তি নিশ্চিত হয়েছে।');
  const cancel = () =>
    run(() => api.cancelHold(holdId, studentId!), 'আবেদন বাতিল করা হয়েছে, seat অন্যদের জন্য ছেড়ে দেওয়া হয়েছে।');

  if (hold.loading && !data) return <Loading label="আবেদনের তথ্য লোড হচ্ছে…" />;

  if (!data || !status) {
    return (
      <Alert tone="error" title={notFound ? 'আবেদন পাওয়া যায়নি' : 'আবেদনের তথ্য আনা যায়নি'}>
        <p>{describeError(hold.error)}</p>
        <p className="mt-space-sm">
          <Link className="underline" to="/my-applications">
            আমার আবেদনসমূহ
          </Link>{' '}
          পেজে আপনার সব আবেদন দেখুন।
        </p>
      </Alert>
    );
  }

  const remaining = remainingMs(data.expiresAt, now);
  const totalMs =
    data.createdAt && Date.parse(data.expiresAt) > Date.parse(data.createdAt)
      ? Date.parse(data.expiresAt) - Date.parse(data.createdAt)
      : undefined;
  const className = data.className ?? data.classId;

  return (
    <div className="flex flex-col gap-gutter">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-space-xs text-label-md text-on-surface-variant">
        <Link to="/my-applications" className="inline-flex items-center gap-1 hover:text-on-surface">
          <Icon name="arrow_back" className="text-[16px]" /> আমার আবেদনসমূহ
        </Link>
        <span aria-hidden="true">/</span>
        <span className="pill bg-surface-container-high text-on-surface">{trackingNumber(data.holdId)}</span>
      </nav>

      <h1 className="sr-only">আবেদন</h1>

      {status === 'HELD' && (
        <HeldHero className={className} holdId={data.holdId} remaining={remaining} totalMs={totalMs} expiresAt={data.expiresAt} />
      )}
      {status === 'CONFIRMED' && <ConfirmedHero holdId={data.holdId} confirmedAt={data.confirmedAt} />}
      {status === 'EXPIRED' && <ExpiredHero data={data} />}
      {status === 'CANCELLED' && <CancelledHero data={data} />}

      <div aria-live="polite" className="flex flex-col gap-space-sm empty:hidden">
        {notice && <Alert tone="success">{notice}</Alert>}
        {actionError && <Alert tone="error">{actionError}</Alert>}
        {hold.error !== undefined && <Alert tone="warning">{describeError(hold.error)}</Alert>}
        {!studentId && status === 'HELD' && (
          <Alert tone="info">ভর্তি ফি দিতে বা বাতিল করতে উপরের ঘরে শিক্ষার্থীর জন্ম নিবন্ধন নম্বর দিন।</Alert>
        )}
      </div>

      {/* Application details */}
      <section className="card overflow-hidden" aria-labelledby="details-heading">
        <div className="flex flex-wrap items-center justify-between gap-space-md bg-surface-container-low p-space-lg">
          <div className="flex items-center gap-space-md">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-lowest">
              <Icon name="assignment_ind" />
            </span>
            <div>
              <h2 id="details-heading" className="text-headline-sm text-on-surface">
                শিক্ষার্থী ও আবেদন বিবরণী
              </h2>
              <p className="text-body-sm text-on-surface-variant">সার্ভারে সংরক্ষিত তথ্য</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
        <dl className="grid gap-space-md p-space-lg sm:grid-cols-2 lg:grid-cols-3">
          <DetailCard icon="pin" label="জন্ম নিবন্ধন নম্বর (BRN)">
            <span className="font-mono tracking-wider tabular">{studentId ? maskStudentId(studentId) : '—'}</span>
          </DetailCard>
          <DetailCard icon="school" label="শ্রেণি ও শিফট">
            {className}
          </DetailCard>
          <DetailCard icon="tag" label="আবেদন নম্বর">
            <span className="break-all font-mono text-body-sm">{data.holdId}</span>
          </DetailCard>
          <DetailCard icon="schedule" label="সংরক্ষণ ও মেয়াদ সময়">
            <span className="block text-body-sm">শুরু: {formatDateTime(data.createdAt)}</span>
            <span className={`block text-body-sm ${status === 'HELD' ? 'text-error' : ''}`}>
              মেয়াদ শেষ: {formatDateTime(data.expiresAt)}
            </span>
          </DetailCard>
          <DetailCard icon="payments" label="ভর্তি ফি" highlight>
            <span className="text-body-md">Simulated payment</span>
            <span className="block text-body-sm text-on-surface-variant">কোনো ব্যাংক বা মোবাইল ব্যাংকিং চার্জ কাটা হবে না</span>
          </DetailCard>
          <DetailCard icon="history" label="কার্যক্রম লগ">
            <ol className="flex flex-col gap-1 text-body-sm">
              <li>• আসন hold: {formatTime(data.createdAt)}</li>
              {data.confirmedAt && <li className="text-secondary">• ভর্তি নিশ্চিত: {formatTime(data.confirmedAt)}</li>}
              {data.cancelledAt && <li className="text-error">• বাতিল: {formatTime(data.cancelledAt)}</li>}
              {status === 'EXPIRED' && <li className="text-error">• মেয়াদ শেষ ও আসন মুক্ত: {formatTime(data.expiresAt)}</li>}
            </ol>
          </DetailCard>
        </dl>
      </section>

      {/* Next step */}
      <section className="card flex flex-col gap-space-md p-space-lg md:flex-row md:items-center md:justify-between" aria-labelledby="next-heading">
        <div>
          <h2 id="next-heading" className="text-headline-sm text-on-surface">
            {status === 'HELD' ? 'পরবর্তী পদক্ষেপ নির্বাচন করুন' : 'পরবর্তী পদক্ষেপ'}
          </h2>
          <p className="text-body-sm text-on-surface-variant">
            {status === 'HELD'
              ? 'সিমুলেটেড প্রক্রিয়া: কোনো প্রকৃত আর্থিক লেনদেন ঘটবে না।'
              : status === 'CONFIRMED'
                ? 'ভর্তি নিশ্চিত — এই আবেদনে আর কিছু করার নেই।'
                : 'এই আবেদনে আর ভর্তি ফি দেওয়া যাবে না। চাইলে Class তালিকা থেকে আবার আবেদন করুন।'}
          </p>
        </div>
        <div className="flex flex-col gap-space-sm sm:flex-row">
          {status === 'CONFIRMED' && (
            <button type="button" className="btn-outline no-print" onClick={() => window.print()}>
              <Icon name="print" className="text-[18px]" /> প্রিন্ট করুন
            </button>
          )}
          {(status === 'EXPIRED' || status === 'CANCELLED') && (
            <Link to="/" className="btn-primary">
              <Icon name="search" className="text-[18px]" /> নতুন করে আবেদন করুন
            </Link>
          )}
          <button type="button" className="btn-danger-outline" disabled={!canAct} onClick={() => setDialog('cancel')}>
            <Icon name="cancel" className="text-[18px]" />
            বাতিল
          </button>
          <button type="button" className="btn-confirm md:min-w-[220px]" disabled={!canAct} onClick={() => setDialog('confirm')}>
            <Icon name={status === 'HELD' ? 'check_circle' : 'block'} className="text-[18px]" />
            ভর্তি ফি দিন
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={dialog === 'confirm'}
        title="ভর্তি ফি জমা নিশ্চিত করবেন?"
        confirmLabel="হ্যাঁ, ভর্তি ফি দিন"
        busy={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setDialog(null)}
      >
        <p>
          <strong className="text-on-surface">{className}</strong> — এটি একটি demo (simulated) payment। কোনো আসল টাকা কাটা
          হবে না; চাপলে ধরে নেওয়া হবে ফি জমা সফল হয়েছে এবং ভর্তি নিশ্চিত হবে।
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
        <p>বাতিল করলে সংরক্ষিত seat-টি সঙ্গে সঙ্গে অপেক্ষমাণ অন্যদের জন্য খুলে যাবে। এই কাজ ফেরানো যাবে না।</p>
      </ConfirmDialog>
    </div>
  );
}

function DetailCard({
  icon,
  label,
  children,
  highlight = false,
}: {
  icon: string;
  label: string;
  children: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-space-xs rounded-xl p-space-md ${highlight ? 'bg-secondary-container/40' : 'bg-surface-container-low'}`}>
      <dt className="flex items-center justify-between text-label-md text-on-surface-variant">
        {label}
        <Icon name={icon} className="text-[18px]" />
      </dt>
      <dd className="text-body-lg font-semibold text-on-surface">{children}</dd>
    </div>
  );
}

/** Screen B: hold assigned + dark countdown card. */
function HeldHero({
  className,
  holdId,
  remaining,
  totalMs,
  expiresAt,
}: {
  className: string;
  holdId: string;
  remaining: number;
  totalMs?: number;
  expiresAt: string;
}) {
  const urgent = remaining <= 120_000;
  const warning = remaining <= 300_000;
  const ratio = totalMs ? Math.min(1, remaining / totalMs) : 1;
  return (
    <section className="grid gap-gutter lg:grid-cols-12" aria-label="আবেদনের অবস্থা">
      <div className="card relative flex flex-col gap-space-md overflow-hidden border-l-4 border-l-secondary bg-gradient-to-br from-surface-container-lowest to-secondary-container/30 p-space-lg lg:col-span-7 md:p-margin">
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <span className="pill bg-secondary-container text-on-secondary-container">
            <Icon name="check_circle" className="text-[14px]" /> আসন সংরক্ষণ সম্পন্ন (Hold Assigned)
          </span>
          <span className="pill bg-surface-container-high font-mono text-on-surface">আবেদন: {trackingNumber(holdId)}</span>
        </div>
        <p className="text-headline-xl-mobile text-on-surface md:text-headline-lg">আসন সাময়িকভাবে সংরক্ষিত হয়েছে</p>
        <p className="text-body-lg text-on-surface-variant">
          <strong className="text-on-surface">{className}</strong>-এ আপনার জন্য একটি seat hold করা হয়েছে। নির্ধারিত সময়ের মধ্যে
          “ভর্তি ফি দিন” চাপলে ভর্তি নিশ্চিত হবে; না হলে seat-টি স্বয়ংক্রিয়ভাবে অন্যদের জন্য খুলে যাবে।
        </p>
        <div className="flex flex-wrap items-center gap-space-sm text-body-sm text-on-surface-variant">
          কারিগরি স্ট্যাটাস: <StatusBadge status="HELD" />
        </div>
      </div>

      <div className="flex flex-col gap-space-md rounded-xl bg-primary-container p-space-lg text-on-primary shadow-sticky lg:col-span-5" role="timer" aria-label="মেয়াদ শেষ হতে বাকি সময়">
        <div className="flex items-center justify-between gap-space-sm">
          <span className="flex items-center gap-space-sm text-label-lg">
            <Icon name="timer" /> নির্ধারিত সময়সীমা (Countdown)
          </span>
          <span className="pill bg-white/10 text-secondary-fixed-dim">সক্রিয় কাউন্টডাউন</span>
        </div>
        <div className="flex flex-wrap items-end gap-space-md">
          <span
            className={`rounded-xl bg-white/10 px-space-lg py-space-sm font-mono text-[3rem] font-bold leading-none tabular ${
              urgent ? 'urgent-pulse text-[#fca5a5]' : warning ? 'text-tertiary-fixed-dim' : 'text-on-primary'
            }`}
          >
            {formatDuration(remaining)}
          </span>
          <span className="pb-1">
            <span className="block text-headline-sm text-secondary-fixed-dim">মিনিট বাকি</span>
            {totalMs && <span className="text-label-md text-inverse-primary">{formatNumber(Math.round(totalMs / 60000))} মিনিট থেকে শুরু</span>}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-pill bg-white/10">
          <div
            className={`h-full transition-[width] ${urgent ? 'bg-[#f87171]' : warning ? 'bg-tertiary-fixed-dim' : 'bg-secondary-fixed-dim'}`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <p className="rounded-lg bg-white/5 p-space-md text-body-sm text-inverse-primary">
          <strong className="text-on-primary">জরুরি বিজ্ঞপ্তি:</strong> মেয়াদ শেষ ({formatTime(expiresAt)}) হওয়ার আগে “ভর্তি ফি
          দিন” বাটনে ক্লিক করুন। আসনটি সাময়িকভাবে সংরক্ষিত / Seat temporarily held।
        </p>
      </div>
    </section>
  );
}

/** Screen C: confirmed admission. */
function ConfirmedHero({ holdId, confirmedAt }: { holdId: string; confirmedAt?: string | null }) {
  return (
    <section className="card overflow-hidden border-t-4 border-t-secondary" aria-label="আবেদনের অবস্থা">
      <div className="flex flex-col gap-space-lg p-space-lg md:flex-row md:items-start md:justify-between md:p-margin">
        <div className="flex flex-col gap-space-md">
          <div className="flex flex-wrap gap-space-sm">
            <span className="pill bg-secondary-container text-on-secondary-container">
              <Icon name="verified" className="text-[14px]" /> ভর্তি নিশ্চিত হয়েছে • CONFIRMED
            </span>
          </div>
          <p className="text-headline-xl-mobile text-on-surface md:text-headline-lg">অভিনন্দন! ভর্তি নিশ্চিত (CONFIRMED)</p>
          <p className="text-body-lg text-on-surface-variant">
            নির্ধারিত সময়ের মধ্যে ভর্তি ফি জমা হওয়ায় আসনটি চূড়ান্তভাবে বরাদ্দ হয়েছে।
          </p>
          <div className="flex flex-wrap gap-space-md text-body-sm text-on-surface-variant">
            <span>
              আবেদন নম্বর: <span className="pill bg-surface-container-high font-mono text-on-surface">{trackingNumber(holdId)}</span>
            </span>
            {confirmedAt && <span>নিশ্চিতকরণের সময়: {formatDateTime(confirmedAt)}</span>}
          </div>
        </div>
        <aside className="flex max-w-sm gap-space-sm rounded-xl bg-surface-container-low p-space-md text-body-sm text-on-surface-variant">
          <Icon name="info" className="text-secondary" />
          <p>
            <strong className="block text-on-surface">সিমুলেটেড সিস্টেম নোটিশ</strong>
            এটি ডেমো পোর্টালের অধীনে একটি পরীক্ষামূলক নিশ্চিতকরণ। কোনো আর্থিক লেনদেন বা প্রকৃত পেমেন্ট গেটওয়ে যুক্ত নেই।
          </p>
        </aside>
      </div>
    </section>
  );
}

/** Screen D: expired hold. */
function ExpiredHero({ data }: { data: HoldDetails }) {
  return (
    <section className="card overflow-hidden border-t-4 border-t-[#64748b]" aria-label="আবেদনের অবস্থা">
      <div className="grid gap-space-lg p-space-lg lg:grid-cols-12 md:p-margin">
        <div className="flex gap-space-md lg:col-span-8">
          <span className="hidden h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-error-container text-error sm:flex">
            <Icon name="timer_off" className="text-[28px]" />
          </span>
          <div className="flex flex-col gap-space-md">
            <span className="pill w-fit bg-[#f1f5f9] text-[#475569]">EXPIRED • সময়সীমা উত্তীর্ণ</span>
            <p className="text-headline-xl-mobile text-on-surface md:text-headline-lg">মেয়াদ শেষ (EXPIRED)</p>
            <p className="text-body-lg text-on-surface-variant">
              আসন সংরক্ষণের নির্ধারিত সময় <strong className="text-on-surface">{formatTime(data.expiresAt)}</strong>-এ শেষ হয়েছে।
              সময়ের মধ্যে ভর্তি ফি জমা না হওয়ায় আসনটি স্বয়ংক্রিয়ভাবে অন্যদের জন্য উন্মুক্ত করা হয়েছে।
            </p>
            <dl className="grid gap-space-sm sm:grid-cols-3">
              <div className="rounded-lg bg-surface-container-low p-space-sm">
                <dt className="text-label-md text-on-surface-variant">সংরক্ষণ শুরু (Hold Started)</dt>
                <dd className="text-label-lg">{formatTime(data.createdAt)}</dd>
              </div>
              <div className="rounded-lg bg-surface-container-low p-space-sm">
                <dt className="text-label-md text-on-surface-variant">মেয়াদোত্তীর্ণ (Expired At)</dt>
                <dd className="text-label-lg text-error">{formatTime(data.expiresAt)}</dd>
              </div>
              <div className="rounded-lg bg-surface-container-low p-space-sm">
                <dt className="text-label-md text-on-surface-variant">আসন স্থিতি (Seat Status)</dt>
                <dd className="text-label-lg text-secondary">মুক্ত (Available in Catalogue)</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md lg:col-span-4">
          <span className="text-label-md text-on-surface-variant">টাইমার স্থিতি</span>
          <span className="flex items-center gap-space-sm font-mono text-headline-md text-on-surface-variant line-through tabular">
            <Icon name="timer_off" /> ০০:০০
          </span>
          <span className="text-body-sm text-error">কাউন্টডাউন বন্ধ • বরাদ্দ নিষ্ক্রিয়</span>
          <div className="mt-auto h-2 rounded-pill bg-outline-variant" />
        </div>
      </div>
    </section>
  );
}

function CancelledHero({ data }: { data: HoldDetails }) {
  return (
    <section className="card overflow-hidden border-t-4 border-t-error" aria-label="আবেদনের অবস্থা">
      <div className="flex gap-space-md p-space-lg md:p-margin">
        <span className="hidden h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-error-container text-error sm:flex">
          <Icon name="cancel" className="text-[28px]" />
        </span>
        <div className="flex flex-col gap-space-md">
          <span className="pill w-fit bg-[#fef2f2] text-[#991b1b]">CANCELLED • বাতিলকৃত</span>
          <p className="text-headline-xl-mobile text-on-surface md:text-headline-lg">বাতিল (CANCELLED)</p>
          <p className="text-body-lg text-on-surface-variant">
            এই আবেদনটি বাতিল করা হয়েছে এবং seat অন্যদের জন্য ছেড়ে দেওয়া হয়েছে।
            {data.cancelledAt && ` বাতিলের সময়: ${formatDateTime(data.cancelledAt)}।`}
          </p>
        </div>
      </div>
    </section>
  );
}
