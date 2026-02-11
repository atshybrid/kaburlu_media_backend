import { getAdmin } from './firebase';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/env';

function parseGoogleClientIds(): string[] {
  const raw = (process.env.GOOGLE_CLIENT_ID || (process.env as any).GOOGLE_WEB_CLIENT_ID || config.google?.clientId || '') as string;
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

// Initialize OAuth2 client lazily (client ID is passed as audience during verification)
const googleClient = new OAuth2Client();

export interface TokenVerificationResult {
  success: boolean;
  firebaseUid: string;
  email?: string;
  verificationMethod: 'firebase' | 'google';
  error?: string;
  audience?: string;
  issuer?: string;
}

/**
 * Comprehensive token verification utility that handles both Firebase and Google OAuth tokens
 * 
 * Priority order:
 * 1. Try firebaseIdToken with Firebase Admin SDK (preferred)
 * 2. Fall back to googleIdToken with google-auth-library (for raw Google OAuth tokens)
 * 
 * @param tokens Object containing either firebaseIdToken or googleIdToken (or both)
 * @returns TokenVerificationResult with verification details and diagnostic info
 */
export async function verifyToken(tokens: {
  firebaseIdToken?: string;
  googleIdToken?: string;
}): Promise<TokenVerificationResult> {
  const { firebaseIdToken, googleIdToken } = tokens;

  console.log('[Token Verification] Starting token verification process...');
  console.log('[Token Verification] Received tokens:', {
    hasFirebaseIdToken: !!firebaseIdToken,
    hasGoogleIdToken: !!googleIdToken,
    firebaseTokenPrefix: firebaseIdToken ? firebaseIdToken.substring(0, 50) + '...' : 'none',
    googleTokenPrefix: googleIdToken ? googleIdToken.substring(0, 50) + '...' : 'none'
  });

  // Validate inputs
  if (!firebaseIdToken && !googleIdToken) {
    console.error('[Token Verification] ERROR: No tokens provided');
    return {
      success: false,
      firebaseUid: '',
      verificationMethod: 'firebase',
      error: 'Either firebaseIdToken or googleIdToken is required'
    };
  }

  // Method 1: Try Firebase ID token first (preferred)
  if (firebaseIdToken) {
    console.log('[Token Verification] Attempting Firebase Admin SDK verification...');
    try {
      const admin = getAdmin();
      const decoded = await admin.auth().verifyIdToken(firebaseIdToken);
      
      console.log('[Token Verification] ✅ Firebase verification successful');
      console.log('[Token Verification] Firebase token details:', {
        uid: decoded.uid,
        email: decoded.email,
        aud: decoded.aud,
        iss: decoded.iss,
        exp: new Date(decoded.exp * 1000).toISOString(),
        iat: new Date(decoded.iat * 1000).toISOString()
      });

      return {
        success: true,
        firebaseUid: decoded.uid,
        email: decoded.email,
        verificationMethod: 'firebase',
        audience: decoded.aud,
        issuer: decoded.iss
      };
    } catch (error: any) {
      console.warn('[Token Verification] Firebase verification failed:', error.message);
      console.warn('[Token Verification] Firebase error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack?.split('\n')[0] // Just first line of stack
      });
      
      // If we have a Google token, try that as fallback
      if (!googleIdToken) {
        return {
          success: false,
          firebaseUid: '',
          verificationMethod: 'firebase',
          error: `Firebase verification failed: ${error.message}`,
          audience: error.code === 'auth/argument-error' ? 'invalid-audience' : undefined
        };
      }
    }
  }

  // Method 2: Try Google OAuth token verification (fallback)
  if (googleIdToken) {
    console.log('[Token Verification] Attempting Google OAuth verification...');

    const googleClientIds = parseGoogleClientIds();
    if (googleClientIds.length === 0) {
      console.error('[Token Verification] ERROR: Google OAuth Client ID not configured');
      return {
        success: false,
        firebaseUid: '',
        verificationMethod: 'google',
        error: 'Google Client ID not configured in environment (set GOOGLE_CLIENT_ID or GOOGLE_WEB_CLIENT_ID)'
      };
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: googleIdToken,
        audience: googleClientIds
      });
      
      const payload = ticket.getPayload();
      if (!payload) {
        console.error('[Token Verification] ERROR: No payload in Google token');
        return {
          success: false,
          firebaseUid: '',
          verificationMethod: 'google',
          error: 'Invalid Google token payload'
        };
      }

      console.log('[Token Verification] ✅ Google OAuth verification successful');
      console.log('[Token Verification] Google token details:', {
        sub: payload.sub,
        email: payload.email,
        aud: payload.aud,
        iss: payload.iss,
        exp: new Date(payload.exp! * 1000).toISOString(),
        iat: new Date(payload.iat! * 1000).toISOString(),
        email_verified: payload.email_verified
      });

      // For Google OAuth tokens, we use the 'sub' as the Firebase UID
      // This should match what was stored when the user was created via Firebase Auth
      return {
        success: true,
        firebaseUid: payload.sub!,
        email: payload.email,
        verificationMethod: 'google',
        audience: payload.aud,
        issuer: payload.iss
      };
    } catch (error: any) {
      console.error('[Token Verification] Google OAuth verification failed:', error.message);
      console.error('[Token Verification] Google error details:', {
        message: error.message,
        stack: error.stack?.split('\n')[0] // Just first line of stack
      });
      
      return {
        success: false,
        firebaseUid: '',
        verificationMethod: 'google',
        error: `Google OAuth verification failed: ${error.message}`,
        audience: error.message.includes('audience') ? 'audience-mismatch' : undefined
      };
    }
  }

  // This should never be reached due to validation at the top
  return {
    success: false,
    firebaseUid: '',
    verificationMethod: 'firebase',
    error: 'No valid tokens provided'
  };
}

/**
 * Legacy function for backwards compatibility
 * @deprecated Use verifyToken instead
 */
export async function verifyGoogleIdToken(googleIdToken: string): Promise<TokenVerificationResult> {
  console.warn('[Token Verification] WARNING: Using deprecated verifyGoogleIdToken, consider migrating to verifyToken');
  return verifyToken({ googleIdToken });
}

/**
 * Legacy function for backwards compatibility  
 * @deprecated Use verifyToken instead
 */
export async function verifyFirebaseIdToken(firebaseIdToken: string): Promise<TokenVerificationResult> {
  console.warn('[Token Verification] WARNING: Using deprecated verifyFirebaseIdToken, consider migrating to verifyToken');
  return verifyToken({ firebaseIdToken });
}