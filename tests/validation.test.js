import { describe, it, expect } from 'vitest';
import {
  validateProfile, validateJob, validatePhoneStep, validateOtpStep,
  validateReview, PATTERNS,
} from '../src/lib/validation.js';

describe('phone validation', () => {
  it('accepts valid Indian mobile numbers', () => {
    for (const n of ['9876543210', '6000000000', '7123456789', '8999999999']) {
      expect(PATTERNS.phone.test(n), n).toBe(true);
    }
  });

  it('rejects numbers that do not start 6-9', () => {
    for (const n of ['1234567890', '5876543210', '0987654321']) {
      expect(PATTERNS.phone.test(n), n).toBe(false);
    }
  });

  it('rejects wrong lengths', () => {
    expect(PATTERNS.phone.test('987654321')).toBe(false);
    expect(PATTERNS.phone.test('98765432100')).toBe(false);
  });

  it('strips non-digits before checking', () => {
    const r = validatePhoneStep({ phone: '98765 43210' });
    expect(r.valid).toBe(true);
    expect(r.data.phone).toBe('9876543210');
  });

  it('rejects an empty phone with a helpful message', () => {
    const r = validatePhoneStep({ phone: '' });
    expect(r.valid).toBe(false);
    expect(r.errors.phone).toMatch(/enter your mobile/i);
  });
});

describe('OTP validation', () => {
  it('accepts exactly six digits', () => {
    expect(validateOtpStep({ otp: '123456' }).valid).toBe(true);
  });

  it('rejects short, long, and non-numeric codes', () => {
    expect(validateOtpStep({ otp: '12345' }).valid).toBe(false);
    expect(validateOtpStep({ otp: '1234567' }).valid).toBe(false);
    expect(validateOtpStep({ otp: 'abcdef' }).valid).toBe(false);
  });
});

describe('profile validation', () => {
  const valid = {
    name: 'Rahul Kumar',
    trade: 'electrician',
    city: 'Ayodhya',
    phone: '9876543210',
    rate: '600',
    bio: 'House wiring and repairs.',
    available: true,
  };

  it('accepts a complete profile', () => {
    expect(validateProfile(valid).valid).toBe(true);
  });

  it('requires name, trade, city and phone', () => {
    const r = validateProfile({});
    expect(r.valid).toBe(false);
    for (const f of ['name', 'trade', 'city', 'phone']) {
      expect(r.errors[f], f).toBeTruthy();
    }
  });

  it('accepts names with Indian scripts, apostrophes and hyphens', () => {
    for (const n of ['राहुल कुमार', "D'Souza", 'Ram-Prasad', 'Mary Jane']) {
      expect(validateProfile({ ...valid, name: n }).errors.name, n).toBeUndefined();
    }
  });

  it('rejects names starting with punctuation or digits', () => {
    expect(validateProfile({ ...valid, name: '123abc' }).errors.name).toBeTruthy();
    expect(validateProfile({ ...valid, name: '-bad' }).errors.name).toBeTruthy();
  });

  it('enforces the day-rate bounds', () => {
    expect(validateProfile({ ...valid, rate: '10' }).errors.rate).toBeTruthy();
    expect(validateProfile({ ...valid, rate: '999999' }).errors.rate).toBeTruthy();
    expect(validateProfile({ ...valid, rate: '' }).errors.rate).toBeUndefined();
  });

  it('strips control characters from free text', () => {
    const r = validateProfile({ ...valid, bio: 'Good\u0000work\u001Fhere' });
    expect(r.data.bio).toBe('Goodworkhere');
  });

  it('truncates an over-long bio rather than silently accepting it', () => {
    const r = validateProfile({ ...valid, bio: 'x'.repeat(900) });
    expect(r.data.bio.length).toBe(500);
  });

  it('collapses repeated whitespace in the name', () => {
    expect(validateProfile({ ...valid, name: 'Rahul    Kumar' }).data.name).toBe('Rahul Kumar');
  });
});

describe('job validation', () => {
  const valid = {
    title: 'Bathroom tap replacement',
    trade: 'plumber',
    city: 'Lucknow',
    budgetMin: '800',
    budgetMax: '2000',
    description: 'Two taps need replacing and there is a slow leak under the basin.',
    phone: '9876543210',
  };

  it('accepts a complete job', () => {
    expect(validateJob(valid).valid).toBe(true);
  });

  it('rejects a max budget below the min', () => {
    const r = validateJob({ ...valid, budgetMin: '5000', budgetMax: '1000' });
    expect(r.valid).toBe(false);
    expect(r.errors.budgetMax).toMatch(/more than the minimum/i);
  });

  it('rejects a too-short description', () => {
    expect(validateJob({ ...valid, description: 'fix tap' }).errors.description).toBeTruthy();
  });

  it('rejects an implausible budget', () => {
    expect(validateJob({ ...valid, budgetMax: '9999999' }).errors.budgetMax).toBeTruthy();
  });
});

describe('review validation', () => {
  const valid = { rating: 5, body: 'Excellent work, arrived on time.', workerId: 'w-1' };

  it('accepts a valid review', () => {
    expect(validateReview(valid).valid).toBe(true);
  });

  it('rejects out-of-range ratings', () => {
    expect(validateReview({ ...valid, rating: 0 }).valid).toBe(false);
    expect(validateReview({ ...valid, rating: 6 }).valid).toBe(false);
  });

  it('requires a meaningful body', () => {
    expect(validateReview({ ...valid, body: 'ok' }).errors.body).toBeTruthy();
  });
});
