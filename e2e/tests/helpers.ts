import { test as base, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

export const API_URL = (process.env.API_URL ?? 'http://localhost:8080').replace(/\/+$/, '');

export interface CreatedClass {
  id: string;
  name: string;
  totalSeats: number;
}

export interface ClassSeats extends CreatedClass {
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface Hold {
  holdId: string;
  classId: string;
  status: 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  createdAt?: string;
}

/**
 * `test` with one automatic check: an uncaught JavaScript error on the page fails the test
 * (the brief: errors must never end up as a blank page or only in the console).
 * `window.print` is replaced by a counter so print buttons can be tested without a dialog.
 */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(() => {
        (window as unknown as { __printCalls: number }).__printCalls = 0;
        window.print = () => {
          (window as unknown as { __printCalls: number }).__printCalls += 1;
        };
      });
      await use(errors);
      expect(errors, 'uncaught errors on the page').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

let counter = 0;

/** A fresh 17-digit birth registration number for every call. */
export function newStudentId(): string {
  counter += 1;
  const digits = `${Date.now()}${String(counter).padStart(3, '0')}${Math.floor(Math.random() * 10)}`;
  return digits.slice(-17).padStart(17, '9');
}

/** A unique class name; `suffix` keeps words such as "Morning Shift" that the UI reads. */
export function uniqueName(suffix: string): string {
  const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`.toUpperCase();
  return `E2E ${tag} - ${suffix}`;
}

const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** 12 -> "১২", as the UI prints numbers. */
export function bn(value: number | string): string {
  return String(value).replace(/[0-9]/g, (digit) => bengaliDigits[Number(digit)]);
}

/** "20152691234567890" -> "2015••••••••••890", as the UI masks the number. */
export function masked(studentId: string): string {
  return `${studentId.slice(0, 4)}${'•'.repeat(studentId.length - 7)}${studentId.slice(-3)}`;
}

// ---------- API helpers (setup and verification only; the actions under test use the UI) ----------

export async function createClass(request: APIRequestContext, name: string, totalSeats: number): Promise<CreatedClass> {
  const response = await request.post(`${API_URL}/classes`, { data: { name, totalSeats } });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as CreatedClass;
}

export async function getClass(request: APIRequestContext, classId: string): Promise<ClassSeats> {
  const response = await request.get(`${API_URL}/classes/${classId}`);
  expect(response.status()).toBe(200);
  return (await response.json()) as ClassSeats;
}

export async function createHold(request: APIRequestContext, classId: string, studentId: string): Promise<Hold> {
  const response = await request.post(`${API_URL}/classes/${classId}/holds`, { headers: { 'X-Student-Id': studentId } });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as Hold;
}

export async function getHold(request: APIRequestContext, holdId: string): Promise<Hold> {
  const response = await request.get(`${API_URL}/holds/${holdId}`);
  expect(response.status()).toBe(200);
  return (await response.json()) as Hold;
}

export async function confirmHold(request: APIRequestContext, holdId: string, studentId: string): Promise<void> {
  const response = await request.post(`${API_URL}/holds/${holdId}/confirm`, { headers: { 'X-Student-Id': studentId } });
  expect(response.status()).toBe(200);
}

export async function cancelHold(request: APIRequestContext, holdId: string, studentId: string): Promise<void> {
  const response = await request.delete(`${API_URL}/holds/${holdId}`, { headers: { 'X-Student-Id': studentId } });
  expect(response.status()).toBe(204);
}

// ---------- UI helpers ----------

/** Types the number into the box at the top of the page and saves it, like a guardian would. */
export async function saveStudentId(page: Page, studentId: string): Promise<void> {
  if (!page.url().startsWith('http')) await page.goto('/');
  const region = page.getByRole('region', { name: 'শিক্ষার্থীর পরিচয়' });
  if (await region.isVisible()) {
    await region.getByRole('button', { name: 'পরিবর্তন করুন' }).click();
  }
  const form = page.getByRole('form', { name: 'শিক্ষার্থীর পরিচয়' });
  await form.getByRole('textbox').fill(studentId);
  await form.getByRole('button', { name: 'সংরক্ষণ করুন' }).click();
  await expect(page.getByRole('region', { name: 'শিক্ষার্থীর পরিচয়' })).toContainText(masked(studentId));
}

/** The card of one class in "Class তালিকা". */
export function classCard(page: Page, name: string): Locator {
  return page
    .getByRole('region', { name: /শ্রেণি ও শিফট তালিকা/ })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) });
}

/** Seat numbers shown on a class card: [total, held, confirmed, available]. */
export async function cardSeats(card: Locator): Promise<string[]> {
  return card.getByRole('definition').allTextContents();
}

/** The row of one class in the admin table. */
export function adminRow(page: Page, name: string): Locator {
  return page.getByRole('row').filter({ has: page.getByRole('rowheader', { name, exact: true }) });
}

export async function printCalls(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls);
}

/** Fails when the page can be scrolled sideways (broken layout on small screens). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
}

/** Hold duration configured on the backend, measured from a real hold. */
export function holdSeconds(hold: Hold): number {
  return Math.round((Date.parse(hold.expiresAt) - Date.parse(hold.createdAt ?? new Date().toISOString())) / 1000);
}
