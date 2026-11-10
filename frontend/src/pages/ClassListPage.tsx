import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, EmptyState, SkeletonCards } from '../components/Alert';
import { Icon } from '../components/Icon';
import { SeatStats } from '../components/SeatStats';
import { useStudent } from '../context/StudentContext';
import { usePolling } from '../hooks/usePolling';
import { useNow } from '../hooks/useNow';
import { api } from '../lib/api';
import { formatNumber, formatPercent } from '../lib/format';
import { describeError } from '../lib/messages';
import type { AdmissionClass, StudentHold } from '../types/api';

export const CLASS_POLL_MS = 4000;

type ShiftFilter = 'all' | 'morning' | 'day' | 'open';

const filters: { id: ShiftFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'সকল শ্রেণি', icon: 'apps' },
  { id: 'morning', label: 'প্রভাতি শিফট (Morning)', icon: 'wb_twilight' },
  { id: 'day', label: 'দিবা শিফট (Day)', icon: 'light_mode' },
  { id: 'open', label: 'শুধু খালি আসন', icon: 'event_seat' },
];

/** Shift is inferred from the class name (each shift is its own class, PDF §1.3). */
export function shiftOf(name: string): 'morning' | 'day' | null {
  const value = name.toLowerCase();
  if (value.includes('morning') || value.includes('প্রভাতি') || value.includes('সকাল')) return 'morning';
  if (value.includes('day') || value.includes('দিবা')) return 'day';
  return null;
}

/** "Class তালিকা" (screen A): seat overview, filters, and a card per class with "আবেদন করুন". */
export function ClassListPage() {
  const { studentId } = useStudent();
  const navigate = useNavigate();
  const now = useNow();
  const [filter, setFilter] = useState<ShiftFilter>('all');
  const [pendingClassId, setPendingClassId] = useState<string | null>(null);
  const [classErrors, setClassErrors] = useState<Record<string, string>>({});

  const classes = usePolling((signal) => api.listClasses(signal), CLASS_POLL_MS);
  const myHolds = usePolling(
    (signal) => (studentId ? api.myHolds(studentId, signal) : Promise.resolve<StudentHold[]>([])),
    CLASS_POLL_MS,
    studentId !== null,
    [studentId],
  );

  const activeHoldFor = useCallback(
    (classId: string): StudentHold | undefined =>
      (studentId ? myHolds.data ?? [] : []).find(
        (hold) =>
          hold.classId === classId &&
          (hold.status === 'CONFIRMED' || (hold.status === 'HELD' && Date.parse(hold.expiresAt) > now)),
      ),
    [myHolds.data, now, studentId],
  );

  const list = classes.data ?? [];
  const totals = useMemo(
    () =>
      list.reduce(
        (acc, item) => ({
          total: acc.total + item.totalSeats,
          held: acc.held + item.heldSeats,
          confirmed: acc.confirmed + item.confirmedSeats,
          available: acc.available + item.availableSeats,
        }),
        { total: 0, held: 0, confirmed: 0, available: 0 },
      ),
    [list],
  );

  const visible = list.filter((item) => {
    if (filter === 'open') return item.availableSeats > 0;
    if (filter === 'morning' || filter === 'day') return shiftOf(item.name) === filter;
    return true;
  });

  const apply = async (admissionClass: AdmissionClass) => {
    if (!studentId) return;
    setPendingClassId(admissionClass.id);
    setClassErrors((errors) => ({ ...errors, [admissionClass.id]: '' }));
    try {
      const hold = await api.createHold(admissionClass.id, studentId);
      navigate(`/applications/${hold.holdId}`);
    } catch (error) {
      setClassErrors((errors) => ({ ...errors, [admissionClass.id]: describeError(error) }));
      void classes.refresh();
      void myHolds.refresh();
    } finally {
      setPendingClassId(null);
    }
  };

  const occupiedRatio = totals.total > 0 ? (totals.held + totals.confirmed) / totals.total : 0;

  return (
    <div className="flex flex-col gap-space-xl">
      {/* Hero + live seat metric */}
      <section className="grid gap-gutter lg:grid-cols-12" aria-labelledby="hero-heading">
        <div className="card flex flex-col gap-space-md p-space-lg lg:col-span-8 md:p-margin">
          <div className="flex flex-wrap gap-space-sm">
            <span className="pill bg-secondary-container text-on-secondary-container">নতুন শিক্ষাবর্ষ • সরাসরি আসন বরাদ্দ</span>
            <span className="pill bg-surface-container-high text-on-surface">আগে আবেদন করলে আগে পাবে</span>
          </div>
          <h1 id="hero-heading" className="text-headline-xl-mobile text-on-surface md:text-headline-xl">
            অনলাইন শিক্ষার্থী ভর্তি ও তাৎক্ষণিক আসন সংরক্ষণ
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            আগে আবেদন করলে আগে পাবেন — কোনো lottery নেই। প্রতিটি class ও shift-এ আসন সীমিত। আবেদন করলে আসনটি কিছু সময়ের জন্য
            শিক্ষার্থীর নামে hold থাকে; এর মধ্যে ভর্তি ফি দিলে ভর্তি নিশ্চিত হয়।
          </p>
          <ul className="grid gap-space-sm sm:grid-cols-3">
            {[
              { icon: 'hourglass_top', title: 'সময়সীমা পর্যন্ত seat hold', text: 'মেয়াদ শেষ হলে আসন নিজে থেকেই অন্যদের জন্য খুলে যায়' },
              { icon: 'pin', title: '১৭-ডিজিট জন্ম নিবন্ধন নম্বর', text: 'Login লাগবে না; উপরের ঘরে নম্বর দিন' },
              { icon: 'credit_card', title: 'ভর্তি ফি (simulated)', text: '“ভর্তি ফি দিন” চাপলেই ভর্তি নিশ্চিত — কোনো আসল লেনদেন নয়' },
            ].map((item) => (
              <li key={item.title} className="flex gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                <Icon name={item.icon} className="text-secondary" />
                <div>
                  <p className="text-label-lg text-on-surface">{item.title}</p>
                  <p className="text-body-sm text-on-surface-variant">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <aside
          className="flex flex-col justify-between gap-space-md rounded-xl bg-primary-container p-space-lg text-on-primary lg:col-span-4"
          aria-label="রিয়েল-টাইম আসন মেট্রিক"
        >
          <div className="flex items-center justify-between">
            <span className="text-label-md text-inverse-primary">রিয়েল-টাইম আসন মেট্রিক</span>
            <span className="h-2 w-2 animate-pulse rounded-pill bg-secondary-fixed-dim" aria-hidden="true" />
          </div>
          <div>
            <p className="font-mono text-headline-xl tabular">{formatNumber(totals.total)}</p>
            <p className="text-body-sm text-inverse-primary">
              মোট আসন বরাদ্দ • {formatNumber(list.length)}টি class
            </p>
          </div>
          <div className="rounded-xl bg-white/5 p-space-md">
            <div className="mb-space-sm flex justify-between text-label-md">
              <span className="text-inverse-primary">সামগ্রিক পূর্ণতা:</span>
              <span className="text-secondary-fixed-dim">{formatPercent(occupiedRatio)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-pill bg-white/10">
              <div className="h-full bg-secondary-fixed-dim" style={{ width: `${occupiedRatio * 100}%` }} />
            </div>
            <dl className="mt-space-md grid grid-cols-3 gap-1 text-center">
              <div className="rounded-lg bg-white/5 py-space-sm">
                <dt className="text-label-sm text-inverse-primary">নিশ্চিত</dt>
                <dd className="font-mono text-headline-sm tabular">{formatNumber(totals.confirmed)}</dd>
              </div>
              <div className="rounded-lg bg-white/5 py-space-sm">
                <dt className="text-label-sm text-tertiary-fixed-dim">সংরক্ষিত</dt>
                <dd className="font-mono text-headline-sm tabular">{formatNumber(totals.held)}</dd>
              </div>
              <div className="rounded-lg bg-white/5 py-space-sm">
                <dt className="text-label-sm text-secondary-fixed-dim">খালি</dt>
                <dd className="font-mono text-headline-sm tabular">{formatNumber(totals.available)}</dd>
              </div>
            </dl>
          </div>
          <p className="text-label-sm text-on-primary-container">প্রতি {formatNumber(CLASS_POLL_MS / 1000)} সেকেন্ডে নিজে থেকে হালনাগাদ</p>
        </aside>
      </section>

      {/* Catalogue */}
      <section aria-labelledby="classes-heading" className="flex flex-col gap-space-md">
        <div className="flex flex-col gap-space-md lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-label-md text-secondary">আসন রেজিস্ট্রি • লাইভ</p>
            <h2 id="classes-heading" className="text-headline-lg-mobile text-on-surface md:text-headline-lg">
              শ্রেণি ও শিফট তালিকা (Class &amp; Shift Catalogue)
            </h2>
            <p className="text-body-sm text-on-surface-variant">
              পছন্দের শ্রেণিতে খালি আসন থাকলে “আবেদন করুন” বাটনে ক্লিক করুন।
            </p>
          </div>
          <div className="-mx-gutter-mobile overflow-x-auto px-gutter-mobile md:mx-0 md:px-0" role="group" aria-label="শ্রেণি ফিল্টার">
            <div className="inline-flex gap-space-xs rounded-xl bg-surface-container-lowest p-1 shadow-card">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                  className={`tab ${filter === item.id ? 'tab-active' : ''}`}
                >
                  <Icon name={item.icon} className="text-[18px]" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!studentId && (
          <Alert tone="info">আবেদন করতে আগে উপরের ঘরে শিক্ষার্থীর ১৭ অঙ্কের জন্ম নিবন্ধন নম্বর লিখে সংরক্ষণ করুন।</Alert>
        )}

        {classes.error !== undefined && classes.data && (
          <Alert tone="warning">{describeError(classes.error)} সর্বশেষ পাওয়া তথ্য দেখানো হচ্ছে।</Alert>
        )}

        {classes.loading && !classes.data && (
          <>
            <p className="sr-only" role="status">
              Class তালিকা লোড হচ্ছে…
            </p>
            <SkeletonCards />
          </>
        )}

        {classes.error !== undefined && !classes.data && (
          <Alert tone="error" title="Class তালিকা আনা যায়নি">
            <p className="mb-space-sm">{describeError(classes.error)}</p>
            <button type="button" className="btn-primary" onClick={() => void classes.refresh()}>
              <Icon name="refresh" className="text-[18px]" /> আবার চেষ্টা করুন
            </button>
          </Alert>
        )}

        {classes.data && list.length === 0 && (
          <EmptyState icon="search_off" title="এখনো কোনো class তৈরি হয়নি">
            <Link to="/admin/classes/new" className="btn-primary">
              স্কুল অ্যাডমিন থেকে class তৈরি করুন
            </Link>
          </EmptyState>
        )}

        {classes.data && list.length > 0 && visible.length === 0 && (
          <EmptyState icon="filter_alt_off" title="এই ফিল্টারে কোনো class নেই">
            <button type="button" className="btn-outline" onClick={() => setFilter('all')}>
              ফিল্টার মুছুন
            </button>
          </EmptyState>
        )}

        {visible.length > 0 && (
          <ul className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
            {visible.map((admissionClass) => {
              const active = activeHoldFor(admissionClass.id);
              const full = admissionClass.availableSeats <= 0;
              const pending = pendingClassId === admissionClass.id;
              const error = classErrors[admissionClass.id];
              const shift = shiftOf(admissionClass.name);
              return (
                <li
                  key={admissionClass.id}
                  className={`card flex flex-col gap-space-md p-space-lg ${full ? 'bg-surface-container-low' : ''}`}
                >
                  <div className="flex items-start justify-between gap-space-sm">
                    <div className="flex min-w-0 flex-col gap-space-xs">
                      {shift && (
                        <span className="pill w-fit bg-surface-container text-on-surface-variant">
                          {shift === 'morning' ? 'প্রভাতি শিফট' : 'দিবা শিফট'}
                        </span>
                      )}
                      <h3 className="text-headline-sm text-on-surface">{admissionClass.name}</h3>
                    </div>
                    <span
                      className={`pill flex-shrink-0 ${
                        full ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'
                      }`}
                    >
                      {full ? 'আসন পূর্ণ' : 'ভর্তি চলছে'}
                    </span>
                  </div>

                  <SeatStats {...admissionClass} />

                  {error && (
                    <p className="field-error" role="alert">
                      <Icon name="error" className="text-[16px]" />
                      {error}
                    </p>
                  )}

                  <div className="mt-auto flex flex-col gap-space-xs">
                    {active ? (
                      <Link to={`/applications/${active.holdId}`} className="btn-confirm w-full">
                        <Icon name={active.status === 'CONFIRMED' ? 'verified' : 'hourglass_top'} className="text-[18px]" />
                        {active.status === 'CONFIRMED' ? 'ভর্তি নিশ্চিত — দেখুন' : 'চলমান আবেদন দেখুন'}
                      </Link>
                    ) : full ? (
                      <button type="button" className="btn-disabled-soft w-full" disabled>
                        <Icon name="block" className="text-[18px]" /> আসন খালি নেই (Full)
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary w-full"
                        disabled={!studentId || pending}
                        onClick={() => void apply(admissionClass)}
                        aria-describedby={!studentId ? `need-id-${admissionClass.id}` : undefined}
                      >
                        {pending ? 'আবেদন পাঠানো হচ্ছে…' : 'আবেদন করুন'}
                        {!pending && <Icon name="arrow_forward" className="text-[18px]" />}
                      </button>
                    )}
                    {!studentId && !active && !full && (
                      <span id={`need-id-${admissionClass.id}`} className="text-center text-body-sm text-on-surface-variant">
                        আগে জন্ম নিবন্ধন নম্বর দিন
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
