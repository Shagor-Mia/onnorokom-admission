import {
  API_URL,
  adminRow,
  bn,
  classCard,
  confirmHold,
  createClass,
  createHold,
  expect,
  newStudentId,
  test,
  uniqueName,
  type ClassSeats,
} from './helpers';

test.describe('School admin — Class তৈরি (create class form)', () => {
  test('page texts, breadcrumb and the two ways back', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: 'নতুন শ্রেণি/শিফট যোগ' }).click();
    await expect(page).toHaveURL(/\/admin\/classes\/new$/);
    await expect(page.getByRole('heading', { level: 1, name: 'নতুন শ্রেণি ও শিফট নিবন্ধন' })).toBeVisible();
    await expect(page.getByText('“Class 6 - Morning Shift” ও “Class 6 - Day Shift” দুটো আলাদা class')).toBeVisible();

    await page.getByRole('link', { name: 'বাতিল (Cancel)' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/classes/new');
    await page.getByRole('link', { name: 'শ্রেণি তালিকায় ফিরে যান' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/classes/new');
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'অ্যাডমিন কন্ট্রোল প্যানেল' }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('validation messages for every invalid input, cleared while typing', async ({ page, request }) => {
    const existing = await createClass(request, uniqueName('Class 8 - Morning Shift'), 5);
    await page.goto('/admin/classes/new');
    const form = page.getByRole('form', { name: 'শ্রেণি ও শিফটের মৌলিক তথ্য' });
    const name = form.getByRole('textbox', { name: /শ্রেণির নাম/ });
    const seats = form.getByRole('textbox', { name: /মোট seat সংখ্যা/ });
    const submit = form.getByRole('button', { name: 'Class তৈরি করুন' });
    const preview = page.getByRole('complementary', { name: 'সারসংক্ষেপ প্রাকদর্শন' });

    await expect(preview).toContainText('Live Preview');
    await submit.click();
    await expect(form).toContainText('ফর্মে ২টি ত্রুটি রয়েছে');
    await expect(form).toContainText('শ্রেণির নাম লিখুন।');
    await expect(form).toContainText('Seat সংখ্যা লিখুন।');
    await expect(preview).toContainText('Validation Error');

    await name.fill('Class 6');
    await expect(form).toContainText('ফর্মে ১টি ত্রুটি রয়েছে');
    await seats.fill('10');
    await expect(form).not.toContainText('ত্রুটি রয়েছে');
    await expect(preview).toContainText('Live Preview');

    const invalidSeats: Array<[string, string]> = [
      ['0', 'Seat সংখ্যা ১ বা তার বেশি পূর্ণসংখ্যা হতে হবে।'],
      ['-5', 'Seat সংখ্যা ১ বা তার বেশি পূর্ণসংখ্যা হতে হবে।'],
      ['1.5', 'Seat সংখ্যা ১ বা তার বেশি পূর্ণসংখ্যা হতে হবে।'],
      ['abc', 'Seat সংখ্যা ১ বা তার বেশি পূর্ণসংখ্যা হতে হবে।'],
      ['99999999999', 'Seat সংখ্যা অনেক বড়।'],
    ];
    for (const [value, message] of invalidSeats) {
      await seats.fill(value);
      await submit.click();
      await expect(form, `seats = ${value}`).toContainText(message);
    }

    await seats.fill('10');
    await name.fill('    ');
    await submit.click();
    await expect(form).toContainText('শ্রেণির নাম লিখুন।');

    await name.fill(existing.name);
    await submit.click();
    await expect(form).toContainText('এই নামে একটি class ইতিমধ্যে আছে');
    await expect(page).toHaveURL(/\/admin\/classes\/new$/);
  });

  test('quick picks, shift choice, seat +/- buttons and live preview', async ({ page }) => {
    await page.goto('/admin/classes/new');
    const form = page.getByRole('form', { name: 'শ্রেণি ও শিফটের মৌলিক তথ্য' });
    const name = form.getByRole('textbox', { name: /শ্রেণির নাম/ });
    const seats = form.getByRole('textbox', { name: /মোট seat সংখ্যা/ });
    const preview = page.getByRole('complementary', { name: 'সারসংক্ষেপ প্রাকদর্শন' });

    for (const pick of ['৬ষ্ঠ শ্রেণি', '৭ম শ্রেণি', '৮ম শ্রেণি', '৯ম শ্রেণি', '১০ম শ্রেণি']) {
      await form.getByRole('button', { name: pick }).click();
      await expect(name).toHaveValue(pick);
    }

    await name.fill('Class 6');
    await expect(form.getByRole('radio', { name: /নামেই লেখা আছে/ })).toBeChecked();
    await expect(preview).toContainText('Class 6');
    await form.getByRole('radio', { name: /প্রভাতি শিফট \(Morning Shift\)/ }).check();
    await expect(preview).toContainText('Class 6 - Morning Shift');
    await form.getByRole('radio', { name: /দিবা শিফট \(Day Shift\)/ }).check();
    await expect(preview).toContainText('Class 6 - Day Shift');
    await form.getByRole('radio', { name: /নামেই লেখা আছে/ }).check();
    await expect(preview).not.toContainText('Class 6 - Day Shift');

    const plus = form.getByRole('button', { name: 'Seat সংখ্যা ১ বাড়ান' });
    const minus = form.getByRole('button', { name: 'Seat সংখ্যা ১ কমান' });
    await plus.click();
    await expect(seats).toHaveValue('1');
    await plus.click();
    await plus.click();
    await expect(seats).toHaveValue('3');
    await expect(preview).toContainText('৩ টি');
    await minus.click();
    await expect(seats).toHaveValue('2');
    await minus.click();
    await minus.click();
    await expect(seats).toHaveValue('1'); // never below 1
  });

  test('creates a class from the UI; it appears for admin and guardians', async ({ page }) => {
    const base = uniqueName('Class 6');
    const fullName = `${base} - Day Shift`;
    await page.goto('/admin/classes/new');
    const form = page.getByRole('form', { name: 'শ্রেণি ও শিফটের মৌলিক তথ্য' });
    await form.getByRole('textbox', { name: /শ্রেণির নাম/ }).fill(base);
    await form.getByRole('radio', { name: /দিবা শিফট \(Day Shift\)/ }).check();
    await form.getByRole('textbox', { name: /মোট seat সংখ্যা/ }).fill('100');
    await form.getByRole('button', { name: 'Class তৈরি করুন' }).click();

    await expect(page).toHaveURL(/\/admin$/);
    const success = page.getByText(`“${fullName}” তৈরি হয়েছে (১০০টি seat)।`);
    await expect(success).toBeVisible();
    await page.getByRole('button', { name: 'ঠিক আছে' }).click();
    await expect(success).toBeHidden();

    const row = adminRow(page, fullName);
    await expect(row.getByRole('cell')).toHaveText([bn(100), bn(0), bn(0), bn(100), /০% পূর্ণ/]);

    await page.goto('/');
    await expect(classCard(page, fullName)).toBeVisible();
  });
});

test.describe('School admin — dashboard (seat counts)', () => {
  test('search, shift dropdown, status filters, refresh and live update', async ({ page, request }) => {
    const tag = uniqueName('X').split(' ')[1];
    const morning = await createClass(request, `E2E ${tag} - Class 6 - Morning Shift`, 5);
    const day = await createClass(request, `E2E ${tag} - Class 6 - Day Shift`, 1);
    const busy = await createClass(request, `E2E ${tag} - Class 9 - Morning Shift`, 5);
    await createHold(request, day.id, newStudentId()); // full
    for (let i = 0; i < 4; i += 1) await createHold(request, busy.id, newStudentId()); // 80% -> high demand

    await page.goto('/admin');
    await expect(page.getByText(/সর্বশেষ সিঙ্ক: /)).toBeVisible();
    await expect(page.getByRole('group', { name: 'সারসংক্ষেপ' })).toContainText('মোট শ্রেণি ও শিফট');

    const search = page.getByRole('textbox', { name: 'শ্রেণি খুঁজুন' });
    await search.fill(tag);
    await expect(adminRow(page, morning.name)).toBeVisible();
    await expect(adminRow(page, day.name)).toBeVisible();
    await expect(adminRow(page, busy.name)).toBeVisible();
    await expect(adminRow(page, day.name).getByRole('cell').nth(3)).toHaveText(`${bn(0)} (পূর্ণ)`);

    const shift = page.getByRole('combobox', { name: 'শিফট' });
    await shift.selectOption('day');
    await expect(adminRow(page, day.name)).toBeVisible();
    await expect(adminRow(page, morning.name)).toBeHidden();
    await shift.selectOption('morning');
    await expect(adminRow(page, morning.name)).toBeVisible();
    await expect(adminRow(page, day.name)).toBeHidden();
    await shift.selectOption('all');

    const filters = page.getByRole('group', { name: 'অবস্থা ফিল্টার' });
    await filters.getByRole('button', { name: /^আসন পূর্ণ/ }).click();
    await expect(filters.getByRole('button', { name: /^আসন পূর্ণ/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(adminRow(page, day.name)).toBeVisible();
    await expect(adminRow(page, morning.name)).toBeHidden();
    await filters.getByRole('button', { name: /^উচ্চ চাহিদা/ }).click();
    await expect(adminRow(page, busy.name)).toBeVisible();
    await expect(adminRow(page, day.name)).toBeHidden();
    await filters.getByRole('button', { name: /^সকল শ্রেণি/ }).click();
    await expect(adminRow(page, morning.name)).toBeVisible();

    await search.fill('no class has this name');
    await expect(page.getByText('এই ফিল্টারে কোনো class নেই')).toBeVisible();
    await search.fill(tag);

    // A guardian applies somewhere else: the table updates without reloading the page.
    await createHold(request, morning.id, newStudentId());
    await expect(adminRow(page, morning.name).getByRole('cell').nth(1)).toHaveText(bn(1), { timeout: 12_000 });
    await createHold(request, morning.id, newStudentId());
    await page.getByRole('button', { name: 'রিফ্রেশ' }).click();
    await expect(adminRow(page, morning.name).getByRole('cell').nth(1)).toHaveText(bn(2));
    await expect(adminRow(page, morning.name).getByRole('cell').nth(3)).toHaveText(bn(3));
  });
});

test.describe('School admin — totals', () => {
  test('confirmed column, summary cards and overall progress follow the real seat counts', async ({ page, request }) => {
    const created = await createClass(request, uniqueName('Class 7 - Day Shift'), 4);
    const paid = newStudentId();
    const waiting = newStudentId();
    const first = await createHold(request, created.id, paid);
    await confirmHold(request, first.holdId, paid);
    const second = await createHold(request, created.id, waiting);

    await page.goto('/admin');
    const row = adminRow(page, created.name);
    // total, held, confirmed, available, progress
    await expect(row.getByRole('cell')).toHaveText([bn(4), bn(1), bn(1), bn(2), /৫০% পূর্ণ/]);

    // A guardian pays: the "নিশ্চিত" column goes up without reloading the page.
    await confirmHold(request, second.holdId, waiting);
    await expect(row.getByRole('cell')).toHaveText([bn(4), bn(0), bn(2), bn(2), /৫০% পূর্ণ/], { timeout: 12_000 });

    // Summary cards and the progress panel show the same totals as GET /classes.
    const summary = page.getByRole('group', { name: 'সারসংক্ষেপ' });
    const card = (label: string) => summary.locator('.card').filter({ hasText: label }).locator('.metric');
    const progress = page.getByRole('region', { name: 'সামগ্রিক ভর্তি অগ্রগতি' });
    const item = (label: string) => progress.getByRole('listitem').filter({ hasText: label }).locator('strong');

    const fromApi = async () => {
      const all = (await (await request.get(`${API_URL}/classes`)).json()) as ClassSeats[];
      const sum = (pick: (c: ClassSeats) => number) => all.reduce((acc, c) => acc + pick(c), 0);
      return {
        classes: bn(all.length),
        total: bn(sum((c) => c.totalSeats)),
        held: bn(sum((c) => c.heldSeats)),
        confirmed: bn(sum((c) => c.confirmedSeats)),
        available: bn(sum((c) => c.availableSeats)),
      };
    };
    const fromUi = async () => ({
      classes: await card('মোট শ্রেণি ও শিফট').innerText(),
      total: await card('মোট নির্ধারিত আসন').innerText(),
      held: await card('সাময়িক সংরক্ষিত (HELD)').innerText(),
      confirmed: await card('চূড়ান্ত ভর্তি নিশ্চিত').innerText(),
      available: await card('অবশিষ্ট খালি আসন').innerText(),
      progressTotal: (await progress.innerText()).match(/([০-৯]+) আসন/)?.[1],
      progressConfirmed: (await item('নিশ্চিত ভর্তি').innerText()).replace(' আসন', ''),
      progressHeld: (await item('সাময়িক সংরক্ষিত (ফি অপেক্ষমাণ)').innerText()).replace(' আসন', ''),
      progressAvailable: (await item('আবেদনযোগ্য খালি আসন').innerText()).replace(' আসন', ''),
    });
    // Holds of earlier tests may expire meanwhile, so compare fresh values until both sides agree.
    await expect
      .poll(
        async () => {
          const api = await fromApi();
          const ui = await fromUi();
          return JSON.stringify(ui) === JSON.stringify({
            ...api,
            progressTotal: api.total,
            progressConfirmed: api.confirmed,
            progressHeld: api.held,
            progressAvailable: api.available,
          })
            ? 'match'
            : JSON.stringify({ api, ui });
        },
        { timeout: 15_000 },
      )
      .toBe('match');
    await expect(progress.getByRole('heading', { name: 'সামগ্রিক ভর্তি অগ্রগতি' })).toBeVisible();
    await expect(progress.getByRole('img', { name: /নিশ্চিত ভর্তি হার [০-৯.]+%/ })).toBeVisible();
  });
});
