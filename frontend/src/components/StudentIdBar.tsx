import { useId, useState, type FormEvent } from 'react';
import { useStudent } from '../context/StudentContext';
import { maskStudentId, normalizeStudentId, validateStudentId } from '../lib/studentId';

/**
 * The box at the top of every page where the guardian writes the student's
 * birth registration number. No login: the UI uses this number as the student's identity.
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
      <div className="student-bar" role="region" aria-label="শিক্ষার্থীর পরিচয়">
        <div className="student-bar__current">
          <span className="student-bar__label">শিক্ষার্থীর জন্ম নিবন্ধন নম্বর</span>
          <span className="student-bar__value mono" aria-label={`জন্ম নিবন্ধন নম্বর ${maskStudentId(studentId)}`}>
            {maskStudentId(studentId)}
          </span>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            setDraft(studentId);
            setEditing(true);
          }}
        >
          পরিবর্তন করুন
        </button>
      </div>
    );
  }

  const normalized = normalizeStudentId(draft);
  return (
    <form className="student-bar" onSubmit={submit} noValidate aria-label="শিক্ষার্থীর পরিচয়">
      <div className="field student-bar__field">
        <label htmlFor={inputId} className="student-bar__label">
          শিক্ষার্থীর জন্ম নিবন্ধন নম্বর (১৭ অঙ্ক)
        </label>
        <input
          id={inputId}
          className={`input mono${error ? ' input--invalid' : ''}`}
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
        <span id={hintId} className="field__hint">
          {normalized.length}/17 অঙ্ক · Login লাগবে না, এই নম্বর দিয়েই আবেদন চিহ্নিত হবে।
        </span>
        {error && (
          <span id={errorId} className="field__error" role="alert">
            {error}
          </span>
        )}
      </div>
      <div className="student-bar__actions">
        <button type="submit" className="btn btn--primary btn--sm">
          সংরক্ষণ করুন
        </button>
        {studentId && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>
            বাতিল
          </button>
        )}
      </div>
    </form>
  );
}
