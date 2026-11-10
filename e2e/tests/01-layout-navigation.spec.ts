import { createHold, createClass, expect, expectNoHorizontalScroll, newStudentId, saveStudentId, test, uniqueName } from './helpers';

test.describe('Layout and navigation', () => {
  test('header, main menu, logo link and footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('অনলাইন ভর্তি • আগে আবেদন করলে আগে পাবে • কোনো lottery নেই')).toBeVisible();

    const menu = page.getByRole('navigation', { name: 'প্রধান মেনু' });
    const home = menu.getByRole('link', { name: 'ভর্তি কার্যক্রম' });
    const mine = menu.getByRole('link', { name: 'আমার আবেদনসমূহ' });
    const admin = menu.getByRole('link', { name: 'স্কুল অ্যাডমিন' });
    await expect(home).toHaveAttribute('aria-current', 'page');

    await mine.click();
    await expect(page).toHaveURL(/\/my-applications$/);
    await expect(mine).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1, name: 'আমার আবেদনসমূহ' })).toBeVisible();

    await admin.click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { level: 1, name: 'আসন ব্যবস্থাপনা ও ভর্তি ড্যাশবোর্ড' })).toBeVisible();
    await expect(page.getByText('স্কুল অ্যাডমিন • শ্রেণি ও আসন ব্যবস্থাপনা')).toBeVisible();

    await page.getByRole('link', { name: 'বিদ্যালয় ভর্তি পোর্টাল — হোম' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'অনলাইন শিক্ষার্থী ভর্তি ও তাৎক্ষণিক আসন সংরক্ষণ' })).toBeVisible();

    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText('বিদ্যালয় ভর্তি পোর্টাল — Demo');
    await expect(footer).toContainText('simulated payment — কোনো আসল লেনদেন হয় না');
  });

  test('skip link moves keyboard focus to the main content', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'মূল অংশে যান' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('unknown page shows a message and a way back', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await expect(page.getByText('পেজটি পাওয়া যায়নি')).toBeVisible();
    await page.getByRole('link', { name: 'Class তালিকায় ফিরে যান' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('phone layout: bottom menu works and the main menu is hidden', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'প্রধান মেনু' })).toBeHidden();
    const mobile = page.getByRole('navigation', { name: 'মোবাইল মেনু' });
    await expect(mobile).toBeVisible();
    await mobile.getByRole('link', { name: 'আবেদনসমূহ' }).click();
    await expect(page).toHaveURL(/\/my-applications$/);
    await mobile.getByRole('link', { name: 'অ্যাডমিন' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await mobile.getByRole('link', { name: 'ক্যাটালগ' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('no page scrolls sideways on phone, tablet or desktop', async ({ page, request }) => {
    const studentId = newStudentId();
    const created = await createClass(request, uniqueName('Class 6 - Morning Shift'), 40);
    const hold = await createHold(request, created.id, studentId);
    await page.goto('/');
    await saveStudentId(page, studentId);

    const routes = ['/', '/my-applications', '/admin', '/admin/classes/new', `/applications/${hold.holdId}`, '/missing'];
    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator('main')).not.toBeEmpty();
        await page.waitForTimeout(300);
        await expectNoHorizontalScroll(page);
      }
    }
  });
});
