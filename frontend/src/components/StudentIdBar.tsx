import { useId, useState, type FormEvent } from 'react';
import { useStudent } from '../context/StudentContext';
import { maskStudentId, normalizeStudentId, toBengaliDigits, validateStudentId } from '../lib/studentId';
import { Icon } from './Icon';

/**
 * The box at the top of every page where the guardian writes the student's birth
 * registration number (PDF §1.3). No login: the UI uses this number as the identity.
 * Styled as the BRN widget from DESIGN.md (counter, inline validation, check icon).
 */
export function StudentIdBar() {
  const { studentId, setStudentId } = useStudent();
  const [editing, setEditing] = useState(studentId === null);
  const [draft, setDraft] = useState(studentId ?? '');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = validateStudentId(draft);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setStudentId(normalizeStudentId(draft));
    setEditing(false);
  };

  if (!editing && studentId) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-space-sm" role="region" aria-label="শিক্ষার্থীর পরিচয়">
        <div className="flex items-center gap-space-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <Icon name="badge" />
          </span>
          <div className="flex flex-col">
            <span className="text-label-md text-on-surface-variant">শিক্ষার্থীর জন্ম নিবন্ধন নম্বর (Birth Registration No.)</span>
            <span className="font-mono text-body-lg font-semibold tracking-wider text-on-surface tabular">
              {maskStudentId(studentId)}
            </span>
          </div>
          <span className="pill hidden bg-secondary-container text-on-secondary-container sm:inline-flex">
            <Icon name="check_circle" className="text-[14px]" /> সংরক্ষিত
          </span>
        </div>
        <button
          type="button"
          className="btn-outline min-h-[40px] text-body-sm"
          onClick={() => {
            setDraft(studentId);
            setEditing(true);
          }}
        >
          <Icon name="edit" className="text-[18px]" />
          পরিবর্তন করুন
        </button>
      </div>
    );
  }

  const normalized = normalizeStudentId(draft);
  const complete = normalized.length === 17 && /^[0-9]+$/.test(normalized);
  return (
    <form onSubmit={submit} noValidate aria-label="শিক্ষার্থীর পরিচয়" className="flex flex-col gap-space-xs">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <label htmlFor={inputId} className="text-label-lg text-on-surface">
          শিক্ষার্থীর জন্ম নিবন্ধন নম্বর (১৭ অঙ্ক) <span className="text-error">*</span>
        </label>
        <span id={hintId} className={`text-label-md tabular ${complete ? 'text-secondary' : 'text-on-surface-variant'}`}>
          {toBengaliDigits(normalized.length)}/১৭ ডিজিট · Login লাগবে না
        </span>
      </div>
      <div className="flex flex-col gap-space-sm sm:flex-row">
        <div className="relative flex-1">
          <Icon name="badge" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            id={inputId}
            className={`input pl-10 pr-10 font-mono tracking-wider tabular ${error ? 'input-invalid' : ''}`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="যেমন 20152691234567890"
            value={draft}
            maxLength={24}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`}
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError(null);
            }}
          />
          {complete && (
            <Icon name="check_circle" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#059669]" />
          )}
        </div>
        <div className="flex gap-space-sm">
          <button type="submit" className="btn-primary flex-1 sm:flex-none">
            সংরক্ষণ করুন
          </button>
          {studentId && (
            <button type="button" className="btn-outline" onClick={() => setEditing(false)}>
              ফিরে যান
            </button>
          )}
        </div>
      </div>
      {error ? (
        <span id={errorId} className="field-error" role="alert">
          <Icon name="error" className="text-[16px]" />
          {error}
        </span>
      ) : (
        complete && (
          <span className="flex items-center gap-1 text-body-sm text-[#059669]">
            <Icon name="check_circle" className="text-[16px]" /> সঠিক ফরম্যাট (১৭ ডিজিট) / Valid BRN format
          </span>
        )
      )}
    </form>
  );
}
