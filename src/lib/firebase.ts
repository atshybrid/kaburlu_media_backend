import admin from 'firebase-admin';
import { config } from '../config/env';

let initialized = false;

function initFirebase() {
  if (initialized) return;
  const { credsPath, projectId, clientEmail, privateKey } = config.firebase;

  try {
    if (credsPath) {
      console.log('[Firebase] init via credentials file');
      admin.initializeApp({ credential: admin.credential.cert(require(credsPath)) });
    } else if (projectId && clientEmail && privateKey) {
      console.log('[Firebase] init via inline service account');
      admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('[Firebase] init via ADC');
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
      console.log('[Firebase] init fallback default');
      admin.initializeApp();
    }
    const actual = admin.app().options.projectId;
    if (projectId && actual && projectId !== actual) {
      console.warn(`[Firebase] WARN project mismatch env=${projectId} actual=${actual}`);
    }
    initialized = true;
  } catch (e) {
    console.error('[Firebase] Initialization failed:', e);
    throw e;
  }
}

export function getMessaging() {
  initFirebase();
  return admin.messaging();
}

export function getAdmin() {
  initFirebase();
  return admin;
}
