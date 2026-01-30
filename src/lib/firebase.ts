import admin from 'firebase-admin';
import { config } from '../config/env';
import * as fs from 'fs';

let initialized = false;
let initError: Error | null = null;

function initFirebase() {
  if (initialized) return;
  if (initError) throw initError;

  const { credsPath, projectId, clientEmail, privateKey: rawPrivateKey } = config.firebase;
  
  // Convert literal \n to actual newlines (common issue with env vars)
  const privateKey = rawPrivateKey?.replace(/\\n/g, '\n');

  try {
    // Check if credsPath exists AND the file actually exists
    const hasValidCredsFile = credsPath && fs.existsSync(credsPath);
    
    if (hasValidCredsFile) {
      console.log('[Firebase] init via credentials file:', credsPath);
      admin.initializeApp({ credential: admin.credential.cert(require(credsPath)) });
    } else if (projectId && clientEmail && privateKey) {
      console.log('[Firebase] init via inline service account');
      console.log('[Firebase] Project:', projectId);
      console.log('[Firebase] Client Email:', clientEmail);
      console.log('[Firebase] Private Key:', privateKey ? `[${privateKey.length} chars, has newlines: ${privateKey.includes('\n')}]` : 'MISSING');
      admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('[Firebase] init via ADC');
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
      const missing = [];
      if (!projectId) missing.push('FIREBASE_PROJECT_ID');
      if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
      if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
      console.error('[Firebase] Missing credentials:', missing.join(', '));
      console.log('[Firebase] init fallback default (will likely fail for FCM)');
      admin.initializeApp();
    }
    const actual = admin.app().options.projectId;
    console.log('[Firebase] Initialized successfully, project:', actual);
    if (projectId && actual && projectId !== actual) {
      console.warn(`[Firebase] WARN project mismatch env=${projectId} actual=${actual}`);
    }
    initialized = true;
  } catch (e) {
    console.error('[Firebase] Initialization failed:', e);
    initError = e as Error;
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
