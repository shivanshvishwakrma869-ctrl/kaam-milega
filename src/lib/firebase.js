/**
 * Firebase bootstrap.
 *
 * Config comes from Vite env vars (VITE_FIREBASE_*), injected at build time by
 * Netlify. These values are NOT secrets — a Firebase web config is public by
 * design and is visible in any client bundle. What actually protects your data
 * is Firestore Security Rules + App Check, not hiding these strings.
 * See firebase/firestore.rules.
 *
 * If no config is present the app runs in DEMO MODE against local seed data,
 * so the UI is fully explorable before any backend exists.
 */

let app = null;
let auth = null;
let db = null;
let analytics = null;
let initPromise = null;

/**
 * `import.meta.env` only exists when the module is processed by Vite. The
 * prerender script and the unit tests import this file outside that pipeline,
 * where it is undefined — reading a property off it would throw at module
 * scope and take the whole build down. Default to an empty object so those
 * contexts simply fall through to demo mode.
 */
const ENV = import.meta.env ?? {};

const CONFIG = {
  apiKey: ENV.VITE_FIREBASE_API_KEY,
  authDomain: ENV.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: ENV.VITE_FIREBASE_PROJECT_ID,
  storageBucket: ENV.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.VITE_FIREBASE_APP_ID,
  measurementId: ENV.VITE_FIREBASE_MEASUREMENT_ID,
};

/** True when a real Firebase project is wired up. */
export const isConfigured = Boolean(CONFIG.apiKey && CONFIG.projectId);

/** True when we're falling back to local seed data. */
export const isDemoMode = !isConfigured;

/**
 * Lazily load the Firebase SDK. Keeping this dynamic means the ~120 KB of
 * Firebase JS never enters the critical path for a visitor who just reads the
 * landing page — it loads on first auth/data interaction instead.
 */
export async function initFirebase() {
  if (!isConfigured) return null;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const [{ initializeApp }, authMod, firestoreMod] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);

    app = initializeApp(CONFIG);
    auth = authMod.getAuth(app);
    db = firestoreMod.getFirestore(app);

    // App Check — blocks requests from outside your own front end.
    const siteKey = ENV.VITE_RECAPTCHA_SITE_KEY;
    if (siteKey) {
      try {
        const { initializeAppCheck, ReCaptchaV3Provider } = await import(
          'firebase/app-check'
        );
        if (ENV.DEV && ENV.VITE_APPCHECK_DEBUG) {
          self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(siteKey),
          isTokenAutoRefreshEnabled: true,
        });
      } catch (err) {
        console.warn('[firebase] App Check init failed', err);
      }
    }

    // Offline persistence — the target audience is on patchy mobile data.
    try {
      await firestoreMod.enableIndexedDbPersistence(db);
    } catch (err) {
      // failed-precondition = multiple tabs; unimplemented = unsupported browser
      if (err?.code !== 'failed-precondition' && err?.code !== 'unimplemented') {
        console.warn('[firebase] persistence unavailable', err);
      }
    }

    // Point at local emulators during development.
    if (ENV.DEV && ENV.VITE_USE_EMULATORS === 'true') {
      authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
        disableWarnings: true,
      });
      firestoreMod.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }

    return { app, auth, db, authMod, firestoreMod };
  })();

  return initPromise;
}

/** Analytics is opt-in — only loaded after the user accepts cookies. */
export async function initAnalytics() {
  if (!isConfigured || !CONFIG.measurementId || analytics) return null;
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    if (!(await isSupported())) return null;
    await initFirebase();
    analytics = getAnalytics(app);
    return analytics;
  } catch (err) {
    console.warn('[firebase] analytics unavailable', err);
    return null;
  }
}

export function getFirebase() {
  return { app, auth, db };
}
