import admin from 'firebase-admin';

let initialized = false;

function initFirebase() {
  if (initialized) return;
  const credsPath = process.env.FIREBASE_CREDENTIALS_PATH; // absolute or relative path to service account JSON
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (credsPath) {
    // Initialize with JSON file
    admin.initializeApp({
      credential: admin.credential.cert(require(credsPath)),
    });
  } else if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } else {
    // Last resort: initialize default (may work if running in GCP with ADC)
    admin.initializeApp();
  }
  initialized = true;
}

export function getMessaging() {
  initFirebase();
  return admin.messaging();
}

export function getAdmin() {
  initFirebase();
  return admin;
}
