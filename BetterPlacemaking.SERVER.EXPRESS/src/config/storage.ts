import { Storage, type Bucket } from "@google-cloud/storage";
import { env } from "./env.js";

let storage: Storage | undefined;

/**
 * GCS client init, mirroring the credential pattern in config/firebase.ts: this
 * project already uses a single GCP service account (GOOGLE_APPLICATION_CREDENTIALS)
 * for Firestore, and the ASP.NET server shared that same credential with GCS via
 * GoogleCredential.GetApplicationDefault() in CloudStorageService - so no separate
 * credential source is needed here. The `keyFilename` key must be omitted entirely
 * when unset, same reasoning as firebase.ts's `credential` key: passing it as
 * undefined explicitly would override the client's own ADC fallback.
 */
export function getStorage(): Storage {
  if (storage) return storage;

  storage = new Storage({
    ...(process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS }
      : {}),
    projectId: env.firebaseProjectId,
  });
  return storage;
}

export function getBucket(): Bucket {
  return getStorage().bucket(env.gcsBucketName);
}
