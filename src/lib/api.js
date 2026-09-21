/**
 * Data access layer.
 *
 * Every read/write goes through here so the rest of the app never touches
 * Firestore directly. When Firebase is unconfigured this transparently serves
 * the local seed set, which keeps the UI fully demoable.
 */

import { initFirebase, isDemoMode } from './firebase.js';
import { WORKERS, JOBS, REVIEWS, STATS } from '../data/seed.js';
import { sanitizeText } from './security.js';

/** Simulated latency in demo mode so loading states are actually visible. */
const DEMO_DELAY = 260;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ Workers */

/**
 * @param {{trade?:string, city?:string, q?:string, availableOnly?:boolean,
 *          verifiedOnly?:boolean, sort?:string, limit?:number}} opts
 */
export async function listWorkers(opts = {}) {
  const {
    trade = '',
    city = '',
    q = '',
    availableOnly = false,
    verifiedOnly = false,
    sort = 'rating',
    limit = 50,
  } = opts;

  if (isDemoMode) {
    await sleep(DEMO_DELAY);
    return filterWorkers(WORKERS, { trade, city, q, availableOnly, verifiedOnly, sort, limit });
  }

  const { firestoreMod, db } = await initFirebase();
  const {
    collection, query, where, orderBy, limit: fsLimit, getDocs,
  } = firestoreMod;

  const clauses = [];
  if (trade) clauses.push(where('trade', '==', trade));
  if (city) clauses.push(where('city', '==', city));
  if (availableOnly) clauses.push(where('available', '==', true));
  if (verifiedOnly) clauses.push(where('verified', '==', true));

  const sortField = sort === 'rate' ? 'rate' : sort === 'jobs' ? 'jobsDone' : 'rating';
  clauses.push(orderBy(sortField, 'desc'), fsLimit(limit));

  const snap = await getDocs(query(collection(db, 'workers'), ...clauses));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Free-text match stays client-side; Firestore has no substring search.
  // For production scale this should move to Algolia or Typesense.
  return q ? rows.filter((w) => matchesText(w, q)) : rows;
}

export async function getWorker(id) {
  if (isDemoMode) {
    await sleep(DEMO_DELAY);
    return WORKERS.find((w) => w.id === id) ?? null;
  }
  const { firestoreMod, db } = await initFirebase();
  const { doc, getDoc } = firestoreMod;
  const snap = await getDoc(doc(db, 'workers', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveWorkerProfile(uid, profile) {
  if (isDemoMode) {
    await sleep(DEMO_DELAY);
    const stored = { id: uid, ...profile, updatedAt: new Date().toISOString() };
    localStorage.setItem('km:demo-profile', JSON.stringify(stored));
    return stored;
  }
  const { firestoreMod, db } = await initFirebase();
  const { doc, setDoc, serverTimestamp } = firestoreMod;
  const ref = doc(db, 'workers', uid);
  // Note: `verified`, `rating` and `jobsDone` are deliberately absent — the
  // security rules reject any client write to those fields.
  await setDoc(
    ref,
    {
      name: profile.name,
      trade: profile.trade,
      city: profile.city,
      phone: profile.phone,
      rate: Number(profile.rate) || 0,
      bio: profile.bio,
      available: Boolean(profile.available),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return { id: uid, ...profile };
}

export function loadDemoProfile() {
  try {
    return JSON.parse(localStorage.getItem('km:demo-profile') || 'null');
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------------- Jobs */

export async function listJobs(opts = {}) {
  const { trade = '', city = '', limit = 50 } = opts;

  if (isDemoMode) {
    await sleep(DEMO_DELAY);
    let rows = [...JOBS];
    if (trade) rows = rows.filter((j) => j.trade === trade);
    if (city) rows = rows.filter((j) => j.city === city);
    const localJobs = loadLocalJobs();
    return [...localJobs, ...rows]
      .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt))
      .slice(0, limit);
  }

  const { firestoreMod, db } = await initFirebase();
  const { collection, query, where, orderBy, limit: fsLimit, getDocs } = firestoreMod;
  const clauses = [where('status', '==', 'open')];
  if (trade) clauses.push(where('trade', '==', trade));
  if (city) clauses.push(where('city', '==', city));
  clauses.push(orderBy('postedAt', 'desc'), fsLimit(limit));
  const snap = await getDocs(query(collection(db, 'jobs'), ...clauses));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createJob(uid, job) {
  if (isDemoMode) {
    await sleep(DEMO_DELAY);
    const row = {
      id: `j-local-${Date.now()}`,
      ...job,
      postedAt: new Date().toISOString(),
      applicants: 0,
      urgency: 'this-week',
    };
    const existing = loadLocalJobs();
    localStorage.setItem('km:demo-jobs', JSON.stringify([row, ...existing].slice(0, 20)));
    return row;
  }
  const { firestoreMod, db } = await initFirebase();
  const { collection, addDoc, serverTimestamp } = firestoreMod;
  const ref = await addDoc(collection(db, 'jobs'), {
    ...job,
    budgetMin: Number(job.budgetMin),
    budgetMax: Number(job.budgetMax),
    ownerId: uid,
    status: 'open',
    applicants: 0,
    postedAt: serverTimestamp(),
  });
  return { id: ref.id, ...job };
}

function loadLocalJobs() {
  try {
    return JSON.parse(localStorage.getItem('km:demo-jobs') || '[]');
  } catch {
    return [];
  }
}

/**
 * Apply to a job.
 *
 * Goes through the `applyToJob` Cloud Function rather than writing directly:
 * the applicant counter has to be incremented inside a transaction, and the
 * client must never be trusted with that number. Firestore rules pin
 * `applicants` to its existing value on any client update for the same reason.
 */
export async function applyToJob(jobId) {
  if (isDemoMode) {
    await sleep(DEMO_DELAY);
    const applied = loadLocalApplications();
    if (applied.includes(jobId)) {
      const err = new Error('You have already applied to this job.');
      err.code = 'already-exists';
      throw err;
    }
    applied.push(jobId);
    localStorage.setItem('km:demo-applications', JSON.stringify(applied.slice(-50)));
    return { ok: true, demo: true };
  }

  const { app } = await initFirebase();
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions(app, 'asia-south1');
  const call = httpsCallable(fns, 'applyToJob');
  const res = await call({ jobId });
  return res.data;
}

/** Job ids the current browser has already applied to (demo mode only). */
export function loadLocalApplications() {
  try {
    const v = JSON.parse(localStorage.getItem('km:demo-applications') || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Submit a review. Cloud-Functions-only by design — `firestore.rules` denies
 * all client writes to /reviews, because the function has to verify the
 * reviewer actually hired the worker before a rating is allowed to count.
 */
export async function submitReview({ workerId, rating, body }) {
  if (isDemoMode) {
    await sleep(DEMO_DELAY);
    return { ok: true, demo: true };
  }
  const { app } = await initFirebase();
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions(app, 'asia-south1');
  const call = httpsCallable(fns, 'submitReview');
  const res = await call({ workerId, rating, body });
  return res.data;
}

/** Map a Cloud Functions error code to language a user can act on. */
export function callableErrorMessage(err) {
  const map = {
    unauthenticated: 'Please log in first.',
    'already-exists': 'You have already applied to this job.',
    'permission-denied': 'You are not allowed to do that.',
    'failed-precondition': 'That job is closed or is your own post.',
    'not-found': 'That job no longer exists.',
    'resource-exhausted': 'Too many requests. Please wait a moment.',
    unavailable: 'Network problem. Check your connection and try again.',
  };
  const code = String(err?.code || '').replace(/^functions\//, '');
  return map[code] || err?.message || 'Something went wrong. Please try again.';
}

/* ------------------------------------------------------------------ Reviews */

export async function listReviews({ workerId = '', limit = 20 } = {}) {
  if (isDemoMode) {
    await sleep(DEMO_DELAY);
    const rows = workerId ? REVIEWS.filter((r) => r.workerId === workerId) : REVIEWS;
    return rows.slice(0, limit);
  }
  const { firestoreMod, db } = await initFirebase();
  const { collection, query, where, orderBy, limit: fsLimit, getDocs } = firestoreMod;
  const clauses = [];
  if (workerId) clauses.push(where('workerId', '==', workerId));
  clauses.push(orderBy('date', 'desc'), fsLimit(limit));
  const snap = await getDocs(query(collection(db, 'reviews'), ...clauses));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* -------------------------------------------------------------------- Stats */

export async function getStats() {
  if (isDemoMode) return STATS;
  try {
    const { firestoreMod, db } = await initFirebase();
    const { doc, getDoc } = firestoreMod;
    const snap = await getDoc(doc(db, 'meta', 'stats'));
    return snap.exists() ? snap.data() : STATS;
  } catch {
    return STATS;
  }
}

/* ------------------------------------------------------------------ Helpers */

function matchesText(worker, q) {
  const needle = sanitizeText(q, 80).toLowerCase();
  if (!needle) return true;
  return `${worker.name} ${worker.trade} ${worker.city} ${worker.bio ?? ''}`
    .toLowerCase()
    .includes(needle);
}

/** Exported for unit tests. */
export function filterWorkers(source, opts) {
  const { trade, city, q, availableOnly, verifiedOnly, sort, limit } = opts;
  let rows = [...source];
  if (trade) rows = rows.filter((w) => w.trade === trade);
  if (city) rows = rows.filter((w) => w.city === city);
  if (availableOnly) rows = rows.filter((w) => w.available);
  if (verifiedOnly) rows = rows.filter((w) => w.verified);
  if (q) rows = rows.filter((w) => matchesText(w, q));

  const cmp = {
    rating: (a, b) => b.rating - a.rating,
    rate: (a, b) => a.rate - b.rate,
    jobs: (a, b) => b.jobsDone - a.jobsDone,
  }[sort] ?? ((a, b) => b.rating - a.rating);

  return rows.sort(cmp).slice(0, limit);
}
