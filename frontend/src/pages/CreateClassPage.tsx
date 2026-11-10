import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { Icon } from '../components/Icon';
import { usePolling } from '../hooks/usePolling';
import { ApiError, api } from '../lib/api';
import { formatNumber } from '../lib/format';
import { describeError } from '../lib/messages';

type Shift = 'morning' | 'day' | 'none';

const shiftLabels: Record<Exclude<Shift, 'none'>, { bn: string; en: string; icon: string; note: string }> = {
  morning: { bn: 'প্রভাতি শিফট', en: 'Morning Shift', icon: 'wb_twilight', note: 'সকালের শিফট — আলাদা class ও আলাদা seat সংখ্যা' },
  day: { bn: 'দিবা শিফট', en: 'Day Shift', icon: 'light_mode', note: 'দুপুরের শিফট — আলাদা class ও আলাদা seat সংখ্যা' },
};

const quickPicks = ['৬ষ্ঠ শ্রেণি', '৭ম শ্রেণি', '৮ম শ্রেণি', '৯ম শ্রেণি', '১০ম শ্রেণি'];

const MAX_SEATS = 2_147_483_647;

/** "Class 6" + morning -> "Class 6 - Morning Shift" style name (each shift is its own class). */
export function composeClassName(base: string, shift: Shift): string {
  const name = base.trim();
  if (shift === 'none' || name.length === 0) return name;
  return `${name} - ${shiftLabels[shift].en}`;
}

export interface FormErrors {
  name?: string;
  totalSeats?: string;
}

export function validateClassForm(name: string, totalSeats: string, existingNames: string[] = []): FormErrors {
  const errors: FormErrors = {};
  const trimmed = name.trim();
  if (trimmed.length === 0) errors.name = 'শ্রেণির নাম লিখুন।';
  else if (trimmed.length > 200) errors.name = 'নাম ২০০ অক্ষরের মধ্যে রাখুন।';
  else if (existingNames.some((existing) => existing.trim().toLowerCase() === trimmed.toLowerCase())) {
    errors.name = 'এই নামে একটি class ইতিমধ্যে আছে। অনুগ্রহ করে নতুন নাম বা শিফট দিন।';
  }

  const seats = totalSeats.trim();
  if (seats.length === 0) errors.totalSeats = 'Seat সংখ্যা লিখুন।';
  else if (!/^[0-9]+$/.test(seats) || Number(seats) < 1) {
    errors.totalSeats = 'Seat সংখ্যা ১ বা তার বেশি পূর্ণসংখ্যা হতে হবে।';
  } else if (Number(seats) > MAX_SEATS) {
    errors.totalSeats = 'Seat সংখ্যা অনেক বড়।';
  }
  return errors;
}

/** "Class তৈরি (school admin)" — screen G (form + live preview + validation summary). */
export function CreateClassPage() {
  const navigate = useNavigate();
  const [base, setBase] = useState('');
  const [shift, setShift] = useState<Shift>('none');
  const [totalSeats, setTotalSeats] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const nameId = useId();
  const seatsId = useId();

  // Existing names, so a duplicate can be flagged before submitting.
  const existing = usePolling((signal) => api.listClasses(signal), 15000);
  const existingNames = (existing.data ?? []).map((item) => item.name);

  const finalName = composeClassName(base, shift);
  const seatsNumber = /^[0-9]+$/.test(totalSeats.trim()) ? Number(totalSeats.trim()) : 0;
  const errorList = [errors.name, errors.totalSeats].filter(Boolean) as string[];

  // Editing a field clears its stale error, so the summary/badge never contradict the current input.
  const clearError = (field: keyof FormErrors) =>
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  const changeSeats = (delta: number) => {
    const next = Math.max(1, (seatsNumber || 0) + delta);
    setTotalSeats(String(next));
    clearError('totalSeats');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setServerError(null);
    const found = validateClassForm(finalName, totalSeats, existingNames);
    setErrors(found);
    if (found.name || found.totalSeats) return;

    setSubmitting(true);
    try {
      const result = await api.createClass({ name: finalName, totalSeats: Number(totalSeats.trim()) });
      navigate('/admin', {
        state: { created: `“${result.name}” তৈরি হয়েছে (${formatNumber(result.totalSeats)}টি seat)।` },
      });
    } catch (error) {
      setServerError(
        error instanceof ApiError && (error.status === 400 || error.status === 422)
          ? 'তথ্য সঠিক নয়: নাম ফাঁকা রাখা যাবে না এবং seat সংখ্যা ১ বা তার বেশি পূর্ণসংখ্যা হতে হবে।'
          : describeError(error),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-gutter">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <nav aria-label="Breadcrumb" className="flex items-center gap-space-xs text-label-md text-on-surface-variant">
          <Icon name="admin_panel_settings" className="text-[16px]" />
          <Link to="/admin" className="hover:text-on-surface">
            অ্যাডমিন কন্ট্রোল প্যানেল
          </Link>
          <span aria-hidden="true">/</span>
          <span className="pill bg-surface-container-high text-on-surface">নতুন শ্রেণি/শিফট যোগ করুন</span>
        </nav>
        <Link to="/admin" className="btn-outline min-h-[40px]">
          <Icon name="arrow_back" className="text-[18px]" /> শ্রেণি তালিকায় ফিরে যান
        </Link>
      </div>

      <div>
        <span className="pill mb-space-sm bg-secondary-container text-on-secondary-container">
          <span className="h-2 w-2 rounded-pill bg-secondary" /> শ্রেণি ও আসন কনফিগারেশন
        </span>
        <h1 className="text-headline-xl-mobile md:text-headline-xl">নতুন শ্রেণি ও শিফট নিবন্ধন</h1>
        <p className="max-w-3xl text-body-lg text-on-surface-variant">
          প্রতিটি shift আলাদা “class” হিসেবে তৈরি হয়, নিজের আলাদা seat সংখ্যা নিয়ে — যেমন “Class 6 - Morning Shift” ও
          “Class 6 - Day Shift” দুটো আলাদা class।
        </p>
      </div>

      <div className="grid gap-gutter xl:grid-cols-12">
        <form onSubmit={submit} noValidate className="card overflow-hidden xl:col-span-8" aria-labelledby="core-heading">
          <div className="flex flex-wrap items-center justify-between gap-space-sm border-b border-surface-container bg-surface-container-low px-space-lg py-space-md">
            <h2 id="core-heading" className="flex items-center gap-space-sm text-headline-sm">
              <span className="h-5 w-1.5 rounded bg-primary" aria-hidden="true" /> শ্রেণি ও শিফটের মৌলিক তথ্য
            </h2>
            <span className="pill bg-surface-container text-on-surface-variant">তারকাচিহ্নিত (*) তথ্য বাধ্যতামূলক</span>
          </div>

          <div className="flex flex-col gap-space-lg p-space-lg">
            {errorList.length > 0 && (
              <div className="rounded-xl border border-error/40 bg-error-container p-space-md text-on-error-container" role="alert">
                <p className="flex items-center gap-space-sm text-label-lg">
                  <Icon name="error" /> ফর্মে {formatNumber(errorList.length)}টি ত্রুটি রয়েছে — লাল চিহ্নিত ঘরগুলো সংশোধন করুন
                </p>
                <ul className="mt-space-xs list-inside list-disc text-body-sm">
                  {errorList.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-space-xs">
              <label htmlFor={nameId} className="text-label-lg">
                শ্রেণির নাম (Class Level &amp; Name) <span className="text-error">*</span>
              </label>
              <input
                id={nameId}
                className={`input ${errors.name ? 'input-invalid' : ''}`}
                value={base}
                placeholder="যেমন Class 6 বা ৬ষ্ঠ শ্রেণি"
                maxLength={200}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? `${nameId}-error` : `${nameId}-hint`}
                onChange={(event) => { setBase(event.target.value); clearError('name'); }}
              />
              {errors.name ? (
                <span id={`${nameId}-error`} className="field-error">
                  <Icon name="cancel" className="text-[16px]" /> {errors.name}
                </span>
              ) : (
                <span id={`${nameId}-hint`} className="text-body-sm text-on-surface-variant">
                  অভিভাবকেরা Class তালিকায় এই নামটিই দেখবেন।
                </span>
              )}
              <div className="flex flex-wrap items-center gap-space-xs text-label-md text-on-surface-variant">
                দ্রুত নির্বাচন:
                {quickPicks.map((pick) => (
                  <button
                    key={pick}
                    type="button"
                    onClick={() => { setBase(pick); clearError('name'); }}
                    className={`rounded-lg border px-space-sm py-1 text-label-md ${
                      base === pick ? 'border-primary bg-primary text-on-primary' : 'border-surface-container bg-surface-container-low hover:bg-surface-container'
                    }`}
                  >
                    {pick}
                  </button>
                ))}
              </div>
            </div>

            <fieldset className="flex flex-col gap-space-sm">
              <legend className="mb-space-xs text-label-lg">শিফট নির্বাচন (Select Shift)</legend>
              <div className="grid gap-space-sm md:grid-cols-3">
                {(['morning', 'day'] as const).map((value) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer flex-col gap-space-xs rounded-xl border p-space-md transition-colors ${
                      shift === value ? 'border-secondary bg-secondary-container/30' : 'border-surface-container bg-surface-container-low hover:bg-surface-container'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-space-sm">
                      <span className="flex items-center gap-space-sm text-label-lg">
                        <Icon name={shiftLabels[value].icon} /> {shiftLabels[value].bn} ({shiftLabels[value].en})
                      </span>
                      <input
                        type="radio"
                        name="shift"
                        value={value}
                        checked={shift === value}
                        onChange={() => { setShift(value); clearError('name'); }}
                        className="h-4 w-4 accent-[#006a61]"
                      />
                    </span>
                    <span className="text-body-sm text-on-surface-variant">{shiftLabels[value].note}</span>
                  </label>
                ))}
                <label
                  className={`flex cursor-pointer flex-col gap-space-xs rounded-xl border p-space-md transition-colors ${
                    shift === 'none' ? 'border-secondary bg-secondary-container/30' : 'border-surface-container bg-surface-container-low hover:bg-surface-container'
                  }`}
                >
                  <span className="flex items-center justify-between gap-space-sm">
                    <span className="flex items-center gap-space-sm text-label-lg">
                      <Icon name="edit_note" /> নামেই লেখা আছে
                    </span>
                    <input
                      type="radio"
                      name="shift"
                      value="none"
                      checked={shift === 'none'}
                      onChange={() => { setShift('none'); clearError('name'); }}
                      className="h-4 w-4 accent-[#006a61]"
                    />
                  </span>
                  <span className="text-body-sm text-on-surface-variant">যেমন “Class 6 - Morning Shift” পুরো নাম উপরে লিখেছেন</span>
                </label>
              </div>
            </fieldset>

            <div className={`flex flex-col gap-space-sm rounded-xl border p-space-md ${errors.totalSeats ? 'border-error/50 bg-error-container/40' : 'border-surface-container bg-surface-container-low'}`}>
              <div className="flex flex-col gap-space-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <label htmlFor={seatsId} className="text-label-lg">
                    মোট seat সংখ্যা <span className="text-error">*</span>
                  </label>
                  <p className="text-body-sm text-on-surface-variant">ধনাত্মক পূর্ণসংখ্যা লিখুন (১ বা তার বেশি)।</p>
                </div>
                <div className="flex items-center gap-space-xs">
                  <button type="button" className="btn-outline w-12 px-0" aria-label="Seat সংখ্যা ১ কমান" onClick={() => changeSeats(-1)}>
                    <Icon name="remove" />
                  </button>
                  <input
                    id={seatsId}
                    className={`input w-32 text-center font-mono text-headline-sm tabular ${errors.totalSeats ? 'input-invalid' : ''}`}
                    value={totalSeats}
                    inputMode="numeric"
                    placeholder="120"
                    aria-invalid={errors.totalSeats ? true : undefined}
                    aria-describedby={errors.totalSeats ? `${seatsId}-error` : undefined}
                    onChange={(event) => { setTotalSeats(event.target.value); clearError('totalSeats'); }}
                  />
                  <button type="button" className="btn-outline w-12 px-0" aria-label="Seat সংখ্যা ১ বাড়ান" onClick={() => changeSeats(1)}>
                    <Icon name="add" />
                  </button>
                </div>
              </div>
              {errors.totalSeats && (
                <span id={`${seatsId}-error`} className="field-error">
                  <Icon name="error" className="text-[16px]" /> {errors.totalSeats}
                </span>
              )}
            </div>

            {serverError && <Alert tone="error">{serverError}</Alert>}
          </div>

          <div className="flex flex-col-reverse gap-space-sm border-t border-surface-container bg-surface-container-low px-space-lg py-space-md sm:flex-row sm:items-center sm:justify-between">
            <Link to="/admin" className="btn text-error hover:bg-error-container/50">
              <Icon name="close" className="text-[18px]" /> বাতিল (Cancel)
            </Link>
            <button type="submit" className="btn-confirm" disabled={submitting}>
              <Icon name="check_circle" className="text-[18px]" />
              {submitting ? 'তৈরি হচ্ছে…' : 'Class তৈরি করুন'}
            </button>
          </div>
        </form>

        <aside className="card flex h-fit flex-col gap-space-md p-space-lg xl:col-span-4" aria-labelledby="preview-heading">
          <div className="flex items-center justify-between">
            <h2 id="preview-heading" className="flex items-center gap-space-sm text-headline-sm">
              <span className="h-2 w-2 rounded-pill bg-secondary" /> সারসংক্ষেপ প্রাকদর্শন
            </h2>
            <span className={`pill ${errorList.length ? 'bg-error-container text-error' : 'bg-surface-container text-on-surface'}`}>
              {errorList.length ? 'Validation Error' : 'Live Preview'}
            </span>
          </div>
          <div className={`flex flex-col gap-space-md rounded-xl border p-space-md ${errorList.length ? 'border-error/40' : 'border-surface-container bg-surface-container-low'}`}>
            <div className="flex items-start justify-between gap-space-sm">
              <div>
                <p className="text-label-md text-on-surface-variant">নিবন্ধিত হতে যাওয়া শ্রেণি:</p>
                <p className={`text-headline-sm ${errors.name ? 'text-error' : 'text-on-surface'}`}>{finalName || '—'}</p>
              </div>
              <Icon name="school" className="text-[28px]" />
            </div>
            <div className="grid grid-cols-2 gap-space-sm">
              <div className="rounded-lg bg-surface-container-lowest p-space-sm">
                <p className="text-label-md text-on-surface-variant">মোট আসন:</p>
                <p className={`font-mono text-headline-sm tabular ${errors.totalSeats ? 'text-error' : ''}`}>
                  {seatsNumber > 0 ? `${formatNumber(seatsNumber)} টি` : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-surface-container-lowest p-space-sm">
                <p className="text-label-md text-on-surface-variant">আসন নীতি:</p>
                <p className="flex items-center gap-1 text-label-lg">
                  <Icon name="lock" className="text-[16px]" /> FCFS row lock
                </p>
              </div>
            </div>
          </div>
          <ul className="flex flex-col gap-space-sm text-body-sm text-on-surface-variant">
            <li className="flex gap-space-sm"><Icon name="check_circle" className="text-[18px] text-secondary" /> তৈরি হওয়ার সঙ্গে সঙ্গে class অভিভাবকদের Class তালিকায় দেখা যাবে।</li>
            <li className="flex gap-space-sm"><Icon name="check_circle" className="text-[18px] text-secondary" /> আবেদন করলে seat নির্ধারিত সময়ের জন্য hold থাকে; ফি না দিলে নিজে থেকেই মুক্ত হয়।</li>
            <li className="flex gap-space-sm"><Icon name="check_circle" className="text-[18px] text-secondary" /> একসাথে যত আবেদনই আসুক, seat সংখ্যার বেশি hold বা ভর্তি হবে না।</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
