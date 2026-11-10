import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, EmptyState, Loading } from '../components/Alert';
import { Icon } from '../components/Icon';
import { KpiCard } from '../components/SeatStats';
import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { formatNumber, formatPercent, formatTime } from '../lib/format';
import { describeError } from '../lib/messages';
import type { AdmissionClass } from '../types/api';
import { CLASS_POLL_MS, shiftOf } from './ClassListPage';

type TableFilter = 'all' | 'high' | 'full';

const occupancy = (item: AdmissionClass) =>
  item.totalSeats > 0 ? (item.heldSeats + item.confirmedSeats) / item.totalSeats : 0;

/** School admin dashboard (screen F): live seat inventory of every class. */
export function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [created, setCreated] = useState<string | null>(
    (location.state as { created?: string } | null)?.created ?? null,
  );
  const [filter, setFilter] = useState<TableFilter>('all');
  const [shift, setShift] = useState<'all' | 'morning' | 'day'>('all');
  const [query, setQuery] = useState('');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const classes = usePolling(async (signal) => {
    const result = await api.listClasses(signal);
    setSyncedAt(new Date().toISOString());
    return result;
  }, CLASS_POLL_MS);

  // Show the "created" message once, then forget it so a refresh does not repeat it.
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const list = classes.data ?? [];
  const totals = list.reduce(
    (acc, item) => ({
      total: acc.total + item.totalSeats,
      held: acc.held + item.heldSeats,
      confirmed: acc.confirmed + item.confirmedSeats,
      available: acc.available + item.availableSeats,
    }),
    { total: 0, held: 0, confirmed: 0, available: 0 },
  );
  const highDemand = list.filter((item) => occupancy(item) >= 0.8 && item.availableSeats > 0).length;
  const fullCount = list.filter((item) => item.availableSeats <= 0).length;

  const needle = query.trim().toLowerCase();
  const visible = list.filter(
    (item) =>
      (filter === 'all' ||
        (filter === 'full' && item.availableSeats <= 0) ||
        (filter === 'high' && occupancy(item) >= 0.8 && item.availableSeats > 0)) &&
      (shift === 'all' || shiftOf(item.name) === shift) &&
      (needle === '' || item.name.toLowerCase().includes(needle)),
  );

  const confirmedRatio = totals.total > 0 ? totals.confirmed / totals.total : 0;
  const heldRatio = totals.total > 0 ? totals.held / totals.total : 0;

  return (
    <div className="flex flex-col gap-gutter">
      <div className="flex flex-col gap-space-md lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-label-md text-on-surface-variant">অ্যাডমিন কন্ট্রোল প্যানেল / সেন্ট্রাল ড্যাশবোর্ড</p>
          <h1 className="text-headline-lg-mobile md:text-headline-lg">আসন ব্যবস্থাপনা ও ভর্তি ড্যাশবোর্ড</h1>
          <p className="text-body-sm text-on-surface-variant">
            রিয়েল-টাইম আসন বণ্টন, সাময়িক সংরক্ষণ (HELD) ও নিশ্চিত ভর্তি পর্যবেক্ষণ। (Demo: অ্যাডমিন অংশে login নেই।)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <span className="pill bg-surface-container-high text-on-surface" aria-live="polite">
            <span className="h-2 w-2 rounded-pill bg-secondary" aria-hidden="true" />
            সর্বশেষ সিঙ্ক: {syncedAt ? formatTime(syncedAt) : '—'}
          </span>
          <button type="button" className="btn-soft" onClick={() => void classes.refresh()}>
            <Icon name="sync" className="text-[18px]" /> রিফ্রেশ
          </button>
          <Link to="/admin/classes/new" className="btn-primary">
            <Icon name="add_circle" className="text-[18px]" /> নতুন শ্রেণি/শিফট যোগ
          </Link>
        </div>
      </div>

      {created && (
        <Alert tone="success" title="শ্রেণি তৈরি হয়েছে">
          {created}{' '}
          <button type="button" className="underline" onClick={() => setCreated(null)}>
            ঠিক আছে
          </button>
        </Alert>
      )}

      <div className="flex flex-col gap-space-sm rounded-xl border border-surface-container-high bg-surface-container-low p-space-md md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-space-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
            <Icon name="verified_user" />
          </span>
          <div>
            <p className="text-label-lg text-on-surface">
              কনকারেন্ট লক সক্রিয় <span className="pill ml-1 bg-secondary-container text-on-secondary-container">PostgreSQL row lock</span>
            </p>
            <p className="text-body-sm text-on-surface-variant">
              প্রতিটি আবেদন একটি database transaction-এ class row lock করে seat গোনে — একসাথে যত আবেদনই আসুক, seat-এর বেশি hold হয় না।
            </p>
          </div>
        </div>
        <p className="flex items-center gap-1 rounded-lg bg-surface-container-lowest px-space-md py-space-sm text-body-sm shadow-card">
          <Icon name="hourglass_top" className="text-[18px] text-on-tertiary-container" />
          বর্তমানে <strong>{formatNumber(totals.held)}টি</strong> আসন ফি প্রদানের অপেক্ষায়
        </p>
      </div>

      {classes.loading && !classes.data && <Loading />}
      {classes.error !== undefined && (
        <Alert tone={classes.data ? 'warning' : 'error'}>
          {describeError(classes.error)}
          {classes.data ? ' সর্বশেষ পাওয়া তথ্য দেখানো হচ্ছে।' : ''}
        </Alert>
      )}

      {classes.data && (
        <div className="grid grid-cols-2 gap-space-md md:grid-cols-3 xl:grid-cols-5" role="group" aria-label="সারসংক্ষেপ">
          <KpiCard label="মোট শ্রেণি ও শিফট" value={list.length} icon="account_balance" accent="navy" note="টি class" />
          <KpiCard label="মোট নির্ধারিত আসন" value={totals.total} icon="event_seat" accent="navy" ratio={totals.total ? 1 : 0} />
          <KpiCard label="সাময়িক সংরক্ষিত (HELD)" value={totals.held} icon="lock_clock" accent="amber" ratio={heldRatio} note={formatPercent(heldRatio)} />
          <KpiCard label="চূড়ান্ত ভর্তি নিশ্চিত" value={totals.confirmed} icon="how_to_reg" accent="teal" ratio={confirmedRatio} note={formatPercent(confirmedRatio)} />
          <KpiCard
            label="অবশিষ্ট খালি আসন"
            value={totals.available}
            icon="chair"
            accent="slate"
            ratio={totals.total ? totals.available / totals.total : 0}
            note={formatPercent(totals.total ? totals.available / totals.total : 0)}
          />
        </div>
      )}

      {classes.data && (
        <div className="grid gap-gutter xl:grid-cols-12">
          <section className="card flex flex-col gap-space-md p-space-md xl:col-span-8 md:p-space-lg" aria-labelledby="inventory-heading">
            <div className="flex flex-col gap-space-sm md:flex-row md:items-start md:justify-between">
              <div>
                <h2 id="inventory-heading" className="flex items-center gap-space-sm text-headline-sm">
                  <Icon name="table_chart" /> শ্রেণি ও শিফট ভিত্তিক আসন বিবরণী
                </h2>
                <p className="text-body-sm text-on-surface-variant">প্রতি {formatNumber(CLASS_POLL_MS / 1000)} সেকেন্ডে নিজে থেকে হালনাগাদ</p>
              </div>
              <div className="inline-flex gap-space-xs rounded-xl bg-surface-container-low p-1" role="group" aria-label="অবস্থা ফিল্টার">
                {(
                  [
                    { id: 'all', label: `সকল শ্রেণি (${formatNumber(list.length)})` },
                    { id: 'high', label: `উচ্চ চাহিদা (${formatNumber(highDemand)})` },
                    { id: 'full', label: `আসন পূর্ণ (${formatNumber(fullCount)})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={filter === tab.id}
                    className={`tab ${filter === tab.id ? 'bg-surface-container-lowest text-on-surface shadow-card' : ''}`}
                    onClick={() => setFilter(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-space-sm rounded-xl bg-surface-container-low p-space-sm sm:grid-cols-3">
              <label className="relative sm:col-span-2">
                <span className="sr-only">শ্রেণি খুঁজুন</span>
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  className="input pl-10"
                  placeholder="শ্রেণি বা শিফটের নাম দিয়ে খুঁজুন"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label>
                <span className="sr-only">শিফট</span>
                <select className="input" value={shift} onChange={(event) => setShift(event.target.value as typeof shift)}>
                  <option value="all">সকল শিফট</option>
                  <option value="morning">প্রভাতি শিফট (Morning)</option>
                  <option value="day">দিবা শিফট (Day)</option>
                </select>
              </label>
            </div>

            {list.length === 0 ? (
              <EmptyState icon="add_business" title="এখনো কোনো class তৈরি হয়নি">
                <Link to="/admin/classes/new" className="btn-primary">
                  প্রথম class তৈরি করুন
                </Link>
              </EmptyState>
            ) : visible.length === 0 ? (
              <EmptyState icon="filter_alt_off" title="এই ফিল্টারে কোনো class নেই" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-body-sm">
                  <caption className="sr-only">প্রতিটি class-এর মোট, hold-এ থাকা, নিশ্চিত ও খালি seat</caption>
                  <thead className="border-y border-[#e2e8f0] bg-[#f8fafc] text-label-md text-[#334155]">
                    <tr>
                      <th scope="col" className="px-space-md py-space-sm text-left">শ্রেণি ও শিফট বিবরণ</th>
                      <th scope="col" className="px-space-md py-space-sm text-right">মোট আসন</th>
                      <th scope="col" className="px-space-md py-space-sm text-center">সংরক্ষিত (HELD)</th>
                      <th scope="col" className="px-space-md py-space-sm text-right">নিশ্চিত</th>
                      <th scope="col" className="px-space-md py-space-sm text-right">খালি</th>
                      <th scope="col" className="px-space-md py-space-sm text-left">দখল হার ও অগ্রগতি</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item) => {
                      const ratio = occupancy(item);
                      const full = item.availableSeats <= 0;
                      return (
                        <tr key={item.id} className={`border-b border-surface-container last:border-0 hover:bg-[#f8fafc] ${full ? 'bg-[#fef2f2]/60' : ''}`}>
                          <th scope="row" className="min-h-[48px] px-space-md py-space-sm text-left text-label-lg font-semibold text-on-surface">
                            {item.name}
                          </th>
                          <td className="px-space-md py-space-sm text-right tabular">{formatNumber(item.totalSeats)}</td>
                          <td className="px-space-md py-space-sm text-center">
                            <span className="pill bg-tertiary-fixed text-on-tertiary-fixed-variant tabular">{formatNumber(item.heldSeats)}</span>
                          </td>
                          <td className="px-space-md py-space-sm text-right text-secondary tabular">{formatNumber(item.confirmedSeats)}</td>
                          <td className="px-space-md py-space-sm text-right">
                            <span className={`rounded-lg px-2 py-0.5 tabular ${full ? 'bg-error-container text-error' : 'bg-surface-container'}`}>
                              {formatNumber(item.availableSeats)}
                              {full ? ' (পূর্ণ)' : ''}
                            </span>
                          </td>
                          <td className="px-space-md py-space-sm">
                            <div className="flex justify-between text-label-md text-on-surface-variant">
                              <span className={full ? 'text-error' : ''}>{formatPercent(ratio)} পূর্ণ</span>
                              <span className="tabular">
                                {formatNumber(item.heldSeats + item.confirmedSeats)}/{formatNumber(item.totalSeats)}
                              </span>
                            </div>
                            <div className="mt-1 flex h-1.5 w-full min-w-[120px] overflow-hidden rounded-pill bg-surface-container">
                              <span className="bg-secondary" style={{ width: `${(item.confirmedSeats / item.totalSeats) * 100}%` }} />
                              <span className="bg-[#d97706]" style={{ width: `${(item.heldSeats / item.totalSeats) * 100}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap gap-space-md text-label-md text-on-surface-variant">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-secondary" /> নিশ্চিত ভর্তি</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-[#d97706]" /> সাময়িক সংরক্ষিত (HELD)</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-surface-container" /> খালি আসন</span>
            </div>
          </section>

          <section className="card flex flex-col gap-space-md p-space-lg xl:col-span-4" aria-labelledby="progress-heading">
            <div className="flex items-center justify-between">
              <h2 id="progress-heading" className="text-headline-sm">সামগ্রিক ভর্তি অগ্রগতি</h2>
              <span className="pill bg-surface-container text-on-surface">{formatNumber(totals.total)} আসন</span>
            </div>
            <Donut confirmed={confirmedRatio} held={heldRatio} />
            <ul className="flex flex-col gap-space-sm text-body-sm">
              <li className="flex justify-between rounded-lg bg-surface-container-low px-space-md py-space-sm">
                <span className="flex items-center gap-space-sm"><span className="h-3 w-3 rounded-pill bg-secondary" /> নিশ্চিত ভর্তি</span>
                <strong className="tabular">{formatNumber(totals.confirmed)} আসন</strong>
              </li>
              <li className="flex justify-between rounded-lg bg-surface-container-low px-space-md py-space-sm">
                <span className="flex items-center gap-space-sm"><span className="h-3 w-3 rounded-pill bg-[#d97706]" /> সাময়িক সংরক্ষিত (ফি অপেক্ষমাণ)</span>
                <strong className="tabular text-on-tertiary-container">{formatNumber(totals.held)} আসন</strong>
              </li>
              <li className="flex justify-between rounded-lg bg-surface-container-low px-space-md py-space-sm">
                <span className="flex items-center gap-space-sm"><span className="h-3 w-3 rounded-pill bg-outline-variant" /> আবেদনযোগ্য খালি আসন</span>
                <strong className="tabular">{formatNumber(totals.available)} আসন</strong>
              </li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

/** Ring chart: confirmed (teal) then held (amber) share of all seats. */
function Donut({ confirmed, held }: { confirmed: number; held: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const confirmedLength = confirmed * circumference;
  const heldLength = held * circumference;
  return (
    <div className="relative mx-auto h-48 w-48" role="img" aria-label={`নিশ্চিত ভর্তি হার ${formatPercent(confirmed)}`}>
      <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#e5eeff" strokeWidth="18" />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="#006a61"
          strokeWidth="18"
          strokeDasharray={`${confirmedLength} ${circumference}`}
        />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="#d97706"
          strokeWidth="18"
          strokeDasharray={`${heldLength} ${circumference}`}
          strokeDashoffset={-confirmedLength}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-headline-lg tabular">{formatPercent(confirmed)}</span>
        <span className="text-label-md text-on-surface-variant">নিশ্চিত ভর্তি হার</span>
      </div>
    </div>
  );
}
