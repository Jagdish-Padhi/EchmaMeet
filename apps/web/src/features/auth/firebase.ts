import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth';

const apiKey = (import.meta.env['VITE_FIREBASE_API_KEY'] as string | undefined)?.trim();
const authDomain = (import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'] as string | undefined)?.trim();
const projectId = (import.meta.env['VITE_FIREBASE_PROJECT_ID'] as string | undefined)?.trim();
const appId = (import.meta.env['VITE_FIREBASE_APP_ID'] as string | undefined)?.trim();

export const isFirebaseConfigured = Boolean(apiKey && projectId);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

if (apiKey && projectId) {
  try {
    const config: Record<string, string> = {
      apiKey,
      authDomain: authDomain || `${projectId}.firebaseapp.com`,
      projectId,
    };
    if (appId) {
      config['appId'] = appId;
    }
    app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    auth = getAuth(app);
  } catch (err) {
    console.warn('Firebase initialization skipped:', err);
  }
}

export interface FirebaseGoogleResult {
  readonly idToken: string;
  readonly email?: string | undefined;
  readonly name?: string | undefined;
  readonly photoUrl?: string | undefined;
}

export async function signInWithGoogleFirebase(): Promise<FirebaseGoogleResult> {
  if (!auth) {
    throw new Error(
      'Firebase is not configured. Please add VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID to your .env file.',
    );
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  return {
    idToken,
    email: result.user.email ?? undefined,
    name: result.user.displayName ?? undefined,
    photoUrl: result.user.photoURL ?? undefined,
  };
}
