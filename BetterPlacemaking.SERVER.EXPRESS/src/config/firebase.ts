import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { env } from "./env.js";

let firestore: Firestore | undefined;

export function getDb(): Firestore {
  if (firestore) return firestore;

  if (getApps().length === 0) {
    // Uses GOOGLE_APPLICATION_CREDENTIALS if set, otherwise ambient/default credentials
    // (matches the ASP.NET server's FirestoreDbBuilder behavior). The `credential` key
    // must be omitted entirely when unset - passing `credential: undefined` explicitly
    // fails firebase-admin's options validation instead of falling back to ADC.
    initializeApp({
      ...(process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? { credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS) }
        : {}),
      projectId: env.firebaseProjectId,
    });
  }

  firestore =
    env.firebaseDatabaseId && env.firebaseDatabaseId !== "(default)"
      ? getFirestore(env.firebaseDatabaseId)
      : getFirestore();
  return firestore;
}
