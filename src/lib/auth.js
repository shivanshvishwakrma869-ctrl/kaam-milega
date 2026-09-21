/**
 * Authentication — Firebase phone auth (OTP), the right primitive for an
 * India-first audience where a mobile number is the universal identity and
 * email is often secondary.
 *
 * In demo mode a fake OTP flow runs locally so the journey is walkable without
 * a backend. The demo path never claims to be secure and is labelled as such
 * in the UI.
 */

import { initFirebase, isDemoMode } from './firebase.js';

const listeners = new Set();
let currentUser = null;
let confirmationResult = null;
let recaptchaVerifier = null;

const DEMO_KEY = 'km:demo-user';
const DEMO_OTP = '123456';

/** Subscribe to auth changes. Returns an unsubscribe function. */
export function onAuthChange(fn) {
  listeners.add(fn);
  fn(currentUser);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => {
    try {
      fn(currentUser);
    } catch (err) {
      console.error('[auth] listener failed', err);
    }
  });
}

export function getUser() {
  return currentUser;
}

/** Restore any existing session. Call once on boot. */
export async function initAuth() {
  if (isDemoMode) {
    try {
      currentUser = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null');
    } catch {
      currentUser = null;
    }
    emit();
    return;
  }

  const { auth, authMod } = await initFirebase();
  authMod.onAuthStateChanged(auth, (user) => {
    currentUser = user
      ? { uid: user.uid, phone: user.phoneNumber, name: user.displayName }
      : null;
    emit();
  });
}

/**
 * Step 1 — send the OTP.
 * @param {string} phone 10-digit Indian mobile, already validated
 * @param {string} recaptchaContainerId id of an element to host the widget
 */
export async function sendOtp(phone, recaptchaContainerId = 'recaptcha-host') {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 400));
    sessionStorage.setItem('km:demo-otp-phone', phone);
    return { demo: true, hint: DEMO_OTP };
  }

  const { auth, authMod } = await initFirebase();
  const { RecaptchaVerifier, signInWithPhoneNumber } = authMod;

  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: 'invisible',
    });
  }

  confirmationResult = await signInWithPhoneNumber(
    auth,
    `+91${phone}`,
    recaptchaVerifier,
  );
  return { demo: false };
}

/** Step 2 — confirm the OTP. */
export async function verifyOtp(code) {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 400));
    if (code !== DEMO_OTP) {
      const err = new Error('That code is not correct. In demo mode the code is 123456.');
      err.code = 'auth/invalid-verification-code';
      throw err;
    }
    const phone = sessionStorage.getItem('km:demo-otp-phone') || '';
    currentUser = { uid: `demo-${phone}`, phone: `+91${phone}`, name: null, demo: true };
    localStorage.setItem(DEMO_KEY, JSON.stringify(currentUser));
    sessionStorage.removeItem('km:demo-otp-phone');
    emit();
    return currentUser;
  }

  if (!confirmationResult) throw new Error('Request a new code first.');
  const cred = await confirmationResult.confirm(code);
  currentUser = {
    uid: cred.user.uid,
    phone: cred.user.phoneNumber,
    name: cred.user.displayName,
  };
  emit();
  return currentUser;
}

export async function signOut() {
  if (isDemoMode) {
    currentUser = null;
    localStorage.removeItem(DEMO_KEY);
    emit();
    return;
  }
  const { auth, authMod } = await initFirebase();
  await authMod.signOut(auth);
  currentUser = null;
  emit();
}

/** Map Firebase auth error codes to language a non-technical user can act on. */
export function authErrorMessage(err) {
  const code = err?.code || '';
  const map = {
    'auth/invalid-phone-number': 'That mobile number does not look right. Check and try again.',
    'auth/invalid-verification-code': 'That code is not correct. Please re-enter it.',
    'auth/code-expired': 'That code has expired. Request a new one.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes before trying again.',
    'auth/quota-exceeded': 'We cannot send codes right now. Please try again later.',
    'auth/network-request-failed': 'Network problem. Check your connection and try again.',
    'auth/missing-phone-number': 'Enter your mobile number first.',
  };
  return map[code] || err?.message || 'Something went wrong. Please try again.';
}
