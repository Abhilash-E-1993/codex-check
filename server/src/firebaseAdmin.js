import "dotenv/config";
import admin from "firebase-admin";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

const hasServiceAccountEnv =
  Boolean(projectId) &&
  Boolean(clientEmail) &&
  Boolean(privateKey);

if (!admin.apps.length) {
  if (hasServiceAccountEnv) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else {
    admin.initializeApp();
  }
}

export const db = admin.firestore();
export const messaging = admin.messaging();
export const auth = admin.auth();
export { admin };
