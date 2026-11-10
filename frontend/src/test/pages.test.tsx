import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { StudentIdBar } from '../components/StudentIdBar';
import { AdminPage } from '../pages/AdminPage';
import { ApplicationPage } from '../pages/ApplicationPage';
import { ClassListPage } from '../pages/ClassListPage';
import { MyApplicationsPage } from '../pages/MyApplicationsPage';
import { mockFetch, rememberStudent, renderAt, STUDENT_ID } from './utils';

const morning = {
  id: 'c_1',
  name: 'Class 6 - Morning Shift',
  totalSeats: 120,
  heldSeats: 15,
  confirmedSeats: 80,
  availableSeats: 25,
};
const full = { id: 'c_2', name: 'Class 6 - Day Shift', totalSeats: 2, heldSeats: 1, confirmedSeats: 1, availableSeats: 0 };

describe('StudentIdBar', () => {
  it('rejects an ID that is not 17 digits and remembers a valid one', async () => {
    const user = userEvent.setup();
    renderAt('/', '/', <StudentIdBar />);

    await user.type(screen.getByLabelText(/জন্ম নিবন্ধন নম্বর/), '12345');
    await user.click(screen.getByRole('button', { name: 'সংরক্ষণ করুন' }));
    expect(screen.getByRole('alert')).toHaveTextContent('১৭ অঙ্কের');
    expect(window.localStorage.getItem('admission.studentId')).toBeNull();

    await user.clear(screen.getByLabelText(/জন্ম নিবন্ধন নম্বর/));
    await user.type(screen.getByLabelText(/জন্ম নিবন্ধন নম্বর/), STUDENT_ID);
    await user.click(screen.getByRole('button', { name: 'সংরক্ষণ করুন' }));
    expect(window.localStorage.getItem('admission.studentId')).toBe(STUDENT_ID);
    expect(screen.getByText('2015••••••••••890')).toBeInTheDocument();
  });
});

describe('ClassListPage', () => {
  it('shows seat counts and disables "আবেদন করুন" until a student ID is entered', async () => {
    mockFetch(() => ({ status: 200, body: [morning, full] }));
    renderAt('/', '/', <ClassListPage />);

    const card = (await screen.findByRole('heading', { name: morning.name })).closest('li')!;
    expect(within(card).getByText('১২০')).toBeInTheDocument();
    expect(within(card).getByText('১৫')).toBeInTheDocument();
    expect(within(card).getByText('৮০')).toBeInTheDocument();
    expect(within(card).getByText('২৫')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'আবেদন করুন' })).toBeDisabled();
  });

  it('creates a hold with the X-Student-Id header and shows a 409 in Bengali', async () => {
    rememberStudent();
    const user = userEvent.setup();
    const { calls } = mockFetch((call) => {
      if (call.method === 'POST') {
        return { status: 409, body: { status: 409, code: 'NO_SEATS_AVAILABLE', detail: 'No seats' } };
      }
      if (call.url.endsWith('/me/holds')) return { status: 200, body: [] };
      return { status: 200, body: [morning, full] };
    });
    renderAt('/', '/', <ClassListPage />);

    const card = (await screen.findByRole('heading', { name: morning.name })).closest('li')!;
    const fullCard = screen.getByRole('heading', { name: full.name }).closest('li')!;
    expect(within(fullCard).getByRole('button', { name: 'আবেদন করুন' })).toBeDisabled();

    await user.click(within(card).getByRole('button', { name: 'আবেদন করুন' }));

    expect(await within(card).findByRole('alert')).toHaveTextContent('seat খালি নেই');
    const post = calls.find((call) => call.method === 'POST')!;
    expect(post.url).toBe('http://localhost:8080/classes/c_1/holds');
    expect(post.headers['X-Student-Id']).toBe(STUDENT_ID);
  });

  it('shows an understandable message when the server is down', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    renderAt('/', '/', <ClassListPage />);
    expect(await screen.findByText(/সার্ভারের সাথে সংযোগ করা যাচ্ছে না/)).toBeInTheDocument();
  });
});

describe('ApplicationPage', () => {
  it('switches to EXPIRED and disables "ভর্তি ফি দিন" without a page reload', async () => {
    rememberStudent();
    const expiresAt = new Date(Date.now() + 1500).toISOString();
    mockFetch(() => ({
      status: 200,
      body: { holdId: 'h_1', classId: 'c_1', className: morning.name, status: 'HELD', expiresAt },
    }));
    renderAt('/applications/h_1', '/applications/:holdId', <ApplicationPage />);

    const pay = await screen.findByRole('button', { name: 'ভর্তি ফি দিন' });
    expect(pay).toBeEnabled();
    expect(screen.getByRole('button', { name: 'বাতিল' })).toBeEnabled();

    await waitFor(() => expect(screen.getByText('মেয়াদ শেষ (EXPIRED)')).toBeInTheDocument(), { timeout: 4000 });
    expect(screen.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'বাতিল' })).toBeDisabled();
  });

  it('confirms through the simulated payment dialog', async () => {
    rememberStudent();
    const user = userEvent.setup();
    let status = 'HELD';
    const expiresAt = new Date(Date.now() + 600_000).toISOString();
    const { calls } = mockFetch((call) => {
      if (call.method === 'POST') {
        status = 'CONFIRMED';
        return { status: 200, body: { holdId: 'h_1', status } };
      }
      return { status: 200, body: { holdId: 'h_1', classId: 'c_1', className: morning.name, status, expiresAt } };
    });
    renderAt('/applications/h_1', '/applications/:holdId', <ApplicationPage />);

    await user.click(await screen.findByRole('button', { name: 'ভর্তি ফি দিন' }));
    await user.click(screen.getByRole('button', { name: 'হ্যাঁ, ভর্তি ফি দিন', hidden: true }));

    expect(await screen.findByText('ভর্তি নিশ্চিত (CONFIRMED)')).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST')!;
    expect(post.url).toBe('http://localhost:8080/holds/h_1/confirm');
    expect(post.headers['X-Student-Id']).toBe(STUDENT_ID);
    expect(screen.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeDisabled();
  });
});

describe('MyApplicationsPage', () => {
  it('lists every application of the remembered student with its status', async () => {
    rememberStudent();
    const { calls } = mockFetch(() => ({
      status: 200,
      body: [
        { holdId: 'h_2', classId: 'c_2', className: full.name, status: 'CONFIRMED', expiresAt: '2026-11-01T04:10:00Z' },
        { holdId: 'h_1', classId: 'c_1', className: morning.name, status: 'EXPIRED', expiresAt: '2026-11-01T04:00:00Z' },
      ],
    }));
    renderAt('/my-applications', '/my-applications', <MyApplicationsPage />);

    expect(await screen.findByText(full.name)).toBeInTheDocument();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
    expect(screen.getByText('EXPIRED')).toBeInTheDocument();
    expect(calls[0].headers['X-Student-Id']).toBe(STUDENT_ID);
  });
});

describe('AdminPage', () => {
  it('validates the form and creates a class', async () => {
    const user = userEvent.setup();
    const { calls } = mockFetch((call) =>
      call.method === 'POST'
        ? { status: 201, body: { id: 'c_9', name: 'Class 7 - Morning Shift', totalSeats: 60 } }
        : { status: 200, body: [] },
    );
    renderAt('/admin', '/admin', <AdminPage />);

    await user.click(screen.getByRole('button', { name: 'Class তৈরি করুন' }));
    expect(screen.getByText('Class-এর নাম লিখুন।')).toBeInTheDocument();
    expect(screen.getByText('Seat সংখ্যা লিখুন।')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Class-এর নাম'), 'Class 7 - Morning Shift');
    await user.type(screen.getByLabelText('মোট seat সংখ্যা'), '0');
    await user.click(screen.getByRole('button', { name: 'Class তৈরি করুন' }));
    expect(screen.getByText(/১ বা তার বেশি/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('মোট seat সংখ্যা'));
    await user.type(screen.getByLabelText('মোট seat সংখ্যা'), '60');
    await user.click(screen.getByRole('button', { name: 'Class তৈরি করুন' }));

    expect(await screen.findByText(/তৈরি হয়েছে/)).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST')!;
    expect(post.body).toEqual({ name: 'Class 7 - Morning Shift', totalSeats: 60 });
  });
});
