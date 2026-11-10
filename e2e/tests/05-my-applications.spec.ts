import {
  cancelHold,
  confirmHold,
  createClass,
  createHold,
  expect,
  masked,
  newStudentId,
  printCalls,
  saveStudentId,
  test,
  uniqueName,
} from './helpers';

test.describe('Guardian — আমার আবেদন', () => {
  test('a new student sees an empty list with a link to apply', async ({ page }) => {
    await page.goto('/my-applications');
    await saveStudentId(page, newStudentId());
    await expect(page.getByText('কোনো আবেদন খুঁজে পাওয়া যায়নি')).toBeVisible();
    await page.getByRole('main').getByRole('link', { name: /আবেদন/ }).last().click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('lists only this student\'s applications with status, filters, search and actions', async ({ page, request }) => {
    const studentId = newStudentId();
    const other = newStudentId();
    const confirmedClass = await createClass(request, uniqueName('Class 6 - Morning Shift'), 5);
    const cancelledClass = await createClass(request, uniqueName('Class 6 - Day Shift'), 5);
    const heldClass = await createClass(request, uniqueName('Class 7 - Morning Shift'), 5);
    const confirmed = await createHold(request, confirmedClass.id, studentId);
    await confirmHold(request, confirmed.holdId, studentId);
    const cancelled = await createHold(request, cancelledClass.id, studentId);
    await cancelHold(request, cancelled.holdId, studentId);
    const held = await createHold(request, heldClass.id, studentId);
    await createHold(request, heldClass.id, other); // someone else's application must not show up

    await page.goto('/my-applications');
    await saveStudentId(page, studentId);
    await expect(page.getByRole('heading', { level: 1, name: 'আমার আবেদনসমূহ' })).toBeVisible();
    await expect(page.getByRole('main')).toContainText(masked(studentId));

    const table = page.getByRole('table', { name: 'এই শিক্ষার্থীর আবেদনসমূহ' });
    const rows = table.getByRole('row').filter({ has: page.getByRole('rowheader') });
    await expect(rows).toHaveCount(3);
    await expect(table.getByRole('columnheader')).toHaveText([
      'আবেদন নম্বর ও তারিখ',
      'শ্রেণি ও শিফট',
      'স্ট্যাটাস',
      'সময়সীমা ও মেয়াদ',
      'পদক্ষেপ',
    ]);
    const row = (name: string) => rows.filter({ has: page.getByRole('rowheader', { name, exact: true }) });
    await expect(row(confirmedClass.name)).toContainText(/CONFIRMED\s*•\s*ভর্তি নিশ্চিত/);
    await expect(row(cancelledClass.name)).toContainText(/CANCELLED\s*•\s*বাতিল/);
    await expect(row(heldClass.name)).toContainText('HELD');

    const summary = page.getByRole('group', { name: 'আবেদনের সারসংক্ষেপ' });
    await expect(summary).toContainText('মোট দাখিলকৃত আবেদন');
    await expect(summary).toContainText('০ EXPIRED / ১ CANCELLED');

    const filters = page.getByRole('group', { name: 'অবস্থা অনুযায়ী ফিল্টার' });
    await expect(filters.getByRole('button')).toHaveText([
      /সকল আবেদন\s*৩/,
      /সাময়িক সংরক্ষিত \(HELD\)\s*১/,
      /নিশ্চিত ভর্তি \(CONFIRMED\)\s*১/,
      /সময় উত্তীর্ণ \(EXPIRED\)\s*০/,
      /বাতিলকৃত \(CANCELLED\)\s*১/,
    ]);
    await filters.getByRole('button', { name: /নিশ্চিত ভর্তি \(CONFIRMED\)/ }).click();
    await expect(rows).toHaveCount(1);
    await expect(row(confirmedClass.name)).toBeVisible();
    await filters.getByRole('button', { name: /সময় উত্তীর্ণ \(EXPIRED\)/ }).click();
    await expect(page.getByText('এই ফিল্টারে কোনো আবেদন নেই')).toBeVisible();
    await filters.getByRole('button', { name: /সকল আবেদন/ }).click();
    await expect(rows).toHaveCount(3);

    const search = page.getByRole('textbox', { name: 'আবেদন খুঁজুন' });
    await search.fill(cancelledClass.name);
    await expect(rows).toHaveCount(1);
    await search.fill(held.holdId);
    await expect(rows).toHaveCount(1);
    await expect(row(heldClass.name)).toBeVisible();
    await search.fill('');
    await expect(rows).toHaveCount(3);

    await page.getByRole('button', { name: 'সারসংক্ষেপ প্রিন্ট' }).click();
    expect(await printCalls(page)).toBe(1);

    // Row actions.
    await row(heldClass.name).getByRole('link', { name: 'ভর্তি ফি দিন / বিস্তারিত' }).click();
    await expect(page).toHaveURL(new RegExp(`/applications/${held.holdId}$`));
    await page.goBack();
    await row(confirmedClass.name).getByRole('link', { name: 'বিস্তারিত দেখুন' }).click();
    await expect(page).toHaveURL(new RegExp(`/applications/${confirmed.holdId}$`));
    await page.goBack();
    await row(cancelledClass.name).getByRole('link', { name: 'বিস্তারিত দেখুন' }).click();
    await expect(page).toHaveURL(new RegExp(`/applications/${cancelled.holdId}$`));
    await page.goBack();
    await row(cancelledClass.name).getByRole('link', { name: 'পুনরায় আবেদন' }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/my-applications');
    await page.getByRole('link', { name: 'নতুন আবেদন করুন' }).click();
    await expect(page).toHaveURL(/\/$/);

    // Refresh keeps the list (the ID is remembered, the data is on the server).
    await page.goto('/my-applications');
    await page.reload();
    await expect(rows).toHaveCount(3);
  });
});
