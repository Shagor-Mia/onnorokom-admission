import { describe, expect, it } from 'vitest';
import { effectiveStatus } from '../pages/ApplicationPage';
import { ApiError } from './api';
import { formatDuration, remainingMs } from './format';
import { describeError } from './messages';
import {
  isValidStudentId,
  loadStudentId,
  maskStudentId,
  normalizeStudentId,
  saveStudentId,
  validateStudentId,
} from './studentId';

describe('student ID', () => {
  it('accepts exactly 17 digits', () => {
    expect(isValidStudentId('20152691234567890')).toBe(true);
    expect(isValidStudentId('2015269123456789')).toBe(false);
    expect(isValidStudentId('201526912345678901')).toBe(false);
    expect(isValidStudentId('2015269123456789a')).toBe(false);
  });

  it('normalizes Bengali digits, spaces and dashes', () => {
    expect(normalizeStudentId('২০১৫২৬৯১২৩৪৫৬৭৮৯০')).toBe('20152691234567890');
    expect(normalizeStudentId('2015 2691-2345 67890')).toBe('20152691234567890');
  });

  it('explains what is wrong in Bengali', () => {
    expect(validateStudentId('')).toContain('লিখুন');
    expect(validateStudentId('12ab')).toContain('শুধু সংখ্যা');
    expect(validateStudentId('12345')).toContain('১৭ অঙ্কের');
    expect(validateStudentId('20152691234567890')).toBeNull();
  });

  it('masks the middle digits', () => {
    expect(maskStudentId('20152691234567890')).toBe('2015••••••••••890');
  });

  it('persists to and restores from localStorage', () => {
    saveStudentId('20152691234567890');
    expect(loadStudentId()).toBe('20152691234567890');
    saveStudentId(null);
    expect(loadStudentId()).toBeNull();
  });
});

describe('error messages', () => {
  it('maps API codes to Bengali text', () => {
    expect(describeError(new ApiError(409, 'x', { code: 'NO_SEATS_AVAILABLE' }))).toContain('seat খালি নেই');
    expect(describeError(new ApiError(409, 'x', { code: 'HOLD_EXPIRED' }))).toContain('মেয়াদ শেষ');
    expect(describeError(new ApiError(0, 'network'))).toContain('সার্ভারের সাথে সংযোগ');
    expect(describeError(new ApiError(500, 'boom'))).toContain('সার্ভারে সমস্যা');
    expect(describeError(new Error('bug'))).toContain('অপ্রত্যাশিত');
  });
});

describe('expiry', () => {
  it('treats a HELD hold past its expiry as EXPIRED', () => {
    const now = Date.parse('2026-11-01T04:10:00Z');
    expect(effectiveStatus({ status: 'HELD', expiresAt: '2026-11-01T04:10:01Z' }, now)).toBe('HELD');
    expect(effectiveStatus({ status: 'HELD', expiresAt: '2026-11-01T04:10:00Z' }, now)).toBe('EXPIRED');
    expect(effectiveStatus({ status: 'CONFIRMED', expiresAt: '2026-11-01T04:00:00Z' }, now)).toBe('CONFIRMED');
  });

  it('formats the remaining time', () => {
    const now = Date.parse('2026-11-01T04:00:00Z');
    expect(remainingMs('2026-11-01T04:10:00Z', now)).toBe(600_000);
    expect(formatDuration(600_000)).toBe('১০:০০');
    expect(formatDuration(0)).toBe('০০:০০');
  });
});
