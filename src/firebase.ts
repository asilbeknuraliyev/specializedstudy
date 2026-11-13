import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import appletFirebaseConfig from '../firebase-applet-config.json';

const envMeta = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

export const resolvedFirebaseConfig = {
  apiKey: String(envMeta.VITE_FIREBASE_API_KEY || appletFirebaseConfig.apiKey || '').trim(),
  authDomain: String(
    (typeof window!=='undefined'&&window.location.hostname==='specializedstudy.vercel.app'?'specializedstudy.vercel.app':envMeta.VITE_FIREBASE_AUTH_DOMAIN || appletFirebaseConfig.authDomain || '')
  ).trim(),
  projectId: String(
    envMeta.VITE_FIREBASE_PROJECT_ID || appletFirebaseConfig.projectId || ''
  ).trim(),
  appId: String(envMeta.VITE_FIREBASE_APP_ID || appletFirebaseConfig.appId || '').trim(),
  storageBucket: String(
    envMeta.VITE_FIREBASE_STORAGE_BUCKET || appletFirebaseConfig.storageBucket || ''
  ).trim(),
  messagingSenderId: String(
    envMeta.VITE_FIREBASE_MESSAGING_SENDER_ID || appletFirebaseConfig.messagingSenderId || ''
  ).trim(),
  firestoreDatabaseId: String(
    envMeta.VITE_FIREBASE_FIRESTORE_DATABASE_ID || appletFirebaseConfig.firestoreDatabaseId || ''
  ).trim(),
};

export interface RuntimeAuthDomainDiagnostics {
  origin: string;
  hostname: string;
  protocol: string;
  projectId: string;
  authDomain: string;
  appId: string;
  isLocalhost: boolean;
  isVercelDomain: boolean;
  isVercelPreviewDomain: boolean;
  isFirebaseHostedDomain: boolean;
  isCloudRunDomain: boolean;
  recommendedAuthorizedDomains: string[];
}

export function getRuntimeAuthDomainDiagnostics(
  overrideOrigin?: string,
  overrideHostname?: string
): RuntimeAuthDomainDiagnostics {
  const origin =
    overrideOrigin !== undefined
      ? overrideOrigin
      : typeof window !== 'undefined' && window.location
      ? window.location.origin
      : 'http://localhost:3000';
  const hostname = (
    overrideHostname !== undefined
      ? overrideHostname
      : typeof window !== 'undefined' && window.location
      ? window.location.hostname
      : 'localhost'
  )
    .trim()
    .toLowerCase();
  const protocol =
    typeof window !== 'undefined' && window.location
      ? window.location.protocol
      : origin.startsWith('https:')
      ? 'https:'
      : 'http:';

  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isVercelDomain = hostname.endsWith('.vercel.app');
  // Vercel preview URLs typically contain -git-<branch>- or a 9-char deployment hash segment before .vercel.app
  const vercelSubdomain = isVercelDomain ? hostname.replace(/\.vercel\.app$/, '') : '';
  const isVercelPreviewDomain =
    isVercelDomain &&
    (vercelSubdomain.includes('-git-') ||
      /-[a-z0-9]{9}-[a-z0-9-]+$/i.test(vercelSubdomain) ||
      vercelSubdomain.split('-').length >= 4);
  const isFirebaseHostedDomain =
    hostname.endsWith('.firebaseapp.com') || hostname.endsWith('.web.app');
  const isCloudRunDomain = hostname.endsWith('.run.app');

  const recommended = new Set<string>([
    'localhost',
    resolvedFirebaseConfig.authDomain,
    `${resolvedFirebaseConfig.projectId}.web.app`,
  ]);
  if (hostname) {
    recommended.add(hostname);
  }

  return {
    origin,
    hostname,
    protocol,
    projectId: resolvedFirebaseConfig.projectId,
    authDomain: resolvedFirebaseConfig.authDomain,
    appId: resolvedFirebaseConfig.appId,
    isLocalhost,
    isVercelDomain,
    isVercelPreviewDomain,
    isFirebaseHostedDomain,
    isCloudRunDomain,
    recommendedAuthorizedDomains: Array.from(recommended).filter(Boolean),
  };
}

const app = initializeApp(resolvedFirebaseConfig);
export const auth = getAuth(app);

export function createGoogleAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
