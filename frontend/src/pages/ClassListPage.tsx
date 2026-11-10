import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Loading } from '../components/Alert';
import { SeatStats } from '../components/SeatStats';
import { useStudent } from '../context/StudentContext';
import { usePolling } from '../hooks/usePolling';
import { useNow } from '../hooks/useNow';
import { api } from '../lib/api';
import { formatNumber } from '../lib/format';
import { describeError } from '../lib/messages';
import type { AdmissionClass, StudentHold } from '../types/api';

export const CLASS_POLL_MS = 4000;

/** "Class তালিকা": every class with total/held/confirmed/available seats and "আবেদন করুন". */
export function ClassListPage() {
  const { studentId } = useStudent();
  const navigate = useNavigate();
  const now = useNow();
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

  return (
    <section aria-labelledby="classes-heading">
      <div className="page-head">
        <div>
          <h1 id="classes-heading">Class তালিকা</h1>
          <p className="muted">
            প্রতিটি shift আলাদা class। আবেদন করলে seat কিছু সময়ের জন্য শিক্ষার্থীর নামে hold থাকে; এর মধ্যে
            ভর্তি ফি দিলে ভর্তি নিশ্চিত হয়। Seat সংখ্যা প্রতি কয়েক সেকেন্ডে নিজে থেকে হালনাগাদ হয়।
          </p>
        </div>
        <span className="live" aria-hidden="true">
          <span className="live__dot" /> সরাসরি হালনাগাদ
        </span>
      </div>

      {!studentId && (
        <Alert tone="info">
          আবেদন করতে আগে উপরের ঘরে শিক্ষার্থীর ১৭ অঙ্কের জন্ম নিবন্ধন নম্বর লিখে সংরক্ষণ করুন।
        </Alert>
      )}

      {classes.error !== undefined && classes.data && (
        <Alert tone="warning">{describeError(classes.error)} সর্বশেষ পাওয়া তথ্য দেখানো হচ্ছে।</Alert>
      )}

      {classes.loading && !classes.data && <Loading label="Class তালিকা লোড হচ্ছে…" />}

      {classes.error !== undefined && !classes.data && (
        <Alert tone="error" title="Class তালিকা আনা যায়নি">
          <p>{describeError(classes.error)}</p>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => void classes.refresh()}>
            আবার চেষ্টা করুন
          </button>
        </Alert>
      )}

      {classes.data && classes.data.length === 0 && (
        <div className="empty">
          <p>এখনো কোনো class তৈরি হয়নি।</p>
          <Link to="/admin" className="btn btn--ghost btn--sm">
            School admin থেকে class তৈরি করুন
          </Link>
        </div>
      )}

      {classes.data && classes.data.length > 0 && (
        <ul className="card-grid">
          {classes.data.map((admissionClass) => {
            const active = activeHoldFor(admissionClass.id);
            const full = admissionClass.availableSeats <= 0;
            const pending = pendingClassId === admissionClass.id;
            const error = classErrors[admissionClass.id];
            return (
              <li key={admissionClass.id} className="card class-card">
                <div className="class-card__head">
                  <h2 className="class-card__title">{admissionClass.name}</h2>
                  <span className={`pill ${full ? 'pill--full' : 'pill--open'}`}>
                    {full ? 'Seat খালি নেই' : `${formatNumber(admissionClass.availableSeats)}টি seat খালি`}
                  </span>
                </div>
                <SeatStats {...admissionClass} />
                {error && (
                  <p className="field__error" role="alert">
                    {error}
                  </p>
                )}
                <div className="class-card__actions">
                  {active ? (
                    <Link to={`/applications/${active.holdId}`} className="btn btn--secondary">
                      {active.status === 'CONFIRMED' ? 'ভর্তি নিশ্চিত — দেখুন' : 'চলমান আবেদন দেখুন'}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={!studentId || full || pending}
                      onClick={() => void apply(admissionClass)}
                      aria-describedby={!studentId ? `need-id-${admissionClass.id}` : undefined}
                    >
                      {pending ? 'আবেদন পাঠানো হচ্ছে…' : 'আবেদন করুন'}
                    </button>
                  )}
                  {!studentId && (
                    <span id={`need-id-${admissionClass.id}`} className="field__hint">
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
  );
}
