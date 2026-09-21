#!/usr/bin/env node
/**
 * Seed the local Firestore emulator with the demo fixtures.
 *
 * This is a development convenience only. It refuses to run against a real
 * project: it talks exclusively to FIRESTORE_EMULATOR_HOST over the emulator's
 * REST API, so there is no Admin SDK dependency and no credential to leak.
 *
 *   npm run emulators      # in one terminal
 *   npm run seed           # in another
 */
import process from 'node:process';
import { WORKERS, JOBS, REVIEWS, STATS } from '../src/data/seed.js';

const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const PROJECT = process.env.GCLOUD_PROJECT ?? process.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-kaammilega';
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Refuse to touch anything that is not an emulator. */
if (!/^(127\.0\.0\.1|localhost|0\.0\.0\.0)(:\d+)?$/.test(HOST)) {
  console.error(
    `[seed] refusing to run: FIRESTORE_EMULATOR_HOST is "${HOST}", which is not a local emulator.\n` +
      '[seed] This script must never write to a production project.',
  );
  process.exit(1);
}

/** Convert a plain JS value into Firestore REST's typed-value format. */
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  // ISO date strings become real timestamps so orderBy('date') sorts correctly.
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v)) return { timestampValue: v };
  return { stringValue: String(v) };
}

const toFields = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));

/** Write one document, replacing whatever was there. */
async function put(collection, id, data) {
  const { id: _omit, ...rest } = data;
  const res = await fetch(`${BASE}/${collection}?documentId=${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(rest) }),
  });
  if (res.status === 409) {
    // Already exists — patch instead so re-running the script is idempotent.
    const patch = await fetch(`${BASE}/${collection}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFields(rest) }),
    });
    if (!patch.ok) throw new Error(`${collection}/${id}: ${patch.status} ${await patch.text()}`);
    return 'updated';
  }
  if (!res.ok) throw new Error(`${collection}/${id}: ${res.status} ${await res.text()}`);
  return 'created';
}

async function main() {
  console.log(`[seed] target  ${BASE}`);

  // Fail fast with a useful message if the emulator is not up.
  try {
    await fetch(`http://${HOST}/`);
  } catch {
    console.error(
      `[seed] cannot reach the Firestore emulator at ${HOST}.\n` +
        '[seed] Start it first with:  npm run emulators',
    );
    process.exit(1);
  }

  let n = 0;
  for (const w of WORKERS) { await put('workers', w.id, w); n++; }
  for (const j of JOBS) { await put('jobs', j.id, j); n++; }
  for (const r of REVIEWS) { await put('reviews', r.id, r); n++; }
  await put('meta', 'stats', STATS); n++;

  console.log(
    `[seed] done — ${WORKERS.length} workers, ${JOBS.length} jobs, ` +
      `${REVIEWS.length} reviews, 1 stats doc (${n} documents).`,
  );
  console.log('[seed] note: reviews are written directly here to give the UI data;');
  console.log('[seed]       in production they are created only by the submitReview function.');
}

main().catch((err) => {
  console.error('[seed] failed:', err.message);
  process.exit(1);
});
