import { useId, useState, type FormEvent } from 'react';
import { Alert, Loading } from '../components/Alert';
import { usePolling } from '../hooks/usePolling';
import { ApiError, api } from '../lib/api';
import { formatNumber } from '../lib/format';
import { describeError } from '../lib/messages';
import { CLASS_POLL_MS } from './ClassListPage';

interface FormErrors {
  name?: string;
  totalSeats?: string;
}

export function validateClassForm(name: string, totalSeats: string): FormErrors {
  const errors: FormErrors = {};
  if (name.trim().length === 0) errors.name = 'Class-এর নাম লিখুন।';
  else if (name.trim().length > 200) errors.name = 'নাম ২০০ অক্ষরের মধ্যে রাখুন।';
  if (totalSeats.trim().length === 0) errors.totalSeats = 'Seat সংখ্যা লিখুন।';
  else if (!/^[0-9]+$/.test(totalSeats.trim()) || Number(totalSeats) < 1) {
    errors.totalSeats = 'Seat সংখ্যা ১ বা তার বেশি পূর্ণসংখ্যা হতে হবে।';
  } else if (Number(totalSeats) > 2_147_483_647) {
    errors.totalSeats = 'Seat সংখ্যা অনেক বড়।';
  }
  return errors;
}

/** "Class তৈরি (school admin)" plus a live seat overview of every class. */
export function AdminPage() {
  const [name, setName] = useState('');
  const [totalSeats, setTotalSeats] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const nameId = useId();
  const seatsId = useId();

  const classes = usePolling((signal) => api.listClasses(signal), CLASS_POLL_MS);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setCreated(null);
    setServerError(null);
    const found = validateClassForm(name, totalSeats);
    setErrors(found);
    if (found.name || found.totalSeats) return;

    setSubmitting(true);
    try {
      const result = await api.createClass({ name: name.trim(), totalSeats: Number(totalSeats) });
      setCreated(`“${result.name}” তৈরি হয়েছে (${formatNumber(result.totalSeats)}টি seat)।`);
      setName('');
      setTotalSeats('');
      await classes.refresh();
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

  return (
    <section aria-labelledby="admin-heading" className="stack">
      <div>
        <h1 id="admin-heading">School admin</h1>
        <p className="muted">
          নতুন class তৈরি করুন এবং প্রতিটি class-এর seat-এর অবস্থা দেখুন। (Demo: admin অংশে login নেই — দেখুন
          ASSUMPTIONS.md।)
        </p>
      </div>

      <form className="card form" onSubmit={submit} noValidate aria-labelledby="create-heading">
        <h2 id="create-heading">Class তৈরি</h2>
        <p className="muted">প্রতিটি shift আলাদা class হিসেবে তৈরি করুন, যেমন “Class 6 - Morning Shift” ও “Class 6 - Day Shift”।</p>
        <div className="form__row">
          <div className="field">
            <label htmlFor={nameId}>Class-এর নাম</label>
            <input
              id={nameId}
              className={`input${errors.name ? ' input--invalid' : ''}`}
              value={name}
              placeholder="Class 6 - Morning Shift"
              maxLength={200}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? `${nameId}-error` : undefined}
              onChange={(event) => setName(event.target.value)}
            />
            {errors.name && (
              <span id={`${nameId}-error`} className="field__error">
                {errors.name}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor={seatsId}>মোট seat সংখ্যা</label>
            <input
              id={seatsId}
              className={`input${errors.totalSeats ? ' input--invalid' : ''}`}
              value={totalSeats}
              inputMode="numeric"
              placeholder="120"
              aria-invalid={errors.totalSeats ? true : undefined}
              aria-describedby={errors.totalSeats ? `${seatsId}-error` : undefined}
              onChange={(event) => setTotalSeats(event.target.value)}
            />
            {errors.totalSeats && (
              <span id={`${seatsId}-error`} className="field__error">
                {errors.totalSeats}
              </span>
            )}
          </div>
        </div>
        {serverError && <Alert tone="error">{serverError}</Alert>}
        {created && <Alert tone="success">{created}</Alert>}
        <div>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'তৈরি হচ্ছে…' : 'Class তৈরি করুন'}
          </button>
        </div>
      </form>

      <div className="card">
        <div className="page-head">
          <h2>সব class-এর seat</h2>
          <span className="live" aria-hidden="true">
            <span className="live__dot" /> সরাসরি হালনাগাদ
          </span>
        </div>

        {classes.loading && !classes.data && <Loading />}
        {classes.error !== undefined && (
          <Alert tone={classes.data ? 'warning' : 'error'}>{describeError(classes.error)}</Alert>
        )}
        {classes.data && list.length === 0 && <p className="empty">এখনো কোনো class তৈরি হয়নি।</p>}
        {list.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">প্রতিটি class-এর মোট, hold-এ থাকা, নিশ্চিত ও খালি seat</caption>
              <thead>
                <tr>
                  <th scope="col">Class</th>
                  <th scope="col">মোট</th>
                  <th scope="col">Hold-এ</th>
                  <th scope="col">নিশ্চিত</th>
                  <th scope="col">খালি</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">{item.name}</th>
                    <td>{formatNumber(item.totalSeats)}</td>
                    <td>{formatNumber(item.heldSeats)}</td>
                    <td>{formatNumber(item.confirmedSeats)}</td>
                    <td>{formatNumber(item.availableSeats)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">সর্বমোট</th>
                  <td>{formatNumber(totals.total)}</td>
                  <td>{formatNumber(totals.held)}</td>
                  <td>{formatNumber(totals.confirmed)}</td>
                  <td>{formatNumber(totals.available)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
