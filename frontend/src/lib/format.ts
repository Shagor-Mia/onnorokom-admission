import { toBengaliDigits } from './studentId';

/** Formats an ISO UTC timestamp in Bangladesh time, clearly labelled. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const text = new Intl.DateTimeFormat('bn-BD', {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
  return `${text} (বাংলাদেশ সময়)`;
}

/** Remaining milliseconds until expiry (never negative). */
export function remainingMs(expiresAt: string, nowMs: number): number {
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) return 0;
  return Math.max(0, expires - nowMs);
}

/** mm:ss (or h:mm:ss) in Bengali digits. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  const text = hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  return toBengaliDigits(text);
}

export function formatNumber(value: number): string {
  return toBengaliDigits(value);
}
