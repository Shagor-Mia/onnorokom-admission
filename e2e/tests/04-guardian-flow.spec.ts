import {
  bn,
  cardSeats,
  classCard,
  createClass,
  createHold,
  expect,
  getClass,
  getHold,
  masked,
  newStudentId,
  printCalls,
  saveStudentId,
  test,
  uniqueName,
} from './helpers';

/** "০৯:৫৮" -> 598 seconds. */
function seconds(text: string): number {
  const digits = text.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  const match = digits.match(/(\d+):(\d\d)/);
  if (!match) throw new Error(`no countdown in "${text}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}

test.describe('Guardian — Class তালিকা', () => {
  test('page texts, seat numbers and the shift / free-seat filters', async ({ page, request }) => {
    const studentId = newStudentId();
    const morning = await createClass(request, uniqueName('Class 6 - Morning Shift'), 120);
    const day = await createClass(request, uniqueName('Class 6 - Day Shift'), 1);
    await createHold(request, day.id, newStudentId());

    await page.goto('/');
    await saveStudentId(page, studentId);
    await expect(page.getByRole('heading', { level: 2, name: 'শ্রেণি ও শিফট তালিকা (Class & Shift Catalogue)' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'রিয়েল-টাইম আসন মেট্রিক' })).toContainText('প্রতি ৪ সেকেন্ডে নিজে থেকে হালনাগাদ');

    const morningCard = classCard(page, morning.name);
    const dayCard = classCard(page, day.name);
    await expect(morningCard.getByRole('term')).toHaveText(['মোট', 'সংরক্ষিত', 'নিশ্চিত', 'খালি']);
    await expect.poll(() => cardSeats(morningCard)).toEqual([bn(120), bn(0), bn(0), bn(120)]);
    await expect(morningCard).toContainText('প্রভাতি শিফট');
    await expect(morningCard).toContainText('ভর্তি চলছে');
    await expect(morningCard.getByRole('button', { name: 'আবেদন করুন' })).toBeEnabled();

    await expect.poll(() => cardSeats(dayCard)).toEqual([bn(1), bn(1), bn(0), bn(0)]);
    await expect(dayCard).toContainText('আসন পূর্ণ');
    await expect(dayCard.getByRole('button', { name: 'আসন খালি নেই (Full)' })).toBeDisabled();

    const filters = page.getByRole('group', { name: 'শ্রেণি ফিল্টার' });
    await filters.getByRole('button', { name: 'দিবা শিফট (Day)' }).click();
    await expect(filters.getByRole('button', { name: 'দিবা শিফট (Day)' })).toHaveAttribute('aria-pressed', 'true');
    await expect(dayCard).toBeVisible();
    await expect(morningCard).toBeHidden();
    await filters.getByRole('button', { name: 'প্রভাতি শিফট (Morning)' }).click();
    await expect(morningCard).toBeVisible();
    await expect(dayCard).toBeHidden();
    await filters.getByRole('button', { name: 'শুধু খালি আসন' }).click();
    await expect(morningCard).toBeVisible();
    await expect(dayCard).toBeHidden();
    await filters.getByRole('button', { name: 'সকল শ্রেণি' }).click();
    await expect(morningCard).toBeVisible();
    await expect(dayCard).toBeVisible();
  });

  test('seat numbers refresh every few seconds without reloading the page', async ({ page, request }) => {
    const created = await createClass(request, uniqueName('Class 7 - Morning Shift'), 10);
    await page.goto('/');
    await saveStudentId(page, newStudentId());
    const card = classCard(page, created.name);
    await expect.poll(() => cardSeats(card)).toEqual([bn(10), bn(0), bn(0), bn(10)]);
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));

    await createHold(request, created.id, newStudentId());
    await createHold(request, created.id, newStudentId());
    await createHold(request, created.id, newStudentId());

    await expect.poll(() => cardSeats(card), { timeout: 12_000 }).toEqual([bn(10), bn(3), bn(0), bn(7)]);
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  });
});

test.describe('Guardian — আবেদন (apply, pay, cancel)', () => {
  test('apply → HELD with countdown → "ভর্তি ফি দিন" → CONFIRMED', async ({ page, request }) => {
    const studentId = newStudentId();
    const created = await createClass(request, uniqueName('Class 6 - Morning Shift'), 5);
    await page.goto('/');
    await saveStudentId(page, studentId);
    await classCard(page, created.name).getByRole('button', { name: 'আবেদন করুন' }).click();

    await expect(page).toHaveURL(/\/applications\/h_[0-9a-f]{32}$/);
    const holdId = page.url().split('/').pop()!;
    await expect(page.getByRole('heading', { level: 1, name: 'আবেদন' })).toBeVisible();
    const status = page.getByRole('region', { name: 'আবেদনের অবস্থা' });
    await expect(status).toContainText('আসন সাময়িকভাবে সংরক্ষিত হয়েছে');
    await expect(status).toContainText('HELD');

    // Countdown is visible and moves.
    const timer = page.getByRole('timer', { name: 'মেয়াদ শেষ হতে বাকি সময়' });
    await expect(timer).toBeVisible();
    const first = seconds(await timer.innerText());
    await expect.poll(async () => seconds(await timer.innerText()), { timeout: 5_000 }).toBeLessThan(first);

    const details = page.getByRole('region', { name: 'শিক্ষার্থী ও আবেদন বিবরণী' });
    await expect(details).toContainText(masked(studentId));
    await expect(details).not.toContainText(studentId);
    await expect(details).toContainText(created.name);
    await expect(details).toContainText(holdId);
    await expect(details).toContainText('Simulated payment');
    expect((await getClass(request, created.id)).heldSeats).toBe(1);

    // Open the payment dialog, step back, then pay.
    const pay = page.getByRole('button', { name: 'ভর্তি ফি দিন' });
    await pay.click();
    const dialog = page.getByRole('dialog', { name: 'ভর্তি ফি জমা নিশ্চিত করবেন?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(created.name);
    await expect(dialog).toContainText('simulated');
    // Keyboard focus moves into the dialog (the browser focuses its first button, "ফিরে যান").
    await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await dialog.getByRole('button', { name: 'ফিরে যান' }).click();
    await expect(dialog).toBeHidden();
    expect((await getHold(request, holdId)).status).toBe('HELD');

    await pay.click();
    await page.keyboard.press('Escape'); // keyboard users can close it too
    await expect(dialog).toBeHidden();
    expect((await getHold(request, holdId)).status).toBe('HELD');

    await pay.click();
    await dialog.getByRole('button', { name: 'হ্যাঁ, ভর্তি ফি দিন' }).click();
    await expect(status).toContainText('ভর্তি নিশ্চিত হয়েছে • CONFIRMED');
    await expect(status).toContainText('অভিনন্দন! ভর্তি নিশ্চিত (CONFIRMED)');
    await expect(page.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'বাতিল', exact: true })).toBeDisabled();

    const seats = await getClass(request, created.id);
    expect([seats.heldSeats, seats.confirmedSeats, seats.availableSeats]).toEqual([0, 1, 4]);

    await page.getByRole('button', { name: 'প্রিন্ট করুন' }).click();
    expect(await printCalls(page)).toBe(1);

    await page.reload();
    await expect(page.getByRole('region', { name: 'আবেদনের অবস্থা' })).toContainText('CONFIRMED');

    // The class card now links to the admission instead of offering a second application.
    await page.getByRole('navigation', { name: 'প্রধান মেনু' }).getByRole('link', { name: 'ভর্তি কার্যক্রম' }).click();
    const card = classCard(page, created.name);
    await expect(card.getByRole('button', { name: 'আবেদন করুন' })).toHaveCount(0);
    await card.getByRole('link', { name: 'ভর্তি নিশ্চিত — দেখুন' }).click();
    await expect(page).toHaveURL(new RegExp(`/applications/${holdId}$`));
  });

  test('a running application is linked from the card; "বাতিল" releases the seat', async ({ page, request }) => {
    const studentId = newStudentId();
    const created = await createClass(request, uniqueName('Class 8 - Day Shift'), 3);
    await page.goto('/');
    await saveStudentId(page, studentId);
    await classCard(page, created.name).getByRole('button', { name: 'আবেদন করুন' }).click();
    await expect(page).toHaveURL(/\/applications\/h_/);
    const holdId = page.url().split('/').pop()!;

    await page.goto('/');
    await classCard(page, created.name).getByRole('link', { name: 'চলমান আবেদন দেখুন' }).click();
    await expect(page).toHaveURL(new RegExp(`/applications/${holdId}$`));

    const cancel = page.getByRole('button', { name: 'বাতিল', exact: true });
    await cancel.click();
    const dialog = page.getByRole('dialog', { name: 'আবেদন বাতিল করবেন?' });
    await expect(dialog).toContainText('বাতিল করলে সংরক্ষিত seat-টি সঙ্গে সঙ্গে অপেক্ষমাণ অন্যদের জন্য খুলে যাবে');
    await dialog.getByRole('button', { name: 'ফিরে যান' }).click();
    await expect(dialog).toBeHidden();
    expect((await getHold(request, holdId)).status).toBe('HELD');

    await cancel.click();
    await dialog.getByRole('button', { name: 'হ্যাঁ, বাতিল করুন' }).click();
    const status = page.getByRole('region', { name: 'আবেদনের অবস্থা' });
    await expect(status).toContainText('CANCELLED • বাতিলকৃত');
    await expect(status).toContainText('seat অন্যদের জন্য ছেড়ে দেওয়া হয়েছে');
    await expect(page.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeDisabled();
    await expect(cancel).toBeDisabled();

    const seats = await getClass(request, created.id);
    expect([seats.heldSeats, seats.confirmedSeats, seats.availableSeats]).toEqual([0, 0, 3]);

    // The guardian may apply again after cancelling.
    await page.goto('/');
    await expect(classCard(page, created.name).getByRole('button', { name: 'আবেদন করুন' })).toBeEnabled();
  });

  test('last seat taken by someone else just before the click → clear message, no hold', async ({ page, request }) => {
    const created = await createClass(request, uniqueName('Class 9 - Morning Shift'), 1);
    await page.goto('/');
    await saveStudentId(page, newStudentId());
    const card = classCard(page, created.name);
    const apply = card.getByRole('button', { name: 'আবেদন করুন' });
    await expect(apply).toBeEnabled();

    await createHold(request, created.id, newStudentId()); // the other guardian is faster
    await apply.click();

    await expect(card.getByRole('alert')).toHaveText(/দুঃখিত, এই class-এ এখন কোনো seat খালি নেই।/);
    await expect(page).toHaveURL(/\/$/);
    await expect(card.getByRole('button', { name: 'আসন খালি নেই (Full)' })).toBeDisabled();
    expect((await getClass(request, created.id)).heldSeats).toBe(1);
  });
});
