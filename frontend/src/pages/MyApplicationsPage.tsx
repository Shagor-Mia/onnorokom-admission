import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, EmptyState, Loading } from '../components/Alert';
import { Icon } from '../components/Icon';
import { KpiCard } from '../components/SeatStats';
import { StatusBadge } from '../components/StatusBadge';
import { useStudent } from '../context/StudentContext';
import { usePolling } from '../hooks/usePolling';
import { useNow } from '../hooks/useNow';
import { api } from '../lib/api';
import { formatDateTime, formatDuration, formatNumber, remainingMs, trackingNumber } from '../lib/format';
import { describeError } from '../lib/messages';
import { maskStudentId } from '../lib/studentId';
import type { HoldStatus, StudentHold } from '../types/api';
import { effectiveStatus } from './ApplicationPage';

export const MY_HOLDS_POLL_MS = 5000;

type Filter = 'ALL' | HoldStatus;

const tabs: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'সকল আবেদন' },
  { id: 'HELD', label: 'সাময়িক সংরক্ষিত (HELD)' },
  { id: 'CONFIRMED', label: 'নিশ্চিত ভর্তি (CONFIRMED)' },
  { id: 'EXPIRED', label: 'সময় উত্তীর্ণ (EXPIRED)' },
  { id: 'CANCELLED', label: 'বাতিলকৃত (CANCELLED)' },
];

/** "আমার আবেদন" (screen E): every application of this student and its current status. */
export function MyApplicationsPage() {
  const { studentId } = useStudent();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const holds = usePolling(
    (signal) => (studentId ? api.myHolds(studentId, signal) : Promise.resolve<StudentHold[]>([])),
    MY_HOLDS_POLL_MS,
    studentId !== null,
    [studentId],
  );

  if (!studentId) {
    return (
      <section aria-labelledby="mine-heading" className="flex flex-col gap-space-md">
        <h1 id="mine-heading" className="text-headline-lg-mobile md:text-headline-lg">
          আমার আবেদনসমূহ
        </h1>
        <Alert tone="info">
          উপরের ঘরে শিক্ষার্থীর ১৭ অঙ্কের জন্ম নিবন্ধন নম্বর দিন — তারপর এই শিক্ষার্থীর সব আবেদন এখানে দেখা যাবে।
        </Alert>
      </section>
    );
  }

  const items = (holds.data ?? []).map((hold) => ({ ...hold, shown: effectiveStatus(hold, now) }));
  const counts = items.reduce<Record<HoldStatus, number>>(
    (acc, hold) => {
      acc[hold.shown] += 1;
      return acc;
    },
    { HELD: 0, CONFIRMED: 0, EXPIRED: 0, CANCELLED: 0 },
  );
  const total = items.length;
  const nextExpiry = items
    .filter((hold) => hold.shown === 'HELD')
    .map((hold) => remainingMs(hold.expiresAt, now))
    .sort((a, b) => a - b)[0];

  const needle = query.trim().toLowerCase();
  const visible = items.filter(
    (hold) =>
      (filter === 'ALL' || hold.shown === filter) &&
      (needle === '' ||
        hold.className.toLowerCase().includes(needle) ||
        hold.holdId.toLowerCase().includes(needle) ||
        trackingNumber(hold.holdId).toLowerCase().includes(needle)),
  );

  return (
    <section aria-labelledby="mine-heading" className="flex flex-col gap-gutter">
      <div className="flex flex-col gap-space-md md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-space-md">
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
            <Icon name="school" className="text-[28px]" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-space-sm">
              <h1 id="mine-heading" className="text-headline-lg-mobile md:text-headline-lg">
                আমার আবেদনসমূহ
              </h1>
              <span className="pill bg-secondary-container text-on-secondary-container">আবেদনকারী শিক্ষার্থী</span>
            </div>
            <p className="flex items-center gap-1 text-body-sm text-on-surface-variant">
              <Icon name="verified_user" className="text-[16px]" /> জন্ম নিবন্ধন (BRN):{' '}
              <span className="font-mono tracking-wider tabular">{maskStudentId(studentId)}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-space-sm">
          <button type="button" className="btn-outline no-print" onClick={() => window.print()}>
            <Icon name="print" className="text-[18px]" /> সারসংক্ষেপ প্রিন্ট
          </button>
          <Link to="/" className="btn-primary">
            <Icon name="add_circle" className="text-[18px]" /> নতুন আবেদন করুন
          </Link>
        </div>
      </div>

      {holds.loading && !holds.data && <Loading label="আবেদনগুলো লোড হচ্ছে…" />}
      {holds.error !== undefined && (
        <Alert tone={holds.data ? 'warning' : 'error'}>
          {describeError(holds.error)}
          {holds.data ? ' সর্বশেষ পাওয়া তথ্য দেখানো হচ্ছে।' : ''}
        </Alert>
      )}

      {holds.data && (
        <div className="grid grid-cols-2 gap-space-md lg:grid-cols-4" role="group" aria-label="আবেদনের সারসংক্ষেপ">
          <KpiCard label="মোট দাখিলকৃত আবেদন" value={total} icon="folder_open" accent="navy" ratio={total > 0 ? 1 : 0} />
          <KpiCard
            label="সাময়িক সংরক্ষিত (HELD)"
            value={counts.HELD}
            icon="timer"
            accent="amber"
            ratio={total ? counts.HELD / total : 0}
            note={nextExpiry !== undefined ? `${formatDuration(nextExpiry)} বাকি` : undefined}
          />
          <KpiCard label="চূড়ান্ত নিশ্চিত (CONFIRMED)" value={counts.CONFIRMED} icon="verified" accent="teal" ratio={total ? counts.CONFIRMED / total : 0} />
          <KpiCard
            label="মেয়াদোত্তীর্ণ বা বাতিল"
            value={counts.EXPIRED + counts.CANCELLED}
            icon="history"
            accent="slate"
            ratio={total ? (counts.EXPIRED + counts.CANCELLED) / total : 0}
            note={`${formatNumber(counts.EXPIRED)} EXPIRED / ${formatNumber(counts.CANCELLED)} CANCELLED`}
          />
        </div>
      )}

      {holds.data && total > 0 && (
        <div className="card flex flex-col gap-space-sm p-space-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 overflow-x-auto px-1" role="group" aria-label="অবস্থা অনুযায়ী ফিল্টার">
            <div className="inline-flex gap-space-xs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={filter === tab.id}
                  className={`tab ${filter === tab.id ? 'tab-active' : ''}`}
                  onClick={() => setFilter(tab.id)}
                >
                  {tab.label}
                  <span className={`pill ${filter === tab.id ? 'bg-white/20 text-on-primary' : 'bg-surface-container text-on-surface'}`}>
                    {formatNumber(tab.id === 'ALL' ? total : counts[tab.id])}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <label className="relative lg:w-80">
            <span className="sr-only">আবেদন খুঁজুন</span>
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              className="input pl-10"
              placeholder="আবেদন নম্বর বা শ্রেণি খুঁজুন"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
      )}

      {holds.data && total === 0 && (
        <EmptyState icon="inbox" title="কোনো আবেদন খুঁজে পাওয়া যায়নি">
          <p className="max-w-md text-body-sm text-on-surface-variant">
            এই জন্ম নিবন্ধন নম্বরের অধীনে এখনো কোনো আবেদন নেই। ক্যাটালগে গিয়ে খালি আসনে আবেদন করুন।
          </p>
          <Link to="/" className="btn-primary">
            <Icon name="view_list" className="text-[18px]" /> নতুন আসন খুঁজুন / ক্যাটালগে যান
          </Link>
        </EmptyState>
      )}

      {holds.data && total > 0 && visible.length === 0 && (
        <EmptyState icon="filter_alt_off" title="এই ফিল্টারে কোনো আবেদন নেই" />
      )}

      {visible.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-left text-body-sm">
              <caption className="sr-only">এই শিক্ষার্থীর আবেদনসমূহ</caption>
              <thead className="border-y border-[#e2e8f0] bg-[#f8fafc] text-label-md text-[#334155]">
                <tr>
                  <th scope="col" className="px-space-md py-space-sm">আবেদন নম্বর ও তারিখ</th>
                  <th scope="col" className="px-space-md py-space-sm">শ্রেণি ও শিফট</th>
                  <th scope="col" className="px-space-md py-space-sm text-center">স্ট্যাটাস</th>
                  <th scope="col" className="px-space-md py-space-sm">সময়সীমা ও মেয়াদ</th>
                  <th scope="col" className="px-space-md py-space-sm text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((hold) => (
                  <tr key={hold.holdId} className="border-b border-surface-container last:border-0 hover:bg-[#f8fafc]">
                    <td className="px-space-md py-space-md">
                      <span className="block font-mono text-label-lg text-on-surface">{trackingNumber(hold.holdId)}</span>
                      <span className="text-label-md text-on-surface-variant">{formatDateTime(hold.createdAt)}</span>
                    </td>
                    <th scope="row" className="px-space-md py-space-md text-label-lg font-semibold text-on-surface">
                      {hold.className}
                    </th>
                    <td className="px-space-md py-space-md text-center">
                      <StatusBadge status={hold.shown} />
                    </td>
                    <td className="px-space-md py-space-md">
                      <HoldTiming hold={hold} shown={hold.shown} now={now} />
                    </td>
                    <td className="px-space-md py-space-md text-right">
                      <HoldAction hold={hold} shown={hold.shown} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-space-md md:hidden">
            {visible.map((hold) => (
              <li key={hold.holdId} className="card flex flex-col gap-space-sm p-space-md">
                <div className="flex items-start justify-between gap-space-sm">
                  <div>
                    <h2 className="text-headline-sm text-on-surface">{hold.className}</h2>
                    <span className="font-mono text-label-md text-on-surface-variant">{trackingNumber(hold.holdId)}</span>
                  </div>
                  <StatusBadge status={hold.shown} />
                </div>
                <HoldTiming hold={hold} shown={hold.shown} now={now} />
                <HoldAction hold={hold} shown={hold.shown} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function HoldTiming({ hold, shown, now }: { hold: StudentHold; shown: HoldStatus; now: number }) {
  if (shown === 'HELD') {
    return (
      <span className="flex items-center gap-1 text-label-lg text-error">
        <Icon name="timer" className="text-[16px]" />
        মেয়াদ শেষ হতে বাকি {formatDuration(remainingMs(hold.expiresAt, now))}
      </span>
    );
  }
  if (shown === 'CONFIRMED') return <span className="text-on-surface-variant">নিশ্চিত: {formatDateTime(hold.confirmedAt ?? null)}</span>;
  if (shown === 'CANCELLED') return <span className="text-on-surface-variant">বাতিল: {formatDateTime(hold.cancelledAt ?? null)}</span>;
  return <span className="text-on-surface-variant">মেয়াদ শেষ: {formatDateTime(hold.expiresAt)}</span>;
}

function HoldAction({ hold, shown }: { hold: StudentHold; shown: HoldStatus }) {
  if (shown === 'HELD') {
    return (
      <Link to={`/applications/${hold.holdId}`} className="btn-confirm min-h-[40px]">
        <Icon name="payments" className="text-[18px]" /> ভর্তি ফি দিন / বিস্তারিত
      </Link>
    );
  }
  if (shown === 'EXPIRED' || shown === 'CANCELLED') {
    return (
      <span className="inline-flex flex-wrap justify-end gap-space-xs">
        <Link to={`/applications/${hold.holdId}`} className="btn-outline min-h-[40px]">
          বিস্তারিত দেখুন
        </Link>
        <Link to="/" className="btn-soft min-h-[40px]">
          <Icon name="refresh" className="text-[18px]" /> পুনরায় আবেদন
        </Link>
      </span>
    );
  }
  return (
    <Link to={`/applications/${hold.holdId}`} className="btn-primary min-h-[40px]">
      <Icon name="description" className="text-[18px]" /> বিস্তারিত দেখুন
    </Link>
  );
}
