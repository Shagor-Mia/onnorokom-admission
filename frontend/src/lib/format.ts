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

/** 0.6667 -> "৬৬.৭%" */
export function formatPercent(ratio: number): string {
  const value = Math.round(ratio * 1000) / 10;
  return `${toBengaliDigits(Number.isInteger(value) ? value : value.toFixed(1))}%`;
}

/** Short time only, e.g. "১০:১৫:০০" in Bangladesh time. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('bn-BD', {
    timeZone: 'Asia/Dhaka',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

/** Short, human tracking number derived from the hold ID: h_3f2a…c9 -> #3F2A-C9D1. */
export function trackingNumber(holdId: string): string {
  const hex = holdId.replace(/^h_/, '').toUpperCase();
  return hex.length >= 8 ? `#${hex.slice(0, 4)}-${hex.slice(-4)}` : `#${hex}`;
}
