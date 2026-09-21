/**
 * Shared validation schema.
 *
 * This module is imported by BOTH the browser bundle and the Cloud Functions
 * (functions/validation.js re-exports it) so a rule can never drift between
 * the two. Client-side use is for instant feedback; the server copy is the
 * one that actually decides.
 */

import { sanitizeText, normalizeSpace } from './security.js';

export const LIMITS = {
  name: { min: 2, max: 60 },
  bio: { min: 0, max: 500 },
  city: { min: 2, max: 60 },
  jobTitle: { min: 5, max: 100 },
  jobDescription: { min: 20, max: 1000 },
  reviewBody: { min: 10, max: 600 },
  password: { min: 8, max: 128 },
};

/** Indian mobile numbers start 6-9 and are 10 digits. */
export const PATTERNS = {
  phone: /^[6-9]\d{9}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  otp: /^\d{6}$/,
  pincode: /^[1-9]\d{5}$/,
  name: /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u,
};

/**
 * @typedef {{valid: boolean, errors: Record<string,string>, data: object}} Result
 */

const req = (v) => v !== undefined && v !== null && String(v).trim() !== '';

function lengthError(label, value, { min, max }) {
  const len = String(value).trim().length;
  if (len < min) return `${label} must be at least ${min} characters.`;
  if (len > max) return `${label} must be ${max} characters or fewer.`;
  return null;
}

/** Validate the worker/customer profile form. */
export function validateProfile(input = {}) {
  const errors = {};
  const data = {
    name: normalizeSpace(sanitizeText(input.name, LIMITS.name.max)),
    trade: sanitizeText(input.trade, 40),
    city: normalizeSpace(sanitizeText(input.city, LIMITS.city.max)),
    phone: String(input.phone ?? '').replace(/\D/g, ''),
    rate: String(input.rate ?? '').replace(/\D/g, ''),
    bio: sanitizeText(input.bio, LIMITS.bio.max),
    available: Boolean(input.available),
  };

  if (!req(data.name)) errors.name = 'Enter your full name.';
  else {
    const e = lengthError('Name', data.name, LIMITS.name);
    if (e) errors.name = e;
    else if (!PATTERNS.name.test(data.name))
      errors.name = 'Name can only contain letters, spaces, apostrophes and hyphens.';
  }

  if (!req(data.trade)) errors.trade = 'Select the work you do.';

  if (!req(data.city)) errors.city = 'Enter your city.';
  else {
    const e = lengthError('City', data.city, LIMITS.city);
    if (e) errors.city = e;
  }

  if (!req(data.phone)) errors.phone = 'Enter your 10-digit mobile number.';
  else if (!PATTERNS.phone.test(data.phone))
    errors.phone = 'Enter a valid Indian mobile number starting with 6, 7, 8 or 9.';

  if (data.rate && (Number(data.rate) < 50 || Number(data.rate) > 100000))
    errors.rate = 'Day rate should be between ₹50 and ₹1,00,000.';

  if (data.bio) {
    const e = lengthError('About your work', data.bio, LIMITS.bio);
    if (e) errors.bio = e;
  }

  return { valid: Object.keys(errors).length === 0, errors, data };
}

/** Validate the "post a job" form. */
export function validateJob(input = {}) {
  const errors = {};
  const data = {
    title: normalizeSpace(sanitizeText(input.title, LIMITS.jobTitle.max)),
    trade: sanitizeText(input.trade, 40),
    city: normalizeSpace(sanitizeText(input.city, LIMITS.city.max)),
    budgetMin: String(input.budgetMin ?? '').replace(/\D/g, ''),
    budgetMax: String(input.budgetMax ?? '').replace(/\D/g, ''),
    description: sanitizeText(input.description, LIMITS.jobDescription.max),
    phone: String(input.phone ?? '').replace(/\D/g, ''),
  };

  if (!req(data.title)) errors.title = 'Give the job a short title.';
  else {
    const e = lengthError('Title', data.title, LIMITS.jobTitle);
    if (e) errors.title = e;
  }

  if (!req(data.trade)) errors.trade = 'Choose which trade this job needs.';
  if (!req(data.city)) errors.city = 'Enter the city where the work is.';

  if (!req(data.description)) errors.description = 'Describe the work to be done.';
  else {
    const e = lengthError('Description', data.description, LIMITS.jobDescription);
    if (e) errors.description = e;
  }

  const min = Number(data.budgetMin);
  const max = Number(data.budgetMax);
  if (!req(data.budgetMin)) errors.budgetMin = 'Enter a minimum budget.';
  else if (min < 50) errors.budgetMin = 'Minimum budget should be at least ₹50.';

  if (!req(data.budgetMax)) errors.budgetMax = 'Enter a maximum budget.';
  else if (max > 1000000) errors.budgetMax = 'Maximum budget looks too high.';
  else if (req(data.budgetMin) && max < min)
    errors.budgetMax = 'Maximum budget must be more than the minimum.';

  if (!req(data.phone)) errors.phone = 'Enter a contact mobile number.';
  else if (!PATTERNS.phone.test(data.phone))
    errors.phone = 'Enter a valid Indian mobile number.';

  return { valid: Object.keys(errors).length === 0, errors, data };
}

/** Validate a phone-auth sign-in step. */
export function validatePhoneStep(input = {}) {
  const errors = {};
  const data = { phone: String(input.phone ?? '').replace(/\D/g, '') };
  if (!req(data.phone)) errors.phone = 'Enter your mobile number.';
  else if (!PATTERNS.phone.test(data.phone))
    errors.phone = 'Enter a valid 10-digit Indian mobile number.';
  return { valid: Object.keys(errors).length === 0, errors, data };
}

export function validateOtpStep(input = {}) {
  const errors = {};
  const data = { otp: String(input.otp ?? '').replace(/\D/g, '') };
  if (!req(data.otp)) errors.otp = 'Enter the 6-digit code we sent you.';
  else if (!PATTERNS.otp.test(data.otp)) errors.otp = 'The code is 6 digits.';
  return { valid: Object.keys(errors).length === 0, errors, data };
}

/** Validate a review submission. */
export function validateReview(input = {}) {
  const errors = {};
  const data = {
    rating: Number(input.rating) || 0,
    body: sanitizeText(input.body, LIMITS.reviewBody.max),
    workerId: sanitizeText(input.workerId, 64),
  };

  if (!(data.rating >= 1 && data.rating <= 5))
    errors.rating = 'Choose a rating from 1 to 5 stars.';

  if (!req(data.body)) errors.body = 'Write a few words about the work.';
  else {
    const e = lengthError('Review', data.body, LIMITS.reviewBody);
    if (e) errors.body = e;
  }

  if (!req(data.workerId)) errors.workerId = 'Missing worker reference.';

  return { valid: Object.keys(errors).length === 0, errors, data };
}

/** Human-readable label for each field, used by the error summary. */
export const FIELD_LABELS = {
  name: 'Full name',
  trade: 'Work you do',
  city: 'City',
  phone: 'Mobile number',
  rate: 'Day rate',
  bio: 'About your work',
  title: 'Job title',
  description: 'Job description',
  budgetMin: 'Minimum budget',
  budgetMax: 'Maximum budget',
  otp: 'Verification code',
  rating: 'Rating',
  body: 'Review',
};
