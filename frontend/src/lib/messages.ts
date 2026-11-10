import { ApiError } from './api';
import type { HoldStatus } from '../types/api';

/** Turns any error into a short Bengali message a guardian can understand. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'অপ্রত্যাশিত সমস্যা হয়েছে। পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।';
  }

  if (error.isNetworkError) {
    return 'সার্ভারের সাথে সংযোগ করা যাচ্ছে না। সার্ভার বন্ধ থাকতে পারে বা ইন্টারনেট সংযোগ নেই — একটু পরে আবার চেষ্টা করুন।';
  }

  switch (error.code) {
    case 'NO_SEATS_AVAILABLE':
      return 'দুঃখিত, এই class-এ এখন কোনো seat খালি নেই।';
    case 'DUPLICATE_ACTIVE_APPLICATION':
      return 'এই শিক্ষার্থীর এই class-এ ইতিমধ্যে একটি চলমান আবেদন বা নিশ্চিত ভর্তি আছে।';
    case 'HOLD_EXPIRED':
      return 'আবেদনের মেয়াদ শেষ হয়ে গেছে, seat ছেড়ে দেওয়া হয়েছে। চাইলে আবার আবেদন করুন।';
    case 'HOLD_NOT_ACTIVE':
      return 'এই আবেদনটি আর চলমান নেই, তাই এই কাজটি করা যাবে না।';
    case 'HOLD_NOT_OWNED':
      return 'এই আবেদনটি অন্য শিক্ষার্থীর। উপরের ঘরে সঠিক জন্ম নিবন্ধন নম্বর দিন।';
    case 'INVALID_STUDENT_ID':
      return 'জন্ম নিবন্ধন নম্বর ঠিক ১৭ অঙ্কের হতে হবে।';
    case 'CLASS_NOT_FOUND':
      return 'এই class খুঁজে পাওয়া যায়নি।';
    case 'HOLD_NOT_FOUND':
      return 'এই আবেদন খুঁজে পাওয়া যায়নি।';
    case 'VALIDATION_FAILED':
      return 'তথ্য সঠিক নয়। ঘরগুলো আবার দেখে নিন।';
    default:
      break;
  }

  if (error.status === 400 || error.status === 422) return 'তথ্য সঠিক নয়। ঘরগুলো আবার দেখে নিন।';
  if (error.status === 403) return 'এই কাজটি করার অনুমতি নেই।';
  if (error.status === 404) return 'তথ্য খুঁজে পাওয়া যায়নি।';
  if (error.status === 409) return 'অনুরোধটি এই মুহূর্তে সম্পন্ন করা গেল না (conflict)। তথ্য রিফ্রেশ করে আবার চেষ্টা করুন।';
  if (error.status >= 500) return 'সার্ভারে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।';
  return 'অনুরোধটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।';
}

export const statusLabels: Record<HoldStatus, string> = {
  HELD: 'Seat hold-এ আছে',
  CONFIRMED: 'ভর্তি নিশ্চিত',
  EXPIRED: 'মেয়াদ শেষ',
  CANCELLED: 'বাতিল',
};
