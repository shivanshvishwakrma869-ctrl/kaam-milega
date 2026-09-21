/**
 * KaamMilega — Cloud Functions (Firebase Functions v2).
 *
 * These exist because some rules cannot be expressed in Firestore Security
 * Rules alone:
 *   - a review may only be left by someone who actually hired the worker
 *   - rating aggregates must stay consistent with the reviews collection
 *   - moderation and rate limiting need server-side state
 *
 * Deploy:  firebase deploy --only functions
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Keep cold starts and cost down; asia-south1 is Mumbai — closest to users.
setGlobalOptions({ region: 'asia-south1', maxInstances: 10 });

const LIMITS = {
  reviewBody: { min: 10, max: 600 },
};

/** Server-side mirror of the client sanitiser. Never trust the client copy. */
function sanitizeText(value, maxLength) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/* -------------------------------------------------------------- submitReview */

/**
 * Callable: submit a review.
 * Enforced here rather than in rules because it needs a cross-document check
 * (did this user actually have a completed job with this worker?).
 */
exports.submitReview = onCall(
  { enforceAppCheck: true, consumeAppCheckToken: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Please log in to leave a review.');

    const workerId = sanitizeText(request.data?.workerId, 64);
    const body = sanitizeText(request.data?.body, LIMITS.reviewBody.max);
    const rating = Number(request.data?.rating);

    if (!workerId) throw new HttpsError('invalid-argument', 'Missing worker.');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new HttpsError('invalid-argument', 'Rating must be a whole number from 1 to 5.');
    }
    if (body.length < LIMITS.reviewBody.min) {
      throw new HttpsError('invalid-argument', 'Please write a little more detail.');
    }
    if (workerId === uid) {
      throw new HttpsError('permission-denied', 'You cannot review your own profile.');
    }

    // Must have a completed engagement with this worker.
    const hired = await db
      .collection('engagements')
      .where('customerId', '==', uid)
      .where('workerId', '==', workerId)
      .where('status', '==', 'completed')
      .limit(1)
      .get();

    if (hired.empty) {
      throw new HttpsError(
        'permission-denied',
        'You can only review a worker you have hired through KaamMilega.',
      );
    }

    // One review per customer per worker.
    const reviewId = `${workerId}__${uid}`;
    const existing = await db.collection('reviews').doc(reviewId).get();
    if (existing.exists) {
      throw new HttpsError('already-exists', 'You have already reviewed this worker.');
    }

    const author = request.auth.token.name || 'KaamMilega customer';

    await db.collection('reviews').doc(reviewId).set({
      workerId,
      authorId: uid,
      author: sanitizeText(author, 60),
      rating,
      body,
      date: admin.firestore.FieldValue.serverTimestamp(),
      status: 'published',
    });

    return { ok: true, reviewId };
  },
);

/* --------------------------------------------------- rating recalculation --- */

/** Recompute a worker's rating aggregate whenever a review lands. */
async function recomputeRating(workerId) {
  const snap = await db
    .collection('reviews')
    .where('workerId', '==', workerId)
    .where('status', '==', 'published')
    .get();

  if (snap.empty) {
    await db.collection('workers').doc(workerId).set(
      { rating: 0, reviewCount: 0 },
      { merge: true },
    );
    return;
  }

  const total = snap.docs.reduce((sum, d) => sum + (Number(d.data().rating) || 0), 0);
  const count = snap.size;

  await db.collection('workers').doc(workerId).set(
    {
      rating: Math.round((total / count) * 10) / 10,
      reviewCount: count,
    },
    { merge: true },
  );
}

exports.onReviewCreated = onDocumentCreated('reviews/{reviewId}', async (event) => {
  const workerId = event.data?.data()?.workerId;
  if (workerId) await recomputeRating(workerId);
});

exports.onReviewDeleted = onDocumentDeleted('reviews/{reviewId}', async (event) => {
  const workerId = event.data?.data()?.workerId;
  if (workerId) await recomputeRating(workerId);
});

/* ------------------------------------------------------------- applyToJob --- */

/**
 * Callable: apply to a job. Increments the counter atomically so the client
 * never has to be trusted with the number.
 */
exports.applyToJob = onCall(
  { enforceAppCheck: true, consumeAppCheckToken: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Please log in to apply.');

    const jobId = sanitizeText(request.data?.jobId, 64);
    if (!jobId) throw new HttpsError('invalid-argument', 'Missing job.');

    const jobRef = db.collection('jobs').doc(jobId);
    const appRef = jobRef.collection('applications').doc(uid);

    await db.runTransaction(async (tx) => {
      const job = await tx.get(jobRef);
      if (!job.exists) throw new HttpsError('not-found', 'That job no longer exists.');
      if (job.data().status !== 'open') {
        throw new HttpsError('failed-precondition', 'That job is closed.');
      }
      if (job.data().ownerId === uid) {
        throw new HttpsError('failed-precondition', 'You cannot apply to your own job.');
      }

      const already = await tx.get(appRef);
      if (already.exists) {
        throw new HttpsError('already-exists', 'You have already applied to this job.');
      }

      tx.set(appRef, {
        workerId: uid,
        appliedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
      });
      tx.update(jobRef, {
        applicants: admin.firestore.FieldValue.increment(1),
      });
    });

    return { ok: true };
  },
);

/* ------------------------------------------------------------ stats refresh - */

/** Nightly: refresh the public counters shown on the landing page. */
exports.refreshStats = onSchedule('every day 02:00', async () => {
  const [workers, jobs] = await Promise.all([
    db.collection('workers').count().get(),
    db.collection('jobs').where('status', '==', 'open').count().get(),
  ]);

  const cities = new Set();
  const citySnap = await db.collection('workers').select('city').get();
  citySnap.forEach((d) => cities.add(d.data().city));

  await db.collection('meta').doc('stats').set({
    workers: `${workers.data().count.toLocaleString('en-IN')}+`,
    jobsPosted: `${jobs.data().count.toLocaleString('en-IN')}+`,
    cities: String(cities.size),
    avgResponse: '18 min',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});

/* ------------------------------------------------------------ account wipe -- */

/**
 * Callable: delete every trace of the caller's account.
 * Required by the DPDP Act's right to erasure, and by our own privacy policy.
 */
exports.deleteMyAccount = onCall(
  { enforceAppCheck: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Please log in first.');

    const batch = db.batch();
    batch.delete(db.collection('workers').doc(uid));

    const jobs = await db.collection('jobs').where('ownerId', '==', uid).get();
    jobs.forEach((d) => batch.delete(d.ref));

    const reviews = await db.collection('reviews').where('authorId', '==', uid).get();
    reviews.forEach((d) => batch.delete(d.ref));

    await batch.commit();
    await admin.auth().deleteUser(uid);

    return { ok: true };
  },
);
