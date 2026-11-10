import { classCard, createClass, expect, masked, newStudentId, test, uniqueName } from './helpers';

test.describe('Student ID box (জন্ম নিবন্ধন নম্বর) — no login', () => {
  test('without an ID the guardian is told to enter one and cannot apply', async ({ page, request }) => {
    const created = await createClass(request, uniqueName('Class 6 - Morning Shift'), 10);
    await page.goto('/');
    await expect(
      page.getByText('আবেদন করতে আগে উপরের ঘরে শিক্ষার্থীর ১৭ অঙ্কের জন্ম নিবন্ধন নম্বর লিখে সংরক্ষণ করুন।'),
    ).toBeVisible();
    const card = classCard(page, created.name);
    await expect(card.getByRole('button', { name: 'আবেদন করুন' })).toBeDisabled();
    await expect(card.getByText('আগে জন্ম নিবন্ধন নম্বর দিন')).toBeVisible();

    await page.goto('/my-applications');
    await expect(page.getByText('উপরের ঘরে শিক্ষার্থীর ১৭ অঙ্কের জন্ম নিবন্ধন নম্বর দিন')).toBeVisible();
  });

  test('validates the number: empty, too short, letters', async ({ page }) => {
    await page.goto('/');
    const form = page.getByRole('form', { name: 'শিক্ষার্থীর পরিচয়' });
    const input = form.getByRole('textbox', { name: /শিক্ষার্থীর জন্ম নিবন্ধন নম্বর \(১৭ অঙ্ক\)/ });
    const save = form.getByRole('button', { name: 'সংরক্ষণ করুন' });

    await expect(input).toHaveAttribute('placeholder', 'যেমন 20152691234567890');
    await expect(form).toContainText('০/১৭ ডিজিট · Login লাগবে না');

    await save.click();
    await expect(form.getByRole('alert')).toHaveText(/জন্ম নিবন্ধন নম্বর লিখুন।/);
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    await input.fill('12345');
    await expect(form.getByRole('alert')).toHaveCount(0); // typing clears the old error
    await expect(form).toContainText('৫/১৭ ডিজিট');
    await save.click();
    await expect(form.getByRole('alert')).toHaveText(/ঠিক ১৭ অঙ্কের হতে হবে \(এখন ৫ অঙ্ক\)/);

    await input.fill('1234567890123456a');
    await save.click();
    await expect(form.getByRole('alert')).toHaveText(/শুধু সংখ্যা ব্যবহার করুন।/);

    await input.fill('123456789012345678');
    await save.click();
    await expect(form.getByRole('alert')).toHaveText(/ঠিক ১৭ অঙ্কের হতে হবে/);
    await expect(page.getByRole('region', { name: 'শিক্ষার্থীর পরিচয়' })).toHaveCount(0);
  });

  test('accepts Bengali digits, saves with Enter, masks the number and keeps it after refresh and reopen', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    const form = page.getByRole('form', { name: 'শিক্ষার্থীর পরিচয়' });
    await form.getByRole('textbox').fill('২০১৫২৬৯১২৩৪৫৬৭৮৯০');
    await expect(form).toContainText('১৭/১৭ ডিজিট');
    await expect(form).toContainText('সঠিক ফরম্যাট (১৭ ডিজিট) / Valid BRN format');
    await form.getByRole('textbox').press('Enter');

    const saved = page.getByRole('region', { name: 'শিক্ষার্থীর পরিচয়' });
    await expect(saved).toContainText('2015••••••••••890');
    await expect(saved).toContainText('সংরক্ষিত');
    await expect(saved).not.toContainText('20152691234567890');
    expect(await page.evaluate(() => localStorage.getItem('admission.studentId'))).toBe('20152691234567890');

    await page.reload();
    await expect(page.getByRole('region', { name: 'শিক্ষার্থীর পরিচয়' })).toContainText('2015••••••••••890');

    // Closing the tab and opening the portal again (same browser profile).
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto('/my-applications');
    await expect(reopened.getByRole('region', { name: 'শিক্ষার্থীর পরিচয়' })).toContainText('2015••••••••••890');
  });

  test('"পরিবর্তন করুন" edits the number and "ফিরে যান" keeps the old one', async ({ page, request }) => {
    const first = newStudentId();
    const second = newStudentId();
    const created = await createClass(request, uniqueName('Class 7 - Day Shift'), 10);
    await page.goto('/');
    const form = page.getByRole('form', { name: 'শিক্ষার্থীর পরিচয়' });
    await form.getByRole('textbox').fill(first);
    await form.getByRole('button', { name: 'সংরক্ষণ করুন' }).click();
    const saved = page.getByRole('region', { name: 'শিক্ষার্থীর পরিচয়' });
    await expect(saved).toContainText(masked(first));
    await expect(classCard(page, created.name).getByRole('button', { name: 'আবেদন করুন' })).toBeEnabled();

    await saved.getByRole('button', { name: 'পরিবর্তন করুন' }).click();
    await expect(form.getByRole('textbox')).toHaveValue(first);
    await form.getByRole('button', { name: 'ফিরে যান' }).click();
    await expect(saved).toContainText(masked(first));

    await saved.getByRole('button', { name: 'পরিবর্তন করুন' }).click();
    await form.getByRole('textbox').fill(second);
    await form.getByRole('button', { name: 'সংরক্ষণ করুন' }).click();
    await expect(saved).toContainText(masked(second));
    expect(await page.evaluate(() => localStorage.getItem('admission.studentId'))).toBe(second);
  });
});
