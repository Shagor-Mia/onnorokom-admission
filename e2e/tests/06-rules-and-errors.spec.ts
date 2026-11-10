import {
  API_URL,
  cardSeats,
  bn,
  classCard,
  createClass,
  createHold,
  expect,
  getClass,
  getHold,
  holdSeconds,
  newStudentId,
  saveStudentId,
  test,
  uniqueName,
} from './helpers';

test.describe('PDF rules seen from the UI', () => {
  test('hold expires → EXPIRED without reload, pay button disabled, seat released', async ({ page, request }) => {
    const studentId = newStudentId();
    const created = await createClass(request, uniqueName('Class 10 - Morning Shift'), 1);
    await page.goto('/');
    await saveStudentId(page, studentId);
    await classCard(page, created.name).getByRole('button', { name: 'আবেদন করুন' }).click();
    await expect(page).toHaveURL(/\/applications\/h_/);
    const holdId = page.url().split('/').pop()!;
    const duration = holdSeconds(await getHold(request, holdId));
    test.skip(duration > 90, `HOLD_DURATION_SECONDS is ${duration}s; run the e2e stack (short holds) to test expiry`);
    test.setTimeout((duration + 60) * 1000);

    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
    const status = page.getByRole('region', { name: 'আবেদনের অবস্থা' });
    await expect(status).toContainText('HELD');
    await expect(page.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeEnabled();

    await expect(status).toContainText('EXPIRED • সময়সীমা উত্তীর্ণ', { timeout: (duration + 10) * 1000 });
    await expect(status).toContainText('মেয়াদ শেষ (EXPIRED)');
    await expect(page.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'বাতিল', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

    // Nobody called the API: the background worker marks it EXPIRED and frees the seat.
    await expect.poll(async () => (await getHold(request, holdId)).status, { timeout: 15_000 }).toBe('EXPIRED');
    expect((await getClass(request, created.id)).availableSeats).toBe(1);

    await page.goto('/');
    await expect.poll(() => cardSeats(classCard(page, created.name))).toEqual([bn(1), bn(0), bn(0), bn(1)]);
    await page.goto('/my-applications');
    const row = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: created.name, exact: true }) });
    await expect(row).toContainText(/EXPIRED\s*•\s*মেয়াদ শেষ/);
    await expect(row.getByRole('link', { name: 'পুনরায় আবেদন' })).toBeVisible();
  });

  test('only the owner can pay for or cancel a hold', async ({ page, request }) => {
    const owner = newStudentId();
    const created = await createClass(request, uniqueName('Class 6 - Day Shift'), 3);
    const hold = await createHold(request, created.id, owner);

    await page.goto('/');
    await saveStudentId(page, newStudentId());
    await page.goto(`/applications/${hold.holdId}`);

    await page.getByRole('button', { name: 'ভর্তি ফি দিন' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'হ্যাঁ, ভর্তি ফি দিন' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('এই আবেদনটি অন্য শিক্ষার্থীর।');

    await page.getByRole('button', { name: 'বাতিল', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'হ্যাঁ, বাতিল করুন' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('এই আবেদনটি অন্য শিক্ষার্থীর।');

    expect((await getHold(request, hold.holdId)).status).toBe('HELD');
  });

  test('without an ID the application page asks for one before paying', async ({ page, request }) => {
    const created = await createClass(request, uniqueName('Class 6 - Morning Shift'), 3);
    const hold = await createHold(request, created.id, newStudentId());
    await page.goto(`/applications/${hold.holdId}`);
    await expect(page.getByText('ভর্তি ফি দিতে বা বাতিল করতে উপরের ঘরে শিক্ষার্থীর জন্ম নিবন্ধন নম্বর দিন।')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeDisabled();
  });

  test('unknown application → "আবেদন পাওয়া যায়নি"', async ({ page }) => {
    await page.goto('/applications/h_00000000000000000000000000000000');
    await expect(page.getByText('আবেদন পাওয়া যায়নি')).toBeVisible();
    await page.getByRole('main').getByRole('link', { name: /আমার আবেদনসমূহ/ }).first().click();
    await expect(page).toHaveURL(/\/my-applications$/);
  });
});

test.describe('Errors are shown in plain Bengali, never a blank page', () => {
  const offline = 'সার্ভারের সাথে সংযোগ করা যাচ্ছে না';

  test('server unreachable: every page explains it, and "আবার চেষ্টা করুন" recovers', async ({ page, request }) => {
    const created = await createClass(request, uniqueName('Class 6 - Morning Shift'), 3);
    const hold = await createHold(request, created.id, newStudentId());
    await page.route(`${API_URL}/**`, (route) => route.abort('connectionrefused'));

    await page.goto('/');
    await expect(page.getByRole('alert').filter({ hasText: 'Class তালিকা আনা যায়নি' })).toContainText(offline);

    await page.goto('/admin');
    await expect(page.getByRole('main')).toContainText(offline);

    await page.goto(`/applications/${hold.holdId}`);
    await expect(page.getByRole('main')).toContainText('আবেদনের তথ্য আনা যায়নি');
    await expect(page.getByRole('main')).toContainText(offline);

    await saveStudentId(page, newStudentId());
    await page.goto('/my-applications');
    await expect(page.getByRole('main')).toContainText(offline);

    await page.goto('/admin/classes/new');
    const form = page.getByRole('form', { name: 'শ্রেণি ও শিফটের মৌলিক তথ্য' });
    await form.getByRole('textbox', { name: /শ্রেণির নাম/ }).fill(uniqueName('Class 6'));
    await form.getByRole('textbox', { name: /মোট seat সংখ্যা/ }).fill('5');
    await form.getByRole('button', { name: 'Class তৈরি করুন' }).click();
    await expect(page.getByRole('main')).toContainText(offline);
    await expect(page).toHaveURL(/\/admin\/classes\/new$/);

    // Server is back: the retry button loads the list.
    await page.goto('/');
    await expect(page.getByRole('main')).toContainText(offline);
    await page.unroute(`${API_URL}/**`);
    await page.getByRole('button', { name: 'আবার চেষ্টা করুন' }).click();
    await expect(classCard(page, created.name)).toBeVisible();
    await expect(page.getByRole('main')).not.toContainText(offline);
  });

  test('server error (500) while applying is explained, not swallowed', async ({ page, request }) => {
    const created = await createClass(request, uniqueName('Class 7 - Day Shift'), 3);
    await page.goto('/');
    await saveStudentId(page, newStudentId());
    await page.route(`${API_URL}/classes/*/holds`, (route) =>
      route.fulfill({ status: 500, contentType: 'application/problem+json', body: '{"status":500,"title":"Server error"}' }),
    );
    const card = classCard(page, created.name);
    await card.getByRole('button', { name: 'আবেদন করুন' }).click();
    await expect(card.getByRole('alert')).toHaveText(/সার্ভারে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।/);
    await expect(page).toHaveURL(/\/$/);
  });
});
