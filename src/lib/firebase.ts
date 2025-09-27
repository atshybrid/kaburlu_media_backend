import admin from 'firebase-admin';

let initialized = false;

function initFirebase() {
  if (initialized) return;
  const credsPath = process.env.FIREBASE_CREDENTIALS_PATH; // absolute or relative path to service account JSON
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  console.log('[Firebase Init] Initializing Firebase Admin SDK...');
  console.log('[Firebase Init] Expected project ID: kaburlu-f0365');
  console.log('[Firebase Init] Environment project ID:', projectId || 'not set');

  if (credsPath) {
    console.log('[Firebase Init] Using credentials file:', credsPath);
    // Initialize with JSON file
    admin.initializeApp({
      credential: admin.credential.cert(require(credsPath)),
    });
  } else if (projectId && clientEmail && privateKey) {
    console.log('[Firebase Init] Using environment credentials for project:', projectId);
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('[Firebase Init] Using Google Application Default Credentials');
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } else {
    console.log('[Firebase Init] Using default initialization (ADC)');
    // Last resort: initialize default (may work if running in GCP with ADC)
    admin.initializeApp();
  }
  
  // Verify the initialized project ID
  try {
    const app = admin.app();
    const actualProjectId = app.options.projectId;
    console.log('[Firebase Init] Actual initialized project ID:', actualProjectId);
    
    if (actualProjectId !== 'kaburlu-f0365') {
      console.warn('[Firebase Init] WARNING: Project ID mismatch!');
      console.warn(`[Firebase Init] Expected: kaburlu-f0365, Got: ${actualProjectId}`);
      console.warn('[Firebase Init] This may cause audience mismatch errors in token verification');
    } else {
      console.log('[Firebase Init] ✅ Project ID verified correctly');
    }
  } catch (error) {
    console.error('[Firebase Init] Error verifying project ID:', error);
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
