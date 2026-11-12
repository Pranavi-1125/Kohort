
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'node:fs';
import 'dotenv/config';

let ready = false;

function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    );
  }

  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (p && fs.existsSync(p)) {
    return cert(
      JSON.parse(fs.readFileSync(p, 'utf8'))
    );
  }

  return null;
}

try {
  const credential = loadCredential();

  if (credential) {
    initializeApp({
      credential,
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });

    ready = true;
    console.log('[firebase] Admin initialized successfully.');
  } else {
    console.warn(
      '[firebase] No service account configured. Auth and realtime mirroring are disabled.'
    );
  }
} catch (e) {
  console.error('[firebase] Failed to initialise:', e.message);
}

export const firebaseReady = () => ready;
export const auth = () => getAuth();
export const firestore = () => getFirestore();
export const serverTs = () => FieldValue.serverTimestamp();
