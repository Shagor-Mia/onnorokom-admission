import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { StudentIdBar } from '../components/StudentIdBar';
import { AdminPage } from '../pages/AdminPage';
import { ApplicationPage } from '../pages/ApplicationPage';
import { ClassListPage } from '../pages/ClassListPage';
import { CreateClassPage, composeClassName } from '../pages/CreateClassPage';
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
    expect(within(card).getByText('ভর্তি চলছে')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'আবেদন করুন' })).toBeDisabled();

    const fullCard = screen.getByRole('heading', { name: full.name }).closest('li')!;
    expect(within(fullCard).getByText('আসন পূর্ণ')).toBeInTheDocument();
    expect(within(fullCard).getByRole('button', { name: 'আসন খালি নেই (Full)' })).toBeDisabled();
  });

  it('filters classes by shift', async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ status: 200, body: [morning, full] }));
    renderAt('/', '/', <ClassListPage />);

    await screen.findByRole('heading', { name: morning.name });
    await user.click(screen.getByRole('button', { name: 'দিবা শিফট (Day)' }));
    expect(screen.queryByRole('heading', { name: morning.name })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: full.name })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'শুধু খালি আসন' }));
    expect(screen.getByRole('heading', { name: morning.name })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: full.name })).not.toBeInTheDocument();
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
    const now = Date.now();
    // Long enough for a slow CI machine to render the HELD state first.
    const expiresAt = new Date(now + 4000).toISOString();
    mockFetch(() => ({
      status: 200,
      body: { holdId: 'h_1', classId: 'c_1', className: morning.name, status: 'HELD', expiresAt, createdAt: new Date(now).toISOString() },
    }));
    renderAt('/applications/h_1', '/applications/:holdId', <ApplicationPage />);

    expect(await screen.findByText('আসন সাময়িকভাবে সংরক্ষিত হয়েছে', undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'বাতিল' })).toBeEnabled();

    await waitFor(() => expect(screen.getByText('মেয়াদ শেষ (EXPIRED)')).toBeInTheDocument(), { timeout: 8000 });
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
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
      return {
        status: 200,
        body: { holdId: 'h_1', classId: 'c_1', className: morning.name, status, expiresAt, confirmedAt: status === 'CONFIRMED' ? new Date().toISOString() : null },
      };
    });
    renderAt('/applications/h_1', '/applications/:holdId', <ApplicationPage />);

    await user.click(await screen.findByRole('button', { name: 'ভর্তি ফি দিন' }));
    await user.click(screen.getByRole('button', { name: 'হ্যাঁ, ভর্তি ফি দিন', hidden: true }));

    expect(await screen.findByText(/ভর্তি নিশ্চিত \(CONFIRMED\)/)).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST')!;
    expect(post.url).toBe('http://localhost:8080/holds/h_1/confirm');
    expect(post.headers['X-Student-Id']).toBe(STUDENT_ID);
    expect(screen.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeDisabled();
  });

  it('cancels through the warning dialog', async () => {
    rememberStudent();
    const user = userEvent.setup();
    let status = 'HELD';
    const expiresAt = new Date(Date.now() + 600_000).toISOString();
    const { calls } = mockFetch((call) => {
      if (call.method === 'DELETE') {
        status = 'CANCELLED';
        return { status: 204 };
      }
      return { status: 200, body: { holdId: 'h_1', classId: 'c_1', className: morning.name, status, expiresAt } };
    });
    renderAt('/applications/h_1', '/applications/:holdId', <ApplicationPage />);

    await user.click(await screen.findByRole('button', { name: 'বাতিল' }));
    await user.click(screen.getByRole('button', { name: 'হ্যাঁ, বাতিল করুন', hidden: true }));

    expect(await screen.findByText('বাতিল (CANCELLED)')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'DELETE')!.headers['X-Student-Id']).toBe(STUDENT_ID);
    expect(screen.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeDisabled();
  });
});

describe('MyApplicationsPage', () => {
  it('lists every application of the remembered student with its status', async () => {
    rememberStudent();
    const user = userEvent.setup();
    const { calls } = mockFetch(() => ({
      status: 200,
      body: [
        { holdId: 'h_2', classId: 'c_2', className: full.name, status: 'CONFIRMED', expiresAt: '2026-11-01T04:10:00Z' },
        { holdId: 'h_1', classId: 'c_1', className: morning.name, status: 'EXPIRED', expiresAt: '2026-11-01T04:00:00Z' },
      ],
    }));
    renderAt('/my-applications', '/my-applications', <MyApplicationsPage />);

    expect((await screen.findAllByText(full.name)).length).toBeGreaterThan(0);
    expect(screen.getAllByText('CONFIRMED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('EXPIRED').length).toBeGreaterThan(0);
    expect(calls[0].headers['X-Student-Id']).toBe(STUDENT_ID);

    await user.click(screen.getByRole('button', { name: /বাতিলকৃত \(CANCELLED\)/ }));
    expect(screen.getByText('এই ফিল্টারে কোনো আবেদন নেই')).toBeInTheDocument();
  });

  it('shows the empty state when the student has no applications', async () => {
    rememberStudent();
    mockFetch(() => ({ status: 200, body: [] }));
    renderAt('/my-applications', '/my-applications', <MyApplicationsPage />);
    expect(await screen.findByText('কোনো আবেদন খুঁজে পাওয়া যায়নি')).toBeInTheDocument();
  });
});

describe('AdminPage', () => {
  it('shows every class with seat counts and totals', async () => {
    mockFetch(() => ({ status: 200, body: [morning, full] }));
    renderAt('/admin', '/admin', <AdminPage />);

    const row = (await screen.findByRole('rowheader', { name: morning.name })).closest('tr')!;
    expect(within(row).getByText('১২০')).toBeInTheDocument();
    expect(within(row).getByText('২৫')).toBeInTheDocument();
    const fullRow = screen.getByRole('rowheader', { name: full.name }).closest('tr')!;
    expect(within(fullRow).getByText(/পূর্ণ\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /নতুন শ্রেণি\/শিফট যোগ/ })).toHaveAttribute('href', '/admin/classes/new');
  });
});

describe('CreateClassPage', () => {
  it('composes the class name from the shift choice', () => {
    expect(composeClassName('Class 6', 'morning')).toBe('Class 6 - Morning Shift');
    expect(composeClassName('Class 6', 'day')).toBe('Class 6 - Day Shift');
    expect(composeClassName('Class 6 - Day Shift', 'none')).toBe('Class 6 - Day Shift');
  });

  it('validates the form, rejects a duplicate name and creates a class', async () => {
    const user = userEvent.setup();
    const { calls } = mockFetch((call) =>
      call.method === 'POST'
        ? { status: 201, body: { id: 'c_9', name: 'Class 7 - Morning Shift', totalSeats: 60 } }
        : { status: 200, body: [morning] },
    );
    renderAt('/admin/classes/new', '/admin/classes/new', <CreateClassPage />);

    await user.click(screen.getByRole('button', { name: 'Class তৈরি করুন' }));
    expect(screen.getByRole('alert')).toHaveTextContent('২টি ত্রুটি');
    expect(screen.getAllByText('শ্রেণির নাম লিখুন।').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Seat সংখ্যা লিখুন।').length).toBeGreaterThan(0);

    await waitFor(() => expect(calls.some((call) => call.method === 'GET')).toBe(true));
    await user.type(screen.getByLabelText(/শ্রেণির নাম/), morning.name);
    await user.type(screen.getByLabelText(/মোট seat সংখ্যা/), '0');
    await user.click(screen.getByRole('button', { name: 'Class তৈরি করুন' }));
    expect(screen.getAllByText(/ইতিমধ্যে আছে/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/১ বা তার বেশি/).length).toBeGreaterThan(0);

    await user.clear(screen.getByLabelText(/শ্রেণির নাম/));
    await user.type(screen.getByLabelText(/শ্রেণির নাম/), 'Class 7 - Morning Shift');
    await user.clear(screen.getByLabelText(/মোট seat সংখ্যা/));
    await user.type(screen.getByLabelText(/মোট seat সংখ্যা/), '60');
    await user.click(screen.getByRole('button', { name: 'Class তৈরি করুন' }));

    expect(await screen.findByText('other page')).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST')!;
    expect(post.body).toEqual({ name: 'Class 7 - Morning Shift', totalSeats: 60 });
  });
});
