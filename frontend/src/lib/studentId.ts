const STORAGE_KEY = 'admission.studentId';
const BENGALI_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Converts Bengali digits to ASCII and removes spaces/dashes the guardian may type. */
export function normalizeStudentId(raw: string): string {
  return raw
    .replace(/[০-৯]/g, (digit) => String(BENGALI_DIGITS.indexOf(digit)))
    .replace(/[\s-]/g, '');
}

export function isValidStudentId(value: string): boolean {
  return /^[0-9]{17}$/.test(value);
}

/** Returns a Bengali validation message, or null when the value is valid. */
export function validateStudentId(raw: string): string | null {
  const value = normalizeStudentId(raw);
  if (value.length === 0) return 'জন্ম নিবন্ধন নম্বর লিখুন।';
  if (!/^[0-9]+$/.test(value)) return 'শুধু সংখ্যা ব্যবহার করুন।';
  if (value.length !== 17) {
    return `জন্ম নিবন্ধন নম্বর ঠিক ১৭ অঙ্কের হতে হবে (এখন ${toBengaliDigits(value.length)} অঙ্ক)।`;
  }
  return null;
}

/** Shows only the first 4 and last 3 digits, e.g. 2015**********890. */
export function maskStudentId(value: string): string {
  if (value.length <= 7) return value;
  return `${value.slice(0, 4)}${'•'.repeat(value.length - 7)}${value.slice(-3)}`;
}

export function toBengaliDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (digit) => BENGALI_DIGITS[Number(digit)]);
}

export function loadStudentId(): string | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && isValidStudentId(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function saveStudentId(value: string | null): void {
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode); the ID then lasts for this tab only.
  }
}
